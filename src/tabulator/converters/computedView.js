// Вычисляемые колонки ARRAY-представления.
// Они получают только копии объявленных частей BaseModel и не изменяют
// хранимое значение свойства.

export function evaluateComputedView(
    property,
    getModelSnapshot,
    rowLimit = Number.POSITIVE_INFINITY,
) {
    const descriptor = property?.computedView;
    if (!descriptor) return [];

    const snapshot = typeof getModelSnapshot === "function"
        ? getModelSnapshot()
        : {};
    const models = {};

    for (const dependency of descriptor.dependencies) {
        models[dependency] = structuredClone(
            snapshot?.[dependency] ?? null
        );
    }

    const limit =
        Number.isInteger(rowLimit) && rowLimit >= 0
            ? rowLimit
            : Number.POSITIVE_INFINITY;

    const rows = descriptor.rows({
        models,
        property,
        rowLimit: limit,
    });

    if (!Array.isArray(rows)) {
        throw new Error(
            "computedView.rows must return an array."
        );
    }

    if (rows.some(row =>
        !row ||
        typeof row !== "object" ||
        Array.isArray(row)
    )) {
        throw new Error(
            "computedView.rows must return objects."
        );
    }

    return Number.isFinite(limit)
        ? rows.slice(0, limit)
        : rows;
}

export function computedViewSignature(property, rows) {
    const descriptor = property?.computedView;
    if (!descriptor) return null;

    return JSON.stringify(
        rows.map(row =>
            descriptor.columns.map(column =>
                row?.[column.key] ?? null
            )
        )
    );
}
