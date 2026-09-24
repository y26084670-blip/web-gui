# Clark E3D Editor

Обновлено: 2026-09-24 21:52 UTC+3.

Текущая версия: **4.29.0**.

Браузерный редактор исходных данных Clark: таблицы, геометрия и материалы,
проверка и сохранение `input3XX`, подготовка списка и запрос запуска локального
решателя. Сам полевой расчёт выполняет установленный Clark.

## Открыть приложение

[Clark E3D Editor](https://y26084670-blip.github.io/web-gui/) ·
[Руководство пользователя](https://y26084670-blip.github.io/web-gui/user-guide/index.html).

## Требования

Для локальных файлов — Google Chrome Desktop или Microsoft Edge Desktop,
HTTPS либо `localhost`, File System Access API и разрешение на выбранный
каталог. Для знакомства без файлового доступа доступна кнопка «Демо».
Публикация сайта не обновляет установленный решатель или локальную LAN-копию.

## Начать работу

Практические инструкции с иллюстрациями находятся в **HTML-руководстве**;
оно открывается также синей кнопкой «Документация» на основной панели.

[Проекты и задания](https://y26084670-blip.github.io/web-gui/user-guide/index.html#tasks) ·
[Библиотеки](https://y26084670-blip.github.io/web-gui/user-guide/index.html#material-source) ·
[Контакты MED](https://y26084670-blip.github.io/web-gui/user-guide/index.html#med) ·
[Проверка и сохранение](https://y26084670-blip.github.io/web-gui/user-guide/index.html#validation) ·
[Запуск](https://y26084670-blip.github.io/web-gui/user-guide/index.html#launch).

В левой шторке вкладки «Выбор задания» доступны создание, копирование,
переименование и перенос задания. [Порядок работы](https://y26084670-blip.github.io/web-gui/user-guide/index.html#tasks).
Удаление задания и «Сохранить как» в этот набор не входят.

## Разработка и сборка

Node.js 24; зависимости зафиксированы в `package-lock.json`.
Начало разработки: `npm ci`, затем `npm run dev`.
Все режимы сборки, Pages, LAN/Caddy и подготовка справки описаны в
[AI_BUILD_AND_RUNTIME](docs/AI_BUILD_AND_RUNTIME.md).
Команды и границы тестирования — в [AI_VERIFICATION](docs/AI_VERIFICATION.md).

## Документация и границы проектов

[Политика](DOC_POLICY.md) · [Архитектура](docs/Architecture.md) ·
[Состояние](docs/resume.md) · [Карта файлов](docs/AI_FILES.md).
Исходный HTML Руководства: [`docs/user-guide/index.html`](docs/user-guide/index.html).

Технические описания: [форматы](docs/AI_DATA_CONTRACTS.md),
[интерфейс](docs/AI_UI_CONTRACTS.md), [интеграция](docs/AI_CLARK_INTEGRATION.md),
[генерация геометрии](docs/AI_GEOMETRY_GENERATION.md).

Математика и поставка решателя принадлежат
[solver](https://github.com/y26084670-blip/solver/blob/main/README.md),
численные эталоны — [clark.tests](https://github.com/y26084670-blip/clark.tests/blob/main/README.md).
Руководство ссылается на эти источники, но не дублирует расчётные алгоритмы.
AI начинает с `DOC_POLICY.md` и карты файлов; активные вопросы находятся в
[аудите](docs/AI_ARCHITECTURE_AUDIT.md) и [плане](docs/AI_ROADMAP.md).
