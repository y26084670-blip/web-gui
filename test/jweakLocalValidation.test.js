import test from "node:test";
import assert from "node:assert/strict";
import { analyzeMed, medDiagnostics } from "../src/services/medAnalysisService.js";
import { parseJweakLocal, validateJweakLocal, jweakLocalLocksStructure } from "../src/services/solver/jweakLocalValidation.js";
import { medBox, medModel } from "./fixtures/medContactCases.js";
function hierarchy(model, divisions) {
    model.jweakLocal = { status: "ready", data: { version: 1, coarse_divisions: divisions } };
    return model;
}
function pair() {
    return hierarchy(medModel([
        medBox({ dp: [3, 3, 4], med: [-1, -1, -1, 2, -1, -1] }),
        medBox({ origin: [0, 1, 0], dp: [1, 1, 4], med: [-1, -1, 1, -1, -1, -1] }),
    ]), [[1, 1, 4], [1, 1, 4]]);
}
test("version and required parent triples are strict; BOM is accepted", () => {
    assert.equal(parseJweakLocal('\ufeff{"version":1,"coarse_divisions":[]}').version, 1);
    for (const spec of [null, [], {}, { version: "1", coarse_divisions: [] },
        { version: 2, coarse_divisions: [] }, { version: 1 },
        { version: 1, coarse_divisions: [[1, 1]] }, { version: 1, coarse_divisions: [[1, 0, 4]] },
        { version: 1, coarse_divisions: [[1, true, 4]] }, { version: 1, coarse_divisions: [[1, 1, 1.5]] }]) {
        assert.throws(() => parseJweakLocal(JSON.stringify(spec)));
    }
});
test("12-to-4 child interface passes through matching 4-to-4 parents, without mutation", () => {
    const m = pair(), before = structuredClone(m), r = analyzeMed(m);
    assert.deepEqual(r.errors, []);
    assert.equal(r.gridLevel, "parent");
    assert.deepEqual(r.refinedBlocks, [1]);
    assert.equal(r.contacts.length, 1);
    assert.equal(r.changes.length, 0);
    assert.deepEqual(medDiagnostics(r), []);
    assert.deepEqual(m, before);
    assert.deepEqual(r.contacts[0].actualDpA, [3, 3, 4]);
    assert.deepEqual(r.contacts[0].contactDpA, [1, 1, 4]);
});
test("same fine grid without companion still fails ordinary conformity check", () => {
    const m = pair(); delete m.jweakLocal;
    assert.ok(analyzeMed(m).errors.some(e => e.code === "GRID_MISMATCH"));
    m.jweakLocal = { status: "absent" };
    assert.ok(analyzeMed(m).errors.some(e => e.code === "GRID_MISMATCH"));
});
test("loading/error/invalid companion never degrades to an ordinary mesh", () => {
    for (const section of [{ status: "loading" }, { status: "error", error: "IO" },
        { status: "ready", data: {} }, { status: "ready", data: { version: 1, coarse_divisions: [] } }]) {
        const m = pair(); m.jweakLocal = section;
        const r = analyzeMed(m);
        assert.ok(r.errors.length > 0);
        assert.equal(r.contacts.length, 0);
        assert.equal(r.canApply, false);
    }
});
test("bad local ratios, changed Z, and refinement of prescribed sources fail", () => {
    const cases = [
        m => { m.elements[0].dp[0] = [2]; },
        m => { m.jweakLocal.data.coarse_divisions[0][2] = 2; },
        m => { m.jweakLocal.data.coarse_divisions[0][0] = 2; },
        m => { m.elements[0].targ = 2; },
        m => { m.elements[0].rv = 0; },
        m => { m.elements.push(medBox()); },
    ];
    for (const change of cases) {
        const m = pair(); change(m);
        assert.ok(validateJweakLocal(m).errors.length > 0);
        assert.equal(analyzeMed(m).canApply, false);
    }
});
test("unrefined compact blocks may contain multiple parents", () => {
    const m = hierarchy(medModel([medBox({ dp: [2, 8, 4] })]), [[2, 8, 4]]);
    assert.deepEqual(analyzeMed(m).errors, []);
});
test("parent grid mismatch remains an error with both blocks and subdivisions", () => {
    const m = pair();
    m.elements[1].dp = [[2], [1], [4]];
    m.jweakLocal.data.coarse_divisions[1] = [2, 1, 4];
    const e = analyzeMed(m).errors.find(e => e.code === "PARENT_GRID_MISMATCH");
    assert.deepEqual(e.elements, [1, 2]);
    assert.match(e.message, /\[1,1,4\].*\[2,1,4\]/u);
});
test("Cartesian geometry and multiplicity restrictions are checked before contact matching", () => {
    for (const change of [
        m => { m.elements[0].geo[7][0] += 0.2; },
        m => { m.elements[0].symVi = [[0], [0], [45]]; },
        m => { m.general.mirrorSymmetryX = 0; },
        m => { m.elements[0].symAs = 2; m.elements[0].symKya = 1; },
    ]) {
        const m = pair(); change(m);
        const r = analyzeMed(m);
        assert.ok(r.errors.some(e => e.code.startsWith("JWEAK_LOCAL")));
        assert.equal(r.canApply, false);
    }
});
test("wrong MED, one-sided insulation, volume overlap and partial contacts remain errors", () => {
    const wrong = pair(); wrong.elements[0].med[3] = [20];
    assert.ok(medDiagnostics(analyzeMed(wrong)).some(d => d.code === "MED_INVALID_POINTER"));
    const isolated = pair(); isolated.elements[0].med[3] = [-1];
    assert.ok(medDiagnostics(analyzeMed(isolated)).some(d => d.code === "MED_INVALID_POINTER"));
    for (const [shift, code] of [[[-0.25, 0, 0], "PARTIAL_CONTACT"], [[0, -0.25, 0], "VOLUME_OVERLAP"]]) {
        const m = pair(); m.elements[1].geo = m.elements[1].geo.map(p => p.map((v, d) => v + shift[d]));
        assert.ok(analyzeMed(m).errors.some(e => e.code === code));
    }
});
test("both floating precisions use parent grids", () => {
    for (const precision of [true, false]) {
        const m = pair(); m.general.doubleFloat = precision;
        assert.deepEqual(analyzeMed(m).errors, []);
    }
});
test("structure is unlocked only for a known absent companion", () => {
    assert.equal(jweakLocalLocksStructure({ status: "absent" }), false);
    for (const status of ["ready", "loading", "error", "unexpected"]) {
        assert.equal(jweakLocalLocksStructure({ status }), true);
    }
});
