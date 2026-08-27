//==============================================================================
// Проверка ограничения minimum
//==============================================================================

export function numericMinimumValidator(value, property) {

    if (property.minimum === undefined) {
        return true;
    }

    return value >= property.minimum;

}