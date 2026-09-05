import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { BUILTIN_TOPICS } from "../src/assistant/builtinAssistant.js";
const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const titles = ["Куда коня впрягать", "Как установить", "Как пользоваться", "Как пользоваться редактором",
  "Как выбрать/создать/удалить проект", "Как выбрать/создать/удалить задачу", "Как создать данные", "Как импортировать данные",
  "Как создать/исправить/удалить геометрию", "Как создать/исправить/удалить свойства", "Как найти/исправить ошибки/неточности",
  "Как осмотреть работу", "Как сохранить работу", "Как запустить расчет", "Как посмотреть результаты в 3D",
  "Как посмотреть результаты в протоколах", "Как затребовать нужное, но отсутствующее", "Как перестать пользоваться всем этим"];
test("help topics are available offline with approved ordering and selected state", async () => {
  const source = await read("src/components/agent/TaskAgentPanel.jsx");
  assert.deepEqual(BUILTIN_TOPICS.map((topic) => topic.title), titles);
  assert.ok(BUILTIN_TOPICS.every((topic) => topic.summary.length));
  assert.match(source, /createSignal\(BUILTIN_TOPICS\)/u);
  assert.match(source, /class="task-help-panel" aria-label="Справка агента"/u);
  assert.match(source, /class="task-help-topics" aria-label="Темы справки"/u);
  assert.match(source, /aria-pressed=\{selectedTopicId\(\) === topic\.id\}/u);
  assert.match(source, /onClick=\{\(\) => selectTopic\(topic\)\}/u);
});
test("passive advice and offline questions preserve the approved layout", async () => {
  const [source, taskStyles, panelStyles] = await Promise.all([
    read("src/components/agent/TaskAgentPanel.jsx"), read("src/tabs/Tasks.css"), read("src/components/agent/TaskAgentPanel.css")
  ]);
  assert.match(source, /class="task-help-chat" aria-label="Диалог с агентом"/u);
  assert.match(source, /role="log"/u);
  assert.match(source, /Следующий шаг/u);
  assert.doesNotMatch(source, /task-agent-actions|executeAction|props\.onAction/u);
  assert.doesNotMatch(source, /disabled=\{!status\(\)\.available/u);
  assert.match(source, /rows="3"/u);
  assert.match(source, /title="Голосовая связь пока не подключена"/u);
  assert.match(source, /<span aria-hidden="true">🔊<\/span>/u);
  assert.match(source, /title="Отправить вопрос"/u);
  assert.match(source, /Экспериментальная функциональность: пока ничего не работает/u);
  assert.ok(source.indexOf('class="task-help-chat"') < source.indexOf('class="task-help-topics"'));
  assert.match(taskStyles, /grid-template-rows:\s*minmax\(240px, 3fr\) minmax\(160px, 2fr\)/u);
  assert.match(taskStyles, /\.task-help-topic\s*\{[^}]*font-size:\s*17px;[^}]*font-weight:\s*700;/su);
  assert.match(taskStyles, /\.task-help-chat-messages\s*\{[^}]*overflow-y:\s*auto;[^}]*font-size:\s*18px;/su);
  assert.match(panelStyles, /\.task-help-chat-composer button:disabled/u);
  assert.doesNotMatch(panelStyles, /\.task-agent-actions|\.task-agent-diagnostics/u);
});
