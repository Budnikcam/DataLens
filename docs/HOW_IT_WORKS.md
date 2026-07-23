# Как устроен дашборд (GitHub Pages)

Публичная страница: **https://budnikcam.github.io/DataLens/**

Это единственный сдаваемый интерфейс для Маргариты (не Yandex DataLens и не Looker).  
Стиль: [`STYLE.md`](STYLE.md) — палитра «природный минимализм», mobile-first.

---

## Что открывается на странице

Один HTML-файл (`index.html`) + данные (`data.json` на сервере).

| Вкладка | Содержание |
|---|---|
| **Проект** | Scorecards, **СМР (дни)** (до «Готовности»), gauge готовности, комплектация, финансы, труд, превью рисков |
| **Задачи** | Donut статусов (кликабельный), фильтры, список **по блокам**, карточка задачи |
| **Риски** | Фильтры, список, карточка риска |

Мета под названием объекта:  
`Генподряд · ООО «Успех» · срок до 30.06.2027`

---

## Как связаны файлы

```
index.html          ← GitHub Pages (корень репозитория)
config.js           ← опциональный локальный sheetsApiUrl (в git обычно пустой)
edit.html           ← редактор + поле связки с Google Sheets
data.json           ← файл на сайте; sources.sheetsApiUrl — URL Apps Script
versions/           ← архив снимков data-YYYY-MM-DD-HHmmss.json + manifest.json
preview/
  mobile-dashboard.html  ← копия index.html
  data.json              ← копия data.json
scripts/export_data_json.py
scripts/google_apps_script/Code.gs
data/*.csv
docs/SHEETS_SYNC.md ← настройка связки Таблица → дашборд
```

### Порядок загрузки данных на дашборде

1. Резолв URL таблицы: `?sheets=` → `config.js` → `data.json.sources.sheetsApiUrl`.
2. Если URL задан — запрос к Apps Script (источник истины; localStorage пропускается). При ошибке — откат к файлу.
3. Если URL не задан и есть `localStorage["datalens-data-current"]` — черновик в **этом** браузере.
4. Иначе — `data.json` с сервера.
5. Если и это недоступно — встроенный FALLBACK в HTML.

Подробнее: [`SHEETS_SYNC.md`](SHEETS_SYNC.md).

**Важно для разработчика:** после правок кода держите в синхроне:

1. `index.html` ↔ `preview/mobile-dashboard.html`
2. `data.json` ↔ `preview/data.json`

---

## Редактор в браузере (`edit.html`)

Ссылка: **https://budnikcam.github.io/DataLens/edit.html**  
На дашборде внизу — discreet-ссылка «Редактор».

Основной сценарий: правите цифры → **«Сохранить на сайт»** → через 1–2 минуты правки видят все на GitHub Pages.

### Вход

Лёгкий пароль (не для жёсткой защиты, а чтобы случайные гости не правили данные):

- пароль: `severny2026`
- или ссылка с ключом: `edit.html?key=severny2026`  
После входа пароль помнится в `sessionStorage` до закрытия вкладки.

### Подключение к сайту (один раз для Маргариты)

1. **Принять приглашение** collaborator в репозиторий [Budnikcam/DataLens](https://github.com/Budnikcam/DataLens) (почта `dodova.m@yandex.ru` / уведомления GitHub).
2. **Создать fine-grained PAT**: только репозиторий `Budnikcam/DataLens`, разрешение **Contents: Read and Write**. Другие scopes не нужны.  
   Создание: https://github.com/settings/personal-access-tokens/new
3. **Вставить токен** в блоке «Подключение к сайту» → «Запомнить токен».  
   Токен хранится только в `localStorage` браузера, в git не коммитится.

### Что можно править

Шапка/KPI, СМР (дни), комплектация, финансы, труд, все поля рисков и задач (включая пояснение, ответственного, блок).

### Как сохранить (основной способ)

Кнопка **«Сохранить на сайт»**:

1. `GET` текущего `data.json` (получает `sha`, проверяет доступ);
2. `PUT` нового файла `versions/data-YYYY-MM-DD-HHmmss.json` (старые файлы не трогает);
3. обновляет `versions/manifest.json` (append);
4. `PUT` корневого `data.json` (и при наличии — `preview/data.json`);
5. дополнительно пишет черновик в `localStorage` (этот браузер).

Успех: *«Опубликовано. Через 1–2 мин обновите дашборд.»*

Ошибки:

| Код | Смысл |
|---|---|
| 401 | Неверный / истёкший токен → создать новый PAT |
| 404 | Нет доступа → принять приглашение collaborator |
| 403 | Не хватает прав → Contents: Read and Write на Budnikcam/DataLens |

Кнопка **«Скачать копию»** — запасной бэкап `data.json` на компьютер (на сайт не публикует).

### Версии

- На сайте: файлы в `versions/` + запись в `manifest.json` (ничего не удаляется).
- В браузере: `datalens-data-current` / `datalens-data-versions` — черновики и локальная история.

---

## Как править цифры, задачи и риски

### Рекомендуемый путь — `edit.html` (см. выше)

### Альтернатива — править `data.json` вручную (разработчик)

Откройте `data.json` в редакторе. Основные блоки:

| Ключ | Что менять |
|---|---|
| `project` | Название, meta, готовность, договор, рабочие… |
| `smrDays` | `elapsed`, `total`, `remaining`, `readinessPct`, `alert` |
| `supply` / `finance` / `labor` | Графики на вкладке «Проект» |
| `tasks[]` | `t`, `description`, `responsible`, `explanation`, `status`, `block`, `m` |
| `risks[]` | `t`, `problem`, `risk_level`, `solution`, `owner`, `deadline`, `m`, `status` |

**Пояснение** (`explanation`): заполняйте для статуса «Не исполнено»; для «В работе» оставляйте пустую строку `""`.

После сохранения скопируйте файл в `preview/data.json` (или запустите скрипт экспорта — он пишет оба).

### Через CSV + скрипт

1. Правьте CSV в папке `data/` (`01_project_card.csv`, `07_risks.csv`, `08_tasks.csv`…).
2. Запустите:

```bash
python scripts/export_data_json.py
```

Скрипт пересчитает `smrDays` по датам старта/окончания и готовности, соберёт задачи с блоками и риски с полными полями, обновит оба `data.json`.

---

## Публикация (для разработчика / без редактора)

Если правили файлы локально:

```bash
git add data.json preview/data.json versions/
git commit -m "Update dashboard data"
git push origin main
```

Через 1–3 минуты: https://budnikcam.github.io/DataLens/

Репозиторий: https://github.com/Budnikcam/DataLens  
Pages обслуживает корень `main` (`index.html`).

---

## Локальная проверка

- Откройте `preview/mobile-dashboard.html` в браузере (рядом должен лежать `preview/data.json`),  
  **или** поднимите простой HTTP-сервер из корня репо:

```bash
python -m http.server 8080
```

Затем: http://localhost:8080/

Проверяйте ширину ~390 px (iPhone) и вкладки Проект / Задачи / Риски.
