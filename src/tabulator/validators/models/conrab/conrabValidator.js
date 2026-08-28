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
    }
}
