import { DIRECTORIES } from "../schemas/common/constants.js";

const FORMAT_VERSION = 1;
const SAFE_FILE_NAME = /^[^\\/:*?"<>|]+\.txt$/iu;

function requireTaskHandle(taskHandle) {
    if (typeof taskHandle?.getDirectoryHandle !== "function") {
        throw new Error("Задание для работы с историей формул не загружено.");
    }
    return taskHandle;
}

function requireFileName(fileName) {
    const value = String(fileName ?? "");
    if (!SAFE_FILE_NAME.test(value) || value === "." || value === "..") {
        throw new Error(`Недопустимое имя файла истории формул '${value}'.`);
    }
    return value;
}

function normalizeFormulas(formulas) {
    if (!Array.isArray(formulas)) {
        throw new Error("История формул должна быть массивом.");
    }
    return formulas.map((formula, index) => {
        if (typeof formula !== "string" || formula.trim().length === 0) {
            throw new Error(`Формула ${index + 1} в истории пуста или некорректна.`);
        }
        return formula;
    });
}

export function serializeFormulaHistory(formulas) {
    return JSON.stringify({
        version: FORMAT_VERSION,
        formulas: normalizeFormulas(formulas),
    });
}

export function parseFormulaHistory(text) {
    let value;
    try {
        value = JSON.parse(String(text ?? ""));
    } catch (error) {
        throw new Error(`Файл истории формул не разобран: ${error.message}`);
    }

    if (
        !value
        || typeof value !== "object"
        || Array.isArray(value)
        || value.version !== FORMAT_VERSION
    ) {
        throw new Error("Файл истории формул имеет неподдерживаемый формат.");
    }
    return normalizeFormulas(value.formulas);
}

export async function saveFormulaHistory({ taskHandle, fileName, formulas }) {
    requireTaskHandle(taskHandle);
    const name = requireFileName(fileName);
    const input = await taskHandle.getDirectoryHandle(
        DIRECTORIES.INPUT,
        { create: true },
    );
    const file = await input.getFileHandle(name, { create: true });
    const writable = await file.createWritable();
    await writable.write(serializeFormulaHistory(formulas));
    await writable.close();
}

export async function loadFormulaHistory({ taskHandle, fileName }) {
    requireTaskHandle(taskHandle);
    const name = requireFileName(fileName);
    const input = await taskHandle.getDirectoryHandle(DIRECTORIES.INPUT);
    let handle;
    try {
        handle = await input.getFileHandle(name);
    } catch (error) {
        if (error?.name === "NotFoundError") {
            throw new Error(`Файл истории формул '${name}' не найден.`);
        }
        throw error;
    }
    return parseFormulaHistory(await (await handle.getFile()).text());
}
