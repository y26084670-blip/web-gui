import { rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
/** Remove only the old generated agent copy, never the material libraries. */
export async function cleanLegacyAgentAssets(root = repositoryRoot) {
  for (const directory of [".generated/clark-agent", "dist/clark-agent"]) {
    await rm(resolve(root, directory), { recursive: true, force: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await cleanLegacyAgentAssets();
}
