import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
    appCss: new URL("../src/App.css", import.meta.url),
    editor: new URL(
        "../src/components/editors/DataEditor.jsx",
        import.meta.url,
    ),
    tasks: new URL("../src/tabs/Tasks.jsx", import.meta.url),
    materials: new URL(
        "../src/tabs/MaterialLibraryTab.css",
        import.meta.url,
    ),
};

test("active tabs fill their content area without the gray page background", async () => {
    const [appCss, editor, tasks, materials] = await Promise.all([
        readFile(files.appCss, "utf8"),
        readFile(files.editor, "utf8"),
        readFile(files.tasks, "utf8"),
        readFile(files.materials, "utf8"),
    ]);

    assert.doesNotMatch(appCss, /background:\s*gray/u);
    assert.match(appCss, /\.tab-content\s*\{[^}]*position:\s*relative;/u);
    assert.match(appCss, /\.tab-content\s*\{[^}]*overflow:\s*hidden;/u);

    for (const source of [editor, tasks]) {
        assert.match(source, /position:\s*"absolute"/u);
        assert.match(source, /inset:\s*"0"/u);
        assert.doesNotMatch(source, /position:\s*"fixed"/u);
        assert.doesNotMatch(source, /top:\s*"90px"/u);
        assert.doesNotMatch(source, /bottom:\s*"10px"/u);
    }

    assert.match(
        materials,
        /\.material-library-tab\s*\{[^}]*position:\s*absolute;/u,
    );
    assert.match(
        materials,
        /\.material-library-tab\s*\{[^}]*inset:\s*0;/u,
    );
    assert.doesNotMatch(materials, /position:\s*fixed;/u);
});

test("graph tabs align their initial vertical divisions", async () => {
    const [editor, tasksCss] = await Promise.all([
        readFile(files.editor, "utf8"),
        readFile(
            new URL("../src/tabs/Tasks.css", import.meta.url),
            "utf8",
        ),
    ]);

    assert.match(
        editor,
        /const \[mainTableRatio, setMainTableRatio\] = createSignal\(0\.65\)/u,
    );
    const lowerRuleStart = tasksCss.indexOf(
        ".data-editor-lower.with-graph .data-editor-detail {",
    );
    const lowerRule = tasksCss.slice(
        lowerRuleStart,
        tasksCss.indexOf("}", lowerRuleStart),
    );

    assert.ok(lowerRuleStart >= 0);
    assert.match(lowerRule, /flex:\s*0 0 calc\(65% - 3px\)/u);
});
