import assert from "node:assert/strict";
import test from "node:test";

import {
    resizedDetailRatio,
    resizedLowerHeight,
} from "../src/services/materials/materialLibraryLayout.js";

test("horizontal material splitter keeps both regions usable", () => {
    assert.equal(resizedLowerHeight({
        startHeight: 300,
        deltaY: -80,
        availableHeight: 700,
    }), 380);
    assert.equal(resizedLowerHeight({
        startHeight: 300,
        deltaY: 500,
        availableHeight: 700,
    }), 180);
    assert.equal(resizedLowerHeight({
        startHeight: 300,
        deltaY: -500,
        availableHeight: 700,
    }), 514);
});

test("vertical material splitter preserves detail and graph minimum widths", () => {
    assert.equal(resizedDetailRatio({
        pointerX: 500,
        containerLeft: 100,
        containerWidth: 806,
    }), 0.5);
    assert.equal(resizedDetailRatio({
        pointerX: 100,
        containerLeft: 100,
        containerWidth: 806,
    }), 0.35);
    assert.equal(resizedDetailRatio({
        pointerX: 906,
        containerLeft: 100,
        containerWidth: 806,
    }), 0.65);
});
