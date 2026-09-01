export const GEOMETRY_MATERIAL_KINDS = Object.freeze({
    FMM_INSULATING: "fmm-insulating",
    FMM_CONDUCTIVE: "fmm-conductive",
    NONMAGNETIC_CONDUCTIVE: "nonmagnetic-conductive",
    HTSC_MAGNETIC: "htsc-magnetic",
    HTSC_CURRENT: "htsc-current",
    HTSC_BOTH: "htsc-both",
    PRESCRIBED_MAGNETIZATION: "prescribed-magnetization",
    PRESCRIBED_CURRENT: "prescribed-current",
    VIRTUAL: "virtual",
    NEUTRAL: "neutral",
});

const KINDS = new Set(Object.values(GEOMETRY_MATERIAL_KINDS));

// `copy` is the canonical category color. The original geometry is slightly
// darker so it remains distinguishable without assigning symmetry images a
// separate hue. Edge colors are opaque and intentionally darker; virtual
// volumes are the explicit white-fill/black-edge exception.
export const GEOMETRY_MATERIAL_PALETTE = Object.freeze({
    [GEOMETRY_MATERIAL_KINDS.FMM_INSULATING]: Object.freeze({
        copy: 0x1e3a8a,
        original: 0x172c69,
        edge: 0x0f1d45,
    }),
    [GEOMETRY_MATERIAL_KINDS.FMM_CONDUCTIVE]: Object.freeze({
        copy: 0x166534,
        original: 0x104b27,
        edge: 0x0b351c,
    }),
    [GEOMETRY_MATERIAL_KINDS.NONMAGNETIC_CONDUCTIVE]: Object.freeze({
        copy: 0x991b1b,
        original: 0x741414,
        edge: 0x4f0e0e,
    }),
    [GEOMETRY_MATERIAL_KINDS.HTSC_MAGNETIC]: Object.freeze({
        copy: 0x5b21b6,
        original: 0x45198a,
        edge: 0x301161,
    }),
    [GEOMETRY_MATERIAL_KINDS.HTSC_CURRENT]: Object.freeze({
        copy: 0xc4b5fd,
        original: 0xa394d9,
        edge: 0x74689f,
    }),
    [GEOMETRY_MATERIAL_KINDS.HTSC_BOTH]: Object.freeze({
        copy: 0x151515,
        original: 0x000000,
        edge: 0x000000,
    }),
    [GEOMETRY_MATERIAL_KINDS.PRESCRIBED_MAGNETIZATION]: Object.freeze({
        copy: 0x7dd3fc,
        original: 0x60aed3,
        edge: 0x3e7894,
    }),
    [GEOMETRY_MATERIAL_KINDS.PRESCRIBED_CURRENT]: Object.freeze({
        copy: 0xfca5a5,
        original: 0xd48686,
        edge: 0x965c5c,
    }),
    [GEOMETRY_MATERIAL_KINDS.VIRTUAL]: Object.freeze({
        copy: 0xffffff,
        original: 0xe6e6e6,
        edge: 0x000000,
    }),
    [GEOMETRY_MATERIAL_KINDS.NEUTRAL]: Object.freeze({
        copy: 0x6b7280,
        original: 0x515761,
        edge: 0x30343a,
    }),
});

function normalizedKind(kind) {
    return KINDS.has(kind) ? kind : GEOMETRY_MATERIAL_KINDS.NEUTRAL;
}

function enabled(value, fallback = true) {
    if (value === undefined || value === null) return fallback;
    return value === true || value === 1;
}

/**
 * Classifies one element record without mutating the BaseModel.
 *
 * `targ` has precedence over the material model because prescribed sources
 * and virtual volumes do not use the ordinary FMM/HTSC material semantics.
 */
export function classifyGeometryMaterial(record = {}, general = {}) {
    const targ = Number(record?.targ);

    if (targ === 3) return GEOMETRY_MATERIAL_KINDS.VIRTUAL;
    if (targ === 2) return GEOMETRY_MATERIAL_KINDS.PRESCRIBED_CURRENT;
    if (targ === 1) {
        return GEOMETRY_MATERIAL_KINDS.PRESCRIBED_MAGNETIZATION;
    }

    if (Number(record?.model) === 2) {
        const magnetic = enabled(general?.htcMu);
        const current = enabled(general?.htcRo);

        if (magnetic && current) return GEOMETRY_MATERIAL_KINDS.HTSC_BOTH;
        if (magnetic) return GEOMETRY_MATERIAL_KINDS.HTSC_MAGNETIC;
        if (current) return GEOMETRY_MATERIAL_KINDS.HTSC_CURRENT;
        return GEOMETRY_MATERIAL_KINDS.NEUTRAL;
    }

    // model=1 has no separate requested viewer color; keeping it in this
    // total xapName/rv branch does not imply solver support for that model.
    const hasMaterial = String(record?.xapName ?? "").trim().length > 0;
    const conductive = Number(record?.rv) > 0;

    if (hasMaterial && conductive) {
        return GEOMETRY_MATERIAL_KINDS.FMM_CONDUCTIVE;
    }
    if (hasMaterial) return GEOMETRY_MATERIAL_KINDS.FMM_INSULATING;
    if (conductive) {
        return GEOMETRY_MATERIAL_KINDS.NONMAGNETIC_CONDUCTIVE;
    }
    return GEOMETRY_MATERIAL_KINDS.NEUTRAL;
}

export function geometryMaterialColor(kind, original = false) {
    const palette = GEOMETRY_MATERIAL_PALETTE[normalizedKind(kind)];
    return original ? palette.original : palette.copy;
}

export function geometryMaterialEdgeColor(kind) {
    return GEOMETRY_MATERIAL_PALETTE[normalizedKind(kind)].edge;
}

export function geometryMaterialStyle(kind, original = false) {
    return {
        color: geometryMaterialColor(kind, original),
        edgeColor: geometryMaterialEdgeColor(kind),
    };
}
