<?php

declare(strict_types=1);

// Copy to api/config.php (it is not in git and not in dist/). Keep config.php when updating the app.
// Set the password with `php api/tools/set-password.php` instead of editing the hash by hand.

return [
    // password_hash() of the administrator password; empty = not set, every POST answers 503.
    'admin_password_hash' => '',
    // Hosts api/fetch.php may download from: exact match, https only.
    'allowed_hosts' => ['gelster.ru', 'www.gelster.ru', 'ooogelingen.ru', 'www.ooogelingen.ru'],
];
