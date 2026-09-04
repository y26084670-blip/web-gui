import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tasksComponentUrl = new URL("../src/tabs/Tasks.jsx", import.meta.url);
const panelComponentUrl = new URL(
    "../src/components/agent/TaskAgentPanel.jsx",
    import.meta.url,
);
const taskStylesUrl = new URL("../src/tabs/Tasks.css", import.meta.url);
const panelStylesUrl = new URL(
    "../src/components/agent/TaskAgentPanel.css",
    import.meta.url,
);

const HELP_TOPICS = [
    "Куда коня впрягать",
    "Как установить",
    "Как пользоваться",
    "Как пользоваться редактором",
    "Как выбрать/создать/удалить проект",
    "Как выбрать/создать/удалить задачу",
    "Как создать данные",
    "Как импортировать данные",
    "Как создать/исправить/удалить геометрию",
    "Как создать/исправить/удалить свойства",
    "Как найти/исправить ошибки/неточности",
    "Как осмотреть работу",
    "Как сохранить работу",
    "Как запустить расчет",
    "Как посмотреть результаты в 3D",
    "Как посмотреть результаты в протоколах",
    "Как затребовать нужное, но отсутствующее",
    "Как перестать пользоваться всем этим",
];

test("task help panel exposes the approved topics and selected state", async () => {
    const [tasksSource, panelSource] = await Promise.all([
        readFile(tasksComponentUrl, "utf8"),
        readFile(panelComponentUrl, "utf8"),
    ]);

    assert.match(tasksSource, /<TaskAgentPanel/u);
    assert.doesNotMatch(tasksSource, /const HELP_TOPICS/u);

    for (const topic of HELP_TOPICS) {
        assert.ok(
            panelSource.includes(`"${topic}"`),
            `missing topic: ${topic}`,
        );
    }
    assert.doesNotMatch(
        panelSource,
        /Как добавить\/исправить\/удалить свойства/u,
    );
    assert.match(panelSource, /const FALLBACK_TOPICS = Object\.freeze/u);
    assert.match(
        panelSource,
        /const \[selectedTopicId, setSelectedTopicId\]/u,
    );
    assert.match(
        panelSource,
        /class="task-help-panel" aria-label="Справка агента"/u,
    );
    assert.match(
        panelSource,
        /class="task-help-topics" aria-label="Темы справки"/u,
    );
    assert.match(panelSource, /onClick=\{\(\) => selectTopic\(topic\)\}/u);
    assert.match(
        panelSource,
        /aria-pressed=\{selectedTopicId\(\) === topic\.id\}/u,
    );
    const saveIndex = panelSource.indexOf('"Как сохранить работу"');
    const runIndex = panelSource.indexOf('"Как запустить расчет"');
    const viewIndex = panelSource.indexOf(
        '"Как посмотреть результаты в 3D"',
    );
    const logsIndex = panelSource.indexOf(
        '"Как посмотреть результаты в протоколах"',
    );
    assert.ok(saveIndex < runIndex && runIndex < viewIndex && viewIndex < logsIndex);
});

test("task help chat is interactive and preserves the approved layout", async () => {
    const [source, taskStyles, panelStyles] = await Promise.all([
        readFile(panelComponentUrl, "utf8"),
        readFile(taskStylesUrl, "utf8"),
        readFile(panelStylesUrl, "utf8"),
    ]);

    assert.match(
        source,
        /class="task-help-chat" aria-label="Диалог с агентом"/u,
    );
    assert.match(source, /class="task-help-chat-messages"/u);
    assert.match(source, /role="log"/u);
    assert.match(source, /agentClient\.analyze/u);
    assert.match(source, /agentClient\.findHelpTopic/u);
    assert.match(
        source,
        /aria-label="Голосовая связь пока не подключена"/u,
    );
    assert.match(source, /<span aria-hidden="true">🔊<\/span>/u);
    assert.match(source, /rows="3"/u);
    assert.match(source, /class="task-help-chat-composer"/u);
    assert.match(source, /type="submit"/u);
    assert.match(
        source,
        /title="Голосовая связь пока не подключена"/u,
    );
    assert.match(source, /title="Отправить вопрос"/u);
    assert.ok(
        source.indexOf('class="task-help-chat"')
        < source.indexOf('class="task-help-topics"'),
        "chat must be above the topic list",
    );
    assert.match(
        taskStyles,
        /\.task-help-panel\s*\{[^}]*grid-template-rows:\s*minmax\(240px, 3fr\) minmax\(160px, 2fr\);[^}]*gap:\s*10px;[^}]*padding:\s*20px;/su,
    );
    assert.match(
        taskStyles,
        /\.task-help-topic\s*\{[^}]*font-size:\s*17px;[^}]*font-weight:\s*700;/su,
    );
    assert.match(
        taskStyles,
        /\.task-help-chat\s*\{[^}]*background:\s*#20262d;[^}]*color:\s*#edf2f7;/su,
    );
    assert.match(
        taskStyles,
        /\.task-help-chat-messages\s*\{[^}]*overflow-y:\s*auto;[^}]*font-size:\s*18px;/su,
    );
    assert.match(
        taskStyles,
        /\.task-help-chat-composer button\s*\{[^}]*align-self:\s*center;[^}]*height:\s*34px;/su,
    );
    assert.match(panelStyles, /\.task-agent-recommendation/u);
    assert.match(panelStyles, /button:disabled/u);
});
