# Фикстуры парсеров

Сохранены `curl -sSL` 2026-11-12, байты как есть (все страницы отдаются в UTF-8, XML ЦБ — windows-1251).
Фикстуры — договор о поддерживаемой вёрстке: если сайт поменялся, пересохранить страницу и поправить адаптер и
ожидания в `collection.test.ts`.

| Файл | Адрес | Тип |
|---|---|---|
| `ooogelingen.ru/m_cocoa.htm` | https://ooogelingen.ru/m_cocoa.htm | натуральный линолеум |
| `ooogelingen.ru/coral_classic.htm` | https://ooogelingen.ru/coral_classic.htm | грязезащитный ковёр |
| `ooogelingen.ru/plint_DSL.htm` | https://ooogelingen.ru/plint_DSL.htm | сопутствующий: плинтус |
| `ooogelingen.ru/glue_marm.htm` | https://ooogelingen.ru/glue_marm.htm | сопутствующий: клей (нет артикулов и характеристик — проверка предупреждений) |
| `gelster.ru/marmoleum_cocoa.htm` | https://gelster.ru/marmoleum_cocoa.htm | натуральный линолеум |
| `gelster.ru/coral-class.htm` | https://gelster.ru/coral-class.htm | грязезащитный ковёр |
| `gelster.ru/dollken_al.htm` | https://gelster.ru/dollken_al.htm | сопутствующий: завершающий профиль |
| `cbr_XML_daily.xml` | https://www.cbr.ru/scripts/XML_daily.asp | курсы ЦБ на 12.11.2026 |

Не поддерживается (нет в фикстурах): страницы химии gelster.ru другой вёрстки (`himia_*.htm`: `h1.title`, без
артикулов и таблицы характеристик) — разбор такой страницы даст только название. Так же
устроены страницы клея Ardex (`ardex_*.html`): нет `.big-background`, описания, артикулов и характеристик.
