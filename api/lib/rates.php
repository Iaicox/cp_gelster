<?php

declare(strict_types=1);

// Central Bank of Russia daily rates: the XML is passed through as is (windows-1251), cached for one hour
// in data/private/. Parsing happens in the client (shared/parsers/rates.ts).

require_once __DIR__ . '/data_files.php';
require_once __DIR__ . '/fetch_allowed.php';

const CBR_RATES_URL = 'https://www.cbr.ru/scripts/XML_daily.asp';
const CBR_HOSTS = ['www.cbr.ru', 'cbr.ru'];
const RATES_CACHE_SECONDS = 3600;
const RATES_MAX_BYTES = 1024 * 1024;

/**
 * Returns the XML from cache if it is younger than an hour, otherwise downloads and caches it.
 * Throws FetchError(502) when the bank is unavailable or answers something that is not the rates XML.
 */
function rates_xml(string $dataDir, int $now, callable $transport): string
{
    $cached = private_read($dataDir, 'rates-cache');
    if (is_array($cached) && is_int($cached['fetchedAt'] ?? null) && is_string($cached['xml'] ?? null)
        && $now - $cached['fetchedAt'] < RATES_CACHE_SECONDS && $now >= $cached['fetchedAt']) {
        $xml = base64_decode($cached['xml'], true);
        if (is_string($xml)) {
            return $xml;
        }
    }
    try {
        $result = fetch_allowed(CBR_RATES_URL, CBR_HOSTS, RATES_MAX_BYTES, $transport);
    } catch (FetchError) {
        throw new FetchError(502, 'Не удалось получить курс ЦБ. Введите курс вручную.');
    }
    if (!str_contains($result['body'], '<ValCurs')) {
        throw new FetchError(502, 'ЦБ вернул неожиданный ответ. Введите курс вручную.');
    }
    try {
        private_write($dataDir, 'rates-cache', ['fetchedAt' => $now, 'xml' => base64_encode($result['body'])]);
    } catch (Throwable) {
        // No cache is not a reason to refuse the rates.
    }
    return $result['body'];
}
