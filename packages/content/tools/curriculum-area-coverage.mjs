#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, "../../..");
const yearSpec = readJSON(path.join(repoRoot, "packages/content/roadmaps/y1-y7-equal-depth-year-spec.json"));
const mapping = readJSON(path.join(repoRoot, "packages/content/roadmaps/curriculum-area-pack-mapping.json"));
const packDir = path.join(repoRoot, "packages/content/packs");
const outDir = path.join(repoRoot, "packages/content/generated/coverage");
const publicDir = path.join(repoRoot, "apps/web/public/content");

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
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

const packFiles = fs.readdirSync(packDir).filter((file) => file.endsWith(".json"));
const packs = packFiles.map((file) => readJSON(path.join(packDir, file)));
const packByID = new Map(packs.map((pack) => [pack.pack_id, pack]));
const reverse = new Map();
const failures = [];

for (const [packID, areas] of Object.entries(mapping.pack_area_mappings ?? {})) {
  const pack = packByID.get(packID);
  if (!pack) {
    failures.push(`${packID}: mapped pack does not exist`);
    continue;
  }
  for (const area of areas) {
    const key = `${pack.source_alignment.year}|${pack.source_alignment.subject}|${area}`;
    const entries = reverse.get(key) ?? [];
    entries.push(packID);
    reverse.set(key, entries);
  }
}

const years = [];
const missingPacks = [];
let totalAreas = 0;
let authoredAreas = 0;

for (const year of yearSpec.years) {
  const subjects = [];
  for (const [subject, areas] of Object.entries(year.curriculum_contract)) {
    const prefix = subject === "English" ? "en" : subject === "Mathematics" ? "ma" : "sc";
    const entries = areas.map((area) => {
      totalAreas += 1;
      const key = `${year.year}|${subject}|${area}`;
      const mappedPacks = reverse.get(key) ?? [];
      const authored = mappedPacks.length > 0;
      if (authored) authoredAreas += 1;
      const proposedPackID = authored ? "" : `${prefix}-y${year.year}-${slug(area)}`;
      if (!authored) {
        missingPacks.push({
          year: year.year,
          subject,
          area,
          proposed_pack_id: proposedPackID,
        });
      }
      return {
        area,
        status: authored ? "authored" : "planned",
        pack_ids: mappedPacks,
        proposed_pack_id: proposedPackID,
      };
    });
    subjects.push({
      subject,
      total_areas: entries.length,
      authored_areas: entries.filter((entry) => entry.status === "authored").length,
      missing_areas: entries.filter((entry) => entry.status === "planned").length,
      areas: entries,
    });
  }
  const yearTotal = subjects.reduce((sum, subject) => sum + subject.total_areas, 0);
  const yearAuthored = subjects.reduce((sum, subject) => sum + subject.authored_areas, 0);
  years.push({
    year: year.year,
    total_areas: yearTotal,
    authored_areas: yearAuthored,
    missing_areas: yearTotal - yearAuthored,
    breadth_percent: Math.round((yearAuthored / yearTotal) * 100),
    subjects,
  });
}

const missingByID = new Map(missingPacks.map((item) => [item.proposed_pack_id, item]));
const nextBalancedWave = (mapping.next_balanced_wave ?? []).map((packID, index) => {
  const item = missingByID.get(packID);
  if (!item) {
    failures.push(`${packID}: next balanced wave item is not a currently missing curriculum area`);
    return { priority: index + 1, proposed_pack_id: packID, invalid: true };
  }
  return { priority: index + 1, ...item };
});

const floor = mapping.policy?.regression_floor ?? {};
if (authoredAreas < (floor.authored_areas ?? 0)) {
  failures.push(`authored curriculum areas regressed below ${floor.authored_areas}`);
}
for (const year of years) {
  for (const subject of year.subjects) {
    if (subject.authored_areas < (floor.minimum_authored_areas_per_year_subject ?? 0)) {
      failures.push(`Year ${year.year} ${subject.subject} regressed below the minimum authored-area floor`);
    }
  }
}

const report = {
  version: 1,
  status: "phase-3-core-area-coverage",
  generated_by: "packages/content/tools/curriculum-area-coverage.mjs",
  policy: mapping.policy,
  totals: {
    years: years.length,
    subjects: years.length * 3,
    contract_areas: totalAreas,
    authored_areas: authoredAreas,
    missing_areas: totalAreas - authoredAreas,
    breadth_percent: Math.round((authoredAreas / totalAreas) * 100),
    authored_packs: packs.length,
    proposed_missing_packs: missingPacks.length,
    failures: failures.length
  },
  years,
  next_balanced_wave: nextBalancedWave,
  missing_pack_queue: missingPacks,
  failures
};

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });
const json = `${JSON.stringify(report, null, 2)}\n`;
fs.writeFileSync(path.join(outDir, "curriculum-area-coverage.json"), json);
fs.writeFileSync(path.join(publicDir, "curriculum-area-coverage.json"), json);

const rows = years.flatMap((year) => year.subjects.map((subject) => `
  <tr>
    <td>Year ${year.year}</td><td>${subject.subject}</td>
    <td>${subject.authored_areas}/${subject.total_areas}</td>
    <td>${subject.areas.filter((area) => area.status === "authored").map((area) => area.area).join(", ") || "none"}</td>
    <td>${subject.areas.filter((area) => area.status === "planned").map((area) => area.area).join(", ") || "none"}</td>
  </tr>`)).join("");
const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>NexusLearn curriculum area coverage</title><style>body{font-family:Inter,system-ui,sans-serif;margin:32px;background:#f6f8ff;color:#17233f}table{width:100%;border-collapse:collapse;background:#fff}th,td{padding:10px;border:1px solid #dbe4ef;vertical-align:top}th{background:#17233f;color:#fff}.truth{padding:18px;background:#fff4d5;border-radius:14px;margin-bottom:20px}</style></head><body><h1>Core curriculum area coverage truth</h1><div class="truth"><strong>${authoredAreas}/${totalAreas} broad English, maths and science areas have an authored proof pack (${report.totals.breadth_percent}%).</strong> This measures breadth only, not pilot or release depth.</div><table><thead><tr><th>Year</th><th>Subject</th><th>Coverage</th><th>Authored</th><th>Missing</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
fs.writeFileSync(path.join(outDir, "curriculum-area-coverage.html"), html);
fs.writeFileSync(path.join(publicDir, "curriculum-area-coverage.html"), html);

console.log(`curriculum-area-coverage areas=${totalAreas} authored=${authoredAreas} missing=${totalAreas - authoredAreas} breadth=${report.totals.breadth_percent}% packs=${packs.length}`);
if (failures.length) {
  failures.forEach((failure) => console.error(`coverage failure ${failure}`));
  process.exit(1);
}
