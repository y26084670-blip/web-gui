import {
    defaultLibraryService,
    MATERIAL_LIBRARY_KINDS,
} from "./defaultLibraryService.js";
import {
    legacyMaterialFileName,
    validateUniqueLegacyMaterialNames,
} from "./materialImport/legacyMaterialName.js";

const INPUT_DIRECTORY = "input3XX";
const TASK_LIBRARY_DIRECTORIES = Object.freeze({
    [MATERIAL_LIBRARY_KINDS.FMM]: "xapLibFMM",
    [MATERIAL_LIBRARY_KINDS.HTC]: "xapLibHTC",
});
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

function assertSafeFileName(fileName) {
    if (
        typeof fileName !== "string"
        || fileName.length === 0
        || fileName === "."
        || fileName === ".."
        || fileName.includes("/")
        || fileName.includes("\\")
    ) {
        throw new Error(`Недопустимое имя характеристики: '${fileName}'.`);
    }
}

function bytesToHex(bytes) {
    return [...bytes]
        .map(value => value.toString(16).padStart(2, "0"))
        .join("");
}

async function digestBytes(bytes, cryptoImpl) {
    if (typeof cryptoImpl?.subtle?.digest !== "function") {
        throw new Error("В окружении недоступна проверка SHA-256.");
    }
    const digest = await cryptoImpl.subtle.digest("SHA-256", bytes);
    return bytesToHex(new Uint8Array(digest));
}

async function readHandleBytes(fileHandle) {
    const file = await fileHandle.getFile();
    return new Uint8Array(await file.arrayBuffer());
}

async function findFileHandle(directoryHandle, fileName) {
    try {
        return {
            fileHandle: await directoryHandle.getFileHandle(fileName),
            exists: true,
        };
    } catch (error) {
        if (error?.name !== "NotFoundError") throw error;
        return {
            fileHandle: null,
            exists: false,
        };
    }
}

async function findDirectoryHandle(parentHandle, directoryName) {
    try {
        return {
            directoryHandle: await parentHandle.getDirectoryHandle(
                directoryName,
            ),
            exists: true,
        };
    } catch (error) {
        if (error?.name !== "NotFoundError") throw error;
        return {
            directoryHandle: null,
            exists: false,
        };
    }
}

async function writeBytes(fileHandle, bytes) {
    const writable = await fileHandle.createWritable();
    try {
        await writable.write(bytes);
        await writable.close();
    } catch (error) {
        try {
            await writable.abort?.();
        } catch {
            // Исходная ошибка записи важнее ошибки отмены.
        }
        throw error;
    }
}

export class MaterialFileConflictError extends Error {
    constructor({ path, existingSha256, expectedSha256 }) {
        super(
            `Локальная характеристика '${path}' отличается от базовой. `
            + "Для замены требуется явное подтверждение.",
        );
        this.name = "MaterialFileConflictError";
        this.path = path;
        this.existingSha256 = existingSha256;
        this.expectedSha256 = expectedSha256;
    }
}

export class MaterialBatchConflictError extends Error {
    constructor(conflicts) {
        const count = Array.isArray(conflicts) ? conflicts.length : 0;
        super(
            `Обнаружены отличающиеся локальные характеристики: ${count}. `
            + "Для их замены требуется единое подтверждение.",
        );
        this.name = "MaterialBatchConflictError";
        this.conflicts = Object.freeze(
            (conflicts ?? []).map(conflict =>
                Object.freeze({ ...conflict })),
        );
    }
}

export class MaterialBatchWriteError extends Error {
    constructor({
        kind,
        sourceName,
        written,
        failed,
        remaining,
        cause,
    }) {
        super(
            `Запись пакета характеристик выполнена частично: обработано `
            + `${written.length}; ошибка файла '${failed.path}'; `
            + `осталось ${remaining.length}.`,
            { cause },
        );
        this.name = "MaterialBatchWriteError";
        this.kind = kind;
        this.sourceName = sourceName;
        this.written = Object.freeze(written.map(item =>
            Object.freeze({ ...item })));
        this.failed = Object.freeze({ ...failed });
        this.remaining = Object.freeze(remaining.map(item =>
            Object.freeze({ ...item })));
    }
}

function conflictSignature(conflict) {
    return [
        conflict.path,
        conflict.existingSha256,
        conflict.expectedSha256,
    ].join("\u0000");
}

function conflictsMatchConfirmation(conflicts, expectedConflicts) {
    if (
        !Array.isArray(expectedConflicts)
        || conflicts.length !== expectedConflicts.length
    ) {
        return false;
    }

    const expected = new Set(expectedConflicts.map(conflictSignature));
    return conflicts.every(conflict =>
        expected.has(conflictSignature(conflict)));
}

function batchResult(kind, sourceName, results) {
    return {
        status: "written",
        kind,
        sourceName: String(sourceName ?? ""),
        results,
        created: results.filter(item => item.status === "created").length,
        replaced: results.filter(item => item.status === "replaced").length,
        unchanged: results.filter(item => item.status === "unchanged").length,
    };
}

function batchWriteError({
    kind,
    sourceName,
    results,
    item,
    remaining,
    cause,
}) {
    return new MaterialBatchWriteError({
        kind,
        sourceName: String(sourceName ?? ""),
        written: results,
        failed: {
            path: item.path,
            fileName: item.fileName,
            message: cause instanceof Error ? cause.message : String(cause),
        },
        remaining: remaining.map(next => ({
            path: next.path,
            fileName: next.fileName,
        })),
        cause,
    });
}

function requireTaskHandle(taskHandle) {
    if (!taskHandle || typeof taskHandle.getDirectoryHandle !== "function") {
        throw new Error("Каталог задания для записи не выбран.");
    }
}

function libraryDirectoryFor(kind) {
    const libraryDirectory = TASK_LIBRARY_DIRECTORIES[kind];
    if (!libraryDirectory) {
        throw new Error(`Неизвестный вид библиотеки: '${kind}'.`);
    }
    return libraryDirectory;
}

async function prepareImportedMaterials({
    kind,
    materials,
    cryptoImpl,
}) {
    libraryDirectoryFor(kind);
    if (!Array.isArray(materials) || materials.length === 0) {
        throw new Error("Пакет импорта не содержит характеристик.");
    }

    const names = validateUniqueLegacyMaterialNames(
        materials.map(material => material?.name),
    );
    const encoder = new TextEncoder();
    const prepared = [];

    for (let index = 0; index < materials.length; index += 1) {
        const material = materials[index];
        if (!material || typeof material !== "object" || Array.isArray(material)) {
            throw new TypeError(
                `Характеристика импорта ${index + 1} должна быть объектом.`,
            );
        }
        if (material.name !== names[index]) {
            throw new Error(
                `Имя характеристики должно быть записано без начальных `
                + `и конечных пробелов: '${names[index]}'.`,
            );
        }
        if (material.kind !== kind) {
            throw new Error(
                `Характеристика '${names[index]}' имеет вид '${material.kind}', `
                + `ожидался '${kind}'.`,
            );
        }

        const expectedFileName = legacyMaterialFileName(names[index]);
        if (material.fileName !== expectedFileName) {
            throw new Error(
                `Имя файла характеристики '${names[index]}' должно быть `
                + `'${expectedFileName}'.`,
            );
        }
        assertSafeFileName(material.fileName);
        if (typeof material.text !== "string") {
            throw new TypeError(
                `Характеристика '${names[index]}' не содержит текст UTF-8.`,
            );
        }

        const bytes = encoder.encode(material.text);
        prepared.push({
            material,
            fileName: material.fileName,
            bytes,
            sha256: await digestBytes(bytes, cryptoImpl),
        });
    }

    return prepared;
}

export function createTaskMaterialLibraryService({
    libraryService = defaultLibraryService,
    cryptoImpl = globalThis.crypto,
} = {}) {
    if (typeof libraryService?.loadBytes !== "function") {
        throw new Error("Не задан сервис базовой библиотеки характеристик.");
    }

    async function copyMaterial({
        taskHandle,
        record,
        overwrite = false,
    } = {}) {
        requireTaskHandle(taskHandle);

        const libraryDirectory = libraryDirectoryFor(record?.kind);
        assertSafeFileName(record.fileName);
        if (
            typeof record.sha256 !== "string"
            || !SHA256_PATTERN.test(record.sha256)
        ) {
            throw new Error("Характеристика не содержит корректный SHA-256.");
        }

        const inputHandle = await taskHandle.getDirectoryHandle(INPUT_DIRECTORY);
        const targetDirectory = await inputHandle.getDirectoryHandle(
            libraryDirectory,
            { create: true },
        );
        const targetPath = `${INPUT_DIRECTORY}/${libraryDirectory}/${record.fileName}`;
        const existing = await findFileHandle(targetDirectory, record.fileName);

        if (existing.exists) {
            const existingBytes = await readHandleBytes(existing.fileHandle);
            const existingSha256 = await digestBytes(existingBytes, cryptoImpl);
            if (existingSha256 === record.sha256) {
                return {
                    status: "unchanged",
                    path: targetPath,
                    byteSize: existingBytes.byteLength,
                    sha256: existingSha256,
                };
            }
            if (!overwrite) {
                throw new MaterialFileConflictError({
                    path: targetPath,
                    existingSha256,
                    expectedSha256: record.sha256,
                });
            }
        }

        const bytes = await libraryService.loadBytes(record);
        const fileHandle = existing.fileHandle
            ?? await targetDirectory.getFileHandle(
                record.fileName,
                { create: true },
            );
        await writeBytes(fileHandle, bytes);

        return {
            status: existing.exists ? "replaced" : "created",
            path: targetPath,
            byteSize: bytes.byteLength,
            sha256: record.sha256,
        };
    }

    async function copyMaterials({
        taskHandle,
        records,
        overwrite = false,
        expectedConflicts = undefined,
    } = {}) {
        requireTaskHandle(taskHandle);
        if (!Array.isArray(records) || records.length === 0) {
            throw new Error("Не выбраны базовые характеристики для копирования.");
        }

        const kind = records[0]?.kind;
        const libraryDirectory = libraryDirectoryFor(kind);
        const fileNames = new Set();
        for (const record of records) {
            if (record?.kind !== kind) {
                throw new Error(
                    "Один пакет копирования не может содержать характеристики разных видов.",
                );
            }
            assertSafeFileName(record.fileName);
            const fileKey = record.fileName.toLowerCase();
            if (fileNames.has(fileKey)) {
                throw new Error(
                    `Пакет копирования содержит повторное имя '${record.fileName}'.`,
                );
            }
            fileNames.add(fileKey);
            if (
                typeof record.sha256 !== "string"
                || !SHA256_PATTERN.test(record.sha256)
            ) {
                throw new Error(
                    `Характеристика '${record.fileName}' не содержит корректный SHA-256.`,
                );
            }
        }

        const inputHandle = await taskHandle.getDirectoryHandle(INPUT_DIRECTORY);
        const targetLookup = await findDirectoryHandle(
            inputHandle,
            libraryDirectory,
        );
        const targetPathPrefix = `${INPUT_DIRECTORY}/${libraryDirectory}`;
        const preflight = [];
        const conflicts = [];

        for (const record of records) {
            const existing = targetLookup.exists
                ? await findFileHandle(
                    targetLookup.directoryHandle,
                    record.fileName,
                )
                : { fileHandle: null, exists: false };
            let existingSha256 = null;
            let existingByteSize = 0;

            if (existing.exists) {
                const existingBytes = await readHandleBytes(existing.fileHandle);
                existingByteSize = existingBytes.byteLength;
                existingSha256 = await digestBytes(existingBytes, cryptoImpl);
            }

            const path = `${targetPathPrefix}/${record.fileName}`;
            const unchanged = existingSha256 === record.sha256;
            const item = {
                record,
                fileName: record.fileName,
                path,
                ...existing,
                existingSha256,
                existingByteSize,
                unchanged,
            };
            preflight.push(item);

            if (existing.exists && !unchanged) {
                conflicts.push({
                    path,
                    fileName: record.fileName,
                    existingSha256,
                    expectedSha256: record.sha256,
                });
            }
        }

        if (
            conflicts.length > 0
            && (
                !overwrite
                || !conflictsMatchConfirmation(conflicts, expectedConflicts)
            )
        ) {
            throw new MaterialBatchConflictError(conflicts);
        }

        // Получение и SHA-проверка всех требуемых базовых файлов завершаются
        // до первой записи в задание.
        for (const item of preflight) {
            if (!item.unchanged) {
                item.bytes = await libraryService.loadBytes(item.record);
            }
        }

        const needsWrite = preflight.some(item => !item.unchanged);
        const targetDirectory = needsWrite
            ? targetLookup.directoryHandle
                ?? await inputHandle.getDirectoryHandle(
                    libraryDirectory,
                    { create: true },
                )
            : targetLookup.directoryHandle;
        const results = [];

        for (let index = 0; index < preflight.length; index += 1) {
            const item = preflight[index];
            if (item.unchanged) {
                results.push({
                    status: "unchanged",
                    path: item.path,
                    byteSize: item.existingByteSize,
                    sha256: item.record.sha256,
                });
                continue;
            }

            try {
                const fileHandle = item.fileHandle
                    ?? await targetDirectory.getFileHandle(
                        item.fileName,
                        { create: true },
                    );
                await writeBytes(fileHandle, item.bytes);
                results.push({
                    status: item.exists ? "replaced" : "created",
                    path: item.path,
                    byteSize: item.bytes.byteLength,
                    sha256: item.record.sha256,
                });
            } catch (cause) {
                throw batchWriteError({
                    kind,
                    sourceName: "базовая библиотека",
                    results,
                    item,
                    remaining: preflight.slice(index + 1),
                    cause,
                });
            }
        }

        return batchResult(kind, "базовая библиотека", results);
    }

    async function writeImportedBatch({
        taskHandle,
        kind,
        materials,
        sourceName = "",
        overwrite = false,
        expectedConflicts = undefined,
    } = {}) {
        requireTaskHandle(taskHandle);
        const libraryDirectory = libraryDirectoryFor(kind);

        // Валидация всего пакета и расчёт ожидаемых SHA завершаются до
        // обращения к целевому каталогу и тем более до первой записи.
        const prepared = await prepareImportedMaterials({
            kind,
            materials,
            cryptoImpl,
        });
        const inputHandle = await taskHandle.getDirectoryHandle(INPUT_DIRECTORY);
        const targetLookup = await findDirectoryHandle(
            inputHandle,
            libraryDirectory,
        );
        const targetPathPrefix = `${INPUT_DIRECTORY}/${libraryDirectory}`;
        const preflight = [];
        const conflicts = [];

        for (const item of prepared) {
            const existing = targetLookup.exists
                ? await findFileHandle(
                    targetLookup.directoryHandle,
                    item.fileName,
                )
                : { fileHandle: null, exists: false };
            let existingSha256 = null;

            if (existing.exists) {
                const existingBytes = await readHandleBytes(existing.fileHandle);
                existingSha256 = await digestBytes(existingBytes, cryptoImpl);
            }

            const path = `${targetPathPrefix}/${item.fileName}`;
            const unchanged = existingSha256 === item.sha256;
            const state = {
                ...item,
                ...existing,
                existingSha256,
                path,
                unchanged,
            };
            preflight.push(state);

            if (existing.exists && !unchanged) {
                conflicts.push({
                    path,
                    fileName: item.fileName,
                    existingSha256,
                    expectedSha256: item.sha256,
                });
            }
        }

        // Ни новый файл, ни даже отсутствующий каталог библиотеки до этой
        // точки не создаются.
        if (
            conflicts.length > 0
            && (
                !overwrite
                || !conflictsMatchConfirmation(conflicts, expectedConflicts)
            )
        ) {
            throw new MaterialBatchConflictError(conflicts);
        }

        const needsWrite = preflight.some(item => !item.unchanged);
        const targetDirectory = needsWrite
            ? targetLookup.directoryHandle
                ?? await inputHandle.getDirectoryHandle(
                    libraryDirectory,
                    { create: true },
                )
            : targetLookup.directoryHandle;
        const results = [];

        for (let index = 0; index < preflight.length; index += 1) {
            const item = preflight[index];
            if (item.unchanged) {
                results.push({
                    status: "unchanged",
                    path: item.path,
                    byteSize: item.bytes.byteLength,
                    sha256: item.sha256,
                });
                continue;
            }

            try {
                const fileHandle = item.fileHandle
                    ?? await targetDirectory.getFileHandle(
                        item.fileName,
                        { create: true },
                    );
                await writeBytes(fileHandle, item.bytes);
                results.push({
                    status: item.exists ? "replaced" : "created",
                    path: item.path,
                    byteSize: item.bytes.byteLength,
                    sha256: item.sha256,
                });
            } catch (cause) {
                throw batchWriteError({
                    kind,
                    sourceName,
                    results,
                    item,
                    remaining: preflight.slice(index + 1),
                    cause,
                });
            }
        }

        return batchResult(kind, sourceName, results);
    }

    return Object.freeze({
        copyMaterial,
        copyMaterials,
        writeImportedBatch,
    });
}

export const taskMaterialLibraryService = createTaskMaterialLibraryService();
