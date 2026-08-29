import { createEffect, createSignal, For, Show } from "solid-js";

import "./MaterialSelectionDialog.css";

export function FmmMaterialEditorDialog(props) {
  const [hip, setHip] = createSignal(0);
  const [comment, setComment] = createSignal("");
  const [rows, setRows] = createSignal([]);
  const [error, setError] = createSignal("");

  createEffect(() => {
    const record = props.record;
    if (!record) return;
    setHip(record.hip);
    setComment(record.comment ?? "");
    setRows(structuredClone(record.tabl ?? []));
    setError("");
  });

  function updateCell(rowIndex, columnIndex, value) {
    const number = Number(value);
    setRows(current => current.map((row, index) =>
      index === rowIndex
        ? row.map((cell, column) => column === columnIndex ? number : cell)
        : row));
  }

  function submit() {
    const nextHip = Number(hip());
    const nextRows = rows();
    if (!Number.isFinite(nextHip)) {
      setError("hip должен быть конечным числом.");
      return;
    }
    if (
      nextRows.length !== 12
      || nextRows.some(row =>
        row.length !== 2 || row.some(value => !Number.isFinite(value)))
    ) {
      setError("Таблица должна содержать 12 пар конечных значений H и M.");
      return;
    }
    props.onSave?.({
      ...props.record,
      hip: nextHip,
      comment: comment(),
      tabl: structuredClone(nextRows),
    });
  }

  return (
    <Show when={props.record}>
      <div class="material-dialog-backdrop" role="presentation">
        <section
          class="material-dialog fmm-material-editor"
          role="dialog"
          aria-modal="true"
          aria-label="Редактирование характеристики ФММ"
        >
          <div class="material-dialog-title">
            Характеристика ФММ — {props.record?.name}
          </div>
          <label class="fmm-material-editor-field">
            <span>hip</span>
            <input
              type="number"
              step="any"
              value={hip()}
              onInput={(event) => setHip(event.currentTarget.value)}
            />
          </label>
          <label class="fmm-material-editor-field">
            <span>Комментарий</span>
            <input
              type="text"
              value={comment()}
              onInput={(event) => setComment(event.currentTarget.value)}
            />
          </label>
          <div class="fmm-material-editor-table-wrap">
            <table class="fmm-material-editor-table">
              <thead>
                <tr><th>#</th><th>H, кА/м</th><th>M, кА/м</th></tr>
              </thead>
              <tbody>
                <For each={rows()}>
                  {(row, rowIndex) => (
                    <tr>
                      <th>{rowIndex() + 1}</th>
                      <For each={row}>
                        {(value, columnIndex) => (
                          <td>
                            <input
                              type="number"
                              step="any"
                              value={value}
                              onInput={(event) => updateCell(
                                rowIndex(),
                                columnIndex(),
                                event.currentTarget.value,
                              )}
                            />
                          </td>
                        )}
                      </For>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
          <Show when={error() || props.error}>
            <div class="material-dialog-status material-dialog-error" role="alert">
              {error() || props.error}
            </div>
          </Show>
          <div class="material-dialog-actions">
            <button disabled={props.busy} onClick={props.onCancel}>Отмена</button>
            <button disabled={props.busy} onClick={submit}>
              Сохранить характеристику
            </button>
          </div>
        </section>
      </div>
    </Show>
  );
}
