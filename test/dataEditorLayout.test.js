import assert from "node:assert/strict";
import test from "node:test";

import {
    DATA_EDITOR_SPLIT_LIMITS,
    resizedEditorTableRatio,
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
