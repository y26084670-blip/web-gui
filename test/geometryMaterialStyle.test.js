import assert from "node:assert/strict";
import test from "node:test";

import {
    GEOMETRY_MATERIAL_KINDS,
    GEOMETRY_MATERIAL_PALETTE,
    classifyGeometryMaterial,
    geometryMaterialColor,
    geometryMaterialEdgeColor,
    geometryMaterialStyle,
} from "../src/services/visualization/geometryMaterialStyle.js";

const KINDS = GEOMETRY_MATERIAL_KINDS;

test("targ classifies virtual and prescribed sources before material fields", () => {
    const conflicting = {
        model: 2,
        xapName: "HTSC",
        rv: 100,
    };

    assert.equal(
        classifyGeometryMaterial({ ...conflicting, targ: 3 }, {
            htcMu: true,
            htcRo: true,
        }),
        KINDS.VIRTUAL,
    );
    assert.equal(
        classifyGeometryMaterial({ ...conflicting, targ: 2 }, {
            htcMu: true,
            htcRo: true,
        }),
        KINDS.PRESCRIBED_CURRENT,
    );
    assert.equal(
        classifyGeometryMaterial({ ...conflicting, targ: 1 }, {
            htcMu: true,
            htcRo: true,
        }),
        KINDS.PRESCRIBED_MAGNETIZATION,
    );
});

test("HTSC subsystem flags select magnetic, current, both, or fallback", () => {
    const htsc = { targ: 0, model: 2, xapName: "ignored", rv: 1 };

    assert.equal(
        classifyGeometryMaterial(htsc, { htcMu: true, htcRo: false }),
        KINDS.HTSC_MAGNETIC,
    );
    assert.equal(
        classifyGeometryMaterial(htsc, { htcMu: false, htcRo: true }),
        KINDS.HTSC_CURRENT,
    );
    assert.equal(
        classifyGeometryMaterial(htsc, { htcMu: true, htcRo: true }),
        KINDS.HTSC_BOTH,
    );
    assert.equal(
        classifyGeometryMaterial(htsc, { htcMu: false, htcRo: false }),
        KINDS.NEUTRAL,
    );
    assert.equal(classifyGeometryMaterial(htsc), KINDS.HTSC_BOTH);
});

test("ordinary materials use characteristic presence and conductivity", () => {
    const ordinary = { targ: 0, model: 0 };

    assert.equal(
        classifyGeometryMaterial({ ...ordinary, xapName: "Steel", rv: 0 }),
        KINDS.FMM_INSULATING,
    );
    assert.equal(
        classifyGeometryMaterial({ ...ordinary, xapName: "Steel", rv: 4 }),
        KINDS.FMM_CONDUCTIVE,
    );
    assert.equal(
        classifyGeometryMaterial({ ...ordinary, xapName: "  ", rv: 4 }),
        KINDS.NONMAGNETIC_CONDUCTIVE,
    );
    assert.equal(
        classifyGeometryMaterial({ ...ordinary, xapName: "", rv: 0 }),
        KINDS.NEUTRAL,
    );
});

test("palette covers every material kind with numeric rendering colors", () => {
    for (const kind of Object.values(KINDS)) {
        const entry = GEOMETRY_MATERIAL_PALETTE[kind];
        assert.equal(typeof entry?.copy, "number", kind);
        assert.equal(typeof entry?.original, "number", kind);
        assert.equal(typeof entry?.edge, "number", kind);
        assert.equal(Object.isFrozen(entry), true, kind);
    }
    assert.equal(Object.isFrozen(GEOMETRY_MATERIAL_PALETTE), true);
});

test("copies keep canonical colors and originals use darker shades", () => {
    for (const kind of Object.values(KINDS)) {
        const palette = GEOMETRY_MATERIAL_PALETTE[kind];
        assert.equal(geometryMaterialColor(kind), palette.copy, kind);
        assert.equal(geometryMaterialColor(kind, true), palette.original, kind);
        assert.notEqual(palette.copy, palette.original, kind);
    }

    assert.equal(
        geometryMaterialColor(KINDS.HTSC_BOTH),
        0x151515,
    );
    assert.equal(
        geometryMaterialColor(KINDS.HTSC_BOTH, true),
        0x000000,
    );
});

test("virtual volumes use white copies and black edges", () => {
    assert.equal(geometryMaterialColor(KINDS.VIRTUAL), 0xffffff);
    assert.equal(geometryMaterialColor(KINDS.VIRTUAL, true), 0xe6e6e6);
    assert.equal(geometryMaterialEdgeColor(KINDS.VIRTUAL), 0x000000);
});

test("style and unknown-kind fallback are stable for scene rendering", () => {
    assert.deepEqual(geometryMaterialStyle(KINDS.FMM_CONDUCTIVE, true), {
        color: GEOMETRY_MATERIAL_PALETTE[KINDS.FMM_CONDUCTIVE].original,
        edgeColor: GEOMETRY_MATERIAL_PALETTE[KINDS.FMM_CONDUCTIVE].edge,
    });
    assert.deepEqual(
        geometryMaterialStyle("future-material"),
        geometryMaterialStyle(KINDS.NEUTRAL),
    );
});
