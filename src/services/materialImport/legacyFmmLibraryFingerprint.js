// Канонический XAP.lib: solver/data/import/библиотека ФММ/XAP.lib.
// Отпечаток подтверждён для solver commit 019e928d8ae9520f39c823bb10742189ece6e5dd.
export const BASE_LEGACY_FMM_LIBRARY_SHA256 =
    "d51b5ddb2162694b8437d6836f82f50ff64242f68c96f725f597f638ae846e9a";

function bytesToHex(bytes) {
    return [...bytes]
        .map(value => value.toString(16).padStart(2, "0"))
        .join("");
}

export async function legacyFmmLibrarySha256(
    source,
    { cryptoImpl = globalThis.crypto } = {},
) {
    if (!(source instanceof ArrayBuffer) && !ArrayBuffer.isView(source)) {
        throw new TypeError(
            "Отпечаток XAP.lib вычисляется только для ArrayBuffer или TypedArray.",
        );
    }
    if (typeof cryptoImpl?.subtle?.digest !== "function") {
        throw new Error("В окружении недоступна проверка SHA-256 XAP.lib.");
    }

    const digest = await cryptoImpl.subtle.digest("SHA-256", source);
    return bytesToHex(new Uint8Array(digest));
}

export async function identifyLegacyFmmLibrary(
    file,
    {
        cryptoImpl = globalThis.crypto,
        baseSha256 = BASE_LEGACY_FMM_LIBRARY_SHA256,
    } = {},
) {
    if (typeof file?.arrayBuffer !== "function") {
        throw new TypeError("Для идентификации XAP.lib требуется объект File.");
    }

    const source = await file.arrayBuffer();
    const sha256 = await legacyFmmLibrarySha256(source, { cryptoImpl });
    return {
        source,
        sha256,
        isBaseLibrary: sha256 === baseSha256,
    };
}
