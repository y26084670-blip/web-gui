import test from "node:test";
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";

import {
    createDefaultLibraryService,
    MATERIAL_LIBRARY_KINDS,
    resolveDefaultLibraryAssetUrl,
} from "../src/services/defaultLibraryService.js";

function sha256(bytes) {
    return createHash("sha256").update(bytes).digest("hex");
}

function response(bytes, status = 200) {
    const value = Buffer.from(bytes);
    return {
        ok: status >= 200 && status < 300,
        status,
        async text() {
            return value.toString("utf8");
        },
        async arrayBuffer() {
            return value.buffer.slice(
                value.byteOffset,
                value.byteOffset + value.byteLength,
            );
        },
    };
}

function fixture() {
    const bytes = Buffer.from(
        '{"tabl":[0,1,0,2],"hip":0,"comment":"Сталь"}\n',
        "utf8",
    );
    const record = {
        kind: "FMM",
        name: "Сталь 3",
        fileName: "Сталь 3.txt",
        relativePath: "xapLibFMM/Сталь 3.txt",
        byteSize: bytes.byteLength,
        sha256: sha256(bytes),
        summary: {
            comment: "Сталь",
            detailCount: 2,
        },
        data: {
            tabl: [0, 1, 0, 2],
            hip: 0,
            comment: "Сталь",
        },
    };
    const index = {
        schemaVersion: 1,
        source: {
            fileCount: 2,
            byteSize: bytes.byteLength,
        },
        libraries: {
            FMM: {
                kind: "FMM",
                directory: "xapLibFMM",
                title: "Характеристики ФММ",
                records: [record],
            },
            HTC: {
                kind: "HTC",
                directory: "xapLibHTC",
                title: "Характеристики ВТСП",
                records: [],
            },
        },
    };
    return { bytes, record, index };
}

test("default-library URLs preserve Vite base paths and encode path segments", () => {
    assert.equal(
        resolveDefaultLibraryAssetUrl(
            "xapLibHTC/ВТСП — 1.txt",
            "/web-gui/",
        ),
        "/web-gui/data/default/xapLibHTC/"
        + "%D0%92%D0%A2%D0%A1%D0%9F%20%E2%80%94%201.txt",
    );
    assert.equal(
        resolveDefaultLibraryAssetUrl("library-index.json", "https://host/app"),
        "https://host/app/data/default/library-index.json",
    );
    assert.throws(
        () => resolveDefaultLibraryAssetUrl("../secret.txt", "/"),
        /Недопустимый путь/,
    );
});

test("default-library service loads RECORDS data without exposing its cache", async () => {
    const { bytes, index } = fixture();
    const calls = [];
    const fetchImpl = async (url, options) => {
        calls.push({ url, options });
        if (url.endsWith("library-index.json")) {
            return response(JSON.stringify(index));
        }
        return response(bytes);
    };
    const service = createDefaultLibraryService({
        fetchImpl,
        cryptoImpl: webcrypto,
        baseUrl: "/web-gui/",
    });

    const records = await service.loadRecords(MATERIAL_LIBRARY_KINDS.FMM);
    records[0].data.comment = "изменение UI";
    const secondRead = await service.loadRecords(MATERIAL_LIBRARY_KINDS.FMM);

    assert.equal(secondRead[0].data.comment, "Сталь");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.cache, "no-store");

    const loaded = await service.loadBytes(secondRead[0]);
    assert.deepEqual(Buffer.from(loaded), bytes);
    assert.match(
        calls[1].url,
        /xapLibFMM\/.*%D0%A1%D1%82%D0%B0%D0%BB%D1%8C%203\.txt\?sha256=[0-9a-f]{64}$/,
    );
    assert.equal(calls[1].options.cache, "force-cache");
});

test("default-library service rejects bytes that differ from the index", async () => {
    const { index } = fixture();
    const service = createDefaultLibraryService({
        fetchImpl: async url => url.endsWith("library-index.json")
            ? response(JSON.stringify(index))
            : response("повреждено"),
        cryptoImpl: webcrypto,
        baseUrl: "/",
    });

    const [record] = await service.loadRecords(MATERIAL_LIBRARY_KINDS.FMM);
    await assert.rejects(
        service.loadBytes(record),
        /Размер .* не соответствует индексу|SHA-256 .* не соответствует индексу/,
    );
});
