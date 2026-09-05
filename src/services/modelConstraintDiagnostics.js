import {
    FIELD_TYPES,
    STORAGE_TYPES,
} from "./schemas/common/constants.js";
import { createError } from "../tabulator/validators/common/createDiagnostic.js";
import { validateConstraintValue } from "../tabulator/validators/types/constraintValidator.js";

function modelItems(schema, modelPart) {
    if (modelPart === null || modelPart === undefined) return [];

    if (schema.config.storage === STORAGE_TYPES.RECORDS) {
        return Array.isArray(modelPart) ? modelPart : [];
    }

    return [modelPart];
}

function nestedValues(value) {
    if (!Array.isArray(value)) return [];

    return value.flatMap(row =>
        Array.isArray(row) ? row : [row]
    );
}

// Вложенные таблицы участвуют в сводной проверке только тогда, когда
// их значения целочисленные. Сейчас ограничения таких значений объявлены
// только у таблиц "Разбиение" elements.dp и regions.dp.
export function countSchemaConstraintViolations(schema, modelPart) {
    let count = 0;

    for (const item of modelItems(schema, modelPart)) {
        if (!item || typeof item !== "object") continue;

        for (const [propertyName, property] of Object.entries(
            schema.properties,
        )) {
            const value = item[propertyName];

            if (property.type === FIELD_TYPES.ARRAY) {
                if (property.items?.type !== FIELD_TYPES.INTEGER) continue;

                for (const nestedValue of nestedValues(value)) {
                    if (!validateConstraintValue(nestedValue, property.items)) {
                        count += 1;
                    }
                }
                continue;
            }

            if (!validateConstraintValue(value, property)) {
                count += 1;
            }
        }
    }

    return count;
}

export function schemaConstraintDiagnostics(schema, modelPart) {
    const count = countSchemaConstraintViolations(schema, modelPart);
    if (count === 0) return [];

    return [{
        ...createError({
            message:
                `Вкладка: ${schema.title} - нарушений ограничений: ${count}`,
        }),
        presentation: "constraint-summary",
    }];
}

export function collectModelConstraintDiagnostics(registry, model) {
    return Object.fromEntries(
        registry.map(schema => [
            schema.id,
            schemaConstraintDiagnostics(schema, model?.[schema.id]),
        ]),
    );
}
