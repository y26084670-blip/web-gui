import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { FIELD_TYPES, STORAGE_TYPES, TABS, FILES } from "../src/services/schemas/common/constants.js";
import { deserialize, serialize, findUnknownStoragePaths } from "../src/services/model/modelSerializer.js";
import { conrabValidator } from "../src/tabulator/validators/models/conrab/conrabValidator.js";
const declaration = readFileSync(new URL("../src/services/schemas/conrab.schema.js", import.meta.url), "utf8")
    .replace(/import\s+[\s\S]*?from\s+["'][^"']+["'];\s*/g, "")
    .replace("export default createSchema", "createSchema");
const descriptor = runInNewContext(declaration, {
    FIELD_TYPES, STORAGE_TYPES, TABS, FILES, createSchema: d => d,
});
const schema = { properties: descriptor.properties, config: { storage: descriptor.storage } };
const obsolete = ["EPS_0", "TAU_0", "KB1", "KEPS1", "CF_KEPS"];
test("legacy settings migrate to independent absolute defaults and clean JSONL", () => {
    const old = Object.fromEntries(obsolete.map(k => [k, "unused"]));
    assert.deepEqual(findUnknownStoragePaths(old, Object.keys(schema.properties), descriptor.obsoleteStoragePaths), []);
    const model = deserialize([old, { ...old, CF_FMMEPS: 0.004, CF_HTSEPS: 0.002 }], schema);
    assert.equal(model[0].CF_FMMEPS, 0.01);
    assert.equal(model[0].CF_HTSEPS, 0.01);
    assert.equal(model[1].CF_FMMEPS, 0.004);
    assert.equal(model[1].CF_HTSEPS, 0.002);
    model[0].CF_FMMEPS = 0.02;
    assert.equal(model[1].CF_FMMEPS, 0.004);
    const stored = serialize(model, schema);
    for (const row of stored) for (const key of obsolete) assert.equal(Object.hasOwn(row, key), false);
    const jsonl = stored.map(JSON.stringify).join("\n");
    assert.deepEqual(deserialize(jsonl.split("\n").map(JSON.parse), schema), model);
});
test("absolute tolerances are finite, positive and identify the correct profile", () => {
    for (const key of ["CF_FMMEPS", "CF_HTSEPS"]) {
        assert.equal(schema.properties[key].exclusiveMinimum, 0);
        for (const invalid of [0, -1, NaN, Infinity, "0.01", null, undefined]) {
            const model = deserialize([{}, {}], schema);
            model[1][key] = invalid;
            const diagnostics = [];
            conrabValidator({ getModel: () => ({ conrab: model }) }, diagnostics);
            assert.equal(diagnostics.length, 1);
            assert.equal(diagnostics[0].property, key);
            assert.equal(diagnostics[0].row, 2);
        }
    }
});
