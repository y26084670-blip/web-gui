import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appUrl = new URL("../src/App.jsx", import.meta.url);
const editorUrl = new URL(
    "../src/components/editors/DataEditor.jsx",
    import.meta.url,
);
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

test("diagnostic rows expose explicit accessible navigation links", async () => {
    const [source, styles, indicator] = await Promise.all([
        readFile(popupUrl, "utf8"),
        readFile(popupStylesUrl, "utf8"),
        readFile(indicatorUrl, "utf8"),
    ]);

    assert.match(source, /const ADDRESSABLE_RECORD_TABS = new Set/u);
    assert.match(source, /TABS\.ELEMENTS\.id/u);
    assert.match(source, /TABS\.REGIONS\.id/u);
    assert.match(source, /`Элемент №\$\{diagnostic\.row\}`/u);
    assert.match(source, /`Область №\$\{diagnostic\.row\}`/u);
    assert.match(source, /`Строка №\$\{diagnostic\.row\}`/u);
    assert.match(source, /type="button"/u);
    assert.match(source, /class="diagnostic-navigation-link"/u);
    assert.match(source, /aria-label=\{`Перейти: \$\{label\(\)\}`\}/u);
    assert.match(source, /onClick=\{\(\) => props\.onSelect\?\.\(diagnostic\)\}/u);
    assert.doesNotMatch(source, /diagnostic-item-selectable/u);
    assert.match(
        styles,
        /\.diagnostic-navigation-link\s*\{[^}]*background:\s*transparent;[^}]*text-decoration:\s*underline;/su,
    );
    assert.match(
        indicator,
        /function handleDiagnosticSelect\(diagnostic\) \{\s*setPopupOpen\(false\);\s*props\.onDiagnosticSelect\?\.\(diagnostic\);/u,
    );
});

test("diagnostic popup scrolls the list while keeping its title visible", async () => {
    const [source, styles] = await Promise.all([
        readFile(popupUrl, "utf8"),
        readFile(popupStylesUrl, "utf8"),
    ]);

    assert.match(
        source,
        /<div class="diagnostic-title">[^<]+<\/div>\s*<div class="diagnostic-list">\s*<For/u,
    );
    assert.match(
        styles,
        /\.diagnostic-popup\s*\{[^}]*max-height:\s*calc\(100vh - 48px\);/su,
    );
    assert.match(
        styles,
        /\.diagnostic-list\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/su,
    );
});

test("App emits a sequenced target and passes it to DataEditor", async () => {
    const source = await readFile(appUrl, "utf8");

    assert.match(source, /let diagnosticTargetSequence = 0;/u);
    assert.match(source, /sequence: \+\+diagnosticTargetSequence/u);
    assert.match(source, /setDiagnosticTarget\(\{/u);
    assert.match(source, /setActiveTab\(tabId\)/u);
    assert.match(source, /diagnosticTarget=\{props\.diagnosticTarget\}/u);
    assert.match(source, /diagnosticTarget=\{diagnosticTarget\(\)\}/u);
    assert.doesNotMatch(source, /selectedDiagnostic=/u);
});

test("DataEditor selects the current labelled row and opens geo details", async () => {
    const source = await readFile(editorUrl, "utf8");

    assert.match(
        source,
        /String\(item\.getData\(\)\?\.rowLabel\) === String\(target\.row\)/u,
    );
    assert.match(source, /table\.deselectRow\?\.\(\)/u);
    assert.match(source, /row\.select\?\.\(\)/u);
    assert.match(source, /scrollToRow\?\.\(row, "center", true\)/u);
    assert.match(
        source,
        /scrollToColumn\?\.\(cell\.getColumn\(\), "center", true\)/u,
    );
    assert.match(source, /if \(propertyName === "geo" && cell\)/u);
    assert.match(source, /const property = resolveProperty\(cell, tableSchema\)/u);
    assert.match(source, /viewRegistry\.get\(property\.view \?\? VIEW_TYPES\.TABLE\)/u);
    assert.match(source, /adapter\?\.activate\?\.\(cell, \{ property \}\)/u);
    assert.match(source, /target\.sequence <= lastDiagnosticTargetSequence/u);
    assert.match(source, /pendingDiagnosticTarget = target/u);
    assert.match(source, /scheduleDiagnosticNavigation\(\)/u);
});
