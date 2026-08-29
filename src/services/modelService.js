import { batch, createSignal } from "solid-js";
import { recomputeModel } from "./model/modelCompute";
import { modelHistoryService } from "./modelHistoryService";
import { unsavedChangesService } from "./unsavedChangesService.js";

const [model, setModel] = createSignal({});
const [partUpdates, setPartUpdates] = createSignal({});

const historySource = Symbol("model-history");
let nextRevision = 0;

function setModelPart(
    schema,
    data,
    {
        source = null,
        recordHistory = false,
    } = {},
) {
    if (!schema?.id) {
        throw new Error("setModelPart requires a schema.");
    }

    const before = model()[schema.id];

    // Нормализация выполняется до единственной публикации revision.
    const computation = recomputeModel(schema, data);
    const update = {
        data: computation.model,
        revision: ++nextRevision,
        source,
        computedPatches: computation.patches,
    };

    batch(() => {
        setModel(current => ({
            ...current,
            [schema.id]: update.data,
        }));

        setPartUpdates(current => ({
            ...current,
            [schema.id]: update,
        }));
    });

    if (recordHistory) {
        modelHistoryService.record(
            schema,
            before,
            update.data,
        );
    }

    unsavedChangesService.setCurrent(schema.id, update.data);

    return update;
}

function clearModel({ source = null } = {}) {
    const ids = new Set([
        ...Object.keys(model()),
        ...Object.keys(partUpdates()),
    ]);

    modelHistoryService.clear();

    batch(() => {
        setModel({});

        if (ids.size === 0) return;

        setPartUpdates(current => {
            const updates = { ...current };

            for (const id of ids) {
                updates[id] = {
                    data: null,
                    revision: ++nextRevision,
                    source,
                    computedPatches: [],
                };
            }

            return updates;
        });
    });

    unsavedChangesService.clear();
}

function getModel() {
    return model();
}

function getModelPartUpdate(id) {
    return partUpdates()[id];
}

function undo(schemaId) {
    const change = modelHistoryService.takeUndo(schemaId);
    if (!change) return false;

    setModelPart(
        change.schema,
        change.value,
        { source: historySource },
    );
    return true;
}

function redo(schemaId) {
    const change = modelHistoryService.takeRedo(schemaId);
    if (!change) return false;

    setModelPart(
        change.schema,
        change.value,
        { source: historySource },
    );
    return true;
}

export const modelService = {
    getModel,
    getModelPartUpdate,
    setModelPart,
    clearModel,
    undo,
    redo,
    canUndo: modelHistoryService.canUndo,
    canRedo: modelHistoryService.canRedo,
    beginHistoryTransaction:
        modelHistoryService.beginTransaction,
    endHistoryTransaction:
        modelHistoryService.endTransaction,
};
