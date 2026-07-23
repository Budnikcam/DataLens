# Связка Google Таблица → дашборд

Цель: правка ячейки в таблице → после обновления страницы дашборд показывает новые данные.

Таблица: [Sheet ID `1dJtRHUOB2bAWj20FO_RIYYmono8syxEq3HRVy4PLKb4`](https://docs.google.com/spreadsheets/d/1dJtRHUOB2bAWj20FO_RIYYmono8syxEq3HRVy4PLKb4)

Листы (как в `data/*.csv`): `project_card`, `kpi_summary`, `smr`, `labor`, `supply`, `finance`, `risks`, `tasks`.

---

## Как это работает

1. **Google Apps Script** (привязан к таблице) читает листы и отдаёт JSON в форме `data.json`.
2. **Публичный дашборд** (`index.html`) при наличии URL веб-приложения запрашивает этот JSON (fetch + JSONP fallback).
3. **Редактор** остаётся запасным: можно править и публиковать `data.json` через GitHub, если таблица недоступна.
4. Опционально **GitHub Action** раз в 15 минут подтягивает тот же JSON в `data.json` (бэкап / офлайн-файл).

Когда `sources.sheetsApiUrl` задан — для посетителей сайта **источник истины = Google Таблица** (localStorage-черновик редактора на дашборд не влияет).

Подпись под шапкой: «Данные из Google Таблицы» / «Данные из файла».

---

## Настройка (Иван / Маргарита) — один раз

### 1. Доступ к таблице

- У редакторов: права **Редактор**.
- Для веб-приложения Apps Script достаточно, что скрипт выполняется от владельца таблицы.
- Для опционального Action через публичный CSV лист должен быть «доступ по ссылке» — **не обязательно**, если используете Apps Script URL.

### 2. Установить Apps Script

1. Открыть таблицу → **Расширения → Apps Script**.
2. Вставить код из [`scripts/google_apps_script/Code.gs`](../scripts/google_apps_script/Code.gs) → Сохранить.
3. **Развернуть → Новое развёртывание → Веб-приложение**:
   - Выполнять от имени: **Я**
   - У кого есть доступ: **Все** (Anyone)
4. Скопировать URL вида `https://script.google.com/macros/s/…/exec`.
5. Открыть URL в браузере — должен вернуться JSON с `project` и `tasks`.

### 3. Вписать URL на сайт

**Предпочтительный способ** (видно всем после публикации):

1. Открыть [редактор](https://budnikcam.github.io/DataLens/edit.html).
2. Поле **«URL веб-приложения Google (Apps Script)»** → вставить `/exec` URL.
3. **«Сохранить на сайт»** (нужен GitHub-токен, как раньше).
4. Через 1–2 минуты обновить дашборд — должна появиться подпись «Данные из Google Таблицы».

Альтернативы:

- `config.js` → `window.DASHBOARD_CONFIG.sheetsApiUrl` (локально / для теста; в git лучше оставлять пустым).
- Query: `https://budnikcam.github.io/DataLens/?sheets=URL_ENCODED`.

Порядок выбора URL: `?sheets=` → `config.js` → `data.json.sources.sheetsApiUrl`.

### 4. (Опционально) GitHub Action — бэкап в `data.json`

1. Repo → **Settings → Secrets and variables → Actions**.
2. Secret **`SHEETS_API_URL`** = тот же `/exec` URL.
3. Workflow: [`.github/workflows/sync-sheets.yml`](../.github/workflows/sync-sheets.yml) — cron каждые 15 мин + ручной запуск.
4. При изменении коммитит обновлённые `data.json` и `preview/data.json`.

Без секрета Action просто пропускает синк; живое чтение через Apps Script всё равно работает.

---

## Ежедневная работа

1. Правите ячейки в Google Таблице.
2. На телефоне откройте / потяните вниз для обновления / закройте и откройте дашборд.
3. Обновление **не всегда мгновенное** без refresh: данные подтягиваются при загрузке страницы (и при успешном Action — в файл на сайте).

Опциональные колонки на листах `tasks` / `risks`: `title` (или `t`), `explanation`, `m` — короткие подписи и пояснения для мобильного списка.

---

## Запасной путь без таблицы

Редактор → правки → «Сохранить на сайт». Пока `sheetsApiUrl` пустой, дашборд читает `data.json`. Если URL задан, а Apps Script временно упал — дашборд откатывается на `data.json` / FALLBACK.
