const MANIFEST_PATH = "clark-agent/manifest.json";
const REQUIRED_METHODS = Object.freeze([
  "analyze",
  "findHelpTopic",
  "getHelpTopic",
  "listHelpTopics",
]);

function applicationBaseUrl() {
  return globalThis.document?.baseURI ?? "http://localhost/";
}

function unavailable(reason, error = null, manifest = null) {
  return Object.freeze({
    available: false,
    reason,
    error,
    manifest,
    version: manifest?.version ?? null,
    api: null,
  });
}

function validateApi(api) {
  return REQUIRED_METHODS.filter((name) => typeof api?.[name] !== "function");
}

export function createAgentClient({
  baseUrl = applicationBaseUrl(),
  fetchImpl = globalThis.fetch?.bind(globalThis),
  importModule = (url) => import(/* @vite-ignore */ url),
} = {}) {
  const resolvedBase = new URL(baseUrl, applicationBaseUrl()).href;
  let loading = null;

  async function loadInternal() {
    if (typeof fetchImpl !== "function") {
      return unavailable("В среде выполнения отсутствует fetch.");
    }

    const manifestUrl = new URL(MANIFEST_PATH, resolvedBase).href;
    let response;
    try {
      response = await fetchImpl(manifestUrl, { cache: "no-store" });
    } catch (error) {
      return unavailable("Не удалось загрузить манифест clark.agent.", error);
    }

    if (!response?.ok) {
      return unavailable(
        `Манифест clark.agent недоступен: HTTP ${response?.status ?? "?"}.`,
      );
    }

    let manifest;
    try {
      manifest = await response.json();
    } catch (error) {
      return unavailable("Манифест clark.agent содержит некорректный JSON.", error);
    }

    if (manifest?.schemaVersion !== 1) {
      return unavailable(
        `Неподдерживаемая версия манифеста clark.agent: `
        + `${manifest?.schemaVersion ?? "не указана"}.`,
        null,
        manifest,
      );
    }
    if (!manifest.available) {
      return unavailable(
        manifest.reason || "clark.agent не включён в текущую сборку.",
        null,
        manifest,
      );
    }
    if (typeof manifest.entry !== "string" || !manifest.entry) {
      return unavailable(
        "Манифест clark.agent не содержит точку входа.",
        null,
        manifest,
      );
    }

    const moduleUrl = new URL(manifest.entry, manifestUrl).href;
    let api;
    try {
      api = await importModule(moduleUrl);
    } catch (error) {
      return unavailable("Не удалось загрузить модуль clark.agent.", error, manifest);
    }

    const missing = validateApi(api);
    if (missing.length) {
      return unavailable(
        `Модуль clark.agent не реализует: ${missing.join(", ")}.`,
        null,
        manifest,
      );
    }

    return Object.freeze({
      available: true,
      reason: "",
      error: null,
      manifest,
      version: manifest.version ?? null,
      api,
    });
  }

  function load() {
    if (!loading) loading = loadInternal();
    return loading;
  }

  function reset() {
    loading = null;
  }

  async function call(name, ...args) {
    const status = await load();
    return status.available ? status.api[name](...args) : null;
  }

  return Object.freeze({
    load,
    reset,
    analyze: (state) => call("analyze", state),
    findHelpTopic: (query) => call("findHelpTopic", query),
    getHelpTopic: (id) => call("getHelpTopic", id),
    listHelpTopics: () => call("listHelpTopics"),
  });
}

export const agentClient = createAgentClient();
