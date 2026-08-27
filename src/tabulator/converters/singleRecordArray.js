// Проекция единственного ARRAY-свойства RECORDS-схемы в основную таблицу.
// StorageModel и BaseModel не меняются: внешний envelope остаётся массивом
// из одной записи.

const EMPTY_VALUE = Object.freeze([]);

export function readSingleRecordArray(
    records,
    propertyName,
) {
    if (records === null || records === undefined) {
        return {
            valid: true,
            materialized: false,
            record: null,
            value: EMPTY_VALUE,
        };
    }

    if (!Array.isArray(records)) {
        return {
            valid: false,
            materialized: false,
            record: null,
            value: EMPTY_VALUE,
        };
    }

    if (records.length === 0) {
        return {
            valid: true,
            materialized: false,
            record: null,
            value: EMPTY_VALUE,
        };
    }

    const record = records[0];

    if (
        records.length !== 1 ||
        !record ||
        typeof record !== "object" ||
        Array.isArray(record)
    ) {
        return {
            valid: false,
            materialized: false,
            record: null,
            value: EMPTY_VALUE,
        };
    }

    const value = record[propertyName];

    if (!Array.isArray(value)) {
        return {
            valid: false,
            materialized: true,
            record,
            value: EMPTY_VALUE,
        };
    }

    return {
        valid: true,
        materialized: true,
        record,
        value,
    };
}

export function writeSingleRecordArray({
    records,
    propertyName,
    value,
    createDefaultRecord,
}) {
    const projection = readSingleRecordArray(
        records,
        propertyName,
    );

    if (!projection.valid) {
        return null;
    }

    const record = projection.materialized
        ? structuredClone(projection.record)
        : createDefaultRecord();

    record[propertyName] = structuredClone(value);

    return [record];
}
