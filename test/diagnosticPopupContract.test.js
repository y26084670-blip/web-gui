import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appUrl = new URL("../src/App.jsx", import.meta.url);
const editorUrl = new URL(
    "../src/components/editors/DataEditor.jsx",
    import.meta.url,
);
const taskInfoUrl = new URL("../src/TaskInfoBar.jsx", import.meta.url);
const popupUrl = new URL(
    "../src/components/diagnostics/DiagnosticPopup.jsx",
    import.meta.url,
);
const popupStylesUrl = new URL(
    "../src/components/diagnostics/DiagnosticPopup.css",
    import.meta.url,
);
const indicatorUrl = new URL(
    "../src/components/diagnostics/ValidationIndicator.jsx",
    import.meta.url,
);

test("diagnostic rows expose static source labels without navigation", async () => {
    const [source, styles, indicator, taskInfo] = await Promise.all([
        readFile(popupUrl, "utf8"),
        readFile(popupStylesUrl, "utf8"),
        readFile(indicatorUrl, "utf8"),
        readFile(taskInfoUrl, "utf8"),
    ]);

    assert.match(source, /function diagnosticSourceLabel\(diagnostic\)/u);
    assert.match(source, /TABS\.ELEMENTS\.id/u);
    assert.match(source, /TABS\.REGIONS\.id/u);
    assert.match(source, /`Элемент №\$\{diagnostic\.row\}`/u);
    assert.match(source, /`Область №\$\{diagnostic\.row\}`/u);
    assert.match(source, /`Строка №\$\{diagnostic\.row\}`/u);
    assert.match(
        source,
        /<Show when=\{diagnosticSourceLabel\(diagnostic\)\}>\s*/u,
    );
    assert.match(source, /\{\(label\) => <span>\{label\(\)\}<\/span>\}/u);
    assert.doesNotMatch(source, /ADDRESSABLE_RECORD_TABS/u);
    assert.doesNotMatch(source, /diagnostic-navigation-link/u);
    assert.doesNotMatch(source, /props\.onSelect/u);
    assert.doesNotMatch(styles, /diagnostic-navigation-link/u);
    assert.match(indicator, /export function ValidationIndicator\(\)/u);
    assert.match(indicator, /<DiagnosticPopup open=\{popupOpen\} \/>/u);
    assert.doesNotMatch(indicator, /onDiagnosticSelect|handleDiagnosticSelect/u);
    assert.match(taskInfo, /<ValidationIndicator \/>/u);
    assert.doesNotMatch(taskInfo, /onDiagnosticSelect/u);
});

test("diagnostic popup scrolls the list while keeping its title visible", async () => {
    const [source, styles] = await Promise.all([
        readFile(popupUrl, "utf8"),
        readFile(popupStylesUrl, "utf8"),
    ]);

    assert.match(
        source,
        /<div class="diagnostic-title">[^<]+<\/div>\s*/u,
    );
    assert.match(source, /<div class="diagnostic-list">\s*<For/u);
    assert.match(
        styles,
        /\.diagnostic-popup\s*\{[^}]*max-height:\s*calc\(100vh - 48px\);/su,
    );
    assert.match(
        styles,
        /\.diagnostic-list\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/su,
    );
});

test("diagnostic fields use visible schema labels", async () => {
    const source = await readFile(popupUrl, "utf8");

    assert.match(
        source,
        /import \{ tabRegistry \} from "\.\.\/\.\.\/services\/tabRegistry";/u,
    );
    assert.match(
        source,
        /import \{ materialTabRegistry \} from "\.\.\/\.\.\/services\/materialTabRegistry";/u,
    );
    assert.match(source, /tabRegistry\.map\(\(schema\) => \[schema\.id, schema\]\)/u);
    assert.match(source, /materialTabRegistry\.map\(\(definition\) => \[/u);
    assert.match(source, /definition\.id,\s*definition\.schema,/u);
    assert.match(source, /function diagnosticPropertyLabel\(diagnostic\)/u);
    assert.match(source, /nonEmptyLabel\(property\.label\)/u);
    assert.match(source, /nonEmptyLabel\(property\.title\)/u);
    assert.match(
        source,
        /schema\.properties\?\.\[propertyId\]\?\.label/u,
    );
    assert.match(
        source,
        /schema\.views\?\.references\?\.\[propertyId\]\?\.label/u,
    );
    assert.match(source, /if \(!schema \|\| !nonEmptyLabel\(propertyId\)\) return null;/u);
    assert.match(
        source,
        /<Show when=\{diagnosticPropertyLabel\(diagnostic\)\}>\s*\{\(label\) => <span>Поле: \{label\(\)\}<\/span>\}\s*<\/Show>/u,
    );
    assert.doesNotMatch(source, /typeof diagnostic\.property/u);
    assert.doesNotMatch(source, /:\s*diagnostic\.property\s*\}/u);
});

test("App and DataEditor contain no diagnostic navigation state", async () => {
    const [app, editor] = await Promise.all([
        readFile(appUrl, "utf8"),
        readFile(editorUrl, "utf8"),
    ]);

    assert.doesNotMatch(
        app,
        /diagnosticTarget|diagnosticTargetSequence|handleDiagnosticSelect/u,
    );
    assert.doesNotMatch(app, /onDiagnosticSelect/u);
    assert.doesNotMatch(
        editor,
        /diagnosticTarget|DiagnosticNavigation|navigateToDiagnosticTarget/u,
    );
    assert.doesNotMatch(editor, /scrollToRow|scrollToColumn/u);
});
