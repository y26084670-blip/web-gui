export const FIELD_TYPES = Object.freeze({
    STRING: "string",
    INTEGER: "integer",
    FLOAT: "float",
    BOOLEAN: "boolean",
    ARRAY: "array",
    OBJECT: "object",
    DATE: "date",
    PATH: "path",
    ENUM: "enum"
});

export const VIEW_TYPES = Object.freeze({
    VALUE: "value",
    COLUMNS: "columns",
    FORM: "form",
    TABLE: "table",
    MATRIX: "matrix",
    REFERENCE: "reference",
    CUSTOM: "custom",
});

export const STORAGE_TYPES = {
    CLUSTER: "cluster",
    RECORDS: "records",
};

export const TABS = {
    TASKS: {
        id: "tasks",
        label: "Задачи и результаты",
    },

    GENERAL: {
        id: "general",
        label: "Общие параметры",
    },

    CONRAB: {
        id: "conrab",
        label: "Конфигурация модели",
    },

    ELEMENTS: {
        id: "elements",
        label: "Элементы модели",
    },

    REGIONS: {
        id: "regions",
        label: "Области наблюдения",
    },

    AMPS: {
        id: "amps",
        label: "Амплитуды",
    },

    MOVES: {
        id: "moves",
        label: "Траектории",
    },

    MHJ: {
        id: "mhj",
        label: "Заданные источники",
    },
};

export const VALIDATION_LEVELS = {
    UNKNOWN: "unknown",
    SUCCESS: "success",
    WARNING: "warning",
    ERROR: "error",
};

// высота вложенной таблицы
export const NESTED_TABLE_MAX_HEIGHT = 240;

// минимальная ширина одной колонки значений вложенной таблицы
export const NESTED_TABLE_COLUMN_MIN_WIDTH = 120;

export const DEFAULT_SUMMARY_MAX_LENGTH = 80;

// Имена каталогов задания.
// Источник: julia, src/base/defines.jl — INPUTNAME, OUTPUTNAME. Снимок 2026-08.
export const DIRECTORIES = Object.freeze({
    INPUT: "input3XX",
    OUTPUT: "output3XX",
});

// Имена файлов исходных данных.
// Источник: julia, src/base/defines.jl — InputGeneral, InputConrab,
// InputAmplitudes, InputMoves, InputKvs, InputTks, InputMhj. Снимок 2026-08.
export const FILES = Object.freeze({
    GENERAL: "general.txt",
    CONRAB: "conrab.txt",
    KVS: "kvs.txt",
    TKS: "tks.txt",
    AMPLITUDES: "amplitudes.txt",
    MOVES: "moves.txt",
    MHJ: "mhj.txt",
});
