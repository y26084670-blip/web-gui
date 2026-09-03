import assert from "node:assert/strict";
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

test("material model labels expose the supported choices", () => {
    assert.equal(EN_MODEL[0].label, "ФММ M(H)");
    assert.equal(EN_MODEL[1].disabled, true);
    assert.equal(EN_MODEL[2].disabled, undefined);
});

test("enum editor disables marked options", async () => {
    const source = await readFile(enumEditorPath, "utf8");

    assert.match(source, /option\.disabled = entry\.disabled === true;/u);
});

test("mirror symmetry uses the three image enum values", async () => {
    const [schema, editor, formatter, styles] = await Promise.all([
        readFile(generalSchemaPath, "utf8"),
        readFile(enumEditorPath, "utf8"),
        readFile(enumFormatterPath, "utf8"),
        readFile(appCssPath, "utf8"),
    ]);

    assert.match(schema, /value:\s*-1,[\s\S]*?resource\/-1\.png/u);
    assert.match(schema, /value:\s*0,[\s\S]*?resource\/0\.png/u);
    assert.match(schema, /value:\s*1,[\s\S]*?resource\/\+1\.png/u);
    assert.match(schema, /Нулевая нормальная компонента напряженности/u);
    assert.match(schema, /Нулевая касательная компонента напряженности/u);
    assert.match(
        schema,
        /mirrorSymmetryX:[\s\S]*?type:\s*FIELD_TYPES\.ENUM,[\s\S]*?enum:\s*mirrorSymmetryOptions/u,
    );
    assert.match(editor, /function imageEnumEditor/u);
    assert.match(formatter, /function imageEnumValue/u);
    assert.match(styles, /\.image-enum-option\.selected/u);
});

test("Tabulator tooltips use the enlarged bold font", async () => {
    const source = await readFile(appCssPath, "utf8");

    assert.match(
        source,
        /\.tabulator-tooltip\s*\{[^}]*font-size:\s*14px;[^}]*font-weight:\s*bold;/su,
    );
});
