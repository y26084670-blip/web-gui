import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";

import { recordGraphConfig } from "../../services/graphs/recordGraphModel.js";
import "./RecordGraphRegion.css";

export function RecordGraphRegion(props) {
  const descriptor = props.schema.views.graph;
  const [mode, setMode] = createSignal(descriptor.defaultMode);
  const [graphError, setGraphError] = createSignal("");
  let canvas;
  let chart;
  let renderRevision = 0;

  createEffect(() => {
    const records = props.records ?? [];
    const modeValue = mode();
    const revision = ++renderRevision;
    chart?.destroy();
    chart = null;
    setGraphError("");
    if (!canvas || records.length === 0) return;

    void import("chart.js/auto").then(({ default: Chart }) => {
      if (revision !== renderRevision || !canvas) return;
      chart = new Chart(
        canvas,
        recordGraphConfig(props.schema, records, modeValue),
      );
    }).catch((error) => {
      if (revision !== renderRevision) return;
      console.error(`${props.schema.id} graph creation error:`, error);
      setGraphError(error instanceof Error ? error.message : String(error));
    });
  });

  onCleanup(() => {
    renderRevision += 1;
    chart?.destroy();
    chart = null;
  });

  return (
    <section
      class="record-graph-region"
      aria-label={descriptor.title}
    >
      <div class="record-graph-region-header">
        <div class="record-graph-region-title">{descriptor.title}</div>
        <Show when={descriptor.modes.length > 1}>
          <div
            class="record-graph-mode-switch"
            role="group"
            aria-label={descriptor.selectorLabel ?? "Режим графика"}
          >
            <span>{descriptor.selectorLabel ?? "Показ"}</span>
            <For each={descriptor.modes}>
              {(item) => (
                <button
                  type="button"
                  classList={{ active: mode() === item.value }}
                  aria-pressed={mode() === item.value}
                  onClick={() => setMode(item.value)}
                >
                  {item.label}
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
      <div class="record-graph-region-host">
        <canvas ref={(element) => (canvas = element)} />
        <Show when={(props.records?.length ?? 0) === 0}>
          <div class="record-graph-region-hint">
            Выберите записи в таблице
          </div>
        </Show>
        <Show when={graphError()}>
          <div class="record-graph-region-error" role="alert">
            График не построен: {graphError()}
          </div>
        </Show>
      </div>
    </section>
  );
}
