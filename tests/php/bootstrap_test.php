<?php

declare(strict_types=1);

require_once __DIR__ . '/../../api/lib/bootstrap.php';

function with_temp_dir(callable $fn): void
{
    $dir = sys_get_temp_dir() . '/gelster-test-' . bin2hex(random_bytes(6));
    mkdir($dir);
    try {
        $fn($dir);
    } finally {
        foreach (glob($dir . '/*') ?: [] as $file) {
            unlink($file);
        }
        rmdir($dir);
    }
}

test('php_version_ok accepts 8.4 and 8.5, rejects 8.3', function (): void {
    assert_true(php_version_ok(80400));
    assert_true(php_version_ok(80512));
    assert_same(false, php_version_ok(80399));
});

test('load_config returns defaults when config.php is missing', function (): void {
    $config = load_config('/nonexistent/config.php');
    assert_same('', $config['admin_password_hash']);
    assert_same(['gelster.ru', 'www.gelster.ru', 'ooogelingen.ru', 'www.ooogelingen.ru'], $config['allowed_hosts']);
});

test('load_config overrides known keys and drops unknown ones', function (): void {
    with_temp_dir(function (string $dir): void {
        file_put_contents($dir . '/config.php', "<?php return ['admin_password_hash' => 'h', 'extra' => 1];");
        $config = load_config($dir . '/config.php');
        assert_same('h', $config['admin_password_hash']);
        assert_true(!array_key_exists('extra', $config), 'unknown key dropped');
        assert_same(4, count($config['allowed_hosts']));
    });
});

test('load_config rejects a file that does not return an array', function (): void {
    with_temp_dir(function (string $dir): void {
        file_put_contents($dir . '/config.php', '<?php return 1;');
        try {
            load_config($dir . '/config.php');
        } catch (RuntimeException) {
            return;
        }
        throw new RuntimeException('expected RuntimeException');
    });
});

test('config.example.php is a valid config', function (): void {
    $config = load_config(__DIR__ . '/../../api/config.example.php');
    assert_same('', $config['admin_password_hash']);
});

test('data_dir honours GELSTER_DATA_DIR', function (): void {
    putenv('GELSTER_DATA_DIR=/tmp/somewhere/');
    try {
        assert_same('/tmp/somewhere', data_dir());
    } finally {
        putenv('GELSTER_DATA_DIR');
    }
    assert_same(realpath(__DIR__ . '/../../api') . '/data', data_dir());
});

test('data_dir_writable: existing dir, creatable dir, impossible dir', function (): void {
    with_temp_dir(function (string $dir): void {
        assert_true(data_dir_writable($dir));
        assert_true(data_dir_writable($dir . '/data'));
        assert_same(false, data_dir_writable($dir . '/missing/data'));
    });
});
