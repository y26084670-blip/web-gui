//
// вкладка выбора задания
//
import { createSignal } from "solid-js";
import { selectionService } from "../services/selectionService";
import { diagnosticService } from "../services/diagnosticService";
import { modelService } from "../services/modelService";
import { DIRECTORIES } from "../services/schemas/common/constants";
import {
  getFilePickerErrorMessage,
  getFileSystemAccessSupport,
  isFilePickerCancellation,
} from "../services/fileSystemAccessSupport";

import "./Tasks.css";

export function Tasks() {
  // состояние компонента
  const [rootHandle, setRootHandle] = createSignal(null);
  const [rootName, setRootName] = createSignal("");
  const [projects, setProjects] = createSignal([]);
  const [selectedProject, setSelectedProject] = createSignal("");
  const [tasks, setTasks] = createSignal([]);
  const [selectedTask, setSelectedTask] = createSignal("");
  const loadedTaskHandle = selectionService.loadedTaskHandle;
  const [taskErrorMessage, setTaskErrorMessage] = createSignal("");

  let taskErrorDialog;
  let taskErrorCloseButton;
  let selectionRevision = 0;

  // Сброс данных прежнего задания выполняется до любой новой загрузки.
  const clearLoadedTaskState = () => {
    selectionService.setLoadedTaskHandle(null);
    selectionService.setLoadedTaskPath(null);
    modelService.clearModel();
    diagnosticService.clearDiagnostics();
    diagnosticService.clearLoadResult();
  };

  const invalidateTaskSelection = () => {
    selectionRevision += 1;
    clearLoadedTaskState();
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
      const handle = await window.showDirectoryPicker();
      const requestId = invalidateTaskSelection();
      setRootHandle(handle);
      setRootName("Корневой каталог: " + handle.name);
      setProjects([]);
      setSelectedProject("");
      setTasks([]);
      setSelectedTask("");

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
    const requestId = invalidateTaskSelection();
    setSelectedProject(projectName);
    setTasks([]);
    setSelectedTask("");
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
  const handleTaskClick = async (task) => {
    const requestId = invalidateTaskSelection();
    setSelectedTask(task.name);

    try {
      const root = rootHandle();
      if (!root) return;

      const [, fullPath] = await Promise.all([
        task.handle.getDirectoryHandle(DIRECTORIES.INPUT),
        getFullPath(root, task.handle),
      ]);
      if (requestId !== selectionRevision) return;

      console.log("Выбранное задание:", fullPath);
      selectionService.setLoadedTaskHandle(task.handle);
      selectionService.setLoadedTaskPath(fullPath);
    } catch (error) {
      if (requestId !== selectionRevision) return;
      if (error?.name === "NotFoundError") {
        showLoadError(task.name);
        return;
      }
      console.error("Ошибка обработки задания:", error);
    }
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
                  selected: selectedTask() === task.name,
                }}
                onClick={() => handleTaskClick(task)}
              >
                {task.name}
              </div>
            ))}
          </div>
          <h4 style="margin-bottom: 5px">Текущее выбранное задание:</h4>
          <div>{loadedTaskHandle() ? loadedTaskHandle().name : "—"}</div>
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
    </div>
  );
}
