<?php

declare(strict_types=1);

// GET api/health.php: installation self-check. Reports only flags, never versions or paths.

require __DIR__ . '/lib/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error(405, 'Метод не поддерживается.');
}

try {
    $config = load_config();
    $configOk = true;
} catch (Throwable $e) {
    $config = default_config();
    $configOk = false;
}

$phpOk = php_version_ok();
$curl = extension_loaded('curl');
$dataWritable = data_dir_writable(data_dir());
$passwordSet = is_string($config['admin_password_hash']) && $config['admin_password_hash'] !== '';

json_response(200, [
    'ok' => $phpOk && $curl && $dataWritable && $configOk,
    'phpOk' => $phpOk,
    'curl' => $curl,
    'dataWritable' => $dataWritable,
    'passwordSet' => $passwordSet,
]);
