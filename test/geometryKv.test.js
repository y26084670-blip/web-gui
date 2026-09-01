import test from "node:test";
import assert from "node:assert/strict";

import {
    unpackKvVertices,
    validateKvVertices,
    validateKvVerticesDetailed,
}
    from "../src/services/solver/geometryKv.js";

const EPS = 0.03;
const PREVIOUS_EPS = 0.001;

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

    assert.deepEqual(
        validateKvVerticesDetailed(validVertices()),
        {
            valid: true,
            malformed: false,
            checks: {
                edge13: true,
                edge57: true,
                edge15: true,
                edge37: true,
                edge26: true,
                parallel13And24: true,
                parallel57And68: true,
                parallel15And26: true,
                parallel37And26: true,
                parallel48And26: true,
                positiveVolume: true,
            },
        },
    );
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
        assert.equal(
            validateKvVerticesDetailed(make(0.5 * EPS))
                .checks[`edge${edge}`],
            false,
            edge,
        );
        assert.equal(validateKvVertices(make(0.5 * EPS)), false, edge);
        assert.equal(validateKvVertices(make(EPS)), false, edge);
        assert.equal(validateKvVertices(make(2 * EPS)), true, edge);
    }
});

test("KV validator keeps strict thresholds for every parallel check", () => {
    const cases = [
        {
            group: "13 ∥ 24",
            check: "parallel13And24",
            make: delta => {
                const vertices = validVertices();
                vertices[3] = [1, 1, delta];
                return vertices;
            },
        },
        {
            group: "57 ∥ 68",
            check: "parallel57And68",
            make: delta => [
                [0, 0, -1], [1, 0, -1],
                [0, 1, -1], [1, 1, -1],
                [0, 0, 0], [1, 0, 0],
                [0, 1, 0], [1, 1, delta],
            ],
        },
        {
            group: "15 ∥ 26",
            check: "parallel15And26",
            make: delta => {
                const vertices = validVertices();
                vertices[4] = [0, delta, 1];
                return vertices;
            },
        },
        {
            group: "37 ∥ 26",
            check: "parallel37And26",
            make: delta => [
                [0, -1, 0], [1, -1, 0],
                [0, 0, 0], [1, delta, 0],
                [0, -1, 1], [1, -1, 1],
                [0, delta, 1], [1, delta, 1],
            ],
        },
        {
            group: "48 ∥ 26",
            check: "parallel48And26",
            make: delta => [
                [0, -1, 0], [1, -1, 0],
                [0, delta, 0], [1, 0, 0],
                [0, -1, 1], [1, -1, 1],
                [0, delta, 1], [1, delta, 1],
            ],
        },
    ];

    for (const { group, check, make } of cases) {
        assert.equal(
            validateKvVertices(make(0.5 * EPS ** 2)),
            true,
            group,
        );
        assert.equal(
            validateKvVerticesDetailed(make(2 * EPS ** 2))
                .checks[check],
            false,
            group,
        );
        assert.equal(validateKvVertices(make(EPS ** 2)), false, group);
        assert.equal(validateKvVertices(make(2 * EPS ** 2)), false, group);
    }
});

test("KV validator identifies each connecting-edge pair independently", () => {
    const connectingChecks = [
        "parallel15And26",
        "parallel37And26",
        "parallel48And26",
    ];
    const cases = [
        {
            failed: "parallel15And26",
            make: delta => {
                const vertices = validVertices();
                vertices[4] = [0, delta, 1];
                return vertices;
            },
        },
        {
            failed: "parallel37And26",
            make: delta => [
                [0, -1, 0], [1, -1, 0],
                [0, 0, 0], [1, delta, 0],
                [0, -1, 1], [1, -1, 1],
                [0, delta, 1], [1, delta, 1],
            ],
        },
        {
            failed: "parallel48And26",
            make: delta => [
                [0, -1, 0], [1, -1, 0],
                [0, delta, 0], [1, 0, 0],
                [0, -1, 1], [1, -1, 1],
                [0, delta, 1], [1, delta, 1],
            ],
        },
    ];

    for (const { failed, make } of cases) {
        const validation = validateKvVerticesDetailed(
            make(2 * EPS ** 2),
        );

        for (const check of connectingChecks) {
            assert.equal(
                validation.checks[check],
                check !== failed,
                `${failed}: ${check}`,
            );
        }
        assert.equal(validation.valid, false, failed);
    }
});

test("KV validator reports simultaneous connecting-edge failures", () => {
    const delta = 2 * EPS ** 2;
    const vertices = validVertices();
    vertices[4] = [0, delta, 1];
    vertices[6] = [0, 1 + delta, 1];
    vertices[7] = [1, 1 + delta, 1];

    const validation = validateKvVerticesDetailed(vertices);

    assert.equal(validation.checks.parallel15And26, false);
    assert.equal(validation.checks.parallel37And26, false);
    assert.equal(validation.checks.parallel48And26, false);
    assert.equal(validation.valid, false);
});

test("KV validator accepts the reported Float32 element at the new tolerance", () => {
    const vertices = [
        [13, 0, 24.500778198242188],
        [13, -2.5132100582122803, 24.37150001525879],
        [13, 0, 27.500699996948242],
        [13, -2.5132100582122803, 27.386499404907227],
        [10, 0, 24.500699996948242],
        [10, -2.5132100582122803, 24.37150001525879],
        [10, 0, 27.500699996948242],
        [10, -2.5132100582122803, 27.386499404907227],
    ];

    const previousValidation = validateKvVerticesDetailed(
        vertices,
        PREVIOUS_EPS,
    );
    const validation = validateKvVerticesDetailed(vertices);

    assert.deepEqual(
        Object.entries(previousValidation.checks)
            .filter(([, passed]) => !passed)
            .map(([check]) => check),
        ["parallel15And26"],
    );
    assert.equal(previousValidation.valid, false);
    assert.equal(validation.valid, true);
    assert.equal(Object.values(validation.checks).every(Boolean), true);
});

test("KV validator requires a positive vertex orientation", () => {
    const vertices = validVertices();

    for (let index = 1; index < vertices.length; index += 2) {
        vertices[index][0] = -1;
    }

    const validation = validateKvVerticesDetailed(vertices);

    assert.equal(validation.valid, false);
    assert.equal(validation.checks.positiveVolume, false);
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

    assert.equal(
        validateKvVerticesDetailed(sparseVertex).malformed,
        true,
    );
});

test("KV unpack keeps solver error flags while constructing vertices", () => {
    const cases = [
        { geoType: 2, valid: [2, 3, 4], invalid: [0, 3, 4] },
        { geoType: 3, valid: [2, 3, 4, 2, 3], invalid: [0, 3, 4, 2, 3] },
        { geoType: 4, valid: [3, 2, 0, 4, 2, 1, 1], invalid: [0, 2, 0, 4, 2, 1, 1] },
    ];

    for (const { geoType, valid, invalid } of cases) {
        const validResult = unpackKvVertices(valid, geoType);
        const invalidResult = unpackKvVertices(invalid, geoType);

        assert.equal(validResult.err, 0, `valid geoType ${geoType}`);
        assert.equal(invalidResult.err, 1, `invalid geoType ${geoType}`);
        assert.equal(validResult.vertices.length, 8);
        assert.equal(invalidResult.vertices.length, 8);
    }
});

test("KV validator can inspect every supported unpacked geometry type", () => {
    const cases = [
        {
            geoType: 0,
            geo: validVertices().flat(),
            expected: true,
        },
        {
            geoType: 1,
            geo: [0, 1, 1, 1, 1, 2, 0, 2, 30],
            expected: true,
        },
        { geoType: 2, geo: [2, 3, 4], expected: true },
        { geoType: 3, geo: [2, 3, 4, 2, 3], expected: true },
    ];

    for (const { geoType, geo, expected } of cases) {
        const unpacked = unpackKvVertices(geo, geoType);

        assert.equal(unpacked.err, 0, `geoType ${geoType}`);
        assert.equal(
            validateKvVerticesDetailed(unpacked.vertices).valid,
            expected,
            `geoType ${geoType}`,
        );
    }

    const pyramid = unpackKvVertices(
        [3, 2, 0, 4, 2, 1, 1],
        4,
    );
    const pyramidValidation = validateKvVerticesDetailed(
        pyramid.vertices,
    );

    assert.equal(pyramid.err, 0);
    assert.equal(pyramidValidation.valid, false);
    assert.equal(pyramidValidation.checks.edge26, false);
    assert.equal(pyramidValidation.checks.positiveVolume, false);
});
