import { createEffect, createSignal } from "solid-js";
import { ValidationIndicator } from "./components/diagnostics/ValidationIndicator";
import { selectionService } from "./services/selectionService";
import {
  getFilePickerErrorMessage,
  getFileSystemAccessSupport,
  isFilePickerCancellation,
} from "./services/fileSystemAccessSupport";
import aboutIconUrl from "./assets/zaica.BMP";
import "./TaskInfoBar.css";

export function TaskInfoBar(props) {
  const [browseNotice, setBrowseNotice] = createSignal("");
  const [aboutOpen, setAboutOpen] = createSignal(false);

  let noticeDialog;
  let noticeButton;
  let aboutDialog;
  let aboutButton;
  let aboutCloseButton;

  const displayPath = () =>
    props.path ?? "Задание для редактирования не загружено";

  // Модальность обеспечивается нативным <dialog>: удержание фокуса,
  // блокировка страницы и закрытие по Esc — штатное поведение элемента.
  createEffect(() => {
    if (!noticeDialog) return;
    if (browseNotice()) {
      if (!noticeDialog.open) {
        noticeDialog.showModal();
        noticeButton?.focus();
      }
    } else if (noticeDialog.open) {
      noticeDialog.close();
    }
  });

  createEffect(() => {
    if (!aboutDialog) return;
    if (aboutOpen()) {
      if (!aboutDialog.open) {
        aboutDialog.showModal();
        aboutCloseButton?.focus();
      }
    } else if (aboutDialog.open) {
      aboutDialog.close();
    }
  });

  // Просмотр содержимого каталога задания: подкаталоги и файлы.
  // Диалог выбора каталога файлы не показывает, поэтому используется
  // диалог открытия файла. Результат намеренно не используется:
  // выбор задания не изменяется.
  async function handleBrowse() {
    const handle = selectionService.loadedTaskHandle();
    if (!handle) return;

    const support = getFileSystemAccessSupport(window, {
      requireOpenFilePicker: true,
    });
    if (!support.supported) {
      setBrowseNotice(support.message);
      return;
    }

    try {
      const picked = await window.showOpenFilePicker({
        id: "task-browse",
        startIn: handle,
        multiple: false,
        excludeAcceptAllOption: false,
      });
      // Системный диалог не является проводником: двойной щелчок по файлу
      // означает его выбор, а не запуск обработчика по умолчанию.
      if (picked?.length) {
        setBrowseNotice(
          "Работа с файлами в Проводнике выполняется через контекстное меню "
          + "при нажатии правой кнопки мыши.",
        );
      }
    } catch (error) {
      // Отмена выбора пользователем — штатная ситуация.
      if (isFilePickerCancellation(error)) return;

      console.error("Ошибка просмотра каталога задания", error);
      setBrowseNotice(
        getFilePickerErrorMessage(error, "просмотреть каталог задания"),
      );
    }
  }

  return (
    <div class="task-info-bar">
      <button
        class="menu-button"
        onClick={props.onMenuToggle}
        title="Дополнительные функции"
        aria-label="Открыть дополнительные функции"
        aria-expanded={props.menuOpen}
      >
        ☰
      </button>

      <div class="task-info-title">
        <div>Редактируемое</div>
        <div>задание</div>
      </div>

      <button
        class="validate-button"
        disabled={!props.path}
        onClick={handleBrowse}
        title="Просмотр каталога задания (выбор задания не изменяется)"
      >
        📂
      </button>

      <div class="task-info-path" title={props.path ?? ""}>
        {displayPath()}
      </div>

      <div class="validation-controls">
        <button
          ref={props.geometryViewerButtonRef}
          class="geometry-button"
          disabled={!props.path}
          onClick={props.onGeometryViewerToggle}
          title={props.geometryViewerOpen
            ? "Закрыть 3D-просмотр геометрии"
            : "Открыть 3D-просмотр геометрии"}
          aria-label={props.geometryViewerOpen
            ? "Закрыть 3D-просмотр геометрии"
            : "Открыть 3D-просмотр геометрии"}
          aria-pressed={props.geometryViewerOpen}
        >
          3D
        </button>

        <button
          class="validate-button"
          disabled={!props.path}
          onClick={props.onValidate}
        >
          Проверить модель
        </button>

        <ValidationIndicator onDiagnosticSelect={props.onDiagnosticSelect} />

        <button
          class="save-button"
          disabled={!props.path}
          onClick={props.onSave}
          title="Сохранить модель"
        >
          💾
        </button>

        <button
          ref={(el) => (aboutButton = el)}
          class="about-button"
          onClick={() => setAboutOpen(true)}
          title="О программе"
          aria-label="О программе"
          aria-haspopup="dialog"
        >
          <img
            class="about-button-image"
            src={aboutIconUrl}
            alt=""
            aria-hidden="true"
            draggable={false}
          />
        </button>
      </div>

      <dialog
        class="modal-window"
        ref={(el) => (noticeDialog = el)}
        onClose={() => setBrowseNotice("")}
      >
        <div class="modal-text">{browseNotice()}</div>
        <button
          class="validate-button"
          ref={(el) => (noticeButton = el)}
          onClick={() => setBrowseNotice("")}
        >
          Закрыть
        </button>
      </dialog>

      <dialog
        class="about-dialog"
        ref={(el) => (aboutDialog = el)}
        aria-labelledby="about-dialog-title"
        onClose={() => {
          setAboutOpen(false);
          aboutButton?.focus();
        }}
      >
        <h2 id="about-dialog-title" class="about-title">О программе E3D</h2>
        <p class="about-description">
          <span>Программа предназначена для подготовки,</span>
          <span>проверки, сохранения и визуализации</span>
          <span>исходных данных расчётных задач Clark,</span>
          <span>включая геометрию, параметры модели</span>
          <span>и характеристики материалов.</span>
        </p>
        <div class="about-separator" aria-hidden="true" />
        <div class="about-credits">
          <div>Разработчик: ChatGPT 5.6 Sol</div>
          <div class="about-curator-stack">
            <div>Куратор: Кулаев Ю.</div>
            <div>2026 г.</div>
            <button
              ref={(el) => (aboutCloseButton = el)}
              class="about-close-button"
              onClick={() => setAboutOpen(false)}
            >
              Закрыть
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
