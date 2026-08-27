//==============================================================================
// Проверка ограничения uniqueItems
//==============================================================================

export function arrayUniqueItemsValidator(value, property) {

    if (property.uniqueItems === undefined) {
        return true;
    }

    if (!property.uniqueItems) {
        return true;
    }

    return new Set(value).size === value.length;

}