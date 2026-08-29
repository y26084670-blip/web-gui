import assert from "node:assert/strict";
import test from "node:test";

import { createMaterialLibraryLoadQueue } from "../src/services/materials/materialLibraryLoadQueue.js";

function deferred() {
    let resolve;
    const promise = new Promise(done => {
        resolve = done;
    });
    return { promise, resolve };
}

test("a newer material source is applied after an older pending render", async () => {
    const queue = createMaterialLibraryLoadQueue();
    const baseRender = deferred();
    const baseStarted = deferred();
    let visible = [];

    const base = queue.run(async () => {
        baseStarted.resolve();
        await baseRender.promise;
        visible = ["base"];
    });
    await baseStarted.promise;

    const clear = queue.run(() => {
        visible = [];
    });
    const task = queue.run(() => {
        visible = ["task"];
    });

    baseRender.resolve();
    await Promise.all([base, clear, task]);
    assert.deepEqual(visible, ["task"]);
});

test("a base source replaces an older pending task render", async () => {
    const queue = createMaterialLibraryLoadQueue();
    const taskRender = deferred();
    const taskStarted = deferred();
    let visible = [];

    const task = queue.run(async () => {
        taskStarted.resolve();
        await taskRender.promise;
        visible = ["task"];
    });
    await taskStarted.promise;

    const clear = queue.run(() => {
        visible = [];
    });
    const base = queue.run(() => {
        visible = ["base"];
    });

    taskRender.resolve();
    await Promise.all([task, clear, base]);
    assert.deepEqual(visible, ["base"]);
});

test("a failed table mutation does not block later source changes", async () => {
    const queue = createMaterialLibraryLoadQueue();

    await assert.rejects(
        queue.run(() => {
            throw new Error("render failed");
        }),
        /render failed/,
    );
    assert.equal(await queue.run(() => "task"), "task");
});
