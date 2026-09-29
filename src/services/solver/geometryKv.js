// services/solver/geometryKv.js
// Источник: julia, src/core/03_kv.jl, функция unpack(me::Kv). Снимок 2026-08.

const GRAD2RADIAN = Math.PI / 180;
import { geometryValidationSettings } from "./geometryValidationSettings.js";
const RADIAN2GRAD = 180 / Math.PI;

function difference(left, right) {
    return [
        left[0] - right[0],
        left[1] - right[1],
        left[2] - right[2],
    ];
}

function cross(left, right) {
    return [
        left[1] * right[2] - left[2] * right[1],
        left[2] * right[0] - left[0] * right[2],
        left[0] * right[1] - left[1] * right[0],
    ];
}

function dot(left, right) {
    return left[0] * right[0]
        + left[1] * right[1]
        + left[2] * right[2];
}

function norm(vector) {
    return Math.hypot(vector[0], vector[1], vector[2]);
}

function isVertex(vertex) {
    return Array.isArray(vertex)
        && vertex.length === 3
        && Array.from(vertex).every(Number.isFinite);
}

export const KV_GEO_FIELDS = {
    0: ["v1x","v1y","v1z","v2x","v2y","v2z","v3x","v3y","v3z","v4x","v4y","v4z",
        "v5x","v5y","v5z","v6x","v6y","v6z","v7x","v7y","v7z","v8x","v8y","v8z"],
    1: ["x1","r1","x2","r2","x3","r3","x4","r4","dvi"],
    2: ["Lx","Ly","Lz"],
    3: ["Hx","Ly","Lz","Ly2","Lz2"],
    4: ["L15","L37","Z037","DY","H","YV","ZV"],
};

export const KV_GEO_LENGTH = 24;   // zeros(REAL, 3 * 8)

// Геометрические критерии принадлежат preflight-валидации web-gui.
// Результат не зависит от масштаба, пока координаты
// численно различимы. Нормируются рёбра до векторных произведений.
export function validateKvVerticesDetailed(vertices, profile = {}) {
    const checks = {}, measurements = {};
    const { settings, invalid } = geometryValidationSettings(profile);
    const result = (extra = {}) => ({
        valid: Object.values(checks).every(Boolean),
        malformed: false, invalidSettings: false, checks, measurements, ...extra,
    });
    if (invalid.length) return result({ valid: false, invalidSettings: true });
    if (!Array.isArray(vertices) || vertices.length !== 8
        || !Array.from(vertices).every(isVertex)) {
        return result({ valid: false, malformed: true });
    }

    function measure(name, value, limit, comparison, unit) {
        measurements[name] = { value, limit, comparison, unit };
        // Только погрешность операций с углами у границы, не предметный допуск.
        const roundoff = unit === "°"
            ? 32 * Number.EPSILON * Math.max(Math.abs(value), Math.abs(limit)) : 0;
        checks[name] = Number.isFinite(value) && (
            comparison === "<=" ? value <= limit + roundoff
                : comparison === ">=" ? value + roundoff >= limit : value > limit
        );
    }

    const directions = {};
    for (const [name, i, j] of [
        ["13", 0, 2], ["24", 1, 3], ["57", 4, 6], ["68", 5, 7],
        ["15", 0, 4], ["26", 1, 5], ["37", 2, 6], ["48", 3, 7], ["12", 0, 1],
    ]) {
        const a = vertices[i], b = vertices[j], edge = difference(b, a);
        const length = norm(edge);
        // Разрешение тех координат, разность которых образует ребро.
        // Общая неизменная координата не ограничивает малые поперечные размеры.
        const coordinateScale = Math.max(...edge.map((value, d) =>
            value === 0 ? 0 : Math.max(Math.abs(a[d]), Math.abs(b[d]))));
        const resolution = Math.max(8 * Number.EPSILON * coordinateScale,
            8 * Number.MIN_VALUE);
        measure(`edge${name}`, length, resolution, ">", "мм");
        if (checks[`edge${name}`]) directions[name] = edge.map(value => value / length);
    }

    function angle(a, b) {
        return Math.atan2(norm(cross(a, b)), Math.abs(dot(a, b))) * RADIAN2GRAD;
    }
    for (const [name, left, right] of [
        ["parallel13And24", "13", "24"], ["parallel57And68", "57", "68"],
        ["parallel15And26", "15", "26"], ["parallel37And26", "37", "26"],
        ["parallel48And26", "48", "26"],
    ]) {
        if (directions[left] && directions[right]) {
            measure(name, angle(directions[left], directions[right]), settings.GEO_ANGLE, "<=", "°");
        }
    }

    if (directions["12"] && directions["24"]) {
        const a = directions["12"], b = directions["24"];
        measure("basis12And24", angle(a, b), settings.GEO_ANGLE, ">=", "°");
        const normal = cross(a, b), area = norm(normal);
        if (checks.basis12And24 && area > 0 && directions["15"]) {
            const n = normal.map(value => value / area), c = directions["15"];
            // r14 = r12+r24: знак прежнего смешанного произведения сохранён.
            // atan2 устойчив и у плоскости (0°), и у нормали (±90°).
            const beta = Math.atan2(dot(n, c), norm(cross(n, c))) * RADIAN2GRAD;
            measure("outOfPlane15", beta, settings.GEO_ANGLE, ">=", "°");
        }
    }
    return result();
}

export function validateKvVertices(vertices, profile = {}) {
    return validateKvVerticesDetailed(vertices, profile).valid;
}

// geo -> вершины [8][3] (kv38, локальная СК). Возврат { vertices, err }.
export function unpackKvVertices(geo, geoType) {
    const v = Array.from({ length: 8 }, () => [0, 0, 0]);
    let err = 0;

    // Шестигранник
    if (geoType === 0) {
        for (let k = 0; k < 8; k++) {
            v[k] = [geo[3 * k], geo[3 * k + 1], geo[3 * k + 2]];
        }
        return { vertices: v, err };
    }

    // Сектор
    if (geoType === 1) {
        const [x1, r1, x2, r2, x3, r3, x4, r4, dvi] = geo.slice(0, 9);
        const xsh = [x1, x2, x3, x4];
        const rsh = [r1, r2, r3, r4];
        const a = (dvi / 2) * GRAD2RADIAN;
        const TNG8 = Math.sin(a) / Math.cos(a);

        let kzz = 0;
        if (rsh[0] === rsh[1] && rsh[2] === rsh[3]) kzz = 1;
        if (xsh[0] === xsh[3] && xsh[1] === xsh[2]) kzz = 2;
        err = kzz === 0 ? 1 : 0;
        if (kzz === 1 && (rsh[1] >= rsh[2] || xsh[0] > xsh[1] || xsh[3] > xsh[2])) err = 2;
        if (kzz === 2 && xsh[3] >= xsh[1]) err = 21;
        if (kzz === 2 && rsh[0] > rsh[3]) err = 22;
        if (kzz === 2 && rsh[1] > rsh[2]) err = 23;
        if (err !== 0) kzz = 1;

        const MSE1 = [2, 6, 5, 1];
        const MSE2 = [7, 8, 6, 5];
        for (let i = 0; i <= 1; i++) {
            const rr = TNG8 * Math.pow(-1, i + kzz);
            for (let k = 0; k < 4; k++) {
                let m = kzz === 1 ? MSE1[k] + 2 * i : 0;
                if (kzz === 2) m = MSE2[k] - 4 * i;
                v[m - 1] = [xsh[k], rsh[k] * rr, rsh[k]];   // julia: 1-based m
            }
        }
        return { vertices: v, err };
    }

    // Прямоугольная призма
    if (geoType === 2) {
        const [Lx, Ly, Lz] = geo.slice(0, 3);
        err = Lx > 0 && Ly > 0 && Lz > 0 ? 0 : 1;
        for (const m of [2, 4, 6, 8]) v[m - 1][0] = Lx;
        for (const m of [1, 2, 3, 4]) v[m - 1][1] = Ly;
        for (const m of [3, 4, 7, 8]) v[m - 1][2] = Lz;
        return { vertices: v, err };
    }

    // Усечённая правильная пирамида
    if (geoType === 3) {
        const [Hx, Ly, Lz, Ly2, Lz2] = geo.slice(0, 5);
        err = Hx > 0 && Ly > 0 && Lz > 0 && Ly2 > 0 && Lz2 > 0
            ? 0
            : 1;
        for (const m of [1, 3, 5, 7]) v[m - 1][0] = 0;
        for (const m of [2, 4, 6, 8]) v[m - 1][0] = Hx; 
        for (const m of [1, 3]) v[m - 1][1] = Ly;
        for (const m of [5, 7]) v[m - 1][1] = 0;
        for (const m of [2, 4]) v[m - 1][1] = (Ly + Ly2) / 2;
        for (const m of [6, 8]) v[m - 1][1] = (Ly - Ly2) / 2;
        for (const m of [1, 5]) v[m - 1][2] = 0;
        for (const m of [3, 7]) v[m - 1][2] = Lz;
        for (const m of [4, 8]) v[m - 1][2] = (Lz + Lz2) / 2;
        for (const m of [2, 6]) v[m - 1][2] = (Lz - Lz2) / 2;
        return { vertices: v, err };
    }

    // Неправильная пирамида
    if (geoType === 4) {
        const [L15, L37, Z037, DY, H, YV, ZV] = geo.slice(0, 7);
        err = L15 > 0 && L37 > 0 && DY > 0 ? 0 : 1;
        for (const m of [1, 3, 5, 7]) v[m - 1][0] = 0;
        for (const m of [2, 4, 6, 8]) v[m - 1][0] = -H;
        for (const m of [1, 5]) v[m - 1][1] = 0;
        for (const m of [3, 7]) v[m - 1][1] = DY;
        for (const m of [2, 4, 6, 8]) v[m - 1][1] = YV;
        v[0][2] = L15;
        v[4][2] = 0;
        v[2][2] = Z037 + L37;
        v[6][2] = Z037;
        for (const m of [2, 4, 6, 8]) v[m - 1][2] = ZV;
        return { vertices: v, err };
    }

    return { vertices: v, err: -1 };
}

// Обратное преобразование для geoType = 0 (не запрошено и не нужно)
export function packKvVertices(vertices) {
    const geo = new Array(KV_GEO_LENGTH).fill(0);
    for (let k = 0; k < 8; k++) {
        geo[3 * k] = vertices[k][0];
        geo[3 * k + 1] = vertices[k][1];
        geo[3 * k + 2] = vertices[k][2];
    }
    return geo;
}

// Смена варианта geo: состав позиций определяется geoType; переноса значений нет.
// Источник: julia, src/core/03_kv.jl::unpack — читает geo[1:k] по типу, хвост не используется.
export function resetKvGeo(geoType) {
    return new Array(KV_GEO_LENGTH).fill(0);
}
