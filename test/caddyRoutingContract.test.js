import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const caddyfileUrl = new URL(
    "../deploy/caddy/Caddyfile",
    import.meta.url,
);

test("default-library assets bypass the single-page fallback", async () => {
    const source = await readFile(caddyfileUrl, "utf8");
    const assetHandler = source.indexOf("handle @default_library");
    const applicationHandler = source.indexOf("try_files {path} /index.html");

    assert.match(source, /@default_library path \/data\/default\/\*/u);
    assert.ok(assetHandler >= 0);
    assert.ok(applicationHandler > assetHandler);
});
