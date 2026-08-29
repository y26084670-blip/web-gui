import { createSignal } from "solid-js";

const revisions = new Map();

function state(kind) {
    if (typeof kind !== "string" || kind.length === 0) {
        throw new Error("Не задан вид библиотеки характеристик.");
    }
    if (!revisions.has(kind)) {
        revisions.set(kind, createSignal(0));
    }
    return revisions.get(kind);
}

export const materialLibraryRevisionService = Object.freeze({
    revision(kind) {
        const [revision] = state(kind);
        return revision();
    },
    notifyChanged(kind) {
        const [, setRevision] = state(kind);
        setRevision(value => value + 1);
    },
});
