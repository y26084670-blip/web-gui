import { FIELD_TYPES } from "../../services/schemas/common/constants";

import { stringFormatter } from "./types/stringFormatter";
import { integerFormatter } from "./types/integerFormatter";
import { floatFormatter } from "./types/floatFormatter";
import { booleanFormatter } from "./types/booleanFormatter";
import { arrayFormatter } from "./types/arrayFormatter";
import { objectFormatter } from "./types/objectFormatter";
import { dateFormatter } from "./types/dateFormatter";
import { pathFormatter } from "./types/pathFormatter";
import { enumFormatter } from "./types/enumFormatter";

import "../../tabulator/views/registerDefaultViews";

//------------------------------------------------------------------------------
// Реестр форматтеров.
//------------------------------------------------------------------------------
export const formatterRegistry = new Map([

    [FIELD_TYPES.STRING, stringFormatter],
    [FIELD_TYPES.INTEGER, integerFormatter],
    [FIELD_TYPES.FLOAT, floatFormatter],
    [FIELD_TYPES.BOOLEAN, booleanFormatter],
    [FIELD_TYPES.ARRAY, arrayFormatter],
    [FIELD_TYPES.OBJECT, objectFormatter],
    [FIELD_TYPES.DATE, dateFormatter],
    [FIELD_TYPES.PATH, pathFormatter],
    [FIELD_TYPES.ENUM, enumFormatter],
]);