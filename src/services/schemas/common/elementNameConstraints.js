import { FIELD_TYPES } from "./constants.js";

export const ELEMENT_NAME_CONSTRAINTS = Object.freeze({
    type: FIELD_TYPES.STRING,
    minLength: 1,
    pattern: "\\S",
});
