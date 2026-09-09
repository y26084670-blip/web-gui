// Source geometry follows solver 15784ff6607ecd22628f479d7c8a90f42301a855:
// task/03_nodes.jl::qcvNodesRecall and vsolver/04_mhj.jl::mhjRecall!.
// Input is BaseModel. Each MHJ row represents one independent source;
// physical symmetry images, motion and time amplitudes are not synthesized.
import { mhjRowCount, mhjRows } from "../solver/mhjLayout.js";
import {
    applyMatrix4ToPoint,
    eulerRotationMatrix4,
    multiplyMatrix4,
    rotationXMatrix4,
} from "../solver/rotation3d.js";
import { trilinearElementPoint } from "./geometryDiscretization.js";

export const SOURCE_VECTOR_LIMIT = 100_000;

function warning(code, message) {
    return { level: "warning", schemaId: "mhj", code, message };
}

function vector3(value) {
    if (!Array.isArray(value) || value.length !== 3) return null;
    const result = value.map(item => Array.isArray(item) ? item[0] : item);
    return result.every(Number.isFinite) ? result : null;
}

function instanceKey(ls, as, ps) {
    return `${ls}:${as}:${ps}`;
}

function elementContext(primitive, record) {
    if (!primitive?.discretization || !record) return null;
    const vi = vector3(record.symVi);
    if (!vi) return null;

    const instances = new Map();
    for (const instance of primitive.instances) {
        if (instance.mirrorX || instance.mirrorY) continue;
        instances.set(instanceKey(instance.ls, instance.as, instance.ps), instance);
    }

    return {
        primitive,
        record,
        instances,
        rotation: eulerRotationMatrix4(...vi),
        directionMatrices: new Map(),
        cellKey: null,
        cell: null,
    };
}

function sourceCell(context, row) {
    const key = `${row.d12}:${row.d13}:${row.d15}`;
    if (context.cellKey === key) return context.cell;

    const counts = context.primitive.discretization.counts;
    const parameters = [row.d12, row.d13, row.d15].map(
        (index, axis) => (index - 0.5) / counts[axis],
    );
    const point = (...position) => trilinearElementPoint(
        context.primitive.vertices,
        ...position,
    );
    const origin = point(...parameters);
    const edgeLengths = parameters.map((value, axis) => {
        const lower = [...parameters];
        const upper = [...parameters];
        lower[axis] = value - 0.5 / counts[axis];
        upper[axis] = value + 0.5 / counts[axis];
        const a = point(...lower);
        const b = point(...upper);
        return a && b ? Math.hypot(...a.map((coordinate, i) => b[i] - coordinate)) : 0;
    });

    context.cellKey = key;
    context.cell = { origin, characteristicSize: Math.hypot(...edgeLengths) };
    return context.cell;
}

function sourceDirection(context, localVector, ls) {
    let matrix = context.directionMatrices.get(ls);
    if (!matrix) {
        // mhjRecall! rotates the vector with VI, and with LS only when auto.
        // AS rotates its centre but does NOT rotate this independent vector.
        // Both matrices have zero translation, so this application adds none.
        matrix = context.record.auto === true
            ? multiplyMatrix4(
                context.rotation,
                rotationXMatrix4(ls * context.record.symYl),
            )
            : context.rotation;
        context.directionMatrices.set(ls, matrix);
    }
    return applyMatrix4ToPoint(matrix, localVector);
}

/** Detached, world-space arrow data; no Three.js objects or BaseModel writes. */
export function buildSourceVectorScene(scene, elements, mhj, options = {}) {
    const vectors = [];
    const diagnostics = [];
    const expectedRows = mhjRowCount(elements);
    const sourceRecords = Array.isArray(mhj) ? mhj : [];
    if (sourceRecords.length > 1) {
        diagnostics.push(warning(
            "invalid-source-records",
            "Заданные источники: ожидается одна запись с таблицей векторов.",
        ));
        return { vectors, diagnostics, truncated: false };
    }

    const values = sourceRecords[0]?.v ?? [];
    if (!Array.isArray(values)) {
        diagnostics.push(warning(
            "invalid-source-table",
            "Заданные источники: значение v не является таблицей векторов.",
        ));
        return { vectors, diagnostics, truncated: false };
    }
    if (values.length !== expectedRows) {
        diagnostics.push(warning(
            "source-row-count",
            `Заданные источники: строк в таблице — ${values.length}, `
                + `независимых объёмов — ${expectedRows}. `
                + "Показываются только строки с соответствующим объёмом.",
        ));
    }

    const limit = Number.isSafeInteger(options.limit) && options.limit >= 0
        ? Math.min(options.limit, SOURCE_VECTOR_LIMIT)
        : SOURCE_VECTOR_LIMIT;
    const matchedCount = Math.min(values.length, expectedRows);
    const truncated = matchedCount > limit;
    // Index rows before visibility filters or skipping unusable geometry.
    // Those operations must never shift values to a subsequent volume.
    const rows = mhjRows(elements, { limit: Math.min(values.length, limit) });
    const primitives = new Map(
        (scene?.primitives ?? [])
            .filter(primitive => primitive.kind === "element-volume")
            .map(primitive => [primitive.source.recordIndex, primitive]),
    );
    const contexts = new Map();
    let invalidValues = 0;
    let invalidGeometry = 0;

    rows.forEach((row, sourceRowIndex) => {
        const localVector = values[sourceRowIndex];
        if (!Array.isArray(localVector) || localVector.length !== 3
            || !localVector.every(Number.isFinite)) {
            invalidValues++;
            return;
        }
        const magnitude = Math.hypot(...localVector);
        if (!Number.isFinite(magnitude)) {
            invalidValues++;
            return;
        }
        if (magnitude === 0) return;

        const recordIndex = row.kv - 1;
        if (!contexts.has(recordIndex)) {
            contexts.set(recordIndex, elementContext(
                primitives.get(recordIndex),
                elements?.[recordIndex],
            ));
        }
        const context = contexts.get(recordIndex);
        const instance = context?.instances.get(instanceKey(
            row.ls - 1, row.as - 1, row.ps - 1,
        ));
        if (!instance) return; // The base scene already explains a skipped element.

        const cell = sourceCell(context, row);
        const origin = cell.origin && applyMatrix4ToPoint(instance.matrix, cell.origin);
        const vector = sourceDirection(context, localVector, row.ls - 1);
        if (!origin?.every(Number.isFinite) || !vector.every(Number.isFinite)
            || !Number.isFinite(cell.characteristicSize) || cell.characteristicSize <= 0) {
            invalidGeometry++;
            return;
        }

        vectors.push({
            source: { ...context.primitive.source },
            sourceRowIndex,
            volumeIndex: row.eoLocal,
            kind: row.targ === 1 ? "magnetization" : "current",
            origin,
            vector,
            magnitude,
            characteristicSize: cell.characteristicSize,
            instance: {
                ls: instance.ls,
                as: instance.as,
                ps: instance.ps,
                mirrorX: 0,
                mirrorY: 0,
            },
        });
    });

    if (invalidValues) {
        diagnostics.push(warning(
            "invalid-source-values",
            `Заданные источники: пропущено строк с некорректными компонентами — ${invalidValues}.`,
        ));
    }
    if (invalidGeometry) {
        diagnostics.push(warning(
            "invalid-source-geometry",
            `Заданные источники: невозможно построить стрелку для ${invalidGeometry} объёмов.`,
        ));
    }
    return { vectors, diagnostics, truncated };
}
