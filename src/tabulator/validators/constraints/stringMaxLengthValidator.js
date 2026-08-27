//==============================================================================
// Проверка ограничения maxLength
//==============================================================================

export function stringMaxLengthValidator(value, property) {

    if (property.maxLength === undefined) {
        return true;
    }

    return value.length <= property.maxLength;

}