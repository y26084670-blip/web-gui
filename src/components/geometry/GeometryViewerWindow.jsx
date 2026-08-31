import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
} from "solid-js";

import { buildGeometryScene } from "../../services/visualization/geometrySceneModel.js";
import { FloatingWindow } from "../window/FloatingWindow.jsx";
import {
  GEOMETRY_INSTANCE_BUDGET,
  ThreeGeometryViewport,
} from "./ThreeGeometryViewport.jsx";
import "./GeometryViewerWindow.css";

const EMPTY_COUNTS = Object.freeze({
  elements: 0,
  regions: 0,
  primitives: 0,
  instances: 0,
  vertices: 0,
  triangles: 0,
  lines: 0,
  skipped: 0,
});

const EMPTY_RENDER_STATS = Object.freeze({
  renderedInstances: 0,
  renderedPrimitives: 0,
  selectedInstances: 0,
  truncated: false,
});

function diagnosticMessage(diagnostic) {
  if (typeof diagnostic === "string") return diagnostic;
  return diagnostic?.message ?? diagnostic?.code ?? String(diagnostic);
}

function diagnosticLevel(diagnostic) {
  const value = diagnostic?.level ?? diagnostic?.severity ?? "warning";
  return String(value).toLowerCase();
}

export function GeometryViewerWindow(props) {
  const [sceneModel, setSceneModel] = createSignal(null);
  const [sceneError, setSceneError] = createSignal("");
  const [viewportError, setViewportError] = createSignal("");
  const [fitRequest, setFitRequest] = createSignal(0);
  const [mode, setMode] = createSignal("surfaces");
  const [showElements, setShowElements] = createSignal(true);
  const [showRegions, setShowRegions] = createSignal(true);
  const [showBase, setShowBase] = createSignal(true);
  const [showCopies, setShowCopies] = createSignal(true);
  const [showMirrors, setShowMirrors] = createSignal(true);
  const [renderStats, setRenderStats] = createSignal(EMPTY_RENDER_STATS);

  const filters = createMemo(() => ({
    base: showBase(),
    copies: showCopies(),
    elements: showElements(),
    mirrors: showMirrors(),
    regions: showRegions(),
  }));

  const counts = () => sceneModel()?.counts ?? EMPTY_COUNTS;
  const diagnostics = () => sceneModel()?.diagnostics ?? [];

  createEffect(() => {
    const open = props.open;
    if (!open) {
      setSceneModel(null);
      setSceneError("");
      setViewportError("");
      setRenderStats(EMPTY_RENDER_STATS);
      return;
    }

    const model = props.model;
    setViewportError("");
    setRenderStats(EMPTY_RENDER_STATS);

    try {
      setSceneModel(buildGeometryScene(model));
      setSceneError("");
    } catch (error) {
      setSceneModel(null);
      setSceneError(error instanceof Error ? error.message : String(error));
    }
  });

  return (
    <FloatingWindow
      open={props.open}
      title="3D-геометрия"
      onClose={props.onClose}
      class="geometry-viewer-floating-window"
      storageKey="web-gui:geometry-viewer-window"
      initialWidth={920}
      initialHeight={680}
      minWidth={520}
      minHeight={360}
    >
      <section class="geometry-viewer-window">
        <div
          class="geometry-viewer-toolbar"
          role="toolbar"
          aria-label="Управление 3D-окном"
        >
          <fieldset class="geometry-viewer-filter-group">
            <legend>Объекты</legend>
            <label title="Показать геометрию элементов">
              <input
                type="checkbox"
                checked={showElements()}
                onChange={(event) => setShowElements(event.currentTarget.checked)}
              />
              Элементы
            </label>
            <label title="Показать геометрию областей">
              <input
                type="checkbox"
                checked={showRegions()}
                onChange={(event) => setShowRegions(event.currentTarget.checked)}
              />
              Области
            </label>
          </fieldset>

          <fieldset class="geometry-viewer-filter-group">
            <legend>Симметрии</legend>
            <label title="Показать исходные объекты">
              <input
                type="checkbox"
                checked={showBase()}
                onChange={(event) => setShowBase(event.currentTarget.checked)}
              />
              Исходные
            </label>
            <label title="Показать образы LS, AS и PS">
              <input
                type="checkbox"
                checked={showCopies()}
                onChange={(event) => setShowCopies(event.currentTarget.checked)}
              />
              Образы
            </label>
            <label title="Показать зеркальные образы">
              <input
                type="checkbox"
                checked={showMirrors()}
                onChange={(event) => setShowMirrors(event.currentTarget.checked)}
              />
              Зеркала
            </label>
          </fieldset>

          <div
            class="geometry-viewer-mode-group"
            role="group"
            aria-label="Режим представления"
          >
            <button
              type="button"
              classList={{ active: mode() === "surfaces" }}
              aria-pressed={mode() === "surfaces"}
              title="Показывать поверхности"
              onClick={() => setMode("surfaces")}
            >
              Поверхности
            </button>
            <button
              type="button"
              classList={{ active: mode() === "wireframe" }}
              aria-pressed={mode() === "wireframe"}
              title="Показывать каркас"
              onClick={() => setMode("wireframe")}
            >
              Каркас
            </button>
          </div>

          <button
            type="button"
            class="geometry-viewer-fit"
            title="Вписать показанную геометрию в окно"
            onClick={() => setFitRequest((value) => value + 1)}
          >
            Вписать всё
          </button>
        </div>

        <div class="geometry-viewer-canvas-region">
          <ThreeGeometryViewport
            scene={sceneModel()}
            filters={filters()}
            mode={mode()}
            fitRequest={fitRequest()}
            instanceBudget={GEOMETRY_INSTANCE_BUDGET}
            onRenderStats={setRenderStats}
            onError={setViewportError}
          />
          <Show when={renderStats().truncated}>
            <div class="geometry-viewer-budget-warning" role="status">
              Показаны первые {renderStats().renderedInstances} экземпляров из
              {" "}{renderStats().selectedInstances}. Измените набор слоёв.
            </div>
          </Show>
        </div>

        <Show when={sceneError() || viewportError()}>
          <div class="geometry-viewer-error" role="alert">
            {sceneError() || viewportError()}
          </div>
        </Show>

        <div class="geometry-viewer-summary" aria-live="polite">
          <span>Элементы: {counts().elements}</span>
          <span>Области: {counts().regions}</span>
          <span>Примитивы: {counts().primitives}</span>
          <span>
            Показано экземпляров: {renderStats().renderedInstances}
            {" / "}{counts().instances}
          </span>
          <Show when={counts().skipped > 0}>
            <span class="geometry-viewer-skipped">
              Пропущено: {counts().skipped}
            </span>
          </Show>
        </div>

        <Show when={diagnostics().length > 0}>
          <details class="geometry-viewer-diagnostics">
            <summary>Диагностика геометрии ({diagnostics().length})</summary>
            <ul>
              <For each={diagnostics()}>
                {(diagnostic) => (
                  <li class={`is-${diagnosticLevel(diagnostic)}`}>
                    {diagnosticMessage(diagnostic)}
                  </li>
                )}
              </For>
            </ul>
          </details>
        </Show>
      </section>
    </FloatingWindow>
  );
}
