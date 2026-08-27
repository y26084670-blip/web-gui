//==============================================================================
// Проверка ограничения maxItems
//==============================================================================

export function arrayMaxItemsValidator(value, property) {

    if (property.maxItems === undefined) {
        return true;
    }

    return value.length <= property.maxItems;

}