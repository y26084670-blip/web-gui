//==============================================================================
// Проверка ограничений JSON Schema
//==============================================================================

import { FIELD_TYPES } from "../../../services/schemas/common/constants.js";
import { numericMinimumValidator } from "../constraints/numericMinimumValidator.js";
import { numericMaximumValidator } from "../constraints/numericMaximumValidator.js";
import { numericExclusiveMinimumValidator } from "../constraints/numericExclusiveMinimumValidator.js";
import { numericExclusiveMaximumValidator } from "../constraints/numericExclusiveMaximumValidator.js";
import { numericMultipleOfValidator } from "../constraints/numericMultipleOfValidator.js";
import { stringMinLengthValidator } from "../constraints/stringMinLengthValidator.js";
import { stringMaxLengthValidator } from "../constraints/stringMaxLengthValidator.js";
import { stringPatternValidator } from "../constraints/stringPatternValidator.js";
import { valueEnumValidator } from "../constraints/valueEnumValidator.js";
import { valueConstValidator } from "../constraints/valueConstValidator.js";
import { arrayMinItemsValidator } from "../constraints/arrayMinItemsValidator.js";
import { arrayMaxItemsValidator } from "../constraints/arrayMaxItemsValidator.js";
import { arrayUniqueItemsValidator } from "../constraints/arrayUniqueItemsValidator.js";
import { resolveProperty } from "../../schema/propertyResolver.js";


//==============================================================================
// Регистрация ограничений JSON Schema по типам полей
//==============================================================================

const constraintRegistry = new Map();

constraintRegistry.set(FIELD_TYPES.INTEGER, [

    numericMinimumValidator,
    numericMaximumValidator,
    numericExclusiveMinimumValidator,
    numericExclusiveMaximumValidator,
    numericMultipleOfValidator,

    valueEnumValidator,
    valueConstValidator,

]);

constraintRegistry.set(FIELD_TYPES.FLOAT, [

    numericMinimumValidator,
    numericMaximumValidator,
    numericExclusiveMinimumValidator,
    numericExclusiveMaximumValidator,
    numericMultipleOfValidator,

    valueEnumValidator,
    valueConstValidator,

]);

constraintRegistry.set(FIELD_TYPES.STRING, [

    stringMinLengthValidator,
    stringMaxLengthValidator,
    stringPatternValidator,

    valueEnumValidator,
    valueConstValidator,

]);

constraintRegistry.set(FIELD_TYPES.ARRAY, [

    arrayMinItemsValidator,
    arrayMaxItemsValidator,
    arrayUniqueItemsValidator,

]);

constraintRegistry.set(FIELD_TYPES.BOOLEAN, [

    valueEnumValidator,
    valueConstValidator,

]);

constraintRegistry.set(FIELD_TYPES.ENUM, [

    valueEnumValidator,
    valueConstValidator,

]);

constraintRegistry.set(FIELD_TYPES.DATE, [

    valueEnumValidator,
    valueConstValidator,

]);

constraintRegistry.set(FIELD_TYPES.PATH, [

    valueEnumValidator,
    valueConstValidator,

]);

constraintRegistry.set(FIELD_TYPES.OBJECT, [

]);

//==============================================================================
// Проверка ограничений непосредственно по значению и дескриптору.
//==============================================================================

export function validateConstraintValue(value, descriptor) {
    if (!descriptor) {
        return true;
    }

    const validators =
        constraintRegistry.get(descriptor.type) ?? [];

    for (const validator of validators) {
        if (!validator(value, descriptor)) {
            return false;
        }
    }

    return true;

}

// Обёртка Tabulator. Дескриптор передаётся колонкой вложенной таблицы явно,
// а для основной таблицы определяется по ячейке и схеме.
export function constraintValidator(
    cell,
    value,
    schema,
    property = undefined,
) {

    const descriptor =
        property ?? resolveProperty(
            cell,
            schema,
        );

    return validateConstraintValue(value, descriptor);

}
