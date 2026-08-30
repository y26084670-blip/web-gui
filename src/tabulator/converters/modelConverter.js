//==============================================================================
// Преобразование между моделью и строками Tabulator
//==============================================================================

import { STORAGE_TYPES, FIELD_TYPES } from "../../services/schemas/common/constants";
import {
    propertyItemRowLabel,
    propertyRowLabel,
    recordRowLabel,
} from "./rowLabel";
import {
    hasRecordColumnsView,
    propertyRowsToRecords,
    recordsToPropertyRows,
} from "./recordColumns";

// Модель -> строки Tabulator
export const modelToRows = (schema, data) => {

    switch (schema.config.storage) {
        case STORAGE_TYPES.CLUSTER: {
            const rows = [];
            for (const [property, value] of Object.entries(data)) {
                const descriptor = schema.properties[property];
                // ARRAY без nColumns отображается как несколько обычных строк.
                if (
                    descriptor?.type === FIELD_TYPES.ARRAY &&
                    !descriptor.nColumns &&
                    Array.isArray(value)
                ) {
                    value.forEach((item, index) => {
                        rows.push({
                            rowLabel: propertyItemRowLabel(descriptor, index),
                            property,
                            arrayIndex: index,
                            value: item,
                        });
                    });
                    continue;
                }
                rows.push({
                    rowLabel: propertyRowLabel(descriptor, property),
                    property,
                    value,
                });
            }
            return rows;
        }

        case STORAGE_TYPES.RECORDS:
            if (hasRecordColumnsView(schema)) {
                return recordsToPropertyRows(schema, data);
            }
            return data.map((record, index) => ({
                rowLabel: recordRowLabel(index),
                ...record,
            }));

        default:
            throw new Error(
                `Unknown storage type: ${schema.config.storage}`
            );
    }

};

// Строки Tabulator -> Базовая модель
export function rowsToModel(schema, rows) {

    switch (schema.config.storage) {
        case STORAGE_TYPES.CLUSTER: {
            const baseModel = {};
            for (const row of rows) {
                if (!schema.properties[row.property]) continue;
                // Несколько строк одного ARRAY-свойства собираются
                // обратно по arrayIndex, а не перезаписывают друг друга.
                if (row.arrayIndex === undefined) {
                    baseModel[row.property] = row.value;
                    continue;
                }
                if (!Array.isArray(baseModel[row.property])) {
                    baseModel[row.property] = [];
                }
                baseModel[row.property][row.arrayIndex] = row.value;
            }
            return baseModel;
        }

        case STORAGE_TYPES.RECORDS: {
            if (hasRecordColumnsView(schema)) {
                return propertyRowsToRecords(schema, rows);
            }
            return rows.map(row => Object.fromEntries(
                Object.keys(schema.properties)
                    .filter(propertyName =>
                        Object.prototype.hasOwnProperty.call(row, propertyName)
                    )
                    .map(propertyName => [propertyName, row[propertyName]]),
            ));
        }

        default:
            throw new Error(
                `Unknown storage type: ${schema.config.storage}`
            );
    }
}
