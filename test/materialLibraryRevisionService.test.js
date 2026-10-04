import assert from "node:assert/strict";
import test from "node:test";

import { materialLibraryRevisionService } from "../src/services/materialLibraryRevisionService.js";

test("FMM and HTS library revisions change independently", () => {
    const fmmBefore = materialLibraryRevisionService.revision("FMM");
    const htsBefore = materialLibraryRevisionService.revision("HTS");

    materialLibraryRevisionService.notifyChanged("HTS");

    assert.equal(
        materialLibraryRevisionService.revision("FMM"),
        fmmBefore,
    );
    assert.equal(
        materialLibraryRevisionService.revision("HTS"),
        htsBefore + 1,
    );
});
