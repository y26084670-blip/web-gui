import { createSignal } from "solid-js";

const [loadedTaskHandle, setLoadedTaskHandle] = createSignal(null);
const [loadedTaskPath, setLoadedTaskPath] = createSignal(null);
const [taskDataVersion, setTaskDataVersion] = createSignal(0);

function notifyTaskDataChanged() {
    setTaskDataVersion(
        value => value + 1
    );
}

export const selectionService = {
    loadedTaskHandle,
    setLoadedTaskHandle,
    loadedTaskPath,
    setLoadedTaskPath,
    taskDataVersion,
    notifyTaskDataChanged,
};