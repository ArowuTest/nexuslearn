#!/usr/bin/env node
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, "../../..");
const packsDir = path.join(repoRoot, "packages/content/packs");
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");

if (write === check) {
  throw new Error("Pass exactly one of --write or --check.");
}

const packNames = (await readdir(packsDir))
  .filter((name) => name.endsWith(".pack.sample.json"))
  .sort();
const audit = {
  packsScanned: 0,
  targetPacks: 0,
  targetVariants: 0,
  feedbackBefore: 0,
  routesBefore: 0,
  feedbackAdded: 0,
  responseModesAdded: 0,
  supportedInteractionsAdded: 0,
  changedPacks: [],
  skipped: [],
  unsafeBefore: [],
  unsafeAfter: [],
};

for (const packName of packNames) {
  const packPath = path.join(packsDir, packName);
  const originalText = await readFile(packPath, "utf8");
  const pack = JSON.parse(originalText);
  const year = Number(pack.source_alignment?.year);
  if (!Number.isInteger(year) || year < 1 || year > 4) continue;

  audit.packsScanned += 1;
  const variants = pack.question_variants ?? [];
  assertUniqueIds(pack.pack_id, variants);
  const originalVariants = structuredClone(variants);
  const originalCore = coreSnapshot(variants);
  audit.unsafeBefore.push(...unsafePressure(pack.pack_id, variants));
  const additions = new Map();
  let packTargets = 0;

  for (const variant of variants) {
    const missingFeedback = !isObject(variant.feedback);
    const missingBothModes = !variant.body?.response_mode && !variant.body?.interaction_mode;
    if (!missingFeedback && !missingBothModes) continue;

    packTargets += 1;
    audit.targetVariants += 1;
    audit.feedbackBefore += Number(missingFeedback);
    audit.routesBefore += Number(missingBothModes);
    const added = { top: [], body: [] };

    if (missingFeedback) {
      const reason = feedbackBlocker(variant);
      if (reason) {
        audit.skipped.push({ pack_id: pack.pack_id, id: variant.id, field: "feedback", reason });
      } else {
        variant.feedback = makeFeedback(pack, variant);
        added.top.push("feedback");
        audit.feedbackAdded += 1;
      }
    }

    variant.body ??= {};
    if (missingBothModes) {
      variant.body.response_mode = responseMode(variant.format);
      added.body.push("response_mode");
      audit.responseModesAdded += 1;
    }
    if (!Object.hasOwn(variant.body, "supported_interaction")) {
      variant.body.supported_interaction = supportedInteraction(pack, variant);
      added.body.push("supported_interaction");
      audit.supportedInteractionsAdded += 1;
    }
    additions.set(variant.id, added);
  }

  if (packTargets === 0) continue;
  audit.targetPacks += 1;
  assertAdditiveOnly(pack.pack_id, originalVariants, variants, additions);
  assertCorePreserved(pack.pack_id, originalCore, coreSnapshot(variants));
  assertUniqueIds(pack.pack_id, variants);
  audit.unsafeAfter.push(...unsafePressure(pack.pack_id, variants));

  const nextText = `${JSON.stringify(pack, null, 2)}\n`;
  if (nextText !== originalText) {
    audit.changedPacks.push(packName);
    if (write) await writeFile(packPath, nextText, "utf8");
  }
}

if (audit.skipped.length > 0) {
  throw new Error(`Cannot safely enrich ${audit.skipped.length} item(s):\n${JSON.stringify(audit.skipped, null, 2)}`);
}
if (audit.unsafeBefore.length || audit.unsafeAfter.length) {
  throw new Error(`Unsafe pressure booleans found:\n${JSON.stringify({ before: audit.unsafeBefore, after: audit.unsafeAfter }, null, 2)}`);
}

console.log(`y1-y4-curated-hardening packs_scanned=${audit.packsScanned} target_packs=${audit.targetPacks} target_variants=${audit.targetVariants}`);
console.log(`y1-y4-curated-hardening missing_feedback before=${audit.feedbackBefore} added=${audit.feedbackAdded} after=${audit.feedbackBefore - audit.feedbackAdded}`);
console.log(`y1-y4-curated-hardening missing_both_modes before=${audit.routesBefore} response_mode_added=${audit.responseModesAdded} after=${audit.routesBefore - audit.responseModesAdded}`);
console.log(`y1-y4-curated-hardening supported_interaction_added=${audit.supportedInteractionsAdded} unsafe_pressure before=0 after=0 skipped=0`);
console.log(`y1-y4-curated-hardening changed_packs=${audit.changedPacks.length}`);

if (check && audit.changedPacks.length > 0) {
  throw new Error(`Curated feedback hardening is out of date; run --write. Packs: ${audit.changedPacks.join(", ")}`);
}
console.log(write ? "y1-y4-curated-hardening write passed" : "y1-y4-curated-hardening deterministic check passed");

function feedbackBlocker(variant) {
  if (!variant.explanation || typeof variant.explanation !== "string") return "missing explanation";
  if (!Array.isArray(variant.hints) || variant.hints.length === 0) return "missing hints";
  if (!Object.hasOwn(variant, "expected_answer")) return "missing expected_answer";
  return null;
}

function makeFeedback(pack, variant) {
  const answer = readable(variant.expected_answer);
  const explanation = sentence(variant.explanation);
  const hints = variant.hints.filter((hint) => typeof hint === "string" && hint.trim()).map(sentence);
  const misconception = humanize(variant.misconception_tag ?? "the first choice not matching the evidence");
  const subject = String(pack.source_alignment?.subject ?? "").toLowerCase();
  const evidence = evidenceFor(subject, variant.format, answer, explanation);
  const support = subject.includes("english")
    ? "Choose by touch or keyboard, scan with a switch, use eye gaze, point or use AAC, or direct an adult to scribe or record the choice. Speech and handwriting are optional. There is no timer or penalty, and correct work stays for the retry."
    : subject.includes("math")
      ? "Use the concrete or visual model and respond by touch, keyboard, switch, eye gaze, AAC or pointing, or direct an adult to scribe the chosen number or step. Fine dragging, handwriting and speech are optional. Retry without a timer, loss or penalty."
      : "Use the picture, model or observation and respond by touch, keyboard, switch, eye gaze, AAC or pointing, or direct an adult to record the choice. Touching materials, fine dragging, handwriting and speech are optional. Retry without a timer, loss or penalty.";

  return {
    correct: `After the response is checked, the accepted answer is ${answer}. ${explanation}`,
    repair: `${hints.join(" ")} Use that clue to repair ${misconception}, then try the same decision again.`,
    evidence,
    misconception_check: misconception,
    support_message: support,
  };
}

function evidenceFor(subject, format, answer, explanation) {
  const kind = String(format ?? "activity").replaceAll("-", " ");
  if (subject.includes("english")) {
    return `For this ${kind}, check the exact sound, word, sentence or text detail named in the prompt. The language evidence supports ${answer}: ${explanation}`;
  }
  if (subject.includes("math")) {
    return `For this ${kind}, the number, equation or representation must show the same quantity and relationship. The mathematical evidence supports ${answer}: ${explanation}`;
  }
  return `For this ${kind}, use the observable feature, ordered model, comparison or test result rather than a guess. The scientific evidence supports ${answer}: ${explanation}`;
}

function responseMode(format) {
  const value = String(format ?? "").toLowerCase();
  if (/listen|audio|fluency|phon/.test(value)) return "replay_then_touch_keyboard_switch_eye_gaze_or_aac_choice";
  if (/build|sort|sequence|order|editor|map|diagram|array|frame/.test(value)) return "tap_select_place_or_keyboard_switch_eye_gaze_stepper_without_required_drag";
  if (/number|equation|measure|scale|clock|coin|line|fraction|chart/.test(value)) return "touch_keyboard_switch_eye_gaze_or_aac_number_choice";
  return "touch_keyboard_switch_eye_gaze_or_aac_choice";
}

function supportedInteraction(pack, variant) {
  const subject = String(pack.source_alignment?.subject ?? "").toLowerCase();
  const task = /build|sort|sequence|order|editor|map|diagram|array|frame/i.test(String(variant.format))
    ? "select and place cards using taps, numbered positions or step controls; dragging is optional"
    : "select a labelled choice or enter the response with large, focusable controls";
  const adult = subject.includes("science") ? "adult-recorded" : "adult-scribed";
  return `${task}. Equivalent routes include touch, keyboard, single-switch scanning, eye-gaze dwell selection, AAC or pointing, and ${adult} responses directed by the learner; no handwriting, speech or fine drag is mandatory.`;
}

function coreSnapshot(variants) {
  return variants.map((variant) => ({
    id: variant.id,
    format: variant.format,
    expected_answer: structuredClone(variant.expected_answer),
    hints: structuredClone(variant.hints),
    explanation: variant.explanation,
    status: variant.status,
    blueprint: structuredClone(variant.body?.variant_blueprint_id),
    audio: Object.fromEntries(Object.entries(variant.body ?? {}).filter(([key]) => key.toLowerCase().includes("audio") || key.toLowerCase().includes("tts"))),
  }));
}

function assertCorePreserved(packId, before, after) {
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error(`${packId}: ID/format/answer/hints/explanation/status/blueprint/audio signature changed.`);
  }
}

function assertAdditiveOnly(packId, before, after, additions) {
  if (before.length !== after.length) throw new Error(`${packId}: variant count changed.`);
  const restored = structuredClone(after);
  for (const variant of restored) {
    const added = additions.get(variant.id);
    if (!added) continue;
    for (const key of added.top) delete variant[key];
    for (const key of added.body) delete variant.body[key];
  }
  if (JSON.stringify(before) !== JSON.stringify(restored)) {
    throw new Error(`${packId}: a field other than approved missing quality metadata changed.`);
  }
}

function assertUniqueIds(packId, variants) {
  const ids = variants.map((variant) => variant.id);
  if (new Set(ids).size !== ids.length) throw new Error(`${packId}: duplicate variant ID.`);
}

function unsafePressure(packId, variants) {
  const unsafe = [];
  const badKeys = new Set(["speed_score_allowed", "timer", "timed", "speed_score", "streaks", "streak_loss", "lives", "loss_on_error", "public_ranking", "retry_cost", "speed_bonus", "leaderboard"]);
  const walk = (value, id, trail = []) => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      const next = [...trail, key];
      if (badKeys.has(key) && child === true) unsafe.push({ pack_id: packId, id, path: next.join(".") });
      walk(child, id, next);
    }
  };
  for (const variant of variants) walk(variant, variant.id);
  return unsafe;
}

function readable(value) {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(readable).join(", ");
  if (isObject(value)) return Object.entries(value).map(([key, item]) => `${humanize(key)}: ${readable(item)}`).join("; ");
  return String(value);
}

function humanize(value) {
  return String(value).replaceAll(/[_-]+/g, " ").trim();
}

function sentence(value) {
  const text = String(value).trim();
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
