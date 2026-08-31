import test from "node:test";
import assert from "node:assert/strict";

import {
    applyMatrix4ToPoint,
    eulerRotationMatrix4,
} from "../src/services/solver/rotation3d.js";
import {
    expandElementSymmetry,
    expandRegionSymmetry,
} from "../src/services/solver/symmetryExpansion.js";

const TOLERANCE = 1e-12;

function assertPoint(actual, expected) {
    assert.equal(actual.length, expected.length);

    actual.forEach((value, index) => {
        assert.ok(
            Math.abs(value - expected[index]) <= TOLERANCE,
            `coordinate ${index}: ${value} != ${expected[index]}`,
        );
    });
}

function record(overrides = {}) {
    return {
        dr: [[0], [0], [0]],
        symVi: [[0], [0], [0]],
        symR0: [[0], [0], [0]],
        symYl: 0,
        symYa: 0,
        symTx: 0,
        symLs: 1,
        symAs: 1,
        symPs: 1,
        symKya: 0,
        symKyp: 0,
        ...overrides,
    };
}

test("Euler rotation follows Rz * Ry * Rx for column vectors", () => {
    const matrix = eulerRotationMatrix4(90, 90, 0);

    assert.equal(matrix instanceof Float64Array, true);
    assertPoint(applyMatrix4ToPoint(matrix, [0, 1, 0]), [1, 0, 0]);
});

test("element transform follows the solver operation order", () => {
    const [instance] = expandElementSymmetry(record({
        dr: [[1], [0], [0]],
        symVi: [[0], [0], [90]],
        symR0: [[10], [0], [0]],
        symYl: 90,
        symYa: 180,
        symTx: 100,
        symLs: 2,
        symAs: 2,
        symPs: 2,
    })).filter(item => item.ls === 1 && item.as === 1 && item.ps === 1);

    // [0, 1, 0] -> Tdr -> RxLS -> Rvi -> Tr0 -> RxAS -> Tps.
    assertPoint(
        applyMatrix4ToPoint(instance.matrix, [0, 1, 0]),
        [110, -1, -1],
    );
});

test("element expansion keeps all counts independent of kya and kyp", () => {
    const instances = expandElementSymmetry(record({
        symLs: 2,
        symAs: 3,
        symPs: 4,
        symKya: 1,
        symKyp: -1,
    }), {
        mirrorSymmetryX: -1,
        mirrorSymmetryY: -1,
    });

    assert.equal(instances.length, 2 * 3 * 4);
    assert.deepEqual(
        instances.filter(item => item.as === 2).map(item => item.axialSign),
        new Array(8).fill(1),
    );
    assert.deepEqual(
        instances.slice(0, 4).map(item => item.periodicSign),
        [1, -1, 1, -1],
    );
});

test("instance order is LS, AS, PS, mirrorY, mirrorX", () => {
    const instances = expandElementSymmetry(record({
        symLs: 2,
        symAs: 2,
        symPs: 2,
    }), {
        mirrorSymmetryX: 0,
        mirrorSymmetryY: 1,
    });

    assert.deepEqual(
        instances.map(({ ls, as, ps, mirrorY, mirrorX }) =>
            `${ls}${as}${ps}${mirrorY}${mirrorX}`),
        [
            "00000", "00001", "00010", "00011",
            "00100", "00101", "00110", "00111",
            "01000", "01001", "01010", "01011",
            "01100", "01101", "01110", "01111",
            "10000", "10001", "10010", "10011",
            "10100", "10101", "10110", "10111",
            "11000", "11001", "11010", "11011",
            "11100", "11101", "11110", "11111",
        ],
    );
});

test("mirror settings 0 and 1 both add reflected geometry", () => {
    for (const setting of [0, 1]) {
        const instances = expandElementSymmetry(record({
            symR0: [[2], [3], [4]],
        }), {
            mirrorSymmetryX: setting,
            mirrorSymmetryY: setting,
        });

        assert.equal(instances.length, 4);
        assertPoint(
            applyMatrix4ToPoint(instances[0].matrix, [0, 0, 0]),
            [2, 3, 4],
        );
        assertPoint(
            applyMatrix4ToPoint(instances[1].matrix, [0, 0, 0]),
            [-2, 3, 4],
        );
        assertPoint(
            applyMatrix4ToPoint(instances[2].matrix, [0, 0, 0]),
            [2, -3, 4],
        );
        assertPoint(
            applyMatrix4ToPoint(instances[3].matrix, [0, 0, 0]),
            [-2, -3, 4],
        );
    }
});

test("regions use only Tr0 * Rvi * RxLS * Tdr", () => {
    const instances = expandRegionSymmetry(record({
        dr: [[1], [0], [0]],
        symVi: [[0], [0], [90]],
        symR0: [[10], [0], [0]],
        symYl: 90,
        symYa: 180,
        symTx: 100,
        symLs: 2,
        symAs: 7,
        symPs: 9,
    }));

    assert.equal(instances.length, 2);
    assert.deepEqual(
        instances.map(({ ls, as, ps, mirrorX, mirrorY }) => ({
            ls, as, ps, mirrorX, mirrorY,
        })),
        [
            { ls: 0, as: 0, ps: 0, mirrorX: 0, mirrorY: 0 },
            { ls: 1, as: 0, ps: 0, mirrorX: 0, mirrorY: 0 },
        ],
    );
    assertPoint(
        applyMatrix4ToPoint(instances[1].matrix, [0, 1, 0]),
        [10, 1, 1],
    );
});

test("invalid explicit symmetry counts produce no instances", () => {
    for (const property of ["symLs", "symAs", "symPs"]) {
        assert.deepEqual(
            expandElementSymmetry(record({ [property]: 0 })),
            [],
        );
    }

    assert.deepEqual(expandRegionSymmetry(record({ symLs: 1.5 })), []);
});
