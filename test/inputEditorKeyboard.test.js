import test from "node:test";
import assert from "node:assert/strict";
import { createInputEditor } from "../src/tabulator/editors/editorFactory.js";

function editorFixture(t, htmlType, parse = value => value) {
    const listeners = new Map();
    const input = {
        type: "", value: "", focused: false, selected: false,
        addEventListener(type, handler) { listeners.set(type, handler); },
        focus() { this.focused = true; },
        select() { this.selected = true; },
    };
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
    Object.defineProperty(globalThis, "document", {
        configurable: true, value: { createElement: () => input },
    });
    t.after(() => {
        if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
        else delete globalThis.document;
    });
    let rendered;
    const saved = [];
    let cancelled = 0, tableFocus = 0;
    createInputEditor({ htmlType, parse })(
        { getValue: () => "123.45" },
        callback => { rendered = callback; },
        value => saved.push(value),
        () => { cancelled++; },
    );
    rendered();
    return {
        input, saved, cancelled: () => cancelled, tableFocus: () => tableFocus,
        blur: () => listeners.get("blur")(),
        key(code, options = {}) {
            const event = { code, key: code, defaultPrevented: false, propagationStopped: false,
                preventDefault() { this.defaultPrevented = true; },
                stopPropagation() { this.propagationStopped = true; }, ...options };
            listeners.get("keydown")(event);
            // Model only the harmful parent action from Tabulator Keybindings:
            // scrollToStart/End focuses the table and blurs (saves) its editor.
            // Actual native caret movement remains the browser's responsibility.
            if (!event.propagationStopped && ["Home", "End"].includes(event.key)) {
                event.preventDefault(); tableFocus++; listeners.get("blur")();
            }
            return event;
        },
    };
}

for (const htmlType of ["text", "number"]) {
    test(`${htmlType} Home/End stay inside the editor and leave native caret/selection handling enabled`, t => {
        const h = editorFixture(t, htmlType);
        assert.equal(h.input.type, htmlType);
        assert.equal(h.input.focused, true); assert.equal(h.input.selected, true);
        for (const code of ["Home", "End"]) {
            for (const options of [{}, { shiftKey: true }, { ctrlKey: true }, { key: "layout-independent" }]) {
                const event = h.key(code, options);
                assert.equal(event.propagationStopped, true);
                assert.equal(event.defaultPrevented, false);
            }
        }
        assert.deepEqual(h.saved, []);
        assert.equal(h.cancelled(), 0); assert.equal(h.tableFocus(), 0);
    });
}

test("input save, cancel and blur still use the configured parser and physical keys", t => {
    const h = editorFixture(t, "number", Number);
    h.input.value = "67.89";
    h.key("Enter", { key: "other" });
    h.key("NumpadEnter", { key: "other" });
    assert.deepEqual(h.saved, [67.89, 67.89]);
    h.key("Escape", { key: "other" });
    assert.equal(h.cancelled(), 1);
    h.input.value = "80"; h.blur();
    assert.deepEqual(h.saved, [67.89, 67.89, 80]);
});

test("numeric keypad Home/End stay in the input while NumLock digits are not intercepted", t => {
    const h = editorFixture(t, "number");
    for (const [code, navigationKey, digit] of [["Numpad7", "Home", "7"], ["Numpad1", "End", "1"]]) {
        const navigation = h.key(code, { key: navigationKey });
        assert.equal(navigation.propagationStopped, true);
        assert.equal(navigation.defaultPrevented, false);
        const numeric = h.key(code, { key: digit });
        assert.equal(numeric.propagationStopped, false);
        assert.equal(numeric.defaultPrevented, false);
    }
    assert.deepEqual(h.saved, []);
    assert.equal(h.cancelled(), 0); assert.equal(h.tableFocus(), 0);
});

test("unrelated input keys continue bubbling for ordinary table navigation", t => {
    const h = editorFixture(t, "text");
    for (const code of ["ArrowLeft", "ArrowRight", "Tab", "KeyA"]) {
        const event = h.key(code);
        assert.equal(event.propagationStopped, false);
        assert.equal(event.defaultPrevented, false);
    }
    assert.deepEqual(h.saved, []);
    assert.equal(h.cancelled(), 0);
});
