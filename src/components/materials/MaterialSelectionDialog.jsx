import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";

import { taskMaterialLibraryService } from "../../services/taskMaterialLibraryService.js";
import "./MaterialSelectionDialog.css";

export function MaterialSelectionDialog(props) {
  const [records, setRecords] = createSignal([]);
  const [selectedName, setSelectedName] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");

  createEffect(() => {
    const request = props.request;
    const taskHandle = props.taskHandle;
    setRecords([]);
    setSelectedName("");
    setError(request?.error ?? "");
    setLoading(false);
    if (!request?.kind || !taskHandle) return;

    let current = true;
    setLoading(true);
    void taskMaterialLibraryService.loadMaterials({
      taskHandle,
      kind: request.kind,
    }).then((items) => {
      if (!current) return;
      setRecords(items);
      if (items.length === 0) {
        setError("Локальная библиотека задания не содержит характеристик.");
      }
    }).catch((loadError) => {
      if (!current) return;
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }).finally(() => {
      if (current) setLoading(false);
    });

    onCleanup(() => {
      current = false;
    });
  });

  return (
    <Show when={props.request}>
      <div class="material-dialog-backdrop" role="presentation">
        <section
          class="material-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Выбор характеристики материала"
        >
          <div class="material-dialog-title">Выбрать характеристику</div>
          <Show when={props.request?.count}>
            <div class="material-dialog-summary">
              Выбрано элементов: {props.request.count}; библиотека: {props.request.kind}.
            </div>
          </Show>
          <Show when={loading()}>
            <div class="material-dialog-status">Загрузка…</div>
          </Show>
          <Show when={error()}>
            <div class="material-dialog-status material-dialog-error" role="alert">
              {error()}
            </div>
          </Show>
          <select
            class="material-dialog-list"
            size="14"
            value={selectedName()}
            disabled={loading() || records().length === 0}
            onChange={(event) => setSelectedName(event.currentTarget.value)}
          >
            <For each={records()}>
              {(record) => <option value={record.name}>{record.name}</option>}
            </For>
          </select>
          <div class="material-dialog-actions">
            <button onClick={props.onCancel}>Отмена</button>
            <button
              disabled={!selectedName() || loading()}
              onClick={() => props.onApply?.(selectedName())}
            >
              Назначить
            </button>
          </div>
        </section>
      </div>
    </Show>
  );
}
