import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import test from "node:test";

import {
    BASE_LEGACY_FMM_LIBRARY_SHA256,
    identifyLegacyFmmLibrary,
    legacyFmmLibrarySha256,
} from "../src/services/materialImport/legacyFmmLibraryFingerprint.js";

function sha256(bytes) {
    return createHash("sha256").update(bytes).digest("hex");
}

test("base legacy FMM fingerprint is the canonical solver XAP.lib SHA-256", () => {
    assert.equal(
        BASE_LEGACY_FMM_LIBRARY_SHA256,
        "d51b5ddb2162694b8437d6836f82f50ff64242f68c96f725f597f638ae846e9a",
    );
});

test("legacy FMM identification hashes exact file bytes", async () => {
    const container = Uint8Array.from([99, 1, 2, 3, 88]);
    const source = container.subarray(1, 4);
    const expected = sha256(source);
    let reads = 0;
    const file = {
        async arrayBuffer() {
            reads += 1;
            return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
        },
    };

    assert.equal(
        await legacyFmmLibrarySha256(source, { cryptoImpl: webcrypto }),
        expected,
    );

    const customIdentity = await identifyLegacyFmmLibrary(file, {
        cryptoImpl: webcrypto,
    });
    assert.equal(customIdentity.isBaseLibrary, false);

    const identity = await identifyLegacyFmmLibrary(file, {
        cryptoImpl: webcrypto,
        baseSha256: expected,
    });
    assert.equal(reads, 2);
    assert.equal(identity.sha256, expected);
    assert.equal(identity.isBaseLibrary, true);
    assert.deepEqual([...new Uint8Array(identity.source)], [1, 2, 3]);
});

test("legacy FMM identification fails closed without Web Crypto", async () => {
    await assert.rejects(
        legacyFmmLibrarySha256(new Uint8Array([1]), { cryptoImpl: null }),
        /недоступна проверка SHA-256 XAP\.lib/u,
    );
});
