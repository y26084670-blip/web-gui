import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
test("task tab supplies root-aware state and passive advice without importing the agent", async () => {
  const [tasks, panel, client, packageText, vite, localCaddy] = await Promise.all([
    read("src/tabs/Tasks.jsx"), read("src/components/agent/TaskAgentPanel.jsx"),
    read("src/services/agentClient.js"), read("package.json"), read("vite.config.js"), read("deploy/caddy/Caddyfile.local")
  ]);
  const pkg = JSON.parse(packageText);
  assert.match(tasks, /projectsRootName:\s*rootHandle\(\)\?\.name/u);
  assert.match(tasks, /projectsRootSelected:\s*Boolean\(rootHandle\(\)\)/u);
  assert.match(tasks, /<TaskAgentPanel state=\{agentState\(\)\} \/>/u);
  assert.doesNotMatch(tasks, /canExecuteAgentAction|handleAgentAction|canExecuteAction=|onAction=/u);
  assert.match(panel, /analyzeBuiltin\(state\)/u);
  assert.match(panel, /agentClient\.analyze/u);
  assert.match(panel, /connection\.available/u);
  assert.match(panel, /revision !== recommendationRevision/u);
  assert.doesNotMatch(panel, /executeAction|actionButton|task-agent-actions/u);
  assert.doesNotMatch(client, /manifest\.json|importModule|@clark\/agent/u);
  assert.match(client, /agent\.hello/u);
  assert.match(client, /agent\.analyze/u);
  for (const script of ["dev", "build", "build:release", "build:pages"]) {
    assert.doesNotMatch(pkg.scripts[script], /agent:prepare|agent:verify/u);
    assert.match(pkg.scripts[script], /assets:prepare/u);
  }
  assert.match(vite, /\/agent\/rpc/u);
  assert.match(localCaddy, /bind 127\.0\.0\.1/u);
  assert.match(localCaddy, /header_up Host 127\.0\.0\.1:8765/u);
  assert.doesNotMatch(localCaddy, /header_up Origin/u);
});
