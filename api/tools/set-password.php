<?php

declare(strict_types=1);

// php api/tools/set-password.php — asks for the administrator password twice and stores its hash in
// api/config.php, keeping the other keys. Command line only: through the web it answers 404.

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/data_files.php';

/** Reads one line from STDIN without echo when it is a terminal. */
function ask_secret(string $prompt): string
{
    fwrite(STDOUT, $prompt);
    $tty = stream_isatty(STDIN);
    if ($tty) {
        shell_exec('stty -echo');
    }
    $line = fgets(STDIN);
    if ($tty) {
        shell_exec('stty echo');
        fwrite(STDOUT, "\n");
    }
    return $line === false ? '' : rtrim($line, "\r\n");
}

$path = config_path();
$config = [];
if (is_file($path)) {
    $loaded = require $path;
    if (!is_array($loaded)) {
        fwrite(STDERR, "config.php не возвращает массив, исправьте его вручную.\n");
        exit(1);
    }
    $config = $loaded;
} else {
    $config = default_config();
}

$first = ask_secret('Новый пароль администратора: ');
if (strlen($first) < 8) {
    fwrite(STDERR, "Пароль должен быть не короче 8 символов.\n");
    exit(1);
}
$second = ask_secret('Повторите пароль: ');
if (!hash_equals($first, $second)) {
    fwrite(STDERR, "Пароли не совпадают, ничего не изменено.\n");
    exit(1);
}

$config['admin_password_hash'] = password_hash($first, PASSWORD_DEFAULT);
$contents = "<?php\n\ndeclare(strict_types=1);\n\n"
    . "// Written by api/tools/set-password.php. Not in git and not in dist/.\n\n"
    . 'return ' . var_export($config, true) . ";\n";
write_file_atomic($path, $contents);
fwrite(STDOUT, "Пароль сохранён в config.php.\n");
