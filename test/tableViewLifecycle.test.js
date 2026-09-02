import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tableViewUrl = new URL(
  "../src/tabulator/views/TableView.js",
  import.meta.url,
);

function methodSource(source, name, nextName) {
  const start = source.indexOf(`    ${name}(`);
  const end = source.indexOf(`    ${nextName}(`, start + 1);

  assert.notEqual(start, -1, `${name} method must exist`);
  assert.notEqual(end, -1, `${nextName} method must follow ${name}`);
  return source.slice(start, end);
}

test("TableView defers updates until its Tabulator instance is built", async () => {
  const source = await readFile(tableViewUrl, "utf8");
  const create = methodSource(source, "create", "setupContext");
  const update = methodSource(source, "update", "destroy");

  assert.match(source, /this\.buildPromise = Promise\.resolve\(\)/u);
  assert.match(source, /this\.resolveBuilt = null/u);
  assert.match(
    create,
    /this\.buildPromise = new Promise[\s\S]*const table = new Tabulator/u,
  );
  assert.match(create, /\(\) => this\.onTableBuilt\(table\)/u);

  const readinessGuard = update.indexOf("if (!this.built)");
  const valueRead = update.indexOf("const value = this.readValue()");
  const dataReplacement = update.indexOf("this.table.replaceData");

  assert.ok(readinessGuard >= 0);
  assert.ok(readinessGuard < valueRead);
  assert.ok(valueRead < dataReplacement);
  assert.match(update, /return buildPromise\.then/u);
  assert.match(update, /this\.table !== table \|\| !this\.built/u);
});

test("TableView releases and discards pending updates when destroyed", async () => {
  const source = await readFile(tableViewUrl, "utf8");
  const built = methodSource(source, "onTableBuilt", "readValue");
  const destroy = source.slice(source.indexOf("    destroy() {"));

  assert.match(built, /if \(this\.table !== table\)[\s\S]*return/u);
  assert.match(built, /this\.built = true/u);
  assert.match(built, /resolveBuilt\?\.\(\)/u);

  const releaseWaiters = destroy.indexOf("resolveBuilt?.()");
  const destroyTable = destroy.indexOf("this.table?.destroy()");

  assert.ok(releaseWaiters >= 0);
  assert.ok(releaseWaiters < destroyTable);
  assert.match(destroy, /this\.buildPromise = Promise\.resolve\(\)/u);
  assert.match(destroy, /this\.table = null/u);
});
