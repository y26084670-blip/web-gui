const ROOT_NAME = "clark.projects";
const INVALID_WINDOWS_CHARACTERS = /[\x00-\x1f\x7f<>:"|?*\\]/;
const WINDOWS_DEVICE_NAME = /^(?:con|prn|aux|nul|clock\$|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i;

function installError(code, message, cause) {
    const error = new Error(message, cause ? { cause } : undefined);
    error.name = "ExamplesInstallError";
    error.code = code;
    return error;
}

function cancellationError() {
    const error = new Error("Установка примеров отменена.");
    error.name = "AbortError";
    error.code = "ABORTED";
    return error;
}

function checkAbort(signal) {
    if (signal?.aborted) throw cancellationError();
}

/** Returns an absolute download URL; relative URLs need an explicit base URL. */
export function validateDownloadUrl(input, baseUrl) {
    let url;
    try {
        if (typeof input !== "string" || !input.trim()) throw new Error();
        url = new URL(input.trim(), baseUrl);
    }
    catch {
        throw installError("INVALID_URL", "В настройках сайта указан некорректный адрес загрузки.");
    }
    const localhost = url.hostname === "localhost"
        || url.hostname.endsWith(".localhost")
        || url.hostname === "127.0.0.1"
        || url.hostname === "[::1]";
    if (url.protocol !== "https:" && !(url.protocol === "http:" && localhost)) {
        throw installError("INVALID_URL", "Адрес загрузки должен использовать HTTPS (HTTP разрешён только для localhost).");
    }
    if (url.username || url.password) {
        throw installError("INVALID_URL", "Адрес загрузки не должен содержать логин или пароль.");
    }
    url.hash = "";
    return url.href;
}

// Compare conservatively across Windows/macOS/Linux without renaming files.
function pathKey(path) {
    return path.normalize("NFC").toUpperCase();
}

function inspectEntry(entry) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)
        || (entry.type !== "file" && entry.type !== "directory")) {
        throw installError("INVALID_MANIFEST", "Список примеров содержит запись неподдерживаемого типа.");
    }
    const path = entry.path;
    if (typeof path !== "string" || !path || path.startsWith("/")) {
        throw installError("UNSAFE_PATH", "Список примеров содержит пустой или абсолютный путь.");
    }
    const segments = path.split("/");
    for (const segment of segments) {
        if (!segment || segment === "." || segment === ".."
            || INVALID_WINDOWS_CHARACTERS.test(segment)
            || /[. ]$/.test(segment) || WINDOWS_DEVICE_NAME.test(segment)
            || segment.includes("\ufffd")) {
            throw installError("UNSAFE_PATH", `Список примеров содержит недопустимый или неоднозначный путь «${path}».`);
        }
        try { encodeURIComponent(segment); }
        catch {
            throw installError("UNSAFE_PATH", `Путь «${path}» содержит некорректные символы Unicode.`);
        }
    }
    const directory = entry.type === "directory";
    if ((!directory && (!Number.isSafeInteger(entry.size) || entry.size < 0))
        || (directory && entry.size !== undefined && entry.size !== 0)) {
        throw installError("INVALID_MANIFEST", `В списке примеров указан некорректный размер «${path}».`);
    }
    return { path, segments, directory, size: directory ? 0 : entry.size };
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
                throw installError("PATH_COLLISION", `Список примеров содержит повторяющиеся или конфликтующие пути «${previous.path}» и «${path}».`);
            }
            nodes.set(key, { path, directory, explicit: (previous?.explicit ?? false) || last });
        }
    }
}

function validateManifest(manifest, manifestUrl) {
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)
        || manifest.version !== 1 || !Array.isArray(manifest.entries)
        || typeof manifest.baseUrl !== "string" || !manifest.baseUrl.trim()) {
        throw installError("INVALID_MANIFEST", "Сервер вернул некорректный список файлов примеров.");
    }
    const base = new URL(validateDownloadUrl(manifest.baseUrl, manifestUrl));
    if (base.origin !== new URL(manifestUrl).origin || !base.pathname.endsWith("/")
        || base.search || new URL(manifest.baseUrl, manifestUrl).hash) {
        throw installError("INVALID_MANIFEST", "Каталог примеров должен находиться на том же сервере, что и список файлов, и иметь адрес каталога без параметров.");
    }
    const items = manifest.entries.map(inspectEntry);
    validateHierarchy(items);
    for (const item of items) {
        if (item.directory) continue;
        const url = new URL(item.segments.map(encodeURIComponent).join("/"), base);
        if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
            throw installError("UNSAFE_PATH", `Адрес файла «${item.path}» выходит за пределы каталога примеров.`);
        }
        item.url = url.href;
    }
    if (!items.length) {
        throw installError("EXAMPLES_UNAVAILABLE", "Комплект примеров ещё не размещён на сервере.");
    }
    return { base, items };
}

function resultFrom(progress) {
    return { rootName: ROOT_NAME, ...progress };
}

function readableError(error, stage, path, signal) {
    if (signal?.aborted || error?.name === "AbortError") return cancellationError();
    if (error?.name === "ExamplesInstallError") return error;
    if (error?.name === "QuotaExceededError") {
        return installError("QUOTA_EXCEEDED", "Недостаточно места для примеров. Освободите место на выбранном диске.", error);
    }
    if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
        return installError("ACCESS_DENIED", "Браузер не разрешил запись файлов. Проверьте доступ к выбранному каталогу и откройте редактор через HTTPS или localhost.", error);
    }
    if (error?.name === "TypeMismatchError") {
        return installError("DESTINATION_CONFLICT", `Файл и каталог конфликтуют по пути «${path || ROOT_NAME}». Существующие данные сохранены.`, error);
    }
    if (stage === "download") {
        return installError("DOWNLOAD_FAILED", `Не удалось скачать файл «${path}». Проверьте подключение к интернету и доступность примеров на сервере.`, error);
    }
    if (stage === "destination") {
        return installError("WRITE_FAILED", `Не удалось записать «${path || ROOT_NAME}». Проверьте доступ к каталогу и свободное место на диске.`, error);
    }
    return installError("INVALID_MANIFEST", "Не удалось получить или проверить список файлов примеров. Проверьте подключение и настройки сайта.", error);
}

/**
 * Copy every manifest entry without importing or interpreting project files.
 * Files stream sequentially from the server to destination writable streams.
 * Only metadata and the current chunk are retained in memory.
 * The caller obtains destinationHandle through a user-activated picker.
 */
export async function installExamples({
    manifestUrl,
    destinationHandle,
    signal,
    onProgress,
    fetchImpl = globalThis.fetch,
}) {
    const indexUrl = validateDownloadUrl(manifestUrl);
    if (!destinationHandle || destinationHandle.kind !== "directory"
        || typeof destinationHandle.getDirectoryHandle !== "function") {
        throw installError("DESTINATION_REQUIRED", "Выберите каталог для сохранения примеров.");
    }
    const progress = {
        phase: "inspect", downloadedBytes: 0, writtenBytes: 0, totalBytes: 0,
        completedFiles: 0, totalFiles: 0, writtenFiles: 0, skippedFiles: 0,
        currentPath: "",
    };
    const emit = () => {
        // An observer must not interrupt a filesystem commit or its accounting.
        try { onProgress?.({ ...progress }); } catch { /* UI callback only. */ }
    };
    const fetchOptions = {
        method: "GET", credentials: "omit", cache: "no-store",
        referrerPolicy: "no-referrer", redirect: "error", signal,
    };
    let stage = "inspect";
    let downloadReader;
    let activeWritable;
    let incompleteFile;
    let destinationStarted = false;
    let failure;
    const cancellationWork = [];
    const onAbort = () => {
        const reason = cancellationError();
        const reader = downloadReader;
        const writable = activeWritable;
        if (reader) cancellationWork.push(Promise.resolve().then(() => reader.cancel(reason)).catch(() => {}));
        if (writable) cancellationWork.push(Promise.resolve().then(() => writable.abort(reason)).catch(() => {}));
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
    const findExistingFile = async (parent, name, children, path) => {
        let existing = children.get(pathKey(name));
        if (!existing) {
            // Recheck just before create, including changes since the listing.
            try {
                const handle = await parent.getFileHandle(name);
                existing = { kind: "file", name, handle };
            }
            catch (error) { if (error.name !== "NotFoundError") throw error; }
        }
        if (existing && existing.kind !== "file") {
            throw installError("DESTINATION_CONFLICT", `Нельзя сохранить файл «${path}»: это имя занято каталогом или неоднозначно.`);
        }
        return existing;
    };
    const skipFile = () => {
        progress.skippedFiles += 1;
        progress.completedFiles += 1;
        emit();
    };

    try {
        checkAbort(signal);
        emit();
        const response = await fetchImpl(indexUrl, fetchOptions);
        checkAbort(signal);
        if (!response.ok) {
            throw installError("HTTP_ERROR", `Сервер не отдал список файлов примеров (HTTP ${response.status}). Комплект примеров может быть ещё не размещён.`);
        }
        if (response.url && validateDownloadUrl(response.url) !== indexUrl) {
            throw installError("INVALID_MANIFEST", "Сервер изменил адрес списка файлов примеров. Проверьте настройки сайта.");
        }
        const { base, items } = validateManifest(await response.json(), indexUrl);
        checkAbort(signal);
        for (const item of items) {
            if (item.directory) continue;
            progress.totalFiles += 1;
            progress.totalBytes += item.size;
            if (!Number.isSafeInteger(progress.totalBytes)) {
                throw installError("EXAMPLES_TOO_LARGE", "Суммарный размер примеров превышает точность файловых размеров, поддерживаемую браузером.");
            }
        }
        emit();
        checkAbort(signal);
        stage = "destination";
        const root = destinationHandle.name === ROOT_NAME
            ? destinationHandle
            : await ensureDirectory(destinationHandle, ROOT_NAME, ROOT_NAME);
        progress.phase = "copy";
        emit();
        for (const item of items) {
            checkAbort(signal);
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
            if (await findExistingFile(parent, name, children, item.path)) {
                skipFile();
                continue;
            }
            checkAbort(signal);
            stage = "download";
            const fileResponse = await fetchImpl(item.url, fetchOptions);
            if (fileResponse.body && typeof fileResponse.body.getReader === "function") {
                downloadReader = fileResponse.body.getReader();
            }
            checkAbort(signal);
            if (!fileResponse.ok) {
                throw installError("HTTP_ERROR", `Сервер не отдал файл «${item.path}» (HTTP ${fileResponse.status}).`);
            }
            if (fileResponse.url) {
                const finalUrl = new URL(validateDownloadUrl(fileResponse.url));
                if (finalUrl.origin !== base.origin || !finalUrl.pathname.startsWith(base.pathname)
                    || finalUrl.href !== item.url) {
                    throw installError("UNSAFE_PATH", `Сервер изменил адрес файла «${item.path}». Проверьте каталог примеров.`);
                }
            }
            if (!downloadReader) {
                throw installError("DOWNLOAD_FAILED", `Сервер вернул недоступный ответ для файла «${item.path}».`);
            }
            stage = "destination";
            if (await findExistingFile(parent, name, children, item.path)) {
                await downloadReader.cancel();
                downloadReader.releaseLock();
                downloadReader = undefined;
                skipFile();
                continue;
            }
            checkAbort(signal);
            destinationStarted = true;
            const fileHandle = await parent.getFileHandle(name, { create: true });
            incompleteFile = { parent, name, fileHandle, bytes: 0 };
            checkAbort(signal);
            activeWritable = await fileHandle.createWritable({ keepExistingData: false, mode: "exclusive" });
            checkAbort(signal);
            while (true) {
                stage = "download";
                const { value, done } = await downloadReader.read();
                checkAbort(signal);
                if (done) break;
                progress.downloadedBytes += value.byteLength;
                if (!Number.isSafeInteger(progress.downloadedBytes)
                    || incompleteFile.bytes + value.byteLength > item.size) {
                    throw installError("SIZE_MISMATCH", `Размер файла «${item.path}» превышает размер в списке примеров. Обновите комплект на сервере.`);
                }
                stage = "destination";
                await activeWritable.write(value);
                incompleteFile.bytes += value.byteLength;
                progress.writtenBytes += value.byteLength;
                emit();
                checkAbort(signal);
            }
            downloadReader.releaseLock();
            downloadReader = undefined;
            if (incompleteFile.bytes !== item.size) {
                throw installError("SIZE_MISMATCH", `Размер файла «${item.path}» не совпадает с размером в списке примеров. Загрузка прервалась либо комплект на сервере изменился.`);
            }
            checkAbort(signal);
            stage = "destination";
            await activeWritable.close();
            activeWritable = undefined;
            incompleteFile = undefined;
            children.set(pathKey(name), { kind: "file", name, handle: fileHandle });
            progress.writtenFiles += 1;
            progress.completedFiles += 1;
            emit();
        }
        checkAbort(signal);
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
    }
    if (failure) {
        if (destinationStarted || progress.completedFiles > 0) failure.partialResult = resultFrom(progress);
        emit();
        throw failure;
    }
    progress.phase = "complete";
    progress.currentPath = "";
    emit();
    return resultFrom(progress);
}
