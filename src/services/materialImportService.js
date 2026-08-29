import {
    createFmmMaterialFile,
    parseXapLibrary,
} from "./materialImport/xapLibImporter.js";
import { identifyLegacyFmmLibrary } from "./materialImport/legacyFmmLibraryFingerprint.js";

export const MATERIAL_IMPORT_KINDS = Object.freeze({
    FMM: "FMM",
});

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

/**
 * Выбирает один XAP.lib, полностью разбирает и проверяет пакет и лишь затем
 * передаёт единственный batch внешнему writer.
 */
export async function importFmmLegacyMaterials({
    pickFile,
    writeBatch,
    cryptoImpl = globalThis.crypto,
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

    const identity = await identifyLegacyFmmLibrary(file, { cryptoImpl });
    if (identity.isBaseLibrary) {
        throw new Error(
            "XAP.lib совпадает со стандартной legacy-библиотекой; "
            + "импорт и дублирование характеристик не требуются.",
        );
    }

    const records = parseXapLibrary(identity.source);
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

export function createMaterialImportService({
    pickFmmFile,
    writeBatch,
    cryptoImpl = globalThis.crypto,
}) {
    requireCallback(writeBatch, "writeBatch");

    return {
        importFmm() {
            return importFmmLegacyMaterials({
                pickFile: requireCallback(pickFmmFile, "pickFmmFile"),
                writeBatch,
                cryptoImpl,
            });
        },
    };
}
