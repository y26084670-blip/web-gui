//==============================================================================
// Проверка ограничения multipleOf
//==============================================================================

export function numericMultipleOfValidator(value, property) {

    if (property.multipleOf === undefined) {
        return true;
    }

    const q = value / property.multipleOf;
    const EPS = 1e-12;
    
    return Math.abs(q - Math.round(q)) < EPS;

}