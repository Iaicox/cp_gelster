<?php

declare(strict_types=1);

// Shared setup for every API entry point: PHP version check, JSON responses, config.php.

// Runs first and uses only old-PHP-safe code, so PHP < 8.4 gets a clear message instead of a type error.
if (PHP_VERSION_ID < 80400) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo '{"error":"Нужен PHP 8.4 или новее. Обновите PHP на сервере."}';
    exit(1);
}

const GELSTER_MIN_PHP_VERSION_ID = 80400;

// The API reports no versions (see health.php); php.ini expose_php may still add one.
header_remove('X-Powered-By');

/** True when the running PHP is new enough for this API (8.4 or later). */
function php_version_ok(int $versionId = PHP_VERSION_ID): bool
{
    return $versionId >= GELSTER_MIN_PHP_VERSION_ID;
}

/** Sends a JSON response and stops the script. */
function json_response(int $status, mixed $data): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}

/** Sends an empty 204 response and stops the script. */
function no_content(): never
{
    http_response_code(204);
    header('Cache-Control: no-store');
    exit;
}

/** Sends `{ "error": "..." }` with a human-readable Russian message. */
function json_error(int $status, string $message): never
{
    json_response($status, ['error' => $message]);
}

/** Settings used when api/config.php is missing or lacks a key. */
function default_config(): array
{
    return [
        'admin_password_hash' => '',
        'allowed_hosts' => ['gelster.ru', 'www.gelster.ru', 'ooogelingen.ru', 'www.ooogelingen.ru'],
    ];
}

/** Path of api/config.php; GELSTER_CONFIG overrides it (tests only). */
function config_path(): string
{
    $fromEnv = getenv('GELSTER_CONFIG');
    if (is_string($fromEnv) && $fromEnv !== '') {
        return $fromEnv;
    }
    return dirname(__DIR__) . '/config.php';
}

/**
 * Reads api/config.php (a file returning an array) over the defaults.
 * A missing file means defaults; a file that does not return an array is a setup error.
 */
function load_config(?string $path = null): array
{
    $path = $path ?? config_path();
    $config = default_config();
    if (!is_file($path)) {
        return $config;
    }
    $loaded = require $path;
    if (!is_array($loaded)) {
        throw new RuntimeException('config.php must return an array');
    }
    return array_replace($config, array_intersect_key($loaded, $config));
}

/** Runtime data directory: api/data, or GELSTER_DATA_DIR (used by tests). */
function data_dir(): string
{
    $fromEnv = getenv('GELSTER_DATA_DIR');
    if (is_string($fromEnv) && $fromEnv !== '') {
        return rtrim($fromEnv, '/\\');
    }
    return dirname(__DIR__) . '/data';
}

/** True when the data directory exists and is writable, or can be created. */
function data_dir_writable(string $dir): bool
{
    if (is_dir($dir)) {
        return is_writable($dir);
    }
    $parent = dirname($dir);
    return is_dir($parent) && is_writable($parent);
}
