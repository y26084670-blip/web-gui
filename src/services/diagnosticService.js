import { createSignal } from "solid-js";
import { VALIDATION_LEVELS } from "./schemas/common/constants.js";
import { createSuccess } from "../tabulator/validators/common/createDiagnostic.js";
import { getValidationLevel } from "../tabulator/validators/common/diagnosticLevel.js";

// Диагностика прикладной проверки модели (ручной запуск).
const [modelDiagnostics, setModelDiagnostics] = createSignal([]);

// Диагностика загрузки по идентификатору вкладки.
const [loadDiagnostics, setLoadDiagnostics] = createSignal({});

// Сводные ошибки ограничений по идентификатору вкладки.
const [constraintDiagnostics, setConstraintDiagnostics] = createSignal({});

const diagnostics = () => {
    const combined = [
        ...Object.values(loadDiagnostics()).flat(),
        ...modelDiagnostics(),
        ...Object.values(constraintDiagnostics()).flat(),
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

// Агент различает загрузочную диагностику и подтверждённую ручную проверку.
const modelValidationChecked = () => modelDiagnostics().length > 0;

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

function setConstraintResult(schemaId, messages) {
    setConstraintDiagnostics(current => ({
        ...current,
        [schemaId]: messages ?? [],
    }));
}

function setConstraintResults(results) {
    setConstraintDiagnostics(results ?? {});
}

function clearLoadResult() {
    setLoadDiagnostics({});
    setConstraintDiagnostics({});
}

export const diagnosticService = {
    validationLevel,
    modelValidationChecked,
    diagnostics,

    clearDiagnostics,
    setValidationResult,
    invalidateDiagnostics,

    setLoadResult,
    clearLoadResult,

    setConstraintResult,
    setConstraintResults,
};
