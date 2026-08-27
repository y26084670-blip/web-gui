let activeTable = null;

export const selectionContextService = {
    setActiveTable(table) {
        activeTable = table;
    },
    getActiveTable() {
        return activeTable;
    },
};