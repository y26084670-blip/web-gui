import { TABS } from "../../services/schemas/common/constants.js";

function tabId(diagnostic) {
  return typeof diagnostic?.tab === "string"
    ? diagnostic.tab
    : diagnostic?.tab?.id;
}

function propertyId(diagnostic) {
  return typeof diagnostic?.property === "string"
    ? diagnostic.property
    : diagnostic?.property?.id
      ?? diagnostic?.property?.label
      ?? diagnostic?.property?.title
      ?? "";
}

function groupableRecordDiagnostic(diagnostic) {
  const id = tabId(diagnostic);
  return (id === TABS.ELEMENTS.id || id === TABS.REGIONS.id)
    && diagnostic?.row !== undefined
    && diagnostic?.row !== null;
}

function groupKey(diagnostic) {
  return JSON.stringify([
    diagnostic?.level ?? "",
    tabId(diagnostic) ?? "",
    propertyId(diagnostic),
    diagnostic?.message ?? "",
  ]);
}

export function groupDiagnostics(diagnostics = []) {
  const result = [];
  const groups = new Map();

  for (const diagnostic of diagnostics) {
    if (!groupableRecordDiagnostic(diagnostic)) {
      result.push({
        ...diagnostic,
        rows: diagnostic?.row === undefined || diagnostic?.row === null
          ? []
          : [diagnostic.row],
      });
      continue;
    }

    const key = groupKey(diagnostic);
    const existing = groups.get(key);
    if (existing) {
      if (!existing.rows.includes(diagnostic.row)) {
        existing.rows.push(diagnostic.row);
      }
      continue;
    }

    const group = {
      ...diagnostic,
      row: undefined,
      rows: [diagnostic.row],
    };
    groups.set(key, group);
    result.push(group);
  }

  for (const diagnostic of result) {
    diagnostic.rows.sort((left, right) => Number(left) - Number(right));
  }

  return result;
}
