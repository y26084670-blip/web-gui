// Точная таблица solver/src/import/01_dictFromData2XX.jl::PRN_ASCII.
// Это не обычная CP1251: ряд управляющих и пунктуационных кодов намеренно
// заменён пробелами согласно формату LabVIEW/Fortran.
const CP1251_HIGH_CODE_POINTS = Object.freeze([
    0x0402, 0x0403, 0x201a, 0x0453, 0x201e, 0x2026, 0x2020, 0x2021,
    0x20ac, 0x2030, 0x0409, 0x2039, 0x040a, 0x040c, 0x040b, 0x040f,
    0x0452, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
    0x0098, 0x2122, 0x0459, 0x203a, 0x045a, 0x045c, 0x045b, 0x045f,
    0x00a0, 0x040e, 0x045e, 0x0408, 0x00a4, 0x0490, 0x00a6, 0x00a7,
    0x0401, 0x00a9, 0x0404, 0x00ab, 0x00ac, 0x00ad, 0x00ae, 0x0407,
    0x00b0, 0x00b1, 0x0406, 0x0456, 0x0491, 0x00b5, 0x00b6, 0x00b7,
    0x0451, 0x2116, 0x0454, 0x00bb, 0x0458, 0x0405, 0x0455, 0x0457,
    ...Array.from({ length: 32 }, (_, index) => 0x0410 + index),
    ...Array.from({ length: 32 }, (_, index) => 0x0430 + index),
]);

const REPLACED_WITH_SPACE = new Set([
    ...Array.from({ length: 32 }, (_, index) => index),
    34,
    35,
    36,
    39,
    47,
    92,
    96,
    127,
    145,
    146,
    147,
    148,
]);

const characterTable = Array.from({ length: 256 }, (_, code) => {
    if (REPLACED_WITH_SPACE.has(code)) return " ";
    if (code < 128) return String.fromCodePoint(code);
    return String.fromCodePoint(CP1251_HIGH_CODE_POINTS[code - 128]);
});

if (characterTable.length !== 256) {
    throw new Error("Таблица legacy-символов должна содержать 256 позиций.");
}

export const LEGACY_CHARACTER_TABLE = Object.freeze(characterTable);

/**
 * Декодирует числовые коды, хранящиеся в Float32-позициях XAP.lib.
 * Некорректные значения не округляются и не маскируются.
 *
 * @param {Iterable<number>} values
 * @param {{ field?: string }} options
 * @returns {string}
 */
export function decodeLegacyCharacterCodes(
    values,
    { field = "legacy-строка" } = {},
) {
    const characters = [];
    let index = 0;

    for (const value of values) {
        if (
            !Number.isFinite(value)
            || !Number.isInteger(value)
            || value < 0
            || value > 255
        ) {
            throw new Error(
                `${field}: код символа ${index + 1} должен быть целым `
                + `числом от 0 до 255; получено ${String(value)}.`,
            );
        }

        characters.push(LEGACY_CHARACTER_TABLE[value]);
        index += 1;
    }

    return characters.join("").trim();
}
