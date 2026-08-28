import {
    copyFile,
    lstat,
    mkdir,
    readFile,
    readdir,
    rm,
    writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_LIBRARY_INDEX_FILE = "library-index.json";
export const DEFAULT_LIBRARY_SHA_FILE = "SHA256SUMS";
export const DEFAULT_LIBRARY_SCHEMA_VERSION = 1;

const LIBRARIES = Object.freeze([
    Object.freeze({
        kind: "FMM",
        directory: "xapLibFMM",
        title: "Характеристики ФММ",
    }),
    Object.freeze({
        kind: "HTC",
        directory: "xapLibHTC",
        title: "Характеристики ВТСП",
    }),
]);

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(scriptDirectory);
const defaultSourceRoot = path.join(projectRoot, "data", "default");
const defaultGeneratedRoot = path.join(
    projectRoot,
    ".generated",
    "data",
    "default",
);
const defaultDistRoot = path.join(projectRoot, "dist", "data", "default");

const compareText = (left, right) => left < right ? -1 : left > right ? 1 : 0;

function toPosixPath(value) {
    return value.split(path.sep).join("/");
}

function sha256(bytes) {
    return createHash("sha256").update(bytes).digest("hex");
}

function assertPlainObject(value, description) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${description} должен быть JSON-объектом.`);
    }
}

function assertSafeMaterialName(fileName, directory) {
    if (path.extname(fileName).toLowerCase() !== ".txt") {
        throw new Error(
            `В '${directory}' обнаружен файл не в формате TXT: '${fileName}'.`,
        );
    }
    if (
        fileName === "."
        || fileName === ".."
        || fileName.includes("/")
        || fileName.includes("\\")
    ) {
        throw new Error(`Недопустимое имя характеристики: '${fileName}'.`);
    }
}

async function listTreeFiles(root) {
    const result = [];

    async function visit(directory, relativeDirectory = "") {
        const entries = await readdir(directory, { withFileTypes: true });
        entries.sort((left, right) => compareText(left.name, right.name));

        for (const entry of entries) {
            const absolutePath = path.join(directory, entry.name);
            const relativePath = relativeDirectory
                ? path.join(relativeDirectory, entry.name)
                : entry.name;
            const stat = await lstat(absolutePath);

            if (stat.isSymbolicLink()) {
                throw new Error(
                    `Символические ссылки в базовой библиотеке запрещены: `
                    + `'${toPosixPath(relativePath)}'.`,
                );
            }
            if (stat.isDirectory()) {
                await visit(absolutePath, relativePath);
                continue;
            }
            if (!stat.isFile()) {
                throw new Error(
                    `Неподдерживаемый объект в базовой библиотеке: `
                    + `'${toPosixPath(relativePath)}'.`,
                );
            }

            result.push({
                absolutePath,
                relativePath: toPosixPath(relativePath),
                byteSize: stat.size,
            });
        }
    }

    await visit(root);
    return result.sort((left, right) =>
        compareText(left.relativePath, right.relativePath));
}

function createSummary(kind, data) {
    const comment = typeof data.comment === "string" ? data.comment : "";
    const detailCount = kind === "FMM" && Array.isArray(data.tabl)
        ? data.tabl.length / 2
        : Object.keys(data).filter(key => key !== "comment").length;

    return {
        comment,
        detailCount,
    };
}

async function readMaterialRecords(sourceRoot, library, sourceFiles) {
    const prefix = `${library.directory}/`;
    const files = sourceFiles.filter(file =>
        file.relativePath.startsWith(prefix));
    const records = [];
    const names = new Map();

    for (const file of files) {
        const fileName = file.relativePath.slice(prefix.length);
        if (!fileName || fileName.includes("/")) {
            throw new Error(
                `В '${library.directory}' допускаются только файлы первого уровня: `
                + `'${file.relativePath}'.`,
            );
        }
        assertSafeMaterialName(fileName, library.directory);

        const caseKey = fileName.toLocaleLowerCase("ru-RU");
        if (names.has(caseKey)) {
            throw new Error(
                `Имена характеристик различаются только регистром: `
                + `'${names.get(caseKey)}' и '${fileName}'.`,
            );
        }
        names.set(caseKey, fileName);

        const bytes = await readFile(path.join(sourceRoot, ...file.relativePath.split("/")));
        let data;
        try {
            data = JSON.parse(bytes.toString("utf8"));
        } catch (error) {
            throw new Error(
                `Характеристика '${file.relativePath}' не разобрана: ${error.message}`,
            );
        }
        assertPlainObject(data, `Характеристика '${file.relativePath}'`);

        if (library.kind === "FMM") {
            if (!Array.isArray(data.tabl) || data.tabl.length % 2 !== 0) {
                throw new Error(
                    `Характеристика '${file.relativePath}' содержит некорректную таблицу 'tabl'.`,
                );
            }
        }

        records.push({
            kind: library.kind,
            name: path.parse(fileName).name,
            fileName,
            relativePath: file.relativePath,
            byteSize: bytes.byteLength,
            sha256: sha256(bytes),
            summary: createSummary(library.kind, data),
            data,
        });
    }

    return records;
}

async function buildIndex(sourceRoot, sourceFiles) {
    const libraries = {};

    for (const library of LIBRARIES) {
        const directoryPath = path.join(sourceRoot, library.directory);
        const stat = await lstat(directoryPath).catch(() => null);
        if (!stat?.isDirectory() || stat.isSymbolicLink()) {
            throw new Error(
                `Каталог базовой библиотеки не найден: '${library.directory}'.`,
            );
        }

        libraries[library.kind] = {
            kind: library.kind,
            directory: library.directory,
            title: library.title,
            records: await readMaterialRecords(
                sourceRoot,
                library,
                sourceFiles,
            ),
        };
    }

    return {
        schemaVersion: DEFAULT_LIBRARY_SCHEMA_VERSION,
        source: {
            fileCount: sourceFiles.length,
            byteSize: sourceFiles.reduce(
                (sum, file) => sum + file.byteSize,
                0,
            ),
        },
        libraries,
    };
}

async function copySourceTree(sourceRoot, outputRoot, sourceFiles) {
    await rm(outputRoot, { recursive: true, force: true });
    await mkdir(outputRoot, { recursive: true });

    for (const file of sourceFiles) {
        const target = path.join(outputRoot, ...file.relativePath.split("/"));
        await mkdir(path.dirname(target), { recursive: true });
        await copyFile(file.absolutePath, target);
    }
}

function formatShaManifest(items) {
    return items
        .sort((left, right) => compareText(left.relativePath, right.relativePath))
        .map(item => `${item.sha256}  ${item.relativePath}`)
        .join("\n") + "\n";
}

export async function prepareDefaultLibraryAssets({
    sourceRoot = defaultSourceRoot,
    outputRoot = defaultGeneratedRoot,
} = {}) {
    const resolvedSource = path.resolve(sourceRoot);
    const resolvedOutput = path.resolve(outputRoot);
    if (resolvedSource === resolvedOutput) {
        throw new Error("Исходный и выходной каталоги assets должны различаться.");
    }

    const sourceFiles = await listTreeFiles(resolvedSource);
    if (sourceFiles.some(file =>
        file.relativePath === DEFAULT_LIBRARY_INDEX_FILE
        || file.relativePath === DEFAULT_LIBRARY_SHA_FILE)) {
        throw new Error(
            "Исходная библиотека содержит зарезервированный файл индекса или SHA-манифеста.",
        );
    }

    const index = await buildIndex(resolvedSource, sourceFiles);
    await copySourceTree(resolvedSource, resolvedOutput, sourceFiles);

    const indexText = JSON.stringify(index, null, 2) + "\n";
    const indexBytes = Buffer.from(indexText, "utf8");
    await writeFile(
        path.join(resolvedOutput, DEFAULT_LIBRARY_INDEX_FILE),
        indexBytes,
    );

    const manifestItems = [];
    for (const file of sourceFiles) {
        const copiedBytes = await readFile(
            path.join(resolvedOutput, ...file.relativePath.split("/")),
        );
        const sourceBytes = await readFile(file.absolutePath);
        const sourceSha = sha256(sourceBytes);
        const copiedSha = sha256(copiedBytes);
        if (sourceBytes.byteLength !== copiedBytes.byteLength || sourceSha !== copiedSha) {
            throw new Error(
                `Побайтовая проверка копии не пройдена: '${file.relativePath}'.`,
            );
        }
        manifestItems.push({
            relativePath: file.relativePath,
            sha256: sourceSha,
        });
    }
    manifestItems.push({
        relativePath: DEFAULT_LIBRARY_INDEX_FILE,
        sha256: sha256(indexBytes),
    });

    await writeFile(
        path.join(resolvedOutput, DEFAULT_LIBRARY_SHA_FILE),
        formatShaManifest(manifestItems),
        "utf8",
    );

    return {
        sourceRoot: resolvedSource,
        outputRoot: resolvedOutput,
        index,
        manifestEntries: manifestItems.length,
    };
}

function parseShaManifest(text) {
    const entries = new Map();
    const lines = text.split(/\r?\n/).filter(line => line.length > 0);

    for (const line of lines) {
        const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
        if (!match) {
            throw new Error(`Некорректная строка SHA-манифеста: '${line}'.`);
        }
        const [, digest, relativePath] = match;
        if (
            path.posix.isAbsolute(relativePath)
            || relativePath.split("/").some(segment =>
                segment === "" || segment === "." || segment === "..")
        ) {
            throw new Error(
                `Некорректный относительный путь в SHA-манифесте: '${relativePath}'.`,
            );
        }
        if (entries.has(relativePath)) {
            throw new Error(
                `Путь повторяется в SHA-манифесте: '${relativePath}'.`,
            );
        }
        entries.set(relativePath, digest);
    }

    return entries;
}

export async function verifyDefaultLibraryAssets({
    assetRoot = defaultDistRoot,
} = {}) {
    const resolvedRoot = path.resolve(assetRoot);
    const manifestPath = path.join(resolvedRoot, DEFAULT_LIBRARY_SHA_FILE);
    const manifest = parseShaManifest(await readFile(manifestPath, "utf8"));
    const actualFiles = await listTreeFiles(resolvedRoot);
    const actualPaths = actualFiles
        .map(file => file.relativePath)
        .filter(relativePath => relativePath !== DEFAULT_LIBRARY_SHA_FILE);
    const expectedPaths = [...manifest.keys()].sort(compareText);

    if (
        actualPaths.length !== expectedPaths.length
        || actualPaths.some((value, index) => value !== expectedPaths[index])
    ) {
        throw new Error(
            "Состав собранной базовой библиотеки не соответствует SHA-манифесту.",
        );
    }

    for (const relativePath of expectedPaths) {
        const bytes = await readFile(
            path.join(resolvedRoot, ...relativePath.split("/")),
        );
        if (sha256(bytes) !== manifest.get(relativePath)) {
            throw new Error(
                `SHA-256 собранного файла не совпадает: '${relativePath}'.`,
            );
        }
    }

    const index = JSON.parse(
        await readFile(
            path.join(resolvedRoot, DEFAULT_LIBRARY_INDEX_FILE),
            "utf8",
        ),
    );
    if (index.schemaVersion !== DEFAULT_LIBRARY_SCHEMA_VERSION) {
        throw new Error(
            `Неподдерживаемая версия индекса: '${index.schemaVersion}'.`,
        );
    }

    for (const library of Object.values(index.libraries ?? {})) {
        for (const record of library.records ?? []) {
            const expectedDigest = manifest.get(record.relativePath);
            if (expectedDigest !== record.sha256) {
                throw new Error(
                    `Индекс и SHA-манифест расходятся для '${record.relativePath}'.`,
                );
            }
        }
    }

    return {
        assetRoot: resolvedRoot,
        fileCount: actualFiles.length,
        verifiedCount: expectedPaths.length,
        index,
    };
}

async function main() {
    const command = process.argv[2] ?? "prepare";
    if (command === "prepare") {
        const result = await prepareDefaultLibraryAssets();
        const recordCount = Object.values(result.index.libraries)
            .reduce((sum, library) => sum + library.records.length, 0);
        console.log(
            `Базовые характеристики подготовлены: ${recordCount}; `
            + `исходных файлов: ${result.index.source.fileCount}.`,
        );
        return;
    }
    if (command === "verify") {
        const result = await verifyDefaultLibraryAssets();
        console.log(
            `Базовые характеристики в dist проверены: `
            + `${result.verifiedCount} файлов по SHA-256.`,
        );
        return;
    }
    throw new Error(`Неизвестная команда: '${command}'.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch(error => {
        console.error(`Ошибка подготовки базовых характеристик: ${error.message}`);
        process.exitCode = 1;
    });
}
