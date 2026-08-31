import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
    materializeReferenceViewRows,
    referenceViewDependencies,
    referenceViewValues,
} from "../src/services/referenceViewService.js";

function descriptor(label, dependencies, rows, nColumns = 1) {
    return {
        label,
        dependencies,
        rows,
        nColumns,
    };
}

test("record reference views materialize without changing source rows", () => {
    const schema = {
        id: "target",
        config: { storage: "records" },
        views: {
            references: {
                links: descriptor(
                    "Ссылки",
                    ["source"],
                    ({ models, recordIndex }) => [[
                        `${models.source[0].name}:${recordIndex}`,
                    ]],
                ),
            },
        },
    };
    const baseModel = [{ value: 1 }, { value: 2 }];
    const rows = [{ rowLabel: 1, value: 1 }, { rowLabel: 2, value: 2 }];
    const snapshot = { source: [{ name: "A" }] };
    const result = materializeReferenceViewRows({
        schema,
        rows,
        baseModel,
        modelSnapshot: snapshot,
    });

    assert.deepEqual(result.map(row => row.links), [[['A:0']], [['A:1']]]);
    assert.equal(rows[0].links, undefined);
    assert.deepEqual(referenceViewDependencies(schema), ["source"]);
});

test("cluster reference view appends one readonly presentation row", () => {
    const schema = {
        id: "general",
        config: { storage: "cluster" },
        views: {
            references: {
                coils: descriptor("Катушки", ["elements"], () => [["C1"]]),
            },
        },
    };
    const values = referenceViewValues(schema, { a: 1 }, { elements: [] });
    assert.deepEqual(values, { coils: [["C1"]] });
    assert.deepEqual(
        materializeReferenceViewRows({
            schema,
            rows: [{ property: "a", value: 1 }],
            baseModel: { a: 1 },
            modelSnapshot: { elements: [] },
        }),
        [
            { rowLabel: "Катушки", property: "coils", value: [["C1"]] },
            { property: "a", value: 1 },
        ],
    );
});


test("CLUSTER reference refresh recreates a missing view-only row", async () => {
    const source = await readFile(
        new URL("../src/components/editors/DataEditor.jsx", import.meta.url),
        "utf8",
    );
    const refresh = source.match(
        /async function refreshReferenceViews[\s\S]*?\n  function handleRowSelectionChanged/u,
    )?.[0] ?? "";

    assert.match(refresh, /table\.addRow/u);
    assert.match(refresh, /rowLabel: descriptor\.label/u);
    assert.match(refresh, /property: propertyName/u);
    assert.match(source, /\[control\]\[general\.measurementCoils\]/u);
    assert.match(source, /replaceEditorData:afterSetData/u);
    assert.match(source, /refreshReferenceViews:afterUpdate/u);
    assert.match(source, /queueModelUpdate:afterReplaceData/u);
});
