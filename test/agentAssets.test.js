import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanLegacyAgentAssets } from "../scripts/clean-legacy-agent-assets.mjs";
test("legacy agent cleanup leaves material libraries and unrelated files intact", async () => {
  const root = await mkdtemp(join(tmpdir(), "clark-agent-clean-"));
  try {
    for (const dir of [".generated/clark-agent", "dist/clark-agent", ".generated/data/default", "dist/data/default"]) {
      await mkdir(join(root, dir), { recursive: true });
      await writeFile(join(root, dir, "sentinel.txt"), "keep");
    }
    await cleanLegacyAgentAssets(root);
    await cleanLegacyAgentAssets(root);
    await assert.rejects(access(join(root, ".generated/clark-agent")));
    await assert.rejects(access(join(root, "dist/clark-agent")));
    assert.equal(await readFile(join(root, ".generated/data/default/sentinel.txt"), "utf8"), "keep");
    assert.equal(await readFile(join(root, "dist/data/default/sentinel.txt"), "utf8"), "keep");
  } finally { await rm(root, { recursive: true, force: true }); }
});
