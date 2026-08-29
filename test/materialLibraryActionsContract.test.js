import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentUrl = new URL(
    "../src/tabs/MaterialLibraryTab.jsx",
    import.meta.url,
);

test("material tabs expose copy and both legacy import actions", async () => {
    const source = await readFile(componentUrl, "utf8");

    assert.match(source, />\s*Копировать в задание\s*</u);
    assert.match(source, /Импортировать XAP\.lib/u);
    assert.match(source, /Импортировать legacy-библиотеку ВТСП/u);
    assert.match(source, /createMaterialImportService/u);
    assert.match(source, /taskMaterialLibraryService\.copyMaterials/u);
    assert.match(source, /taskMaterialLibraryService\.writeImportedBatch/u);
    assert.match(source, /Источник характеристик/u);
    assert.match(source, /Базовая библиотека/u);
    assert.match(source, /Локальная библиотека задания/u);
    assert.match(source, />\s*Редактировать\s*</u);
    assert.match(source, />\s*Удалить\s*</u);
    assert.match(source, /destination\.getFileHandle\("XAP\.lib"\)/u);
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
