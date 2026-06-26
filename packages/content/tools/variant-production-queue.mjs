#!/usr/bin/env node
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packRoot = path.join(repoRoot, "packages/content/packs");
const outDir = path.join(repoRoot, "packages/content/generated/coverage");
const webDir = path.join(repoRoot, "apps/web/public/content");
const runtimeStatuses = new Set(["approved", "published", "live"]);

const items = [];
for (const file of await findPackFiles(packRoot)) {
  const pack = JSON.parse(await readFile(file, "utf8"));
  const variants = pack.question_variants ?? [];
  const runtime = variants.filter((variant) => runtimeStatuses.has(variant.status)).length;
  const review = variants.filter((variant) => variant.status === "review").length;
  const pilot = pack.practice?.variant_targets?.pilot ?? 150;
  const remainingAuthoring = Math.max(0, pilot - variants.length);
  const remainingReview = Math.max(0, pilot - runtime);
  const blockers = readinessBlockers(pack, variants, runtime, pilot, remainingAuthoring);
  const flagshipBonus = ["en-y1-phonics-blend-cvc-words", "ma-y4-number-multiplication-12x12", "sc-y7-particles-states-of-matter"].includes(pack.pack_id) ? 80 : 0;
  const score = remainingReview * 3 + remainingAuthoring * 2 + review * 12 + blockers.length * 15 + flagshipBonus + (pack.source_alignment?.year === 1 ? 20 : 0);
  items.push({
    rank: 0,
    pack_id: pack.pack_id,
    year: pack.source_alignment?.year,
    subject: pack.source_alignment?.subject,
    status: pack.status,
    authored_variants: variants.length,
    runtime_variants: runtime,
    review_candidates: review,
    pilot_target: pilot,
    remaining_authoring: remainingAuthoring,
    remaining_review: remainingReview,
    progress_percent: Math.min(100, Math.round((runtime / pilot) * 100)),
    blockers,
    score,
    next_action: nextAction(pack, review, remainingAuthoring, blockers),
  });
}
items.sort((a, b) => b.score - a.score || a.year - b.year || a.pack_id.localeCompare(b.pack_id));
items.forEach((item, index) => { item.rank = index + 1; });

const report = {
  version: 1,
  status: "phase-3-variant-production-queue",
  generated_by: "packages/content/tools/variant-production-queue.mjs",
  totals: {
    packs: items.length,
    pilot_target_variants: items.reduce((sum, item) => sum + item.pilot_target, 0),
    authored_variants: items.reduce((sum, item) => sum + item.authored_variants, 0),
    runtime_variants: items.reduce((sum, item) => sum + item.runtime_variants, 0),
    review_candidates: items.reduce((sum, item) => sum + item.review_candidates, 0),
    remaining_review: items.reduce((sum, item) => sum + item.remaining_review, 0),
    blocked_from_pilot: items.filter((item) => item.blockers.length > 0).length,
  },
  next_balanced_batch: chooseBalancedBatch(items),
  queue: items,
};

await mkdir(outDir, { recursive: true });
await mkdir(webDir, { recursive: true });
const jsonPath = path.join(outDir, "variant-production-queue.json");
const htmlPath = path.join(outDir, "variant-production-queue.html");
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(htmlPath, renderHTML(report), "utf8");
await copyFile(jsonPath, path.join(webDir, "variant-production-queue.json"));
console.log(`variant-production-queue packs=${report.totals.packs} authored=${report.totals.authored_variants} runtime=${report.totals.runtime_variants} review=${report.totals.review_candidates} remaining_review=${report.totals.remaining_review}`);
console.log(`variant-production-next ${report.next_balanced_batch.join(", ")}`);

function chooseBalancedBatch(queue) {
  const selected = [];
  const usedYears = new Set();
  for (const item of queue) {
    if (selected.length >= 7) break;
    if (usedYears.has(item.year)) continue;
    selected.push(item.pack_id);
    usedYears.add(item.year);
  }
  return selected;
}

function readinessBlockers(pack, variants, runtime, pilot, remainingAuthoring) {
  const blockers = [];
  const qa = pack.qa ?? {};
  if (remainingAuthoring > 0) {
    blockers.push(`author ${remainingAuthoring} more reviewed sample variants to reach pilot target`);
  }
  if (runtime < pilot) {
    blockers.push(`promote ${pilot - runtime} reviewed variants to runtime-approved status after calibration`);
  }
  const incompleteReviews = [
    ["curriculum_review", "curriculum review"],
    ["teacher_review", "independent teacher review"],
    ["accessibility_review", "accessibility/SEND review"],
    ["safeguarding_review", "safeguarding review"],
  ].filter(([key]) => !["complete", "approved"].includes(String(qa[key] ?? "").toLowerCase()));
  for (const [, label] of incompleteReviews) blockers.push(`${label} pending`);
  const producedAudioNeeded = variants.some((variant) => {
    const body = variant.body ?? {};
    return body.ssp_programme_mapping === "required_before_pilot"
      || body.audio_asset_status === "required_before_pilot"
      || body.produced_audio_status === "required_before_pilot";
  });
  if (producedAudioNeeded) {
    blockers.push("SSP mapping and produced-audio QA pending before child runtime");
  }
  const advancedFormats = new Set((pack.practice?.formats ?? []).filter((format) => !["choice", "tap-choice", "numeric", "explain-choice"].includes(format)));
  if (advancedFormats.size > 0 && runtime === 0) {
    blockers.push(`runtime renderer/accessibility acceptance pending for ${[...advancedFormats].slice(0, 4).join(", ")}`);
  }
  return blockers;
}

function nextAction(pack, review, remainingAuthoring, blockers) {
  if (pack.pack_id === "en-y1-phonics-blend-cvc-words") {
    return "Do SSP progression mapping and produced-audio listening QA before any child-runtime promotion.";
  }
  if (review > 0 && blockers.some((blocker) => blocker.includes("teacher review") || blocker.includes("accessibility") || blocker.includes("safeguarding"))) {
    return `Run curriculum, teacher, accessibility and safeguarding review on ${Math.min(review, 30)} queued candidates before promotion.`;
  }
  if (review > 0) {
    return `Review and calibrate ${Math.min(review, 30)} queued candidates before promoting a batch.`;
  }
  if (remainingAuthoring > 0) {
    return `Author the next ${Math.min(30, remainingAuthoring)} blueprint-linked candidates.`;
  }
  if (blockers.length > 0) {
    return `Resolve blocker: ${blockers[0]}.`;
  }
  return "Ready for pilot promotion review.";
}

function renderHTML(report) {
  const rows = report.queue.map((item) => `<tr><td>${item.rank}</td><td><code>${escapeHTML(item.pack_id)}</code></td><td>Y${item.year} ${escapeHTML(item.subject)}</td><td>${item.runtime_variants}/${item.pilot_target}</td><td>${item.review_candidates}</td><td>${item.remaining_authoring}</td><td>${item.blockers.map((blocker) => `<div>${escapeHTML(blocker)}</div>`).join("")}</td><td>${escapeHTML(item.next_action)}</td></tr>`).join("");
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>NexusLearn variant production queue</title><style>body{font-family:Inter,system-ui,sans-serif;margin:32px;color:#17233f;background:#fbfaf6}table{width:100%;border-collapse:collapse;background:white}th,td{padding:11px;border:1px solid #ddd;text-align:left;vertical-align:top}th{background:#17233f;color:white}code{font-size:12px}</style></head><body><h1>Variant Production Queue</h1><p>This queue ranks actual pilot-depth deficits and promotion blockers, not merely missing objective-pack files.</p><p><strong>Blocked from pilot:</strong> ${report.totals.blocked_from_pilot}/${report.totals.packs}. <strong>Next balanced batch:</strong> ${report.next_balanced_batch.map((item) => `<code>${escapeHTML(item)}</code>`).join(" ")}</p><table><thead><tr><th>Rank</th><th>Pack</th><th>Coverage</th><th>Reviewed runtime / pilot</th><th>Awaiting review</th><th>Still to author</th><th>Promotion blockers</th><th>Next action</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

async function findPackFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await findPackFiles(full));
    else if (entry.name.endsWith(".pack.json") || entry.name.endsWith(".pack.sample.json")) {
      if ((await stat(full)).isFile()) files.push(full);
    }
  }
  return files;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
