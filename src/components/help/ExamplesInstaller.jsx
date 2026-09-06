import { Show, createEffect, createSignal, createUniqueId, onCleanup } from "solid-js";
import {
  getFilePickerErrorMessage,
  getFileSystemAccessSupport,
  isFilePickerCancellation,
} from "../../services/fileSystemAccessSupport";
import {
  installExamples,
  validateExamplesUrl,
} from "../../services/examplesService";
import "./ExamplesInstaller.css";

const numberFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });

function formatBytes(value = 0) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${numberFormatter.format(bytes)} Б`;
  if (bytes < 1024 * 1024) return `${numberFormatter.format(bytes / 1024)} КБ`;
  return `${numberFormatter.format(bytes / (1024 * 1024))} МБ`;
}

export function ExamplesInstaller(props) {
  const inputId = createUniqueId();
  const descriptionId = createUniqueId();
  const errorId = createUniqueId();
  const [url, setUrl] = createSignal("");
  const [fieldError, setFieldError] = createSignal("");
  const [notice, setNotice] = createSignal("");
  const [failed, setFailed] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [cancelling, setCancelling] = createSignal(false);
  const [progress, setProgress] = createSignal(null);
  const [result, setResult] = createSignal(null);
  let input;
  let configController;
  let operationController;
  let configLoaded = false;
  let urlEdited = false;
  let disposed = false;

  async function loadDefaultUrl() {
    if (configLoaded || configController || urlEdited) return;
    const controller = new AbortController();
    configController = controller;
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}examples-config.json`, {
        signal: controller.signal,
        credentials: "omit",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Не удалось загрузить адрес примеров.");
      const config = await response.json();
      if (controller.signal.aborted || disposed) return;
      configLoaded = true;
      if (!urlEdited && typeof config?.url === "string") {
        setUrl(config.url);
        if (config.url.trim()) setFieldError("");
      }
    } catch (error) {
      if (controller.signal.aborted || disposed) return;
      configLoaded = true;
      if (!urlEdited) {
        setNotice("Не удалось получить адрес примеров. Укажите URL ZIP-архива ниже.");
      }
    } finally {
      if (configController === controller) configController = undefined;
    }
  }

  function cancelInstallation() {
    if (!operationController || operationController.signal.aborted) return;
    setCancelling(true);
    setNotice("Отмена развёртывания…");
    operationController.abort();
  }

  createEffect(() => {
    if (props.open) {
      void loadDefaultUrl();
    } else {
      configController?.abort();
      configController = undefined;
      cancelInstallation();
    }
  });

  onCleanup(() => {
    disposed = true;
    configController?.abort();
    operationController?.abort();
  });

  async function handleInstall() {
    if (busy()) return;
    setFieldError("");
    setFailed(false);

    let downloadUrl;
    try {
      downloadUrl = validateExamplesUrl(url());
    } catch (error) {
      setFieldError(error?.message || "Укажите URL ZIP-архива с примерами.");
      input?.focus();
      return;
    }

    const support = getFileSystemAccessSupport(window);
    if (!support.supported) {
      setFailed(true);
      setNotice(support.message);
      return;
    }

    const controller = new AbortController();
    operationController = controller;
    setBusy(true);
    setCancelling(false);
    setProgress(null);
    setResult(null);
    setNotice("Выберите папку для примеров.");
    let destinationHandle;

    try {
      // The picker must run in the click gesture, before any network await.
      destinationHandle = await window.showDirectoryPicker({
        mode: "readwrite",
        id: "clark-examples",
      });
      if (controller.signal.aborted) throw new DOMException("Отменено", "AbortError");
      setNotice("Развёртывание примеров…");
      const installed = await installExamples({
        url: downloadUrl,
        destinationHandle,
        signal: controller.signal,
        onProgress(update) {
          if (!disposed && !controller.signal.aborted) {
            setProgress((previous) => ({ ...previous, ...update }));
          }
        },
      });
      if (disposed) return;
      setResult(installed);
      setNotice(`Примеры развернуты в папке «${installed.rootName}».`);
    } catch (error) {
      if (disposed) return;
      if (error?.partialResult) setResult(error.partialResult);
      if (controller.signal.aborted || isFilePickerCancellation(error)) {
        setNotice(destinationHandle
          ? "Развёртывание отменено. Уже записанные файлы сохранены."
          : "Выбор папки отменён.");
      } else {
        setFailed(true);
        setNotice(destinationHandle
          ? (error?.message || "Не удалось развернуть примеры. Повторите попытку.")
          : getFilePickerErrorMessage(error, "выбрать папку для примеров"));
      }
    } finally {
      if (operationController === controller) {
        operationController = undefined;
        if (!disposed) {
          setBusy(false);
          setCancelling(false);
        }
      }
    }
  }

  const isDownloading = () => progress()?.phase === "download";
  const downloadPercent = () => progress()?.totalDownloadBytes > 0
    ? Math.min(100, Math.round(100 * (progress()?.downloadedBytes || 0) / progress().totalDownloadBytes))
    : undefined;
  const counts = () => result() || progress();

  return (
    <div class="examples-installer" aria-label="Развёртывание примеров">
      <div class="examples-installer-actions">
        <button type="button" disabled={busy()} onClick={handleInstall}>
          Развернуть примеры
        </button>
        <Show when={busy()}>
          <button
            type="button"
            class="examples-installer-cancel"
            disabled={cancelling()}
            onClick={cancelInstallation}
          >
            {cancelling() ? "Отмена…" : "Отменить"}
          </button>
        </Show>
      </div>
      <label class="examples-installer-label" for={inputId}>URL ZIP-архива с примерами</label>
      <input
        ref={(element) => (input = element)}
        id={inputId}
        class="examples-installer-url"
        type="url"
        inputmode="url"
        autocomplete="off"
        spellcheck={false}
        placeholder="https://example.org/examples.zip"
        value={url()}
        disabled={busy()}
        aria-invalid={Boolean(fieldError())}
        aria-describedby={`${descriptionId}${fieldError() ? ` ${errorId}` : ""}`}
        onInput={(event) => {
          urlEdited = true;
          setUrl(event.currentTarget.value);
          setFieldError("");
        }}
      />
      <p id={descriptionId} class="examples-installer-description">
        Выберите существующую папку <strong>clark.projects</strong> или родительскую
        папку, в которой она будет создана. Уже существующие файлы будут пропущены.
        После развёртывания выберите <strong>clark.projects</strong> в редакторе.
      </p>
      <Show when={fieldError()}>
        <p id={errorId} class="examples-installer-error" role="alert">{fieldError()}</p>
      </Show>
      <div class="examples-installer-status" role="status" aria-live="polite" aria-atomic="true">
        <Show when={notice()}>
          <p classList={{ "examples-installer-error": failed() }}>{notice()}</p>
        </Show>
        <Show when={counts()}>
          <p>
            Записано файлов: {counts()?.writtenFiles || 0}.
            {" Пропущено существующих: "}{counts()?.skippedFiles || 0}.
          </p>
        </Show>
      </div>
      <Show when={busy() && progress()}>
        <div class="examples-installer-progress">
          <Show when={isDownloading()} fallback={
            <>
              <p>
                {progress()?.phase === "inspect" ? "Проверка архива…" : "Распаковка файлов…"}
                <Show when={progress()?.totalFiles > 0}>
                  {" "}{progress()?.completedFiles || 0} из {progress()?.totalFiles}
                </Show>
              </p>
              <progress
                aria-label="Распаковка файлов"
                max={progress()?.totalFiles || 1}
                value={progress()?.totalFiles > 0 ? (progress()?.completedFiles || 0) : undefined}
              />
              <Show when={progress()?.currentPath}>
                <p class="examples-installer-current-path">{progress()?.currentPath}</p>
              </Show>
            </>
          }>
            <p>
              Загружено: {formatBytes(progress()?.downloadedBytes)}
              <Show when={progress()?.totalDownloadBytes > 0}>
                {" из "}{formatBytes(progress()?.totalDownloadBytes)} ({downloadPercent()}%)
              </Show>
            </p>
            <progress
              aria-label="Загрузка архива с примерами"
              max="100"
              value={downloadPercent()}
            />
          </Show>
        </div>
      </Show>
    </div>
  );
}
