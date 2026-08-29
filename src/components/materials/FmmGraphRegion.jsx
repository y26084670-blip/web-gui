import { createEffect, onCleanup } from "solid-js";

import { fmmGraphConfig } from "../../services/materials/fmmGraphModel.js";

export function FmmGraphRegion(props) {
  let canvas;
  let chart;
  let renderRevision = 0;

  createEffect(() => {
    const records = props.records ?? [];
    const revision = ++renderRevision;
    chart?.destroy();
    chart = null;
    if (!canvas || records.length === 0) return;
    void import("chart.js/auto").then(({ default: Chart }) => {
      if (revision !== renderRevision || !canvas) return;
      chart = new Chart(canvas, fmmGraphConfig(records));
    }).catch((error) => {
      console.error("FMM graph creation error:", error);
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
    >
      <div class="fmm-graph-region-title">
        Графики характеристик ФММ
      </div>
      <div class="fmm-graph-region-host">
        <canvas ref={(element) => (canvas = element)} />
        {(props.records?.length ?? 0) === 0 && (
          <div class="fmm-graph-region-hint">
            Выберите характеристики в таблице
          </div>
        )}
      </div>
    </section>
  );
}
