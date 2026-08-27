import { columnCount } from "../../services/model/arrayShape";

function defaultColumns(property) {
    const count = columnCount(property);
    return Array.from(
        { length: count },
        (_, index) => property.columns?.[index] ?? `C${index + 1}`,
    );
}

// BaseModel ARRAY -> конфигурация и строки связанного представления.
export function decodeArrayView(property, value, record) {
    const codec = property.variantCodec;
    const dependencyKey = codec
        ? codec.dependencies.map(
            dependency => [
                dependency,
                record?.[dependency],
            ],
        )
        : null;
    const fallback = {
        key: dependencyKey,
        rows: Array.isArray(value) ? value : [],
        columns: defaultColumns(property),
        itemLabels: property.itemLabels ?? [],
        itemLabelTitle: property.itemLabelTitle,
    };

    if (!codec) return fallback;

    const decoded = codec.decode({
        value,
        record,
        property,
    });

    if (!decoded || typeof decoded !== "object") {
        return fallback;
    }

    return {
        ...fallback,
        ...decoded,
        key: decoded.key ?? fallback.key,
        rows: Array.isArray(decoded.rows)
            ? decoded.rows
            : fallback.rows,
        columns:
            Array.isArray(decoded.columns) && decoded.columns.length > 0
                ? decoded.columns
                : fallback.columns,
        itemLabels: Array.isArray(decoded.itemLabels)
            ? decoded.itemLabels
            : fallback.itemLabels,
    };
}

// Строки связанного представления -> BaseModel ARRAY.
export function encodeArrayView(
    property,
    rows,
    record,
    presentation,
) {
    const codec = property.variantCodec;

    if (!codec) return rows;

    return codec.encode({
        rows,
        record,
        property,
        presentation,
    });
}

export function arrayViewSignature(presentation) {
    return JSON.stringify({
        key: presentation.key,
        columns: presentation.columns,
        itemLabels: presentation.itemLabels,
        itemLabelTitle: presentation.itemLabelTitle,
    });
}
