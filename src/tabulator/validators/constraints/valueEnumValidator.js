//==============================================================================
// Проверка ограничения enum
//==============================================================================

import { findNamedEnumOption } from "../../../services/schemas/common/enumOptions.js";

export function valueEnumValidator(value, property) {
    if (property.enum === undefined) {
        return true;
    }

    return findNamedEnumOption(property.enum, value) !== undefined;
}
