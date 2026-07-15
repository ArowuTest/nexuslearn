#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packPath = path.resolve(argValue("--pack") ?? path.join(repoRoot, "packages/content/packs/ma-y1-number-counting-within-100.pack.sample.json"));
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y1-number-counting-bank-";
const reviewBatch = "y1-number-counting-pilot-a";
const allocation = {
  "forward-count-on-paths": 44,
  "decade-transition-builds": 44,
  "backward-count-paths": 44,
  "listen-and-tap-counts": 44,
  "garden-count-transfer": 44,
};
const objects = ["seeds", "shells", "buttons", "stars", "pebbles", "leaves", "blocks", "tickets"];
const representations = ["ten-frames and loose counters", "bundled sticks and single sticks", "bead string", "hundred square", "number line", "tens-and-ones cards"];
const reviewDays = [1, 3, 7, 14, 30];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y1-number-counting-within-100") throw new Error("This generator only supports the Year 1 counting-within-100 pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedSnapshot = JSON.stringify(curated);
const curatedBlueprint = new Map([
  ["ma-y1-number-counting-within-100-q-after-27", "forward-count-on-paths"],
  ["ma-y1-number-counting-within-100-q-one-more-39", "decade-transition-builds"],
  ["ma-y1-number-counting-within-100-q-back-from-43", "backward-count-paths"],
]);
const curatedCounts = countBy(curated, (v) => v.body?.variant_blueprint_id ?? curatedBlueprint.get(v.id));
const targets = Object.fromEntries(Object.entries(allocation).map(([id, total]) => [id, total - (curatedCounts[id] ?? 0)]));
for (const [id, count] of Object.entries(targets)) if (count < 0) throw new Error(`Curated variants exceed allocation for ${id}.`);

const generated = [
  ...forwardCandidates(targets["forward-count-on-paths"]),
  ...placeValueCandidates(targets["decade-transition-builds"]),
  ...backwardCandidates(targets["backward-count-paths"]),
  ...patternCandidates(targets["listen-and-tap-counts"]),
  ...transferCandidates(targets["garden-count-transfer"]),
];
pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Review-stage Year 1 counting and place-value pack with a deterministic 220-variant pilot bank. Three curated variants are unchanged. Generated tasks cover stable forward and backward counting from varied starts, one more and less, one-to-one object counting and conservation, numeral-word-quantity links, tens and ones, comparison and ordering, number-line placement, missing numbers, counting in twos/fives/tens, estimation with exact checking, misconception repair and spaced transfer. Every generated task offers concrete, low-visual-load, dyscalculia/SEND and alternative-input routes with rich corrective feedback and no timers, streaks, lives, loss or speed scoring. Optional narrated items reference ElevenLabs assets held for human listening review; browser TTS is prohibited. Independent mathematics, SEND, narration and renderer review remains required before promotion.";

validateBank(pack, curated, curatedSnapshot, generated, curatedBlueprint);
enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y1-number-counting-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y1-number-counting-bank blueprints=${summary(pack.question_variants, (v) => v.body?.variant_blueprint_id ?? curatedBlueprint.get(v.id))}`);
console.log(`y1-number-counting-bank formats=${summary(pack.question_variants, (v) => v.format)}`);
console.log(`y1-number-counting-bank concepts=${summary(generated, (v) => v.body.concept_focus)}`);
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y1-number-counting-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 1 number-counting bank is out of date; run generate-y1-number-counting-bank.mjs --write.");
  console.log("y1-number-counting-bank deterministic check passed");
} else console.log("y1-number-counting-bank dry-run; pass --write to update the pack");

function forwardCandidates(count) {
  const modes = ["continue", "missing", "word-link", "decade", "start-marker"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length];
    const start = 2 + ((i * 13 + Math.floor(i / 5) * 7) % 93);
    const length = 3 + (i % 3);
    const sequence = range(start + 1, length);
    if (mode === "missing") {
      const full = range(start, length + 2), gap = 1 + (i % length), answer = full[gap];
      return item({ id: `forward-missing-${start}-${i + 1}`, format: "number-path", blueprint: "forward-count-on-paths", band: "intro", concept: "forward_missing_number",
        prompt: `Pathfinder mission ${i + 1}: the path begins at ${start}. Which number fills the empty stone?`, body: { start, path: full.map((n, x) => x === gap ? null : n), missing_index: gap, choices: numberChoices(answer), direction: "forwards", step: 1 }, answer,
        hints: [`Start at ${start}; do not restart at 1.`, `Each forward step is one more. Check the stones before and after the gap.`], explanation: `${full.slice(0, gap).join(", ")}, ${answer}, ${full.slice(gap + 1).join(", ")} increases by one each step.`, correct: `The missing stone is ${answer}.`, repair: "Keep the start marker visible, move one counter per step and reveal only the neighbouring stones.", tag: "restart_at_one", hook: "garden-path-missing-stone" });
    }
    if (mode === "word-link") {
      const answer = start + 1;
      return item({ id: `forward-word-${start}-${i + 1}`, format: "number-path", blueprint: "forward-count-on-paths", band: "developing", concept: "numeral_word_sequence_link",
        prompt: `Label-gate mission ${i + 1}: ${numberWord(start)} is on the first stone. Choose the numeral for the next number.`, body: { start_word: numberWord(start), start_numeral: start, choices: numberChoices(answer), direction: "forwards", step: 1, representation_match: [numberWord(start), start] }, answer,
        hints: [`Read ${numberWord(start)} as ${start}.`, "The next number is one more."], explanation: `${numberWord(start)} means ${start}; one more is ${answer}, written ${numberWord(answer)}.`, correct: `Word, numeral and next number linked at ${answer}.`, repair: "Place the numeral card beneath the number word, then make one physical step on a number line.", tag: "number_word_not_linked_to_numeral", hook: "garden-label-gate" });
    }
    if (mode === "decade") {
      const boundaryStart = 8 + 10 * (i % 9), full = range(boundaryStart, 5), answer = boundaryStart + 2;
      return item({ id: `forward-decade-${boundaryStart}-${i + 1}`, format: "number-path", blueprint: "forward-count-on-paths", band: "developing", concept: "forward_decade_transition",
        prompt: `Decade-bridge mission ${i + 1}: fill the middle stone in ${full[0]}, ${full[1]}, __, ${full[3]}, ${full[4]}.`, body: { start: boundaryStart, path: [full[0], full[1], null, full[3], full[4]], choices: numberChoices(answer), direction: "forwards", step: 1, decade_boundary_visible: true }, answer,
        hints: ["Every step is one more, even when the tens digit changes.", `${full[1]} has nine ones; one more makes a new ten.`], explanation: `${full.join(", ")} crosses the decade in stable forward order, so the missing number is ${answer}.`, correct: `The decade bridge continues through ${answer}.`, repair: "Build the number before the boundary with tens and ones, add one loose counter and exchange ten ones for one ten.", tag: "decade_transition_confusion", hook: "garden-decade-bridge" });
    }
    return item({ id: `forward-${mode}-${start}-${i + 1}`, format: "number-path", blueprint: "forward-count-on-paths", band: "intro", concept: mode === "start-marker" ? "count_from_given_start" : "stable_forward_count",
      prompt: `Trail mission ${i + 1}: start at ${start} and place the next ${length} numbers in order.`, body: { start, slots: length, choices: rotate([...sequence, Math.min(100, start + length + 1)], i % (length + 1)), direction: "forwards", step: 1, start_marker: true }, answer: sequence,
      hints: [`Say or point to ${start} first.`, "Move one place right for each next number."], explanation: `Starting at ${start}, the next numbers are ${sequence.join(", ")}. Counting can begin at any given number.`, correct: `Stable forward sequence built from ${start}.`, repair: "Anchor a counter on the given start, cover distant numbers and uncover one next space at a time.", tag: "restart_at_one", hook: "garden-trail-forward" });
  });
}

function placeValueCandidates(count) {
  const modes = ["one-more", "one-less", "compose", "object-count", "conservation", "triple-link"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length];
    const n = 10 + ((i * 17 + 9) % 90), tens = Math.floor(n / 10), ones = n % 10;
    if (mode === "one-more" || mode === "one-less") {
      const boundary = mode === "one-more" ? 19 + 10 * (i % 8) : 20 + 10 * (i % 8);
      const answer = boundary + (mode === "one-more" ? 1 : -1);
      return item({ id: `${mode}-${boundary}-${i + 1}`, format: "ten-frame", blueprint: "decade-transition-builds", band: "developing", concept: mode.replace("-", "_"),
        prompt: `Packing-station mission ${i + 1}: what is ${mode.replace("-", " ")} than ${boundary}?`, body: { number: boundary, tens: Math.floor(boundary / 10), ones: boundary % 10, operation: mode, choices: numberChoices(answer), representation: "full ten-frames and loose counters", regrouping_language: "ten loose ones exchange for one full ten" }, answer,
        hints: [`Build ${boundary} as tens and ones.`, `${mode === "one-more" ? "Add" : "Remove"} one counter, then recount tens and ones.`], explanation: `${boundary} is ${Math.floor(boundary / 10)} tens and ${boundary % 10} ones. ${mode.replace("-", " ")} is ${answer}.`, correct: `${mode.replace("-", " ")} found by changing the quantity by exactly one.`, repair: "Keep full tens fixed, change one loose counter and exchange only when ten ones are present.", tag: "decade_transition_confusion", hook: "packing-station-decade" });
    }
    if (mode === "compose") return item({ id: `compose-${n}-${i + 1}`, format: "ten-frame", blueprint: "decade-transition-builds", band: "expected", concept: "tens_and_ones_compose",
      prompt: `Place-value workshop ${i + 1}: ${tens} full tens and ${ones} ones make which number?`, body: { tens, ones, choices: numberChoices(n), representation: representations[i % representations.length], place_value_cards: [tens * 10, ones], exchange_available: true }, answer: n,
      hints: [`${tens} tens are worth ${tens * 10}.`, `Join ${tens * 10} and ${ones} ones without reversing the digits.`], explanation: `${tens} tens and ${ones} ones compose ${n}; ${tens * 10} + ${ones} = ${n}.`, correct: `${n} composed from ${tens} tens and ${ones} ones.`, repair: "Label the tens column and ones column, count bundled tens first, then append the loose ones.", tag: "tens_ones_reversed", hook: "place-value-workshop" });
    if (mode === "object-count") {
      const noun = objects[i % objects.length];
      return item({ id: `objects-${n}-${i + 1}`, format: "ten-frame", blueprint: "decade-transition-builds", band: "developing", concept: "organised_one_to_one_object_count",
        prompt: `Collection mission ${i + 1}: organise the ${noun} into tens, then choose the exact total.`, body: { quantity: n, object_name: noun, initial_layout: "scattered_low_overlap", organisation_choices: ["move into ten-frames", "mark each object once", "guess from the space used"], tens, ones, choices: numberChoices(n), count_check: "touch_or_mark_each_object_once" }, answer: n,
        hints: ["Move or mark each object once so none are skipped or counted twice.", `Look for ${tens} complete groups of ten and ${ones} extra.`], explanation: `Organising gives ${tens} tens and ${ones} ones, so there are exactly ${n} ${noun}. Spacing does not change the total.`, correct: `${n} objects counted once each and checked in tens and ones.`, repair: "Dim each object after one count or move it into a ten-frame; recount by tens and leftover ones.", tag: "objects_skipped_or_double_counted", hook: "collection-organise" });
    }
    if (mode === "conservation") {
      const noun = objects[i % objects.length];
      return item({ id: `conserve-${n}-${i + 1}`, format: "ten-frame", blueprint: "decade-transition-builds", band: "expected", concept: "quantity_conservation",
        prompt: `Shape-shift mission ${i + 1}: ${n} ${noun} move from rows into a wide circle. How many are there now?`, body: { quantity_before: n, quantity_after_layout: "wider_spacing_same_objects", choices: numberChoices(n), objects_added: 0, objects_removed: 0, conservation_check: true }, answer: n,
        hints: ["No object was added or removed.", "Rearranging or spreading objects does not change how many there are."], explanation: `There are still ${n} ${noun}. Position and spacing changed, but the quantity was conserved.`, correct: `Quantity ${n} conserved across a new arrangement.`, repair: "Pair each before-object with one after-object or recount both layouts using the same ten-frame organisation.", tag: "spread_out_means_more", hook: "collection-shape-shift" });
    }
    return item({ id: `triple-${n}-${i + 1}`, format: "ten-frame", blueprint: "decade-transition-builds", band: "expected", concept: "numeral_word_quantity_equivalence",
      prompt: `Three-sign mission ${i + 1}: match the numeral ${n}, the word “${numberWord(n)}” and the tens-and-ones model.`, body: { numeral: n, number_word: numberWord(n), quantity_model: { tens, ones }, choices: [n, Math.min(100, tens + ones), Number(`${ones}${tens}`)], representation: "three matching cards" }, answer: n,
      hints: [`Read ${n} as ${numberWord(n)}.`, `Check the model has ${tens} tens and ${ones} ones.`], explanation: `${n}, ${numberWord(n)}, and ${tens} tens with ${ones} ones all represent the same quantity.`, correct: "Numeral, number word and quantity linked.", repair: "Match the numeral to place-value cards first, then attach the spoken or printed number-word card.", tag: "representation_changes_number", hook: "three-sign-match" });
  });
}

function backwardCandidates(count) {
  const modes = ["continue", "missing", "decade", "order", "line"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length], start = 7 + ((i * 19 + 21) % 94), length = 3 + (i % 3);
    if (mode === "missing" || mode === "decade") {
      const s = mode === "decade" ? 2 + 10 * (1 + (i % 9)) : start;
      const full = rangeDown(s, 5), gap = 2, answer = full[gap];
      return item({ id: `back-${mode}-${s}-${i + 1}`, format: "number-path", blueprint: "backward-count-paths", band: "expected", concept: mode === "decade" ? "backward_decade_transition" : "backward_missing_number",
        prompt: `Moon-path mission ${i + 1}: fill the gap in ${full[0]}, ${full[1]}, __, ${full[3]}, ${full[4]}.`, body: { start: s, path: [full[0], full[1], null, full[3], full[4]], choices: numberChoices(answer), direction: "backwards", step: -1, decade_boundary_visible: mode === "decade" }, answer,
        hints: ["Each backward step is one less.", "Check both neighbours; the missing number is one less than the left stone and one more than the right stone."], explanation: `${full.join(", ")} decreases by one each step, so ${answer} fills the gap.`, correct: `Backward path repaired with ${answer}.`, repair: "Face the number line toward smaller numbers, remove one counter per step and keep the current number marker visible.", tag: "backward_sequence_skip", hook: "moon-path-repair" });
    }
    if (mode === "order") {
      const values = unique([start, start - 4, start - 1]);
      const answer = [...values].sort((a, b) => b - a);
      return item({ id: `back-order-${start}-${i + 1}`, format: "number-path", blueprint: "backward-count-paths", band: "secure", concept: "order_numbers_descending",
        prompt: `Descending-lift mission ${i + 1}: place ${values.join(", ")} from greatest to least.`, body: { numbers: rotate(values, i % 3), direction: "backwards", order_language: "greatest_to_least", number_line_window: [Math.max(0, start - 6), start + 1] }, answer,
        hints: ["Greatest means the number furthest right on a normal number line.", "Then move toward smaller numbers."], explanation: `${answer.join(" > ")} is greatest to least. Counting backwards confirms the order.`, correct: `Numbers ordered from greatest to least.`, repair: "Place all three cards on a short number line, then read them from right to left.", tag: "descending_order_reversed", hook: "descending-number-lift" });
    }
    if (mode === "line") {
      const target = start - 2, anchors = [start - 5, start];
      return item({ id: `back-line-${target}-${i + 1}`, format: "number-path", blueprint: "backward-count-paths", band: "secure", concept: "number_line_placement",
        prompt: `Number-line lookout ${i + 1}: place ${target} between the labelled anchors ${anchors[0]} and ${anchors[1]}.`, body: { target, anchors, interval: 1, choices: range(anchors[0], 6), direction: "backwards_check", equal_spacing: true }, answer: target,
        hints: [`Start at ${anchors[1]} and count backwards.`, "Equal number-line steps represent equal differences of one."], explanation: `${target} is ${anchors[1] - target} steps before ${anchors[1]} and ${target - anchors[0]} steps after ${anchors[0]}.`, correct: `${target} placed using equal one-step intervals.`, repair: "Label every tick temporarily, place the target, then hide the extra labels again.", tag: "number_line_spacing_guess", hook: "number-line-lookout" });
    }
    const sequence = rangeDown(start - 1, length);
    return item({ id: `back-continue-${start}-${i + 1}`, format: "number-path", blueprint: "backward-count-paths", band: "expected", concept: "stable_backward_count",
      prompt: `Return-trail mission ${i + 1}: start at ${start} and place the next ${length} numbers when counting backwards.`, body: { start, slots: length, choices: rotate([...sequence, Math.min(100, start + 1)], i % (length + 1)), direction: "backwards", step: -1 }, answer: sequence,
      hints: [`Anchor the start at ${start}.`, "Remove one or move one number-line step left each time."], explanation: `Counting backwards from ${start} gives ${sequence.join(", ")}.`, correct: `Stable backward sequence built from ${start}.`, repair: "Use a bead string or short number track and move exactly one bead or space per spoken number.", tag: "backward_sequence_skip", hook: "return-trail-backward" });
  });
}

function patternCandidates(count) {
  const modes = ["audio-next", "twos", "fives", "tens", "compare", "audio-missing", "word-choice", "pattern-repair"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length];
    if (mode === "twos" || mode === "fives" || mode === "tens") {
      const step = mode === "twos" ? 2 : mode === "fives" ? 5 : 10;
      const maxStart = 100 - step * 4, start = step * ((i * 3) % Math.floor(maxStart / step)), seq = Array.from({ length: 5 }, (_, n) => start + n * step), answer = seq[4];
      return item({ id: `pattern-${step}-${start}-${i + 1}`, format: "tap-choice", blueprint: "listen-and-tap-counts", band: "retrieval", concept: `count_in_${step}s_pattern`,
        prompt: `Pattern-orbit mission ${i + 1}: continue ${seq.slice(0, 4).join(", ")}, __.`, body: { sequence: [...seq.slice(0, 4), null], step, choices: patternChoices(answer, step), representation: step === 2 ? "paired counters" : step === 5 ? "five-bead groups" : "full ten-frames", audio_required: false }, answer,
        hints: [`Add ${step} each time.`, `Check with ${step === 2 ? "pairs" : step === 5 ? "groups of five" : "groups of ten"}, not just the last digit.`], explanation: `The sequence increases by ${step}: ${seq.join(", ")}. The missing number is ${answer}.`, correct: `Counting-in-${step}s pattern continued to ${answer}.`, repair: `Build equal groups of ${step} and count the running totals; mark each jump on a number line.`, tag: "pattern_step_changes", hook: "pattern-orbit" });
    }
    if (mode === "compare") {
      const a = 10 + ((i * 11) % 90), b = clamp(a + [-10, -1, 1, 10][i % 4], 0, 100), answer = a === b ? "equal" : a > b ? "greater" : "less";
      return item({ id: `compare-${a}-${b}-${i + 1}`, format: "tap-choice", blueprint: "listen-and-tap-counts", band: "secure", concept: "compare_numbers_with_place_value",
        prompt: `Balance-bridge mission ${i + 1}: is ${a} greater than, less than or equal to ${b}?`, body: { numbers: [a, b], choices: ["greater", "less", "equal"], tens_ones_models: [parts(a), parts(b)], audio_required: false }, answer,
        hints: ["Compare the tens first.", "If the tens are equal, compare the ones."], explanation: `${a} is ${answer} than ${b}. The tens-and-ones models and number line show the same comparison.`, correct: `Comparison justified with place value.`, repair: "Align tens bundles and ones counters in two rows; compare tens before loose ones.", tag: "compares_ones_before_tens", hook: "balance-bridge" });
    }
    if (mode === "word-choice") {
      const n = (i * 17 + 6) % 101;
      return item({ id: `word-choice-${n}-${i + 1}`, format: "tap-choice", blueprint: "listen-and-tap-counts", band: "retrieval", concept: "number_word_numeral_retrieval",
        prompt: `Number-name radio ${i + 1}: choose the numeral that matches “${numberWord(n)}”.`, body: { number_word: numberWord(n), choices: numberChoices(n), audio_required: false, static_word_card: true }, answer: n,
        hints: [`Listen for or read the tens part in ${numberWord(n)}.`, "Then check the ones digit against the final number word."], explanation: `${numberWord(n)} is written ${n}, with ${parts(n).tens} tens and ${parts(n).ones} ones.`, correct: `Number word matched to numeral ${n}.`, repair: "Split the word card into tens and ones language, then build matching place-value cards.", tag: "number_word_digits_reversed", hook: "number-name-radio" });
    }
    if (mode === "pattern-repair") {
      const start = 20 + (i % 50), shown = [start, start + 1, start + 3, start + 4], answer = start + 2;
      return item({ id: `repair-${start}-${i + 1}`, format: "tap-choice", blueprint: "listen-and-tap-counts", band: "retrieval", concept: "sequence_misconception_repair",
        prompt: `Signal-repair mission ${i + 1}: ${shown.join(", ")} skipped one number. Which number restores counting in ones?`, body: { shown_sequence: shown, choices: numberChoices(answer), expected_step: 1, audio_required: false }, answer,
        hints: [`Count in ones from ${start}.`, "Compare each neighbouring pair and find the jump of two."], explanation: `${start}, ${start + 1}, ${answer}, ${start + 3}, ${start + 4} has a difference of one each time.`, correct: `Skipped number ${answer} restored.`, repair: "Place the sequence on consecutive number-line ticks and fill the only uncovered tick.", tag: "sequence_skip", hook: "signal-repair" });
    }
    const start = 4 + ((i * 23) % 91), missing = mode === "audio-missing" ? start + 2 : start + 4;
    const script = mode === "audio-missing" ? `${start}, ${start + 1}, blank, ${start + 3}.` : `${start}, ${start + 1}, ${start + 2}, ${start + 3}. What comes next?`;
    return item({ id: `${mode}-${start}-${i + 1}`, format: "tap-choice", blueprint: "listen-and-tap-counts", band: "retrieval", concept: mode === "audio-missing" ? "narrated_missing_number" : "narrated_count_on",
      prompt: `Listening-lantern mission ${i + 1}: hear the short number sequence and choose the missing or next number.`, body: { sequence_script: script, choices: numberChoices(missing), direction: "forwards", step: 1 }, answer: missing, audioScript: script,
      hints: ["Replay as often as useful; replay does not reduce the result.", `Start with ${start} and track one counter per spoken number.`], explanation: `The sequence counts forwards in ones, so the answer is ${missing}.`, correct: `Narrated sequence tracked to ${missing}.`, repair: "Replay once, place each heard number on a four-space track and pause at the gap or end.", tag: "spoken_sequence_not_tracked", hook: "listening-lantern" });
  });
}

function transferCandidates(count) {
  const modes = ["estimate", "organise", "compare-quantity", "line-transfer", "conserve-repair", "spaced", "check-estimate", "order-context"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length], n = 12 + ((i * 29 + 7) % 79), noun = objects[i % objects.length], day = reviewDays[i % reviewDays.length];
    if (mode === "estimate" || mode === "check-estimate") {
      const sensible = nearestTen(n), choices = unique([sensible, clamp(sensible - 20, 0, 100), clamp(sensible + 30, 0, 100)]);
      return item({ id: `${mode}-${n}-${i + 1}`, format: "number-path", blueprint: "garden-count-transfer", band: "stretch", concept: "estimate_then_exact_check",
        prompt: `Explorer-scoop mission ${i + 1}: estimate about how many ${noun} there are, then organise and count to check.`, body: { exact_quantity: n, estimate_choices: rotate(choices, i % choices.length), accepted_estimate: sensible, check_method: "groups_of_ten_then_ones", estimation_not_scored_as_exact: true, review_interval_days: day }, answer: { estimate: sensible, exact: n },
        hints: ["An estimate is a sensible nearby amount, not a hurried exact count.", "After estimating, group into tens and count the remaining ones exactly."], explanation: `${sensible} is a sensible estimate for ${n}. Organising confirms the exact count is ${n}; the estimate is checked, not treated as exact.`, correct: `Estimate ${sensible} checked against exact quantity ${n}.`, repair: "Show one benchmark group of ten, compare the collection to it, then organise every object for an exact check.", tag: "estimate_treated_as_exact", hook: "explorer-estimate-scoop" });
    }
    if (mode === "organise") return item({ id: `transfer-organise-${n}-${i + 1}`, format: "number-path", blueprint: "garden-count-transfer", band: "stretch", concept: "practical_object_count_transfer",
      prompt: `Maker-table mission ${i + 1}: count ${n} mixed ${noun} accurately and record the total.`, body: { exact_quantity: n, organisation_plan: ["move each object once", "make groups of ten", "count leftover ones", "match numeral"], choices: numberChoices(n), review_interval_days: day }, answer: n,
      hints: ["Choose a counted area and an uncounted area.", `Make ${Math.floor(n / 10)} complete tens, then count ${n % 10} ones.`], explanation: `${Math.floor(n / 10)} tens and ${n % 10} ones make ${n}. Moving each object once prevents skips and double counts.`, correct: `${n} objects organised and counted accurately.`, repair: "Use two trays labelled TO COUNT and COUNTED; transfer one object for each count word.", tag: "objects_skipped_or_double_counted", hook: "maker-table-count" });
    if (mode === "compare-quantity") {
      const other = clamp(n + [-9, -1, 1, 8][i % 4], 0, 100), answer = n > other ? n : other;
      return item({ id: `transfer-compare-${n}-${other}-${i + 1}`, format: "number-path", blueprint: "garden-count-transfer", band: "stretch", concept: "compare_quantities_transfer",
        prompt: `Habitat mission ${i + 1}: one tray has ${n} ${noun}; another has ${other}. Which quantity is greater?`, body: { quantities: [n, other], choices: [n, other], representations: [representations[i % representations.length], representations[(i + 1) % representations.length]], compare_language: "greater_than", review_interval_days: day }, answer,
        hints: ["Different models can represent quantities fairly.", "Compare tens first, then ones if needed."], explanation: `${answer} is greater because it lies further along the number line and has the larger place-value quantity.`, correct: `Greater quantity ${answer} identified across representations.`, repair: "Translate both models into tens and ones cards, then align them on the same number line.", tag: "larger_picture_means_larger_number", hook: "habitat-compare" });
    }
    if (mode === "line-transfer") {
      const low = Math.floor(n / 10) * 10, high = Math.min(100, low + 10);
      return item({ id: `transfer-line-${n}-${i + 1}`, format: "number-path", blueprint: "garden-count-transfer", band: "stretch", concept: "number_line_transfer",
        prompt: `Map-coordinate mission ${i + 1}: place ${n} on the line from ${low} to ${high}.`, body: { target: n, anchors: [low, high], interval: 1, choices: range(low, high - low + 1), tens_ones: parts(n), review_interval_days: day }, answer: n,
        hints: [`Begin at ${low}.`, `Count ${n - low} equal one-steps toward ${high}.`], explanation: `${n} is ${n - low} ones after ${low}, so it belongs on that equal-spaced tick.`, correct: `${n} transferred from place value to number-line position.`, repair: "Build the extra ones beside the lower ten, then move the same number of equal line steps.", tag: "number_line_spacing_guess", hook: "map-coordinate-line" });
    }
    if (mode === "conserve-repair") return item({ id: `transfer-conserve-${n}-${i + 1}`, format: "number-path", blueprint: "garden-count-transfer", band: "stretch", concept: "conservation_misconception_repair",
      prompt: `Windy-garden mission ${i + 1}: ${n} ${noun} spread farther apart. A helper says there are more now. Choose the best check.`, body: { quantity: n, choices: ["No object was added: organise and recount the same objects.", "Choose more because the row is longer.", "Start counting but count some objects twice."], review_interval_days: day }, answer: "No object was added: organise and recount the same objects.",
      hints: ["Ask whether anything was added or removed.", "Spacing changes appearance, not quantity."], explanation: `The quantity remains ${n}. Organising and recounting checks conservation without relying on how much space the objects use.`, correct: "Conservation misconception repaired with an exact check.", repair: "Match each object before and after one-to-one, then group both arrangements into equal tens and ones.", tag: "spread_out_means_more", hook: "windy-garden-repair" });
    if (mode === "order-context") {
      const values = unique([n, clamp(n - 7, 0, 100), clamp(n + 4, 0, 100)]), answer = [...values].sort((a, b) => a - b);
      return item({ id: `transfer-order-${n}-${i + 1}`, format: "number-path", blueprint: "garden-count-transfer", band: "stretch", concept: "order_quantities_transfer",
        prompt: `Supply-shelf mission ${i + 1}: order boxes labelled ${values.join(", ")} from least to greatest.`, body: { quantities: rotate(values, i % 3), order_language: "least_to_greatest", choices: values, review_interval_days: day }, answer,
        hints: ["Least is the smallest quantity.", "Use tens first, then ones, or place every label on a number line."], explanation: `${answer.join(" < ")} is least to greatest.`, correct: "Three quantities ordered using place-value evidence.", repair: "Build only the tens for all three first, then add ones to break any tie.", tag: "order_by_ones_digit_only", hook: "supply-shelf-order" });
    }
    const direction = i % 2 ? -1 : 1, start = direction === 1 ? n : Math.min(100, n + 4), sequence = Array.from({ length: 5 }, (_, x) => start + direction * x), gap = 2, answer = sequence[gap];
    return item({ id: `spaced-${start}-${direction}-${i + 1}`, format: "number-path", blueprint: "garden-count-transfer", band: "retrieval", concept: "spaced_counting_transfer",
      prompt: `Memory-path mission ${i + 1}: after ${day} days, restore the missing number in ${sequence.map((x, j) => j === gap ? "__" : x).join(", ")}.`, body: { path: sequence.map((x, j) => j === gap ? null : x), choices: numberChoices(answer), direction: direction === 1 ? "forwards" : "backwards", step: direction, review_interval_days: day }, answer,
      hints: [`The path changes by ${direction === 1 ? "one more" : "one less"} each step.`, "Check the gap from both sides."], explanation: `${sequence.join(", ")} is stable ${direction === 1 ? "forward" : "backward"} counting, so the missing number is ${answer}.`, correct: `Spaced counting pattern restored with ${answer}.`, repair: "Return to a short number track, anchor the nearest shown number and move one equal step into the gap.", tag: "retrieval_sequence_skip", hook: "memory-path-return" });
  });
}

function item({ id, format, blueprint, band, concept, prompt, body, answer, hints, explanation, correct, repair, tag, hook, audioScript }) {
  const audio = audioScript ? {
    audio_required: true, narration_script: audioScript, audio_asset_id: `narration-${prefix}${id}`, audio_provider: "ElevenLabs",
    audio_asset_status: "required_human_listening_review", human_listening_approval_required: true, browser_tts_allowed: false, browser_tts_fallback: "prohibited",
    unavailable_audio_state: "honest_not_ready_show_visual_sequence_or_use_adult_narration", audio_replay_unlimited: true,
  } : { audio_required: false, audio_route: "not_needed_for_this_concrete_or_visual_task" };
  return {
    id: `${prefix}${id}`, format,
    body: {
      prompt, ...body, ...audio, concept_focus: concept,
      response_mode: "tap_drag_keyboard_switch_eye_gaze_aac_point_or_adult_scribed",
      supported_interaction: "An adult or peer may read, scan choices, move named counters or record the child's indicated answer without supplying the number.",
      concrete_route: "Use large counters, ten-frames, bundled sticks, a bead string or a tactile number track; the child may choose one representation.",
      visual_route: "One uncluttered representation per panel with large numerals, clear spacing, optional number-word labels and no colour-only meaning.",
      dyscalculia_support: { stable_start_marker: true, one_to_one_counting_cues: true, tens_ones_partitions: true, number_line_available: true, manipulatives_optional: true, numeral_word_quantity_link: true },
      processing_route: "Reveal one count step or one group at a time, allow pauses, preserve correct placements and reduce choices to two when useful.",
      motor_alternative: "Tap, keyboard, switch scan, eye gaze, AAC, pointing or adult-scribed placement can replace dragging, speech and handwriting.",
      low_visual_load: true, reduced_motion: "instant_state_change_and_static_focus_outline", preserve_correct_work: true, undo_available: true,
      no_timer: true, speed_score_allowed: false, microphone_required: false, handwriting_required: false, retry_without_penalty: true,
      gamification: { mission: "explore a calm counting garden and repair one number path", reward: "one map leaf for organising or checking a quantity", lives: false, streaks: false, loss_on_error: false, leaderboard: false, speed_bonus: false, retry_message: "Your correct counters and stones stay. Choose another tool or clue and continue." },
      difficulty_band: band, evidence_purpose: concept, variant_blueprint_id: blueprint, review_batch: reviewBatch,
    },
    expected_answer: { value: answer }, hints, explanation,
    feedback: { correct, repair, mathematical_evidence: explanation, strategy_message: "Counting, grouping, touching, pointing, moving, saying, eye gaze and adult-scribed answers are equally valid evidence; speed is not scored." },
    difficulty: band === "intro" ? 2 : band === "developing" ? 3 : band === "expected" ? 4 : 5,
    status: "review", misconception_tag: tag, animation_hook: hook,
  };
}

function validateBank(currentPack, curated, snapshot, generated, curatedBlueprint) {
  if (curated.length !== 3) throw new Error(`Expected 3 curated variants, found ${curated.length}.`);
  if (JSON.stringify(curated) !== snapshot) throw new Error("Curated variants changed during generation.");
  if (currentPack.question_variants.length !== 220 || generated.length !== 217) throw new Error("Pilot must contain 3 curated and 217 generated variants.");
  const ids = currentPack.question_variants.map((v) => v.id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate variant IDs found.");
  const counts = countBy(currentPack.question_variants, (v) => v.body?.variant_blueprint_id ?? curatedBlueprint.get(v.id));
  for (const [id, total] of Object.entries(allocation)) if (counts[id] !== total) throw new Error(`${id} expected ${total}, found ${counts[id] ?? 0}.`);
  const concepts = new Set(generated.map((v) => v.body.concept_focus));
  for (const concept of ["stable_forward_count", "stable_backward_count", "one_more", "one_less", "organised_one_to_one_object_count", "quantity_conservation", "numeral_word_quantity_equivalence", "tens_and_ones_compose", "compare_numbers_with_place_value", "order_numbers_descending", "number_line_placement", "forward_missing_number", "count_in_2s_pattern", "count_in_5s_pattern", "count_in_10s_pattern", "estimate_then_exact_check", "sequence_misconception_repair", "spaced_counting_transfer"]) if (!concepts.has(concept)) throw new Error(`Missing concept ${concept}.`);
  for (const v of generated) {
    const b = v.body;
    if (!b.dyscalculia_support?.tens_ones_partitions || !b.concrete_route || !b.visual_route || !b.motor_alternative || !b.low_visual_load) throw new Error(`Missing SEND/dyscalculia route in ${v.id}.`);
    if (!v.feedback?.correct || !v.feedback?.repair || !v.feedback?.mathematical_evidence) throw new Error(`Missing rich feedback in ${v.id}.`);
    if (!b.no_timer || b.speed_score_allowed || b.gamification?.lives || b.gamification?.streaks || b.gamification?.loss_on_error) throw new Error(`Pressure mechanic in ${v.id}.`);
    if (b.audio_required) {
      if (b.audio_provider !== "ElevenLabs" || b.audio_asset_status !== "required_human_listening_review" || !b.human_listening_approval_required || b.browser_tts_allowed !== false || b.browser_tts_fallback !== "prohibited") throw new Error(`Audio policy failure in ${v.id}.`);
    } else if (b.audio_asset_id || b.audio_provider) throw new Error(`Unnecessary audio reference in ${v.id}.`);
  }
}

function numberWord(n) {
  const small = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  if (n < 20) return small[n];
  if (n === 100) return "one hundred";
  return n % 10 ? `${tens[Math.floor(n / 10)]}-${small[n % 10]}` : tens[n / 10];
}
function parts(n) { return { tens: Math.floor(n / 10), ones: n % 10 }; }
function range(start, count) { return Array.from({ length: count }, (_, i) => start + i); }
function rangeDown(start, count) { return Array.from({ length: count }, (_, i) => start - i); }
function numberChoices(n) { return unique([n, clamp(n - 1, 0, 100), clamp(n + 1, 0, 100), n >= 10 ? Number(`${n % 10}${Math.floor(n / 10)}`) : clamp(n + 10, 0, 100)]); }
function patternChoices(n, step) { return unique([n, clamp(n - step, 0, 100), clamp(n + 1, 0, 100), clamp(n + step, 0, 100)]); }
function nearestTen(n) { return clamp(Math.round(n / 10) * 10, 0, 100); }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function rotate(items, n) { const a = [...items], k = a.length ? n % a.length : 0; return a.slice(k).concat(a.slice(0, k)); }
function unique(items) { return [...new Set(items)]; }
function countBy(items, fn) { const out = {}; for (const item of items) { const key = fn(item); out[key] = (out[key] ?? 0) + 1; } return out; }
function summary(items, fn) { return Object.entries(countBy(items, fn)).sort(([a], [b]) => String(a).localeCompare(String(b))).map(([k, v]) => `${k}:${v}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
