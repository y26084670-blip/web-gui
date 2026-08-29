import { createSignal, untrack } from "solid-js";

const [activeTable, setActiveTableSignal] = createSignal(null);
const [selectionRevision, setSelectionRevision] = createSignal(0);

export const selectionContextService = {
    setActiveTable(table) {
        // Setter may be called from a reactive tab-activation effect. Reading
        // the current value there must not subscribe that effect to later
        // detail-table activation and immediately restore the main table.
        if (untrack(activeTable) === table) return;
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
