import {
  For, Show, batch, createEffect, createMemo, createSignal, createUniqueId,
  onCleanup, onMount, untrack,
} from "solid-js";
import { FloatingWindow } from "../window/FloatingWindow.jsx";
import { selectionService } from "../../services/selectionService.js";
import { unsavedChangesService } from "../../services/unsavedChangesService.js";
import {
  TASK_LIST_FILE, createNativeLaunchUri, invalidateLaunchRequest,
  prepareLaunchRequest, readLaunchResult,
  readTaskList, refreshTaskList, setTaskListEntriesEnabled,
} from "../../services/taskLaunchService.js";
import "./TaskLaunchWindow.css";

const ACCEPT_TIMEOUT_MS = 45000;
const keyOf = path => path.toLowerCase();
const errorText = error => error?.message || String(error);

export function TaskLaunchWindow(props) {
  const listId = createUniqueId();
  const [entries, setEntries] = createSignal([]);
  const [listExists, setListExists] = createSignal(false);
  const [listValid, setListValid] = createSignal(false);
  const [selected, setSelected] = createSignal(new Set());
  const [activeIndex, setActiveIndex] = createSignal(0);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [notice, setNotice] = createSignal("");
  const binding = () => props.binding ?? null;
  const [proof, setProof] = createSignal(null);
  const [pending, setPending] = createSignal(null);
  const [confirmImport, setConfirmImport] = createSignal(false);
  const [loadedPath, setLoadedPath] = createSignal(null);
  const [resolvingLoaded, setResolvingLoaded] = createSignal(false);
  const [loadedPathError, setLoadedPathError] = createSignal(false);
  let listElement;
  let anchorIndex = 0;
  let rootRevision = 0;
  let loadedRevision = 0;
  let disposed = false;
  let polling = false;

  const current = (root, revision) => !disposed
    && root === props.rootHandle && revision === rootRevision;
  const enabledEntries = createMemo(() => entries().filter(entry => entry.enabled));
  const loadedIncluded = createMemo(() => {
    const path = loadedPath();
    return Boolean(path && enabledEntries().some(entry => keyOf(entry.path) === keyOf(path)));
  });
  const includedDirty = createMemo(() => unsavedChangesService.hasDirty() && loadedIncluded());
  const locked = () => busy() || Boolean(pending()) || props.bindingBusy;
  const canLaunch = () => !locked() && !resolvingLoaded() && !loadedPathError() && !includedDirty()
    && listExists() && listValid() && enabledEntries().length > 0
    && binding()?.bindingState === "bound" && Boolean(proof());
  const bindingLabel = () => binding()?.bindingState === "bound"
    ? "Каталог связан с Решателем"
    : "Каталог не связан с Решателем";

  createEffect(() => props.onBusyChange?.(busy() || Boolean(pending())));

  async function armLaunch(root, revision, marker = binding()) {
    setProof(null);
    if (!marker || marker.bindingState !== "bound" || !listExists() || !listValid()) return;
    const prepared = await prepareLaunchRequest(root, marker);
    if (current(root, revision) && !pending() && !props.bindingBusy
      && marker.workspaceId === binding()?.workspaceId
      && binding()?.bindingState === "bound") setProof(prepared);
  }

  async function loadRoot(root, revision) {
    if (!root) return;
    setBusy(true);
    try {
      const result = await readTaskList(root);
      if (!current(root, revision)) return;
      setEntries(result.entries);
      setListExists(result.exists);
      setListValid(true);
      await armLaunch(root, revision);
    } catch (failure) {
      if (current(root, revision)) setError(errorText(failure));
    } finally {
      if (current(root, revision)) setBusy(false);
    }
  }

  createEffect(() => {
    const root = props.rootHandle;
    const revision = ++rootRevision;
    untrack(() => {
      batch(() => {
        setEntries([]);
        setListExists(false);
        setListValid(false);
        setSelected(new Set());
        setActiveIndex(0);
        setBusy(false);
        setError("");
        setNotice("");
        setProof(null);
        setPending(null);
        setConfirmImport(false);
      });
      anchorIndex = 0;
      void loadRoot(root, revision);
    });
  });

  createEffect(() => {
    const marker = binding();
    untrack(() => {
      setProof(null);
      if (marker?.bindingState === "bound") void refreshOnFocus();
    });
  });

  createEffect(() => {
    const root = props.rootHandle;
    const loaded = selectionService.loadedTaskHandle();
    const demo = selectionService.loadedTaskIsDemo();
    const revision = ++loadedRevision;
    setLoadedPath(null);
    setLoadedPathError(false);
    setResolvingLoaded(Boolean(root && loaded && !demo));
    if (!root || !loaded || demo) return;
    void root.resolve(loaded).then(parts => {
      if (!disposed && revision === loadedRevision) {
        setLoadedPath(parts?.join("/") ?? null);
      }
    }).catch(failure => {
      if (!disposed && revision === loadedRevision) {
        setLoadedPathError(true);
        setError("Не удалось определить каталог загруженного задания: " + errorText(failure));
      }
    }).finally(() => {
      if (!disposed && revision === loadedRevision) setResolvingLoaded(false);
    });
  });

  async function changeList(operation) {
    if (locked() || !props.rootHandle) return;
    const root = props.rootHandle;
    const revision = rootRevision;
    setBusy(true);
    setProof(null);
    setError("");
    setNotice("");
    setConfirmImport(false);
    try {
      const result = await operation(root);
      if (!current(root, revision)) return;
      const retained = new Set(result.entries.map(entry => entry.path));
      setEntries(result.entries);
      setListExists(result.exists);
      setListValid(true);
      setSelected(previous => new Set([...previous].filter(path => retained.has(path))));
      setActiveIndex(0);
      anchorIndex = 0;
      await armLaunch(root, revision);
    } catch (failure) {
      if (current(root, revision)) setError(errorText(failure));
    } finally {
      if (current(root, revision)) setBusy(false);
    }
  }

  const updateList = () => changeList(root => refreshTaskList(root));
  const toggleSelected = enabled => {
    const snapshot = entries();
    const selection = new Set(selected());
    if (!selection.size || !listValid()) return;
    return changeList(root => setTaskListEntriesEnabled(root, snapshot, selection, enabled));
  };

  async function saveLoadedModel() {
    if (locked() || !includedDirty()) return;
    const root = props.rootHandle;
    const revision = rootRevision;
    setBusy(true);
    setError("");
    try {
      await props.onSave?.();
      if (current(root, revision) && includedDirty()) {
        setNotice("Сохраните изменения загруженного задания перед запуском.");
      } else if (current(root, revision)) setNotice("Модель сохранена. Можно запускать список.");
    } catch (failure) {
      if (current(root, revision)) setError(errorText(failure));
    } finally {
      if (current(root, revision)) setBusy(false);
    }
  }

  function launch(action) {
    if (!canLaunch() || (action === "circuit" && enabledEntries().length !== 1)) return;
    const prepared = proof();
    const snapshot = entries().map(entry => ({ ...entry }));
    try {
      const uri = createNativeLaunchUri(prepared.workspaceId, action, prepared.requestId);
      if (action === "import") props.onBeforeImport?.(snapshot, loadedIncluded());
      setPending({
        ...prepared, action, entries: snapshot, startedAt: Date.now(), state: "waiting",
      });
      setProof(null);
      setConfirmImport(false);
      setError("");
      setNotice("Ожидание ответа Clark… Подтвердите открытие Clark, если браузер запросит разрешение.");
      // Files are already closed and the URI is opened directly from this click.
      window.location.href = uri;
    } catch (failure) {
      setPending(null);
      setError(errorText(failure));
      setProof(prepared);
    }
  }

  async function finishRun(root, revision, run, result) {
    setBusy(true);
    setPending(null);
    if (result.state === "error") {
      setNotice("");
      setError(result.message);
    } else {
      setError("");
      setNotice(result.message || "Выполнение завершено.");
    }
    try {
      if (result.state === "completed" || (run.action === "import"
        && (run.state === "accepted" || Number.isInteger(result.exitCode)))) {
        await props.onLaunchComplete?.(run.entries, run.action);
      }
      if (!current(root, revision)) return;
      await armLaunch(root, revision);
    } catch (failure) {
      if (current(root, revision)) setError(errorText(failure));
    } finally {
      if (current(root, revision)) setBusy(false);
    }
  }

  async function pollNative() {
    if (polling || disposed || busy() || props.bindingBusy || !props.rootHandle) return;
    const root = props.rootHandle;
    const revision = rootRevision;
    const run = pending();
    if (!run) return;
    polling = true;
    try {
      if (run) {
        let result = null;
        try { result = await readLaunchResult(root, run.requestId); }
        catch { /* A concurrent native replacement is retried on the next poll. */ }
        if (!current(root, revision) || pending()?.requestId !== run.requestId) return;
        if (result?.workspaceId === run.workspaceId && result.action === run.action) {
          if (result.state === "accepted") {
            setPending({ ...run, state: "accepted" });
            setError("");
            setNotice(result.message || "Clark выполняет задания…");
          } else {
            await finishRun(root, revision, run, result);
          }
        } else if (run.state === "waiting" && Date.now() - run.startedAt >= ACCEPT_TIMEOUT_MS) {
          setBusy(true);
          try {
            // A locked proof may already belong to a native launch. Keep waiting
            // unless invalidation succeeds and its latest result is still absent.
            await invalidateLaunchRequest(root);
            if (!current(root, revision) || pending()?.requestId !== run.requestId) return;
            const latest = await readLaunchResult(root, run.requestId);
            if (!current(root, revision) || pending()?.requestId !== run.requestId) return;
            if (latest?.workspaceId === run.workspaceId && latest.action === run.action) {
              if (latest.state === "accepted") {
                setPending({ ...run, state: "accepted" });
                setError("");
                setNotice(latest.message || "Clark выполняет задания…");
              } else await finishRun(root, revision, run, latest);
              return;
            }
            setPending(null);
            setProof(null);
            setNotice("");
            setError("Ответ Clark не получен. Проверьте установку Clark и повторите запуск. После переноса каталога свяжите его повторно.");
            await armLaunch(root, revision);
          } catch (failure) {
            if (current(root, revision)) setError(errorText(failure));
          } finally {
            if (current(root, revision)) setBusy(false);
          }
        }
      }
    } catch (failure) {
      if (current(root, revision)) setError(errorText(failure));
    } finally {
      polling = false;
    }
  }

  async function refreshOnFocus() {
    if (pending()) { await pollNative(); return; }
    if (busy() || props.bindingBusy || disposed || !props.rootHandle) return;
    const root = props.rootHandle;
    const revision = rootRevision;
    try {
      const marker = binding();
      if (marker?.bindingState === "bound" && !proof()) {
        setBusy(true);
        try { await armLaunch(root, revision, marker); }
        finally { if (current(root, revision)) setBusy(false); }
      }
    } catch (failure) {
      if (current(root, revision)) setError(errorText(failure));
    }
  }

  onMount(() => {
    const timer = window.setInterval(() => { void pollNative(); }, 1000);
    const onFocus = () => { void refreshOnFocus(); };
    window.addEventListener("focus", onFocus);
    onCleanup(() => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    });
  });
  onCleanup(() => {
    disposed = true;
    rootRevision += 1;
    loadedRevision += 1;
    props.onBusyChange?.(false);
  });

  function selectAll() {
    setSelected(new Set(entries().map(entry => entry.path)));
    listElement?.focus({ preventScroll: true });
  }

  function selectRow(index, { shiftKey = false, ctrlKey = false, metaKey = false } = {}) {
    const rows = entries();
    if (!rows[index]) return;
    const multiple = ctrlKey || metaKey;
    if (shiftKey) {
      const next = multiple ? new Set(selected()) : new Set();
      const first = Math.min(anchorIndex, index);
      const last = Math.max(anchorIndex, index);
      for (let position = first; position <= last; position += 1) {
        if (rows[position]) next.add(rows[position].path);
      }
      setSelected(next);
    } else if (multiple) {
      const next = new Set(selected());
      if (next.has(rows[index].path)) next.delete(rows[index].path);
      else next.add(rows[index].path);
      setSelected(next);
      anchorIndex = index;
    } else {
      setSelected(new Set([rows[index].path]));
      anchorIndex = index;
    }
    setActiveIndex(index);
    listElement?.focus({ preventScroll: true });
  }

  function handleListKeyDown(event) {
    const rows = entries();
    if (!rows.length || event.altKey || event.isComposing) return;
    if ((event.ctrlKey || event.metaKey) && event.code === "KeyA") {
      event.preventDefault();
      event.stopPropagation();
      selectAll();
      return;
    }
    const previous = activeIndex();
    const moves = { ArrowDown: previous + 1, ArrowUp: previous - 1, Home: 0, End: rows.length - 1 };
    if (Object.hasOwn(moves, event.key)) {
      event.preventDefault();
      event.stopPropagation();
      const next = Math.max(0, Math.min(rows.length - 1, moves[event.key]));
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey) setActiveIndex(next);
      else selectRow(next, event);
      document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    } else if (event.code === "Space") {
      event.preventDefault();
      event.stopPropagation();
      selectRow(previous, { ctrlKey: true });
    }
  }

  return (
    <FloatingWindow
      open={props.open}
      title={`Список заданий — ${props.rootHandle?.name ?? ""}`}
      initialWidth={880} initialHeight={600} minWidth={560} minHeight={360}
      storageKey="web-gui:task-launch-window"
      class="task-launch-window"
      onClose={props.onClose}
    >
      <div class="task-launch-body">
        <div class="task-launch-hint">
          «Обновить список» → выделить нужные задания → «Подключить» → команда запуска.
          {" "}Новые задания отключены (*).
        </div>
        <div class="task-launch-metadata">
          <span title={props.rootHandle?.name}>{props.rootHandle?.name}/{TASK_LIST_FILE}</span>
          <span
            class="task-launch-binding-status"
            classList={{ "is-unbound": binding()?.bindingState !== "bound" }}
          >{bindingLabel()}</span>
        </div>
        <div class="task-launch-hint">
          {binding()?.bindingState === "bound"
            ? "Каталог связан с Решателем. Можно запускать подключённые задания."
            : "Нажмите «Связать с Решателем» рядом с кнопкой «Выбрать каталог с проектами» на вкладке выбора задания."}
        </div>
        <div class="task-launch-toolbar">
          <button type="button" disabled={locked() || !props.rootHandle} onClick={updateList}>Обновить список</button>
          <button type="button" disabled={locked() || !listValid() || !selected().size} onClick={() => toggleSelected(true)}>Подключить</button>
          <button type="button" disabled={locked() || !listValid() || !selected().size} onClick={() => toggleSelected(false)}>Отключить</button>
          <button type="button" disabled={!entries().length} onClick={selectAll}>Выделить все</button>
        </div>
        <Show when={error()}><div class="task-launch-error" role="alert">{error()}</div></Show>
        <Show when={notice()}><div class="task-launch-notice" role="status">{notice()}</div></Show>
        <Show when={includedDirty()}>
          <div class="task-launch-save-prompt">
            <span>Включённое задание содержит несохранённые изменения.</span>
            <button type="button" disabled={locked() || !props.onSave} onClick={saveLoadedModel}>Сохранить модель</button>
          </div>
        </Show>
        <div
          ref={listElement} id={listId} class="task-launch-list" role="listbox"
          aria-label="Список заданий" aria-multiselectable="true" tabIndex="0"
          aria-activedescendant={entries().length ? `${listId}-${activeIndex()}` : undefined}
          onKeyDown={handleListKeyDown}
        >
          <For each={entries()} fallback={
            <div class="task-launch-empty">{busy() ? "Загрузка…" : listExists() && listValid()
              ? "В списке нет заданий. Нажмите «Обновить список»."
              : "Нажмите «Обновить список», чтобы собрать задания базового каталога."}</div>
          }>{(entry, index) => (
            <div
              id={`${listId}-${index()}`} role="option" aria-selected={selected().has(entry.path)}
              class="task-launch-row"
              classList={{ "is-disabled": !entry.enabled, "is-selected": selected().has(entry.path), "is-active": activeIndex() === index() }}
              onClick={event => selectRow(index(), event)}
            >{entry.enabled ? "" : "*"}{entry.path}</div>
          )}</For>
        </div>
        <div class="task-launch-counts">
          <span>Всего: {entries().length}</span><span>Подключено: {enabledEntries().length}</span>
          <span>Выделено: {selected().size}</span><span class="task-launch-selection-hint">Выделение: Ctrl / Shift</span>
        </div>
        <Show when={confirmImport()}>
          <div class="task-launch-import-confirm">
            <span>Импорт заменит исходные данные включённых заданий. Продолжить?</span>
            <button type="button" disabled={!canLaunch()} onClick={() => launch("import")}>Выполнить импорт</button>
            <button type="button" onClick={() => setConfirmImport(false)}>Отмена</button>
          </div>
        </Show>
        <div class="task-launch-actions">
          <button type="button" disabled={!canLaunch()} onClick={() => launch("solver")}>Запустить расчёт</button>
          <button type="button" disabled={!canLaunch() || enabledEntries().length !== 1}
            title="Для клиента цепи требуется одно подключённое задание REAL64 с конфигурацией цепи."
            onClick={() => launch("circuit")}>Запустить клиента — эл. цепь</button>
          <button type="button" disabled={!canLaunch()} onClick={() => setConfirmImport(true)}>Запустить импорт данных</button>
        </div>
      </div>
    </FloatingWindow>
  );
}
