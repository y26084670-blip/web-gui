import {
  createEffect,
  createSignal,
  onCleanup,
  Show,
} from "solid-js";

import {
  recordGraphConfig,
  recordGraphModeForProperty,
} from "../../services/graphs/recordGraphModel.js";
import "./RecordGraphRegion.css";

export function RecordGraphRegion(props) {
  const descriptor = props.schema.views.graph;
  const [graphError, setGraphError] = createSignal("");
  let canvas;
  let chart;
  let renderRevision = 0;

  function currentMode() {
    return recordGraphModeForProperty(props.schema, props.field);
  }

  function graphHint() {
    if (!props.field) return "Откройте таблицу детализации";
    if (!currentMode()) return "Для текущей таблицы график не предусмотрен";
    if ((props.records?.length ?? 0) === 0) {
      return "Выберите записи в основной таблице";
    }
    return "";
  }

  createEffect(() => {
    const records = props.records ?? [];
    const mode = currentMode();
    const revision = ++renderRevision;
    chart?.destroy();
    chart = null;
    setGraphError("");
    if (!canvas || records.length === 0 || !mode) return;

    void import("chart.js/auto").then(({ default: Chart }) => {
      if (revision !== renderRevision || !canvas) return;
      chart = new Chart(
        canvas,
        recordGraphConfig(props.schema, records, mode.value),
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
        <div class="record-graph-region-title">
          {descriptor.title}
          {currentMode()?.label ? ` — ${currentMode().label}` : ""}
        </div>
      </div>
      <div class="record-graph-region-host">
        <canvas ref={(element) => (canvas = element)} />
        <Show when={graphHint()}>
          <div class="record-graph-region-hint">
            {graphHint()}
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
