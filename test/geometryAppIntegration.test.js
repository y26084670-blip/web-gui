import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appUrl = new URL("../src/App.jsx", import.meta.url);
const taskInfoBarUrl = new URL("../src/TaskInfoBar.jsx", import.meta.url);
const taskInfoBarStylesUrl = new URL("../src/TaskInfoBar.css", import.meta.url);
const aboutIconUrl = new URL("../src/assets/zaica.BMP", import.meta.url);

test("App hosts one global modeless geometry viewer", async () => {
    const source = await readFile(appUrl, "utf8");

    assert.match(source, /import \{ GeometryViewerWindow \}/u);
    assert.match(source, /const \[geometryViewerOpen, setGeometryViewerOpen\]/u);
    assert.match(source, /<GeometryViewerWindow/u);
    assert.match(source, /const geometryModel = createMemo/u);
    assert.match(source, /model=\{geometryModel\(\)\}/u);
    assert.match(source, /selectedGeometryElementIndices/u);
    assert.match(source, /selectedGeometryRegionIndices/u);
    assert.match(source, /onRecordSelectionChange=\{handleGeometryRecordSelectionChange\}/u);
    assert.match(source, /selections=\{geometrySelections\(\)\}/u);
    assert.match(source, /selectionService\.loadedTaskHandle\(\)/u);
    assert.match(source, /setSelectedGeometryElementIndices\(\[\]\)/u);
    assert.match(source, /setSelectedGeometryRegionIndices\(\[\]\)/u);
    assert.match(source, /setGeometryViewerOpen\(false\)/u);
    assert.match(source, /geometryViewerButton\?\.focus\(\)/u);
});

test("task bar opens geometry viewer only for a loaded task", async () => {
    const source = await readFile(taskInfoBarUrl, "utf8");

    assert.match(source, /class="geometry-button"/u);
    assert.match(source, /disabled=\{!props\.path\}/u);
    assert.match(source, /onClick=\{props\.onGeometryViewerToggle\}/u);
    assert.match(source, /aria-pressed=\{props\.geometryViewerOpen\}/u);
    assert.match(source, /Закрыть 3D-просмотр геометрии/u);
});

test("task bar exposes an always available modal about dialog", async () => {
    const source = await readFile(taskInfoBarUrl, "utf8");
    const styles = await readFile(taskInfoBarStylesUrl, "utf8");
    const aboutIcon = await readFile(aboutIconUrl);
    const aboutButton = source.match(
        /<button\s+ref=\{\(el\) => \(aboutButton = el\)\}[\s\S]*?<\/button>/u,
    )?.[0] ?? "";

    assert.match(source, /const \[aboutOpen, setAboutOpen\] = createSignal\(false\)/u);
    assert.match(source, /import aboutIconUrl from "\.\/assets\/zaica\.BMP";/u);
    assert.equal(aboutIcon.subarray(0, 2).toString("ascii"), "BM");
    assert.match(aboutButton, /class="about-button"/u);
    assert.match(aboutButton, /title="О программе"/u);
    assert.match(aboutButton, /aria-label="О программе"/u);
    assert.match(aboutButton, /aria-haspopup="dialog"/u);
    assert.match(aboutButton, /onClick=\{\(\) => setAboutOpen\(true\)\}/u);
    assert.match(aboutButton, /class="about-button-image"/u);
    assert.match(aboutButton, /src=\{aboutIconUrl\}/u);
    assert.match(aboutButton, /alt=""/u);
    assert.match(aboutButton, /aria-hidden="true"/u);
    assert.doesNotMatch(aboutButton, />\s*\?\s*</u);
    assert.doesNotMatch(aboutButton, /disabled/u);
    assert.match(source, /class="about-dialog"/u);
    assert.match(source, /aboutDialog\.showModal\(\)/u);
    assert.match(source, /aboutButton\?\.focus\(\)/u);
    assert.match(source, /onClick=\{\(\) => setAboutOpen\(false\)\}/u);
    assert.match(source, /<h2[^>]*>О программе E3D<\/h2>/u);
    assert.match(source, /<span>Программа предназначена для подготовки,<\/span>/u);
    assert.match(source, /<span>проверки, сохранения и визуализации<\/span>/u);
    assert.match(source, /<span>исходных данных расчётных задач Clark,<\/span>/u);
    assert.match(source, /<span>включая геометрию, параметры модели<\/span>/u);
    assert.match(source, /<span>и характеристики материалов\.<\/span>/u);
    assert.match(source, /Разработчик: ChatGPT 5\.6 Sol/u);
    assert.match(source, /Куратор: Кулаев Ю\./u);
    assert.match(source, /<div>2026 г\.<\/div>/u);
    assert.match(source, /class="about-separator" aria-hidden="true"/u);
    assert.match(source, /class="about-curator-stack"/u);
    assert.match(
        styles,
        /\.about-dialog\s*\{[^}]*width:\s*max-content;[^}]*max-width:\s*calc\(100vw - 48px\);[^}]*padding:\s*18px 20px;[^}]*background:\s*#20262d;[^}]*color:\s*#f0f4f7;/su,
    );
    assert.match(
        styles,
        /\.about-button\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;/su,
    );
    assert.match(
        styles,
        /\.about-button-image\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*object-fit:\s*contain;/su,
    );
    assert.match(
        styles,
        /\.about-separator\s*\{[^}]*border-top:\s*1px dashed rgba\(240, 244, 247, \.38\);/su,
    );
    assert.match(
        styles,
        /\.about-curator-stack\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*max-content;[^}]*gap:\s*4px;/su,
    );
    assert.match(
        styles,
        /\.about-close-button\s*\{[^}]*width:\s*100%;[^}]*margin-top:\s*8px;[^}]*color:\s*#f0f4f7;[^}]*background:\s*#3a4650;/su,
    );
});
