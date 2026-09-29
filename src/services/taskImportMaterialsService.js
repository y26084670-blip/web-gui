import { createFmmMaterialFile, parseXapLibrary } from "./materialImport/xapLibImporter.js";
import { validateLegacyMaterialName } from "./materialImport/legacyMaterialName.js";
import { MaterialBatchConflictError, taskMaterialLibraryService } from "./taskMaterialLibraryService.js";
import { materialLibraryRevisionService } from "./materialLibraryRevisionService.js";

const nameKey = value => value.trim().normalize("NFC").toLocaleLowerCase("ru-RU");
const messageOf = error => error?.message || String(error);

// Совпадает с регистронезависимым сравнением ссылок редактора. Выделение,
// видимость и назначение элемента не ограничивают сбор ссылок на ФММ.
export function collectUsedFmmNames(elements) {
  const names = new Map();
  for (const element of elements) {
    if (!element || ![0, 1].includes(Number(element.model))) continue;
    const name = String(element.xapName ?? "").trim();
    if (name && !names.has(nameKey(name))) names.set(nameKey(name), validateLegacyMaterialName(name));
  }
  return [...names.values()];
}

export async function findLocalXap(task) {
  let found = null;
  for await (const [name, handle] of task.entries()) {
    if (name.toLowerCase() !== "xap.lib") continue;
    if (handle.kind !== "file") throw new Error("XAP.lib не является файлом.");
    if (found) throw new Error("В каталоге несколько файлов с именем XAP.lib.");
    found = handle;
  }
  return found;
}

async function taskDirectory(root, path) {
  const parts = path.replaceAll("\\", "/").split("/");
  if (parts.length !== 2 || parts.some(part => !part || part === "." || part === ".."
    || /[<>:"|?*\u0000-\u001f]/.test(part))) throw new Error("Некорректный путь задания.");
  return (await root.getDirectoryHandle(parts[0])).getDirectoryHandle(parts[1]);
}

/** Импорт по снимку текущих элементов. Не читает kvs.txt и не меняет модель.
 * Ошибки записи передаются вызывающему коду, отсутствие имени — только info. */
export async function importUsedFmmMaterials(task, elements, {
  isCurrent = () => true,
  libraryService = taskMaterialLibraryService,
  notifyChanged = () => materialLibraryRevisionService.notifyChanged("FMM"),
} = {}) {
  const result = { imported: 0, messages: [], writeResult: null };
  const info = text => result.messages.push({ level: "info", text });
  // Снимок ссылок формируется до первого await.
  const names = collectUsedFmmNames(elements);
  if (!isCurrent()) return result;
  const xap = await findLocalXap(task);
  if (!isCurrent()) return result;
  if (!xap) throw new Error("В каталоге выбранного задания отсутствует XAP.lib.");
  if (!names.length) { info("Используемых характеристик ФММ нет."); return result; }
  // Выборочный импорт допускает и стандартную локальную XAP.lib.
  const records = parseXapLibrary(await (await xap.getFile()).arrayBuffer());
  const byName = new Map();
  for (const record of records) {
    const key = nameKey(record.name);
    if (byName.has(key)) throw new Error(`Неоднозначное имя в XAP.lib: ${record.name}`);
    byName.set(key, record);
  }
  const materials = [];
  for (const name of names) {
    const record = byName.get(nameKey(name));
    if (!record) info(`Характеристика «${name}» не найдена в XAP.lib; импорт продолжается.`);
    else materials.push(createFmmMaterialFile({ ...record, name }));
  }
  if (!isCurrent()) return result;
  if (!materials.length) return result;
  const request = { taskHandle: task, kind: "FMM", materials, sourceName: "XAP.lib" };
  try {
    try {
      result.writeResult = await libraryService.writeImportedBatch(request);
    } catch (error) {
      if (!(error instanceof MaterialBatchConflictError)) throw error;
      if (!isCurrent()) return result;
      // Замена уже подтверждена общей командой импорта. Штатный writer
      // повторно сверяет SHA конфликтов, не обходя защиту от внешних правок.
      result.writeResult = await libraryService.writeImportedBatch({ ...request, overwrite: true,
        expectedConflicts: error.conflicts });
    }
  } finally {
    // В том числе после возможной частичной записи при файловой ошибке.
    notifyChanged();
  }
  result.imported = materials.length;
  info(`Характеристики ФММ перенесены: ${materials.length} из ${names.length} используемых.`);
  return result;
}

/** Дополняет только успешно завершённый native-импорт. Ошибка одного задания
 * не останавливает остальные; отсутствие имени — информационная запись.
 * isCurrent не позволяет начать следующую запись после смены корня/запроса.
 */
export async function importUsedTaskMaterials(root, entries, {
  isCurrent = () => true,
  libraryService = taskMaterialLibraryService,
  notifyChanged = () => materialLibraryRevisionService.notifyChanged("FMM"),
} = {}) {
  const messages = [];
  const seenPaths = new Set();
  let imported = 0;
  for (const entry of entries) {
    if (!isCurrent()) break;
    if (!entry.enabled) continue;
    const path = String(entry.path ?? "");
    const key = path.replaceAll("\\", "/").toLowerCase();
    if (seenPaths.has(key)) continue;
    seenPaths.add(key);
    try {
      const task = await taskDirectory(root, path);
      const xap = await findLocalXap(task);
      if (!isCurrent()) break;
      if (!xap) continue;
      const input = await task.getDirectoryHandle("input3XX");
      const file = await (await input.getFileHandle("kvs.txt")).getFile();
      const text = (await file.text()).replace(/^\uFEFF/, "");
      const elements = text.split(/\r?\n/).filter(line => line.trim()).map((line, index) => {
        const record = JSON.parse(line);
        if (!record || typeof record !== "object" || Array.isArray(record)) {
          throw new Error(`kvs.txt: запись ${index + 1} не является объектом.`);
        }
        return record;
      });
      const result = await importUsedFmmMaterials(task, elements, {
        isCurrent, libraryService, notifyChanged,
      });
      imported += result.imported;
      messages.push(...result.messages.map(message => ({ ...message, path })));
    } catch (error) {
      messages.push({ level: "error", path, text: `Импорт характеристик: ${messageOf(error)}` });
    }
  }
  return { imported, messages };
}
