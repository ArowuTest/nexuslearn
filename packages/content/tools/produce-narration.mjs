#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectMP3Buffer } from "./lib/mp3-inspection.mjs";
import { buildVariantAudioCatalog, canonicalJSONStringify } from "./lib/variant-audio-catalog.mjs";
import { catalogAssetsToProductionItems, selectProductionItems } from "./lib/narration-manifest-v2.mjs";
import { productionCheckpoint, readProductionCheckpoint, writeProductionCheckpoint, removeProductionCheckpoint, withProductionLock } from "./lib/narration-production-cache.mjs";
import { publishNarrationBatch, recoverNarrationPublication } from "./lib/narration-publication.mjs";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, "../../..");
const packDir = path.join(repoRoot, "packages/content/packs");
const publicRoot = path.join(repoRoot, "apps/web/public/audio/narration/alice");
const manifestPath = path.join(repoRoot, "packages/content/audio/narration-manifest.json");
const publicManifestPath = path.join(repoRoot, "apps/web/public/content/narration-manifest.json");
const reviewPath = path.join(repoRoot, "packages/content/generated/audio/narration-review.html");
const publicReviewPath = path.join(repoRoot, "apps/web/private/content/narration-review.html");
const checkpointRoot = path.join(repoRoot, ".agent/narration-production/assets");
const apiKey = process.env.ELEVENLABS_API_KEY ?? "";
const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "Xb7hH8MSUJpSbSDYk0k2";
const modelId = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";
validateArgs();
const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");
const only = argValue("--only") ?? "all";
const packFilter = argValue("--pack");
const yearFilter = argValue("--year");
const limitValue = argValue("--limit");
if (!dryRun && only === "variants") {
  throw new Error("variant production is fail-closed until manifest v2 backend import is active; use --dry-run to inspect the canonical batch");
}
const narrationPacingPolicy = {
  version: 1,
  year_1: { lesson: 0.92, vocabulary: 0.90, rationale: "slightly slower early-reader pacing" },
  year_2: { lesson: 0.94, vocabulary: 0.92, rationale: "supported early-primary pacing" },
  year_3_to_7: { lesson: 0.94, vocabulary: 0.92, rationale: "standard clear teaching pace" },
};

function validateArgs() {
  const booleanOptions = new Set(["--dry-run", "--force"]);
  const valueOptions = new Set(["--only", "--pack", "--year", "--limit"]);
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (booleanOptions.has(argument)) continue;
    if (valueOptions.has(argument)) {
      const candidate = args[index + 1];
      if (!candidate || candidate.startsWith("--")) throw new Error(`${argument} requires a value`);
      index += 1;
      continue;
    }
    throw new Error(`unknown option: ${argument}`);
  }
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const candidate = process.argv[index + 1];
  if (!candidate || candidate.startsWith("--")) throw new Error(`${name} requires a value`);
  return candidate;
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
    return { manifest, items: new Map((manifest.items ?? []).map((item) => [item.id, item])) };
  } catch (error) {
    if (error?.code === "ENOENT") return { manifest: null, items: new Map() };
    throw error;
  }
}

async function collect() {
  const files = (await fs.readdir(packDir)).filter((file) => file.endsWith(".json")).sort();
  const items = [];
  for (const file of files) {
    const pack = await readJSON(path.join(packDir, file));
    for (const step of pack.teaching_sequence ?? []) {
      if (!step.audio_script) continue;
      items.push(makeItem(pack.pack_id, pack.source_alignment?.year, "lesson", step.step_id, step.audio_script));
    }
    for (const entry of pack.objective?.vocabulary ?? []) {
      if (!entry.audio_script) continue;
      items.push(makeItem(pack.pack_id, pack.source_alignment?.year, "vocabulary", entry.term, entry.audio_script));
    }
  }
  return items;
}

async function collectVariantItems() {
  const files = (await fs.readdir(packDir)).filter((file) => file.endsWith(".json")).sort();
  const packs = [];
  for (const file of files) {
    packs.push(await readJSON(path.join(packDir, file)));
  }
  const catalog = buildVariantAudioCatalog(packs, {
    provider: "ElevenLabs",
    voice_id: voiceId,
    model_id: modelId,
    output_format: "mp3_44100_128",
    voice_settings: {
      stability: 0.55,
      similarity_boost: 0.75,
      style: 0.15,
      use_speaker_boost: true,
    },
    speed_by_year: Object.fromEntries(
      Array.from({ length: 7 }, (_, index) => index + 1)
        .map((year) => [year, year === 1 ? narrationPacingPolicy.year_1.lesson : year === 2 ? narrationPacingPolicy.year_2.lesson : narrationPacingPolicy.year_3_to_7.lesson]),
    ),
  });
  return catalogAssetsToProductionItems(catalog);
}

function selectItems(items) {
  if (!new Set(["all", "lessons", "vocabulary", "variants"]).has(only)) {
    throw new Error("--only must be all, lessons, vocabulary or variants");
  }
  const parsedYear = yearFilter === undefined ? undefined : Number(yearFilter);
  if (parsedYear !== undefined && (!Number.isInteger(parsedYear) || parsedYear < 1 || parsedYear > 7)) {
    throw new Error("--year must be an integer from 1 to 7");
  }
  const parsedLimit = limitValue === undefined ? undefined : Number(limitValue);
  if (parsedLimit !== undefined && (!Number.isInteger(parsedLimit) || parsedLimit < 1)) {
    throw new Error("--limit must be a positive integer");
  }
  let selected = selectProductionItems(items, { pack: packFilter, year: parsedYear }).filter((item) => {
    if (only === "lessons" && item.kind !== "lesson") return false;
    if (only === "vocabulary" && item.kind !== "vocabulary") return false;
    if (only === "variants" && item.kind !== "variant") return false;
    return true;
  });
  if (parsedLimit !== undefined) selected = selected.slice(0, parsedLimit);
  if (!selected.length) throw new Error("narration selection is empty; check --only, --pack, --year and --limit");
  return selected;
}

function makeItem(packId, yearValue, kind, sourceId, text) {
  const year = Number(yearValue);
  if (!Number.isInteger(year) || year < 1 || year > 7) {
    throw new Error(`${packId}: narration requires a valid source-alignment year`);
  }
  const id = `${packId}--${kind}--${slug(sourceId)}`;
  const relativeFile = `${packId}/${kind}/${slug(sourceId)}.mp3`;
  const pacing = pacingFor(year, kind);
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
    year,
    pacing_profile: pacing.profile,
    voice_settings: pacing.voiceSettings,
    file: `/audio/narration/alice/${relativeFile.replaceAll("\\", "/")}`,
    relative_file: relativeFile,
    production_status: "generated_pending_human_listening",
  };
}

function pacingFor(year, kind) {
  const profile = year === 1 ? "year_1" : year === 2 ? "year_2" : "year_3_to_7";
  const speed = kind === "vocabulary" ? narrationPacingPolicy[profile].vocabulary : narrationPacingPolicy[profile].lesson;
  return {
    profile,
    voiceSettings: {
      stability: 0.55,
      similarity_boost: 0.75,
      style: 0.15,
      use_speaker_boost: true,
      speed,
    },
  };
}

async function requestSpeech(item) {
  const signal = AbortSignal.timeout(90_000);
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: item.text,
          model_id: modelId,
          voice_settings: item.voice_settings,
        }),
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`ElevenLabs returned HTTP ${response.status}; no automatic retry was sent`);
    }
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    if (signal.aborted) throw new Error("ElevenLabs request timed out; its billing outcome may be uncertain and no automatic retry was sent");
    throw error;
  }
}

function technicalCheck(buffer) {
  return {
    ...inspectMP3Buffer(buffer),
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
  };
}

function sameRecordingIdentity(previous, item) {
  return Boolean(
    previous
    && previous.id === item.id
    && previous.text_sha256 === item.text_sha256
    && previous.voice_id === item.voice_id
    && previous.model_id === item.model_id
    && previous.relative_file === item.relative_file
    && previous.file === item.file
  );
}

function hasRecordedSettings(item) {
  const settings = item?.voice_settings;
  return Boolean(settings && !Array.isArray(settings)
    && ["stability", "similarity_boost", "style", "speed"].every(key => Number.isFinite(settings[key]))
    && settings.speed > 0 && typeof settings.use_speaker_boost === "boolean");
}

function reusableMetadataMatches(previous, item) {
  return sameRecordingIdentity(previous, item)
    && hasRecordedSettings(previous)
    && canonicalJSONStringify(previous.voice_settings) === canonicalJSONStringify(item.voice_settings);
}

async function produce(items, previousItems, pendingPublications) {
  let produced = 0;
  let skipped = 0;
  let planned = 0;
  let resumed = 0;
  const unknownSettings = items.filter(item => previousItems.has(item.id) && !hasRecordedSettings(previousItems.get(item.id)));
  // Preflight the whole selection before the first paid call. Today's policy is
  // not evidence of how a historical file was made; replacing it is explicit.
  if (unknownSettings.length && !dryRun && !force) {
    throw new Error(`${unknownSettings.length} selected recordings have unknown generation settings; use --dry-run to plan, then --force only for the chosen re-recording batch`);
  }
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
          // Replace, rather than overlay: absent historical fields must remain
          // absent, including the policy/profile label and voice display name.
          for (const key of Object.keys(item)) delete item[key];
          Object.assign(item, previous, check);
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
    const checkpoint = productionCheckpoint(checkpointRoot, item);
    const cached = await readProductionCheckpoint(checkpoint);
    if (cached) {
      Object.assign(item, cached);
      resumed += 1;
    } else {
      if (!apiKey) throw new Error("ELEVENLABS_API_KEY is required to generate missing or stale narration");
      try {
        const audio = await requestSpeech(item);
        const check = { ...technicalCheck(audio), generated_at: new Date().toISOString() };
        if (!check.technical_pass) throw new Error(`invalid MP3 response (${check.bytes} bytes)`);
        await writeProductionCheckpoint(checkpoint, audio, check);
        Object.assign(item, check);
        produced += 1;
      } catch (error) {
        throw new Error(`${item.id}: ${error?.message ?? "generation failed"}. Earlier verified responses remain staged; the published inventory is unchanged. Inspect provider usage before explicitly retrying an uncertain request.`);
      }
    }
    pendingPublications.push({ checkpoint, absoluteFile });
    if ((index + 1) % 10 === 0 || index + 1 === items.length) {
      console.log(`narration progress ${index + 1}/${items.length} produced=${produced} skipped=${skipped}`);
    }
  }
  return { produced, skipped, planned, resumed, unknown_settings: unknownSettings.length };
}

async function mergeProducedInventory(allItems, selectedItems, previousItems) {
  const selectedByID = new Map(selectedItems.map((item) => [item.id, item]));
  const expectedIDs = new Set(allItems.map((item) => item.id));
  const merged = [];
  for (const previous of previousItems.values()) {
    if (!expectedIDs.has(previous.id)) merged.push(previous);
  }
  for (const expected of allItems) {
    const selected = selectedByID.get(expected.id);
    if (selected?.technical_pass) {
      merged.push(selected);
      continue;
    }
    const previous = previousItems.get(expected.id);
    if (!sameRecordingIdentity(previous, expected)) continue;
    try {
      const existing = await fs.readFile(path.join(publicRoot, expected.relative_file));
      const check = technicalCheck(existing);
      if (check.technical_pass && previous.sha256 === check.sha256 && (previous.bytes === undefined || previous.bytes === check.bytes)) {
        // An unselected, verified recording stays exactly as recorded, even if
        // its settings differ from today's policy or were never recorded.
        merged.push({ ...previous, ...check });
      }
    } catch {
      // Missing and stale assets stay out of the produced manifest.
    }
  }
  return merged;
}

function manifestWrites(items, summary, expectedAssets, selectedAssets) {
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
      pacing: narrationPacingPolicy,
    },
    totals: {
      assets: items.length,
      lesson_assets: items.filter((item) => item.kind === "lesson").length,
      vocabulary_assets: items.filter((item) => item.kind === "vocabulary").length,
      variant_assets: items.filter((item) => item.kind === "variant").length,
      characters: items.reduce((total, item) => total + item.text.length, 0),
      technical_pass: items.filter((item) => item.technical_pass).length,
      expected_assets: expectedAssets,
      selected_assets: selectedAssets,
      ...summary,
    },
    items,
  };
  const rendered = `${JSON.stringify(manifest, null, 2)}\n`;
  const publicManifest = {
    ...manifest,
    items: manifest.items.map((item) => ({
      id: item.id,
      pack_id: item.pack_id,
      kind: item.kind,
      source_id: item.source_id,
      file: item.file,
      production_status: item.production_status,
      technical_pass: item.technical_pass,
      year: item.year,
      pacing_profile: item.pacing_profile,
      speed: item.voice_settings?.speed,
    })),
  };
  const publicRendered = `${JSON.stringify(publicManifest)}\n`;
  const review = renderReview(manifest);
  return [
    { file: manifestPath, data: rendered }, { file: publicManifestPath, data: publicRendered },
    { file: reviewPath, data: review }, { file: publicReviewPath, data: review },
  ];
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
          <div><strong>${escapeHTML(item.kind)} &middot; ${escapeHTML(item.source_id)}</strong></div>
          <p>${escapeHTML(item.text)}</p>
          <audio controls preload="none" src="${escapeHTML(item.file)}"></audio>
          <div class="review">Review: &#9744; natural &#9744; clear &#9744; correct pronunciation &#9744; suitable for age</div>
        </article>`).join("")}
    </section>`).join("");
  const html = `<!doctype html>
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
    <p>${manifest.totals.assets} assets &middot; ${manifest.totals.characters} characters &middot; ${manifest.totals.technical_pass} technical passes.</p>
  </header>
  ${sections}
</body>
</html>
`;
  return html.replace(/[ \t]+$/gm, "");
}

async function main() {
  await recoverNarrationPublication(repoRoot, { readOnly: dryRun });
  const standardItems = await collect();
  const variantItems = await collectVariantItems();
  const inventory = only === "variants" ? variantItems : standardItems;
  const items = selectItems(inventory);
  const previous = await readPreviousManifest();
  const previousItems = previous.items;
  if (items.length < inventory.length && previous.manifest && (
    previous.manifest.voice?.id !== voiceId || previous.manifest.voice?.model_id !== modelId
  )) {
    throw new Error("filtered production cannot change voice or model; run the complete inventory migration without --pack, --year, --only or --limit");
  }
  const pendingPublications = [];
  const summary = await produce(items, previousItems, pendingPublications);
  if (!dryRun) {
    const mergedItems = await mergeProducedInventory(inventory, items, previousItems);
    const updates = [];
    // Provider work never replaces public bytes. One recoverable publication
    // includes every selected recording and all four inventory/review files.
    for (const { checkpoint, absoluteFile } of pendingPublications) {
      await readProductionCheckpoint(checkpoint);
      updates.push({ file: absoluteFile, data: await fs.readFile(checkpoint.audio) });
    }
    updates.push(...manifestWrites(mergedItems, summary, inventory.length, items.length));
    await publishNarrationBatch(repoRoot, updates);
    for (const { checkpoint } of pendingPublications) await removeProductionCheckpoint(checkpoint);
  }
  console.log(
    `narration selected=${items.length} expected=${inventory.length} standard=${standardItems.length} variants=${variantItems.length} lessons=${items.filter((item) => item.kind === "lesson").length} vocabulary=${items.filter((item) => item.kind === "vocabulary").length} variant_items=${items.filter((item) => item.kind === "variant").length} characters=${items.reduce((total, item) => total + item.text.length, 0)} produced=${summary.produced} skipped=${summary.skipped} planned=${summary.planned} resumed=${summary.resumed} unknown_settings=${summary.unknown_settings}`,
  );
}

if (dryRun) await main();
else await withProductionLock(path.dirname(checkpointRoot), main);
