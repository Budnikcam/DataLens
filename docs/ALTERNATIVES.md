# Альтернативы Looker Studio (РФ)

## Проблема

**Looker Studio (бывш. Data Studio) официально недоступен в России.**  
Сообщение Google: *«Сервис недоступен. Google прекратил предоставление услуг Data Studio в вашей стране.»*

Это известное ограничение (с осени 2024, IT-санкции США). VPN / смена аккаунта **не подходит** как основной план сдачи клиенту: нестабильно, не масштабируется на конечных пользователей, риск «не открывается на iPhone без VPN».

Данные по-прежнему в Google Sheets — это ок; недоступен именно **конструктор отчётов** Looker.

---

## Ранжирование для ЭТОГО заказа

Контекст: бюджет ≤3000₽, сдача к субботе, mobile-first, charts > text, стиль «ПРИРОДНЫЙ МИНИМАЛИЗМ», источник — Google Таблица / xlsx; **топ-менеджеры на iPhone без VPN**.

| # | Вариант | Вердикт | Почему |
|---|---|---|---|
| **1** | **Yandex DataLens** | **Основной путь сдачи** | Работает в РФ, без VPN; view-ссылка в Safari на iPhone; коннектор Google Sheets (+ CSV/xlsx fallback); живое обновление данных |
| **2** | **HTML/CSS** (`preview/mobile-dashboard.html`) | **Запасной превью / эталон стиля** | Точная палитра и phone layout уже есть; сдать файл/хостинг, если DataLens затянется |
| **3** | **Google Sheets: вкладка-дашборд + графики** | Fallback «минималка» | Быстро, но слабый UI и phone layout |
| — | Tableau Public / Power BI / Metabase | Не брать | Дольше, тяжелее, избыточно для 3к и субботы |

**VPN + Looker — не рекомендуем** как deliverable для конечных пользователей.

---

## Рекомендуемый путь (primary)

### Сдавать: Yandex DataLens

Пошагово: **[`docs/DATALENS_BUILD.md`](DATALENS_BUILD.md)**.

Кратко:

1. [datalens.yandex.ru](https://datalens.yandex.ru) / [datalens.yandex.cloud](https://datalens.yandex.cloud) → воркбук.
2. Подключить Google Sheets **или** загрузить CSV/xlsx из `data/`.
3. Датасеты: `project_card`, `kpi_summary`, `smr`, `labor`, `supply`, `finance`, `risks`, `tasks`.
4. Дашборд: 2 вкладки «Проект» / «Задачи», scorecards + bar/gauge/donut, ~390px, цвета из `docs/STYLE.md`.
5. Сдать **публичную** view-ссылку + кратко «как обновлять данные в таблице».

HTML (`preview/mobile-dashboard.html`) — **макет согласия по стилю** и backup, если нужно показать вид до готовности DataLens.

### HTML — backup

1. Довести `preview/mobile-dashboard.html` по чеклисту ниже (если сдаём как запасной канал).
2. Доставка: файл / GitHub Pages / Netlify Drop.
3. Данные — снимок на момент сдачи (или fetch CSV, если успеете).

---

## Что ещё допилить в HTML (если нужен backup)

Файл `preview/mobile-dashboard.html` уже годится как визуальный эталон:

- [ ] Подставить **реальные** цифры/названия из таблицы клиента.
- [ ] Синхронизировать метрики с листами: project / smr / supply / finance / risks / tasks.
- [ ] Проверить на телефоне 390px: без гор. скролла, tap ≥44px.
- [ ] Краткий README для клиента: «как открыть».
- [ ] Favicon / title = имя объекта клиента.

Не обязательно для v1: бэкенд, логин, realtime sync.

---

## Дерево решений (для Ивана)

```
Клиент в РФ не открывает Looker? Топ на iPhone без VPN?
  └─ Да → НЕ обещать Looker / VPN
       ├─ Нужен живой BI + ссылка на телефон?
       │    └─ ДА → DataLens (primary). Гайд: DATALENS_BUILD.md
       ├─ Нужен только красивый снимок / макет стиля?
       │    └─ HTML preview (backup)
       └─ Совсем минимум / только цифры в таблице?
            └─ Вкладка-дашборд в Google Sheets.
```

**Сейчас:** зафиксировали DataLens с клиентом → собирать по `DATALENS_BUILD.md` → публичная ссылка.
