import {
    defaultLibraryService,
    MATERIAL_LIBRARY_KINDS,
} from "../defaultLibraryService";
import {
    toFmmLibraryModel,
    toHtcLibraryModel,
} from "./materialLibraryModel";
import { taskMaterialLibraryService } from "../taskMaterialLibraryService.js";

const adapters = Object.freeze({
    [MATERIAL_LIBRARY_KINDS.FMM]: toFmmLibraryModel,
    [MATERIAL_LIBRARY_KINDS.HTC]: toHtcLibraryModel,
});

export async function loadMaterialLibrary(kind, options) {
    const adapt = adapters[kind];
    if (!adapt) {
        throw new Error(`Неизвестный вид библиотеки характеристик '${kind}'.`);
    }

    const records = await defaultLibraryService.loadRecords(kind, options);
    return adapt(records);
}

export async function loadTaskMaterialLibrary(kind, taskHandle) {
    const adapt = adapters[kind];
    if (!adapt) {
        throw new Error(`Неизвестный вид библиотеки характеристик '${kind}'.`);
    }

    const records = await taskMaterialLibraryService.loadMaterials({
        taskHandle,
        kind,
    });
    return adapt(records);
}

export { MATERIAL_LIBRARY_KINDS };
