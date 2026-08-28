import { HTC_PARAMETER_NAMES } from "./materialConstants.js";

const PRESENTATION_KEYS = new Set([
    "name",
    "comment",
]);

function isObject(value) {
    return value !== null &&
        typeof value === "object" &&
        !Array.isArray(value);
}

function recordPayload(record) {
    return isObject(record?.data)
        ? record.data
        : record;
}

function recordName(record, payload) {
    const value = record?.name ?? payload?.name;
    return typeof value === "string" ? value : "";
}

function cloneRecordPayload(record) {
    const payload = recordPayload(record);
    if (!isObject(payload)) {
        throw new TypeError("Характеристика должна быть JSON-объектом.");
    }
    return structuredClone(payload);
}

function transientLibrarySource(record) {
    const isDefaultRecord =
        isObject(record?.data) &&
        typeof record?.relativePath === "string" &&
        typeof record?.sha256 === "string";
    return isDefaultRecord
        ? { _libraryRecord: structuredClone(record) }
        : {};
}

export function decodeFmmTable(value) {
    if (!Array.isArray(value)) {
        throw new TypeError("Поле tabl характеристики ФММ должно быть массивом.");
    }

    if (value.every(Array.isArray)) {
        if (
            value.length !== 12 ||
            value.some(row => row.length !== 2)
        ) {
            throw new Error(
                "Таблица ФММ должна содержать 12 строк и две колонки H и M.",
            );
        }
        const rows = structuredClone(value);
        assertFiniteFmmValues(rows.flat());
        return rows;
    }

    if (value.length !== 24) {
        throw new Error(
            `Таблица ФММ должна содержать 24 значения; получено ${value.length}.`,
        );
    }

    assertFiniteFmmValues(value);
    const rowCount = value.length / 2;
    return Array.from(
        { length: rowCount },
        (_, row) => [value[row], value[row + rowCount]],
    );
}

function assertFiniteFmmValues(values) {
    if (values.some(item => !Number.isFinite(item))) {
        throw new Error(
            "Таблица ФММ должна содержать только конечные числовые значения.",
        );
    }
}

export function toFmmLibraryModel(records) {
    if (!Array.isArray(records)) {
        throw new TypeError("Библиотека ФММ должна быть массивом RECORDS.");
    }

    return records.map(record => {
        const payload = cloneRecordPayload(record);
        return {
            ...transientLibrarySource(record),
            name: recordName(record, payload),
            tabl: decodeFmmTable(payload.tabl),
            hip: payload.hip,
            comment: payload.comment ?? "",
        };
    });
}

export function toHtcLibraryModel(records) {
    if (!Array.isArray(records)) {
        throw new TypeError("Библиотека ВТСП должна быть массивом RECORDS.");
    }

    return records.map(record => {
        const payload = cloneRecordPayload(record);
        delete payload.name;
        return {
            ...transientLibrarySource(record),
            name: recordName(record, payload),
            ...payload,
            comment: payload.comment ?? "",
        };
    });
}

export function htcParameterEntries(record) {
    if (!isObject(record)) return [];

    const sourceKeys = Object.keys(record).filter(
        key =>
            !PRESENTATION_KEYS.has(key) &&
            !key.startsWith("_"),
    );
    const sourceKeySet = new Set(sourceKeys);
    const known = HTC_PARAMETER_NAMES.filter(key => sourceKeySet.has(key));
    const knownSet = new Set(known);
    const additional = sourceKeys.filter(key => !knownSet.has(key));

    return [...known, ...additional].map(key => [
        key,
        formatMaterialValue(record[key]),
    ]);
}

export function formatMaterialValue(value) {
    if (value === null) return "null";
    if (typeof value === "string") return value;
    if (
        typeof value === "number" ||
        typeof value === "boolean"
    ) {
        return JSON.stringify(value);
    }
    return JSON.stringify(value) ?? String(value);
}
