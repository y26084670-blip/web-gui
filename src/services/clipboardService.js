import { createSignal } from "solid-js";

const [clipboard, setClipboard] = createSignal(null);

export const clipboardService = {

    set(table, rows) {
        setClipboard({
            schemaId: table._gui.schema.id,
            rows: structuredClone(rows),
        });
    },

    get() {
        return clipboard();
    },

    hasData() {
        const data = clipboard();
        return !!(data && data.rows.length);
    },

    isCompatible(table) {
        const data = clipboard();
        return !!(
            data &&
            data.schemaId === table._gui.schema.id
        );
    },

    clear() {
        setClipboard(null);
    },

};