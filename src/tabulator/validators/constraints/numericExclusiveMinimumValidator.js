//==============================================================================
// Проверка ограничения exclusiveMinimum
//==============================================================================

export function numericExclusiveMinimumValidator(value, property) {

    if (property.exclusiveMinimum === undefined) {
        return true;
    }

    return value > property.exclusiveMinimum;

}