#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, "../../..");
const packsDir = path.join(repoRoot, "packages/content/packs");
const generatedDir = path.join(repoRoot, "packages/content/generated");
const previewsDir = path.join(generatedDir, "previews");
const policyPath = path.join(repoRoot, "packages/content/roadmaps/content-release-policy.json");
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

function collect() {
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

  return {
    version: policy.version,
    status: policy.status,
    generated_by: "packages/content/tools/content-release-snapshot.mjs",
    generated_at: new Date().toISOString(),
    policy: policy.policy,
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

const report = collect();
const paths = writeReports(report);
console.log(`content-release packs=${report.totals.packs} failures=${report.totals.failures} warnings=${report.totals.warnings}`);
console.log(`content-release written ${path.relative(process.cwd(), paths.jsonPath)}`);
console.log(`content-release written ${path.relative(process.cwd(), paths.htmlPath)}`);
console.log(`content-release web asset ${path.relative(process.cwd(), paths.webJSONPath)}`);
if (report.totals.failures > 0) {
  for (const failure of report.failures) console.error(`release failure ${failure}`);
  process.exit(1);
}
