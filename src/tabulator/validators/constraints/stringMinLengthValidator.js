//==============================================================================
// Проверка ограничения minLength
//==============================================================================

export function stringMinLengthValidator(value, property) {

    if (property.minLength === undefined) {
        return true;
    }

    return value.length >= property.minLength;

}