import { createEffect, createSignal, Show } from "solid-js";
import "./TaskOperationDialog.css";

export const TASK_OPERATION_LABELS = Object.freeze({
  create: "Создать задание", copy: "Создать копию", rename: "Переименовать", move: "Перенести в другой каталог",
});

export function TaskOperationDialog(props) {
  let dialog, nameInput;
  const [name, setName] = createSignal("");
  const [stopped, setStopped] = createSignal(false);
  const relocation = () => ["rename", "move"].includes(props.request?.kind);
  createEffect(() => {
    const request = props.request;
    setName(request?.name ?? "");
    setStopped(false);
    if (request) {
      if (!dialog.open) dialog.showModal();
      queueMicrotask(() => { nameInput?.focus(); nameInput?.select(); });
    } else if (dialog.open) dialog.close();
  });
  return <dialog ref={dialog} class="task-operation-dialog" aria-labelledby="task-operation-title"
    onCancel={event => { event.preventDefault(); if (!props.busy) props.onClose(); }}>
    <form onSubmit={event => { event.preventDefault(); if (!props.busy && (!relocation() || stopped())) props.onSubmit(name()); }}>
      <h2 id="task-operation-title">{TASK_OPERATION_LABELS[props.request?.kind]}</h2>
      <p>Проект: {props.request?.projectName}</p>
      <Show when={props.request?.kind !== "move"} fallback={<p>Задание: {props.request?.name}. Выберите проект назначения после нажатия кнопки ниже.</p>}>
        <label>Имя задания
          <input ref={nameInput} name="taskName" value={name()} maxLength={120} required disabled={props.busy}
            onInput={event => setName(event.currentTarget.value)} autocomplete="off" />
        </label>
      </Show>
      <Show when={props.request?.kind === "copy"}>
        <p>Копируются сохранённые исходные данные и библиотеки. Несохранённые правки и результаты расчёта в копию не входят. Копия автоматически не открывается.</p>
      </Show>
      <Show when={props.request?.kind === "create"}>
        <p>Будет создан черновик с начальными параметрами и пустой геометрией. Затем загрузите, заполните, проверьте и сохраните его.</p>
      </Show>
      <Show when={relocation()}>
        <p>Переносится всё содержимое, включая результаты. Несохранённые изменения выбранного задания необходимо предварительно сохранить. Существующее назначение не перезаписывается.</p>
        <label class="task-operation-confirm"><input type="checkbox" checked={stopped()} disabled={props.busy}
          onChange={event => setStopped(event.currentTarget.checked)} />Расчёт и другие программы, изменяющие это задание, остановлены</label>
      </Show>
      <p class="task-operation-error" role="alert">{props.error}</p>
      <p role="status">{props.busy ? "Выполнение операции и проверка файлов…" : ""}</p>
      <div class="task-operation-actions">
        <button type="submit" disabled={props.busy || props.failed || (relocation() && !stopped())}>
          {props.request?.kind === "move" ? "Выбрать каталог назначения" : TASK_OPERATION_LABELS[props.request?.kind]}
        </button>
        <button type="button" disabled={props.busy} onClick={props.onClose}>{props.failed ? "Закрыть" : "Отмена"}</button>
      </div>
    </form>
  </dialog>;
}
