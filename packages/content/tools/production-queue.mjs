#!/usr/bin/env node
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const roadmapPath = path.join(repoRoot, "packages/content/roadmaps/y1-y7-core-pack-roadmap.json");
const packRoot = path.join(repoRoot, "packages/content/packs");
const coreSubjects = ["Mathematics", "English", "Science"];

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const roadmap = await readJSON(roadmapPath);
  const packs = await readPacks(packRoot);
  const queue = buildQueue(roadmap, packs);
  printQueue(queue);
  if (options.out) {
    const outDir = path.resolve(options.out);
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, "next-pack-production-queue.json"), `${JSON.stringify(queue, null, 2)}\n`, "utf8");
    await writeFile(path.join(outDir, "next-pack-production-queue.html"), renderHTML(queue), "utf8");
    console.log(`queue written ${relative(path.join(outDir, "next-pack-production-queue.json"))}`);
    console.log(`queue written ${relative(path.join(outDir, "next-pack-production-queue.html"))}`);
  }
  const errors = validateQueue(queue);
  if (errors.length > 0) {
    for (const error of errors) console.log(`error: ${error}`);
    process.exit(1);
  }
}

function buildQueue(roadmap, packs) {
  const authoredIDs = new Set(packs.map((pack) => pack.pack_id));
  const authoredByYearSubject = new Map();
  for (const pack of packs) {
    const key = `${pack.source_alignment?.year}:${pack.source_alignment?.subject}`;
    authoredByYearSubject.set(key, (authoredByYearSubject.get(key) ?? 0) + 1);
  }
  const items = [];
  for (const yearEntry of roadmap.years ?? []) {
    const yearAuthoredCount = packs.filter((pack) => pack.source_alignment?.year === yearEntry.year).length;
    for (const pack of yearEntry.priority_packs ?? []) {
      if (authoredIDs.has(pack.pack_id)) continue;
      const subjectAuthoredCount = authoredByYearSubject.get(`${yearEntry.year}:${pack.subject}`) ?? 0;
      const score = scoreMissingPack(pack, yearAuthoredCount, subjectAuthoredCount);
      items.push({
        rank: 0,
        pack_id: pack.pack_id,
        year: yearEntry.year,
        phase: yearEntry.phase,
        subject: pack.subject,
        strand: pack.strand,
        target_status: pack.target_status,
        roadmap_priority: pack.priority,
        score,
        reason: reasonFor(pack, yearAuthoredCount, subjectAuthoredCount),
        expected_pack_definition: {
          teaching_sequence: "6-9 steps with explicit teach, worked example, guided practice, checkpoint, repair and teach-back.",
          practice_bank: "At least 150 pilot, 300 release and 800-1500+ mature planned variants through blueprints.",
          interactions: expectedInteractions(pack),
          animation: expectedAnimation(pack),
          evidence: "Signals, mastery rule, parent summary, teacher evidence and next actions.",
          accessibility: "Low-sensory, reduced-motion, audio-first, reading, attention, processing, confidence and EAL supports."
        }
      });
    }
  }
  items.sort((a, b) => b.score - a.score || a.year - b.year || a.roadmap_priority - b.roadmap_priority || a.pack_id.localeCompare(b.pack_id));
  items.forEach((item, index) => {
    item.rank = index + 1;
  });
  return {
    version: "2026-06-14",
    status: "phase-3-production-queue",
    generated_by: "packages/content/tools/production-queue.mjs",
    totals: {
      missing_packs: items.length,
      pilot_targets: items.filter((item) => item.target_status === "pilot").length,
      review_targets: items.filter((item) => item.target_status === "review").length,
      missing_by_subject: Object.fromEntries(coreSubjects.map((subject) => [subject, items.filter((item) => item.subject === subject).length])),
      missing_by_year: Object.fromEntries((roadmap.years ?? []).map((yearEntry) => [String(yearEntry.year), items.filter((item) => item.year === yearEntry.year).length]))
    },
    next_balanced_batch: chooseBalancedBatch(items),
    queue: items
  };
}

function scoreMissingPack(pack, yearAuthoredCount, subjectAuthoredCount) {
  let score = 100;
  score += pack.target_status === "pilot" ? 40 : 10;
  score += Math.max(0, 5 - pack.priority) * 8;
  if (subjectAuthoredCount === 0) score += 60;
  if (yearAuthoredCount < 2) score += 30;
  if (pack.subject === "Science") score += 10;
  if (pack.subject === "English") score += 6;
  return score;
}

function reasonFor(pack, yearAuthoredCount, subjectAuthoredCount) {
  const reasons = [];
  if (subjectAuthoredCount === 0) reasons.push(`fills missing ${pack.subject} authored coverage for Year ${pack.pack_id.match(/y(\d)/)?.[1] ?? "?"}`);
  if (yearAuthoredCount < 2) reasons.push("keeps year coverage depth balanced");
  if (pack.target_status === "pilot") reasons.push("roadmap marks this as a pilot-ready priority");
  reasons.push(`roadmap priority ${pack.priority}`);
  return reasons.join("; ");
}

function expectedInteractions(pack) {
  if (pack.subject === "Mathematics") return ["manipulative builder", "representation transfer", "retrieval choice", "teach-back"];
  if (pack.subject === "Science") return ["safe simulation", "model sort", "prediction test", "evidence explanation"];
  if (pack.subject === "English") return ["text highlight", "reason builder", "short response", "evidence repair"];
  return ["guided interaction", "checkpoint", "repair", "teach-back"];
}

function expectedAnimation(pack) {
  if (pack.subject === "Science") return "Model/simulation animation with reduced-motion static panels and no misleading scientific visuals.";
  if (pack.subject === "Mathematics") return "Manipulative-first animation that makes the structure visible before symbolic fluency.";
  if (pack.subject === "English") return "Evidence-thread, focus and card-link animations that support reading rather than distract from it.";
  return "Purpose-led animation tied to concept, hint, repair, success and world growth.";
}

function chooseBalancedBatch(items) {
  const selected = [];
  const usedYears = new Set();
  const subjectCounts = new Map();
  for (const item of items) {
    if (selected.length >= 7) break;
    const subjectCount = subjectCounts.get(item.subject) ?? 0;
    if (usedYears.has(item.year) && subjectCount > 0) continue;
    selected.push(item.pack_id);
    usedYears.add(item.year);
    subjectCounts.set(item.subject, subjectCount + 1);
  }
  for (const item of items) {
    if (selected.length >= 7) break;
    if (!selected.includes(item.pack_id)) selected.push(item.pack_id);
  }
  return selected;
}

function validateQueue(queue) {
  const errors = [];
  if (!Number.isInteger(queue.totals.missing_packs) || queue.totals.missing_packs < 0) {
    errors.push("missing_packs total is invalid");
  }
  for (const item of queue.queue) {
    if (!item.pack_id || !Number.isInteger(item.rank) || !Number.isInteger(item.score)) {
      errors.push(`invalid queue item ${item.pack_id ?? "(unknown)"}`);
    }
    if (!coreSubjects.includes(item.subject)) {
      errors.push(`queue item ${item.pack_id} has non-core subject ${item.subject}`);
    }
  }
  return errors;
}

function printQueue(queue) {
  console.log(`production-queue missing=${queue.totals.missing_packs} pilot=${queue.totals.pilot_targets} review=${queue.totals.review_targets}`);
  console.log(`next-balanced-batch ${queue.next_balanced_batch.join(", ")}`);
  for (const item of queue.queue.slice(0, 12)) {
    console.log(`#${item.rank} ${item.pack_id} Year ${item.year} ${item.subject} score=${item.score} ${item.reason}`);
  }
}

function renderHTML(queue) {
  const rows = queue.queue.map((item) => `
    <tr>
      <td>${item.rank}</td>
      <td><code>${escapeHTML(item.pack_id)}</code></td>
      <td>Year ${item.year}</td>
      <td>${escapeHTML(item.subject)}</td>
      <td>${escapeHTML(item.strand)}</td>
      <td>${escapeHTML(item.target_status)}</td>
      <td>${item.score}</td>
      <td>${escapeHTML(item.reason)}</td>
      <td>${item.expected_pack_definition.interactions.map((value) => `<span class="pill">${escapeHTML(value)}</span>`).join("")}</td>
    </tr>`).join("");
  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NexusLearn production queue</title>
  <style>
    :root { color-scheme: light; --ink: #1d1a3e; --muted: rgba(29,26,62,.66); --paper: #fbfaf6; --line: rgba(29,26,62,.14); --teal: #14745f; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--paper); color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.45; }
    main { max-width: 1440px; margin: 0 auto; padding: 32px 20px 56px; }
    header, section { background: #fff; border: 1px solid var(--line); padding: 24px; }
    section { margin-top: 20px; }
    h1 { margin: 0; font-size: clamp(32px, 5vw, 56px); line-height: 1.05; letter-spacing: 0; }
    h2 { margin: 0 0 12px; font-size: 24px; }
    p { margin: 8px 0 0; color: var(--muted); }
    table { width: 100%; border-collapse: collapse; margin-top: 18px; background: #fff; border: 1px solid var(--line); }
    th, td { padding: 12px; border: 1px solid var(--line); text-align: left; vertical-align: top; }
    thead th { background: #f0ece2; }
    code { font-family: "SFMono-Regular", Consolas, monospace; font-size: 12px; }
    .pill { display: inline-block; margin: 0 4px 6px 0; padding: 4px 7px; background: #e9f6f2; color: var(--teal); font-size: 12px; font-weight: 800; }
  </style>
</head>
<body>
<main>
  <header>
    <h1>Next Pack Production Queue</h1>
    <p>Missing packs: ${queue.totals.missing_packs}. Pilot targets: ${queue.totals.pilot_targets}. Review targets: ${queue.totals.review_targets}.</p>
  </header>
  <section>
    <h2>Next Balanced Batch</h2>
    <p>${queue.next_balanced_batch.map((id) => `<code>${escapeHTML(id)}</code>`).join(" ")}</p>
  </section>
  <table>
    <thead>
      <tr>
        <th>Rank</th>
        <th>Pack</th>
        <th>Year</th>
        <th>Subject</th>
        <th>Strand</th>
        <th>Status</th>
        <th>Score</th>
        <th>Reason</th>
        <th>Expected Interactions</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</main>
</body>
</html>
`;
}

function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--out") options.out = args[++i];
  }
  return options;
}

async function readPacks(dir) {
  const files = await findPackFiles(dir);
  const packs = [];
  for (const file of files) packs.push(await readJSON(file));
  return packs;
}

async function findPackFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findPackFiles(fullPath));
    } else if (entry.name.endsWith(".pack.json") || entry.name.endsWith(".pack.sample.json")) {
      const info = await stat(fullPath);
      if (info.isFile()) files.push(fullPath);
    }
  }
  return files;
}

async function readJSON(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new Error(`Could not read JSON ${file}: ${error.message}`);
  }
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function relative(file) {
  return path.relative(repoRoot, file).replaceAll("\\", "/");
}
