import assert from "node:assert/strict";
import test from "node:test";

import {
    loadFormulaHistory,
    parseFormulaHistory,
    saveFormulaHistory,
    serializeFormulaHistory,
} from "../src/services/generator/timeFunctionHistoryService.js";

function memoryTaskHandle() {
    const files = new Map();
    const input = {
        async getFileHandle(name, options = {}) {
            if (!files.has(name) && !options.create) {
                throw Object.assign(new Error("missing"), { name: "NotFoundError" });
            }
            if (!files.has(name)) files.set(name, "");
            return {
                async getFile() {
                    return { text: async () => files.get(name) };
                },
                async createWritable() {
                    return {
                        async write(value) { files.set(name, String(value)); },
                        async close() {},
                    };
                },
            };
        },
    };
    return {
        files,
        async getDirectoryHandle(name) {
            assert.equal(name, "input3XX");
            return input;
        },
    };
}

test("formula history preserves multiline expressions", () => {
    const formulas = ["f=50\nres=sin(2*pi*f*t)", "res=t^2"];
    assert.deepEqual(
        parseFormulaHistory(serializeFormulaHistory(formulas)),
        formulas,
    );
});

test("formula history saves and restores the requested task file", async () => {
    const taskHandle = memoryTaskHandle();
    const formulas = ["res=t", "res=2t"];
    await saveFormulaHistory({
        taskHandle,
        fileName: "_генератор_амплитуд.txt",
        formulas,
    });
    assert.deepEqual(
        await loadFormulaHistory({
            taskHandle,
            fileName: "_генератор_амплитуд.txt",
        }),
        formulas,
    );
});

test("formula history rejects malformed files", () => {
    assert.throws(() => parseFormulaHistory("not json"), /не разобран/u);
    assert.throws(
        () => parseFormulaHistory('{"version":2,"formulas":[]}'),
        /неподдерживаемый/u,
    );
});
