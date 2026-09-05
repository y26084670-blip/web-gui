import { FIELD_TYPES } from "../../services/schemas/common/constants.js";

/*
Все подсистемы получают описание свойства исключительно через resolveProperty().
Прямой доступ к schema.properties допускается только внутри сервисов,
непосредственно работающих со схемой (например, schemaFactory или resolveProperty).
Исключение: Не использовать resolveProperty() там, где вообще нет cell.

Порядок определения имени свойства:
    row._property — зарезервировано за представлениями, строки которых
                    описывают именованные элементы (см. «Направления развития»
                    в Architecture.md). Действующими построителями не
                    производится и сохраняется намеренно;
    row.property  — строки CLUSTER-таблицы;
    cell.getField() — строки RECORDS-таблицы.
*/
export function resolveProperty(cell, schema) {

    if (!schema) return null;

    const row = cell.getRow().getData();
    const field = cell.getField();

    const propertyName =
        row._property ??
        row.property;

    if (propertyName) {
        return schema.properties?.[propertyName]
            ?? schema.views?.references?.[propertyName]
            ?? null;
    }

    return schema.properties?.[field]
        ?? schema.views?.references?.[field]
        ?? null;
}

export function resolveValueProperty(property) {

    if (!property) return null;

    if (property.type === FIELD_TYPES.ARRAY) {
        return property.items ?? null;
    }

    return property;
}
