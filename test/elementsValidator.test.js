import test from "node:test";
import assert from "node:assert/strict";

import { elementsValidator }
    from "../src/tabulator/validators/models/elements/elementsValidator.js";

const EPS = 0.03;

function validVertices() {
    return [
        [0, 1, 0],
        [1, 1, 0],
        [0, 1, 1],
        [1, 1, 1],
        [0, 0, 0],
        [1, 0, 0],
        [0, 0, 1],
        [1, 0, 1],
    ];
}

function vector(rows, value = 0) {
    return Array.from({ length: rows }, () => [value]);
}

function parameterGeo(values) {
    const flat = new Array(24).fill(0);
    values.forEach((value, index) => {
        flat[index] = value;
    });

    return Array.from(
        { length: 8 },
        (_, index) => flat.slice(3 * index, 3 * index + 3),
    );
}

function element({
    geoType = 0,
    geo = validVertices(),
    ...overrides
} = {}) {
    return {
        symVi: vector(3),
        symR0: vector(3),
        symYl: 0,
        symYa: 0,
        symTx: 0,
        symLs: 1,
        symAs: 1,
        symPs: 1,
        geoType,
        geo,
        dr: vector(3),
        dp: vector(3, 1),
        vkan: vector(3),
        med: vector(6),
        indMove: 0,
        targ: 0,
        model: 0,
        rv: 0,
        ...overrides,
    };
}

function validate(elements) {
    const diagnostics = [];
    const service = {
        getModel: () => ({ elements }),
    };

    elementsValidator(service, diagnostics);
    return diagnostics;
}

function invalidVertices() {
    const vertices = validVertices();
    vertices[3][1] += 0.25;
    return vertices;
}

test("elements accepts valid direct vertices", () => {
    assert.deepEqual(validate([element()]), []);
});

test("elements reports invalid direct vertices at their record row", () => {
    const diagnostics = validate([
        element(),
        element({ geo: invalidVertices() }),
    ]);

    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].level, "error");
    assert.equal(diagnostics[0].tab.id, "elements");
    assert.equal(diagnostics[0].row, 2);
    assert.equal(diagnostics[0].property, "geo");
    assert.equal(
        diagnostics[0].message,
        "Рёбра 13 и 24 не параллельны с заданной точностью",
    );
});

test("elements reports connecting-edge failures separately", () => {
    const delta = 2 * EPS ** 2;
    const pair15 = [
        [0, 0, 0], [1, 0, 0],
        [0, 1, 0], [1, 1, 0],
        [0, delta, 1], [1, 0, 1],
        [0, 1, 1], [1, 1, 1],
    ];
    const pair37 = [
        [0, -1, 0], [1, -1, 0],
        [0, 0, 0], [1, delta, 0],
        [0, -1, 1], [1, -1, 1],
        [0, delta, 1], [1, delta, 1],
    ];
    const pair48 = [
        [0, -1, 0], [1, -1, 0],
        [0, delta, 0], [1, 0, 0],
        [0, -1, 1], [1, -1, 1],
        [0, delta, 1], [1, delta, 1],
    ];
    const cases = [
        [pair15, "Рёбра 15 и 26 не параллельны с заданной точностью"],
        [pair37, "Рёбра 37 и 26 не параллельны с заданной точностью"],
        [pair48, "Рёбра 48 и 26 не параллельны с заданной точностью"],
    ];

    for (const [geo, message] of cases) {
        const diagnostics = validate([element({ geo })]);

        assert.deepEqual(
            diagnostics.map(item => item.message),
            [message],
        );
    }
});

test("elements accepts the reported Float32 geometry", () => {
    const geo = [
        [13, 0, 24.500778198242188],
        [13, -2.5132100582122803, 24.37150001525879],
        [13, 0, 27.500699996948242],
        [13, -2.5132100582122803, 27.386499404907227],
        [10, 0, 24.500699996948242],
        [10, -2.5132100582122803, 24.37150001525879],
        [10, 0, 27.500699996948242],
        [10, -2.5132100582122803, 27.386499404907227],
    ];

    assert.deepEqual(validate([element({ geo })]), []);
});

test("elements validates every geometry type after unpack", () => {
    const validCases = [
        [1, [0, 1, 1, 1, 1, 2, 0, 2, 30]],
        [2, [2, 3, 4]],
        [3, [2, 3, 4, 2, 3]],
    ];

    for (const [geoType, parameters] of validCases) {
        assert.deepEqual(
            validate([
                element({
                    geoType,
                    geo: parameterGeo(parameters),
                }),
            ]),
            [],
            `geoType ${geoType}`,
        );
    }

    for (const [geoType, parameters] of [
        [1, [0, 1, 1, 1, 1, 2, 0, 2, 0]],
        [2, [0, 3, 4]],
        [3, [0, 3, 4, 2, 3]],
        [4, [3, 2, 0, 4, 2, 1, 1]],
    ]) {
        assert.notDeepEqual(
            validate([
                element({
                    geoType,
                    geo: parameterGeo(parameters),
                }),
            ]),
            [],
            `geoType ${geoType}`,
        );
    }
});

test("elements reports every failed solver geometry flag separately", () => {
    const diagnostics = validate([
        element({
            geoType: 4,
            geo: parameterGeo([3, 2, 0, 4, 2, 1, 1]),
        }),
    ]);

    assert.deepEqual(
        diagnostics.map(({ message }) => message),
        [
            "Длина ребра 26 не превышает 0,03 мм",
            "Ориентированный объём не превышает 0,000027 мм³",
        ],
    );
    assert.equal(diagnostics.every(item => item.row === 1), true);
    assert.equal(
        diagnostics.every(item => item.property === "geo"),
        true,
    );
});

test("elements reports unpack errors without suppressing flag details", () => {
    const diagnostics = validate([
        element({
            geoType: 2,
            geo: parameterGeo([0, 3, 4]),
        }),
    ]);

    assert.deepEqual(
        diagnostics.map(({ message }) => message),
        [
            "Прямоугольная призма содержит неположительный размер Lx, Ly или Lz",
            "Ориентированный объём не превышает 0,000027 мм³",
        ],
    );
});

test("elements does not duplicate an incomplete geo shape error", () => {
    const diagnostics = validate([
        element({ geo: validVertices().slice(0, 7) }),
    ]);

    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].property, "geo");
    assert.match(diagnostics[0].message, /8 × 3/);
});

test("elements treats sparse geo arrays as one shape error", () => {
    const sparseRows = new Array(8);
    sparseRows[0] = [0, 0, 0];

    const sparseCoordinates = validVertices();
    sparseCoordinates[0] = new Array(3);

    for (const geo of [sparseRows, sparseCoordinates]) {
        const diagnostics = validate([element({ geo })]);

        assert.equal(diagnostics.length, 1);
        assert.equal(diagnostics[0].property, "geo");
        assert.match(diagnostics[0].message, /8 × 3/);
    }
});

test("elements reports inconsistent symmetry settings", () => {
    const diagnostics = validate([element({
        symLs: 2,
        symAs: 3,
        symPs: 2,
    })]);

    assert.deepEqual(
        diagnostics.map(({ level, property, message }) => ({
            level,
            property,
            message,
        })),
        [
            {
                level: "error",
                property: "symYl",
                message:
                    "при наличии локальных образов следует задать "
                    + "ненулевой угол симметрии (шаг по углу)",
            },
            {
                level: "error",
                property: "symYa",
                message:
                    "при наличии азимутальных образов следует задать "
                    + "ненулевой угол симметрии (шаг по углу)",
            },
            {
                level: "error",
                property: "symTx",
                message:
                    "при наличии периодических образов следует задать "
                    + "ненулевой шаг вдоль оси",
            },
        ],
    );
});

test("elements warns about unused symmetry steps", () => {
    const diagnostics = validate([element({
        symYl: 15,
        symYa: 30,
        symTx: 4,
    })]);

    assert.deepEqual(diagnostics.map(item => item.level), [
        "warning",
        "warning",
        "warning",
    ]);
    assert.deepEqual(diagnostics.map(item => item.property), [
        "symYl",
        "symYa",
        "symTx",
    ]);
    assert.deepEqual(diagnostics.map(item => item.message), [
        "при отсутствии локальных образов задавать угол симметрии "
            + "(шаг по углу) излишне",
        "при отсутствии азимутальных образов задавать угол симметрии "
            + "(шаг по углу) излишне",
        "при отсутствии периодических образов задавать шаг вдоль оси "
            + "излишне",
    ]);
});

test("elements rejects negative movement and conductivity", () => {
    const diagnostics = validate([element({ indMove: -1, rv: -0.1 })]);

    assert.deepEqual(
        diagnostics.map(({ level, property, message }) => ({
            level,
            property,
            message,
        })),
        [
            {
                level: "error",
                property: "indMove",
                message: "индекс движения не может быть отрицательным",
            },
            {
                level: "error",
                property: "rv",
                message: "электропроводность не может быть отрицательной",
            },
        ],
    );
});

test("elements validates every discretization direction", () => {
    const diagnostics = validate([element({
        dp: [[0], [1.5], ["2"]],
    })]);

    assert.deepEqual(diagnostics.map(item => item.property), ["dp", "dp", "dp"]);
    assert.deepEqual(diagnostics.map(item => item.message), [
        "разбиение D1 должно быть задано положительным целым числом",
        "разбиение D2 должно быть задано положительным целым числом",
        "разбиение D3 должно быть задано положительным целым числом",
    ]);
});
