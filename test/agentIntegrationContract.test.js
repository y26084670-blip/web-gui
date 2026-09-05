import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  tasks: new URL("../src/tabs/Tasks.jsx", import.meta.url),
  panel: new URL(
    "../src/components/agent/TaskAgentPanel.jsx",
    import.meta.url,
  ),
  package: new URL("../package.json", import.meta.url),
};

test("task tab delegates passive next-step reasoning to the agent library", async () => {
  const [tasks, panel, packageText] = await Promise.all([
    readFile(files.tasks, "utf8"),
    readFile(files.panel, "utf8"),
    readFile(files.package, "utf8"),
  ]);
  const packageData = JSON.parse(packageText);

  assert.match(tasks, /buildAgentState/u);
  assert.match(tasks, /projectsRootName:\s*rootHandle\(\)\?\.name/u);
  assert.match(tasks, /projectsRootSelected:\s*Boolean\(rootHandle\(\)\)/u);
  assert.match(tasks, /<TaskAgentPanel state=\{agentState\(\)\} \/>/u);
  assert.doesNotMatch(tasks, /canExecuteAgentAction/u);
  assert.doesNotMatch(tasks, /handleAgentAction/u);
  assert.doesNotMatch(tasks, /canExecuteAction=/u);
  assert.doesNotMatch(tasks, /onAction=/u);
  assert.doesNotMatch(tasks, /const HELP_TOPICS/u);

  assert.match(panel, /agentClient\.analyze/u);
  assert.match(panel, /agentClient\.findHelpTopic/u);
  assert.match(panel, /Следующий шаг/u);
  assert.doesNotMatch(panel, /executeAction/u);
  assert.doesNotMatch(panel, /actionButton/u);
  assert.doesNotMatch(panel, /task-agent-actions/u);

  assert.match(packageData.scripts.dev, /agent:prepare/u);
  assert.match(packageData.scripts["build:release"], /agent:verify/u);
});
