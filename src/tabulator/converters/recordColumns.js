//==============================================================================
// Транспонированное представление фиксированного набора RECORDS.
//
// StorageModel и BaseModel сохраняют обычную форму RECORDS: один объект на
// строку JSON Lines. ViewModel размещает свойства по строкам, а фиксированные
// записи — по колонкам. Служебные поля представления не сериализуются.
//==============================================================================

import { propertyRowLabel } from "./rowLabel.js";

const RECORD_FIELD_PREFIX = "_record_";

export function hasRecordColumnsView(schema) {
    return Boolean(schema?.views?.recordsAsColumns);
}

export function recordColumnField(recordIndex) {
    if (!Number.isInteger(recordIndex) || recordIndex < 0) {
        throw new Error(
            "Индекс колонки RECORDS должен быть неотрицательным целым числом.",
        );
    }

    return `${RECORD_FIELD_PREFIX}${recordIndex}`;
}

export function recordIndexFromColumn(field) {
    if (typeof field !== "string" || !field.startsWith(RECORD_FIELD_PREFIX)) {
        return null;
    }

    const suffix = field.slice(RECORD_FIELD_PREFIX.length);
    if (!/^(0|[1-9]\d*)$/.test(suffix)) return null;

    return Number(suffix);
}

export function assertFixedRecordCount(records, recordCount) {
    if (recordCount === undefined) return records;

    if (!Array.isArray(records) || records.length !== recordCount) {
        const actual = Array.isArray(records) ? records.length : 0;
        throw new Error(
            `ожидалось записей: ${recordCount}; получено: ${actual}`,
        );
    }

    records.forEach((record, index) => {
        if (
            record === null ||
            typeof record !== "object" ||
            Array.isArray(record)
        ) {
            throw new Error(
                `запись ${index + 1} должна быть JSON-объектом`,
            );
        }
    });

    return records;
}

export function parseFixedRecordLines(text) {
    const lines = text.split(/\r?\n/);
    // Обычный завершающий перевод строки не создаёт JSONL-запись.
    // Любая дополнительная пустая строка остаётся видимой и ошибочна.
    if (lines.at(-1) === "") lines.pop();

    return lines.map((line, index) => {
        const content = line.trim();
        if (!content) {
            throw new Error(
                `запись ${index + 1} должна содержать JSON-объект`,
            );
        }
        return JSON.parse(content);
    });
}

export function recordsToPropertyRows(schema, records) {
    assertFixedRecordCount(records, schema.config.recordCount);

    return Object.entries(schema.properties).map(
        ([propertyName, property]) => {
            const row = {
                _property: propertyName,
                rowLabel: propertyRowLabel(property, propertyName),
            };

            records.forEach((record, recordIndex) => {
                row[recordColumnField(recordIndex)] =
                    structuredClone(record[propertyName]);
            });

            return row;
        },
    );
}

export function propertyRowsToRecords(schema, rows) {
    const recordCount = schema.config.recordCount;
    const records = Array.from(
        { length: recordCount },
        () => ({}),
    );

    for (const row of rows) {
        const propertyName = row?._property;
        if (!schema.properties[propertyName]) continue;

        for (let recordIndex = 0; recordIndex < recordCount; recordIndex++) {
            records[recordIndex][propertyName] = structuredClone(
                row[recordColumnField(recordIndex)],
            );
        }
    }

    return records;
}
