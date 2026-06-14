#!/usr/bin/env node
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const sourceMapPath = path.join(repoRoot, "packages/content/research/uk-y1-y7-curriculum-source-map.json");

const runtimeStatuses = new Set(["approved", "published", "live"]);
const packStatuses = new Set(["draft", "review", "pilot", "approved", "published", "archived"]);
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
  if (!["validate", "compile", "diff", "publish"].includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }
  const options = parseArgs(args);
  const files = await expandPackInputs(options);
  if (files.length === 0) {
    throw new Error("Provide at least one objective pack JSON file, folder, or --all.");
  }

  const sourceMap = await readJSON(sourceMapPath);
  const sourceIDs = new Set((sourceMap.sources ?? []).map((source) => source.source_id));
  const results = [];
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
    if (command === "compile" || command === "diff" || command === "publish") {
      const payload = compilePack(pack);
      if (command === "compile") {
        const outDir = path.resolve(options.out ?? "packages/content/generated");
        await mkdir(outDir, { recursive: true });
        const outPath = path.join(outDir, `${pack.pack_id}.admin-payload.json`);
        await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
        console.log(`compiled ${relative(outPath)}`);
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
  if (errorCount > 0 || (options.strict && warningCount > 0)) {
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
  for (const key of ["intro", "concept", "thinking", "hint", "repair", "success", "mastery", "world_growth", "reduced_motion_fallback"]) {
    requireText(pack.animation_plan?.[key], `animation_plan.${key}`, errors);
  }
  for (const key of ["low_sensory", "reduced_motion", "audio_first", "reading_support", "attention_support", "confidence_support"]) {
    requireText(pack.adaptive_support?.[key], `adaptive_support.${key}`, errors);
  }

  return {
    file: packPath,
    packID: pack.pack_id ?? "(unknown)",
    errors,
    warnings,
  };
}

function compilePack(pack) {
  const objective = pack.objective;
  const source = pack.source_alignment;
  const activityID = `act-${objective.id}`;
  const activityStatus = runtimeStatusFromPack(pack.status);
  const primaryManipulative = pack.manipulatives[0];
  const primaryFormat = pack.practice.formats[0] ?? primaryManipulative.type;
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
    difficulty: medianDifficulty(pack.question_variants),
    interaction: {
      type: primaryFormat,
      pack_id: pack.pack_id,
      source_ids: source.source_ids,
      teaching_sequence: pack.teaching_sequence,
      manipulative: primaryManipulative,
      adaptive_support: pack.adaptive_support,
      practice_formats: pack.practice.formats,
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
  const questionPayloads = pack.question_variants.map((variant) => ({
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
      formats: Array.from(new Set(questionPayloads.map((question) => question.format))).sort(),
    },
  };
}

async function publishPayload(payload, options) {
  const api = options.api ?? process.env.NEXUSLEARN_API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  const adminKey = options.adminKey ?? process.env.ADMIN_API_KEY;
  if (!api) throw new Error("publish requires --api or NEXUSLEARN_API_URL");
  if (!adminKey) throw new Error("publish requires --admin-key or ADMIN_API_KEY");
  await putJSON(api, `/v1/admin/curriculum/objectives/${payload.objective.id}`, adminKey, payload.objective);
  console.log(`published objective ${payload.objective.id}`);
  for (const activity of payload.activities) {
    await putJSON(api, `/v1/admin/content/activities/${activity.id}`, adminKey, activity);
    console.log(`published activity ${activity.id}`);
  }
  for (const question of payload.questions) {
    await putJSON(api, `/v1/admin/content/questions/${question.id}`, adminKey, question);
    console.log(`published question ${question.id}`);
  }
  for (const rule of payload.reward_rules) {
    await putJSON(api, `/v1/admin/reward-rules/${rule.id}`, adminKey, rule);
    console.log(`published reward rule ${rule.id}`);
  }
}

async function fetchLiveAdminConfig(options) {
  const api = options.api ?? process.env.NEXUSLEARN_API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  const adminKey = options.adminKey ?? process.env.ADMIN_API_KEY;
  if (!api) throw new Error("diff requires --api or NEXUSLEARN_API_URL");
  if (!adminKey) throw new Error("diff requires --admin-key or ADMIN_API_KEY");
  const baseURL = api.replace(/\/$/, "");
  const res = await fetch(`${baseURL}/v1/admin/config`, {
    headers: {
      "X-Admin-Key": adminKey,
    },
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

async function putJSON(api, route, adminKey, body) {
  const res = await fetch(`${api.replace(/\/$/, "")}${route}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": adminKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PUT ${route} failed ${res.status}: ${text}`);
  }
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
    else if (value === "--all") options.all = true;
    else if (value === "--strict") options.strict = true;
    else if (value === "--allow-sample") options.allowSample = true;
    else options.files.push(value);
  }
  return options;
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
  node packages/content/tools/objective-pack.mjs diff <pack...> --api <url> --admin-key <key>
  node packages/content/tools/objective-pack.mjs publish <pack...> --api <url> --admin-key <key>

Options:
  --all             Include every *.pack.json and *.pack.sample.json under packages/content/packs
  --strict          Treat warnings as failures
  --allow-sample    Allow publish for files named *.sample.*

The publish command promotes validated objective packs through existing admin APIs:
curriculum objective, teaching activity, question variants and reward rule.`);
}
