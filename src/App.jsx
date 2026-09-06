import { createEffect, createMemo, createSignal, For, onCleanup, onMount } from "solid-js";

import { Tasks } from "./tabs/Tasks.jsx";
import { DataEditor } from "./components/editors/DataEditor.jsx";
import { MaterialLibraryTab } from "./tabs/MaterialLibraryTab.jsx";
import { tabRegistry } from "./services/tabRegistry";
import { materialTabRegistry } from "./services/materialTabRegistry";
import { TaskInfoBar } from "./TaskInfoBar";
import { SidePanel } from "./components/SidePanel";
import { MaterialSelectionDialog } from "./components/materials/MaterialSelectionDialog.jsx";
import { GeometryViewerWindow } from "./components/geometry/GeometryViewerWindow.jsx";
import {
  TABS,
  VALIDATION_LEVELS,
} from "./services/schemas/common/constants";
import { selectionService } from "./services/selectionService";
import { modelService } from "./services/modelService";
import { materialLibraryHistoryService } from "./services/materialLibraryHistoryService.js";
import { modelValidator } from "./tabulator/validators/types/modelValidator";
import { diagnosticService } from "./services/diagnosticService";
import { dataService } from "./services/dataService";
import { viewSettingsService } from "./services/viewSettingsService";
import { selectionContextService } from "./services/selectionContextService.js";
import { unsavedChangesService } from "./services/unsavedChangesService.js";
import { taskApprovalService } from "./services/taskApprovalService.js";
import {
  assignSelectedElementMaterial,
  clearSelectedElementMaterials,
  selectedElementMaterialRequest,
  selectedElementsRequest,
} from "./tabulator/actions/elementMaterialActions.js";
import { loadMaterialReferenceCatalog } from "./services/materialReferenceValidation.js";
import { createError } from "./tabulator/validators/common/createDiagnostic.js";

import "./App.css";

export default function App() {
  const [activeTab, setActiveTab] = createSignal(TABS.TASKS.id);
  const [taskSummaryBounds, setTaskSummaryBounds] = createSignal(null);
  const tabButtons = new Map();
  let tabsViewport;
  let tabsHeader;
  let tasksContent;
  let taskPanelMeasurementFrame;
  let taskPanelMeasurementDisposed = false;

  function measureTaskSummaryBounds() {
    taskPanelMeasurementFrame = undefined;
    if (activeTab() !== TABS.TASKS.id || !tasksContent) return;

    const regionsButton = tabButtons.get(TABS.REGIONS.id);
    const movesButton = tabButtons.get(TABS.MOVES.id);
    if (!regionsButton || !movesButton) return;

    const regionsRect = regionsButton.getBoundingClientRect();
    const movesRect = movesButton.getBoundingClientRect();
    const contentRect = tasksContent.getBoundingClientRect();
    // Grid coordinates start inside the content border, unlike viewport rects.
    const left = regionsRect.left - contentRect.left - tasksContent.clientLeft;
    const width = movesRect.right - regionsRect.left;
    if (left <= 0 || width <= 0) return;

    setTaskSummaryBounds((previous) =>
      previous?.left === left && previous?.width === width
        ? previous
        : { left, width },
    );
  }

  function scheduleTaskPanelMeasurement() {
    if (taskPanelMeasurementDisposed || taskPanelMeasurementFrame !== undefined) return;
    taskPanelMeasurementFrame = requestAnimationFrame(measureTaskSummaryBounds);
  }

  createEffect(() => {
    // The active button becomes bold and can change the flex row's geometry.
    if (activeTab() !== TABS.TASKS.id && tabsViewport) {
      tabsViewport.scrollLeft = 0;
    }
    scheduleTaskPanelMeasurement();
  });

  onMount(() => {
    const observer = new ResizeObserver(scheduleTaskPanelMeasurement);
    observer.observe(tabsHeader);
    observer.observe(tasksContent);
    tabButtons.forEach((button) => observer.observe(button));
    window.addEventListener("resize", scheduleTaskPanelMeasurement);
    document.fonts?.addEventListener("loadingdone", scheduleTaskPanelMeasurement);
    document.fonts?.ready.then(scheduleTaskPanelMeasurement);
    scheduleTaskPanelMeasurement();

    onCleanup(() => {
      taskPanelMeasurementDisposed = true;
      observer.disconnect();
      window.removeEventListener("resize", scheduleTaskPanelMeasurement);
      document.fonts?.removeEventListener("loadingdone", scheduleTaskPanelMeasurement);
      cancelAnimationFrame(taskPanelMeasurementFrame);
    });
  });

  const [admin, setAdmin] = createSignal(false);
  const [sidePanelOpen, setSidePanelOpen] = createSignal(false);
  const [materialRequest, setMaterialRequest] = createSignal(null);
  const [geometryViewerOpen, setGeometryViewerOpen] = createSignal(false);
  const [selectedGeometryElementIndices, setSelectedGeometryElementIndices] =
    createSignal([]);
  const [selectedGeometryRegionIndices, setSelectedGeometryRegionIndices] =
    createSignal([]);
  let geometryViewerButton;
  let modelValidationRevision = 0;
  let observedGeometryTaskHandle;

  const [validationPending, setValidationPending] = createSignal(null);
  const [validationFeedback, setValidationFeedback] = createSignal(null);
  let validationFeedbackTimer;
  let validationContextVersion = 0;

  function clearValidationFeedback() {
    clearTimeout(validationFeedbackTimer);
    validationFeedbackTimer = undefined;
    setValidationFeedback(null);
  }

  createEffect(() => {
    selectionService.loadedTaskHandle();
    modelService.getModel();
    validationContextVersion += 1;
    clearValidationFeedback();
  });

  onCleanup(() => {
    validationContextVersion += 1;
    clearValidationFeedback();
  });

  function isValidationContextCurrent(context) {
    return context.version === validationContextVersion
      && context.revision === modelValidationRevision
      && context.taskHandle === selectionService.loadedTaskHandle()
      && context.modelSnapshot === modelService.getModel();
  }

  function showValidationFeedback(context, status, message) {
    if (!isValidationContextCurrent(context)) return;

    clearValidationFeedback();
    setValidationFeedback({ status, message });
    validationFeedbackTimer = setTimeout(clearValidationFeedback, 3000);
  }

  const [savePending, setSavePending] = createSignal(null);
  const [saveFeedback, setSaveFeedback] = createSignal(null);
  let saveFeedbackTimer;
  let saveContextVersion = 0;

  function clearSaveFeedback() {
    clearTimeout(saveFeedbackTimer);
    saveFeedbackTimer = undefined;
    setSaveFeedback(null);
  }

  createEffect(() => {
    selectionService.loadedTaskHandle();
    modelService.getModel();
    saveContextVersion += 1;
    clearSaveFeedback();
  });

  onCleanup(() => {
    saveContextVersion += 1;
    clearSaveFeedback();
  });

  function showSaveFeedback(context, status, message) {
    if (
      context.version !== saveContextVersion
      || context.taskHandle !== selectionService.loadedTaskHandle()
      || context.modelSnapshot !== modelService.getModel()
    ) return;

    clearSaveFeedback();
    setSaveFeedback({ status, message });
    saveFeedbackTimer = setTimeout(clearSaveFeedback, 3000);
  }

  async function collectModelDiagnostics(taskHandle, modelSnapshot) {
    const materialResult = await loadMaterialReferenceCatalog(taskHandle);
    const diagnostics = modelValidator(
      { getModel: () => modelSnapshot },
      { materialCatalog: materialResult.catalog },
    );
    diagnostics.push(...materialResult.errors.map(message => createError({
      tab: TABS.ELEMENTS,
      property: "xapName",
      message: `Проверка ссылок на характеристики не завершена: ${message}`,
    })));
    return diagnostics;
  }

  async function handleModelValidation() {
    const taskHandle = selectionService.loadedTaskHandle();
    if (!taskHandle || validationPending()) return;

    const modelSnapshot = modelService.getModel();
    const context = {
      version: validationContextVersion,
      revision: ++modelValidationRevision,
      taskHandle,
      modelSnapshot,
    };
    setValidationPending(context);
    clearValidationFeedback();

    try {
      const diagnostics = await collectModelDiagnostics(
        taskHandle,
        modelSnapshot,
      );
      if (!isValidationContextCurrent(context)) return;

      diagnosticService.setValidationResult(diagnostics);
      showValidationFeedback(
        context,
        "success",
        "Проверка модели завершена. Результат — в диагностике.",
      );
    } catch (error) {
      if (!isValidationContextCurrent(context)) return;

      const message = "Не удалось завершить проверку модели: "
        + (error?.message ?? String(error));
      diagnosticService.setValidationResult([createError({ message })]);
      showValidationFeedback(context, "error", message);
      console.error("Не удалось завершить проверку модели", error);
    } finally {
      setValidationPending(null);
    }
  }

  function handleAdminUnlock(password) {
    if (password !== "_qwerty123") return false;
    setAdmin(true);
    return true;
  }

  const tabs = [
    {
      id: TABS.TASKS.id,
      label: "Задачи и результаты",
      component: (props) => (
        <Tasks
          active={props.active}
          summaryBounds={taskSummaryBounds()}
          admin={admin()}
          onReturnToEditing={props.onReturnToEditing}
          onValidate={handleModelValidation}
          onSave={handleSave}
          onOpenTab={setActiveTab}
        />
      ),
      historyEnabled: false,
      changeIndicator: false,
    },

    ...tabRegistry.map((schema) => ({
      id: schema.id,
      label: schema.title,
      component: (props) => (
        <DataEditor
          schema={schema}
          active={props.active}
          computedColumnsMode={props.computedColumnsMode}
          onRecordSelectionChange={handleGeometryRecordSelectionChange}
        />
      ),
    })),

    ...materialTabRegistry.map((definition) => ({
      id: definition.id,
      label: definition.label,
      historyController: materialLibraryHistoryService,
      component: (props) => (
        <MaterialLibraryTab
          definition={definition}
          active={props.active}
        />
      ),
    })),
  ];
  const activeTabDefinition = () =>
    tabs.find((tab) => tab.id === activeTab());
  const historyTabId = () =>
    activeTabDefinition()?.historyEnabled === false
      ? null
      : activeTab();
  const historyTabLabel = () =>
    tabs.find((tab) => tab.id === activeTab())?.label ?? "";
  const historyController = () =>
    activeTabDefinition()?.historyController ?? modelService;
  const materialActionVisible = () => activeTab() === TABS.ELEMENTS.id;
  const materialActionEnabled = () =>
    materialActionVisible()
    && Boolean(selectionService.loadedTaskHandle())
    && selectionContextService.selectedRows().length > 0;
  const geometryModel = createMemo((previous) => {
    const model = modelService.getModel();

    if (
      previous?.general === model.general
      && previous?.elements === model.elements
      && previous?.regions === model.regions
    ) {
      return previous;
    }

    return {
      general: model.general,
      elements: model.elements,
      regions: model.regions,
    };
  });
  const geometrySelections = createMemo(() => ({
    elements: selectedGeometryElementIndices(),
    regions: selectedGeometryRegionIndices(),
  }));

  function sameRecordIndices(left, right) {
    return left.length === right.length &&
      left.every((value, index) => value === right[index]);
  }

  function updateGeometrySelection(setSelection, recordIndices) {
    const next = Array.isArray(recordIndices) ? [...recordIndices] : [];
    setSelection((current) =>
      sameRecordIndices(current, next) ? current : next
    );
  }

  function handleGeometryRecordSelectionChange(schemaId, recordIndices) {
    if (schemaId === TABS.ELEMENTS.id) {
      updateGeometrySelection(
        setSelectedGeometryElementIndices,
        recordIndices,
      );
    } else if (schemaId === TABS.REGIONS.id) {
      updateGeometrySelection(
        setSelectedGeometryRegionIndices,
        recordIndices,
      );
    }
  }

  createEffect(() => {
    const taskHandle = selectionService.loadedTaskHandle();
    if (taskHandle === observedGeometryTaskHandle) return;

    observedGeometryTaskHandle = taskHandle;
    setSelectedGeometryElementIndices([]);
    setSelectedGeometryRegionIndices([]);
  });

  function handleMaterialSelectionOpen() {
    try {
      setMaterialRequest(
        selectedElementMaterialRequest(
          selectionContextService.getActiveTable(),
        ),
      );
    } catch (error) {
      setMaterialRequest({
        error: error instanceof Error ? error.message : String(error),
      });
    }
    setSidePanelOpen(false);
  }

  async function handleMaterialSelectionApply(name) {
    const request = materialRequest();
    try {
      await assignSelectedElementMaterial(request, name);
      setMaterialRequest(null);
    } catch (error) {
      setMaterialRequest({
        ...request,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function handleMakeElementsNonmagnetic() {
    try {
      const request = selectedElementsRequest(
        selectionContextService.getActiveTable(),
      );
      await clearSelectedElementMaterials(request);
      setSidePanelOpen(false);
    } catch (error) {
      console.error("Не удалось сделать элементы немагнитными", error);
    }
  }

  async function handleSave() {
    const dirHandle = selectionService.loadedTaskHandle();
    if (!dirHandle || savePending()) return;

    const modelSnapshot = modelService.getModel();
    const validationRevision = ++modelValidationRevision;
    const context = {
      version: saveContextVersion,
      taskHandle: dirHandle,
      modelSnapshot,
    };
    let feedbackResult;
    setSavePending(context);
    clearSaveFeedback();

    try {
      try {
        await taskApprovalService.markUnapproved(dirHandle);
      } catch (error) {
        feedbackResult = {
          status: "error",
          message: "Сохранение отменено: не удалось подготовить запись. "
            + (error?.message ?? String(error)),
        };
        console.error(
          "Сохранение отменено: не удалось создать маркер проверки",
          error,
        );
        return;
      }

      let saveFailed = false;
      let savedCount = 0;
      const saveErrors = [];
      for (const schema of tabRegistry) {
        const itemModel = modelSnapshot[schema.id];
        try {
          const saved = await dataService.save(
            dirHandle,
            schema,
            itemModel,
          );
          if (!saved) {
            saveFailed = true;
            // Отсутствующая необязательная вкладка не требует записи.
            if (itemModel != null || schema.config.required) {
              saveErrors.push(schema.title);
            }
            console.warn(`Не сохранена вкладка '${schema.id}'`);
            continue;
          }
          savedCount += 1;
          unsavedChangesService.setBaseline(schema.id, itemModel);
        } catch (error) {
          saveFailed = true;
          saveErrors.push(`${schema.title}: ${error?.message ?? String(error)}`);
          console.warn(`Не удалось сохранить '${schema.id}'`, error);
        }
      }

      feedbackResult = saveErrors.length > 0 || savedCount === 0
        ? {
          status: "error",
          message: saveErrors.length > 0
            ? `Не удалось сохранить вкладки: ${saveErrors.join("; ")}`
            : "Нет данных для сохранения",
        }
        : { status: "success", message: "Данные модели сохранены" };
      if (saveFailed) return;

      let diagnostics;
      try {
        diagnostics = await collectModelDiagnostics(
          dirHandle,
          modelSnapshot,
        );
      } catch (error) {
        console.error(
          "Маркер проверки сохранён: проверка модели не завершена",
          error,
        );
        return;
      }

      if (
        validationRevision === modelValidationRevision
        && dirHandle === selectionService.loadedTaskHandle()
        && modelSnapshot === modelService.getModel()
      ) {
        diagnosticService.setValidationResult(diagnostics);
      }

      const hasErrors = diagnostics.some(
        diagnostic => diagnostic.level === VALIDATION_LEVELS.ERROR,
      );
      if (hasErrors) return;

      try {
        await taskApprovalService.clearUnapproved(dirHandle);
      } catch (error) {
        console.error(
          "Данные сохранены без ошибок, но маркер проверки не удалён",
          error,
        );
      }
    } finally {
      setSavePending(null);
      if (feedbackResult) {
        showSaveFeedback(context, feedbackResult.status, feedbackResult.message);
      }
    }
  }

  function runHistoryAction(action) {
    void Promise.resolve()
      .then(action)
      .catch(error => console.error("History action error:", error));
  }

  function handleReturnToEditing() {
    const firstDirtyTab = unsavedChangesService.dirtyTabIds(
      tabs.filter(tab => tab.changeIndicator !== false).map(tab => tab.id),
    )[0];
    if (firstDirtyTab) setActiveTab(firstDirtyTab);
  }

  return (
    <div class="app-container">
      <TaskInfoBar
        admin={admin()}
        path={selectionService.loadedTaskPath()}
        onAdminUnlock={handleAdminUnlock}
        onValidate={handleModelValidation}
        validationBusy={Boolean(validationPending())}
        validating={Boolean(validationPending())
          && validationPending().taskHandle === selectionService.loadedTaskHandle()}
        validationFeedback={validationFeedback()}
        onSave={handleSave}
        saveBusy={Boolean(savePending())}
        saving={Boolean(savePending())
          && savePending().taskHandle === selectionService.loadedTaskHandle()}
        saveFeedback={saveFeedback()}
        menuOpen={sidePanelOpen()}
        onMenuToggle={() => setSidePanelOpen((open) => !open)}
        geometryViewerOpen={geometryViewerOpen()}
        geometryViewerButtonRef={(element) => {
          geometryViewerButton = element;
        }}
        onGeometryViewerToggle={() => {
          setGeometryViewerOpen((open) => !open);
        }}
      />
      <SidePanel
        open={sidePanelOpen()}
        onClose={() => setSidePanelOpen(false)}
        computedColumnsMode={viewSettingsService.computedColumnsMode()}
        onComputedColumnsModeChange={
          viewSettingsService.setComputedColumnsMode
        }
        historyTabLabel={historyTabLabel()}
        historyEnabled={historyTabId() !== null}
        canUndo={historyController().canUndo(historyTabId())}
        canRedo={historyController().canRedo(historyTabId())}
        onUndo={() => runHistoryAction(
          () => historyController().undo(historyTabId()),
        )}
        onRedo={() => runHistoryAction(
          () => historyController().redo(historyTabId()),
        )}
        materialActionVisible={materialActionVisible()}
        materialActionEnabled={materialActionEnabled()}
        onChooseMaterial={handleMaterialSelectionOpen}
        onMakeNonmagnetic={handleMakeElementsNonmagnetic}
      />
      <div
        class="tabs-viewport"
        ref={tabsViewport}
        classList={{ "tasks-active": activeTab() === TABS.TASKS.id }}
      >
        <div class="tabs-frame">
          <div class="tabs-header" ref={tabsHeader}>
            <For each={tabs}>
              {(tab) => (
                <button
                  ref={(element) => tabButtons.set(tab.id, element)}
                  classList={{
                    active: activeTab() === tab.id,
                  }}
                  onClick={() => {
                    setActiveTab(tab.id);
                  }}
                >
                  <span class="tab-label">{tab.label}</span>
                  {tab.changeIndicator !== false && (
                    <span
                      classList={{
                        "tab-change-indicator": true,
                        dirty: unsavedChangesService.isDirty(tab.id),
                      }}
                      title={unsavedChangesService.isDirty(tab.id)
                        ? "Есть несохранённые изменения"
                        : "Нет несохранённых изменений"}
                      aria-label={unsavedChangesService.isDirty(tab.id)
                        ? "Есть несохранённые изменения"
                        : "Нет несохранённых изменений"}
                    />
                  )}
                </button>
              )}
            </For>
          </div>

          <For each={tabs}>
            {(tab) => {
              const Component = tab.component;
              return (
                <div
                  class="tab-content"
                  ref={(element) => {
                    if (tab.id === TABS.TASKS.id) tasksContent = element;
                  }}
                  style={{
                    display: activeTab() === tab.id ? "block" : "none",
                  }}
                >
                  <Component
                    active={activeTab() === tab.id}
                    computedColumnsMode={
                      viewSettingsService.computedColumnsMode()
                    }
                    onReturnToEditing={handleReturnToEditing}
                  />
                </div>
              );
            }}
          </For>
        </div>
      </div>
      <MaterialSelectionDialog
        request={materialRequest()}
        taskHandle={selectionService.loadedTaskHandle()}
        onCancel={() => setMaterialRequest(null)}
        onApply={handleMaterialSelectionApply}
      />
      <GeometryViewerWindow
        open={geometryViewerOpen()}
        model={geometryModel()}
        selections={geometrySelections()}
        onClose={() => {
          setGeometryViewerOpen(false);
          geometryViewerButton?.focus();
        }}
      />
    </div>
  );
}
