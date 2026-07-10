#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectMP3Buffer } from "./lib/mp3-inspection.mjs";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, "../../..");
const packDir = path.join(repoRoot, "packages/content/packs");
const manifestPath = path.join(repoRoot, "packages/content/audio/narration-manifest.json");
const reviewLedgerPath = path.join(repoRoot, "packages/content/audio/narration-listening-reviews.json");
const audioRoot = path.join(repoRoot, "apps/web/public/audio/narration/alice");
const coverageDir = path.join(repoRoot, "packages/content/generated/coverage");
const publicDir = path.join(repoRoot, "apps/web/public/content");
const strict = process.argv.includes("--strict");
const sampleLimit = 50;

const expectedProvider = "ElevenLabs";
const pendingStatuses = new Set(["generated_pending_human_listening", "required_human_listening_review"]);
const approvedStatuses = new Set(["human_listening_approved", "approved", "production_approved", "released"]);
const validProductionStatuses = new Set([...pendingStatuses, ...approvedStatuses]);

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
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

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalPath(value) {
  return String(value ?? "").replaceAll("\\", "/").replace(/^\.\//, "");
}

function yearOf(pack) {
  const aligned = Number(pack.source_alignment?.year);
  if (Number.isInteger(aligned)) return aligned;
  const match = String(pack.pack_id ?? "").match(/-y(\d+)(?:-|$)/);
  return match ? Number(match[1]) : null;
}

function variantID(variant, index) {
  return variant.variant_id ?? variant.id ?? variant.question_variant_id ?? `index-${index}`;
}

function compareText(left, right) {
  const a = String(left);
  const b = String(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

function bounded(values) {
  const sorted = [...values].sort((a, b) => compareText(JSON.stringify(a), JSON.stringify(b)));
  return {
    count: sorted.length,
    shown: Math.min(sorted.length, sampleLimit),
    truncated: sorted.length > sampleLimit,
    samples: sorted.slice(0, sampleLimit),
  };
}

function collectExpected(packs, voice) {
  const expected = [];
  for (const pack of packs) {
    for (const step of asArray(pack.teaching_sequence)) {
      if (typeof step.audio_script !== "string" || !step.audio_script) continue;
      expected.push(makeExpected(pack, "lesson", step.step_id, step.audio_script, voice));
    }
    for (const entry of asArray(pack.objective?.vocabulary)) {
      if (typeof entry.audio_script !== "string" || !entry.audio_script) continue;
      expected.push(makeExpected(pack, "vocabulary", entry.term, entry.audio_script, voice));
    }
  }
  return expected.sort((a, b) => compareText(a.id, b.id));
}

function makeExpected(pack, kind, sourceID, text, voice) {
  const sourceSlug = slug(sourceID);
  const relativeFile = `${pack.pack_id}/${kind}/${sourceSlug}.mp3`;
  return {
    id: `${pack.pack_id}--${kind}--${sourceSlug}`,
    pack_id: pack.pack_id,
    year: yearOf(pack),
    kind,
    source_id: sourceID,
    text,
    text_sha256: sha256(text),
    provider: expectedProvider,
    voice_id: voice.id ?? "",
    model_id: voice.model_id ?? "",
    file: `/audio/narration/alice/${relativeFile}`,
    relative_file: relativeFile,
  };
}

function collectVariantReferences(packs) {
  const declarations = [];
  for (const pack of packs) {
    asArray(pack.question_variants).forEach((variant, index) => {
      walkReferenceFields(variant, (key, value, owner, location) => {
        declarations.push({
          pack_id: pack.pack_id,
          year: yearOf(pack),
          variant_id: variantID(variant, index),
          field: key,
          location,
          asset_id: typeof value === "string" ? value.trim() : value,
          audio_provider: owner.audio_provider ?? null,
          audio_asset_status: owner.audio_asset_status ?? null,
          human_listening_approval_required: owner.human_listening_approval_required ?? null,
          browser_tts_allowed: owner.browser_tts_allowed ?? null,
        });
      });
    });
  }
  return declarations.sort((a, b) => compareText(
    `${a.pack_id}|${a.variant_id}|${a.location}|${a.asset_id}`,
    `${b.pack_id}|${b.variant_id}|${b.location}|${b.asset_id}`,
  ));
}

function walkReferenceFields(value, visit, location = "question_variant", seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walkReferenceFields(entry, visit, `${location}[${index}]`, seen));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const next = `${location}.${key}`;
    if (key === "audio_asset_id" || key === "audio_ref") visit(key, entry, value, next);
    if (entry && typeof entry === "object") walkReferenceFields(entry, visit, next, seen);
  }
}

function listMP3Files(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => compareText(a.name, b.name))) {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".mp3")) files.push(normalPath(path.relative(root, target)));
    }
  };
  visit(root);
  return files.sort();
}

function inspectMP3(relativeFile) {
  const absolute = path.join(audioRoot, relativeFile);
  if (!fs.existsSync(absolute)) return { exists: false, bytes: 0, mp3_signature: false, technical_pass: false, sha256: "" };
  const buffer = fs.readFileSync(absolute);
  return {
    exists: true,
    ...inspectMP3Buffer(buffer),
    sha256: sha256(buffer),
  };
}

function validApproval(review, item, technical) {
  return review?.decision === "approve"
    && review.criteria?.natural === true
    && review.criteria?.clear === true
    && review.criteria?.pronunciation === true
    && review.criteria?.age_suitable === true
    && review.binding?.text_sha256 === item.text_sha256
    && review.binding?.audio_sha256 === technical.sha256
    && review.binding?.voice_id === item.voice_id
    && review.binding?.model_id === item.model_id;
}

function buildReport() {
  const packFiles = fs.readdirSync(packDir).filter((file) => file.endsWith(".json")).sort();
  const packs = packFiles.map((file) => readJSON(path.join(packDir, file)));
  const manifest = fs.existsSync(manifestPath) ? readJSON(manifestPath) : { items: [], voice: {} };
  const manifestItems = asArray(manifest.items);
  const reviewLedger = fs.existsSync(reviewLedgerPath) ? readJSON(reviewLedgerPath) : { version: 1, reviews: [] };
  const reviews = asArray(reviewLedger.reviews);
  const latestReviewByID = new Map(reviews.map((review) => [review.asset_id, review]));
  const expected = collectExpected(packs, manifest.voice ?? {});
  const refs = collectVariantReferences(packs);
  const actualFiles = listMP3Files(audioRoot);

  const manifestByID = new Map();
  const duplicateIDs = [];
  const pathOwners = new Map();
  for (const item of manifestItems) {
    if (manifestByID.has(item.id)) duplicateIDs.push({ id: item.id });
    else manifestByID.set(item.id, item);
    const relative = normalPath(item.relative_file);
    const owners = pathOwners.get(relative) ?? [];
    owners.push(item.id ?? "(missing id)");
    pathOwners.set(relative, owners);
  }
  const duplicatePaths = Array.from(pathOwners.entries())
    .filter(([relative, owners]) => relative && owners.length > 1)
    .map(([relative_file, ids]) => ({ relative_file, ids: ids.sort() }));

  const expectedByID = new Map(expected.map((item) => [item.id, item]));
  const expectedPaths = new Set(expected.map((item) => item.relative_file));
  const missing = [];
  const stale = [];
  const invalid = [];
  const unreviewed = [];
  const assetChecks = [];

  if (!fs.existsSync(manifestPath)) invalid.push({ id: "manifest", issues: ["narration manifest is missing"] });
  if (manifest.provider !== expectedProvider) invalid.push({ id: "manifest", issues: [`provider must be ${expectedProvider}`] });
  if (!manifest.voice?.id) invalid.push({ id: "manifest", issues: ["voice.id is required"] });
  if (!manifest.voice?.model_id) invalid.push({ id: "manifest", issues: ["voice.model_id is required"] });
  if (manifest.totals?.assets !== manifestItems.length) invalid.push({ id: "manifest", issues: ["totals.assets differs from manifest item count"] });
  if (reviewLedger.version !== 1) invalid.push({ id: "review-ledger", issues: ["review ledger must use version 1"] });
  const duplicateReviewIDs = reviews.filter((review, index) => reviews.findIndex((entry) => entry.review_id === review.review_id) !== index);
  if (duplicateReviewIDs.length) invalid.push({ id: "review-ledger", issues: ["review_id values must be unique"] });
  for (const review of reviews) {
    const issues = [];
    if (!review.review_id || !review.asset_id) issues.push("review_id and asset_id are required");
    if (!new Set(["approve", "reject"]).has(review.decision)) issues.push("decision must be approve or reject");
    if (!review.reviewer || !review.reviewed_at) issues.push("reviewer and reviewed_at are required");
    if (review.asset_id && !manifestByID.has(review.asset_id)) issues.push("asset_id does not exist in the production manifest");
    if (issues.length) invalid.push({ id: review.review_id ?? "review-ledger-entry", issues });
  }

  for (const item of expected) {
    const produced = manifestByID.get(item.id);
    if (!produced) {
      missing.push({ id: item.id, pack_id: item.pack_id, year: item.year, relative_file: item.relative_file });
      continue;
    }
    const staleIssues = [];
    const invalidIssues = [];
    if (produced.text !== item.text) staleIssues.push("text differs from authored audio_script");
    if (produced.text_sha256 !== item.text_sha256) staleIssues.push("text_sha256 differs from authored audio_script");
    if (produced.pack_id !== item.pack_id || produced.kind !== item.kind || produced.source_id !== item.source_id) {
      staleIssues.push("source identity differs from authored item");
    }
    if (produced.voice_id !== manifest.voice?.id) invalidIssues.push("voice_id differs from manifest voice.id");
    if (produced.voice_name !== manifest.voice?.name) invalidIssues.push("voice_name differs from manifest voice.name");
    if (produced.model_id !== manifest.voice?.model_id) invalidIssues.push("model_id differs from manifest voice.model_id");
    if (normalPath(produced.relative_file) !== item.relative_file) invalidIssues.push("relative_file differs from expected path");
    if (normalPath(produced.file) !== normalPath(item.file)) invalidIssues.push("public file differs from expected path");
    if (!validProductionStatuses.has(produced.production_status)) invalidIssues.push("production_status is missing or unknown");
    const technical = inspectMP3(item.relative_file);
    if (!technical.exists) invalidIssues.push("MP3 file is missing");
    else if (!technical.technical_pass) invalidIssues.push("MP3 frame validation failed: " + (technical.technical_reason || "unknown decoder error"));
    if (technical.exists && produced.sha256 && produced.sha256 !== technical.sha256) staleIssues.push("manifest file sha256 differs from MP3");
    if (produced.bytes !== undefined && produced.bytes !== technical.bytes) staleIssues.push("manifest byte count differs from MP3");
    if (produced.technical_pass !== true) invalidIssues.push("manifest technical_pass is not true");
    const review = latestReviewByID.get(item.id);
    const approved = validApproval(review, produced, technical);
    if (!approved) unreviewed.push({ id: item.id, pack_id: item.pack_id, year: item.year, production_status: produced.production_status ?? null, review_status: review ? "rejected_or_stale" : "pending" });
    if (staleIssues.length) stale.push({ id: item.id, pack_id: item.pack_id, year: item.year, issues: staleIssues });
    if (invalidIssues.length) invalid.push({ id: item.id, pack_id: item.pack_id, year: item.year, issues: invalidIssues });
    assetChecks.push({ ...item, production_status: produced.production_status ?? null, listening_approved: approved, ...technical, issues: [...staleIssues, ...invalidIssues] });
  }

  const orphanManifest = manifestItems
    .filter((item) => !expectedByID.has(item.id))
    .map((item) => ({ id: item.id ?? null, relative_file: normalPath(item.relative_file) }));
  const orphanFiles = actualFiles
    .filter((relative) => !expectedPaths.has(relative))
    .map((relative_file) => ({ relative_file }));

  const actualRefs = refs.filter((entry) => typeof entry.asset_id === "string" && entry.asset_id.length > 0);
  const emptyRefs = refs.filter((entry) => typeof entry.asset_id !== "string" || entry.asset_id.length === 0);
  const nonconformingRefs = actualRefs.filter((entry) =>
    entry.audio_provider !== expectedProvider
    || !validProductionStatuses.has(entry.audio_asset_status)
    || entry.human_listening_approval_required !== true
    || entry.browser_tts_allowed !== false,
  );
  const producedManifestIDs = new Set(manifestItems.filter((item) => {
    const relative = normalPath(item.relative_file);
    return item.id && relative && item.technical_pass === true && inspectMP3(relative).technical_pass;
  }).map((item) => item.id));
  const resolvedRefs = actualRefs.filter((entry) => producedManifestIDs.has(entry.asset_id));
  const unresolvedRefs = actualRefs.filter((entry) => !producedManifestIDs.has(entry.asset_id));

  const packStats = new Map(packs.map((pack) => [pack.pack_id, {
    pack_id: pack.pack_id,
    year: yearOf(pack),
    expected_assets: 0,
    manifest_assets: 0,
    technical_pass: 0,
    listening_approved: 0,
    missing: 0,
    stale: 0,
    invalid: 0,
    unreviewed: 0,
    variant_reference_declarations: 0,
    variant_references: 0,
    unique_variant_references: 0,
    resolved_variant_references: 0,
    unresolved_variant_references: 0,
    nonconforming_variant_references: 0,
  }]));
  for (const item of expected) packStats.get(item.pack_id).expected_assets += 1;
  for (const item of manifestItems) if (packStats.has(item.pack_id)) packStats.get(item.pack_id).manifest_assets += 1;
  for (const item of assetChecks) {
    const stat = packStats.get(item.pack_id);
    if (item.technical_pass) stat.technical_pass += 1;
    if (item.listening_approved) stat.listening_approved += 1;
  }
  for (const item of missing) if (packStats.has(item.pack_id)) packStats.get(item.pack_id).missing += 1;
  for (const item of stale) if (packStats.has(item.pack_id)) packStats.get(item.pack_id).stale += 1;
  for (const item of invalid) if (packStats.has(item.pack_id)) packStats.get(item.pack_id).invalid += 1;
  for (const item of unreviewed) if (packStats.has(item.pack_id)) packStats.get(item.pack_id).unreviewed += 1;
  for (const entry of refs) packStats.get(entry.pack_id).variant_reference_declarations += 1;
  for (const entry of actualRefs) packStats.get(entry.pack_id).variant_references += 1;
  for (const entry of resolvedRefs) packStats.get(entry.pack_id).resolved_variant_references += 1;
  for (const entry of unresolvedRefs) packStats.get(entry.pack_id).unresolved_variant_references += 1;
  for (const entry of nonconformingRefs) packStats.get(entry.pack_id).nonconforming_variant_references += 1;
  for (const stat of packStats.values()) {
    stat.unique_variant_references = new Set(actualRefs.filter((entry) => entry.pack_id === stat.pack_id).map((entry) => entry.asset_id)).size;
  }
  const packsReport = Array.from(packStats.values()).sort((a, b) => compareText(a.pack_id, b.pack_id));
  const years = Array.from(new Set(packsReport.map((item) => item.year))).sort((a, b) => (a ?? 999) - (b ?? 999)).map((year) => {
    const entries = packsReport.filter((item) => item.year === year);
    return {
      year,
      packs: entries.length,
      ...sumFields(entries, ["expected_assets", "manifest_assets", "technical_pass", "listening_approved", "missing", "stale", "invalid", "unreviewed", "variant_reference_declarations", "variant_references", "resolved_variant_references", "unresolved_variant_references", "nonconforming_variant_references"]),
      unique_variant_references: new Set(actualRefs.filter((entry) => entry.year === year).map((entry) => entry.asset_id)).size,
    };
  });

  const strictGapCount = missing.length + stale.length + invalid.length + orphanManifest.length + orphanFiles.length
    + duplicateIDs.length + duplicatePaths.length + unreviewed.length + unresolvedRefs.length + nonconformingRefs.length;
  return {
    version: 1,
    status: strictGapCount === 0 ? "ready" : "gaps_present",
    generated_by: "packages/content/tools/narration-readiness.mjs",
    deterministic: true,
    sample_limit: sampleLimit,
    policy: {
      expected_provider: expectedProvider,
      minimum_mp3_bytes: 2000,
      minimum_complete_frames: 3,
      minimum_duration_seconds: 0.1,
      narration_root: "apps/web/public/audio/narration/alice",
      human_listening_approval_required: true,
      variant_references_require_independently_registered_matching_asset_id: true,
    },
    totals: {
      packs: packs.length,
      question_variants: packs.reduce((sum, pack) => sum + asArray(pack.question_variants).length, 0),
      expected_assets: expected.length,
      expected_lesson_assets: expected.filter((item) => item.kind === "lesson").length,
      expected_vocabulary_assets: expected.filter((item) => item.kind === "vocabulary").length,
      manifest_items: manifestItems.length,
      technical_pass: assetChecks.filter((item) => item.technical_pass).length,
      decoder_valid: assetChecks.filter((item) => item.technical_pass && item.frame_count >= 3 && item.duration_seconds >= 0.1).length,
      total_duration_seconds: Math.round(assetChecks.reduce((sum, item) => sum + (item.duration_seconds ?? 0), 0) * 1000) / 1000,
      shortest_duration_seconds: Math.min(...assetChecks.map((item) => item.duration_seconds ?? 0)),
      longest_duration_seconds: Math.max(...assetChecks.map((item) => item.duration_seconds ?? 0)),
      listening_approved: assetChecks.filter((item) => item.listening_approved).length,
      missing: missing.length,
      stale: stale.length,
      invalid: invalid.length,
      orphan_manifest_items: orphanManifest.length,
      orphan_files: orphanFiles.length,
      duplicate_ids: duplicateIDs.length,
      duplicate_paths: duplicatePaths.length,
      unreviewed: unreviewed.length,
      variant_reference_declarations: refs.length,
      empty_variant_reference_declarations: emptyRefs.length,
      variant_references: actualRefs.length,
      unique_variant_references: new Set(actualRefs.map((entry) => entry.asset_id)).size,
      audio_asset_id_references: actualRefs.filter((entry) => entry.field === "audio_asset_id").length,
      unique_audio_asset_id_references: new Set(actualRefs.filter((entry) => entry.field === "audio_asset_id").map((entry) => entry.asset_id)).size,
      audio_ref_references: actualRefs.filter((entry) => entry.field === "audio_ref").length,
      unique_audio_ref_references: new Set(actualRefs.filter((entry) => entry.field === "audio_ref").map((entry) => entry.asset_id)).size,
      resolved_variant_references: resolvedRefs.length,
      unique_resolved_variant_references: new Set(resolvedRefs.map((entry) => entry.asset_id)).size,
      unresolved_variant_references: unresolvedRefs.length,
      unique_unresolved_variant_references: new Set(unresolvedRefs.map((entry) => entry.asset_id)).size,
      nonconforming_variant_references: nonconformingRefs.length,
      strict_gaps: strictGapCount,
    },
    manifest: {
      present: fs.existsSync(manifestPath),
      provider: manifest.provider ?? null,
      voice_id: manifest.voice?.id ?? null,
      voice_name: manifest.voice?.name ?? null,
      model_id: manifest.voice?.model_id ?? null,
      production_status: manifest.status ?? null,
    },
    years,
    packs: packsReport,
    samples: {
      missing: bounded(missing),
      stale: bounded(stale),
      invalid: bounded(invalid),
      orphan_manifest_items: bounded(orphanManifest),
      orphan_files: bounded(orphanFiles),
      duplicate_ids: bounded(duplicateIDs),
      duplicate_paths: bounded(duplicatePaths),
      unreviewed: bounded(unreviewed),
      empty_variant_reference_declarations: bounded(emptyRefs),
      unresolved_variant_references: bounded(unresolvedRefs),
      nonconforming_variant_references: bounded(nonconformingRefs),
    },
  };
}

function sumFields(items, fields) {
  return Object.fromEntries(fields.map((field) => [field, items.reduce((sum, item) => sum + item[field], 0)]));
}

function htmlEscape(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);
}

function renderHTML(report) {
  const summaryCards = [
    [report.totals.expected_assets, "expected narration assets"],
    [report.totals.technical_pass, "technical passes"],
    [report.totals.listening_approved, "listening approved"],
    [report.totals.unreviewed, "awaiting listening review"],
    [report.totals.unique_variant_references, "unique variant audio references"],
    [report.totals.unique_unresolved_variant_references, "unique unresolved references"],
  ].map(([value, label]) => `<div class="card"><strong>${value}</strong><span>${htmlEscape(label)}</span></div>`).join("");
  const yearRows = report.years.map((year) => `<tr><th scope="row">Year ${htmlEscape(year.year ?? "unknown")}</th><td>${year.packs}</td><td>${year.expected_assets}</td><td>${year.technical_pass}</td><td>${year.listening_approved}</td><td>${year.unreviewed}</td><td>${year.variant_references}</td><td>${year.unresolved_variant_references}</td></tr>`).join("");
  const packRows = report.packs.map((pack) => `<tr><th scope="row"><code>${htmlEscape(pack.pack_id)}</code></th><td>${htmlEscape(pack.year ?? "unknown")}</td><td>${pack.expected_assets}</td><td>${pack.technical_pass}</td><td>${pack.listening_approved}</td><td>${pack.unreviewed}</td><td>${pack.variant_references}</td><td>${pack.unresolved_variant_references}</td><td>${pack.nonconforming_variant_references}</td></tr>`).join("");
  const gapSections = Object.entries(report.samples).map(([name, group]) => `<section aria-labelledby="${htmlEscape(name)}"><h2 id="${htmlEscape(name)}">${htmlEscape(name.replaceAll("_", " "))}: ${group.count}</h2>${group.samples.length ? `<ul>${group.samples.map((item) => `<li><code>${htmlEscape(item.id ?? item.asset_id ?? item.relative_file ?? item.pack_id ?? "item")}</code>${item.pack_id ? ` — ${htmlEscape(item.pack_id)}` : ""}${item.issues ? ` — ${htmlEscape(item.issues.join("; "))}` : ""}</li>`).join("")}</ul>${group.truncated ? `<p>Showing ${group.shown} of ${group.count} deterministic samples.</p>` : ""}` : "<p>None.</p>"}</section>`).join("");
  return `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>NexusLearn narration readiness</title>
<style>body{font-family:Inter,system-ui,sans-serif;margin:0;background:#f6f8fc;color:#17233f;line-height:1.5}.skip{position:absolute;left:-999px}.skip:focus{left:1rem;top:1rem;background:#fff;padding:.75rem;z-index:2}main{max-width:1200px;margin:auto;padding:2rem}.status{padding:1rem;border-left:.4rem solid #9a6700;background:#fff7d6}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(10rem,1fr));gap:.75rem;margin:1.5rem 0}.card{background:#fff;border:1px solid #d9e2ef;border-radius:.75rem;padding:1rem}.card strong,.card span{display:block}.card strong{font-size:1.7rem}.table-wrap{overflow-x:auto;margin:1rem 0 2rem}table{width:100%;border-collapse:collapse;background:#fff}caption{text-align:left;font-weight:700;padding:.75rem 0}th,td{padding:.65rem;border:1px solid #d9e2ef;text-align:left;vertical-align:top}thead th{background:#17233f;color:#fff}section{margin:2rem 0}code{overflow-wrap:anywhere}a{color:#0645ad}</style></head>
<body><a class="skip" href="#main">Skip to report</a><main id="main"><h1>NexusLearn narration readiness</h1><p class="status"><strong>Status: ${htmlEscape(report.status.replaceAll("_", " "))}.</strong> This is a read-only audit. Technical validation does not replace human listening approval.</p><div class="cards" aria-label="Readiness summary">${summaryCards}</div>
<section><h2>Policy and manifest</h2><p>Provider: ${htmlEscape(report.manifest.provider ?? "missing")}; voice: ${htmlEscape(report.manifest.voice_name ?? "missing")}; model: <code>${htmlEscape(report.manifest.model_id ?? "missing")}</code>. MP3 files require a valid signature and at least ${report.policy.minimum_mp3_bytes} bytes.</p></section>
<section><h2>Coverage by year</h2><div class="table-wrap"><table><caption>Narration and question-variant references by year</caption><thead><tr><th scope="col">Year</th><th scope="col">Packs</th><th scope="col">Expected</th><th scope="col">Technical</th><th scope="col">Approved</th><th scope="col">Unreviewed</th><th scope="col">Variant refs</th><th scope="col">Unresolved</th></tr></thead><tbody>${yearRows}</tbody></table></div></section>
<section><h2>Coverage by pack</h2><div class="table-wrap"><table><caption>Narration readiness for every content pack</caption><thead><tr><th scope="col">Pack</th><th scope="col">Year</th><th scope="col">Expected</th><th scope="col">Technical</th><th scope="col">Approved</th><th scope="col">Unreviewed</th><th scope="col">Variant refs</th><th scope="col">Unresolved</th><th scope="col">Nonconforming</th></tr></thead><tbody>${packRows}</tbody></table></div></section>
<section><h2>Bounded gap samples</h2><p>Each category shows at most ${report.sample_limit} items; complete counts remain above and in the JSON report.</p></section>${gapSections}</main></body></html>\n`;
}

function writeReports(report) {
  fs.mkdirSync(coverageDir, { recursive: true });
  fs.mkdirSync(publicDir, { recursive: true });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const html = renderHTML(report);
  fs.writeFileSync(path.join(coverageDir, "narration-readiness.json"), json);
  fs.writeFileSync(path.join(coverageDir, "narration-readiness.html"), html);
  fs.writeFileSync(path.join(publicDir, "narration-readiness.json"), json);
  fs.writeFileSync(path.join(publicDir, "narration-readiness.html"), html);
}

const report = buildReport();
writeReports(report);
console.log(`narration-readiness packs=${report.totals.packs} expected=${report.totals.expected_assets} manifest=${report.totals.manifest_items} technical=${report.totals.technical_pass} approved=${report.totals.listening_approved} unreviewed=${report.totals.unreviewed}`);
console.log(`narration-readiness variant_refs=${report.totals.variant_references} unique=${report.totals.unique_variant_references} unresolved=${report.totals.unresolved_variant_references} unique_unresolved=${report.totals.unique_unresolved_variant_references} nonconforming=${report.totals.nonconforming_variant_references}`);
console.log(`narration-readiness missing=${report.totals.missing} stale=${report.totals.stale} invalid=${report.totals.invalid} orphan_manifest=${report.totals.orphan_manifest_items} orphan_files=${report.totals.orphan_files} duplicate_ids=${report.totals.duplicate_ids} duplicate_paths=${report.totals.duplicate_paths}`);
if (strict && report.totals.strict_gaps > 0) process.exitCode = 1;
