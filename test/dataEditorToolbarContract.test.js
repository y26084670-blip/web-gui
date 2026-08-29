import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentUrl = new URL(
    "../src/components/editors/DataEditor.jsx",
    import.meta.url,
);

test("record list actions are disabled until a task is loaded", async () => {
    const source = await readFile(componentUrl, "utf8");
    const disabled = source.match(/disabled=\{!hasActiveTask\(\)\}/gu) ?? [];

    assert.equal(disabled.length, 6);
    assert.match(source, /if \(!hasActiveTask\(\)\) return;/u);
    assert.match(source, /Сначала загрузите задание/u);
});
