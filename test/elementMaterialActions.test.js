import assert from "node:assert/strict";
import test from "node:test";

import {
    assignSelectedElementMaterial,
    clearSelectedElementMaterials,
    selectedElementMaterialRequest,
    selectedElementsRequest,
} from "../src/tabulator/actions/elementMaterialActions.js";

function row(data) {
    return { getData: () => data };
}

function tableFor(records) {
    const rows = records.map(row);
    const calls = [];
    return {
        calls,
        table: {
            _gui: {
                schema: { id: "elements" },
                model: {
                    async setRecordsValue(items, field, value) {
                        calls.push({ items, field, value });
                        items.forEach(item => { item[field] = value; });
                    },
                },
            },
            getSelectedRows: () => rows,
        },
    };
}

test("one FMM name is assigned to every selected element in one model call", async () => {
    const records = [{ model: 0 }, { model: 1 }];
    const { table, calls } = tableFor(records);
    const request = selectedElementMaterialRequest(table);

    assert.equal(request.kind, "FMM");
    assert.equal(request.count, 2);
    await assignSelectedElementMaterial(request, "Сталь 3");

    assert.equal(calls.length, 1);
    assert.equal(calls[0].field, "xapName");
    assert.equal(calls[0].value, "Сталь 3");
    assert.deepEqual(records.map(item => item.xapName), ["Сталь 3", "Сталь 3"]);
});

test("mixed selections use the first selected row and assign every row without changing models", async () => {
    for (const [models, kind] of [
        [[0, 2], "FMM"],
        [[2, 0], "HTC"],
        [[1, 2], "FMM"],
    ]) {
        const records = models.map((model, index) => ({
            num: 20 - index,
            model,
            xapName: "Прежняя характеристика",
        }));
        const { table, calls } = tableFor(records);
        const request = selectedElementMaterialRequest(table);

        assert.equal(request.kind, kind);
        assert.equal(request.count, records.length);
        assert.deepEqual(request.rows.map(item => item.getData()), records);
        assert.equal(await assignSelectedElementMaterial(request, "Материал"), 2);
        assert.deepEqual(calls, [{
            items: records,
            field: "xapName",
            value: "Материал",
        }]);
        assert.deepEqual(records.map(item => item.xapName), ["Материал", "Материал"]);
        assert.deepEqual(records.map(item => item.model), models);
    }
});

test("material selection preserves the element table and nonempty selection guards", () => {
    assert.throws(
        () => selectedElementMaterialRequest(tableFor([]).table),
        /Выберите хотя бы один элемент модели/u,
    );
    const { table } = tableFor([{ model: 0 }]);
    table._gui.schema.id = "nodes";
    assert.throws(
        () => selectedElementMaterialRequest(table),
        /доступно только для элементов модели/u,
    );
});

test("mixed selected elements can be made nonmagnetic in one model call", async () => {
    const records = [
        { model: 0, xapName: "Сталь" },
        { model: 2, xapName: "ВТСП" },
    ];
    const { table, calls } = tableFor(records);
    const request = selectedElementsRequest(table);

    await clearSelectedElementMaterials(request);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].field, "xapName");
    assert.equal(calls[0].value, "");
    assert.deepEqual(records.map(item => item.xapName), ["", ""]);
});
