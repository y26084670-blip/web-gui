import { createWarning, createError }
    from "../../common/createDiagnostic";
import { TABS } from "../../../../services/schemas/common/constants";

export function generalValidator(
    service,
    diagnostics,
) {
    const general = service.getModel().general;
    if (!general) return;

    if (
        general.countTimeSteps > 0 &&
        general.timeStep <= 0.0
    ) {
        diagnostics.push(
            createError({
                tab: TABS.GENERAL,
                property: "timeStep",
                row: undefined,
                message:
                    "Для динамической задачи шаг по времени должен быть отличный от нуля и положительный",
            })
        );
    }

    if (
        general.countTimeSteps == 0 &&
        general.timeStep > 0.0
    ) {
        diagnostics.push(
            createWarning({
                tab: TABS.GENERAL,
                property: "timeStep",
                row: undefined,
                message:
                    "Для статической задачи задавать ненулевой шаг по времени не требуется",
            })
        );
    }
}