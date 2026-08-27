import test from "node:test";
import assert from "node:assert/strict";

import { validateKvVertices }
    from "../src/services/solver/geometryKv.js";

const EPS = 0.001;

function validVertices() {
    return [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [1, 1, 0],
        [0, 0, 1],
        [1, 0, 1],
        [0, 1, 1],
        [1, 1, 1],
    ];
}

test("KV validator accepts a valid hexahedron", () => {
    assert.equal(validateKvVertices(validVertices()), true);
});

test("KV validator keeps strict thresholds for all required edges", () => {
    const cases = [
        {
            edge: "13",
            make: length => [
                [0, 0, 0], [1, 0, 0],
                [0, length, 0], [1, length, 0],
                [0, 0, 1], [1, 0, 1],
                [0, length, 2], [1, length, 2],
            ],
        },
        {
            edge: "57",
            make: length => [
                [0, 0, 0], [1, 0, 0],
                [0, 1, 0], [1, 1, 0],
                [0, 2, 2 * length], [1, 1, length],
                [0, 2, length], [1, 1, 0],
            ],
        },
        {
            edge: "15",
            make: length => [
                [0, 0, 0], [1, 0, 0],
                [0, 1, 0], [1, 1, 0],
                [0, 0, length], [1, 0, 1],
                [0, 1, 1], [1, 1, 2 - length],
            ],
        },
        {
            edge: "37",
            make: length => [
                [0, 0, 0], [1, 0, 0],
                [0, 1, 0], [1, 1, 0],
                [0, 0, 1], [1, 0, 1],
                [0, 1, length], [1, 1, length],
            ],
        },
        {
            edge: "26",
            make: length => [
                [0, 0, 0], [1, 0, 0],
                [0, 1, 0], [1, 1, 0],
                [0, 0, 1], [1, 0, length],
                [0, 1, 1], [1, 1, length],
            ],
        },
    ];

    for (const { edge, make } of cases) {
        assert.equal(validateKvVertices(make(0.5 * EPS)), false, edge);
        assert.equal(validateKvVertices(make(EPS)), false, edge);
        assert.equal(validateKvVertices(make(2 * EPS)), true, edge);
    }
});

test("KV validator keeps strict thresholds for every parallel check", () => {
    const cases = [
        {
            group: "13 ∥ 24",
            make: delta => {
                const vertices = validVertices();
                vertices[3] = [1, 1, delta];
                return vertices;
            },
        },
        {
            group: "57 ∥ 68",
            make: delta => [
                [0, 0, -1], [1, 0, -1],
                [0, 1, -1], [1, 1, -1],
                [0, 0, 0], [1, 0, 0],
                [0, 1, 0], [1, 1, delta],
            ],
        },
        {
            group: "15 ∥ 26",
            make: delta => {
                const vertices = validVertices();
                vertices[4] = [0, delta, 1];
                return vertices;
            },
        },
        {
            group: "37 ∥ 26",
            make: delta => [
                [0, -1, 0], [1, -1, 0],
                [0, 0, 0], [1, delta, 0],
                [0, -1, 1], [1, -1, 1],
                [0, delta, 1], [1, delta, 1],
            ],
        },
        {
            group: "48 ∥ 26",
            make: delta => [
                [0, -1, 0], [1, -1, 0],
                [0, delta, 0], [1, 0, 0],
                [0, -1, 1], [1, -1, 1],
                [0, delta, 1], [1, delta, 1],
            ],
        },
    ];

    for (const { group, make } of cases) {
        assert.equal(
            validateKvVertices(make(0.5 * EPS ** 2)),
            true,
            group,
        );
        assert.equal(validateKvVertices(make(EPS ** 2)), false, group);
        assert.equal(validateKvVertices(make(2 * EPS ** 2)), false, group);
    }
});

test("KV validator requires a positive vertex orientation", () => {
    const vertices = validVertices();

    for (let index = 1; index < vertices.length; index += 2) {
        vertices[index][0] = -1;
    }

    assert.equal(validateKvVertices(vertices), false);
});

test("KV validator keeps the strict positive-volume threshold", () => {
    const volumeVertices = height => [
        [0, 0, 0], [height, 0, 0],
        [0, 1, 0], [height, 1, 0],
        [0, 0, 1], [height, 0, 1],
        [0, 1, 1], [height, 1, 1],
    ];

    assert.equal(
        validateKvVertices(volumeVertices(0.5 * EPS ** 3)),
        false,
    );
    assert.equal(
        validateKvVertices(volumeVertices(EPS ** 3)),
        false,
    );
    assert.equal(
        validateKvVertices(volumeVertices(2 * EPS ** 3)),
        true,
    );
});

test("KV validator rejects malformed and non-finite vertices", () => {
    assert.equal(
        validateKvVertices(validVertices().slice(0, 7)),
        false,
    );

    const nonFinite = validVertices();
    nonFinite[0][0] = Number.POSITIVE_INFINITY;
    assert.equal(validateKvVertices(nonFinite), false);

    const nonNumeric = validVertices();
    nonNumeric[0][0] = "0";
    assert.equal(validateKvVertices(nonNumeric), false);

    const sparseVertices = new Array(8);
    sparseVertices[0] = [0, 0, 0];
    assert.equal(validateKvVertices(sparseVertices), false);

    const sparseVertex = validVertices();
    sparseVertex[0] = new Array(3);
    assert.equal(validateKvVertices(sparseVertex), false);
});
