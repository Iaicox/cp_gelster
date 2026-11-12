<?php

declare(strict_types=1);

// Validation of an uploaded signature image: only the file content counts, never the client's name or type.

const SIGNATURE_MAX_BYTES = 5 * 1024 * 1024;
const SIGNATURE_MAX_SIDE = 6000;

/** A refusal with the HTTP status for the endpoint and a Russian message. */
final class UploadError extends RuntimeException
{
    public function __construct(public readonly int $httpStatus, string $message)
    {
        parent::__construct($message);
    }
}

/**
 * Checks one entry of $_FILES and returns the temporary path and the extension chosen by content ('jpg'|'png').
 * $isUploaded is is_uploaded_file() in production and replaceable in tests.
 *
 * @return array{path:string, ext:string}
 */
function check_signature_upload(mixed $file, ?callable $isUploaded = null): array
{
    $isUploaded ??= 'is_uploaded_file';
    if (!is_array($file) || !is_int($file['error'] ?? null) || $file['error'] === UPLOAD_ERR_NO_FILE) {
        throw new UploadError(400, 'Не приложен файл подписи.');
    }
    if ($file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE) {
        throw new UploadError(413, 'Файл подписи больше 5 МБ.');
    }
    $path = $file['tmp_name'] ?? null;
    if ($file['error'] !== UPLOAD_ERR_OK || !is_string($path) || !$isUploaded($path)) {
        throw new UploadError(400, 'Не удалось принять файл подписи.');
    }
    $size = filesize($path);
    if ($size === false || $size === 0) {
        throw new UploadError(400, 'Файл подписи пустой.');
    }
    if ($size > SIGNATURE_MAX_BYTES) {
        throw new UploadError(413, 'Файл подписи больше 5 МБ.');
    }
    $info = @getimagesize($path);
    $ext = match (is_array($info) ? $info[2] : null) {
        IMAGETYPE_JPEG => 'jpg',
        IMAGETYPE_PNG => 'png',
        default => null,
    };
    if ($ext === null) {
        throw new UploadError(400, 'Подпись должна быть картинкой JPEG или PNG.');
    }
    if ($info[0] < 1 || $info[1] < 1 || $info[0] > SIGNATURE_MAX_SIDE || $info[1] > SIGNATURE_MAX_SIDE) {
        throw new UploadError(400, 'Картинка подписи должна быть не больше 6000 × 6000 точек.');
    }
    return ['path' => $path, 'ext' => $ext];
}
