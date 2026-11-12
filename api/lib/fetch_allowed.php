<?php

declare(strict_types=1);

// The only place where PHP downloads a URL that came from the client.
// Checks: https only, exact host from allowed_hosts, no credentials, port empty or 443, manual redirects
// (at most 3, each re-checked), public IP of the connected peer, size limit while downloading.
// The network is behind a "transport" callable so the rules are tested without network access.

const FETCH_MAX_REDIRECTS = 3;
const FETCH_CONNECT_TIMEOUT = 5;
const FETCH_TOTAL_TIMEOUT = 15;
const FETCH_PAGE_MAX_BYTES = 5 * 1024 * 1024;
const FETCH_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/** A refusal with the HTTP status the endpoint should answer and a Russian message for the user. */
final class FetchError extends RuntimeException
{
    public function __construct(public readonly int $httpStatus, string $message)
    {
        parent::__construct($message);
    }
}

/**
 * Validates a URL and returns its normalized form built from the parsed parts (so cURL never sees anything
 * the check did not), or null when the URL is not allowed.
 *
 * @param list<string> $allowedHosts
 */
function normalize_allowed_url(string $url, array $allowedHosts): ?string
{
    if (strlen($url) > 2048 || preg_match('/[\x00-\x20\x7f\\\\]/', $url) === 1) {
        return null;
    }
    // Non-ASCII characters (e.g. Cyrillic in a path) are percent-encoded byte by byte.
    $url = preg_replace_callback('/[\x80-\xff]/', static fn(array $m): string => rawurlencode($m[0]), $url);
    if (stripos($url, 'https://') !== 0) {
        return null;
    }
    $parts = parse_url($url);
    if (!is_array($parts) || !isset($parts['scheme'], $parts['host'])) {
        return null;
    }
    if (strtolower($parts['scheme']) !== 'https' || isset($parts['user']) || isset($parts['pass'])) {
        return null;
    }
    // parse_url() drops an empty "user@" part; any "@" before the path means credentials.
    $authority = substr($url, 8, strcspn($url, '/?#', 8));
    if (str_contains($authority, '@')) {
        return null;
    }
    if (isset($parts['port']) && $parts['port'] !== 443) {
        return null;
    }
    $host = strtolower($parts['host']);
    $allowed = array_map('strtolower', $allowedHosts);
    if (!in_array($host, $allowed, true)) {
        return null;
    }
    $path = $parts['path'] ?? '/';
    if ($path === '' || $path[0] !== '/') {
        return null;
    }
    $query = isset($parts['query']) ? '?' . $parts['query'] : '';
    return 'https://' . $host . $path . $query;
}

/** Resolves a Location header against the URL that returned it. */
function resolve_location(string $base, string $location): string
{
    $location = trim($location);
    if (preg_match('#^[a-z][a-z0-9+.-]*:#i', $location) === 1) {
        return $location;
    }
    $parts = parse_url($base);
    $origin = ($parts['scheme'] ?? 'https') . '://' . ($parts['host'] ?? '');
    if (str_starts_with($location, '//')) {
        return ($parts['scheme'] ?? 'https') . ':' . $location;
    }
    if (str_starts_with($location, '/')) {
        return $origin . $location;
    }
    $basePath = $parts['path'] ?? '/';
    if (str_starts_with($location, '?')) {
        return $origin . $basePath . $location;
    }
    $dir = substr($basePath, 0, (int) strrpos($basePath, '/') + 1);
    $segments = [];
    foreach (explode('/', $dir . $location) as $segment) {
        if ($segment === '..') {
            array_pop($segments);
        } elseif ($segment !== '.') {
            $segments[] = $segment;
        }
    }
    $path = implode('/', $segments);
    return $origin . (str_starts_with($path, '/') ? $path : '/' . $path);
}

/** True when $ip lies in $cidr (both of the same family). */
function ip_in_cidr(string $ip, string $cidr): bool
{
    [$net, $bits] = explode('/', $cidr);
    $ipBin = @inet_pton($ip);
    $netBin = @inet_pton($net);
    if ($ipBin === false || $netBin === false || strlen($ipBin) !== strlen($netBin)) {
        return false;
    }
    $bits = (int) $bits;
    $bytes = intdiv($bits, 8);
    if (substr($ipBin, 0, $bytes) !== substr($netBin, 0, $bytes)) {
        return false;
    }
    $rest = $bits % 8;
    if ($rest === 0) {
        return true;
    }
    $mask = (0xff << (8 - $rest)) & 0xff;
    return (ord($ipBin[$bytes]) & $mask) === (ord($netBin[$bytes]) & $mask);
}

/** True for a public unicast address; private, loopback, link-local, CGNAT, reserved and similar are false. */
function is_public_ip(string $ip): bool
{
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
        return false;
    }
    $blocked = [
        '0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16', '172.16.0.0/12',
        '192.0.0.0/24', '192.0.2.0/24', '192.88.99.0/24', '192.168.0.0/16', '198.18.0.0/15', '198.51.100.0/24',
        '203.0.113.0/24', '224.0.0.0/4', '240.0.0.0/4',
        '::/128', '::1/128', '::ffff:0:0/96', '64:ff9b::/96', '64:ff9b:1::/48', '100::/64', '2001::/23',
        '2001:db8::/32', '2002::/16', 'fc00::/7', 'fe80::/10', 'fec0::/10', 'ff00::/8',
    ];
    foreach ($blocked as $cidr) {
        if (ip_in_cidr($ip, $cidr)) {
            return false;
        }
    }
    return true;
}

/**
 * Downloads an allowed URL through $transport, following up to 3 redirects by hand.
 * $transport(string $url, int $maxBytes): array{status:int, headers:array<string,string>, body:string, primaryIp:string}
 * (header names in lower case); it throws FetchError on network failure or when the body exceeds $maxBytes.
 *
 * @param list<string> $allowedHosts
 * @return array{url:string, contentType:string, body:string}
 */
function fetch_allowed(string $url, array $allowedHosts, int $maxBytes, callable $transport): array
{
    $current = normalize_allowed_url($url, $allowedHosts);
    if ($current === null) {
        throw new FetchError(400, 'Адрес не разрешён: допускаются только https-ссылки на gelster.ru и ooogelingen.ru.');
    }
    for ($redirects = 0; ; $redirects++) {
        $response = $transport($current, $maxBytes);
        if (!is_public_ip((string) ($response['primaryIp'] ?? ''))) {
            throw new FetchError(502, 'Сайт недоступен: адрес сервера не прошёл проверку.');
        }
        if (strlen($response['body']) > $maxBytes) {
            throw new FetchError(502, 'Сайт недоступен: слишком большой ответ.');
        }
        $status = $response['status'];
        if ($status >= 300 && $status < 400 && isset($response['headers']['location'])) {
            if ($redirects >= FETCH_MAX_REDIRECTS) {
                throw new FetchError(502, 'Сайт недоступен: слишком много перенаправлений.');
            }
            $next = normalize_allowed_url(resolve_location($current, $response['headers']['location']), $allowedHosts);
            if ($next === null) {
                throw new FetchError(502, 'Сайт перенаправил на неразрешённый адрес.');
            }
            $current = $next;
            continue;
        }
        if ($status !== 200) {
            throw new FetchError(502, "Сайт недоступен: ответ {$status}.");
        }
        return [
            'url' => $current,
            'contentType' => (string) ($response['headers']['content-type'] ?? ''),
            'body' => $response['body'],
        ];
    }
}

/** True when a Content-Type header names text/html. */
function is_html_content_type(string $contentType): bool
{
    return strtolower(trim(explode(';', $contentType, 2)[0])) === 'text/html';
}

/** MIME type of an image recognised by its first bytes (jpeg, png, gif, webp), otherwise null. */
function detect_image_type(string $bytes): ?string
{
    return match (true) {
        str_starts_with($bytes, "\xFF\xD8\xFF") => 'image/jpeg',
        str_starts_with($bytes, "\x89PNG\r\n\x1A\n") => 'image/png',
        str_starts_with($bytes, 'GIF87a'), str_starts_with($bytes, 'GIF89a') => 'image/gif',
        strlen($bytes) >= 12 && str_starts_with($bytes, 'RIFF') && substr($bytes, 8, 4) === 'WEBP' => 'image/webp',
        default => null,
    };
}

/**
 * cURL write callback that keeps the body in $buffer and aborts the transfer once it grows past $maxBytes
 * (returning a short count makes cURL stop with CURLE_WRITE_ERROR). $exceeded is set when that happened.
 */
function make_limited_writer(string &$buffer, int $maxBytes, bool &$exceeded): Closure
{
    return static function ($handle, string $chunk) use (&$buffer, $maxBytes, &$exceeded): int {
        if (strlen($buffer) + strlen($chunk) > $maxBytes) {
            $exceeded = true;
            return 0;
        }
        $buffer .= $chunk;
        return strlen($chunk);
    };
}

/**
 * The real transport: one HTTPS GET without following redirects, with TLS verification, timeouts,
 * a size limit enforced while downloading and a refusal to connect to non-public addresses.
 *
 * @return array{status:int, headers:array<string,string>, body:string, primaryIp:string}
 */
function curl_transport(string $url, int $maxBytes): array
{
    $handle = curl_init();
    $body = '';
    $exceeded = false;
    $headers = [];
    curl_setopt_array($handle, [
        CURLOPT_URL => $url,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_CONNECTTIMEOUT => FETCH_CONNECT_TIMEOUT,
        CURLOPT_TIMEOUT => FETCH_TOTAL_TIMEOUT,
        CURLOPT_MAXFILESIZE => $maxBytes,
        CURLOPT_PROXY => '',
        CURLOPT_ENCODING => '',
        CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; GelsterKP/1.0)',
        CURLOPT_HTTPHEADER => ['Accept: */*'],
        CURLOPT_WRITEFUNCTION => make_limited_writer($body, $maxBytes, $exceeded),
        CURLOPT_HEADERFUNCTION => static function ($h, string $line) use (&$headers): int {
            $pos = strpos($line, ':');
            if ($pos !== false) {
                $headers[strtolower(trim(substr($line, 0, $pos)))] = trim(substr($line, $pos + 1));
            }
            return strlen($line);
        },
        // Checked again by fetch_allowed(); here it stops the request before anything is sent.
        CURLOPT_PREREQFUNCTION => static fn($h, string $ip): int
            => is_public_ip($ip) ? CURL_PREREQFUNC_OK : CURL_PREREQFUNC_ABORT,
    ]);
    $ok = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    $primaryIp = (string) curl_getinfo($handle, CURLINFO_PRIMARY_IP);
    $errno = curl_errno($handle);
    unset($handle);
    if ($exceeded || $errno === CURLE_FILESIZE_EXCEEDED) {
        throw new FetchError(502, 'Сайт недоступен: слишком большой ответ.');
    }
    if ($ok === false || $errno !== 0) {
        if ($primaryIp !== '' && !is_public_ip($primaryIp)) {
            throw new FetchError(502, 'Сайт недоступен: адрес сервера не прошёл проверку.');
        }
        throw new FetchError(502, 'Сайт недоступен. Проверьте ссылку или попробуйте позже.');
    }
    return ['status' => $status, 'headers' => $headers, 'body' => $body, 'primaryIp' => $primaryIp];
}
