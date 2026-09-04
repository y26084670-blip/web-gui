import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  app: new URL("../src/App.jsx", import.meta.url),
  tasks: new URL("../src/tabs/Tasks.jsx", import.meta.url),
  panel: new URL(
    "../src/components/agent/TaskAgentPanel.jsx",
    import.meta.url,
  ),
  package: new URL("../package.json", import.meta.url),
};

test("task tab delegates reasoning to the external agent library", async () => {
  const [app, tasks, panel, packageText] = await Promise.all([
    readFile(files.app, "utf8"),
    readFile(files.tasks, "utf8"),
    readFile(files.panel, "utf8"),
    readFile(files.package, "utf8"),
  ]);
  const packageData = JSON.parse(packageText);

  assert.match(tasks, /buildAgentState/u);
  assert.match(tasks, /<TaskAgentPanel/u);
  assert.match(tasks, /canExecuteAgentAction/u);
  assert.doesNotMatch(tasks, /const HELP_TOPICS/u);
  assert.match(panel, /agentClient\.analyze/u);
  assert.match(panel, /agentClient\.findHelpTopic/u);
  assert.match(app, /onValidate=\{handleModelValidation\}/u);
  assert.match(app, /onSave=\{handleSave\}/u);
  assert.match(app, /onOpenTab=\{setActiveTab\}/u);
  assert.match(packageData.scripts.dev, /agent:prepare/u);
  assert.match(packageData.scripts["build:release"], /agent:verify/u);
});
