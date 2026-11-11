# Генератор КП Гельстер

Генератор коммерческих предложений по коллекциям с сайтов gelster.ru и ooogelingen.ru.
Идёт переписывание с PHP на React + TypeScript с тонким сервером на Node.js (Hono).
Спецификация — `docs/spec.md`, решения — `docs/decisions.md`, правила стека — `docs/context/stack.md`.
Старая PHP-версия лежит в `legacy/` без изменений до приёмки новой.

## Требования

Node.js ≥ 22.18 (сервер запускается напрямую из `.ts`), npm.

## Разработка

```sh
npm ci
npm run dev
```

`npm run dev` поднимает два процесса: сервер API на http://127.0.0.1:3000 (перезапускается при правке `server/`)
и Vite на http://127.0.0.1:5173 (горячая перезагрузка клиента). Открывать http://127.0.0.1:5173 — запросы `/api`
Vite проксирует на сервер.

## Production

```sh
npm ci
npm run build   # клиент собирается в dist/
npm start       # сервер на http://127.0.0.1:3000: API + собранный клиент
```

Проверка: `curl -s http://127.0.0.1:3000/api/health` → `{"ok":true}`.

## Проверки

```sh
npm run typecheck
npm run lint
npm test
tests/run.sh     # всё сразу: typecheck, lint, test
```

## Переменные окружения

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `PORT` | `3000` | порт сервера (в dev — и адрес прокси Vite) |
| `HOST` | `127.0.0.1` | адрес, на котором слушает сервер; `0.0.0.0` — открыть в локальную сеть |
| `DATA_DIR` | `./data-runtime` | каталог данных во время работы (менеджеры, подписи); вне git |
| `ALLOWED_HOSTS` | `gelster.ru, www.gelster.ru, ooogelingen.ru, www.ooogelingen.ru` | хосты, с которых сервер может загружать страницы и картинки (будет в следующих задачах) |
| `ADMIN_TOKEN` | не задана | если задана, изменение списка менеджеров требует заголовок `X-Admin-Token` (будет в следующих задачах) |

## Каталоги

```
shared/   код без DOM и Node API, общий для клиента и сервера
server/   Hono-приложение (server/index.ts — точка входа, server/app.ts — маршруты)
src/      клиент React (src/pages — страницы, src/styles — document.css и form.css)
public/   header.jpg, footer.jpg, шрифты PT Sans / PT Serif, иконка
data/     начальные данные: data/managers — список менеджеров и подписи
legacy/   старая PHP-версия, не править
tests/    общие тесты и tests/run.sh
```
