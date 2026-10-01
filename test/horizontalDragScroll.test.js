import test from "node:test";
import assert from "node:assert/strict";
import { installHorizontalDragScroll } from "../src/services/horizontalDragScroll.js";

// Lightweight DOM boundary: the real installed event handlers run below;
// layout, capture and computed CSS are supplied by the fixture, not a browser.
class EventHost {
  listeners = new Map();
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
  emit(type, data = {}) {
    const event = { target: this, pointerId: 1, pointerType: "mouse", isPrimary: true,
      button: 2, buttons: 2, clientX: 50, clientY: 30, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.propagationStopped = true; }, ...data };
    for (const handler of this.listeners.get(type) ?? []) handler(event);
    return event;
  }
}

class Element extends EventHost {
  constructor(document, parent, options = {}) {
    super();
    Object.assign(this, { ownerDocument: document, parentElement: parent, nodeType: 1,
      tagName: "div", role: "", readOnly: false, contentEditable: null,
      clientWidth: 100, clientHeight: 100, scrollWidth: 100, scrollLeft: 0, scrollTop: 17,
      clientLeft: 0, clientTop: 0, overflowX: "hidden", overflowY: "hidden", left: 0, top: 0 }, options);
    this.children = []; parent?.children.push(this);
    const classes = new Set(options.classes ?? []);
    this.classList = { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) };
    this.captured = new Set();
  }
  matches(selector) {
    return selector.split(/,\s*/u).some(part => {
      if (part.startsWith(".")) return this.classList.contains(part.slice(1));
      if (part === "textarea:not([readonly])") return this.tagName === "textarea" && !this.readOnly;
      if (part === "[contenteditable]:not([contenteditable=\"false\"])") return this.contentEditable !== null && this.contentEditable !== "false";
      if (part.startsWith("[role=")) return this.role === part.slice(7, -2);
      return this.tagName === part;
    });
  }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) ?? null; }
  contains(element) { return element === this || Boolean(element?.parentElement && this.contains(element.parentElement)); }
  querySelector(selector) {
    for (const child of this.children) {
      if (child.matches(selector)) return child;
      const nested = child.querySelector(selector); if (nested) return nested;
    }
    return null;
  }
  getBoundingClientRect() { return { left: this.left, top: this.top }; }
  setPointerCapture(pointerId) { this.captured.add(pointerId); }
  hasPointerCapture(pointerId) { return this.captured.has(pointerId); }
  releasePointerCapture(pointerId) { this.captured.delete(pointerId); this.emit("lostpointercapture", { pointerId }); }
}

function fixture(t, options = {}) {
  const view = new EventHost(), document = new EventHost();
  document.defaultView = view; view.getComputedStyle = element => element;
  const root = new Element(document, null, { overflowX: "auto", scrollWidth: 500, scrollLeft: 100, ...options });
  const dispose = installHorizontalDragScroll(root); t.after(dispose);
  return { root, document, view, dispose,
    element: (parent = root, options = {}) => new Element(document, parent, options),
    start: (target = root, data = {}) => root.emit("pointerdown", { target, ...data }),
    move: (clientX, data = {}) => document.emit("pointermove", { clientX, ...data }),
    end: (data = {}) => document.emit("pointerup", { buttons: 0, ...data }),
  };
}

test("right drag scrolls the nearest overflowing pane, preserves vertical position and clamps edges", t => {
  const h = fixture(t), inner = h.element(h.root, { overflowX: "auto", scrollWidth: 300, scrollLeft: 90 });
  h.start(h.element(inner));
  assert.equal(h.root.hasPointerCapture(1), false);
  assert.equal(h.move(70).defaultPrevented, true);
  assert.equal(inner.scrollLeft, 70); assert.equal(inner.scrollTop, 17); assert.equal(h.root.scrollLeft, 100);
  assert.equal(h.root.hasPointerCapture(1), true);
  assert.equal(h.root.classList.contains("horizontal-drag-scrolling"), true);
  h.move(400); assert.equal(inner.scrollLeft, 0);
  h.move(-400); assert.equal(inner.scrollLeft, 200);
  h.end({ clientX: -400 });
  assert.equal(h.root.hasPointerCapture(1), false);
  assert.equal(h.root.classList.contains("horizontal-drag-scrolling"), false);
});

test("non-overflowing and hidden-overflow panes fall back to the outer tab scroller", t => {
  const h = fixture(t), inner = h.element(h.root, { overflowX: "auto" });
  const hidden = h.element(inner, { overflowX: "hidden", scrollWidth: 800 });
  h.start(hidden); h.move(20);
  assert.equal(h.root.scrollLeft, 130); assert.equal(inner.scrollLeft, 0); assert.equal(hidden.scrollLeft, 0);
});

test("dragging a Tabulator header scrolls its holder instead of the tab viewport", t => {
  const h = fixture(t), table = h.element(h.root, { classes: ["tabulator"] });
  const header = h.element(table, { classes: ["tabulator-header"] });
  const holder = h.element(table, { classes: ["tabulator-tableholder"], overflowX: "auto", scrollWidth: 300, scrollLeft: 80 });
  h.start(h.element(header)); h.move(70);
  assert.equal(holder.scrollLeft, 60); assert.equal(h.root.scrollLeft, 100);
});

test("readonly summary text scrolls independently while editable controls and graphics keep their gestures", t => {
  const h = fixture(t);
  const readonly = h.element(h.root, { tagName: "textarea", readOnly: true, overflowX: "auto", scrollWidth: 400, scrollLeft: 60 });
  h.start(readonly); h.move(75); h.end({ clientX: 75 }); assert.equal(readonly.scrollLeft, 35);
  const blocked = [
    { tagName: "input" }, { tagName: "input", readOnly: true }, { tagName: "select" },
    { tagName: "textarea" }, { contentEditable: "true" }, { role: "textbox" },
    { role: "separator" }, { tagName: "canvas" },
    ...["tabulator-editing", "tabulator-col-resize-handle", "tabulator-row-resize-handle",
      "record-graph-region", "fmm-graph-region", "time-generator-graph", "three-geometry-viewport", "graph-context-menu"]
      .map(name => ({ classes: [name] })),
  ];
  for (const options of blocked) {
    h.start(h.element(h.element(h.root, options))); h.move(10);
    assert.equal(h.root.scrollLeft, 100, JSON.stringify(options));
    assert.equal(h.root.emit("contextmenu").defaultPrevented, false, JSON.stringify(options));
  }
});

test("native scrollbar and border presses do not start a tab drag", t => {
  const h = fixture(t), inner = h.element(h.root, { overflowY: "auto", clientWidth: 80, clientHeight: 70 });
  for (const point of [{ clientX: 85 }, { clientY: 75 }, { clientX: -1 }]) {
    h.start(inner, point); h.move(10);
    assert.equal(h.root.scrollLeft, 100);
  }
});

test("short, vertical, left, touch, non-primary and already handled gestures are ignored", t => {
  const h = fixture(t);
  h.start(); h.move(54); h.end({ clientX: 54 }); assert.equal(h.root.scrollLeft, 100);
  h.start(); h.move(60, { clientY: 70 }); h.end({ clientX: 60, clientY: 70 }); assert.equal(h.root.scrollLeft, 100);
  for (const data of [{ button: 0 }, { pointerType: "touch" }, { isPrimary: false }, { defaultPrevented: true }]) {
    h.start(h.root, data); h.move(10); assert.equal(h.root.scrollLeft, 100);
  }
  assert.equal(h.root.emit("contextmenu").defaultPrevented, false);
});

test("a tab without horizontal overflow and targets outside the tab remain untouched", t => {
  const h = fixture(t, { scrollWidth: 100 }), outside = h.element(null, { overflowX: "auto", scrollWidth: 300 });
  for (const target of [h.root, outside]) {
    h.start(target); h.move(10);
    assert.equal(h.root.scrollLeft, 100); assert.equal(outside.scrollLeft, 0);
    assert.equal(h.root.emit("contextmenu").defaultPrevented, false);
  }
});

test("ordinary right click retains its menu; a menu after drag release is suppressed only once", t => {
  const h = fixture(t);
  h.start(); h.end(); assert.equal(h.root.emit("contextmenu").defaultPrevented, false);
  h.start(); h.move(70); h.end({ clientX: 70 });
  assert.equal(h.root.emit("contextmenu").defaultPrevented, true);
  assert.equal(h.root.emit("contextmenu").defaultPrevented, false);
  h.start(); h.end(); assert.equal(h.root.emit("contextmenu").defaultPrevented, false);
});

test("menu before drag release is suppressed without swallowing the next ordinary right click", t => {
  const h = fixture(t);
  h.start(); h.move(70); assert.equal(h.root.emit("contextmenu").defaultPrevented, true);
  h.end({ clientX: 70 }); assert.equal(h.root.emit("contextmenu").defaultPrevented, false);
  h.start(); h.end(); assert.equal(h.root.emit("contextmenu").defaultPrevented, false);
});

test("platforms opening the native menu on initial press retain it without later background scrolling", t => {
  const h = fixture(t);
  h.start(); assert.equal(h.root.emit("contextmenu").defaultPrevented, false);
  h.move(10); assert.equal(h.root.scrollLeft, 100);
});

for (const reason of ["pointercancel", "lostpointercapture", "Escape", "blur", "buttons released", "dispose"]) {
  test(`${reason} stops a drag and releases its cursor and capture`, t => {
    const h = fixture(t); h.start(); h.move(70);
    if (reason === "pointercancel") h.document.emit("pointercancel");
    else if (reason === "lostpointercapture") h.root.emit("lostpointercapture");
    else if (reason === "Escape") h.document.emit("keydown", { code: "Escape" });
    else if (reason === "blur") h.view.emit("blur");
    else if (reason === "buttons released") h.move(60, { buttons: 0 });
    else h.dispose();
    h.move(10);
    assert.equal(h.root.scrollLeft, 80);
    assert.equal(h.root.hasPointerCapture(1), false);
    assert.equal(h.root.classList.contains("horizontal-drag-scrolling"), false);
    if (reason === "dispose") {
      h.start(); h.move(10); assert.equal(h.root.scrollLeft, 80);
      assert.equal(h.root.emit("contextmenu").defaultPrevented, false);
    }
  });
}

test("another pointer cannot move or finish the active drag", t => {
  const h = fixture(t); h.start(); h.move(70, { pointerId: 2 }); h.end({ pointerId: 2 });
  assert.equal(h.root.scrollLeft, 100);
  h.move(70); assert.equal(h.root.scrollLeft, 80);
});

test("keyboard context menus remain available after a drag", t => {
  const h = fixture(t); h.start(); h.move(70); h.end({ clientX: 70 });
  assert.equal(h.root.emit("contextmenu", { button: 0 }).defaultPrevented, false);
});
