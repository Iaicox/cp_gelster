<?php

declare(strict_types=1);

// Administrator password check with a per-address brute-force limit:
// 5 wrong attempts within 15 minutes lock that address (REMOTE_ADDR) for 15 minutes. No global lock,
// so a stranger cannot lock out the director. The 1 s delay on a wrong attempt is added by the endpoint.

require_once __DIR__ . '/data_files.php';

const AUTH_MAX_FAILURES = 5;
const AUTH_WINDOW_SECONDS = 900;
const AUTH_LOCK_SECONDS = 900;

/**
 * Checks a password for the client address. Returns 'ok', 'wrong', 'locked' (429) or 'not_set' (503).
 * The attempts file is updated under a lock, so parallel requests cannot bypass the limit.
 */
function auth_check(string $hash, string $password, string $ip, string $dataDir, int $now): string
{
    if ($hash === '') {
        return 'not_set';
    }
    return with_private_lock($dataDir, 'login-attempts', static function () use ($hash, $password, $ip, $dataDir, $now): string {
        $all = private_read($dataDir, 'login-attempts');
        $all = is_array($all) ? $all : [];
        // Forget stale records of every address so the file stays small.
        foreach ($all as $key => $record) {
            $failures = array_values(array_filter(
                is_array($record['failures'] ?? null) ? $record['failures'] : [],
                static fn($t): bool => is_int($t) && $now - $t < AUTH_WINDOW_SECONDS,
            ));
            $lockedUntil = is_int($record['lockedUntil'] ?? null) ? $record['lockedUntil'] : 0;
            if ($failures === [] && $lockedUntil <= $now) {
                unset($all[$key]);
            } else {
                $all[$key] = ['failures' => $failures, 'lockedUntil' => $lockedUntil];
            }
        }
        $record = $all[$ip] ?? ['failures' => [], 'lockedUntil' => 0];
        if ($record['lockedUntil'] > $now) {
            return 'locked';
        }
        if (password_verify($password, $hash)) {
            unset($all[$ip]);
            private_write($dataDir, 'login-attempts', (object) $all);
            return 'ok';
        }
        $record['failures'][] = $now;
        if (count($record['failures']) >= AUTH_MAX_FAILURES) {
            $record = ['failures' => [], 'lockedUntil' => $now + AUTH_LOCK_SECONDS];
        }
        $all[$ip] = $record;
        private_write($dataDir, 'login-attempts', (object) $all);
        return 'wrong';
    });
}
