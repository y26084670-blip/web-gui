//==============================================================================
// Операции над диагностическими сообщениями
//==============================================================================

import {
    VALIDATION_LEVELS,
} from "../../../services/schemas/common/constants";

//==============================================================================
// Определение общего результата диагностики
//==============================================================================

export function getValidationLevel(diagnostics) {
    if (
        diagnostics.some(
            diagnostic =>
                diagnostic.level === VALIDATION_LEVELS.ERROR
        )
    ) {
        return VALIDATION_LEVELS.ERROR;
    }
    if (
        diagnostics.some(
            diagnostic =>
                diagnostic.level === VALIDATION_LEVELS.WARNING
        )
    ) {
        return VALIDATION_LEVELS.WARNING;
    }
    return VALIDATION_LEVELS.SUCCESS;
}