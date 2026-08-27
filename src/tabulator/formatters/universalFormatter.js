import { resolveProperty } from "../schema/propertyResolver";
import { formatterRegistry } from "./formatterRegistry";

// Единый канал получения описания поля:
//   1) formatterParams.property — если описание передано колонкой;
//   2) resolveProperty(cell, table._gui.schema) — иначе.
export function universalFormatter(cell, formatterParams, onRendered) {
    const params = formatterParams ?? {};

    let property = params.property;

    if (!property) {
        const schema = cell.getTable()._gui?.schema;

        if (!schema) return "";

        property = resolveProperty(
            cell,
            schema,
        );
    }

    if (!property) return "";

    const formatter = formatterRegistry.get(
        property.type,
    );

    if (!formatter) return "";
    
    return formatter(
        cell,
        {
            ...params,
            property,
        },
        onRendered,
    );
}