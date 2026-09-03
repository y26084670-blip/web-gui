import assert from "node:assert/strict";
import test from "node:test";

import { regionsValidator }
    from "../src/tabulator/validators/models/regions/regionsValidator.js";

function vector(rows, value = 0) {
    return Array.from({ length: rows }, () => [value]);
}

function region(overrides = {}) {
    return {
        symVi: vector(3),
        symR0: vector(3),
        symYl: 0,
        symLs: 1,
        geo: Array.from({ length: 4 }, () => [0, 0, 0]),
        dr: vector(3),
        dp: vector(2, 1),
        indMove: 0,
        ...overrides,
    };
}

function validate(regions) {
    const diagnostics = [];
    regionsValidator({
        getModel: () => ({ regions }),
    }, diagnostics);
    return diagnostics;
}

test("regions accept valid local symmetry and discretization", () => {
    assert.deepEqual(validate([region()]), []);
});

test("regions report and warn about inconsistent local symmetry", () => {
    const error = validate([region({ symLs: 2 })]);
    const warning = validate([region({ symYl: 30 })]);

    assert.deepEqual(error.map(item => ({
        level: item.level,
        property: item.property,
        message: item.message,
    })), [{
        level: "error",
        property: "symYl",
        message:
            "при наличии локальных образов следует задать ненулевой "
            + "угол симметрии (шаг по углу)",
    }]);
    assert.deepEqual(warning.map(item => ({
        level: item.level,
        property: item.property,
        message: item.message,
    })), [{
        level: "warning",
        property: "symYl",
        message:
            "при отсутствии локальных образов задавать угол симметрии "
            + "(шаг по углу) излишне",
    }]);
});

test("regions reject negative movement and invalid discretization", () => {
    const diagnostics = validate([region({
        indMove: -1,
        dp: [[0], [1.5]],
    })]);

    assert.deepEqual(diagnostics.map(item => item.property), [
        "indMove",
        "dp",
        "dp",
    ]);
    assert.deepEqual(diagnostics.map(item => item.message), [
        "индекс движения не может быть отрицательным",
        "разбиение D1 должно быть задано положительным целым числом",
        "разбиение D2 должно быть задано положительным целым числом",
    ]);
});
