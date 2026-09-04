import { dataService } from "./dataService.js";
import { DIRECTORIES } from "./schemas/common/constants.js";
import elementsSchema from "./schemas/elements.schema.js";
import generalSchema from "./schemas/general.schema.js";
import regionsSchema from "./schemas/regions.schema.js";

const PREVIEW_SCHEMAS = Object.freeze([
  Object.freeze({ key: "general", schema: generalSchema }),
  Object.freeze({ key: "elements", schema: elementsSchema }),
  Object.freeze({ key: "regions", schema: regionsSchema }),
]);

function isMissingEntry(error) {
  return error?.name === "NotFoundError" || error?.name === "TypeMismatchError";
}

export async function loadTaskGeometryPreview(
  taskHandle,
  { load = (handle, schema, diagnostics) =>
    dataService.load(handle, schema, diagnostics) } = {},
) {
  if (!taskHandle) {
    return { model: null, diagnostics: [], currentFormat: false };
  }

  try {
    await taskHandle.getDirectoryHandle(DIRECTORIES.INPUT);
  } catch (error) {
    if (isMissingEntry(error)) {
      return { model: null, diagnostics: [], currentFormat: false };
    }
    throw error;
  }

  const diagnostics = [];
  const parts = await Promise.all(
    PREVIEW_SCHEMAS.map(({ schema }) =>
      load(taskHandle, schema, diagnostics)
    ),
  );
  const model = {};

  PREVIEW_SCHEMAS.forEach(({ key }, index) => {
    const value = parts[index];
    model[key] = value ?? (key === "general" ? {} : []);
  });

  return { model, diagnostics, currentFormat: true };
}
