import test from "node:test";
import assert from "node:assert/strict";

import {
    deserialize,
    findUnknownStoragePaths,
    getStorageValue,
    hasStorageValue,
    propertyStoragePath,
    serialize,
} from "../src/services/model/modelSerializer.js";

function clusterSchema() {
    return {
        id: "fixture",
        config: { storage: "cluster" },
        properties: {
            kya: {
                type: "integer",
                storageKey: "sym.kya",
                default: 0,
            },
            matrix: {
                type: "array",
                nColumns: 2,
                default: [],
            },
            computed: {
                type: "integer",
                default: 7,
                compute: {
                    dependencies: ["kya"],
                    evaluate: ({ values }) => values.kya + 1,
                },
            },
            storedCount: {
                type: "integer",
                storageKey: "meta.count",
                default: 0,
                computeStored: {
                    dependencies: ["matrix"],
                    evaluate: ({ values }) => values.matrix.length,
                },
            },
            missing: {
                type: "string",
                default: "default-value",
            },
        },
    };
}

test("CLUSTER deserialize applies storage paths, defaults and ARRAY shape", () => {
    const storage = {
        sym: { kya: -1 },
        matrix: [1, 2, 3, 4, 5, 6],
        meta: { count: 3 },
        unknown: true,
    };

    const model = deserialize(storage, clusterSchema());

    assert.deepEqual(model, {
        kya: -1,
        matrix: [
            [1, 4],
            [2, 5],
            [3, 6],
        ],
        computed: 7,
        storedCount: 3,
        missing: "default-value",
    });

    model.matrix[0][0] = 99;
    assert.equal(storage.matrix[0], 1);
});

test("CLUSTER serialize excludes compute and preserves computeStored", () => {
    const model = {
        kya: 2,
        matrix: [
            [1, 4],
            [2, 5],
            [3, 6],
        ],
        computed: 100,
        storedCount: 3,
        missing: "value",
    };

    assert.deepEqual(serialize(model, clusterSchema()), {
        sym: { kya: 2 },
        matrix: [1, 2, 3, 4, 5, 6],
        meta: { count: 3 },
        missing: "value",
    });
});

test("legacy htcFlatten field is dropped during CLUSTER round-trip", () => {
    const storage = {
        sym: { kya: -1 },
        matrix: [],
        meta: { count: 0 },
        missing: "value",
        htcFlatten: true,
    };

    const model = deserialize(storage, clusterSchema());

    assert.equal(Object.hasOwn(model, "htcFlatten"), false);
    assert.equal(
        Object.hasOwn(serialize(model, clusterSchema()), "htcFlatten"),
        false,
    );
});

test("legacy Conrab fields are dropped from both RECORDS profiles", () => {
    const legacyFields = {
        EPS_J: 0.001,
        EPS_M: 0.002,
        EPS_Z: 0.003,
        TAU_J: 0.1,
        TAU_Z: 0.2,
        TAU_M: 0.3,
        SCALE_0: 1,
        HIP_MIN: 0.0001,
    };
    const schema = {
        id: "conrab-fixture",
        config: { storage: "records" },
        properties: {
            EPS: { type: "float", default: 0.005 },
        },
    };
    const storage = [
        { EPS: 0.001, ...legacyFields },
        { EPS: 0.0005, ...legacyFields },
    ];

    const model = deserialize(storage, schema);
    const serialized = serialize(model, schema);

    for (const record of [...model, ...serialized]) {
        for (const key of Object.keys(legacyFields)) {
            assert.equal(Object.hasOwn(record, key), false);
        }
    }

    assert.deepEqual(serialized, [
        { EPS: 0.001 },
        { EPS: 0.0005 },
    ]);
});

test("legacy element xapType is ignored and dropped during round-trip", () => {
    const schema = {
        id: "elements-fixture",
        config: { storage: "records" },
        properties: {
            name: { type: "string", default: "" },
            xapName: { type: "string", default: "" },
        },
    };
    const storage = [{
        name: "KV",
        xapName: "Steel",
        xapType: 2,
        unexpected: true,
    }];

    const model = deserialize(storage, schema);

    assert.deepEqual(model, [{ name: "KV", xapName: "Steel" }]);
    assert.deepEqual(serialize(model, schema), [
        { name: "KV", xapName: "Steel" },
    ]);
    assert.deepEqual(
        findUnknownStoragePaths(
            storage[0],
            ["name", "xapName"],
            ["xapType"],
        ),
        ["unexpected"],
    );
});

test("RECORDS serialization applies the same contract to each record", () => {
    const schema = {
        id: "records",
        config: { storage: "records" },
        properties: {
            value: { type: "integer", default: 0 },
        },
    };
    const storage = [{ value: 1 }, { value: 2 }];

    assert.deepEqual(deserialize(storage, schema), storage);
    assert.deepEqual(serialize(storage, schema), storage);
});

test("storage path helpers distinguish missing and present undefined", () => {
    const storage = {
        nested: {
            present: undefined,
            object: { value: 3 },
            extra: 4,
        },
        other: 5,
    };

    assert.equal(propertyStoragePath("value", {}), "value");
    assert.equal(
        propertyStoragePath("value", { storageKey: "nested.object" }),
        "nested.object",
    );
    assert.equal(hasStorageValue(storage, "nested.present"), true);
    assert.equal(hasStorageValue(storage, "nested.missing"), false);
    assert.equal(getStorageValue(storage, "nested.object.value"), 3);
    assert.deepEqual(
        findUnknownStoragePaths(storage, [
            "nested.present",
            "nested.object.value",
        ]),
        ["nested.extra", "other"],
    );
});

test("unknown storage type fails explicitly", () => {
    const schema = {
        id: "invalid",
        config: { storage: "stream" },
        properties: {},
    };

    assert.throws(
        () => deserialize({}, schema),
        /Неизвестный тип хранения 'stream'/,
    );
    assert.throws(
        () => serialize({}, schema),
        /Неизвестный тип хранения 'stream'/,
    );
});
