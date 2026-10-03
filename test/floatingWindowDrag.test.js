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
      handleResizePointerDown, handleResizePointerMove, handleResizePointerUp,
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
    currentTarget: target, target: { closest: () => null }, preventDefault() {}, stopPropagation() {}, ...extra });
  return {
    ...api, window, storage, changed, props,
    down: (x = 300, y = 120, extra) => api.handleTitlePointerDown(event(x, y, extra)),
    move: (x, y, extra) => api.handleTitlePointerMove(event(x, y, extra)),
    up: () => api.handleTitlePointerUp(event(0, 0)),
    edgeDown: (edge, x = 300, y = 120, extra) => api.handleResizePointerDown(event(x, y, extra), edge),
    edgeMove: (x, y, extra) => api.handleResizePointerMove(event(x, y, extra)),
    edgeUp: () => api.handleResizePointerUp(event(0, 0)),
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
  const divisor = h.props.fitOnDrag ? 2 : 1;
  assert.ok(r.width >= Math.min(520, (h.window.innerWidth - 16) / divisor));
  assert.ok(r.height >= Math.min(360, (h.window.innerHeight - 16) / divisor));
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
  h.toggleMaximized(); const beforeResize = { ...h.rect() };
  h.edgeDown("right"); h.edgeMove(800, 600); h.edgeUp();
  assert.deepEqual(h.rect(), beforeResize);
});

test("drag shrinks independently at all four edges without restoring former dimensions", () => {
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
    assert.equal(h.rect().width, expected.width);
    assert.equal(h.rect().height, expected.height);
    assertInside(h);
    h.up();
  }
});

test("reversing at an edge grows only to half the available axis and then moves", () => {
  for (const [start, first, second, third, expected] of [
    [[900, 120], [850, 120], [800, 120], [750, 120],
      [{ x: 622, y: 100, width: 570, height: 600 },
        { x: 572, y: 100, width: 592, height: 600 },
        { x: 522, y: 100, width: 592, height: 600 }]],
    [[-400, 120], [-350, 120], [-300, 120], [-250, 120],
      [{ x: 8, y: 100, width: 570, height: 600 },
        { x: 36, y: 100, width: 592, height: 600 },
        { x: 86, y: 100, width: 592, height: 600 }]],
    [[300, 800], [300, 750], [300, 700], [300, 650],
      [{ x: 100, y: 482, width: 800, height: 410 },
        { x: 100, y: 432, width: 800, height: 442 },
        { x: 100, y: 382, width: 800, height: 442 }]],
    [[300, -600], [300, -550], [300, -500], [300, -450],
      [{ x: 100, y: 8, width: 800, height: 410 },
        { x: 100, y: 26, width: 800, height: 442 },
        { x: 100, y: 76, width: 800, height: 442 }]],
  ]) {
    const h = runtime(); h.down(); h.move(...start);
    for (const [index, point] of [first, second, third].entries()) {
      h.move(...point); assert.deepEqual(h.rect(), expected[index]); assertInside(h);
    }
    h.up();
  }
});

test("long drags stop at usable minimums; reversing has no hidden overshoot to undo", () => {
  for (const [x, y] of [[10000, 10000], [-10000, -10000], [10000, -10000], [-10000, 10000]]) {
    const h = runtime(); h.down(); h.move(x, y); assertInside(h);
    assert.equal(h.rect().width, 520); assert.equal(h.rect().height, 360);
    h.move(x - Math.sign(x) * 10, y - Math.sign(y) * 10);
    assert.equal(h.rect().width, 530); assert.equal(h.rect().height, 370);
    assertInside(h);
  }
});

test("release and reopening preserve only the visible dimensions, including legacy storage", () => {
  for (const dx of [600, -700]) {
    const h = runtime(); h.down(); h.move(300 + dx, 120); h.up();
    const fitted = { ...h.rect() };
    h.finishPointerOperation();
    assert.deepEqual(h.changed.at(-1), fitted);
    const [key] = h.storage.keys();
    assert.deepEqual(JSON.parse(h.storage.get(key)), fitted);
    h.storage.set(key, JSON.stringify({ ...fitted,
      preferredRect: { x: 100, y: 100, width: 800, height: 600 } }));
    const reopened = runtime({ storage: h.storage });
    assert.deepEqual(reopened.rect(), fitted);
    reopened.down(); reopened.move(300 - Math.sign(dx) * 100, 120); reopened.up();
    assert.equal(reopened.rect().width, 592);
    assert.deepEqual(JSON.parse(h.storage.get(key)), reopened.rect());
  }
});

test("maximized drag starts with its full visible size then obeys edge fitting without restoration", () => {
  const h = runtime(); h.toggleMaximized();
  const full = { x: 8, y: 8, width: 1184, height: 884 };
  assert.deepEqual(h.rect(), full);
  h.down(); h.move(300, 120); h.up();
  assert.equal(h.maximized(), true); assert.deepEqual(h.rect(), full);
  h.down(); h.move(420, 160);
  assert.equal(h.maximized(), false);
  assert.deepEqual(h.rect(), { x: 128, y: 48, width: 1064, height: 844 });
  h.move(300, 120);
  const moved = { x: 8, y: 8, width: 1064, height: 844 };
  assert.deepEqual(h.rect(), moved);
  h.up(); h.toggleMaximized(); h.toggleMaximized();
  assert.deepEqual(h.rect(), moved);
});

test("manual corner resize may exceed half the viewport and maximize button restores its visible size", () => {
  const h = runtime(); h.manualResize(700, 500);
  h.toggleMaximized(); h.toggleMaximized();
  assert.deepEqual(h.rect(), { x: 100, y: 100, width: 700, height: 500 });
  h.down(); h.move(750, 120); h.up();
  assert.equal(h.rect().width, 642);
  h.toggleMaximized(); h.toggleMaximized();
  assert.equal(h.rect().width, 642);
  h.down(); h.move(-150, 120); h.up();
  assert.deepEqual(h.rect(), { x: 100, y: 100, width: 642, height: 500 });
});

test("viewport shrinking stores current bounds; enlarging cannot restore a former larger size", () => {
  const h = runtime(); h.resize(450, 300); assertInside(h);
  assert.deepEqual(h.rect(), { x: 8, y: 8, width: 434, height: 284 });
  h.resize(1200, 900);
  assert.deepEqual(h.rect(), { x: 8, y: 8, width: 520, height: 360 });
});

test("keyboard movement uses the same edge growth and half-size cap as mouse drag", () => {
  const h = runtime(); h.down(); h.move(900, 120); h.up();
  assert.deepEqual(h.rect(), { x: 672, y: 100, width: 520, height: 600 });
  h.key("ArrowLeft");
  assert.deepEqual(h.rect(), { x: 662, y: 100, width: 530, height: 600 });
  for (let index = 0; index < 9; index++) h.key("ArrowLeft");
  assert.deepEqual(h.rect(), { x: 572, y: 100, width: 592, height: 600 });
  h.key("ArrowUp", true); assert.equal(h.rect().y, 99);
  h.down(); h.move(290, 120); h.up();
  assert.deepEqual(h.rect(), { x: 562, y: 99, width: 592, height: 600 });
});

test("minimized drag uses titlebar height and restores content inside the viewport", () => {
  const h = runtime(); h.toggleMinimized();
  h.down(); h.move(350, 1000); h.up();
  assert.equal(h.rect().y, 852); assert.equal(h.rect().height, 600);
  h.toggleMinimized(); assert.equal(h.minimized(), false); assertInside(h);
  assert.equal(h.rect().height, 600);
  h.down(); h.move(300, -632); h.up();
  assertInside(h);
});

test("small viewports reduce the effective minimum so automatic growth stays at half", () => {
  for (const [width, height] of [[800, 600], [450, 300]]) {
    const h = runtime(); h.resize(width, height);
    h.down(); h.move(10000, 10000);
    const halfWidth = (width - 16) / 2, halfHeight = (height - 16) / 2;
    assert.equal(h.rect().width, halfWidth); assert.equal(h.rect().height, halfHeight);
    h.move(9950, 9950);
    assert.equal(h.rect().width, halfWidth); assert.equal(h.rect().height, halfHeight);
    assertInside(h);
  }
});

test("each manual edge resizes one axis while fixing the opposite side", () => {
  for (const [edge, dx, dy, expected] of [
    ["left", -80, 80, { x: 20, y: 100, width: 880, height: 600 }],
    ["right", 100, 80, { x: 100, y: 100, width: 900, height: 600 }],
    ["top", 80, -60, { x: 100, y: 40, width: 800, height: 660 }],
    ["bottom", 80, 100, { x: 100, y: 100, width: 800, height: 700 }],
  ]) {
    const h = runtime(); h.edgeDown(edge); h.edgeMove(300 + dx, 120 + dy); h.edgeUp();
    assert.deepEqual(h.rect(), expected); assertInside(h);
    const reopened = runtime({ storage: h.storage }); assert.deepEqual(reopened.rect(), expected);
  }
});

test("manual edge resize respects the viewport and minimums without imposing the automatic half cap", () => {
  for (const [edge, expandX, expandY, shrinkX, shrinkY] of [
    ["left", -10000, 120, 10000, 120], ["right", 10000, 120, -10000, 120],
    ["top", 300, -10000, 300, 10000], ["bottom", 300, 10000, 300, -10000],
  ]) {
    const h = runtime(); h.edgeDown(edge); h.edgeMove(expandX, expandY); assertInside(h);
    const horizontal = edge === "left" || edge === "right";
    assert.ok(horizontal ? h.rect().width > 592 : h.rect().height > 442);
    h.edgeMove(shrinkX, shrinkY); assertInside(h);
    assert.equal(horizontal ? h.rect().width : h.rect().height, horizontal ? 520 : 360);
    h.edgeUp();
  }
});

test("manual resize rejects other pointers and hidden handles; cancellation finishes the operation", () => {
  const h = runtime(), original = { ...h.rect() };
  h.edgeDown("right", 300, 120, { button: 2 }); h.edgeMove(700, 120);
  assert.deepEqual(h.rect(), original);
  h.edgeDown("right"); h.edgeMove(700, 120, { pointerId: 2 });
  assert.deepEqual(h.rect(), original);
  h.edgeMove(350, 120); h.finishPointerOperation();
  const cancelled = { ...h.rect() }; h.edgeMove(700, 120);
  assert.deepEqual(h.rect(), cancelled);
  h.toggleMaximized(); const full = { ...h.rect() };
  h.edgeDown("right"); h.edgeMove(350, 120); h.edgeUp(); assert.deepEqual(h.rect(), full);
  h.toggleMaximized(); h.toggleMinimized(); const minimized = { ...h.rect() };
  h.edgeDown("right"); h.edgeMove(350, 120); h.edgeUp(); assert.deepEqual(h.rect(), minimized);
});

test("buttons, non-left pointers and another pointer cannot start or change a window drag", () => {
  const h = runtime(), original = { ...h.rect() };
  h.down(300, 120, { button: 2 }); h.move(700, 600); assert.deepEqual(h.rect(), original);
  h.down(300, 120, { target: { closest: () => ({}) } }); h.move(700, 600); assert.deepEqual(h.rect(), original);
  h.down(); h.move(700, 600, { pointerId: 2 }); assert.deepEqual(h.rect(), original);
  h.move(700, 600); h.finishPointerOperation();
  const cancelled = { ...h.rect() }; h.move(300, 120); assert.deepEqual(h.rect(), cancelled);
});
