import assert from "node:assert/strict";
import test from "node:test";

import {
    createMaterialReferenceCatalog,
    loadMaterialReferenceCatalog,
    validateElementMaterialReferences,
} from "../src/services/materialReferenceValidation.js";

test("material references respect model kind and report missing files", () => {
    const catalog = createMaterialReferenceCatalog({
        FMM: [{ name: "Сталь" }],
        HTC: [{ name: "ВТСП" }],
    });
    const diagnostics = [];
    validateElementMaterialReferences([
        { model: 0, xapName: "сталь" },
        { model: 2, xapName: "Сталь" },
        { model: 0, xapName: "Нет файла" },
        { model: 0, xapName: "" },
    ], catalog, diagnostics);

    assert.equal(diagnostics.length, 2);
    assert.match(diagnostics[0].message, /найдена только в библиотеке FMM/u);
    assert.match(diagnostics[1].message, /не найден/u);
    assert.deepEqual(diagnostics.map(item => item.row), [2, 3]);
});

test("identical local names are not diagnosed as a collision", () => {
    const diagnostics = [];
    const catalog = createMaterialReferenceCatalog({
        FMM: [{ name: "Сталь" }, { name: "Сталь" }],
    });
    validateElementMaterialReferences(
        [{ model: 0, xapName: "Сталь" }],
        catalog,
        diagnostics,
    );
    assert.deepEqual(diagnostics, []);
});

test("case-only material spellings are diagnosed as ambiguous", () => {
    const diagnostics = [];
    const catalog = createMaterialReferenceCatalog({
        FMM: [{ name: "Steel" }, { name: "steel" }],
    });
    validateElementMaterialReferences(
        [{ model: 0, xapName: "STEEL" }],
        catalog,
        diagnostics,
    );
    assert.equal(diagnostics.length, 1);
    assert.match(diagnostics[0].message, /неоднозначна/u);
});

test("validation catalog loads names only from task libraries", async () => {
    const taskHandle = { name: "task" };
    const calls = [];
    const result = await loadMaterialReferenceCatalog(
        taskHandle,
        {
            taskLibraryService: {
                async loadMaterials(request) {
                    calls.push(request);
                    return request.kind === "FMM"
                        ? [{ name: "Локальная сталь" }]
                        : [{ name: "Локальная ВТСП" }];
                },
            },
        },
    );

    assert.deepEqual(
        calls.map(request => request.kind),
        ["FMM", "HTC"],
    );
    assert.ok(calls.every(request => request.taskHandle === taskHandle));
    assert.deepEqual(result.errors, []);

    const diagnostics = [];
    validateElementMaterialReferences([
        { model: 0, xapName: "Локальная сталь" },
        { model: 0, xapName: "Только базовая сталь" },
        { model: 2, xapName: "Локальная ВТСП" },
    ], result.catalog, diagnostics);

    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].row, 2);
    assert.match(diagnostics[0].message, /не найден/u);
});
