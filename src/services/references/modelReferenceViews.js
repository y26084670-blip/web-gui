function recordName(record, fallback) {
    const value = String(record?.name ?? "").trim();
    return value || fallback;
}

export function amplitudeReferenceRows({ models, recordIndex }) {
    const amplitudeIndex = recordIndex + 1;
    const elements = Array.isArray(models?.elements) ? models.elements : [];

    return elements.flatMap((element, index) =>
        Number(element?.indAmp) === amplitudeIndex && Number(element?.targ) !== 3
            ? [[index + 1, recordName(element, `KV ${index + 1}`)]]
            : []
    );
}

export function amplitudeReferenceSummary({ value }) {
    if (!Array.isArray(value) || value.length === 0) return "—";
    return value.map(row => row?.[0]).filter(Boolean).join(", ");
}

export function moveReferenceRows({ models, recordIndex }) {
    const moveIndex = recordIndex + 1;
    const elements = Array.isArray(models?.elements) ? models.elements : [];
    const regions = Array.isArray(models?.regions) ? models.regions : [];

    return [
        ...elements.flatMap((element, index) =>
            Number(element?.indMove) === moveIndex
                ? [["KV", index + 1, recordName(element, `KV ${index + 1}`)]]
                : []
        ),
        ...regions.flatMap((region, index) =>
            Number(region?.indMove) === moveIndex
                ? [["TK", index + 1, recordName(region, `TK ${index + 1}`)]]
                : []
        ),
    ];
}

export function moveReferenceSummary({ value }) {
    if (!Array.isArray(value) || value.length === 0) return "—";
    const kv = value.filter(row => row?.[0] === "KV").map(row => row[1]);
    const tk = value.filter(row => row?.[0] === "TK").map(row => row[1]);
    const parts = [];
    if (kv.length > 0) parts.push(`KV: ${kv.join(", ")}`);
    if (tk.length > 0) parts.push(`TK: ${tk.join(", ")}`);
    return parts.join("; ");
}

function coilDirection(record) {
    if (Number(record?.targ) !== 3) return "—";
    switch (Number(record?.indAmp)) {
        case 0: return "Поле в центре";
        case 1: return "D1";
        case 2: return "D2";
        case 3: return "D3";
        default: return `Некорректно: ${record?.indAmp}`;
    }
}

function coilBindings(records, kind) {
    if (!Array.isArray(records)) return [];
    return records.flatMap((record, index) => {
        const coil = Number(record?.indCoil);
        if (!Number.isSafeInteger(coil) || coil <= 0) return [];
        return [[
            coil,
            kind,
            index + 1,
            recordName(record, `${kind} ${index + 1}`),
            Number.isFinite(Number(record?.wCoil)) ? Number(record.wCoil) : "—",
            kind === "KV" ? coilDirection(record) : "—",
        ]];
    });
}

export function measurementCoilRows({ models }) {
    return [
        ...coilBindings(models?.elements, "KV"),
        ...coilBindings(models?.regions, "TK"),
    ].sort((left, right) =>
        left[0] - right[0]
        || left[1].localeCompare(right[1])
        || left[2] - right[2]
    );
}

export function measurementCoilSummary({ value }) {
    if (!Array.isArray(value) || value.length === 0) return "Катушки не заданы";
    const coils = new Map();
    for (const row of value) {
        const coil = row[0];
        const item = coils.get(coil) ?? { KV: 0, TK: 0 };
        item[row[1]] += 1;
        coils.set(coil, item);
    }
    return [...coils.entries()].map(([coil, counts]) =>
        `${coil} (KV: ${counts.KV}, TK: ${counts.TK})`
    ).join("; ");
}
