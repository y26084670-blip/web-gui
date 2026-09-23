// Source-level contracts supplement (not replace) the real browser scenarios.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/tabs/MaterialLibraryTab.jsx', import.meta.url), 'utf8');
test('both material tabs share the local-first selector', () => {
    assert.ok(source.indexOf('<option value="task"') < source.indexOf('<option value="default"'));
    assert.match(source, /selected=\{librarySource\(\) === "task"\}/u);
    assert.match(source, /selected=\{librarySource\(\) === "default"\}/u);
});
test('initial material selection belongs to the loaded task, not to DOM change events', () => {
    assert.match(source, /librarySession = createMemo\(\(\) => \(\{ destination: taskHandle\(\) \}\)\)/u);
    assert.match(source, /session\.destination \? "task" : "default"/u);
    assert.match(source, /setSourceChoice\(\{ session: librarySession\(\), source: nextSource \}\)/u);
    assert.doesNotMatch(source, /dispatchEvent\(new Event\("change"/u);
});
test('material responses check task, source and request; table is protected until commit', () => {
    assert.match(source, /revision === recordLoadRevision/u);
    assert.match(source, /session === librarySession\(\) && destination === taskHandle\(\)/u);
    assert.match(source, /source === librarySource\(\)/u);
    assert.match(source, /isTaskSource\(\) && recordsReady\(\) && !actionBusy\(\)/u);
    assert.match(source, /visibility: recordsReady\(\) \? "visible" : "hidden"/u);
    assert.match(source, /отсутствует или пуста/u);
    assert.match(source, /untrack\(\(\) => \{ void loadRecords\(\{ source, destination \}\); \}\)/u);
});
