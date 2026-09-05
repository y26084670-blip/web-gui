import { For, Show, createEffect, createSignal, onMount } from "solid-js";

import { agentClient } from "../../services/agentClient.js";
import "./TaskAgentPanel.css";

// Сохраняет прежний список тем, если отдельный пакет не попал в сборку.
// Содержимое ответов и сценарии при наличии пакета поступают из clark.agent.
const FALLBACK_TOPICS = Object.freeze([
  ["getting_started", "Куда коня впрягать"],
  ["install", "Как установить"],
  ["usage", "Как пользоваться"],
  ["editor", "Как пользоваться редактором"],
  ["projects", "Как выбрать/создать/удалить проект"],
  ["tasks", "Как выбрать/создать/удалить задачу"],
  ["data_create", "Как создать данные"],
  ["data_import", "Как импортировать данные"],
  ["geometry", "Как создать/исправить/удалить геометрию"],
  ["properties", "Как создать/исправить/удалить свойства"],
  ["validation", "Как найти/исправить ошибки/неточности"],
  ["inspect", "Как осмотреть работу"],
  ["save", "Как сохранить работу"],
  ["run", "Как запустить расчет"],
  ["results_3d", "Как посмотреть результаты в 3D"],
  ["results_protocols", "Как посмотреть результаты в протоколах"],
  ["request_missing", "Как затребовать нужное, но отсутствующее"],
  ["exit", "Как перестать пользоваться всем этим"],
].map(([id, title]) => Object.freeze({ id, title, summary: "" })));

function statusText(status) {
  if (status.loading) return "Подключение агента…";
  if (status.available) {
    return status.version ? `Агент ${status.version} подключён` : "Агент подключён";
  }
  return "Агент недоступен";
}

export function TaskAgentPanel(props) {
  const [status, setStatus] = createSignal({
    loading: true,
    available: false,
    version: null,
    reason: "",
  });
  const [topics, setTopics] = createSignal(FALLBACK_TOPICS);
  const [recommendation, setRecommendation] = createSignal(null);
  const [selectedTopicId, setSelectedTopicId] = createSignal("");
  const [answer, setAnswer] = createSignal(null);
  const [question, setQuestion] = createSignal("");
  let recommendationRevision = 0;

  onMount(async () => {
    const loaded = await agentClient.load();
    setStatus({
      loading: false,
      available: loaded.available,
      version: loaded.version,
      reason: loaded.reason,
    });

    if (!loaded.available) return;
    const loadedTopics = await agentClient.listHelpTopics();
    if (Array.isArray(loadedTopics) && loadedTopics.length) {
      setTopics(loadedTopics);
    }
  });

  createEffect(() => {
    const state = props.state;
    if (!status().available) return;

    const revision = ++recommendationRevision;
    void agentClient.analyze(state).then((value) => {
      if (revision !== recommendationRevision) return;
      setRecommendation(value);
    }).catch((error) => {
      if (revision !== recommendationRevision) return;
      console.error("Ошибка анализа состояния агентом", error);
      setRecommendation(null);
    });
  });

  async function selectTopic(topic) {
    setSelectedTopicId(topic.id);
    const fullTopic = status().available
      ? await agentClient.getHelpTopic(topic.id)
      : topic;
    setAnswer({
      question: "",
      title: fullTopic?.title ?? topic.title,
      summary: fullTopic?.summary || "Содержание темы пока не подключено.",
    });
  }

  async function submitQuestion(event) {
    event.preventDefault();
    const value = question().trim();
    if (!value || !status().available) return;

    const topic = await agentClient.findHelpTopic(value);
    const current = recommendation();
    setAnswer(topic
      ? {
          question: value,
          title: topic.title,
          summary: topic.summary,
        }
      : {
          question: value,
          title: "По текущему состоянию",
          summary: current?.message
            ?? "Подходящая тема не найдена. Уточните действие или объект модели.",
        });
    if (topic) setSelectedTopicId(topic.id);
    setQuestion("");
  }

  return (
    <aside class="task-help-panel" aria-label="Справка агента">
      <section class="task-help-chat" aria-label="Диалог с агентом">
        <div
          class="task-help-chat-messages"
          role="log"
          aria-live="polite"
        >
          <div
            classList={{
              "task-agent-status": true,
              available: status().available,
              unavailable: !status().loading && !status().available,
            }}
            title={status().reason || ""}
          >
            {statusText(status())}{" [Экспериментальная функциональность: пока ничего не работает]"}
          </div>

          <Show
            when={recommendation()}
            fallback={
              <Show when={!status().loading && !status().available}>
                <p class="task-help-chat-placeholder">
                  {status().reason || "Пакет clark.agent не включён в сборку."}
                </p>
              </Show>
            }
          >
            {(item) => (
              <div
                class="task-agent-recommendation"
                data-level={item().level}
              >
                <div class="task-agent-caption">Следующий шаг</div>
                <p class="task-agent-message">{item().message}</p>
              </div>
            )}
          </Show>

          <Show when={answer()}>
            {(item) => (
              <div class="task-agent-answer">
                <Show when={item().question}>
                  <p class="task-agent-question">Вы: {item().question}</p>
                </Show>
                <p class="task-agent-answer-title">{item().title}</p>
                <p class="task-agent-answer-text">{item().summary}</p>
              </div>
            )}
          </Show>
        </div>

        <form class="task-help-chat-composer" onSubmit={submitQuestion}>
          <textarea
            rows="3"
            aria-label="Вопрос агенту"
            placeholder="Задайте вопрос…"
            value={question()}
            disabled={!status().available}
            onInput={(event) => setQuestion(event.currentTarget.value)}
          />
          <button
            type="button"
            class="task-help-voice-button"
            aria-label="Голосовая связь пока не подключена"
            title="Голосовая связь пока не подключена"
            disabled
          >
            <span aria-hidden="true">🔊</span>
          </button>
          <button
            type="submit"
            class="task-help-send-button"
            title="Отправить вопрос"
            disabled={!status().available || !question().trim()}
          >
            Отправить
          </button>
        </form>
      </section>

      <nav class="task-help-topics" aria-label="Темы справки">
        <For each={topics()}>
          {(topic) => (
            <button
              type="button"
              classList={{
                "task-help-topic": true,
                selected: selectedTopicId() === topic.id,
              }}
              aria-pressed={selectedTopicId() === topic.id}
              onClick={() => selectTopic(topic)}
            >
              {topic.title}
            </button>
          )}
        </For>
      </nav>
    </aside>
  );
}
