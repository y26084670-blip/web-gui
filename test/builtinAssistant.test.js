import assert from "node:assert/strict";
import test from "node:test";
import { BUILTIN_TOPICS, analyzeBuiltin, findBuiltinTopic } from "../src/assistant/builtinAssistant.js";
test("built-in assistant follows root, project, task and loading without a server", () => {
  const state = {};
  assert.equal(analyzeBuiltin(state).recommendationId, "projects_root.missing");
  state.projectsRoot = { selected: true };
  assert.equal(analyzeBuiltin(state).recommendationId, "project.missing");
  state.project = { selected: true };
  assert.equal(analyzeBuiltin(state).recommendationId, "task.missing");
  state.task = { selected: true, loaded: false };
  assert.equal(analyzeBuiltin(state).recommendationId, "task.not_loaded");
});
test("offline errors and invalid counters never produce readiness", () => {
  const state = { projectsRoot: { selected: true }, project: { selected: true },
    task: { selected: true, loaded: true }, validation: { checked: true, errors: "2" } };
  assert.equal(analyzeBuiltin(state).level, "error");
  state.validation.errors = 2;
  assert.equal(analyzeBuiltin(state).level, "error");
  state.validation = { checked: false, errors: [] };
  assert.equal(analyzeBuiltin(state).recommendationId, "validation.unchecked");
  assert.equal(analyzeBuiltin({ schemaVersion: 99 }).level, "error");
});
test("all fallback topics have content and free questions work offline", () => {
  assert.equal(BUILTIN_TOPICS.length, 18);
  assert.ok(BUILTIN_TOPICS.every((topic) => topic.summary.length > 30));
  assert.equal(findBuiltinTopic("проверить модель ошибка").id, "validation");
  assert.equal(findBuiltinTopic("протокол").id, "results_protocols");
  assert.equal(findBuiltinTopic("абракадабра"), null);
});
