# Версии данных дашборда

Публикация идёт из `edit.html` кнопкой **«Сохранить на сайт»** (GitHub Contents API).

| Файл | Роль |
|---|---|
| `../data.json` | Опубликованная версия на GitHub Pages (для всех посетителей) |
| `manifest.json` | Список версий в репозитории (только append) |
| `data-YYYY-MM-DD-HHmmss.json` | Снимок; при сохранении создаётся новый файл, старые не удаляются |

Дополнительно редактор пишет черновик в браузер (`localStorage`: `datalens-data-current`, `datalens-data-versions`).

## Как пользоваться (Маргарита)

1. Принять приглашение collaborator в `Budnikcam/DataLens`.
2. Создать fine-grained PAT (Contents: Read and Write только на этот репозиторий) и вставить в редактор.
3. Править поля → **«Сохранить на сайт»**.
