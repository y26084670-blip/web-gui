import test from "node:test";
import assert from "node:assert/strict";

import {
    createMaterialImportService,
    importFmmLegacyMaterials,
    importHtcLegacyMaterials,
    MATERIAL_IMPORT_KINDS,
} from "../src/services/materialImportService.js";
import {
    buildHtcConfig,
    buildXapRecord,
    mockFile,
    mockLibraryDirectory,
    mockMaterialDirectory,
} from "./fixtures/materialImportFixtures.js";

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

test("HTC coordinator sorts directories and writes one validated batch", async () => {
    const second = mockMaterialDirectory(
        "Бета",
        buildHtcConfig(204),
        "Комментарий Б",
    );
    const first = mockMaterialDirectory(
        "Альфа",
        buildHtcConfig(203),
        "Комментарий А",
    );
    const previousOutput = mockMaterialDirectory(
        "new_xapLibHTC",
        "повреждённый прежний результат",
        "не является исходной характеристикой",
    );
    previousOutput.deleteFile("config.txt");
    previousOutput.deleteFile("comment.txt");
    const batches = [];

    const result = await importHtcLegacyMaterials({
        pickDirectory: async () => mockLibraryDirectory(
            "legacy-htc",
            [second, previousOutput, first],
        ),
        writeBatch: async batch => {
            batches.push(batch);
            return "written";
        },
    });

    assert.equal(result.status, "written");
    assert.equal(result.kind, MATERIAL_IMPORT_KINDS.HTC);
    assert.deepEqual(
        result.materials.map(material => material.name),
        ["Альфа", "Бета"],
    );
    assert.deepEqual(
        result.materials.map(material => material.legacyVersion),
        [203, 204],
    );
    assert.equal(batches.length, 1);
    assert.equal(batches[0].kind, "HTC");
});

test("HTC coordinator rejects ambiguous new_xapLibHTC material directory", async () => {
    const ambiguous = mockMaterialDirectory(
        "new_xapLibHTC",
        buildHtcConfig(203),
        "Это характеристика, а не пустой прежний output",
    );
    let writes = 0;

    await assert.rejects(
        importHtcLegacyMaterials({
            pickDirectory: async () => mockLibraryDirectory(
                "legacy-htc",
                [ambiguous],
            ),
            writeBatch: async () => { writes += 1; },
        }),
        /неоднозначен с каталогом характеристики ВТСП/,
    );
    assert.equal(writes, 0);
});

test("HTC coordinator performs no write after any source error", async () => {
    const valid = mockMaterialDirectory(
        "Альфа",
        buildHtcConfig(203),
        "Комментарий",
    );
    const invalid = mockMaterialDirectory(
        "Бета",
        buildHtcConfig(203),
        "Комментарий",
    );
    invalid.deleteFile("comment.txt");
    let writes = 0;

    await assert.rejects(
        importHtcLegacyMaterials({
            pickDirectory: async () => mockLibraryDirectory(
                "legacy-htc",
                [valid, invalid],
            ),
            writeBatch: async () => { writes += 1; },
        }),
        /отсутствует comment\.txt/,
    );
    assert.equal(writes, 0);
});

test("coordinator treats AbortError and null selection as cancellation", async () => {
    const abort = new Error("cancelled");
    abort.name = "AbortError";
    const fmm = await importFmmLegacyMaterials({
        pickFile: async () => { throw abort; },
        writeBatch: async () => assert.fail("writer must not run"),
    });
    const htc = await importHtcLegacyMaterials({
        pickDirectory: async () => null,
        writeBatch: async () => assert.fail("writer must not run"),
    });

    assert.equal(fmm.status, "cancelled");
    assert.equal(htc.status, "cancelled");
});

test("service factory keeps picker and writer dependencies outside parsers", async () => {
    const calls = [];
    const service = createMaterialImportService({
        pickFmmFile: async () => mockFile(
            "XAP.lib",
            buildXapRecord({ name: "FACTORY" }),
        ),
        pickHtcDirectory: async () => null,
        writeBatch: async batch => calls.push(batch.kind),
    });

    await service.importFmm();
    await service.importHtc();
    assert.deepEqual(calls, ["FMM"]);
});
