import assert from "node:assert/strict";
import test from "node:test";

import { buildAgentState } from "../src/services/agentStateAdapter.js";

const error = {
  level: "error",
  tab: { id: "elements" },
  row: 2,
  property: "xapName",
  message: "Характеристика не найдена.",
};
const warning = {
  level: "warning",
  tab: "elements",
  row: 1,
  property: "geo",
  message: "Проверить форму.",
};

test("adapter reports whether the projects root is selected", () => {
  const missingRoot = buildAgentState();
  const selectedRoot = buildAgentState({
    projectsRootName: "clark.projects",
    projectsRootSelected: true,
  });

  assert.deepEqual(missingRoot.projectsRoot, {
    selected: false,
    name: null,
  });
  assert.deepEqual(selectedRoot.projectsRoot, {
    selected: true,
    name: "clark.projects",
  });
});

test("adapter distinguishes selected and loaded task", () => {
  const state = buildAgentState({
    projectsRootName: "clark.projects",
    projectsRootSelected: true,
    projectName: "demo",
    taskName: "task-001",
    taskLoaded: false,
  });

  assert.deepEqual(state.projectsRoot, {
    selected: true,
    name: "clark.projects",
  });
  assert.deepEqual(state.project, { selected: true, name: "demo" });
  assert.deepEqual(state.task, {
    selected: true,
    loaded: false,
    name: "task-001",
  });
  assert.equal(state.data.exists, false);
  assert.equal(state.data.format, "none");
});

test("adapter summarizes model, validation and unsaved state", () => {
  const state = buildAgentState({
    projectsRootName: "clark.projects",
    projectsRootSelected: true,
    projectName: "demo",
    taskName: "task-001",
    taskLoaded: true,
    model: {
      general: { name: "demo" },
      elements: [
        { name: "E1", xapName: "Steel" },
        { name: "E2", xapName: "" },
      ],
      mhj: [{ v: [[1, 2, 3], [4, 5, 6]] }],
    },
    diagnostics: [error, warning, { level: "success", message: "ok" }],
    validationChecked: true,
    dirty: true,
    resultsExists: true,
  });

  assert.equal(state.data.exists, true);
  assert.equal(state.data.dirty, true);
  assert.equal(state.geometry.exists, true);
  assert.equal(state.elements.count, 2);
  assert.equal(state.properties.assigned, false);
  assert.equal(state.properties.missingCount, 1);
  assert.equal(state.sources.count, 2);
  assert.equal(state.validation.checked, true);
  assert.equal(state.validation.errors.length, 1);
  assert.equal(state.validation.errors[0].path, "elements/2/xapName");
  assert.equal(state.validation.warnings.length, 1);
  assert.equal(state.results.exists, true);
});

test("adapter does not claim missing properties before validation", () => {
  const state = buildAgentState({
    projectsRootName: "clark.projects",
    projectsRootSelected: true,
    projectName: "demo",
    taskName: "task-001",
    taskLoaded: true,
    model: { elements: [{ name: "E1", xapName: "" }] },
    validationChecked: false,
  });

  assert.equal(state.properties.assigned, true);
  assert.equal(state.properties.missingCount, 0);
  assert.equal(state.validation.checked, false);
});
