import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { modelHistoryService } from "../src/services/modelHistoryService.js";

const schemaA = { id: "a" };
const schemaB = { id: "b" };

beforeEach(() => {
    modelHistoryService.clear();
});

test("Undo and Redo histories are independent by schema", () => {
    modelHistoryService.record(schemaA, { value: 1 }, { value: 2 });
    modelHistoryService.record(schemaB, { value: 10 }, { value: 11 });

    assert.equal(modelHistoryService.canUndo("a"), true);
    assert.equal(modelHistoryService.canUndo("b"), true);
    assert.deepEqual(modelHistoryService.takeUndo("a"), {
        schema: schemaA,
        value: { value: 1 },
    });
    assert.equal(modelHistoryService.canUndo("a"), false);
    assert.equal(modelHistoryService.canUndo("b"), true);
    assert.equal(modelHistoryService.canRedo("a"), true);
    assert.deepEqual(modelHistoryService.takeRedo("a"), {
        schema: schemaA,
        value: { value: 2 },
    });
});

test("new edit clears the Redo branch", () => {
    modelHistoryService.record(schemaA, 0, 1);
    modelHistoryService.takeUndo("a");
    assert.equal(modelHistoryService.canRedo("a"), true);

    modelHistoryService.record(schemaA, 0, 2);
    assert.equal(modelHistoryService.canRedo("a"), false);
    assert.deepEqual(modelHistoryService.takeUndo("a"), {
        schema: schemaA,
        value: 0,
    });
});

test("transaction joins sequential changes of one schema", () => {
    modelHistoryService.beginTransaction();
    modelHistoryService.record(schemaA, { value: 0 }, { value: 1 });
    modelHistoryService.record(schemaA, { value: 1 }, { value: 2 });
    modelHistoryService.endTransaction();

    assert.deepEqual(modelHistoryService.takeUndo("a"), {
        schema: schemaA,
        value: { value: 0 },
    });
    assert.equal(modelHistoryService.canUndo("a"), false);
    assert.deepEqual(modelHistoryService.takeRedo("a"), {
        schema: schemaA,
        value: { value: 2 },
    });
});

test("history stores defensive snapshots", () => {
    const before = { values: [1] };
    const after = { values: [2] };

    modelHistoryService.record(schemaA, before, after);
    before.values[0] = 10;
    after.values[0] = 20;

    assert.deepEqual(modelHistoryService.takeUndo("a").value, {
        values: [1],
    });
    assert.deepEqual(modelHistoryService.takeRedo("a").value, {
        values: [2],
    });
});

test("history keeps at most 100 actions per schema", () => {
    for (let value = 0; value < 101; value++) {
        modelHistoryService.record(schemaA, value, value + 1);
    }

    let earliestRetained = null;
    for (let index = 0; index < 100; index++) {
        earliestRetained = modelHistoryService.takeUndo("a");
    }

    assert.equal(earliestRetained.value, 1);
    assert.equal(modelHistoryService.canUndo("a"), false);
});
