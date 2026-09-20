//
// вкладка выбора задания
//
import { Show, batch, createSignal, onCleanup, onMount } from "solid-js";
import { selectionService } from "../services/selectionService";
import { diagnosticService } from "../services/diagnosticService";
import { modelService } from "../services/modelService";
import { unsavedChangesService } from "../services/unsavedChangesService.js";
import { DEMO_TASK_NAME, loadDemoTask } from "../services/demoTaskService.js";
import { DIRECTORIES } from "../services/schemas/common/constants";
import { TaskGeometryPreview } from "../components/geometry/TaskGeometryPreview.jsx";
import { TaskLaunchWindow } from "../components/tasks/TaskLaunchWindow.jsx";
import {
  prepareWorkspaceBinding,
  readWorkspaceBinding,
} from "../services/taskLaunchService.js";
import {
  readTaskResultsSummary,
  readTaskSummary,
} from "../services/taskSummaryService.js";
import {
  getFilePickerErrorMessage,
  getFileSystemAccessSupport,
  isFilePickerCancellation,
} from "../services/fileSystemAccessSupport";

import "./Tasks.css";

const PROJECTS_ROOT_NAME = "clark.projects";
const EMPTY_TASK_INFO = Object.freeze({
  summaryText: "",
});

export function Tasks(props) {
  // состояние компонента
  const [rootHandle, setRootHandle] = createSignal(null);
  const [rootName, setRootName] = createSignal("");
  const [projects, setProjects] = createSignal([]);
  const [selectedProject, setSelectedProject] = createSignal("");
  const [tasks, setTasks] = createSignal([]);
  const [selectedTask, setSelectedTask] = createSignal(null);
  const loadedTaskHandle = selectionService.loadedTaskHandle;
  const loadedTaskPath = selectionService.loadedTaskPath;
  const [taskErrorMessage, setTaskErrorMessage] = createSignal("");
  const [pendingTaskLoad, setPendingTaskLoad] = createSignal(null);
  const [taskInfo, setTaskInfo] = createSignal(EMPTY_TASK_INFO);
  const [taskResultsText, setTaskResultsText] = createSignal("");
  const [demoLoading, setDemoLoading] = createSignal(false);
  const [taskLaunchOpen, setTaskLaunchOpen] = createSignal(false);
  const [previewRevision, setPreviewRevision] = createSignal(1);
  const [workspaceBinding, setWorkspaceBinding] = createSignal(null);
  const [bindingBusy, setBindingBusy] = createSignal(false);
  const [bindUri, setBindUri] = createSignal("");
  const [bindingNotice, setBindingNotice] = createSignal("");
  const [launchBusy, setLaunchBusy] = createSignal(false);

  let taskErrorDialog;
  let taskErrorCloseButton;
  let unsavedDialog;
  let returnToEditingButton;
  let selectionRevision = 0;
  let taskLoadRevision = 0;
  let taskInfoRevision = 0;
  let directoryPickRevision = 0;
  let bindingRevision = 0;
  let bindingPolling = false;
  let disposed = false;

  // Сброс данных прежнего задания выполняется до любой новой загрузки.
  const clearLoadedTaskState = () => {
    selectionService.setLoadedTaskHandle(null);
    selectionService.setLoadedTaskPath(null);
    selectionService.setLoadedTaskIsDemo(false);
    modelService.clearModel();
    diagnosticService.clearDiagnostics();
    diagnosticService.clearLoadResult();
  };

  const invalidateBrowserSelection = () => {
    selectionRevision += 1;
    taskLoadRevision += 1;
    taskInfoRevision += 1;
    return selectionRevision;
  };

  const showTaskError = (message) => {
    setTaskErrorMessage(message);
    queueMicrotask(() => {
      if (!taskErrorDialog.open) {
        taskErrorDialog.showModal();
      }
      taskErrorCloseButton?.focus();
    });
  };

  const showLoadError = (taskName) => {
    showTaskError(
      `Данные задания «${taskName}» не загружены: обязательный каталог `
      + `«${DIRECTORIES.INPUT}» отсутствует.`,
    );
  };

  const bindingIsCurrent = (root, revision) => !disposed
    && root === rootHandle() && revision === bindingRevision;
  const bindingDisabled = () => !rootHandle() || bindingBusy() || launchBusy()
    || workspaceBinding()?.bindingState === "bound";

  const resetWorkspaceBinding = () => {
    bindingRevision += 1;
    setWorkspaceBinding(null);
    setBindingBusy(false);
    setBindUri("");
    setBindingNotice("");
  };

  function openBindingUri(uri) {
    // Keep the prepared URI until confirmation, so a retry uses a direct click.
    setBindingNotice("Выберите в окне Решателя тот же базовый каталог «"
      + rootHandle().name + "». После отмены можно нажать «Связать с Решателем» повторно.");
    window.location.href = uri;
  }

  async function bindWorkspace() {
    if (bindingDisabled()) return;
    const root = rootHandle();
    const revision = bindingRevision;
    setBindingBusy(true);
    try {
      if (bindUri()) {
        openBindingUri(bindUri());
        return;
      }
      const prepared = await prepareWorkspaceBinding(root);
      if (!bindingIsCurrent(root, revision)) return;
      setWorkspaceBinding({ workspaceId: prepared.workspaceId, bindingState: "pending" });
      setBindUri(prepared.uri);
      if (navigator.userActivation && !navigator.userActivation.isActive) {
        setBindingNotice("Подготовка завершена. Нажмите «Связать с Решателем» ещё раз, "
          + "чтобы открыть выбор каталога в Windows.");
      } else openBindingUri(prepared.uri);
    } catch (error) {
      if (bindingIsCurrent(root, revision)) {
        showTaskError("Не удалось связать каталог с Решателем: "
          + (error?.message || String(error)));
      }
    } finally {
      if (bindingIsCurrent(root, revision)) setBindingBusy(false);
    }
  }

  async function pollWorkspaceBinding() {
    const expected = workspaceBinding();
    if (disposed || bindingPolling || bindingBusy()
      || expected?.bindingState !== "pending" || !rootHandle()) return;
    const root = rootHandle();
    const revision = bindingRevision;
    bindingPolling = true;
    try {
      const marker = await readWorkspaceBinding(root);
      if (!bindingIsCurrent(root, revision)
        || workspaceBinding()?.workspaceId !== expected.workspaceId) return;
      if (marker?.workspaceId === expected.workspaceId && marker.bindingState === "bound") {
        batch(() => {
          setWorkspaceBinding(marker);
          setBindUri("");
          setBindingNotice("Каталог связан с Решателем.");
        });
      }
    } catch {
      // The native handler may be replacing the marker; retry on the next poll.
    } finally {
      bindingPolling = false;
    }
  }

  onMount(() => {
    const timer = window.setInterval(() => { void pollWorkspaceBinding(); }, 1000);
    const onFocus = () => { void pollWorkspaceBinding(); };
    window.addEventListener("focus", onFocus);
    onCleanup(() => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    });
  });
  onCleanup(() => { disposed = true; bindingRevision += 1; directoryPickRevision += 1; });

  // получение полного пути
  const getFullPath = async (root, handle) => {
    const segments = await root.resolve(handle);
    if (!segments) return root.name;
    return root.name + "/" + segments.join("/");
  };

  // получение списка подкаталогов
  const getSubdirs = async (dirHandle) => {
    const dirs = [];
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind === "directory") {
        dirs.push({
          name,
          handle,
        });
      }
    }
    return dirs;
  };

  // выбор корневого каталога
  const handlePickDirectory = async () => {
    if (bindingBusy() || launchBusy()) return;
    const support = getFileSystemAccessSupport(window);
    if (!support.supported) {
      showTaskError(support.message);
      return;
    }

    const pickRevision = ++directoryPickRevision;
    try {
      const handle = await window.showDirectoryPicker({
        mode: "readwrite",
      });
      const previous = rootHandle();
      const sameDirectory = previous ? await previous.isSameEntry(handle) : false;
      if (disposed || pickRevision !== directoryPickRevision) return;
      const requestId = invalidateBrowserSelection();
      if (!sameDirectory) resetWorkspaceBinding();
      setRootHandle(sameDirectory ? previous : handle);
      setRootName("Корневой каталог: " + handle.name);
      setProjects([]);
      setSelectedProject("");
      setTasks([]);
      setSelectedTask(null);
      setTaskInfo(EMPTY_TASK_INFO);
      setTaskResultsText("");

      const subdirs = await getSubdirs(handle);
      if (requestId !== selectionRevision) return;
      setProjects(subdirs);
    } catch (error) {
      // Отмена выбора пользователем — штатная ситуация.
      if (isFilePickerCancellation(error)) return;

      console.error("Ошибка выбора каталога", error);
      showTaskError(
        getFilePickerErrorMessage(error, "выбрать каталог с проектами"),
      );
    }
  };

  // выбор проекта
  const handleProjectChange = async (event) => {
    const projectName = event.currentTarget.value;
    const requestId = invalidateBrowserSelection();
    setSelectedProject(projectName);
    setTasks([]);
    setSelectedTask(null);
    setTaskInfo(EMPTY_TASK_INFO);
    setTaskResultsText("");
    if (!projectName) return;
    try {
      const root = rootHandle();
      if (!root) return;
      const projectHandle = await root.getDirectoryHandle(projectName);
      const taskDirs = await getSubdirs(projectHandle);
      if (requestId !== selectionRevision) return;
      setTasks(taskDirs);
    } catch (error) {
      console.error(
        "Ошибка получения списка заданий выбранного проекта",
        error,
      );
    }
  };

  // выбор задания
  const commitTaskLoad = ({ task, fullPath }) => {
    batch(() => {
      clearLoadedTaskState();
      selectionService.setLoadedTaskIsDemo(task.isDemo === true);
      selectionService.setLoadedTaskPath(fullPath);
      selectionService.setLoadedTaskHandle(task.handle);
    });
    if (task.isDemo) void selectTaskCandidate(task);
    console.log("Выбранное задание:", fullPath);
  };

  const selectTaskCandidate = async (task) => {
    taskLoadRevision += 1;
    const requestId = ++taskInfoRevision;
    setSelectedTask(task);
    setTaskInfo(EMPTY_TASK_INFO);
    setTaskResultsText("");

    const isCurrentSelection = () => !(
      requestId !== taskInfoRevision
      || selectedTask()?.handle !== task.handle
    );

    // Сводки читаются независимо: задержка или ошибка одной не скрывает другую.
    // Повторный выбор той же строки также перечитывает файлы после расчёта.
    await Promise.all([
      (async () => {
        try {
          const info = await readTaskSummary(task.handle);
          if (isCurrentSelection()) setTaskInfo(info);
        } catch (error) {
          if (!isCurrentSelection()) return;
          console.error("Ошибка чтения информации о выбранном задании:", error);
          setTaskInfo({
            summaryText: "Ошибка чтения информации о задании: "
              + (error?.message || error?.name || String(error)),
          });
        }
      })(),
      (async () => {
        try {
          const text = await readTaskResultsSummary(task.handle);
          if (isCurrentSelection()) setTaskResultsText(text);
        } catch (error) {
          if (!isCurrentSelection()) return;
          console.error("Ошибка чтения результатов расчёта:", error);
          setTaskResultsText("Ошибка чтения результатов расчёта: "
            + (error?.message || error?.name || String(error)));
        }
      })(),
    ]);
  };

  const offerTaskLoad = (request) => {
    if (loadedTaskHandle() && unsavedChangesService.hasDirty()) {
      setPendingTaskLoad(request);
      queueMicrotask(() => {
        if (!unsavedDialog.open) unsavedDialog.showModal();
        returnToEditingButton?.focus();
      });
      return;
    }
    commitTaskLoad(request);
  };

  const handleLaunchComplete = async (entries, action) => {
    const root = rootHandle();
    const task = selectedTask();
    if (!root || !task || task.isDemo) return;
    const segments = await root.resolve(task.handle);
    if (root !== rootHandle() || task !== selectedTask() || !segments) return;
    const relativePath = segments.join("/").toLowerCase();
    if (!entries.some(entry => entry.enabled && entry.path.toLowerCase() === relativePath)) return;
    if (action === "import") setPreviewRevision(value => value + 1);
    await selectTaskCandidate(task);
  };

  const requestDemoLoad = async () => {
    if (demoLoading()) return;
    const requestId = ++taskLoadRevision;
    setDemoLoading(true);
    try {
      const handle = await loadDemoTask();
      if (requestId !== taskLoadRevision) return;
      offerTaskLoad({
        task: { name: DEMO_TASK_NAME, handle, isDemo: true },
        fullPath: DEMO_TASK_NAME,
      });
    } catch (error) {
      if (requestId !== taskLoadRevision) return;
      showTaskError(
        "Демонстрационная задача не загружена: "
        + (error?.message || error?.name || String(error)),
      );
    } finally {
      setDemoLoading(false);
    }
  };

  const requestTaskLoad = async () => {
    const task = selectedTask();
    if (!task || task.handle === loadedTaskHandle()) return;
    const requestId = ++taskLoadRevision;

    try {
      const root = rootHandle();
      if (!root) return;

      const [, fullPath] = await Promise.all([
        task.handle.getDirectoryHandle(DIRECTORIES.INPUT),
        getFullPath(root, task.handle),
      ]);
      if (requestId !== taskLoadRevision) return;

      offerTaskLoad({ task, fullPath });
    } catch (error) {
      if (requestId !== taskLoadRevision) return;
      if (error?.name === "NotFoundError") {
        showLoadError(task.name);
        return;
      }
      console.error("Ошибка обработки задания:", error);
    }
  };

  const confirmTaskLoad = () => {
    const request = pendingTaskLoad();
    if (!request) return;
    setPendingTaskLoad(null);
    unsavedDialog.close();
    commitTaskLoad(request);
  };

  const returnToEditing = () => {
    setPendingTaskLoad(null);
    unsavedDialog.close();
    props.onReturnToEditing?.();
  };

  const taskLoaded = () =>
    Boolean(selectedTask()?.handle)
    && selectedTask()?.handle === loadedTaskHandle();

  return (
    <div
      class="tasks-layout"
      style={{
        "grid-template-columns": props.summaryBounds
          ? `calc(${props.summaryBounds.left}px - var(--tasks-panel-gap)) `
            + `${props.summaryBounds.width}px minmax(360px, 1fr)`
          : undefined,
      }}
    >
      <div
        class="task-browser-panel"
        style={{
          border: "3px solid #161414",
          padding: "20px",
          background: "lightgray",
        }}
      >
        <div class="task-browser-content">
          <div>
            <div class="task-directory-actions">
              <div class="task-directory-buttons">
                <button
                  id="pickDir"
                  disabled={bindingBusy() || launchBusy()}
                  title={`Базовый каталог с проектами, обычно ${PROJECTS_ROOT_NAME}`}
                  onClick={handlePickDirectory}
                >
                  Выбрать каталог с проектами
                </button>
                <button
                  type="button"
                  class="task-bind-button"
                  classList={{ "is-bound": workspaceBinding()?.bindingState === "bound" }}
                  disabled={bindingDisabled()}
                  aria-busy={bindingBusy()}
                  title={workspaceBinding()?.bindingState === "bound"
                    ? "Связь с Решателем для выбранного базового каталога установлена"
                    : "Связать выбранный базовый каталог с установленным Решателем"}
                  onClick={bindWorkspace}
                >
                  {workspaceBinding()?.bindingState === "bound"
                    ? "Решатель доступен" : "Связать с Решателем"}
                </button>
              </div>
              <p class="task-directory-hint">
                Для подготовки к запуску расчетов из редактора выполнить:
                «Связать с Решателем» →
                «Формирование списка заданий и запуск решателей или импорта» →
                «Обновить список» → выделить задания →
                «Подключить» → «Запустить расчёт».
              </p>
              <Show when={rootHandle()}>
                <p class="task-binding-status" role="status"
                  classList={{ "is-unbound": workspaceBinding()?.bindingState !== "bound" }}>
                  {bindingNotice() || "Каталог не связан с Решателем."}
                </p>
              </Show>
            </div>
            <span id="rootName">{rootName()}</span>
            <p></p>
          </div>
          <div class="box">
            <h4>Список проектов</h4>
            <select
              id="listProject"
              value={selectedProject()}
              onChange={handleProjectChange}
            >
              <option value="">Выбрать проект</option>
              {projects().map((project) => (
                <option value={project.name}>{project.name}</option>
              ))}
            </select>
          </div>
          <div class="task-list-group">
            <div class="task-list-heading">
              <h4>Список заданий выбранного проекта</h4>
              <button
                type="button"
                class="task-demo-button"
                disabled={demoLoading()}
                aria-busy={demoLoading()}
                title="Загрузить демонстрационную задачу для редактирования"
                onClick={requestDemoLoad}
              >
                Демо
              </button>
            </div>
            <div
              id="listTask"
              class="listTask"
              tabIndex="0"
            >
              {tasks().map((task) => (
                <div
                  classList={{
                    "listTask-item": true,
                    selected: selectedTask()?.handle === task.handle,
                  }}
                  onClick={() => selectTaskCandidate(task)}
                >
                  {task.name}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div class="task-browser-actions">
          <button
            class="task-load-button"
            disabled={!selectedTask() || taskLoaded()}
            onClick={requestTaskLoad}
          >
            <span class="task-load-label">
              <span class="task-load-leading">
                <Show keyed when={loadedTaskPath()}>
                  {() => (
                    <span
                      class="task-load-confirmation"
                      role="status"
                      aria-label="Задание загружено"
                      title="Задание загружено"
                    >
                      ✓
                    </span>
                  )}
                </Show>
              </span>
              <span class="task-load-text">Загрузить для редактирования</span>
              <span class="task-load-trailing" aria-hidden="true" />
            </span>
          </button>
          <button
            type="button"
            class="task-launch-open-button"
            disabled={!rootHandle()}
            onClick={() => setTaskLaunchOpen(true)}
          >
            Формирование списка заданий и запуск решателей или импорта
          </button>
        </div>
        <div class="task-panel-caption">выбор задания</div>
      </div>
      <div
        class="task-summary-panel"
        style={{
          border: "3px solid #161414",
          padding: "20px",
          background: "lightgray",
        }}
      >
        <Show when={previewRevision()} keyed>
          {() => (
            <TaskGeometryPreview
              taskHandle={selectedTask()?.handle}
              active={props.active}
            />
          )}
        </Show>
        <div class="task-summary-content">
          <textarea
            class="task-summary-text"
            aria-label="Информация о выбранном задании"
            readOnly
            value={taskInfo().summaryText}
          />
        </div>
        <div class="task-panel-caption">исходные данные</div>
      </div>

      <section class="task-results-panel" aria-label="Результаты расчёта">
        <textarea
          class="task-results-text"
          aria-label="Сводка результатов расчёта выбранного задания"
          readOnly
          wrap="off"
          spellcheck={false}
          value={taskResultsText()}
        />
        <div class="task-panel-caption">результаты</div>
      </section>

      <TaskLaunchWindow
        open={taskLaunchOpen() && props.active !== false}
        rootHandle={rootHandle()}
        binding={workspaceBinding()}
        bindingBusy={bindingBusy()}
        onBusyChange={setLaunchBusy}
        onClose={() => setTaskLaunchOpen(false)}
        onSave={props.onSave}
        onBeforeImport={(_entries, loadedIncluded) => {
          if (loadedIncluded) clearLoadedTaskState();
        }}
        onLaunchComplete={handleLaunchComplete}
      />

      <dialog
        class="task-load-error-dialog"
        ref={(el) => (taskErrorDialog = el)}
        onClose={() => setTaskErrorMessage("")}
      >
        <p>{taskErrorMessage()}</p>
        <button
          ref={(el) => (taskErrorCloseButton = el)}
          onClick={() => taskErrorDialog.close()}
        >
          Закрыть
        </button>
      </dialog>

      <dialog
        class="task-unsaved-dialog"
        ref={(el) => (unsavedDialog = el)}
        onCancel={(event) => event.preventDefault()}
      >
        <p>
          В редакторе есть несохранённые изменения. Загрузить другое задание
          без сохранения текущих данных?
        </p>
        <div class="task-unsaved-actions">
          <button onClick={confirmTaskLoad}>
            Загрузить без сохранения
          </button>
          <button
            ref={(el) => (returnToEditingButton = el)}
            onClick={returnToEditing}
          >
            Вернуться к редактированию
          </button>
        </div>
      </dialog>
    </div>
  );
}
