import { For, Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { agentClient } from "../../services/agentClient.js";
import { BUILTIN_TOPICS, analyzeBuiltin, findBuiltinTopic, getBuiltinTopic } from "../../assistant/builtinAssistant.js";
import "./TaskAgentPanel.css";

const CONNECTION_KEY = "clark.agent.connection.v2";
const PANEL_DISABLED = true;
function statusText(status) {
  if (PANEL_DISABLED) return "Агент отключен. Встроенный помощник [Экспериментальный: пока ничего не работает]";
  if (status.available) return `Локальный агент ${status.version ?? ""} подключён`;
  return status.loading ? "Встроенный помощник; подключение агента…" : "Встроенный помощник";
}
function validTopic(topic) {
  return topic && typeof topic.id === "string" && typeof topic.title === "string" && typeof topic.summary === "string";
}
export function TaskAgentPanel(props) {
  const [status, setStatus] = createSignal(agentClient.getStatus());
  const [topics, setTopics] = createSignal(BUILTIN_TOPICS);
  const [recommendation, setRecommendation] = createSignal(null);
  const [selectedTopicId, setSelectedTopicId] = createSignal("");
  const [answer, setAnswer] = createSignal(null);
  const [question, setQuestion] = createSignal("");
  const [endpoint, setEndpoint] = createSignal("/agent/rpc");
  const [key, setKey] = createSignal("");
  const [connectionError, setConnectionError] = createSignal("");
  const [memoryWarning, setMemoryWarning] = createSignal(false);
  let recommendationRevision = 0, answerRevision = 0, timer;
  let previousState = "", previousConnection = "";
  let disposed = false;

  onMount(() => {
    if (PANEL_DISABLED) return;
    const unsubscribe = agentClient.subscribe(setStatus);
    onCleanup(() => { disposed = true; recommendationRevision++; answerRevision++;
      clearTimeout(timer); unsubscribe(); agentClient.disconnect(); });
    try {
      const saved = JSON.parse(sessionStorage.getItem(CONNECTION_KEY) || "null");
      if (saved?.token) { setEndpoint(saved.endpoint || "/agent/rpc"); void agentClient.configure(saved); }
    } catch { /* Private mode or obsolete settings must not disable local help. */ }
  });

  createEffect(() => {
    if (PANEL_DISABLED) return;
    const current = status();
    if (!current.available) { setTopics(BUILTIN_TOPICS); return; }
    const generation = current.generation;
    void agentClient.listHelpTopics().then((items) => {
      if (disposed || generation !== status().generation) return;
      if (Array.isArray(items) && items.length && items.every(validTopic)) setTopics(items);
    }).catch(() => {});
  });

  createEffect(() => {
    if (PANEL_DISABLED) return;
    const state = props.state;
    const stateKey = JSON.stringify(state);
    const connection = status();
    const connectionKey = `${connection.generation}:${connection.available}`;
    if (stateKey === previousState && connectionKey === previousConnection) return;
    if (stateKey !== previousState) { answerRevision++; setAnswer(null); }
    previousState = stateKey; previousConnection = connectionKey;
    const revision = ++recommendationRevision;
    clearTimeout(timer);
    setRecommendation(analyzeBuiltin(state));
    setMemoryWarning(false);
    if (!connection.available) return;
    // Coalesce short bursts; the local recommendation is already visible.
    timer = setTimeout(() => {
      void agentClient.analyze(state).then((value) => {
        if (disposed || revision !== recommendationRevision) return;
        if (value?.schemaVersion !== 1 || typeof value.message !== "string"
            || typeof value.recommendationId !== "string") return;
        setRecommendation({ ...value, source: "agent" });
        setMemoryWarning(value.storage?.recorded === false);
      }).catch(() => {
        if (!disposed && revision === recommendationRevision) setRecommendation(analyzeBuiltin(state));
      });
    }, 150);
  });

  async function selectTopic(topic) {
    if (PANEL_DISABLED) return;
    const revision = ++answerRevision;
    setSelectedTopicId(topic.id);
    let fullTopic = getBuiltinTopic(topic.id) ?? topic;
    if (status().available) {
      try { const value = await agentClient.getHelpTopic(topic.id); if (validTopic(value)) fullTopic = value; }
      catch { /* Keep the local content. */ }
    }
    if (disposed || revision !== answerRevision) return;
    setAnswer({ question: "", title: fullTopic.title, summary: fullTopic.summary });
  }
  async function submitQuestion(event) {
    event.preventDefault();
    if (PANEL_DISABLED) return;
    const value = question().trim();
    if (!value) return;
    const revision = ++answerRevision;
    let topic = findBuiltinTopic(value);
    if (status().available) {
      try { const remote = await agentClient.findHelpTopic(value); if (validTopic(remote)) topic = remote; }
      catch { /* Offline questions use built-in help. */ }
    }
    if (disposed || revision !== answerRevision) return;
    setAnswer({ question: value, title: topic?.title ?? "По текущему состоянию",
      summary: topic?.summary ?? recommendation()?.message ?? "Уточните действие или объект модели." });
    if (topic) setSelectedTopicId(topic.id);
    setQuestion("");
  }
  async function connect(event) {
    event.preventDefault();
    if (PANEL_DISABLED) return;
    setConnectionError("");
    const config = { endpoint: endpoint().trim() || "/agent/rpc", token: key().trim() };
    try {
      const promise = agentClient.configure(config);
      try { sessionStorage.setItem(CONNECTION_KEY, JSON.stringify(config)); } catch { /* in-memory session still works */ }
      setKey(""); await promise;
    } catch (error) { setConnectionError(error.message); }
  }
  function disconnect() {
    if (PANEL_DISABLED) return;
    agentClient.disconnect(); setKey("");
    try { sessionStorage.removeItem(CONNECTION_KEY); } catch { /* optional browser storage */ }
  }

  return (
    <aside class="task-help-panel" classList={{ "is-disabled": PANEL_DISABLED }} aria-label="Справка агента" aria-disabled={PANEL_DISABLED}>
      <section class="task-help-chat" aria-label="Диалог с агентом">
        <div class="task-help-chat-messages" role="log" aria-live="polite">
          <div classList={{ "task-agent-status": true, available: !PANEL_DISABLED && status().available,
            unavailable: !PANEL_DISABLED && !status().loading && !status().available }} title={PANEL_DISABLED ? undefined : status().reason}>
            {statusText(status())}{PANEL_DISABLED ? "" : " [Экспериментальная функциональность: пока ничего не работает]"}
          </div>
          <details class="task-agent-connection" inert={PANEL_DISABLED ? "" : undefined}>
            <summary tabIndex={PANEL_DISABLED ? -1 : undefined}>Подключение локального агента</summary>
            <p>Ключ доступен на локальной странице настроек агента. LAN-профиль использует только встроенную помощь.</p>
            <form onSubmit={connect}>
              <label>WebSocket-адрес<input disabled={PANEL_DISABLED} value={endpoint()} onInput={(event) => setEndpoint(event.currentTarget.value)} /></label>
              <label>Ключ редактора<input type="password" autocomplete="off" disabled={PANEL_DISABLED} value={key()} onInput={(event) => setKey(event.currentTarget.value)} /></label>
              <button type="submit" disabled={PANEL_DISABLED || !key().trim()}>Подключить</button>
              <button type="button" disabled={PANEL_DISABLED} onClick={disconnect}>Отключить</button>
            </form>
            <Show when={connectionError()}><p role="alert">{connectionError()}</p></Show>
          </details>
          <Show when={recommendation()}>{(item) => (
            <div class="task-agent-recommendation" data-level={item().level}>
              <div class="task-agent-caption">Следующий шаг</div>
              <div class="task-agent-source">{item().source === "agent" ? "Локальный агент" : "Встроенная помощь"}</div>
              <p class="task-agent-message">{item().message}</p>
            </div>
          )}</Show>
          <Show when={memoryWarning()}><p role="status">Ответ получен, но локальная запись истории недоступна.</p></Show>
          <Show when={answer()}>{(item) => (
            <div class="task-agent-answer">
              <Show when={item().question}><p class="task-agent-question">Вы: {item().question}</p></Show>
              <p class="task-agent-answer-title">{item().title}</p>
              <p class="task-agent-answer-text">{item().summary}</p>
            </div>
          )}</Show>
        </div>
        <form class="task-help-chat-composer" onSubmit={submitQuestion}>
          <textarea rows="3" maxlength="4000" aria-label="Вопрос агенту" placeholder="Задайте вопрос…"
            disabled={PANEL_DISABLED} value={question()} onInput={(event) => setQuestion(event.currentTarget.value)} />
          <button type="button" class="task-help-voice-button" aria-label="Голосовая связь пока не подключена"
            title="Голосовая связь пока не подключена" disabled><span aria-hidden="true">🔊</span></button>
          <button type="submit" class="task-help-send-button" title="Отправить вопрос" disabled={PANEL_DISABLED || !question().trim()}>Отправить</button>
        </form>
      </section>
      <nav class="task-help-topics" aria-label="Темы справки">
        <For each={topics()}>{(topic) => (
          <button type="button" classList={{ "task-help-topic": true, selected: selectedTopicId() === topic.id }}
            disabled={PANEL_DISABLED} aria-pressed={selectedTopicId() === topic.id} onClick={() => selectTopic(topic)}>{topic.title}</button>
        )}</For>
      </nav>
    </aside>
  );
}
