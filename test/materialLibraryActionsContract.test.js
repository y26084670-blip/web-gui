import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentUrl = new URL(
    "../src/tabs/MaterialLibraryTab.jsx",
    import.meta.url,
);
const appUrl = new URL("../src/App.jsx", import.meta.url);

test("material tabs expose copy and FMM-only legacy import actions", async () => {
    const source = await readFile(componentUrl, "utf8");

    assert.match(source, />\s*Копировать в задание\s*</u);
    assert.match(source, />\s*Импортировать\s*</u);
    assert.match(
        source,
        /Импортировать локальную библиотеку старого формата/u,
    );
    assert.match(source, /<Show when=\{isFmm\}>[\s\S]*?>\s*Импортировать\s*<[\s\S]*?<\/Show>/u);
    assert.doesNotMatch(source, /Импортировать legacy-библиотеку ВТСП/u);
    assert.doesNotMatch(source, /pickHtcDirectory|importHtc/u);
    assert.match(source, /createMaterialImportService/u);
    assert.match(source, /taskMaterialLibraryService\.copyMaterials/u);
    assert.match(source, /taskMaterialLibraryService\.writeImportedBatch/u);
    assert.match(source, /Источник характеристик/u);
    assert.match(source, /Базовая библиотека/u);
    assert.match(source, /Локальная библиотека задания/u);
    assert.doesNotMatch(source, />\s*Редактировать\s*</u);
    assert.match(source, />\s*Сохранить\s*</u);
    assert.match(source, />\s*Удалить\s*</u);
    assert.match(source, /destination\.getFileHandle\("XAP\.lib"\)/u);
    assert.match(source, /legacyFmmStatus/u);
    assert.match(source, /identifyLegacyFmmLibrary/u);
    assert.match(source, /identity\.isBaseLibrary \? "base" : "importable"/u);
    assert.match(source, /legacyFmmStatus\(\) !== "importable"/u);
    assert.match(source, /совпадает со стандартной legacy-библиотекой/u);
    assert.match(source, /MaterialDeleteConfirmationDialog/u);
    assert.match(source, /sourceRecord: source/u);
    assert.match(source, /material-library-splitter-horizontal/u);
    assert.match(source, /material-library-splitter-vertical/u);
    assert.match(source, /createMaterialLibraryLoadQueue/u);
    assert.match(source, /tableLoadQueue\.run/u);
    assert.match(source, /const \[tableReady, setTableReady\]/u);
    assert.match(
        source,
        /if \(source === "task"\).*revision\(definition\.kind\)/su,
    );
    assert.match(source, /createHtcMaterialFile/u);
    assert.match(source, /HtcMaterialDetailView/u);
    assert.match(source, /materialLibraryHistoryService\.record/u);
    assert.match(source, /materialLibraryHistoryService\.attach/u);
    assert.equal(
        source.match(/loadRecords\(\{ source, destination \}\)/gu)?.length,
        1,
    );
    assert.match(source, /createSignal\(360\)/u);
    assert.match(source, /\{ primary: true \}/u);
});

test("material tabs route side-panel history outside task BaseModel", async () => {
    const source = await readFile(appUrl, "utf8");

    assert.match(source, /historyController: materialLibraryHistoryService/u);
    assert.match(source, /activeTabDefinition\(\)\?\.historyController \?\? modelService/u);
    assert.match(
        source,
        /\.\.\.materialTabRegistry\.map\(\(definition\) => \(\{[\s\S]*historyController: materialLibraryHistoryService,[\s\S]*component:/u,
    );
});

test("material actions keep task save notifications outside their contract", async () => {
    const source = await readFile(componentUrl, "utf8");

    assert.doesNotMatch(source, /notifyTaskDataChanged/u);
    assert.match(source, /MaterialBatchConflictError/u);
    assert.match(source, /MaterialBatchWriteError/u);
    assert.match(source, /window\.confirm/u);
    assert.match(source, /expectedConflicts = writeError\.conflicts/u);
    assert.match(
        source,
        /Копирование выполнено частично/u,
    );
    assert.match(
        source,
        /Импорт выполнен частично/u,
    );
    assert.match(
        source,
        /обработано —.*не удалось записать.*осталось —/su,
    );
    assert.match(source, /Импорт отменён пользователем; файлы не изменены/u);
});
