import { createSignal } from "solid-js";

const HISTORY_LIMIT = 100;

const histories = new Map();
const [historyRevision, setHistoryRevision] = createSignal(0);

let transactionDepth = 0;
let transactionChanges = new Map();

function notify() {
    setHistoryRevision(value => value + 1);
}

function cloneValue(value) {
    return value === undefined
        ? undefined
        : structuredClone(value);
}

function valuesEqual(left, right) {
    if (Object.is(left, right)) return true;
    return JSON.stringify(left) === JSON.stringify(right);
}

function getHistory(schemaId, create = false) {
    if (!schemaId) return null;

    let history = histories.get(schemaId);

    if (!history && create) {
        history = {
            past: [],
            future: [],
        };
        histories.set(schemaId, history);
    }

    return history ?? null;
}

function createChange(schema, before, after) {
    if (!schema?.id || valuesEqual(before, after)) {
        return null;
    }

    return {
        schema,
        before: cloneValue(before),
        after: cloneValue(after),
    };
}

const parts=entry=>entry?.changes ?? (entry?[entry]:[]);
function clearFutures(ids) {
    const pending=[...ids],seen=new Set();
    while(pending.length) {
        const id=pending.pop();if(seen.has(id))continue;seen.add(id);
        const h=getHistory(id);if(!h)continue;
        for(const entry of h.future)if(entry.changes)pending.push(...entry.changes.map(c=>c.schema.id));
        h.future.length=0;
    }
}
function trimThrough(entry) {
    for(const change of parts(entry)) {
        const h=getHistory(change.schema.id),index=h?.past.indexOf(entry)??-1;
        if(index<0)continue;
        const removed=h.past.splice(0,index+1);
        for(const old of removed)if(old.changes)trimThrough(old);
    }
}
function pushEntry(entry,notifyChange=true) {
    const ids=parts(entry).map(c=>c.schema.id);
    clearFutures(ids);
    for(const id of ids)getHistory(id,true).past.push(entry);
    for(const id of ids){const h=getHistory(id);while(h.past.length>HISTORY_LIMIT)trimThrough(h.past[0]);}
    if(notifyChange)notify();
    return true;
}
function recordGroup(changes) {
    const prepared=changes.map(c=>createChange(c.schema,c.before,c.after)).filter(Boolean);
    if(!prepared.length)return;
    if(transactionDepth)throw new Error("Групповая операция недоступна внутри независимой транзакции.");
    if(new Set(prepared.map(c=>c.schema.id)).size!==prepared.length)throw new Error("Повтор вкладки в группе истории.");
    pushEntry(prepared.length===1?prepared[0]:{changes:prepared});
}

function pushChange(change, notifyChange = true) {
    if (!change || valuesEqual(change.before, change.after)) {
        return false;
    }

    return pushEntry(change,notifyChange);
}

function record(schema, before, after) {
    const change = createChange(schema, before, after);
    if (!change) return;

    if (transactionDepth > 0) {
        const current = transactionChanges.get(schema.id);

        if (current) {
            current.after = change.after;
        } else {
            transactionChanges.set(schema.id, change);
        }
        return;
    }

    pushChange(change);
}

function beginTransaction() {
    if (transactionDepth === 0) {
        transactionChanges = new Map();
    }

    transactionDepth += 1;
}

function endTransaction() {
    if (transactionDepth === 0) return;

    transactionDepth -= 1;
    if (transactionDepth > 0) return;

    const changes = [...transactionChanges.values()];
    transactionChanges = new Map();

    let changed = false;
    for (const change of changes) {
        changed = pushChange(change, false) || changed;
    }

    if (changed) {
        notify();
    }
}

function canUndo(schemaId) {
    historyRevision();
    return canTake(schemaId,"past");
}

function canRedo(schemaId) {
    historyRevision();
    return canTake(schemaId,"future");
}

function canTake(schemaId,stack) {
    const entry=getHistory(schemaId)?.[stack].at(-1);
    return !!entry && parts(entry).every(c=>getHistory(c.schema.id)?.[stack].at(-1)===entry);
}
function take(schemaId,from,to,value) {
    if(!canTake(schemaId,from))return null;
    const entry=getHistory(schemaId)[from].at(-1);
    for(const c of parts(entry)){const h=getHistory(c.schema.id);h[from].pop();h[to].push(entry);}
    notify();
    const values=parts(entry).map(c=>({schema:c.schema,value:cloneValue(c[value])}));
    return entry.changes?{changes:values}:values[0];
}

function takeUndo(schemaId) {
    return take(schemaId,"past","future","before");
}

function takeRedo(schemaId) {
    return take(schemaId,"future","past","after");
}

function clear(schemaId = null) {
    if (schemaId) {
        const related=new Set([schemaId]);
        for(const id of related)for(const entry of [...(getHistory(id)?.past??[]),...(getHistory(id)?.future??[])])
            if(entry.changes)for(const c of entry.changes)related.add(c.schema.id);
        for(const id of related)if(id!==schemaId){histories.delete(id);transactionChanges.delete(id);}
        const historyChanged = histories.delete(schemaId);
        const transactionChanged = transactionChanges.delete(schemaId);
        const changed = historyChanged || transactionChanged;
        if (changed) notify();
        return;
    }

    histories.clear();
    transactionDepth = 0;
    transactionChanges = new Map();
    notify();
}

export const modelHistoryService = {
    record,
    recordGroup,
    beginTransaction,
    endTransaction,
    canUndo,
    canRedo,
    takeUndo,
    takeRedo,
    clear,
};
