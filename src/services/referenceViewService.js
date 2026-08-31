import { STORAGE_TYPES } from "./schemas/common/constants.js";

export function referenceViewEntries(schema) {
    return Object.entries(schema?.views?.references ?? {});
}

export function referenceViewProperty(schema, propertyName) {
    return schema?.views?.references?.[propertyName] ?? null;
}

export function referenceViewDependencies(schema) {
    return [
        ...new Set(
            referenceViewEntries(schema).flatMap(
                ([, descriptor]) => descriptor.dependencies,
            ),
        ),
    ];
}

function dependencyModels(descriptor, snapshot) {
    return Object.fromEntries(
        descriptor.dependencies.map(dependency => [
            dependency,
            structuredClone(snapshot?.[dependency] ?? null),
        ]),
    );
}

function evaluateReference(descriptor, snapshot, record, recordIndex) {
    const rows = descriptor.rows({
        models: dependencyModels(descriptor, snapshot),
        record: structuredClone(record ?? null),
        recordIndex,
    });

    if (
        !Array.isArray(rows)
        || rows.some(row =>
            !Array.isArray(row)
            || row.length !== descriptor.nColumns
        )
    ) {
        throw new Error(
            `View-only поле '${descriptor.label}' должно возвращать таблицу `
            + `${descriptor.nColumns} колонок.`,
        );
    }
    return structuredClone(rows);
}

export function referenceViewValues(schema, baseModel, modelSnapshot) {
    const entries = referenceViewEntries(schema);
    if (entries.length === 0 || baseModel === null || baseModel === undefined) {
        return schema?.config?.storage === STORAGE_TYPES.RECORDS ? [] : {};
    }

    if (schema.config.storage === STORAGE_TYPES.RECORDS) {
        if (!Array.isArray(baseModel)) {
            throw new Error(`Schema '${schema.id}': RECORDS BaseModel must be an array.`);
        }
        return baseModel.map((record, recordIndex) => Object.fromEntries(
            entries.map(([propertyName, descriptor]) => [
                propertyName,
                evaluateReference(
                    descriptor,
                    modelSnapshot,
                    record,
                    recordIndex,
                ),
            ]),
        ));
    }

    if (schema.config.storage === STORAGE_TYPES.CLUSTER) {
        return Object.fromEntries(
            entries.map(([propertyName, descriptor]) => [
                propertyName,
                evaluateReference(descriptor, modelSnapshot, baseModel, null),
            ]),
        );
    }

    throw new Error(`Schema '${schema.id}': unsupported storage type.`);
}

export function materializeReferenceViewRows({
    schema,
    rows,
    baseModel,
    modelSnapshot,
}) {
    const entries = referenceViewEntries(schema);
    if (entries.length === 0 || baseModel === null || baseModel === undefined) {
        return rows;
    }

    const values = referenceViewValues(schema, baseModel, modelSnapshot);
    if (schema.config.storage === STORAGE_TYPES.RECORDS) {
        return rows.map((row, index) => ({
            ...row,
            ...values[index],
        }));
    }

    const referenceRows = entries.map(([propertyName, descriptor]) => ({
        rowLabel: descriptor.label,
        property: propertyName,
        value: values[propertyName],
    }));

    return [
        ...referenceRows,
        ...rows,
    ];
}
