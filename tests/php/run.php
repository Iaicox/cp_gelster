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
