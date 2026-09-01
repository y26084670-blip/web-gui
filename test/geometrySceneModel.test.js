import assert from "node:assert/strict";
import test from "node:test";

import { buildGeometryScene }
    from "../src/services/visualization/geometrySceneModel.js";
import { GEOMETRY_MATERIAL_KINDS }
    from "../src/services/visualization/geometryMaterialStyle.js";

function vector(values) {
    return values.map(value => [value]);
}

function geometryRows(values, rowCount) {
    const flat = [
        ...values,
        ...new Array(rowCount * 3 - values.length).fill(0),
    ];

    return Array.from(
        { length: rowCount },
        (_, index) => flat.slice(index * 3, index * 3 + 3),
    );
}

function element(overrides = {}) {
    return {
        name: "KV 1",
        geoType: 2,
        geo: geometryRows([2, 3, 4], 8),
        dr: vector([0, 0, 0]),
        symVi: vector([0, 0, 0]),
        symR0: vector([0, 0, 0]),
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

function region(overrides = {}) {
    return {
        name: "TK 1",
        geoType: 2,
        geo: geometryRows([1, 2, 3, 4, 5, 6], 4),
        dr: vector([0, 0, 0]),
        symVi: vector([0, 0, 0]),
        symR0: vector([0, 0, 0]),
        symYl: 0,
        symLs: 1,
        ...overrides,
    };
}

function plain(value) {
    return Array.from(value);
}

test("scene converts BaseModel arrays and preserves solver face topology", () => {
    const model = {
        general: {
            mirrorSymmetryX: -1,
            mirrorSymmetryY: -1,
        },
        elements: [element({ dr: vector([10, 0, 0]) })],
        regions: [region()],
    };
    const before = structuredClone(model);
    const scene = buildGeometryScene(model);

    assert.deepEqual(model, before);
    assert.equal(scene.diagnostics.length, 0);
    assert.equal(scene.primitives.length, 2);

    const [volume, line] = scene.primitives;
    assert.equal(volume.kind, "element-volume");
    assert.equal(
        volume.materialKind,
        GEOMETRY_MATERIAL_KINDS.NEUTRAL,
    );
    assert.deepEqual(volume.source, {
        schemaId: "elements",
        recordIndex: 0,
        name: "KV 1",
    });
    assert.equal(volume.vertices instanceof Float64Array, true);
    assert.deepEqual(plain(volume.vertices), [
        0, 3, 0,
        2, 3, 0,
        0, 3, 4,
        2, 3, 4,
        0, 0, 0,
        2, 0, 0,
        0, 0, 4,
        2, 0, 4,
    ]);
    assert.deepEqual(plain(volume.indices), [
        0, 4, 6, 0, 6, 2,
        1, 3, 7, 1, 7, 5,
        0, 2, 3, 0, 3, 1,
        4, 5, 7, 4, 7, 6,
        0, 1, 5, 0, 5, 4,
        2, 6, 7, 2, 7, 3,
    ]);
    assert.equal(volume.instances[0].matrix instanceof Float64Array, true);

    assert.equal(line.kind, "region-line");
    assert.equal(Object.hasOwn(line, "materialKind"), false);
    assert.deepEqual(line.source, {
        schemaId: "regions",
        recordIndex: 0,
        name: "TK 1",
    });
    assert.deepEqual(plain(line.vertices), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(plain(line.indices), [0, 1]);

    assert.deepEqual(plain(scene.bounds.min), [1, 0, 0]);
    assert.deepEqual(plain(scene.bounds.max), [12, 5, 6]);
    assert.deepEqual(scene.counts, {
        elements: 1,
        regions: 1,
        primitives: 2,
        instances: 2,
        vertices: 10,
        triangles: 12,
        lines: 1,
        skipped: 0,
    });
});

test("scene carries element material categories from BaseModel properties", () => {
    const scene = buildGeometryScene({
        general: {
            htcMu: false,
            htcRo: true,
        },
        elements: [
            element({ targ: 3, model: 2, xapName: "ignored", rv: 10 }),
            element({ targ: 0, model: 2 }),
            element({ targ: 0, model: 0, xapName: "Steel", rv: 10 }),
        ],
        regions: [region()],
    });

    assert.deepEqual(
        scene.primitives.slice(0, 3).map(item => item.materialKind),
        [
            GEOMETRY_MATERIAL_KINDS.VIRTUAL,
            GEOMETRY_MATERIAL_KINDS.HTSC_CURRENT,
            GEOMETRY_MATERIAL_KINDS.FMM_CONDUCTIVE,
        ],
    );
    assert.equal(
        Object.hasOwn(scene.primitives[3], "materialKind"),
        false,
    );
});

test("general mirrors apply only to elements; regions use local copies", () => {
    const scene = buildGeometryScene({
        general: {
            mirrorSymmetryX: 0,
            mirrorSymmetryY: 1,
        },
        elements: [element({
            geo: geometryRows([1, 1, 1], 8),
            symR0: vector([2, 3, 4]),
        })],
        regions: [region({
            symLs: 2,
            symYl: 90,
        })],
    });

    const [volume, line] = scene.primitives;
    assert.deepEqual(
        volume.instances.map(({ mirrorX, mirrorY }) => [mirrorX, mirrorY]),
        [[0, 0], [1, 0], [0, 1], [1, 1]],
    );
    assert.deepEqual(
        line.instances.map(({ ls, as, ps, mirrorX, mirrorY }) => ({
            ls,
            as,
            ps,
            mirrorX,
            mirrorY,
        })),
        [
            { ls: 0, as: 0, ps: 0, mirrorX: 0, mirrorY: 0 },
            { ls: 1, as: 0, ps: 0, mirrorX: 0, mirrorY: 0 },
        ],
    );
    assert.deepEqual(plain(scene.bounds.min), [-3, -6, 2]);
    assert.deepEqual(plain(scene.bounds.max), [4, 5, 6]);
    assert.deepEqual(scene.counts, {
        elements: 1,
        regions: 1,
        primitives: 2,
        instances: 6,
        vertices: 36,
        triangles: 48,
        lines: 2,
        skipped: 0,
    });
});

test("surface regions use a two-triangle quad without dp expansion", () => {
    const scene = buildGeometryScene({
        regions: [region({
            geoType: 3,
            geo: geometryRows([2, 3], 4),
            symLs: 3,
            dp: vector([20, 30]),
        })],
    });
    const [surface] = scene.primitives;

    assert.equal(surface.kind, "region-surface");
    assert.deepEqual(plain(surface.vertices), [
        0, 0, 0,
        0, 0, 3,
        0, 2, 3,
        0, 2, 0,
    ]);
    assert.deepEqual(plain(surface.indices), [0, 1, 2, 0, 2, 3]);
    assert.equal(surface.instances.length, 3);
    assert.equal(scene.counts.triangles, 6);
});

test("bad records are skipped with diagnostics instead of throwing", () => {
    const scene = buildGeometryScene({
        elements: [
            element({ geoType: 99 }),
            element({
                geo: geometryRows([Number.NaN, 2, 3], 8),
            }),
            element({ symLs: 0 }),
        ],
        regions: [
            region({
                geoType: 1,
                geo: geometryRows([0, 0, 0, 0], 4),
            }),
            region({ symVi: vector([Number.POSITIVE_INFINITY, 0, 0]) }),
        ],
    });

    assert.deepEqual(scene.primitives, []);
    assert.equal(scene.bounds, null);
    assert.deepEqual(
        scene.diagnostics.map(item => [
            item.schemaId,
            item.recordIndex,
            item.code,
        ]),
        [
            ["elements", 0, "unsupported-geometry"],
            ["elements", 1, "invalid-geometry"],
            ["elements", 2, "invalid-symmetry"],
            ["regions", 0, "invalid-geometry"],
            ["regions", 1, "invalid-transform"],
        ],
    );
    assert.deepEqual(scene.counts, {
        elements: 0,
        regions: 0,
        primitives: 0,
        instances: 0,
        vertices: 0,
        triangles: 0,
        lines: 0,
        skipped: 5,
    });
});

test("zero-volume elements and zero-length regions are invalid", () => {
    const scene = buildGeometryScene({
        elements: [element({
            geo: geometryRows([0, 2, 3], 8),
        })],
        regions: [region({
            geo: geometryRows([1, 2, 3, 1, 2, 3], 4),
        })],
    });

    assert.deepEqual(scene.primitives, []);
    assert.deepEqual(
        scene.diagnostics.map(item => item.code),
        ["invalid-geometry", "invalid-geometry"],
    );
    assert.equal(scene.counts.skipped, 2);
});

test("large translated direct geometry keeps a stable volume check", () => {
    const offset = [1e14, 3e14, -2e14];
    const vertices = [
        [0, 1, 0], [1, 1, 0], [0, 1, 1], [1, 1, 1],
        [0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1],
    ].map(vertex => vertex.map((value, axis) => value + offset[axis]));
    const scene = buildGeometryScene({
        elements: [element({
            geoType: 0,
            geo: vertices,
        })],
    });

    assert.equal(scene.primitives.length, 1);
    assert.deepEqual(scene.diagnostics, []);
});

test("symmetry preflight rejects unsafe and excessive counts before expansion", () => {
    const scene = buildGeometryScene({
        elements: [
            element({ symLs: 1e20 }),
            element({ symLs: 1_000_000_000 }),
            element({ symYa: Number.NaN }),
            element({ symPs: 3, symTx: 1e308 }),
        ],
        regions: [region({ symYl: Number.POSITIVE_INFINITY })],
    });

    assert.deepEqual(scene.primitives, []);
    assert.deepEqual(
        scene.diagnostics.map(item => item.code),
        [
            "invalid-symmetry",
            "instance-budget-exceeded",
            "invalid-transform",
            "invalid-transform",
            "invalid-transform",
        ],
    );
});

test("coordinates outside the Float32 render range are skipped", () => {
    const scene = buildGeometryScene({
        regions: [region({
            geo: geometryRows([1e308, 0, 0, 0, 0, 0], 4),
            dr: vector([1e308, 0, 0]),
        })],
    });

    assert.deepEqual(scene.primitives, []);
    assert.equal(scene.bounds, null);
    assert.equal(scene.diagnostics[0].code, "invalid-transform");
});

test("empty and non-array model parts produce an empty scene", () => {
    const scene = buildGeometryScene({
        elements: null,
        regions: {},
    });

    assert.deepEqual(scene.primitives, []);
    assert.deepEqual(scene.diagnostics, []);
    assert.equal(scene.bounds, null);
    assert.deepEqual(scene.counts, {
        elements: 0,
        regions: 0,
        primitives: 0,
        instances: 0,
        vertices: 0,
        triangles: 0,
        lines: 0,
        skipped: 0,
    });
});
