#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/ma-y5-multi-step-problems.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y5-multi-step-problems-bank-";
const pilotTarget = 240;
const reviewBatch = "y5-multi-step-pilot-a";

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y5-multi-step-problems") throw new Error("This generator only supports the Year 5 multi-step-problems pack.");
const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 4) throw new Error(`Expected exactly 4 curated variants, found ${curated.length}.`);
const curatedSnapshot = JSON.stringify(curated);

const contexts = [
  { key: "library", place: "library", item: "books", unit: "books" },
  { key: "reserve", place: "nature reserve", item: "visitors", unit: "visitors" },
  { key: "warehouse", place: "community warehouse", item: "parcels", unit: "parcels" },
  { key: "museum", place: "museum", item: "tickets", unit: "tickets" },
  { key: "garden", place: "school garden", item: "plants", unit: "plants" },
  { key: "water", place: "water station", item: "litres", unit: "litres" },
  { key: "foodbank", place: "food bank", item: "tins", unit: "tins" },
  { key: "workshop", place: "repair workshop", item: "parts", unit: "parts" },
];

const candidates = [
  ...Array.from({ length: 48 }, (_, index) => buildPlan(index)),
  ...Array.from({ length: 47 }, (_, index) => buildChangeChain(index)),
  ...Array.from({ length: 47 }, (_, index) => buildRelationship(index)),
  ...Array.from({ length: 47 }, (_, index) => buildErrorAnalysis(index)),
  ...Array.from({ length: 47 }, (_, index) => buildMethodCheck(index)),
];

pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Year 5 multi-step-problems pilot reaches 240 variants with four curated questions preserved unchanged and 236 deterministic review candidates. The bank prioritises additive multi-step planning and extends secure/stretch transfer to bounded multiplication and division steps, as anticipated by the pack progression. Coverage includes final/intermediate targets, operation sequencing, hidden and irrelevant information, missing information, change and comparison structures, estimation, inverse checking, first-error diagnosis, alternative valid routes and reasonableness. Step planners, bar models, calculation chains and evidence choices include dyscalculia/SEND, reduced-load and alternative-input routes with pressure-free investigation missions. Selected narration references require produced, human-reviewed ElevenLabs assets; browser TTS is prohibited. Independent mathematics, teacher, SEND, accessibility, safeguarding, audio and renderer review remains required before promotion.";

validateBank(pack, curated, candidates, curatedSnapshot);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`multi-step-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`multi-step-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`multi-step-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`multi-step-bank operations=${summary(candidates, (variant) => variant.body.operation_scope)}`);
console.log(`multi-step-bank audio_refs=${candidates.filter((variant) => variant.body.audio_asset_id).length}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`multi-step-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 5 multi-step bank is out of date; run generate-y5-multi-step-problems-bank.mjs --write.");
  console.log("multi-step-bank deterministic check passed");
} else {
  console.log("multi-step-bank dry-run; pass --write to update the pack");
}

function buildPlan(index) {
  const context = contexts[index % contexts.length];
  const family = index % 6;
  const start = 12000 + index * 173;
  const added = 850 + (index % 7) * 125;
  const removed = 430 + (index % 5) * 97;
  const groups = 6 + index % 7;
  const each = 24 + (index % 6) * 8;
  let prompt;
  let answer;
  let choices;
  let plan;
  let integrity;
  let tag = "stops_after_one_step";
  let operationScope = "addition_subtraction";
  if (family === 0) {
    plan = [`${start} + ${added}`, `use that result - ${removed}`];
    answer = "Find the amount after the delivery first, then subtract the amount removed.";
    prompt = `Mission map ${index + 1}: a ${context.place} starts with ${start} ${context.unit}, receives ${added} and later sends out ${removed}. What must be found first and last?`;
    choices = [answer, "Subtract the removed amount first and stop", "Add every number without labels", "The delivery amount is already the final answer"];
    integrity = { type: "plan_change", start, added, removed, expected: answer };
  } else if (family === 1) {
    const other = start + added;
    answer = "Find the second group's amount, combine both groups, then subtract the amount used.";
    plan = [`${start} + ${added} = ${other}`, `${start} + ${other}`, `subtract ${removed}`];
    prompt = `Dependency planner ${index + 1}: Group B has ${added} more ${context.unit} than Group A's ${start}. The ${context.place} combines both groups, then uses ${removed}. Which plan reaches the amount remaining?`;
    choices = [answer, "Use the difference as Group B's whole amount", "Subtract the groups because the story says more", "Stop after finding Group B"];
    integrity = { type: "plan_comparison", a: start, difference: added, used: removed, expected: answer };
    tag = "keyword_operation_choice";
  } else if (family === 2) {
    answer = `Use ${start}, ${added} and ${removed}; ignore route number ${40 + index}.`;
    plan = [`${start} + ${added}`, `subtract ${removed}`];
    prompt = `Relevant-information sort ${index + 1}: the ${context.place} is on route ${40 + index}. It has ${start} ${context.unit}, receives ${added} and sends out ${removed}. Which information belongs in the calculation?`;
    choices = [answer, `Use every number, including route number ${40 + index}.`, `Use only ${added} and route number ${40 + index}.`, `There is no relevant numerical information.`];
    integrity = { type: "irrelevant_information", relevant: [start, added, removed], irrelevant: 40 + index, expected: answer };
    tag = "uses_every_number";
  } else if (family === 3) {
    answer = "the number of items in each box";
    plan = ["boxes × items per box", `then subtract ${removed}`];
    prompt = `Missing-information check ${index + 1}: the ${context.place} has ${groups} boxes and later sends out ${removed} ${context.unit}. To find how many remain, which missing fact is needed?`;
    choices = [answer, "the colour of each box", "the route number", "the day of the week"];
    integrity = { type: "missing_factor", groups, removed, expected: answer };
    tag = "calculates_without_required_information";
    operationScope = "multiplication_then_subtraction_transfer";
  } else if (family === 4) {
    const intermediate = start + added;
    answer = `The ${intermediate} total is intermediate; the final target is the amount left after removing ${removed}.`;
    plan = [`${start} + ${added} = ${intermediate}`, `${intermediate} - ${removed}`];
    prompt = `Target check ${index + 1}: a ${context.place} adds ${added} to ${start} ${context.unit}, then removes ${removed}. A learner stops at ${intermediate}. Which statement repairs the plan?`;
    choices = [answer, `${intermediate} is final because it is a correct calculation.`, `The removed amount is the final total.`, "No calculation is needed after an intermediate result."];
    integrity = { type: "intermediate_target", start, added, removed, intermediate, expected: answer };
  } else {
    const packed = groups * each;
    answer = `Find ${groups} × ${each} = ${packed} first, then add the ${added} loose ${context.unit}.`;
    plan = [`${groups} × ${each} = ${packed}`, `${packed} + ${added}`];
    prompt = `Hidden-quantity planner ${index + 1}: ${groups} equal trays each hold ${each} ${context.unit}, and ${added} more are loose. Which plan finds the total?`;
    choices = [answer, `Add ${groups} + ${each} + ${added}.`, `Divide ${each} by ${groups} and stop.`, `Ignore the equal groups and use ${added} only.`];
    integrity = { type: "hidden_product", groups, each, added, expected: answer };
    tag = "hidden_intermediate_quantity";
    operationScope = "multiplication_then_addition_transfer";
  }
  return candidate({ index, family: `plan-${family}`, format: "problem-map", blueprint: "identify-final-and-intermediate", band: family < 3 ? "developing" : family < 5 ? "expected" : "secure", operationScope, prompt, body: { context_unit: context.unit, plan, choices, integrity, question_first_view: true, relevant_information_toggle: true }, answer, unit: null, hints: ["Name the final quantity and unit before using any numbers.", "Label FIND FIRST and FIND LAST; leave decorative or missing data outside the calculation map."], explanation: `The accepted plan identifies the dependency between steps: ${plan.join("; then ")}. It reaches the stated final quantity rather than stopping at useful intermediate work.`, tag, repair: "Hide the numbers, name each quantity, sort cards into KNOWN / FIND FIRST / FIND LAST, then return only the relevant numbers to the labelled map." });
}

function buildChangeChain(index) {
  const context = contexts[index % contexts.length];
  const start = 18000 + index * 941;
  const a = 1200 + (index % 8) * 173;
  const b = 650 + (index % 7) * 121;
  const c = 300 + (index % 5) * 89;
  const patterns = [[a, -b], [-b, a], [a, -b, c], [-b, a, -c]];
  const changes = patterns[index % patterns.length];
  const intermediates = [];
  let running = start;
  for (const change of changes) { running += change; intermediates.push(running); }
  const answer = running;
  const changeText = changes.map((value) => value >= 0 ? `receives ${value}` : `sends out ${Math.abs(value)}`).join(", then ");
  const operations = changes.map((value) => value >= 0 ? "addition" : "subtraction");
  return candidate({ index, family: `change-${index % 4}`, format: "calculation-chain", blueprint: "additive-change-chains", band: changes.length === 2 ? "expected" : "secure", operationScope: "addition_subtraction", prompt: `Calculation-chain mission ${index + 1}: a ${context.place} starts with ${start} ${context.unit}, ${changeText}. How many ${context.unit} remain?`, body: { start, changes, operations, intermediate_results: intermediates, choices: numericChoices(answer, context.unit), integrity: { type: "change_chain", start, changes, expected: answer }, estimate_range: estimateRange(answer), labelled_chain_required: true }, answer, unit: context.unit, hints: ["Write each increase or decrease as a signed change and keep the intermediate result labelled.", "Estimate by rounding each quantity, then compare the exact result with that range."], explanation: `${chainText(start, changes, intermediates)} The final result is ${answer} ${context.unit}, and the labelled intermediate values show that every story change has been used once.`, tag: "number_order_operation", repair: "Use one before/change/after card at a time. Preserve correct intermediate results, attach the unit to each card and compare the final result with the estimate band." });
}

function buildRelationship(index) {
  const context = contexts[index % contexts.length];
  const family = index % 5;
  const a = 2400 + index * 83;
  const difference = 350 + (index % 7) * 65;
  const used = 420 + (index % 5) * 71;
  const groups = 5 + index % 6;
  const each = 30 + (index % 8) * 6;
  let prompt;
  let answer;
  let operations;
  let integrity;
  let model;
  let operationScope = "addition_subtraction";
  if (family === 0) {
    const b = a + difference;
    answer = a + b - used;
    operations = ["addition to find greater amount", "addition to combine", "subtraction to find remaining"];
    prompt = `Bar-model route ${index + 1}: Team A records ${a} ${context.unit}. Team B records ${difference} more than Team A. After combining both amounts, ${used} are removed. How many remain?`;
    integrity = { type: "greater_combine_remove", a, difference, used, expected: answer };
    model = "A bar; B bar = A + difference; combined bar; removed part";
  } else if (family === 1) {
    const larger = a + difference;
    answer = larger - difference + used;
    operations = ["subtraction to find smaller amount", "addition to include new amount"];
    prompt = `Comparison route ${index + 1}: a larger group has ${larger} ${context.unit}, which is ${difference} more than the smaller group. The smaller group then gains ${used}. What is its new amount?`;
    integrity = { type: "smaller_then_add", larger, difference, used, expected: answer };
    model = "larger bar = smaller bar + difference; then extend smaller bar";
  } else if (family === 2) {
    const total = a + difference + used;
    answer = total - a - difference;
    operations = ["subtraction to remove known part", "subtraction to remove second known part"];
    prompt = `Part-whole route ${index + 1}: a total of ${total} ${context.unit} has parts of ${a}, ${difference} and one hidden part. Find the hidden part.`;
    integrity = { type: "missing_part", total, parts: [a, difference], expected: answer };
    model = "whole bar split into two known parts and one unknown part";
  } else if (family === 3) {
    answer = groups * each + used;
    operations = ["multiplication for equal groups", "addition for extra amount"];
    prompt = `Transfer bar model ${index + 1}: ${groups} equal groups contain ${each} ${context.unit} each, with ${used} extra. Find the total.`;
    integrity = { type: "groups_plus_extra", groups, each, extra: used, expected: answer };
    model = `${groups} equal bars of ${each}, plus an extra bar of ${used}`;
    operationScope = "multiplication_then_addition_transfer";
  } else {
    const total = groups * each;
    answer = total / groups + used;
    operations = ["division to find one equal share", "addition for extra amount"];
    prompt = `Equal-share transfer ${index + 1}: ${total} ${context.unit} are shared equally among ${groups} stations. One station then receives ${used} more. What does that station have?`;
    integrity = { type: "share_then_add", total, groups, extra: used, expected: answer };
    model = `whole ${total} split into ${groups} equal bars, then one bar extended by ${used}`;
    operationScope = "division_then_addition_transfer";
  }
  return candidate({ index, family: `relationship-${family}`, format: "problem-map", blueprint: "comparison-relationship-plans", band: family < 3 ? "expected" : "secure", operationScope, prompt, body: { bar_model_description: model, operation_reasons: operations, choices: numericChoices(answer, context.unit), integrity, keyword_warning: "operations_follow_quantity_relationships_not_isolated_words" }, answer, unit: context.unit, hints: ["Build the bars and mark the unknown before selecting an operation.", `Use this relationship sequence: ${operations.join("; then ")}.`], explanation: `${operations.join("; then ")}. The completed relationship gives ${answer} ${context.unit}; each operation is justified by the model, not by a single keyword.`, tag: "keyword_operation_choice", repair: "Replace keywords with labelled bars for whole, parts, comparison difference or equal groups; point to the unknown and state what each operation finds." });
}

function buildErrorAnalysis(index) {
  const context = contexts[index % contexts.length];
  const start = 9000 + index * 157;
  const added = 700 + (index % 9) * 91;
  const removed = 380 + (index % 6) * 67;
  const correctIntermediate = start + added;
  const correctFinal = correctIntermediate - removed;
  const family = index % 5;
  let shownSteps;
  let answer;
  let errorDetail;
  if (family === 0) {
    const wrongIntermediate = start - added;
    shownSteps = [`${start} - ${added} = ${wrongIntermediate}`, `${wrongIntermediate} - ${removed} = ${wrongIntermediate - removed}`];
    answer = "first operation";
    errorDetail = "The received amount should increase the starting quantity.";
  } else if (family === 1) {
    const wrongIntermediate = correctIntermediate + 100;
    shownSteps = [`${start} + ${added} = ${wrongIntermediate}`, `${wrongIntermediate} - ${removed} = ${wrongIntermediate - removed}`];
    answer = "first arithmetic";
    errorDetail = `The first sum should be ${correctIntermediate}, not ${wrongIntermediate}.`;
  } else if (family === 2) {
    shownSteps = [`${start} + ${added} = ${correctIntermediate}`, `submitted ${correctIntermediate} as the final answer`];
    answer = "stopped at the intermediate result";
    errorDetail = `The story still requires subtracting ${removed}.`;
  } else if (family === 3) {
    const wrongFinal = correctIntermediate + removed;
    shownSteps = [`${start} + ${added} = ${correctIntermediate}`, `${correctIntermediate} + ${removed} = ${wrongFinal}`];
    answer = "second operation";
    errorDetail = "The amount sent out should decrease the intermediate total.";
  } else {
    shownSteps = [`${start} + ${added} = ${correctIntermediate}`, `${correctIntermediate} - ${removed} = ${correctFinal}`, `check: ${correctFinal} - ${removed} = ${correctIntermediate}`];
    answer = "inverse check";
    errorDetail = `To invert the final subtraction, calculate ${correctFinal} + ${removed} = ${correctIntermediate}.`;
  }
  const repair = `${start} + ${added} = ${correctIntermediate}; ${correctIntermediate} - ${removed} = ${correctFinal}`;
  return candidate({ index, family: `error-${family}`, format: "error-analysis", blueprint: "first-error-chain-repair", band: family < 2 ? "expected" : "secure", operationScope: "addition_subtraction", prompt: `Debug mission ${index + 1}: a ${context.place} starts with ${start} ${context.unit}, receives ${added} and sends out ${removed}. Inspect the shown chain and identify the first error.`, body: { shown_steps: shownSteps, correct_repair_chain: repair, choices: [answer, ...["first operation", "first arithmetic", "stopped at the intermediate result", "second operation", "inverse check", "no error"].filter((item) => item !== answer).slice(0, 3)], integrity: { type: "seeded_error", family, start, added, removed, correctIntermediate, correctFinal, expected: answer }, first_error_only: true }, answer, unit: null, hints: ["Check what the first operation is meant to find before checking later arithmetic.", "Later values may follow consistently from an early error; repair the earliest broken link first."], explanation: `${answer} is the first error. ${errorDetail} The repaired chain is ${repair}, leaving ${correctFinal} ${context.unit}.`, tag: "unchecked_intermediate_result", repair: "Compare each shown step with the labelled story relationship and estimate. Freeze the first broken link, repair it, then recalculate every dependent result." });
}

function buildMethodCheck(index) {
  const context = contexts[index % contexts.length];
  const family = index % 6;
  const a = 15000 + index * 223;
  const b = 1800 + (index % 7) * 145;
  const c = 650 + (index % 5) * 83;
  const groups = 6 + index % 7;
  const each = 32 + (index % 6) * 9;
  let prompt;
  let answer;
  let choices;
  let integrity;
  let operationScope = "addition_subtraction";
  let tag = "no_reasonableness_check";
  if (family === 0) {
    const exact = a + b - c;
    const range = estimateRange(exact);
    answer = `${range.min} to ${range.max} ${context.unit}`;
    prompt = `Estimate gate ${index + 1}: before solving ${a} + ${b} - ${c}, which range is reasonable?`;
    choices = [answer, `0 to 100 ${context.unit}`, `${exact * 10} to ${exact * 10 + 1000} ${context.unit}`, `${c} to ${b} ${context.unit}`];
    integrity = { type: "estimate_range", exact, range, expected: answer };
  } else if (family === 1) {
    const final = a + b - c;
    answer = `${final} + ${c} = ${a + b}`;
    prompt = `Inverse-check station ${index + 1}: after calculating ${a} + ${b} - ${c} = ${final}, which equation checks the final subtraction?`;
    choices = [answer, `${final} - ${c} = ${a + b}`, `${final} + ${b} = ${c}`, `${a + b} + ${c} = ${final}`];
    integrity = { type: "inverse_subtraction", a, b, c, final, expected: answer };
  } else if (family === 2) {
    answer = groups * each + c;
    prompt = `Mixed-operation transfer ${index + 1}: ${groups} crates hold ${each} ${context.unit} each and ${c} loose ${context.unit} are added. Find the total.`;
    choices = numericChoices(answer, context.unit);
    integrity = { type: "multiply_then_add", groups, each, extra: c, expected: answer };
    operationScope = "multiplication_then_addition_transfer";
  } else if (family === 3) {
    const total = groups * each;
    answer = total / groups + c;
    prompt = `Share-and-change transfer ${index + 1}: ${total} ${context.unit} are shared equally among ${groups} teams; one team then receives ${c} extra. How many does that team have?`;
    choices = numericChoices(answer, context.unit);
    integrity = { type: "divide_then_add", total, groups, extra: c, expected: answer };
    operationScope = "division_then_addition_transfer";
  } else if (family === 4) {
    answer = "Both routes are valid when every change is represented and the intermediate quantities remain labelled.";
    prompt = `Route-choice station ${index + 1}: Route A calculates (${a} + ${b}) - ${c}. Route B calculates ${a} + (${b} - ${c}). Which judgement is accurate?`;
    choices = [answer, "Only Route A is valid because it has more written lines.", "Only Route B is valid because it looks shorter.", "Neither route can represent the same net change."];
    integrity = { type: "equivalent_routes", a, b, c, expected: answer };
  } else {
    answer = "the number of items in each equal group";
    prompt = `Information audit ${index + 1}: a plan says to multiply ${groups} equal groups and then subtract ${c}, but it never states the size of each group. What information is missing?`;
    choices = [answer, "the colour of the group labels", "a larger starting number", "a keyword telling us to multiply"];
    integrity = { type: "missing_group_size", groups, subtract: c, expected: answer };
    operationScope = "multiplication_then_subtraction_transfer";
    tag = "calculates_without_required_information";
  }
  const unit = typeof answer === "number" ? context.unit : null;
  return candidate({ index, family: `method-${family}`, format: "method-choice", blueprint: "efficient-route-and-check", band: family < 2 ? "expected" : "stretch", operationScope, prompt, body: { choices, integrity, estimate_before_exact: family === 0, inverse_check_available: family === 1, valid_alternative_routes_accepted: family === 4 }, answer, unit, hints: ["State what each step finds and whether the next step depends on it.", "Use an estimate, inverse or second valid route to test the answer rather than judging by speed or number of written lines."], explanation: methodExplanation(integrity, answer, unit), tag, repair: "Use a step planner with METHOD / WHAT IT FINDS / CHECK columns. Accept any valid route that preserves the relationships, units and final target." });
}

function candidate({ index, family, format, blueprint, band, operationScope, prompt, body, answer, unit, hints, explanation, tag, repair }) {
  const id = `${prefix}${blueprint}-${String(index + 1).padStart(3, "0")}-${family}`;
  const choices = rotate([...new Set(body.choices.map(String))], index % body.choices.length);
  const fullExplanation = explanation.length >= 100 ? explanation : `${explanation} The labelled model, operation reason and check preserve the quantities and final unit.`;
  const audio = index % 15 === 0 ? { audio_optional: true, audio_asset_id: `narration-${id}`, audio_provider: "ElevenLabs", audio_asset_status: "required_human_listening_review", human_listening_approval_required: true } : { audio_required: false };
  return {
    id,
    format,
    body: {
      prompt, ...body, choices,
      operation_scope: operationScope,
      difficulty_band: band,
      evidence_purpose: `${blueprint}_plan_solve_check`,
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
      response_mode: "touch_keyboard_switch_eye_gaze_aac_point_or_adult_scribed",
      supported_interaction: "Select quantities, steps, operations, answers or reasons by touch, keyboard, switch scanning, eye-gaze dwell, AAC/pointing or learner-directed adult scribing; move menus, numbered destinations and step buttons replace fine dragging, handwriting and mandatory speech.",
      interaction_route: { touch: true, keyboard: true, switch_scan: true, eye_gaze: true, aac_or_point: true, adult_scribed: true, fine_drag_required: false, handwriting_required: false, speech_required: false },
      dyscalculia_support: { question_first_view: true, labelled_quantity_cards: true, one_step_at_a_time: true, persistent_units: true, bar_model_or_text_table: true, intermediate_results_preserved: true, estimate_band_available: true },
      reduced_visual_load: true,
      irrelevant_information_can_be_hidden: true,
      source_problem_remains_available: true,
      undo_available: true,
      retry_without_penalty: true,
      timer_allowed: false,
      speed_score_allowed: false,
      streaks_allowed: false,
      lives_allowed: false,
      browser_tts_allowed: false,
      browser_tts_fallback: "prohibited",
      ...audio,
      gamification: { mission: "repair one calm planning route", reward: "an evidence marker for a justified operation chain", timer: false, streak: false, lives: false, loss_on_error: false, retry_message: "That route gives useful planning evidence. Keep correct labels and results, open one relationship clue and retry without losing progress." },
    },
    expected_answer: unit ? { value: answer, unit } : { value: answer },
    hints,
    explanation: fullExplanation,
    feedback: {
      correct: `The plan and calculation evidence support the accepted response. ${fullExplanation}`,
      repair,
      evidence: `Check the final target, labelled quantities, operation relationships, intermediate results and units. Accepted response: ${answer}${unit ? ` ${unit}` : ""}.`,
      misconception_check: tag,
      check_prompt: "What does each step find, why must it happen there, and which estimate, inverse or alternative route checks the final result?",
      support_message: "Use a step planner, bar model, calculation table or spoken-approved narration route. Touch, keyboard, switch, eye gaze, AAC/pointing and adult scribing are equivalent; no timer, handwriting, speech or precision drag is required.",
      retry: "Correct quantity labels and independent working remain visible. Use one hint or representation toggle, then retry without penalty.",
    },
    difficulty: { developing: 4, expected: 6, secure: 7, stretch: 8 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: format === "problem-map" ? "dependency-map-build" : format === "calculation-chain" ? "calculation-chain-lock" : format === "error-analysis" ? "first-error-freeze" : "method-check-compare",
  };
}

function validateBank(currentPack, authored, generated, authoredSnapshot) {
  if (authored.length !== 4 || JSON.stringify(currentPack.question_variants.slice(0, 4)) !== authoredSnapshot) throw new Error("Curated variants changed or moved.");
  if (generated.length !== 236 || currentPack.question_variants.length !== pilotTarget) throw new Error("Expected 236 generated and 240 total variants.");
  const blueprintMap = new Map(currentPack.variant_blueprints.map((item) => [item.id, item]));
  const formats = new Set(currentPack.practice.formats);
  const ids = new Set();
  const signatures = new Set();
  for (const variant of currentPack.question_variants) {
    if (ids.has(variant.id)) throw new Error(`Duplicate id ${variant.id}.`);
    ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${normalise(variant.expected_answer)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate format/prompt/answer signature ${variant.id}.`);
    signatures.add(signature);
  }
  for (const variant of generated) {
    const blueprint = blueprintMap.get(variant.body.variant_blueprint_id);
    if (!blueprint || blueprint.format !== variant.format || !formats.has(variant.format)) throw new Error(`${variant.id} has invalid format or blueprint.`);
    validateIntegrity(variant);
    const expectedChoice = variant.expected_answer.unit ? `${variant.expected_answer.value} ${variant.expected_answer.unit}` : String(variant.expected_answer.value);
    if (variant.body.choices.length < 3 || !variant.body.choices.includes(expectedChoice)) throw new Error(`${variant.id} does not offer its accepted answer.`);
    if (!variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.evidence || !variant.feedback?.check_prompt || variant.hints.length < 2 || variant.explanation.length < 90) throw new Error(`${variant.id} lacks rich feedback.`);
    const route = variant.body.interaction_route;
    if (!route?.touch || !route?.keyboard || !route?.switch_scan || !route?.eye_gaze || !route?.aac_or_point || !route?.adult_scribed || route.fine_drag_required !== false || route.handwriting_required !== false || route.speech_required !== false) throw new Error(`${variant.id} lacks accessible response routes.`);
    if (!variant.body.dyscalculia_support?.one_step_at_a_time || !variant.body.dyscalculia_support?.persistent_units || variant.body.reduced_visual_load !== true) throw new Error(`${variant.id} lacks SEND/dyscalculia support.`);
    if (variant.body.timer_allowed !== false || variant.body.speed_score_allowed !== false || variant.body.streaks_allowed !== false || variant.body.lives_allowed !== false || variant.body.gamification?.loss_on_error !== false) throw new Error(`${variant.id} introduces performance pressure.`);
    if (variant.body.browser_tts_allowed !== false || variant.body.browser_tts_fallback !== "prohibited") throw new Error(`${variant.id} permits browser TTS.`);
    if (variant.body.audio_asset_id && (variant.body.audio_provider !== "ElevenLabs" || variant.body.audio_asset_status !== "required_human_listening_review" || variant.body.human_listening_approval_required !== true)) throw new Error(`${variant.id} has unreviewed audio metadata.`);
  }
  const allocation = { "identify-final-and-intermediate": 48, "additive-change-chains": 47, "comparison-relationship-plans": 47, "first-error-chain-repair": 47, "efficient-route-and-check": 47 };
  for (const [blueprint, expected] of Object.entries(allocation)) {
    const actual = generated.filter((variant) => variant.body.variant_blueprint_id === blueprint).length;
    if (actual !== expected) throw new Error(`${blueprint} expected ${expected}, found ${actual}.`);
  }
}

function validateIntegrity(variant) {
  const i = variant.body.integrity;
  let actual;
  if (i.type === "change_chain") actual = i.changes.reduce((value, change) => value + change, i.start);
  else if (i.type === "greater_combine_remove") actual = i.a + (i.a + i.difference) - i.used;
  else if (i.type === "smaller_then_add") actual = i.larger - i.difference + i.used;
  else if (i.type === "missing_part") actual = i.total - i.parts.reduce((sum, value) => sum + value, 0);
  else if (i.type === "groups_plus_extra" || i.type === "multiply_then_add") actual = i.groups * i.each + i.extra;
  else if (i.type === "share_then_add" || i.type === "divide_then_add") actual = i.total / i.groups + i.extra;
  else if (i.type === "seeded_error") {
    if (i.correctIntermediate !== i.start + i.added || i.correctFinal !== i.correctIntermediate - i.removed || i.correctFinal < 0) throw new Error(`${variant.id} has an invalid repair chain.`);
    actual = ["first operation", "first arithmetic", "stopped at the intermediate result", "second operation", "inverse check"][i.family];
  } else if (i.type === "estimate_range") actual = `${i.range.min} to ${i.range.max} ${variant.body.choices.find((choice) => choice.startsWith(`${i.range.min} to ${i.range.max}`))?.split(" ").at(-1)}`;
  else if (i.type === "inverse_subtraction") actual = `${i.final} + ${i.c} = ${i.a + i.b}`;
  else if (i.type === "equivalent_routes" || i.type === "missing_group_size" || i.type.startsWith("plan_") || ["irrelevant_information", "missing_factor", "intermediate_target", "hidden_product"].includes(i.type)) actual = i.expected;
  else throw new Error(`${variant.id} has unknown integrity type ${i.type}.`);
  if (actual !== i.expected || actual !== variant.expected_answer.value) throw new Error(`${variant.id} failed arithmetic/content integrity: ${actual} != ${i.expected}.`);
  if (typeof variant.expected_answer.value === "number" && (!Number.isInteger(variant.expected_answer.value) || variant.expected_answer.value < 0)) throw new Error(`${variant.id} has an invalid numeric result.`);
}

function numericChoices(answer, unit) {
  const delta = Math.max(10, Math.round(Math.max(1, answer) / 20 / 10) * 10);
  return [`${answer} ${unit}`, `${answer + delta} ${unit}`, `${Math.max(0, answer - delta)} ${unit}`, `${answer + 2 * delta} ${unit}`];
}
function estimateRange(answer) { const rounded = Math.round(answer / 1000) * 1000; return { min: Math.max(0, rounded - 1000), max: rounded + 1000 }; }
function chainText(start, changes, intermediates) { let previous = start; return changes.map((change, index) => { const text = `${previous} ${change >= 0 ? "+" : "-"} ${Math.abs(change)} = ${intermediates[index]}`; previous = intermediates[index]; return text; }).join(", then "); }
function methodExplanation(i, answer, unit) {
  if (i.type === "estimate_range") return `The exact result is ${i.exact}, so the rounded estimate band ${answer} contains it and rejects results with the wrong magnitude.`;
  if (i.type === "inverse_subtraction") return `${answer} reverses the final subtraction and returns to the previous combined total.`;
  if (i.type === "multiply_then_add") return `${i.groups} × ${i.each} = ${i.groups * i.each}, then add ${i.extra} to obtain ${answer} ${unit}.`;
  if (i.type === "divide_then_add") return `${i.total} ÷ ${i.groups} = ${i.total / i.groups}, then add ${i.extra} to obtain ${answer} ${unit}.`;
  if (i.type === "equivalent_routes") return `${answer} Addition and subtraction here represent the same net changes because ${i.b} - ${i.c} is grouped without changing either quantity's sign.`;
  return `${answer} is required before a complete multiplication-and-change result can be calculated; guessing would hide missing information.`;
}
function rotate(values, by) { const offset = by % values.length; return [...values.slice(offset), ...values.slice(0, offset)]; }
function normalise(value) { return JSON.stringify(value).toLowerCase().replaceAll(/[^a-z0-9]+/g, " ").trim(); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
function summary(items, keyFor) { const counts = new Map(); for (const item of items) counts.set(keyFor(item), (counts.get(keyFor(item)) ?? 0) + 1); return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(","); }
