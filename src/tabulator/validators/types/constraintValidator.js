//==============================================================================
// Проверка ограничений JSON Schema
//==============================================================================

import { FIELD_TYPES } from "../../../services/schemas/common/constants";
import { numericMinimumValidator } from "../constraints/numericMinimumValidator";
import { numericMaximumValidator } from "../constraints/numericMaximumValidator";
import { numericExclusiveMinimumValidator } from "../constraints/numericExclusiveMinimumValidator";
import { numericExclusiveMaximumValidator } from "../constraints/numericExclusiveMaximumValidator";
import { numericMultipleOfValidator } from "../constraints/numericMultipleOfValidator";
import { stringMinLengthValidator } from "../constraints/stringMinLengthValidator";
import { stringMaxLengthValidator } from "../constraints/stringMaxLengthValidator";
import { stringPatternValidator } from "../constraints/stringPatternValidator";
import { valueEnumValidator } from "../constraints/valueEnumValidator";
import { valueConstValidator } from "../constraints/valueConstValidator";
import { arrayMinItemsValidator } from "../constraints/arrayMinItemsValidator";
import { arrayMaxItemsValidator } from "../constraints/arrayMaxItemsValidator";
import { arrayUniqueItemsValidator } from "../constraints/arrayUniqueItemsValidator";
import { resolveProperty } from "../../schema/propertyResolver";


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
// Проверка ограничений
//
// Единый канал получения описания поля:
//   1) property — дескриптор, переданный колонкой явно
//      (элемент связанного представления);
//   2) resolveProperty(cell, schema) — иначе.
//==============================================================================

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