import { createError } from "../../common/createDiagnostic";
import { TABS } from "../../../../services/schemas/common/constants";

const FIXED_ARRAY_SHAPES = Object.freeze([
    { property: "symVi", storagePath: "sym.vi", rows: 3, columns: 1 },
    { property: "symR0", storagePath: "sym.r0", rows: 3, columns: 1 },
    { property: "geo", storagePath: "geo", rows: 4, columns: 3 },
    { property: "dr", storagePath: "dr", rows: 3, columns: 1 },
    { property: "dp", storagePath: "dp", rows: 2, columns: 1 },
]);

export function regionsValidator(
    service,
    diagnostics,
) {
    const regions = service.getModel()[TABS.REGIONS.id];
    if (!Array.isArray(regions)) return;

    regions.forEach((record, index) => {
        for (const shape of FIXED_ARRAY_SHAPES) {
            if (hasCompleteShape(record?.[shape.property], shape)) {
                continue;
            }

            diagnostics.push(
                createError({
                    tab: TABS.REGIONS,
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

function hasCompleteShape(value, { rows, columns }) {
    return Array.isArray(value) &&
        value.length === rows &&
        value.every(row =>
            Array.isArray(row) &&
            row.length === columns &&
            row.every(cell =>
                cell !== null &&
                cell !== undefined
            )
        );
}
