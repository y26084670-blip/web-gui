# Карта файлов и компонентов web-gui

Обновлено: 2026-09-15 00:20 UTC+3.

## Назначение

Документ является канонической картой дерева проекта, точек входа, владельцев
реализации и направлений зависимостей. Поведение компонентов здесь не
пересказывается: точные контракты находятся в
[`AI_DATA_CONTRACTS.md`](AI_DATA_CONTRACTS.md),
[`AI_UI_CONTRACTS.md`](AI_UI_CONTRACTS.md) и
[`AI_CLARK_INTEGRATION.md`](AI_CLARK_INTEGRATION.md).

Карта проверена по `main` на коммите `105d7789c63ef9e012dbb4328b812de7535c72d3`.

## 1. Точки входа и конфигурация

| Путь | Ответственность |
|---|---|
| `index.html` | HTML-точка входа Vite и контейнер приложения. |
| `src/index.jsx` | Инициализация SolidJS и монтирование корневого `App`. |
| `src/App.jsx` | Корневая координация выбора задания, загрузки, редакторов, сохранения, диагностики, окон и глобальных состояний. Не является владельцем предметных преобразований. |
| `src/App.css` | Общая компоновка приложения и глобальное оформление. |
| `src/TaskInfoBar.jsx`, `src/TaskInfoBar.css` | Верхняя строка сведений о выбранном задании и состоянии данных. |
| `package.json` | Версия приложения, зависимости и канонические npm-команды. |
| `vite.config.js` | Конфигурация Vite и подключение раздачи файлов примеров. |
| `public/examples-config.json` | Публичная конфигурация примеров и адреса установщика Clark. |

## 2. Основные каталоги

| Каталог | Содержание и направление зависимостей |
|---|---|
| `src/components/` | SolidJS-компоненты интерфейса; используют сервисы и чистые модели, но не должны становиться владельцами предметных правил. |
| `src/tabs/` | Верхнеуровневые вкладки выбора задания и библиотек материалов. |
| `src/services/` | Состояния приложения, предметные операции, файловый ввод-вывод и чистые преобразования. |
| `src/tabulator/` | Адаптация схем и BaseModel к Tabulator: builders, converters, editors, formatters, actions и views. |
| `src/assets/` | Импортируемые Vite статические ресурсы интерфейса. |
| `data/default/` | Исходный комплект встроенных readonly-библиотек ФММ/ВТСП; производные ресурсы создаёт `scripts/default-library-assets.mjs`. |
| `data/demo/` | Исходные файлы встроенного демонстрационного задания; производный пакет создаёт `scripts/prepare-demo-assets.mjs`. |
| `public/` | Ресурсы, копируемые в сборку без преобразования, включая примеры и базовые библиотеки. |
| `resource/` | Служебные изображения знаков, сохраняемые как исходные ресурсы проекта. |
| `scripts/` | Подготовка ресурсов, dev/build/LAN-сценарии и HTTP-раздача примеров. |
| `deploy/caddy/` | Конфигурация и установка локального HTTPS-сервера Caddy. |
| `test/` | Node.js-тесты функций и контрактные проверки исходного текста. |
| `.github/workflows/` | Независимая сборка и публикация GitHub Pages. |
| `docs/` | Человеческие точки входа и канонические AI-документы. |

## 3. Модель данных и сериализация

| Владелец | Путь | Ответственность |
|---|---|---|
| Фабрика схем | `src/services/schemaFactory.js` | Нормативная форма схемы и дескрипторов свойств. |
| Реестр вкладок | `src/services/tabRegistry.js` | Единственный состав вкладок модели задания и связь вкладки со схемой. |
| Предметные схемы | `src/services/schemas/*.schema.js` | Контракты `general`, `conrab`, `elements`, `regions`, `amps`, `moves`, `mhj`, библиотек ФММ и ВТСП. |
| Состояние модели | `src/services/modelService.js` | Публикация BaseModel и ревизий; не владеет табличным представлением. |
| Сериализация | `src/services/model/modelSerializer.js` | Преобразование StorageModel ↔ BaseModel. |
| Форма ARRAY | `src/services/model/arrayShape.js` | Размеры, ориентация и индексация плоских массивов. |
| Вычисления | `src/services/model/modelCompute.js` | Единый граф `compute`/`computeStored`, нормализация и transient-патчи. |
| Смена варианта | `src/services/model/variantChange.js` | Согласованное преобразование вариантных ARRAY при изменении `geo`. |
| История модели | `src/services/modelHistoryService.js` | Undo/Redo-снимки редактируемой модели задания. |
| Загрузка/сохранение | `src/services/dataService.js` | Файловый ввод-вывод задания и преобразование между файлами и BaseModel. |
| Несохранённые данные | `src/services/unsavedChangesService.js` | Базовые версии вкладок, явные dirty-признаки и общий перечень изменений. |

## 4. Табличный слой

| Область | Пути и владельцы |
|---|---|
| Построение | `src/tabulator/builders/TableBuilder.js` создаёт таблицы по схеме; `src/tabulator/tableOptions.js` владеет общими инвариантными опциями. |
| Разрешение свойств | `src/tabulator/schema/propertyResolver.js` — единственная точка получения эффективного дескриптора свойства для ячейки. |
| Преобразования | `src/tabulator/converters/` содержит ARRAY/RECORDS/CLUSTER-кодеки, вычисляемые представления, подписи строк и geo-варианты. |
| Форматирование | `src/tabulator/formatters/formatterRegistry.js` и `universalFormatter.js`. |
| Редактирование | `src/tabulator/editors/editorRegistry.js`, `editorFactory.js`, `universalEditor.js`. |
| Представления | `src/tabulator/views/viewRegistry.js`, `TableView.js`, `DetailRegion.js`, `HtcMaterialDetailView.js`, `registerDefaultViews.js`. |
| Операции | `src/tabulator/actions/recordsActions.js` и `elementMaterialActions.js`. |

## 5. Валидация и диагностика

| Владелец | Путь | Ответственность |
|---|---|---|
| Ограничения значения | `src/tabulator/validators/types/constraintValidator.js` и `src/tabulator/validators/constraints/` | Диспетчер и зарегистрированные проверки дескрипторных ограничений отдельной ячейки. |
| Модельные ограничения | `src/tabulator/validators/types/modelValidator.js`, `src/tabulator/validators/models/modelRegistry.js` и профильные каталоги `models/*/` | Условные, межполевые и предметные проверки BaseModel. |
| Сводка ограничений | `src/services/modelConstraintDiagnostics.js` | Подсчёт нарушений независимо от наличия экземпляров таблиц. |
| Общая диагностика | `src/services/diagnosticService.js` | Нормализация и группировка ошибок с координатами вкладки, записи и поля. |
| UI диагностики | `src/components/diagnostics/` | Окно сообщений и индикаторы проверки; не определяют предметные условия. |
| Ссылки материалов | `src/services/materialReferenceValidation.js` | Проверка `elements.xapName` относительно доступных библиотек. |

Фактические имена отдельных validator-файлов и регистраций следует искать через
импорты `modelRegistry` и схем; критерии проверки находятся в
[`AI_VERIFICATION.md`](AI_VERIFICATION.md).

## 6. Выбор задания, файловые операции и Clark

| Владелец | Путь | Ответственность |
|---|---|---|
| Выбор | `src/services/selectionService.js` | Выбранные проект и задание, а также версия загруженных данных. |
| Проверка среды | `src/services/fileSystemAccessSupport.js` | Наличие безопасного контекста и File System Access API, классификация ошибок диалогов. |
| Подтверждение задания | `src/services/taskApprovalService.js` | Маркер разрешения расчёта и его файловый жизненный цикл. |
| Список и запуск | `src/services/taskLaunchService.js` | `clark.tasks.txt`, связь с обработчиком `clark://` и формирование команд запуска. |
| Окно запуска | `src/components/tasks/TaskLaunchWindow.jsx` | Представление списка и операций; предметный файловый контракт остаётся у сервиса. |
| Предпросмотр | `src/services/taskGeometryPreviewService.js`, `src/components/geometry/TaskGeometryPreview.jsx` | Подготовка и показ геометрии выбранного, но ещё не загруженного задания. |
| Сводки | `src/services/taskSummaryService.js` | Чтение `_summary.txt` и `_summary_out.txt` без интерпретации формата результатов. |
| Демо | `src/services/demoTaskService.js` | Загружаемая копия демонстрационного задания в памяти браузера. |
| Примеры | `src/services/examplesService.js`, `src/components/help/ExamplesInstaller.jsx` | Установка дерева примеров из HTTP-источника. |

## 7. Библиотеки материалов

| Владелец | Путь | Ответственность |
|---|---|---|
| Реестр вкладок | `src/services/materialTabRegistry.js` | Состав вкладок библиотек вне модели задания. |
| Базовые данные | `src/services/defaultLibraryService.js` | Неизменяемые JSON-библиотеки из ресурсов сборки. |
| Локальные данные | `src/services/taskMaterialLibraryService.js` | Чтение и безопасная запись библиотек выбранного задания. |
| Модель/раскладка | `src/services/materials/materialLibraryModel.js`, `materialLibraryLayout.js`, `materialConstants.js` | Нормализация структуры и представления библиотек. |
| Загрузка | `src/services/materials/materialLibraryLoadQueue.js`, `materialLibraryService.js` | Очередь и координация источников библиотек. |
| Ревизии и история | `src/services/materialLibraryRevisionService.js`, `materialLibraryHistoryService.js` | Независимые ревизии и Undo/Redo вне BaseModel задания. |
| Импорт | `src/services/materialImport/` и `materialImportService.js` | Импорт legacy ФММ и конфигураций ВТСП. |
| UI | `src/tabs/MaterialLibraryTab.jsx`, `src/components/materials/` | Таблицы, графики и диалоги библиотек. |

## 8. Генераторы, графики и представления-ссылки

| Область | Владелец |
|---|---|
| Формулы времени | `src/services/generator/timeFunctionExpression.js` |
| Временная сетка и применение | `src/services/generator/timeFunctionModel.js` |
| Файловая история формул | `src/services/generator/timeFunctionHistoryService.js` |
| Окно генератора | `src/components/generator/TimeFunctionGenerator.jsx` |
| Модель графика RECORDS | `src/services/graphs/recordGraphModel.js` |
| Копирование графиков | `src/services/graphs/graphClipboard.js` |
| Контекстное меню/область | `src/components/graphs/GraphContextMenu.jsx`, `RecordGraphRegion.jsx` |
| View-only-ссылки | `src/services/referenceViewService.js`, `src/services/references/modelReferenceViews.js` |

## 9. 3D-визуализация

| Владелец | Путь | Ответственность |
|---|---|---|
| Окно/viewport | `src/components/geometry/GeometryViewerWindow.jsx`, `ThreeGeometryViewport.jsx` | Жизненный цикл окна и Three.js-сцены. |
| Сцена | `src/services/visualization/geometrySceneModel.js` | Чистая проекция `general`, `elements`, `regions`. |
| Время | `src/services/visualization/geometryTimeModel.js` | Положение, углы и амплитуды в выбранный момент. |
| Источники | `src/services/visualization/sourceVectorSceneModel.js` | Векторы `mhj`, AS/PS и симметричные образы. |
| Дискретизация | `src/services/visualization/geometryDiscretization.js` | Линии, центры, узлы и билинейные поверхности для отображения. |
| Камера | `geometryCameraView.js`, `geometryCameraFit.js` | Осевые виды и вписывание по текущей проекции. |
| Фильтры/стиль/picking | `geometryRenderFilters.js`, `geometryMaterialStyle.js`, `geometryPicking.js` | Видимость, палитра и адресные подписи объектов. |
| Solver-совместимая математика | `src/services/solver/rotation3d.js`, `symmetryExpansion.js`, `geometryKv.js`, `geometryTk.js`, `kvDerived.js`, `tkDerived.js`, `mhjLayout.js` | Прослеживаемые преобразования, перенесённые из Julia-решателя. |

## 10. Сборка, ресурсы и поставка

| Путь | Ответственность |
|---|---|
| `scripts/default-library-assets.mjs` | Подготовка и проверка базовых библиотек. |
| `scripts/prepare-examples-config.mjs` | Проверка и подготовка публичной конфигурации примеров. |
| `scripts/prepare-demo-assets.mjs` | Подготовка демонстрационных данных. |
| `scripts/serve-examples-assets.mjs` | Корректная HTTP-раздача дерева примеров в Vite. |
| `scripts/dev.cmd`, `build-local.cmd`, `release-lan.cmd` | Windows-сценарии разработки, сборки и LAN-выпуска. |
| `scripts/caddy/`, `deploy/caddy/` | Локальный HTTPS и конфигурация Caddy. |
| `.github/workflows/agent-check.yml` | Сборка на Ubuntu и Windows; тесты только при ручном параметре. |
| `.github/workflows/deploy-pages.yml` | Сборка и публикация GitHub Pages. |

Команды, предусловия и артефакты не дублируются здесь и находятся в
[`AI_BUILD_AND_RUNTIME.md`](AI_BUILD_AND_RUNTIME.md).

## 11. Тесты

Каждый файл `test/*.test.js` проверяет одноимённый сервис, модель или контракт
представления. Основные группы: модель и сериализация, схемы и ограничения,
табличные представления, библиотеки материалов, выбор и запуск задания,
генераторы, 3D-геометрия, сборочные ресурсы и файловые операции.

Точное состояние, команды и правила интерпретации результатов находятся только
в [`AI_VERIFICATION.md`](AI_VERIFICATION.md). Добавляя новый существенный
владелец поведения, следует добавить его в настоящий документ и определить
соответствующую проверку либо явно зафиксировать причину её отсутствия.


## 12. Подробные связи владельцев

Таблицы выше служат навигацией. Ниже находятся дополнительные границы и связи,
которые необходимо учитывать при изменении нескольких компонентов.

Schema (createSchema, tabRegistry), StorageModel, BaseModel, modelSerializer,
modelCompute, arrayShape, modelConverter, variantChange, arrayViewCodec,
computedView, referenceViewService, rowLabel, TableBuilder, tableOptions.

`modelCompute` — единственный владелец общего графа
`compute`/`computeStored`, определения участия свойства в StorageModel,
нормализации BaseModel и формирования transient-патчей вычисленных значений.

Инструменты обработки значения: universalFormatter / formatterRegistry,
universalEditor / editorRegistry / editorFactory, constraintValidator /
реестр ограничений.

Представления: ViewRegistry, ViewAdapter, View (TableView), DetailRegion и
основная View-проекция свойства вкладки.
Представление 3D-геометрии: GeometryViewerWindow,
ThreeGeometryViewport и общий UI-компонент FloatingWindow.

Прикладная проверка: modelValidator, modelRegistry.

Генерация временных зависимостей разделена на безопасный разбор
выражений, формирование временной сетки, применение результата и файловую
историю формул.
Проверку ссылок `xapName` на доступные библиотеки выполняет
`materialReferenceValidation`.

Сервисы состояния: modelService, diagnosticService, selectionService,
selectionContextService, clipboardService, dataService и
`unsavedChangesService`.
Подготовка 3D-сцены исходной геометрии выполняется чистым
`geometrySceneModel`; чистый `geometryDiscretization` рассчитывает
линии разбиения, центры и узлы только для 3D-представления.
Матрицы поворотов и раскрытие симметрий
принадлежат прослеживаемым до решателя модулям
`rotation3d` и `symmetryExpansion`. Чистый `geometryRenderFilters` владеет
режимами видимости исходных записей и образов симметрии, а
`geometryPicking` — адресными подписями объектов, вершин,
центров элементарных объёмов и узлов областей.

Базовые характеристики обслуживают `defaultLibraryService` и отдельный
`materialTabRegistry`. Чтение, копирование, импорт, редактирование и удаление в
локальной библиотеке выбранного задания выполняет
`taskMaterialLibraryService`; отдельную ревизию файлов публикует
`materialLibraryRevisionService`, независимо для ФММ и ВТСП. Несохранённые
снимки представления применяет `materialLibraryHistoryService` через контроллер
соответствующей вкладки. Эти операции не изменяют BaseModel задания и не
участвуют в его истории Undo/Redo.

`selectionService` хранит выбранное задание, его путь, признак демонстрационного
задания `loadedTaskIsDemo` и версию загруженных данных.
`selectionContextService` хранит активный экземпляр таблицы и ревизию
его выделения для операций панели; он не владеет выбранным заданием и не
дублирует состояние `selectionService`.

`fileSystemAccessSupport` является единственным владельцем проверки клиентского
окружения для операций с локальными файлами. Перед открытием системного диалога
UI проверяет `window.isSecureContext` и наличие требуемого метода File System
Access API. Для полной функциональности рекомендуются актуальные настольные
Google Chrome и Microsoft Edge. Название браузера не является условием запрета:
доступность конкретной файловой операции определяется безопасным контекстом и
наличием нужного API. При его отсутствии показывается объяснение и рекомендация
браузера. Отдельный Chromium SDK на клиенте не требуется.

Корневой каталог проектов выбирается с `mode: "readwrite"`: одно разрешение
покрывает чтение исходных данных, обычное сохранение и запись локальных
характеристик. Legacy-библиотека ФММ `XAP.lib` читается через уже выбранный
каталог задания. Пользовательский сценарий legacy-импорта ВТСП отсутствует.

Кнопка «Демо» находится справа в строке выбора каталога, имеет жёлтую надпись
и ширину по тексту. Она загружает «Демонстрационную задачу» без выбора локального
каталога. `scripts/prepare-demo-assets.mjs` упаковывает `data/demo` в статический
ресурс `.generated/demo-task.json`; пути и байты файлов сохраняются в пакете.
`demoTaskService` получает его с учётом `import.meta.env.BASE_URL` и при каждом
запуске демо создаёт отдельное записываемое дерево файлов в памяти браузера.
Содержимое `data/demo` представляется в этом дереве каталогом `input3XX`.

Демо проходит общий сценарий загрузки: предупреждение о несохранённых данных,
сброс прежней модели и диагностики, обновление предпросмотра, сводок и редакторов.
Таблицы, история и операции записи локальных характеристик работают с рабочей
копией. `DataEditor` и библиотечные сервисы используют обычный интерфейс
directory/file handle; отдельная копия BaseModel или отдельный парсер не создаётся.
В режиме демо `App` не выполняет сохранение модели, а `TaskInfoBar` отключает
кнопку «Сохранить модель». Просмотр каталога сообщает, что демо находится в памяти
браузера, без передачи виртуального handle системному диалогу. При загрузке
обычного задания признак демо сбрасывается. Повторное открытие демо и перезагрузка
страницы возвращают исходный набор данных; изменения рабочей копии не публикуются.

`App` владеет сеансовым логическим состоянием `admin`, начальное значение
которого равно `false`. Состояние не сохраняется и после перезагрузки страницы
возвращается в `false`. Выбор базового каталога в `Tasks` не зависит от `admin`:
кнопка «Выбрать каталог с проектами» допускает произвольное имя и расположение.
`clark.projects` остаётся обычным именем каталога примеров. Требования
File System Access API и разрешение `readwrite` сохраняются.

Отказ пользователя в системном диалоге представлен только `AbortError` и
обрабатывается без сообщения. Небезопасный контекст, отсутствие API, отказ в
разрешении и прочие ошибки открытия системного файлового диалога показываются
пользователю в модальном окне; их запрещено оставлять только в консоли или
подавлять.

Допустимое направление зависимостей: UI и View → адаптеры и реестры → чистые
форматтеры, валидаторы и модельные модули. Форматтеры, валидаторы и schema не
зависят от TableView или UI-компонентов.
