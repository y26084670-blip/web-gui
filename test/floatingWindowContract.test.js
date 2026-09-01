import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentUrl = new URL(
    "../src/components/window/FloatingWindow.jsx",
    import.meta.url,
);
const stylesUrl = new URL(
    "../src/components/window/FloatingWindow.css",
    import.meta.url,
);

test("floating window is a modeless Solid portal", async () => {
    const source = await readFile(componentUrl, "utf8");
    const styles = await readFile(stylesUrl, "utf8");

    assert.match(source, /import \{ Portal \} from "solid-js\/web"/u);
    assert.match(source, /<Portal>/u);
    assert.match(source, /role="dialog"/u);
    assert.match(source, /aria-modal="false"/u);
    assert.match(
        styles,
        /\.floating-window-layer\s*\{[^}]*position:\s*fixed;[^}]*pointer-events:\s*none;/su,
    );
    assert.match(
        styles,
        /\.floating-window\s*\{[^}]*position:\s*fixed;[^}]*resize:\s*both;[^}]*pointer-events:\s*auto;/su,
    );
});

test("floating window supports drag, viewport clamp, and persistence", async () => {
    const source = await readFile(componentUrl, "utf8");

    assert.match(source, /setPointerCapture\(event\.pointerId\)/u);
    assert.match(source, /releasePointerCapture\(event\.pointerId\)/u);
    assert.match(source, /onPointerMove=\{handleTitlePointerMove\}/u);
    assert.match(source, /onKeyDown=\{handleTitleKeyDown\}/u);
    assert.match(source, /event\.target !== event\.currentTarget/u);
    assert.match(source, /function clampRect\(/u);
    assert.match(source, /options\.positionHeight/u);
    assert.match(
        source,
        /viewport\.height - positionHeight - margin/u,
    );
    assert.match(source, /window\.addEventListener\("resize"/u);
    assert.match(source, /window\.localStorage\.getItem/u);
    assert.match(source, /window\.localStorage\.setItem/u);
    assert.match(source, /!props\.open/u);
    assert.match(source, /!windowElement\?\.isConnected/u);
    assert.doesNotMatch(source, /ResizeObserver/u);
});

test("floating window exposes minimize, maximize, and close actions", async () => {
    const source = await readFile(componentUrl, "utf8");

    assert.match(source, /const toggleMinimized/u);
    assert.match(source, /DEFAULT_MINIMIZED_HEIGHT = 40/u);
    assert.match(source, /positionHeight: positionHeight\(\)/u);
    assert.match(source, /setMinimized\(!minimized\(\)\)/u);
    assert.match(source, /replaceRect\(rect\(\), true\)/u);
    assert.match(source, /if \(wasDragging\) persistRect\(\)/u);
    assert.match(source, /const toggleMaximized/u);
    assert.match(source, /props\.onClose\?\.\(\)/u);
    assert.match(source, /Свернуть окно/u);
    assert.match(source, /На весь экран/u);
    assert.match(source, /Закрыть окно/u);
});
