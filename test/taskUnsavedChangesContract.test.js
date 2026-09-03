import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tasksUrl = new URL("../src/tabs/Tasks.jsx", import.meta.url);
const appUrl = new URL("../src/App.jsx", import.meta.url);

test("task selection is committed only by the explicit load action", async () => {
    const source = await readFile(tasksUrl, "utf8");

    assert.match(source, /onClick=\{\(\) => selectTaskCandidate\(task\)\}/u);
    assert.match(source, /class="task-load-label"[\s\S]*?Загрузить для редактирования/u);
    assert.match(source, /const commitTaskLoad = .*clearLoadedTaskState\(\)/su);
    assert.match(source, /getDirectoryHandle\(DIRECTORIES\.INPUT\)/u);
    assert.doesNotMatch(source, /Текущее выбранное задание/u);
});

test("task replacement is guarded by a two-action modal", async () => {
    const source = await readFile(tasksUrl, "utf8");

    assert.match(source, /unsavedChangesService\.hasDirty\(\)/u);
    assert.match(source, /class="task-unsaved-dialog"/u);
    assert.match(source, /onCancel=\{\(event\) => event\.preventDefault\(\)\}/u);
    assert.match(source, />\s*Загрузить без сохранения\s*</u);
    assert.match(source, />\s*Вернуться к редактированию\s*</u);
    assert.match(source, /props\.onReturnToEditing\?\.\(\)/u);
});

test("tab headers expose reactive saved-state indicators", async () => {
    const source = await readFile(appUrl, "utf8");

    assert.match(source, /class="tab-change-indicator"|"tab-change-indicator": true/u);
    assert.match(source, /dirty: unsavedChangesService\.isDirty\(tab\.id\)/u);
    assert.match(source, /unsavedChangesService\.setBaseline\(schema\.id, itemModel\)/u);
    assert.match(source, /handleReturnToEditing/u);
});
