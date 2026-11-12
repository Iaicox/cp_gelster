<?php

declare(strict_types=1);

require_once __DIR__ . '/../../api/lib/bootstrap.php';
require_once __DIR__ . '/../../api/lib/fetch_allowed.php';

const TEST_HOSTS = ['gelster.ru', 'www.gelster.ru', 'ooogelingen.ru', 'www.ooogelingen.ru'];
const PUBLIC_IP = '93.184.216.34';

/**
 * Fake transport: answers from a map url => response (status, headers, body, primaryIp) and records the calls.
 * An unknown URL fails the test, so a request that should never be made is caught.
 */
function fake_transport(array $responses, array &$calls = []): Closure
{
    return static function (string $url, int $maxBytes) use ($responses, &$calls): array {
        $calls[] = $url;
        if (!isset($responses[$url])) {
            throw new RuntimeException('unexpected request to ' . $url);
        }
        return $responses[$url] + ['status' => 200, 'headers' => [], 'body' => '', 'primaryIp' => PUBLIC_IP];
    };
}

function html_response(string $body = '<html></html>'): array
{
    return ['headers' => ['content-type' => 'text/html; charset=utf-8'], 'body' => $body];
}

function redirect_to(string $location): array
{
    return ['status' => 302, 'headers' => ['location' => $location]];
}

function expect_refusal(int $status, string $url, array $responses = [], int $max = 1000): void
{
    $calls = [];
    $e = expect_throws(FetchError::class, fn() => fetch_allowed($url, TEST_HOSTS, $max, fake_transport($responses, $calls)));
    assert_same($status, $e->httpStatus, 'status for ' . $url);
}

test('fetch: an allowed https URL is downloaded', function (): void {
    $calls = [];
    $result = fetch_allowed('https://gelster.ru/catalog/x/', TEST_HOSTS, 1000, fake_transport([
        'https://gelster.ru/catalog/x/' => html_response('<p>ok</p>'),
    ], $calls));
    assert_same('<p>ok</p>', $result['body']);
    assert_same('https://gelster.ru/catalog/x/', $result['url']);
    assert_same('text/html; charset=utf-8', $result['contentType']);
    assert_same(['https://gelster.ru/catalog/x/'], $calls);
});

test('fetch: host case and :443 are normalized, fragment dropped, query kept', function (): void {
    $calls = [];
    fetch_allowed('HTTPS://WWW.Gelster.RU:443/a?b=1#frag', TEST_HOSTS, 1000, fake_transport([
        'https://www.gelster.ru/a?b=1' => html_response(),
    ], $calls));
    assert_same(['https://www.gelster.ru/a?b=1'], $calls);
});

test('fetch: refuses a foreign host', fn() => expect_refusal(400, 'https://evil.com/'));
test('fetch: refuses http', fn() => expect_refusal(400, 'http://gelster.ru/'));
test('fetch: refuses other schemes', function (): void {
    foreach (['file:///etc/passwd', 'ftp://gelster.ru/', 'gopher://gelster.ru/', '//gelster.ru/', 'gelster.ru'] as $url) {
        expect_refusal(400, $url);
    }
});
test('fetch: refuses a port other than 443', function (): void {
    expect_refusal(400, 'https://gelster.ru:8443/');
    expect_refusal(400, 'https://gelster.ru:80/');
});
test('fetch: refuses credentials in the URL', function (): void {
    expect_refusal(400, 'https://user:pass@gelster.ru/');
    expect_refusal(400, 'https://user@gelster.ru/');
    expect_refusal(400, 'https://@gelster.ru/');
    expect_refusal(400, 'https://evil.com@gelster.ru/');
    expect_refusal(400, 'https://gelster.ru@evil.com/');
});
test('fetch: refuses look-alike hosts (exact match only)', function (): void {
    foreach (['https://gelster.ru.evil.com/', 'https://evilgelster.ru/', 'https://gelster.ru./', 'https://xgelster.ru/',
        'https://sub.gelster.ru/', 'https://gelster.ru\\@evil.com/', 'https://gelster.ru%2eevil.com/'] as $url) {
        expect_refusal(400, $url);
    }
});
test('fetch: refuses whitespace and control characters', function (): void {
    expect_refusal(400, "https://gelster.ru/\r\nHost: evil.com");
    expect_refusal(400, 'https://gelster.ru/ a');
});
test('fetch: Cyrillic in a path is percent-encoded', function (): void {
    $calls = [];
    fetch_allowed('https://gelster.ru/каталог/', TEST_HOSTS, 1000, fake_transport([
        'https://gelster.ru/%D0%BA%D0%B0%D1%82%D0%B0%D0%BB%D0%BE%D0%B3/' => html_response(),
    ], $calls));
    assert_same(1, count($calls));
});

test('fetch: follows a redirect to an allowed host and reports the final URL', function (): void {
    $result = fetch_allowed('https://gelster.ru/a', TEST_HOSTS, 1000, fake_transport([
        'https://gelster.ru/a' => redirect_to('https://www.gelster.ru/a'),
        'https://www.gelster.ru/a' => redirect_to('/b/'),
        'https://www.gelster.ru/b/' => redirect_to('c?x=1'),
        'https://www.gelster.ru/b/c?x=1' => html_response('final'),
    ]));
    assert_same('final', $result['body']);
    assert_same('https://www.gelster.ru/b/c?x=1', $result['url']);
});

test('fetch: refuses a redirect outside the allowed hosts', function (): void {
    $calls = [];
    $transport = fake_transport(['https://gelster.ru/a' => redirect_to('https://evil.com/')], $calls);
    $e = expect_throws(FetchError::class, fn() => fetch_allowed('https://gelster.ru/a', TEST_HOSTS, 1000, $transport));
    assert_same(502, $e->httpStatus);
    assert_same(['https://gelster.ru/a'], $calls, 'the foreign URL is never requested');
    expect_refusal(502, 'https://gelster.ru/a', ['https://gelster.ru/a' => redirect_to('http://gelster.ru/a')]);
    expect_refusal(502, 'https://gelster.ru/a', ['https://gelster.ru/a' => redirect_to('//gelster.ru.evil.com/')]);
    expect_refusal(502, 'https://gelster.ru/a', ['https://gelster.ru/a' => redirect_to('https://127.0.0.1/')]);
});

test('fetch: refuses the fourth redirect', function (): void {
    $calls = [];
    $transport = fake_transport([
        'https://gelster.ru/0' => redirect_to('/1'),
        'https://gelster.ru/1' => redirect_to('/2'),
        'https://gelster.ru/2' => redirect_to('/3'),
        'https://gelster.ru/3' => redirect_to('/4'),
        'https://gelster.ru/4' => html_response(),
    ], $calls);
    $e = expect_throws(FetchError::class, fn() => fetch_allowed('https://gelster.ru/0', TEST_HOSTS, 1000, $transport));
    assert_same(502, $e->httpStatus);
    assert_same(4, count($calls), 'three redirects followed, the fourth refused');
});

test('fetch: refuses an oversized body', function (): void {
    expect_refusal(502, 'https://gelster.ru/', ['https://gelster.ru/' => html_response(str_repeat('a', 1001))], 1000);
});

test('fetch: refuses a response from a private or service IP', function (): void {
    foreach (['127.0.0.1', '10.1.2.3', '192.168.0.10', '172.16.5.5', '169.254.169.254', '100.100.1.1', '0.0.0.0',
        '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '', 'garbage'] as $ip) {
        expect_refusal(502, 'https://gelster.ru/', ['https://gelster.ru/' => html_response() + ['primaryIp' => $ip]]);
    }
});

test('fetch: non-200 answers are refused with 502', function (): void {
    expect_refusal(502, 'https://gelster.ru/', ['https://gelster.ru/' => ['status' => 404]]);
    expect_refusal(502, 'https://gelster.ru/', ['https://gelster.ru/' => ['status' => 302]]);
});

test('fetch: transport failure surfaces as FetchError', function (): void {
    $e = expect_throws(FetchError::class, fn() => fetch_allowed('https://gelster.ru/', TEST_HOSTS, 10,
        static fn() => throw new FetchError(502, 'down')));
    assert_same(502, $e->httpStatus);
});

test('is_public_ip: public addresses pass, special ones do not', function (): void {
    foreach (['93.184.216.34', '8.8.8.8', '2606:4700::1111'] as $ip) {
        assert_true(is_public_ip($ip), $ip);
    }
    foreach (['127.0.0.1', '10.0.0.1', '100.64.0.1', '169.254.1.1', '192.0.2.1', '224.0.0.1', '255.255.255.255',
        '::', '::1', 'fc00::1', 'fe80::1', '::ffff:10.0.0.1', '64:ff9b::a00:1', '2001:db8::1', '2002::1'] as $ip) {
        assert_same(false, is_public_ip($ip), $ip);
    }
});

test('is_html_content_type: only text/html', function (): void {
    assert_true(is_html_content_type('text/html'));
    assert_true(is_html_content_type('Text/HTML; charset=windows-1251'));
    foreach (['', 'application/json', 'text/plain', 'image/png', 'text/htmlx', 'application/xhtml+xml'] as $type) {
        assert_same(false, is_html_content_type($type), $type);
    }
});

test('detect_image_type: by signature bytes, not by name or header', function (): void {
    assert_same('image/jpeg', detect_image_type(file_get_contents(__DIR__ . '/../../api/seed/signatures/max_mal.jpg')));
    assert_same('image/png', detect_image_type("\x89PNG\r\n\x1A\n...."));
    assert_same('image/gif', detect_image_type('GIF89a....'));
    assert_same('image/webp', detect_image_type('RIFF1234WEBPVP8 '));
    foreach (['', '<html>', '<svg xmlns="http://www.w3.org/2000/svg"/>', '<?php echo 1;', 'RIFF1234WAVE'] as $bytes) {
        assert_same(null, detect_image_type($bytes), $bytes);
    }
});

test('resolve_location: absolute, scheme-relative, absolute path, relative, dot segments', function (): void {
    $base = 'https://gelster.ru/a/b/c?q=1';
    assert_same('https://x.ru/y', resolve_location($base, 'https://x.ru/y'));
    assert_same('https://x.ru/y', resolve_location($base, '//x.ru/y'));
    assert_same('https://gelster.ru/z', resolve_location($base, '/z'));
    assert_same('https://gelster.ru/a/b/d', resolve_location($base, 'd'));
    assert_same('https://gelster.ru/a/d', resolve_location($base, '../d'));
    assert_same('https://gelster.ru/a/b/c?n=2', resolve_location($base, '?n=2'));
});

test('limited writer aborts the download once the limit is passed', function (): void {
    $buffer = '';
    $exceeded = false;
    $write = make_limited_writer($buffer, 10, $exceeded);
    assert_same(6, $write(null, 'abcdef'));
    assert_same(4, $write(null, 'ghij'));
    assert_same(0, $write(null, 'k'), 'short count stops cURL');
    assert_true($exceeded);
    assert_same('abcdefghij', $buffer);
});

test('curl transport source: no FOLLOWLOCATION, TLS verification on, https only', function (): void {
    $source = '';
    foreach (array_merge(glob(__DIR__ . '/../../api/*.php'), glob(__DIR__ . '/../../api/*/*.php')) as $file) {
        $source .= file_get_contents($file);
    }
    assert_same(0, preg_match('/FOLLOWLOCATION\s*=>\s*true/i', $source), 'FOLLOWLOCATION true');
    assert_same(0, preg_match('/SSL_VERIFYPEER\s*=>\s*(false|0)/i', $source), 'VERIFYPEER off');
    assert_same(0, preg_match('/SSL_VERIFYHOST\s*=>\s*[01]\b/i', $source), 'VERIFYHOST off');
    assert_same(0, preg_match('/file_get_contents\s*\(\s*\$url/i', $source), 'file_get_contents by URL');
    $lib = file_get_contents(__DIR__ . '/../../api/lib/fetch_allowed.php');
    assert_true(str_contains($lib, 'CURLOPT_PROTOCOLS => CURLPROTO_HTTPS'));
    assert_true(str_contains($lib, 'CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS'));
    assert_true(str_contains($lib, 'CURLOPT_FOLLOWLOCATION => false'));
});
