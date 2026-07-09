#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const manifestPath = path.join(repoRoot, "packages/content/audio/narration-manifest.json");
const ledgerPath = path.join(repoRoot, "packages/content/audio/narration-listening-reviews.json");
const readinessPath = path.join(repoRoot, "packages/content/generated/coverage/narration-readiness.json");
const coverageDir = path.join(repoRoot, "packages/content/generated/coverage");
const publicDir = path.join(repoRoot, "apps/web/public/content");
const batchSize = 40;

const manifest = readJSON(manifestPath);
const ledger = fs.existsSync(ledgerPath) ? readJSON(ledgerPath) : { version: 1, reviews: [] };
const readiness = readJSON(readinessPath);
const latestReviewByAsset = new Map();
for (const review of ledger.reviews ?? []) latestReviewByAsset.set(review.asset_id, review);
const packStats = new Map((readiness.packs ?? []).map((pack) => [pack.pack_id, pack]));

const candidates = (manifest.items ?? [])
  .filter((item) => item.technical_pass === true)
  .map((item) => ({ ...item, latest_review: latestReviewByAsset.get(item.id) ?? null, pack_stats: packStats.get(item.pack_id) ?? null }))
  .filter((item) => item.latest_review?.decision !== "approve")
  .map((item) => ({ ...item, priority: priorityFor(item), rationale: rationaleFor(item) }))
  .sort((a, b) => b.priority - a.priority || compareText(a.pack_id, b.pack_id) || compareText(a.kind, b.kind) || compareText(a.id, b.id));

const firstPassCandidates = chooseBalancedFirstPass(candidates, batchSize, 6);
const firstPass = firstPassCandidates.map((item, index) => ({
  rank: index + 1,
  asset_id: item.id,
  pack_id: item.pack_id,
  year: item.year ?? item.pack_stats?.year ?? null,
  kind: item.kind,
  source_id: item.source_id,
  priority: item.priority,
  rationale: item.rationale,
  text_preview: item.text,
  file: item.file,
  relative_file: item.relative_file,
  text_sha256: item.text_sha256,
  audio_sha256: item.sha256,
  review_command: `node packages/content/tools/narration-review.mjs --asset ${item.id} --decision approve --reviewer "REVIEWER NAME" --confirm natural,clear,pronunciation,age_suitable --notes "warm child-safe pace; accurate pronunciation; no robotic artefacts"`,
  reject_command: `node packages/content/tools/narration-review.mjs --asset ${item.id} --decision reject --reviewer "REVIEWER NAME" --notes "describe the pronunciation, pace, warmth or clarity issue"`,
}));

const report = {
  version: 1,
  status: firstPass.length > 0 ? "listening_priority_ready" : "no_pending_listening_assets",
  generated_by: "packages/content/tools/narration-listening-priority.mjs",
  source_report: "narration-readiness.json",
  batch_id: "phase3-narration-listening-priority",
  deterministic: true,
  policy: {
    provider: manifest.provider ?? "ElevenLabs",
    voice_id: manifest.voice?.id ?? null,
    voice_name: manifest.voice?.name ?? null,
    model_id: manifest.voice?.model_id ?? null,
    batch_size: batchSize,
    approval_requires: ["natural", "clear", "pronunciation", "age_suitable"],
    browser_tts_fallback_allowed: false,
    first_pass_order: "Year 1-2, phonics/listening/early literacy, high variant-reference impact, then remaining years.",
  },
  totals: {
    expected_assets: readiness.totals?.expected_assets ?? 0,
    technical_pass: readiness.totals?.technical_pass ?? 0,
    listening_approved: readiness.totals?.listening_approved ?? 0,
    awaiting_listening: candidates.length,
    first_pass_assets: firstPass.length,
    early_years_first_pass: firstPass.filter((item) => (item.year ?? 99) <= 2).length,
    phonics_or_listening_first_pass: firstPass.filter((item) => /phonics|segmenting|listening|letter|fluency/i.test(item.pack_id)).length,
  },
  operator_guidance: [
    "Listen with headphones and child-safety judgement; technical MP3 validity is not approval.",
    "Approve only if the voice is warm, clear, natural, age-suitable and pronunciation is accurate.",
    "Reject or re-record any robotic artefact, clipped word, odd emphasis, rushed pacing or curriculum pronunciation issue.",
    "Prioritise this first pass before exposing Year 1-2 audio-led or phonics-heavy missions to children.",
  ],
  first_pass: firstPass,
};

fs.mkdirSync(coverageDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });
const json = `${JSON.stringify(report, null, 2)}\n`;
const html = renderHTML(report);
fs.writeFileSync(path.join(coverageDir, "narration-listening-priority.json"), json);
fs.writeFileSync(path.join(publicDir, "narration-listening-priority.json"), json);
fs.writeFileSync(path.join(coverageDir, "narration-listening-priority.html"), html);
fs.writeFileSync(path.join(publicDir, "narration-listening-priority.html"), html);
console.log(`narration-listening-priority first_pass=${report.totals.first_pass_assets} awaiting=${report.totals.awaiting_listening} early_years=${report.totals.early_years_first_pass}`);

function priorityFor(item) {
  const year = Number(item.year ?? item.pack_stats?.year ?? 99);
  const pack = String(item.pack_id ?? "");
  const stats = item.pack_stats ?? {};
  let score = 10_000 - year * 100;
  if (year <= 2) score += 2_000;
  if (/phonics|segmenting|letter/i.test(pack)) score += 900;
  if (/listening|fluency/i.test(pack)) score += 700;
  if (/number-counting|number-bonds|measures/i.test(pack)) score += 250;
  if (item.kind === "lesson") score += 140;
  if (item.kind === "vocabulary") score += 60;
  score += Math.min(600, Number(stats.variant_references ?? 0));
  score += Math.min(500, Number(stats.unresolved_variant_references ?? 0));
  return score;
}

function chooseBalancedFirstPass(items, limit, maxPerPack) {
  const earlyYears = items.filter((item) => Number(item.year ?? item.pack_stats?.year ?? 99) <= 2);
  const pool = earlyYears.length >= limit ? earlyYears : items;
  const byPack = new Map();
  for (const item of pool) {
    const entries = byPack.get(item.pack_id) ?? [];
    entries.push(item);
    byPack.set(item.pack_id, entries);
  }
  for (const entries of byPack.values()) {
    entries.sort((a, b) => b.priority - a.priority || compareText(a.kind, b.kind) || compareText(a.id, b.id));
  }
  const packOrder = Array.from(byPack.entries())
    .map(([packID, entries]) => ({ packID, priority: entries[0]?.priority ?? 0, year: entries[0]?.year ?? entries[0]?.pack_stats?.year ?? 99 }))
    .sort((a, b) => b.priority - a.priority || Number(a.year) - Number(b.year) || compareText(a.packID, b.packID));
  const selected = [];
  const selectedByPack = new Map();
  let progress = true;
  while (selected.length < limit && progress) {
    progress = false;
    for (const { packID } of packOrder) {
      if (selected.length >= limit) break;
      if ((selectedByPack.get(packID) ?? 0) >= maxPerPack) continue;
      const next = byPack.get(packID)?.shift();
      if (!next) continue;
      selected.push(next);
      selectedByPack.set(packID, (selectedByPack.get(packID) ?? 0) + 1);
      progress = true;
    }
  }
  return selected;
}

function rationaleFor(item) {
  const reasons = [];
  const year = Number(item.year ?? item.pack_stats?.year ?? 99);
  if (year <= 2) reasons.push("early-years audio clarity has the highest child-impact risk");
  if (/phonics|segmenting|letter/i.test(item.pack_id)) reasons.push("phonics/early-literacy pronunciation must be human-listened");
  if (/listening|fluency/i.test(item.pack_id)) reasons.push("listening and fluency packs depend on warm non-robotic narration");
  if ((item.pack_stats?.variant_references ?? 0) > 0) reasons.push(`${item.pack_stats.variant_references} variant audio references depend on this pack family being trusted`);
  if (item.kind === "lesson") reasons.push("lesson narration guides the learner before task attempts");
  return reasons.length ? reasons : ["pending approved listening evidence"];
}

function renderHTML(summary) {
  const cards = [
    [summary.totals.first_pass_assets, "first-pass assets"],
    [summary.totals.awaiting_listening, "awaiting listening"],
    [summary.totals.early_years_first_pass, "Year 1-2 first pass"],
    [summary.totals.phonics_or_listening_first_pass, "phonics/listening first pass"],
  ].map(([value, label]) => `<div class="card"><strong>${value}</strong><span>${escapeHTML(label)}</span></div>`).join("");
  const rows = summary.first_pass.map((item) => `<tr><td>${item.rank}</td><td><code>${escapeHTML(item.asset_id)}</code><br>Y${escapeHTML(item.year ?? "unknown")} ${escapeHTML(item.kind)}</td><td><code>${escapeHTML(item.pack_id)}</code><br>${escapeHTML(item.source_id)}</td><td>${escapeHTML(item.rationale.join("; "))}</td><td><audio controls src="${escapeHTML(item.file)}"></audio><p><a href="${escapeHTML(item.file)}">open mp3</a></p></td><td><code>${escapeHTML(item.review_command)}</code></td></tr>`).join("");
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>NexusLearn narration listening priority</title><style>body{font-family:Inter,system-ui,sans-serif;margin:0;background:#fbfaf6;color:#17233f}main{max-width:1200px;margin:auto;padding:32px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:18px 0}.card{background:white;border:1px solid #ddd;padding:16px}.card strong,.card span{display:block}.card strong{font-size:28px}table{width:100%;border-collapse:collapse;background:white}th,td{padding:10px;border:1px solid #ddd;text-align:left;vertical-align:top}th{background:#17233f;color:white}code{font-size:12px;overflow-wrap:anywhere}audio{max-width:220px;width:100%}.guard{background:#fff4d5;border-left:4px solid #ffbf45;padding:12px}</style></head><body><main><h1>Narration Listening Priority</h1><p class="guard">Approve only after human listening confirms warmth, clarity, accurate pronunciation and child suitability. Browser text-to-speech is not an acceptable fallback.</p><div class="cards">${cards}</div><h2>First-pass listening queue</h2><table><thead><tr><th>Rank</th><th>Asset</th><th>Pack/source</th><th>Why now</th><th>Audio</th><th>Approval command</th></tr></thead><tbody>${rows}</tbody></table></main></body></html>\n`;
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function compareText(left, right) {
  const a = String(left);
  const b = String(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
