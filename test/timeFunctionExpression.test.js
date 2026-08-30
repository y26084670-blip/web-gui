import assert from "node:assert/strict";
import test from "node:test";

import {
    compileTimeExpression,
    TIME_EXPRESSION_HELP,
} from "../src/services/generator/timeFunctionExpression.js";

test("time expression supports assignments, constants, functions and implicit multiplication", () => {
    const evaluate = compileTimeExpression([
        "f=50.0",
        "omega=2 * pi * f",
        "tau=1.1",
        "res=exp(-2t/tau)*sin(omega*t-pi/2)",
    ].join("\n"));

    assert.equal(evaluate(0), -1);
    assert.ok(Math.abs(evaluate(0.01) - 0.9819824738582275) < 1e-14);
    assert.ok(TIME_EXPRESSION_HELP.constants.includes("pi"));
    assert.ok(TIME_EXPRESSION_HELP.functions.includes("sin"));
});

test("time expression uses mathematical power precedence", () => {
    assert.equal(compileTimeExpression("-2^2")(0), -4);
    assert.equal(compileTimeExpression("2^3^2")(0), 512);
});

test("time expression rejects unsafe syntax and invalid results", () => {
    assert.throws(
        () => compileTimeExpression("globalThis.alert(1)"),
        /Недопустимый символ/u,
    );
    assert.throws(
        () => compileTimeExpression("t=1"),
        /зарезервировано/u,
    );
    assert.throws(
        () => compileTimeExpression("unknown+1")(0),
        /Неизвестная переменная/u,
    );
    assert.throws(
        () => compileTimeExpression("1/0")(0),
        /конечным числом/u,
    );
});
