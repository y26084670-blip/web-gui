//
// вкладка выбора задания
//
import { Show, createSignal } from "solid-js";
import { selectionService } from "../services/selectionService";
import { diagnosticService } from "../services/diagnosticService";
import { modelService } from "../services/modelService";
import { unsavedChangesService } from "../services/unsavedChangesService.js";
import { DIRECTORIES } from "../services/schemas/common/constants";
import { TaskGeometryPreview } from "../components/geometry/TaskGeometryPreview.jsx";
import {
  TASK_SUMMARY_TEXT,
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
  legacyImportAvailable: false,
});
const HELP_TOPICS = Object.freeze([
  "Куда коня впрягать",
  "Как установить",
  "Как пользоваться",
  "Как пользоваться редактором",
  "Как выбрать/создать/удалить проект",
  "Как выбрать/создать/удалить задачу",
  "Как создать данные",
  "Как импортировать данные",
  "Как создать/исправить/удалить геометрию",
  "Как создать/исправить/удалить свойства",
  "Как найти/исправить ошибки/неточности",
  "Как осмотреть работу",
  "Как сохранить работу",
  "Как затребовать нужное, но отсутствующее",
  "Как перестать пользоваться всем этим",
]);

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
  const [selectedHelpTopic, setSelectedHelpTopic] = createSignal("");

  let taskErrorDialog;
  let taskErrorCloseButton;
  let unsavedDialog;
  let returnToEditingButton;
  let selectionRevision = 0;
  let taskLoadRevision = 0;
  let taskInfoRevision = 0;

  // Сброс данных прежнего задания выполняется до любой новой загрузки.
  const clearLoadedTaskState = () => {
    selectionService.setLoadedTaskHandle(null);
    selectionService.setLoadedTaskPath(null);
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
    const support = getFileSystemAccessSupport(window);
    if (!support.supported) {
      showTaskError(support.message);
      return;
    }

    try {
      const handle = await window.showDirectoryPicker({
        mode: "readwrite",
      });
      if (!props.admin && handle.name !== PROJECTS_ROOT_NAME) {
        showTaskError(
          `Выберите каталог «${PROJECTS_ROOT_NAME}». `
          + `Выбран каталог «${handle.name}».`,
        );
        return;
      }
      const requestId = invalidateBrowserSelection();
      setRootHandle(handle);
      setRootName("Корневой каталог: " + handle.name);
      setProjects([]);
      setSelectedProject("");
      setTasks([]);
      setSelectedTask(null);
      setTaskInfo(EMPTY_TASK_INFO);

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
    clearLoadedTaskState();
    console.log("Выбранное задание:", fullPath);
    selectionService.setLoadedTaskHandle(task.handle);
    selectionService.setLoadedTaskPath(fullPath);
  };

  const selectTaskCandidate = async (task) => {
    taskLoadRevision += 1;
    const requestId = ++taskInfoRevision;
    setSelectedTask(task);
    setTaskInfo(EMPTY_TASK_INFO);

    try {
      const info = await readTaskSummary(task.handle);
      if (
        requestId !== taskInfoRevision
        || selectedTask()?.handle !== task.handle
      ) return;
      setTaskInfo(info);
    } catch (error) {
      if (requestId !== taskInfoRevision) return;
      console.error("Ошибка чтения информации о выбранном задании:", error);
      setTaskInfo({
        summaryText: TASK_SUMMARY_TEXT.NO_INFORMATION,
        legacyImportAvailable: false,
      });
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

      const request = { task, fullPath };
      if (loadedTaskHandle() && unsavedChangesService.hasDirty()) {
        setPendingTaskLoad(request);
        queueMicrotask(() => {
          if (!unsavedDialog.open) unsavedDialog.showModal();
          returnToEditingButton?.focus();
        });
        return;
      }

      commitTaskLoad(request);
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
  return (
    <div
      style={{
        display: "grid",
        "grid-template-columns": "500px 0.6fr 0.9fr",
        gap: "10px",
        width: "100%",
        height: "100%",
        position: "absolute",
        inset: "0",
        "min-height": "0",
        overflow: "auto",
        "box-sizing": "border-box",
      }}
    >
      <div
        style={{
          border: "3px solid #161414",
          padding: "20px",
          background: "lightgray",
        }}
      >
        <div>
          <span>
            <button id="pickDir" onClick={handlePickDirectory}>
              {props.admin
                ? "Выбрать каталог с проектами"
                : "Выбрать каталог clark.projects"}
            </button>
            <p></p>
          </span>
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
        <div>
          <h4 style="margin-bottom: 10px">Список заданий выбранного проекта</h4>
          <div id="listTask" class="listTask">
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
          <button
            class="task-load-button"
            disabled={
              !selectedTask()
              || selectedTask()?.handle === loadedTaskHandle()
            }
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
        </div>
      </div>
      <div
        class="task-summary-panel"
        style={{
          border: "3px solid #161414",
          padding: "20px",
          background: "lightgray",
        }}
      >
        <TaskGeometryPreview
          taskHandle={selectedTask()?.handle}
          active={props.active}
        />
        <div class="task-summary-content">
          <textarea
            class="task-summary-text"
            aria-label="Информация о выбранном задании"
            readOnly
            value={taskInfo().summaryText}
          />
          <Show when={taskInfo().legacyImportAvailable}>
            <div class="task-legacy-import">
              {TASK_SUMMARY_TEXT.LEGACY_IMPORT}
            </div>
          </Show>
        </div>
      </div>
      <aside class="task-help-panel" aria-label="Справка">
        <section class="task-help-chat" aria-label="Чат справки">
          <div
            class="task-help-chat-messages"
            role="log"
            aria-live="polite"
          >
            <Show
              when={selectedHelpTopic()}
              fallback={(
                <p class="task-help-chat-placeholder">
                  Выберите тему справки или задайте вопрос
                </p>
              )}
            >
              {(topic) => (
                <p class="task-help-chat-topic">Тема: {topic()}</p>
              )}
            </Show>
          </div>

          <div class="task-help-chat-composer">
            <textarea
              rows="3"
              aria-label="Вопрос справочной системе"
              placeholder="Задайте вопрос…"
            />
            <button
              type="button"
              class="task-help-voice-button"
              aria-label="Голосовая связь"
              title="Голосовая связь"
            >
              <span aria-hidden="true">🔊</span>
            </button>
            <button
              type="button"
              class="task-help-send-button"
              title="Отправить вопрос"
            >
              Отправить
            </button>
          </div>
        </section>

        <nav class="task-help-topics" aria-label="Темы справки">
          {HELP_TOPICS.map((topic) => (
            <button
              type="button"
              classList={{
                "task-help-topic": true,
                selected: selectedHelpTopic() === topic,
              }}
              aria-pressed={selectedHelpTopic() === topic}
              onClick={() => setSelectedHelpTopic(topic)}
            >
              {topic}
            </button>
          ))}
        </nav>
      </aside>

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
