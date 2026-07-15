#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/ma-y3-number-recall-3-4-8-tables.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y3-tables-bank-";
const reviewBatch = "y3-tables-production-pilot-a";
const pilotAllocation = {
  "equal-group-array-builds": 48,
  "double-four-to-eight": 48,
  "multiplication-division-families": 48,
  "mixed-low-pressure-recall": 48,
  "fact-retrieval-spaced": 48,
};
const multipliers = Array.from({ length: 12 }, (_, index) => index + 1);
const contexts = ["seed packet", "story bundle", "drum-beat card", "garden marker", "shell box", "art pack", "team badge", "lantern hook", "robot wheel", "picnic plate", "map tile", "library shelf"];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y3-number-recall-3-4-8-tables") throw new Error("This generator only supports the Year 3 3, 4 and 8 tables pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedAllocation = countBy(curated, curatedBlueprint);
const targets = Object.fromEntries(Object.entries(pilotAllocation).map(([id, total]) => [id, total - (curatedAllocation[id] ?? 0)]));
for (const [blueprint, count] of Object.entries(targets)) if (count < 0) throw new Error(`Curated variants exceed ${blueprint}.`);

const generated = [
  ...arrayCandidates(targets["equal-group-array-builds"]),
  ...doublingCandidates(targets["double-four-to-eight"]),
  ...familyCandidates(targets["multiplication-division-families"]),
  ...mixedCandidates(targets["mixed-low-pressure-recall"]),
  ...retrievalCandidates(targets["fact-retrieval-spaced"]),
];

const enrichedCurated = curated.map(enrichVariant);
const enrichedGenerated = generated.map(enrichVariant);
pack.question_variants = [...enrichedCurated, ...enrichedGenerated];
pack.version = "0.2.0";
pack.adaptive_support.audio_first = "Audio is optional and unnecessary for generated fact work because complete array, concrete, symbolic and adult/partner reading routes are provided. Browser TTS is prohibited; any future narration must be a human-reviewed ElevenLabs asset and must not replace visible text or manipulatives.";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Review-stage Year 3 multiplication and division pack with a deterministic 240-variant pilot bank and three preserved curated variants. Coverage develops 3, 4 and 8 facts through equal groups, arrays, commutativity, doubling from 4 to 8, inverse families, missing factors, scaling contexts, misconception diagnosis, strategic reasoning and spaced retrieval. Generated timed-recall-format items are explicitly untimed and include strategy choice, concrete and visual SEND routes, supported non-drag interactions, rich feedback and pressure-free island workshop missions. Generated audio is unnecessary; browser TTS is prohibited and any future ElevenLabs asset requires human review. Independent mathematics, teacher, accessibility, safeguarding and renderer review remain required before promotion.";
validateBank(pack, enrichedCurated, enrichedGenerated);

console.log(`y3-tables-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y3-tables-bank blueprints=${allocationSummary(curated, generated)}`);
console.log(`y3-tables-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y3-tables-bank bands=${summary(generated, (variant) => variant.body.difficulty_band)}`);
console.log(`y3-tables-bank strands=${summary(generated, (variant) => variant.body.tables_strand)}`);

enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y3-tables-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 3 tables bank is out of date; run generate-y3-tables-bank.mjs --write.");
  console.log("y3-tables-bank deterministic check passed");
} else {
  console.log("y3-tables-bank dry-run; pass --write to update the pack");
}

function arrayCandidates(count) {
  const variants = [];
  for (const n of multipliers) {
    const context = contexts[n - 1];
    const modes = [
      arrayMode(n, 3, "build-three", "arrays", "build_equal_group_array", context),
      arrayMode(n, 4, "group-four", "equal_groups", "connect_groups_to_array", context),
      arrayMode(n, 8, "turn-eight", "commutativity", "turn_array_commutatively", context),
      { id: `reason-${n}`, table: [3, 4, 8][(n - 1) % 3], strand: "reasoning", stage: "diagnose_unequal_group_model", prompt: `A model for ${[3, 4, 8][(n - 1) % 3]} × ${n} has one short group. Which repair makes the groups equal?`, answer: `Give every group ${n} counters before finding the total`, choices: [`Give every group ${n} counters before finding the total`, "Count the unequal groups as though they match", `Add the factors ${[3, 4, 8][(n - 1) % 3]} and ${n}`, "Change each group to a different size"], hints: ["Multiplication models equal groups.", `Each row needs exactly ${n} counters.`], explanation: `The array represents multiplication only when every one of its groups has ${n} counters. Repairing the short group restores equal-group structure.`, purpose: "equal_group_model_diagnosis", misconception: "unequal_groups_model", body: { groups: [3, 4, 8][(n - 1) % 3], group_size: n, model_has_short_group: true } },
    ];
    for (const mode of modes) variants.push(makeVariant({ ...mode, id: `array-${mode.id}`, format: "array-build", blueprint: "equal-group-array-builds" }));
  }
  return variants.slice(0, count);
}

function arrayMode(n, table, suffix, strand, stage, context) {
  const product = table * n;
  if (suffix === "turn-eight") return { id: `${suffix}-${n}`, table, strand, stage, prompt: `Turn an ${table}-by-${n} array. Which fact has the same ${product} cells?`, answer: `${n} × ${table} = ${product}`, choices: [`${n} × ${table} = ${product}`, `${n} + ${table} = ${n + table}`, `${table} × ${n + 1} = ${table * (n + 1)}`, `${product} ÷ ${table} = ${product}`], hints: ["Turning an array keeps every cell.", "The factors can swap order without changing the product."], explanation: `${table} × ${n} and ${n} × ${table} describe the same rectangular array in different orientations, so both products are ${product}.`, purpose: "array_commutativity", misconception: "swapping_factors_changes_product", body: { rows: table, columns: n, product, turned_rows: n, turned_columns: table } };
  return { id: `${suffix}-${n}`, table, strand, stage, prompt: `${table} equal groups each hold ${n} ${plural(context, n)}. How many ${plural(context, product)} are there altogether?`, answer: product, choices: numericChoices(product, [table + n, product - table, product + n]), hints: [`Build ${table} equal rows of ${n}.`, `Use ${table} × ${n}.`], explanation: `${table} equal groups of ${n} form a ${table}-by-${n} array with ${product} items altogether.`, purpose: suffix === "build-three" ? "three_table_array_build" : "four_table_equal_groups", misconception: "adds_factors_instead_of_multiplying", body: { rows: table, columns: n, groups: table, group_size: n, product, context } };
}

function doublingCandidates(count) {
  const variants = [];
  for (const n of multipliers) {
    const four = 4 * n;
    const eight = 8 * n;
    const modes = [
      { id: `derive-${n}`, strand: "doubling", stage: "double_four_groups_to_eight", prompt: `Use 4 × ${n} = ${four} to find 8 × ${n}.`, answer: eight, choices: numericChoices(eight, [four + 4, four + 8, eight - n]), hints: ["Eight groups are twice as many groups as four.", `Double ${four}.`], explanation: `Doubling the four equal groups makes eight equal groups while each group still contains ${n}; ${four} + ${four} = ${eight}.`, purpose: "double_four_fact_to_eight", misconception: "confuses_4x_8x", body: { n, known_fact: `4 × ${n} = ${four}`, target_fact: `8 × ${n} = ${eight}`, operation: "double" } },
      { id: `halve-${n}`, strand: "halving", stage: "halve_eight_groups_to_four", prompt: `Use 8 × ${n} = ${eight} to find 4 × ${n}.`, answer: four, choices: numericChoices(four, [eight - 4, eight - 8, four + n]), hints: ["Four groups are half as many groups as eight.", `Halve ${eight}.`], explanation: `Halving eight equal groups leaves four equal groups of the same size, so half of ${eight} is ${four}.`, purpose: "halve_eight_fact_to_four", misconception: "subtracts_four_instead_of_halving", body: { n, known_fact: `8 × ${n} = ${eight}`, target_fact: `4 × ${n} = ${four}`, operation: "halve" } },
      { id: `model-${n}`, strand: "visual_relationships", stage: "select_valid_double_array", prompt: `Which model correctly changes 4 × ${n} into 8 × ${n}?`, answer: `Copy the complete 4-by-${n} array once, keeping ${n} in every row`, choices: [`Copy the complete 4-by-${n} array once, keeping ${n} in every row`, `Add four loose counters to the ${four}-counter array`, `Change each row from ${n} to ${n + 1}`, "Remove half of every row"], hints: ["Double the number of equal rows.", "Keep the group size unchanged."], explanation: `A copied 4-by-${n} array contributes four more complete rows of ${n}, producing eight rows and preserving the equal group size.`, purpose: "doubling_array_model", misconception: "adds_four_not_double", body: { n, source_rows: 4, target_rows: 8, columns: n, source_product: four, target_product: eight } },
      { id: `repair-${n}`, strand: "misconceptions", stage: "diagnose_four_eight_confusion", prompt: `A learner says 8 × ${n} is ${four + 4} because they added 4 to 4 × ${n}. What is the correction?`, answer: `Double ${four} to get ${eight}`, choices: [`Double ${four} to get ${eight}`, `Keep ${four + 4} because 8 means add 4`, `Add ${n} once to get ${four + n}`, `Subtract 4 from ${four}`], hints: ["The number of groups doubles from four to eight.", "Copy all four original groups, not four individual counters."], explanation: `Moving from four groups to eight groups adds another complete set of four groups. Therefore ${four} must be doubled, giving ${eight}.`, purpose: "four_to_eight_misconception_repair", misconception: "adds_four_not_double", body: { n, incorrect_answer: four + 4, known_product: four, correct_product: eight } },
    ];
    for (const mode of modes) variants.push(makeVariant({ ...mode, id: `double-${mode.id}`, table: 8, format: "array-build", blueprint: "double-four-to-eight" }));
  }
  return variants.slice(0, count);
}

function familyCandidates(count) {
  const variants = [];
  for (const n of multipliers) {
    const table = [3, 4, 8][(n - 1) % 3];
    const product = table * n;
    const family = [`${table} × ${n} = ${product}`, `${n} × ${table} = ${product}`, `${product} ÷ ${table} = ${n}`, `${product} ÷ ${n} = ${table}`];
    const modes = [
      { id: `division-${n}`, strand: "inverse_families", stage: "match_inverse_division", prompt: `Which division fact belongs with ${table} × ${n} = ${product}?`, answer: `${product} ÷ ${table} = ${n}`, choices: [`${product} ÷ ${table} = ${n}`, `${product} ÷ ${n} = ${Math.max(1, table - 1)}`, `${table} ÷ ${n} = ${product + 1}`, `${product - table} ÷ ${table} = ${n}`], hints: ["Keep the same total and factors.", `Ask how many groups of ${table} fit into ${product}.`], explanation: `${product} ÷ ${table} = ${n} reverses ${table} × ${n} = ${product}, so both statements describe the same array and factor family.`, purpose: "inverse_division_match", misconception: "division_not_connected", body: { table, n, product, divisor: table, quotient: n, fact_family: family } },
      { id: `missing-${n}`, strand: "missing_factors", stage: "solve_missing_factor", prompt: `${table} × ? = ${product}. What is the missing factor?`, answer: n, choices: numericChoices(n, [table, product - table, n + table]), hints: [`Rewrite it as ${product} ÷ ${table}.`, "Check the answer by rebuilding the array."], explanation: `${product} ÷ ${table} = ${n}, so the missing factor is ${n}. Multiplying ${table} by ${n} checks the total ${product}.`, purpose: "missing_factor_inverse", misconception: "uses_subtraction_for_missing_factor", body: { table, n, product, missing_position: "second_factor", inverse_fact: `${product} ÷ ${table} = ${n}` } },
      { id: `commute-${n}`, strand: "commutativity", stage: "complete_commutative_family", prompt: `Which multiplication fact completes the family for ${table} × ${n} = ${product}?`, answer: `${n} × ${table} = ${product}`, choices: [`${n} × ${table} = ${product}`, `${n} + ${table} = ${product}`, `${table} × ${n + 1} = ${product}`, `${product} × ${table} = ${n}`], hints: ["Turn the array through a quarter turn.", "Swap the factors but keep the product."], explanation: `Turning the array changes ${table} rows of ${n} into ${n} rows of ${table} without changing its ${product} cells.`, purpose: "commutative_family_completion", misconception: "swapping_factors_changes_product", body: { table, n, product, fact_family: family } },
      { id: `meaning-${n}`, strand: "division_meaning", stage: "connect_grouping_and_sharing", prompt: `${product} counters are placed into groups of ${table}. Which statement describes the result?`, answer: `There are ${n} equal groups because ${product} ÷ ${table} = ${n}`, choices: [`There are ${n} equal groups because ${product} ÷ ${table} = ${n}`, `There are ${table} groups because division repeats the divisor`, `There are ${product - table} groups because division means subtract once`, "The groups do not need to be equal"], hints: ["Build groups of the stated size until all counters are used.", "Connect the model to a multiplication check."], explanation: `${n} equal groups of ${table} use all ${product} counters, and the multiplication check ${n} × ${table} = ${product} confirms the quotient.`, purpose: "division_grouping_meaning", misconception: "division_not_connected", body: { table, n, product, divisor: table, quotient: n, division_model: "grouping", fact_family: family } },
    ];
    for (const mode of modes) variants.push(makeVariant({ ...mode, id: `family-${mode.id}`, table, format: "fact-family", blueprint: "multiplication-division-families" }));
  }
  return variants.slice(0, count);
}

function mixedCandidates(count) {
  const variants = [];
  for (const n of multipliers) {
    for (const table of [3, 4, 8]) {
      const product = table * n;
      variants.push(makeVariant({ id: `mixed-${table}x${n}`, table, format: "timed-recall", blueprint: "mixed-low-pressure-recall", strand: "mixed_recall", stage: table === 3 ? "recall_three_fact" : table === 4 ? "recall_four_fact" : "recall_eight_fact", prompt: `Untimed fact choice: what is ${table} × ${n}?`, answer: product, choices: numericChoices(product, [product - table, product + table, table + n]), hints: [anchorHint(table, n), "Use an array, a related fact or a fact-family card if useful."], explanation: `${table} × ${n} = ${product}. The answer can be checked with ${n} equal groups of ${table} or ${table} equal groups of ${n}.`, purpose: "untimed_mixed_fact_recall", misconception: "nearby_fact_confusion", body: { table, n, product, strategy_choice: ["array", "skip-count", "known fact", "inverse check"] } }));
    }
    const table = [3, 4, 8][(n + 1) % 3];
    const product = table * n;
    const scale = n % 2 === 0 ? 2 : 3;
    variants.push(makeVariant({ id: `mixed-scale-${table}x${n}`, table, format: "timed-recall", blueprint: "mixed-low-pressure-recall", strand: "scaling_context", stage: "scale_equal_group_context", prompt: `One crate has ${table} groups of ${n} ${plural(contexts[n - 1], n)}, so it contains ${product} items. How many items are in ${scale} identical crates?`, answer: product * scale, choices: numericChoices(product * scale, [product + scale, product + table, product * Math.max(1, scale - 1)]), hints: [`Find one crate first: ${table} × ${n} = ${product}.`, `Then multiply ${product} by ${scale}.`], explanation: `Each crate contains ${product} items. ${scale} identical crates contain ${scale} × ${product} = ${product * scale}, so both the group structure and scale factor are included.`, purpose: "fact_scaling_context", misconception: "forgets_scale_factor", body: { table, n, one_set_total: product, copies: scale, total: product * scale, context: contexts[n - 1] } }));
  }
  return variants.slice(0, count);
}

function retrievalCandidates(count) {
  const variants = [];
  for (const n of multipliers) {
    const table = [3, 4, 8][(n - 1) % 3];
    const product = table * n;
    const previous = table * Math.max(0, n - 1);
    const modes = [
      { id: `multiply-${n}`, strand: "spaced_retrieval", stage: "retrieve_multiplication_fact", prompt: `Return visit: ${table} × ${n} = ?`, answer: product, choices: numericChoices(product, [product - table, product + table, table + n]), hints: [anchorHint(table, n), "Check with equal groups if the fact is not yet secure."], explanation: `${table} × ${n} = ${product}. Retrieval can be supported by a known anchor or array without introducing a timer or speed score.`, purpose: "spaced_multiplication_retrieval", misconception: "counts_from_start", body: { table, n, product } },
      { id: `divide-${n}`, strand: "spaced_retrieval", stage: "retrieve_inverse_division", prompt: `Return visit: ${product} ÷ ${table} = ?`, answer: n, choices: numericChoices(n, [table, Math.max(0, n - 1), n + table]), hints: [`Think ${table} × ? = ${product}.`, "Use the same fact-family array."], explanation: `${product} ÷ ${table} = ${n} because ${table} × ${n} = ${product}. The inverse multiplication fact verifies the quotient.`, purpose: "spaced_division_retrieval", misconception: "division_not_connected", body: { table, n, product, dividend: product, divisor: table, quotient: n } },
      { id: `repair-${n}`, strand: "misconception_diagnosis", stage: "repair_nearby_fact", prompt: `A learner gives ${previous} for ${table} × ${n}. What is the most useful diagnosis?`, answer: `They used ${table} × ${Math.max(0, n - 1)} and need one more group of ${table}`, choices: [`They used ${table} × ${Math.max(0, n - 1)} and need one more group of ${table}`, "They should add the two factors", "They must swap the product and a factor", "They need one fewer group"], hints: [`${previous} is one ${table}-group below ${product}.`, "Name the nearby fact before repairing it."], explanation: `${previous} represents ${table} × ${Math.max(0, n - 1)}. Adding one complete group of ${table} reaches the target product ${product}.`, purpose: "nearby_fact_diagnosis", misconception: "nearby_fact_confusion", body: { table, n, product, stated_answer: previous, repair: `${previous} + ${table} = ${product}` } },
      { id: `transfer-${n}`, strand: "transfer", stage: "transfer_fact_to_new_context", prompt: `A new tray has ${n} equal rows of ${table} counters. Which known fact solves it?`, answer: `${n} × ${table} = ${product}`, choices: [`${n} × ${table} = ${product}`, `${n} + ${table} = ${n + table}`, `${table} × ${n + 1} = ${table * (n + 1)}`, `${product} ÷ ${n} = ${Math.max(1, table - 1)}`], hints: ["Translate rows and row size into factors.", `Use commutativity to connect it to ${table} × ${n}.`], explanation: `${n} rows of ${table} form the commutative array ${n} × ${table} = ${product}, transferring the known table fact to a new orientation and context.`, purpose: "commutative_context_transfer", misconception: "adds_factors_instead_of_multiplying", body: { table, n, rows: n, columns: table, product, context: "counter tray" } },
    ];
    for (const mode of modes) variants.push(makeVariant({ ...mode, id: `retrieval-${mode.id}`, table, format: "timed-recall", blueprint: "fact-retrieval-spaced", retrieval: true }));
  }
  return variants.slice(0, count);
}

function makeVariant({ id, table, format, blueprint, strand, stage, prompt, answer, choices, hints, explanation, purpose, misconception, body, retrieval = false }) {
  const fullId = `${prefix}${id}`;
  const band = bandFor(blueprint, stage);
  const cleanChoices = uniqueByJSON(choices);
  return {
    id: fullId,
    format,
    body: {
      prompt,
      choices: rotate(cleanChoices, fullId.length % cleanChoices.length),
      ...body,
      focus_table: table,
      tables_strand: strand,
      coverage_tags: coverageFor(strand, stage, table),
      conceptual_progression: stage,
      difficulty_band: band,
      evidence_purpose: purpose,
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
      response_mode: "choice_keyboard_switch_touch_number_or_partner_recorded",
      timed_format_policy: { untimed_default: true, timer_visible: false, timer_optional: false, speed_score: false, pause_and_think: true, strategy_reveal_available: true },
      interaction_support: { keyboard: true, switch_scan: true, touch: true, number_entry: true, choice_buttons: true, partner_recording: true, drag_required: false, undo_available: true, confirm_before_submit: true },
      manipulative_routes: { concrete: "counters in adult-prepared row frames, egg boxes or equal-group hoops", visual: "static patterned array with labelled rows and columns; colour is never required", symbolic: "fact card, related-fact bridge and four-part family table", verbal: "adult or partner records an equal-groups or known-fact explanation" },
      send_routes: { reduced_choices: "show two choices first while retaining the full model", reduced_visual_load: "one array or fact family at a time with decorative scenery removed", processing: "keep the known fact visible and reveal only one adjustment step", tactile: "large counters, raised row boundaries and tactile factor cards", text: "short fact statement followed by one question" },
      reduced_visual_load: true,
      reduced_motion_alternative: "instant static array copies and fact-family panels without countdowns, orbiting or pulsing",
      audio_support: { required: false, pedagogical_decision: "Facts and relationships are fully represented with visible symbols, arrays, concrete materials and adult/partner reading.", browser_tts_allowed: false, future_asset_policy: "Only human-reviewed ElevenLabs audio may be added, with the complete non-audio route retained." },
      strategy_choice: ["build or view an array", "use a known nearby fact", "double or halve", "use the inverse family"],
      mission: missionFor(strand, stage, fullId),
      pressure_rules: { timer: false, speed_score: false, streak_loss: false, lives: false, public_ranking: false, retry_cost: false },
      review_interval_days: retrieval ? [1, 3, 7, 14, 30][fullId.length % 5] : undefined,
    },
    expected_answer: { value: answer },
    hints,
    explanation,
    feedback: { correct: `Fact route secured: ${purpose.replaceAll("_", " ")}.`, repair: repairFor(strand, body), representation_check: "Show the same fact with equal groups, an array or a complete fact family and check that the total is preserved.", strategy_check: "Name the chosen strategy and explain why it is more useful than recounting from one.", misconception_check: misconceptionFeedback(misconception), retry: "The island keeps every correct group and known fact. Choose another strategy with no timer, lives or penalty." },
    difficulty: difficultyFor(band),
    status: "review",
    misconception_tag: misconception,
    animation_hook: animationFor(strand),
  };
}

function enrichVariant(variant) {
  const body = variant.body ?? {};
  const responseModes = ["touch", "keyboard", "switch", "eye_gaze", "aac", "partner_recorded"];
  const mode = body.rows !== undefined && body.columns !== undefined
    ? "equal_groups_or_array"
    : body.dividend !== undefined && body.divisor !== undefined
      ? "inverse_division_family"
      : body.source_product !== undefined && body.target_product !== undefined
        ? "double_or_halve_relationship"
        : body.one_set_total !== undefined && body.copies !== undefined
          ? "scaling_context"
          : "strategy_choice";
  return {
    ...variant,
    body: {
      ...body,
      tables_contract: {
        kind: "multiplication_division_table_relationship",
        mode,
        focus_table_key: body.focus_table !== undefined ? "focus_table" : null,
        groups_key: body.groups !== undefined ? "groups" : null,
        group_size_key: body.group_size !== undefined ? "group_size" : null,
        rows_key: body.rows !== undefined ? "rows" : null,
        columns_key: body.columns !== undefined ? "columns" : null,
        inverse_keys: ["dividend", "divisor", "quotient"].filter((key) => body[key] !== undefined),
        response_modes: responseModes,
        drag_required: false,
        timed_recall_is_untimed: true,
        preserve_correct_work: true,
      },
    },
  };
}

function missionFor(strand, stage, id) {
  const stations = { arrays: "Array Garden", equal_groups: "Equal-Group Store", commutativity: "Turntable Bridge", reasoning: "Model Inspector's Desk", doubling: "Four-to-Eight Lighthouse", halving: "Eight-to-Four Return Path", visual_relationships: "Twin-Array Studio", misconceptions: "Fact Repair Hut", inverse_families: "Inverse Lock Workshop", missing_factors: "Missing-Key Dock", division_meaning: "Sharing and Grouping Quay", mixed_recall: "Choice Route Clearing", scaling_context: "Supply Scale Station", spaced_retrieval: "Memory Garden Return", misconception_diagnosis: "Friendly Error Lab", transfer: "New Island Blueprint" };
  const tools = { arrays: "build equal rows and count every item once", equal_groups: "keep each group the same size", commutativity: "turn the array while preserving every cell", reasoning: "diagnose the model before calculating", doubling: "copy all four groups to make eight", halving: "split eight equal groups into two matching sets of four", visual_relationships: "keep row size fixed while doubling row count", misconceptions: "name the mistaken fact and repair one relationship", inverse_families: "use one array for two multiplications and two divisions", missing_factors: "rewrite the gap as inverse division", division_meaning: "label total, number of groups and group size", mixed_recall: "choose an array, anchor, doubling or inverse route", scaling_context: "find one set, then apply the number of copies", spaced_retrieval: "retrieve, check and revisit without speed scoring", misconception_diagnosis: "identify the nearby fact before adding or removing a group", transfer: "translate the new context into equal rows and a known fact" };
  return { campaign: "The Calm Fact Islands: Reconnect the 3, 4 and 8 Routes", station: stations[strand], mission_code: id.slice(-30), objective: `Complete the ${stage.replaceAll("_", " ")} route and verify it with a second representation.`, strategic_tool: tools[strand], route_choices: ["array trail", "known-fact bridge", "double-or-halve ferry", "inverse-family lock"], reward: { item: "private island route marker", earned_for: "using a valid strategy, explanation or repair", effect: "reconnects one route without changing difficulty or adding speed pressure" }, retry_protocol: "No lives, route markers or progress are lost; correct groups stay fixed while one targeted strategy clue appears." };
}

function validateBank(packData, curatedItems, generatedItems) {
  const pilot = packData.practice.variant_targets.pilot;
  if (curatedItems.length !== 3) throw new Error(`Expected three curated variants, found ${curatedItems.length}.`);
  if (generatedItems.length !== pilot - curatedItems.length || curatedItems.length + generatedItems.length !== pilot) throw new Error(`Pilot bank must contain exactly ${pilot} variants.`);
  const blueprintMap = new Map(packData.variant_blueprints.map((item) => [item.id, item]));
  const ids = new Set(); const signatures = new Set(); const coverage = new Set(); const tables = new Set(); const formats = new Set(); const blueprints = new Set(); const bands = new Set();
  for (const variant of [...curatedItems, ...generatedItems]) {
    if (ids.has(variant.id)) throw new Error(`Duplicate id ${variant.id}.`); ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${JSON.stringify(variant.expected_answer?.value)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`); signatures.add(signature);
    validateTablesContract(variant);
  }
  for (const variant of generatedItems) {
    const blueprint = blueprintMap.get(variant.body.variant_blueprint_id);
    if (!blueprint || variant.format !== blueprint.format) throw new Error(`${variant.id} does not match its blueprint format.`);
    if (variant.status !== "review") throw new Error(`${variant.id} must remain in review.`);
    if (!Array.isArray(variant.body.choices) || variant.body.choices.length < 4 || uniqueByJSON(variant.body.choices).length !== variant.body.choices.length) throw new Error(`${variant.id} has invalid choices.`);
    if (variant.body.choices.filter((choice) => JSON.stringify(choice) === JSON.stringify(variant.expected_answer.value)).length !== 1) throw new Error(`${variant.id} must contain its answer exactly once.`);
    if (!variant.body.timed_format_policy?.untimed_default || variant.body.timed_format_policy?.timer_optional !== false || variant.body.timed_format_policy?.speed_score !== false) throw new Error(`${variant.id} introduces recall pressure.`);
    if (!variant.body.interaction_support?.keyboard || !variant.body.interaction_support?.switch_scan || !variant.body.interaction_support?.choice_buttons || variant.body.interaction_support?.drag_required !== false) throw new Error(`${variant.id} lacks supported interactions.`);
    if (!variant.body.manipulative_routes?.concrete || !variant.body.manipulative_routes?.visual || !variant.body.send_routes?.tactile || !variant.body.send_routes?.processing || variant.body.reduced_visual_load !== true) throw new Error(`${variant.id} lacks concrete/visual SEND routes.`);
    if (variant.body.audio_support?.browser_tts_allowed !== false || variant.body.audio_support?.required !== false || variant.body.audio_asset_id) throw new Error(`${variant.id} violates the generated audio decision.`);
    if (Object.values(variant.body.pressure_rules).some((value) => value !== false) || !/No lives/.test(variant.body.mission?.retry_protocol) || !variant.body.mission?.strategic_tool || variant.body.strategy_choice.length < 4) throw new Error(`${variant.id} lacks pressure-free choice missions.`);
    if (!variant.feedback?.repair || !variant.feedback?.representation_check || !variant.feedback?.strategy_check || !variant.feedback?.misconception_check || !variant.feedback?.retry || variant.hints.length < 2 || variant.explanation.length < 60) throw new Error(`${variant.id} lacks rich feedback.`);
    validateMath(variant);
    for (const tag of variant.body.coverage_tags) coverage.add(tag);
    tables.add(variant.body.focus_table); formats.add(variant.format); blueprints.add(variant.body.variant_blueprint_id); bands.add(variant.body.difficulty_band);
  }
  const allocation = combinedAllocation(curatedItems, generatedItems);
  for (const [blueprint, expected] of Object.entries(pilotAllocation)) if (allocation[blueprint] !== expected) throw new Error(`${blueprint} expected ${expected}, found ${allocation[blueprint] ?? 0}.`);
  assertCovered("formats", new Set(packData.practice.formats), formats);
  assertCovered("blueprints", new Set(blueprintMap.keys()), blueprints);
  assertCovered("difficulty bands", new Set([...packData.practice.difficulty_bands, ...packData.variant_blueprints.map((item) => item.difficulty_band)]), bands);
  assertCovered("focus tables", new Set([3, 4, 8]), tables);
  assertCovered("tables coverage", new Set(["arrays", "equal_groups", "doubling", "commutativity", "inverse_families", "missing_factors", "scaling_context", "misconceptions", "reasoning", "transfer", "spaced_retrieval"]), coverage);
}

function validateTablesContract(variant) {
  const body = variant.body ?? {};
  const contract = body.tables_contract;
  const requiredResponseModes = ["touch", "keyboard", "switch", "eye_gaze", "aac", "partner_recorded"];
  if (!contract || contract.kind !== "multiplication_division_table_relationship" || contract.drag_required !== false || contract.timed_recall_is_untimed !== true || contract.preserve_correct_work !== true || requiredResponseModes.some((mode) => !contract.response_modes?.includes(mode))) throw new Error(`${variant.id} lacks a safe tables interaction contract.`);
  if (contract.mode === "equal_groups_or_array" && (!Number.isInteger(body[contract.rows_key]) || !Number.isInteger(body[contract.columns_key]) || body[contract.rows_key] * body[contract.columns_key] !== body.product)) throw new Error(`${variant.id} has invalid array relationship data.`);
  if (contract.mode === "inverse_division_family" && body.dividend / body.divisor !== body.quotient) throw new Error(`${variant.id} has invalid inverse-family data.`);
  if (contract.mode === "double_or_halve_relationship" && body.source_product * 2 !== body.target_product) throw new Error(`${variant.id} has invalid doubling relationship data.`);
  if (contract.mode === "scaling_context" && body.one_set_total * body.copies !== body.total) throw new Error(`${variant.id} has invalid scaling data.`);
}

function validateMath(variant) {
  const body = variant.body;
  if (Number.isInteger(body.table) && Number.isInteger(body.n) && Number.isInteger(body.product) && body.table * body.n !== body.product) throw new Error(`${variant.id} has an invalid product.`);
  if (Number.isInteger(body.rows) && Number.isInteger(body.columns) && Number.isInteger(body.product) && body.rows * body.columns !== body.product) throw new Error(`${variant.id} has inconsistent array data.`);
  if (Number.isInteger(body.dividend) && body.dividend / body.divisor !== body.quotient) throw new Error(`${variant.id} has invalid inverse division data.`);
  if (Number.isInteger(body.one_set_total) && body.one_set_total * body.copies !== body.total) throw new Error(`${variant.id} has invalid scaling data.`);
  if (Number.isInteger(body.source_product) && body.source_product * 2 !== body.target_product) throw new Error(`${variant.id} has invalid doubling data.`);
}

function anchorHint(table, n) { if (table === 8) return `Use 4 × ${n} = ${4 * n}, then double.`; if (table === 4) return `Use 2 × ${n} = ${2 * n}, then double.`; return n > 5 ? `Use 3 × 5 = 15, then add ${n - 5} more group${n - 5 === 1 ? "" : "s"} of 3.` : `Count ${n} equal groups of 3 or turn the array.`; }
function plural(noun, count) { if (count === 1) return noun; if (noun.endsWith("shelf")) return `${noun.slice(0, -1)}ves`; if (noun.endsWith("s") || noun.endsWith("x") || noun.endsWith("ch") || noun.endsWith("sh")) return `${noun}es`; if (noun.endsWith("y")) return `${noun.slice(0, -1)}ies`; return `${noun}s`; }
function numericChoices(answer, distractors) { const values = uniqueByJSON([answer, ...distractors]); for (let offset = 1; values.length < 4; offset += 1) if (!values.includes(answer + offset)) values.push(answer + offset); return values.slice(0, 4); }
function coverageFor(strand, stage, table) { const tags = new Set([strand, `${table}_table`]); if (stage.includes("array") || strand === "arrays") tags.add("arrays"); if (stage.includes("group") || strand === "equal_groups" || strand === "division_meaning") tags.add("equal_groups"); if (stage.includes("double") || strand === "doubling") tags.add("doubling"); if (stage.includes("commut") || strand === "commutativity" || strand === "transfer") tags.add("commutativity"); if (stage.includes("division") || strand === "inverse_families") tags.add("inverse_families"); if (stage.includes("missing") || strand === "missing_factors") tags.add("missing_factors"); if (stage.includes("scale") || strand === "scaling_context") tags.add("scaling_context"); if (stage.includes("diagnos") || stage.includes("repair") || strand === "misconceptions" || strand === "misconception_diagnosis") tags.add("misconceptions"); if (stage.includes("reason") || strand === "reasoning") tags.add("reasoning"); if (stage.includes("transfer") || strand === "transfer") tags.add("transfer"); if (strand === "spaced_retrieval") tags.add("spaced_retrieval"); return [...tags]; }
function bandFor(blueprint, stage) { if (blueprint === "equal-group-array-builds") return stage.includes("diagnose") ? "developing" : "intro"; if (blueprint === "double-four-to-eight") return stage.includes("diagnose") ? "expected" : "developing"; if (blueprint === "multiplication-division-families") return stage.includes("missing") || stage.includes("grouping") ? "secure" : "expected"; if (blueprint === "mixed-low-pressure-recall") return stage.includes("scale") ? "stretch" : "secure"; return "retrieval"; }
function difficultyFor(band) { return { intro: 3, developing: 4, expected: 5, secure: 7, stretch: 8, retrieval: 5 }[band]; }
function repairFor(strand, body) { if (["doubling", "halving", "visual_relationships"].includes(strand)) return "Keep the group size fixed; copy all four groups to make eight, or split eight groups into two equal sets of four."; if (["inverse_families", "missing_factors", "division_meaning"].includes(strand)) return "Label total, groups and group size, then rewrite the division or missing factor as a multiplication fact."; if (strand === "scaling_context") return "Find one complete set first, then apply the number of identical copies without changing its internal groups."; if (["misconceptions", "misconception_diagnosis"].includes(strand)) return "Name the incorrect nearby fact or model, preserve what is correct and add or remove one complete equal group."; if (strand === "transfer") return "Translate the context into rows and columns, then turn the array or use its known table fact."; return `Build or view ${body.rows ?? body.groups ?? body.table ?? "the"} equal groups, keep their size fixed and check the product with a related fact.`; }
function misconceptionFeedback(tag) { return ({ unequal_groups_model: "Multiplication models require every group to contain the same number.", adds_factors_instead_of_multiplying: "The factors describe equal groups; adding them does not count every item.", swapping_factors_changes_product: "Turning an array swaps factor order but preserves every cell and the product.", confuses_4x_8x: "Eight groups are double four groups when the group size stays fixed.", subtracts_four_instead_of_halving: "Halving splits the complete total into two equal parts; it is not subtracting four.", adds_four_not_double: "Add another complete set of four groups, not four individual counters.", division_not_connected: "Use the same total and factors to write inverse multiplication and division facts.", uses_subtraction_for_missing_factor: "A missing factor is found with inverse division, then checked by multiplication.", nearby_fact_confusion: "Identify which adjacent fact the answer represents and adjust by one complete group.", forgets_scale_factor: "After finding one set, include every identical copy.", counts_from_start: "Use an array, anchor fact, double or inverse check instead of restarting the count." })[tag] ?? "Return to equal groups and identify the first relationship that changed."; }
function animationFor(strand) { return ({ arrays: "equal-row-array-build", equal_groups: "group-hoops-fill", commutativity: "array-turn-static", reasoning: "model-inspector-check", doubling: "four-array-copy", halving: "eight-array-split", visual_relationships: "twin-array-compare", misconceptions: "fact-bridge-repair", inverse_families: "family-card-lock", missing_factors: "hidden-factor-reveal", division_meaning: "grouping-sharing-toggle", mixed_recall: "choice-route-open", scaling_context: "identical-set-copy", spaced_retrieval: "memory-garden-return", misconception_diagnosis: "nearby-fact-repair", transfer: "context-array-translate" })[strand]; }
function curatedBlueprint(variant) { const map = { "ma-y3-number-recall-3-4-8-tables-q-double-4x7": "double-four-to-eight", "ma-y3-number-recall-3-4-8-tables-q-fact-family": "multiplication-division-families", "ma-y3-number-recall-3-4-8-tables-q-7x8": "mixed-low-pressure-recall" }; const value = map[variant.id]; if (!value) throw new Error(`No curated blueprint assignment for ${variant.id}.`); return value; }
function combinedAllocation(curatedItems, generatedItems) { const counts = countBy(curatedItems, curatedBlueprint); for (const variant of generatedItems) counts[variant.body.variant_blueprint_id] = (counts[variant.body.variant_blueprint_id] ?? 0) + 1; return counts; }
function allocationSummary(curatedItems, generatedItems) { return Object.entries(combinedAllocation(curatedItems, generatedItems)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function uniqueByJSON(items) { const seen = new Set(); return items.filter((item) => { const key = JSON.stringify(item); if (seen.has(key)) return false; seen.add(key); return true; }); }
function assertCovered(label, required, actual) { const missing = [...required].filter((value) => !actual.has(value)); if (missing.length) throw new Error(`Missing ${label}: ${missing.join(", ")}.`); }
function countBy(items, keyFor) { const counts = {}; for (const item of items) { const key = keyFor(item); counts[key] = (counts[key] ?? 0) + 1; } return counts; }
function summary(items, keyFor) { return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
