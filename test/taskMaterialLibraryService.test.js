import test from "node:test";
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";

import {
    createTaskMaterialLibraryService,
    MaterialBatchConflictError,
    MaterialBatchWriteError,
    MaterialFileConflictError,
} from "../src/services/taskMaterialLibraryService.js";

function sha256(bytes) {
    return createHash("sha256").update(bytes).digest("hex");
}

function notFound(name) {
    const error = new Error(`Не найдено: ${name}`);
    error.name = "NotFoundError";
    return error;
}

class MemoryFileHandle {
    constructor(bytes = new Uint8Array(), { failWrite = false } = {}) {
        this.kind = "file";
        this.bytes = new Uint8Array(bytes);
        this.writeCount = 0;
        this.failWrite = failWrite;
    }

    async getFile() {
        const bytes = new Uint8Array(this.bytes);
        return {
            async arrayBuffer() {
                return bytes.buffer.slice(
                    bytes.byteOffset,
                    bytes.byteOffset + bytes.byteLength,
                );
            },
        };
    }

    async createWritable() {
        const handle = this;
        let nextBytes = null;
        return {
            async write(bytes) {
                if (handle.failWrite) {
                    throw new Error("имитация сбоя записи");
                }
                nextBytes = new Uint8Array(bytes);
            },
            async close() {
                handle.bytes = nextBytes ?? new Uint8Array();
                handle.writeCount += 1;
            },
            async abort() {
                nextBytes = null;
            },
        };
    }
}

class MemoryDirectoryHandle {
    constructor() {
        this.kind = "directory";
        this.directories = new Map();
        this.files = new Map();
    }

    async getDirectoryHandle(name, { create = false } = {}) {
        if (!this.directories.has(name)) {
            if (!create) throw notFound(name);
            this.directories.set(name, new MemoryDirectoryHandle());
        }
        return this.directories.get(name);
    }

    async getFileHandle(name, { create = false } = {}) {
        if (!this.files.has(name)) {
            if (!create) throw notFound(name);
            this.files.set(name, new MemoryFileHandle());
        }
        return this.files.get(name);
    }

    async *entries() {
        for (const entry of this.directories) yield entry;
        for (const entry of this.files) yield entry;
    }

    async removeEntry(name) {
        if (!this.files.delete(name) && !this.directories.delete(name)) {
            throw notFound(name);
        }
    }
}

async function taskRoot() {
    const root = new MemoryDirectoryHandle();
    await root.getDirectoryHandle("input3XX", { create: true });
    return root;
}

async function taskInputDirectory(root) {
    return root.getDirectoryHandle("input3XX");
}

async function taskLibraryDirectory(root, name, options = undefined) {
    const inputDirectory = await taskInputDirectory(root);
    return inputDirectory.getDirectoryHandle(name, options);
}

function materialRecord(bytes, kind = "FMM") {
    const fileName = kind === "FMM" ? "Сталь 3.txt" : "ВТСП 1.txt";
    return {
        kind,
        fileName,
        sha256: sha256(bytes),
    };
}

function serviceFor(bytes) {
    let loadCount = 0;
    const service = createTaskMaterialLibraryService({
        libraryService: {
            async loadBytes() {
                loadCount += 1;
                return new Uint8Array(bytes);
            },
        },
        cryptoImpl: webcrypto,
    });
    return { service, getLoadCount: () => loadCount };
}

function importedMaterial(name, text, kind = "FMM") {
    return {
        kind,
        name,
        fileName: `${name}.txt`,
        text,
    };
}

test("a base material is copied byte-for-byte into the task-local library", async () => {
    const bytes = Buffer.from("{\"comment\":\"Сталь\"}\n", "utf8");
    const root = await taskRoot();
    const { service } = serviceFor(bytes);

    const result = await service.copyMaterial({
        taskHandle: root,
        record: materialRecord(bytes),
    });

    assert.deepEqual(result, {
        status: "created",
        path: "input3XX/xapLibFMM/Сталь 3.txt",
        byteSize: bytes.byteLength,
        sha256: sha256(bytes),
    });
    const library = await taskLibraryDirectory(root, "xapLibFMM");
    const file = await library.getFileHandle("Сталь 3.txt");
    assert.deepEqual(Buffer.from(file.bytes), bytes);
});

test("task-local libraries require the mandatory input3XX directory", async () => {
    const bytes = Buffer.from("{}\n", "utf8");
    const root = new MemoryDirectoryHandle();
    const { service } = serviceFor(bytes);

    await assert.rejects(
        service.copyMaterial({
            taskHandle: root,
            record: materialRecord(bytes),
        }),
        /обязательный input3XX/,
    );
    assert.equal(root.directories.has("xapLibFMM"), false);
    assert.equal(root.directories.has("input3XX"), false);
});

test("an identical task-local material is an idempotent copy", async () => {
    const bytes = Buffer.from("одинаковые байты", "utf8");
    const root = await taskRoot();
    const library = await taskLibraryDirectory(
        root,
        "xapLibHTC",
        { create: true },
    );
    library.files.set("ВТСП 1.txt", new MemoryFileHandle(bytes));
    const { service, getLoadCount } = serviceFor(bytes);

    const result = await service.copyMaterial({
        taskHandle: root,
        record: materialRecord(bytes, "HTC"),
    });

    assert.equal(result.status, "unchanged");
    assert.equal(getLoadCount(), 0);
});

test("a changed task-local material is preserved until overwrite is explicit", async () => {
    const baseBytes = Buffer.from("базовая версия", "utf8");
    const localBytes = Buffer.from("пользовательская версия", "utf8");
    const root = await taskRoot();
    const library = await taskLibraryDirectory(
        root,
        "xapLibFMM",
        { create: true },
    );
    const file = new MemoryFileHandle(localBytes);
    library.files.set("Сталь 3.txt", file);
    const { service, getLoadCount } = serviceFor(baseBytes);
    const record = materialRecord(baseBytes);

    await assert.rejects(
        service.copyMaterial({ taskHandle: root, record }),
        error => error instanceof MaterialFileConflictError,
    );
    assert.deepEqual(Buffer.from(file.bytes), localBytes);
    assert.equal(getLoadCount(), 0);

    const result = await service.copyMaterial({
        taskHandle: root,
        record,
        overwrite: true,
    });
    assert.equal(result.status, "replaced");
    assert.deepEqual(Buffer.from(file.bytes), baseBytes);
});

test("copying rejects path separators in a material file name", async () => {
    const bytes = Buffer.from("данные", "utf8");
    const root = await taskRoot();
    const { service } = serviceFor(bytes);

    await assert.rejects(
        service.copyMaterial({
            taskHandle: root,
            record: {
                ...materialRecord(bytes),
                fileName: "../Сталь.txt",
            },
        }),
        /Недопустимое имя характеристики/,
    );
});

test("selected base materials are all preflighted before the first copy", async () => {
    const newBytes = Buffer.from("новая базовая\n", "utf8");
    const baseConflictBytes = Buffer.from("базовый конфликт\n", "utf8");
    const localConflictBytes = Buffer.from("локальный конфликт\n", "utf8");
    const root = await taskRoot();
    const library = await taskLibraryDirectory(
        root,
        "xapLibFMM",
        { create: true },
    );
    const conflictFile = new MemoryFileHandle(localConflictBytes);
    library.files.set("Конфликт.txt", conflictFile);
    let loadCount = 0;
    const service = createTaskMaterialLibraryService({
        libraryService: {
            async loadBytes(record) {
                loadCount += 1;
                return new Uint8Array(record.bytes);
            },
        },
        cryptoImpl: webcrypto,
    });
    const records = [
        {
            kind: "FMM",
            fileName: "Новая.txt",
            sha256: sha256(newBytes),
            bytes: newBytes,
        },
        {
            kind: "FMM",
            fileName: "Конфликт.txt",
            sha256: sha256(baseConflictBytes),
            bytes: baseConflictBytes,
        },
    ];

    await assert.rejects(
        service.copyMaterials({ taskHandle: root, records }),
        error => {
            assert.ok(error instanceof MaterialBatchConflictError);
            assert.equal(error.conflicts.length, 1);
            return true;
        },
    );

    assert.equal(library.files.has("Новая.txt"), false);
    assert.equal(conflictFile.writeCount, 0);
    assert.equal(loadCount, 0);
});

test("an imported batch writes UTF-8 files only after full validation", async () => {
    const root = await taskRoot();
    const { service } = serviceFor(new Uint8Array());
    const materials = [
        importedMaterial("Сталь", "{\"comment\":\"Сталь\"}\n"),
        importedMaterial("Сплав", "{\"comment\":\"Сплав\"}\n"),
    ];

    const result = await service.writeImportedBatch({
        taskHandle: root,
        kind: "FMM",
        materials,
        sourceName: "XAP.lib",
    });

    assert.equal(result.status, "written");
    assert.equal(result.created, 2);
    assert.equal(result.replaced, 0);
    assert.equal(result.unchanged, 0);
    assert.equal(result.sourceName, "XAP.lib");

    const library = await taskLibraryDirectory(root, "xapLibFMM");
    for (const material of materials) {
        const file = await library.getFileHandle(material.fileName);
        assert.equal(
            new TextDecoder().decode(file.bytes),
            material.text,
        );
    }
});

test("batch conflicts are all reported before any file is written", async () => {
    const root = await taskRoot();
    const library = await taskLibraryDirectory(
        root,
        "xapLibFMM",
        { create: true },
    );
    const local = new MemoryFileHandle(Buffer.from("локальная", "utf8"));
    const localSecond = new MemoryFileHandle(Buffer.from("локальная 2", "utf8"));
    library.files.set("Конфликт.txt", local);
    library.files.set("Конфликт 2.txt", localSecond);
    const { service } = serviceFor(new Uint8Array());
    const materials = [
        importedMaterial("Новая", "новая\n"),
        importedMaterial("Конфликт", "импорт\n"),
        importedMaterial("Конфликт 2", "импорт 2\n"),
    ];

    await assert.rejects(
        service.writeImportedBatch({
            taskHandle: root,
            kind: "FMM",
            materials,
        }),
        error => {
            assert.ok(error instanceof MaterialBatchConflictError);
            assert.equal(error.conflicts.length, 2);
            assert.equal(
                error.conflicts[0].path,
                "input3XX/xapLibFMM/Конфликт.txt",
            );
            return true;
        },
    );

    assert.equal(library.files.has("Новая.txt"), false);
    assert.equal(local.writeCount, 0);
    assert.equal(localSecond.writeCount, 0);
    assert.equal(
        new TextDecoder().decode(local.bytes),
        "локальная",
    );
});

test("confirmed imported batch replaces conflicts and skips identical files", async () => {
    const root = await taskRoot();
    const library = await taskLibraryDirectory(
        root,
        "xapLibHTC",
        { create: true },
    );
    const changed = new MemoryFileHandle(Buffer.from("старая\n", "utf8"));
    const same = new MemoryFileHandle(Buffer.from("без изменений\n", "utf8"));
    library.files.set("A.txt", changed);
    library.files.set("B.txt", same);
    const { service } = serviceFor(new Uint8Array());

    const request = {
        taskHandle: root,
        kind: "HTC",
        materials: [
            importedMaterial("A", "новая\n", "HTC"),
            importedMaterial("B", "без изменений\n", "HTC"),
            importedMaterial("C", "создана\n", "HTC"),
        ],
    };
    let expectedConflicts;
    await assert.rejects(
        service.writeImportedBatch(request),
        error => {
            assert.ok(error instanceof MaterialBatchConflictError);
            expectedConflicts = error.conflicts;
            return true;
        },
    );
    await assert.rejects(
        service.writeImportedBatch({
            ...request,
            overwrite: true,
        }),
        error => error instanceof MaterialBatchConflictError,
    );
    const result = await service.writeImportedBatch({
        ...request,
        overwrite: true,
        expectedConflicts,
    });

    assert.deepEqual(
        result.results.map(item => item.status),
        ["replaced", "unchanged", "created"],
    );
    assert.equal(result.replaced, 1);
    assert.equal(result.unchanged, 1);
    assert.equal(result.created, 1);
    assert.equal(changed.writeCount, 1);
    assert.equal(same.writeCount, 0);
    assert.equal(
        new TextDecoder().decode(changed.bytes),
        "новая\n",
    );
});

test("changed conflicts after confirmation require a new confirmation", async () => {
    const root = await taskRoot();
    const library = await taskLibraryDirectory(
        root,
        "xapLibFMM",
        { create: true },
    );
    const file = new MemoryFileHandle(Buffer.from("первая локальная\n", "utf8"));
    library.files.set("A.txt", file);
    const { service } = serviceFor(new Uint8Array());
    const request = {
        taskHandle: root,
        kind: "FMM",
        materials: [importedMaterial("A", "импорт\n")],
    };
    let confirmedConflicts;

    await assert.rejects(
        service.writeImportedBatch(request),
        error => {
            assert.ok(error instanceof MaterialBatchConflictError);
            confirmedConflicts = error.conflicts;
            return true;
        },
    );

    file.bytes = new Uint8Array(Buffer.from("вторая локальная\n", "utf8"));

    await assert.rejects(
        service.writeImportedBatch({
            ...request,
            overwrite: true,
            expectedConflicts: confirmedConflicts,
        }),
        error => {
            assert.ok(error instanceof MaterialBatchConflictError);
            assert.notEqual(
                error.conflicts[0].existingSha256,
                confirmedConflicts[0].existingSha256,
            );
            return true;
        },
    );
    assert.equal(file.writeCount, 0);
    assert.equal(
        new TextDecoder().decode(file.bytes),
        "вторая локальная\n",
    );
});

test("a mid-write failure reports completed, failed, and remaining files", async () => {
    const root = await taskRoot();
    const library = await taskLibraryDirectory(
        root,
        "xapLibFMM",
        { create: true },
    );
    const failing = new MemoryFileHandle(
        Buffer.from("локальная B\n", "utf8"),
        { failWrite: true },
    );
    library.files.set("B.txt", failing);
    const { service } = serviceFor(new Uint8Array());
    const request = {
        taskHandle: root,
        kind: "FMM",
        sourceName: "XAP.lib",
        materials: [
            importedMaterial("A", "создана A\n"),
            importedMaterial("B", "замена B\n"),
            importedMaterial("C", "создана C\n"),
        ],
    };
    let expectedConflicts;
    await assert.rejects(
        service.writeImportedBatch(request),
        error => {
            assert.ok(error instanceof MaterialBatchConflictError);
            expectedConflicts = error.conflicts;
            return true;
        },
    );

    await assert.rejects(
        service.writeImportedBatch({
            ...request,
            overwrite: true,
            expectedConflicts,
        }),
        error => {
            assert.ok(error instanceof MaterialBatchWriteError);
            assert.equal(error.kind, "FMM");
            assert.equal(error.sourceName, "XAP.lib");
            assert.deepEqual(
                error.written.map(item => item.path),
                ["input3XX/xapLibFMM/A.txt"],
            );
            assert.equal(
                error.failed.path,
                "input3XX/xapLibFMM/B.txt",
            );
            assert.match(error.failed.message, /имитация сбоя записи/u);
            assert.deepEqual(
                error.remaining.map(item => item.path),
                ["input3XX/xapLibFMM/C.txt"],
            );
            return true;
        },
    );

    assert.equal(library.files.has("A.txt"), true);
    assert.equal(library.files.has("C.txt"), false);
    assert.equal(failing.writeCount, 0);
    assert.equal(
        new TextDecoder().decode(failing.bytes),
        "локальная B\n",
    );
});

test("an unsafe or duplicate batch fails before creating its library", async () => {
    const root = await taskRoot();
    const { service } = serviceFor(new Uint8Array());

    await assert.rejects(
        service.writeImportedBatch({
            taskHandle: root,
            kind: "FMM",
            materials: [
                importedMaterial("Допустимая", "данные\n"),
                importedMaterial("NUL", "данные\n"),
            ],
        }),
        /зарезервировано Windows/,
    );
    assert.equal(
        (await taskInputDirectory(root)).directories.has("xapLibFMM"),
        false,
    );

    await assert.rejects(
        service.writeImportedBatch({
            taskHandle: root,
            kind: "HTC",
            materials: [
                importedMaterial("Материал", "1\n", "HTC"),
                importedMaterial("материал", "2\n", "HTC"),
            ],
        }),
        /конфликтуют в Windows/,
    );
    assert.equal(
        (await taskInputDirectory(root)).directories.has("xapLibHTC"),
        false,
    );
});

test("task-local materials are loaded from directories inside input3XX", async () => {
    const root = await taskRoot();
    const library = await taskLibraryDirectory(
        root,
        "xapLibFMM",
        { create: true },
    );
    const first = Buffer.from('{"tabl":[0,1],"hip":0,"comment":"Б"}\n', "utf8");
    const second = Buffer.from('{"tabl":[0,1],"hip":0,"comment":"А"}\n', "utf8");
    library.files.set("Бета.txt", new MemoryFileHandle(first));
    library.files.set("Альфа.txt", new MemoryFileHandle(second));
    library.files.set("служебный.bin", new MemoryFileHandle(second));
    const { service } = serviceFor(new Uint8Array());

    const records = await service.loadMaterials({
        taskHandle: root,
        kind: "FMM",
    });

    assert.deepEqual(records.map(record => record.name), ["Альфа", "Бета"]);
    assert.equal(records[0].source, "task");
    assert.equal(
        records[0].relativePath,
        "input3XX/xapLibFMM/Альфа.txt",
    );
    assert.equal(records[0].sha256, sha256(second));
});

test("explicit local edit and delete use the loaded SHA as a concurrency guard", async () => {
    const root = await taskRoot();
    const library = await taskLibraryDirectory(
        root,
        "xapLibFMM",
        { create: true },
    );
    const original = Buffer.from('{"comment":"исходная"}\n', "utf8");
    const file = new MemoryFileHandle(original);
    library.files.set("Сталь.txt", file);
    const { service } = serviceFor(new Uint8Array());
    const [loaded] = await service.loadMaterials({
        taskHandle: root,
        kind: "FMM",
    });

    const editedText = '{"comment":"изменённая"}\n';
    const result = await service.saveMaterial({
        taskHandle: root,
        material: importedMaterial("Сталь", editedText),
        expectedSha256: loaded.sha256,
    });
    assert.equal(result.status, "replaced");
    assert.equal(new TextDecoder().decode(file.bytes), editedText);

    await assert.rejects(
        service.deleteMaterials({ taskHandle: root, records: [loaded] }),
        error => error instanceof MaterialFileConflictError,
    );

    const [reloaded] = await service.loadMaterials({
        taskHandle: root,
        kind: "FMM",
    });
    const deleted = await service.deleteMaterials({
        taskHandle: root,
        records: [reloaded],
    });
    assert.deepEqual(deleted, [{
        status: "deleted",
        path: "input3XX/xapLibFMM/Сталь.txt",
    }]);
    assert.equal(library.files.has("Сталь.txt"), false);
});
