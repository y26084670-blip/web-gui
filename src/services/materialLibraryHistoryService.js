import { modelHistoryService } from "./modelHistoryService.js";

const appliers = new Map();

function requireTabId(tabId) {
    if (typeof tabId !== "string" || tabId.length === 0) {
        throw new Error("Не задана библиотечная вкладка для Undo/Redo.");
    }
    return tabId;
}

function attach(tabId, applySnapshot) {
    requireTabId(tabId);
    if (typeof applySnapshot !== "function") {
        throw new TypeError("Обработчик библиотечной истории должен быть функцией.");
    }

    appliers.set(tabId, applySnapshot);
    return () => {
        if (appliers.get(tabId) === applySnapshot) {
            appliers.delete(tabId);
        }
    };
}

function record(schema, before, after) {
    modelHistoryService.record(schema, before, after);
}

async function applyHistory(tabId, take, rollback) {
    const applySnapshot = appliers.get(requireTabId(tabId));
    if (!applySnapshot) return false;

    const change = take(tabId);
    if (!change) return false;

    try {
        await applySnapshot(change.value);
        return true;
    } catch (error) {
        rollback(tabId);
        throw error;
    }
}

function undo(tabId) {
    return applyHistory(
        tabId,
        modelHistoryService.takeUndo,
        modelHistoryService.takeRedo,
    );
}

function redo(tabId) {
    return applyHistory(
        tabId,
        modelHistoryService.takeRedo,
        modelHistoryService.takeUndo,
    );
}

function clear(tabId) {
    modelHistoryService.clear(requireTabId(tabId));
}

export const materialLibraryHistoryService = {
    attach,
    record,
    clear,
    undo,
    redo,
    canUndo: modelHistoryService.canUndo,
    canRedo: modelHistoryService.canRedo,
};
