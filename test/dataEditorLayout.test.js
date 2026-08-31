import assert from "node:assert/strict";
import test from "node:test";

import {
    DATA_EDITOR_SPLIT_LIMITS,
    resizedEditorTableRatio,
    resizedGeneratorGraphRatio,
    TIME_GENERATOR_SPLIT_LIMITS,
} from "../src/services/dataEditorLayout.js";

test("editor splitter preserves table and generator minimum widths", () => {
    const containerWidth = 1200;
    const contentWidth = containerWidth - DATA_EDITOR_SPLIT_LIMITS.splitterSize;

    assert.equal(
        resizedEditorTableRatio({
            pointerX: 100,
            containerLeft: 0,
            containerWidth,
        }),
        DATA_EDITOR_SPLIT_LIMITS.tableWidth / contentWidth,
    );
    assert.equal(
        resizedEditorTableRatio({
            pointerX: 1150,
            containerLeft: 0,
            containerWidth,
        }),
        (contentWidth - DATA_EDITOR_SPLIT_LIMITS.generatorWidth) / contentWidth,
    );
});

test("editor splitter uses the pointer position inside valid limits", () => {
    const ratio = resizedEditorTableRatio({
        pointerX: 700,
        containerLeft: 100,
        containerWidth: 1000,
    });

    assert.equal(ratio, 600 / 994);
});


test("generator splitter preserves graph and workspace minimum heights", () => {
    const containerHeight = 800;
    const contentHeight =
        containerHeight - TIME_GENERATOR_SPLIT_LIMITS.splitterSize;

    assert.equal(
        resizedGeneratorGraphRatio({
            pointerY: 10,
            containerTop: 0,
            containerHeight,
        }),
        TIME_GENERATOR_SPLIT_LIMITS.graphHeight / contentHeight,
    );
    assert.equal(
        resizedGeneratorGraphRatio({
            pointerY: 790,
            containerTop: 0,
            containerHeight,
        }),
        (contentHeight - TIME_GENERATOR_SPLIT_LIMITS.workspaceHeight) /
            contentHeight,
    );
});

test("generator splitter uses the pointer position inside valid limits", () => {
    const ratio = resizedGeneratorGraphRatio({
        pointerY: 350,
        containerTop: 50,
        containerHeight: 700,
    });

    assert.equal(ratio, 300 / 694);
});
