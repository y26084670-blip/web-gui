import assert from "node:assert/strict";
import test from "node:test";

import { createAgentClient } from "../src/services/agentClient.js";

function response(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

const api = Object.freeze({
  analyze: (state) => ({ recommendationId: state.id }),
  findHelpTopic: (query) => ({ id: query }),
  getHelpTopic: (id) => ({ id }),
  listHelpTopics: () => [{ id: "usage" }],
});

test("agent client loads one manifest and delegates calls", async () => {
  const fetched = [];
  const imported = [];
  const client = createAgentClient({
    baseUrl: "https://example.test/web-gui/",
    fetchImpl: async (url, options) => {
      fetched.push({ url, options });
      return response({
        schemaVersion: 1,
        available: true,
        version: "0.1.1",
        entry: "src/index.js",
      });
    },
    importModule: async (url) => {
      imported.push(url);
      return api;
    },
  });

  const status = await client.load();
  assert.equal(status.available, true);
  assert.equal(status.version, "0.1.1");
  assert.deepEqual(await client.analyze({ id: "ready" }), {
    recommendationId: "ready",
  });
  assert.deepEqual(await client.listHelpTopics(), [{ id: "usage" }]);
  assert.equal(fetched.length, 1);
  assert.equal(fetched[0].options.cache, "no-store");
  assert.equal(
    fetched[0].url,
    "https://example.test/web-gui/clark-agent/manifest.json",
  );
  assert.deepEqual(imported, [
    "https://example.test/web-gui/clark-agent/src/index.js",
  ]);
});

test("unavailable agent degrades without throwing", async () => {
  const client = createAgentClient({
    baseUrl: "https://example.test/",
    fetchImpl: async () => response({
      schemaVersion: 1,
      available: false,
      reason: "not installed",
    }),
    importModule: async () => {
      throw new Error("must not import");
    },
  });

  const status = await client.load();
  assert.equal(status.available, false);
  assert.equal(status.reason, "not installed");
  assert.equal(await client.analyze({}), null);
  assert.equal(await client.findHelpTopic("проверка"), null);
});

test("invalid agent module is reported as unavailable", async () => {
  const client = createAgentClient({
    baseUrl: "https://example.test/",
    fetchImpl: async () => response({
      schemaVersion: 1,
      available: true,
      entry: "src/index.js",
    }),
    importModule: async () => ({ analyze() {} }),
  });

  const status = await client.load();
  assert.equal(status.available, false);
  assert.match(status.reason, /findHelpTopic/);
});
