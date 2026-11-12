<?php

declare(strict_types=1);

// GET api/rates.php: XML of the Central Bank daily rates as is (windows-1251), cached for one hour.

require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/rates.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error(405, 'Метод не поддерживается.');
}

try {
    $xml = rates_xml(data_dir(), time(), 'curl_transport');
} catch (FetchError $e) {
    json_error($e->httpStatus, $e->getMessage());
} catch (Throwable) {
    json_error(502, 'Не удалось получить курс ЦБ. Введите курс вручную.');
}

header('Content-Type: application/xml; charset=windows-1251');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
echo $xml;
