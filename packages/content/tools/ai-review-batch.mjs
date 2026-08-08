#!/usr/bin/env node
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { calculateRiskTier, canonicalContent, sha256Content } from "./lib/review-evidence.mjs";

const toolPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(toolPath), "../../..");
const defaultPackRoot = path.join(repoRoot, "packages/content/packs");
const defaultOutput = path.join(repoRoot, "packages/content/generated/coverage/ai-review-batch.json");
const defaultRegistry = path.join(repoRoot, "packages/content/roadmaps/interaction-renderer-registry.json");
const requiredLanes = ["ai_curriculum_lead", "ai_send_lead"];
const knownReleaseStates = new Set(["draft", "review", "approved", "published", "live"]);
const openResponseFormats = new Set([
  "free_text", "free-text", "long_text", "long-text", "spoken_response", "spoken-response",
  "constructed_response", "constructed-response", "evidence-explain", "evidence-explanation",
  "investigation-planner", "prediction-observation-explanation", "claim-evidence-explain",
]);

export function buildReviewBatch(packs, options = {}) {
  const rubricRevision = options.rubricRevision ?? "curriculum-send-v1";
  const sourceSetRevision = options.sourceSetRevision ?? "sources-v1";
  const reviewerImplementation = options.reviewerImplementation ?? "nexuslearn-ai-curriculum-send-review-v1";
  const rendererRegistry = options.rendererRegistry ?? { formats: {} };
  const inspectedPacks = [...packs]
    .map((pack) => inspectPack(pack, rendererRegistry))
    .sort((left, right) => left.year_group - right.year_group || left.pack_id.localeCompare(right.pack_id));

  const body = {
    schema_version: 1,
    rubric_revision: rubricRevision,
    source_set_revision: sourceSetRevision,
    reviewer_implementation: reviewerImplementation,
    totals: {
      packs: inspectedPacks.length,
      variants: inspectedPacks.reduce((total, pack) => total + pack.variants.length, 0),
      review_units: inspectedPacks.reduce((total, pack) => total + 1 + pack.variant_families.length + pack.direct_variant_ids.length, 0),
      tier_1: inspectedPacks.reduce((total, pack) => total + pack.variants.filter((variant) => variant.risk_tier === "tier_1").length, 0),
      tier_2: inspectedPacks.reduce((total, pack) => total + pack.variants.filter((variant) => variant.risk_tier === "tier_2").length, 0),
      tier_3: inspectedPacks.reduce((total, pack) => total + pack.variants.filter((variant) => variant.risk_tier === "tier_3").length, 0),
      blocking_findings: inspectedPacks.reduce((total, pack) => total + pack.pack_review.findings.filter((finding) => finding.release_blocking).length + pack.variants.reduce((variantTotal, variant) => variantTotal + variant.findings.filter((finding) => finding.release_blocking).length, 0), 0),
    },
    packs: inspectedPacks,
  };
  const batchHash = sha256Content(body);
  return {
    ...body,
    batch_id: `ai-review-${batchHash.slice(0, 20)}`,
    batch_hash: batchHash,
  };
}

function inspectPack(pack, rendererRegistry) {
  const packID = String(pack.pack_id ?? pack.id ?? pack.objective?.id ?? "").trim();
  const yearGroup = Number(pack.source_alignment?.year ?? pack.objective?.year ?? 0);
  const subject = String(pack.source_alignment?.subject ?? pack.objective?.subject ?? "").trim();
  const contentRevision = String(pack.version ?? "unversioned");
  const packFindings = [];
  if (!packID || !Number.isInteger(yearGroup) || yearGroup < 1 || yearGroup > 7 || !subject || !pack.objective?.id) {
    packFindings.push(finding("missing_curriculum_link", "curriculum_alignment", "blocking", true, ["source_alignment", "objective"], "The pack needs a stable ID, Year 1-7 subject alignment and objective ID."));
  }
  const packMaterial = {
    pack_id: packID,
    version: contentRevision,
    source_alignment: pack.source_alignment ?? {},
    objective: pack.objective ?? {},
    teaching_sequence: pack.teaching_sequence ?? [],
    manipulatives: pack.manipulatives ?? [],
    practice: pack.practice ?? {},
    misconception_repairs: pack.misconception_repairs ?? [],
    adaptive_support: pack.adaptive_support ?? {},
    animation_plan: pack.animation_plan ?? {},
    evidence: pack.evidence ?? {},
    accessibility_policy: pack.accessibility_policy ?? {},
  };
  const packReview = {
    content_id: packID,
    content_type: "pack",
    content_revision: contentRevision,
    content_hash: sha256Content(packMaterial),
    risk_tier: packFindings.some((item) => item.release_blocking) ? "tier_2" : "tier_1",
    findings: packFindings,
  };

  const variants = [...(Array.isArray(pack.question_variants) ? pack.question_variants : [])]
    .sort((left, right) => String(left.id ?? "").localeCompare(String(right.id ?? "")));
  const duplicateSignatures = duplicateVariantSignatures(variants);
  const variantRecords = variants.map((variant) => inspectVariant({
    pack,
    packID,
    yearGroup,
    subject,
    contentRevision,
    variant,
    duplicateSignatures,
    rendererRegistry,
  }));
  const familyGroups = new Map();
  for (const variant of variantRecords.filter((item) => item.risk_tier === "tier_1")) {
    const group = familyGroups.get(variant.family_signature) ?? [];
    group.push(variant);
    familyGroups.set(variant.family_signature, group);
  }
  const variantFamilies = [];
  const directVariantIDs = variantRecords.filter((variant) => variant.risk_tier !== "tier_1").map((variant) => variant.id);
  for (const [familySignature, members] of [...familyGroups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (members.length < 2) {
      directVariantIDs.push(members[0].id);
      continue;
    }
    const ordered = [...members].sort((left, right) => left.id.localeCompare(right.id));
    const familyHash = sha256Content({
      pack_id: packID,
      family_signature: familySignature,
      members: ordered.map((member) => ({ id: member.id, content_hash: member.content_hash })),
    });
    variantFamilies.push({
      content_id: `${packID}::family::${familyHash.slice(0, 20)}`,
      content_type: "variant_family",
      content_revision: contentRevision,
      content_hash: familyHash,
      risk_tier: "tier_1",
      format: ordered[0].format,
      family_signature: familySignature,
      member_ids: ordered.map((member) => member.id),
      boundary_case_ids: boundaryCases(ordered),
    });
  }

  return {
    pack_id: packID,
    year_group: yearGroup,
    subject,
    content_revision: contentRevision,
    required_lanes: [...requiredLanes],
    pack_review: packReview,
    variants: variantRecords,
    variant_families: variantFamilies,
    direct_variant_ids: directVariantIDs.sort(),
  };
}

function inspectVariant({ pack, packID, yearGroup, subject, contentRevision, variant, duplicateSignatures, rendererRegistry }) {
  const id = String(variant.id ?? "").trim();
  const format = String(variant.format ?? "").trim();
  const body = variant.body ?? {};
  const prompt = String(body.prompt ?? "").trim();
  const answerPresent = hasMeaningfulAnswer(variant.expected_answer);
  const answerResolved = answerResolvesAgainstBody(variant);
  const narration = narrationText(variant);
  const narrationRequired = hasKeyValue(variant, "audio_asset_status", "required") || format.toLowerCase().includes("audio") || format.toLowerCase().includes("listen");
  const audioSourceDeclared = Boolean(narration) || hasTruthyKey(variant, /audio_asset_id(s)?$/i);
  const narrationParity = narration ? textParity(prompt, narration) : null;
  const readingLimit = yearGroup <= 2 ? 130 : yearGroup <= 4 ? 180 : 220;
  const responseRoute = hasResponseRoute(variant) || hasResponseRoute(pack.accessibility_policy) || hasResponseRoute(pack.adaptive_support);
  const curriculumLink = Boolean(packID && subject && yearGroup >= 1 && yearGroup <= 7 && pack.objective?.id);
  const rendererRegistered = Boolean(rendererRegistry.formats?.[format] ?? rendererRegistry.formats?.[format.replaceAll("_", "-")]);
  const releaseStateValid = knownReleaseStates.has(String(variant.status ?? ""));
  const signature = variantDuplicateSignature(variant);
  const findings = [];
  if (!id) findings.push(finding("missing_variant_id", "variant_correctness", "blocking", true, ["id"], "Every variant needs a stable identifier."));
  if (!prompt) findings.push(finding("missing_prompt", "variant_prompt_alignment", "blocking", true, ["body.prompt"], "The learner-facing prompt is empty."));
  if (!answerPresent) findings.push(finding("missing_expected_answer", "variant_answer_validity", "blocking", true, ["expected_answer"], "The expected answer is absent or empty."));
  if (answerPresent && answerResolved === false) findings.push(finding("prompt_answer_mismatch", "variant_answer_validity", "blocking", true, ["body", "expected_answer"], "The expected answer cannot be resolved from the supplied response options or deterministic operands."));
  if (duplicateSignatures.has(signature)) findings.push(finding("duplicate_prompt_answer_signature", "surface_variation", "blocking", true, ["body.prompt", "expected_answer", "format"], "Another variant in this pack has the same prompt, answer and format."));
  if (narrationRequired && !audioSourceDeclared) findings.push(finding("required_narration_missing", "narration_text_parity", "blocking", true, ["body.narration_text", "body.audio_script", "body.audio_asset_id"], "This audio-led item has no reviewable narration text or declared produced-audio source."));
  if (narrationParity === false && narration) findings.push(finding("visible_narration_text_mismatch", "narration_text_parity", "observation", false, ["body.prompt", "body.narration_text"], "Visible and narrated instructions need a semantic parity check."));
  if (prompt.length > readingLimit) findings.push(finding("prompt_reading_load", "age_language", "observation", false, ["body.prompt"], `The prompt exceeds the Year ${yearGroup || "?"} deterministic reading-load threshold of ${readingLimit} characters.`));
  if (!responseRoute) findings.push(finding("response_route_metadata_missing", "input_route_access", "blocking", true, ["body.supported_interaction", "accessibility_policy"], "No equivalent response-route metadata was found at variant or pack level."));
  if (!curriculumLink) findings.push(finding("missing_curriculum_link", "curriculum_alignment", "blocking", true, ["source_alignment", "objective"], "The variant cannot inherit a complete curriculum link from its pack."));
  if (!rendererRegistered) findings.push(finding("renderer_not_registered", "variant_correctness", "blocking", true, ["format"], `Format ${format || "(empty)"} is absent from the interaction renderer registry.`));
  if (!releaseStateValid) findings.push(finding("invalid_release_state", "variant_correctness", "blocking", true, ["status"], "The variant release state is not governed."));

  const safetySensitive = hasTruthyKey(variant, /safety|safeguard/i);
  const sendAdaptation = responseRoute || hasTruthyKey(variant, /accessibility|alternative|aac|eye_gaze|switch/i);
  const generatorNovel = !rendererRegistered;
  const narrationDependent = narrationRequired || Boolean(narration);
  const priorFailure = findings.some((item) => item.release_blocking);
  const riskTier = calculateRiskTier({
    format: openResponseFormats.has(format) ? "free_text" : format,
    sendAdaptation,
    safetySensitive,
    generatorNovel,
    narrationDependent,
    priorFailure,
  });
  const material = {
    id,
    format,
    body,
    expected_answer: variant.expected_answer ?? {},
    hints: variant.hints ?? [],
    explanation: variant.explanation ?? "",
    difficulty: variant.difficulty ?? null,
    misconception_tag: variant.misconception_tag ?? "",
    animation_hook: variant.animation_hook ?? "",
    feedback: variant.feedback ?? {},
  };
  const constraints = deterministicConstraints(variant);
  const familySignature = sha256Content({
    pack_id: packID,
    format,
    template: body.variant_blueprint_id ?? body.review_provenance ?? body.review_batch ?? "unclassified",
    expected_answer_shape: valueShape(variant.expected_answer ?? {}),
    deterministic_constraints: constraints,
  });
  return {
    id,
    content_id: id,
    content_type: "variant",
    content_revision: contentRevision,
    content_hash: sha256Content(material),
    pack_id: packID,
    year_group: yearGroup,
    subject,
    format,
    release_state: String(variant.status ?? ""),
    risk_tier: riskTier,
    family_signature: familySignature,
    deterministic_constraint_signature: sha256Content(constraints),
    checks: {
      answer_present: answerPresent,
      answer_resolved: answerResolved,
      duplicate_signature: duplicateSignatures.has(signature),
      visible_narration_parity: narrationParity,
      reading_load_characters: prompt.length,
      reading_load_limit: readingLimit,
      response_route_metadata: responseRoute,
      curriculum_link: curriculumLink,
      renderer_registered: rendererRegistered,
      release_state_valid: releaseStateValid,
    },
    findings,
  };
}

function finding(code, criterionID, severity, releaseBlocking, affectedFields, rationale) {
  return { code, criterion_id: criterionID, severity, release_blocking: releaseBlocking, affected_fields: affectedFields, rationale };
}

function duplicateVariantSignatures(variants) {
  const counts = new Map();
  for (const variant of variants) {
    const signature = variantDuplicateSignature(variant);
    counts.set(signature, (counts.get(signature) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([signature]) => signature));
}

function variantDuplicateSignature(variant) {
  return sha256Content({
    format: variant.format ?? "",
    prompt: normaliseText(variant.body?.prompt),
    expected_answer: variant.expected_answer ?? {},
  });
}

function hasMeaningfulAnswer(answer) {
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) return false;
  return Object.values(answer).some((value) => meaningful(value));
}

function meaningful(value) {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0 && value.some(meaningful);
  if (typeof value === "object") return Object.values(value).some(meaningful);
  return true;
}

function answerResolvesAgainstBody(variant) {
  const body = variant.body ?? {};
  const answer = variant.expected_answer ?? {};
  const expected = answer.value;
  if (Array.isArray(body.choices) && body.choices.length > 0 && expected !== undefined) {
    if (Array.isArray(expected)) {
      const serialised = canonicalContent(expected);
      if (body.choices.some((choice) => canonicalContent(choice) === serialised)) return true;
      const scalarChoices = body.choices.filter((choice) => ["string", "number", "boolean"].includes(typeof choice)).map(String);
      if (expected.every((item) => scalarChoices.includes(String(item)))) return true;
      return null;
    }
    const choices = body.choices.map(String).map((choice) => choice.trim().toLowerCase());
    const direct = String(expected).trim().toLowerCase();
    if (choices.includes(direct)) return true;
    if (answer.unit && choices.includes(`${direct} ${String(answer.unit).trim().toLowerCase()}`)) return true;
    if (answer.calculation && choices.includes(String(answer.calculation).trim().toLowerCase())) return true;
    if (body.chosen_strategy && choices.includes(String(body.chosen_strategy).trim().toLowerCase())) return true;
    if (choices.some((choice) => equivalentClockTime(choice, direct))) return true;
    if (choices.some((choice) => direct.startsWith(`${choice} `) || choice.startsWith(`${direct} `))) return true;
    if (["model-sort", "method-choice", "perimeter-builder"].includes(variant.format)) return null;
    return false;
  }
  const numericExpected = Number(expected);
  const a = Number(body.a);
  const b = Number(body.b);
  if (Number.isFinite(numericExpected) && Number.isFinite(a) && Number.isFinite(b)) {
    if (["array-build", "timed-recall"].includes(variant.format)) return a * b === numericExpected;
    if (variant.format === "division-match" && b !== 0) return a / b === numericExpected;
  }
  return null;
}

function equivalentClockTime(left, right) {
  const parse = (value) => {
    const match = String(value).trim().toLowerCase().match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return null;
    if (match[3]) {
      if (hour < 1 || hour > 12) return null;
      hour %= 12;
      if (match[3] === "pm") hour += 12;
    }
    return hour * 60 + minute;
  };
  const leftMinutes = parse(left);
  const rightMinutes = parse(right);
  return leftMinutes !== null && rightMinutes !== null && leftMinutes === rightMinutes;
}

function narrationText(variant) {
  for (const value of [variant.narration_text, variant.audio_script, variant.body?.narration_text, variant.body?.narration_script, variant.body?.audio_script, variant.body?.spoken_prompt]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function textParity(visible, narration) {
  const left = normaliseText(visible);
  const right = normaliseText(narration);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function normaliseText(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function hasResponseRoute(value) {
  if (!value || typeof value !== "object") return false;
  if (typeof value.supported_interaction === "string" && value.supported_interaction.trim()) return true;
  if (Array.isArray(value.response_modes) && value.response_modes.length > 0) return true;
  if (Array.isArray(value.input_routes) && value.input_routes.length > 0) return true;
  for (const [key, child] of Object.entries(value)) {
    if (/response.*route|interaction_route|equivalent_response|accessible_response|response_mode/i.test(key) && meaningful(child)) return true;
    if (typeof child === "object" && hasResponseRoute(child)) return true;
  }
  return false;
}

function hasKeyValue(value, targetKey, targetValue) {
  if (!value || typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value)) {
    if (key === targetKey && child === targetValue) return true;
    if (typeof child === "object" && hasKeyValue(child, targetKey, targetValue)) return true;
  }
  return false;
}

function hasTruthyKey(value, pattern) {
  if (!value || typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value)) {
    if (pattern.test(key) && child !== false && child !== null && child !== "" && (!Array.isArray(child) || child.length > 0)) return true;
    if (typeof child === "object" && hasTruthyKey(child, pattern)) return true;
  }
  return false;
}

function deterministicConstraints(value, prefix = "", result = {}) {
  if (!value || typeof value !== "object") return result;
  for (const key of Object.keys(value).sort()) {
    const child = value[key];
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    if (/contract|constraint|invariant|response_modes|input_routes|supported_interaction|timed|precision|safety|audio_asset_status|ssp_programme_mapping/i.test(key)) {
      result[fieldPath] = child;
    } else if (child && typeof child === "object") {
      deterministicConstraints(child, fieldPath, result);
    }
  }
  return result;
}

function valueShape(value) {
  if (Array.isArray(value)) return { type: "array", length: value.length, items: [...new Set(value.map((item) => JSON.stringify(valueShape(item))))].sort().map(JSON.parse) };
  if (value && typeof value === "object") return { type: "object", fields: Object.keys(value).sort().map((key) => ({ key, shape: valueShape(value[key]) })) };
  return { type: value === null ? "null" : typeof value };
}

function boundaryCases(members) {
  const byLength = [...members].sort((left, right) => left.checks.reading_load_characters - right.checks.reading_load_characters || left.id.localeCompare(right.id));
  return [...new Set([members[0].id, members.at(-1).id, byLength.at(-1).id])].sort();
}

async function readPacks(packRoot) {
  const files = (await readdir(packRoot)).filter((file) => file.endsWith(".pack.sample.json")).sort();
  return Promise.all(files.map(async (file) => JSON.parse(await readFile(path.join(packRoot, file), "utf8"))));
}

async function main() {
  const output = path.resolve(argument("--out") ?? defaultOutput);
  const packRoot = path.resolve(argument("--packs") ?? defaultPackRoot);
  const [packs, rendererRegistry] = await Promise.all([
    readPacks(packRoot),
    readFile(defaultRegistry, "utf8").then(JSON.parse),
  ]);
  const batch = buildReviewBatch(packs, { rendererRegistry });
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(batch, null, 2)}\n`, "utf8");
  console.log(`ai-review-batch packs=${batch.totals.packs} variants=${batch.totals.variants} units=${batch.totals.review_units} tiers=${batch.totals.tier_1}/${batch.totals.tier_2}/${batch.totals.tier_3} blockers=${batch.totals.blocking_findings}`);
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(toolPath)) {
  await main();
}
