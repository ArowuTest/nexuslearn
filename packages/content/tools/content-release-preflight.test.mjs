import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

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

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tool, ...args], { env: { ...process.env, NEXUSLEARN_ADMIN_TOKEN: "test-session" } });
    let output = "";
    child.stdout.on("data", data => { output += data; });
    child.stderr.on("data", data => { output += data; });
    child.on("error", reject);
    child.on("close", code => resolve({ code, output }));
  });
}

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
