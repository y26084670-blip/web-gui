import { VALIDATION_LEVELS } from "../../../services/schemas/common/constants.js";

export function createDiagnostic({
    level,
    tab = undefined,
    row = undefined,
    property = undefined,
    message,
}) {
    return {
        level,
        tab,
        row,
        property,
        message,
    };
}

export function createError({
    message,
    tab,
    row,
    property,
}) {
    return createDiagnostic({
        level: VALIDATION_LEVELS.ERROR,
        message,
        tab,
        row,
        property,
    });
}

export function createWarning({
    message,
    tab,
    row,
    property,
}) {
    return createDiagnostic({
        level: VALIDATION_LEVELS.WARNING,
        message,
        tab,
        row,
        property,
    });
}

export function createSuccess(
    message = "Ошибок не обнаружено."
) {
    return createDiagnostic({
        level: VALIDATION_LEVELS.SUCCESS,
        message,
    });
}

export function createUnknown() {
    return createDiagnostic({
        level: VALIDATION_LEVELS.UNKNOWN,
        message: "",
    });
}
