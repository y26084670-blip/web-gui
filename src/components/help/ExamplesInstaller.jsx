import { Show, createEffect, createSignal, onCleanup } from "solid-js";
import {
  getFilePickerErrorMessage,
  getFileSystemAccessSupport,
  isFilePickerCancellation,
} from "../../services/fileSystemAccessSupport";
import { installExamples, validateDownloadUrl } from "../../services/examplesService";
import "./ExamplesInstaller.css";

const numberFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });

function formatBytes(value = 0) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${numberFormatter.format(bytes)} Б`;
  if (bytes < 1024 * 1024) return `${numberFormatter.format(bytes / 1024)} КБ`;
  return `${numberFormatter.format(bytes / (1024 * 1024))} МБ`;
}

export function ExamplesInstaller(props) {
  const [manifestUrl, setManifestUrl] = createSignal("");
  const [solverInstallerUrl, setSolverInstallerUrl] = createSignal("");
  const [configLoading, setConfigLoading] = createSignal(false);
  const [configError, setConfigError] = createSignal("");
  const [notice, setNotice] = createSignal("");
  const [failed, setFailed] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [cancelling, setCancelling] = createSignal(false);
  const [progress, setProgress] = createSignal(null);
  const [result, setResult] = createSignal(null);
  let downloadLink;
  let configController;
  let operationController;
  let configLoaded = false;
  let disposed = false;

  async function loadConfiguration() {
    if (configLoaded || configController) return;
    const controller = new AbortController();
    configController = controller;
    setConfigLoading(true);
    setConfigError("");
    try {
      const baseUrl = new URL(import.meta.env.BASE_URL, window.location.href);
      const response = await fetch(new URL("examples-config.json", baseUrl), {
        signal: controller.signal,
        credentials: "omit",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Не удалось получить сведения для установки.");
      const config = await response.json();
      if (controller.signal.aborted || disposed) return;
      const examplesUrl = validateDownloadUrl(config?.manifestUrl, baseUrl);
      const installerUrl = typeof config?.solverInstallerUrl === "string"
        && config.solverInstallerUrl.trim()
        ? validateDownloadUrl(config.solverInstallerUrl, baseUrl)
        : "";
      setManifestUrl(examplesUrl);
      setSolverInstallerUrl(installerUrl);
      configLoaded = true;
    } catch (error) {
      if (controller.signal.aborted || disposed) return;
      setConfigError("Не удалось получить сведения для установки. Закройте и снова откройте эту панель, чтобы повторить попытку.");
    } finally {
      if (configController === controller) {
        configController = undefined;
        if (!disposed) setConfigLoading(false);
      }
    }
  }

  function cancelInstallation() {
    if (!operationController || operationController.signal.aborted) return;
    setCancelling(true);
    setNotice("Отмена копирования…");
    operationController.abort();
  }

  createEffect(() => {
    if (props.open) {
      void loadConfiguration();
    } else {
      configController?.abort();
      configController = undefined;
      setConfigLoading(false);
      cancelInstallation();
    }
  });

  onCleanup(() => {
    disposed = true;
    configController?.abort();
    operationController?.abort();
  });

  async function handleInstall() {
    if (busy() || !manifestUrl()) return;
    setFailed(false);
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
      // Keep the click gesture for the native picker, before network awaits.
      destinationHandle = await window.showDirectoryPicker({ mode: "readwrite", id: "clark-examples" });
      if (controller.signal.aborted) throw new DOMException("Отменено", "AbortError");
      setNotice("Копирование примеров…");
      const installed = await installExamples({
        manifestUrl: manifestUrl(),
        destinationHandle,
        signal: controller.signal,
        onProgress(update) {
          if (!disposed && !controller.signal.aborted) setProgress(update);
        },
      });
      if (disposed) return;
      setResult(installed);
      setNotice(`Примеры установлены в папке «${installed.rootName}». Теперь выберите её в редакторе.`);
    } catch (error) {
      if (disposed) return;
      if (error?.partialResult) setResult(error.partialResult);
      if (controller.signal.aborted || isFilePickerCancellation(error)) {
        setNotice(destinationHandle
          ? "Копирование отменено. Уже записанные файлы сохранены."
          : "Выбор папки отменён.");
      } else {
        setFailed(true);
        setNotice(destinationHandle
          ? (error?.message || "Не удалось установить примеры. Повторите попытку.")
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

  function handleDownloadInstaller() {
    if (solverInstallerUrl()) downloadLink?.click();
  }

  const counts = () => result() || progress();
  return (
    <div class="examples-installer" aria-label="Установка примеров и решателя">
      <div class="examples-installer-actions">
        <button type="button" disabled={busy() || !manifestUrl()} onClick={handleInstall}>
          Установить примеры
        </button>
        <button
          type="button"
          disabled={!solverInstallerUrl()}
          title={solverInstallerUrl() ? "Скачать установщик решателя" : "Установщик решателя пока недоступен для скачивания"}
          onClick={handleDownloadInstaller}
        >
          Скачать установщик решателя
        </button>
      </div>
      <a
        ref={(element) => (downloadLink = element)}
        href={solverInstallerUrl() || undefined}
        download=""
        target="_blank"
        rel="noopener noreferrer"
        referrerpolicy="no-referrer"
        hidden
        aria-hidden="true"
        tabindex="-1"
      />
      <p class="examples-installer-description">
        Для примеров выберите диск или папку, в которой нужно создать clark.projects,
        либо уже существующий clark.projects. Файлы копируются без преобразования;
        существующие файлы пропускаются. Затем выберите clark.projects в редакторе.
      </p>
      <Show when={configLoading()}><p role="status">Получение сведений для установки…</p></Show>
      <Show when={configError()}><p class="examples-installer-error" role="alert">{configError()}</p></Show>
      <Show when={!configLoading() && !configError() && !solverInstallerUrl()}>
        <p class="examples-installer-description">Установщик решателя пока недоступен для скачивания.</p>
      </Show>
      <Show when={busy()}>
        <button type="button" class="examples-installer-cancel" disabled={cancelling()} onClick={cancelInstallation}>
          {cancelling() ? "Отмена…" : "Отменить копирование"}
        </button>
      </Show>
      <div class="examples-installer-status" role="status" aria-live="polite" aria-atomic="true">
        <Show when={notice()}><p classList={{ "examples-installer-error": failed() }}>{notice()}</p></Show>
        <Show when={counts()}>
          <p>
            Записано файлов: {counts()?.writtenFiles || 0}.
            {" Пропущено существующих: "}{counts()?.skippedFiles || 0}.
          </p>
        </Show>
      </div>
      <Show when={busy() && progress()}>
        <div class="examples-installer-progress">
          <p>
            {progress()?.phase === "inspect" ? "Проверка списка примеров…" : "Копирование файлов…"}
            <Show when={progress()?.totalFiles > 0}>
              {" "}{progress()?.completedFiles || 0} из {progress()?.totalFiles}
            </Show>
          </p>
          <progress
            aria-label="Копирование примеров"
            max={progress()?.totalFiles || 1}
            value={progress()?.totalFiles > 0 ? (progress()?.completedFiles || 0) : undefined}
          />
          <Show when={progress()?.currentPath}>
            <p class="examples-installer-current-path">{progress()?.currentPath}</p>
          </Show>
          <p class="examples-installer-description">Записано: {formatBytes(progress()?.writtenBytes)}</p>
        </div>
      </Show>
    </div>
  );
}
