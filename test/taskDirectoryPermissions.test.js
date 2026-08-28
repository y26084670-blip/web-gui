import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tasksComponent = new URL("../src/tabs/Tasks.jsx", import.meta.url);

test("task root picker requests read-write permission", async () => {
    const source = await readFile(tasksComponent, "utf8");

    assert.match(
        source,
        /showDirectoryPicker\s*\(\s*\{\s*mode:\s*["']readwrite["']/,
    );
});
