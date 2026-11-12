<?php

declare(strict_types=1);

// Minimal PHP unit test runner without dependencies: `php tests/php/run.php`.
// Loads every tests/php/*_test.php; each file registers cases with test(). Exit code 0 = all passed.

/** @var array<string, callable> $GLOBALS['gelster_tests'] */
$GLOBALS['gelster_tests'] = [];

function test(string $name, callable $fn): void
{
    $GLOBALS['gelster_tests'][$name] = $fn;
}

function assert_same(mixed $expected, mixed $actual, string $message = ''): void
{
    if ($expected !== $actual) {
        throw new RuntimeException(
            ($message !== '' ? $message . ': ' : '')
            . 'expected ' . var_export($expected, true) . ', got ' . var_export($actual, true)
        );
    }
}

function assert_true(bool $condition, string $message = 'expected true'): void
{
    assert_same(true, $condition, $message);
}

/** Runs $fn with a fresh temporary directory and removes it (recursively) afterwards. */
function with_temp_dir(callable $fn): void
{
    $dir = sys_get_temp_dir() . '/gelster-test-' . bin2hex(random_bytes(6));
    mkdir($dir);
    try {
        $fn($dir);
    } finally {
        remove_tree($dir);
    }
}

function remove_tree(string $path): void
{
    if (is_dir($path) && !is_link($path)) {
        foreach (scandir($path) ?: [] as $entry) {
            if ($entry !== '.' && $entry !== '..') {
                remove_tree($path . '/' . $entry);
            }
        }
        rmdir($path);
    } elseif (file_exists($path) || is_link($path)) {
        unlink($path);
    }
}

/** Runs $fn and returns what it throws; fails when it throws nothing or an exception of another class. */
function expect_throws(string $class, callable $fn): Throwable
{
    try {
        $fn();
    } catch (Throwable $e) {
        if ($e instanceof $class) {
            return $e;
        }
        throw new RuntimeException('expected ' . $class . ', got ' . $e::class . ': ' . $e->getMessage());
    }
    throw new RuntimeException('expected ' . $class . ', nothing thrown');
}

$files = glob(__DIR__ . '/*_test.php') ?: [];
sort($files);
foreach ($files as $file) {
    require $file;
}

$failed = 0;
foreach ($GLOBALS['gelster_tests'] as $name => $fn) {
    try {
        $fn();
        echo "ok   {$name}\n";
    } catch (Throwable $e) {
        $failed++;
        echo "FAIL {$name}\n     " . $e->getMessage() . "\n";
    }
}

$total = count($GLOBALS['gelster_tests']);
echo "\n" . ($total - $failed) . "/{$total} PHP tests passed\n";
if ($total === 0) {
    echo "No PHP tests found\n";
    exit(1);
}
exit($failed === 0 ? 0 : 1);
