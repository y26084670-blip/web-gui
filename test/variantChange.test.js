import test from "node:test";
import assert from "node:assert/strict";

import { applyVariantChange } from "../src/services/model/variantChange.js";

function variantProperty() {
    return {
        variantCodec: {
            dependencies: ["geoType"],
            onDependencyChange: ({ value, newValue }) => [
                newValue,
                ...value.slice(1),
            ],
        },
    };
}

test("unrelated or unchanged dependency preserves model identity", () => {
    const schema = {
        config: { storage: "cluster" },
        properties: { geo: variantProperty() },
    };
    const model = { geoType: 0, geo: [10, 20] };

    assert.deepEqual(
        applyVariantChange(schema, model, {
            propertyName: "other",
            oldValue: 0,
            newValue: 1,
        }),
        { model, changed: false, refresh: false },
    );
    assert.deepEqual(
        applyVariantChange(schema, model, {
            propertyName: "geoType",
            oldValue: 0,
            newValue: 0,
        }),
        { model, changed: false, refresh: false },
    );
});

test("CLUSTER dependency reaction clones and updates affected value", () => {
    const schema = {
        config: { storage: "cluster" },
        properties: { geo: variantProperty() },
    };
    const model = { geoType: 0, geo: [10, 20] };

    const result = applyVariantChange(schema, model, {
        propertyName: "geoType",
        oldValue: 0,
        newValue: 3,
    });

    assert.equal(result.changed, true);
    assert.equal(result.refresh, true);
    assert.notEqual(result.model, model);
    assert.deepEqual(result.model.geo, [3, 20]);
    assert.deepEqual(model.geo, [10, 20]);
});

test("RECORDS dependency reaction changes only selected record", () => {
    const schema = {
        config: { storage: "records" },
        properties: { geo: variantProperty() },
    };
    const model = [
        { geoType: 0, geo: [10, 20] },
        { geoType: 0, geo: [30, 40] },
    ];

    const result = applyVariantChange(schema, model, {
        propertyName: "geoType",
        recordIndex: 1,
        oldValue: 0,
        newValue: 2,
    });

    assert.deepEqual(result.model, [
        { geoType: 0, geo: [10, 20] },
        { geoType: 0, geo: [2, 40] },
    ]);
    assert.deepEqual(model[1].geo, [30, 40]);
});

test("missing RECORDS target does not create a model change", () => {
    const schema = {
        config: { storage: "records" },
        properties: { geo: variantProperty() },
    };
    const model = [];

    assert.deepEqual(
        applyVariantChange(schema, model, {
            propertyName: "geoType",
            recordIndex: 5,
            oldValue: 0,
            newValue: 1,
        }),
        { model, changed: false, refresh: false },
    );
});
