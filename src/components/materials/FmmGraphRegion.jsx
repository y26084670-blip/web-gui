import {
  createEffect,
  createSignal,
  onCleanup,
  Show,
} from "solid-js";

import { GraphContextMenu } from "../graphs/GraphContextMenu.jsx";
import {
  createDetailTableBlock,
} from "../../services/graphs/graphClipboard.js";
import { fmmGraphConfig } from "../../services/materials/fmmGraphModel.js";

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}
export function FmmGraphRegion(props) {
  const [graphError, setGraphError] = createSignal("");
  const [copyError, setCopyError] = createSignal("");
  const [menuPosition, setMenuPosition] = createSignal(null);
  let canvas;
  let chart;
  let renderRevision = 0;

  function tableBlocks() {
    const property = props.property;
    if (!property) return [];

    return (props.records ?? []).map((record, index) => {
      const name = record?.name || record?.rowLabel || index + 1;
      return createDetailTableBlock({
        title: `${property.label ?? "Таблица H–M"} — ${name}`,
        property,
        rows: record?.tabl,
      });
    });
  }

  function openContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    setCopyError("");
    setMenuPosition({ x: event.clientX, y: event.clientY });
  }

  createEffect(() => {
    const records = props.records ?? [];
    const revision = ++renderRevision;
    chart?.destroy();
    chart = null;
    setGraphError("");
    setCopyError("");
    setMenuPosition(null);
    if (!canvas || records.length === 0) return;

    void import("chart.js/auto").then(({ default: Chart }) => {
      if (revision !== renderRevision || !canvas) return;
      chart = new Chart(canvas, fmmGraphConfig(records));
    }).catch((error) => {
      if (revision !== renderRevision) return;
      console.error("FMM graph creation error:", error);
      setGraphError(errorText(error));
    });
  });

  onCleanup(() => {
    renderRevision += 1;
    chart?.destroy();
    chart = null;
  });

  return (
    <section
      class="fmm-graph-region"
      aria-label="Область графиков характеристик ФММ"
      onContextMenu={openContextMenu}
    >
      <div class="fmm-graph-region-title">
        Графики характеристик ФММ
      </div>
      <div class="fmm-graph-region-host">
        <canvas ref={(element) => (canvas = element)} />
        <Show when={(props.records?.length ?? 0) === 0}>
          <div class="fmm-graph-region-hint">
            Выберите характеристики в таблице
          </div>
        </Show>
        <Show when={graphError()}>
          <div class="fmm-graph-region-hint" role="alert">
            График не построен: {graphError()}
          </div>
        </Show>
        <Show when={copyError()}>
          <div class="fmm-graph-region-hint" role="alert">
            Копирование не выполнено: {copyError()}
          </div>
        </Show>
      </div>
      <GraphContextMenu
        position={menuPosition()}
        onClose={() => setMenuPosition(null)}
        onError={error => setCopyError(errorText(error))}
        getTables={tableBlocks}
        getCanvas={() => canvas}
        hasImage={() => Boolean(chart)}
        imageBackground="#20262d"
      />
    </section>
  );
}
