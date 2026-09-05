export const AGENT_PROTOCOL_VERSION = 2;
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const defaultBase = () => globalThis.document?.baseURI ?? "http://localhost/";

export function resolveAgentSocketUrl(endpoint = "/agent/rpc", baseUrl = defaultBase()) {
  const base = new URL(baseUrl);
  if (!["http:", "https:"].includes(base.protocol) || !LOOPBACK.has(base.hostname)) {
    throw new Error("Для агента используйте редактор на локальном origin. LAN-режим остаётся на встроенной помощи.");
  }
  const url = new URL(endpoint || "/agent/rpc", base);
  if (url.protocol === "http:") url.protocol = "ws:";
  if (url.protocol === "https:") url.protocol = "wss:";
  if (!["ws:", "wss:"].includes(url.protocol) || !LOOPBACK.has(url.hostname)
      || url.username || url.password || url.search || url.hash) {
    throw new Error("Требуется локальный WebSocket-адрес без ключа в URL.");
  }
  if (base.protocol === "https:" && url.protocol !== "wss:") {
    throw new Error("Для HTTPS-редактора требуется локальный WSS-прокси.");
  }
  return url.href;
}
function rpcError(message, code = null) {
  return Object.assign(new Error(message), { code });
}

/** Optional transport. No imports from the agent, DOM side effects or automatic commands. */
export function createAgentClient({
  baseUrl = defaultBase(), WebSocketImpl = globalThis.WebSocket,
  timeoutMs = 2000, retryDelayMs = 500, maxRetryDelayMs = 10000
} = {}) {
  const listeners = new Set(), pending = new Map();
  let socket = null, token = "", endpoint = "/agent/rpc", running = false;
  let generation = 0, sequence = 0, attempt = 0, retryTimer = null;
  let connecting = null, finishConnect = null, connectTimer = null;
  let status = Object.freeze({ available: false, loading: false, version: null,
    reason: "Используется встроенный помощник.", generation });
  function publish(patch) {
    status = Object.freeze({ ...status, ...patch, generation });
    for (const listener of listeners) { try { listener(status); } catch { /* isolate UI observers */ } }
  }
  function settleConnection() {
    clearTimeout(connectTimer); connectTimer = null;
    const finish = finishConnect; finishConnect = null; connecting = null;
    finish?.(status);
  }
  function fail(ws, reason, retry = true) {
    if (ws !== socket) return;
    socket = null; generation += 1;
    for (const [id, call] of pending) {
      clearTimeout(call.timer); pending.delete(id);
      call.reject(rpcError(reason));
    }
    publish({ available: false, loading: false, version: null, reason });
    settleConnection();
    try { ws?.close(); } catch { /* already closed */ }
    clearTimeout(retryTimer);
    if (running && retry && token) {
      const delay = Math.min(maxRetryDelayMs, retryDelayMs * 2 ** Math.min(attempt++, 5));
      retryTimer = setTimeout(() => { void connect(); }, delay);
      retryTimer.unref?.();
    }
  }
  function send(ws, method, params) {
    if (!ws || ws !== socket || ws.readyState !== 1) return Promise.reject(rpcError("Агент не подключён."));
    if (pending.size >= 16) return Promise.reject(rpcError("Очередь запросов агента заполнена."));
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        if (!pending.delete(id)) return;
        reject(rpcError("Истекло ожидание ответа агента."));
        fail(ws, "Агент не ответил; используется встроенный помощник.");
      }, timeoutMs);
      pending.set(id, { ws, resolve, reject, timer });
      try { ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params })); }
      catch { clearTimeout(timer); pending.delete(id); reject(rpcError("Запрос не отправлен.")); fail(ws, "Связь с агентом прервана."); }
    });
  }
  function connect() {
    running = true;
    if (!token || typeof WebSocketImpl !== "function") return Promise.resolve(status);
    if (socket) return connecting ?? Promise.resolve(status);
    clearTimeout(retryTimer); retryTimer = null;
    let url;
    try { url = resolveAgentSocketUrl(endpoint, baseUrl); }
    catch (error) { running = false; publish({ reason: error.message }); return Promise.resolve(status); }
    generation += 1;
    publish({ available: false, loading: true, reason: "Подключение локального агента…" });
    connecting = new Promise((resolve) => { finishConnect = resolve; });
    const result = connecting;
    let ws;
    try { ws = new WebSocketImpl(url); socket = ws; }
    catch { running = false; publish({ loading: false, reason: "WebSocket недоступен." }); settleConnection(); return result; }
    connectTimer = setTimeout(() => fail(ws, "Локальный агент недоступен."), timeoutMs);
    ws.addEventListener("open", () => {
      if (ws !== socket) return;
      void send(ws, "agent.hello", { protocolVersion: AGENT_PROTOCOL_VERSION,
        clientId: "web-gui", token }).then((hello) => {
        if (ws !== socket) return;
        if (hello?.protocolVersion !== AGENT_PROTOCOL_VERSION) {
          throw rpcError("Несовместимая версия протокола.", -32602);
        }
        attempt = 0;
        publish({ available: true, loading: false, version: hello.agentVersion ?? null,
          reason: "Локальный агент подключён." });
        settleConnection();
      }).catch((error) => {
        if (ws !== socket) return;
        const blocked = error.code === -32001 || error.code === -32602;
        if (blocked) running = false;
        fail(ws, blocked ? "Проверьте ключ подключения и версию агента." : "Подключение агента не завершено.", !blocked);
      });
    });
    ws.addEventListener("message", (event) => {
      if (ws !== socket) return;
      let message;
      try {
        if (typeof event.data !== "string" || event.data.length > 512 * 1024) throw new Error();
        message = JSON.parse(event.data);
        if (!message || message.jsonrpc !== "2.0" || Array.isArray(message)) throw new Error();
      } catch { fail(ws, "Некорректный ответ агента."); return; }
      const call = pending.get(message.id);
      if (!call || call.ws !== ws) return;
      pending.delete(message.id); clearTimeout(call.timer);
      if (message.error) call.reject(rpcError("RPC агента отклонил запрос.", message.error.code));
      else if (Object.hasOwn(message, "result")) call.resolve(message.result);
      else { call.reject(rpcError("Ответ не содержит результата.")); fail(ws, "Некорректный ответ агента."); }
    });
    ws.addEventListener("error", () => fail(ws, "Локальный агент недоступен."));
    ws.addEventListener("close", () => fail(ws, "Связь с агентом прервана."));
    return result;
  }
  function disconnect() {
    running = false; token = ""; clearTimeout(retryTimer); retryTimer = null;
    if (socket) fail(socket, "Используется встроенный помощник.", false);
    else { generation += 1; publish({ available: false, loading: false, reason: "Используется встроенный помощник." }); settleConnection(); }
  }
  function configure(options = {}) {
    const nextEndpoint = options.endpoint || "/agent/rpc";
    resolveAgentSocketUrl(nextEndpoint, baseUrl);
    if (typeof options.token !== "string" || !/^[a-f0-9]{64}$/.test(options.token.trim())) {
      throw new Error("Введите 64-значный ключ из локальной страницы настроек агента.");
    }
    disconnect(); endpoint = nextEndpoint; token = options.token.trim();
    return connect();
  }
  const request = (method, params = {}) => status.available
    ? send(socket, method, params) : Promise.reject(rpcError("Агент не подключён."));
  return Object.freeze({ configure, connect, disconnect,
    getStatus: () => status,
    subscribe(listener) { listeners.add(listener); listener(status); return () => listeners.delete(listener); },
    analyze: (state) => request("agent.analyze", { state }),
    listHelpTopics: () => request("agent.help.list"),
    getHelpTopic: (id) => request("agent.help.get", { id }),
    findHelpTopic: (query) => request("agent.help.find", { query }),
    feedback: (feedback) => request("agent.feedback", feedback)
  });
}
export const agentClient = createAgentClient();
