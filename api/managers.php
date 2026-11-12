<?php

declare(strict_types=1);

// GET api/managers.php: Manager[].
// POST api/managers.php action=login|add|delete, password (+ name and file signature for add, id for delete).
// Every POST needs the administrator password; without a configured password every POST answers 503.

require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/managers_store.php';
require __DIR__ . '/lib/image_check.php';
require __DIR__ . '/lib/auth.php';

$dataDir = data_dir();
$seedDir = __DIR__ . '/seed';
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        json_response(200, managers_list($dataDir, $seedDir));
    } catch (Throwable) {
        json_error(500, 'Не удалось прочитать список менеджеров.');
    }
}
if ($method !== 'POST') {
    json_error(405, 'Метод не поддерживается.');
}

// A body over post_max_size arrives as empty $_POST and $_FILES.
if ($_POST === [] && $_FILES === [] && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    json_error(413, 'Слишком большой запрос: файл подписи должен быть не больше 5 МБ.');
}

$action = $_POST['action'] ?? null;
if (!in_array($action, ['login', 'add', 'delete'], true)) {
    json_error(400, 'Неизвестное действие.');
}

try {
    $config = load_config();
} catch (Throwable) {
    json_error(500, 'Ошибка в api/config.php.');
}
$hash = is_string($config['admin_password_hash']) ? $config['admin_password_hash'] : '';
$password = $_POST['password'] ?? '';
$password = is_string($password) ? $password : '';

try {
    $auth = auth_check($hash, $password, (string) ($_SERVER['REMOTE_ADDR'] ?? ''), $dataDir, time());
} catch (Throwable) {
    json_error(500, 'Не удалось проверить пароль: нет доступа к каталогу данных.');
}
switch ($auth) {
    case 'not_set':
        json_error(503, 'Пароль администратора не задан. Задайте его командой php api/tools/set-password.php.');
    case 'locked':
        json_error(429, 'Слишком много неверных попыток. Попробуйте через 15 минут.');
    case 'wrong':
        sleep(1);
        json_error(401, 'Неверный пароль.');
}

if ($action === 'login') {
    no_content();
}

if ($action === 'add') {
    $name = normalize_manager_name($_POST['name'] ?? null);
    if ($name === null) {
        json_error(400, 'Имя менеджера: от 1 до 100 символов, без служебных символов.');
    }
    try {
        $upload = check_signature_upload($_FILES['signature'] ?? null);
        $manager = managers_add(
            $dataDir,
            $seedDir,
            $name,
            $upload['ext'],
            static fn(string $destination): bool => move_uploaded_file($upload['path'], $destination),
        );
    } catch (UploadError $e) {
        json_error($e->httpStatus, $e->getMessage());
    } catch (Throwable) {
        json_error(500, 'Не удалось сохранить менеджера.');
    }
    json_response(200, $manager);
}

$id = $_POST['id'] ?? null;
if (!is_string($id) || $id === '') {
    json_error(400, 'Не указан менеджер.');
}
try {
    $deleted = managers_delete($dataDir, $seedDir, $id);
} catch (Throwable) {
    json_error(500, 'Не удалось удалить менеджера.');
}
if (!$deleted) {
    json_error(404, 'Менеджер не найден.');
}
no_content();
