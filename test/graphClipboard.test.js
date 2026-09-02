import assert from "node:assert/strict";
import test from "node:test";

import {
    copyGraphImage,
    copyGraphTables,
    createDetailTableBlock,
    createGeneratedDetailTableBlock,
    graphTablesToTsv,
} from "../src/services/graphs/graphClipboard.js";

const moveProperty = {
    label: "Положение",
    nColumns: 4,
    columns: [
        "Время, сек",
        "X0, мм",
        "Y0, мм",
        "Z0, мм",
    ],
};

test("graph table TSV reproduces detail titles, headers, and rows", () => {
    const first = createDetailTableBlock({
        title: "Положение — запись 2",
        property: moveProperty,
        rows: [
            [0, 1, 2, 3],
            [0.5, 4, 5, 6],
        ],
    });
    const second = createDetailTableBlock({
        title: "Положение — запись 5",
        property: moveProperty,
        rows: [[0, 7, 8, 9]],
    });

    assert.equal(
        graphTablesToTsv([first, second]),
        [
            "Положение — запись 2",
            "#\tВремя, сек\tX0, мм\tY0, мм\tZ0, мм",
            "1\t0\t1\t2\t3",
            "2\t0.5\t4\t5\t6",
            "",
            "Положение — запись 5",
            "#\tВремя, сек\tX0, мм\tY0, мм\tZ0, мм",
            "1\t0\t7\t8\t9",
        ].join("\n"),
    );
});
test("generator TSV keeps the source detail table shape", () => {
    const table = createGeneratedDetailTableBlock({
        title: "Положение — предпросмотр",
        property: moveProperty,
        points: [
            [0, 12],
            [0.5, 18],
        ],
        valueColumn: 2,
    });

    assert.deepEqual(table.rows, [
        [1, 0, "", 12, ""],
        [2, 0.5, "", 18, ""],
    ]);
    assert.equal(
        graphTablesToTsv([table]),
        [
            "Положение — предпросмотр",
            "#\tВремя, сек\tX0, мм\tY0, мм\tZ0, мм",
            "1\t0\t\t12\t",
            "2\t0.5\t\t18\t",
        ].join("\n"),
    );
});

test("table copy writes TSV to the system clipboard", async () => {
    const writes = [];
    const table = createDetailTableBlock({
        title: "Amplitude — запись 1",
        property: {
            label: "Amplitude",
            nColumns: 2,
            columns: ["Время, сек", "Амплитуда"],
        },
        rows: [[0, 1]],
    });

    await copyGraphTables([table], {
        clipboard: {
            writeText(text) {
                writes.push(text);
            },
        },
    });

    assert.equal(writes.length, 1);
    assert.match(writes[0], /#\tВремя, сек\tАмплитуда/u);
});

test("image copy creates a PNG with the visible graph background", async () => {
    const operations = [];
    const blob = { type: "image/png" };
    const context = {
        fillStyle: "",
        fillRect(...args) {
            operations.push(["fill", this.fillStyle, ...args]);
        },
        drawImage(...args) {
            operations.push(["draw", ...args]);
        },
    };
    const exportCanvas = {
        width: 0,
        height: 0,
        getContext: () => context,
        toBlob: callback => callback(blob),
    };
    const sourceCanvas = {
        width: 800,
        height: 400,
        ownerDocument: {
            createElement: name => {
                assert.equal(name, "canvas");
                return exportCanvas;
            },
        },
    };
    const writes = [];
    class TestClipboardItem {
        constructor(items) {
            this.items = items;
        }
    }

    await copyGraphImage(sourceCanvas, {
        background: "#20262d",
        clipboard: {
            write(items) {
                writes.push(items);
            },
        },
        ClipboardItemType: TestClipboardItem,
    });

    assert.deepEqual(operations[0], [
        "fill",
        "#20262d",
        0,
        0,
        800,
        400,
    ]);
    assert.deepEqual(operations[1], ["draw", sourceCanvas, 0, 0]);
    assert.equal(writes[0][0].items["image/png"], blob);
});
