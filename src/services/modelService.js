import { batch, createSignal } from "solid-js";
import { recomputeModel } from "./model/modelCompute";
import { modelHistoryService } from "./modelHistoryService";
import { unsavedChangesService } from "./unsavedChangesService.js";

const [model, setModel] = createSignal({});
const [partUpdates, setPartUpdates] = createSignal({});

const historySource = Symbol("model-history");
let nextRevision = 0;

function setModelParts(parts, {source=null,recordHistory=false}={}) {
    if(!parts.length || parts.some(p=>!p.schema?.id)
        || new Set(parts.map(p=>p.schema.id)).size!==parts.length)throw new Error("Ожидались разные вкладки модели.");
    // Prepare every part before publishing or recording anything.
    const current=model();
    const updates=parts.map(({schema,data})=>{
        const computation=recomputeModel(schema,data);
        return {schema,before:current[schema.id],update:{data:computation.model,
            revision:++nextRevision,source,computedPatches:computation.patches}};
    });
    batch(()=>{
        if(recordHistory) {
            if(updates.length===1){const p=updates[0];modelHistoryService.record(p.schema,p.before,p.update.data);}
            else modelHistoryService.recordGroup(updates.map(p=>({schema:p.schema,before:p.before,after:p.update.data})));
        }
        setModel(old=>({...old,...Object.fromEntries(updates.map(p=>[p.schema.id,p.update.data]))}));
        setPartUpdates(old=>({...old,...Object.fromEntries(updates.map(p=>[p.schema.id,p.update]))}));
        for(const p of updates)unsavedChangesService.setCurrent(p.schema.id,p.update.data);
    });
    return updates.map(p=>p.update);
}

function setModelPart(schema,data,options={}) {
    if(!schema?.id)throw new Error("setModelPart requires a schema.");
    return setModelParts([{schema,data}],options)[0];
}

// Read-only task attachment: part of the immutable snapshot and revision,
// but not a tab, editable history item, dirty value or serialization target.
function setJweakLocal(data) {
    batch(() => {
        const update = { data, revision: ++nextRevision, source: null, computedPatches: [] };
        setModel(current => ({ ...current, jweakLocal: data }));
        setPartUpdates(current => ({ ...current, jweakLocal: update }));
    });
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

    setModelParts((change.changes??[change]).map(c=>({schema:c.schema,data:c.value})),{source:historySource});
    return true;
}

function redo(schemaId) {
    const change = modelHistoryService.takeRedo(schemaId);
    if (!change) return false;

    setModelParts((change.changes??[change]).map(c=>({schema:c.schema,data:c.value})),{source:historySource});
    return true;
}

export const modelService = {
    getModel,
    getModelPartUpdate,
    setModelPart,
    setModelParts,
    setJweakLocal,
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
