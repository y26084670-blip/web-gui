//------------------------------------------------------------------------------
// Форматтер вещественных чисел.
//------------------------------------------------------------------------------
export function formatFixedSignificant(number, digits) {
    if (!Number.isFinite(number)) return String(number);
    if (number === 0) {
        return digits > 1 ? `0.${"0".repeat(digits - 1)}` : "0";
    }

    const exponent = Math.floor(Math.log10(Math.abs(number)));
    const fractionDigits = Math.max(0, digits - exponent - 1);
    if (fractionDigits <= 100 && Math.abs(number) < 1e21) {
        return number.toFixed(fractionDigits);
    }

    const [coefficient, exponentText] = number
        .toExponential(Math.max(0, digits - 1))
        .split("e");
    const exponentValue = Number(exponentText);
    const negative = coefficient.startsWith("-");
    const significant = coefficient.replace("-", "").replace(".", "");
    const decimalPosition = exponentValue + 1;
    const body = decimalPosition <= 0
        ? `0.${"0".repeat(-decimalPosition)}${significant}`
        : decimalPosition >= significant.length
            ? significant + "0".repeat(decimalPosition - significant.length)
            : `${significant.slice(0, decimalPosition)}.${significant.slice(decimalPosition)}`;
    return negative ? `-${body}` : body;
}

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
    if (property.floatFormat === "fixed") {
        return formatFixedSignificant(number, digits);
    }
    return floatExp
        ? number.toExponential(digits - 1)
        : number.toPrecision(digits);
}
