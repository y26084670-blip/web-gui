import assert from "node:assert/strict";
import test from "node:test";

import {
    amplitudeReferenceRows,
    amplitudeReferenceSummary,
    measurementCoilRows,
    measurementCoilSummary,
    moveReferenceRows,
    moveReferenceSummary,
} from "../src/services/references/modelReferenceViews.js";

const elements = [
    { name: "Источник", targ: 1, indAmp: 1, indMove: 2, indCoil: 0 },
    { name: "Виртуальная катушка", targ: 3, indAmp: 2, indMove: 2, indCoil: 4, wCoil: 20 },
];
const regions = [
    { name: "TK 1", indMove: 2, indCoil: 4, wCoil: 0.5 },
];

test("amplitude and move references use one-based record indices", () => {
    const ampRows = amplitudeReferenceRows({ models: { elements }, recordIndex: 0 });
    assert.deepEqual(ampRows, [[1, "Источник"]]);
    assert.equal(amplitudeReferenceSummary({ value: ampRows }), "1");

    const moveRows = moveReferenceRows({
        models: { elements, regions },
        recordIndex: 1,
    });
    assert.deepEqual(moveRows, [
        ["KV", 1, "Источник"],
        ["KV", 2, "Виртуальная катушка"],
        ["TK", 1, "TK 1"],
    ]);
    assert.equal(moveReferenceSummary({ value: moveRows }), "KV: 1, 2; TK: 1");
});

test("measurement coil summary combines KV and TK bindings", () => {
    const rows = measurementCoilRows({ models: { elements, regions } });
    assert.deepEqual(rows, [
        [4, "KV", 2, "Виртуальная катушка", 20, "D2"],
        [4, "TK", 1, "TK 1", 0.5, "—"],
    ]);
    assert.equal(measurementCoilSummary({ value: rows }), "4 (KV: 1, TK: 1)");
});
