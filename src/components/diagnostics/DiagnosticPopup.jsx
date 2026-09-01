import { Show, For } from "solid-js";
import { diagnosticService } from "../../services/diagnosticService";
import {
  TABS,
  VALIDATION_LEVELS,
} from "../../services/schemas/common/constants";
import { tabRegistry } from "../../services/tabRegistry";
import { materialTabRegistry } from "../../services/materialTabRegistry";
import "./DiagnosticPopup.css";

const LEVEL_LABELS = {
  [VALIDATION_LEVELS.ERROR]: "ERROR",
  [VALIDATION_LEVELS.WARNING]: "WARNING",
  [VALIDATION_LEVELS.SUCCESS]: "SUCCESS",
  [VALIDATION_LEVELS.UNKNOWN]: "UNKNOWN",
};

const SCHEMAS_BY_TAB_ID = new Map([
  ...tabRegistry.map((schema) => [schema.id, schema]),
  ...materialTabRegistry.map((definition) => [
    definition.id,
    definition.schema,
  ]),
]);

function nonEmptyLabel(value) {
  return typeof value === "string" && value.trim() !== ""
    ? value
    : null;
}

function diagnosticPropertyLabel(diagnostic) {
  const property = diagnostic?.property;

  if (property && typeof property === "object") {
    const objectLabel = nonEmptyLabel(property.label)
      ?? nonEmptyLabel(property.title);
    if (objectLabel) return objectLabel;
  }

  const propertyId = typeof property === "string"
    ? property
    : property?.id;
  const tabId = typeof diagnostic?.tab === "string"
    ? diagnostic.tab
    : diagnostic?.tab?.id;
  const schema = SCHEMAS_BY_TAB_ID.get(tabId);

  if (!schema || !nonEmptyLabel(propertyId)) return null;

  return nonEmptyLabel(schema.properties?.[propertyId]?.label)
    ?? nonEmptyLabel(schema.views?.references?.[propertyId]?.label);
}

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

  function diagnosticSourceLabel(diagnostic) {
    if (
      diagnostic?.row === undefined
      || diagnostic?.row === null
    ) {
      return null;
    }

    if (diagnostic.tab?.id === TABS.ELEMENTS.id) {
      return `Элемент №${diagnostic.row}`;
    }

    if (diagnostic.tab?.id === TABS.REGIONS.id) {
      return `Область №${diagnostic.row}`;
    }

    return `Строка №${diagnostic.row}`;
  }

  return (
    <Show when={props.open()}>
      <div class="diagnostic-popup">
        <div class="diagnostic-title">Диагностика модели</div>

        <div class="diagnostic-list">
          <For each={diagnosticService.diagnostics()}>
            {(diagnostic) => (
              <div class="diagnostic-item">
                <div class={`diagnostic-level level-${diagnostic.level}`}>
                  {LEVEL_LABELS[diagnostic.level]}
                </div>
                <div class="diagnostic-message">{diagnostic.message}</div>
                <div class="diagnostic-source">
                  {diagnostic.tab && (
                    <span>Вкладка: {displayValue(diagnostic.tab)}</span>
                  )}

                  <Show when={diagnosticSourceLabel(diagnostic)}>
                    {(label) => <span>{label()}</span>}
                  </Show>

                  <Show when={diagnosticPropertyLabel(diagnostic)}>
                    {(label) => <span>Поле: {label()}</span>}
                  </Show>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
}
