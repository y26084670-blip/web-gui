import { createSignal } from "solid-js";

const modelStates = new Map();
const explicitDirtyTabs = new Set();
const [revision, setRevision] = createSignal(0);

function requireTabId(tabId) {
    if (typeof tabId !== "string" || tabId.length === 0) {
        throw new TypeError("unsavedChangesService: tabId должен быть непустой строкой.");
    }
    return tabId;
}

function fingerprint(value) {
    if (value === undefined) return "undefined";
    return JSON.stringify(value);
}

function notify() {
    setRevision(value => value + 1);
}

function stateFor(tabId) {
    const id = requireTabId(tabId);
    let state = modelStates.get(id);
    if (!state) {
        state = {
            hasBaseline: false,
            baseline: null,
            hasCurrent: false,
            current: null,
        };
        modelStates.set(id, state);
    }
    return state;
}

function setCurrent(tabId, value) {
    const state = stateFor(tabId);
    const next = fingerprint(value);
    if (state.hasCurrent && state.current === next) return;
    state.hasCurrent = true;
    state.current = next;
    notify();
}

function setBaseline(tabId, value) {
    const state = stateFor(tabId);
    const next = fingerprint(value);
    if (state.hasBaseline && state.baseline === next) return;
    state.hasBaseline = true;
    state.baseline = next;
    notify();
}

function setExplicitDirty(tabId, dirty) {
    const id = requireTabId(tabId);
    const changed = dirty
        ? !explicitDirtyTabs.has(id)
        : explicitDirtyTabs.has(id);
    if (!changed) return;
    if (dirty) {
        explicitDirtyTabs.add(id);
    } else {
        explicitDirtyTabs.delete(id);
    }
    notify();
}

function isDirty(tabId) {
    revision();
    const id = requireTabId(tabId);
    if (explicitDirtyTabs.has(id)) return true;
    const state = modelStates.get(id);
    return Boolean(
        state?.hasBaseline
        && state.hasCurrent
        && state.baseline !== state.current,
    );
}

function dirtyTabIds(order = []) {
    revision();
    const dirty = new Set([
        ...explicitDirtyTabs,
        ...[...modelStates.keys()].filter(id => isDirty(id)),
    ]);
    const ordered = [];
    for (const id of order) {
        if (!dirty.delete(id)) continue;
        ordered.push(id);
    }
    return [...ordered, ...dirty];
}

function hasDirty() {
    return dirtyTabIds().length > 0;
}

function clear(tabId = null) {
    if (tabId === null) {
        const changed = modelStates.size > 0 || explicitDirtyTabs.size > 0;
        modelStates.clear();
        explicitDirtyTabs.clear();
        if (changed) notify();
        return;
    }

    const id = requireTabId(tabId);
    const modelChanged = modelStates.delete(id);
    const explicitChanged = explicitDirtyTabs.delete(id);
    const changed = modelChanged || explicitChanged;
    if (changed) notify();
}

export const unsavedChangesService = Object.freeze({
    setCurrent,
    setBaseline,
    setExplicitDirty,
    isDirty,
    dirtyTabIds,
    hasDirty,
    clear,
});
