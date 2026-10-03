const DRAG_THRESHOLD = 5;
const BLOCKED_TARGETS = [
  "input", "select", "textarea:not([readonly])", "[contenteditable]:not([contenteditable=\"false\"])",
  "[role=\"textbox\"]", "[role=\"separator\"]", "canvas", ".tabulator-editing",
  ".tabulator-col-resize-handle", ".tabulator-row-resize-handle",
  ".record-graph-region", ".fmm-graph-region", ".time-generator-graph",
  ".three-geometry-viewport", ".graph-context-menu",
].join(", ");
const SCROLL_OVERFLOW = /^(auto|scroll)$/u;

function scrollsHorizontally(element, view) {
  return element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1
    && SCROLL_OVERFLOW.test(view.getComputedStyle(element).overflowX);
}

function scrollTarget(target, root, event, view) {
  // Cells and headers belong to the same scroll surface, including formatted
  // content inside a cell. Do not mistake their clipped content for a scrollbar.
  const tablePart = target.closest(".tabulator-cell, .tabulator-header");
  const holder = tablePart?.closest(".tabulator")?.querySelector(".tabulator-tableholder");
  let candidate = holder && scrollsHorizontally(holder, view) ? holder : null;
  for (let element = target; element; element = element.parentElement) {
    const style = view.getComputedStyle(element);
    if (element === target && !tablePart
      && (SCROLL_OVERFLOW.test(style.overflowX) || SCROLL_OVERFLOW.test(style.overflowY))) {
      // A native scrollbar press targets its own scroll container, not a cell
      // inside it. Checking every ancestor can reject visible table content.
      const bounds = element.getBoundingClientRect();
      const x = event.clientX - bounds.left - element.clientLeft;
      const y = event.clientY - bounds.top - element.clientTop;
      if (x < 0 || x >= element.clientWidth || y < 0 || y >= element.clientHeight) return null;
    }
    if (!candidate && scrollsHorizontally(element, view)) candidate = element;
    if (element === root) return candidate;
  }
  return null;
}

/** Add right-button horizontal dragging to existing tab scroll containers. */
export function installHorizontalDragScroll(root) {
  const document = root.ownerDocument, view = document.defaultView;
  let drag = null, suppressMenuUntil = 0;

  function finish(suppressMenu = false) {
    const finished = drag;
    drag = null;
    root.classList.remove("horizontal-drag-ready");
    root.classList.remove("horizontal-drag-scrolling");
    if (suppressMenu && finished?.moved && !finished.contextMenuSeen) {
      suppressMenuUntil = Date.now() + 1000;
    }
    if (finished && root.hasPointerCapture?.(finished.pointerId)) {
      root.releasePointerCapture(finished.pointerId);
    }
  }

  function pointerDown(event) {
    finish(); suppressMenuUntil = 0;
    if (event.defaultPrevented || event.button !== 2 || event.isPrimary === false || event.pointerType === "touch") return;
    const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
    if (!target || !root.contains(target) || target.isContentEditable || target.closest(BLOCKED_TARGETS)) return;
    const scroller = scrollTarget(target, root, event, view);
    if (!scroller) return;
    drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      startLeft: scroller.scrollLeft, scroller, moved: false, contextMenuSeen: false };
    root.classList.add("horizontal-drag-ready");
    // Keep a right press on table data from also starting a compatibility
    // mousedown action such as row selection or focus changes in Tabulator.
    event.preventDefault();
  }

  function moveContent(event) {
    const dx = event.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD || Math.abs(dx) <= Math.abs(event.clientY - drag.y)) return;
      drag.moved = true;
      root.classList.add("horizontal-drag-scrolling");
      // Document listeners still finish the gesture if capture is unavailable.
      try { root.setPointerCapture?.(event.pointerId); } catch { /* pointer already released */ }
    }
    event.preventDefault(); event.stopPropagation();
    drag.scroller.scrollLeft = Math.max(0, Math.min(
      drag.scroller.scrollWidth - drag.scroller.clientWidth, drag.startLeft - dx,
    ));
  }

  function pointerMove(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!(event.buttons & 2)) { finish(true); return; }
    moveContent(event);
  }

  function pointerUp(event) {
    if (!drag || drag.pointerId !== event.pointerId || (event.button !== 2 && (event.buttons & 2))) return;
    if (drag.moved) moveContent(event);
    finish(true);
  }

  function pointerCancel(event) {
    if (drag?.pointerId === event.pointerId) finish(true);
  }

  function contextMenu(event) {
    if (event.button === 2 && (drag || Date.now() < suppressMenuUntil)) {
      event.preventDefault(); event.stopPropagation();
      if (drag) drag.contextMenuSeen = true;
      suppressMenuUntil = 0;
    } else {
      // Keep keyboard menus and ordinary clicks outside an active drag intact.
      finish(); suppressMenuUntil = 0;
    }
  }

  function keyDown(event) {
    suppressMenuUntil = 0;
    if (event.code === "Escape" && drag) {
      if (drag.moved) event.preventDefault();
      finish(true);
    }
  }

  const blur = () => finish(true);
  const listeners = [
    [root, "pointerdown", pointerDown], [root, "contextmenu", contextMenu],
    [root, "lostpointercapture", pointerCancel],
    [document, "pointermove", pointerMove], [document, "pointerup", pointerUp],
    [document, "pointercancel", pointerCancel], [document, "keydown", keyDown],
    [view, "blur", blur],
  ];
  for (const [target, type, handler] of listeners) target.addEventListener(type, handler, true);
  return () => {
    finish(); suppressMenuUntil = 0;
    for (const [target, type, handler] of listeners) target.removeEventListener(type, handler, true);
  };
}
