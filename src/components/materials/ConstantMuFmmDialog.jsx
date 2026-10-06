import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { createConstantMuFmm } from "../../services/materials/constantMuFmm.js";
import "./MaterialSelectionDialog.css";
import "./ConstantMuFmmDialog.css";

export function ConstantMuFmmDialog(props) {
  const [mu, setMu] = createSignal(1000);
  const [hMax, setHMax] = createSignal(100);
  const [generated, setGenerated] = createSignal(null);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [notice, setNotice] = createSignal("");
  const stale = createMemo(() => !generated()
    || generated().mu !== mu() || generated().hMax !== hMax());
  let dialog;
  let disposed = false;
  createEffect(() => {
    if (props.open) {
      queueMicrotask(() => {
        if (!disposed && props.open && dialog?.isConnected && !dialog.open) dialog.showModal();
      });
    } else if (dialog?.open) dialog.close();
  });
  createEffect(() => { props.taskHandle; setError(""); setNotice(""); });
  onCleanup(() => { disposed = true; dialog?.close(); });
  const change = (setter, value) => { setter(value); setError(""); setNotice(""); };
  function createTable() {
    try {
      const record = createConstantMuFmm({ mu: mu(), hMax: hMax() });
      setGenerated({ mu: mu(), hMax: hMax(), record });
      setError(""); setNotice("Таблица из 12 точек создана в памяти. Файл ещё не сохранён.");
    } catch (cause) { setError(cause.message); setNotice(""); }
  }
  async function saveTable() {
    if (busy() || stale() || !props.canSave) return;
    const task = props.taskHandle;
    setBusy(true); setError(""); setNotice("");
    try {
      const saved = await props.onSave(generated().record);
      if (!disposed && task === props.taskHandle) {
        setNotice(`Сохранено: ${saved._taskLibraryRecord.relativePath}. Одноимённый файл перезаписан при наличии.`);
      }
    } catch (cause) {
      if (!disposed && task === props.taskHandle) setError(cause.message || String(cause));
    } finally { if (!disposed) setBusy(false); }
  }
  const number = value => value.toLocaleString("ru-RU", { maximumSignificantDigits: 10 });
  return <Portal>
    <dialog ref={dialog} class="material-dialog constant-mu-dialog" aria-label="ФММ: μ = const"
      aria-modal="true" onCancel={event => { event.preventDefault(); if (!busy()) props.onClose(); }}>
      <div class="material-dialog-title">ФММ: μ = const</div>
      <div class="constant-mu-inputs">
        <label>Hmax, кА/м<input type="number" min="0" step="any" value={hMax()} disabled={busy()}
          onInput={event => change(setHMax, event.currentTarget.valueAsNumber)}/></label>
        <label>μ<input type="number" min="0" step="any" value={mu()} disabled={busy()}
          onInput={event => change(setMu, event.currentTarget.valueAsNumber)}/></label>
      </div>
      <p class="material-dialog-summary">M = (μ − 1)H. 12 равноотстоящих точек от 0 до Hmax включительно.</p>
      <Show when={generated()}>{value => <>
        <p class="material-dialog-summary">Файл: <strong>{value().record.name}.txt</strong></p>
        <table class="constant-mu-preview"><thead><tr><th>№</th><th>H, кА/м</th><th>M, кА/м</th></tr></thead>
          <tbody><For each={value().record.tabl}>{(row, i) => <tr><td>{i()+1}</td><td>{number(row[0])}</td><td>{number(row[1])}</td></tr>}</For></tbody>
        </table>
        <Show when={stale()}><p class="material-dialog-summary">Параметры изменены. Нажмите «Создать» для обновления таблицы перед сохранением.</p></Show>
      </>}</Show>
      <p class="material-dialog-summary">Сохранение в input3XX/xapLibFMM текущего задания. Одноимённый файл заменяется без дополнительного запроса.</p>
      <Show when={!props.canSave}><p class="material-dialog-summary">Для сохранения откройте локальное задание (не демо).</p></Show>
      <Show when={error()}><p class="material-dialog-error" role="alert">{error()}</p></Show>
      <Show when={notice()}><p class="material-dialog-status" role="status">{notice()}</p></Show>
      <div class="material-dialog-actions">
        <button disabled={busy()} onClick={createTable}>Создать</button>
        <button disabled={busy() || stale() || !props.canSave} onClick={saveTable}>Сохранить</button>
        <button disabled={busy()} onClick={props.onClose}>Закрыть</button>
      </div>
    </dialog>
  </Portal>;
}
