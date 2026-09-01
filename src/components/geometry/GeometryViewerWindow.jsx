import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
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
  discretizationLineSegments: 0,
  discretizationPoints: 0,
  discretizationTruncated: false,
  renderedInstances: 0,
  renderedPrimitives: 0,
  selectedInstances: 0,
  truncated: false,
});

const DIAGNOSTIC_REASONS = Object.freeze({
  "instance-budget-exceeded": "превышен лимит образов",
  "invalid-geometry": "некорректная или вырожденная геометрия",
  "invalid-discretization": "слой дискретизации недоступен",
  "invalid-symmetry": "некорректное число образов симметрии",
  "invalid-transform": "некорректное преобразование",
  "scene-conversion-failed": "ошибка преобразования геометрии",
  "unsupported-geometry": "неизвестный тип геометрии",
});

const OBJECT_MODE_LABELS = Object.freeze({
  all: "все",
  none: "не показывать",
  selected: "выделенные",
});

const OPTIONS_PANEL_ID = "geometry-viewer-options-panel";

function diagnosticDetail(diagnostic) {
  if (typeof diagnostic === "string") return diagnostic;
  return diagnostic?.message ?? diagnostic?.code ?? String(diagnostic);
}

function diagnosticMessage(diagnostic) {
  const message = DIAGNOSTIC_REASONS[diagnostic?.code] ??
    diagnosticDetail(diagnostic);
  const recordIndex = Number(diagnostic?.recordIndex);
  const sourceLabel = diagnostic?.schemaId === "elements"
    ? "Элемент"
    : diagnostic?.schemaId === "regions"
      ? "Область"
      : "";

  return sourceLabel && Number.isInteger(recordIndex) && recordIndex >= 0
    ? `${sourceLabel} №${recordIndex + 1} — ${message}`
    : message;
}

function diagnosticLevel(diagnostic) {
  const value = diagnostic?.level ?? diagnostic?.severity ?? "warning";
  return String(value).toLowerCase();
}

export function GeometryViewerWindow(props) {
  let viewerElement;
  let toolbarElement;
  let optionsPanelElement;
  let activePanelButton;
  let viewerResizeObserver;

  const [sceneModel, setSceneModel] = createSignal(null);
  const [sceneError, setSceneError] = createSignal("");
  const [viewportError, setViewportError] = createSignal("");
  const [fitRequest, setFitRequest] = createSignal(0);
  const [renderMode, setRenderMode] = createSignal("solid");
  const [orthographicView, setOrthographicView] = createSignal(true);
  const [showEdges, setShowEdges] = createSignal(true);
  const [showVertices, setShowVertices] = createSignal(false);
  const [showDiscretizationLines, setShowDiscretizationLines] =
    createSignal(false);
  const [showCentersAndNodes, setShowCentersAndNodes] = createSignal(false);
  const [elementsMode, setElementsMode] = createSignal("all");
  const [regionsMode, setRegionsMode] = createSignal("all");
  const [showLocalSymmetry, setShowLocalSymmetry] = createSignal(true);
  const [showAxialSymmetry, setShowAxialSymmetry] = createSignal(true);
  const [showPeriodicSymmetry, setShowPeriodicSymmetry] = createSignal(true);
  const [showMirrorSymmetry, setShowMirrorSymmetry] = createSignal(true);
  const [openPanel, setOpenPanel] = createSignal(null);
  const [panelPosition, setPanelPosition] = createSignal({ left: 8, top: 40 });
  const [renderStats, setRenderStats] = createSignal(EMPTY_RENDER_STATS);

  const filters = createMemo(() => ({
    objectModes: {
      elements: elementsMode(),
      regions: regionsMode(),
    },
    selections: {
      elements: new Set(props.selections?.elements ?? []),
      regions: new Set(props.selections?.regions ?? []),
    },
    symmetry: {
      axial: showAxialSymmetry(),
      local: showLocalSymmetry(),
      mirror: showMirrorSymmetry(),
      periodic: showPeriodicSymmetry(),
    },
  }));

  const counts = () => sceneModel()?.counts ?? EMPTY_COUNTS;
  const diagnostics = () => sceneModel()?.diagnostics ?? [];
  const budgetWarning = () => {
    const stats = renderStats();
    const messages = [];
    if (stats.truncated) {
      messages.push(
        `Показаны первые ${stats.renderedInstances} экземпляров из ` +
        `${stats.selectedInstances}. Измените режимы показа.`,
      );
    }
    if (stats.discretizationTruncated) {
      messages.push(
        "Часть линий дискретизации или точек скрыта из-за ограничения " +
        "объёма 3D-сцены.",
      );
    }
    return messages.join(" ");
  };

  const updatePanelPosition = () => {
    if (!openPanel() || !viewerElement || !activePanelButton) return;

    const viewerBounds = viewerElement.getBoundingClientRect();
    const buttonBounds = activePanelButton.getBoundingClientRect();
    const toolbarBounds = toolbarElement?.getBoundingClientRect();
    const panelWidth = optionsPanelElement?.offsetWidth ?? 248;
    const maximumLeft = Math.max(8, viewerBounds.width - panelWidth - 8);
    setPanelPosition({
      left: Math.min(
        Math.max(buttonBounds.left - viewerBounds.left, 8),
        maximumLeft,
      ),
      top: Math.max(
        (toolbarBounds?.bottom ?? buttonBounds.bottom) - viewerBounds.top + 4,
        4,
      ),
    });
  };

  const setViewerElement = (element) => {
    viewerResizeObserver?.disconnect();
    viewerElement = element;
    if (!element || typeof ResizeObserver !== "function") return;

    viewerResizeObserver = new ResizeObserver(updatePanelPosition);
    viewerResizeObserver.observe(element);
  };

  const togglePanel = (name, event) => {
    if (openPanel() === name) {
      setOpenPanel(null);
      return;
    }

    activePanelButton = event.currentTarget;
    setOpenPanel(name);
    queueMicrotask(updatePanelPosition);
  };

  const closePanel = (restoreFocus = false) => {
    setOpenPanel(null);
    if (restoreFocus) activePanelButton?.focus();
  };

  const handlePanelKeyDown = (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closePanel(true);
  };

  onCleanup(() => viewerResizeObserver?.disconnect());

  createEffect(() => {
    const open = props.open;
    if (!open) {
      setOpenPanel(null);
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
      storageKey="web-gui:geometry-viewer-window:v2"
      initialWidth={1220}
      initialHeight={680}
      minWidth={520}
      minHeight={360}
    >
      <section
        ref={setViewerElement}
        class="geometry-viewer-window"
        onKeyDown={handlePanelKeyDown}
      >
        <div
          ref={(element) => (toolbarElement = element)}
          class="geometry-viewer-toolbar"
          role="toolbar"
          aria-label="Управление 3D-окном"
          onScroll={updatePanelPosition}
        >
          <div class="geometry-viewer-toolbar-controls">
            <button
              type="button"
              class="geometry-viewer-menu-button"
              classList={{ active: openPanel() === "elements" }}
              aria-expanded={openPanel() === "elements"}
              aria-controls={OPTIONS_PANEL_ID}
              aria-haspopup="dialog"
              title={`Элементы: ${OBJECT_MODE_LABELS[elementsMode()]}`}
              onClick={(event) => togglePanel("elements", event)}
            >
              Элементы
            </button>

            <button
              type="button"
              class="geometry-viewer-menu-button"
              classList={{ active: openPanel() === "regions" }}
              aria-expanded={openPanel() === "regions"}
              aria-controls={OPTIONS_PANEL_ID}
              aria-haspopup="dialog"
              title={`Области: ${OBJECT_MODE_LABELS[regionsMode()]}`}
              onClick={(event) => togglePanel("regions", event)}
            >
              Области
            </button>

            <button
              type="button"
              class="geometry-viewer-menu-button"
              classList={{ active: openPanel() === "symmetry" }}
              aria-expanded={openPanel() === "symmetry"}
              aria-controls={OPTIONS_PANEL_ID}
              aria-haspopup="dialog"
              title="Настроить показ образов симметрии"
              onClick={(event) => togglePanel("symmetry", event)}
            >
              Симметрии
            </button>

            <button
              type="button"
              class="geometry-viewer-menu-button"
              classList={{ active: openPanel() === "general" }}
              aria-label="Общие опции отображения"
              aria-expanded={openPanel() === "general"}
              aria-controls={OPTIONS_PANEL_ID}
              aria-haspopup="dialog"
              title="Настроить общие опции отображения"
              onClick={(event) => togglePanel("general", event)}
            >
              Общие опции
            </button>

            <select
              class="geometry-viewer-select"
              value={renderMode()}
              aria-label="Режим представления"
              title="Режим представления геометрии"
              onChange={(event) => setRenderMode(event.currentTarget.value)}
            >
              <option value="solid">Сплошной</option>
              <option value="translucent">Полупрозрачный</option>
              <option value="wireframe">Каркас</option>
            </select>

            <button
              type="button"
              class="geometry-viewer-fit"
              title="Вписать показанную геометрию в окно"
              onClick={() => setFitRequest((value) => value + 1)}
            >
              Вписать всё
            </button>
          </div>
        </div>

        <Show when={openPanel()}>
          <div
            ref={(element) => {
              optionsPanelElement = element;
              queueMicrotask(updatePanelPosition);
            }}
            id={OPTIONS_PANEL_ID}
            class="geometry-viewer-options-panel"
            role="dialog"
            aria-modal="false"
            aria-label={openPanel() === "general"
              ? "Общие опции отображения"
              : openPanel() === "symmetry"
                ? "Показ симметрий"
                : `Показ ${openPanel() === "elements" ? "элементов" : "областей"}`}
            tabIndex="-1"
            style={{
              left: `${panelPosition().left}px`,
              top: `${panelPosition().top}px`,
            }}
          >
            <Show when={openPanel() === "elements"}>
              <div class="geometry-viewer-options-title">Показ элементов</div>
              <label>
                <input
                  type="radio"
                  name="geometry-elements-mode"
                  checked={elementsMode() === "all"}
                  onChange={() => setElementsMode("all")}
                />
                Все элементы
              </label>
              <label>
                <input
                  type="radio"
                  name="geometry-elements-mode"
                  checked={elementsMode() === "selected"}
                  onChange={() => setElementsMode("selected")}
                />
                Выделенные в списке
              </label>
              <label>
                <input
                  type="radio"
                  name="geometry-elements-mode"
                  checked={elementsMode() === "none"}
                  onChange={() => setElementsMode("none")}
                />
                Не показывать
              </label>
            </Show>

            <Show when={openPanel() === "regions"}>
              <div class="geometry-viewer-options-title">Показ областей</div>
              <label>
                <input
                  type="radio"
                  name="geometry-regions-mode"
                  checked={regionsMode() === "all"}
                  onChange={() => setRegionsMode("all")}
                />
                Все области
              </label>
              <label>
                <input
                  type="radio"
                  name="geometry-regions-mode"
                  checked={regionsMode() === "selected"}
                  onChange={() => setRegionsMode("selected")}
                />
                Выделенные в списке
              </label>
              <label>
                <input
                  type="radio"
                  name="geometry-regions-mode"
                  checked={regionsMode() === "none"}
                  onChange={() => setRegionsMode("none")}
                />
                Не показывать
              </label>
            </Show>

            <Show when={openPanel() === "symmetry"}>
              <div class="geometry-viewer-options-title">Показ симметрий</div>
              <label>
                <input
                  type="checkbox"
                  checked={showLocalSymmetry()}
                  onChange={(event) =>
                    setShowLocalSymmetry(event.currentTarget.checked)}
                />
                Локальная
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showAxialSymmetry()}
                  onChange={(event) =>
                    setShowAxialSymmetry(event.currentTarget.checked)}
                />
                Азимутальная
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showPeriodicSymmetry()}
                  onChange={(event) =>
                    setShowPeriodicSymmetry(event.currentTarget.checked)}
                />
                Периодическая
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showMirrorSymmetry()}
                  onChange={(event) =>
                    setShowMirrorSymmetry(event.currentTarget.checked)}
                />
                Зеркальная
              </label>
            </Show>

            <Show when={openPanel() === "general"}>
              <div class="geometry-viewer-options-title">Общие опции</div>
              <label>
                <input
                  type="checkbox"
                  checked={orthographicView()}
                  onChange={(event) =>
                    setOrthographicView(event.currentTarget.checked)}
                />
                Ортогональный вид
              </label>
              <label
                classList={{ "is-disabled": renderMode() === "wireframe" }}
                title={renderMode() === "wireframe"
                  ? "Рёбра обязательны в режиме «Каркас»"
                  : undefined}
              >
                <input
                  type="checkbox"
                  checked={renderMode() === "wireframe" || showEdges()}
                  disabled={renderMode() === "wireframe"}
                  onChange={(event) => setShowEdges(event.currentTarget.checked)}
                />
                Рёбра
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showVertices()}
                  onChange={(event) =>
                    setShowVertices(event.currentTarget.checked)}
                />
                Вершины
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showDiscretizationLines()}
                  onChange={(event) =>
                    setShowDiscretizationLines(event.currentTarget.checked)}
                />
                Линии дискретизации
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showCentersAndNodes()}
                  onChange={(event) =>
                    setShowCentersAndNodes(event.currentTarget.checked)}
                />
                Центры и узлы
              </label>
              <label
                class="is-disabled"
                title="Функция будет реализована позднее"
              >
                <input type="checkbox" checked={false} disabled />
                Заданные источники
              </label>
            </Show>
          </div>
        </Show>

        <div class="geometry-viewer-canvas-region">
          <ThreeGeometryViewport
            scene={sceneModel()}
            filters={filters()}
            mode={renderMode()}
            showEdges={showEdges()}
            showVertices={showVertices()}
            showDiscretizationLines={showDiscretizationLines()}
            showCentersAndNodes={showCentersAndNodes()}
            projection={orthographicView() ? "orthographic" : "perspective"}
            fitRequest={fitRequest()}
            instanceBudget={GEOMETRY_INSTANCE_BUDGET}
            onRenderStats={setRenderStats}
            onError={setViewportError}
          />
          <Show when={budgetWarning()} keyed>
            {(warning) => (
              <div class="geometry-viewer-budget-warning" role="status">
                {warning}
              </div>
            )}
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
                  <li
                    class={`is-${diagnosticLevel(diagnostic)}`}
                    title={diagnosticDetail(diagnostic)}
                  >
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
