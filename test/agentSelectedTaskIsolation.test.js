import assert from "node:assert/strict";
import test from "node:test";
import { buildAgentState } from "../src/services/agentStateAdapter.js";
test("selected but unloaded task does not inherit the old task's diagnostics or model", () => {
  const state = buildAgentState({ projectsRootName: "clark.projects", projectName: "new-project", taskName: "new-task",
    taskLoaded: false, model: { elements: [{ name: "private-old" }], mhj: [{ v: [1, 2, 3] }] },
    diagnostics: [{ level: "error", message: "private-old-error", property: "xapName" }],
    validationChecked: true, dirty: true, resultsExists: true });
  assert.equal(state.task.loaded, false);
  assert.equal(state.elements.count, 0);
  assert.equal(state.sources.count, 0);
  assert.equal(state.properties.missingCount, 0);
  assert.deepEqual(state.validation.errors, []);
  assert.equal(state.validation.checked, false);
  assert.equal(state.data.dirty, false);
  assert.equal(state.results.exists, false);
  assert.equal(JSON.stringify(state).includes("private-old"), false);
});
