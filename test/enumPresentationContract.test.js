import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { EN_MODEL } from "../src/services/schemas/common/enums.js";

const enumEditorPath = new URL(
    "../src/tabulator/editors/types/enumEditor.js",
    import.meta.url,
);
const appCssPath = new URL("../src/App.css", import.meta.url);
const generalSchemaPath = new URL(
    "../src/services/schemas/general.schema.js",
    import.meta.url,
);
const enumFormatterPath = new URL(
    "../src/tabulator/formatters/types/enumFormatter.js",
    import.meta.url,
);
const tableBuilderPath = new URL(
    "../src/tabulator/builders/TableBuilder.js",
    import.meta.url,
);
const mirrorImagePaths = Object.freeze([
    Object.freeze({
        url: new URL("../resource/-1.png", import.meta.url),
        sha256: "44cd41d0688441469dfd87ee1ca1f3aaaa4c5830fec4220e8b49a29e2b703cba",
    }),
    Object.freeze({
        url: new URL("../resource/0.png", import.meta.url),
        sha256: "49600375e02f2c6cacbdad5e22adc6efe1fa0362208de600b1decf8e1e4af723",
    }),
    Object.freeze({
        url: new URL("../resource/+1.png", import.meta.url),
        sha256: "8e211b2adbcbf53e2facccb41b76b97afa8e0e3dc3ac09f9d49f50cae21ccd3b",
    }),
]);

test("material model labels expose the supported choices", () => {
    assert.equal(EN_MODEL[0].label, "ФММ M(H)");
    assert.equal(EN_MODEL[1].disabled, true);
    assert.equal(EN_MODEL[2].disabled, undefined);
});

test("enum editor disables marked options", async () => {
    const source = await readFile(enumEditorPath, "utf8");

    assert.match(source, /option\.disabled = entry\.disabled === true;/u);
});

test("mirror symmetry uses image values with one white tooltip", async () => {
    const [schema, editor, formatter, builder, styles] = await Promise.all([
        readFile(generalSchemaPath, "utf8"),
        readFile(enumEditorPath, "utf8"),
        readFile(enumFormatterPath, "utf8"),
        readFile(tableBuilderPath, "utf8"),
        readFile(appCssPath, "utf8"),
    ]);

    assert.match(schema, /value:\s*-1,[\s\S]*?resource\/-1\.png/u);
    assert.match(schema, /value:\s*0,[\s\S]*?resource\/0\.png/u);
    assert.match(schema, /value:\s*1,[\s\S]*?resource\/\+1\.png/u);
    assert.match(schema, /Нулевая нормальная компонента напряженности/u);
    assert.match(schema, /Нулевая касательная компонента напряженности/u);
    assert.match(
        schema,
        /mirrorSymmetryX:[\s\S]*?description:\s*"",[\s\S]*?enum:\s*mirrorSymmetryOptions/u,
    );
    assert.match(
        schema,
        /mirrorSymmetryY:[\s\S]*?description:\s*"",[\s\S]*?enum:\s*mirrorSymmetryOptions/u,
    );
    assert.match(editor, /function imageEnumEditor/u);
    assert.match(formatter, /function imageEnumValue/u);
    assert.doesNotMatch(formatter, /value\.title/u);
    assert.match(builder, /function imageEnumTooltip/u);
    assert.match(builder, /element\.classList\.add\("image-enum-tooltip"\)/u);
    assert.match(builder, /classList\.contains\("tabulator-editing"\)/u);
    assert.match(styles, /\.image-enum-option\.selected/u);
    assert.match(
        styles,
        /\.tabulator-tooltip\.image-enum-tooltip\s*\{[^}]*background:\s*#fff;[^}]*color:\s*#111;/su,
    );
});

test("mirror symmetry uses the updated image assets", async () => {
    for (const image of mirrorImagePaths) {
        const bytes = await readFile(image.url);
        const digest = createHash("sha256").update(bytes).digest("hex");
        assert.equal(digest, image.sha256);
    }
});

test("Tabulator tooltips use the enlarged bold font", async () => {
    const source = await readFile(appCssPath, "utf8");

    assert.match(
        source,
        /\.tabulator-tooltip\s*\{[^}]*font-size:\s*14px;[^}]*font-weight:\s*bold;/su,
    );
});
