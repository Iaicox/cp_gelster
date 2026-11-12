<?php

declare(strict_types=1);

// Managers list: <data>/managers.json and <data>/signatures/<random>.jpg|png.
// Initialised from api/seed/ on first use; every change goes under flock, through a temp file and rename().

require_once __DIR__ . '/data_files.php';

/** URL prefix of signature files relative to the app (the web server serves them as plain files). */
const SIGNATURE_URL_PREFIX = 'api/data/signatures/';

const SIGNATURES_HTACCESS = "# Signatures are plain images: never run anything from here.\n"
    . "<FilesMatch \"\\.(?i:php\\d?|phtml|phar|pht|cgi|pl|py|sh)$\">\n  Require all denied\n</FilesMatch>\n"
    . "<IfModule mod_php.c>\n  php_flag engine off\n</IfModule>\n";

/** Validates a manager name: trimmed, 1–100 characters, no control characters. Returns it or null. */
function normalize_manager_name(mixed $name): ?string
{
    if (!is_string($name)) {
        return null;
    }
    $name = trim($name);
    if (preg_match('/^.{1,100}$/us', $name) !== 1 || preg_match('/\p{Cc}/u', $name) === 1) {
        return null;
    }
    return $name;
}

/** Runs $fn under the managers lock after making sure the data is initialised from the seed. */
function managers_locked(string $dataDir, string $seedDir, callable $fn): mixed
{
    return with_private_lock($dataDir, 'managers', static function () use ($dataDir, $seedDir, $fn): mixed {
        managers_init($dataDir, $seedDir);
        return $fn();
    });
}

/** Copies seed managers and signatures into the data directory if managers.json is missing. */
function managers_init(string $dataDir, string $seedDir): void
{
    $sigDir = $dataDir . '/signatures';
    ensure_dir($sigDir);
    if (!is_file($sigDir . '/.htaccess')) {
        write_file_atomic($sigDir . '/.htaccess', SIGNATURES_HTACCESS);
    }
    if (!is_file($dataDir . '/private/.htaccess')) {
        write_file_atomic($dataDir . '/private/.htaccess', "Require all denied\n");
    }
    if (is_file($dataDir . '/managers.json')) {
        return;
    }
    foreach (glob($seedDir . '/signatures/*') ?: [] as $file) {
        if (preg_match('/\.(jpg|png)$/', $file) !== 1) {
            continue;
        }
        if (!is_file($sigDir . '/' . basename($file)) && !copy($file, $sigDir . '/' . basename($file))) {
            throw new RuntimeException('cannot copy seed signature');
        }
    }
    $seed = file_get_contents($seedDir . '/managers.json');
    if ($seed === false) {
        throw new RuntimeException('cannot read seed managers');
    }
    write_file_atomic($dataDir . '/managers.json', $seed);
}

/** @return list<array{id:string, name:string, signature:string}> */
function managers_read(string $dataDir): array
{
    $raw = file_get_contents($dataDir . '/managers.json');
    if ($raw === false) {
        throw new RuntimeException('cannot read managers');
    }
    $list = json_decode($raw, true, 8, JSON_THROW_ON_ERROR);
    if (!is_array($list) || !array_is_list($list)) {
        throw new RuntimeException('managers.json is not a list');
    }
    return $list;
}

/** @param list<array{id:string, name:string, signature:string}> $list */
function managers_write(string $dataDir, array $list): void
{
    write_file_atomic(
        $dataDir . '/managers.json',
        json_encode($list, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . "\n"
    );
}

/** @return list<array{id:string, name:string, signature:string}> */
function managers_list(string $dataDir, string $seedDir): array
{
    return managers_locked($dataDir, $seedDir, static fn(): array => managers_read($dataDir));
}

/**
 * Adds a manager. $placeFile(string $destination): bool puts the checked upload at the server-chosen path
 * (move_uploaded_file in production).
 *
 * @return array{id:string, name:string, signature:string}
 */
function managers_add(string $dataDir, string $seedDir, string $name, string $ext, callable $placeFile): array
{
    if (!in_array($ext, ['jpg', 'png'], true)) {
        throw new InvalidArgumentException('bad signature extension');
    }
    return managers_locked($dataDir, $seedDir, static function () use ($dataDir, $name, $ext, $placeFile): array {
        $list = managers_read($dataDir);
        $fileName = bin2hex(random_bytes(16)) . '.' . $ext;
        $destination = $dataDir . '/signatures/' . $fileName;
        if (!$placeFile($destination)) {
            throw new RuntimeException('cannot store signature');
        }
        $manager = ['id' => bin2hex(random_bytes(8)), 'name' => $name, 'signature' => SIGNATURE_URL_PREFIX . $fileName];
        $list[] = $manager;
        try {
            managers_write($dataDir, $list);
        } catch (Throwable $e) {
            @unlink($destination);
            throw $e;
        }
        return $manager;
    });
}

/** Deletes a manager and its signature file. Returns false when there is no such id. */
function managers_delete(string $dataDir, string $seedDir, string $id): bool
{
    return managers_locked($dataDir, $seedDir, static function () use ($dataDir, $id): bool {
        $list = managers_read($dataDir);
        foreach ($list as $i => $manager) {
            if (($manager['id'] ?? null) !== $id) {
                continue;
            }
            array_splice($list, $i, 1);
            managers_write($dataDir, $list);
            $file = basename((string) ($manager['signature'] ?? ''));
            if (str_starts_with((string) $manager['signature'], SIGNATURE_URL_PREFIX)
                && preg_match('/^[A-Za-z0-9_-]+\.(jpg|png)$/', $file) === 1) {
                @unlink($dataDir . '/signatures/' . $file);
            }
            return true;
        }
        return false;
    });
}
