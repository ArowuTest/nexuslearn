import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(await readFile(new URL("../src/lib/api.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const session = { token: "test-session", role: "parent", expires_at: "2099-01-01T00:00:00Z" };
const response = (body, status = 200) => ({ ok: status === 200, status, json: async () => body });
function harness(fetcher) {
  const timers = new Set();
  const storage = new Map();
  const context = {
    exports: {}, process: { env: { NEXT_PUBLIC_API_URL: "http://api.test" } },
    AbortController, DOMException, Error, Date, URLSearchParams,
    fetch: fetcher,
    setTimeout: fn => { timers.add(fn); return fn; }, clearTimeout: fn => timers.delete(fn),
    window: { sessionStorage: storage, dispatchEvent: () => assert.fail("Authentication transport must not publish a session") },
    sessionStorage: storage,
  };
  vm.runInNewContext(source, context);
  return { api: context.exports, timers, storage, context };
}

function privateHarness(fetcher) {
  const h = harness(fetcher);
  h.storage.getItem = key => h.storage.get(key) ?? null;
  h.storage.setItem = (key, value) => h.storage.set(key, value);
  h.storage.removeItem = key => h.storage.delete(key);
  h.context.Event = Event;
  h.context.window.dispatchEvent = () => {};
  h.storage.set("nexuslearn_account_session", session.token);
  h.storage.set("nexuslearn_account_role", session.role);
  h.storage.set("nexuslearn_account_session_expires", session.expires_at);
  return h;
}

// Prove settlement even when a transport ignores abort, without a real sleep.
async function settled(pending) {
  let result = "pending";
  pending.then(() => { result = "resolved"; }, () => { result = "rejected"; });
  for (let i = 0; i < 30; i++) await Promise.resolve();
  assert.notEqual(result, "pending", "The private operation must settle at its deadline/cancellation");
}

test("logout removes the local session immediately and bounds an unresponsive revoke", async () => {
  let signal;
  const h = privateHarness((_url, options) => {
    signal = options.signal;
    assert.equal(options.headers.Authorization, "Bearer test-session");
    return new Promise(() => {});
  });
  const pending = h.api.logoutAccount();
  assert.equal(h.storage.size, 0);
  for (const expire of [...h.timers]) expire();
  await settled(pending);
  assert.equal(signal.aborted, true);
  await pending;
  assert.equal(h.timers.size, 0);
});

test("late logout settlement cannot clear a replacement account", async () => {
  let finish;
  const h = privateHarness(() => new Promise(resolve => { finish = resolve; }));
  const pending = h.api.logoutAccount();
  h.api.storeAccountSession({ ...session, token: "replacement" });
  finish(response({}));
  await pending;
  assert.equal(h.storage.get("nexuslearn_account_session"), "replacement");
  assert.equal(h.timers.size, 0);
});

for (const [name, read] of [
  ["parent portal", (api, signal) => api.getParentPortal(signal)],
  ["child evidence", (api, signal) => api.getParentChildEvidence("child/private", signal)],
]) {
  test(`${name} deadline settles a permanently stalled response body`, async () => {
    let signal;
    const h = privateHarness(async (_url, options) => {
      signal = options.signal;
      assert.equal(options.cache, "no-store");
      return { ok: true, json: () => new Promise(() => {}) };
    });
    const pending = read(h.api);
    const failure = assert.rejects(pending, /timed out/);
    await Promise.resolve();
    for (const expire of [...h.timers]) expire();
    await settled(pending);
    await failure;
    assert.equal(signal.aborted, true);
    assert.equal(h.timers.size, 0);
  });

  test(`${name} caller cancellation settles and rejects a late private response`, async () => {
    let finish;
    const caller = new AbortController();
    const h = privateHarness(() => new Promise(resolve => { finish = resolve; }));
    const pending = read(h.api, caller.signal);
    const failure = assert.rejects(pending, /cancelled/);
    caller.abort();
    await settled(pending);
    finish(response({ parent: { display_name: "Old private parent" }, children: [] }));
    await failure;
    assert.equal(h.timers.size, 0);
  });

  test(`${name} does not fetch for an already cancelled caller`, async () => {
    let requests = 0;
    const h = privateHarness(async () => { requests++; return response({}); });
    const caller = new AbortController();
    caller.abort();
    await assert.rejects(() => read(h.api, caller.signal), /cancelled/);
    assert.equal(requests, 0);
    assert.equal(h.timers.size, 0);
  });

  test(`${name} does not return the previous owner's data after account replacement`, async () => {
    let finish;
    const h = privateHarness(() => new Promise(resolve => { finish = resolve; }));
    const pending = read(h.api);
    h.api.storeAccountSession({ ...session, token: "replacement" });
    finish(response({ parent: { display_name: "Old private parent" }, children: [] }));
    await assert.rejects(pending, /session changed|cancelled/);
    assert.equal(h.timers.size, 0);
  });
}

// Execute the real handler; browser coverage separately checks rendered state.
test("admin sign-out clears private UI before remote revocation settles", async () => {
  const pageSource = await readFile(new URL("../src/app/admin/page.tsx", import.meta.url), "utf8");
  const file = ts.createSourceFile("page.tsx", pageSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "signOutAdmin") handler = node.getText(file);
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(handler);
  let privateVisible = true;
  let finish;
  const context = {
    clearAdminProgress() {}, logoutAccount: () => new Promise(resolve => { finish = resolve; }),
    resetWorkspace() { privateVisible = false; },
    setConfig(value) { privateVisible = value !== null; }, setAccountRole() {}, resetAccountDirectories() {},
    setProgressStudentID() {}, setAdminKey() {}, setContentReviewLedger() {}, setContentReviewDrafts() {},
    auditLedgerRequest: { current: 0 }, versionLedgerRequest: { current: 0 }, releaseLedgerRequest: { current: 0 },
    setAuditLedger() {}, setVersionLedger() {}, setReleaseLedger() {}, emptyAdminLedger() {}, setMessage() {},
  };
  const run = vm.runInNewContext(`${ts.transpileModule(handler, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText}; signOutAdmin`, context);
  const pending = run();
  try { assert.equal(privateVisible, false, "Private admin UI must clear synchronously"); }
  finally { finish(); await pending; }
});

test("verified authentication returns a session without storing or publishing it", async () => {
  const h = harness(async (url, options) => {
    assert.equal(url, "http://api.test/v1/auth/parent-login");
    assert.equal(options.method, "POST");
    assert.equal(options.cache, "no-store");
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(JSON.parse(options.body).login_id, "test-parent");
    return response({ session });
  });
  const result = await h.api.requestAccountSession("/v1/auth/parent-login", { login_id: "test-parent" }, ["parent"]);
  assert.equal(result.session.token, session.token);
  assert.equal(h.storage.size, 0);
  assert.equal(h.timers.size, 0);
});

async function workspaceHarness() {
  const h = privateHarness(() => assert.fail("Workspace subscription must not fetch"));
  h.context.window = Object.assign(new EventTarget(), { sessionStorage: h.storage });
  h.context.document = new EventTarget();
  const effects = [];
  let resets = 0;
  const hookSource = ts.transpileModule(await readFile(new URL("../src/components/role-workspaces/useAccountWorkspace.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const hookContext = {
    exports: {}, AbortController, Error,
    require: name => name === "react" ? {
      useRef: current => ({ current }), useEffect: effect => effects.push(effect), useEffectEvent: callback => callback,
    } : h.api,
  };
  vm.runInNewContext(hookSource, hookContext);
  const workspace = hookContext.exports.default(() => { resets++; });
  const cleanups = effects.map(effect => effect());
  return { ...h, workspace, resets: () => resets, unmount: () => cleanups.forEach(cleanup => cleanup()) };
}

test("idle workspace replacement clears its owner and aborts private reads", async () => {
  const h = await workspaceHarness();
  let finish;
  let signal;
  const current = h.workspace.capture();
  const pending = h.workspace.run(s => { signal = s; return new Promise(resolve => { finish = resolve; }); });
  h.api.storeAccountSession({ ...session, token: "replacement" });
  assert.equal(h.resets(), 1);
  assert.equal(current(), false);
  assert.equal(signal.aborted, true);
  finish("old private result");
  await assert.rejects(pending, /cancelled/);
  h.unmount();
  assert.equal(h.timers.size, 0);
});

test("idle workspace expiry clears private state without another request", async () => {
  const h = await workspaceHarness();
  h.context.Date = class extends Date { static now() { return Date.parse("2100-01-01T00:00:00Z"); } };
  for (const expire of [...h.timers]) expire();
  assert.equal(h.resets(), 1);
  assert.equal(h.storage.size, 0);
  h.unmount();
  assert.equal(h.timers.size, 0);
});

test("a same-token role change invalidates the private workspace", async () => {
  const h = await workspaceHarness();
  const current = h.workspace.capture();
  h.api.storeAccountSession({ ...session, role: "content_reviewer" });
  assert.equal(h.resets(), 1);
  assert.equal(current(), false);
  h.unmount();
});

test("an unmounted workspace cannot start a continuation under a newer owner", async () => {
  const h = await workspaceHarness();
  h.unmount();
  h.api.storeAccountSession({ ...session, token: "replacement" });
  let sent = false;
  await assert.rejects(() => h.workspace.run(async () => { sent = true; return "private"; }), /cancelled/);
  assert.equal(sent, false);
});

test("malformed, expired and wrong-role successful responses fail closed", async () => {
  for (const bad of [null, {}, { session: null }, { session: { ...session, token: 7 } },
    { session: { ...session, token: " " } }, { session: { ...session, role: "pupil" } },
    { session: { ...session, expires_at: undefined } }, { session: { ...session, expires_at: "not-a-date" } },
    { session: { ...session, expires_at: "2000-01-01T00:00:00Z" } }]) {
    const h = harness(async () => response(bad));
    await assert.rejects(() => h.api.requestAccountSession("/v1/auth/parent-login", {}, ["parent"]), /could not be verified/);
    assert.equal(h.timers.size, 0);
  }
});

test("a stalled transport times out, aborts and clears its timer", async () => {
  let signal;
  const h = harness(async (_url, options) => {
    signal = options.signal;
    return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  });
  const pending = h.api.requestAccountSession("/v1/auth/parent-login", {}, ["parent"]);
  assert.equal(h.timers.size, 1);
  for (const expire of h.timers) expire();
  await assert.rejects(pending, /timed out/);
  assert.equal(signal.aborted, true);
  assert.equal(h.timers.size, 0);
});

test("the deadline covers a response body that finishes after timeout", async () => {
  let finish;
  let bodyStarted;
  const started = new Promise(resolve => { bodyStarted = resolve; });
  const h = harness(async () => ({ ok: true, json: () => new Promise(resolve => { finish = resolve; bodyStarted(); }) }));
  const pending = h.api.requestAccountSession("/v1/auth/parent-login", {}, ["parent"]);
  await started;
  for (const expire of h.timers) expire();
  finish({ session });
  await assert.rejects(pending, /timed out/);
  assert.equal(h.timers.size, 0);
});

test("a cancelled caller cannot accept a late successful response", async () => {
  let finish;
  const caller = new AbortController();
  const h = harness(() => new Promise(resolve => { finish = resolve; }));
  const pending = h.api.requestAccountSession("/v1/auth/parent-login", {}, ["parent"], caller.signal);
  caller.abort();
  finish(response({ session }));
  await assert.rejects(pending, /cancelled/);
  assert.equal(h.timers.size, 0);
});

test("an already-cancelled caller does not send credentials", async () => {
  const caller = new AbortController();
  caller.abort();
  const h = harness(() => assert.fail("Cancelled authentication must not start"));
  await assert.rejects(() => h.api.requestAccountSession("/v1/auth/parent-login", {}, ["parent"], caller.signal), /cancelled/);
  assert.equal(h.timers.size, 0);
});

test("a denied login retains the server error without retaining a session", async () => {
  const h = harness(async () => response({ error: "Sign-in details were not recognised.", session }, 401));
  await assert.rejects(() => h.api.requestAccountSession("/v1/auth/parent-login", {}, ["parent"]), /not recognised/);
  assert.equal(h.storage.size, 0);
  assert.equal(h.timers.size, 0);
});

test("a storage failure during session subscription removes partially installed listeners", () => {
  const h = harness(() => assert.fail("Subscription must not send a request"));
  const listeners = new Set();
  for (const target of [h.context.window, h.context.document = {}]) {
    target.addEventListener = event => listeners.add(event);
    target.removeEventListener = event => listeners.delete(event);
  }
  h.context.sessionStorage = { getItem() { throw new Error("Storage temporarily unavailable"); } };
  assert.throws(() => h.api.subscribeAccountSession(() => {}), /Storage temporarily unavailable/);
  assert.equal(listeners.size, 0);
});
