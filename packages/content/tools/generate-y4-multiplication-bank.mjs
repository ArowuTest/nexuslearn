#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/ma-y4-number-multiplication-12x12.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const generatedPrefix = "ma-y4-number-multiplication-12x12-bank-";

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y4-number-multiplication-12x12") {
  throw new Error("This generator only supports the Year 4 multiplication flagship pack.");
}

const authored = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(generatedPrefix));
const candidates = [
  ...recallCandidates(),
  ...arrayCandidates(),
  ...divisionCandidates(),
];
pack.question_variants = [...authored, ...candidates];
pack.version = "0.2.0";
pack.qa.notes = "Flagship authoring bank now includes deterministic review candidates for mixed recall, array structure and inverse division. Candidates remain non-runtime until curriculum, teacher and accessibility review.";

console.log(`flagship-bank authored=${authored.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`flagship-bank formats=${formatSummary(candidates)}`);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`flagship-bank written ${path.relative(repoRoot, packPath).replaceAll("\\", "/")}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 4 multiplication bank is out of date; run generate-y4-multiplication-bank.mjs --write.");
  console.log("flagship-bank deterministic check passed");
} else {
  console.log("flagship-bank dry-run; pass --write to update the pack");
}

function recallCandidates() {
  const variants = [];
  for (const factor of [6, 7, 8, 9, 12]) {
    for (let multiplier = 2; multiplier <= 12; multiplier += 1) {
      if (factor === 7 && multiplier === 8) continue;
      const product = factor * multiplier;
      const anchor = factor >= 9 ? 10 : 5;
      const remainder = factor - anchor;
      variants.push({
        id: `${generatedPrefix}recall-${factor}x${multiplier}`,
        format: "timed-recall",
        body: {
          prompt: `Power the next forge cell: ${factor} x ${multiplier} = ?`,
          a: factor,
          b: multiplier,
          input: "number",
          response_mode: "untimed_by_default",
          evidence_purpose: "mixed_fact_recall",
          variant_blueprint_id: "core-table-fluency-grid",
          review_batch: "y4-multiplication-pilot-a",
        },
        expected_answer: { value: product },
        hints: [
          `${anchor} x ${multiplier} = ${anchor * multiplier}.`,
          `${remainder > 0 ? `Add ${remainder} more group${remainder === 1 ? "" : "s"} of ${multiplier}.` : `Use the known ${anchor} times table fact.`}`,
        ],
        explanation: `${factor} x ${multiplier} is ${product}. It can be checked from ${anchor} x ${multiplier}${remainder > 0 ? ` by adding ${remainder} more group${remainder === 1 ? "" : "s"} of ${multiplier}` : ""}.`,
        difficulty: recallDifficulty(factor, multiplier),
        status: "review",
        misconception_tag: "nearby_fact_confusion",
        animation_hook: "array-anchor-highlight",
      });
    }
  }
  return variants;
}

function arrayCandidates() {
  const variants = [];
  for (const rows of [6, 7, 8, 9, 12]) {
    for (const columns of [4, 5, 6, 7, 8, 9, 10]) {
      const product = rows * columns;
      const split = rows > 5 ? 5 : Math.max(2, rows - 1);
      variants.push({
        id: `${generatedPrefix}array-${rows}x${columns}`,
        format: "array-build",
        body: {
          prompt: `Build ${rows} equal rows of ${columns}. How many energy cells are there altogether?`,
          a: rows,
          b: columns,
          rows,
          columns,
          input: "number",
          response_mode: "build_then_answer",
          evidence_purpose: "array_structure_and_decomposition",
          variant_blueprint_id: "array-decomposition-builds",
          review_batch: "y4-multiplication-pilot-a",
        },
        expected_answer: { value: product },
        hints: [
          `Build ${split} rows first.`,
          `Then add ${rows - split} more row${rows - split === 1 ? "" : "s"} of ${columns}.`,
        ],
        explanation: `${rows} equal rows of ${columns} contain ${product} cells because ${rows} x ${columns} = ${product}.`,
        difficulty: Math.min(7, 3 + Math.ceil((rows + columns) / 6)),
        status: "review",
        misconception_tag: "counts_every_fact_from_start",
        animation_hook: "array-split-recombine",
      });
    }
  }
  return variants;
}

function divisionCandidates() {
  const variants = [];
  for (const groups of [6, 7, 8, 9, 12]) {
    for (const groupSize of [4, 5, 6, 7, 8, 9, 10]) {
      if (groups === 8 && groupSize === 7) continue;
      const dividend = groups * groupSize;
      variants.push({
        id: `${generatedPrefix}division-${dividend}-by-${groups}`,
        format: "division-match",
        body: {
          prompt: `${dividend} energy cells are shared into ${groups} equal rows. How many cells are in each row?`,
          dividend,
          groups,
          input: "number",
          response_mode: "inverse_fact",
          evidence_purpose: "multiplication_division_connection",
          variant_blueprint_id: "division-family-matches",
          review_batch: "y4-multiplication-pilot-a",
        },
        expected_answer: { value: groupSize },
        hints: [
          `Think: ${groups} times what equals ${dividend}?`,
          `Use the matching multiplication fact ${groups} x ${groupSize} = ${dividend}.`,
        ],
        explanation: `${dividend} divided into ${groups} equal rows gives ${groupSize} in each row because ${groups} x ${groupSize} = ${dividend}.`,
        difficulty: Math.min(8, 5 + Math.ceil((groups + groupSize) / 10)),
        status: "review",
        misconception_tag: "inverse_fact_gap",
        animation_hook: "array-hide-row-count",
      });
    }
  }
  return variants;
}

function recallDifficulty(a, b) {
  const product = a * b;
  if (a === 12 || b === 12 || product >= 90) return 7;
  if ([6, 7, 8, 9].includes(a) && b >= 6) return 6;
  return 5;
}

function formatSummary(variants) {
  const counts = new Map();
  for (const variant of variants) counts.set(variant.format, (counts.get(variant.format) ?? 0) + 1);
  return Array.from(counts.entries()).sort().map(([format, count]) => `${format}:${count}`).join(",");
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
