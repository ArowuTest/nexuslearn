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
const extensionPrefix = "ma-y4-number-multiplication-12x12-depth-";
const reviewBatch = "y4-multiplication-depth-pilot-a";
const baseTarget = 126;
const pilotTarget = 240;

const recallFacts = [];
for (const first of [2, 3, 4, 5, 10, 11]) for (const second of [7, 8, 9, 12]) recallFacts.push([first, second]);

const arrayFacts = [[6, 7], [6, 8], [6, 9], [7, 8], [7, 9], [7, 12], [8, 9], [8, 12], [9, 12], [11, 7], [11, 8], [12, 12]];
const divisionFacts = [[6, 8], [7, 8], [7, 9], [8, 9], [6, 12], [7, 12], [8, 12], [9, 12], [11, 6], [11, 8], [11, 12]];
const transferFacts = [[3, 8], [4, 9], [5, 12], [6, 7], [6, 9], [7, 8], [7, 12], [8, 9], [8, 12], [9, 11], [12, 12]];
const reviewFacts = [[6, 7], [6, 8], [7, 8], [7, 9], [8, 9], [9, 12], [11, 7], [11, 8], [12, 7], [12, 8], [12, 12]];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y4-number-multiplication-12x12") throw new Error("This generator only supports the Year 4 multiplication flagship pack.");

const preserved = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(extensionPrefix));
if (preserved.length !== baseTarget) throw new Error(`Expected ${baseTarget} preserved variants, found ${preserved.length}. Refusing to rewrite the base bank.`);

const extensions = [
  ...recallCandidates(),
  ...arrayCandidates(),
  ...divisionCandidates(),
  ...transferCandidates(),
  ...reviewCandidates(),
];

pack.question_variants = [...preserved, ...extensions];
pack.version = "0.3.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Depth-wave review bank reaches the 240-item pilot target while preserving all 126 prior variants unchanged and appending 114 deterministic candidates. The extension strengthens mixed 12x12 recall, commutativity, arrays, efficient decomposition, inverse division, derived facts, transfer reasoning and named misconception repairs. Timed-recall remains untimed by default with no speed score or penalty; generated candidates include SEND alternatives, supported non-drag interactions, rich feedback and strategic low-pressure forge missions. Independent mathematics, teacher, accessibility, safeguarding and renderer review remain required before promotion.";
validateBank(pack, preserved, extensions);

console.log(`y4-multiplication-bank preserved=${preserved.length} depth_candidates=${extensions.length} total=${pack.question_variants.length}`);
console.log(`y4-multiplication-bank formats=${summary(extensions, (variant) => variant.format)}`);
console.log(`y4-multiplication-bank blueprints=${summary(extensions, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`y4-multiplication-bank bands=${summary(extensions, (variant) => variant.body.difficulty_band)}`);
console.log(`y4-multiplication-bank coverage=${coverageSummary(extensions)}`);

const nextText = `${JSON.stringify(pack, null, 2)}\n`;
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y4-multiplication-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 4 multiplication bank is out of date; run generate-y4-multiplication-bank.mjs --write.");
  console.log("y4-multiplication-bank deterministic check passed");
} else {
  console.log("y4-multiplication-bank dry-run; pass --write to update the pack");
}

function recallCandidates() {
  return recallFacts.map(([a, b], index) => {
    const product = a * b;
    const reversed = `${b} × ${a}`;
    const anchor = a === 11 ? 10 : a === 10 ? 5 : Math.max(1, a - 1);
    return makeVariant({
      id: `recall-${a}x${b}`,
      format: "timed-recall",
      blueprint: "core-table-fluency-grid",
      strand: "recall_and_commutativity",
      stage: index < 8 ? "supported_recall" : "mixed_recall",
      band: index < 4 ? "intro" : index < 12 ? "developing" : "expected",
      prompt: `Relay ${index + 1}: ${a} × ${b} = ?`,
      answer: product,
      hints: [`Turn the array if useful: ${reversed} has the same product.`, `${anchor} × ${b} = ${anchor * b}; adjust by ${a - anchor} group${a - anchor === 1 ? "" : "s"} of ${b}.`],
      explanation: `${a} × ${b} = ${product}. Turning a ${a}-by-${b} array gives ${b} × ${a} without changing the number of cells.`,
      misconception: "confuses_factor_pairs",
      purpose: "mixed_recall_with_commutative_check",
      coverage: ["12x12_recall", "commutativity", "derived_fact", "misconception"],
      body: { a, b, product, input: "number", commutative_fact: `${b} × ${a} = ${product}`, derived_anchor: `${anchor} × ${b} = ${anchor * b}` },
    });
  });
}

function arrayCandidates() {
  const variants = [];
  for (const [rows, columns] of arrayFacts) {
    const product = rows * columns;
    const split = rows >= 10 ? 10 : rows >= 7 ? 5 : rows - 1;
    const remainder = rows - split;
    variants.push(makeVariant({
      id: `array-${rows}x${columns}-build`, format: "array-build", blueprint: "array-decomposition-builds", strand: "arrays", stage: "build_and_count_array", band: "developing",
      prompt: `Build ${rows} equal rows of ${columns}. How many cells are in the complete array?`, answer: product,
      hints: [`Build ${split} rows of ${columns} first.`, `Add ${remainder} more row${remainder === 1 ? "" : "s"} of ${columns}.`],
      explanation: `${rows} rows of ${columns} contain ${product} cells. The split ${split} × ${columns} plus ${remainder} × ${columns} recombines the same array.`,
      misconception: "counts_every_fact_from_start", purpose: "array_product_build", coverage: ["arrays", "equal_groups", "decomposition", "derived_fact"],
      body: { rows, columns, product, input: "number", split_rows: [split, remainder], decomposition: `${split} × ${columns} + ${remainder} × ${columns} = ${product}` },
    }));
    const strategy = `${split} × ${columns} + ${remainder} × ${columns} = ${product}`;
    variants.push(makeVariant({
      id: `array-${rows}x${columns}-reason`, format: "array-build", blueprint: "array-decomposition-builds", strand: "commutativity_and_decomposition", stage: "choose_efficient_array_strategy", band: "expected",
      prompt: `Which strategy preserves all ${rows} rows of ${columns} and finds the product efficiently?`, answer: strategy,
      choices: [strategy, `${rows} + ${columns} = ${rows + columns}`, `${split} × ${columns} = ${split * columns} and ignore the remaining rows`, `${rows} × ${columns - 1} = ${rows * (columns - 1)} without replacing the missing column`],
      hints: ["Every row must appear exactly once.", `Split ${rows} into ${split} and ${remainder}, while keeping each row size ${columns}.`],
      explanation: `${split} + ${remainder} = ${rows}, so the two smaller arrays contain every cell exactly once and total ${product}.`,
      misconception: "additive_instead_of_multiplicative", purpose: "efficient_array_decomposition_reasoning", coverage: ["arrays", "decomposition", "reasoning", "misconception"],
      body: { rows, columns, product, split_rows: [split, remainder], strategy_choices: true },
    }));
  }
  return variants;
}

function divisionCandidates() {
  const variants = [];
  for (const [a, b] of divisionFacts) {
    const product = a * b;
    for (const [divisor, quotient, mode] of [[a, b, "groups_known"], [b, a, "group_size_known"]]) {
      variants.push(makeVariant({
        id: `division-${product}-by-${divisor}`,
        format: "division-match", blueprint: "division-family-matches", strand: "inverse_division", stage: mode === "groups_known" ? "find_group_size" : "find_group_count", band: "secure",
        prompt: `${product} cells are arranged in equal groups of ${divisor}. What is the missing factor?`, answer: quotient,
        hints: [`Think: ${divisor} × ? = ${product}.`, `Use the fact family ${a} × ${b} = ${product}.`],
        explanation: `${product} ÷ ${divisor} = ${quotient} because ${divisor} × ${quotient} = ${product}. Multiplication checks the inverse division fact.`,
        misconception: "does_not_connect_division_facts", purpose: "inverse_division_missing_factor", coverage: ["inverse_division", "fact_family", "missing_factor", "reasoning"],
        body: { dividend: product, divisor, quotient, factors: [a, b], input: "number", fact_family: [`${a} × ${b} = ${product}`, `${b} × ${a} = ${product}`, `${product} ÷ ${a} = ${b}`, `${product} ÷ ${b} = ${a}`] },
      }));
    }
  }
  return variants;
}

function transferCandidates() {
  const contexts = ["solar-panel grid", "supply-crate layer", "garden-plot map", "window-tile panel", "signal-board grid", "archive-tray layout", "bridge-bolt plan", "stage-light board", "robot-parts tray", "observatory chart", "forge-cell panel"];
  const variants = [];
  for (const [index, [rows, columns]] of transferFacts.entries()) {
    const product = rows * columns;
    const context = contexts[index];
    variants.push(makeVariant({
      id: `transfer-${rows}x${columns}-one`, format: "array-build", blueprint: "area-and-scaling-transfer", strand: "array_transfer", stage: "apply_fact_to_rectangular_context", band: "stretch",
      prompt: `A ${context} has ${rows} equal rows of ${columns}. How many positions does it contain?`, answer: product,
      hints: ["Represent the context as a rectangular array.", `Use ${rows} × ${columns}.`],
      explanation: `The ${context} has ${rows} rows with ${columns} positions in each row, so it contains ${product} positions altogether.`,
      misconception: "adds_dimensions", purpose: "rectangular_array_transfer", coverage: ["arrays", "transfer", "reasoning", "misconception"],
      body: { context, rows, columns, copies: 1, product, input: "number", model: "labelled_rectangular_array" },
    }));
    const doubled = product * 2;
    variants.push(makeVariant({
      id: `transfer-${rows}x${columns}-double`, format: "array-build", blueprint: "area-and-scaling-transfer", strand: "derived_scaling", stage: "derive_double_array_total", band: "stretch",
      prompt: `Two identical ${context}s each have ${rows} rows of ${columns}. How many positions are there altogether?`, answer: doubled,
      hints: [`One grid has ${rows} × ${columns} = ${product} positions.`, `Double ${product} for two identical grids.`],
      explanation: `One ${context} contains ${product} positions. Two identical grids contain ${product} + ${product} = ${doubled}.`,
      misconception: "forgets_scale_factor", purpose: "derived_fact_double_transfer", coverage: ["derived_fact", "scaling", "transfer", "reasoning"],
      body: { context, rows, columns, copies: 2, one_grid_product: product, total: doubled, input: "number", derivation: `2 × (${rows} × ${columns}) = ${doubled}` },
    }));
  }
  return variants;
}

function reviewCandidates() {
  const variants = [];
  for (const [index, [a, b]] of reviewFacts.entries()) {
    const product = a * b;
    const anchor = a === 12 ? 10 : a >= 7 ? 5 : a - 1;
    const remainder = a - anchor;
    variants.push(makeVariant({
      id: `review-${a}x${b}-derive`, format: "timed-recall", blueprint: "spaced-review-fact-families", strand: "derived_fact_review", stage: "derive_from_known_anchor", band: "retrieval",
      prompt: `Return-route fact: use ${anchor} × ${b} to find ${a} × ${b}.`, answer: product,
      hints: [`${anchor} × ${b} = ${anchor * b}.`, `Add ${remainder} more group${remainder === 1 ? "" : "s"} of ${b}.`],
      explanation: `${anchor * b} + ${remainder * b} = ${product}, so ${a} × ${b} = ${product}. This derives the fact instead of counting from one.`,
      misconception: "counts_every_fact_from_start", purpose: "spaced_derived_fact_retrieval", coverage: ["spaced_retrieval", "derived_fact", "decomposition", "recall"],
      body: { a, b, product, input: "number", anchor_fact: `${anchor} × ${b} = ${anchor * b}`, review_interval_days: [1, 3, 7, 14, 30][index % 5] },
    }));
    const wrong = product - b;
    variants.push(makeVariant({
      id: `review-${a}x${b}-repair`, format: "timed-recall", blueprint: "spaced-review-fact-families", strand: "misconception_repair", stage: "repair_nearby_fact_confusion", band: "retrieval",
      prompt: `A navigator says ${a} × ${b} = ${wrong}. What is the correct product?`, answer: product,
      hints: [`${wrong} is ${a - 1} × ${b}.`, `Add one more group of ${b}.`],
      explanation: `${wrong} is the nearby fact ${a - 1} × ${b}. Adding the missing group of ${b} gives ${product}.`,
      misconception: "nearby_fact_confusion", purpose: "spaced_misconception_repair", coverage: ["spaced_retrieval", "misconception", "nearby_fact", "reasoning"],
      body: { a, b, product, stated_wrong_product: wrong, input: "number", repair_step: `${wrong} + ${b} = ${product}`, review_interval_days: [1, 3, 7, 14, 30][(index + 2) % 5] },
    }));
  }
  return variants;
}

function makeVariant({ id, format, blueprint, strand, stage, band, prompt, answer, choices, hints, explanation, misconception, purpose, coverage, body }) {
  const fullId = `${extensionPrefix}${id}`;
  const interactionChoices = choices ? rotate(unique(choices), fullId.length % choices.length) : undefined;
  return {
    id: fullId,
    format,
    body: {
      prompt,
      ...(interactionChoices ? { choices: interactionChoices } : {}),
      ...body,
      strand,
      coverage_tags: coverage,
      conceptual_progression: stage,
      difficulty_band: band,
      evidence_purpose: purpose,
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
      response_mode: "untimed_keyboard_switch_touch_numeric_oral_or_partner_recorded",
      timed_format_policy: { untimed_default: true, timer_visible: false, timer_optional: false, speed_score: false, answer_after_pause: true, no_penalty_for_replay: true },
      interaction_support: { keyboard: true, switch_scan: true, touch: true, numeric_entry: true, oral_or_partner_recording: true, drag_required: false, undo_available: true },
      send_scaffolds: { one_step_prompt: true, fact_family_card: true, known_fact_anchor: true, array_masking: true, repeated_rehearsal: true, no_time_limit: true },
      alternatives: { visual: "static patterned array with row and column labels", tactile: "adult-prepared counters, row frames or multiplication grid", text: "linear equal-groups description and fact-family table", low_vision: "high-contrast outlines, large numerals and pattern rather than colour" },
      reduced_visual_load: true,
      reduced_motion_alternative: "instant labelled array states with no orbiting, pulsing or countdown animation",
      feedback_mode: "retain the known fact, identify one missing or extra group, then rebuild the target without failure language",
      mission: missionFor(strand, stage, fullId, body),
      pressure_rules: { timer: false, speed_score: false, streak_loss: false, lives: false, public_ranking: false, retry_cost: false },
    },
    expected_answer: { value: answer },
    hints,
    explanation,
    feedback: {
      correct: `Relay secured using ${purpose.replaceAll("_", " ")}.`,
      repair: repairFor(strand, body),
      misconception_check: misconceptionFeedback(misconception),
      retry: "The forge keeps your correct steps. Choose another strategy and continue without a timer or penalty.",
    },
    difficulty: difficultyFor(band),
    status: "review",
    misconception_tag: misconception,
    animation_hook: animationFor(strand),
  };
}

function missionFor(strand, stage, id, body) {
  const sectors = { recall_and_commutativity: "Twin-Array Relay", arrays: "Array Forge", commutativity_and_decomposition: "Split-Route Foundry", inverse_division: "Inverse Orbit Locks", array_transfer: "Gridworks Outpost", derived_scaling: "Scaling Beacon", derived_fact_review: "Anchor-Fact Return Route", misconception_repair: "Fault-Finder Bay" };
  const tools = { recall_and_commutativity: "turn the array or use a nearby known fact", arrays: "build equal rows and split them efficiently", commutativity_and_decomposition: "preserve every row while choosing a useful split", inverse_division: "complete the multiplication fact family", array_transfer: "translate the context into rows and columns", derived_scaling: "find one grid, then scale the known total", derived_fact_review: "anchor, adjust and verify", misconception_repair: "identify the nearby fact and restore the missing group" };
  return {
    campaign: "Forge Network: Restore the Twelve Constellation Relays",
    sector: sectors[strand],
    mission_code: id.slice(-28),
    objective: `Complete the ${stage.replaceAll("_", " ")} phase and verify the relay value.`,
    strategic_tool: tools[strand],
    strategy_options: ["array", "commutative fact", "known-fact decomposition", "inverse fact family"],
    verification: body.fact_family ? "check with both multiplication and division" : body.decomposition ?? body.derivation ?? "check with a turned or split array",
    reward: { item: "constellation relay crystal", earned_for: "using a valid strategy or completing a repair", effect: "lights a route on the forge map without changing difficulty or adding pressure" },
    retry_protocol: "No energy, lives or progress are lost; the mission preserves correct groups and reveals a targeted strategy clue.",
  };
}

function validateBank(packData, baseVariants, generated) {
  if (baseVariants.length !== baseTarget) throw new Error(`Expected ${baseTarget} preserved variants.`);
  if (generated.length !== pilotTarget - baseTarget) throw new Error(`Expected ${pilotTarget - baseTarget} depth candidates, found ${generated.length}.`);
  if (packData.question_variants.length !== packData.practice.variant_targets.pilot || packData.question_variants.length !== pilotTarget) throw new Error(`Pilot bank must contain exactly ${pilotTarget} variants.`);
  for (let index = 0; index < baseVariants.length; index += 1) if (packData.question_variants[index] !== baseVariants[index]) throw new Error(`Preserved variant reference changed at index ${index}.`);
  const blueprintMap = new Map(packData.variant_blueprints.map((item) => [item.id, item]));
  const ids = new Set(); const signatures = new Set(); const coverage = new Set(); const formats = new Set(); const blueprints = new Set(); const bands = new Set();
  for (const variant of packData.question_variants) {
    if (ids.has(variant.id)) throw new Error(`Duplicate id ${variant.id}.`); ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${normalise(variant.expected_answer?.value)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`); signatures.add(signature);
  }
  for (const variant of generated) {
    const blueprint = blueprintMap.get(variant.body.variant_blueprint_id);
    if (!blueprint || variant.format !== blueprint.format) throw new Error(`${variant.id} does not match its blueprint format.`);
    if (variant.status !== "review") throw new Error(`${variant.id} must remain in review.`);
    if (variant.body.choices && (variant.body.choices.length < 4 || new Set(variant.body.choices).size !== variant.body.choices.length || variant.body.choices.filter((choice) => choice === variant.expected_answer.value).length !== 1)) throw new Error(`${variant.id} has invalid choices.`);
    if (!variant.body.timed_format_policy?.untimed_default || variant.body.timed_format_policy?.timer_optional !== false || variant.body.timed_format_policy?.speed_score !== false) throw new Error(`${variant.id} introduces timed pressure.`);
    if (!variant.body.interaction_support?.keyboard || !variant.body.interaction_support?.switch_scan || variant.body.interaction_support?.drag_required !== false) throw new Error(`${variant.id} lacks supported interactions.`);
    if (!variant.body.send_scaffolds?.known_fact_anchor || !variant.body.alternatives?.tactile || !variant.body.alternatives?.text || variant.body.reduced_visual_load !== true) throw new Error(`${variant.id} lacks SEND alternatives.`);
    if (Object.values(variant.body.pressure_rules).some((value) => value !== false) || !/No energy/.test(variant.body.mission?.retry_protocol) || !variant.body.mission?.strategic_tool) throw new Error(`${variant.id} lacks low-pressure mission design.`);
    if (!variant.feedback?.repair || !variant.feedback?.misconception_check || !variant.feedback?.retry || variant.hints.length < 2 || variant.explanation.length < 65) throw new Error(`${variant.id} lacks rich feedback.`);
    validateMath(variant);
    for (const tag of variant.body.coverage_tags) coverage.add(tag);
    formats.add(variant.format); blueprints.add(variant.body.variant_blueprint_id); bands.add(variant.body.difficulty_band);
  }
  assertCovered("blueprints", new Set(blueprintMap.keys()), blueprints);
  assertCovered("difficulty bands", new Set([...packData.practice.difficulty_bands, ...packData.variant_blueprints.map((item) => item.difficulty_band)]), bands);
  assertCovered("depth coverage", new Set(["12x12_recall", "arrays", "commutativity", "inverse_division", "derived_fact", "reasoning", "misconception"]), coverage);
  const expectedCounts = { "core-table-fluency-grid": 24, "array-decomposition-builds": 24, "division-family-matches": 22, "area-and-scaling-transfer": 22, "spaced-review-fact-families": 22 };
  const actualCounts = countBy(generated, (variant) => variant.body.variant_blueprint_id);
  for (const [blueprint, expected] of Object.entries(expectedCounts)) if (actualCounts[blueprint] !== expected) throw new Error(`${blueprint} expected ${expected}, found ${actualCounts[blueprint] ?? 0}.`);
}

function validateMath(variant) {
  const body = variant.body;
  if (Number.isInteger(body.a) && Number.isInteger(body.b) && body.product !== body.a * body.b) throw new Error(`${variant.id} has an invalid product.`);
  if (Number.isInteger(body.rows) && Number.isInteger(body.columns)) {
    const expected = body.rows * body.columns;
    if ((body.product ?? body.one_grid_product) !== expected) throw new Error(`${variant.id} has invalid array data.`);
    if (body.copies === 2 && body.total !== expected * 2) throw new Error(`${variant.id} has invalid scaling data.`);
  }
  if (Number.isInteger(body.dividend) && body.dividend / body.divisor !== body.quotient) throw new Error(`${variant.id} has invalid division data.`);
}

function repairFor(strand, body) { if (strand === "inverse_division") return `Write ${body.divisor} × ? = ${body.dividend}, build that row if needed, then check the quotient.`; if (strand === "misconception_repair") return `Name the nearby fact, then restore the missing group shown in ${body.repair_step}.`; if (strand === "derived_scaling") return "Find one complete grid first, preserve that total, then double it for two identical grids."; if (strand.includes("array") || strand === "arrays" || strand.includes("commutativity")) return "Keep the row size fixed, show every row exactly once and recombine the split array."; return "Turn the array or start from the shown anchor fact, adjust by complete equal groups and verify the product."; }
function misconceptionFeedback(tag) { return ({ confuses_factor_pairs: "Check both factor labels; a nearby table fact may differ by one complete group.", counts_every_fact_from_start: "Use the known anchor instead of recounting every group from one.", additive_instead_of_multiplicative: "Rows of equal size require multiplication, not simply adding the two factors.", does_not_connect_division_facts: "Rewrite division as a missing-factor multiplication fact.", adds_dimensions: "Rows and columns describe equal groups; multiply them rather than adding dimensions.", forgets_scale_factor: "After finding one grid, include the number of identical copies.", nearby_fact_confusion: "Identify which nearby fact the wrong product actually represents." })[tag] ?? "Check the array structure and fact family."; }
function animationFor(strand) { return ({ recall_and_commutativity: "array-rotate-commute", arrays: "array-split-recombine", commutativity_and_decomposition: "array-strategy-route", inverse_division: "array-hide-row-count", array_transfer: "context-grid-build", derived_scaling: "double-grid-link", derived_fact_review: "anchor-fact-bridge", misconception_repair: "nearby-fact-repair" })[strand]; }
function difficultyFor(band) { return { intro: 3, developing: 4, expected: 5, secure: 7, stretch: 8, retrieval: 5 }[band]; }
function assertCovered(label, required, actual) { const missing = [...required].filter((value) => !actual.has(value)); if (missing.length) throw new Error(`Missing ${label}: ${missing.join(", ")}.`); }
function coverageSummary(variants) { const values = new Set(); for (const variant of variants) for (const tag of variant.body.coverage_tags) values.add(tag); return [...values].sort().join(","); }
function countBy(items, keyFor) { const counts = {}; for (const item of items) { const key = keyFor(item); counts[key] = (counts[key] ?? 0) + 1; } return counts; }
function summary(items, keyFor) { return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function unique(items) { return [...new Set(items)]; }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
