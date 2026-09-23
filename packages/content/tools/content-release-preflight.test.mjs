import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const tool = fileURLToPath(new URL("./content-release.mjs", import.meta.url));
const canonical = (v) => JSON.stringify(sort(v));
function sort(v) {
  if (Array.isArray(v)) return v.map(sort);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map(k => [k, sort(v[k])]));
  return v;
}
const sha = (v) => createHash("sha256").update(canonical(v)).digest("hex");
const hash = (c) => c.repeat(64);

async function fixture(directory) {
  const payload = { pack_id: "pack-1" };
  const pack = { pack_id: "pack-1", pack_version: "1.0.0", payload_sha256: sha(payload), objective_count: 1, activity_count: 0, question_count: 0, reward_rule_count: 0 };
  const packs = [pack];
  const manifest = {
    id: `nexuslearn-live-${sha(packs).slice(0, 16)}`, schema_version: "1.0", channel: "live", source_revision: "test",
    manifest_sha256: sha(packs), expected_pack_count: 1, expected_objective_count: 1, expected_activity_count: 0, expected_question_count: 0, expected_reward_rule_count: 0,
    packs, metadata: {
      ai_review_identities: [{ content_id: "pack-1", content_hash: pack.payload_sha256, rubric_revision: "rubric", source_set_revision: "sources", reviewer_implementation: "reviewer" }],
      human_review_batch_id: "batch", human_review_batch_sha256: hash("b"), audio_release_id: `narration-release-v2-${"a".repeat(24)}`, audio_release_sha256: hash("a"),
      audio_catalogue_id: `variant-audio-catalog-v1-${"b".repeat(24)}`, audio_catalogue_sha256: hash("b"), audio_licence_id: "provider_terms",
      required_audio_assets: [{ asset_id: `narration-v1-${"c".repeat(24)}`, text_sha256: hash("d"), audio_sha256: hash("e"), production_identity_sha256: hash("c"), production_profile_sha256: hash("f") }],
    },
  };
  await mkdir(path.join(directory, "packs"));
  await writeFile(path.join(directory, "manifest.json"), JSON.stringify(manifest));
  await writeFile(path.join(directory, "packs", "pack-1.json"), JSON.stringify({ ...pack, payload }));
  return manifest;
}

const secret = "fake-content-admin-secret-do-not-print";

function run(args, { token = "test-session", fastDeadline = false } = {}) {
  return new Promise((resolve, reject) => {
    // Keep real fetch/streams. Only shorten the production deadline/backoff in this child.
    const bootstrap = `
      const realFetch = globalThis.fetch;
      globalThis.fetch = (url, options) => {
        if (new URL(url).hostname !== '127.0.0.1') throw new Error('test forbids external requests');
        console.log('test-transport-attempt');
        return realFetch(url, options);
      };
      const timer = globalThis.setTimeout;
      globalThis.setTimeout = (fn, ms, ...rest) => timer(fn, ms === 500 || ms === 1000 ? 1 : ms, ...rest);
      if (${fastDeadline}) {
        const timeout = AbortSignal.timeout;
        AbortSignal.timeout = ms => timeout(Math.min(ms, 100));
      }
      process.argv = [process.execPath, ${JSON.stringify(tool)}, ...${JSON.stringify(args)}];
      await import(${JSON.stringify(pathToFileURL(tool).href)});
    `;
    const child = spawn(process.execPath, ["--input-type=module", "-e", bootstrap], {
      env: { SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, NEXUSLEARN_ADMIN_TOKEN: token },
    });
    let output = "";
    let killed = false;
    // Allow process startup on a busy host; transport stalls still use 100 ms deadlines.
    const watchdog = setTimeout(() => { killed = true; child.kill(); }, fastDeadline ? 5000 : 10_000);
    child.stdout.on("data", data => { output += data; });
    child.stderr.on("data", data => { output += data; });
    child.on("error", error => { clearTimeout(watchdog); reject(error); });
    child.on("close", code => { clearTimeout(watchdog); resolve({ code, output, killed, attempts: (output.match(/test-transport-attempt/g) ?? []).length }); });
  });
}

async function releaseFixture(t) {
  const dir = await mkdtemp(path.join(tmpdir(), "nexus-release-transport-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return { dir, manifest: await fixture(dir) };
}

async function listen(t, handler) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}

function safeOutput(result) {
  assert.equal(result.output.includes(secret.slice(0, 8)), false, "CLI disclosed a fake credential/server detail");
  assert.equal(result.killed, false, "CLI did not terminate within its bounded deadline/retries");
}

const readyChecks = () => ["ai_review", "safeguarding", "audio_release", "audio_listening", "child_pilot"]
  .map(code => ({ code, passed: true, message: "requirement satisfied" }));

test("CLI preflight reports blockers without staging and requires matching backend evidence", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "nexus-preflight-"));
  const manifest = await fixture(dir);
  const requests = [];
  let response = { release_id: manifest.id, manifest_sha256: manifest.manifest_sha256, evidence_ready: false, checks: [{ code: "audio_listening", passed: false, message: "human listening approval required" }] };
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    requests.push({ url: req.url, method: req.method, auth: req.headers.authorization, body: JSON.parse(body) });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(response));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const args = ["preflight", dir, "--api", `http://127.0.0.1:${server.address().port}`];
    const blocked = await run(args);
    assert.equal(blocked.code, 1);
    assert.match(blocked.output, /audio_listening/);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "/v1/admin/content/releases/preflight");
    assert.equal(requests[0].method, "POST");
    assert.equal(requests[0].auth, "Bearer test-session");
    assert.deepEqual(requests[0].body, manifest);
    response = { ...response, evidence_ready: true, checks: ["ai_review", "safeguarding", "audio_release", "audio_listening", "child_pilot"].map(code => ({ code, passed: true, message: "requirement satisfied" })) };
    assert.equal((await run(args)).code, 0);
    const fullChecks = response.checks;
    response.checks = [fullChecks[0]];
    assert.equal((await run(args)).code, 1, "partial report must not claim readiness");
    response.checks = fullChecks;
    response.manifest_sha256 = hash("0");
    assert.equal((await run(args)).code, 1, "foreign manifest readiness must not pass");
    assert.equal(requests.length, 4, "preflight must never stage, upload or activate");
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});

test("publisher refuses off-origin and same-origin redirects without forwarding admin credentials", async t => {
  const { dir, manifest } = await releaseFixture(t);
  let received = 0;
  const receiver = await listen(t, (_req, res) => { received++; res.end(JSON.stringify({ content_release: manifest })); });
  for (const status of [301, 302, 303, 307, 308]) {
    for (const sameOrigin of [false, true]) {
      let requests = 0;
      const credentials = [];
      const api = await listen(t, (req, res) => {
        requests++;
        credentials.push({ key: req.headers["x-admin-key"], token: req.headers.authorization });
        if (req.url.startsWith("/sink")) { received++; res.end(JSON.stringify({ content_release: manifest })); return; }
        res.writeHead(status, { Location: `${sameOrigin ? "" : receiver}/sink?credential=${secret}` });
        res.end(secret);
      });
      const result = await run(["publish", dir, "--api", api, "--admin-key", secret], { token: "" });
      safeOutput(result);
      assert.equal(received, 0, "redirect receiver must get zero requests");
      assert.equal(requests, 1, "redirects must not retry");
      assert.ok(credentials.every(auth => auth.key === secret && auth.token === undefined), "admin key is used only when no session is supplied");
      assert.equal(result.code, 1);
    }
  }
});

test("publisher rejects unsafe API URLs with fixed diagnostics before making requests", async t => {
  const { dir } = await releaseFixture(t);
  let requests = 0;
  const api = await listen(t, (_req, res) => { requests++; res.end("{}"); });
  for (const url of [
    `${api}?token=${secret}`, `${api}#${secret}`, `${api}?`, `${api}#`,
    api.replace("//", `//${secret}@`), api.replace("//", "//@"),
    `http://example.invalid/${secret}`, `ftp://127.0.0.1/${secret}`, `not-a-url-${secret}`,
  ]) {
    const result = await run(["publish", dir, "--api", url, "--admin-key", secret], { token: "" });
    safeOutput(result);
    assert.equal(result.code, 1);
    assert.match(result.output, /invalid admin API URL/i);
    assert.equal(requests, 0);
  }
});

for (const phase of ["headers", "body"]) {
  test(`publisher deadline includes stalled ${phase} and exhausts only three attempts`, async t => {
    const { dir } = await releaseFixture(t);
    let requests = 0;
    const api = await listen(t, (req, res) => {
      requests++;
      req.resume();
      if (phase === "body") { res.writeHead(200, { "Content-Type": "application/json" }); res.write('{"content_release":'); }
    });
    const result = await run(["publish", dir, "--api", api, "--token", secret], { fastDeadline: true });
    safeOutput(result);
    assert.equal(result.code, 1);
    assert.match(result.output, /timed out/i);
    assert.equal(result.attempts, 3);
    assert.ok(requests >= 1 && requests <= 3, "a deadline may expire before an attempt reaches the server");
  });
}

test("publisher fails closed on HTTP, JSON, size and acknowledgement errors without printing bodies", async t => {
  const { dir, manifest } = await releaseFixture(t);
  const cases = [
    ...[400, 401, 403, 409, 422, 501].map(status => ({ status, body: secret })),
    { status: 200, body: `{"detail":"${secret}"` },
    { status: 200, body: `${secret} is not JSON` },
    ...[null, [], {}, { content_release: { ...manifest, status: "staged", id: "foreign" } }].map(body => ({ status: 200, body: JSON.stringify(body) })),
    { status: 200, body: JSON.stringify({ padding: "x".repeat(8 * 1024 * 1024), content_release: manifest }) },
  ];
  for (const scenario of cases) {
    let requests = 0;
    const api = await listen(t, (req, res) => {
      requests++; req.resume();
      res.writeHead(scenario.status, { "Content-Type": "application/json" });
      res.end(scenario.body);
    });
    const result = await run(["publish", dir, "--api", api, "--token", secret, "--activate"]);
    safeOutput(result);
    assert.equal(result.code, 1, `invalid acknowledgement must stop publishing (status=${scenario.status}, bytes=${scenario.body.length}): ${result.output}`);
    assert.equal(requests, 1, "terminal response must not retry, upload or activate");
  }
});

test("publisher checks release identity and acknowledgements at every phase", async t => {
  const mutations = [
    ...["id", "schema_version", "channel", "manifest_sha256", "expected_pack_count", "expected_objective_count", "expected_activity_count", "expected_question_count", "expected_reward_rule_count"].map(field => ({
      name: `stage rejects mismatched ${field}`, phase: 1,
      change: ack => { ack.content_release[field] = typeof ack.content_release[field] === "number" ? ack.content_release[field] + 1 : "foreign"; },
    })),
    { name: "upload rejects a different pack", phase: 2, change: ack => { ack.pack_id = "foreign-pack"; } },
    { name: "upload rejects incorrect counts", phase: 2, change: ack => { ack.content_release.expected_question_count++; } },
    { name: "activation requires an explicit acknowledgement", phase: 3, change: ack => { delete ack.activated; } },
    { name: "activation cannot acknowledge false", phase: 3, change: ack => { ack.activated = false; } },
    { name: "activation requires applied status", phase: 3, change: ack => { ack.content_release.status = "staged"; } },
  ];
  for (const scenario of mutations) await t.test(scenario.name, async subtest => {
    const { dir, manifest } = await releaseFixture(subtest);
    const routes = [];
    const api = await listen(subtest, (req, res) => {
      req.resume();
      routes.push(req.url);
      const phase = routes.length;
      const ack = {
        content_release: { ...manifest, status: phase === 3 ? "applied" : "staged" },
        ...(phase === 2 ? { pack_id: "pack-1" } : {}),
        ...(phase === 3 ? { activated: true } : {}),
      };
      if (phase === scenario.phase) scenario.change(ack);
      res.end(JSON.stringify(ack));
    });
    const result = await run(["publish", dir, "--api", api, "--activate"]);
    safeOutput(result);
    assert.equal(result.code, 1);
    assert.match(result.output, /invalid acknowledgement/);
    assert.equal(routes.length, scenario.phase, "invalid ACK must not retry or advance to a later phase");
    assert.equal(result.output.includes("release activated"), false);
    if (scenario.phase === 2) assert.equal(result.output.includes("release uploaded"), false);
    if (scenario.phase === 1) assert.equal(result.output.includes("release staged"), false);
  });
});

test("publisher preserves prefix, payloads, auth priority and explicit activation across lost acknowledgements", async t => {
  const { dir, manifest } = await releaseFixture(t);
  const requests = [];
  const committed = new Map();
  const api = await listen(t, async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    requests.push({ url: req.url, method: req.method, body, token: req.headers.authorization, key: req.headers["x-admin-key"] });
    if (!committed.has(req.url)) { committed.set(req.url, body); res.destroy(); return; }
    const activation = req.url.endsWith("/activate");
    res.end(JSON.stringify({ content_release: { ...manifest, status: activation ? "applied" : "staged" }, ...(activation ? { activated: true } : { pack_id: "pack-1" }) }));
  });
  const args = ["publish", dir, "--api", `${api}/prefix/`, "--admin-key", secret];
  const staged = await run(args);
  safeOutput(staged);
  assert.equal(staged.code, 0);
  assert.equal(committed.size, 2, "staging and one chunk only; no implicit activation");
  assert.equal(requests.length, 4);
  assert.equal(requests[0].url, "/prefix/v1/admin/content/releases");
  assert.deepEqual(JSON.parse(requests[0].body), manifest);
  assert.equal(requests[0].body, requests[1].body);
  assert.equal(requests[2].body, requests[3].body);
  assert.equal(requests[2].method, "PUT");
  assert.ok(requests.every(req => req.token === "Bearer test-session" && req.key === undefined), "session auth takes priority over admin key");
  const activated = await run([...args, "--activate", "--token", secret]);
  safeOutput(activated);
  assert.equal(activated.code, 0);
  assert.equal(committed.size, 3);
  assert.equal(requests.length, 8);
  assert.equal(requests.at(-1).url, `/prefix/v1/admin/content/releases/${manifest.id}/activate`);
  assert.equal(requests.at(-1).body, "");
  assert.equal(requests.at(-2).body, "");
  assert.ok(requests.slice(4).every(req => req.token === `Bearer ${secret}` && req.key === undefined));
});

test("publisher retries only bounded transient statuses with the same request bytes", async t => {
  const { dir, manifest } = await releaseFixture(t);
  for (const status of [429, 500, 502, 503, 504]) {
    const bodies = [];
    const api = await listen(t, async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      bodies.push(body);
      res.writeHead(status, { "Retry-After": "999999999" });
      res.end(secret);
    });
    const result = await run(["publish", dir, "--api", api]);
    safeOutput(result);
    assert.equal(result.code, 1, result.output);
    assert.equal(bodies.length, 3);
    assert.equal(new Set(bodies).size, 1);
    assert.deepEqual(JSON.parse(bodies[0]), manifest);
  }
});

test("preflight output never echoes untrusted messages or check codes", async t => {
  const { dir, manifest } = await releaseFixture(t);
  let checks = readyChecks().map(check => ({ ...check, message: secret }));
  const api = await listen(t, (_req, res) => res.end(JSON.stringify({ release_id: manifest.id, manifest_sha256: manifest.manifest_sha256, evidence_ready: true, checks })));
  const result = await run(["preflight", dir, "--api", api]);
  safeOutput(result);
  assert.equal(result.code, 0);
  checks = [{ code: secret, passed: false, message: secret }];
  const malformed = await run(["preflight", dir, "--api", api]);
  safeOutput(malformed);
  assert.equal(malformed.code, 1);
});

test("offline release validation never sends requests", async t => {
  const { dir } = await releaseFixture(t);
  let requests = 0;
  const api = await listen(t, (_req, res) => { requests++; res.end("{}"); });
  const result = await run(["validate", dir, "--api", api, "--admin-key", secret]);
  safeOutput(result);
  assert.equal(result.code, 0);
  assert.equal(requests, 0);
});
