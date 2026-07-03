#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, "../../..");
const packDir = path.join(repoRoot, "packages/content/packs");
const publicRoot = path.join(repoRoot, "apps/web/public/audio/narration/alice");
const manifestPath = path.join(repoRoot, "packages/content/audio/narration-manifest.json");
const publicManifestPath = path.join(repoRoot, "apps/web/public/content/narration-manifest.json");
const reviewPath = path.join(repoRoot, "packages/content/generated/audio/narration-review.html");
const publicReviewPath = path.join(repoRoot, "apps/web/public/content/narration-review.html");
const apiKey = process.env.ELEVENLABS_API_KEY ?? "";
const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "Xb7hH8MSUJpSbSDYk0k2";
const modelId = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";
const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");
const only = argValue("--only") ?? "all";

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

function textHash(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

async function readJSON(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readPreviousManifest() {
  try {
    const manifest = await readJSON(manifestPath);
    return new Map((manifest.items ?? []).map((item) => [item.id, item]));
  } catch (error) {
    if (error?.code === "ENOENT") return new Map();
    throw error;
  }
}

async function collect() {
  const files = (await fs.readdir(packDir)).filter((file) => file.endsWith(".json")).sort();
  const items = [];
  for (const file of files) {
    const pack = await readJSON(path.join(packDir, file));
    for (const step of pack.teaching_sequence ?? []) {
      if (!step.audio_script || (only !== "all" && only !== "lessons")) continue;
      items.push(makeItem(pack.pack_id, "lesson", step.step_id, step.audio_script));
    }
    for (const entry of pack.objective?.vocabulary ?? []) {
      if (!entry.audio_script || (only !== "all" && only !== "vocabulary")) continue;
      items.push(makeItem(pack.pack_id, "vocabulary", entry.term, entry.audio_script));
    }
  }
  return items;
}

function makeItem(packId, kind, sourceId, text) {
  const id = `${packId}--${kind}--${slug(sourceId)}`;
  const relativeFile = `${packId}/${kind}/${slug(sourceId)}.mp3`;
  return {
    id,
    pack_id: packId,
    kind,
    source_id: sourceId,
    text,
    text_sha256: textHash(text),
    voice_id: voiceId,
    voice_name: "Alice - Clear, Engaging Educator",
    model_id: modelId,
    file: `/audio/narration/alice/${relativeFile.replaceAll("\\", "/")}`,
    relative_file: relativeFile,
    production_status: "generated_pending_human_listening",
  };
}

async function requestSpeech(item) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: item.text,
        model_id: modelId,
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.75,
          style: 0.15,
          use_speaker_boost: true,
          speed: item.kind === "lesson" ? 0.94 : 0.92,
        },
      }),
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${detail.slice(0, 500)}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function technicalCheck(buffer) {
  const header = buffer.subarray(0, 3).toString("ascii");
  const id3 = header === "ID3";
  const frameSync = buffer.length > 1 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
  return {
    bytes: buffer.length,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    mp3_signature: id3 || frameSync,
    technical_pass: buffer.length >= 2_000 && (id3 || frameSync),
  };
}

function reusableMetadataMatches(previous, item) {
  return Boolean(
    previous
    && previous.text_sha256 === item.text_sha256
    && previous.voice_id === item.voice_id
    && previous.model_id === item.model_id
    && previous.relative_file === item.relative_file,
  );
}

async function produce(items, previousItems) {
  if (!dryRun && !apiKey) throw new Error("ELEVENLABS_API_KEY is required unless --dry-run is used");
  let produced = 0;
  let skipped = 0;
  let planned = 0;
  for (const [index, item] of items.entries()) {
    const absoluteFile = path.join(publicRoot, item.relative_file);
    const previous = previousItems.get(item.id);
    if (!force && reusableMetadataMatches(previous, item)) {
      try {
        const existing = await fs.readFile(absoluteFile);
        const check = technicalCheck(existing);
        const fileMatchesManifest = Boolean(
          previous.sha256
          && previous.sha256 === check.sha256
          && (previous.bytes === undefined || previous.bytes === check.bytes),
        );
        if (check.technical_pass && fileMatchesManifest) {
          Object.assign(item, check);
          skipped += 1;
          continue;
        }
      } catch {
        // Missing or invalid files are generated below.
      }
    }

    if (dryRun) {
      planned += 1;
      continue;
    }
    await fs.mkdir(path.dirname(absoluteFile), { recursive: true });
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const audio = await requestSpeech(item);
        const check = technicalCheck(audio);
        if (!check.technical_pass) throw new Error(`invalid MP3 response (${check.bytes} bytes)`);
        await fs.writeFile(absoluteFile, audio);
        Object.assign(item, check);
        produced += 1;
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1_500));
      }
    }
    if (!item.technical_pass) throw new Error(`${item.id}: ${lastError?.message ?? "generation failed"}`);
    if ((index + 1) % 10 === 0 || index + 1 === items.length) {
      console.log(`narration progress ${index + 1}/${items.length} produced=${produced} skipped=${skipped}`);
    }
  }
  return { produced, skipped, planned };
}

async function writeManifest(items, summary) {
  const manifest = {
    version: 1,
    status: dryRun ? "planned" : "generated_pending_human_listening",
    generated_at: new Date().toISOString(),
    provider: "ElevenLabs",
    voice: {
      id: voiceId,
      name: "Alice - Clear, Engaging Educator",
      accent: "British",
      model_id: modelId,
    },
    policy: {
      browser_tts_allowed: false,
      phonemes_included: false,
      phoneme_reason: "Pure phonemes require SSP-specialist recording and listening approval.",
      human_listening_approval_required: true,
    },
    totals: {
      assets: items.length,
      lesson_assets: items.filter((item) => item.kind === "lesson").length,
      vocabulary_assets: items.filter((item) => item.kind === "vocabulary").length,
      characters: items.reduce((total, item) => total + item.text.length, 0),
      technical_pass: items.filter((item) => item.technical_pass).length,
      ...summary,
    },
    items,
  };
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.mkdir(path.dirname(publicManifestPath), { recursive: true });
  const rendered = `${JSON.stringify(manifest, null, 2)}\n`;
  await fs.writeFile(manifestPath, rendered);
  await fs.writeFile(publicManifestPath, rendered);
  const review = renderReview(manifest);
  await fs.mkdir(path.dirname(reviewPath), { recursive: true });
  await fs.writeFile(reviewPath, review);
  await fs.writeFile(publicReviewPath, review);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[char]);
}

function renderReview(manifest) {
  const groups = new Map();
  for (const item of manifest.items) {
    const group = groups.get(item.pack_id) ?? [];
    group.push(item);
    groups.set(item.pack_id, group);
  }
  const sections = Array.from(groups.entries()).map(([packID, items]) => `
    <section>
      <h2>${escapeHTML(packID)}</h2>
      ${items.map((item) => `
        <article>
          <div><strong>${escapeHTML(item.kind)} · ${escapeHTML(item.source_id)}</strong></div>
          <p>${escapeHTML(item.text)}</p>
          <audio controls preload="none" src="${escapeHTML(item.file)}"></audio>
          <div class="review">Review: ☐ natural ☐ clear ☐ correct pronunciation ☐ suitable for age</div>
        </article>`).join("")}
    </section>`).join("");
  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <title>NexusLearn narration listening review</title>
  <style>
    body{font-family:Inter,system-ui,sans-serif;margin:32px;background:#f5f8ff;color:#17233f}
    header,section{max-width:980px;margin:0 auto 24px;background:white;border:1px solid #dbe5f2;border-radius:18px;padding:22px}
    article{padding:16px 0;border-top:1px solid #e4ebf4}
    article:first-of-type{border-top:0} audio{width:min(100%,520px)} p{line-height:1.55}
    .review{margin-top:8px;color:#4a5570;font-size:14px}
  </style>
</head>
<body>
  <header>
    <h1>NexusLearn narration listening review</h1>
    <p>Voice: ${escapeHTML(manifest.voice.name)}. These files passed automated format checks but remain pending human listening approval. Pure phoneme assets are intentionally excluded.</p>
    <p>${manifest.totals.assets} assets · ${manifest.totals.characters} characters · ${manifest.totals.technical_pass} technical passes.</p>
  </header>
  ${sections}
</body>
</html>
`;
}

const items = await collect();
const previousItems = await readPreviousManifest();
const summary = await produce(items, previousItems);
if (!dryRun) await writeManifest(items, summary);
console.log(
  `narration assets=${items.length} lessons=${items.filter((item) => item.kind === "lesson").length} vocabulary=${items.filter((item) => item.kind === "vocabulary").length} characters=${items.reduce((total, item) => total + item.text.length, 0)} produced=${summary.produced} skipped=${summary.skipped} planned=${summary.planned}`,
);
