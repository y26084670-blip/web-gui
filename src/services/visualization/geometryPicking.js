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
export function formatGeometryTooltip(source) {
    const prefix = `${sourceLabel(source)} №${oneBasedIndex(source?.recordIndex)}`;
    const name = sourceName(source);
    return name ? `${prefix} — ${name}` : prefix;
}

/**
 * Formats the tooltip for a vertex. Both record and vertex indices are
 * zero-based; coordinates can be an Array or any indexable typed array.
 */
export function formatVertexTooltip(source, vertexIndex, coordinates) {
    const prefix = `${sourceLabel(source)} №${oneBasedIndex(source?.recordIndex)}`;
    const vertex = oneBasedIndex(vertexIndex);
    const formattedCoordinates = COORDINATE_NAMES.map(
        (name, index) => `${name}=${formatCoordinate(coordinates?.[index])}`,
    ).join("; ");

    return `${prefix}, вершина №${vertex} — ${formattedCoordinates}`;
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
