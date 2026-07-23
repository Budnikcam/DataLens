# Сборка дашборда — ПРИРОДНЫЙ МИНИМАЛИЗМ

Ориентир UI: `preview/mobile-dashboard.html`  
Палитра/шрифты: `docs/STYLE.md` (**источник истины**)  
Данные: Google Sheets клиента / `data/Dashboard_Mobile_Source.xlsx`  
**Primary:** Yandex DataLens — `docs/DATALENS_BUILD.md`  
Ограничение РФ и выбор стека: `docs/ALTERNATIVES.md`

Заказчик: гайд «ПРИРОДНЫЙ МИНИМАЛИЗМ» + **больше графиков / минимум текста** + **адаптация под телефон** + **iPhone без VPN**.

---

## Primary: Yandex DataLens

Полный клик-путь: **[`docs/DATALENS_BUILD.md`](DATALENS_BUILD.md)**.

Кратко:

1. [datalens.yandex.ru](https://datalens.yandex.ru) / [datalens.yandex.cloud](https://datalens.yandex.cloud) → воркбук.
2. Подключение: Google Sheets **или** CSV/xlsx из `data/` (fallback).
3. Датасеты: `project_card`, `kpi_summary`, `smr`, `labor`, `supply`, `finance`, `risks`, `tasks`.
4. Дашборд: 2 вкладки «Проект» / «Задачи»; indicator, bar, donut; цвета из `STYLE.md`.
5. Сдать **публичную** view-ссылку (Safari iPhone) + «как обновлять таблицу».

### Экраны

| Экран | Виджеты |
|---|---|
| «Проект» | Название · scorecards · gauge/bar готовности · bar комплектации · bar план/факт финансы · компактные риски |
| «Задачи» | Donut статусов · фильтр · список задача + срок |

---

## Backup: HTML-превью

`preview/mobile-dashboard.html` — эталон стиля и запасной deliverable.

1. Сверить цифры с [таблицей](https://docs.google.com/spreadsheets/d/1dJtRHUOB2bAWj20FO_RIYYmono8syxEq3HRVy4PLKb4/edit).
2. Проверка: DevTools → iPhone / 390px.
3. Доставка: файл или GitHub Pages / Netlify Drop — только если DataLens недоступен/затянулся.

Чеклист: `docs/ALTERNATIVES.md`.

---

## Fallback: Google Sheets (вкладка-дашборд)

Только если DataLens и HTML отвергли: лист «Дашборд» + встроенные графики. Слабый контроль стиля.

---

## Looker Studio — архив

Мы **не можем** править edit-URL клиента удалённо.  
В РФ Looker часто недоступен конечным пользователям — **не сдаём**.  
Если клиент всё же собирает сам: `docs/LOOKER_BUILD_CLICKPATH.md`.

---

## Сдача (актуально)

- **Основное:** публичная ссылка Yandex DataLens
- Ссылка на Google Таблицу с данными
- HTML-превью — по запросу / как эталон стиля
- Текст клиенту: `docs/REPLY_TO_CLIENT.md`
