#!/usr/bin/env bash
# Live check of the PHP API against the real sites and the Central Bank (needs network; not part of run.sh).
# Starts php -S with a temporary data directory, requests a page and a picture from both sites, the main photo
# (`.big-background`) of the gelster.ru page and the rates.
# Exit code 0 = all passed. Override sample URLs with GELSTER_PAGE_URL_1/2 and GELSTER_IMAGE_URL_1/2.
set -euo pipefail
cd "$(dirname "$0")/.."

PAGES=("${GELSTER_PAGE_URL_1:-https://gelster.ru/marmoleum_cocoa.htm}" "${GELSTER_PAGE_URL_2:-https://ooogelingen.ru/m_cocoa.htm}")
IMAGES=("${GELSTER_IMAGE_URL_1:-https://gelster.ru/img/collections/marmoleum/m_cocoa/3584.jpg}"
        "${GELSTER_IMAGE_URL_2:-https://ooogelingen.ru/Forbo/Marmoleum/Cocoa/3580.jpg}")

tmp=$(mktemp -d)
port=$(php -r '$s = stream_socket_server("tcp://127.0.0.1:0"); echo explode(":", stream_socket_get_name($s, false))[1];')
GELSTER_DATA_DIR="$tmp/data" GELSTER_CONFIG="$tmp/config.php" php -S "127.0.0.1:$port" -t . >"$tmp/php.log" 2>&1 &
php_pid=$!
trap 'kill $php_pid 2>/dev/null; rm -rf "$tmp"' EXIT
for _ in $(seq 50); do curl -s -o /dev/null "http://127.0.0.1:$port/api/health.php" && break; sleep 0.1; done
base="http://127.0.0.1:$port/api"
failed=0

# check <name> <url> <expected content-type regex> [<body regex>]
check() {
  local name=$1 url=$2 type_re=$3 body_re=${4:-}
  local code type
  code=$(curl -s -o "$tmp/body" -D "$tmp/headers" -w '%{http_code}' "$url")
  type=$(grep -i '^content-type:' "$tmp/headers" | tr -d '\r' | cut -d' ' -f2- || true)
  if [ "$code" = 200 ] && [[ "$type" =~ $type_re ]] && { [ -z "$body_re" ] || grep -Eqa "$body_re" "$tmp/body"; }; then
    echo "ok   $name ($(wc -c <"$tmp/body") bytes, $type)"
  else
    echo "FAIL $name: HTTP $code, $type: $(head -c 200 "$tmp/body")"
    failed=1
  fi
}

# main_photo_of <html file> <page url>: address of the gelster.ru banner `.big-background`, by the rule of
# shared/parsers/gelster.ts (url(...) in the style attribute, then data-src / data-bg / data-background),
# made absolute against the page address. Prints nothing when there is no banner.
main_photo_of() {
  php -- "$1" "$2" <<'PHP'
<?php
[, $file, $page] = $argv;
$doc = new DOMDocument();
libxml_use_internal_errors(true);
$doc->loadHTML((string) file_get_contents($file));
$el = (new DOMXPath($doc))->query('//*[contains(concat(" ", normalize-space(@class), " "), " big-background ")]')->item(0);
if (!$el instanceof DOMElement) exit;
$value = preg_match('/background(?:-image)?\s*:[^;]*?url\(\s*([\'"]?)([^\'")]+?)\1\s*\)/i', $el->getAttribute('style'), $m)
    ? $m[2] : '';
foreach (['data-src', 'data-bg', 'data-background'] as $attr) if ($value === '') $value = $el->getAttribute($attr);
$value = trim($value);
if ($value === '') exit;
$p = parse_url($page);
$origin = $p['scheme'] . '://' . $p['host'];
if (preg_match('#^https?://#i', $value)) $url = $value;
elseif (str_starts_with($value, '//')) $url = $p['scheme'] . ':' . $value;
elseif (str_starts_with($value, '/')) $url = $origin . $value;
else $url = $origin . preg_replace('#[^/]*$#', '', $p['path'] ?? '/') . $value;
// Dot segments, as new URL() removes them: «/./img» → «/img», «/a/../img» → «/img».
do $url = preg_replace(['#(?<!:)/\./#', '#(?<!/)/[^/]+/\.\./#'], '/', $url, -1, $n); while ($n > 0);
echo $url;
PHP
}

for page in "${PAGES[@]}"; do
  check "page $page" "$base/fetch.php?kind=page&url=$(php -r 'echo rawurlencode($argv[1]);' "$page")" '^text/html' '<h1'
  # gelster.ru: the banner is the main photo of the KP; it has to come through the proxy as a picture.
  if [[ "$page" =~ ^https://(www\.)?gelster\.ru/ ]]; then
    photo=$(main_photo_of "$tmp/body" "$page")
    if [ -z "$photo" ]; then
      echo "FAIL main photo of $page: no .big-background address in the page"
      failed=1
    else
      check "main photo $photo" "$base/fetch.php?kind=image&url=$(php -r 'echo rawurlencode($argv[1]);' "$photo")" '^image/'
    fi
  fi
done
for image in "${IMAGES[@]}"; do
  check "image $image" "$base/fetch.php?kind=image&url=$(php -r 'echo rawurlencode($argv[1]);' "$image")" '^image/(jpeg|png|gif|webp)$'
done
check 'rates (cbr.ru)' "$base/rates.php" '^application/xml' '<ValCurs'
check 'rates from cache' "$base/rates.php" '^application/xml' '<ValCurs'

exit $failed
