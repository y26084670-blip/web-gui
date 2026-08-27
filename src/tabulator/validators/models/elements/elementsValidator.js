import { createError } from "../../common/createDiagnostic.js";
import { TABS } from "../../../../services/schemas/common/constants.js";
import { validateKvVertices }
    from "../../../../services/solver/geometryKv.js";

const GEO_SHAPE = Object.freeze({
    property: "geo",
    storagePath: "geo",
    rows: 8,
    columns: 3,
});

const FIXED_ARRAY_SHAPES = Object.freeze([
    { property: "symVi", storagePath: "sym.vi", rows: 3, columns: 1 },
    { property: "symR0", storagePath: "sym.r0", rows: 3, columns: 1 },
    GEO_SHAPE,
    { property: "dr", storagePath: "dr", rows: 3, columns: 1 },
    { property: "dp", storagePath: "dp", rows: 3, columns: 1 },
    { property: "vkan", storagePath: "vkan", rows: 3, columns: 1 },
    { property: "med", storagePath: "med", rows: 6, columns: 1 },
]);

const VALID_TARG = new Set([0, 1, 2, 3]);
const VALID_MODEL = new Set([0, 1, 2]);

export function elementsValidator(
    service,
    diagnostics,
) {
    const elements = service.getModel()[TABS.ELEMENTS.id];
    if (!Array.isArray(elements)) return;

    validateArrayShapes(elements, diagnostics);
    validateGeometry(elements, diagnostics);
    validateRecordOrder(elements, diagnostics);
}

function validateArrayShapes(elements, diagnostics) {
    elements.forEach((record, index) => {
        for (const shape of FIXED_ARRAY_SHAPES) {
            if (hasCompleteShape(record?.[shape.property], shape)) {
                continue;
            }

            diagnostics.push(
                createError({
                    tab: TABS.ELEMENTS,
                    row: index + 1,
                    property: shape.property,
                    message:
                        "Массив '" + shape.storagePath + "' должен содержать "
                        + shape.rows + " × " + shape.columns
                        + " заполненных значений",
                })
            );
        }
    });
}

function validateGeometry(elements, diagnostics) {
    elements.forEach((record, index) => {
        if (
            record?.geoType !== 0
            || !hasCompleteShape(record?.geo, GEO_SHAPE)
            || validateKvVertices(record.geo)
        ) {
            return;
        }

        diagnostics.push(
            createError({
                tab: TABS.ELEMENTS,
                row: index + 1,
                property: "geo",
                message:
                    "Вершины должны задавать корректный объёмный шестигранник: "
                    + "рёбра 13, 57, 15, 37 и 26 не вырождены; "
                    + "13 ∥ 24, 15 ∥ 26 ∥ 37 ∥ 48 и 57 ∥ 68; "
                    + "нумерация вершин задаёт положительную ориентацию объёма",
            })
        );
    });
}

function validateRecordOrder(elements, diagnostics) {
    let maximumTarg = null;
    let nonModelTwoSeen = false;

    elements.forEach((record, index) => {
        const targ = record?.targ;

        if (!VALID_TARG.has(targ)) return;

        if (maximumTarg !== null && targ < maximumTarg) {
            diagnostics.push(
                createError({
                    tab: TABS.ELEMENTS,
                    row: index + 1,
                    property: "targ",
                    message:
                        "Записи elements должны располагаться по "
                        + "неубыванию targ (0, 1, 2, 3)",
                })
            );
        }

        maximumTarg = maximumTarg === null
            ? targ
            : Math.max(maximumTarg, targ);

        if (targ !== 0 || !VALID_MODEL.has(record?.model)) return;

        if (record.model === 2) {
            if (nonModelTwoSeen) {
                diagnostics.push(
                    createError({
                        tab: TABS.ELEMENTS,
                        row: index + 1,
                        property: "model",
                        message:
                            "В группе targ = 0 записи с model = 2 "
                            + "должны предшествовать остальным",
                    })
                );
            }
        }
        else {
            nonModelTwoSeen = true;
        }
    });
}

function hasCompleteShape(value, { rows, columns }) {
    return Array.isArray(value) &&
        value.length === rows &&
        Array.from(value).every(row =>
            Array.isArray(row) &&
            row.length === columns &&
            Array.from(row).every(cell =>
                cell !== null &&
                cell !== undefined
            )
        );
}
