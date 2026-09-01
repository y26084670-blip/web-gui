import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appUrl = new URL("../src/App.jsx", import.meta.url);
const taskInfoBarUrl = new URL("../src/TaskInfoBar.jsx", import.meta.url);

test("App hosts one global modeless geometry viewer", async () => {
    const source = await readFile(appUrl, "utf8");

    assert.match(source, /import \{ GeometryViewerWindow \}/u);
    assert.match(source, /const \[geometryViewerOpen, setGeometryViewerOpen\]/u);
    assert.match(source, /<GeometryViewerWindow/u);
    assert.match(source, /const geometryModel = createMemo/u);
    assert.match(source, /model=\{geometryModel\(\)\}/u);
    assert.match(source, /selectedGeometryElementIndices/u);
    assert.match(source, /selectedGeometryRegionIndices/u);
    assert.match(source, /onRecordSelectionChange=\{handleGeometryRecordSelectionChange\}/u);
    assert.match(source, /selections=\{geometrySelections\(\)\}/u);
    assert.match(source, /selectionService\.loadedTaskHandle\(\)/u);
    assert.match(source, /setSelectedGeometryElementIndices\(\[\]\)/u);
    assert.match(source, /setSelectedGeometryRegionIndices\(\[\]\)/u);
    assert.match(source, /setGeometryViewerOpen\(false\)/u);
    assert.match(source, /geometryViewerButton\?\.focus\(\)/u);
});

test("task bar opens geometry viewer only for a loaded task", async () => {
    const source = await readFile(taskInfoBarUrl, "utf8");

    assert.match(source, /class="geometry-button"/u);
    assert.match(source, /disabled=\{!props\.path\}/u);
    assert.match(source, /onClick=\{props\.onGeometryViewerToggle\}/u);
    assert.match(source, /aria-pressed=\{props\.geometryViewerOpen\}/u);
    assert.match(source, /Закрыть 3D-просмотр геометрии/u);
});
