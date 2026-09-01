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

const EXPECTED_PALETTE = Object.freeze({
    [KINDS.FMM_INSULATING]: {
        copy: 0x4b78e6,
        original: 0x3b60b8,
        edge: 0x203a73,
    },
    [KINDS.FMM_CONDUCTIVE]: {
        copy: 0x3aad68,
        original: 0x2e8a53,
        edge: 0x185331,
    },
    [KINDS.NONMAGNETIC_CONDUCTIVE]: {
        copy: 0xdf5555,
        original: 0xb94444,
        edge: 0x722828,
    },
    [KINDS.HTSC_MAGNETIC]: {
        copy: 0x9b63df,
        original: 0x7d4fb5,
        edge: 0x482d6b,
    },
    [KINDS.HTSC_CURRENT]: {
        copy: 0xd5c5ff,
        original: 0xb2a2df,
        edge: 0x6d6292,
    },
    [KINDS.HTSC_BOTH]: {
        copy: 0x59616b,
        original: 0x424950,
        edge: 0x15191d,
    },
    [KINDS.PRESCRIBED_MAGNETIZATION]: {
        copy: 0x92dcf8,
        original: 0x70bad6,
        edge: 0x386d82,
    },
    [KINDS.PRESCRIBED_CURRENT]: {
        copy: 0xffb2b2,
        original: 0xda9292,
        edge: 0x8d5454,
    },
    [KINDS.VIRTUAL]: {
        copy: 0xffffff,
        original: 0xd8d8d8,
        edge: 0x000000,
    },
    [KINDS.NEUTRAL]: {
        copy: 0x929da9,
        original: 0x747e89,
        edge: 0x414951,
    },
});

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

test("palette uses the approved brighter colors", () => {
    assert.deepEqual(GEOMETRY_MATERIAL_PALETTE, EXPECTED_PALETTE);
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
        0x59616b,
    );
    assert.equal(
        geometryMaterialColor(KINDS.HTSC_BOTH, true),
        0x424950,
    );
});

test("virtual volumes use white copies and black edges", () => {
    assert.equal(geometryMaterialColor(KINDS.VIRTUAL), 0xffffff);
    assert.equal(geometryMaterialColor(KINDS.VIRTUAL, true), 0xd8d8d8);
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
