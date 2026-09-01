import assert from "node:assert/strict";
import test from "node:test";

import {
    findVertexMetadataRange,
    formatGeometryTooltip,
    formatVertexTooltip,
} from "../src/services/visualization/geometryPicking.js";

test("geometry tooltip uses one-based source numbers and optional names", () => {
    assert.equal(
        formatGeometryTooltip({
            schemaId: "elements",
            recordIndex: 0,
            name: "KV 1",
        }),
        "Элемент №1 — KV 1",
    );
    assert.equal(
        formatGeometryTooltip({
            schemaId: "regions",
            recordIndex: 2,
            name: "   ",
        }),
        "Область №3",
    );
    assert.equal(
        formatGeometryTooltip({
            schemaId: "unknown",
            recordIndex: -1,
            name: 42,
        }),
        "Объект №?",
    );
});

test("vertex tooltip formats element coordinates compactly and stably", () => {
    assert.equal(
        formatVertexTooltip(
            { schemaId: "elements", recordIndex: 1 },
            0,
            [1.23456789, -0, 0.000000012345],
        ),
        "Элемент №2, вершина №1 — "
            + "X=1.234568; Y=0; Z=1.2345e-8",
    );
});

test("vertex tooltip supports regions, extreme and invalid coordinates", () => {
    assert.equal(
        formatVertexTooltip(
            { schemaId: "regions", recordIndex: 0 },
            3,
            new Float64Array([1.2e30, -9.87654e-15, Number.NaN]),
        ),
        "Область №1, вершина №4 — "
            + "X=1.2e+30; Y=-9.87654e-15; Z=—",
    );
    assert.equal(
        formatVertexTooltip(
            { schemaId: "elements", recordIndex: 0 },
            Number.NaN,
            [Number.POSITIVE_INFINITY, "12", null],
        ),
        "Элемент №1, вершина №? — X=—; Y=—; Z=—",
    );
});

test("metadata range lookup uses half-open boundaries", () => {
    const ranges = [
        { start: 0, end: 8, source: "first" },
        { start: 8, end: 12, source: "second" },
        { start: 20, end: 24, source: "third" },
    ];

    assert.equal(findVertexMetadataRange(ranges, 0), ranges[0]);
    assert.equal(findVertexMetadataRange(ranges, 7), ranges[0]);
    assert.equal(findVertexMetadataRange(ranges, 8), ranges[1]);
    assert.equal(findVertexMetadataRange(ranges, 11), ranges[1]);
    assert.equal(findVertexMetadataRange(ranges, 12), null);
    assert.equal(findVertexMetadataRange(ranges, 19), null);
    assert.equal(findVertexMetadataRange(ranges, 20), ranges[2]);
    assert.equal(findVertexMetadataRange(ranges, 24), null);
});

test("metadata range lookup rejects invalid input", () => {
    assert.equal(findVertexMetadataRange([], 0), null);
    assert.equal(findVertexMetadataRange(null, 0), null);
    assert.equal(findVertexMetadataRange([], -1), null);
    assert.equal(findVertexMetadataRange([], 1.5), null);
    assert.equal(
        findVertexMetadataRange([{ start: 4, end: 4 }], 4),
        null,
    );
});
