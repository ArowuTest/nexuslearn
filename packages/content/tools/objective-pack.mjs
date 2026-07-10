#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const sourceMapPath = path.join(repoRoot, "packages/content/research/uk-y1-y7-curriculum-source-map.json");
const narrationManifestPath = path.join(repoRoot, "packages/content/audio/narration-manifest.json");
const runtimeSpineOverlayPath = path.join(repoRoot, "packages/content/generated/coverage/runtime-spine-overlays.json");
const narrationItems = existsSync(narrationManifestPath)
  ? JSON.parse(readFileSync(narrationManifestPath, "utf8")).items ?? []
  : [];
const narrationByID = new Map(narrationItems.map((item) => [item.id, item]));
const runtimeSpineOverlays = existsSync(runtimeSpineOverlayPath)
  ? JSON.parse(readFileSync(runtimeSpineOverlayPath, "utf8")).overlays ?? {}
  : {};

const runtimeStatuses = new Set(["approved", "published", "live"]);
const packStatuses = new Set(["draft", "review", "pilot", "approved", "published", "archived"]);
const reviewCompleteStatuses = new Set(["complete", "approved", "passed"]);
const promotedPackStatuses = new Set(["pilot", "approved", "published"]);
const minimumVariantTargets = {
  pilot: 150,
  release: 300,
  mature: 500,
};
const requiredTopLevel = [
  "pack_id",
  "version",
  "status",
  "source_alignment",
  "objective",
  "teaching_sequence",
  "manipulatives",
  "practice",
  "question_variants",
  "misconception_repairs",
  "adaptive_support",
  "animation_plan",
  "evidence",
  "qa",
];

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }
  if (!["validate", "compile", "bundle", "preview", "diff", "publish", "rollback"].includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }
  const options = parseArgs(args);
  if (command === "rollback") {
    await rollbackVersion(options);
    return;
  }
  const files = await expandPackInputs(options);
  if (files.length === 0) {
    throw new Error("Provide at least one objective pack JSON file, folder, or --all.");
  }

  const sourceMap = await readJSON(sourceMapPath);
  const sourceIDs = new Set((sourceMap.sources ?? []).map((source) => source.source_id));
  const results = [];
  const releasePayloads = [];
  const liveConfig = command === "diff" ? await fetchLiveAdminConfig(options) : null;
  for (const file of files) {
    const packPath = path.resolve(file);
    const pack = await readJSON(packPath);
    const result = validatePack(pack, sourceIDs, packPath);
    results.push(result);
    printValidation(result);
    if (result.errors.length > 0) {
      continue;
    }
    if (command === "compile" || command === "bundle" || command === "preview" || command === "diff" || command === "publish") {
      const payload = compilePack(pack);
      if (command === "bundle") {
        releasePayloads.push(payload);
      } else if (command === "compile") {
        const outDir = path.resolve(options.out ?? "packages/content/generated");
        await mkdir(outDir, { recursive: true });
        const outPath = path.join(outDir, `${pack.pack_id}.admin-payload.json`);
        await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
        console.log(`compiled ${relative(outPath)}`);
      } else if (command === "preview") {
        const outDir = path.resolve(options.out ?? "packages/content/generated/previews");
        await mkdir(outDir, { recursive: true });
        const outPath = path.join(outDir, `${pack.pack_id}.preview.html`);
        await writeFile(outPath, renderPreviewHTML(pack, payload, result), "utf8");
        console.log(`preview ${relative(outPath)}`);
      } else if (command === "diff") {
        printDiff(payload, liveConfig);
      } else {
        if (isSamplePack(packPath) && !options.allowSample) {
          throw new Error(`Refusing to publish sample pack ${relative(packPath)}. Rename it or pass --allow-sample explicitly.`);
        }
        await publishPayload(payload, options);
      }
    }
  }

  const errorCount = results.reduce((total, result) => total + result.errors.length, 0);
  const warningCount = results.reduce((total, result) => total + result.warnings.length, 0);
  console.log(`summary packs=${results.length} errors=${errorCount} warnings=${warningCount}`);
  const promotedWarningCount = results
    .filter((result) => result.promoted)
    .reduce((total, result) => total + result.warnings.length, 0);
  if (command === "bundle" && errorCount === 0) {
    await writeReleaseBundle(releasePayloads, options);
  }
  if (errorCount > 0 || (options.strict && warningCount > 0) || (options.strictPromoted && promotedWarningCount > 0)) {
    process.exitCode = 1;
  }
}

function validatePack(pack, sourceIDs, packPath) {
  const errors = [];
  const warnings = [];
  for (const key of requiredTopLevel) {
    if (pack[key] === undefined || pack[key] === null) {
      errors.push(`missing top-level field: ${key}`);
    }
  }
  if (!packStatuses.has(pack.status)) {
    errors.push(`status must be one of ${Array.from(packStatuses).join(", ")}`);
  }
  if (pack.pack_id && pack.objective?.id && pack.pack_id !== pack.objective.id) {
    warnings.push("pack_id and objective.id differ; generated admin payload will use objective.id for runtime links");
  }
  const sourceAlignment = pack.source_alignment ?? {};
  if (!Number.isInteger(sourceAlignment.year) || sourceAlignment.year < 1 || sourceAlignment.year > 7) {
    errors.push("source_alignment.year must be between 1 and 7");
  }
  if (!Array.isArray(sourceAlignment.source_ids) || sourceAlignment.source_ids.length === 0) {
    errors.push("source_alignment.source_ids must include at least one source");
  } else {
    for (const sourceID of sourceAlignment.source_ids) {
      if (!sourceIDs.has(sourceID)) {
        errors.push(`unknown source_id: ${sourceID}`);
      }
    }
  }

  const objective = pack.objective ?? {};
  requireText(objective.id, "objective.id", errors);
  requireText(objective.statement, "objective.statement", errors);
  requireArray(objective.prerequisites, "objective.prerequisites", errors);
  requireArray(objective.misconceptions, "objective.misconceptions", errors, 2);
  if (!objective.mastery || typeof objective.mastery !== "object") {
    errors.push("objective.mastery is required");
  } else {
    const mastery = objective.mastery;
    if (!Number.isInteger(mastery.expected) || mastery.expected < 1 || mastery.expected > 100) errors.push("objective.mastery.expected must be 1-100");
    if (!Number.isInteger(mastery.secure) || mastery.secure < mastery.expected || mastery.secure > 100) errors.push("objective.mastery.secure must be >= expected and <= 100");
    requireArray(mastery.retention_days, "objective.mastery.retention_days", errors, 1);
    requireArray(mastery.required_formats, "objective.mastery.required_formats", errors, 1);
  }

  requireArray(pack.teaching_sequence, "teaching_sequence", errors, 5);
  requireArray(pack.manipulatives, "manipulatives", errors, 1);
  requireArray(pack.misconception_repairs, "misconception_repairs", errors, 2);
  requireArray(pack.question_variants, "question_variants", errors, 1);

  const lessonKinds = new Set((pack.teaching_sequence ?? []).map((step) => step.kind));
  for (const kind of ["concept_launch", "worked_example", "guided_practice", "checkpoint", "teach_back"]) {
    if (!lessonKinds.has(kind)) warnings.push(`teaching_sequence is missing recommended step kind: ${kind}`);
  }
  const formats = new Set(pack.practice?.formats ?? []);
  const variantFormats = new Set((pack.question_variants ?? []).map((variant) => variant.format));
  const variantTargets = pack.practice?.variant_targets ?? {};
  for (const [target, minimum] of Object.entries(minimumVariantTargets)) {
    if (variantTargets[target] !== undefined && (!Number.isInteger(variantTargets[target]) || variantTargets[target] < minimum)) {
      errors.push(`practice.variant_targets.${target} must be at least ${minimum}`);
    }
  }
  if (Number.isInteger(variantTargets.mature) && Number.isInteger(variantTargets.pilot) && variantTargets.mature < variantTargets.pilot) {
    errors.push("practice.variant_targets.mature must be greater than or equal to pilot");
  }
  if (Number.isInteger(variantTargets.release) && Number.isInteger(variantTargets.pilot) && variantTargets.release < variantTargets.pilot) {
    errors.push("practice.variant_targets.release must be greater than or equal to pilot");
  }
  for (const requiredFormat of objective.mastery?.required_formats ?? []) {
    if (!formats.has(requiredFormat) && !variantFormats.has(requiredFormat)) {
      errors.push(`required format has no practice or variant coverage: ${requiredFormat}`);
    }
  }
  for (const variant of pack.question_variants ?? []) {
    requireText(variant.id, "question_variants[].id", errors);
    requireText(variant.format, `question ${variant.id || "(unknown)"} format`, errors);
    if (!variant.body || typeof variant.body !== "object" || Array.isArray(variant.body)) errors.push(`question ${variant.id || "(unknown)"} body must be an object`);
    if (!variant.expected_answer || typeof variant.expected_answer !== "object" || Array.isArray(variant.expected_answer)) errors.push(`question ${variant.id || "(unknown)"} expected_answer must be an object`);
    requireArray(variant.hints, `question ${variant.id || "(unknown)"} hints`, errors, 1);
    requireText(variant.explanation, `question ${variant.id || "(unknown)"} explanation`, errors);
    if (!Number.isInteger(variant.difficulty) || variant.difficulty < 1 || variant.difficulty > 10) errors.push(`question ${variant.id || "(unknown)"} difficulty must be 1-10`);
    if (!["draft", "review", "approved", "published", "live", "archived"].includes(variant.status)) errors.push(`question ${variant.id || "(unknown)"} has invalid status`);
  }

  const approvedVariantCount = (pack.question_variants ?? []).filter((variant) => runtimeStatuses.has(variant.status)).length;
  if ((pack.status === "pilot" || pack.status === "approved" || pack.status === "published") && approvedVariantCount < 3) {
    errors.push("pilot/approved/published packs need at least 3 runtime-approved question variants");
  }
  if ((pack.question_variants ?? []).length < (pack.practice?.variant_targets?.pilot ?? 0)) {
    warnings.push(`question_variants count is below pilot target (${(pack.question_variants ?? []).length}/${pack.practice?.variant_targets?.pilot ?? 0})`);
  }
  validateVariantBlueprints(pack, formats, warnings);
  for (const key of ["intro", "concept", "thinking", "hint", "repair", "success", "mastery", "world_growth", "reduced_motion_fallback"]) {
    requireText(pack.animation_plan?.[key], `animation_plan.${key}`, errors);
  }
  for (const key of ["low_sensory", "reduced_motion", "audio_first", "reading_support", "attention_support", "confidence_support"]) {
    requireText(pack.adaptive_support?.[key], `adaptive_support.${key}`, errors);
  }
  validateQAReadiness(pack, errors, warnings);

  return {
    file: packPath,
    packID: pack.pack_id ?? "(unknown)",
    promoted: promotedPackStatuses.has(pack.status),
    errors,
    warnings,
  };
}

function validateQAReadiness(pack, errors, warnings) {
  const qa = pack.qa ?? {};
  for (const key of ["curriculum_review", "teacher_review", "accessibility_review", "safeguarding_review", "readiness_status"]) {
    requireText(qa[key], `qa.${key}`, errors);
  }

  const reviews = ["curriculum_review", "teacher_review", "accessibility_review", "safeguarding_review"];
  const incompleteReviews = reviews.filter((key) => !reviewCompleteStatuses.has(String(qa[key] ?? "").toLowerCase()));
  const actualVariants = Array.isArray(pack.question_variants) ? pack.question_variants.length : 0;
  const pilotTarget = pack.practice?.variant_targets?.pilot ?? minimumVariantTargets.pilot;
  const qaClaimsPilot = ["pilot", "approved", "published", "release", "live"].includes(String(qa.readiness_status ?? "").toLowerCase());

  if (qaClaimsPilot && !promotedPackStatuses.has(pack.status)) {
    warnings.push(`qa.readiness_status claims ${qa.readiness_status} while pack status is ${pack.status}; this is a target, not current readiness`);
  }
  if (promotedPackStatuses.has(pack.status)) {
    if (incompleteReviews.length > 0) {
      errors.push(`promoted packs require completed human review: ${incompleteReviews.join(", ")}`);
    }
    if (actualVariants < pilotTarget) {
      errors.push(`promoted packs require actual reviewed question volume (${actualVariants}/${pilotTarget})`);
    }
    if (!qaClaimsPilot) {
      errors.push("promoted packs require qa.readiness_status of pilot or later");
    }
  }
}

function validateVariantBlueprints(pack, formats, warnings) {
  const blueprints = pack.variant_blueprints ?? [];
  if (!Array.isArray(blueprints) || blueprints.length === 0) {
    warnings.push("variant_blueprints are missing; large-scale production should not rely on hand-written variants only");
    return;
  }
  let plannedCount = 0;
  const blueprintFormats = new Set();
  for (const blueprint of blueprints) {
    if (!Number.isInteger(blueprint.count) || blueprint.count < 1) {
      warnings.push(`variant blueprint ${blueprint.id ?? "(unknown)"} has invalid count`);
      continue;
    }
    plannedCount += blueprint.count;
    if (blueprint.format) blueprintFormats.add(blueprint.format);
    if (blueprint.format && !formats.has(blueprint.format)) {
      warnings.push(`variant blueprint ${blueprint.id ?? "(unknown)"} uses format not listed in practice.formats: ${blueprint.format}`);
    }
    if (!blueprint.purpose || !blueprint.source) {
      warnings.push(`variant blueprint ${blueprint.id ?? "(unknown)"} should include purpose and source`);
    }
  }
  const matureTarget = pack.practice?.variant_targets?.mature ?? 0;
  if (plannedCount < matureTarget) {
    warnings.push(`variant_blueprints planned count is below mature target (${plannedCount}/${matureTarget})`);
  }
  for (const requiredFormat of pack.objective?.mastery?.required_formats ?? []) {
    if (!blueprintFormats.has(requiredFormat)) {
      warnings.push(`variant_blueprints missing required format: ${requiredFormat}`);
    }
  }
}

function compilePack(pack) {
  const objective = pack.objective;
  const source = pack.source_alignment;
  const questionVariants = [...pack.question_variants, ...(runtimeSpineOverlays[pack.pack_id] ?? [])];
  const activityID = `act-${objective.id}`;
  const activityStatus = runtimeStatusFromPack(pack.status);
  const primaryManipulative = pack.manipulatives[0];
  const primaryFormat = pack.practice.formats[0] ?? primaryManipulative.type;
  const teachingSequence = pack.teaching_sequence.map((step) => ({
    ...step,
    audio_url: narrationURL(pack.pack_id, "lesson", step.step_id) || step.audio_url,
  }));
  const vocabulary = (objective.vocabulary ?? []).map((entry) => ({
    ...entry,
    audio_url: narrationURL(pack.pack_id, "vocabulary", entry.term) || entry.audio_url,
  }));
  const objectivePayload = {
    id: objective.id,
    year: source.year,
    subject: source.subject,
    strand: source.strand ?? "",
    topic: source.topic ?? "",
    statement: objective.statement,
    prerequisites: objective.prerequisites,
    misconceptions: objective.misconceptions,
    mastery: {
      expected: objective.mastery.expected,
      secure: objective.mastery.secure,
      retention_days: objective.mastery.retention_days,
      required_formats: objective.mastery.required_formats,
    },
    parent_explanation: pack.evidence.parent_summary,
    teacher_evidence: pack.evidence.teacher_evidence,
  };
  const activityPayload = {
    id: activityID,
    objective_id: objective.id,
    template_id: primaryManipulative.type,
    world_key: worldKeyForYear(source.year),
    title: objective.child_goal,
    prompt: firstStepPrompt(pack),
    difficulty: medianDifficulty(questionVariants),
    interaction: {
      type: primaryFormat,
      pack_id: pack.pack_id,
      source_ids: source.source_ids,
      teaching_sequence: teachingSequence,
      vocabulary,
      manipulative: primaryManipulative,
      adaptive_support: pack.adaptive_support,
      practice_formats: pack.practice.formats,
      variant_targets: pack.practice.variant_targets,
      variant_blueprints: pack.variant_blueprints ?? [],
      misconception_repairs: pack.misconception_repairs,
    },
    feedback: {
      selection_reason: `Selected from objective pack ${pack.pack_id} (${pack.version}).`,
      companion_prompt: teachBackPrompt(pack),
      parent_summary: pack.evidence.parent_summary,
      teacher_evidence: pack.evidence.teacher_evidence,
      next_actions: pack.evidence.next_actions,
    },
    animation_hooks: pack.animation_plan,
    status: activityStatus,
  };
  const questionPayloads = questionVariants.map((variant) => ({
    id: variant.id,
    activity_id: activityID,
    objective_id: objective.id,
    format: variant.format,
    body: {
      ...variant.body,
      pack_id: pack.pack_id,
      animation_hook: variant.animation_hook ?? "",
      misconception_tag: variant.misconception_tag ?? "",
    },
    expected_answer: variant.expected_answer,
    hints: variant.hints,
    explanation: variant.explanation,
    difficulty: variant.difficulty,
    status: variant.status,
  }));
  const rewardRulePayload = {
    id: `reward-${objective.id}-mastery`,
    world_key: activityPayload.world_key,
    objective_id: objective.id,
    trigger: "attempt.correct",
    reward_payload: {
      reward_hook: pack.animation_plan.world_growth,
      animation_hook: pack.animation_plan.success,
      feedback: "Progress added to your world.",
      explanation: pack.evidence.parent_summary,
      evidence_event: "objective_pack_attempt_correct",
      companion_prompt: teachBackPrompt(pack),
    },
    enabled: true,
  };
  return {
    pack_id: pack.pack_id,
    version: pack.version,
    generated_by: "packages/content/tools/objective-pack.mjs",
    objective: objectivePayload,
    activities: [activityPayload],
    questions: questionPayloads,
    reward_rules: [rewardRulePayload],
    readiness_seed: {
      expected_status: pack.qa.readiness_status,
      source_ids: source.source_ids,
      variant_count: questionPayloads.length,
      runtime_variant_count: questionPayloads.filter((question) => runtimeStatuses.has(question.status)).length,
      planned_variant_count: (pack.variant_blueprints ?? []).reduce((total, blueprint) => total + (Number.isInteger(blueprint.count) ? blueprint.count : 0), 0),
      formats: Array.from(new Set(questionPayloads.map((question) => question.format))).sort(),
    },
  };
}

function narrationURL(packID, kind, sourceID) {
  const id = `${packID}--${kind}--${slug(sourceID)}`;
  const item = narrationByID.get(id);
  return item?.technical_pass ? item.file : "";
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

async function publishPayload(payload, options) {
  const api = options.api ?? process.env.NEXUSLEARN_API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  const auth = adminAuth(options);
  if (!api) throw new Error("publish requires --api or NEXUSLEARN_API_URL");
  if (!auth) throw new Error("publish requires --token/NEXUSLEARN_ADMIN_TOKEN or --admin-key/ADMIN_API_KEY");
  await putJSON(api, `/v1/admin/curriculum/objectives/${payload.objective.id}`, auth, payload.objective);
  console.log(`published objective ${payload.objective.id}`);
  for (const activity of payload.activities) {
    await putJSON(api, `/v1/admin/content/activities/${activity.id}`, auth, activity);
    console.log(`published activity ${activity.id}`);
  }
  for (const question of payload.questions) {
    await putJSON(api, `/v1/admin/content/questions/${question.id}`, auth, question);
    console.log(`published question ${question.id}`);
  }
  for (const rule of payload.reward_rules) {
    await putJSON(api, `/v1/admin/reward-rules/${rule.id}`, auth, rule);
    console.log(`published reward rule ${rule.id}`);
  }
}

async function fetchLiveAdminConfig(options) {
  const api = options.api ?? process.env.NEXUSLEARN_API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  const auth = adminAuth(options);
  if (!api) throw new Error("diff requires --api or NEXUSLEARN_API_URL");
  if (!auth) throw new Error("diff requires --token/NEXUSLEARN_ADMIN_TOKEN or --admin-key/ADMIN_API_KEY");
  const baseURL = api.replace(/\/$/, "");
  const res = await fetch(`${baseURL}/v1/admin/config`, {
    headers: auth,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET /v1/admin/config failed ${res.status}: ${text}`);
  }
  const config = await res.json();
  const objectiveRes = await fetch(`${baseURL}/v1/curriculum/objectives`);
  if (!objectiveRes.ok) {
    const text = await objectiveRes.text();
    throw new Error(`GET /v1/curriculum/objectives failed ${objectiveRes.status}: ${text}`);
  }
  const objectiveBody = await objectiveRes.json();
  return {
    ...config,
    objectives: objectiveBody.objectives ?? [],
  };
}

function printDiff(payload, liveConfig) {
  const checks = [
    ["objective", payload.objective, liveConfig.objectives ?? [], "id"],
    ["activity", payload.activities[0], liveConfig.activities ?? [], "id"],
    ...payload.questions.map((question) => ["question", question, liveConfig.questions ?? [], "id"]),
    ...payload.reward_rules.map((rule) => ["reward_rule", rule, liveConfig.reward_rules ?? [], "id"]),
  ];
  const totals = { create: 0, update: 0, unchanged: 0 };
  for (const [type, next, currentItems, idKey] of checks) {
    const current = currentItems.find((item) => item[idKey] === next[idKey]);
    const state = diffState(next, current);
    totals[state] += 1;
    console.log(`diff ${state} ${type} ${next[idKey]}`);
    if (state === "update") {
      const fields = changedFields(next, current);
      const shown = fields.slice(0, 8);
      for (const field of shown) {
        console.log(`  field ${field}`);
      }
      if (fields.length > shown.length) {
        console.log(`  ... ${fields.length - shown.length} more field changes`);
      }
    }
  }
  console.log(`diff-summary create=${totals.create} update=${totals.update} unchanged=${totals.unchanged}`);
}

function diffState(next, current) {
  if (!current) return "create";
  return sameProjectedFields(next, current) ? "unchanged" : "update";
}

function sameProjectedFields(next, current) {
  for (const key of Object.keys(next)) {
    const nextValue = next[key];
    const currentValue = current[key];
    if (Array.isArray(nextValue)) {
      if (stableStringify(nextValue) !== stableStringify(currentValue ?? [])) return false;
    } else if (nextValue && typeof nextValue === "object") {
      if (stableStringify(nextValue) !== stableStringify(currentValue ?? {})) return false;
    } else if (nextValue !== currentValue) {
      return false;
    }
  }
  return true;
}

function changedFields(next, current, prefix = "") {
  const fields = [];
  const keys = new Set([...Object.keys(next ?? {}), ...Object.keys(current ?? {})]);
  for (const key of keys) {
    const name = prefix ? `${prefix}.${key}` : key;
    const nextValue = next[key];
    const currentValue = current?.[key];
    if (Array.isArray(nextValue)) {
      if (stableStringify(nextValue) !== stableStringify(currentValue ?? [])) fields.push(name);
    } else if (nextValue && typeof nextValue === "object") {
      if (!currentValue || typeof currentValue !== "object" || Array.isArray(currentValue)) {
        fields.push(name);
      } else {
        const nested = changedFields(nextValue, currentValue, name);
        fields.push(...nested);
      }
    } else if (nextValue !== currentValue) {
      fields.push(name);
    }
  }
  return fields;
}

async function putJSON(api, route, auth, body) {
  const res = await fetch(`${api.replace(/\/$/, "")}${route}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...auth,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PUT ${route} failed ${res.status}: ${text}`);
  }
}

async function rollbackVersion(options) {
  const api = options.api ?? process.env.NEXUSLEARN_API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  const auth = adminAuth(options);
  const versionID = options.versionId;
  if (!api) throw new Error("rollback requires --api or NEXUSLEARN_API_URL");
  if (!auth) throw new Error("rollback requires --token/NEXUSLEARN_ADMIN_TOKEN or --admin-key/ADMIN_API_KEY");
  if (!versionID) throw new Error("rollback requires --version-id");
  const route = `/v1/admin/content/versions/${encodeURIComponent(versionID)}/restore`;
  const res = await fetch(`${api.replace(/\/$/, "")}${route}`, { method: "POST", headers: auth });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${route} failed ${res.status}: ${text}`);
  }
  const body = await res.json();
  console.log(`restored ${body.content_version?.content_type ?? "content"} ${body.content_version?.content_key ?? versionID} from version ${body.content_version?.version ?? "unknown"}`);
}

function adminAuth(options) {
  const token = options.token ?? process.env.NEXUSLEARN_ADMIN_TOKEN;
  if (token) return { Authorization: `Bearer ${token}` };
  const adminKey = options.adminKey ?? process.env.ADMIN_API_KEY;
  if (adminKey) return { "X-Admin-Key": adminKey };
  return null;
}

function printValidation(result) {
  console.log(`${result.errors.length === 0 ? "valid" : "invalid"} ${relative(result.file)} (${result.packID})`);
  for (const error of result.errors) console.log(`  error: ${error}`);
  for (const warning of result.warnings) console.log(`  warning: ${warning}`);
}

function parseArgs(args) {
  const options = { files: [] };
  for (let i = 0; i < args.length; i += 1) {
    const value = args[i];
    if (value === "--out") options.out = args[++i];
    else if (value === "--api") options.api = args[++i];
    else if (value === "--admin-key") options.adminKey = args[++i];
    else if (value === "--token") options.token = args[++i];
    else if (value === "--version-id") options.versionId = args[++i];
    else if (value === "--channel") options.channel = args[++i];
    else if (value === "--source-revision") options.sourceRevision = args[++i];
    else if (value === "--all") options.all = true;
    else if (value === "--strict") options.strict = true;
    else if (value === "--strict-promoted") options.strictPromoted = true;
    else if (value === "--allow-sample") options.allowSample = true;
    else options.files.push(value);
  }
  return options;
}

async function writeReleaseBundle(payloads, options) {
  const channel = options.channel ?? "review";
  if (!["review", "pilot", "live"].includes(channel)) throw new Error("bundle --channel must be review, pilot or live");
  if (payloads.length === 0) throw new Error("bundle requires at least one valid pack");
  if (channel !== "review") {
    for (const payload of payloads) {
      if (payload.activities.some((activity) => !runtimeStatuses.has(activity.status))) {
        throw new Error(`${payload.pack_id} has a non-runtime activity and cannot enter the ${channel} channel`);
      }
      const runtimeQuestions = payload.questions.filter((question) => runtimeStatuses.has(question.status)).length;
      if (runtimeQuestions < 3) throw new Error(`${payload.pack_id} needs at least three runtime-approved questions for the ${channel} channel`);
    }
  }
  payloads.sort((left, right) => left.pack_id.localeCompare(right.pack_id));
  const chunks = payloads.map((payload) => {
    const canonical = stableStringify(payload);
    const digest = sha256(canonical);
    return {
      descriptor: {
        pack_id: payload.pack_id,
        pack_version: payload.version,
        payload_sha256: digest,
        objective_count: 1,
        activity_count: payload.activities.length,
        question_count: payload.questions.length,
        reward_rule_count: payload.reward_rules.length,
      },
      upload: {
        pack_id: payload.pack_id,
        pack_version: payload.version,
        payload_sha256: digest,
        payload,
        objective_count: 1,
        activity_count: payload.activities.length,
        question_count: payload.questions.length,
        reward_rule_count: payload.reward_rules.length,
      },
    };
  });
  const packs = chunks.map((item) => item.descriptor);
  const manifestSHA = sha256(stableStringify(packs));
  const releaseID = `nexuslearn-${channel}-${manifestSHA.slice(0, 16)}`;
  const sum = (key) => packs.reduce((total, pack) => total + pack[key], 0);
  const manifest = {
    id: releaseID,
    schema_version: "1.0",
    channel,
    source_revision: options.sourceRevision ?? process.env.GITHUB_SHA ?? "",
    manifest_sha256: manifestSHA,
    complete_snapshot: true,
    expected_pack_count: packs.length,
    expected_objective_count: sum("objective_count"),
    expected_activity_count: sum("activity_count"),
    expected_question_count: sum("question_count"),
    expected_reward_rule_count: sum("reward_rule_count"),
    packs,
    metadata: {
      generator: "packages/content/tools/objective-pack.mjs",
      managed_by: "nexuslearn-content-release",
    },
  };
  const outDir = path.resolve(options.out ?? `packages/content/generated/releases/${releaseID}`);
  const chunksDir = path.join(outDir, "packs");
  await mkdir(chunksDir, { recursive: true });
  await writeFile(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  for (const chunk of chunks) {
    await writeFile(path.join(chunksDir, `${chunk.descriptor.pack_id}.json`), `${JSON.stringify(chunk.upload)}\n`, "utf8");
  }
  console.log(`release-bundle id=${releaseID} packs=${packs.length} questions=${manifest.expected_question_count} channel=${channel}`);
  console.log(`release-bundle written ${relative(outDir)}`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function expandPackInputs(options) {
  const inputs = options.all ? [...options.files, "packages/content/packs"] : options.files;
  const out = [];
  for (const input of inputs) {
    const resolved = path.resolve(input);
    let info;
    try {
      info = await stat(resolved);
    } catch {
      throw new Error(`Pack input not found: ${input}`);
    }
    if (info.isDirectory()) {
      out.push(...await findPackFiles(resolved));
    } else if (isPackFile(resolved)) {
      out.push(resolved);
    }
  }
  return Array.from(new Set(out)).sort();
}

async function findPackFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findPackFiles(fullPath));
    } else if (isPackFile(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function isPackFile(file) {
  return file.endsWith(".pack.json") || file.endsWith(".pack.sample.json");
}

function isSamplePack(file) {
  return file.includes(".sample.");
}

function renderPreviewHTML(pack, payload, validation) {
  const source = pack.source_alignment;
  const objective = pack.objective;
  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHTML(pack.pack_id)} preview</title>
  <style>
    :root { color-scheme: light; --ink: #1d1a3e; --muted: rgba(29,26,62,.64); --paper: #fbfaf6; --line: rgba(29,26,62,.12); --gold: #ffbf45; --teal: #55cbd3; --violet: #7357c9; --red: #b94747; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--paper); color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.5; }
    main { max-width: 1180px; margin: 0 auto; padding: 32px 20px 56px; }
    header { display: grid; gap: 18px; padding: 28px; background: white; border: 1px solid var(--line); box-shadow: 0 18px 40px rgba(29,26,62,.08); }
    h1, h2, h3 { margin: 0; line-height: 1.08; }
    h1 { font-size: clamp(32px, 6vw, 64px); letter-spacing: 0; }
    h2 { font-size: 28px; margin-bottom: 14px; }
    h3 { font-size: 19px; }
    p { margin: 0; }
    section { margin-top: 22px; padding: 24px; background: white; border: 1px solid var(--line); }
    .grid { display: grid; gap: 14px; }
    .cols { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .pill, .status { display: inline-flex; align-items: center; width: fit-content; padding: 6px 10px; background: rgba(85,203,211,.18); color: #155d64; font-size: 12px; font-weight: 800; }
    .status { background: rgba(255,191,69,.32); color: #6b4800; text-transform: uppercase; letter-spacing: .08em; }
    .muted { color: var(--muted); }
    .card { padding: 16px; background: #f6f3ea; border: 1px solid var(--line); }
    .step { display: grid; grid-template-columns: 150px 1fr; gap: 16px; padding: 16px 0; border-top: 1px solid var(--line); }
    .step:first-child { border-top: 0; }
    .hook { background: rgba(115,87,201,.12); color: #4e33a4; }
    .warning { background: #fff4d5; color: #725100; }
    .error { background: #ffe8e8; color: #8b2b2b; }
    code { font-family: "SFMono-Regular", Consolas, monospace; font-size: 13px; }
    ul { margin: 8px 0 0; padding-left: 20px; }
    @media (max-width: 680px) { .step { grid-template-columns: 1fr; } header, section { padding: 18px; } }
  </style>
</head>
<body>
<main>
  <header>
    <span class="status">${escapeHTML(pack.status)}</span>
    <h1>${escapeHTML(objective.child_goal)}</h1>
    <p class="muted">${escapeHTML(objective.statement)}</p>
    <div class="grid cols">
      ${previewInfo("Pack", pack.pack_id)}
      ${previewInfo("Version", pack.version)}
      ${previewInfo("Year", `Year ${source.year}`)}
      ${previewInfo("Subject", source.subject)}
      ${previewInfo("Strand", source.strand ?? "")}
      ${previewInfo("Topic", source.topic ?? "")}
    </div>
  </header>

  <section>
    <h2>Validation</h2>
    <div class="grid">
      ${validation.errors.length === 0 ? `<span class="pill">No validation errors</span>` : validation.errors.map((item) => `<span class="pill error">${escapeHTML(item)}</span>`).join("")}
      ${validation.warnings.length === 0 ? `<span class="pill">No warnings</span>` : validation.warnings.map((item) => `<span class="pill warning">${escapeHTML(item)}</span>`).join("")}
    </div>
  </section>

  <section>
    <h2>Teaching Journey</h2>
    ${pack.teaching_sequence.map((step) => `
      <article class="step">
        <div>
          <span class="pill">${escapeHTML(step.kind)}</span>
          ${step.animation_hook ? `<p style="margin-top:8px"><span class="pill hook">${escapeHTML(step.animation_hook)}</span></p>` : ""}
        </div>
        <div>
          <h3>${escapeHTML(step.child_prompt)}</h3>
          <p class="muted" style="margin-top:8px">${escapeHTML(step.learning_purpose)}</p>
          ${step.audio_script ? `<p style="margin-top:10px"><strong>Audio:</strong> ${escapeHTML(step.audio_script)}</p>` : ""}
          ${step.visual_model ? `<p style="margin-top:6px"><strong>Visual:</strong> ${escapeHTML(step.visual_model)}</p>` : ""}
        </div>
      </article>
    `).join("")}
  </section>

  <section>
    <h2>Manipulatives and Animation</h2>
    <div class="grid cols">
      ${pack.manipulatives.map((item) => `<div class="card"><h3>${escapeHTML(item.id)}</h3><p class="muted">${escapeHTML(item.type)}</p><p style="margin-top:8px">${escapeHTML(item.purpose)}</p></div>`).join("")}
    </div>
    <div class="grid cols" style="margin-top:16px">
      ${Object.entries(pack.animation_plan).map(([key, value]) => `<div class="card"><strong>${escapeHTML(key)}</strong><p class="muted">${escapeHTML(value)}</p></div>`).join("")}
    </div>
  </section>

  <section>
    <h2>Question Variants</h2>
    <div class="grid">
      ${pack.question_variants.map((variant) => `<article class="card"><h3>${escapeHTML(variant.id)}</h3><p><span class="pill">${escapeHTML(variant.format)}</span> <span class="pill">${escapeHTML(variant.status)}</span> <span class="pill">difficulty ${escapeHTML(String(variant.difficulty))}</span></p><p style="margin-top:10px">${escapeHTML(variant.body?.prompt ?? "")}</p><p class="muted" style="margin-top:8px">${escapeHTML(variant.explanation)}</p></article>`).join("")}
    </div>
  </section>

  <section>
    <h2>Variant Bank Plan</h2>
    <div class="grid cols">
      ${previewInfo("Pilot target", String(pack.practice?.variant_targets?.pilot ?? ""))}
      ${previewInfo("Release target", String(pack.practice?.variant_targets?.release ?? ""))}
      ${previewInfo("Mature target", String(pack.practice?.variant_targets?.mature ?? ""))}
      ${previewInfo("Planned blueprints", String((pack.variant_blueprints ?? []).reduce((total, item) => total + (item.count ?? 0), 0)))}
    </div>
    <div class="grid" style="margin-top:16px">
      ${(pack.variant_blueprints ?? []).map((blueprint) => `<article class="card"><h3>${escapeHTML(blueprint.id)}</h3><p><span class="pill">${escapeHTML(blueprint.format)}</span> <span class="pill">${escapeHTML(blueprint.difficulty_band)}</span> <span class="pill">${escapeHTML(String(blueprint.count))} planned</span></p><p style="margin-top:10px">${escapeHTML(blueprint.purpose)}</p><p class="muted" style="margin-top:8px">${escapeHTML(blueprint.review_notes ?? "")}</p></article>`).join("")}
    </div>
  </section>

  <section>
    <h2>Adaptive Support</h2>
    <div class="grid cols">
      ${Object.entries(pack.adaptive_support).map(([key, value]) => `<div class="card"><strong>${escapeHTML(key)}</strong><p class="muted">${escapeHTML(value)}</p></div>`).join("")}
    </div>
  </section>

  <section>
    <h2>Admin Payload Summary</h2>
    <div class="grid cols">
      ${previewInfo("Objective", payload.objective.id)}
      ${previewInfo("Activity", payload.activities[0]?.id ?? "")}
      ${previewInfo("Questions", String(payload.questions.length))}
      ${previewInfo("Reward rules", String(payload.reward_rules.length))}
      ${previewInfo("Runtime variants", String(payload.readiness_seed.runtime_variant_count))}
      ${previewInfo("Planned variants", String(payload.readiness_seed.planned_variant_count))}
      ${previewInfo("Formats", payload.readiness_seed.formats.join(", "))}
    </div>
  </section>
</main>
</body>
</html>
`;
}

function previewInfo(label, value) {
  return `<div class="card"><strong>${escapeHTML(label)}</strong><p class="muted">${escapeHTML(value)}</p></div>`;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function runtimeStatusFromPack(status) {
  if (status === "published") return "published";
  if (status === "approved" || status === "pilot") return "approved";
  if (status === "archived") return "archived";
  return status;
}

function worldKeyForYear(year) {
  const worlds = {
    1: "wonder-garden",
    2: "storybook-kingdom",
    3: "explorer-islands",
    4: "inventor-wilds",
    5: "orbit-city",
    6: "quest-academy",
    7: "future-worlds",
  };
  return worlds[year] ?? "nexus-hub";
}

function firstStepPrompt(pack) {
  return pack.teaching_sequence.find((step) => step.kind === "concept_launch")?.child_prompt ?? pack.objective.child_goal;
}

function teachBackPrompt(pack) {
  return pack.teaching_sequence.find((step) => step.kind === "teach_back")?.child_prompt ?? "Show your companion how the idea works.";
}

function medianDifficulty(variants) {
  const values = variants.map((variant) => variant.difficulty).filter(Number.isInteger).sort((a, b) => a - b);
  if (values.length === 0) return 3;
  return values[Math.floor(values.length / 2)];
}

function requireText(value, label, errors) {
  if (typeof value !== "string" || value.trim() === "") errors.push(`${label} is required`);
}

function requireArray(value, label, errors, minItems = 0) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return;
  }
  if (value.length < minItems) errors.push(`${label} needs at least ${minItems} item(s)`);
}

async function readJSON(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new Error(`Could not read JSON ${file}: ${error.message}`);
  }
}

function relative(file) {
  return path.relative(repoRoot, file).replaceAll("\\", "/");
}

function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  }
  return value;
}

function printHelp() {
  console.log(`Usage:
  node packages/content/tools/objective-pack.mjs validate <pack...>
  node packages/content/tools/objective-pack.mjs compile <pack...> [--out packages/content/generated]
  node packages/content/tools/objective-pack.mjs bundle <pack...> [--channel review] [--source-revision <sha>] [--out <dir>]
  node packages/content/tools/objective-pack.mjs preview <pack...> [--out packages/content/generated/previews]
  node packages/content/tools/objective-pack.mjs diff <pack...> --api <url> --admin-key <key>
  node packages/content/tools/objective-pack.mjs publish <pack...> --api <url> --admin-key <key>
  node packages/content/tools/objective-pack.mjs rollback --version-id <uuid> --api <url> --token <session>

Options:
  --all             Include every *.pack.json and *.pack.sample.json under packages/content/packs
  --strict          Treat warnings as failures
  --strict-promoted Treat warnings as failures only for pilot/approved/published packs
  --allow-sample    Allow publish for files named *.sample.*
  --token           Named administrator bearer session (preferred)
  --version-id      Content version UUID to restore with rollback

The publish command promotes validated objective packs through existing admin APIs:
curriculum objective, teaching activity, question variants and reward rule.`);
}
