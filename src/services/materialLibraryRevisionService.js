import { createSignal } from "solid-js";

const [revision, setRevision] = createSignal(0);

export const materialLibraryRevisionService = Object.freeze({
    revision,
    notifyChanged() {
        setRevision(value => value + 1);
    },
});
