import assert from "node:assert/strict";
import test from "node:test";

import {
    decodeFmmTable,
    htcParameterEntries,
    toFmmLibraryModel,
    toHtcLibraryModel,
} from "../src/services/materials/materialLibraryModel.js";

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
    const model = toHtcLibraryModel([{
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

    assert.deepEqual(model, [{
        _libraryRecord: {
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
        },
        name: "ВТСП",
        j_HC0: 2300,
        M3D: true,
        comment: "Описание",
    }]);
});

test("HTC detail projection shows current and unnormalized legacy fields", () => {
    const entries = htcParameterEntries({
        name: "ВТСП",
        j_HC0: 2300,
        m_type: 3,
        m2_dh: 0.5,
        m2_n: 4,
        comment: "Описание",
    });

    assert.deepEqual(entries, [
        ["j_HC0", "2300"],
        ["m_type", "3"],
        ["m2_dh", "0.5"],
        ["m2_n", "4"],
    ]);
});
