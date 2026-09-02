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

test("ordinary mode accepts only the clark.projects root", async () => {
    const source = await readFile(tasksComponent, "utf8");

    assert.match(
        source,
        /const PROJECTS_ROOT_NAME = "clark\.projects";/u,
    );
    assert.match(
        source,
        /if \(!props\.admin && handle\.name !== PROJECTS_ROOT_NAME\)/u,
    );
    assert.match(source, /Выберите каталог «\$\{PROJECTS_ROOT_NAME\}»/u);

    const pickerIndex = source.indexOf("window.showDirectoryPicker");
    const guardIndex = source.indexOf(
        "if (!props.admin && handle.name !== PROJECTS_ROOT_NAME)",
    );
    const invalidationIndex = source.indexOf(
        "const requestId = invalidateBrowserSelection()",
    );
    const mutationIndex = source.indexOf("setRootHandle(handle)");

    assert.ok(pickerIndex >= 0 && guardIndex > pickerIndex);
    assert.ok(invalidationIndex > guardIndex);
    assert.ok(mutationIndex > guardIndex);
});
