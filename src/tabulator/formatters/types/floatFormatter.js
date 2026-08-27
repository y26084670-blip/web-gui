//------------------------------------------------------------------------------
// Форматтер вещественных чисел.
//------------------------------------------------------------------------------
export function floatFormatter(
    cell,
    formatterParams,
) {
    const property = formatterParams.property;
    const value = cell.getValue();
    if (value == null) return "";
    const number = Number(value);
    if (Number.isNaN(number)) return value;
    const digits = property.digits ?? 6;
    const floatExp = property.floatExp ?? false;
    return floatExp
        ? number.toExponential(digits - 1)
        : number.toPrecision(digits);
}