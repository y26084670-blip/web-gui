import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { EN_MODEL } from "../src/services/schemas/common/enums.js";

const enumEditorPath = new URL(
    "../src/tabulator/editors/types/enumEditor.js",
    import.meta.url,
);
const appCssPath = new URL("../src/App.css", import.meta.url);

test("material model labels expose the supported choices", () => {
    assert.equal(EN_MODEL[0].label, "ФММ M(H)");
    assert.equal(EN_MODEL[1].disabled, true);
    assert.equal(EN_MODEL[2].disabled, undefined);
});

test("enum editor disables marked options", async () => {
    const source = await readFile(enumEditorPath, "utf8");

    assert.match(source, /option\.disabled = entry\.disabled === true;/u);
});

test("Tabulator tooltips use the enlarged bold font", async () => {
    const source = await readFile(appCssPath, "utf8");

    assert.match(
        source,
        /\.tabulator-tooltip\s*\{[^}]*font-size:\s*14px;[^}]*font-weight:\s*bold;/su,
    );
});
