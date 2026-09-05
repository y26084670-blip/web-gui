// Deliberately small fallback, not a copy of the server or its persistent memory.
const TOPICS = [
  ["getting_started", "Куда коня впрягать", "Выберите базовый каталог кнопкой слева, затем проект и задачу. Нажмите «Загрузить для редактирования».", "начать первый шаг каталог"],
  ["install", "Как установить", "Запустите редактор из установленного комплекта CLARK. Для базовой справки отдельный агент не требуется.", "установка установить"],
  ["usage", "Как пользоваться", "Выберите и загрузите задачу, отредактируйте её, выполните «Проверить модель» и сохраните изменения.", "порядок работа пользоваться"],
  ["editor", "Как пользоваться редактором", "Выделение задачи показывает сведения о ней. Редактируется только задача, загруженная кнопкой «Загрузить для редактирования».", "редактор таблица вкладка"],
  ["projects", "Как выбрать/создать/удалить проект", "После выбора базового каталога выберите проект в списке. Создание и удаление каталогов не выполняются помощником; предварительно сохраните работу.", "проект каталог"],
  ["tasks", "Как выбрать/создать/удалить задачу", "Выберите задачу в списке проекта и загрузите её для редактирования. Помощник не создаёт и не удаляет каталоги задач.", "задача задание загрузить"],
  ["data_create", "Как создать данные", "В загруженной задаче заполните общие параметры, элементы, свойства и нужные зависимости. Затем проверьте модель.", "данные создать input3xx"],
  ["data_import", "Как импортировать данные", "Для legacy-данных используйте импортёр комплекта CLARK. После импорта загрузите созданный input3XX, проверьте модель и сохраните её.", "импорт legacy формат"],
  ["geometry", "Как создать/исправить/удалить геометрию", "Откройте «Элементы модели». Измените нужные строки и координаты, осмотрите геометрию и выполните «Проверить модель».", "геометрия координаты элемент форма"],
  ["properties", "Как создать/исправить/удалить свойства", "Во вкладке «Элементы модели» проверьте тип материала и назначенную характеристику. Характеристика должна быть в локальной библиотеке задачи.", "свойства материал фмм втсп характеристика"],
  ["validation", "Как найти/исправить ошибки/неточности", "Выполните «Проверить модель» и разберите сообщения. Нарушения ограничений ввода отмечаются красными границами; остальные ошибки также ищите в диагностике.", "ошибка проверить модель предупреждение ограничение красная граница"],
  ["inspect", "Как осмотреть работу", "Осмотрите геометрию в 3D и сведения о выбранной задаче. Наличие каталога результатов само по себе не подтверждает их актуальность.", "осмотреть посмотреть работа результат"],
  ["save", "Как сохранить работу", "Используйте штатную команду сохранения редактора. Перед переходом к другой задаче убедитесь, что нужные изменения сохранены.", "сохранить запись"],
  ["run", "Как запустить расчет", "Сохраните и проверьте модель. Запуск выполняется средствами установленного комплекса, не кнопкой помощника.", "расчёт расчет запустить solver"],
  ["results_3d", "Как посмотреть результаты в 3D", "Предпросмотр на вкладке задач показывает геометрию. Не путайте его с визуализацией рассчитанного поля; проверьте доступность средств просмотра результатов.", "3d результаты поле"],
  ["results_protocols", "Как посмотреть результаты в протоколах", "Откройте текстовые протоколы нужной задачи в output3XX. Сверьте дату расчёта и задачу с текущими данными.", "протокол output3xx"],
  ["request_missing", "Как затребовать нужное, но отсутствующее", "Сформулируйте цель и отсутствующую операцию. Текущий помощник не отправляет обращения или рабочие данные разработчику.", "запросить отсутствует добавить"],
  ["exit", "Как перестать пользоваться всем этим", "Сохраните нужные изменения и закройте редактор. Локальную память отдельного агента можно очистить на его странице настроек.", "закрыть выйти перестать"]
];
export const BUILTIN_TOPICS = Object.freeze(TOPICS.map(([id, title, summary]) => Object.freeze({ id, title, summary })));
export const getBuiltinTopic = (id) => BUILTIN_TOPICS.find((topic) => topic.id === id) ?? null;
const normalizeText = (value) => String(value ?? "").toLowerCase().replaceAll("ё", "е").replace(/[^\p{L}\p{N}]+/gu, " ");
export function findBuiltinTopic(query) {
  const tokens = normalizeText(query).split(/\s+/u).filter((t) => t.length > 2 && !["как", "что", "где", "мне", "это"].includes(t));
  let best = null, score = 0;
  TOPICS.forEach(([id, title, _summary, aliases]) => {
    const words = normalizeText(title + " " + aliases).split(/\s+/u);
    const current = tokens.reduce((sum, token) => sum + (words.includes(token) ? 1 : 0), 0);
    if (current > score) { score = current; best = getBuiltinTopic(id); }
  });
  return best;
}
function result(id, message, helpTopic, level = "info") {
  return { schemaVersion: 1, recommendationId: id, message, helpTopic, level, source: "builtin" };
}
function issueCount(value, explicit) {
  const count = explicit ?? (Array.isArray(value) ? value.length : typeof value === "object" && value
    ? value.count ?? value.items?.length : value) ?? 0;
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}
export function analyzeBuiltin(state = {}) {
  if (!state || typeof state !== "object" || Array.isArray(state)
      || (state.schemaVersion !== undefined && state.schemaVersion !== 1)) {
    return result("state.invalid", "Не удалось определить состояние. Проверьте модель штатной командой.", "validation", "error");
  }
  if (!state.projectsRoot?.selected) return result("projects_root.missing", "Сначала выберите базовый каталог с проектами.", "projects");
  if (!state.project?.selected) return result("project.missing", "Выберите проект в списке слева.", "projects");
  if (!state.task?.selected) return result("task.missing", "Выберите задачу в списке проекта.", "tasks");
  if (!state.task?.loaded) return result("task.not_loaded", "Нажмите «Загрузить для редактирования» у выбранной задачи.", "tasks");
  const validation = state.validation ?? {};
  const errors = issueCount(validation.errors, validation.errorCount);
  const warnings = issueCount(validation.warnings, validation.warningCount);
  if (errors === null || warnings === null) return result("state.invalid", "Диагностика имеет неверный формат. Выполните «Проверить модель».", "validation", "error");
  if (errors > 0 || state.geometry?.valid === false) return result("validation.errors",
    "Исправьте ошибки модели. Красные границы отмечают нарушения ограничений ввода; проверьте также сообщения диагностики.", "validation", "error");
  if (state.data?.exists === false) return result("data.missing", "В загруженной задаче ещё нет исходных данных.", "data_create");
  if (state.geometry?.exists === false) return result("geometry.missing", "Подготовьте геометрию во вкладке «Элементы модели».", "geometry");
  if (state.properties?.assigned === false) return result("properties.missing", "Проверьте свойства и локальные характеристики элементов.", "properties");
  if (validation.checked !== true) return result("validation.unchecked", "Выполните «Проверить модель». Проверьте данные по ограничениям и значения с красными границами.", "validation");
  if (state.data?.dirty) return result("data.unsaved", "Сохраните изменения штатной командой редактора.", "save", "warning");
  if (warnings > 0) return result("validation.warnings", `Разберите предупреждения проверки модели: ${warnings}.`, "validation", "warning");
  return result("builtin.continue", "Продолжайте работу с проверенной задачей. Перед расчётом убедитесь, что нужные изменения сохранены.", "usage");
}
