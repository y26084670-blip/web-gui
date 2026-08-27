import test from "node:test";
import assert from "node:assert/strict";

import {
    isComputedProperty,
    isPropertyReadonly,
    isStoredProperty,
    recomputeModel,
    validateComputationSchema,
} from "../src/services/model/modelCompute.js";

function computed(evaluate, dependencies, extra = {}) {
    return {
        type: "integer",
        default: 0,
        compute: {
            dependencies,
            evaluate,
            ...extra,
        },
    };
}

test("computed property classification distinguishes storage contract", () => {
    const plain = { readonly: true };
    const transient = computed(() => 1, ["source"]);
    const stored = {
        computeStored: {
            dependencies: ["source"],
            evaluate: () => 1,
        },
    };

    assert.equal(isComputedProperty(plain), false);
    assert.equal(isComputedProperty(transient), true);
    assert.equal(isStoredProperty(transient), false);
    assert.equal(isStoredProperty(stored), true);
    assert.equal(isPropertyReadonly(plain), true);
    assert.equal(isPropertyReadonly(transient), true);
});

test("CLUSTER computation follows dependency order and returns patches", () => {
    const schema = {
        id: "chain",
        config: { storage: "cluster" },
        properties: {
            source: { type: "integer", default: 0 },
            doubled: computed(
                ({ values }) => values.source * 2,
                ["source"],
            ),
            result: computed(
                ({ values }) => values.doubled + 1,
                ["doubled"],
            ),
        },
    };
    const original = { source: 3, doubled: 0, result: 0 };

    const updated = recomputeModel(schema, original);

    assert.equal(updated.changed, true);
    assert.notEqual(updated.model, original);
    assert.deepEqual(updated.model, {
        source: 3,
        doubled: 6,
        result: 7,
    });
    assert.deepEqual(updated.patches, [
        { recordIndex: null, propertyName: "doubled", value: 6 },
        { recordIndex: null, propertyName: "result", value: 7 },
    ]);
    assert.deepEqual(original, { source: 3, doubled: 0, result: 0 });

    const unchanged = recomputeModel(schema, updated.model);
    assert.equal(unchanged.changed, false);
    assert.equal(unchanged.model, updated.model);
    assert.deepEqual(unchanged.patches, []);
});

test("RECORDS scope receives an immutable collection snapshot", () => {
    const frozenStates = [];
    const schema = {
        id: "records-scope",
        config: { storage: "records" },
        properties: {
            value: { type: "integer", default: 0 },
            prefix: computed(
                ({ records, recordIndex }) => {
                    frozenStates.push(
                        Object.isFrozen(records) &&
                        Object.isFrozen(records[0]),
                    );
                    return records
                        .slice(0, recordIndex)
                        .reduce((sum, record) => sum + record.value, 0);
                },
                ["value"],
                { scope: "records" },
            ),
        },
    };
    const original = [
        { value: 2, prefix: -1 },
        { value: 3, prefix: -1 },
        { value: 5, prefix: -1 },
    ];

    const result = recomputeModel(schema, original);

    assert.deepEqual(result.model.map(record => record.prefix), [0, 2, 5]);
    assert.deepEqual(frozenStates, [true, true, true]);
    assert.deepEqual(original.map(record => record.prefix), [-1, -1, -1]);
});

test("schema validation rejects cycles and invalid records scope", () => {
    const cyclic = {
        id: "cyclic",
        config: { storage: "cluster" },
        properties: {
            left: computed(({ values }) => values.right, ["right"]),
            right: computed(({ values }) => values.left, ["left"]),
        },
    };
    assert.throws(
        () => validateComputationSchema(cyclic),
        /computation cycle/,
    );

    const invalidScope = {
        id: "invalid-scope",
        config: { storage: "cluster" },
        properties: {
            source: { type: "integer", default: 0 },
            result: computed(
                () => 1,
                ["source"],
                { scope: "records" },
            ),
        },
    };
    assert.throws(
        () => validateComputationSchema(invalidScope),
        /scope 'records' requires RECORDS storage/,
    );
});

test("evaluation must be synchronous and return a defined value", () => {
    const schemaFor = evaluate => ({
        id: "evaluate-contract",
        config: { storage: "cluster" },
        properties: {
            source: { type: "integer", default: 0 },
            result: computed(evaluate, ["source"]),
        },
    });

    assert.throws(
        () => recomputeModel(
            schemaFor(() => Promise.resolve(1)),
            { source: 1, result: 0 },
        ),
        /evaluate must be synchronous/,
    );
    assert.throws(
        () => recomputeModel(
            schemaFor(() => undefined),
            { source: 1, result: 0 },
        ),
        /evaluate returned undefined/,
    );
});
