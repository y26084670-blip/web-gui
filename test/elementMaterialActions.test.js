import assert from "node:assert/strict";
import test from "node:test";

import {
    assignSelectedElementMaterial,
    selectedElementMaterialRequest,
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

test("HTC elements use the HTC library and mixed selections are rejected", () => {
    assert.equal(
        selectedElementMaterialRequest(tableFor([{ model: 2 }]).table).kind,
        "HTC",
    );
    assert.throws(
        () => selectedElementMaterialRequest(
            tableFor([{ model: 0 }, { model: 2 }]).table,
        ),
        /разным видам характеристик/,
    );
});
