import test from "node:test";
import assert from "node:assert/strict";

import {
    createMaterialImportService,
    importFmmLegacyMaterials,
    MATERIAL_IMPORT_KINDS,
} from "../src/services/materialImportService.js";
import {
    buildXapRecord,
    mockFile,
} from "./fixtures/materialImportFixtures.js";
import { BASE_LEGACY_FMM_LIBRARY_SHA256 } from "../src/services/materialImport/legacyFmmLibraryFingerprint.js";

function fixedDigestCrypto(hexDigest) {
    const bytes = Uint8Array.from(
        hexDigest.match(/../gu),
        pair => Number.parseInt(pair, 16),
    );
    return {
        subtle: {
            async digest() {
                return bytes.buffer.slice(0);
            },
        },
    };
}

test("FMM coordinator validates all input and calls writer once", async () => {
    const batches = [];
    const result = await importFmmLegacyMaterials({
        pickFile: async () => mockFile(
            "XAP.lib",
            buildXapRecord({ name: "STAL3" }),
        ),
        writeBatch: async batch => {
            batches.push(batch);
            return { written: batch.materials.length };
        },
    });

    assert.equal(result.status, "written");
    assert.equal(result.kind, MATERIAL_IMPORT_KINDS.FMM);
    assert.equal(result.count, 1);
    assert.equal(batches.length, 1);
    assert.equal(batches[0].kind, "FMM");
    assert.equal(batches[0].materials[0].name, "STAL3");
    assert.equal(batches[0].materials[0].fileName, "STAL3.txt");
    assert.equal(Object.hasOwn(batches[0].materials[0].data, "name"), false);
});

test("FMM coordinator supports handles and rejects a wrong selected file", async () => {
    const file = mockFile("XAP.lib", buildXapRecord({ name: "HANDLE" }));
    const result = await importFmmLegacyMaterials({
        pickFile: async () => [{ async getFile() { return file; } }],
        writeBatch: async () => "ok",
    });
    assert.equal(result.materials[0].name, "HANDLE");

    let writes = 0;
    await assert.rejects(
        importFmmLegacyMaterials({
            pickFile: async () => mockFile("CONRAB.LIB", buildXapRecord()),
            writeBatch: async () => { writes += 1; },
        }),
        /требуется legacy-библиотека XAP\.lib/,
    );
    assert.equal(writes, 0);
});

test("FMM coordinator rejects the unchanged base legacy library before writing", async () => {
    let writes = 0;

    await assert.rejects(
        importFmmLegacyMaterials({
            pickFile: async () => mockFile(
                "XAP.lib",
                buildXapRecord({ name: "BASE" }),
            ),
            writeBatch: async () => { writes += 1; },
            cryptoImpl: fixedDigestCrypto(BASE_LEGACY_FMM_LIBRARY_SHA256),
        }),
        /совпадает со стандартной legacy-библиотекой/u,
    );
    assert.equal(writes, 0);
});

test("FMM coordinator treats AbortError as cancellation", async () => {
    const abort = new Error("cancelled");
    abort.name = "AbortError";
    const fmm = await importFmmLegacyMaterials({
        pickFile: async () => { throw abort; },
        writeBatch: async () => assert.fail("writer must not run"),
    });

    assert.equal(fmm.status, "cancelled");
});

test("service factory keeps picker and writer dependencies outside parsers", async () => {
    const calls = [];
    const service = createMaterialImportService({
        pickFmmFile: async () => mockFile(
            "XAP.lib",
            buildXapRecord({ name: "FACTORY" }),
        ),
        writeBatch: async batch => calls.push(batch.kind),
    });

    await service.importFmm();
    assert.deepEqual(calls, ["FMM"]);
});
