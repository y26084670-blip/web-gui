import { VALIDATION_LEVELS } from "./schemas/common/constants.js";

function records(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.records)) return value.records;
  if (Array.isArray(value?.v)) return value.v;
  return [];
}

function countSources(value) {
  const rows = records(value);
  if (!rows.length) return 0;

  const nested = rows.reduce(
    (sum, row) => sum + (Array.isArray(row?.v) ? row.v.length : 0),
    0,
  );
  return nested || rows.length;
}

function entity(name, selected = Boolean(name)) {
  const normalized = typeof name === "string" ? name.trim() : "";
  return {
    selected: Boolean(selected),
    name: normalized || null,
  };
}

function diagnosticPath(diagnostic) {
  const tab = typeof diagnostic?.tab === "string"
    ? diagnostic.tab
    : diagnostic?.tab?.id;
  return [tab, diagnostic?.row, diagnostic?.property]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .join("/");
}

function toIssue(diagnostic) {
  return {
    code: diagnostic?.code ?? "model-diagnostic",
    message: String(diagnostic?.message ?? ""),
    path: diagnosticPath(diagnostic),
  };
}

function isLevel(diagnostic, level) {
  return diagnostic?.level === level;
}

function isMissingPropertyDiagnostic(diagnostic) {
  return isLevel(diagnostic, VALIDATION_LEVELS.ERROR)
    && diagnostic?.property === "xapName";
}

/**
 * Converts reactive web-gui state to the stable clark.agent contract.
 * The adapter has no UI or file-system side effects.
 */
export function buildAgentState({
  projectName = "",
  taskName = "",
  taskLoaded = false,
  model = {},
  diagnostics = [],
  validationChecked = false,
  dirty = false,
  resultsExists = false,
} = {}) {
  const snapshot = model && typeof model === "object" ? model : {};
  const messages = Array.isArray(diagnostics) ? diagnostics : [];
  const elementRows = records(snapshot.elements);
  const elementsCount = elementRows.length;
  const dataExists = Boolean(taskLoaded && Object.keys(snapshot).length > 0);
  const missingPropertyDiagnostics = messages.filter(
    isMissingPropertyDiagnostic,
  );

  return {
    schemaVersion: 1,
    project: entity(projectName),
    task: {
      ...entity(taskName),
      loaded: Boolean(taskLoaded),
    },
    data: {
      exists: dataExists,
      dirty: Boolean(dirty),
      format: taskLoaded ? "input3XX" : "none",
    },
    geometry: {
      exists: elementsCount > 0,
      valid: null,
    },
    elements: {
      count: elementsCount,
    },
    properties: {
      assigned: elementsCount > 0 && missingPropertyDiagnostics.length === 0,
      missingCount: missingPropertyDiagnostics.length,
    },
    sources: {
      count: countSources(snapshot.mhj),
    },
    validation: {
      checked: Boolean(validationChecked),
      errors: messages
        .filter((item) => isLevel(item, VALIDATION_LEVELS.ERROR))
        .map(toIssue),
      warnings: messages
        .filter((item) => isLevel(item, VALIDATION_LEVELS.WARNING))
        .map(toIssue),
    },
    results: {
      exists: Boolean(resultsExists),
    },
  };
}
