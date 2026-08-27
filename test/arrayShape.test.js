import test from "node:test";
import assert from "node:assert/strict";

import {
    ARRAY_ORDERS,
    cellsToValues,
    columnCount,
    columnKey,
    fromColumnMajor,
    fromRowMajor,
    fromStorage,
    hasMatrixShape,
    isArrayOrder,
    toColumnMajor,
    toRowMajor,
    toStorage,
    valuesToCells,
} from "../src/services/model/arrayShape.js";

test("ARRAY descriptor defaults and order validation", () => {
    assert.equal(hasMatrixShape({}), false);
    assert.equal(hasMatrixShape({ nColumns: 3 }), true);
    assert.equal(columnCount({}), 1);
    assert.equal(columnCount({ nColumns: 3 }), 3);
    assert.equal(isArrayOrder(undefined), true);
    assert.equal(isArrayOrder(ARRAY_ORDERS.COLUMN), true);
    assert.equal(isArrayOrder(ARRAY_ORDERS.ROW), true);
    assert.equal(isArrayOrder("diagonal"), false);
});

test("column-major StorageModel round-trip preserves row values", () => {
    const flat = [1, 2, 3, 4, 5, 6];
    const rows = [
        [1, 4],
        [2, 5],
        [3, 6],
    ];

    assert.deepEqual(fromColumnMajor(flat, 2), rows);
    assert.deepEqual(toColumnMajor(rows, 2), flat);
    assert.deepEqual(fromStorage(flat, { nColumns: 2 }), rows);
    assert.deepEqual(toStorage(rows, { nColumns: 2 }), flat);
});

test("column-major incomplete storage is padded with null", () => {
    assert.deepEqual(
        fromColumnMajor([1, 2, 3, 4, 5], 2),
        [
            [1, 4],
            [2, 5],
            [3, null],
        ],
    );
});

test("row-major StorageModel round-trip preserves sequential groups", () => {
    const flat = [1, 2, 3, 4, 5, 6];
    const rows = [
        [1, 2, 3],
        [4, 5, 6],
    ];
    const property = {
        nColumns: 3,
        order: ARRAY_ORDERS.ROW,
    };

    assert.deepEqual(fromRowMajor(flat, 3), rows);
    assert.deepEqual(toRowMajor(rows, 3), flat);
    assert.deepEqual(fromStorage(flat, property), rows);
    assert.deepEqual(toStorage(rows, property), flat);
});

test("ViewModel cell conversion is descriptor-driven", () => {
    assert.equal(columnKey(2), "c2");
    assert.deepEqual(
        valuesToCells([10, 20, 30]),
        { c0: 10, c1: 20, c2: 30 },
    );
    assert.deepEqual(
        cellsToValues({ c0: 10, c2: 30, computed: 99 }, 3),
        [10, null, 30],
    );
});

test("unsupported ARRAY order fails explicitly", () => {
    assert.throws(
        () => fromStorage([], { nColumns: 2, order: "diagonal" }),
        /Unsupported ARRAY order 'diagonal'/,
    );
});
