#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateExactAudioReleaseGate } from "./narration-readiness.mjs";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, "../../..");
const packsDir = path.join(repoRoot, "packages/content/packs");
const generatedDir = path.join(repoRoot, "packages/content/generated");
const previewsDir = path.join(generatedDir, "previews");
const policyPath = path.join(repoRoot, "packages/content/roadmaps/content-release-policy.json");
const aiEvidencePath = path.join(repoRoot, "packages/content/generated/coverage/ai-review-evidence.json");
const defaultAudioManifestPath = path.join(repoRoot, "packages/content/audio/narration-manifest-v2.json");
const defaultAudioReviewsPath = path.join(repoRoot, "packages/content/audio/narration-listening-reviews-v2.json");
const webContentDir = path.join(repoRoot, "apps/web/public/content");
const outArg = argValue("--out");
const outDir = outArg ? path.resolve(process.cwd(), outArg) : path.join(repoRoot, "packages/content/generated/coverage");

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function fileExists(file) {
  return fs.existsSync(file) && fs.statSync(file).isFile();
}

function packFiles() {
  return fs.readdirSync(packsDir).filter((file) => file.endsWith(".json")).sort();
}

export function reconcileReviewGate(source, backend) {
  const unavailable = !backend || backend.available === false;
  const revisionMatch = !unavailable &&
    backend.rubric_revision === source.rubric_revision &&
    backend.source_set_revision === source.source_set_revision &&
    backend.reviewer_implementation === source.reviewer_implementation;
  const expectedPerLane = source.review_units;
  const coverageMatch = !unavailable &&
    backend.packs === source.packs && backend.variants === source.variants &&
    backend.current_ai_curriculum_lead === expectedPerLane && backend.current_ai_send_lead === expectedPerLane;
  const gatesClear = !unavailable && backend.controlled_pilot_allowed === true &&
    backend.stale === 0 && backend.revision_required === 0 && backend.escalation_required === 0 &&
    backend.blocking_findings === 0 && backend.escalation_findings === 0;
  const promotionAllowed = source.controlled_pilot_allowed === true && revisionMatch && coverageMatch && gatesClear;
  return {
    ...(backend ?? {}),
    available: !unavailable,
    revision_match: revisionMatch,
    coverage_match: coverageMatch,
    promotion_allowed: promotionAllowed,
    reason: promotionAllowed ? "source and backend AI review gates match" :
      unavailable ? "backend review state unavailable" :
        !revisionMatch ? "backend review revision differs from source" :
          !coverageMatch ? "backend review coverage is incomplete" : "backend review gates are not clear",
  };
}

export function reconcileReleaseGate(source, backend, audioGate) {
  const reviewGate = reconcileReviewGate(source, backend);
  const audioReady = audioGate?.release_ready === true;
  const promotionAllowed = reviewGate.promotion_allowed && audioReady;
  return {
    backend_release_state: reviewGate,
    audio_release_state: audioGate ?? { release_ready: false, blockers_by_cause: { unavailable: 1 } },
    promotion_allowed: promotionAllowed,
    promotion_reason: promotionAllowed
      ? "AI review and exact audio release gates are current"
      : !reviewGate.promotion_allowed
        ? reviewGate.reason
        : "exact audio release gate is blocked",
    production_release_allowed: false,
    production_reason: "independent human safeguarding and real-child pilot evidence remain backend activation requirements",
  };
}

function sourceReviewProjection() {
  if (!fileExists(aiEvidencePath)) return { available: false, controlled_pilot_allowed: false };
  const evidence = readJSON(aiEvidencePath);
  return {
    available: true,
    batch_id: evidence.batch_id,
    batch_hash: evidence.batch_hash,
    rubric_revision: evidence.rubric_revision,
    source_set_revision: evidence.source_set_revision,
    reviewer_implementation: evidence.reviewer_implementation,
    packs: evidence.totals?.packs ?? 0,
    variants: evidence.totals?.variants ?? 0,
    review_units: evidence.totals?.review_units ?? 0,
    current_lane_decisions: evidence.totals?.current_lane_decisions ?? 0,
    stale: evidence.totals?.stale_decisions ?? 0,
    controlled_pilot_allowed: evidence.controlled_pilot_allowed === true,
  };
}

function sourceAudioProjection() {
  const manifestArg = argValue("--audio-manifest");
  const reviewsArg = argValue("--audio-reviews");
  const manifestPath = manifestArg ? path.resolve(process.cwd(), manifestArg) : defaultAudioManifestPath;
  const reviewsPath = reviewsArg ? path.resolve(process.cwd(), reviewsArg) : defaultAudioReviewsPath;
  const manifest = fileExists(manifestPath) ? readJSON(manifestPath) : undefined;
  const reviewLedger = fileExists(reviewsPath) ? readJSON(reviewsPath) : { reviews: [] };
  return evaluateExactAudioReleaseGate({
    manifest,
    reviews: Array.isArray(reviewLedger) ? reviewLedger : reviewLedger.reviews,
    supportedLicences: ["provider_terms"],
  });
}

function collect(backendState) {
  const policy = readJSON(policyPath);
  const allowedChannels = new Set(policy.policy?.allowed_channels ?? []);
  const failures = [];
  const warnings = [];
  const rows = [];
  const channelCounts = {};

  for (const file of packFiles()) {
    const packPath = path.join(packsDir, file);
    const pack = readJSON(packPath);
    const packID = pack.pack_id;
    const override = policy.pack_overrides?.[packID] ?? {};
    const channel = override.channel ?? policy.policy?.default_channel ?? "authoring";
    const payloadPath = path.join(generatedDir, `${packID}.admin-payload.json`);
    const previewPath = path.join(previewsDir, `${packID}.preview.html`);
    const hasPayload = fileExists(payloadPath);
    const hasPreview = fileExists(previewPath);
    const row = {
      pack_id: packID,
      source_file: `packages/content/packs/${file}`,
      channel,
      status: pack.status ?? "unknown",
      year: pack.source_alignment?.year,
      subject: pack.source_alignment?.subject,
      objective_id: pack.objective?.id,
      pack_hash: sha256(packPath),
      payload_hash: hasPayload ? sha256(payloadPath) : "",
      preview_hash: hasPreview ? sha256(previewPath) : "",
      payload_path: hasPayload ? `packages/content/generated/${packID}.admin-payload.json` : "",
      preview_path: hasPreview ? `packages/content/generated/previews/${packID}.preview.html` : "",
      variant_sample_count: Array.isArray(pack.question_variants) ? pack.question_variants.length : 0,
      pilot_variant_target: pack.practice?.variant_targets?.pilot ?? 150,
      mature_variant_target: pack.practice?.variant_targets?.mature ?? 500,
      reviews: {
        curriculum: pack.qa?.curriculum_review ?? "missing",
        teacher: pack.qa?.teacher_review ?? "missing",
        accessibility: pack.qa?.accessibility_review ?? "missing",
        safeguarding: pack.qa?.safeguarding_review ?? "missing",
      },
      warnings: [],
    };

    if (!packID) failures.push(`${file}: pack_id is required`);
    if (!allowedChannels.has(channel)) failures.push(`${packID}: release channel ${channel} is not allowed`);
    if (policy.policy?.requires_payload_hash && !hasPayload) failures.push(`${packID}: generated admin payload is missing`);
    if (policy.policy?.requires_preview && !hasPreview) failures.push(`${packID}: reviewer preview is missing`);
    if (channel === "pilot" || channel === "release") {
      const incompleteReviews = Object.entries(row.reviews)
        .filter(([, status]) => !["complete", "approved", "passed"].includes(String(status).toLowerCase()))
        .map(([name]) => name);
      if (row.variant_sample_count < row.pilot_variant_target) {
        failures.push(`${packID}: ${channel} channel requires actual reviewed variants (${row.variant_sample_count}/${row.pilot_variant_target})`);
      }
      if (incompleteReviews.length > 0) {
        failures.push(`${packID}: ${channel} channel requires completed ${incompleteReviews.join(", ")} review`);
      }
      if (!["pilot", "approved", "published"].includes(pack.status)) {
        failures.push(`${packID}: ${channel} channel is incompatible with pack status ${pack.status}`);
      }
      if (policy.policy?.requires_warning_acknowledgement_before_pilot && !override.warning_acknowledged) {
        failures.push(`${packID}: ${channel} channel requires warning_acknowledged override`);
      }
    }
    if (row.variant_sample_count < row.mature_variant_target) {
      row.warnings.push(`sample variants ${row.variant_sample_count}/${row.mature_variant_target}`);
    }
    channelCounts[channel] = (channelCounts[channel] ?? 0) + 1;
    warnings.push(...row.warnings.map((warning) => `${packID}: ${warning}`));
    rows.push(row);
  }

  const sourceProjection = sourceReviewProjection();
  const reconciled = reconcileReleaseGate(sourceProjection, backendState, sourceAudioProjection());
  return {
    version: policy.version,
    status: policy.status,
    generated_by: "packages/content/tools/content-release-snapshot.mjs",
    generated_at: new Date().toISOString(),
    policy: policy.policy,
    source_review_projection: sourceProjection,
    backend_release_state: reconciled.backend_release_state,
    audio_release_state: reconciled.audio_release_state,
    promotion_allowed: reconciled.promotion_allowed,
    promotion_reason: reconciled.promotion_reason,
    production_release_allowed: reconciled.production_release_allowed,
    production_reason: reconciled.production_reason,
    totals: {
      packs: rows.length,
      authoring: channelCounts.authoring ?? 0,
      review: channelCounts.review ?? 0,
      pilot: channelCounts.pilot ?? 0,
      release: channelCounts.release ?? 0,
      archived: channelCounts.archived ?? 0,
      failures: failures.length,
      warnings: warnings.length,
    },
    failures,
    warnings,
    packs: rows,
  };
}

async function loadBackendState() {
  const statePath = argValue("--backend-state");
  if (statePath) return { available: true, ...readJSON(path.resolve(process.cwd(), statePath)) };
  const apiURL = argValue("--api-url") ?? process.env.NEXUSLEARN_API_URL;
  const token = process.env.NEXUSLEARN_ACCOUNT_SESSION;
  if (!apiURL || !token) return { available: false };
  try {
    const response = await fetch(`${apiURL.replace(/\/$/, "")}/v1/admin/ai-reviews/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return { available: false, status: response.status };
    return { available: true, ...(await response.json()) };
  } catch {
    return { available: false };
  }
}

function htmlEscape(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);
}

function writeReports(report) {
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "content-release-snapshot.json");
  const htmlPath = path.join(outDir, "content-release-snapshot.html");
  if (fileExists(jsonPath)) {
    const previous = readJSON(jsonPath);
    const previousComparable = { ...previous, generated_at: "" };
    const nextComparable = { ...report, generated_at: "" };
    if (JSON.stringify(previousComparable) === JSON.stringify(nextComparable) && previous.generated_at) {
      report.generated_at = previous.generated_at;
    }
  }
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  const rows = report.packs.map((pack) => `
    <tr>
      <td><code>${htmlEscape(pack.pack_id)}</code><br />Y${htmlEscape(pack.year)} ${htmlEscape(pack.subject)}</td>
      <td>${htmlEscape(pack.channel)}</td>
      <td>${htmlEscape(pack.status)}</td>
      <td><code>${htmlEscape(pack.pack_hash.slice(0, 12))}</code></td>
      <td><code>${htmlEscape(pack.payload_hash.slice(0, 12))}</code></td>
      <td>${pack.variant_sample_count}/${pack.mature_variant_target}</td>
      <td>${htmlEscape(pack.warnings.join("; "))}</td>
    </tr>`).join("");
  fs.writeFileSync(htmlPath, `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>NexusLearn Content Release Snapshot</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; margin: 32px; color: #17233f; background: #f8fbff; }
    .summary { display: flex; flex-wrap: wrap; gap: 12px; margin: 20px 0; }
    .summary div { background: #fff; border: 1px solid #dbe7f2; border-radius: 12px; padding: 12px 16px; box-shadow: 0 10px 24px rgba(23,35,63,0.08); }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 14px; overflow: hidden; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e7eef7; vertical-align: top; }
    th { background: #17233f; color: #fff; }
  </style>
</head>
<body>
  <h1>NexusLearn Content Release Snapshot</h1>
  <p>Deterministic pack, payload and preview hashes for release control and rollback evidence.</p>
  <section class="summary">
    <div><strong>${report.totals.packs}</strong><br />packs</div>
    <div><strong>${report.totals.authoring}</strong><br />authoring</div>
    <div><strong>${report.totals.pilot}</strong><br />pilot</div>
    <div><strong>${report.totals.failures}</strong><br />failures</div>
    <div><strong>${report.totals.warnings}</strong><br />warnings</div>
  </section>
  <table>
    <thead><tr><th>Pack</th><th>Channel</th><th>Status</th><th>Pack hash</th><th>Payload hash</th><th>Variants</th><th>Warnings</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>
`);
  fs.mkdirSync(webContentDir, { recursive: true });
  const webJSONPath = path.join(webContentDir, "content-release-snapshot.json");
  fs.copyFileSync(jsonPath, webJSONPath);
  return { jsonPath, htmlPath, webJSONPath };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const report = collect(await loadBackendState());
  const paths = writeReports(report);
  console.log(`content-release packs=${report.totals.packs} failures=${report.totals.failures} warnings=${report.totals.warnings} backend=${report.backend_release_state.available ? "available" : "unavailable"} promotion=${report.promotion_allowed}`);
  console.log(`content-release written ${path.relative(process.cwd(), paths.jsonPath)}`);
  console.log(`content-release written ${path.relative(process.cwd(), paths.htmlPath)}`);
  console.log(`content-release web asset ${path.relative(process.cwd(), paths.webJSONPath)}`);
  if (report.totals.failures > 0) {
    for (const failure of report.failures) console.error(`release failure ${failure}`);
    process.exitCode = 1;
  }
  if (process.argv.includes("--strict-backend") && !report.promotion_allowed) {
    console.error(`release failure ${report.backend_release_state.reason}`);
    process.exitCode = 1;
  }
}
