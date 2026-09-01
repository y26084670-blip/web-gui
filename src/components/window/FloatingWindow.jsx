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

  const rectOptions = (viewport) => ({
    viewport,
    minWidth: minWidth(),
    minHeight: minHeight(),
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
    const wasDragging = Boolean(dragState);
    dragState = null;
    if (minimized()) {
      if (wasDragging) persistRect();
      return;
    }
    syncRectFromElement(true);
  };

  onMount(() => {
    const stored = readStoredRect(storageKey());
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
      maximized() ||
      event.target.closest("button")
    ) {
      return;
    }

    syncRectFromElement(false);
    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: rect().x,
      y: rect().y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handleTitlePointerMove = (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const current = rect();
    replaceRect({
      ...current,
      x: dragState.x + event.clientX - dragState.startX,
      y: dragState.y + event.clientY - dragState.startY,
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
    const current = rect();
    replaceRect(
      {
        ...current,
        x: current.x + offset[0] * step,
        y: current.y + offset[1] * step,
      },
      true,
    );
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
    restoreRect = rect();
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
              "min-width": `min(${minWidth()}px, calc(100vw - ${2 * VIEWPORT_MARGIN}px))`,
              "min-height": minimized()
                ? "0"
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
          </section>
        </div>
      </Portal>
    </Show>
  );
}
