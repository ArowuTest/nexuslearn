#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, "../../..");
const manifestPath = path.join(repoRoot, "packages/content/audio/narration-manifest.json");
const ledgerPath = path.join(repoRoot, "packages/content/audio/narration-listening-reviews.json");
const audioRoot = path.join(repoRoot, "apps/web/public/audio/narration/alice");
const requiredCriteria = ["natural", "clear", "pronunciation", "age_suitable"];
const dryRun = process.argv.includes("--dry-run");

function value(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function fail(message) {
  console.error(`narration-review error: ${message}`);
  process.exit(1);
}

function currentBinding(item) {
  const file = path.join(audioRoot, item.relative_file ?? "");
  if (!item.technical_pass || !fs.existsSync(file)) fail(`${item.id}: technically valid MP3 is required before review`);
  const audio = fs.readFileSync(file);
  const audioHash = sha256(audio);
  if (!item.sha256 || item.sha256 !== audioHash) fail(`${item.id}: MP3 hash differs from the production manifest`);
  return {
    text_sha256: item.text_sha256,
    audio_sha256: audioHash,
    voice_id: item.voice_id,
    model_id: item.model_id,
  };
}

const manifest = readJSON(manifestPath);
const ledger = fs.existsSync(ledgerPath) ? readJSON(ledgerPath) : { version: 1, reviews: [] };
if (ledger.version !== 1 || !Array.isArray(ledger.reviews)) fail("review ledger must use version 1 with a reviews array");

const assetID = value("--asset");
const decision = value("--decision");
if (!assetID && !decision) {
  const latest = new Map();
  for (const review of ledger.reviews) latest.set(review.asset_id, review);
  const counts = { approved: 0, rejected: 0, stale: 0, pending: 0 };
  for (const item of manifest.items ?? []) {
    const review = latest.get(item.id);
    if (!review) { counts.pending += 1; continue; }
    const binding = currentBinding(item);
    const current = Object.entries(binding).every(([key, entry]) => review.binding?.[key] === entry);
    if (!current) counts.stale += 1;
    else if (review.decision === "approve") counts.approved += 1;
    else counts.rejected += 1;
  }
  console.log(`narration-review assets=${manifest.items?.length ?? 0} approved=${counts.approved} rejected=${counts.rejected} stale=${counts.stale} pending=${counts.pending}`);
  process.exit(0);
}

if (!assetID || !decision) fail("--asset and --decision approve|reject are required together");
if (!new Set(["approve", "reject"]).has(decision)) fail("--decision must be approve or reject");
const reviewer = value("--reviewer")?.trim();
const notes = value("--notes")?.trim() ?? "";
if (!reviewer || reviewer.length < 2) fail("--reviewer is required");
if (decision === "reject" && !notes) fail("--notes is required when rejecting audio");

const item = (manifest.items ?? []).find((entry) => entry.id === assetID);
if (!item) fail(`unknown asset: ${assetID}`);
const criteria = new Set((value("--confirm") ?? "").split(",").map((entry) => entry.trim()).filter(Boolean));
if (decision === "approve") {
  const missing = requiredCriteria.filter((criterion) => !criteria.has(criterion));
  const unknown = [...criteria].filter((criterion) => !requiredCriteria.includes(criterion));
  if (missing.length || unknown.length) fail(`approval requires --confirm ${requiredCriteria.join(",")} exactly`);
}

const reviewedAt = new Date().toISOString();
const review = {
  review_id: sha256(`${assetID}|${reviewedAt}|${reviewer}|${decision}`).slice(0, 24),
  asset_id: assetID,
  decision,
  reviewer,
  reviewed_at: reviewedAt,
  criteria: Object.fromEntries(requiredCriteria.map((criterion) => [criterion, decision === "approve"])),
  notes,
  binding: currentBinding(item),
};
if (dryRun) {
  console.log(`narration-review validated asset=${assetID} decision=${decision} reviewer=${reviewer} dry_run=true`);
} else {
  ledger.reviews.push(review);
  fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
  console.log(`narration-review recorded asset=${assetID} decision=${decision} reviewer=${reviewer}`);
}
