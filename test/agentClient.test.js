import assert from "node:assert/strict";
import test from "node:test";
import { createAgentClient, resolveAgentSocketUrl } from "../src/services/agentClient.js";
const token = "a".repeat(64);
class MockSocket extends EventTarget {
  static instances = [];
  constructor(url) {
    super(); this.url = url; this.readyState = 0; this.sent = []; MockSocket.instances.push(this);
    queueMicrotask(() => { if (this.readyState !== 0) return; this.readyState = 1; this.dispatchEvent(new Event("open")); });
  }
  send(text) {
    const request = JSON.parse(text); this.sent.push(request);
    if (request.method === "agent.analyze" && this.hold) return;
    queueMicrotask(() => this.reply(request.id, request.method === "agent.hello"
      ? { protocolVersion: 2, agentVersion: "test" }
      : { recommendationId: "project.missing", message: "Выберите проект." }));
  }
  reply(id, result) { this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ jsonrpc: "2.0", id, result }) })); }
  close() { this.readyState = 3; queueMicrotask(() => this.dispatchEvent(new Event("close"))); }
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
test("client authenticates through hello and sends JSON-RPC without credentials in URL or status", async () => {
  const client = createAgentClient({ WebSocketImpl: MockSocket });
  try {
    await client.configure({ token });
    assert.equal(client.getStatus().available, true);
    assert.equal((await client.analyze({})).recommendationId, "project.missing");
    const ws = MockSocket.instances.at(-1);
    assert.equal(ws.url, "ws://localhost/agent/rpc");
    assert.equal(ws.sent[0].params.token, token);
    assert.equal(ws.sent[1].method, "agent.analyze");
    assert.equal(JSON.stringify(client.getStatus()).includes(token), false);
  } finally { client.disconnect(); }
});
test("late close and reply from an old connection do not reset a new connection", async () => {
  const client = createAgentClient({ WebSocketImpl: MockSocket });
  try {
    await client.configure({ token });
    const old = MockSocket.instances.at(-1); old.hold = true;
    const pending = client.analyze({}); const rejected = assert.rejects(pending);
    await client.configure({ token }); await rejected;
    old.reply(2, { recommendationId: "obsolete" }); old.dispatchEvent(new Event("close"));
    assert.equal(client.getStatus().available, true);
    assert.equal((await client.analyze({})).recommendationId, "project.missing");
  } finally { client.disconnect(); }
});
test("RPC timeout activates fallback and reconnects without editor reload", async () => {
  const client = createAgentClient({ WebSocketImpl: MockSocket, timeoutMs: 20, retryDelayMs: 5 });
  try {
    await client.configure({ token }); MockSocket.instances.at(-1).hold = true;
    await assert.rejects(client.analyze({}));
    assert.equal(client.getStatus().available, false);
    for (let i = 0; i < 100 && !client.getStatus().available; i++) await delay(10);
    assert.equal(client.getStatus().available, true);
  } finally { client.disconnect(); }
});
test("only explicitly configured local endpoints are accepted; HTTPS requires WSS", () => {
  assert.equal(resolveAgentSocketUrl("/agent/rpc", "https://localhost:8443/"), "wss://localhost:8443/agent/rpc");
  assert.throws(() => resolveAgentSocketUrl("ws://127.0.0.1:8765/rpc", "https://localhost/"));
  for (const url of ["wss://external.example/rpc", "ws://user:secret@localhost/rpc", "/agent/rpc?token=secret"]) {
    assert.throws(() => resolveAgentSocketUrl(url));
  }
  assert.throws(() => resolveAgentSocketUrl("/agent/rpc", "https://192.168.1.10/"));
});
