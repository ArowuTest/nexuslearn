import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  createReviewAPI,
  evidenceIdempotencyKey,
  importEvidence,
  verifyBatchIdentity,
} from "./import-ai-review-evidence.mjs";

const unit = {
  content_id: "en-y3-reading-v1",
  content_type: "variant",
  content_revision: "1.0.0",
  content_hash: "a".repeat(64),
  pack_id: "en-y3-reading",
  year_group: 3,
  subject: "English",
  risk_tier: "tier_2",
  reviewed_variant_ids: ["en-y3-reading-v1"],
};

const evidence = {
  ...unit,
  lane_id: "ai_curriculum_lead",
  status: "approved",
  rubric_revision: "curriculum-send-v1",
  source_set_revision: "sources-v1",
  reviewer_implementation: "reviewer-v1",
  model_identifier: "gpt-5",
  confidence: 0.95,
  criterion_results: { alignment: { result: "met", evidence: "Checked." } },
  source_ids: ["govuk-english"],
  evidence_notes: "AI curriculum evidence.",
  findings: [],
};

const batch = {
  schema_version: 1,
  rubric_revision: "curriculum-send-v1",
  source_set_revision: "sources-v1",
  reviewer_implementation: "reviewer-v1",
  totals: { packs: 1, variants: 1, review_units: 1 },
  packs: [{
    pack_id: "en-y3-reading",
    year_group: 3,
    subject: "English",
    content_revision: "1.0.0",
    pack_review: { ...unit, content_id: "en-y3-reading", content_type: "pack" },
    variant_families: [],
    direct_variant_ids: ["en-y3-reading-v1"],
    variants: [unit],
  }],
};

test("import key is stable for one immutable review identity", () => {
  assert.equal(evidenceIdempotencyKey(evidence), evidenceIdempotencyKey({ ...evidence }));
  assert.match(evidenceIdempotencyKey(evidence), /^[0-9a-f]{64}$/);
});

const secret = "fake-review-session-do-not-print";
const savedEvidence = value => ({ ...value, id: "evidence-1", created_at: "2026-01-01T00:00:00Z", stale: false });

async function listen(t, handler) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

async function failure(operation) {
  try { await operation(); } catch (error) {
    assert.equal(String(error.stack).includes(secret.slice(0, 8)), false, "error disclosed a fake secret/server body");
    return error;
  }
  assert.fail("operation accepted an unsafe transport/result");
}

test("review API rejects unsafe URL components before fetch", async () => {
  let requests = 0;
  const fetchImpl = async () => { requests++; return Response.json(savedEvidence(evidence)); };
  for (const baseURL of [
    `http://example.invalid/${secret}`, `https://${secret}@example.invalid`, "https://@example.invalid",
    `https://example.invalid/?token=${secret}`, `https://example.invalid/#${secret}`,
    "https://example.invalid/?", "https://example.invalid/#", `invalid-${secret}`,
    "ftp://127.0.0.1", "http://localhost.evil.invalid", "http://2130706433", "http://127.1",
  ]) {
    const error = await failure(async () => createReviewAPI({ baseURL, token: secret, fetchImpl }).save(evidence, "key"));
    assert.match(error.message, /invalid admin API URL/i);
    assert.equal(requests, 0);
  }
});

test("review API accepts HTTPS and explicit loopback URLs without dropping base paths", async () => {
  for (const baseURL of ["https://example.invalid/prefix/", "http://127.0.0.1:8080/prefix/", "http://localhost/prefix/", "http://[::1]/prefix/"]) {
    let target;
    const api = createReviewAPI({ baseURL, token: secret, fetchImpl: async (url, init) => {
      target = url;
      assert.equal(init.method, "POST");
      assert.ok(init.headers.Authorization === `Bearer ${secret}`);
      assert.equal(init.headers["Idempotency-Key"], "test-key");
      return Response.json(savedEvidence(evidence));
    } });
    const result = await api.save(evidence, "test-key");
    assert.equal(result.id, "evidence-1");
    assert.equal(target, `${baseURL.replace(/\/$/, "")}/v1/admin/ai-reviews`);
  }
});

test("review importer never follows authenticated redirects, even on the same origin", async t => {
  let received = 0;
  const receiver = await listen(t, (_req, res) => { received++; res.end(JSON.stringify(savedEvidence(evidence))); });
  for (const sameOrigin of [false, true]) {
    let requests = 0;
    const origin = await listen(t, (req, res) => {
      requests++;
      if (req.url.startsWith("/sink")) { received++; res.end(JSON.stringify(savedEvidence(evidence))); return; }
      res.writeHead(307, { Location: `${sameOrigin ? "" : receiver.url}/sink?token=${secret}` });
      res.end(secret);
    });
    const delays = [];
    const error = await failure(() => importEvidence({ report: { evidence: [evidence] }, batch, api: createReviewAPI({ baseURL: origin.url, token: secret }), sleep: async ms => { delays.push(ms); } }));
    assert.equal(error.kind, "redirect");
    assert.equal(delays.length, 0, "redirect must not enter retry backoff");
    assert.equal(received, 0);
    assert.equal(requests, 1);
  }
});

for (const phase of ["headers", "body"]) {
  test(`review API deadline includes stalled ${phase}`, async t => {
    let requests = 0;
    const { server, url } = await listen(t, (req, res) => {
      requests++; req.resume();
      if (phase === "body") { res.writeHead(200, { "Content-Type": "application/json" }); res.write('{"id":'); }
    });
    let expired = false;
    const watchdog = setTimeout(() => { expired = true; server.closeAllConnections(); }, 1500);
    try {
      const error = await failure(() => createReviewAPI({ baseURL: url, token: secret, timeoutMs: 80 }).save(evidence, "key"));
      assert.equal(expired, false, "response exceeded the injected deadline");
      assert.match(error.message, /timed out/i);
      assert.equal(requests, 1, "transport itself must not retry");
    } finally { clearTimeout(watchdog); }
  });
}

test("review importer stops the whole import on auth, conflict, schema, malformed or oversized results", async t => {
  const records = [evidence, { ...evidence, lane_id: "ai_send_lead" }];
  const cases = [
    ...[400, 401, 403, 409, 422, 500, 501].map(status => ({ status, body: secret })),
    { status: 200, body: `{"detail":"${secret}"` },
    { status: 200, body: `${secret} is not JSON` },
    ...[null, [], {}, { ...savedEvidence(evidence), content_hash: "b".repeat(64) }, { ...savedEvidence(evidence), status: "wrong" }]
      .map(body => ({ status: 200, body: JSON.stringify(body) })),
    { status: 200, body: JSON.stringify({ ...savedEvidence(evidence), padding: "x".repeat(4096) }) },
  ];
  for (const scenario of cases) {
    let requests = 0;
    const delays = [];
    const { url } = await listen(t, (req, res) => { requests++; req.resume(); res.writeHead(scenario.status); res.end(scenario.body); });
    await failure(() => importEvidence({
      report: { evidence: records }, batch,
      api: createReviewAPI({ baseURL: url, token: secret, maxResponseBytes: 4096 }),
      sleep: async ms => { delays.push(ms); },
    }));
    assert.equal(delays.length, 0, "terminal result must not enter retry backoff");
    assert.equal(requests, 1, "must not retry or continue to next record");
  }
});

test("review retry-after and retry count are bounded for each transient status", async t => {
  for (const status of [429, 502, 503, 504]) {
    const requests = [];
    const { url } = await listen(t, async (req, res) => {
      let body = "";
      for await (const part of req) body += part;
      requests.push({ body, key: req.headers["idempotency-key"] });
      res.writeHead(status, { "Retry-After": "999999999999" });
      res.end(secret);
    });
    const delays = [];
    await failure(() => importEvidence({ report: { evidence: [evidence] }, batch,
      api: createReviewAPI({ baseURL: url, token: secret }), sleep: async ms => { delays.push(ms); },
    }));
    assert.equal(requests.length, 5, "four retries total; no multiplying transport layer");
    assert.equal(delays.length, 4);
    assert.ok(delays.every(ms => Number.isFinite(ms) && ms > 0 && ms <= 8000), "server cannot choose an unbounded delay");
    assert.equal(new Set(requests.map(req => req.body)).size, 1);
    assert.equal(new Set(requests.map(req => req.key)).size, 1);
  }
});

test("negative or invalid retry-after uses finite positive backoff", async t => {
  for (const retryAfter of ["-999", "not-a-delay", "0", "Infinity"]) {
    let requests = 0;
    const { url } = await listen(t, (_req, res) => {
      requests++;
      if (requests === 1) { res.writeHead(503, { "Retry-After": retryAfter }); res.end(); }
      else res.end(JSON.stringify(savedEvidence(evidence)));
    });
    const delays = [];
    const result = await importEvidence({ report: { evidence: [evidence] }, batch,
      api: createReviewAPI({ baseURL: url, token: secret }), sleep: async ms => { delays.push(ms); },
    });
    assert.equal(result.imported, 1);
    assert.equal(requests, 2);
    assert.ok(delays.length === 1 && delays[0] > 0 && delays[0] <= 8000);
  }
});

test("lost review acknowledgement replays identical bytes/key and commits one immutable record", async t => {
  const original = structuredClone(evidence);
  const requests = [];
  const committed = new Map();
  const { url } = await listen(t, async (req, res) => {
    let body = "";
    for await (const part of req) body += part;
    const key = req.headers["idempotency-key"];
    requests.push({ body, key, route: req.url, auth: req.headers.authorization });
    if (!committed.has(key)) { committed.set(key, body); res.destroy(); return; }
    if (committed.get(key) !== body) { res.writeHead(409); res.end(); return; }
    res.end(JSON.stringify(savedEvidence(JSON.parse(body))));
  });
  const result = await importEvidence({ report: { evidence: [original] }, batch,
    api: createReviewAPI({ baseURL: `${url}/prefix/`, token: secret }),
    sleep: async () => { original.evidence_notes = "caller changed its copy"; original.source_ids.push("changed"); },
  });
  assert.equal(result.imported, 1);
  assert.equal(requests.length, 2);
  assert.equal(committed.size, 1);
  assert.equal(requests[0].body, requests[1].body);
  assert.deepEqual(JSON.parse(requests[0].body), evidence);
  assert.equal(requests[0].key, evidenceIdempotencyKey(evidence));
  assert.equal(requests[1].key, requests[0].key);
  assert.ok(requests.every(req => req.route === "/prefix/v1/admin/ai-reviews" && req.auth === `Bearer ${secret}`));
});

test("invalid retry budgets fail before making requests", async () => {
  for (const maxRetries of [-1, 1.5, NaN, Infinity, 100]) {
    let requests = 0;
    await failure(() => importEvidence({ report: { evidence: [evidence] }, batch, maxRetries,
      api: { save: async () => { requests++; return savedEvidence(evidence); } },
    }));
    assert.equal(requests, 0);
  }
});

test("review CLI dry-run sends zero requests and failure diagnostics contain no server secrets", async t => {
  const dir = await mkdtemp(path.join(tmpdir(), "nexus-review-transport-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const cohortPath = path.join(dir, "cohort.json");
  const batchPath = path.join(dir, "batch.json");
  const reportPath = path.join(dir, "report.json");
  await writeFile(batchPath, JSON.stringify(batch));
  await writeFile(cohortPath, JSON.stringify({ ...batch, decisions: [evidence] }));
  await writeFile(reportPath, JSON.stringify({ ...batch, decision_files: [cohortPath], evidence_index: [evidence] }));
  let requests = 0;
  let response = `${secret} is not JSON`;
  const { url } = await listen(t, (req, res) => { requests++; req.resume(); res.end(response); });
  const tool = fileURLToPath(new URL("./import-ai-review-evidence.mjs", import.meta.url));
  async function run(extra = []) {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [tool, "--batch", batchPath, "--report", reportPath, "--api-url", url, ...extra], {
        env: { SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, NEXUSLEARN_ACCOUNT_SESSION: secret },
      });
      let output = "";
      const watchdog = setTimeout(() => child.kill(), 10_000);
      child.stdout.on("data", data => { output += data; });
      child.stderr.on("data", data => { output += data; });
      child.on("error", reject);
      child.on("close", code => { clearTimeout(watchdog); resolve({ code, output }); });
    });
  }
  const dry = await run(["--dry-run"]);
  assert.equal(dry.code, 0);
  assert.match(dry.output, /writes=0 mode=dry-run/);
  assert.equal(requests, 0);
  const badJSON = await run();
  assert.equal(badJSON.output.includes(secret.slice(0, 8)), false, "CLI must sanitize parser errors");
  assert.equal(badJSON.code, 1);
  assert.equal(requests, 1);
  response = "{}";
  const badSchema = await run();
  assert.equal(badSchema.code, 1);
  assert.equal(requests, 2);
});

test("import refuses evidence absent from the current review batch", async () => {
  const stale = { ...evidence, content_id: "removed-unit" };
  await assert.rejects(
    () => importEvidence({ report: { evidence: [stale] }, batch, api: { save: () => assert.fail("must not write") } }),
    /stale review unit removed-unit/,
  );
});

test("import is deterministic and carries stable idempotency keys", async () => {
  const writes = [];
  const result = await importEvidence({
    report: { evidence: [{ ...evidence, lane_id: "ai_send_lead" }, evidence] },
    batch,
    api: { save: async (payload, key) => writes.push({ payload, key }) },
  });
  assert.equal(result.imported, 2);
  assert.deepEqual(writes.map((item) => item.payload.lane_id), ["ai_curriculum_lead", "ai_send_lead"]);
  assert.deepEqual(writes.map((item) => item.key), writes.map((item) => evidenceIdempotencyKey(item.payload)));
});

test("batch identity verification rejects a material hash mismatch", () => {
  assert.throws(() => verifyBatchIdentity({ ...batch, batch_hash: "0".repeat(64) }), /batch hash/);
});
