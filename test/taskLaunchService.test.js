import test from "node:test";
import assert from "node:assert/strict";
import {
  parseMpiRanks, formatMpiRanks, createNativeLaunchUri, createNativeSettingsRequest,
  readRuntimeSettings, SETTINGS_FILE,
} from "../src/services/taskLaunchService.js";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const request = { workspaceId, requestId };
const rootWith = value => ({
  kind: "directory",
  async getFileHandle(name) {
    assert.equal(name, SETTINGS_FILE);
    if (value === undefined) throw Object.assign(new Error("missing"), { name: "NotFoundError" });
    return { async getFile() { return { async text() { return JSON.stringify(value); } }; } };
  },
});

test("MPI count: explicit integer, default and invalid input", () => {
  for (const value of [null, undefined, "", " default ", "DEFAULT"]) assert.equal(parseMpiRanks(value), null);
  for (const value of [1, "8", " 12 ", 2147483647]) assert.equal(parseMpiRanks(value), Number(value));
  for (const value of [0, -1, "1.5", "1e2", "04", "2;exit", "Infinity", 2147483648, true]) {
    assert.throws(() => parseMpiRanks(value), /MPI/);
  }
  assert.equal(formatMpiRanks(8), "8");
  for (const value of [null, undefined, "8", 0, 1.5, 2147483648]) assert.equal(formatMpiRanks(value), "default");
});

test("launch override applies to solver and circuit, with legacy URI for default", () => {
  for (const action of ["solver", "circuit"]) {
    const url = new URL(createNativeLaunchUri(workspaceId, action, requestId, 12));
    assert.equal(url.searchParams.get("mpiRanks"), "12");
    assert.equal(url.searchParams.get("action"), action);
    assert.equal(url.searchParams.get("request"), requestId);
  }
  for (const action of ["solver", "circuit", "import"]) {
    const url = new URL(createNativeLaunchUri(workspaceId, action, requestId, "default"));
    assert.equal(url.searchParams.has("mpiRanks"), false);
    assert.equal([...url.searchParams].length, 3);
  }
  assert.throws(() => createNativeLaunchUri(workspaceId, "import", requestId, 2), /импорта/);
  assert.throws(() => createNativeLaunchUri(workspaceId, "solver", requestId, "2.5"), /MPI/);
});

test("settings discovery requires an updated bound launcher and creates unique requests", () => {
  for (const binding of [null, { workspaceId, bindingState: "pending", launchOptionsVersion: 1 },
    { workspaceId, bindingState: "bound" }]) assert.equal(createNativeSettingsRequest(binding), null);
  const binding = { workspaceId, bindingState: "bound", launchOptionsVersion: 1 };
  const a = createNativeSettingsRequest(binding), b = createNativeSettingsRequest(binding);
  assert.notEqual(a.requestId, b.requestId);
  const url = new URL(a.uri);
  assert.equal(url.host, "settings");
  assert.equal(url.searchParams.get("workspace"), workspaceId);
  assert.equal(url.searchParams.get("request"), a.requestId);
});

test("settings read accepts matching values and rejects old requests and other roots", async () => {
  const result = { schemaVersion: 1, ...request, mpiRanks: 6 };
  assert.deepEqual(await readRuntimeSettings(rootWith(result), request), result);
  assert.equal((await readRuntimeSettings(rootWith({ ...result, mpiRanks: null }), request)).mpiRanks, null);
  for (const value of [undefined, { ...result, requestId: workspaceId }, { ...result, workspaceId: requestId }]) {
    assert.equal(await readRuntimeSettings(rootWith(value), request), null);
  }
  for (const value of [{ ...result, schemaVersion: 2 }, { ...result, mpiRanks: "6" },
    { ...result, mpiRanks: 0 }, { ...result, mpiRanks: 6.2 }, { ...request, schemaVersion: 1 }]) {
    await assert.rejects(() => readRuntimeSettings(rootWith(value), request), /настройки/);
  }
});
