const WINDOWS_RESERVED_FILE_STEMS = new Set([
    "CON",
    "PRN",
    "AUX",
    "NUL",
    ...Array.from({ length: 9 }, (_, index) => `COM${index + 1}`),
    ...Array.from({ length: 9 }, (_, index) => `LPT${index + 1}`),
]);

const INVALID_MATERIAL_NAME_CHARACTER = /[\u0000-\u001f<>:"/\\|?*]/u;

/**
 * Проверяет имя характеристики по тому же контракту, который использует
 * Julia-импортёр библиотек 2XX.
 *
 * @param {unknown} rawName
 * @returns {string} нормализованное имя без начальных и конечных пробелов
 */
export function validateLegacyMaterialName(rawName) {
    if (typeof rawName !== "string") {
        throw new TypeError("Имя характеристики должно быть строкой.");
    }

    const name = rawName.trim();

    if (!name) {
        throw new Error("Пустое имя характеристики.");
    }
    if (INVALID_MATERIAL_NAME_CHARACTER.test(name)) {
        throw new Error(`Недопустимое имя характеристики: ${name}`);
    }
    if (name === "." || name === ".." || name.endsWith(".")) {
        throw new Error(`Недопустимое имя характеристики: ${name}`);
    }

    const fileStem = name.split(".", 1)[0].toUpperCase();
    if (WINDOWS_RESERVED_FILE_STEMS.has(fileStem)) {
        throw new Error(
            `Имя характеристики зарезервировано Windows: ${name}`,
        );
    }

    return name;
}

/**
 * Проверяет весь пакет до начала записи и запрещает коллизии имён в
 * регистронезависимой файловой системе Windows.
 *
 * @param {Iterable<unknown>} rawNames
 * @returns {string[]}
 */
export function validateUniqueLegacyMaterialNames(rawNames) {
    const names = [];
    const seen = new Map();

    for (const rawName of rawNames) {
        const name = validateLegacyMaterialName(rawName);
        const key = name.toLowerCase();
        const previous = seen.get(key);

        if (previous !== undefined) {
            throw new Error(
                "Имена характеристик конфликтуют в Windows: "
                + `${JSON.stringify(previous)} и ${JSON.stringify(name)}`,
            );
        }

        seen.set(key, name);
        names.push(name);
    }

    return names;
}

export function legacyMaterialFileName(rawName) {
    return `${validateLegacyMaterialName(rawName)}.txt`;
}
