import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tasksUrl = new URL("../src/tabs/Tasks.jsx", import.meta.url);
const appUrl = new URL("../src/App.jsx", import.meta.url);
const taskInfoBarUrl = new URL("../src/TaskInfoBar.jsx", import.meta.url);
const taskInfoBarStylesUrl = new URL("../src/TaskInfoBar.css", import.meta.url);

test("loaded task path reaches the task bar", async () => {
    const [tasksSource, appSource] = await Promise.all([
        readFile(tasksUrl, "utf8"),
        readFile(appUrl, "utf8"),
    ]);

    assert.match(
        tasksSource,
        /const commitTaskLoad = [\s\S]*?selectionService\.setLoadedTaskPath\(fullPath\);/u,
    );
    assert.match(
        appSource,
        /<TaskInfoBar[\s\S]*?path=\{selectionService\.loadedTaskPath\(\)\}/u,
    );
});

test("loaded path is announced and softly highlighted once", async () => {
    const [source, styles] = await Promise.all([
        readFile(taskInfoBarUrl, "utf8"),
        readFile(taskInfoBarStylesUrl, "utf8"),
    ]);

    assert.match(source, /import \{ Show,/u);
    assert.match(source, /aria-live="polite"/u);
    assert.match(source, /aria-atomic="true"/u);
    assert.match(source, /<Show\s+keyed\s+when=\{props\.path\}/u);
    assert.match(source, /class="task-info-path-empty"/u);
    assert.match(source, /class="task-info-path-value"/u);

    const keyframes = styles.match(
        /@keyframes task-path-attention\s*\{[\s\S]*?\n\}/u,
    )?.[0] ?? "";

    assert.match(
        styles,
        /\.task-info-path-value\s*\{[^}]*animation:\s*task-path-attention 1s ease-out;/su,
    );
    assert.match(
        keyframes,
        /background-color:[^;]+;[\s\S]*box-shadow:[^;]+;[\s\S]*background-color:[^;]+;[\s\S]*box-shadow:[^;]+;/u,
    );
    assert.doesNotMatch(styles, /animation:[^;]*(?:infinite|transform)/u);
    assert.doesNotMatch(keyframes, /transform\s*:/u);
    assert.match(
        styles,
        /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.task-info-path-value\s*\{\s*animation:\s*none;/u,
    );
});
