#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packPath = path.resolve(argValue("--pack") ?? path.join(repoRoot, "packages/content/packs/ma-y2-number-add-subtract-two-digit.pack.sample.json"));
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y2-add-subtract-two-digit-bank-";
const reviewBatch = "y2-add-subtract-two-digit-pilot-a";
const allocation = {
  "two-digit-build-add-no-regroup": 48,
  "regrouping-addition-swaps": 48,
  "subtract-tens-and-ones": 48,
  "strategy-selection-choices": 48,
  "workshop-word-problems": 48,
};
const contexts = ["gears", "tiles", "seed packets", "map tokens", "robot parts", "shells", "books", "stickers"];
const reviewDays = [1, 3, 7, 14, 30];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y2-number-add-subtract-two-digit") throw new Error("This generator only supports the Year 2 two-digit addition/subtraction pack.");
const curated = (pack.question_variants ?? []).filter((v) => !v.id.startsWith(prefix));
const curatedSnapshot = JSON.stringify(curated.map(removeMathsContract));
const curatedBlueprint = new Map([
  ["ma-y2-number-add-subtract-two-digit-q-34-plus-18", "regrouping-addition-swaps"],
  ["ma-y2-number-add-subtract-two-digit-q-46-minus-20", "subtract-tens-and-ones"],
  ["ma-y2-number-add-subtract-two-digit-q-57-minus-9", "subtract-tens-and-ones"],
  ["ma-y2-number-add-subtract-two-digit-q-strategy-63-minus-20", "strategy-selection-choices"],
]);
const curatedCounts = countBy(curated, (v) => v.body?.variant_blueprint_id ?? curatedBlueprint.get(v.id));
const targets = Object.fromEntries(Object.entries(allocation).map(([id, total]) => [id, total - (curatedCounts[id] ?? 0)]));
for (const [id, count] of Object.entries(targets)) if (count < 0) throw new Error(`Curated variants exceed allocation for ${id}.`);

const generated = [
  ...noExchangeCandidates(targets["two-digit-build-add-no-regroup"]),
  ...exchangeCandidates(targets["regrouping-addition-swaps"]),
  ...subtractionCandidates(targets["subtract-tens-and-ones"]),
  ...strategyCandidates(targets["strategy-selection-choices"]),
  ...contextCandidates(targets["workshop-word-problems"]),
];
const enrichedCurated = curated.map(enrichVariant);
const enrichedGenerated = generated.map(enrichVariant);
pack.question_variants = [...enrichedCurated, ...enrichedGenerated];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Review-stage Year 2 two-digit addition and subtraction pack with a deterministic 240-variant pilot bank. Four curated variants are unchanged. Generated tasks cover place-value partitioning; adding and subtracting ones, tens and two-digit numbers; concrete exchange across ten; efficient mental and written representations; inverse fact families; missing-number equations; comparison and one/two-step contexts; estimation, reasonableness, misconception diagnosis and spaced transfer. Every generated task includes base-ten, number-line and part-whole routes, reduced-load SEND/dyscalculia supports, alternative inputs, rich corrective feedback and pressure-free exploration without timers, streaks, lives or loss. Selected narrated contexts reference ElevenLabs assets held for human listening review; browser TTS is prohibited. Independent mathematics, accessibility, narration and renderer review remains required before promotion.";

validateBank(pack, enrichedCurated, curatedSnapshot, enrichedGenerated, curatedBlueprint);
enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y2-add-subtract-two-digit-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y2-add-subtract-two-digit-bank blueprints=${summary(pack.question_variants, (v) => v.body?.variant_blueprint_id ?? curatedBlueprint.get(v.id))}`);
console.log(`y2-add-subtract-two-digit-bank formats=${summary(pack.question_variants, (v) => v.format)}`);
console.log(`y2-add-subtract-two-digit-bank concepts=${summary(generated, (v) => v.body.concept_focus)}`);
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y2-add-subtract-two-digit-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 2 addition/subtraction bank is out of date; run generate-y2-add-subtract-two-digit-bank.mjs --write.");
  console.log("y2-add-subtract-two-digit-bank deterministic check passed");
} else console.log("y2-add-subtract-two-digit-bank dry-run; pass --write to update the pack");

function noExchangeCandidates(count) {
  const modes = ["add_ones_without_exchange", "add_tens_preserve_ones", "add_two_digit_no_exchange", "place_value_partition", "efficient_tens_then_ones"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length];
    if (mode === "place_value_partition") {
      const answer = 20 + ((i * 17) % 79), p = parts(answer);
      return calc({ id: `partition-${answer}-${i + 1}`, format: "base-ten-build", blueprint: "two-digit-build-add-no-regroup", band: "intro", concept: mode,
        prompt: `Blueprint mission ${i + 1}: recombine ${p.tens * 10} and ${p.ones}.`, a: p.tens * 10, b: p.ones, operation: "+", answer,
        model: { expanded_form: [p.tens * 10, p.ones], tens: p.tens, ones: p.ones, exchange_required: false },
        steps: [`Build ${p.tens} ten-rods.`, `Add ${p.ones} one-cubes in the ones place.`],
        explanation: `${answer} is ${p.tens} tens and ${p.ones} ones: ${p.tens * 10} + ${p.ones} = ${answer}.`, tag: "digits_not_place_values", hook: "place-value-blueprint" });
    }
    if (mode === "add_ones_without_exchange") {
      const tens = 2 + (i % 7), aOnes = (i * 3) % 6, a = 10 * tens + aOnes, b = 1 + (i % (9 - aOnes)), answer = a + b;
      return calc({ id: `add-ones-${a}-${b}-${i + 1}`, format: "base-ten-build", blueprint: "two-digit-build-add-no-regroup", band: "intro", concept: mode,
        prompt: `One-cube mission ${i + 1}: build ${a}, then add ${b} ones.`, a, b, operation: "+", answer,
        model: { start: parts(a), added: { tens: 0, ones: b }, result: parts(answer), exchange_required: false },
        steps: [`Keep ${tens} tens fixed.`, `Combine ${aOnes} and ${b} ones.`], explanation: `${a} + ${b} = ${answer}; only the ones change.`, tag: "ones_added_to_tens_digit", hook: "base-ten-add-ones" });
    }
    if (mode === "add_tens_preserve_ones") {
      const aT = 1 + (i % 5), aO = (i * 3) % 10, bT = 1 + (i % (8 - aT)), a = 10 * aT + aO, b = 10 * bT, answer = a + b;
      return calc({ id: `add-tens-${a}-${b}-${i + 1}`, format: "base-ten-build", blueprint: "two-digit-build-add-no-regroup", band: "intro", concept: mode,
        prompt: `Ten-rod mission ${i + 1}: add ${b} to ${a}.`, a, b, operation: "+", answer,
        model: { start: parts(a), added: parts(b), result: parts(answer), exchange_required: false },
        steps: [`Add ${bT} ten-rods.`, `Keep ${aO} ones unchanged.`], explanation: `${a} + ${b} = ${answer}; adding tens changes the tens while the ${aO} ones remain.`, tag: "tens_treated_as_ones", hook: "base-ten-add-tens" });
    }
    const aT = 1 + (i % 4), aO = (i * 2) % 5, bT = 1 + ((i * 3) % (8 - aT)), bO = (i * 3 + 1) % (10 - aO), a = 10 * aT + aO, b = 10 * bT + bO, answer = a + b;
    return calc({ id: `${mode}-${a}-${b}-${i + 1}`, format: "base-ten-build", blueprint: "two-digit-build-add-no-regroup", band: "developing", concept: mode,
      prompt: `Build-and-jump mission ${i + 1}: solve ${a} + ${b} without an exchange.`, a, b, operation: "+", answer,
      model: { addends: [parts(a), parts(b)], result: parts(answer), exchange_required: false, number_line_jumps: [bT * 10, bO] },
      steps: [`Add ${bT * 10}: ${a} → ${a + bT * 10}.`, `Add ${bO}: ${a + bT * 10} → ${answer}.`],
      explanation: `${a} + ${b} = ${answer}. Partitioning ${b} into ${bT * 10} and ${bO} preserves place value.`, tag: "digits_added_without_place_value", hook: "tens-then-ones-route" });
  });
}

function exchangeCandidates(count) {
  return Array.from({ length: count }, (_, i) => {
    const aT = 1 + (i % 4), aO = 4 + (i % 6), bT = 1 + (Math.floor(i / 4) % (8 - aT)), bO = 10 - aO + (Math.floor(i / 3) % aO);
    const a = 10 * aT + aO, b = 10 * bT + bO, answer = a + b, onesTotal = aO + bO;
    return calc({ id: `exchange-${a}-${b}-${i + 1}`, format: "base-ten-build", blueprint: "regrouping-addition-swaps", band: "expected", concept: i % 3 ? "add_two_digit_with_exchange" : "add_ones_cross_ten",
      prompt: `Exchange workshop ${i + 1}: build ${a} + ${b} and swap ten ones for one ten.`, a, b, operation: "+", answer,
      model: { addends: [parts(a), parts(b)], ones_before_exchange: onesTotal, exchange: { ten_ones: 10, new_tens: 1, ones_left: onesTotal - 10 }, result: parts(answer), quantity_conserved: true },
      steps: [`Combine ones: ${aO} + ${bO} = ${onesTotal}.`, `Exchange 10 ones for 1 ten, leaving ${onesTotal - 10} ones.`, `Recount ${parts(answer).tens} tens and ${parts(answer).ones} ones.`],
      explanation: `${a} + ${b} = ${answer}. ${onesTotal} ones regroup as one new ten and ${onesTotal - 10} ones without changing quantity.`, tag: i % 2 ? "ignores_regrouping" : "exchange_changes_quantity", hook: "ones-to-ten-conservation" });
  });
}

function subtractionCandidates(count) {
  const modes = ["subtract_ones", "subtract_tens", "subtract_two_digit_no_exchange", "exchange_one_ten", "bridge_back_through_ten"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length];
    if (mode === "subtract_ones") {
      const aT = 2 + (i % 7), aO = 1 + ((i * 3) % 9), b = 1 + (i % aO), a = 10 * aT + aO;
      return subtractItem(i, mode, a, b, false, [`Remove ${b} ones.`, `Keep ${aT} tens.`]);
    }
    if (mode === "subtract_tens") {
      const aT = 2 + (i % 7), aO = (i * 3) % 10, bT = 1 + (i % aT), a = 10 * aT + aO, b = 10 * bT;
      return subtractItem(i, mode, a, b, false, [`Remove ${bT} ten-rods.`, `Keep ${aO} ones.`]);
    }
    if (mode === "subtract_two_digit_no_exchange") {
      const aT = 3 + (i % 6), aO = 3 + (i % 7), bT = 1 + (i % (aT - 1)), bO = i % (aO + 1), a = 10 * aT + aO, b = 10 * bT + bO;
      return subtractItem(i, mode, a, b, false, [`Jump back ${bT * 10}.`, `Then jump back ${bO}.`]);
    }
    const aT = 3 + (i % 6), aO = i % 5, bO = aO + 1 + (i % (9 - aO)), bT = mode === "bridge_back_through_ten" ? 0 : 1 + (i % (aT - 1)), a = 10 * aT + aO, b = 10 * bT + bO;
    const steps = mode === "bridge_back_through_ten"
      ? [`Subtract ${aO + 1} to reach ${a - aO - 1}.`, `Subtract the remaining ${b - aO - 1}.`]
      : [`Exchange one ten: ${aT} tens ${aO} ones becomes ${aT - 1} tens ${aO + 10} ones.`, `Remove ${bT} tens and ${bO} ones.`];
    return subtractItem(i, mode, a, b, true, steps);
  });
}

function subtractItem(i, concept, a, b, exchange, steps) {
  const answer = a - b;
  return calc({ id: `${concept}-${a}-${b}-${i + 1}`, format: "number-line", blueprint: "subtract-tens-and-ones", band: exchange ? "expected" : "developing", concept,
    prompt: `Return-route mission ${i + 1}: solve ${a} − ${b}.`, a, b, operation: "−", answer,
    model: { start: parts(a), subtract: parts(b), result: parts(answer), exchange_required: exchange, number_line_direction: "backwards", strategy_steps: steps }, steps,
    explanation: exchange ? `${a} − ${b} = ${answer}. Exchanging one ten for ten ones preserves the starting quantity and supports the subtraction.` : `${a} − ${b} = ${answer}. Tens and ones are removed according to their place value.`,
    tag: exchange ? "subtracts_larger_ones_without_exchange" : "operation_choice_confusion", hook: exchange ? "ten-to-ones-static-exchange" : "number-line-back-jumps" });
}

function strategyCandidates(count) {
  const modes = ["inverse_fact_family", "missing_addend", "missing_subtrahend", "estimate_and_reasonableness", "misconception_diagnosis", "efficient_strategy_selection", "written_representation_link"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length], a = 20 + ((i * 11) % 40), b = 10 + ((i * 7) % 29), total = a + b;
    if (mode === "inverse_fact_family") {
      const facts = [`${a} + ${b} = ${total}`, `${b} + ${a} = ${total}`, `${total} − ${a} = ${b}`, `${total} − ${b} = ${a}`];
      return choice({ id: `family-${a}-${b}-${i + 1}`, format: "fact-family-choice", concept: mode, prompt: `Fact-family mission ${i + 1}: select the four facts for parts ${a}, ${b} and whole ${total}.`, body: { parts: [a, b], whole: total, choices: [...facts, `${a} − ${b} = ${Math.abs(a - b)}`], select_count: 4 }, answer: facts,
        hints: ["Addition joins the two parts.", "Subtraction starts with the whole."], explanation: `${a} and ${b} make ${total}; the four linked inverse facts use those same three numbers.`, repair: "Label PART, PART and WHOLE, then test each equation against that fixed model.", tag: "inverse_facts_unconnected", hook: "fact-family-machine" });
    }
    if (mode === "missing_addend" || mode === "missing_subtrahend") {
      const equation = mode === "missing_addend" ? `${a} + □ = ${total}` : `${total} − □ = ${a}`;
      return choice({ id: `${mode}-${a}-${b}-${i + 1}`, concept: mode, prompt: `Equation-lock mission ${i + 1}: solve ${equation}.`, body: { equation, choices: numberChoices(b), part_whole_model: { whole: total, known_part: a, missing_part: b }, inverse_check: `${total} − ${a} = ${b}` }, answer: b,
        hints: ["Mark the whole and known part.", "Use the inverse instead of guessing."], explanation: `The missing number is ${b}: ${a} + ${b} = ${total} and ${total} − ${a} = ${b}.`, repair: "Build the whole, cover the known part and count the uncovered part before returning to the equation.", tag: "equals_means_answer_comes_next", hook: "equation-lock" });
    }
    if (mode === "estimate_and_reasonableness") {
      const ra = nearestTen(a), rb = nearestTen(b), estimate = ra + rb;
      return choice({ id: `estimate-${a}-${b}-${i + 1}`, concept: mode, prompt: `Reasonableness scanner ${i + 1}: estimate ${a} + ${b}.`, body: { calculation: `${a} + ${b}`, rounded_numbers: [ra, rb], choices: unique([estimate, clamp(estimate - 30, 0, 100), clamp(estimate + 30, 0, 100)]), exact_answer_for_check: total, estimate_not_exact: true }, answer: estimate,
        hints: [`${a} is near ${ra}; ${b} is near ${rb}.`, "Use the estimate to reject impossible answers."], explanation: `${ra} + ${rb} = ${estimate} estimates the exact total ${total}, which is reasonably close.`, repair: "Place each number between neighbouring tens, choose the nearer ten, then compare the exact total with the benchmark.", tag: "estimate_treated_as_exact", hook: "reasonableness-scanner" });
    }
    if (mode === "misconception_diagnosis") {
      const aa = 24 + (i % 5), bb = 17 + (i % 3), exact = aa + bb, shown = exact - 10;
      const answer = "Ten ones were made, but the new ten was not included.";
      return choice({ id: `diagnose-${aa}-${bb}-${i + 1}`, concept: mode, prompt: `Repair-bot mission ${i + 1}: a helper says ${aa} + ${bb} = ${shown}. What happened?`, body: { calculation: `${aa} + ${bb}`, shown_answer: shown, choices: [answer, "Addition must make a smaller number.", "The ones digit should never change."], rebuild_with_base_ten: true }, answer,
        hints: [`Check ${ones(aa)} + ${ones(bb)} ones.`, "Exchange ten ones and recount the tens."], explanation: `${aa} + ${bb} = ${exact}. The incorrect answer omitted the new ten from the ones exchange.`, repair: "Circle ten one-cubes, exchange them for a ten-rod and keep every remaining cube visible.", tag: "ignores_regrouping", hook: "repair-bot" });
    }
    const tensJump = parts(b).tens * 10, onesJump = ones(b);
    if (mode === "written_representation_link") {
      const answer = `${a} + ${tensJump} = ${a + tensJump}; then + ${onesJump} = ${total}`;
      return choice({ id: `written-${a}-${b}-${i + 1}`, concept: mode, prompt: `Written-route mission ${i + 1}: choose the expanded steps for ${a} + ${b}.`, body: { calculation: `${a} + ${b}`, choices: [answer, `${a} + ${parts(b).tens}; then + ${onesJump}`, `${parts(a).tens} + ${parts(b).tens}; join the ones`], no_formal_column_requirement: true }, answer,
        hints: [`Partition ${b} into ${tensJump} and ${onesJump}.`, "Each written step must keep the value of the tens."], explanation: `${b} = ${tensJump} + ${onesJump}, so the expanded horizontal steps reach ${total}.`, repair: "Match each written step to a base-ten change or labelled number-line jump.", tag: "written_digits_without_place_value", hook: "written-route" });
    }
    const answer = `Add ${tensJump}, then add ${onesJump}`;
    return choice({ id: `efficient-${a}-${b}-${i + 1}`, concept: mode, prompt: `Route-picker mission ${i + 1}: choose an efficient place-value strategy for ${a} + ${b}.`, body: { calculation: `${a} + ${b}`, choices: [answer, "Count every object again from one", "Join the digits into one numeral"], multiple_valid_strategies_accepted_with_explanation: true }, answer,
      hints: ["Partition the second number into tens and ones.", "Efficiency means fewer reliable steps, not working quickly."], explanation: `${answer} reaches ${total} while preserving place value. Other accurate explained strategies can also be accepted.`, repair: "Offer base-ten, number-line and part-whole strategy cards; test one with no speed demand.", tag: "strategy_ignores_place_value", hook: "route-picker" });
  });
}

function contextCandidates(count) {
  const modes = ["combine", "take_away", "compare", "missing_change", "two_step_add_subtract", "two_step_subtract_add", "reasonableness_context", "transfer_retrieval"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length], noun = contexts[i % contexts.length], a = 25 + ((i * 11) % 39), b = 8 + ((i * 7) % 21), day = reviewDays[i % reviewDays.length];
    let prompt, answer, operation, model, explanation, tag;
    if (mode === "combine") { answer = a + b; operation = "+"; prompt = `A maker has ${a} ${noun} and receives ${b} more. How many now?`; model = { parts: [a, b], whole: answer }; explanation = `${a} + ${b} = ${answer}; two parts combine.`; tag = "subtracts_when_combining"; }
    else if (mode === "take_away") { answer = a - b; operation = "−"; prompt = `A tray has ${a} ${noun}. ${b} are used. How many remain?`; model = { whole: a, removed: b, remaining: answer }; explanation = `${a} − ${b} = ${answer}; the starting whole decreases.`; tag = "adds_in_take_away"; }
    else if (mode === "compare") { const larger = a + b; answer = b; operation = "−"; prompt = `One tray has ${larger} ${noun}; another has ${a}. How many more are in the first?`; model = { quantities: [larger, a], difference: b }; explanation = `${larger} − ${a} = ${b}; aligned bars reveal the difference.`; tag = "adds_comparison_quantities"; }
    else if (mode === "missing_change") { const total = a + b; answer = b; operation = "−"; prompt = `A box had ${a} ${noun}. Later it had ${total}. How many arrived?`; model = { whole: total, known_part: a, missing_part: b }; explanation = `${total} − ${a} = ${b}; subtraction finds the missing increase.`; tag = "final_total_used_as_change"; }
    else if (mode === "two_step_add_subtract") { const remove = 3 + (i % 6); answer = a + b - remove; operation = "+"; prompt = `Start with ${a} ${noun}, collect ${b}, then use ${remove}. How many remain?`; model = { start: a, first_change: b, intermediate: a + b, second_change: -remove }; explanation = `${a} + ${b} = ${a + b}; then ${a + b} − ${remove} = ${answer}.`; tag = "two_steps_merged"; }
    else if (mode === "two_step_subtract_add") { const add = 4 + (i % 7); answer = a - b + add; operation = "−"; prompt = `Start with ${a} ${noun}, use ${b}, then receive ${add}. How many now?`; model = { start: a, first_change: -b, intermediate: a - b, second_change: add }; explanation = `${a} − ${b} = ${a - b}; then ${a - b} + ${add} = ${answer}.`; tag = "step_order_reversed"; }
    else if (mode === "reasonableness_context") { answer = a + b; operation = "+"; prompt = `A plan combines ${a} and ${b} ${noun}. Is ${answer + 25} reasonable? Find and check the exact total.`; model = { claimed: answer + 25, estimate: nearestTen(a) + nearestTen(b), exact: answer }; explanation = `${a} + ${b} = ${answer}; the estimate ${nearestTen(a) + nearestTen(b)} shows ${answer + 25} is too large.`; tag = "unreasonable_answer_not_checked"; }
    else { answer = a - b; operation = "−"; prompt = `Memory-map return after ${day} days: ${a} ${noun} were packed and ${b} left. How many remain?`; model = { whole: a, removed: b, remaining: answer, review_interval_days: day, inverse_check: `${answer} + ${b} = ${a}` }; explanation = `${a} − ${b} = ${answer}; inverse check: ${answer} + ${b} = ${a}.`; tag = "transfer_without_check"; }
    return calc({ id: `context-${mode}-${i + 1}`, format: "base-ten-build", blueprint: "workshop-word-problems", band: mode.startsWith("two_step") ? "stretch" : "expected", concept: mode,
      prompt: `Story-workshop mission ${i + 1}: ${prompt}`, a, b, operation, answer, model: { ...model, picture_supported: true, context_object: noun },
      steps: ["Identify the start, change or compared quantities.", "Choose and model each operation in story order.", "Check with an inverse, estimate or second representation."], explanation, tag, hook: "story-workshop-model", audioScript: i % 3 === 0 ? prompt : undefined });
  });
}

function calc({ id, format, blueprint, band, concept, prompt, a, b, operation, answer, model, steps, explanation, tag, hook, audioScript }) {
  return candidate({ id, format, blueprint, band, concept, prompt, body: { calculation: `${a} ${operation} ${b}`, operands: [a, b], operation, model, strategy_steps: steps, choices: numberChoices(answer), exact_answer: answer }, answer,
    hints: [steps[0], steps.at(-1)], explanation, correct: `The calculation and model agree. ${explanation}`, repair: repairFor(operation, model), tag, hook, audioScript });
}

function choice({ id, format = "tap-choice", concept, prompt, body, answer, hints, explanation, repair, tag, hook }) {
  return candidate({ id, format, blueprint: "strategy-selection-choices", band: "secure", concept, prompt, body, answer, hints, explanation, correct: `The strategy evidence is consistent. ${explanation}`, repair, tag, hook });
}

function candidate({ id, format, blueprint, band, concept, prompt, body, answer, hints, explanation, correct, repair, tag, hook, audioScript }) {
  const audio = audioScript ? { audio_required: true, narration_script: audioScript, audio_asset_id: `narration-${prefix}${id}`, audio_provider: "ElevenLabs", audio_asset_status: "required_human_listening_review", human_listening_approval_required: true, browser_tts_allowed: false, browser_tts_fallback: "prohibited", audio_replay_unlimited: true, unavailable_audio_state: "honest_not_ready_use_picture_and_adult_read_route" } : { audio_required: false, audio_route: "not_needed_for_this_concrete_or_symbolic_task" };
  return {
    id: `${prefix}${id}`, format,
    body: {
      prompt, ...body, ...audio, concept_focus: concept,
      response_mode: "tap_drag_keyboard_switch_eye_gaze_aac_point_or_adult_scribed",
      supported_interaction: "An adult or peer may read, scan, move named blocks or record the child's indicated step without supplying the calculation.",
      concrete_route: "Base-ten rods and cubes on labelled tens/ones mats, with automatic exchange and undo available.",
      number_line_route: "Static or stepwise labelled jumps of tens and ones; movement animation is optional.",
      part_whole_route: "A labelled whole-and-parts bar can replace dense text or block manipulation.",
      dyscalculia_support: { place_value_columns: true, tens_ones_partition: true, one_step_per_panel: true, exchange_preserves_quantity: true, operation_symbol_with_words: true, inverse_check_available: true },
      visual_route: "One low-clutter representation per panel with large numerals, aligned place-value labels and no colour-only meaning.",
      processing_route: "Reveal build, exchange or jump steps separately; preserve correct work and reduce choices when useful.",
      motor_alternative: "Tap, keyboard, switch scan, eye gaze, AAC, pointing or adult-scribed steps can replace dragging, speech and handwriting.",
      low_visual_load: true, reduced_motion: "static_before_exchange_after_frames_or_instant_jumps", undo_available: true, preserve_correct_work: true,
      no_timer: true, speed_score_allowed: false, microphone_required: false, handwriting_required: false, retry_without_penalty: true,
      gamification: { mission: "repair a calm invention workshop using one checked calculation", reward: "one blueprint spark for a model, strategy or check", lives: false, streaks: false, loss_on_error: false, leaderboard: false, speed_bonus: false, retry_message: "Your correct blocks and steps stay. Choose another model or clue and continue." },
      difficulty_band: band, evidence_purpose: concept, variant_blueprint_id: blueprint, review_batch: reviewBatch,
    },
    expected_answer: { value: answer }, hints, explanation,
    feedback: { correct, repair, mathematical_evidence: explanation, strategy_message: "Building, jumping, partitioning, pointing, eye gaze, AAC and adult-scribed explanations are equally valid evidence; speed and handwriting are not scored." },
    difficulty: band === "intro" ? 3 : band === "developing" ? 4 : band === "expected" ? 5 : 6,
    status: "review", misconception_tag: tag, animation_hook: hook,
  };
}

function enrichVariant(variant) {
  const body = variant.body ?? {};
  const responseModes = ["tap", "keyboard", "switch", "eye_gaze", "aac", "adult_scribed"];
  let mathsContract;
  if (variant.format === "base-ten-build") {
    const structured = body.calculation !== undefined && body.model !== undefined;
    mathsContract = {
      kind: "place_value_calculation",
      mode: structured ? "model_and_calculation" : "authored_choice",
      calculation_key: structured ? "calculation" : null,
      operands_key: structured ? "operands" : null,
      model_key: structured ? "model" : null,
      strategy_steps_key: structured ? "strategy_steps" : null,
      exchange_preserves_quantity: true,
      response_modes: responseModes,
      drag_required: false,
    };
  } else if (variant.format === "number-line") {
    const structured = body.calculation !== undefined && body.model !== undefined;
    mathsContract = {
      kind: "number_line_subtraction",
      mode: structured ? "model_and_backwards_jumps" : "authored_choice",
      calculation_key: structured ? "calculation" : null,
      model_key: structured ? "model" : null,
      strategy_steps_key: structured ? "strategy_steps" : null,
      direction_key: structured ? "model" : null,
      response_modes: responseModes,
      drag_required: false,
    };
  } else if (variant.format === "fact-family-choice") {
    const structured = body.parts !== undefined && body.whole !== undefined;
    mathsContract = {
      kind: "inverse_fact_family",
      mode: structured ? "parts_and_whole" : "authored_choice",
      parts_key: structured ? "parts" : null,
      whole_key: structured ? "whole" : null,
      choices_key: "choices",
      response_modes: responseModes,
      drag_required: false,
    };
  } else if (variant.format === "tap-choice") {
    mathsContract = {
      kind: "strategy_choice",
      mode: body.evidence_purpose !== undefined ? "evidence_linked" : "authored_choice",
      choices_key: "choices",
      evidence_purpose_key: body.evidence_purpose !== undefined ? "evidence_purpose" : null,
      response_modes: responseModes,
      drag_required: false,
    };
  }
  return mathsContract ? { ...variant, body: { ...body, maths_contract: mathsContract } } : variant;
}

function repairFor(operation, model) {
  if (model?.exchange?.ten_ones || model?.exchange_required) return "Keep every block visible. Exchange exactly ten ones for one ten, confirm the quantity is unchanged, then continue from the first uncertain step.";
  if (operation === "−") return "Rebuild the starting whole, mark the backward direction, remove tens and ones by place value, then check by adding the removed amount back.";
  return "Separate tens and ones on a labelled mat, keep correct groups and rebuild only the first place-value step that does not match.";
}

function validateBank(currentPack, curated, snapshot, generated, curatedBlueprint) {
  if (curated.length !== 4) throw new Error(`Expected 4 curated variants, found ${curated.length}.`);
  if (JSON.stringify(curated.map(removeMathsContract)) !== snapshot) throw new Error("Curated variants changed during generation.");
  if (currentPack.question_variants.length !== 240 || generated.length !== 236) throw new Error("Pilot must contain 4 curated and 236 generated variants.");
  const ids = currentPack.question_variants.map((v) => v.id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate variant IDs found.");
  const counts = countBy(currentPack.question_variants, (v) => v.body?.variant_blueprint_id ?? curatedBlueprint.get(v.id));
  for (const [id, total] of Object.entries(allocation)) if (counts[id] !== total) throw new Error(`${id} expected ${total}, found ${counts[id] ?? 0}.`);
  for (const variant of currentPack.question_variants.filter((v) => ["base-ten-build", "number-line", "fact-family-choice", "tap-choice"].includes(v.format))) validateMathsContract(variant);
  const concepts = new Set(generated.map((v) => v.body.concept_focus));
  for (const concept of ["place_value_partition", "add_ones_without_exchange", "add_tens_preserve_ones", "add_two_digit_with_exchange", "subtract_ones", "subtract_tens", "exchange_one_ten", "inverse_fact_family", "missing_addend", "missing_subtrahend", "estimate_and_reasonableness", "misconception_diagnosis", "efficient_strategy_selection", "compare", "two_step_add_subtract", "transfer_retrieval"]) if (!concepts.has(concept)) throw new Error(`Missing concept ${concept}.`);
  for (const v of generated) {
    const b = v.body;
    if (!b.dyscalculia_support?.place_value_columns || !b.concrete_route || !b.number_line_route || !b.part_whole_route || !b.motor_alternative || !b.low_visual_load) throw new Error(`Missing SEND/dyscalculia route in ${v.id}.`);
    if (!v.feedback?.correct || !v.feedback?.repair || !v.feedback?.mathematical_evidence) throw new Error(`Missing rich feedback in ${v.id}.`);
    if (!b.no_timer || b.speed_score_allowed || b.gamification?.lives || b.gamification?.streaks || b.gamification?.loss_on_error) throw new Error(`Pressure mechanic in ${v.id}.`);
    const value = v.expected_answer?.value;
    if (typeof value === "number" && (value < 0 || value > 99)) throw new Error(`Numeric answer outside two-digit scope in ${v.id}: ${value}.`);
    if (b.audio_required) {
      if (b.audio_provider !== "ElevenLabs" || b.audio_asset_status !== "required_human_listening_review" || !b.human_listening_approval_required || b.browser_tts_allowed !== false || b.browser_tts_fallback !== "prohibited") throw new Error(`Audio policy failure in ${v.id}.`);
    } else if (b.audio_asset_id || b.audio_provider) throw new Error(`Unnecessary audio reference in ${v.id}.`);
  }
}

function validateMathsContract(variant) {
  const body = variant.body ?? {};
  const contract = body.maths_contract;
  const requiredResponseModes = ["tap", "keyboard", "switch", "eye_gaze", "aac", "adult_scribed"];
  if (!contract || contract.drag_required !== false || requiredResponseModes.some((mode) => !contract.response_modes?.includes(mode))) throw new Error(`${variant.id} lacks an accessible two-digit maths contract.`);
  if (variant.format === "base-ten-build") {
    if (contract.kind !== "place_value_calculation") throw new Error(`${variant.id} has the wrong place-value contract.`);
    if (contract.mode === "model_and_calculation" && (!body[contract.calculation_key] || !body[contract.model_key] || !Array.isArray(body[contract.strategy_steps_key]))) throw new Error(`${variant.id} lacks place-value model semantics.`);
    if (contract.mode !== "model_and_calculation" && contract.mode !== "authored_choice") throw new Error(`${variant.id} has an unknown place-value mode.`);
  } else if (variant.format === "number-line") {
    if (contract.kind !== "number_line_subtraction") throw new Error(`${variant.id} has the wrong number-line contract.`);
    if (contract.mode === "model_and_backwards_jumps" && (!body[contract.calculation_key] || !body[contract.model_key] || !Array.isArray(body[contract.strategy_steps_key]))) throw new Error(`${variant.id} lacks number-line jump semantics.`);
    if (contract.mode !== "model_and_backwards_jumps" && contract.mode !== "authored_choice") throw new Error(`${variant.id} has an unknown number-line mode.`);
  } else if (variant.format === "fact-family-choice") {
    if (contract.kind !== "inverse_fact_family") throw new Error(`${variant.id} has the wrong inverse-fact contract.`);
    if (contract.mode === "parts_and_whole" && (!Array.isArray(body[contract.parts_key]) || body[contract.parts_key].length !== 2 || !Number.isInteger(body[contract.whole_key]))) throw new Error(`${variant.id} lacks inverse fact parts and whole.`);
    if (contract.mode !== "parts_and_whole" && contract.mode !== "authored_choice") throw new Error(`${variant.id} has an unknown inverse-fact mode.`);
  } else if (variant.format === "tap-choice") {
    if (contract.kind !== "strategy_choice") throw new Error(`${variant.id} has the wrong strategy-choice contract.`);
    if (contract.mode !== "evidence_linked" && contract.mode !== "authored_choice") throw new Error(`${variant.id} has an unknown strategy-choice mode.`);
  }
}

function removeMathsContract(variant) {
  const { maths_contract: _mathsContract, ...body } = variant.body ?? {};
  return { ...variant, body };
}

function parts(n) { return { tens: Math.floor(n / 10), ones: n % 10 }; }
function ones(n) { return n % 10; }
function nearestTen(n) { return clamp(Math.round(n / 10) * 10, 0, 100); }
function numberChoices(n) { return unique([n, clamp(n - 10, 0, 99), clamp(n + 10, 0, 99), clamp(n + (n % 2 ? 1 : -1), 0, 99)]); }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function unique(items) { return [...new Set(items)]; }
function countBy(items, fn) { const out = {}; for (const item of items) { const key = fn(item); out[key] = (out[key] ?? 0) + 1; } return out; }
function summary(items, fn) { return Object.entries(countBy(items, fn)).sort(([a], [b]) => String(a).localeCompare(String(b))).map(([k, v]) => `${k}:${v}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
