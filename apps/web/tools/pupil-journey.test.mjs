import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Execute the actual TS modules with only browser I/O substituted. This works
// on the Node versions used in CI without experimental TS/module hooks.
const compile = async name => ts.transpileModule(await readFile(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const apiSource = await compile("api");
const journeySource = await compile("pupil-journey");
const response = (body, status = 200) => ({ ok: status === 200, status, json: async () => body });

function harness() {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const requests = [];
  const routes = new Map([
    ["/v1/runtime/flags", { flags: { child_play_enabled: true } }],
    ["/v1/students/ava/profile", { student_id: "ava", year_group: 3, active_world_key: "wonder", active_world: "Wonder Garden" }],
    ["/v1/learning/next", { student_id: "ava", activity_id: "step", assessment_mode: "practice", world_key: "wonder", world: "Wonder Garden" }],
    ["/v1/students/ava/progress", { student_id: "ava", subjects: [] }],
    ["/v1/students/ava/world", { student_id: "ava", world_key: "wonder", state: { artefacts: [] } }],
  ]);
  const context = {
    exports: {}, process: { env: { NEXT_PUBLIC_API_URL: "http://api.test" } },
    window: { sessionStorage: storage }, sessionStorage: storage,
    AbortController, DOMException, Error, Date, URLSearchParams, setTimeout, clearTimeout,
    fetch: async (target, options) => {
      const url = new URL(target);
      requests.push({ url, options });
      const route = routes.get(url.pathname);
      assert.ok(route, `unexpected endpoint ${url.pathname}`);
      return typeof route === "function" ? route(url, options) : response(route);
    },
  };
  vm.runInNewContext(apiSource, context);
  const api = context.exports;
  api.storePupilSession({ student: { external_ref: "ava" }, session: { token: "ava-token", expires_at: "2099-01-01T00:00:00Z" } });
  context.exports = {};
  context.require = name => { assert.equal(name, "./api"); return api; };
  vm.runInNewContext(journeySource, context);
  return { journey: context.exports, api, storage, routes, requests, context };
}

test("world reads explicitly scope the selected world and reject a mismatched response", async () => {
  const h = harness();
  h.routes.set("/v1/students/ava/world", (url) => {
    assert.equal(url.searchParams.get("worldKey"), "wonder");
    return response({ student_id: "ava", world_key: "another-world", state: { artefacts: ["wrong"] } });
  });
  const result = await h.journey.loadPupilJourney(new AbortController().signal);
  assert.equal(result.kind, "ready");
  assert.equal(result.data.world, null);
  assert.equal(result.data.worldName, "Wonder Garden");
});

test("a selected next world wins over the profile's earlier world", async () => {
  const h = harness();
  h.routes.set("/v1/learning/next", { activity_id: "step", assessment_mode: "teach", world_key: "future", world: "Future Lab" });
  h.routes.set("/v1/students/ava/world", url => {
    assert.equal(url.searchParams.get("worldKey"), "future");
    return response({ student_id: "ava", world_key: "future", state: { artefacts: [] } });
  });
  const result = await h.journey.loadPupilJourney(new AbortController().signal);
  assert.equal(result.kind, "ready");
  assert.equal(result.data.worldName, "Future Lab");
  assert.equal(result.data.world.world_key, "future");
});

test("an old denied response cannot clear a replacement session, even for the same pupil", async () => {
  for (const student of ["bea", "ava"]) {
    const h = harness();
    let rejectOld;
    let started;
    const pending = new Promise(resolve => { started = resolve; });
    h.routes.set("/v1/students/ava/profile", () => { started(); return new Promise(resolve => { rejectOld = resolve; }); });
    const controller = new AbortController();
    const load = h.journey.loadPupilJourney(controller.signal);
    await pending;
    rejectOld(response({}, 401));
    h.api.storePupilSession({ student: { external_ref: student }, session: { token: "replacement-token", expires_at: "2099-01-01T00:00:00Z" } });
    controller.abort();
    await load;
    assert.equal(h.storage.getItem("nexuslearn_pupil_session"), "replacement-token");
    assert.equal(h.storage.getItem("nexuslearn_pupil_id"), student);
  }
});

test("a current denied optional response still invalidates the whole private view", async () => {
  const h = harness();
  h.routes.set("/v1/students/ava/progress", () => response({}, 403));
  const result = await h.journey.loadPupilJourney(new AbortController().signal);
  assert.equal(result.kind, "access");
  assert.equal(h.storage.getItem("nexuslearn_pupil_session"), null);
});

test("inaccessible storage fails closed without a request", async () => {
  const h = harness();
  h.storage.getItem = () => { throw new DOMException("blocked", "SecurityError"); };
  const result = await h.journey.loadPupilJourney(new AbortController().signal);
  assert.equal(result.kind, "access");
  assert.equal(h.requests.length, 0);
});

test("an absent next activity never creates an invented mission URL", async () => {
  const h = harness();
  for (const next of [null, {}, { activity_id: "step", assessment_mode: "unknown" }]) {
    assert.equal(h.journey.pupilMissionURL({ studentId: "ava", next }), "");
  }
});

test("revoked storage cannot throw out of card removal", () => {
  const h = harness();
  Object.defineProperty(h.context.window, "sessionStorage", { get() { throw new DOMException("blocked", "SecurityError"); } });
  assert.doesNotThrow(() => h.api.clearPupilSession());
});
