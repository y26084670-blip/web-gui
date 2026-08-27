//==============================================================================
// Проверка ограничения minItems
//==============================================================================

export function arrayMinItemsValidator(value, property) {

    if (property.minItems === undefined) {
        return true;
    }

    return value.length >= property.minItems;

}