import assert from "node:assert/strict";
import test from "node:test";

import { groupDiagnostics } from "../src/components/diagnostics/diagnosticGrouping.js";
import {
    TABS,
    VALIDATION_LEVELS,
} from "../src/services/schemas/common/constants.js";

function recordDiagnostic({
    tab = TABS.ELEMENTS,
    row,
    message = "Одинаковая ошибка",
    level = VALIDATION_LEVELS.ERROR,
    property = "LAS",
}) {
    return { tab, row, message, level, property };
}

test("identical element diagnostics are grouped into a sorted row list", () => {
    const diagnostics = [
        recordDiagnostic({ row: 3 }),
        recordDiagnostic({ row: 1 }),
        recordDiagnostic({ row: 2 }),
        recordDiagnostic({ row: 2 }),
    ];

    const grouped = groupDiagnostics(diagnostics);

    assert.equal(grouped.length, 1);
    assert.deepEqual(grouped[0].rows, [1, 2, 3]);
    assert.equal(grouped[0].row, undefined);
    assert.equal(grouped[0].message, "Одинаковая ошибка");
});

test("diagnostics with different context stay in separate groups", () => {
    const diagnostics = [
        recordDiagnostic({ row: 1 }),
        recordDiagnostic({ row: 2, property: "YLV" }),
        recordDiagnostic({ row: 3, message: "Другая ошибка" }),
        recordDiagnostic({
            row: 4,
            level: VALIDATION_LEVELS.WARNING,
        }),
        recordDiagnostic({ tab: TABS.REGIONS, row: 5 }),
    ];

    const grouped = groupDiagnostics(diagnostics);

    assert.equal(grouped.length, 5);
    assert.deepEqual(grouped.map(item => item.rows), [[1], [2], [3], [4], [5]]);
});

test("rowless and non-element diagnostics are not merged", () => {
    const diagnostics = [
        recordDiagnostic({ row: undefined }),
        recordDiagnostic({ row: undefined }),
        recordDiagnostic({ tab: TABS.AMPS, row: 1 }),
        recordDiagnostic({ tab: TABS.AMPS, row: 2 }),
    ];

    const grouped = groupDiagnostics(diagnostics);

    assert.equal(grouped.length, diagnostics.length);
    assert.deepEqual(grouped.map(item => item.rows), [[], [], [1], [2]]);
});
