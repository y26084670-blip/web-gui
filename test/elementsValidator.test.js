import test from "node:test";
import assert from "node:assert/strict";

import { elementsValidator }
    from "../src/tabulator/validators/models/elements/elementsValidator.js";

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

function vector(rows) {
    return Array.from({ length: rows }, () => [0]);
}

function element({
    geoType = 0,
    geo = validVertices(),
} = {}) {
    return {
        symVi: vector(3),
        symR0: vector(3),
        geoType,
        geo,
        dr: vector(3),
        dp: vector(3),
        vkan: vector(3),
        med: vector(6),
        targ: 0,
        model: 0,
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
    assert.match(
        diagnostics[0].message,
        /корректный объёмный шестигранник/,
    );
});

test("elements does not validate constructed geometry types", () => {
    for (const geoType of [1, 2, 3, 4]) {
        assert.deepEqual(
            validate([
                element({
                    geoType,
                    geo: invalidVertices(),
                }),
            ]),
            [],
            `geoType ${geoType}`,
        );
    }
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
