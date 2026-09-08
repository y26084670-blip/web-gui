import { Show, createEffect, createSignal, onCleanup } from "solid-js";
import {
  getFilePickerErrorMessage,
  getFileSystemAccessSupport,
  isFilePickerCancellation,
} from "../../services/fileSystemAccessSupport";
import { installExamples, validateDownloadUrl } from "../../services/examplesService";
import "./ExamplesInstaller.css";

function fileWord(count) {
  const lastTwo = count % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return "файлов";
  if (count % 10 === 1) return "файл";
  if (count % 10 >= 2 && count % 10 <= 4) return "файла";
  return "файлов";
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
  let installerFolderLink;
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
      setNotice("");
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
      setNotice("");
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

  function handleOpenInstallerFolder() {
    if (!solverInstallerUrl() || !installerFolderLink) return;
    installerFolderLink.click();
  }

  const counts = () => result() || progress();
  return (
    <div class="examples-installer" aria-label="Установка примеров и решателя">
      <div class="examples-installer-actions">
        <div class="examples-installer-action">
          <button type="button" disabled={busy() || !manifestUrl()} onClick={handleInstall}>
            Установить примеры
          </button>
          <Show when={counts()?.totalFiles > 0}>
            <div class="examples-installer-progress">
              <p role="status" aria-live="polite" aria-atomic="true">
                Скачано {counts()?.completedFiles || 0} {fileWord(counts()?.completedFiles || 0)} из {counts()?.totalFiles}
              </p>
              <progress
                aria-label="Установка примеров"
                max={counts()?.totalFiles || 1}
                value={counts()?.completedFiles || 0}
              />
            </div>
          </Show>
          <Show when={busy() && !(counts()?.totalFiles > 0) && !notice()}>
            <p class="examples-installer-description" role="status">Подготовка списка файлов…</p>
          </Show>
          <Show when={notice()}>
            <p classList={{ "examples-installer-error": failed() }} role="status">{notice()}</p>
          </Show>
          <Show when={busy()}>
            <button type="button" class="examples-installer-cancel" disabled={cancelling()} onClick={cancelInstallation}>
              {cancelling() ? "Отмена…" : "Отменить копирование"}
            </button>
          </Show>
        </div>
        <div class="examples-installer-action">
          <button
            type="button"
            disabled={!solverInstallerUrl()}
            title={solverInstallerUrl() ? "Открыть облачный каталог с актуальным установщиком" : "Каталог установщика пока недоступен"}
            onClick={handleOpenInstallerFolder}
          >
            Скачать установщик решателя
          </button>
        </div>
      </div>
      <a
        ref={(element) => (installerFolderLink = element)}
        href={solverInstallerUrl() || undefined}
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
    </div>
  );
}
