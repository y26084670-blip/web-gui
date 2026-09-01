const SOURCE_LABELS = Object.freeze({
    elements: "Элемент",
    regions: "Область",
});

const COORDINATE_NAMES = Object.freeze(["X", "Y", "Z"]);
const EXPONENTIAL_UPPER_BOUND = 1e6;
const EXPONENTIAL_LOWER_BOUND = 1e-4;
const COORDINATE_SIGNIFICANT_DIGITS = 7;

function sourceLabel(source) {
    return SOURCE_LABELS[source?.schemaId] ?? "Объект";
}

function oneBasedIndex(value) {
    return Number.isSafeInteger(value) && value >= 0
        ? String(value + 1)
        : "?";
}

function sourceName(source) {
    return typeof source?.name === "string" ? source.name.trim() : "";
}

function displayedSymmetryIndex(value) {
    const index = Number(value);
    return Number.isSafeInteger(index) && index > 0 ? index + 1 : null;
}

export function formatSymmetryInstance(instance) {
    const labels = [];
    const axial = displayedSymmetryIndex(instance?.as);
    const periodic = displayedSymmetryIndex(instance?.ps);
    const local = displayedSymmetryIndex(instance?.ls);

    if (axial !== null) labels.push(`AS=${axial}`);
    if (periodic !== null) labels.push(`PS=${periodic}`);
    if (local !== null) labels.push(`LS=${local}`);
    if (Number(instance?.mirrorX) > 0) labels.push("EX");
    if (Number(instance?.mirrorY) > 0) labels.push("EY");

    return labels.length > 0 ? `[${labels.join(" ")}]` : "";
}

function sourceIdentity(source, instance) {
    const prefix = `${sourceLabel(source)} №${oneBasedIndex(source?.recordIndex)}`;
    const symmetry = formatSymmetryInstance(instance);
    return symmetry ? `${prefix} ${symmetry}` : prefix;
}

function trimExponential(value) {
    const [rawMantissa, rawExponent] = value.toLowerCase().split("e");
    const mantissa = rawMantissa
        .replace(/(\.\d*?[1-9])0+$/u, "$1")
        .replace(/\.0+$/u, "");
    const exponent = rawExponent.replace(/^([+-])0+(\d)/u, "$1$2");
    return `${mantissa}e${exponent}`;
}

function formatCoordinate(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    if (value === 0) return "0";

    const absolute = Math.abs(value);
    if (
        absolute >= EXPONENTIAL_UPPER_BOUND
        || absolute < EXPONENTIAL_LOWER_BOUND
    ) {
        return trimExponential(
            value.toExponential(COORDINATE_SIGNIFICANT_DIGITS - 1),
        );
    }

    return String(Number(value.toPrecision(COORDINATE_SIGNIFICANT_DIGITS)));
}

/**
 * Formats the tooltip for a scene primitive source.
 * `source.recordIndex` follows the zero-based BaseModel convention.
 */
export function formatGeometryTooltip(source, instance) {
    const prefix = sourceIdentity(source, instance);
    const name = sourceName(source);
    return name ? `${prefix} — ${name}` : prefix;
}

/**
 * Formats the tooltip for a vertex. Both record and vertex indices are
 * zero-based; coordinates can be an Array or any indexable typed array.
 */
export function formatVertexTooltip(
    source,
    vertexIndex,
    coordinates,
    instance,
) {
    const prefix = sourceIdentity(source, instance);
    const vertex = oneBasedIndex(vertexIndex);
    const formattedCoordinates = COORDINATE_NAMES.map(
        (name, index) => `${name}=${formatCoordinate(coordinates?.[index])}`,
    ).join("; ");

    return `${prefix}, вершина №${vertex} — ${formattedCoordinates}`;
}

export function geometryHitInstance(hit) {
    const pick = hit?.object?.userData?.pick;
    const instances = pick?.instances;
    const span = pick?.span;
    if (!Array.isArray(instances) || !Number.isSafeInteger(span) || span <= 0) {
        return null;
    }

    const hitIndex = pick.kind === "mesh" ? hit?.faceIndex : hit?.index;
    if (!Number.isSafeInteger(hitIndex) || hitIndex < 0) return null;

    return instances[Math.floor(hitIndex / span)] ?? null;
}

export function vertexHitMetadata(range, globalIndex) {
    if (
        !range ||
        !Number.isSafeInteger(globalIndex) ||
        globalIndex < range.start ||
        globalIndex >= range.end ||
        !Number.isSafeInteger(range.sourceVertexCount) ||
        range.sourceVertexCount <= 0 ||
        !Array.isArray(range.instances)
    ) {
        return null;
    }

    const localIndex = globalIndex - range.start;
    const instanceIndex = Math.floor(localIndex / range.sourceVertexCount);
    const instance = range.instances[instanceIndex];
    if (!instance) return null;

    return {
        instance,
        vertexIndex: localIndex % range.sourceVertexCount,
    };
}

/**
 * Finds a metadata range containing `globalIndex` in a sorted range list.
 * Ranges use a half-open interval: `{ start, end, ...metadata }` means
 * `start <= globalIndex < end`.
 */
export function findVertexMetadataRange(ranges, globalIndex) {
    if (
        !Array.isArray(ranges)
        || !Number.isSafeInteger(globalIndex)
        || globalIndex < 0
    ) {
        return null;
    }

    let lower = 0;
    let upper = ranges.length - 1;

    while (lower <= upper) {
        const middle = lower + Math.floor((upper - lower) / 2);
        const range = ranges[middle];
        const start = range?.start;
        const end = range?.end;

        if (
            !Number.isSafeInteger(start)
            || !Number.isSafeInteger(end)
            || start < 0
            || end <= start
        ) {
            return null;
        }

        if (globalIndex < start) {
            upper = middle - 1;
        } else if (globalIndex >= end) {
            lower = middle + 1;
        } else {
            return range;
        }
    }

    return null;
}
