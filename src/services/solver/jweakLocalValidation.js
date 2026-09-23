// Supported contract: solver/src/task/05_taskData.jl::read3XX and
// src/vsolver/02_current_weak.jl::weakCurrentSpace / weakCellBounds.
// No weak matrices, child-volume enumeration or alternative MED matcher.
export const JWEAK_LOCAL_FILE = "jweak_local.json";
export const JWEAK_STRUCTURE_NOTICE = "jweak_local.json: состав и порядок ШГ зафиксированы. "
    + "Добавление, удаление, вставка и перемещение записей недоступны; "
    + "родительская сетка в редакторе не изменяется.";

const triple = value => Array.isArray(value) && value.length === 3
    && value.every(x => Number.isSafeInteger(x) && x > 0);
const vector = value => Array.isArray(value)
    ? value.map(x => Array.isArray(x) && x.length === 1 ? x[0] : x) : null;
const equal = (a, b) => a.every((x, i) => x === b[i]);

export function parseJweakLocal(text) {
    const spec = JSON.parse(text.replace(/^\uFEFF/u, ""));
    assertJweakLocalSpec(spec);
    return spec;
}

function assertJweakLocalSpec(spec) {
    if (!spec || typeof spec !== "object" || Array.isArray(spec) || spec.version !== 1) {
        throw new Error(`${JWEAK_LOCAL_FILE}: ожидается объект с version=1.`);
    }
    if (!Array.isArray(spec.coarse_divisions) || !spec.coarse_divisions.every(triple)) {
        throw new Error(`${JWEAK_LOCAL_FILE}: coarse_divisions должен содержать тройки положительных целых чисел.`);
    }
}

// A missing section is permitted for standalone callers with ordinary models.
// App always publishes loading/absent/ready/error for an actual loaded task.
export function jweakLocalLocksStructure(section) {
    return section !== undefined && section !== null && section.status !== "absent";
}

export function validateJweakLocal(model) {
    const section = model.jweakLocal;
    const result = { hierarchical: false, divisions: null, refinedBlocks: [], errors: [] };
    const fail = (code, message, block) => result.errors.push({
        code, message, elements: block === undefined ? [] : [block], faces: [],
    });
    if (!section || section.status === "absent") return result;
    if (section.status !== "ready") {
        fail("JWEAK_LOCAL_UNAVAILABLE", section.error
            || `${JWEAK_LOCAL_FILE}: описание иерархии ещё не загружено; проверка не завершена.`);
        return result;
    }
    try { assertJweakLocalSpec(section.data); }
    catch (error) { fail("JWEAK_LOCAL_FORMAT", error.message); return result; }
    const divisions = section.data.coarse_divisions;
    if (!Array.isArray(model.elements) || divisions.length !== model.elements.length) {
        fail("JWEAK_LOCAL_COUNT", `${JWEAK_LOCAL_FILE}: число строк coarse_divisions (${divisions.length}) `
            + `не соответствует числу ШГ (${model.elements?.length ?? 0}).`);
        return result;
    }
    result.hierarchical = true;
    result.divisions = divisions;
    model.elements.forEach((row, index) => {
        const block = index + 1, parent = divisions[index], actual = vector(row?.dp);
        if (!triple(actual) || !Number.isSafeInteger(actual.reduce((a, b) => a * b, 1))
            || !Number.isSafeInteger(parent.reduce((a, b) => a * b, 1))) {
            fail("JWEAK_LOCAL_DP", `ШГ №${block}: некорректное разбиение dp или слишком большое число ЭО.`, block);
            return;
        }
        if (row.targ !== 0) {
            if (!equal(parent, actual)) fail("JWEAK_LOCAL_SOURCE", `ШГ №${block}: `
                + "родительское разбиение заданного источника/виртуального ШГ должно совпадать с dp.", block);
            return;
        }
        if (!(Number.isFinite(row.rv) && row.rv > 0)) {
            fail("JWEAK_LOCAL_MATERIAL", `ШГ №${block}: иерархический режим требует проводящих неизвестных ШГ.`, block);
        }
        if (!equal(parent, actual)) {
            if (parent[0] !== 1 || parent[1] !== 1 || parent[2] !== actual[2]
                || actual[0] !== 3 || actual[1] !== 3) {
                fail("JWEAK_LOCAL_REFINEMENT", `ШГ №${block}: dp=[${actual}] не является `
                    + `допустимым уточнением родителя [${parent}]; требуется [1,1,nz] → [3,3,nz].`, block);
            } else result.refinedBlocks.push(block);
        }
        // weakCellBounds requires multiplicity=1. Explicit geometrical images
        // remain subject to the same Cartesian vertex check below.
        if (model.general?.mirrorSymmetryX !== -1 || model.general?.mirrorSymmetryY !== -1
            || (row.symAs > 1 && row.symKya !== 0) || (row.symPs > 1 && row.symKyp !== 0)) {
            fail("JWEAK_LOCAL_IMAGES", `ШГ №${block}: иерархия не поддерживает зеркальные или свёрнутые токовые образы.`, block);
        }
    });
    return result;
}

// A regular trilinear subdivision of this indexed Cartesian box partitions
// every parent by construction. Do not allocate all daughter cells to prove it.
export function isJweakLocalCartesian(vertices, doubleFloat) {
    const lower = [0, 1, 2].map(d => Math.min(...vertices.map(p => p[d])));
    const upper = [0, 1, 2].map(d => Math.max(...vertices.map(p => p[d])));
    const scale = Math.max(...vertices.flat().map(Math.abs), ...upper.map((x, d) => x - lower[d]));
    const tolerance = 64 * (doubleFloat ? Number.EPSILON : 2 ** -23) * scale;
    return vertices.length === 8 && lower.every((x, d) => upper[d] - x > tolerance)
        && vertices.every((point, vertex) => point.every((x, d) => Number.isFinite(x)
            && Math.abs(x - ((vertex >> d) & 1 ? upper[d] : lower[d])) <= tolerance));
}
