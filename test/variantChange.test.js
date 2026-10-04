import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

import { applyVariantChange } from "../src/services/model/variantChange.js";
import { resetKvGeo, unpackKvVertices, validateKvVertices } from "../src/services/solver/geometryKv.js";

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: "custom" });
after(() => server.close());
const { default: elementSchema } = await server.ssrLoadModule("/src/services/schemas/elements.schema.js");
const { dataService } = await server.ssrLoadModule("/src/services/dataService.js");
const { serialize, deserialize } = await server.ssrLoadModule("/src/services/model/modelSerializer.js");
const { modelService } = await server.ssrLoadModule("/src/services/modelService.js");

function exampleRecord(type = 0) {
    const record = dataService.createDefaultRecord(elementSchema);
    record.geoType = type;
    const values = resetKvGeo(type);
    record.geo = Array.from({ length: 8 }, (_, index) => values.slice(index * 3, index * 3 + 3));
    return record;
}

function assertValidGeometry(record) {
    assert.equal(record.geo.length, 8);
    assert.ok(record.geo.every(row => row.length === 3));
    const { vertices, err } = unpackKvVertices(record.geo.flat(), record.geoType);
    assert.equal(err, 0);
    assert.equal(validateKvVertices(vertices), true);
}

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

test("new element has an independent valid geometry and geometry type immediately follows geometry", () => {
    const first = dataService.createDefaultRecord(elementSchema);
    const second = dataService.createDefaultRecord(elementSchema);
    assert.deepEqual(Object.keys(elementSchema.properties).slice(0, 4), ["name", "geo", "geoType", "dr"]);
    assert.equal(first.geoType, 0);
    assert.ok(first.geo.flat().every(value => value !== 0));
    assertValidGeometry(first);
    const original = structuredClone(second.geo);
    first.geo[0][0] += 100;
    assert.deepEqual(second.geo, original);
    assert.deepEqual(dataService.createDefaultRecord(elementSchema).geo, original);
});

test("all KV type transitions replace only the target geometry and retain the storage format", () => {
    for (let from = 0; from <= 4; from++) {
        for (let to = 0; to <= 4; to++) {
            if (from === to) continue;
            const model = [exampleRecord(), { ...exampleRecord(from), name: "Свой элемент", dr: [[5], [6], [7]], geoType: to }];
            const before = structuredClone(model);
            const result = applyVariantChange(elementSchema, model, {
                propertyName: "geoType", recordIndex: 1, oldValue: from, newValue: to,
            });
            assert.equal(result.changed, true);
            assertValidGeometry(result.model[1]);
            assert.notDeepEqual(result.model[1].geo, before[1].geo);
            assert.deepEqual(result.model[0], before[0]);
            assert.deepEqual({ ...result.model[1], geo: null }, { ...before[1], geo: null });
            assert.deepEqual(model, before);

            const stored = serialize(result.model, elementSchema);
            assert.equal(stored[1].geo.length, 24);
            assert.ok(stored[1].geo.every(Number.isFinite));
            const restored = deserialize(stored, elementSchema);
            assert.equal(restored[1].geoType, to);
            assert.deepEqual(restored[1].geo, result.model[1].geo);
        }
    }
});

test("unchanged or unknown KV type preserves manually entered geometry", () => {
    const model = [exampleRecord()];
    model[0].geo = model[0].geo.map(row => row.map(value => value + 2));
    for (const to of [0, 99, "2", null]) {
        const result = applyVariantChange(elementSchema, model, {
            propertyName: "geoType", recordIndex: 0, oldValue: 0, newValue: to,
        });
        assert.equal(result.changed, false);
        assert.equal(result.model, model);
    }
});

test("loading explicit geometry preserves user values, including zero or invalid geometry", () => {
    for (const type of [0, 1, 2, 3, 4]) {
        for (const geo of [resetKvGeo(type).map(value => value * 1.1), new Array(24).fill(0)]) {
            const stored = serialize([exampleRecord(type)], elementSchema);
            stored[0].geo = geo;
            const record = deserialize(stored, elementSchema)[0];
            assert.equal(record.geoType, type);
            assert.deepEqual(record.geo.flat(), geo);
        }
    }
});

test("Undo and Redo restore geometry together with its type in one edit", () => {
    modelService.clearModel();
    const initial = [exampleRecord()];
    initial[0].geo = initial[0].geo.map(row => row.map(value => value + 7));
    modelService.setModelPart(elementSchema, initial);
    const original = structuredClone(modelService.getModel().elements);
    const edited = structuredClone(original);
    edited[0].geoType = 1;
    const changed = applyVariantChange(elementSchema, edited, {
        propertyName: "geoType", recordIndex: 0, oldValue: 0, newValue: 1,
    });
    modelService.setModelPart(elementSchema, changed.model, { recordHistory: true });
    const afterChange = structuredClone(modelService.getModel().elements);
    assertValidGeometry(afterChange[0]);
    assert.equal(modelService.undo("elements"), true);
    assert.deepEqual(modelService.getModel().elements, original);
    assert.equal(modelService.canUndo("elements"), false);
    assert.equal(modelService.redo("elements"), true);
    assert.deepEqual(modelService.getModel().elements, afterChange);
    modelService.clearModel();
});
