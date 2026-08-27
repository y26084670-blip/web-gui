import { createError } from "../../common/createDiagnostic";
import { TABS } from "../../../../services/schemas/common/constants";

export function movesValidator(
    service,
    diagnostics,
) {
    const moves = service.getModel()[TABS.MOVES.id];
    if (!Array.isArray(moves)) return;

    moves.forEach((record, index) => {
        const angle = record?.angle;
        const position = record?.position;

        if (
            !Array.isArray(angle) ||
            !Array.isArray(position) ||
            angle.length === position.length
        ) {
            return;
        }

        diagnostics.push(
            createError({
                tab: TABS.MOVES,
                row: index + 1,
                property: "position",
                message:
                    "Таблицы 'angle' и 'position' должны содержать "
                    + "одинаковое число строк (сейчас "
                    + angle.length + " и " + position.length + ")",
            })
        );
    });
}
