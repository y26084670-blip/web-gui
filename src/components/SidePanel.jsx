import { createEffect, onCleanup } from "solid-js";
import {
  COMPUTED_COLUMN_MODES,
} from "../services/viewSettingsService";
import "./SidePanel.css";

const VISIBILITY_OPTIONS = Object.freeze([
  {
    value: COMPUTED_COLUMN_MODES.SCHEMA,
    label: "По схеме",
    title: "Восстановить видимость, заданную схемой",
  },
  {
    value: COMPUTED_COLUMN_MODES.SHOW,
    label: "Показать",
    title: "Показать все вычисляемые колонки",
  },
  {
    value: COMPUTED_COLUMN_MODES.HIDE,
    label: "Скрыть",
    title: "Скрыть все вычисляемые колонки",
  },
]);

export function SidePanel(props) {
  let closeButton;

  createEffect(() => {
    if (!props.open) return;

    closeButton?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        props.onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  return (
    <>
      <div
        classList={{
          "side-panel-backdrop": true,
          open: props.open,
        }}
        aria-hidden="true"
        onClick={props.onClose}
      />

      <aside
        classList={{
          "side-panel": true,
          open: props.open,
        }}
        aria-hidden={!props.open}
        aria-label="Дополнительные функции"
      >
        <div class="side-panel-header">
          <div class="side-panel-title">Дополнительные функции</div>
          <button
            class="side-panel-close"
            ref={(element) => (closeButton = element)}
            disabled={!props.open}
            onClick={props.onClose}
            title="Закрыть"
            aria-label="Закрыть дополнительные функции"
          >
            ×
          </button>
        </div>

        <section class="side-panel-section">
          <div
            class="side-panel-section-title"
            title={
              "вторичные колонки, зависимые от значений пользовательских "
              + "редактируемых колонок"
            }
          >
            Вычисляемые колонки
          </div>

          <div
            class="side-panel-options"
            role="group"
            aria-label="Видимость вычисляемых колонок"
          >
            {VISIBILITY_OPTIONS.map((option) => (
              <button
                classList={{
                  "side-panel-option": true,
                  active:
                    props.computedColumnsMode === option.value,
                }}
                disabled={!props.open}
                aria-pressed={
                  props.computedColumnsMode === option.value
                }
                title={option.title}
                onClick={() =>
                  props.onComputedColumnsModeChange?.(
                    option.value,
                  )
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        {props.materialActionVisible && (
          <>
            <hr class="side-panel-separator" />
            <section class="side-panel-section">
              <div class="side-panel-section-title">
                Элементы модели
              </div>
              <div class="side-panel-options">
                <button
                  class="side-panel-option"
                  disabled={!props.open || !props.materialActionEnabled}
                  onClick={props.onChooseMaterial}
                  title={
                    "Выбрать элементы в списке, нажать кнопку и выбрать "
                    + "характеристику в появившемся диалоге"
                  }
                >
                  Выбрать характеристику
                </button>
                <button
                  class="side-panel-option"
                  disabled={!props.open || !props.materialActionEnabled}
                  onClick={props.onMakeNonmagnetic}
                  title="Очистить имя характеристики у выделенных элементов"
                >
                  Сделать немагнитными
                </button>
              </div>
            </section>
          </>
        )}

        <hr class="side-panel-separator" />

        <section class="side-panel-section side-panel-history">
          <div class="side-panel-section-title">
            История текущей вкладки
          </div>
          <div class="side-panel-history-tab">
            {props.historyEnabled
              ? props.historyTabLabel
              : "Для этой вкладки история не ведётся"}
          </div>

          <div class="side-panel-history-actions">
            <button
              class="side-panel-option"
              disabled={
                !props.open ||
                !props.historyEnabled ||
                !props.canUndo
              }
              onClick={props.onUndo}
              title="Отменить последнее изменение текущей вкладки"
            >
              ↶ Отменить
            </button>
            <button
              class="side-panel-option"
              disabled={
                !props.open ||
                !props.historyEnabled ||
                !props.canRedo
              }
              onClick={props.onRedo}
              title="Повторить отменённое изменение текущей вкладки"
            >
              ↷ Повторить
            </button>
          </div>
        </section>
      </aside>
    </>
  );
}
