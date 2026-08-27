import { createSignal } from "solid-js";
import { VALIDATION_LEVELS } from "./schemas/common/constants";
import { createSuccess } from "../tabulator/validators/common/createDiagnostic.js";
import { getValidationLevel } from "../tabulator/validators/common/diagnosticLevel.js";

// Диагностика прикладной проверки модели (ручной запуск).
const [modelDiagnostics, setModelDiagnostics] = createSignal([]);

// Диагностика загрузки по идентификатору вкладки.
const [loadDiagnostics, setLoadDiagnostics] = createSignal({});

const diagnostics = () => {
    const combined = [
        ...Object.values(loadDiagnostics()).flat(),
        ...modelDiagnostics(),
    ];
    const hasProblems = combined.some(
        diagnostic =>
            diagnostic.level === VALIDATION_LEVELS.WARNING ||
            diagnostic.level === VALIDATION_LEVELS.ERROR
    );

    return hasProblems
        ? combined.filter(
            diagnostic =>
                diagnostic.level !== VALIDATION_LEVELS.SUCCESS
        )
        : combined;
};

// Пустое объединение означает, что проверка не выполнялась:
// выполненная проверка всегда оставляет хотя бы одну запись.
const validationLevel = () => {
    const list = diagnostics();
    return list.length
        ? getValidationLevel(list)
        : VALIDATION_LEVELS.UNKNOWN;
};

function clearDiagnostics() {
    setModelDiagnostics([]);
}

// Результат без замечаний фиксируется записью уровня SUCCESS.
function setValidationResult(messages) {
    setModelDiagnostics(
        messages?.length ? messages : [createSuccess()]
    );
}

function invalidateDiagnostics() {
    setModelDiagnostics([]);
}

// Диагностика загрузки вкладки замещается при каждой загрузке.
function setLoadResult(schemaId, messages) {
    setLoadDiagnostics(current => ({
        ...current,
        [schemaId]: messages ?? [],
    }));
}

function clearLoadResult() {
    setLoadDiagnostics({});
}

export const diagnosticService = {
    validationLevel,
    diagnostics,

    clearDiagnostics,
    setValidationResult,
    invalidateDiagnostics,

    setLoadResult,
    clearLoadResult,
};