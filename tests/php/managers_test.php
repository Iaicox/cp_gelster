<?php

declare(strict_types=1);

require_once __DIR__ . '/../../api/lib/bootstrap.php';
require_once __DIR__ . '/../../api/lib/managers_store.php';
require_once __DIR__ . '/../../api/lib/image_check.php';
require_once __DIR__ . '/../../api/lib/auth.php';
require_once __DIR__ . '/../../api/lib/rates.php';

const SEED_DIR = __DIR__ . '/../../api/seed';
const SEED_JPEG = SEED_DIR . '/signatures/max_mal.jpg';

/** A $_FILES entry for a local file; the test passes an is_uploaded_file stand-in. */
function upload_entry(string $path, int $error = UPLOAD_ERR_OK): array
{
    return ['name' => 'x.jpg', 'type' => 'image/jpeg', 'tmp_name' => $path, 'error' => $error, 'size' => @filesize($path)];
}

function always_uploaded(): Closure
{
    return static fn(string $path): bool => true;
}

// --- signature upload check ---

test('signature: a real JPEG is accepted as jpg, a PNG as png', function (): void {
    assert_same('jpg', check_signature_upload(upload_entry(SEED_JPEG), always_uploaded())['ext']);
    with_temp_dir(function (string $dir): void {
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
        file_put_contents($dir . '/s', $png);
        assert_same('png', check_signature_upload(upload_entry($dir . '/s'), always_uploaded())['ext']);
    });
});

test('signature: plain text is refused', function (): void {
    with_temp_dir(function (string $dir): void {
        file_put_contents($dir . '/a.jpg', 'just some text');
        $e = expect_throws(UploadError::class, fn() => check_signature_upload(upload_entry($dir . '/a.jpg'), always_uploaded()));
        assert_same(400, $e->httpStatus);
    });
});

test('signature: PHP code named .jpg is refused', function (): void {
    with_temp_dir(function (string $dir): void {
        file_put_contents($dir . '/shell.jpg', '<?php system($_GET["c"]); ?>');
        $e = expect_throws(UploadError::class, fn() => check_signature_upload(upload_entry($dir . '/shell.jpg'), always_uploaded()));
        assert_same(400, $e->httpStatus);
        assert_same('Загружаемый файл должен быть в формате JPG или PNG.', $e->getMessage());
    });
});

test('signature: a GIF (not JPEG/PNG) is refused', function (): void {
    with_temp_dir(function (string $dir): void {
        file_put_contents($dir . '/g', base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'));
        $e = expect_throws(UploadError::class, fn() => check_signature_upload(upload_entry($dir . '/g'), always_uploaded()));
        assert_same(400, $e->httpStatus);
        assert_same('Загружаемый файл должен быть в формате JPG или PNG.', $e->getMessage());
    });
});

test('signature: a file over 5 MB is refused with 413', function (): void {
    with_temp_dir(function (string $dir): void {
        $jpeg = file_get_contents(SEED_JPEG);
        file_put_contents($dir . '/big.jpg', $jpeg . str_repeat("\0", SIGNATURE_MAX_BYTES + 1 - strlen($jpeg)));
        $e = expect_throws(UploadError::class, fn() => check_signature_upload(upload_entry($dir . '/big.jpg'), always_uploaded()));
        assert_same(413, $e->httpStatus);
        $e = expect_throws(UploadError::class, fn() => check_signature_upload(upload_entry('', UPLOAD_ERR_INI_SIZE), always_uploaded()));
        assert_same(413, $e->httpStatus);
    });
});

test('signature: sides over 6000 px are refused', function (): void {
    with_temp_dir(function (string $dir): void {
        // A PNG header claiming 7000 x 10 is enough for getimagesize().
        $ihdr = 'IHDR' . pack('NNCCCCC', 7000, 10, 8, 2, 0, 0, 0);
        $png = "\x89PNG\r\n\x1A\n" . pack('N', 13) . $ihdr . pack('N', crc32($ihdr));
        file_put_contents($dir . '/wide.png', $png);
        $e = expect_throws(UploadError::class, fn() => check_signature_upload(upload_entry($dir . '/wide.png'), always_uploaded()));
        assert_same(400, $e->httpStatus);
    });
});

test('signature: a file that was not uploaded is refused (is_uploaded_file by default)', function (): void {
    $e = expect_throws(UploadError::class, fn() => check_signature_upload(upload_entry(SEED_JPEG)));
    assert_same(400, $e->httpStatus);
    $e = expect_throws(UploadError::class, fn() => check_signature_upload(null));
    assert_same(400, $e->httpStatus);
});

// --- managers store ---

test('managers: list is initialised from the seed with signatures copied', function (): void {
    with_temp_dir(function (string $dir): void {
        $list = managers_list($dir, SEED_DIR);
        $seed = json_decode(file_get_contents(SEED_DIR . '/managers.json'), true);
        assert_same($seed, $list);
        assert_true(is_file($dir . '/managers.json'));
        foreach ($list as $m) {
            assert_true(is_file($dir . '/signatures/' . basename($m['signature'])), $m['signature']);
        }
        assert_true(is_file($dir . '/signatures/.htaccess'));
    });
});

test('managers: seed is not re-applied once managers.json exists', function (): void {
    with_temp_dir(function (string $dir): void {
        managers_list($dir, SEED_DIR);
        assert_true(managers_delete($dir, SEED_DIR, 'max_mal'));
        assert_same(3, count(managers_list($dir, SEED_DIR)));
        assert_same(false, is_file($dir . '/signatures/max_mal.jpg'), 'signature file removed');
        assert_same(false, managers_delete($dir, SEED_DIR, 'max_mal'), 'second delete finds nothing');
    });
});

test('managers: add stores the signature under a server-generated name', function (): void {
    with_temp_dir(function (string $dir): void {
        $manager = managers_add($dir, SEED_DIR, 'Пётр Петров', 'png', static fn(string $dest): bool => copy(SEED_JPEG, $dest));
        assert_same(1, preg_match('#^api/data/signatures/[0-9a-f]{32}\.png$#', $manager['signature']));
        assert_same(1, preg_match('/^[0-9a-f]{16}$/', $manager['id']));
        assert_true(is_file($dir . '/signatures/' . basename($manager['signature'])));
        $list = managers_list($dir, SEED_DIR);
        assert_same($manager, end($list));
        assert_same(5, count($list));
        $files = array_filter(scandir($dir) ?: [], static fn(string $f): bool => str_starts_with($f, '.tmp-'));
        assert_same([], $files, 'no temp files left');
    });
});

test('managers: failed file placement leaves the list unchanged', function (): void {
    with_temp_dir(function (string $dir): void {
        expect_throws(RuntimeException::class, fn() => managers_add($dir, SEED_DIR, 'X', 'jpg', static fn(): bool => false));
        assert_same(4, count(managers_list($dir, SEED_DIR)));
        expect_throws(InvalidArgumentException::class, fn() => managers_add($dir, SEED_DIR, 'X', 'php', static fn(): bool => true));
    });
});

test('managers: name rules', function (): void {
    assert_same('Иван', normalize_manager_name('  Иван '));
    assert_same(str_repeat('я', 100), normalize_manager_name(str_repeat('я', 100)));
    foreach (['', '   ', str_repeat('я', 101), "Иван\nИванов", "a\x00b", "\xff\xfe", null, ['x']] as $bad) {
        assert_same(null, normalize_manager_name($bad), var_export($bad, true));
    }
});

// --- password and lockout ---

test('auth: no hash means not_set; right and wrong passwords', function (): void {
    with_temp_dir(function (string $dir): void {
        assert_same('not_set', auth_check('', 'anything', '1.2.3.4', $dir, 1000));
        $hash = password_hash('test-only-password', PASSWORD_DEFAULT);
        assert_same('ok', auth_check($hash, 'test-only-password', '1.2.3.4', $dir, 1000));
        assert_same('wrong', auth_check($hash, 'nope', '1.2.3.4', $dir, 1000));
        assert_same('wrong', auth_check($hash, '', '1.2.3.4', $dir, 1000));
    });
});

test('auth: 5 wrong attempts lock the address for 15 minutes, other addresses unaffected', function (): void {
    with_temp_dir(function (string $dir): void {
        $hash = password_hash('test-only-password', PASSWORD_DEFAULT);
        for ($i = 0; $i < 5; $i++) {
            assert_same('wrong', auth_check($hash, 'bad', '1.2.3.4', $dir, 1000 + $i));
        }
        assert_same('locked', auth_check($hash, 'test-only-password', '1.2.3.4', $dir, 1010), 'right password still locked');
        assert_same('ok', auth_check($hash, 'test-only-password', '5.6.7.8', $dir, 1010), 'other address');
        assert_same('locked', auth_check($hash, 'test-only-password', '1.2.3.4', $dir, 1004 + 899));
        assert_same('ok', auth_check($hash, 'test-only-password', '1.2.3.4', $dir, 1004 + 900), 'lock expired');
    });
});

test('auth: failures older than 15 minutes do not count; success resets the counter', function (): void {
    with_temp_dir(function (string $dir): void {
        $hash = password_hash('test-only-password', PASSWORD_DEFAULT);
        for ($i = 0; $i < 4; $i++) {
            auth_check($hash, 'bad', '1.2.3.4', $dir, 1000);
        }
        assert_same('wrong', auth_check($hash, 'bad', '1.2.3.4', $dir, 1000 + 900), 'old failures expired');
        assert_same('ok', auth_check($hash, 'test-only-password', '1.2.3.4', $dir, 1901));
        for ($i = 0; $i < 4; $i++) {
            assert_same('wrong', auth_check($hash, 'bad', '1.2.3.4', $dir, 1902));
        }
        assert_same('ok', auth_check($hash, 'test-only-password', '1.2.3.4', $dir, 1903));
    });
});

test('auth: the attempts file is a guarded private .php without the password or hash', function (): void {
    with_temp_dir(function (string $dir): void {
        $hash = password_hash('test-only-password', PASSWORD_DEFAULT);
        auth_check($hash, 'bad-guess', '1.2.3.4', $dir, 1000);
        $raw = file_get_contents($dir . '/private/login-attempts.php');
        assert_true(str_starts_with($raw, "<?php http_response_code(404); exit; ?>\n"));
        assert_same(false, str_contains($raw, 'bad-guess'));
        assert_same(false, str_contains($raw, $hash));
        assert_same(['failures' => [1000], 'lockedUntil' => 0], private_read($dir, 'login-attempts')['1.2.3.4']);
    });
});

// --- rates cache ---

test('rates: downloaded XML is cached for an hour, then refreshed', function (): void {
    with_temp_dir(function (string $dir): void {
        $calls = 0;
        $xml = "<?xml version=\"1.0\" encoding=\"windows-1251\"?><ValCurs Date=\"12.11.2026\">\xc5</ValCurs>";
        $transport = static function (string $url) use (&$calls, $xml): array {
            $calls++;
            assert_same(CBR_RATES_URL, $url);
            return ['status' => 200, 'headers' => [], 'body' => $xml, 'primaryIp' => '93.184.216.34'];
        };
        assert_same($xml, rates_xml($dir, 1000, $transport));
        assert_same($xml, rates_xml($dir, 1000 + 3599, $transport));
        assert_same(1, $calls);
        assert_same($xml, rates_xml($dir, 1000 + 3600, $transport));
        assert_same(2, $calls);
        assert_true(str_starts_with(file_get_contents($dir . '/private/rates-cache.php'), PRIVATE_FILE_GUARD));
    });
});

test('rates: failure or unexpected answer is 502', function (): void {
    with_temp_dir(function (string $dir): void {
        $e = expect_throws(FetchError::class, fn() => rates_xml($dir, 1000, static fn() => throw new FetchError(502, 'x')));
        assert_same(502, $e->httpStatus);
        $e = expect_throws(FetchError::class, fn() => rates_xml($dir, 1000, static fn(): array
            => ['status' => 200, 'headers' => [], 'body' => '<html>blocked</html>', 'primaryIp' => '93.184.216.34']));
        assert_same(502, $e->httpStatus);
    });
});
