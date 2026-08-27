import {
    fromStorage,
    toStorage,
} from "../../services/model/arrayShape";
import {
    KV_GEO_FIELDS,
    KV_GEO_LENGTH,
    resetKvGeo,
} from "../../services/solver/geometryKv";
import {
    TK_GEO_FIELDS,
    TK_GEO_LENGTH,
    resetTkGeo,
} from "../../services/solver/geometryTk";

function variantFields(fields, geoType) {
    if (
        typeof geoType !== "number" ||
        !Number.isInteger(geoType)
    ) {
        return null;
    }

    return fields[geoType] ?? null;
}

function createGeoVariantCodec({
    fields,
    length,
    vertexCount,
    reset,
}) {
    return Object.freeze({
        dependencies: ["geoType"],

        decode({ value, record, property }) {
            const geoType = record?.geoType;
            const labels = variantFields(fields, geoType);

            // Неизвестный тип не должен приводить к потере или
            // переинтерпретации данных: показывается исходная матрица.
            if (!labels) {
                return {
                    key: `fallback:${typeof geoType}:${String(geoType)}`,
                    rows: Array.isArray(value) ? value : [],
                };
            }

            if (geoType === 0) {
                return {
                    key: geoType,
                    rows: Array.isArray(value) ? value : [],
                    columns: ["X", "Y", "Z"],
                    itemLabels: Array.from(
                        { length: vertexCount },
                        (_, index) => `V${index + 1}`,
                    ),
                    itemLabelTitle: "Вершина",
                };
            }

            const flat = toStorage(value, property);

            return {
                key: geoType,
                rows: labels.map(
                    (_, index) => [flat?.[index] ?? null],
                ),
                columns: ["Значение"],
                itemLabels: labels,
                itemLabelTitle: "Параметр",
            };
        },

        encode({ rows, record, property }) {
            const geoType = record?.geoType;
            const labels = variantFields(fields, geoType);

            // Сохраняющий fallback: неизвестный тип не меняет форму значения.
            if (!labels || geoType === 0) {
                return structuredClone(rows);
            }

            const flat = new Array(length).fill(0);

            for (let index = 0; index < labels.length; index++) {
                flat[index] = rows[index]?.[0] ?? null;
            }

            return fromStorage(flat, property);
        },

        onDependencyChange({
            value,
            property,
            oldValue,
            newValue,
        }) {
            if (
                Object.is(oldValue, newValue) ||
                !variantFields(fields, newValue)
            ) {
                return value;
            }

            return fromStorage(
                reset(newValue),
                property,
            );
        },
    });
}

export const kvGeoVariantCodec = createGeoVariantCodec({
    fields: KV_GEO_FIELDS,
    length: KV_GEO_LENGTH,
    vertexCount: 8,
    reset: resetKvGeo,
});

export const tkGeoVariantCodec = createGeoVariantCodec({
    fields: TK_GEO_FIELDS,
    length: TK_GEO_LENGTH,
    vertexCount: 4,
    reset: resetTkGeo,
});
