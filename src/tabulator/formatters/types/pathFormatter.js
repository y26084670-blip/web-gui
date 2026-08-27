//------------------------------------------------------------------------------
// Форматтер пути.
//------------------------------------------------------------------------------
export function pathFormatter(cell, formatterParams) {
    const value = cell.getValue();

    if (!value) {
        return "";
    }

    return value;
}