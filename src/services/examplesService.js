import { BlobReader, ZipReader } from "@zip.js/zip.js";

const ROOT_NAME = "clark.projects";
const ZIP_OPTIONS = {
    useWebWorkers: false,
    filenameEncoding: "ibm866",
    strictness: "strict",
    filenameValidation: "strict",
};
const INVALID_WINDOWS_CHARACTERS = /[\x00-\x1f\x7f<>:"|?*\\]/;
const WINDOWS_DEVICE_NAME = /^(?:con|prn|aux|nul|clock\$|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i;

function installError(code, message, cause) {
    const error = new Error(message, cause ? { cause } : undefined);
    error.name = "ExamplesInstallError";
    error.code = code;
    return error;
}

function cancellationError() {
    const error = new Error("Загрузка примеров отменена.");
    error.name = "AbortError";
    error.code = "ABORTED";
    return error;
}

function checkAbort(signal) {
    if (signal?.aborted) throw cancellationError();
}

/** Returns an absolute URL; relative URLs require an explicit baseUrl. */
export function validateExamplesUrl(input, baseUrl) {
    let url;
    try {
        if (typeof input !== "string" || !input.trim()) throw new Error();
        url = new URL(input.trim(), baseUrl);
    }
    catch {
        throw installError("INVALID_URL", "Укажите корректную HTTPS-ссылку на ZIP-архив примеров.");
    }
    const localhost = url.hostname === "localhost"
        || url.hostname.endsWith(".localhost")
        || url.hostname === "127.0.0.1"
        || url.hostname === "[::1]";
    if (url.protocol !== "https:" && !(url.protocol === "http:" && localhost)) {
        throw installError("INVALID_URL", "Ссылка на архив должна использовать HTTPS (HTTP разрешён только для localhost).");
    }
    if (url.username || url.password) {
        throw installError("INVALID_URL", "Ссылка на архив не должна содержать логин или пароль.");
    }
    url.hash = "";
    return url.href;
}

// Compare conservatively across Windows/macOS/Linux without changing stored names.
function pathKey(path) {
    return path.normalize("NFC").toUpperCase();
}

function inspectPath(entry) {
    const name = entry.filename;
    if (typeof name !== "string" || !name || name.startsWith("/")) {
        throw installError("UNSAFE_PATH", "Архив содержит пустой или абсолютный путь.");
    }
    const path = entry.directory && name.endsWith("/") ? name.slice(0, -1) : name;
    const segments = path.split("/");
    for (const segment of segments) {
        if (!segment || segment === "." || segment === ".."
            || INVALID_WINDOWS_CHARACTERS.test(segment)
            || /[. ]$/.test(segment) || WINDOWS_DEVICE_NAME.test(segment)
            || segment.includes("\ufffd")) {
            throw installError("UNSAFE_PATH", `Архив содержит недопустимый или неоднозначный путь «${name}».`);
        }
    }
    const unixType = (entry.unixMode ?? (entry.externalFileAttributes >>> 16)) & 0xf000;
    if (entry.symlink || unixType === 0xa000) {
        throw installError("UNSAFE_ENTRY", `Архив содержит символическую ссылку «${name}».`);
    }
    if (unixType && unixType !== 0x8000 && unixType !== 0x4000) {
        throw installError("UNSAFE_ENTRY", `Архив содержит специальный файл «${name}».`);
    }
    if (entry.encrypted || entry.extraFieldAES || (entry.rawBitFlag & 0x41)) {
        throw installError("ENCRYPTED_ARCHIVE", "Зашифрованные ZIP-архивы примеров не поддерживаются.");
    }
    for (const size of [entry.compressedSize, entry.uncompressedSize, entry.offset]) {
        if (!Number.isSafeInteger(size) || size < 0) {
            throw installError("INVALID_ARCHIVE", `Некорректный или слишком большой размер записи «${name}».`);
        }
    }
    if (entry.directory && entry.uncompressedSize !== 0) {
        throw installError("INVALID_ARCHIVE", `Запись каталога «${name}» содержит данные файла.`);
    }
    return { entry, segments, path, directory: entry.directory };
}

function validateHierarchy(items) {
    const nodes = new Map();
    for (const item of items) {
        let path = "";
        for (let index = 0; index < item.segments.length; index += 1) {
            path += `${index ? "/" : ""}${item.segments[index]}`;
            const key = pathKey(path);
            const last = index === item.segments.length - 1;
            const directory = !last || item.directory;
            const previous = nodes.get(key);
            if (previous && (previous.path !== path || previous.directory !== directory
                || (last && previous.explicit))) {
                throw installError("PATH_COLLISION", `Архив содержит повторяющиеся или конфликтующие пути «${previous.path}» и «${path}».`);
            }
            nodes.set(key, { path, directory, explicit: (previous?.explicit ?? false) || last });
        }
    }
}

function resultFrom(progress) {
    return {
        rootName: ROOT_NAME,
        writtenFiles: progress.writtenFiles,
        skippedFiles: progress.skippedFiles,
        totalFiles: progress.totalFiles,
        totalBytes: progress.totalBytes,
        downloadedBytes: progress.downloadedBytes,
    };
}

function readableError(error, stage, path, signal) {
    if (signal?.aborted || error?.name === "AbortError") return cancellationError();
    if (error?.name === "ExamplesInstallError") return error;
    if (error?.name === "QuotaExceededError") {
        return installError("QUOTA_EXCEEDED", "Недостаточно места для архива или распакованных примеров. Освободите место на диске и в хранилище браузера.", error);
    }
    if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
        return installError("ACCESS_DENIED", "Браузер не разрешил запись файлов. Проверьте доступ к выбранному каталогу и откройте редактор через HTTPS или localhost.", error);
    }
    if (error?.name === "TypeMismatchError") {
        return installError("DESTINATION_CONFLICT", `Файл и каталог конфликтуют по пути «${path || ROOT_NAME}». Существующие данные сохранены.`, error);
    }
    if (stage === "download") {
        return installError("DOWNLOAD_FAILED", "Не удалось скачать архив. Проверьте ссылку и подключение к интернету; сервер архива должен разрешать загрузку из браузера (CORS).", error);
    }
    if (stage === "temporary") {
        return installError("TEMPORARY_STORAGE_FAILED", "Не удалось сохранить временный архив в браузере. Проверьте свободное место и настройки хранилища сайта.", error);
    }
    if (stage === "destination") {
        return installError("WRITE_FAILED", `Не удалось записать «${path || ROOT_NAME}». Проверьте доступ к каталогу и свободное место на диске.`, error);
    }
    return installError("INVALID_ARCHIVE", path
        ? `Не удалось проверить или распаковать «${path}»: ZIP-архив повреждён либо использует неподдерживаемый формат.`
        : "Скачанный файл не является корректным ZIP-архивом либо использует неподдерживаемый формат.", error);
}

/**
 * Download and extract every archive file, without importing or interpreting it.
 * Compressed bytes use a temporary OPFS File, not an in-memory archive buffer;
 * entries are written sequentially and committed only after CRC/size checks.
 * There is no 10 MB (or compression-ratio) limit. Practical bounds are browser
 * OPFS quota, destination disk space, ZIP metadata memory and safe integer sizes.
 * The caller obtains destinationHandle through a user-activated directory picker.
 */
export async function installExamples({
    url,
    destinationHandle,
    signal,
    onProgress,
    fetchImpl = globalThis.fetch,
    storage = globalThis.navigator?.storage,
}) {
    const archiveUrl = validateExamplesUrl(url);
    if (!destinationHandle || destinationHandle.kind !== "directory"
        || typeof destinationHandle.getDirectoryHandle !== "function") {
        throw installError("DESTINATION_REQUIRED", "Выберите каталог для сохранения примеров.");
    }
    if (typeof storage?.getDirectory !== "function") {
        throw installError("STORAGE_UNAVAILABLE", "Браузер не предоставляет временное файловое хранилище для загрузки ZIP-архива. Используйте актуальный Chrome или Edge через HTTPS или localhost.");
    }
    const progress = {
        phase: "download", downloadedBytes: 0, totalDownloadBytes: 0,
        writtenBytes: 0, totalBytes: 0, completedFiles: 0, totalFiles: 0,
        writtenFiles: 0, skippedFiles: 0, currentPath: "",
    };
    const emit = () => {
        // An observer must not interrupt a filesystem commit or its accounting.
        try { onProgress?.({ ...progress }); } catch { /* UI callback only. */ }
    };
    let stage = "temporary";
    let temporaryRoot;
    let temporaryName;
    let zipReader;
    let downloadReader;
    let activeWritable;
    let incompleteFile;
    let destinationStarted = false;
    let failure;
    let result;
    const cancellationWork = [];
    const onAbort = () => {
        const reason = cancellationError();
        if (downloadReader) cancellationWork.push(Promise.resolve(downloadReader.cancel(reason)).catch(() => {}));
        if (activeWritable) cancellationWork.push(Promise.resolve(activeWritable.abort(reason)).catch(() => {}));
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    // Cache directory listings for conservative case-insensitive conflict checks.
    const directoryContents = new WeakMap();
    const childrenOf = async directory => {
        if (!directoryContents.has(directory)) {
            const children = new Map();
            for await (const [name, handle] of directory.entries()) {
                checkAbort(signal);
                const key = pathKey(name);
                if (children.has(key)) children.set(key, { kind: "ambiguous", name });
                else children.set(key, { kind: handle.kind, name, handle });
            }
            directoryContents.set(directory, children);
        }
        return directoryContents.get(directory);
    };
    const ensureDirectory = async (parent, name, path) => {
        checkAbort(signal);
        const children = await childrenOf(parent);
        const existing = children.get(pathKey(name));
        if (existing) {
            if (existing.kind !== "directory" || existing.name !== name) {
                throw installError("DESTINATION_CONFLICT", `Нельзя создать каталог «${path}»: это имя уже занято файлом или отличается регистром букв.`);
            }
            return existing.handle;
        }
        checkAbort(signal);
        destinationStarted = true;
        const handle = await parent.getDirectoryHandle(name, { create: true });
        children.set(pathKey(name), { kind: "directory", name, handle });
        return handle;
    };

    try {
        checkAbort(signal);
        emit();
        temporaryRoot = await storage.getDirectory();
        checkAbort(signal);
        temporaryName = `.clark-examples-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}.zip`;
        const temporaryHandle = await temporaryRoot.getFileHandle(temporaryName, { create: true });
        activeWritable = await temporaryHandle.createWritable();
        checkAbort(signal);
        stage = "download";
        const response = await fetchImpl(archiveUrl, {
            method: "GET", mode: "cors", credentials: "omit", referrerPolicy: "no-referrer", signal,
        });
        if (response.body && typeof response.body.getReader === "function") {
            downloadReader = response.body.getReader();
        }
        checkAbort(signal);
        if (!response.ok) {
            throw installError("HTTP_ERROR", `Сервер не отдал архив примеров (HTTP ${response.status}). Проверьте ссылку.`);
        }
        if (response.url) validateExamplesUrl(response.url);
        if (!downloadReader) {
            throw installError("DOWNLOAD_FAILED", "Сервер вернул недоступный или пустой ответ вместо ZIP-архива. Проверьте ссылку и настройки CORS.");
        }
        const contentLength = Number(response.headers.get("content-length"));
        if (Number.isSafeInteger(contentLength) && contentLength > 0) progress.totalDownloadBytes = contentLength;
        emit();
        while (true) {
            checkAbort(signal);
            stage = "download";
            const { value, done } = await downloadReader.read();
            checkAbort(signal);
            if (done) break;
            stage = "temporary";
            await activeWritable.write(value);
            progress.downloadedBytes += value.byteLength;
            if (!Number.isSafeInteger(progress.downloadedBytes)) {
                throw installError("ARCHIVE_TOO_LARGE", "Размер архива превышает точность файловых смещений, поддерживаемую браузером.");
            }
            emit();
        }
        downloadReader.releaseLock();
        downloadReader = undefined;
        stage = "temporary";
        await activeWritable.close();
        activeWritable = undefined;
        checkAbort(signal);
        const archiveFile = await temporaryHandle.getFile();
        progress.totalDownloadBytes = progress.downloadedBytes;
        progress.phase = "inspect";
        stage = "inspect";
        emit();
        zipReader = new ZipReader(new BlobReader(archiveFile), ZIP_OPTIONS);
        const items = [];
        for await (const entry of zipReader.getEntriesGenerator()) {
            checkAbort(signal);
            items.push(inspectPath(entry));
        }
        if (!items.length) throw installError("EMPTY_ARCHIVE", "ZIP-архив примеров пуст.");
        validateHierarchy(items);
        const stripRoot = items.every(item => item.segments[0] === ROOT_NAME
            && (item.segments.length > 1 || item.directory));
        if (stripRoot) {
            for (const item of items) {
                item.segments = item.segments.slice(1);
                item.path = item.segments.join("/");
            }
        }
        for (const item of items) {
            if (!item.directory) {
                progress.totalFiles += 1;
                progress.totalBytes += item.entry.uncompressedSize;
                if (!Number.isSafeInteger(progress.totalBytes)) {
                    throw installError("ARCHIVE_TOO_LARGE", "Суммарный размер файлов архива превышает точность размеров, поддерживаемую браузером.");
                }
            }
        }
        emit();
        // zip.js checks local headers and overlapping records without inflating
        // content. Finish this complete preflight before any destination mutation.
        for (const item of items) {
            checkAbort(signal);
            progress.currentPath = item.path;
            emit();
            await item.entry.getData(undefined, { ...ZIP_OPTIONS, signal, checkOverlappingEntryOnly: true });
        }
        checkAbort(signal);
        stage = "destination";
        const root = destinationHandle.name === ROOT_NAME
            ? destinationHandle
            : await ensureDirectory(destinationHandle, ROOT_NAME, ROOT_NAME);
        progress.phase = "extract";
        emit();
        for (const item of items) {
            checkAbort(signal);
            if (!item.segments.length) continue;
            stage = "destination";
            progress.currentPath = item.path;
            emit();
            let parent = root;
            const directorySegments = item.directory ? item.segments : item.segments.slice(0, -1);
            for (let index = 0; index < directorySegments.length; index += 1) {
                parent = await ensureDirectory(parent, directorySegments[index], directorySegments.slice(0, index + 1).join("/"));
            }
            if (item.directory) continue;
            const name = item.segments.at(-1);
            const children = await childrenOf(parent);
            let existing = children.get(pathKey(name));
            if (!existing) {
                // Recheck just before create, including changes since the listing.
                try {
                    const handle = await parent.getFileHandle(name);
                    existing = { kind: "file", name, handle };
                }
                catch (error) { if (error.name !== "NotFoundError") throw error; }
            }
            if (existing) {
                if (existing.kind !== "file") {
                    throw installError("DESTINATION_CONFLICT", `Нельзя сохранить файл «${item.path}»: это имя занято каталогом или неоднозначно.`);
                }
                progress.skippedFiles += 1;
                progress.completedFiles += 1;
                emit();
                continue;
            }
            checkAbort(signal);
            destinationStarted = true;
            const fileHandle = await parent.getFileHandle(name, { create: true });
            incompleteFile = { parent, name, fileHandle, bytes: 0 };
            checkAbort(signal);
            activeWritable = await fileHandle.createWritable({ keepExistingData: false, mode: "exclusive" });
            checkAbort(signal);
            const fileWritable = activeWritable;
            const sink = new WritableStream({
                async write(chunk) {
                    checkAbort(signal);
                    if (incompleteFile.bytes + chunk.byteLength > item.entry.uncompressedSize) {
                        throw installError("INVALID_ARCHIVE", `Размер распакованного файла «${item.path}» превышает размер, указанный в ZIP-архиве.`);
                    }
                    try { await fileWritable.write(chunk); }
                    catch (error) { throw readableError(error, "destination", item.path, signal); }
                    incompleteFile.bytes += chunk.byteLength;
                    progress.writtenBytes += chunk.byteLength;
                    emit();
                },
            });
            stage = "extract";
            await item.entry.getData(sink, { ...ZIP_OPTIONS, signal, checkCrc32: true, preventClose: true });
            checkAbort(signal);
            if (incompleteFile.bytes !== item.entry.uncompressedSize) {
                throw installError("INVALID_ARCHIVE", `Размер распакованного файла «${item.path}» не совпадает с размером в ZIP-архиве.`);
            }
            stage = "destination";
            await fileWritable.close();
            activeWritable = undefined;
            incompleteFile = undefined;
            children.set(pathKey(name), { kind: "file", name, handle: fileHandle });
            progress.writtenFiles += 1;
            progress.completedFiles += 1;
            emit();
        }
        checkAbort(signal);
        result = resultFrom(progress);
    }
    catch (error) {
        failure = readableError(error, stage, progress.currentPath, signal);
    }
    finally {
        signal?.removeEventListener("abort", onAbort);
        if (downloadReader) {
            try { await downloadReader.cancel(); } catch { /* Already failed or cancelled. */ }
            try { downloadReader.releaseLock(); } catch { /* Already released. */ }
        }
        if (activeWritable) {
            try { await activeWritable.abort(); } catch { /* Already aborted/closed. */ }
        }
        await Promise.all(cancellationWork);
        if (incompleteFile) {
            progress.writtenBytes -= incompleteFile.bytes;
            try {
                // Never recursively remove directories or delete a completed file.
                const current = await incompleteFile.parent.getFileHandle(incompleteFile.name);
                if (await current.isSameEntry(incompleteFile.fileHandle)) {
                    await incompleteFile.parent.removeEntry(incompleteFile.name);
                }
            }
            catch (error) {
                if (error.name !== "NotFoundError" && failure) {
                    failure.message += ` Не удалось удалить незавершённый файл «${progress.currentPath}».`;
                }
            }
        }
        if (zipReader) {
            try { await zipReader.close(); }
            catch (error) { failure ??= readableError(error, "inspect", "", signal); }
        }
        if (temporaryRoot && temporaryName) {
            try { await temporaryRoot.removeEntry(temporaryName); }
            catch (error) {
                if (error.name !== "NotFoundError") {
                    if (failure) failure.message += " Не удалось удалить временный архив из хранилища браузера.";
                    else failure = installError("TEMPORARY_CLEANUP_FAILED", "Примеры сохранены, но удалить временный архив из хранилища браузера не удалось.", error);
                }
            }
        }
    }
    if (failure) {
        if (destinationStarted || progress.completedFiles > 0) failure.partialResult = resultFrom(progress);
        emit();
        throw failure;
    }
    progress.phase = "complete";
    progress.currentPath = "";
    emit();
    return result;
}
