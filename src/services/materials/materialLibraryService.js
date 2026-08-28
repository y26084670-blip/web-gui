import {
    defaultLibraryService,
    MATERIAL_LIBRARY_KINDS,
} from "../defaultLibraryService";
import {
    toFmmLibraryModel,
    toHtcLibraryModel,
} from "./materialLibraryModel";

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

export { MATERIAL_LIBRARY_KINDS };
