import test from "node:test";
import assert from "node:assert/strict";

import {
    createHtcMaterialFile,
    HTC_PROPERTY_KEYS,
    htcMaterialStorageRecord,
    parseHtcConfig,
    parseHtcMaterial,
    serializeHtcMaterial,
} from "../src/services/materialImport/htcConfigImporter.js";
import {
    buildHtcConfig,
    utf8Bytes,
    windows1251Bytes,
} from "./fixtures/materialImportFixtures.js";

for (const version of [201, 202, 203, 204]) {
    test(`HTC config version ${version} produces canonical current property`, () => {
        const parsed = parseHtcConfig(buildHtcConfig(version));

        assert.equal(parsed.version, version);
        assert.equal(parsed.property.j_HC0, 2300);
        assert.equal(parsed.property.JC0, 150);
        assert.equal(parsed.property.j_gmin, Math.fround(0.01));
        assert.equal(parsed.property.j1_delta, Math.fround(0.03));
        assert.equal(parsed.property.j2_n, 21);
        assert.equal(parsed.property.m_type, 3);
        assert.equal(parsed.property.m3_Mmax, 460);
        assert.equal(parsed.property.m3_a, version >= 202 ? 1 : 2);
        assert.equal(parsed.property.m3_b, version >= 202 ? 10 : 1);
        assert.equal(parsed.property.KHabc, 1);
        assert.equal(parsed.property.Diag, 0);
        assert.equal(parsed.property.M3D, false);
        assert.equal(Object.hasOwn(parsed.property, "m2_dh"), false);
        assert.equal(Object.hasOwn(parsed.property, "KFC"), false);
        assert.equal(Object.hasOwn(parsed.property, "KMS"), false);
    });
}

test("HTC parser ignores non-ASCII config descriptions", () => {
    const bytes = utf8Bytes(buildHtcConfig(203));
    const headerStart = bytes.indexOf(0x0a) + 1;
    bytes[headerStart] = 0xff;

    assert.equal(parseHtcConfig(bytes).version, 203);
});

test("HTC material uses first comment line and supports CP1251 fallback", () => {
    const utf8 = parseHtcMaterial({
        name: "ВТСП 1",
        config: buildHtcConfig(203),
        comment: utf8Bytes("Первая строка\r\nВторая строка"),
    });
    assert.equal(utf8.record.comment, "Первая строка");

    const cp1251 = parseHtcMaterial({
        name: "ВТСП 2",
        config: buildHtcConfig(203),
        comment: windows1251Bytes("Комментарий"),
    });
    assert.equal(cp1251.record.comment, "Комментарий");
});

test("HTC material requires a nonempty comment file", () => {
    assert.throws(
        () => parseHtcMaterial({
            name: "ВТСП",
            config: buildHtcConfig(203),
            comment: new Uint8Array(),
        }),
        /comment\.txt пуст/,
    );
});

test("HTC serializer writes current keys only and excludes transient metadata", () => {
    const { version, record } = parseHtcMaterial({
        name: "ВТСП",
        config: buildHtcConfig(204),
        comment: "Описание",
    });
    const storage = htcMaterialStorageRecord(record);
    const file = createHtcMaterialFile(record, { version });

    assert.deepEqual(Object.keys(storage), HTC_PROPERTY_KEYS);
    assert.equal(Object.hasOwn(storage, "name"), false);
    assert.equal(Object.hasOwn(storage, "legacyVersion"), false);
    assert.equal(file.kind, "HTC");
    assert.equal(file.fileName, "ВТСП.txt");
    assert.equal(file.legacyVersion, 204);
    assert.deepEqual(file.data, storage);
    assert.equal(file.text, serializeHtcMaterial(record));
    assert.equal(file.text.endsWith("\n"), true);
});

test("HTC parser rejects unsupported, malformed and truncated configs", () => {
    assert.throws(
        () => parseHtcConfig(buildHtcConfig(205)),
        /Неподдерживаемая версия/,
    );

    const noTab = buildHtcConfig(203).replace("2300\tfixture", "2300 fixture");
    assert.throws(() => parseHtcConfig(noTab), /разделитель табуляции/);

    const truncated = buildHtcConfig(204).split(/\r?\n/).slice(0, 20).join("\n");
    assert.throws(() => parseHtcConfig(truncated), /оборван/);
});

test("HTC material parser does not require unrelated version 204 circuit data", () => {
    const materialSectionOnly = buildHtcConfig(204)
        .split(/\r?\n/)
        .slice(0, 26)
        .join("\n");

    const parsed = parseHtcConfig(materialSectionOnly);
    assert.equal(parsed.version, 204);
    assert.equal(parsed.property.JC0, 150);
    assert.equal(parsed.property.m3_b, 10);
});

test("HTC parser rejects nonintegral model selectors", () => {
    assert.throws(
        () => parseHtcConfig(buildHtcConfig(203, { m_type: 1.5 })),
        /Mtype.*ожидалось целое/,
    );
    assert.throws(
        () => parseHtcConfig(buildHtcConfig(203, { j2_n: 20.5 })),
        /JMOD2N.*ожидалось целое/,
    );
});

test("Float32-backed HTC integer fields are not narrowed to Int32", () => {
    const parsed = parseHtcConfig(buildHtcConfig(203, {
        m_type: 3000000000,
        j2_n: 3000000000,
    }));

    assert.equal(parsed.property.m_type, Math.fround(3000000000));
    assert.equal(parsed.property.j2_n, Math.fround(3000000000));
});
