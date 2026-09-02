import {
  onCleanup,
  onMount,
  Show,
} from "solid-js";

import {
  copyGraphImage,
  copyGraphTables,
} from "../../services/graphs/graphClipboard.js";
import "./GraphContextMenu.css";

function reportError(callback, error) {
  callback?.(
    error instanceof Error ? error : new Error(String(error)),
  );
}
export function GraphContextMenu(props) {
  function close() {
    props.onClose?.();
  }

  function handleWindowKeyDown(event) {
    if (event.key === "Escape") close();
  }

  onMount(() => {
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    window.addEventListener("keydown", handleWindowKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("pointerdown", close);
    window.removeEventListener("blur", close);
    window.removeEventListener("keydown", handleWindowKeyDown);
  });

  function run(action) {
    return (event) => {
      event.preventDefault();
      event.stopPropagation();
      close();

      try {
        void Promise.resolve(action()).catch(
          error => reportError(props.onError, error),
        );
      } catch (error) {
        reportError(props.onError, error);
      }
    };
  }

  function tables() {
    return props.getTables?.() ?? [];
  }

  function canCopyTable() {
    return tables().length > 0;
  }

  function canCopyImage() {
    return props.hasImage?.() ?? Boolean(props.getCanvas?.());
  }

  return (
    <Show when={props.position}>
      <div
        class="graph-context-menu"
        role="menu"
        aria-label="Копирование графика"
        style={{
          left: `${props.position.x}px`,
          top: `${props.position.y}px`,
        }}
        onPointerDown={event => event.stopPropagation()}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <button
          type="button"
          role="menuitem"
          disabled={!canCopyTable()}
          onClick={run(() => copyGraphTables(tables()))}
        >
          Копировать таблицу
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={!canCopyImage()}
          onClick={run(() => copyGraphImage(
            props.getCanvas?.(),
            { background: props.imageBackground },
          ))}
        >
          Копировать картинку
        </button>
      </div>
    </Show>
  );
}
