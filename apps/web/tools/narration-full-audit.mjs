import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { inspectMP3Buffer } from "../../../packages/content/tools/lib/mp3-inspection.mjs";
import { measurePCM, assessPace } from "./audio-audit-metrics.mjs";
import { reconcileAudioInventory, fatalAudioAudit } from "./audio-audit-inventory.mjs";
import { renderAudioAuditReport } from "./audio-audit-report.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const publicRoot = path.join(repo, "apps/web/public");
const audioRoot = path.join(publicRoot, "audio");
const output = path.join(repo, "packages/content/generated/coverage/narration-full-audit.json");
const manifestBytes = fs.readFileSync(path.join(repo, "packages/content/audio/narration-manifest.json"));
const manifest = JSON.parse(manifestBytes);
const publicManifestBytes = fs.readFileSync(path.join(publicRoot, "content/narration-manifest.json"));
const publicManifest = JSON.parse(publicManifestBytes);
const hash = data => crypto.createHash("sha256").update(data).digest("hex");
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : entry.isFile() && /\.(mp3|wav|ogg|m4a)$/i.test(entry.name) ? [path.join(dir, entry.name)] : []);
}
const files = walk(audioRoot).sort();
const paths = new Set(files.map(file => "/" + path.relative(publicRoot, file).replaceAll("\\", "/")));
const inventoryIssues = reconcileAudioInventory(manifest.items ?? [], publicManifest.items ?? [], [...paths]);
const byFile = new Map((manifest.items ?? []).filter(Boolean).map(item => [item.file, item]));
const missing = inventoryIssues.filter(issue => issue.code === "missing_file");
const rows = [];
const browser = await chromium.launch({ headless: true });
let cursor = 0;
try {
  await Promise.all([0, 1].map(async () => {
    const page = await browser.newPage();
    await page.addScriptTag({ content: `window.measurePCM = ${measurePCM.toString()}; window.auditContext = new OfflineAudioContext(1, 1, 44100);` });
    while (cursor < files.length) {
      const file = files[cursor++];
      const relative = "/" + path.relative(publicRoot, file).replaceAll("\\", "/");
      const item = byFile.get(relative);
      const bytes = fs.readFileSync(file);
      const sha = hash(bytes);
      const year = Number(item?.year ?? item?.pack_id?.match(/-y([1-7])-/)?.[1]) || null;
      const row = { id: item?.id ?? null, file: relative, pack_id: item?.pack_id ?? null, year, kind: item?.kind ?? null, text: item?.text ?? null, text_sha256: item?.text_sha256 ?? null, bytes: bytes.length, sha256: sha, flags: [] };
      if (!item) row.flags.push("orphan_file");
      if (item && item.sha256 !== sha) row.flags.push("audio_hash_mismatch");
      if (item && item.text_sha256 !== hash(item.text ?? "")) row.flags.push("script_hash_mismatch");
      row.recorded_generation_speed = item?.voice_settings?.speed ?? null;
      if (item && row.recorded_generation_speed === null) row.flags.push("generation_speed_not_recorded");
      if (/\.mp3$/i.test(file)) {
        row.mp3 = inspectMP3Buffer(bytes);
        if (!row.mp3.technical_pass) row.flags.push("frame_inspection_failed");
      }
      try {
        row.pcm = await page.evaluate(async base64 => {
          const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
          let timer;
          try {
            const decoded = await Promise.race([window.auditContext.decodeAudioData(bytes.buffer), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Decode timeout")), 15000); })]);
            return window.measurePCM(Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i)), decoded.sampleRate);
          } finally { clearTimeout(timer); }
        }, bytes.toString("base64"));
        if (row.pcm.non_finite_samples) row.flags.push("invalid_pcm_samples");
        if (row.pcm.peak < 0.00001) row.flags.push("silent_audio");
        if (row.pcm.silent_fraction > 0.65) row.flags.push("mostly_silence_review");
        if (row.pcm.clipped_fraction > 0.001) row.flags.push("hot_peaks_review");
        if (row.pcm.leading_silence_seconds > 1.5 || row.pcm.trailing_silence_seconds > 2) row.flags.push("long_edge_silence_review");
        row.pace = assessPace(item?.text, row.pcm.duration_seconds, year);
        if (row.pace.status.startsWith("pace_review")) row.flags.push(row.pace.status);
      } catch (error) {
        row.flags.push("decode_failed");
        row.decode_error = String(error.message).slice(0, 250);
      }
      rows.push(row);
      if (rows.length % 100 === 0) console.log(`Decoded ${rows.length}/${files.length}`);
    }
    await page.close();
  }));
} finally { await browser.close(); }
rows.sort((a, b) => a.file.localeCompare(b.file));
const groups = new Map();
for (const row of rows) {
  const matches = groups.get(row.sha256) ?? [];
  matches.push(row.id ?? row.file);
  groups.set(row.sha256, matches);
}
const counts = {};
for (const row of rows) for (const flag of row.flags) counts[flag] = (counts[flag] ?? 0) + 1;
const summary = Array.from({ length: 7 }, (_, i) => {
  const selected = rows.filter(row => row.year === i + 1);
  const rates = selected.filter(row => row.pace?.words >= 8).map(row => row.pace.wpm).sort((a, b) => a - b);
  return { year: i + 1, files: selected.length, decoded: selected.filter(row => row.pcm).length, measured_scripts: rates.length, median_wpm: rates.length ? rates[Math.floor(rates.length / 2)] : null, max_wpm: rates.at(-1) ?? null, fast_review: selected.filter(row => row.flags.includes("pace_review_fast")).length };
});
const report = { schema: "nexuslearn.audio-technical-audit.v1", generated_at: new Date().toISOString(), decoder: `Chromium ${browser.version()} Web Audio PCM`, manifest_sha256: hash(manifestBytes), public_manifest_sha256: hash(publicManifestBytes), scope: "All MP3/WAV/OGG/M4A files under apps/web/public/audio; no subjective listening approval", thresholds: "20ms silence windows below -50dBFS; >65% silence / >0.1% near-full-scale samples flagged for review. Script rate is not transcription; WPM screens Y1>160,Y2>170,Y3-7>190 or <70, scripts >=8 words only. Not educational standards.", total_files: files.length, manifest_items: manifest.items?.length ?? 0, inventory_issues: inventoryIssues, missing_files: missing, duplicate_audio_groups: [...groups.values()].filter(ids => ids.length > 1), flag_counts: counts, by_year: summary, items: rows };
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
fs.writeFileSync(output.replace(/\.json$/, ".html"), renderAudioAuditReport(report));
console.log(JSON.stringify({ total_files: report.total_files, inventory_issues: inventoryIssues, flags: counts, by_year: summary, report: path.relative(repo, output) }, null, 2));
if (fatalAudioAudit(inventoryIssues, rows)) process.exitCode = 1;
