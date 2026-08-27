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

function pushChange(change, notifyChange = true) {
    if (!change || valuesEqual(change.before, change.after)) {
        return false;
    }

    const history = getHistory(change.schema.id, true);
    history.past.push(change);

    if (history.past.length > HISTORY_LIMIT) {
        history.past.splice(
            0,
            history.past.length - HISTORY_LIMIT,
        );
    }

    history.future.length = 0;

    if (notifyChange) {
        notify();
    }

    return true;
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
    return (getHistory(schemaId)?.past.length ?? 0) > 0;
}

function canRedo(schemaId) {
    historyRevision();
    return (getHistory(schemaId)?.future.length ?? 0) > 0;
}

function takeUndo(schemaId) {
    const history = getHistory(schemaId);
    const change = history?.past.pop();
    if (!change) return null;

    history.future.push(change);
    notify();

    return {
        schema: change.schema,
        value: cloneValue(change.before),
    };
}

function takeRedo(schemaId) {
    const history = getHistory(schemaId);
    const change = history?.future.pop();
    if (!change) return null;

    history.past.push(change);
    notify();

    return {
        schema: change.schema,
        value: cloneValue(change.after),
    };
}

function clear() {
    histories.clear();
    transactionDepth = 0;
    transactionChanges = new Map();
    notify();
}

export const modelHistoryService = {
    record,
    beginTransaction,
    endTransaction,
    canUndo,
    canRedo,
    takeUndo,
    takeRedo,
    clear,
};
