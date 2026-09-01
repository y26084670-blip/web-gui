import assert from "node:assert/strict";
import test from "node:test";

import {
    findVertexMetadataRange,
    formatGeometryTooltip,
    formatSymmetryInstance,
    formatVertexTooltip,
    geometryHitInstance,
    vertexHitMetadata,
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

test("symmetry labels use compact one-based image numbers", () => {
    assert.equal(formatSymmetryInstance(null), "");
    assert.equal(
        formatSymmetryInstance({
            as: 1,
            ps: 2,
            ls: 3,
            mirrorX: 1,
            mirrorY: 1,
        }),
        "[AS=2 PS=3 LS=4 EX EY]",
    );
    assert.equal(
        formatGeometryTooltip(
            { schemaId: "elements", recordIndex: 1, name: "KV 2" },
            { as: 1, ps: 0, ls: 0, mirrorX: 1, mirrorY: 0 },
        ),
        "Элемент №2 [AS=2 EX] — KV 2",
    );
    assert.equal(
        formatVertexTooltip(
            { schemaId: "regions", recordIndex: 0 },
            1,
            [1, 2, 3],
            { ls: 1 },
        ),
        "Область №1 [LS=2], вершина №2 — X=1; Y=2; Z=3",
    );
});

test("geometry hit resolves the accepted symmetry instance by its span", () => {
    const instances = [
        { ls: 0 },
        { ls: 1 },
        { ls: 2 },
    ];
    const mesh = {
        object: { userData: { pick: { instances, kind: "mesh", span: 12 } } },
    };
    assert.equal(geometryHitInstance({ ...mesh, faceIndex: 0 }), instances[0]);
    assert.equal(geometryHitInstance({ ...mesh, faceIndex: 23 }), instances[1]);
    assert.equal(geometryHitInstance({ ...mesh, faceIndex: 24 }), instances[2]);

    const lines = {
        object: { userData: { pick: { instances, kind: "lines", span: 24 } } },
    };
    assert.equal(geometryHitInstance({ ...lines, index: 46 }), instances[1]);
    assert.equal(geometryHitInstance({ ...lines, index: 48 }), instances[2]);
    assert.equal(geometryHitInstance({ ...lines, index: 72 }), null);
    assert.equal(geometryHitInstance({ object: {} }), null);
});

test("vertex metadata resolves both image and source vertex", () => {
    const instances = [{ as: 0 }, { as: 1 }];
    const range = {
        start: 20,
        end: 36,
        sourceVertexCount: 8,
        instances,
    };

    assert.deepEqual(vertexHitMetadata(range, 20), {
        instance: instances[0],
        vertexIndex: 0,
    });
    assert.deepEqual(vertexHitMetadata(range, 35), {
        instance: instances[1],
        vertexIndex: 7,
    });
    assert.equal(vertexHitMetadata(range, 36), null);
    assert.equal(vertexHitMetadata(null, 20), null);
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
