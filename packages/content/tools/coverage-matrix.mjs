#!/usr/bin/env node
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const roadmapPath = path.join(repoRoot, "packages/content/roadmaps/y1-y7-core-pack-roadmap.json");
const packRoot = path.join(repoRoot, "packages/content/packs");
const requiredYears = [1, 2, 3, 4, 5, 6, 7];
const coreSubjects = ["Mathematics", "English", "Science"];

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const roadmap = await readJSON(roadmapPath);
  const packs = await readPacks(packRoot);
  const report = buildReport(roadmap, packs);
  printSummary(report);
  if (options.out) {
    const outDir = path.resolve(options.out);
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, "y1-y7-core-coverage.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await writeFile(path.join(outDir, "y1-y7-core-coverage.html"), renderHTML(report), "utf8");
    console.log(`coverage written ${relative(path.join(outDir, "y1-y7-core-coverage.json"))}`);
    console.log(`coverage written ${relative(path.join(outDir, "y1-y7-core-coverage.html"))}`);
  }
  const errors = checkReport(report);
  if (errors.length > 0) {
    for (const error of errors) console.log(`error: ${error}`);
    console.log(`coverage invalid errors=${errors.length}`);
    process.exit(1);
  }
}

function buildReport(roadmap, packs) {
  const packByID = new Map(packs.map((pack) => [pack.pack_id, pack]));
  const authoredPackIDs = new Set(packByID.keys());
  const roadmapPackIDs = new Set();
  const years = [];
  for (const yearEntry of roadmap.years ?? []) {
    const year = yearEntry.year;
    const priorityPacks = yearEntry.priority_packs ?? [];
    for (const pack of priorityPacks) roadmapPackIDs.add(pack.pack_id);
    const subjects = {};
    for (const subject of coreSubjects) {
      const roadmapped = priorityPacks.filter((pack) => pack.subject === subject);
      const authored = roadmapped
        .map((pack) => packByID.get(pack.pack_id))
        .filter(Boolean)
        .map(summarisePack);
      subjects[subject] = {
        roadmapped_count: roadmapped.length,
        authored_count: authored.length,
        roadmapped_packs: roadmapped.map((pack) => ({
          pack_id: pack.pack_id,
          strand: pack.strand,
          target_status: pack.target_status,
          authored: packByID.has(pack.pack_id),
        })),
        authored_packs: authored,
        planned_variants: authored.reduce((total, pack) => total + pack.planned_variants, 0),
      };
    }
    const authoredYearPacks = packs.filter((pack) => pack.source_alignment?.year === year).map(summarisePack);
    years.push({
      year,
      phase: yearEntry.phase,
      roadmapped_pack_count: priorityPacks.length,
      authored_pack_count: authoredYearPacks.length,
      planned_variants: authoredYearPacks.reduce((total, pack) => total + pack.planned_variants, 0),
      subjects,
      authored_packs: authoredYearPacks,
      missing_roadmap_packs: priorityPacks.filter((pack) => !packByID.has(pack.pack_id)).map((pack) => pack.pack_id),
    });
  }

  const unroadmappedAuthoredPacks = packs
    .filter((pack) => !roadmapPackIDs.has(pack.pack_id))
    .map(summarisePack);
  return {
    version: "2026-06-14",
    status: "phase-3-coverage-matrix",
    generated_by: "packages/content/tools/coverage-matrix.mjs",
    totals: {
      years: years.length,
      roadmapped_packs: Array.from(roadmapPackIDs).length,
      authored_packs: authoredPackIDs.size,
      authored_roadmap_packs: packs.filter((pack) => roadmapPackIDs.has(pack.pack_id)).length,
      unroadmapped_authored_packs: unroadmappedAuthoredPacks.length,
      planned_variants: years.reduce((total, year) => total + year.planned_variants, 0),
    },
    years,
    unroadmapped_authored_packs: unroadmappedAuthoredPacks,
  };
}

function summarisePack(pack) {
  const targets = pack.practice?.variant_targets ?? {};
  const blueprints = pack.variant_blueprints ?? [];
  return {
    pack_id: pack.pack_id,
    year: pack.source_alignment?.year,
    subject: pack.source_alignment?.subject,
    strand: pack.source_alignment?.strand,
    topic: pack.source_alignment?.topic,
    status: pack.status,
    sample_variants: pack.question_variants?.length ?? 0,
    pilot_target: targets.pilot ?? 0,
    release_target: targets.release ?? 0,
    mature_target: targets.mature ?? 0,
    planned_variants: blueprints.reduce((total, blueprint) => total + (Number.isInteger(blueprint.count) ? blueprint.count : 0), 0),
    blueprint_count: blueprints.length,
    formats: pack.practice?.formats ?? [],
  };
}

function checkReport(report) {
  const errors = [];
  for (const year of requiredYears) {
    const entry = report.years.find((item) => item.year === year);
    if (!entry) {
      errors.push(`missing Year ${year}`);
      continue;
    }
    if (entry.authored_pack_count < 1) {
      errors.push(`Year ${year} has no authored proof pack`);
    }
    if (entry.planned_variants < 500) {
      errors.push(`Year ${year} planned variants are below 500`);
    }
    for (const subject of coreSubjects) {
      const subjectEntry = entry.subjects[subject];
      if (!subjectEntry || subjectEntry.roadmapped_count < 1) {
        errors.push(`Year ${year} has no roadmapped ${subject} pack`);
      }
    }
  }
  if (report.totals.unroadmapped_authored_packs > 0) {
    errors.push("authored packs must appear in the roadmap");
  }
  return errors;
}

function printSummary(report) {
  console.log(`coverage years=${report.totals.years} roadmapped=${report.totals.roadmapped_packs} authored=${report.totals.authored_packs} planned_variants=${report.totals.planned_variants}`);
  for (const year of report.years) {
    const cells = coreSubjects.map((subject) => {
      const item = year.subjects[subject];
      return `${subject}:${item.authored_count}/${item.roadmapped_count}`;
    }).join(" ");
    console.log(`Year ${year.year} authored=${year.authored_pack_count} planned=${year.planned_variants} ${cells}`);
  }
}

function renderHTML(report) {
  const rows = report.years.map((year) => `
    <tr>
      <th>Year ${year.year}</th>
      <td>${escapeHTML(year.phase)}</td>
      <td>${year.authored_pack_count}</td>
      <td>${year.planned_variants.toLocaleString("en-GB")}</td>
      ${coreSubjects.map((subject) => renderSubjectCell(year.subjects[subject])).join("")}
      <td>${year.missing_roadmap_packs.map((id) => `<code>${escapeHTML(id)}</code>`).join("<br>")}</td>
    </tr>`).join("");
  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NexusLearn Year 1-7 coverage matrix</title>
  <style>
    :root { color-scheme: light; --ink: #1d1a3e; --muted: rgba(29,26,62,.66); --paper: #fbfaf6; --line: rgba(29,26,62,.14); --ready: #14745f; --gap: #965d00; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--paper); color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.45; }
    main { max-width: 1440px; margin: 0 auto; padding: 32px 20px 56px; }
    header { display: grid; gap: 12px; padding: 24px; background: #fff; border: 1px solid var(--line); }
    h1 { margin: 0; font-size: clamp(32px, 5vw, 56px); line-height: 1.05; letter-spacing: 0; }
    p { margin: 0; color: var(--muted); }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; background: #fff; border: 1px solid var(--line); }
    th, td { padding: 12px; border: 1px solid var(--line); text-align: left; vertical-align: top; }
    thead th { background: #f0ece2; }
    tbody th { min-width: 80px; }
    code { font-family: "SFMono-Regular", Consolas, monospace; font-size: 12px; }
    .pill { display: inline-block; margin: 0 4px 6px 0; padding: 4px 7px; background: #e9f6f2; color: var(--ready); font-size: 12px; font-weight: 800; }
    .gap { background: #fff4d8; color: var(--gap); }
    .pack { margin-top: 8px; }
    .muted { color: var(--muted); }
  </style>
</head>
<body>
<main>
  <header>
    <h1>Year 1-7 Core Coverage Matrix</h1>
    <p>Roadmapped packs: ${report.totals.roadmapped_packs}. Authored proof packs: ${report.totals.authored_packs}. Planned mature-bank variants: ${report.totals.planned_variants.toLocaleString("en-GB")}.</p>
  </header>
  <table>
    <thead>
      <tr>
        <th>Year</th>
        <th>Phase</th>
        <th>Authored Packs</th>
        <th>Planned Variants</th>
        ${coreSubjects.map((subject) => `<th>${escapeHTML(subject)}</th>`).join("")}
        <th>Missing Roadmap Packs</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</main>
</body>
</html>
`;
}

function renderSubjectCell(subject) {
  const statusClass = subject.authored_count > 0 ? "pill" : "pill gap";
  const statusText = `${subject.authored_count}/${subject.roadmapped_count} authored`;
  const packs = subject.roadmapped_packs.map((pack) => {
    const klass = pack.authored ? "pill" : "pill gap";
    const label = pack.authored ? "authored" : "planned";
    return `<div class="pack"><code>${escapeHTML(pack.pack_id)}</code><br><span class="${klass}">${label}</span> <span class="muted">${escapeHTML(pack.strand)}</span></div>`;
  }).join("");
  return `<td><span class="${statusClass}">${statusText}</span>${packs}</td>`;
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
