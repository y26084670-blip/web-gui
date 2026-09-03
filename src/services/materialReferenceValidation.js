import {
    MATERIAL_LIBRARY_KINDS,
} from "./defaultLibraryService.js";
import { taskMaterialLibraryService } from "./taskMaterialLibraryService.js";
import { TABS } from "./schemas/common/constants.js";
import { createError } from "../tabulator/validators/common/createDiagnostic.js";

function normalizedName(value) {
    return String(value ?? "").trim().normalize("NFC").toLocaleLowerCase("ru-RU");
}

function emptyKindIndex() {
    return {
        names: new Map(),
        collisions: new Map(),
    };
}

export function createMaterialReferenceCatalog(recordsByKind = {}) {
    const catalog = {
        [MATERIAL_LIBRARY_KINDS.FMM]: emptyKindIndex(),
        [MATERIAL_LIBRARY_KINDS.HTC]: emptyKindIndex(),
    };

    for (const kind of Object.values(MATERIAL_LIBRARY_KINDS)) {
        const spellings = new Map();
        for (const record of recordsByKind[kind] ?? []) {
            const name = String(record?.name ?? "").trim();
            const key = normalizedName(name);
            if (!key) continue;
            if (!spellings.has(key)) spellings.set(key, new Set());
            spellings.get(key).add(name);
        }

        for (const [key, values] of spellings) {
            const names = [...values].sort((left, right) =>
                left.localeCompare(right, "ru-RU"));
            catalog[kind].names.set(key, names[0]);
            if (names.length > 1) catalog[kind].collisions.set(key, names);
        }
    }

    return catalog;
}

export async function loadMaterialReferenceCatalog(
    taskHandle,
    { taskLibraryService = taskMaterialLibraryService } = {},
) {
    const requests = Object.values(MATERIAL_LIBRARY_KINDS).map(kind => ({
        kind,
        load: () => taskLibraryService.loadMaterials({
            taskHandle,
            kind,
        }),
    }));

    const settled = await Promise.allSettled(
        requests.map(request => request.load()),
    );
    const recordsByKind = {
        [MATERIAL_LIBRARY_KINDS.FMM]: [],
        [MATERIAL_LIBRARY_KINDS.HTC]: [],
    };
    const errors = [];

    settled.forEach((result, index) => {
        const request = requests[index];
        if (result.status === "fulfilled") {
            recordsByKind[request.kind].push(...result.value);
            return;
        }
        errors.push(
            `локальная библиотека ${request.kind}: `
            + (result.reason instanceof Error
                ? result.reason.message
                : String(result.reason)),
        );
    });

    return {
        catalog: createMaterialReferenceCatalog(recordsByKind),
        errors,
    };
}

function materialKindForModel(model) {
    return Number(model) === 2
        ? MATERIAL_LIBRARY_KINDS.HTC
        : MATERIAL_LIBRARY_KINDS.FMM;
}

function oppositeKind(kind) {
    return kind === MATERIAL_LIBRARY_KINDS.HTC
        ? MATERIAL_LIBRARY_KINDS.FMM
        : MATERIAL_LIBRARY_KINDS.HTC;
}

export function validateElementMaterialReferences(
    elements,
    catalog,
    diagnostics,
) {
    if (!Array.isArray(elements) || !catalog) return;

    elements.forEach((element, index) => {
        const name = String(element?.xapName ?? "").trim();
        if (!name) return;

        const key = normalizedName(name);
        const expected = materialKindForModel(element?.model);
        const other = oppositeKind(expected);
        const expectedIndex = catalog[expected] ?? emptyKindIndex();
        const otherIndex = catalog[other] ?? emptyKindIndex();
        let message = "";

        if (expectedIndex.collisions.has(key)) {
            message =
                `Ссылка '${name}' неоднозначна в библиотеке ${expected}: `
                + expectedIndex.collisions.get(key).join(", ");
        } else if (expectedIndex.names.has(key)) {
            return;
        } else if (otherIndex.names.has(key)) {
            message =
                `Ссылка '${name}' найдена только в библиотеке ${other}, `
                + `но model = ${element?.model} требует ${expected}`;
        } else {
            message =
                `Файл характеристики '${name}.txt' не найден `
                + `в библиотеке ${expected}`;
        }

        diagnostics.push(createError({
            tab: TABS.ELEMENTS,
            row: index + 1,
            property: "xapName",
            message,
        }));
    });
}
