export function createMaterialLibraryLoadQueue() {
    let tail = Promise.resolve();

    return Object.freeze({
        run(mutation) {
            if (typeof mutation !== "function") {
                throw new TypeError("Операция таблицы должна быть функцией.");
            }

            const result = tail.then(() => mutation());
            tail = result.catch(() => undefined);
            return result;
        },
    });
}
