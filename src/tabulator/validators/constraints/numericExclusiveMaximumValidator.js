//==============================================================================
// Проверка ограничения exclusiveMaximum
//==============================================================================

export function numericExclusiveMaximumValidator(value, property) {

    if (property.exclusiveMaximum === undefined) {
        return true;
    }

    return value < property.exclusiveMaximum;

}