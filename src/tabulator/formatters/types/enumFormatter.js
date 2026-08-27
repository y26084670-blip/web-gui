//------------------------------------------------------------------------------
// Форматтер именованных перечислений.
//------------------------------------------------------------------------------
import { findNamedEnumOption } from "../../../services/schemas/common/enumOptions";

export function enumFormatter(cell, formatterParams) {
    const value = cell.getValue();

    if (value === undefined || value === null) {
        return "";
    }

    const option = findNamedEnumOption(
        formatterParams?.property?.enum,
        value,
    );

    return option?.label ?? String(value);
}
