//------------------------------------------------------------------------------
// Форматтер логических значений.
//------------------------------------------------------------------------------
export function booleanFormatter(cell, formatterParams) {
    const property = formatterParams.property;
    return cell.getValue()
        ? `🟢 ${property.textOn ?? "ON"}`
        : `⚫ ${property.textOff ?? "OFF"}`;
}