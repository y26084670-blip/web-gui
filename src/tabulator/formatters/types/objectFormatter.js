//------------------------------------------------------------------------------
// Форматтер объектов.
//------------------------------------------------------------------------------
export function objectFormatter(cell, formatterParams) {
    const value = cell.getValue();

    if (
        value === null ||
        typeof value !== "object" ||
        Array.isArray(value)
    ) {
        return "";
    }

    return "{...}";
}