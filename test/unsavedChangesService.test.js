import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { unsavedChangesService } from "../src/services/unsavedChangesService.js";

beforeEach(() => {
    unsavedChangesService.clear();
});

test("model tab is dirty only when current data differs from its baseline", () => {
    unsavedChangesService.setCurrent("elements", [{ value: 1 }]);
    assert.equal(unsavedChangesService.isDirty("elements"), false);

    unsavedChangesService.setBaseline("elements", [{ value: 1 }]);
    assert.equal(unsavedChangesService.isDirty("elements"), false);

    unsavedChangesService.setCurrent("elements", [{ value: 2 }]);
    assert.equal(unsavedChangesService.isDirty("elements"), true);

    // Возврат Undo к сохранённому значению гасит индикатор.
    unsavedChangesService.setCurrent("elements", [{ value: 1 }]);
    assert.equal(unsavedChangesService.isDirty("elements"), false);
});

test("a successful save moves only its tab baseline", () => {
    unsavedChangesService.setCurrent("elements", 1);
    unsavedChangesService.setBaseline("elements", 0);
    unsavedChangesService.setCurrent("regions", 11);
    unsavedChangesService.setBaseline("regions", 10);

    unsavedChangesService.setBaseline("elements", 1);

    assert.equal(unsavedChangesService.isDirty("elements"), false);
    assert.equal(unsavedChangesService.isDirty("regions"), true);
});

test("explicit library dirtiness joins model tabs in requested order", () => {
    unsavedChangesService.setCurrent("moves", 2);
    unsavedChangesService.setBaseline("moves", 1);
    unsavedChangesService.setExplicitDirty("fmmLibrary", true);

    assert.deepEqual(
        unsavedChangesService.dirtyTabIds([
            "fmmLibrary",
            "moves",
        ]),
        ["fmmLibrary", "moves"],
    );
    assert.equal(unsavedChangesService.hasDirty(), true);

    unsavedChangesService.setExplicitDirty("fmmLibrary", false);
    unsavedChangesService.clear("moves");
    assert.equal(unsavedChangesService.hasDirty(), false);
});
