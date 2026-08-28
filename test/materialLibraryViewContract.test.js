import assert from "node:assert/strict";
import test from "node:test";

import { HTC_PARAMETER_NAMES } from
    "../src/services/materials/materialConstants.js";
import {
    decodeFmmTable,
    htcParameterEntries,
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

    const record = Object.fromEntries(
        HTC_PARAMETER_NAMES.map((name, index) => [name, index]),
    );
    const entries = htcParameterEntries({
        name: "ВТСП",
        ...record,
        comment: "Комментарий",
    });

    assert.deepEqual(
        entries.map(([name]) => name),
        HTC_PARAMETER_NAMES,
    );
});
