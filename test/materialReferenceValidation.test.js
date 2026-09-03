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
    assert.match(
        diagnostics[0].message,
        /найдена только в локальной библиотеке FMM/u,
    );
    assert.match(diagnostics[1].message, /не найдена в локальной библиотеке/u);
    assert.deepEqual(diagnostics.map(item => item.row), [2, 3]);
});

test("repeated identical local names are not a collision", () => {
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

test("catalog loader reads only task-local libraries", async () => {
    const calls = [];
    const taskHandle = { name: "task" };
    const taskLibraryService = {
        async loadMaterials(request) {
            calls.push(request);
            return request.kind === "FMM"
                ? [{ name: "Локальная сталь" }]
                : [];
        },
    };

    const result = await loadMaterialReferenceCatalog(taskHandle, {
        taskLibraryService,
    });
    const diagnostics = [];
    validateElementMaterialReferences([
        { model: 0, xapName: "Локальная сталь" },
        { model: 0, xapName: "Только базовая" },
    ], result.catalog, diagnostics);

    assert.deepEqual(calls.map(call => call.kind).sort(), ["FMM", "HTC"]);
    assert.equal(calls.every(call => call.taskHandle === taskHandle), true);
    assert.deepEqual(result.errors, []);
    assert.equal(diagnostics.length, 1);
    assert.match(diagnostics[0].message, /Только базовая/u);
});

test("missing local library diagnoses every referenced material", async () => {
    const result = await loadMaterialReferenceCatalog({}, {
        taskLibraryService: {
            async loadMaterials() {
                return [];
            },
        },
    });
    const diagnostics = [];
    validateElementMaterialReferences([
        { model: 0, xapName: "Сталь" },
        { model: 2, xapName: "ВТСП" },
        { model: 0, xapName: "" },
    ], result.catalog, diagnostics);

    assert.deepEqual(diagnostics.map(item => item.row), [1, 2]);
    assert.equal(
        diagnostics.every(item =>
            item.message.includes("локальной библиотеке")
        ),
        true,
    );
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
