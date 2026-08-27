//------------------------------------------------------------------------------
// Форматтер целых чисел.
//------------------------------------------------------------------------------
export function integerFormatter(cell, formatterParams) {
    const value = cell.getValue();

    if (value === null || value === undefined || value === "") {
        return "";
    }

    return Number(value).toString();
}