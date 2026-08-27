//==============================================================================
// Проверка ограничения pattern
//==============================================================================

export function stringPatternValidator(value, property) {

    if (property.pattern === undefined) {
        return true;
    }

    return new RegExp(property.pattern).test(value);

}