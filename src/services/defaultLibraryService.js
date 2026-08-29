const INDEX_FILE = "library-index.json";
const INDEX_SCHEMA_VERSION = 1;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export const MATERIAL_LIBRARY_KINDS = Object.freeze({
    FMM: "FMM",
    HTC: "HTC",
});

const LIBRARY_DIRECTORIES = Object.freeze({
    [MATERIAL_LIBRARY_KINDS.FMM]: "xapLibFMM",
    [MATERIAL_LIBRARY_KINDS.HTC]: "xapLibHTC",
});

function clone(value) {
    return structuredClone(value);
}

function defaultBaseUrl() {
    // Точная форма import.meta.env.BASE_URL нужна Vite для подстановки base.
    // Проверка объекта сохраняет возможность автономных Node.js-тестов.
    if (typeof import.meta.env === "object") {
        return import.meta.env.BASE_URL;
    }
    return "/";
}

function normalizeBaseUrl(baseUrl) {
    const value = String(baseUrl ?? "").trim();
    if (!value) return "/";
    return value.endsWith("/") ? value : `${value}/`;
}

function validateRelativePath(relativePath) {
    if (typeof relativePath !== "string" || relativePath.length === 0) {
        throw new Error("Не задан относительный путь базовой характеристики.");
    }

    const segments = relativePath.split("/");
    if (
        relativePath.startsWith("/")
        || relativePath.includes("\\")
        || segments.some(segment =>
            segment.length === 0 || segment === "." || segment === "..")
    ) {
        throw new Error(
            `Недопустимый путь базовой характеристики: '${relativePath}'.`,
        );
    }

    return segments;
}

export function resolveDefaultLibraryAssetUrl(
    relativePath,
    baseUrl = defaultBaseUrl(),
) {
    const segments = validateRelativePath(relativePath);
    const encodedPath = segments.map(encodeURIComponent).join("/");
    return `${normalizeBaseUrl(baseUrl)}data/default/${encodedPath}`;
}

function assertPlainObject(value, description) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${description} должен быть объектом.`);
    }
}

function validateMaterialRecord(record, kind, directory) {
    assertPlainObject(record, `Запись библиотеки ${kind}`);

    if (record.kind !== kind) {
        throw new Error(
            `Запись библиотеки ${kind} содержит вид '${record.kind}'.`,
        );
    }
    if (
        typeof record.name !== "string"
        || record.name.length === 0
        || typeof record.fileName !== "string"
        || record.fileName.length === 0
    ) {
        throw new Error(`Запись библиотеки ${kind} не содержит имени.`);
    }

    const segments = validateRelativePath(record.relativePath);
    if (
        segments.length !== 2
        || segments[0] !== directory
        || segments[1] !== record.fileName
    ) {
        throw new Error(
            `Путь '${record.relativePath}' не соответствует библиотеке ${kind}.`,
        );
    }
    if (!Number.isSafeInteger(record.byteSize) || record.byteSize < 0) {
        throw new Error(
            `Некорректный размер '${record.relativePath}'.`,
        );
    }
    if (typeof record.sha256 !== "string" || !SHA256_PATTERN.test(record.sha256)) {
        throw new Error(
            `Некорректный SHA-256 '${record.relativePath}'.`,
        );
    }

    assertPlainObject(record.summary, `Сводка '${record.relativePath}'`);
    if (
        typeof record.summary.comment !== "string"
        || !Number.isFinite(record.summary.detailCount)
        || record.summary.detailCount < 0
    ) {
        throw new Error(
            `Некорректная сводка '${record.relativePath}'.`,
        );
    }
    assertPlainObject(record.data, `Данные '${record.relativePath}'`);
}

export function validateDefaultLibraryIndex(index) {
    assertPlainObject(index, "Индекс базовых характеристик");
    if (index.schemaVersion !== INDEX_SCHEMA_VERSION) {
        throw new Error(
            `Неподдерживаемая версия индекса базовых характеристик: `
            + `'${index.schemaVersion}'.`,
        );
    }
    assertPlainObject(index.source, "Описание исходной библиотеки");
    if (
        !Number.isSafeInteger(index.source.fileCount)
        || index.source.fileCount < 0
        || !Number.isSafeInteger(index.source.byteSize)
        || index.source.byteSize < 0
    ) {
        throw new Error("Некорректная сводка исходной библиотеки.");
    }
    assertPlainObject(index.libraries, "Список базовых библиотек");

    const knownPaths = new Set();
    for (const [kind, directory] of Object.entries(LIBRARY_DIRECTORIES)) {
        const library = index.libraries[kind];
        assertPlainObject(library, `Библиотека ${kind}`);
        if (
            library.kind !== kind
            || library.directory !== directory
            || typeof library.title !== "string"
            || !Array.isArray(library.records)
        ) {
            throw new Error(`Некорректное описание библиотеки ${kind}.`);
        }

        for (const record of library.records) {
            validateMaterialRecord(record, kind, directory);
            const pathKey = record.relativePath.toLocaleLowerCase("ru-RU");
            if (knownPaths.has(pathKey)) {
                throw new Error(
                    `Путь характеристики повторяется: '${record.relativePath}'.`,
                );
            }
            knownPaths.add(pathKey);
        }
    }

    const unknownKinds = Object.keys(index.libraries)
        .filter(kind => !(kind in LIBRARY_DIRECTORIES));
    if (unknownKinds.length > 0) {
        throw new Error(
            `Индекс содержит неизвестные библиотеки: ${unknownKinds.join(", ")}.`,
        );
    }

    return index;
}

function bytesToHex(bytes) {
    return [...bytes]
        .map(value => value.toString(16).padStart(2, "0"))
        .join("");
}

async function digestBytes(bytes, cryptoImpl) {
    if (typeof cryptoImpl?.subtle?.digest !== "function") {
        throw new Error("В окружении недоступна проверка SHA-256.");
    }
    const digest = await cryptoImpl.subtle.digest("SHA-256", bytes);
    return bytesToHex(new Uint8Array(digest));
}

async function ensureSuccessfulResponse(response, url) {
    if (!response || response.ok !== true) {
        const status = response?.status;
        const suffix = Number.isInteger(status) ? ` (HTTP ${status})` : "";
        throw new Error(`Не удалось загрузить '${url}'${suffix}.`);
    }
    return response;
}

export function createDefaultLibraryService({
    fetchImpl = globalThis.fetch,
    cryptoImpl = globalThis.crypto,
    baseUrl = defaultBaseUrl(),
} = {}) {
    if (typeof fetchImpl !== "function") {
        throw new Error("В окружении недоступна загрузка базовой библиотеки.");
    }

    let cachedIndex = null;
    let pendingIndex = null;

    const assetUrl = relativePath =>
        resolveDefaultLibraryAssetUrl(relativePath, baseUrl);

    async function fetchIndex() {
        const url = assetUrl(INDEX_FILE);
        const response = await ensureSuccessfulResponse(
            await fetchImpl(url, { cache: "no-store" }),
            url,
        );
        let index;
        try {
            index = JSON.parse(await response.text());
        } catch (error) {
            throw new Error(
                `Индекс базовых характеристик не разобран: ${error.message}`,
            );
        }
        validateDefaultLibraryIndex(index);
        cachedIndex = clone(index);
        return cachedIndex;
    }

    async function loadIndex({ force = false } = {}) {
        if (force) {
            cachedIndex = null;
            pendingIndex = null;
        }
        if (cachedIndex) return clone(cachedIndex);
        if (!pendingIndex) {
            pendingIndex = fetchIndex().finally(() => {
                pendingIndex = null;
            });
        }
        return clone(await pendingIndex);
    }

    async function loadRecords(kind, options) {
        if (!(kind in LIBRARY_DIRECTORIES)) {
            throw new Error(`Неизвестный вид библиотеки: '${kind}'.`);
        }
        const index = await loadIndex(options);
        return clone(index.libraries[kind].records);
    }

    async function loadBytes(record) {
        const directory = LIBRARY_DIRECTORIES[record?.kind];
        if (!directory) {
            throw new Error(`Неизвестный вид библиотеки: '${record?.kind}'.`);
        }
        validateMaterialRecord(record, record.kind, directory);

        const url = `${assetUrl(record.relativePath)}`
            + `?sha256=${record.sha256}`;
        const response = await ensureSuccessfulResponse(
            await fetchImpl(url, { cache: "force-cache" }),
            url,
        );
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength !== record.byteSize) {
            throw new Error(
                `Размер '${record.relativePath}' не соответствует индексу.`,
            );
        }
        if (await digestBytes(bytes, cryptoImpl) !== record.sha256) {
            throw new Error(
                `SHA-256 '${record.relativePath}' не соответствует индексу.`,
            );
        }
        return bytes;
    }

    return Object.freeze({
        assetUrl,
        loadIndex,
        loadRecords,
        loadBytes,
    });
}

export const defaultLibraryService = createDefaultLibraryService();
