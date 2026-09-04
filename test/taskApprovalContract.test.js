import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
    taskApprovalService,
} from "../src/services/taskApprovalService.js";
import {
    DIRECTORIES,
    TASK_UNAPPROVED_FILE,
} from "../src/services/schemas/common/constants.js";

function notFound(name) {
    const error = new Error(`Не найдено: ${name}`);
    error.name = "NotFoundError";
    return error;
}

class MemoryDirectoryHandle {
    constructor({ failMarkerCreation = false } = {}) {
        this.directories = new Map();
        this.files = new Set();
        this.failMarkerCreation = failMarkerCreation;
    }

    async getDirectoryHandle(name, { create = false } = {}) {
        if (!this.directories.has(name)) {
            if (!create) throw notFound(name);
            this.directories.set(
                name,
                new MemoryDirectoryHandle({
                    failMarkerCreation: this.failMarkerCreation,
                }),
            );
        }
        return this.directories.get(name);
    }

    async getFileHandle(name, { create = false } = {}) {
        if (
            name === TASK_UNAPPROVED_FILE
            && this.failMarkerCreation
        ) {
            throw new Error("имитация сбоя создания маркера");
        }
        if (!this.files.has(name)) {
            if (!create) throw notFound(name);
            this.files.add(name);
        }
        return { kind: "file", name };
    }

    async removeEntry(name) {
        if (!this.files.delete(name)) throw notFound(name);
    }
}

test("unapproved marker is created inside input3XX", async () => {
    const task = new MemoryDirectoryHandle();

    await taskApprovalService.markUnapproved(task);
    await taskApprovalService.markUnapproved(task);

    const input = await task.getDirectoryHandle(DIRECTORIES.INPUT);
    assert.deepEqual([...input.files], [TASK_UNAPPROVED_FILE]);
});

test("clean validation removes an existing marker idempotently", async () => {
    const task = new MemoryDirectoryHandle();
    await taskApprovalService.markUnapproved(task);

    assert.equal(
        await taskApprovalService.clearUnapproved(task),
        true,
    );
    assert.equal(
        await taskApprovalService.clearUnapproved(task),
        false,
    );
});

test("marker creation failure rejects before task data can be saved", async () => {
    const task = new MemoryDirectoryHandle({
        failMarkerCreation: true,
    });

    await assert.rejects(
        taskApprovalService.markUnapproved(task),
        /имитация сбоя создания маркера/u,
    );
});

test("save keeps the fail-safe marker order", async () => {
    const source = await readFile(
        new URL("../src/App.jsx", import.meta.url),
        "utf8",
    );
    const saveStart = source.indexOf("async function handleSave()");
    const marker = source.indexOf(
        "taskApprovalService.markUnapproved(dirHandle)",
        saveStart,
    );
    const write = source.indexOf(
        "const saved = await dataService.save(",
        saveStart,
    );
    const validate = source.indexOf(
        "collectModelDiagnostics(",
        write,
    );
    const errorLevel = source.indexOf(
        "VALIDATION_LEVELS.ERROR",
        validate,
    );
    const clear = source.indexOf(
        "taskApprovalService.clearUnapproved(dirHandle)",
        errorLevel,
    );

    assert.ok(saveStart >= 0);
    assert.ok(marker > saveStart);
    assert.ok(write > marker);
    assert.ok(validate > write);
    assert.ok(errorLevel > validate);
    assert.ok(clear > errorLevel);
    assert.match(
        source.slice(marker, write),
        /return;/u,
    );
    assert.match(
        source.slice(write, validate),
        /if \(saveFailed\) return;/u,
    );
});
