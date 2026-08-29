import assert from "node:assert/strict";
import test from "node:test";

import { materialLibraryRevisionService } from "../src/services/materialLibraryRevisionService.js";

test("FMM and HTC library revisions change independently", () => {
    const fmmBefore = materialLibraryRevisionService.revision("FMM");
    const htcBefore = materialLibraryRevisionService.revision("HTC");

    materialLibraryRevisionService.notifyChanged("HTC");

    assert.equal(
        materialLibraryRevisionService.revision("FMM"),
        fmmBefore,
    );
    assert.equal(
        materialLibraryRevisionService.revision("HTC"),
        htcBefore + 1,
    );
});
