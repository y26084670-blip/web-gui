import { DIRECTORIES } from "./schemas/common/constants.js";

export const DEMO_TASK_NAME = "Демонстрационная задача";

// Only this module owns the working files; each load creates a fresh tree.
const nodes = new WeakMap();

function fileError(name, message) {
    return new DOMException(message, name);
}

function assertName(name) {
    if (typeof name !== "string" || !name || name === "." || name === ".."
        || /[/\\\0]/u.test(name)) {
        throw new TypeError(`Недопустимое имя файла или каталога: ${name}`);
    }
}

function currentNode(handle) {
    const node = nodes.get(handle);
    if (!node || node.removed) {
        throw fileError("NotFoundError", "Файл или каталог больше не существует.");
    }
    return node;
}

function createNode(kind, name, parent = null) {
    const node = {
        kind, name, parent, removed: false,
        children: kind === "directory" ? new Map() : null,
        bytes: kind === "file" ? new Uint8Array() : null,
        lastModified: Date.now(),
    };
    node.handle = kind === "directory"
        ? new MemoryDirectoryHandle(node)
        : new MemoryFileHandle(node);
    return node;
}

class MemoryHandle {
    constructor(node) {
        nodes.set(this, node);
    }

    get kind() { return nodes.get(this).kind; }
    get name() { return nodes.get(this).name; }
    async queryPermission() { return "granted"; }
    async requestPermission() { return "granted"; }
    async isSameEntry(other) { return nodes.get(this) === nodes.get(other); }
}

class MemoryDirectoryHandle extends MemoryHandle {
    getChild(name, kind, { create = false } = {}) {
        assertName(name);
        const parent = currentNode(this);
        let child = parent.children.get(name);
        if (child && child.kind !== kind) {
            throw fileError("TypeMismatchError", `Имя «${name}» занято другим типом объекта.`);
        }
        if (!child) {
            if (!create) {
                throw fileError("NotFoundError", `Файл или каталог «${name}» отсутствует.`);
            }
            child = createNode(kind, name, parent);
            parent.children.set(name, child);
        }
        return child.handle;
    }

    async getDirectoryHandle(name, options) {
        return this.getChild(name, "directory", options);
    }

    async getFileHandle(name, options) {
        return this.getChild(name, "file", options);
    }

    async *entries() {
        for (const [name, child] of currentNode(this).children) {
            yield [name, child.handle];
        }
    }

    async *values() {
        for await (const [, handle] of this.entries()) yield handle;
    }

    [Symbol.asyncIterator]() { return this.entries(); }

    async removeEntry(name, { recursive = false } = {}) {
        assertName(name);
        const parent = currentNode(this);
        const child = parent.children.get(name);
        if (!child) {
            throw fileError("NotFoundError", `Файл или каталог «${name}» отсутствует.`);
        }
        if (child.children?.size && !recursive) {
            throw fileError("InvalidModificationError", `Каталог «${name}» не пуст.`);
        }
        const remove = node => {
            node.removed = true;
            for (const descendant of node.children?.values() ?? []) remove(descendant);
        };
        remove(child);
        parent.children.delete(name);
    }

    async resolve(handle) {
        const root = currentNode(this);
        let node = nodes.get(handle);
        if (!node || node.removed) return null;
        const path = [];
        while (node !== root) {
            if (!node.parent) return null;
            path.unshift(node.name);
            node = node.parent;
        }
        return path;
    }
}

async function writeBytes(data) {
    if (typeof data === "string") return new TextEncoder().encode(data);
    if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
    if (data instanceof ArrayBuffer) return new Uint8Array(data.slice(0));
    if (ArrayBuffer.isView(data)) {
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
    }
    throw new TypeError("Для записи нужны строка, Blob или байтовый буфер.");
}

class MemoryFileHandle extends MemoryHandle {
    async getFile() {
        const node = currentNode(this);
        // File copies its bytes: an earlier snapshot survives subsequent writes.
        return new File([node.bytes], node.name, { lastModified: node.lastModified });
    }

    async createWritable({ keepExistingData = false } = {}) {
        const node = currentNode(this);
        let bytes = keepExistingData ? node.bytes.slice() : new Uint8Array();
        let position = 0;
        let state = "open";
        let pending = Promise.resolve();
        const requireOpen = () => {
            if (state !== "open") {
                throw fileError("InvalidStateError", "Запись файла уже завершена или отменена.");
            }
        };

        // The editor and material services write strings or buffers sequentially.
        // Changes become visible only after close; abort leaves the file intact.
        return {
            async write(data) {
                requireOpen();
                pending = pending.then(async () => {
                    const chunk = await writeBytes(data);
                    if (state === "aborted") return;
                    const end = position + chunk.byteLength;
                    if (end > bytes.byteLength) {
                        const extended = new Uint8Array(end);
                        extended.set(bytes);
                        bytes = extended;
                    }
                    bytes.set(chunk, position);
                    position = end;
                });
                return pending;
            },
            async close() {
                requireOpen();
                state = "closing";
                await pending;
                if (state === "aborted") {
                    throw fileError("AbortError", "Запись файла отменена.");
                }
                currentNode(node.handle);
                node.bytes = bytes;
                node.lastModified = Date.now();
                state = "closed";
            },
            async abort() {
                if (state === "closed") {
                    throw fileError("InvalidStateError", "Запись файла уже завершена.");
                }
                state = "aborted";
                await pending.catch(() => {});
            },
        };
    }
}

function pathSegments(path) {
    if (typeof path !== "string") throw new TypeError("В пакете демо отсутствует путь.");
    const segments = path.split("/");
    segments.forEach(assertName);
    return segments;
}

async function ensureDirectory(root, segments) {
    let directory = root;
    for (const name of segments) {
        directory = await directory.getDirectoryHandle(name, { create: true });
    }
    return directory;
}

export async function loadDemoTask() {
    try {
        const response = await fetch(`${import.meta.env.BASE_URL}demo-task.json`, {
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error(`Сервер не отдал пакет демо (HTTP ${response.status}).`);
        }
        const bundle = await response.json();
        if (bundle?.schemaVersion !== 1 || !Array.isArray(bundle.directories)
            || !Array.isArray(bundle.files)) {
            throw new Error("Неподдерживаемый формат пакета демо.");
        }

        const task = createNode("directory", DEMO_TASK_NAME).handle;
        const input = await task.getDirectoryHandle(DIRECTORIES.INPUT, { create: true });
        for (const path of bundle.directories) {
            await ensureDirectory(input, pathSegments(path));
        }
        for (const file of bundle.files) {
            const segments = pathSegments(file.path);
            const parent = await ensureDirectory(input, segments.slice(0, -1));
            const handle = await parent.getFileHandle(segments.at(-1), { create: true });
            const binary = atob(file.base64);
            currentNode(handle).bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
        }
        return task;
    } catch (cause) {
        throw new Error(
            `Не удалось загрузить демонстрационную задачу: ${cause?.message ?? String(cause)}`,
            { cause },
        );
    }
}
