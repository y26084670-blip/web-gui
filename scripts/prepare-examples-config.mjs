import { copyFile, mkdir } from "node:fs/promises";

const projectRoot = new URL("../", import.meta.url);
const outputRoot = new URL(".generated/", projectRoot);

await mkdir(outputRoot, { recursive: true });
await copyFile(
    new URL("public/examples-config.json", projectRoot),
    new URL("examples-config.json", outputRoot),
);
