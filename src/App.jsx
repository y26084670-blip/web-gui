import { createEffect, createSignal, For } from "solid-js";

import { Tasks } from "./tabs/Tasks.jsx";
import { DataEditor } from "./components/editors/DataEditor.jsx";
import { MaterialLibraryTab } from "./tabs/MaterialLibraryTab.jsx";
import { tabRegistry } from "./services/tabRegistry";
import { materialTabRegistry } from "./services/materialTabRegistry";
import { TaskInfoBar } from "./TaskInfoBar";
import { SidePanel } from "./components/SidePanel";
import { MaterialSelectionDialog } from "./components/materials/MaterialSelectionDialog.jsx";
import { TABS } from "./services/schemas/common/constants";
import { selectionService } from "./services/selectionService";
import { modelService } from "./services/modelService";
import { modelValidator } from "./tabulator/validators/types/modelValidator";
import { diagnosticService } from "./services/diagnosticService";
import { dataService } from "./services/dataService";
import { viewSettingsService } from "./services/viewSettingsService";
import { selectionContextService } from "./services/selectionContextService.js";
import {
  assignSelectedElementMaterial,
  selectedElementMaterialRequest,
} from "./tabulator/actions/elementMaterialActions.js";

import "./App.css";

export default function App() {
  const [activeTab, setActiveTab] = createSignal(TABS.TASKS.id);
  const [selectedDiagnostic, setSelectedDiagnostic] = createSignal(null);
  const [sidePanelOpen, setSidePanelOpen] = createSignal(false);
  const [materialRequest, setMaterialRequest] = createSignal(null);

  function handleModelValidation() {
    const diagnostics = modelValidator(modelService);
    diagnosticService.setValidationResult(diagnostics);
  }

  function handleDiagnosticSelect(diagnostic) {
    const tabId = diagnostic?.tab?.id;
    if (!tabId) return;

    setSelectedDiagnostic(diagnostic);
    setActiveTab(tabId);
  }

  const tabs = [
    {
      id: TABS.TASKS.id,
      label: "Задачи и результаты",
      component: Tasks,
      historyEnabled: false,
    },

    ...tabRegistry.map((schema) => ({
      id: schema.id,
      label: schema.title,
      component: (props) => (
        <DataEditor
          schema={schema}
          active={props.active}
          computedColumnsMode={props.computedColumnsMode}
        />
      ),
    })),

    ...materialTabRegistry.map((definition) => ({
      id: definition.id,
      label: definition.label,
      historyEnabled: false,
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
  const materialActionVisible = () => activeTab() === TABS.ELEMENTS.id;
  const materialActionEnabled = () =>
    materialActionVisible()
    && Boolean(selectionService.loadedTaskHandle())
    && selectionContextService.selectedRows().length > 0;

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
      } catch (error) {
        console.warn(`Не удалось сохранить '${schema.id}'`, error);
      }
    }
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
        canUndo={modelService.canUndo(historyTabId())}
        canRedo={modelService.canRedo(historyTabId())}
        onUndo={() => modelService.undo(historyTabId())}
        onRedo={() => modelService.redo(historyTabId())}
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
              {tab.label}
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
              selectedDiagnostic={selectedDiagnostic()}
            >
              <Component
                active={activeTab() === tab.id}
                computedColumnsMode={
                  viewSettingsService.computedColumnsMode()
                }
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
    </div>
  );
}
