import { VIEW_TYPES } from "../../services/schemas/common/constants";
import { viewRegistry } from "./viewRegistry";
import { valueViewAdapter } from "./types/valueViewAdapter";
import { tableViewAdapter } from "./types/tableViewAdapter";

viewRegistry.set(VIEW_TYPES.VALUE, valueViewAdapter);
viewRegistry.set(VIEW_TYPES.COLUMNS, null);
viewRegistry.set(VIEW_TYPES.FORM, null);
viewRegistry.set(VIEW_TYPES.TABLE, tableViewAdapter);
viewRegistry.set(VIEW_TYPES.MATRIX, null);
viewRegistry.set(VIEW_TYPES.REFERENCE, null);
viewRegistry.set(VIEW_TYPES.CUSTOM, null);