import assert from "node:assert/strict";
import test from "node:test";

import { HTC_PARAMETER_NAMES } from
    "../src/services/materials/materialConstants.js";
import {
    createHtcMaterialDetailSchema,
    decodeFmmTable,
} from "../src/services/materials/materialLibraryModel.js";

test("FMM detail projection has twelve H-M rows", () => {
    const storage = [
        ...Array.from({ length: 12 }, (_, index) => index),
        ...Array.from({ length: 12 }, (_, index) => 100 + index),
    ];
    const rows = decodeFmmTable(storage);

    assert.equal(rows.length, 12);
    assert.ok(rows.every(row => row.length === 2));
    assert.deepEqual(rows[4], [4, 104]);
});

test("HTC detail contract lists eighteen current scalar parameters", () => {
    assert.equal(HTC_PARAMETER_NAMES.length, 18);
    assert.deepEqual(
        HTC_PARAMETER_NAMES.slice(-3),
        ["KHabc", "Diag", "M3D"],
    );

    const detailSchema = createHtcMaterialDetailSchema({
        id: "htcLibrary",
        config: {},
        views: {},
        properties: Object.fromEntries(
            HTC_PARAMETER_NAMES.map(name => [name, {
                type: "float",
                label: name,
                readonly: true,
            }]),
        ),
    });
    assert.deepEqual(
        Object.keys(detailSchema.properties),
        HTC_PARAMETER_NAMES,
    );
    assert.ok(
        Object.values(detailSchema.properties)
            .every(property => property.readonly === false),
    );
    assert.deepEqual(
        detailSchema.views.recordsAsColumns.labels,
        ["Значение"],
    );
});
