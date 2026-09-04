import {
    DIRECTORIES,
    TASK_UNAPPROVED_FILE,
} from "./schemas/common/constants.js";

function requireTaskHandle(taskHandle) {
    if (!taskHandle) {
        throw new Error("Task directory not selected.");
    }
}

async function markUnapproved(taskHandle) {
    requireTaskHandle(taskHandle);
    const inputHandle = await taskHandle.getDirectoryHandle(
        DIRECTORIES.INPUT,
        { create: true },
    );
    await inputHandle.getFileHandle(
        TASK_UNAPPROVED_FILE,
        { create: true },
    );
}

async function clearUnapproved(taskHandle) {
    requireTaskHandle(taskHandle);
    const inputHandle = await taskHandle.getDirectoryHandle(
        DIRECTORIES.INPUT,
    );
    try {
        await inputHandle.removeEntry(TASK_UNAPPROVED_FILE);
        return true;
    } catch (error) {
        if (error?.name === "NotFoundError") return false;
        throw error;
    }
}

export const taskApprovalService = {
    markUnapproved,
    clearUnapproved,
};
