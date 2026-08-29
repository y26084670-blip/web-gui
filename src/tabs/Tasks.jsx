//
// вкладка выбора задания
//
import { createSignal } from "solid-js";
import { selectionService } from "../services/selectionService";
import { diagnosticService } from "../services/diagnosticService";
import { modelService } from "../services/modelService";
import { unsavedChangesService } from "../services/unsavedChangesService.js";
import { DIRECTORIES } from "../services/schemas/common/constants";
import {
  getFilePickerErrorMessage,
  getFileSystemAccessSupport,
  isFilePickerCancellation,
} from "../services/fileSystemAccessSupport";

import "./Tasks.css";

export function Tasks(props) {
  // состояние компонента
  const [rootHandle, setRootHandle] = createSignal(null);
  const [rootName, setRootName] = createSignal("");
  const [projects, setProjects] = createSignal([]);
  const [selectedProject, setSelectedProject] = createSignal("");
  const [tasks, setTasks] = createSignal([]);
  const [selectedTask, setSelectedTask] = createSignal(null);
  const loadedTaskHandle = selectionService.loadedTaskHandle;
  const [taskErrorMessage, setTaskErrorMessage] = createSignal("");
  const [pendingTaskLoad, setPendingTaskLoad] = createSignal(null);

  let taskErrorDialog;
  let taskErrorCloseButton;
  let unsavedDialog;
  let returnToEditingButton;
  let selectionRevision = 0;
  let taskLoadRevision = 0;

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
      const requestId = invalidateBrowserSelection();
      setRootHandle(handle);
      setRootName("Корневой каталог: " + handle.name);
      setProjects([]);
      setSelectedProject("");
      setTasks([]);
      setSelectedTask(null);

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

  const selectTaskCandidate = (task) => {
    taskLoadRevision += 1;
    setSelectedTask(task);
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
        "grid-template-columns": "500px 0.5fr 1fr",
        gap: "10px",
        width: "98%",
        position: "fixed",
        top: "90px",
        bottom: "10px",
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
              Выбрать каталог с проектами
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
            Загрузить для редактирования
          </button>
        </div>
      </div>
      <div
        style={{
          border: "3px solid #161414",
          padding: "20px",
          background: "lightgray",
        }}
      >
        <h4> Вторая ячейка 1 (пустая) </h4>
      </div>
      <div
        style={{
          border: "3px solid #161414",
          padding: "20px",
          background: "lightgray",
        }}
      >
        <h4> Третья ячейка 1 (пустая) </h4>
      </div>

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
