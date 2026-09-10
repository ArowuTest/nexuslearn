import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const voice = { id: "Xb7hH8MSUJpSbSDYk0k2", model_id: "eleven_multilingual_v2" };
const settings = { stability: 0.55, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true, speed: 0.94 };
const hash = value => crypto.createHash("sha256").update(value).digest("hex");

// Structurally valid MPEG frames for the producer's format check, not listening evidence.
const audio = Buffer.alloc(417 * 8);
for (let offset = 0; offset < audio.length; offset += 417) audio.set([0xff, 0xfb, 0x90, 0], offset);
const generatedAudio = Buffer.from(audio);
generatedAudio[4] = 1;

async function fixture(t, items) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-narration-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const tools = path.join(root, "packages/content/tools");
  await fs.mkdir(tools, { recursive: true });
  await fs.copyFile(path.join(toolDir, "produce-narration.mjs"), path.join(tools, "produce-narration.mjs"));
  await fs.cp(path.join(toolDir, "lib"), path.join(tools, "lib"), { recursive: true, filter: file => !file.endsWith(".test.mjs") });
  const manifestPath = path.join(root, "packages/content/audio/narration-manifest.json");
  const rows = [];
  for (const [index, input] of items.entries()) {
    const packID = `test-y${input.year ?? 3}-${index}`;
    const text = `Listen to teaching step ${index}.`;
    const relative = `${packID}/lesson/teach.mp3`;
    const row = {
      id: `${packID}--lesson--teach`, pack_id: packID, kind: "lesson", source_id: "teach",
      text, text_sha256: hash(text), voice_id: voice.id, model_id: voice.model_id,
      year: input.year ?? 3, file: `/audio/narration/alice/${relative}`, relative_file: relative,
      sha256: hash(audio), bytes: audio.length, technical_pass: true,
      production_status: "generated_pending_human_listening", ...input,
    };
    rows.push(row);
    const packPath = path.join(root, "packages/content/packs", `${packID}.json`);
    await fs.mkdir(path.dirname(packPath), { recursive: true });
    await fs.writeFile(packPath, JSON.stringify({ pack_id: packID, source_alignment: { year: row.year }, teaching_sequence: [{ step_id: "teach", audio_script: text }] }));
    const file = path.join(root, "apps/web/public/audio/narration/alice", relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, audio);
  }
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify({ version: 1, voice, items: rows }));
  const entry = pathToFileURL(path.join(tools, "produce-narration.mjs")).href;
  return {
    root, rows, manifestPath,
    readManifest: async () => JSON.parse(await fs.readFile(manifestPath, "utf8")),
    run(args = [], responses = [200], publicationFault = null) {
      const script = `
        import fs from 'node:fs/promises';
        process.argv = [process.execPath, 'produce-narration.mjs', ...${JSON.stringify(args)}];
        let call = 0;
        const responses = ${JSON.stringify(responses)};
        const rename = fs.rename;
        let publicationFault = ${JSON.stringify(publicationFault)};
        fs.rename = async (from, to) => {
          if (publicationFault && to === ${JSON.stringify(path.join(root, "apps/web/public/content/narration-manifest.json"))}) {
            const fault = publicationFault;
            publicationFault = null;
            if (fault === 'crash') process.exit(75);
            throw new Error('injected publication failure');
          }
          return rename(from, to);
        };
        const originalTimeout = AbortSignal.timeout;
        AbortSignal.timeout = milliseconds => {
          if (!(milliseconds > 0 && milliseconds <= 120_000)) throw new Error('unbounded request deadline');
          return originalTimeout(40);
        };
        globalThis.fetch = async (url, init) => {
          if (!String(url).startsWith('https://api.elevenlabs.io/v1/text-to-speech/')) throw new Error('unexpected network target');
          await fs.appendFile(${JSON.stringify(path.join(root, "requests.jsonl"))}, JSON.stringify({url, method: init.method, body: JSON.parse(init.body)}) + '\\n');
          const response = responses[Math.min(call++, responses.length - 1)];
          if (response === 'stalled_headers' || response === 'stalled_body') {
            const stalled = () => new Promise((resolve, reject) => {
              const keepAlive = setInterval(() => {}, 100);
              const abort = () => { clearInterval(keepAlive); reject(init.signal.reason); };
              if (init.signal?.aborted) abort();
              else init.signal?.addEventListener('abort', abort, {once: true});
            });
            if (response === 'stalled_headers') return stalled();
            return { ok: true, arrayBuffer: stalled };
          }
          if (response === 'network') throw new Error('socket closed after request was sent');
          if (response === 'invalid') return new Response('not an MP3', {status: 200});
          return new Response(response === 200 ? Buffer.from('${generatedAudio.toString("base64")}', 'base64') : 'provider detail must not leak offline-test-only', { status: response, headers: {'content-type': 'audio/mpeg'} });
        };
        await import(${JSON.stringify(entry)});
      `;
      return spawnSync(process.execPath, ["--input-type=module", "-e", script], {
        encoding: "utf8", timeout: responses.some(response => String(response).startsWith("stalled_")) ? 2500 : 20_000,
        env: { ...process.env, ELEVENLABS_API_KEY: "offline-test-only", ELEVENLABS_VOICE_ID: voice.id, ELEVENLABS_MODEL_ID: voice.model_id },
      });
    },
    async requests() {
      try { return (await fs.readFile(path.join(root, "requests.jsonl"), "utf8")).trim().split("\n").filter(Boolean).map(JSON.parse); }
      catch (error) { if (error.code === "ENOENT") return []; throw error; }
    },
  };
}

test("unknown historical settings block production without rewriting or charging", async t => {
  const f = await fixture(t, [{}]);
  const before = await fs.readFile(f.manifestPath, "utf8");
  const result = f.run();
  assert.notEqual(result.status, 0, "unknown settings must not be silently certified from today's defaults");
  assert.match(result.stderr, /unknown.*settings|settings.*unknown/i);
  assert.equal(await fs.readFile(f.manifestPath, "utf8"), before);
  assert.equal((await f.requests()).length, 0);
});

test("dry-run reports unknown settings as work, with no writes or provider calls", async t => {
  const f = await fixture(t, [{}]);
  const before = await fs.readFile(f.manifestPath, "utf8");
  const result = f.run(["--dry-run"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /planned=1/);
  assert.match(result.stdout, /unknown_settings=1/);
  assert.equal(await fs.readFile(f.manifestPath, "utf8"), before);
  assert.equal((await f.requests()).length, 0);
});

test("equivalent recorded settings reuse bytes regardless of JSON key order", async t => {
  const reversed = Object.fromEntries(Object.entries(settings).reverse());
  const f = await fixture(t, [{ voice_settings: reversed }]);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal((await f.requests()).length, 0, "object key order must not trigger a paid generation");
  assert.equal((await f.readManifest()).totals.skipped, 1);
});

test("filtered generation preserves unselected recordings without inventing settings", async t => {
  const f = await fixture(t, [{}, { year: 1, voice_settings: { ...settings, speed: 0.80 }, pacing_profile: "recorded-slower", listening_status: "pending" }]);
  const result = f.run(["--pack", f.rows[0].pack_id, "--force"]);
  assert.equal(result.status, 0, result.stderr);
  const manifest = await f.readManifest();
  assert.equal(manifest.items.length, 2, "a filtered batch must not drop an unrelated, valid recording");
  assert.deepEqual(manifest.items.find(item => item.id === f.rows[1].id).voice_settings, { ...settings, speed: 0.80 });
  assert.equal(manifest.items.find(item => item.id === f.rows[1].id).pacing_profile, "recorded-slower");
  assert.equal(manifest.items.find(item => item.id === f.rows[1].id).listening_status, "pending");
});

test("filtered reuse leaves unknown historical speed absent in both manifests", async t => {
  const f = await fixture(t, [{ voice_settings: settings }, {}]);
  const result = f.run(["--pack", f.rows[0].pack_id]);
  assert.equal(result.status, 0, result.stderr);
  const historical = (await f.readManifest()).items.find(item => item.id === f.rows[1].id);
  assert.ok(historical, "unselected historical recording remains available for review");
  assert.equal(historical.voice_settings, undefined);
  assert.equal(historical.pacing_profile, undefined);
  const publicManifest = JSON.parse(await fs.readFile(path.join(f.root, "apps/web/public/content/narration-manifest.json"), "utf8"));
  assert.equal(publicManifest.items.find(item => item.id === historical.id).speed, undefined);
});

for (const failure of [401, 429, 500, "network", "invalid"]) {
  test(`a ${failure} generation failure does not automatically repeat a billable POST`, async t => {
    const f = await fixture(t, [{ voice_settings: settings }]);
    const before = await fs.readFile(f.manifestPath, "utf8");
    const result = f.run(["--force"], [failure]);
    assert.notEqual(result.status, 0);
    assert.equal((await f.requests()).length, 1, "uncertain or rejected POSTs require an explicit retry decision");
    assert.equal(await fs.readFile(f.manifestPath, "utf8"), before);
    assert.doesNotMatch(result.stderr, /offline-test-only/);
  });
}

test("a later provider failure keeps published files intact and resumes verified paid work", async t => {
  const f = await fixture(t, [{ voice_settings: settings }, { voice_settings: settings }]);
  const before = await fs.readFile(f.manifestPath, "utf8");
  const first = f.run(["--force"], [200, 401]);
  assert.notEqual(first.status, 0);
  assert.equal(await fs.readFile(f.manifestPath, "utf8"), before);
  for (const row of f.rows) {
    assert.deepEqual(await fs.readFile(path.join(f.root, "apps/web/public/audio/narration/alice", row.relative_file)), audio,
      "no selected public file is replaced until the entire provider batch is ready");
  }
  const second = f.run(["--force"]);
  assert.equal(second.status, 0, second.stderr);
  assert.equal((await f.requests()).length, 3, "the previously verified response must not be paid for twice");
  const manifest = await f.readManifest();
  assert.equal(manifest.totals.resumed, 1);
  assert.equal(manifest.totals.produced, 1);
  assert.equal(manifest.items.length, 2);
  for (const row of manifest.items) {
    assert.equal(row.sha256, hash(generatedAudio));
    assert.equal(row.production_status, "generated_pending_human_listening");
    assert.ok(row.generated_at);
  }
});

test("re-recording clears all old generation and listening assertions", async t => {
  const f = await fixture(t, [{ voice_settings: settings, generated_at: "2020-01-01T00:00:00Z", human_listening_approved: true, listening_status: "approved", reviewer_name: "old reviewer" }]);
  const result = f.run(["--force"]);
  assert.equal(result.status, 0, result.stderr);
  const item = (await f.readManifest()).items[0];
  assert.notEqual(item.generated_at, "2020-01-01T00:00:00Z");
  assert.equal(item.reviewer_name, undefined);
  assert.equal(item.human_listening_approved, undefined);
  assert.equal(item.listening_status, undefined);
});

test("selected reuse preserves absent historical profile fields", async t => {
  const f = await fixture(t, [{ voice_settings: settings }]);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const item = (await f.readManifest()).items[0];
  assert.equal(item.pacing_profile, undefined);
  assert.equal(item.voice_name, undefined);
  const publicManifest = JSON.parse(await fs.readFile(path.join(f.root, "apps/web/public/content/narration-manifest.json"), "utf8"));
  assert.equal(publicManifest.items[0].pacing_profile, undefined);
});

for (const failure of ["stalled_headers", "stalled_body"]) {
  test(`${failure} aborts through one bounded deadline without retry or publication`, async t => {
    const f = await fixture(t, [{ voice_settings: settings }]);
    const before = await fs.readFile(f.manifestPath, "utf8");
    const result = f.run(["--force"], [failure]);
    assert.match(result.stderr, /timed out|timeout/i, "the producer must terminate, not hang until the test kills it");
    assert.notEqual(result.status, 0);
    assert.equal((await f.requests()).length, 1);
    assert.equal(await fs.readFile(f.manifestPath, "utf8"), before);
  });
}

test("an existing production lock prevents competing writers and paid requests", async t => {
  const f = await fixture(t, [{ voice_settings: settings }]);
  await fs.mkdir(path.join(f.root, ".agent/narration-production/run.lock"), { recursive: true });
  const result = f.run(["--force"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /lock|another.*production/i);
  assert.equal((await f.requests()).length, 0);
});

test("a manifest publication failure rolls back files and resumes without another charge", async t => {
  const f = await fixture(t, [{ voice_settings: settings }]);
  const before = await fs.readFile(f.manifestPath, "utf8");
  const first = f.run(["--force"], [200], "failure");
  assert.notEqual(first.status, 0);
  assert.equal(await fs.readFile(f.manifestPath, "utf8"), before, "canonical inventory must roll back with the files");
  assert.deepEqual(await fs.readFile(path.join(f.root, "apps/web/public/audio/narration/alice", f.rows[0].relative_file)), audio);
  const second = f.run(["--force"]);
  assert.equal(second.status, 0, second.stderr);
  assert.equal((await f.requests()).length, 1);
  assert.equal((await f.readManifest()).items[0].sha256, hash(generatedAudio));
});

test("a terminated publication requires recovery before dry-run and resumes its paid response", async t => {
  const f = await fixture(t, [{ voice_settings: settings }]);
  const first = f.run(["--force"], [200], "crash");
  assert.equal(first.status, 75);
  // This fixture's child process has exited; explicitly remove only its owned stale lock.
  await fs.rm(path.join(f.root, ".agent/narration-production/run.lock"), { recursive: true });
  const preview = f.run(["--dry-run"]);
  assert.notEqual(preview.status, 0, "a partially published inventory cannot be treated as a valid preview");
  assert.match(preview.stderr, /publication.*recover|recover.*publication/i);
  const second = f.run(["--force"]);
  assert.equal(second.status, 0, second.stderr);
  assert.equal((await f.requests()).length, 1);
  assert.equal((await f.readManifest()).items[0].sha256, hash(generatedAudio));
});

test("a missing publication journal preserves orphaned backups and fails closed", async t => {
  const f = await fixture(t, [{ voice_settings: settings }]);
  assert.equal(f.run(["--force"], [200], "crash").status, 75);
  const production = path.join(f.root, ".agent/narration-production");
  await fs.rm(path.join(production, "run.lock"), { recursive: true });
  await fs.unlink(path.join(production, "publication/state.json"));
  const backup = await fs.readFile(path.join(production, "publication/0.bin"));
  const result = f.run(["--force"]);
  assert.notEqual(result.status, 0, "missing state is not proof that publication never began");
  assert.match(result.stderr, /journal|recovery/i);
  assert.deepEqual(await fs.readFile(path.join(production, "publication/0.bin")), backup);
  assert.equal((await f.requests()).length, 1);
});
