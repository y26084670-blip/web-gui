import assert from "node:assert/strict";
import test from "node:test";

import {
    createMaterialReferenceCatalog,
    loadMaterialReferenceCatalog,
    validateElementMaterialReferences,
} from "../src/services/materialReferenceValidation.js";
import {
    assignSelectedElementMaterial,
    selectedElementMaterialRequest,
} from "../src/tabulator/actions/elementMaterialActions.js";

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
        { model: 2, xapName: "ВТСП" },
        { model: 0, xapName: "ВТСП" },
    ], catalog, diagnostics);

    assert.equal(diagnostics.length, 3);
    assert.match(
        diagnostics[0].message,
        /найдена только в локальной библиотеке FMM/u,
    );
    assert.match(diagnostics[1].message, /не найдена в локальной библиотеке/u);
    assert.match(
        diagnostics[2].message,
        /найдена только в локальной библиотеке HTC.*model = 0 требует FMM/u,
    );
    assert.deepEqual(diagnostics.map(item => item.row), [2, 3, 6]);
});

test("the same material name in both libraries is valid for each model", () => {
    const catalog = createMaterialReferenceCatalog({
        FMM: [{ name: "Материал" }],
        HTC: [{ name: "Материал" }],
    });
    const diagnostics = [];
    validateElementMaterialReferences(
        [0, 1, 2].map(model => ({ model, xapName: "Материал" })),
        catalog,
        diagnostics,
    );
    assert.deepEqual(diagnostics, []);
});

test("a mixed material assignment is subsequently validated against each row's model", async () => {
    const catalog = createMaterialReferenceCatalog({
        FMM: [{ name: "Сталь" }],
        HTC: [{ name: "ВТСП" }],
    });
    for (const [models, name, expectedKind] of [
        [[0, 2], "Сталь", "HTC"],
        [[2, 0], "ВТСП", "FMM"],
    ]) {
        const records = models.map(model => ({ model }));
        const request = selectedElementMaterialRequest({
            _gui: {
                schema: { id: "elements" },
                model: {
                    async setRecordsValue(items, field, value) {
                        items.forEach(item => { item[field] = value; });
                    },
                },
            },
            getSelectedRows: () => records.map(data => ({ getData: () => data })),
        });
        await assignSelectedElementMaterial(request, name);
        const diagnostics = [];
        validateElementMaterialReferences(records, catalog, diagnostics);

        assert.deepEqual(records.map(item => item.model), models);
        assert.deepEqual(diagnostics.map(item => item.row), [2]);
        assert.match(diagnostics[0].message, new RegExp(`требует ${expectedKind}`, "u"));
    }
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
