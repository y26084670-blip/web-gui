const INSECURE_CONTEXT_MESSAGE =
    "Редактору требуется безопасное соединение. Откройте страницу по HTTPS "
    + "или через localhost в актуальном Google Chrome или Microsoft Edge.";

const UNSUPPORTED_BROWSER_MESSAGE =
    "Этот браузер не предоставляет необходимый доступ к локальным каталогам. "
    + "Используйте актуальный Google Chrome или Microsoft Edge для настольной Windows.";

export function getFileSystemAccessSupport(
    environment = globalThis,
    { requireOpenFilePicker = false } = {},
) {
    if (environment?.isSecureContext !== true) {
        return {
            supported: false,
            reason: "insecure-context",
            message: INSECURE_CONTEXT_MESSAGE,
        };
    }

    if (typeof environment?.showDirectoryPicker !== "function") {
        return {
            supported: false,
            reason: "directory-picker-unavailable",
            message: UNSUPPORTED_BROWSER_MESSAGE,
        };
    }

    if (
        requireOpenFilePicker
        && typeof environment?.showOpenFilePicker !== "function"
    ) {
        return {
            supported: false,
            reason: "open-file-picker-unavailable",
            message: UNSUPPORTED_BROWSER_MESSAGE,
        };
    }

    return {
        supported: true,
        reason: null,
        message: "",
    };
}

export function isFilePickerCancellation(error) {
    return error?.name === "AbortError";
}

export function getFilePickerErrorMessage(
    error,
    action = "выполнить файловую операцию",
) {
    const operation = typeof action === "string" && action.trim()
        ? action.trim()
        : "выполнить файловую операцию";

    if (error?.name === "NotAllowedError") {
        return `Не удалось ${operation}: браузер не предоставил доступ к локальным файлам. `
            + "Повторите операцию и подтвердите разрешение.";
    }

    if (error?.name === "SecurityError") {
        return `Не удалось ${operation}: доступ к локальным файлам разрешён только `
            + "при работе через HTTPS или localhost.";
    }

    return `Не удалось ${operation}. Проверьте доступ к локальным файлам и повторите операцию `
        + "в актуальном Google Chrome или Microsoft Edge.";
}
