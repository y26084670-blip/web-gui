import {
    createFmmMaterialFile,
    parseXapLibrary,
} from "./materialImport/xapLibImporter.js";
import {
    createHtcMaterialFile,
    parseHtcMaterial,
} from "./materialImport/htcConfigImporter.js";
import { validateUniqueLegacyMaterialNames } from "./materialImport/legacyMaterialName.js";

export const MATERIAL_IMPORT_KINDS = Object.freeze({
    FMM: "FMM",
    HTC: "HTC",
});

export const LEGACY_HTC_OUTPUT_DIRECTORY = "new_xapLibHTC";

function requireCallback(value, name) {
    if (typeof value !== "function") {
        throw new TypeError(`materialImportService: ${name} должен быть функцией.`);
    }
    return value;
}

function cancelled(kind) {
    return {
        status: "cancelled",
        kind,
        count: 0,
        materials: [],
    };
}

function isCancellation(error) {
    return error?.name === "AbortError";
}

async function selectedFile(selection) {
    const candidate = Array.isArray(selection)
        ? selection[0]
        : selection;

    if (!candidate) return null;
    if (typeof candidate.arrayBuffer === "function") return candidate;
    if (typeof candidate.getFile === "function") return candidate.getFile();

    throw new TypeError(
        "Выбор XAP.lib должен вернуть File, FileSystemFileHandle или массив из одного handle.",
    );
}

async function readDirectoryFile(directory, fileName) {
    let handle;
    try {
        handle = await directory.getFileHandle(fileName);
    } catch (error) {
        if (error?.name === "NotFoundError") {
            throw new Error(
                `В каталоге характеристики «${directory.name}» отсутствует ${fileName}.`,
                { cause: error },
            );
        }
        throw error;
    }

    return handle.getFile();
}

async function directoryHasFile(directory, fileName) {
    try {
        await directory.getFileHandle(fileName);
        return true;
    } catch (error) {
        if (error?.name === "NotFoundError") return false;
        throw error;
    }
}

function compareNames([first], [second]) {
    if (first < second) return -1;
    if (first > second) return 1;
    return 0;
}

/**
 * Выбирает один XAP.lib, полностью разбирает и проверяет пакет и лишь затем
 * передаёт единственный batch внешнему writer.
 */
export async function importFmmLegacyMaterials({
    pickFile,
    writeBatch,
}) {
    requireCallback(pickFile, "pickFile");
    requireCallback(writeBatch, "writeBatch");

    let selection;
    try {
        selection = await pickFile();
    } catch (error) {
        if (isCancellation(error)) return cancelled(MATERIAL_IMPORT_KINDS.FMM);
        throw error;
    }

    const file = await selectedFile(selection);
    if (!file) return cancelled(MATERIAL_IMPORT_KINDS.FMM);
    if (typeof file.name === "string" && file.name.toLowerCase() !== "xap.lib") {
        throw new Error(
            `Выбран файл «${file.name}»; требуется legacy-библиотека XAP.lib.`,
        );
    }

    const records = parseXapLibrary(await file.arrayBuffer());
    const materials = records.map(createFmmMaterialFile);
    const writeResult = await writeBatch({
        kind: MATERIAL_IMPORT_KINDS.FMM,
        materials,
        sourceName: file.name ?? "XAP.lib",
    });

    return {
        status: "written",
        kind: MATERIAL_IMPORT_KINDS.FMM,
        count: materials.length,
        materials,
        writeResult,
    };
}

/**
 * Выбирает каталог ВТСП, читает его непосредственные подкаталоги, полностью
 * проверяет пакет и лишь затем передаёт единственный batch внешнему writer.
 */
export async function importHtcLegacyMaterials({
    pickDirectory,
    writeBatch,
}) {
    requireCallback(pickDirectory, "pickDirectory");
    requireCallback(writeBatch, "writeBatch");

    let sourceDirectory;
    try {
        sourceDirectory = await pickDirectory();
    } catch (error) {
        if (isCancellation(error)) return cancelled(MATERIAL_IMPORT_KINDS.HTC);
        throw error;
    }

    if (!sourceDirectory) return cancelled(MATERIAL_IMPORT_KINDS.HTC);
    if (typeof sourceDirectory.entries !== "function") {
        throw new TypeError(
            "Выбор библиотеки ВТСП должен вернуть FileSystemDirectoryHandle.",
        );
    }

    const directories = [];
    for await (const entry of sourceDirectory.entries()) {
        const [name, handle] = entry;
        if (handle?.kind !== "directory") continue;

        if (name.toLowerCase() === LEGACY_HTC_OUTPUT_DIRECTORY.toLowerCase()) {
            const [hasConfig, hasComment] = await Promise.all([
                directoryHasFile(handle, "config.txt"),
                directoryHasFile(handle, "comment.txt"),
            ]);
            if (hasConfig || hasComment) {
                throw new Error(
                    `Каталог прежнего результата «${name}» содержит `
                    + "config.txt или comment.txt и неоднозначен с каталогом "
                    + "характеристики ВТСП.",
                );
            }
            continue;
        }

        directories.push([name, handle]);
    }
    directories.sort(compareNames);

    if (directories.length === 0) {
        throw new Error(
            `В каталоге «${sourceDirectory.name ?? "выбранная библиотека"}» `
            + "нет подкаталогов характеристик ВТСП.",
        );
    }

    const normalizedNames = validateUniqueLegacyMaterialNames(
        directories.map(([name]) => name),
    );
    const parsedMaterials = [];

    // Сначала читается и валидируется весь пакет. writeBatch ещё не вызван.
    for (let index = 0; index < directories.length; index += 1) {
        const [, directory] = directories[index];
        const [configFile, commentFile] = await Promise.all([
            readDirectoryFile(directory, "config.txt"),
            readDirectoryFile(directory, "comment.txt"),
        ]);
        const [config, comment] = await Promise.all([
            configFile.arrayBuffer(),
            commentFile.arrayBuffer(),
        ]);
        const { version, record } = parseHtcMaterial({
            name: normalizedNames[index],
            config,
            comment,
        });

        parsedMaterials.push(createHtcMaterialFile(record, { version }));
    }

    const writeResult = await writeBatch({
        kind: MATERIAL_IMPORT_KINDS.HTC,
        materials: parsedMaterials,
        sourceName: sourceDirectory.name ?? "",
    });

    return {
        status: "written",
        kind: MATERIAL_IMPORT_KINDS.HTC,
        count: parsedMaterials.length,
        materials: parsedMaterials,
        writeResult,
    };
}

export function createMaterialImportService({
    pickFmmFile,
    pickHtcDirectory,
    writeBatch,
}) {
    requireCallback(writeBatch, "writeBatch");

    return {
        importFmm() {
            return importFmmLegacyMaterials({
                pickFile: requireCallback(pickFmmFile, "pickFmmFile"),
                writeBatch,
            });
        },
        importHtc() {
            return importHtcLegacyMaterials({
                pickDirectory: requireCallback(
                    pickHtcDirectory,
                    "pickHtcDirectory",
                ),
                writeBatch,
            });
        },
    };
}
