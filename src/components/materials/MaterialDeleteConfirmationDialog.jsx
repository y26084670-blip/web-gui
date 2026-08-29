import { For, Show } from "solid-js";

import "./MaterialSelectionDialog.css";

export function MaterialDeleteConfirmationDialog(props) {
  return (
    <Show when={props.request}>
      <div class="material-dialog-backdrop" role="presentation">
        <section
          class="material-dialog material-delete-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Подтверждение удаления характеристик"
        >
          <div class="material-dialog-title">
            Удалить выбранные характеристики?
          </div>
          <div class="material-dialog-summary">
            Файлы будут удалены из локальной библиотеки задания.
          </div>
          <ul class="material-delete-list">
            <For each={props.request?.names ?? []}>
              {(name) => <li>{name}</li>}
            </For>
          </ul>
          <div class="material-dialog-actions material-delete-actions">
            <button disabled={props.busy} onClick={props.onCancel}>
              Отмена
            </button>
            <button
              class="material-delete-confirm"
              disabled={props.busy}
              onClick={props.onConfirm}
            >
              Удалить
            </button>
          </div>
        </section>
      </div>
    </Show>
  );
}
