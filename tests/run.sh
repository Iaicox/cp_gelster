#!/usr/bin/env bash
# Single entry point for checks: typecheck, lint, unit tests. Exit code 0 = all passed.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d node_modules ] || npm ci
npm run typecheck
npm run lint
npm test
