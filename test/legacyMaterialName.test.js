import test from "node:test";
import assert from "node:assert/strict";

import {
    decodeLegacyCharacterCodes,
    LEGACY_CHARACTER_TABLE,
} from "../src/services/materialImport/legacyCharacterTable.js";
import {
    legacyMaterialFileName,
    validateLegacyMaterialName,
    validateUniqueLegacyMaterialNames,
} from "../src/services/materialImport/legacyMaterialName.js";

const expectedCharacterTable = [
    ...(
        "                                 !   %& ()*+,-. "
        + "0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[ ]^_ "
        + "abcdefghijklmnopqrstuvwxyz{|}~ "
        + "ЂЃ‚ѓ„…†‡€‰Љ‹ЊЌЋЏђ"
        + "    •–—\u0098™љ›њќћџ"
        + " ЎўЈ¤Ґ¦§Ё©Є«¬­®Ї°±Ііґµ¶·ё№є»јЅѕї"
        + "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ"
        + "абвгдежзийклмнопрстуфхцчшщъыьэюя"
    ),
];

test("legacy character table exactly matches all 256 Julia positions", () => {
    assert.equal(expectedCharacterTable.length, 256);
    assert.deepEqual(LEGACY_CHARACTER_TABLE, expectedCharacterTable);
});

test("legacy character decoder trims padding and rejects inexact codes", () => {
    assert.equal(
        decodeLegacyCharacterCodes([0, 32, 209, 210, 192, 203, 220, 0]),
        "СТАЛЬ",
    );
    assert.throws(
        () => decodeLegacyCharacterCodes([65, 66.5]),
        /целым числом от 0 до 255/,
    );
    assert.throws(
        () => decodeLegacyCharacterCodes([256]),
        /целым числом от 0 до 255/,
    );
});
test("material names follow Windows-safe Julia importer rules", () => {
    assert.equal(validateLegacyMaterialName("  Сталь 3  "), "Сталь 3");
    assert.equal(legacyMaterialFileName("Сталь 3"), "Сталь 3.txt");

    for (const name of [
        "",
        "   ",
        ".",
        "..",
        "name.",
        "bad/name",
        "bad\\name",
        "bad:name",
        "bad\u0001name",
        "CON",
        "prn.xap",
        "Com9",
        "lpt1.anything",
    ]) {
        assert.throws(() => validateLegacyMaterialName(name));
    }
});

test("material package rejects case-insensitive duplicates before writing", () => {
    assert.deepEqual(
        validateUniqueLegacyMaterialNames([" A ", "Б"]),
        ["A", "Б"],
    );
    assert.throws(
        () => validateUniqueLegacyMaterialNames(["Steel", "steel"]),
        /конфликтуют в Windows/,
    );
});
