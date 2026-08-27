//==============================================================================
// Проверка ограничения maximum
//==============================================================================

export function numericMaximumValidator(value, property) {

    if (property.maximum === undefined) {
        return true;
    }

    return value <= property.maximum;

}