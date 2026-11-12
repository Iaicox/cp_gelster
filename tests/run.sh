#!/usr/bin/env bash
# Single entry point for checks: typecheck, lint, Vitest, then PHP (php -l over api/ and tests/php/run.php).
# Without php the PHP checks are skipped with a loud warning and exit 0; REQUIRE_PHP=1 turns the skip into a failure.
# Exit code 0 = all passed.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d node_modules ] || npm ci

npm run typecheck
npm run lint
npm test

if ! command -v php >/dev/null 2>&1; then
  {
    echo
    echo '################################################################'
    echo '###                                                          ###'
    echo '###        PHP НЕ НАЙДЕН: тесты PHP ПРОПУЩЕНЫ                ###'
    echo '###   (Debian: sudo apt install php-cli php-curl)            ###'
    echo '###                                                          ###'
    echo '################################################################'
    echo
  } >&2
  if [ "${REQUIRE_PHP:-0}" = "1" ]; then
    echo 'REQUIRE_PHP=1: PHP обязателен, проверка провалена.' >&2
    exit 1
  fi
  exit 0
fi

echo '--- php -l'
while IFS= read -r -d '' file; do
  php -l "$file" >/dev/null || { echo "Syntax error in $file" >&2; exit 1; }
done < <(find api tests/php -name '*.php' -not -path 'api/data/*' -print0)

echo '--- PHP unit tests'
php tests/php/run.php
