import { createEffect, createMemo, createSignal, For } from "solid-js";

import { Tasks } from "./tabs/Tasks.jsx";
import { DataEditor } from "./components/editors/DataEditor.jsx";
import { MaterialLibraryTab } from "./tabs/MaterialLibraryTab.jsx";
import { tabRegistry } from "./services/tabRegistry";
import { materialTabRegistry } from "./services/materialTabRegistry";
import { TaskInfoBar } from "./TaskInfoBar";
import { SidePanel } from "./components/SidePanel";
import { MaterialSelectionDialog } from "./components/materials/MaterialSelectionDialog.jsx";
import { GeometryViewerWindow } from "./components/geometry/GeometryViewerWindow.jsx";
import { TABS } from "./services/schemas/common/constants";
import { selectionService } from "./services/selectionService";
import { modelService } from "./services/modelService";
import { materialLibraryHistoryService } from "./services/materialLibraryHistoryService.js";
import { modelValidator } from "./tabulator/validators/types/modelValidator";
import { diagnosticService } from "./services/diagnosticService";
import { dataService } from "./services/dataService";
import { viewSettingsService } from "./services/viewSettingsService";
import { selectionContextService } from "./services/selectionContextService.js";
import { unsavedChangesService } from "./services/unsavedChangesService.js";
import {
  assignSelectedElementMaterial,
  selectedElementMaterialRequest,
} from "./tabulator/actions/elementMaterialActions.js";
import { loadMaterialReferenceCatalog } from "./services/materialReferenceValidation.js";
import { createError } from "./tabulator/validators/common/createDiagnostic.js";

import "./App.css";

export default function App() {
  const [activeTab, setActiveTab] = createSignal(TABS.TASKS.id);
  const [diagnosticTarget, setDiagnosticTarget] = createSignal(null);
  const [sidePanelOpen, setSidePanelOpen] = createSignal(false);
  const [materialRequest, setMaterialRequest] = createSignal(null);
  const [geometryViewerOpen, setGeometryViewerOpen] = createSignal(false);
  const [selectedGeometryElementIndices, setSelectedGeometryElementIndices] =
    createSignal([]);
  const [selectedGeometryRegionIndices, setSelectedGeometryRegionIndices] =
    createSignal([]);
  let geometryViewerButton;
  let diagnosticTargetSequence = 0;
  let modelValidationRevision = 0;
  let observedGeometryTaskHandle;

  async function handleModelValidation() {
    const revision = ++modelValidationRevision;
    const taskHandle = selectionService.loadedTaskHandle();
    if (!taskHandle) return;

    const materialResult = await loadMaterialReferenceCatalog(taskHandle);
    if (
      revision !== modelValidationRevision
      || taskHandle !== selectionService.loadedTaskHandle()
    ) {
      return;
    }
    const diagnostics = modelValidator(modelService, {
      materialCatalog: materialResult.catalog,
    });
    diagnostics.push(...materialResult.errors.map(message => createError({
      tab: TABS.ELEMENTS,
      property: "xapName",
      message: `Проверка ссылок на характеристики не завершена: ${message}`,
    })));
    diagnosticService.setValidationResult(diagnostics);
  }

  function handleDiagnosticSelect(diagnostic) {
    const tabId = diagnostic?.tab?.id;
    if (
      !tabId
      || diagnostic?.row === undefined
      || diagnostic?.row === null
    ) {
      return;
    }

    setDiagnosticTarget({
      sequence: ++diagnosticTargetSequence,
      tabId,
      row: diagnostic.row,
      property: diagnostic.property,
    });
    setActiveTab(tabId);
  }

  const tabs = [
    {
      id: TABS.TASKS.id,
      label: "Задачи и результаты",
      component: (props) => (
        <Tasks onReturnToEditing={props.onReturnToEditing} />
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
          diagnosticTarget={props.diagnosticTarget}
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

  async function handleSave() {
    const dirHandle = selectionService.loadedTaskHandle();
    if (!dirHandle) return;
    for (const schema of tabRegistry) {
      try {
        const baseModel = modelService.getModel();
        const itemModel = baseModel[schema.id];
        await dataService.save(dirHandle, schema, itemModel);
        unsavedChangesService.setBaseline(schema.id, itemModel);
      } catch (error) {
        console.warn(`Не удалось сохранить '${schema.id}'`, error);
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
        path={selectionService.loadedTaskPath()}
        onValidate={handleModelValidation}
        onDiagnosticSelect={handleDiagnosticSelect}
        onSave={handleSave}
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
      />
      <div class="tabs-header">
        <For each={tabs}>
          {(tab) => (
            <button
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
              style={{
                display: activeTab() === tab.id ? "block" : "none",
              }}
            >
              <Component
                active={activeTab() === tab.id}
                diagnosticTarget={diagnosticTarget()}
                computedColumnsMode={
                  viewSettingsService.computedColumnsMode()
                }
                onReturnToEditing={handleReturnToEditing}
              />
            </div>
          );
        }}
      </For>
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
