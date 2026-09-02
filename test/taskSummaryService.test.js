import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  TASK_SUMMARY_TEXT,
  readTaskSummary,
} from "../src/services/taskSummaryService.js";

const tasksUrl = new URL("../src/tabs/Tasks.jsx", import.meta.url);
const tasksStylesUrl = new URL("../src/tabs/Tasks.css", import.meta.url);

function missing(name = "NotFoundError") {
  return Object.assign(new Error(name), { name });
}

function fileHandle(content) {
  return {
    async getFile() {
      return {
        async text() {
          return content;
        },
      };
    },
  };
}

function directoryHandle({ directories = {}, files = {} } = {}) {
  return {
    async getDirectoryHandle(name) {
      if (Object.hasOwn(directories, name)) return directories[name];
      throw missing();
    },
    async getFileHandle(name) {
      if (Object.hasOwn(files, name)) return files[name];
      throw missing();
    },
  };
}

test("selected task exposes summary text without loading the task", async () => {
  const input = directoryHandle({
    files: { "_summary.txt": fileHandle("Элементов: 12\nОбластей: 3") },
  });
  const task = directoryHandle({ directories: { input3XX: input } });

  assert.deepEqual(await readTaskSummary(task), {
    summaryText: "Элементов: 12\nОбластей: 3",
    legacyImportAvailable: false,
  });
});

test("missing summary is reported while input3XX exists", async () => {
  const task = directoryHandle({
    directories: { input3XX: directoryHandle() },
  });

  assert.deepEqual(await readTaskSummary(task), {
    summaryText: TASK_SUMMARY_TEXT.NO_INFORMATION,
    legacyImportAvailable: false,
  });
});

test("missing input3XX does not hide available legacy import", async () => {
  const task = directoryHandle({ files: { "kv.in": fileHandle("") } });

  assert.deepEqual(await readTaskSummary(task), {
    summaryText: TASK_SUMMARY_TEXT.NO_CURRENT_FORMAT,
    legacyImportAvailable: true,
  });
});

test("task tab renders readonly summary and ignores stale reads", async () => {
  const [source, styles] = await Promise.all([
    readFile(tasksUrl, "utf8"),
    readFile(tasksStylesUrl, "utf8"),
  ]);

  assert.match(source, /grid-template-columns": "500px 0\.6fr 0\.9fr"/u);
  assert.match(source, /readOnly/u);
  assert.match(source, /task-summary-text/u);
  assert.match(source, /taskInfoRevision/u);
  assert.match(source, /requestId !== taskInfoRevision/u);
  assert.match(source, /TASK_SUMMARY_TEXT\.LEGACY_IMPORT/u);
  assert.match(styles, /\.task-summary-panel/u);
  assert.match(styles, /\.task-summary-text/u);
  assert.match(styles, /\.task-legacy-import/u);
});
