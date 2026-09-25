import { TABS } from "../../../../services/schemas/common/constants.js";
import { createError } from "../../common/createDiagnostic.js";

export function conrabValidator(
    service,
    diagnostics,
) {
    const conrab = service.getModel().conrab;
    if (conrab === null || conrab === undefined) return;

    if (
        !Array.isArray(conrab) ||
        conrab.length !== 2 ||
        conrab.some(record =>
            record === null ||
            typeof record !== "object" ||
            Array.isArray(record)
        )
    ) {
        diagnostics.push(createError({
            tab: TABS.CONRAB,
            message:
                "Файл conrab.txt должен содержать ровно две записи: "
                + "Float32 и Float64.",
        }));
        return;
    }
    for (const [row, record] of conrab.entries()) {
        for (const property of ["CF_FMMEPS", "CF_HTSEPS"]) {
            const value = record[property];
            if (!Number.isFinite(value) || value <= 0) {
                diagnostics.push(createError({
                    tab: TABS.CONRAB,
                    row: row + 1,
                    property,
                    message: `${property} (${row === 0 ? "Float32" : "Float64"}): `
                        + "требуется конечный положительный допуск в кА/м.",
                }));
            }
        }
    }
}
