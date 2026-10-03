import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL(
  "../src/components/window/FloatingWindow.jsx", import.meta.url,
), "utf8");
const componentStart = source.indexOf("export function FloatingWindow(props) {");
const markupStart = source.indexOf("  return (\n    <Show", componentStart);
assert.ok(componentStart > 0 && markupStart > componentStart);

// Execute the actual component state and pointer handlers. Only Solid lifecycle,
// signals and the DOM rectangle are stubbed; the window fitting code is unchanged.
const createRuntime = new Function("dependencies", `
  const { window, document, createSignal, createUniqueId, onMount, onCleanup } = dependencies;
  ${source.slice(source.indexOf("const VIEWPORT_MARGIN"), componentStart)}
  return function(props) {
    ${source.slice(componentStart + "export function FloatingWindow(props) {".length, markupStart)}
    return { rect, minimized, maximized, handleTitlePointerDown, handleTitlePointerMove,
      handleTitlePointerUp, handleTitleKeyDown, finishPointerOperation, toggleMaximized, toggleMinimized,
      handleViewportResize, syncRectFromElement,
      attach(element) { windowElement = element; } };
  };
`);

function runtime(options = {}) {
  const storage = options.storage ?? new Map();
  const mounts = [], cleanup = [], listeners = new Map(), changed = [];
  const window = {
    innerWidth: 1200, innerHeight: 900,
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name),
  };
  const props = { open: true, fitOnDrag: true, minWidth: 520, minHeight: 360,
    initialWidth: 800, initialHeight: 600, initialX: 100, initialY: 100,
    onRectChange: value => changed.push(value), ...options.props };
  let measured = null;
  const api = createRuntime({
    window, document: { documentElement: {} }, createUniqueId: () => "window",
    createSignal(initial) { let value = initial; return [() => value, next => { value = next; }]; },
    onMount: callback => mounts.push(callback), onCleanup: callback => cleanup.push(callback),
  })(props);
  api.attach({ isConnected: true, getBoundingClientRect() {
    const r = api.rect();
    return measured ?? { left: r.x, top: r.y, width: r.width, height: api.minimized() ? 40 : r.height };
  } });
  mounts.forEach(callback => callback());
  const captures = new Set();
  const target = {
    setPointerCapture: id => captures.add(id), hasPointerCapture: id => captures.has(id),
    releasePointerCapture: id => { captures.delete(id); api.finishPointerOperation(); },
  };
  const event = (x, y, extra = {}) => ({ pointerId: 1, button: 0, clientX: x, clientY: y,
    currentTarget: target, target: { closest: () => null }, preventDefault() {}, ...extra });
  return {
    ...api, window, storage, changed,
    down: (x = 300, y = 120, extra) => api.handleTitlePointerDown(event(x, y, extra)),
    move: (x, y, extra) => api.handleTitlePointerMove(event(x, y, extra)),
    up: () => api.handleTitlePointerUp(event(0, 0)),
    key: (key, shiftKey = false) => api.handleTitleKeyDown({
      target, currentTarget: target, key, shiftKey, preventDefault() {},
    }),
    resize(width, height) { window.innerWidth = width; window.innerHeight = height; api.handleViewportResize(); },
    manualResize(width, height) {
      const r = api.rect(); measured = { left: r.x, top: r.y, width, height };
      api.syncRectFromElement(); measured = null;
    },
    dispose: () => cleanup.forEach(callback => callback()),
  };
}

function assertInside(h) {
  const r = h.rect();
  assert.ok(r.x >= 8 && r.y >= 8, "titlebar remains inside the 8px viewport margin");
  assert.ok(r.x + r.width <= h.window.innerWidth - 8);
  assert.ok(r.y + r.height <= h.window.innerHeight - 8);
  assert.ok(r.width >= Math.min(520, h.window.innerWidth - 16));
  assert.ok(r.height >= Math.min(360, h.window.innerHeight - 16));
}

test("3D alone opts into fitting during drag; existing modeless dialogs retain their contract", () => {
  const viewer = readFileSync(new URL("../src/components/geometry/GeometryViewerWindow.jsx", import.meta.url), "utf8");
  assert.match(viewer, /<FloatingWindow\b[^>]*\bfitOnDrag\b/su);
  for (const path of ["elements/MedAutofillDialog.jsx", "tasks/TaskLaunchWindow.jsx"]) {
    assert.doesNotMatch(readFileSync(new URL(`../src/components/${path}`, import.meta.url), "utf8"), /\bfitOnDrag\b/u);
  }
  const h = runtime({ props: { fitOnDrag: false } });
  h.down(); h.move(750, 570);
  assert.deepEqual(h.rect(), { x: 392, y: 292, width: 800, height: 600 });
  h.up(); h.toggleMaximized(); h.down(); h.move(800, 600);
  assert.equal(h.maximized(), true);
});

test("drag fits independently at all four edges and restores the full original rectangle", () => {
  for (const [dx, dy, expected] of [
    [400, 0, { x: 500, y: 100, width: 692, height: 600 }],
    [-200, 0, { x: 8, y: 100, width: 692, height: 600 }],
    [0, 250, { x: 100, y: 350, width: 800, height: 542 }],
    [0, -200, { x: 100, y: 8, width: 800, height: 492 }],
    [400, 250, { x: 500, y: 350, width: 692, height: 542 }],
    [-200, -200, { x: 8, y: 8, width: 692, height: 492 }],
  ]) {
    const h = runtime(); h.down(); h.move(300 + dx, 120 + dy);
    assert.deepEqual(h.rect(), expected); assertInside(h);
    h.move(300, 120);
    assert.deepEqual(h.rect(), { x: 100, y: 100, width: 800, height: 600 });
    h.up();
  }
});

test("long drags stop at usable minimums and never hide the titlebar", () => {
  for (const [x, y] of [[10000, 10000], [-10000, -10000], [10000, -10000], [-10000, 10000]]) {
    const h = runtime(); h.down(); h.move(x, y); assertInside(h);
    assert.equal(h.rect().width, 520); assert.equal(h.rect().height, 360);
    h.move(300, 120);
    assert.deepEqual(h.rect(), { x: 100, y: 100, width: 800, height: 600 });
  }
});

test("preferred dimensions survive release, the next drag and storage restoration at either edge", () => {
  for (const dx of [400, -200]) {
    const h = runtime(); h.down(); h.move(300 + dx, 120); h.up();
    const fitted = { ...h.rect() };
    // Window-level pointerup after captured titlebar pointerup must not convert
    // the smaller visible rectangle into the preferred dimensions.
    h.finishPointerOperation();
    assert.deepEqual(h.changed.at(-1), fitted);
    assert.equal(h.changed.at(-1).preferredRect, undefined);
    const reopened = runtime({ storage: h.storage });
    assert.deepEqual(reopened.rect(), fitted);
    reopened.down(); reopened.move(300 - dx, 120); reopened.up();
    assert.deepEqual(reopened.rect(), { x: 100, y: 100, width: 800, height: 600 });
  }
});

test("maximized drag leaves fullscreen only upon movement and retains its full size as the preferred size", () => {
  const h = runtime(); h.toggleMaximized();
  const full = { x: 8, y: 8, width: 1184, height: 884 };
  assert.deepEqual(h.rect(), full);
  h.down(); h.move(300, 120); h.up();
  assert.equal(h.maximized(), true); assert.deepEqual(h.rect(), full);
  h.down(); h.move(420, 160);
  assert.equal(h.maximized(), false);
  assert.deepEqual(h.rect(), { x: 128, y: 48, width: 1064, height: 844 });
  h.move(300, 120); assert.deepEqual(h.rect(), full);
  h.up(); h.toggleMaximized(); h.toggleMaximized();
  assert.deepEqual(h.rect(), full);
});

test("manual resizing establishes new preferred dimensions while maximize button still restores them", () => {
  const h = runtime(); h.manualResize(700, 500);
  h.down(); h.move(750, 120); h.up();
  assert.equal(h.rect().width, 642);
  h.toggleMaximized(); h.toggleMaximized();
  assert.equal(h.rect().width, 642);
  h.down(); h.move(-150, 120); h.up();
  assert.deepEqual(h.rect(), { x: 100, y: 100, width: 700, height: 500 });
});

test("viewport shrinking preserves preferred size and enlarging restores it", () => {
  const h = runtime(); h.resize(450, 300); assertInside(h);
  assert.deepEqual(h.rect(), { x: 8, y: 8, width: 434, height: 284 });
  h.resize(1200, 900);
  assert.deepEqual(h.rect(), { x: 100, y: 100, width: 800, height: 600 });
});

test("keyboard movement after edge fitting preserves the preferred size for subsequent drag", () => {
  const h = runtime(); h.down(); h.move(700, 120); h.up();
  assert.deepEqual(h.rect(), { x: 500, y: 100, width: 692, height: 600 });
  h.key("ArrowLeft");
  assert.deepEqual(h.rect(), { x: 490, y: 100, width: 702, height: 600 });
  h.key("ArrowUp", true); assert.equal(h.rect().y, 99);
  h.down(); h.move(-90, 121); h.up();
  assert.deepEqual(h.rect(), { x: 100, y: 100, width: 800, height: 600 });
});

test("minimized drag uses titlebar height and restores content inside the viewport", () => {
  const h = runtime(); h.toggleMinimized();
  h.down(); h.move(350, 1000); h.up();
  assert.equal(h.rect().y, 852); assert.equal(h.rect().height, 600);
  h.toggleMinimized(); assert.equal(h.minimized(), false); assertInside(h);
  assert.equal(h.rect().height, 360);
  h.down(); h.move(300, -632); h.up();
  assertInside(h);
});

test("buttons, non-left pointers and another pointer cannot start or change a window drag", () => {
  const h = runtime(), original = { ...h.rect() };
  h.down(300, 120, { button: 2 }); h.move(700, 600); assert.deepEqual(h.rect(), original);
  h.down(300, 120, { target: { closest: () => ({}) } }); h.move(700, 600); assert.deepEqual(h.rect(), original);
  h.down(); h.move(700, 600, { pointerId: 2 }); assert.deepEqual(h.rect(), original);
  h.move(700, 600); h.finishPointerOperation();
  const cancelled = { ...h.rect() }; h.move(300, 120); assert.deepEqual(h.rect(), cancelled);
});
