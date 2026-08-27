import { createError } from "../../common/createDiagnostic";
import {
    TABS,
} from "../../../../services/schemas/common/constants";
import {
    mhjRowCount,
} from "../../../../services/solver/mhjLayout";

export function mhjValidator(
    service,
    diagnostics,
) {
    const model = service.getModel();
    const elements = model[TABS.ELEMENTS.id];
    const mhj = model[TABS.MHJ.id];
    const elementsAvailable = Array.isArray(elements);
    const requiredRows = elementsAvailable
        ? mhjRowCount(elements)
        : 0;

    if (mhj === null || mhj === undefined) {
        if (requiredRows > 0) {
            diagnostics.push(
                createError({
                    tab: TABS.MHJ,
                    property: "v",
                    message:
                        "При требуемом числе строк " + requiredRows
                        + " файл mhj.txt должен содержать одну запись",
                })
            );
        }
        return;
    }

    if (!Array.isArray(mhj) || mhj.length !== 1) {
        diagnostics.push(
            createError({
                tab: TABS.MHJ,
                property: "v",
                message:
                    "Файл mhj.txt должен содержать ровно одну запись с ключом v",
            })
        );
        return;
    }

    if (!Array.isArray(mhj[0]?.v)) {
        diagnostics.push(
            createError({
                tab: TABS.MHJ,
                row: 1,
                property: "v",
                message:
                    "Свойство v в файле mhj.txt должно быть массивом",
            })
        );
        return;
    }

    if (!elementsAvailable) return;

    const actualRows = mhj[0].v.length;

    if (actualRows !== requiredRows) {
        diagnostics.push(
            createError({
                tab: TABS.MHJ,
                row: 1,
                property: "v",
                message:
                    `Число строк таблицы заданных источников (${actualRows}) `
                    + "не соответствует числу строк, определяемому параметрами "
                    + `дискретизации и симметрии элементов (${requiredRows})`,
            })
        );
    }
}
