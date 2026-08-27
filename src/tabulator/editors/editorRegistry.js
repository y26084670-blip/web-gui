import { FIELD_TYPES } from "../../services/schemas/common/constants";

import { stringEditor } from "./types/stringEditor";
import { integerEditor } from "./types/integerEditor";
import { floatEditor } from "./types/floatEditor";
import { dateEditor } from "./types/dateEditor";
import { pathEditor } from "./types/pathEditor";
import { enumEditor } from "./types/enumEditor";

export const editorRegistry = new Map();

editorRegistry.set(FIELD_TYPES.STRING, stringEditor);
editorRegistry.set(FIELD_TYPES.INTEGER, integerEditor);
editorRegistry.set(FIELD_TYPES.FLOAT, floatEditor);
editorRegistry.set(FIELD_TYPES.DATE, dateEditor);
editorRegistry.set(FIELD_TYPES.PATH, pathEditor);
editorRegistry.set(FIELD_TYPES.ENUM, enumEditor);
