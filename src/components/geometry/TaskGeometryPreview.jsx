import { Show, createEffect, createSignal, onCleanup } from "solid-js";

import { loadTaskGeometryPreview } from "../../services/taskGeometryPreviewService.js";
import { buildGeometryScene } from "../../services/visualization/geometrySceneModel.js";
import { ThreeGeometryViewport } from "./ThreeGeometryViewport.jsx";
import "./GeometryViewerWindow.css";

const ORIGINAL_OBJECT_FILTERS = Object.freeze({
  objectModes: Object.freeze({
    elements: "all",
    regions: "all",
  }),
  selections: Object.freeze({
    elements: Object.freeze([]),
    regions: Object.freeze([]),
  }),
  symmetry: Object.freeze({
    axial: false,
    local: false,
    mirror: false,
    periodic: false,
  }),
});

export function TaskGeometryPreview(props) {
  const [scene, setScene] = createSignal(null);
  const [loading, setLoading] = createSignal(false);
  const [message, setMessage] = createSignal("Выберите задание для просмотра");
  let loadRevision = 0;

  createEffect(() => {
    const taskHandle = props.taskHandle;
    const active = props.active !== false;
    const revision = ++loadRevision;

    setScene(null);
    setLoading(false);
    setMessage(taskHandle ? "" : "Выберите задание для просмотра");
    if (!taskHandle || !active) return;

    setLoading(true);
    void loadTaskGeometryPreview(taskHandle)
      .then((result) => {
        if (revision !== loadRevision) return;
        setLoading(false);

        if (!result.currentFormat || !result.model) {
          setMessage("Не содержит данных актуального формата");
          return;
        }

        const nextScene = buildGeometryScene(result.model);
        setScene(nextScene);
        setMessage(
          nextScene.primitives.length === 0
            ? "Нет геометрии для предварительного просмотра"
            : "",
        );
      })
      .catch((error) => {
        if (revision !== loadRevision) return;
        console.error("Ошибка предварительного просмотра задания:", error);
        setLoading(false);
        setMessage("Не удалось подготовить предварительный просмотр");
      });
  });

  onCleanup(() => {
    loadRevision += 1;
  });

  return (
    <section
      class="task-geometry-preview"
      aria-label="Предварительный просмотр геометрии выбранного задания"
      aria-busy={loading()}
    >
      <Show when={scene()} keyed>
        {(sceneModel) => (
          <ThreeGeometryViewport
            scene={sceneModel}
            filters={ORIGINAL_OBJECT_FILTERS}
            mode="solid"
            showEdges={true}
            showVertices={false}
            showDiscretizationLines={false}
            showCentersAndNodes={false}
            projection="orthographic"
            autoFit={true}
          />
        )}
      </Show>
      <Show when={loading()}>
        <div class="task-geometry-preview-overlay">Загрузка геометрии…</div>
      </Show>
      <Show when={!loading() && message()} keyed>
        {(text) => <div class="task-geometry-preview-overlay">{text}</div>}
      </Show>
    </section>
  );
}
