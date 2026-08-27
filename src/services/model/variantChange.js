import { STORAGE_TYPES } from "../schemas/common/constants.js";

// Применяет реакцию вариантного свойства к BaseModel после точечной правки
// свойства-зависимости. Обработчики дескрипторов являются чистыми функциями:
// им не передаются Tabulator, modelService или файловые сущности.
export function applyVariantChange(schema, baseModel, change) {
    if (!change || Object.is(change.oldValue, change.newValue)) {
        return {
            model: baseModel,
            changed: false,
            refresh: false,
        };
    }

    const affected = Object.entries(schema.properties)
        .filter(([, property]) =>
            property.variantCodec?.dependencies?.includes(
                change.propertyName,
            )
        );

    if (affected.length === 0) {
        return {
            model: baseModel,
            changed: false,
            refresh: false,
        };
    }

    const model = structuredClone(baseModel);
    const record = schema.config.storage === STORAGE_TYPES.RECORDS
        ? model?.[change.recordIndex]
        : model;

    if (!record || typeof record !== "object") {
        return {
            model: baseModel,
            changed: false,
            refresh: false,
        };
    }

    let changed = false;

    for (const [propertyName, property] of affected) {
        const reaction = property.variantCodec.onDependencyChange;
        if (typeof reaction !== "function") continue;

        const previous = record[propertyName];
        const next = reaction({
            value: previous,
            record,
            property,
            dependency: change.propertyName,
            oldValue: change.oldValue,
            newValue: change.newValue,
        });

        if (Object.is(previous, next)) continue;

        record[propertyName] = next;
        changed = true;
    }

    return {
        model: changed ? model : baseModel,
        changed,
        refresh: true,
    };
}
