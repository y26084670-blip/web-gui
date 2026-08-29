import assert from "node:assert/strict";
import test from "node:test";

import {
    decodeFmmTable,
    toFmmLibraryModel,
    toHtcLibraryModel,
} from "../src/services/materials/materialLibraryModel.js";
import { HTC_PARAMETER_NAMES } from "../src/services/materials/materialConstants.js";
import { createHtcMaterialFile } from "../src/services/materialImport/htcConfigImporter.js";

test("FMM default-library records become 12x2 RECORDS details", () => {
    const h = Array.from({ length: 12 }, (_, index) => index + 1);
    const m = Array.from({ length: 12 }, (_, index) => 101 + index);

    const model = toFmmLibraryModel([{
        kind: "FMM",
        name: "STAL",
        relativePath: "xapLibFMM/STAL.txt",
        sha256: "a".repeat(64),
        data: {
            tabl: [...h, ...m],
            hip: 7.5,
            comment: "Тест",
        },
    }]);

    assert.deepEqual(model, [{
        _libraryRecord: {
            kind: "FMM",
            name: "STAL",
            relativePath: "xapLibFMM/STAL.txt",
            sha256: "a".repeat(64),
            data: {
                tabl: [...h, ...m],
                hip: 7.5,
                comment: "Тест",
            },
        },
        name: "STAL",
        tabl: h.map((value, index) => [value, m[index]]),
        hip: 7.5,
        comment: "Тест",
    }]);
});

test("FMM importer BaseModel with a matrix stays a matrix", () => {
    const rows = Array.from(
        { length: 12 },
        (_, index) => [index, index * 2],
    );

    assert.deepEqual(
        decodeFmmTable(rows),
        rows,
    );
    assert.notEqual(decodeFmmTable(rows), rows);
});

test("browser-import material is adapted without a default-library source", () => {
    const values = Array.from({ length: 24 }, (_, index) => index);
    const [record] = toFmmLibraryModel([{
        kind: "FMM",
        name: "Импорт",
        fileName: "Импорт.txt",
        data: {
            tabl: values,
            hip: 0,
            comment: "",
        },
    }]);

    assert.equal(record.name, "Импорт");
    assert.equal(record._libraryRecord, undefined);
});

test("task-local material keeps separate transient file metadata", () => {
    const [record] = toFmmLibraryModel([{
        source: "task",
        kind: "FMM",
        name: "Локальная",
        fileName: "Локальная.txt",
        relativePath: "input3XX/xapLibFMM/Локальная.txt",
        sha256: "c".repeat(64),
        data: {
            tabl: Array.from({ length: 24 }, (_, index) => index),
            hip: 1,
            comment: "",
        },
    }]);

    assert.equal(record._libraryRecord, undefined);
    assert.equal(record._taskLibraryRecord.source, "task");
    assert.equal(
        record._taskLibraryRecord.relativePath,
        "input3XX/xapLibFMM/Локальная.txt",
    );
    assert.equal(record.name, "Локальная");
});

test("malformed FMM table is rejected before rendering", () => {
    assert.throws(
        () => decodeFmmTable(Array(23).fill(0)),
        /24 значения/,
    );
    assert.throws(
        () => decodeFmmTable([[1, 2, 3]]),
        /12 строк и две колонки/,
    );
    assert.throws(
        () => decodeFmmTable([[1, 2]]),
        /12 строк и две колонки/,
    );
    assert.throws(
        () => decodeFmmTable([
            ...Array(23).fill(0),
            Number.NaN,
        ]),
        /конечные числовые/,
    );
});

test("HTC model keeps scalar JSON fields and transient filename name", () => {
    const [material] = toHtcLibraryModel([{
        kind: "HTC",
        name: "ВТСП",
        fileName: "ВТСП.txt",
        relativePath: "xapLibHTC/ВТСП.txt",
        sha256: "b".repeat(64),
        data: {
            j_HC0: 2300,
            M3D: true,
            comment: "Описание",
        },
    }]);

    assert.deepEqual(material._libraryRecord, {
        kind: "HTC",
        name: "ВТСП",
        fileName: "ВТСП.txt",
        relativePath: "xapLibHTC/ВТСП.txt",
        sha256: "b".repeat(64),
        data: {
            j_HC0: 2300,
            M3D: true,
            comment: "Описание",
        },
    });
    assert.equal(material.name, "ВТСП");
    assert.equal(material.j_HC0, 2300);
    assert.equal(material.KHabc, 1);
    assert.equal(material.Diag, 0);
    assert.equal(material.M3D, true);
    assert.equal(material.comment, "Описание");
    assert.deepEqual(
        Object.keys(material).filter(key => !key.startsWith("_")),
        ["name", ...HTC_PARAMETER_NAMES, "comment"],
    );
});

test("HTC model drops legacy fields and supplies solver defaults", () => {
    const [material] = toHtcLibraryModel([{
        kind: "HTC",
        name: "Legacy",
        data: {
            j_HC0: 2300,
            m2_dh: 0.5,
            m2_n: 4,
            comment: "Описание",
        },
    }]);

    assert.equal(Object.hasOwn(material, "m2_dh"), false);
    assert.equal(Object.hasOwn(material, "m2_n"), false);
    assert.equal(material.KHabc, 1);
    assert.equal(material.Diag, 0);
    assert.equal(material.M3D, false);
});

test("normalized legacy HTC material serializes as the current local format", () => {
    const legacyProperty = Object.fromEntries(
        HTC_PARAMETER_NAMES
            .filter(name => !["KHabc", "Diag", "M3D"].includes(name))
            .map((name, index) => [name, index + 1]),
    );
    const [material] = toHtcLibraryModel([{
        kind: "HTC",
        name: "Legacy",
        data: {
            ...legacyProperty,
            m2_dh: 0.5,
            m2_dm: 0.25,
            m2_n: 4,
            comment: "Описание",
        },
    }]);

    const file = createHtcMaterialFile(material);
    assert.deepEqual(
        Object.keys(file.data),
        [...HTC_PARAMETER_NAMES, "comment"],
    );
    assert.equal(file.data.KHabc, 1);
    assert.equal(file.data.Diag, 0);
    assert.equal(file.data.M3D, false);
    assert.equal(file.text.includes("m2_dh"), false);
});
