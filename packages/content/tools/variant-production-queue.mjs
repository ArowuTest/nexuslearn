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
  const flagshipBonus = ["en-y1-phonics-blend-cvc-words", "ma-y4-number-multiplication-12x12", "sc-y7-particles-states-of-matter"].includes(pack.pack_id) ? 80 : 0;
  const score = remainingReview * 3 + remainingAuthoring * 2 + review * 12 + flagshipBonus + (pack.source_alignment?.year === 1 ? 20 : 0);
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
    score,
    next_action: review > 0
      ? `Review and calibrate ${Math.min(review, 30)} queued candidates before promoting a batch.`
      : `Author the next ${Math.min(30, remainingAuthoring)} blueprint-linked candidates.`,
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

function renderHTML(report) {
  const rows = report.queue.map((item) => `<tr><td>${item.rank}</td><td><code>${escapeHTML(item.pack_id)}</code></td><td>Y${item.year} ${escapeHTML(item.subject)}</td><td>${item.runtime_variants}/${item.pilot_target}</td><td>${item.review_candidates}</td><td>${item.remaining_authoring}</td><td>${escapeHTML(item.next_action)}</td></tr>`).join("");
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>NexusLearn variant production queue</title><style>body{font-family:Inter,system-ui,sans-serif;margin:32px;color:#17233f;background:#fbfaf6}table{width:100%;border-collapse:collapse;background:white}th,td{padding:11px;border:1px solid #ddd;text-align:left;vertical-align:top}th{background:#17233f;color:white}code{font-size:12px}</style></head><body><h1>Variant Production Queue</h1><p>This queue ranks actual pilot-depth deficits, not merely missing objective-pack files.</p><p><strong>Next balanced batch:</strong> ${report.next_balanced_batch.map((item) => `<code>${escapeHTML(item)}</code>`).join(" ")}</p><table><thead><tr><th>Rank</th><th>Pack</th><th>Coverage</th><th>Reviewed runtime / pilot</th><th>Awaiting review</th><th>Still to author</th><th>Next action</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
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
