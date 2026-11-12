<?php

declare(strict_types=1);

// Data files: atomic writes, flock-guarded updates and private JSON files that a web server never serves.

/** First line of every file in data/private/: the file answers 404 if a web server runs it. */
const PRIVATE_FILE_GUARD = "<?php http_response_code(404); exit; ?>\n";

/** Creates a directory (and parents) if it is missing; throws if that fails. */
function ensure_dir(string $dir): void
{
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('cannot create data directory');
    }
}

/** Writes a file atomically: temporary file in the same directory, then rename(). */
function write_file_atomic(string $path, string $contents): void
{
    $dir = dirname($path);
    ensure_dir($dir);
    $tmp = $dir . '/.tmp-' . bin2hex(random_bytes(8));
    if (file_put_contents($tmp, $contents) !== strlen($contents)) {
        @unlink($tmp);
        throw new RuntimeException('cannot write data file');
    }
    if (!rename($tmp, $path)) {
        @unlink($tmp);
        throw new RuntimeException('cannot replace data file');
    }
}

/**
 * Runs $fn while holding an exclusive flock on $lockPath (a guarded .php file, so it is safe in a web root).
 * The lock is separate from the data file because rename() replaces the data file's inode.
 */
function with_lock(string $lockPath, callable $fn): mixed
{
    ensure_dir(dirname($lockPath));
    $handle = fopen($lockPath, 'c');
    if ($handle === false) {
        throw new RuntimeException('cannot open lock file');
    }
    try {
        if (!flock($handle, LOCK_EX)) {
            throw new RuntimeException('cannot lock data file');
        }
        if (fstat($handle)['size'] === 0) {
            fwrite($handle, PRIVATE_FILE_GUARD);
            fflush($handle);
        }
        return $fn();
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

/** Path of a private data file: <data>/private/<name>.php. */
function private_path(string $dataDir, string $name): string
{
    if (preg_match('/^[a-z0-9_-]+$/', $name) !== 1) {
        throw new InvalidArgumentException('bad private file name');
    }
    return $dataDir . '/private/' . $name . '.php';
}

/** Reads a private JSON file; missing or damaged file = null. */
function private_read(string $dataDir, string $name): mixed
{
    $path = private_path($dataDir, $name);
    if (!is_file($path)) {
        return null;
    }
    $raw = file_get_contents($path);
    if ($raw === false || !str_starts_with($raw, PRIVATE_FILE_GUARD)) {
        return null;
    }
    try {
        return json_decode(substr($raw, strlen(PRIVATE_FILE_GUARD)), true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        return null;
    }
}

/** Writes a private JSON file atomically, guard line first. */
function private_write(string $dataDir, string $name, mixed $data): void
{
    write_file_atomic(
        private_path($dataDir, $name),
        PRIVATE_FILE_GUARD . json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)
    );
}

/** Runs $fn under the lock of a private file (<data>/private/<name>.lock.php). */
function with_private_lock(string $dataDir, string $name, callable $fn): mixed
{
    return with_lock(private_path($dataDir, $name . '-lock'), $fn);
}
