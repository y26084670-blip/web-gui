import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { materialLibraryHistoryService } from "../src/services/materialLibraryHistoryService.js";
import { modelHistoryService } from "../src/services/modelHistoryService.js";

const schema = { id: "fmmLibrary" };

beforeEach(() => {
    modelHistoryService.clear();
});

test("material history applies snapshots through its registered tab", async () => {
    const applied = [];
    const detach = materialLibraryHistoryService.attach(
        schema.id,
        snapshot => applied.push(snapshot),
    );
    materialLibraryHistoryService.record(
        schema,
        { records: [{ hip: 1 }] },
        { records: [{ hip: 2 }] },
    );

    assert.equal(materialLibraryHistoryService.canUndo(schema.id), true);
    assert.equal(await materialLibraryHistoryService.undo(schema.id), true);
    assert.deepEqual(applied, [{ records: [{ hip: 1 }] }]);
    assert.equal(materialLibraryHistoryService.canRedo(schema.id), true);

    assert.equal(await materialLibraryHistoryService.redo(schema.id), true);
    assert.deepEqual(applied.at(-1), { records: [{ hip: 2 }] });
    detach();
});

test("failed material history application restores its direction", async () => {
    const detach = materialLibraryHistoryService.attach(
        schema.id,
        async () => { throw new Error("apply failed"); },
    );
    materialLibraryHistoryService.record(schema, 1, 2);

    await assert.rejects(
        materialLibraryHistoryService.undo(schema.id),
        /apply failed/u,
    );
    assert.equal(materialLibraryHistoryService.canUndo(schema.id), true);
    assert.equal(materialLibraryHistoryService.canRedo(schema.id), false);
    detach();
});
