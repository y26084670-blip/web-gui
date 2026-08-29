import {
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { TabulatorFull as Tabulator } from "tabulator-tables";

import { FmmGraphRegion } from "../components/materials/FmmGraphRegion.jsx";
import { FmmMaterialEditorDialog } from "../components/materials/FmmMaterialEditorDialog.jsx";
import { modelToRows } from "../tabulator/converters/modelConverter";
import { TableBuilder } from "../tabulator/builders/TableBuilder";
import { DetailRegion } from "../tabulator/views/DetailRegion";
import { TableView } from "../tabulator/views/TableView";
import { COMMON_TABLE_OPTIONS } from "../tabulator/tableOptions";
import {
  FIELD_TYPES,
  VIEW_TYPES,
} from "../services/schemas/common/constants";
import { htcParameterEntries } from "../services/materials/materialLibraryModel";
import { loadTaskMaterialLibrary } from "../services/materials/materialLibraryService.js";
import { selectionService } from "../services/selectionService";
import { materialLibraryRevisionService } from "../services/materialLibraryRevisionService.js";
import {
  MaterialBatchConflictError,
  MaterialBatchWriteError,
  taskMaterialLibraryService,
} from "../services/taskMaterialLibraryService";
import { createMaterialImportService } from "../services/materialImportService";
import { createFmmMaterialFile } from "../services/materialImport/xapLibImporter.js";
import {
  getFilePickerErrorMessage,
  getFileSystemAccessSupport,
} from "../services/fileSystemAccessSupport";

import "tabulator-tables/dist/css/tabulator.min.css";
import "./MaterialLibraryTab.css";

function withoutRowLabel(rowData) {
  const { rowLabel, ...record } = rowData;
  return record;
}

function htcDetailProperty(entries) {
  return {
    type: FIELD_TYPES.ARRAY,
    view: VIEW_TYPES.TABLE,
    label: "Параметры характеристики",
    description: "Параметры выбранной характеристики ВТСП",
    default: [],
    readonly: true,
    rowsMutable: false,
    nColumns: 1,
    columns: ["Значение"],
    itemLabels: entries.map(([name]) => name),
    itemLabelTitle: "Параметр",
    itemLabelWidth: 130,
    items: {
      type: FIELD_TYPES.STRING,
      description: "Значение параметра характеристики",
      default: "",
      readonly: true,
    },
  };
}

class ImportConflictCancelled extends Error {
  constructor(count) {
    super("Замена отличающихся локальных характеристик отменена.");
    this.name = "ImportConflictCancelled";
    this.count = count;
  }
}

function replacementQuestion(title, conflicts) {
  const limit = 10;
  const paths = conflicts
    .slice(0, limit)
    .map(conflict => `• ${conflict.path}`);
  if (conflicts.length > limit) {
    paths.push(`• …и ещё ${conflicts.length - limit}`);
  }

  return `${title}\n\n${paths.join("\n")}\n\nЗаменить эти файлы?`;
}

function writeSummary(prefix, results) {
  const counts = {
    created: 0,
    replaced: 0,
    unchanged: 0,
  };
  for (const result of results ?? []) {
    if (result?.status in counts) {
      counts[result.status] += 1;
    }
  }
  return `${prefix}: создано — ${counts.created}, заменено — `
    + `${counts.replaced}, без изменений — ${counts.unchanged}.`;
}

function actionErrorMessage(error, action) {
  if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
    return getFilePickerErrorMessage(error, action);
  }
  return error instanceof Error ? error.message : String(error);
}

function partialWriteMessage(summary, error) {
  return `${summary}: обработано — ${error.written.length}; `
    + `не удалось записать «${error.failed.path}»; `
    + `осталось — ${error.remaining.length}. `
    + "Проверьте доступ к каталогу задания и повторите операцию.";
}

export function MaterialLibraryTab(props) {
  const definition = props.definition;
  const schema = definition.schema;

  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal("");
  const [selectedRecords, setSelectedRecords] = createSignal([]);
  const [actionBusy, setActionBusy] = createSignal(false);
  const [actionMessage, setActionMessage] = createSignal("");
  const [actionError, setActionError] = createSignal("");
  const [librarySource, setLibrarySource] = createSignal("default");
  const [editorRecord, setEditorRecord] = createSignal(null);
  const [editorError, setEditorError] = createSignal("");

  let tableHost;
  let detailTitleHost;
  let detailToolbarHost;
  let detailViewHost;
  let table;
  let disposed = false;
  let recordLoadRevision = 0;

  const detailRegion = new DetailRegion();
  const recordDetailViews = new Map();

  const taskHandle = selectionService.loadedTaskHandle;
  const supportsTaskSource = definition.kind === "FMM";
  const isTaskSource = () =>
    supportsTaskSource && librarySource() === "task";
  const importActionLabel = definition.kind === "FMM"
    ? "Импортировать XAP.lib"
    : "Импортировать legacy-библиотеку ВТСП";

  function beginAction() {
    setActionBusy(true);
    setActionMessage("");
    setActionError("");
  }

  function endAction() {
    setActionBusy(false);
  }

  function selectedBaseRecords(rows) {
    return rows.map(row => withoutRowLabel(row.getData()));
  }

  function clearRenderedRecords() {
    detailRegion.showHint("Выберите характеристику в таблице");
    for (const entry of recordDetailViews.values()) {
      entry.view.destroy();
    }
    recordDetailViews.clear();
    setSelectedRecords([]);
  }

  function createHtcDetail(row) {
    const rowData = row.getData();
    const record = withoutRowLabel(rowData);
    const entries = htcParameterEntries(record);
    const property = htcDetailProperty(entries);
    const values = entries.map(([, value]) => [value]);
    const host = document.createElement("div");
    host.className = "nested-table-view";

    const view = new TableView(property, {
      getSchema: () => schema,
      getValue: () => values,
      getRecord: () => record,
      getModelSnapshot: () => ({}),
      isWritable: () => false,
      setValue: () => undefined,
    });

    const entry = {
      host,
      property,
      view,
      record,
    };
    recordDetailViews.set(rowData, entry);
    return entry;
  }

  function createPropertyDetail(row) {
    const rowData = row.getData();
    const record = withoutRowLabel(rowData);
    const propertyName = definition.detail.property;
    const property = schema.properties[propertyName];
    const host = document.createElement("div");
    host.className = "nested-table-view";

    const view = new TableView(property, {
      getSchema: () => schema,
      getValue: () => rowData[propertyName],
      getRecord: () => record,
      getModelSnapshot: () => ({}),
      isWritable: () => false,
      setValue: () => undefined,
    });

    const entry = {
      host,
      property,
      propertyName,
      view,
      record,
    };
    recordDetailViews.set(rowData, entry);
    return entry;
  }

  function showHtcDetail(row) {
    const rowData = row.getData();
    const entry = recordDetailViews.get(rowData)
      ?? createHtcDetail(row);
    const name = entry.record.name || rowData.rowLabel;

    detailRegion.mount(
      entry,
      entry.view,
      `Параметры характеристики — ${name}`,
      entry.host,
      null,
      null,
    );
  }

  function showPropertyDetail(row) {
    const rowData = row.getData();
    const entry = recordDetailViews.get(rowData)
      ?? createPropertyDetail(row);
    const name = entry.record.name || rowData.rowLabel;
    const sourceCell = row.getCell(entry.propertyName);

    detailRegion.mount(
      entry,
      entry.view,
      `${entry.property.label} — ${name}`,
      entry.host,
      entry.propertyName,
      sourceCell,
    );
  }

  function showDetail(row) {
    if (!row) {
      detailRegion.showHint("Выберите характеристику в таблице");
      return;
    }

    if (definition.detail.type === "property") {
      showPropertyDetail(row);
      return;
    }

    showHtcDetail(row);
  }

  function handleSelectionChanged(_data, rows) {
    setSelectedRecords(selectedBaseRecords(rows));
    showDetail(rows.length > 0 ? rows[rows.length - 1] : null);
  }

  function createTable() {
    const columns = TableBuilder.buildColumns(schema);

    if (definition.detail.type === "property") {
      const propertyName = definition.detail.property;
      const detailColumn = columns.find(
        column => column.field === propertyName,
      );
      if (detailColumn) {
        detailColumn.cellClick = (_event, cell) => {
          showPropertyDetail(cell.getRow());
        };
      }
    }

    table = new Tabulator(tableHost, {
      ...COMMON_TABLE_OPTIONS,
      layout: schema.config.stretchLastColumn
        ? "fitDataStretch"
        : "fitDataFill",
      height: "100%",
      data: [],
      columns,
      selectableRows: true,
      selectableRowsRangeMode: "click",
    });

    table._gui = {
      schema,
      required: false,
      detailRegion,
      model: {
        getSnapshot: () => ({}),
        getRecord: withoutRowLabel,
        setRecordValue: () => undefined,
      },
      structure: {
        mutable: false,
      },
    };

    table.on("rowSelectionChanged", handleSelectionChanged);
  }

  async function loadRecords({
    source = librarySource(),
    destination = taskHandle(),
  } = {}) {
    const revision = ++recordLoadRevision;
    setLoading(true);
    setError("");
    clearRenderedRecords();

    try {
      const records = source === "task"
        ? destination
          ? await loadTaskMaterialLibrary(definition.kind, destination)
          : []
        : await definition.loadRecords();
      if (disposed || revision !== recordLoadRevision) return;
      await table.setData(modelToRows(schema, records));
    } catch (loadError) {
      if (disposed || revision !== recordLoadRevision) return;
      console.error(`${definition.id} ${source} loading error:`, loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : String(loadError),
      );
      await table.setData([]);
    } finally {
      if (!disposed && revision === recordLoadRevision) setLoading(false);
    }
  }

  async function copySelectedMaterials() {
    const destination = taskHandle();
    if (!destination) {
      setActionError(
        "Сначала выберите задание на вкладке «Задачи и результаты».",
      );
      return;
    }

    const selected = selectedRecords();
    if (selected.length === 0) {
      setActionError("Выберите характеристики для копирования.");
      return;
    }

    const sourceRecords = selected.map(record => record._libraryRecord);
    if (sourceRecords.some(record => !record)) {
      setActionError(
        "Для одной из выбранных характеристик отсутствуют данные базовой библиотеки.",
      );
      return;
    }

    beginAction();
    try {
      const outcome = await runConfirmedBatch({
        title: "Выбранные локальные характеристики отличаются от базовых.",
        execute: options => taskMaterialLibraryService.copyMaterials({
          taskHandle: destination,
          records: sourceRecords,
          ...options,
        }),
      });

      if (outcome.status === "cancelled") {
        setActionMessage(
          `Копирование отменено; отличающиеся локальные файлы сохранены: ${outcome.count}.`,
        );
        return;
      }

      setActionMessage(
        writeSummary("Копирование завершено", outcome.result.results),
      );
      materialLibraryRevisionService.notifyChanged();
    } catch (copyError) {
      console.error(`${definition.id} copy error:`, copyError);
      if (copyError instanceof MaterialBatchWriteError) {
        setActionError(
          partialWriteMessage("Копирование выполнено частично", copyError),
        );
        return;
      }
      setActionError(
        `Копирование не завершено: ${actionErrorMessage(copyError, "скопировать характеристики")}`,
      );
    } finally {
      endAction();
    }
  }

  async function runConfirmedBatch({ title, execute }) {
    let overwrite = false;
    let expectedConflicts;

    while (true) {
      try {
        return {
          status: "written",
          result: await execute({ overwrite, expectedConflicts }),
        };
      } catch (writeError) {
        if (!(writeError instanceof MaterialBatchConflictError)) {
          throw writeError;
        }

        const confirmed = window.confirm(
          replacementQuestion(title, writeError.conflicts),
        );
        if (!confirmed) {
          return {
            status: "cancelled",
            count: writeError.conflicts.length,
          };
        }

        // Подтверждение относится только к точному набору путей и SHA.
        // Если файлы изменятся до повторного preflight, сервис вернёт
        // новый конфликт и цикл запросит новое подтверждение.
        overwrite = true;
        expectedConflicts = writeError.conflicts;
      }
    }
  }

  async function writeImportedBatch(destination, batch) {
    const outcome = await runConfirmedBatch({
      title: "Импортируемые характеристики отличаются от локальных.",
      execute: options => taskMaterialLibraryService.writeImportedBatch({
        taskHandle: destination,
        ...batch,
        ...options,
      }),
    });

    if (outcome.status === "cancelled") {
      throw new ImportConflictCancelled(outcome.count);
    }

    return outcome.result;
  }

  async function importLegacyMaterials() {
    const destination = taskHandle();
    if (!destination) {
      setActionError(
        "Сначала выберите задание на вкладке «Задачи и результаты».",
      );
      return;
    }

    const isFmm = definition.kind === "FMM";
    const support = getFileSystemAccessSupport(window, {
      requireOpenFilePicker: isFmm && !isTaskSource(),
    });
    if (!support.supported) {
      setActionError(support.message);
      return;
    }

    beginAction();

    const importer = createMaterialImportService({
      pickFmmFile: async () => {
        if (isTaskSource()) {
          try {
            return [await destination.getFileHandle("XAP.lib")];
          } catch (error) {
            if (error?.name === "NotFoundError") {
              throw new Error(
                "В каталоге выбранного задания отсутствует XAP.lib.",
                { cause: error },
              );
            }
            throw error;
          }
        }
        return window.showOpenFilePicker({
          id: "clark-import-xaplib-fmm",
          multiple: false,
          excludeAcceptAllOption: false,
          types: [{
            description: "Legacy-библиотека ФММ XAP.lib",
            accept: {
              "application/octet-stream": [".lib"],
            },
          }],
        });
      },
      pickHtcDirectory: () => window.showDirectoryPicker({
        id: "clark-import-xaplib-htc",
        mode: "read",
      }),
      writeBatch: batch => writeImportedBatch(destination, batch),
    });

    try {
      const result = isFmm
        ? await importer.importFmm()
        : await importer.importHtc();

      if (result.status === "cancelled") {
        setActionMessage("Импорт отменён пользователем; файлы не изменены.");
        return;
      }

      setActionMessage(
        writeSummary("Импорт завершён", result.writeResult?.results),
      );
      materialLibraryRevisionService.notifyChanged();
      if (isTaskSource()) await loadRecords();
    } catch (importError) {
      if (importError instanceof ImportConflictCancelled) {
        setActionMessage(
          `Импорт отменён; отличающиеся локальные файлы сохранены: ${importError.count}.`,
        );
        return;
      }

      if (importError instanceof MaterialBatchWriteError) {
        console.error(`${definition.id} import partial write:`, importError);
        setActionError(
          partialWriteMessage("Импорт выполнен частично", importError),
        );
        return;
      }

      console.error(`${definition.id} import error:`, importError);
      setActionError(
        `Импорт не завершён: ${actionErrorMessage(importError, "импортировать характеристики")}`,
      );
    } finally {
      endAction();
    }
  }

  async function deleteSelectedMaterials() {
    const destination = taskHandle();
    const localRecords = selectedRecords()
      .map(record => record._taskLibraryRecord)
      .filter(Boolean);
    if (!destination || localRecords.length === 0) return;

    const names = localRecords.map(record => record.name).join(", ");
    if (!window.confirm(`Удалить локальные характеристики: ${names}?`)) {
      return;
    }

    beginAction();
    try {
      const results = await taskMaterialLibraryService.deleteMaterials({
        taskHandle: destination,
        records: localRecords,
      });
      setActionMessage(`Удалено характеристик: ${results.length}.`);
      materialLibraryRevisionService.notifyChanged();
      await loadRecords();
    } catch (deleteError) {
      setActionError(
        `Удаление не завершено: ${actionErrorMessage(deleteError, "удалить характеристики")}`,
      );
    } finally {
      endAction();
    }
  }

  function editSelectedMaterial() {
    const selected = selectedRecords();
    if (selected.length !== 1 || !selected[0]._taskLibraryRecord) return;
    setEditorError("");
    setEditorRecord(selected[0]);
  }

  async function saveEditedMaterial(record) {
    const destination = taskHandle();
    const source = editorRecord()?._taskLibraryRecord;
    if (!destination || !source) return;

    setActionBusy(true);
    setEditorError("");
    try {
      await taskMaterialLibraryService.saveMaterial({
        taskHandle: destination,
        material: createFmmMaterialFile(record),
        expectedSha256: source.sha256,
      });
      setEditorRecord(null);
      setActionMessage(`Характеристика «${record.name}» сохранена.`);
      materialLibraryRevisionService.notifyChanged();
      await loadRecords();
    } catch (saveError) {
      setEditorError(
        saveError instanceof Error ? saveError.message : String(saveError),
      );
    } finally {
      setActionBusy(false);
    }
  }

  onMount(() => {
    detailRegion.attach({
      title: detailTitleHost,
      toolbar: detailToolbarHost,
      host: detailViewHost,
    });
    detailRegion.showHint("Выберите характеристику в таблице");
    createTable();
    void loadRecords();
  });

  createEffect(() => {
    if (!props.active || !table) return;

    requestAnimationFrame(() => {
      if (!props.active || !table) return;
      table.redraw(true);
      void Promise.resolve(detailRegion.onVisible()).catch(
        visibilityError => {
          console.error(
            `${definition.id} detail visibility error:`,
            visibilityError,
          );
        },
      );
    });
  });

  createEffect(() => {
    const source = librarySource();
    const destination = taskHandle();
    if (!table || !supportsTaskSource) return;
    void loadRecords({ source, destination });
  });

  createEffect(() => {
    materialLibraryRevisionService.revision();
    if (!table || !isTaskSource()) return;
    void loadRecords();
  });

  onCleanup(() => {
    disposed = true;
    detailRegion.destroy();
    for (const entry of recordDetailViews.values()) {
      entry.view.destroy();
    }
    recordDetailViews.clear();
    table?.destroy();
    table = null;
  });

  return (
    <div class="material-library-tab">
      <div class="material-library-actions">
        <Show when={supportsTaskSource}>
          <label class="material-library-source">
            <span>Источник характеристик</span>
            <select
              value={librarySource()}
              disabled={actionBusy()}
              onChange={(event) => setLibrarySource(event.currentTarget.value)}
            >
              <option value="default">Базовая библиотека</option>
              <option value="task">Локальная библиотека задания</option>
            </select>
          </label>
        </Show>
        <Show when={!isTaskSource()}>
          <button
            disabled={
              actionBusy()
              || !taskHandle()
              || selectedRecords().length === 0
            }
            title={
              !taskHandle()
                ? "Сначала выберите задание"
                : "Скопировать выделенные базовые характеристики в задание"
            }
            onClick={copySelectedMaterials}
          >
            Копировать в задание
          </button>
          <Show when={!supportsTaskSource}>
            <button
              disabled={actionBusy() || !taskHandle()}
              title={!taskHandle() ? "Сначала выберите задание" : importActionLabel}
              onClick={importLegacyMaterials}
            >
              {importActionLabel}
            </button>
          </Show>
        </Show>
        <Show when={isTaskSource()}>
          <button
            disabled={actionBusy() || !taskHandle()}
            title="Импортировать XAP.lib из каталога выбранного задания"
            onClick={importLegacyMaterials}
          >
            Импортировать XAP.lib
          </button>
          <button
            disabled={actionBusy() || selectedRecords().length !== 1}
            title="Редактировать одну выбранную локальную характеристику"
            onClick={editSelectedMaterial}
          >
            Редактировать
          </button>
          <button
            disabled={actionBusy() || selectedRecords().length === 0}
            title="Удалить выбранные локальные характеристики"
            onClick={deleteSelectedMaterials}
          >
            Удалить
          </button>
        </Show>
        <Show when={actionBusy()}>
          <span class="material-library-action-progress">
            Выполняется операция…
          </span>
        </Show>
      </div>

      <Show when={!taskHandle()}>
        <div class="material-library-action-hint">
          Для работы с локальной библиотекой сначала выберите задание.
        </div>
      </Show>
      <Show when={actionMessage()}>
        <div class="material-library-action-status" aria-live="polite">
          {actionMessage()}
        </div>
      </Show>
      <Show when={actionError()}>
        <div
          class="material-library-action-status material-library-error"
          role="alert"
        >
          {actionError()}
        </div>
      </Show>

      <Show when={loading()}>
        <div class="material-library-message">
          Загрузка {isTaskSource() ? "локальной" : "базовой"} библиотеки…
        </div>
      </Show>
      <Show when={error()}>
        <div class="material-library-message material-library-error">
          Библиотека недоступна: {error()}
        </div>
      </Show>

      <div
        class="material-library-table"
        ref={(element) => (tableHost = element)}
      />

      <div
        classList={{
          "material-library-lower": true,
          "with-graph": definition.graphRegion,
        }}
      >
        <div class="detail-region material-library-detail">
          <div class="detail-region-header">
            <div
              class="detail-region-title"
              ref={(element) => (detailTitleHost = element)}
            />
            <div
              class="detail-region-toolbar"
              ref={(element) => (detailToolbarHost = element)}
            />
          </div>
          <div
            class="detail-region-host"
            ref={(element) => (detailViewHost = element)}
          />
        </div>

        <Show when={definition.graphRegion}>
          <FmmGraphRegion records={selectedRecords()} />
        </Show>
      </div>
      <FmmMaterialEditorDialog
        record={editorRecord()}
        error={editorError()}
        busy={actionBusy()}
        onCancel={() => setEditorRecord(null)}
        onSave={saveEditedMaterial}
      />
    </div>
  );
}
