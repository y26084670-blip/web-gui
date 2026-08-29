import { MATERIAL_LIBRARY_KINDS } from "../../services/defaultLibraryService.js";
import { TABS } from "../../services/schemas/common/constants.js";

function materialKindForModel(model) {
    return Number(model) === 2
        ? MATERIAL_LIBRARY_KINDS.HTC
        : MATERIAL_LIBRARY_KINDS.FMM;
}

export function selectedElementMaterialRequest(table) {
    if (table?._gui?.schema?.id !== TABS.ELEMENTS.id) {
        throw new Error("Выбор характеристики доступен только для элементов модели.");
    }

    const rows = table.getSelectedRows?.() ?? [];
    if (rows.length === 0) {
        throw new Error("Выберите хотя бы один элемент модели.");
    }

    const kinds = new Set(
        rows.map(row => materialKindForModel(row.getData()?.model)),
    );
    if (kinds.size !== 1) {
        throw new Error(
            "Выбранные элементы относятся к разным видам характеристик ФММ и ВТСП.",
        );
    }

    return {
        table,
        rows,
        kind: [...kinds][0],
        count: rows.length,
    };
}

export async function assignSelectedElementMaterial(request, name) {
    const value = String(name ?? "").trim();
    if (!value) {
        throw new Error("Не выбрана характеристика материала.");
    }
    if (value.toLowerCase().endsWith(".txt")) {
        throw new Error("Имя характеристики задаётся без расширения .txt.");
    }

    const rowData = request.rows.map(row => row.getData());
    const setter = request.table?._gui?.model?.setRecordsValue;
    if (typeof setter !== "function") {
        throw new Error("Активная таблица не поддерживает групповое назначение.");
    }
    await setter(rowData, "xapName", value);
    return rowData.length;
}
