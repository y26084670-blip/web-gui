import { createSignal } from "solid-js";

const [activeTable, setActiveTableSignal] = createSignal(null);
const [selectionRevision, setSelectionRevision] = createSignal(0);

export const selectionContextService = {
    setActiveTable(table) {
        if (activeTable() === table) return;
        setActiveTableSignal(table);
        setSelectionRevision(value => value + 1);
    },
    getActiveTable() {
        return activeTable();
    },
    notifySelectionChanged(table) {
        if (activeTable() === table) {
            setSelectionRevision(value => value + 1);
        }
    },
    selectedRows() {
        selectionRevision();
        return activeTable()?.getSelectedRows?.() ?? [];
    },
};
