<?php

declare(strict_types=1);

// GET api/fetch.php?kind=page|image&url=...: bytes of a page or picture from an allowed site.
// Only Content-Type (and X-Final-Url) is passed to the client; the origin's other headers are dropped.

require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/fetch_allowed.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error(405, 'Метод не поддерживается.');
}

$kind = $_GET['kind'] ?? null;
$url = $_GET['url'] ?? null;
if (!in_array($kind, ['page', 'image'], true)) {
    json_error(400, 'Неизвестный тип запроса: нужен kind=page или kind=image.');
}
if (!is_string($url) || $url === '') {
    json_error(400, 'Не указан адрес.');
}

try {
    $config = load_config();
    $maxBytes = $kind === 'page' ? FETCH_PAGE_MAX_BYTES : FETCH_IMAGE_MAX_BYTES;
    $result = fetch_allowed($url, $config['allowed_hosts'], $maxBytes, 'curl_transport');
} catch (FetchError $e) {
    json_error($e->httpStatus, $e->getMessage());
} catch (Throwable $e) {
    json_error(500, 'Ошибка сервера при загрузке страницы.');
}

if ($kind === 'page') {
    if (!is_html_content_type($result['contentType'])) {
        json_error(415, 'По ссылке не HTML-страница.');
    }
    // Keep the origin's charset; anything but printable ASCII in the header falls back to plain text/html.
    $contentType = preg_match('/^[\x20-\x7e]{1,200}$/', $result['contentType']) === 1
        ? $result['contentType'] : 'text/html';
    header('Content-Type: ' . $contentType);
    header('Cache-Control: no-store');
    // The page is data for the client, not a page of this site: opened directly it runs no scripts.
    header("Content-Security-Policy: sandbox; default-src 'none'");
} else {
    $imageType = detect_image_type($result['body']);
    if ($imageType === null) {
        json_error(415, 'По ссылке не картинка (нужен JPEG, PNG, GIF или WebP).');
    }
    header('Content-Type: ' . $imageType);
    header('Cache-Control: max-age=86400');
    header("Content-Security-Policy: default-src 'none'");
}
header('X-Content-Type-Options: nosniff');
header('X-Final-Url: ' . $result['url']);
header('Content-Length: ' . strlen($result['body']));
echo $result['body'];
