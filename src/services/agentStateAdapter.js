import { VALIDATION_LEVELS } from "./schemas/common/constants.js";
function records(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.records)) return value.records;
  if (Array.isArray(value?.v)) return value.v;
  return [];
}
function countSources(value) {
  const rows = records(value);
  const nested = rows.reduce((sum, row) => sum + (Array.isArray(row?.v) ? row.v.length : 0), 0);
  return nested || rows.length;
}
function entity(value, selected = Boolean(value)) {
  const name = typeof value === "string" ? value.trim() : "";
  return { selected: Boolean(selected), name: name || null };
}
function toIssue(item) {
  const tab = typeof item?.tab === "string" ? item.tab : item?.tab?.id;
  return { code: item?.code ?? "model-diagnostic", message: String(item?.message ?? ""),
    path: [tab, item?.row, item?.property].filter((v) => v !== undefined && v !== null && v !== "").join("/") };
}
/** A selected task must never inherit the previous loaded task's model or diagnostics. */
export function buildAgentState({
  projectsRootName = "", projectsRootSelected = Boolean(projectsRootName),
  projectName = "", taskName = "", taskLoaded = false, model = {}, diagnostics = [],
  validationChecked = false, dirty = false, resultsExists = false
} = {}) {
  const loaded = Boolean(taskLoaded && taskName);
  const snapshot = loaded && model && typeof model === "object" ? model : {};
  const messages = loaded && Array.isArray(diagnostics) ? diagnostics : [];
  const elementsCount = records(snapshot.elements).length;
  const missing = messages.filter((item) => item?.level === VALIDATION_LEVELS.ERROR && item?.property === "xapName");
  return {
    schemaVersion: 1,
    projectsRoot: entity(projectsRootName, projectsRootSelected),
    project: entity(projectName), task: { ...entity(taskName), loaded },
    data: { exists: loaded && Object.keys(snapshot).length > 0, dirty: loaded && Boolean(dirty), format: loaded ? "input3XX" : "none" },
    geometry: { exists: elementsCount > 0, valid: null },
    elements: { count: elementsCount },
    properties: { assigned: elementsCount > 0 && missing.length === 0, missingCount: missing.length },
    sources: { count: countSources(snapshot.mhj) },
    validation: { checked: loaded && Boolean(validationChecked),
      errors: messages.filter((item) => item?.level === VALIDATION_LEVELS.ERROR).map(toIssue),
      warnings: messages.filter((item) => item?.level === VALIDATION_LEVELS.WARNING).map(toIssue) },
    results: { exists: loaded && Boolean(resultsExists) }
  };
}
