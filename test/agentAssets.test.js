import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  prepareAgentAssets,
  verifyAgentAssets,
} from "../scripts/agent-assets.mjs";

async function tempDirectory(prefix) {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

test("agent assets copy a valid sibling package", async () => {
  const source = await tempDirectory("clark-agent-source-");
  const output = await tempDirectory("clark-agent-output-");
  await mkdir(path.join(source, "src"), { recursive: true });
  await writeFile(path.join(source, "package.json"), JSON.stringify({
    name: "@clark/agent",
    version: "0.1.1",
  }));
  await writeFile(path.join(source, "src", "index.js"), "export const ok = true;\n");

  const manifest = await prepareAgentAssets({ sourceRoot: source, outputRoot: output });
  assert.equal(manifest.available, true);
  assert.equal(manifest.version, "0.1.1");
  assert.equal(
    await readFile(path.join(output, "src", "index.js"), "utf8"),
    "export const ok = true;\n",
  );
  assert.equal((await verifyAgentAssets({ root: output })).available, true);
});

test("missing sibling produces a valid unavailable manifest", async () => {
  const root = await tempDirectory("clark-agent-missing-");
  const output = path.join(root, "generated");
  const manifest = await prepareAgentAssets({
    sourceRoot: path.join(root, "absent"),
    outputRoot: output,
  });

  assert.equal(manifest.available, false);
  assert.match(manifest.reason, /не найден/);
  assert.equal((await verifyAgentAssets({ root: output })).available, false);
});
