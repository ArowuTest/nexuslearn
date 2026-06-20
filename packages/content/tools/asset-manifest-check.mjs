#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, "../../..");
const manifestPath = path.join(repoRoot, "packages/content/roadmaps/asset-production-manifest.json");
const narrationManifestPath = path.join(repoRoot, "packages/content/audio/narration-manifest.json");
const packDir = path.join(repoRoot, "packages/content/packs");
const outArg = argValue("--out");
const outDir = outArg ? path.resolve(process.cwd(), outArg) : path.join(repoRoot, "packages/content/generated/coverage");

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function collect() {
  const manifest = readJSON(manifestPath);
  const policy = manifest.policy ?? {};
  const releaseStatuses = new Set(asArray(policy.release_statuses));
  const requiredAccessibility = asArray(policy.required_accessibility);
  const requiredYears = asArray(policy.required_years);
  const audioQuality = policy.audio_quality ?? {};
  const failures = [];
  const warnings = [];
  const statusCounts = {};
  const yearCoverage = new Map(requiredYears.map((year) => [year, 0]));

  for (const family of asArray(manifest.asset_families)) {
    const label = family.id || family.name || "unnamed-family";
    if (!family.id || !/^[a-z0-9-]+$/.test(family.id)) failures.push(`${label}: id must be kebab-case`);
    if (!family.name) failures.push(`${label}: name is required`);
    if (!family.purpose) failures.push(`${label}: purpose is required`);
    if (!family.owner) failures.push(`${label}: owner is required`);
    if (!releaseStatuses.has(family.status)) failures.push(`${label}: status must be one of ${Array.from(releaseStatuses).join(", ")}`);
    if (!asArray(family.formats).length) failures.push(`${label}: at least one format is required`);
    if (!asArray(family.variants).length) failures.push(`${label}: at least one variant/state is required`);
    for (const requirement of requiredAccessibility) {
      if (!asArray(family.accessibility).includes(requirement)) failures.push(`${label}: missing accessibility requirement ${requirement}`);
    }
    for (const year of asArray(family.years)) {
      if (yearCoverage.has(year)) yearCoverage.set(year, (yearCoverage.get(year) ?? 0) + 1);
    }
    if (family.runtime && family.status === "planned") {
      failures.push(`${label}: runtime asset families must be at least prototype before child runtime use`);
    }
    if (!asArray(family.production_gaps).length && family.status !== "production") {
      warnings.push(`${label}: non-production family should list production gaps`);
    }
    statusCounts[family.status] = (statusCounts[family.status] ?? 0) + 1;
  }

  for (const [year, count] of yearCoverage.entries()) {
    if (count === 0) failures.push(`Year ${year}: no asset family coverage`);
  }
  if (audioQuality.browser_tts !== "prohibited_for_phonics_narration_and_teaching") {
    failures.push("audio policy: browser TTS must be prohibited for phonics, narration and teaching");
  }
  const narration = asArray(manifest.asset_families).find((family) => family.id === "narration-young-learners");
  if (!narration?.quality_gate || narration.quality_gate.browser_tts_allowed !== false) {
    failures.push("narration-young-learners: quality gate must explicitly forbid browser TTS");
  }
  if (!narration?.quality_gate?.requires_human_listening_approval) {
    failures.push("narration-young-learners: human listening approval is required");
  }
  if (fs.existsSync(narrationManifestPath)) {
    const produced = readJSON(narrationManifestPath);
    const expected = expectedNarrationCount();
    if (produced.totals?.assets !== expected) {
      failures.push(`produced narration: expected ${expected} assets, found ${produced.totals?.assets ?? 0}`);
    }
    if (produced.totals?.technical_pass !== produced.totals?.assets) {
      failures.push("produced narration: every generated asset must pass technical validation");
    }
    if (produced.policy?.browser_tts_allowed !== false || produced.policy?.phonemes_included !== false) {
      failures.push("produced narration: browser TTS and unreviewed phonemes must remain excluded");
    }
    for (const item of asArray(produced.items)) {
      const localFile = path.join(repoRoot, "apps/web/public", String(item.file ?? "").replace(/^\//, ""));
      if (!item.technical_pass || !fs.existsSync(localFile) || fs.statSync(localFile).size < 2_000) {
        failures.push(`${item.id ?? "unknown narration"}: produced MP3 is missing or invalid`);
      }
    }
  }

  return {
    version: manifest.version,
    status: manifest.status,
    generated_by: "packages/content/tools/asset-manifest-check.mjs",
    totals: {
      families: asArray(manifest.asset_families).length,
      runtime_families: asArray(manifest.asset_families).filter((family) => family.runtime).length,
      planned: statusCounts.planned ?? 0,
      prototype: statusCounts.prototype ?? 0,
      pilot: statusCounts.pilot ?? 0,
      production: statusCounts.production ?? 0,
      failures: failures.length,
      warnings: warnings.length,
    },
    year_coverage: Object.fromEntries(yearCoverage),
    failures,
    warnings,
    asset_families: manifest.asset_families,
  };
}

function expectedNarrationCount() {
  let count = 0;
  for (const file of fs.readdirSync(packDir).filter((name) => name.endsWith(".json"))) {
    const pack = readJSON(path.join(packDir, file));
    count += asArray(pack.teaching_sequence).filter((step) => typeof step.audio_script === "string" && step.audio_script.trim()).length;
    count += asArray(pack.objective?.vocabulary).filter((entry) => typeof entry.audio_script === "string" && entry.audio_script.trim()).length;
  }
  return count;
}

function htmlEscape(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);
}

function writeReports(report) {
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "asset-production-readiness.json");
  const htmlPath = path.join(outDir, "asset-production-readiness.html");
  const publicDir = path.join(repoRoot, "apps/web/public/content");
  const publicJsonPath = path.join(publicDir, "asset-production-readiness.json");
  const publicHtmlPath = path.join(publicDir, "asset-production-readiness.html");
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  const rows = asArray(report.asset_families).map((family) => `
    <tr>
      <td><code>${htmlEscape(family.id)}</code><br />${htmlEscape(family.name)}</td>
      <td>${htmlEscape(family.status)}</td>
      <td>${family.runtime ? "yes" : "no"}</td>
      <td>${htmlEscape(asArray(family.years).join(", "))}</td>
      <td>${htmlEscape(asArray(family.formats).join(", "))}</td>
      <td>${htmlEscape(asArray(family.production_gaps).join("; "))}</td>
    </tr>`).join("");
  fs.writeFileSync(htmlPath, `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>NexusLearn Asset Production Readiness</title>
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
  <h1>NexusLearn Asset Production Readiness</h1>
  <p>Tracks the produced-art, animation, narration and accessibility asset pipeline before Phase 4 scale.</p>
  <section class="summary">
    <div><strong>${report.totals.families}</strong><br />families</div>
    <div><strong>${report.totals.runtime_families}</strong><br />runtime families</div>
    <div><strong>${report.totals.prototype}</strong><br />prototype</div>
    <div><strong>${report.totals.planned}</strong><br />planned</div>
    <div><strong>${report.totals.failures}</strong><br />failures</div>
  </section>
  <table>
    <thead><tr><th>Family</th><th>Status</th><th>Runtime</th><th>Years</th><th>Formats</th><th>Production gaps</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>
`);
  fs.mkdirSync(publicDir, { recursive: true });
  fs.copyFileSync(jsonPath, publicJsonPath);
  fs.copyFileSync(htmlPath, publicHtmlPath);
  return { jsonPath, htmlPath, publicJsonPath, publicHtmlPath };
}

const report = collect();
const paths = writeReports(report);
console.log(`asset-manifest families=${report.totals.families} failures=${report.totals.failures} warnings=${report.totals.warnings}`);
console.log(`asset-manifest written ${path.relative(process.cwd(), paths.jsonPath)}`);
console.log(`asset-manifest written ${path.relative(process.cwd(), paths.htmlPath)}`);
console.log(`asset-manifest web asset ${path.relative(process.cwd(), paths.publicJsonPath)}`);
if (report.totals.failures > 0) {
  for (const failure of report.failures) console.error(`asset failure ${failure}`);
  process.exit(1);
}
