import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentUrl = new URL("../src/tabs/Tasks.jsx", import.meta.url);
const stylesUrl = new URL("../src/tabs/Tasks.css", import.meta.url);

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
    const source = await readFile(componentUrl, "utf8");

    for (const topic of HELP_TOPICS) {
        assert.ok(source.includes(`"${topic}"`), `missing topic: ${topic}`);
    }
    assert.doesNotMatch(source, /Как добавить\/исправить\/удалить свойства/u);
    assert.match(source, /const HELP_TOPICS = Object\.freeze/u);
    assert.match(source, /const \[selectedHelpTopic, setSelectedHelpTopic\]/u);
    assert.match(source, /class="task-help-panel" aria-label="Справка"/u);
    assert.match(source, /class="task-help-topics" aria-label="Темы справки"/u);
    assert.match(source, /onClick=\{\(\) => setSelectedHelpTopic\(topic\)\}/u);
    assert.match(source, /aria-pressed=\{selectedHelpTopic\(\) === topic\}/u);
    const saveIndex = source.indexOf('"Как сохранить работу"');
    const runIndex = source.indexOf('"Как запустить расчет"');
    const viewIndex = source.indexOf('"Как посмотреть результаты в 3D"');
    const logsIndex = source.indexOf(
        '"Как посмотреть результаты в протоколах"',
    );
    assert.ok(saveIndex < runIndex && runIndex < viewIndex && viewIndex < logsIndex);
});

test("task help chat is a scrollable dark placeholder with voice control", async () => {
    const [source, styles] = await Promise.all([
        readFile(componentUrl, "utf8"),
        readFile(stylesUrl, "utf8"),
    ]);

    assert.match(source, /class="task-help-chat" aria-label="Чат справки"/u);
    assert.match(source, /class="task-help-chat-messages"/u);
    assert.match(source, /role="log"/u);
    assert.match(source, /aria-label="Голосовая связь"/u);
    assert.match(source, /<span aria-hidden="true">🔊<\/span>/u);
    assert.match(source, /rows="3"/u);
    const composerStart = source.indexOf('class="task-help-chat-composer"');
    const composerEnd = source.indexOf("</div>", composerStart);
    const composer = source.slice(composerStart, composerEnd);
    assert.doesNotMatch(composer, /disabled/u);
    assert.match(source, /title="Голосовая связь"/u);
    assert.match(source, /title="Отправить вопрос"/u);
    assert.ok(
        source.indexOf('class="task-help-chat"')
        < source.indexOf('class="task-help-topics"'),
        "chat must be above the topic list",
    );
    assert.match(
        styles,
        /\.task-help-panel\s*\{[^}]*grid-template-rows:\s*minmax\(240px, 3fr\) minmax\(160px, 2fr\);[^}]*gap:\s*10px;[^}]*padding:\s*20px;/su,
    );
    assert.match(
        styles,
        /\.task-help-topic\s*\{[^}]*font-size:\s*17px;[^}]*font-weight:\s*700;/su,
    );
    assert.match(
        styles,
        /\.task-help-chat\s*\{[^}]*background:\s*#20262d;[^}]*color:\s*#edf2f7;/su,
    );
    assert.match(
        styles,
        /\.task-help-chat-messages\s*\{[^}]*overflow-y:\s*auto;[^}]*font-size:\s*18px;/su,
    );
    assert.match(
        styles,
        /\.task-help-chat-composer button\s*\{[^}]*align-self:\s*center;[^}]*height:\s*34px;/su,
    );
});
