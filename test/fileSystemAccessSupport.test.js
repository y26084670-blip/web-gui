import test from "node:test";
import assert from "node:assert/strict";

import {
    getFilePickerErrorMessage,
    getFileSystemAccessSupport,
    isFilePickerCancellation,
} from "../src/services/fileSystemAccessSupport.js";

const supportedEnvironment = () => ({
    isSecureContext: true,
    showDirectoryPicker() {},
    showOpenFilePicker() {},
});

test("File System Access API is supported in a secure compatible environment", () => {
    assert.deepEqual(getFileSystemAccessSupport(supportedEnvironment()), {
        supported: true,
        reason: null,
        message: "",
    });
});

test("an insecure context is rejected before checking picker methods", () => {
    const result = getFileSystemAccessSupport({
        isSecureContext: false,
        showDirectoryPicker() {},
    });

    assert.equal(result.supported, false);
    assert.equal(result.reason, "insecure-context");
    assert.match(result.message, /HTTPS|localhost/);
});

test("a missing directory picker produces a Chrome or Edge recommendation", () => {
    const result = getFileSystemAccessSupport({ isSecureContext: true });

    assert.equal(result.supported, false);
    assert.equal(result.reason, "directory-picker-unavailable");
    assert.match(result.message, /Google Chrome/);
    assert.match(result.message, /Microsoft Edge/);
});

test("the open-file picker is checked only by operations that require it", () => {
    const environment = {
        isSecureContext: true,
        showDirectoryPicker() {},
    };

    assert.equal(getFileSystemAccessSupport(environment).supported, true);

    const result = getFileSystemAccessSupport(environment, {
        requireOpenFilePicker: true,
    });
    assert.equal(result.supported, false);
    assert.equal(result.reason, "open-file-picker-unavailable");
});

test("only AbortError is treated as a silent user cancellation", () => {
    assert.equal(isFilePickerCancellation({ name: "AbortError" }), true);
    assert.equal(isFilePickerCancellation({ name: "NotAllowedError" }), false);
    assert.equal(isFilePickerCancellation(new Error("failure")), false);
});

test("permission and security failures have actionable messages", () => {
    assert.match(
        getFilePickerErrorMessage(
            { name: "NotAllowedError" },
            "выбрать каталог",
        ),
        /подтвердите разрешение/,
    );
    assert.match(
        getFilePickerErrorMessage(
            { name: "SecurityError" },
            "выбрать каталог",
        ),
        /HTTPS|localhost/,
    );
    assert.match(
        getFilePickerErrorMessage(new Error("failure"), "выбрать каталог"),
        /Google Chrome|Microsoft Edge/,
    );
});
