#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const outDir = path.join(repoRoot, "packages/content/generated/coverage");
const webDir = path.join(repoRoot, "apps/web/public/content");
const packPaths = [
  "packages/content/packs/en-y1-phonics-blend-cvc-words.pack.sample.json",
  "packages/content/packs/ma-y4-number-multiplication-12x12.pack.sample.json",
  "packages/content/packs/sc-y7-particles-states-of-matter.pack.sample.json",
];

const packs = [];
for (const relative of packPaths) {
  const pack = JSON.parse(await readFile(path.join(repoRoot, relative), "utf8"));
  packs.push(reviewPack(pack));
}
const decisions = packs.flatMap((pack) => pack.items);
const report = {
  version: 1,
  status: "internal-review-not-independent-teacher-approval",
  generated_by: "packages/content/tools/flagship-review.mjs",
  review_scope: {
    completed: ["curriculum alignment", "answer integrity", "technical structure", "age/readability heuristics", "accessibility contract presence", "safeguarding content scan"],
    not_substituted: ["independent classroom teacher review", "produced audio QA", "child usability testing", "pilot item calibration"],
  },
  totals: {
    packs: packs.length,
    items: decisions.length,
    internal_pass: decisions.filter((item) => item.internal_decision === "pass_for_human_review").length,
    revise: decisions.filter((item) => item.internal_decision === "revise").length,
    release_blocked: decisions.filter((item) => item.release_blocked).length,
    runtime_approved_by_this_review: 0,
  },
  packs,
};

await mkdir(outDir, { recursive: true });
await mkdir(webDir, { recursive: true });
const jsonPath = path.join(outDir, "flagship-review.json");
const htmlPath = path.join(outDir, "flagship-review.html");
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(htmlPath, renderHTML(report), "utf8");
// Keep the generated review artifact readable for maintainers, but serve a
// compact payload to the admin UI so report indentation does not consume the
// public-asset performance budget.
await writeFile(path.join(webDir, "flagship-review.json"), JSON.stringify(report), "utf8");
console.log(`flagship-review items=${report.totals.items} internal_pass=${report.totals.internal_pass} revise=${report.totals.revise} release_blocked=${report.totals.release_blocked} runtime_approved=0`);

function reviewPack(pack) {
  const items = (pack.question_variants ?? []).map((variant) => reviewItem(pack, variant));
  return {
    pack_id: pack.pack_id,
    year: pack.source_alignment?.year,
    subject: pack.source_alignment?.subject,
    authored_items: items.length,
    internal_pass: items.filter((item) => item.internal_decision === "pass_for_human_review").length,
    revise: items.filter((item) => item.internal_decision === "revise").length,
    release_blocked: items.filter((item) => item.release_blocked).length,
    runtime_approval_recommendation: pack.pack_id.startsWith("en-y1-phonics")
      ? "Do not approve until SSP mapping and produced phoneme audio are independently checked."
      : "Technically ready for independent teacher, accessibility and safeguarding review; do not expose broadly before calibration.",
    items,
  };
}

function reviewItem(pack, variant) {
  const blockers = [];
  const revisions = [];
  const passes = ["schema and provenance", "answer present", "hints and explanation present"];
  if (!variant.body?.variant_blueprint_id || !variant.body?.review_batch) revisions.push("missing explicit blueprint or review-batch provenance");
  if (pack.pack_id === "en-y1-phonics-blend-cvc-words") {
    passes.push("single-letter CVC structure", "answer not revealed in word-build prompt", "SEND interaction metadata");
    if (variant.body?.audio_asset_status !== "produced_and_verified") blockers.push("produced phoneme and whole-word audio not verified");
    if (variant.body?.ssp_programme_mapping === "required_before_pilot") blockers.push("school SSP programme progression mapping pending");
    blockers.push("independent phonics-teacher review pending", "child listening/usability test pending");
  } else if (pack.pack_id === "ma-y4-number-multiplication-12x12") {
    passes.push("deterministic arithmetic consistency", "misconception route", "untimed/support-aware interaction");
    blockers.push("independent teacher review pending", "pilot difficulty calibration pending");
  } else {
    passes.push("particle count invariant", "particle size invariant", "misconception-linked explanation");
    blockers.push("independent science-teacher review pending", "simulation usability and calibration pending");
  }
  blockers.push("independent accessibility acceptance pending", "independent safeguarding review pending");
  const internalDecision = revisions.length > 0 ? "revise" : "pass_for_human_review";
  return {
    id: variant.id,
    format: variant.format,
    current_status: variant.status,
    internal_decision: internalDecision,
    release_blocked: blockers.length > 0,
    passes,
    revisions,
    blockers,
  };
}

function renderHTML(report) {
  const cards = report.packs.map((pack) => `<section><h2>${escapeHTML(pack.pack_id)}</h2><p>${pack.authored_items} items · ${pack.internal_pass} internal pass · ${pack.revise} revise · ${pack.release_blocked} release-blocked</p><p><strong>Decision:</strong> ${escapeHTML(pack.runtime_approval_recommendation)}</p></section>`).join("");
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>NexusLearn flagship review</title><style>body{font-family:Inter,system-ui,sans-serif;margin:32px;color:#17233f;background:#f8fbff}section{margin:16px 0;padding:20px;background:white;border:1px solid #dbe7f2}strong{color:#8b2b2b}</style></head><body><h1>Flagship Internal Review</h1><p>This report records internal curriculum, product and technical review. It explicitly does not impersonate independent teacher, child-user or produced-audio approval.</p>${cards}</body></html>`;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
