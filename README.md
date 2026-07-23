# DataLens — мобильный дашборд ЖК «Северный»

Стиль **«Природный минимализм»** · mobile-first · графики вместо длинных текстов.  
Публикация: **GitHub Pages** (открывается на iPhone в Safari без VPN).

> **Почему не Looker Studio?** В РФ Looker Studio недоступен без VPN.  
> Этот HTML-дашборд — быстрый публичный просмотр с теми же KPI.  
> Альтернатива с «живыми» данными: [Yandex DataLens](https://datalens.yandex.ru) — см. `docs/`.

## Ссылки

| Что | URL |
|---|---|
| Репозиторий | https://github.com/Budnikcam/DataLens |
| Публичный дашборд (Pages) | https://budnikcam.github.io/DataLens/ |
| Стиль | [`docs/STYLE.md`](docs/STYLE.md) |

## Как открыть на iPhone

1. Включите GitHub Pages (см. ниже) и дождитесь деплоя (~1 мин).
2. Откройте в **Safari**: https://budnikcam.github.io/DataLens/
3. По желанию: «Поделиться» → **На экран «Домой»** — иконка как у приложения.

Локально: откройте `index.html` через любой локальный сервер (для `fetch` нужен http, не `file://`), либо используйте Pages.

## Как обновить данные

**Основной способ:** отредактируйте [`data.json`](data.json) в корне репозитория и сделайте `git push` в `main`.  
Через 1–2 минуты Pages подтянет новые цифры — разметку HTML менять не нужно.

Структура `data.json`:

- `project` — название, KPI (готовность, договор, оплата, рабочие, комплектация)
- `supply` — полоски комплектации
- `finance` / `labor` — план/факт
- `risks` — короткие строки рисков
- `tasks` — список задач и статусы (donut пересчитается сам)

**Опционально из CSV:** после правки файлов в `data/` выполните:

```bash
python scripts/export_data_json.py
```

Скрипт пересоберёт `data.json` и `preview/data.json`.

## GitHub Pages — включение

1. Репозиторий → **Settings** → **Pages**
2. **Build and deployment** → Source: **Deploy from a branch**
3. Branch: **main** · folder: **/ (root)** → Save
4. Через минуту сайт: `https://budnikcam.github.io/DataLens/`

## Файлы для Pages

| Файл | Назначение |
|---|---|
| `index.html` | Дашборд (вкладки Проект / Задачи) |
| `data.json` | Все числа и списки |
| `README.md` | Эта инструкция |

Превью копия: `preview/mobile-dashboard.html` + `preview/data.json` (тот же стиль).

## Исходные CSV

`data/*.csv` — сырые выгрузки. Пересборка книги: `python scripts/build_workbook.py`.
