//==============================================================================
// Проверка ограничения const
//==============================================================================

export function valueConstValidator(value, property) {

    if (property.const === undefined) {
        return true;
    }

    return value === property.const;

}