import { Show, For } from "solid-js";
import { diagnosticService } from "../../services/diagnosticService";
import { VALIDATION_LEVELS } from "../../services/schemas/common/constants";
import "./DiagnosticPopup.css";

const LEVEL_LABELS = {
  [VALIDATION_LEVELS.ERROR]: "ERROR",
  [VALIDATION_LEVELS.WARNING]: "WARNING",
  [VALIDATION_LEVELS.SUCCESS]: "SUCCESS",
  [VALIDATION_LEVELS.UNKNOWN]: "UNKNOWN",
};

export function DiagnosticPopup(props) {
  function displayValue(value) {
    if (value === undefined || value === null) {
      return "";
    }

    if (typeof value === "object") {
      return value.label ?? value.title ?? value.id ?? "";
    }

    return value;
  }
  return (
    <Show when={props.open()}>
      <div class="diagnostic-popup">
        <div class="diagnostic-title">Диагностика модели</div>

        <For each={diagnosticService.diagnostics()}>
          {(diagnostic) => (
            <div
              class="diagnostic-item"
              classList={{
                "diagnostic-item-selectable": Boolean(diagnostic?.tab?.id),
              }}
              onClick={() => {
                if (diagnostic?.tab?.id) {
                  props.onSelect?.(diagnostic);
                }
              }}
            >
              <div class={`diagnostic-level level-${diagnostic.level}`}>
                {LEVEL_LABELS[diagnostic.level]}
              </div>
              <div class="diagnostic-message">{diagnostic.message}</div>
              <div class="diagnostic-source">
                {diagnostic.tab && (
                  <span>Вкладка: {displayValue(diagnostic.tab)}</span>
                )}

                {diagnostic.row !== undefined && (
                  <span>Строка: {diagnostic.row}</span>
                )}

                {diagnostic.property && (
                  <span>
                    Поле:{" "}
                    {typeof diagnostic.property === "object"
                      ? (diagnostic.property.title ?? diagnostic.property.id)
                      : diagnostic.property}
                  </span>
                )}
              </div>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}
