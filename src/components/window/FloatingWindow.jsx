import {
  Show,
  createSignal,
  createUniqueId,
  onCleanup,
  onMount,
} from "solid-js";
import { Portal } from "solid-js/web";
import "./FloatingWindow.css";

const VIEWPORT_MARGIN = 8;
const DEFAULT_WIDTH = 720;
const DEFAULT_HEIGHT = 520;
const DEFAULT_MIN_WIDTH = 360;
const DEFAULT_MIN_HEIGHT = 240;
const DEFAULT_MINIMIZED_HEIGHT = 40;
const DEFAULT_STORAGE_KEY = "web-gui:floating-window";

function finiteNumber(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function viewportSize() {
  return {
    width: Math.max(
      1,
      window.innerWidth || document.documentElement.clientWidth || 1,
    ),
    height: Math.max(
      1,
      window.innerHeight || document.documentElement.clientHeight || 1,
    ),
  };
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function clampRect(rect, options = {}) {
  const viewport = options.viewport ?? viewportSize();
  const margin = options.margin ?? VIEWPORT_MARGIN;
  const availableWidth = Math.max(1, viewport.width - 2 * margin);
  const availableHeight = Math.max(1, viewport.height - 2 * margin);
  const minimumWidth = Math.min(
    availableWidth,
    finiteNumber(options.minWidth, DEFAULT_MIN_WIDTH),
  );
  const minimumHeight = Math.min(
    availableHeight,
    finiteNumber(options.minHeight, DEFAULT_MIN_HEIGHT),
  );
  const width = clamp(
    finiteNumber(rect.width, DEFAULT_WIDTH),
    minimumWidth,
    availableWidth,
  );
  const height = clamp(
    finiteNumber(rect.height, DEFAULT_HEIGHT),
    minimumHeight,
    availableHeight,
  );
  const positionHeight = clamp(
    finiteNumber(options.positionHeight, height),
    1,
    availableHeight,
  );

  return {
    x: clamp(finiteNumber(rect.x, margin), margin, viewport.width - width - margin),
    y: clamp(
      finiteNumber(rect.y, margin),
      margin,
      viewport.height - positionHeight - margin,
    ),
    width,
    height,
  };
}

// An edge contact is enough to determine expansion. No former or hidden size
// participates: after reaching half of the available span, the window moves.
function moveFittedAxis(position, size, delta, start, end, minimum, growthLimit = (end - start) / 2) {
  const halfSpan = growthLimit;
  if (delta > 0 && position <= start + 0.5 && size < halfSpan) {
    const growth = Math.min(delta, halfSpan - size);
    size += growth;
    delta -= growth;
  } else if (delta < 0 && position + size >= end - 0.5 && size < halfSpan) {
    const growth = Math.min(-delta, halfSpan - size);
    position -= growth;
    size += growth;
    delta += growth;
  }
  const requested = position + delta;
  const nextPosition = clamp(requested, start, end - minimum);
  return {
    position: nextPosition,
    size: clamp(Math.min(requested + size, end) - nextPosition, minimum, size),
  };
}

function moveFittedRect(rect, dx, dy, options = {}) {
  const viewport = options.viewport ?? viewportSize();
  const margin = options.margin ?? VIEWPORT_MARGIN;
  const minimum = clampRect({ width: 0, height: 0 }, options);
  const horizontal = moveFittedAxis(rect.x, rect.width, dx,
    margin, Math.max(margin + 1, viewport.width - margin), minimum.width);
  const availableWidth=Math.max(1,viewport.width-2*margin);
  const availableHeight=Math.max(1,viewport.height-2*margin);
  const proportionalHeight=clamp(horizontal.size*availableHeight/availableWidth,minimum.height,availableHeight);
  const vertical = moveFittedAxis(rect.y, rect.height, dy,
    margin, Math.max(margin + 1, viewport.height - margin), minimum.height,
    options.fitViewportAspect ? proportionalHeight : availableHeight/2);
  // Only automatic recovery changes the ratio. Free dragging/manual resizing
  // keep their visible dimensions and never restore a remembered rectangle.
  if(options.fitViewportAspect && horizontal.size>rect.width) {
    vertical.size=proportionalHeight;
    vertical.position=clamp(vertical.position,margin,viewport.height-margin-vertical.size);
  }
  return {
    x: horizontal.position, y: vertical.position,
    width: horizontal.size, height: vertical.size,
  };
}

function resizeRectFromEdge(rect, edge, dx, dy, options = {}) {
  const viewport = options.viewport ?? viewportSize();
  const margin = options.margin ?? VIEWPORT_MARGIN;
  const minimum = clampRect({ width: 0, height: 0 }, options);
  const next = { ...rect };
  if (edge === "left") {
    next.x = clamp(rect.x + dx, margin, rect.x + rect.width - minimum.width);
    next.width = rect.x + rect.width - next.x;
  } else if (edge === "right") {
    next.width = clamp(rect.width + dx, minimum.width, viewport.width - margin - rect.x);
  } else if (edge === "top") {
    next.y = clamp(rect.y + dy, margin, rect.y + rect.height - minimum.height);
    next.height = rect.y + rect.height - next.y;
  } else if (edge === "bottom") {
    next.height = clamp(rect.height + dy, minimum.height, viewport.height - margin - rect.y);
  }
  return next;
}

function initialRect(props) {
  const viewport = viewportSize();
  const width = finiteNumber(props.initialWidth, DEFAULT_WIDTH);
  const height = finiteNumber(props.initialHeight, DEFAULT_HEIGHT);

  return clampRect(
    {
      x: finiteNumber(props.initialX, (viewport.width - width) / 2),
      y: finiteNumber(props.initialY, (viewport.height - height) / 2),
      width,
      height,
    },
    {
      viewport,
      minWidth: props.minWidth,
      minHeight: props.minHeight,
    },
  );
}

function readStoredRect(storageKey) {
  try {
    const value = window.localStorage.getItem(storageKey);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function writeStoredRect(storageKey, rect) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(rect));
  } catch {
    // Storage may be unavailable in private browsing or by policy.
  }
}

export function FloatingWindow(props) {
  const generatedTitleId = createUniqueId();
  const titleId = () => props.titleId ?? generatedTitleId;
  const storageKey = () => props.storageKey ?? DEFAULT_STORAGE_KEY;
  const minWidth = () => finiteNumber(props.minWidth, DEFAULT_MIN_WIDTH);
  const minHeight = () => finiteNumber(props.minHeight, DEFAULT_MIN_HEIGHT);

  let windowElement;
  let dragState = null;
  let resizeState = null;
  let restoreRect = null;

  const [rect, setRect] = createSignal({
    x: VIEWPORT_MARGIN,
    y: VIEWPORT_MARGIN,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  });
  const [ready, setReady] = createSignal(false);
  const [minimized, setMinimized] = createSignal(false);
  const [maximized, setMaximized] = createSignal(false);

  const positionHeight = () => {
    if (!minimized()) return undefined;

    const measured = windowElement?.getBoundingClientRect().height;
    return Number.isFinite(measured) && measured > 0 && measured < rect().height
      ? measured
      : DEFAULT_MINIMIZED_HEIGHT;
  };

  const rectOptions = (viewport = viewportSize()) => ({
    viewport,
    fitViewportAspect: props.fitViewportAspect,
    minWidth: props.fitOnDrag
      ? Math.min(minWidth(), Math.max(1, (viewport.width - 2 * VIEWPORT_MARGIN) / 2))
      : minWidth(),
    minHeight: props.fitOnDrag
      ? Math.min(minHeight(), Math.max(1, (viewport.height - 2 * VIEWPORT_MARGIN) / 2))
      : minHeight(),
    positionHeight: positionHeight(),
  });

  const persistRect = (value = rect()) => {
    if (!maximized()) {
      writeStoredRect(storageKey(), value);
    }
    props.onRectChange?.(value);
  };

  const replaceRect = (value, persist = false) => {
    const next = clampRect(value, rectOptions());
    setRect(next);
    if (persist) persistRect(next);
    return next;
  };

  const moveVisibleRect = (dx, dy, persist = false) => {
    const next = moveFittedRect(rect(), dx, dy, rectOptions());
    setRect(next);
    if (persist) persistRect(next);
    return next;
  };

  const maximizeRect = () => {
    const viewport = viewportSize();
    return {
      x: VIEWPORT_MARGIN,
      y: VIEWPORT_MARGIN,
      width: Math.max(1, viewport.width - 2 * VIEWPORT_MARGIN),
      height: Math.max(1, viewport.height - 2 * VIEWPORT_MARGIN),
    };
  };

  const syncRectFromElement = (persist = true) => {
    if (
      !props.open ||
      !windowElement?.isConnected ||
      minimized() ||
      maximized()
    ) {
      return;
    }

    const bounds = windowElement.getBoundingClientRect();
    replaceRect(
      {
        x: bounds.left,
        y: bounds.top,
        width: bounds.width,
        height: bounds.height,
      },
      persist,
    );
  };

  const handleViewportResize = () => {
    if (maximized()) {
      setRect(maximizeRect());
      return;
    }
    replaceRect(rect(), true);
  };

  const finishPointerOperation = () => {
    const wasDragging = Boolean(dragState || resizeState);
    dragState = null;
    resizeState = null;
    if (wasDragging && props.fitOnDrag && !minimized()) {
      persistRect();
      return;
    }
    if (minimized()) {
      if (wasDragging) persistRect();
      return;
    }
    syncRectFromElement(true);
  };

  onMount(() => {
    const stored = readStoredRect(storageKey());
    // Older saved records may include a preferred rectangle. Only their visible
    // x/y/width/height are used, and the next save writes those four fields.
    replaceRect(stored ?? initialRect(props));
    setReady(true);

    window.addEventListener("resize", handleViewportResize);
    window.addEventListener("pointerup", finishPointerOperation);

    onCleanup(() => {
      window.removeEventListener("resize", handleViewportResize);
      window.removeEventListener("pointerup", finishPointerOperation);
    });
  });

  const handleTitlePointerDown = (event) => {
    if (
      event.button !== 0 ||
      dragState || resizeState ||
      (maximized() && !props.fitOnDrag) ||
      event.target.closest("button")
    ) {
      return;
    }

    syncRectFromElement(false);
    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      rect: { ...rect() },
      wasMaximized: maximized(),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handleTitlePointerMove = (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    if (dragState.wasMaximized) {
      if (dx === 0 && dy === 0) return;
      // A drag starts from the visible maximized size, not the old restore size.
      setMaximized(false);
      restoreRect = null;
      dragState.wasMaximized = false;
    }
    if (props.fitOnDrag && !minimized()) {
      moveVisibleRect(dx, dy);
      // Discard overshoot at a minimum size. Reversing the next mouse movement
      // expands immediately, without any invisible position or size to undo.
      dragState.startX = event.clientX;
      dragState.startY = event.clientY;
      return;
    }
    replaceRect({
      ...rect(),
      x: dragState.rect.x + dx,
      y: dragState.rect.y + dy,
    });
  };

  const handleTitlePointerUp = (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragState = null;
    persistRect();
  };

  const handleResizePointerDown = (event, edge) => {
    if (!props.fitOnDrag || minimized() || maximized() || event.button !== 0 ||
      dragState || resizeState) return;
    syncRectFromElement(false);
    resizeState = {
      pointerId: event.pointerId, edge,
      startX: event.clientX, startY: event.clientY, rect: { ...rect() },
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
    props.onActivate?.(event);
  };

  const handleResizePointerMove = (event) => {
    if (!resizeState || resizeState.pointerId !== event.pointerId) return;
    replaceRect(resizeRectFromEdge(resizeState.rect, resizeState.edge,
      event.clientX - resizeState.startX, event.clientY - resizeState.startY,
      rectOptions()));
  };

  const handleResizePointerUp = (event) => {
    if (!resizeState || resizeState.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resizeState = null;
    persistRect();
  };

  const handleTitleKeyDown = (event) => {
    if (event.target !== event.currentTarget) return;

    const offsets = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const offset = offsets[event.key];
    if (!offset || maximized()) return;

    event.preventDefault();
    const step = event.shiftKey ? 1 : 10;
    if (props.fitOnDrag && !minimized()) {
      moveVisibleRect(offset[0] * step, offset[1] * step, true);
      return;
    }
    replaceRect({ ...rect(), x: rect().x + offset[0] * step,
      y: rect().y + offset[1] * step }, true);
  };

  const toggleMinimized = () => {
    if (maximized()) return;
    setMinimized(!minimized());
    replaceRect(rect(), true);
  };

  const toggleMaximized = () => {
    const wasMinimized = minimized();
    setMinimized(false);

    if (maximized()) {
      setMaximized(false);
      replaceRect(restoreRect ?? initialRect(props), true);
      restoreRect = null;
      return;
    }

    if (!wasMinimized) syncRectFromElement(true);
    restoreRect = { ...rect() };
    setRect(maximizeRect());
    setMaximized(true);
  };

  const close = () => {
    syncRectFromElement(true);
    props.onClose?.();
  };

  return (
    <Show when={props.open && ready()}>
      <Portal>
        <div
          class="floating-window-layer"
          style={{ "z-index": props.zIndex }}
        >
          <section
            ref={(element) => (windowElement = element)}
            class={`floating-window${minimized() ? " is-minimized" : ""}${
              maximized() ? " is-maximized" : ""
            }${props.class ? ` ${props.class}` : ""}`}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId()}
            style={{
              left: `${rect().x}px`,
              top: `${rect().y}px`,
              width: `${rect().width}px`,
              height: `${rect().height}px`,
              "min-width": props.fitOnDrag
                ? `min(${minWidth()}px, calc(50vw - ${VIEWPORT_MARGIN}px))`
                : `min(${minWidth()}px, calc(100vw - ${2 * VIEWPORT_MARGIN}px))`,
              "min-height": minimized()
                ? "0"
                : props.fitOnDrag
                  ? `min(${minHeight()}px, calc(50vh - ${VIEWPORT_MARGIN}px))`
                  : `min(${minHeight()}px, calc(100vh - ${2 * VIEWPORT_MARGIN}px))`,
            }}
            onPointerDown={props.onActivate}
          >
            <header
              class="floating-window-titlebar"
              tabIndex="0"
              aria-label={`${props.title ?? "Окно"}. Перемещение стрелками`}
              onPointerDown={handleTitlePointerDown}
              onPointerMove={handleTitlePointerMove}
              onPointerUp={handleTitlePointerUp}
              onPointerCancel={finishPointerOperation}
              onLostPointerCapture={finishPointerOperation}
              onKeyDown={handleTitleKeyDown}
            >
              <div id={titleId()} class="floating-window-title">
                {props.title ?? "Окно"}
              </div>
              <div class="floating-window-actions">
                <button
                  type="button"
                  onClick={toggleMinimized}
                  disabled={maximized()}
                  title={minimized() ? "Развернуть окно" : "Свернуть окно"}
                  aria-label={minimized() ? "Развернуть окно" : "Свернуть окно"}
                >
                  {minimized() ? "□" : "−"}
                </button>
                <button
                  type="button"
                  onClick={toggleMaximized}
                  title={maximized() ? "Восстановить размер" : "На весь экран"}
                  aria-label={maximized() ? "Восстановить размер" : "На весь экран"}
                >
                  {maximized() ? "❐" : "□"}
                </button>
                <button
                  type="button"
                  class="floating-window-close"
                  onClick={close}
                  title="Закрыть окно"
                  aria-label="Закрыть окно"
                >
                  ×
                </button>
              </div>
            </header>

            <div class="floating-window-content" aria-hidden={minimized()}>
              {props.children}
            </div>
            <Show when={props.fitOnDrag && !minimized() && !maximized()}>
              {["top", "right", "bottom", "left"].map((edge) => (
                <div
                  class={`floating-window-resize-edge floating-window-resize-${edge}`}
                  aria-hidden="true"
                  onPointerDown={(event) => handleResizePointerDown(event, edge)}
                  onPointerMove={handleResizePointerMove}
                  onPointerUp={handleResizePointerUp}
                  onPointerCancel={finishPointerOperation}
                  onLostPointerCapture={finishPointerOperation}
                />
              ))}
            </Show>
          </section>
        </div>
      </Portal>
    </Show>
  );
}
