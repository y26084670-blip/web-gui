import test from "node:test";
import assert from "node:assert/strict";

import {
    eoRange,
    isTargOrdered,
    kvLoopLimits,
    mhjLayout,
    mhjRowCount,
    mhjRows,
} from "../src/services/solver/mhjLayout.js";

function element(overrides = {}) {
    return {
        name: "element",
        targ: 0,
        dp: [[1], [1], [1]],
        symLs: 1,
        symAs: 1,
        symPs: 1,
        symKya: 1,
        symKyp: 1,
        ...overrides,
    };
}

test("loop limits apply symmetry enable flags", () => {
    assert.deepEqual(kvLoopLimits(element({
        dp: [[2], [3], [4]],
        symLs: 5,
        symAs: 6,
        symPs: 7,
        symKya: 0,
        symKyp: 0,
    })), {
        G1: 2,
        G2: 3,
        G3: 4,
        G6: 5,
        G4: 6,
        G5: 7,
    });
    assert.deepEqual(kvLoopLimits(element({
        symAs: 6,
        symPs: 7,
    })), {
        G1: 1,
        G2: 1,
        G3: 1,
        G6: 1,
        G4: 1,
        G5: 1,
    });
});

test("layout includes only independent-source elements", () => {
    const elements = [
        element({ name: "passive", dp: [[2], [1], [1]] }),
        element({
            name: "magnet",
            targ: 1,
            dp: [[1], [2], [1]],
            symLs: 2,
        }),
        element({
            name: "coil",
            targ: 2,
            symAs: 2,
            symPs: 2,
            symKya: 0,
            symKyp: 0,
        }),
    ];

    assert.deepEqual(mhjLayout(elements), {
        rows: 8,
        items: [
            { kvIndex: 1, name: "magnet", start: 0, count: 4 },
            { kvIndex: 2, name: "coil", start: 4, count: 4 },
        ],
    });
    assert.equal(mhjRowCount(elements), 8);
});

test("global EO numbers include every physically preceding element", () => {
    const elements = [
        element({ dp: [[2], [1], [1]] }),
        element({
            targ: 1,
            dp: [[1], [2], [1]],
            symLs: 2,
        }),
        element({
            targ: 2,
            symAs: 2,
            symPs: 2,
            symKya: 0,
            symKyp: 0,
        }),
    ];
    const rows = mhjRows(elements);

    assert.deepEqual(
        rows.slice(0, 4).map(row => row.eoLocal),
        [1, 2, 3, 4],
    );
    assert.deepEqual(
        rows.slice(0, 4).map(row => row.eoGlobal),
        [3, 4, 5, 6],
    );
    assert.deepEqual(
        rows.slice(4).map(row => row.eoGlobal),
        [7, 8, 9, 10],
    );
    assert.equal(eoRange(elements, 0), "1…2");
    assert.equal(eoRange(elements, 1), "3…6");
    assert.equal(eoRange(elements, 2), "7…10");
    assert.equal(eoRange(elements, -1), "");
});

test("MHJ nested order keeps PS as the fastest index", () => {
    const rows = mhjRows([
        element({
            targ: 1,
            symAs: 2,
            symPs: 2,
            symKya: 0,
            symKyp: 0,
        }),
    ]);

    assert.deepEqual(
        rows.map(row => [row.as, row.ps]),
        [[1, 1], [1, 2], [2, 1], [2, 2]],
    );
});

test("row limit stops traversal without changing numbering", () => {
    const elements = [
        element({ dp: [[2], [1], [1]] }),
        element({
            targ: 1,
            dp: [[1], [2], [1]],
            symLs: 2,
        }),
        element({
            targ: 2,
            symAs: 2,
            symPs: 2,
            symKya: 0,
            symKyp: 0,
        }),
    ];
    const rows = mhjRows(elements, { limit: 5 });

    assert.equal(rows.length, 5);
    assert.equal(rows[4].eoLocal, 1);
    assert.equal(rows[4].eoGlobal, 7);
    assert.deepEqual(mhjRows(elements, { limit: 0 }), []);
});

test("zero loop limit produces no rows and targ ordering is explicit", () => {
    const empty = [element({ targ: 1, dp: [[0], [1], [1]] })];

    assert.equal(mhjRowCount(empty), 0);
    assert.deepEqual(mhjRows(empty), []);
    assert.equal(isTargOrdered([
        element({ targ: 0 }),
        element({ targ: 1 }),
        element({ targ: 2 }),
    ]), true);
    assert.equal(isTargOrdered([
        element({ targ: 2 }),
        element({ targ: 1 }),
    ]), false);
});
