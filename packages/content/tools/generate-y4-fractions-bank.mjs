#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/ma-y4-fractions.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y4-fractions-bank-";
const reviewBatch = "y4-fractions-cross-year-pilot-a";
const pilotAllocation = {
  "same-whole-calibration": 52,
  "common-equivalent-bar-matches": 52,
  "same-denominator-add-subtract-builds": 52,
  "hundredths-grid-counts": 52,
  "fraction-retrieval-expedition": 52,
};

const wholeCases = [
  ["half-third", 12, 12, 1, 2, 1, 3], ["third-quarter", 10, 10, 1, 3, 1, 4], ["quarter-eighth", 16, 16, 3, 4, 5, 8],
  ["two-fifths-half", 15, 15, 2, 5, 1, 2], ["three-sixths-four-eighths", 14, 14, 3, 6, 4, 8], ["unequal-half", 8, 16, 1, 2, 1, 2],
  ["unequal-thirds", 18, 9, 2, 3, 2, 3], ["sixth-third", 12, 12, 1, 6, 1, 3], ["five-tenths-half", 20, 20, 5, 10, 1, 2],
  ["three-eighths-half", 16, 16, 3, 8, 1, 2], ["four-sixths-two-thirds", 18, 18, 4, 6, 2, 3], ["unequal-quarters", 12, 20, 3, 4, 3, 4],
  ["seven-tenths-three-fifths", 10, 10, 7, 10, 3, 5],
].map(([id, wholeA, wholeB, nA, dA, nB, dB]) => ({ id, wholeA, wholeB, nA, dA, nB, dB }));

const equivalentPairs = [
  [1, 2, 2, 4], [1, 2, 3, 6], [1, 2, 4, 8], [1, 2, 5, 10], [1, 2, 6, 12],
  [1, 3, 2, 6], [1, 3, 3, 9], [1, 3, 4, 12], [2, 3, 4, 6], [2, 3, 6, 9], [2, 3, 8, 12],
  [1, 4, 2, 8], [1, 4, 3, 12], [3, 4, 6, 8], [3, 4, 9, 12], [1, 5, 2, 10], [2, 5, 4, 10],
].map(([n, d, en, ed]) => ({ n, d, en, ed }));

const operationCases = [
  [1, 5, 2, "add"], [2, 5, 2, "add"], [3, 8, 2, "add"], [1, 8, 5, "add"], [2, 6, 3, "add"],
  [4, 10, 3, "add"], [2, 7, 4, "add"], [3, 9, 5, "add"], [1, 4, 2, "add"], [5, 12, 4, "add"],
  [4, 5, 2, "subtract"], [7, 8, 3, "subtract"], [5, 6, 2, "subtract"], [9, 10, 4, "subtract"], [6, 7, 2, "subtract"],
  [8, 9, 5, "subtract"], [3, 4, 1, "subtract"], [11, 12, 5, "subtract"], [6, 10, 3, "subtract"], [5, 8, 4, "subtract"],
].map(([a, d, b, operation]) => ({ a, d, b, operation }));

const quantityCases = [
  [1, 2, 18], [1, 3, 24], [2, 3, 21], [1, 4, 28], [3, 4, 20], [1, 5, 30], [2, 5, 25], [3, 5, 35], [1, 6, 36], [5, 6, 24],
].map(([n, d, total]) => ({ n, d, total }));

const hundredthsValues = [4, 7, 10, 12, 19, 20, 27, 30, 36, 45, 50, 58, 64, 70, 83, 90, 96];

const mixedCases = [
  [1, 2, 3, 8, 24], [2, 3, 3, 4, 20], [3, 5, 7, 10, 30], [1, 4, 2, 8, 32], [5, 6, 4, 6, 24],
  [3, 8, 1, 2, 40], [4, 5, 7, 10, 25], [2, 6, 1, 3, 36], [5, 10, 4, 8, 18], [1, 5, 3, 10, 50],
  [7, 8, 5, 8, 32], [2, 4, 3, 6, 28], [4, 6, 5, 6, 30], [3, 10, 1, 5, 40], [6, 8, 3, 4, 24],
  [2, 5, 1, 2, 35], [9, 10, 4, 5, 20],
].map(([nA, dA, nB, dB, total]) => ({ nA, dA, nB, dB, total }));

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y4-fractions") throw new Error("This generator only supports the Year 4 fractions pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedAllocation = countBy(curated, curatedBlueprint);
const targets = Object.fromEntries(Object.entries(pilotAllocation).map(([id, total]) => [id, total - (curatedAllocation[id] ?? 0)]));
for (const [blueprint, count] of Object.entries(targets)) if (count < 0) throw new Error(`Curated variants exceed ${blueprint}.`);

const candidates = [
  ...sameWholeCandidates(targets["same-whole-calibration"]),
  ...equivalenceCandidates(targets["common-equivalent-bar-matches"]),
  ...operationCandidates(targets["same-denominator-add-subtract-builds"]),
  ...hundredthsCandidates(targets["hundredths-grid-counts"]),
  ...retrievalCandidates(targets["fraction-retrieval-expedition"]),
];

pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Review-stage Year 4 fractions pack with a deterministic 260-item pilot bank and five preserved curated variants. The bank covers same-whole calibration, common equivalence, tenths and hundredths, same-denominator addition and subtraction, fractions of quantities, number lines, visual models, comparison and misconception reasoning. Generated candidates include strategic untimed mission progression, SEND and dyslexia scaffolds, manipulatives, non-drag supported interactions and evidence-led feedback. Independent mathematics, teacher, accessibility, safeguarding and renderer review remain required before promotion.";
validateBank(pack, curated, candidates);

console.log(`y4-fractions-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`y4-fractions-bank blueprints=${allocationSummary(curated, candidates)}`);
console.log(`y4-fractions-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y4-fractions-bank bands=${summary(candidates, (variant) => variant.body.difficulty_band)}`);
console.log(`y4-fractions-bank strands=${summary(candidates, (variant) => variant.body.strand)}`);

const nextText = `${JSON.stringify(pack, null, 2)}\n`;
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y4-fractions-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 4 fractions bank is out of date; run generate-y4-fractions-bank.mjs --write.");
  console.log("y4-fractions-bank deterministic check passed");
} else {
  console.log("y4-fractions-bank dry-run; pass --write to update the pack");
}

function sameWholeCandidates(count) {
  const variants = [];
  for (const item of wholeCases) {
    const same = item.wholeA === item.wholeB;
    const fA = fraction(item.nA, item.dA);
    const fB = fraction(item.nB, item.dB);
    const comparison = compareFractions(item.nA, item.dA, item.nB, item.dB);
    const fairAnswer = same ? "Yes, the bars represent same-size wholes" : "No, resize the bars to the same whole before comparing";
    const larger = comparison === 0 ? `${fA} and ${fB} are equivalent` : comparison > 0 ? `${fA} is larger` : `${fB} is larger`;
    const comparisonDistractors = comparison === 0
      ? ["Bar A covers more of its whole", "Bar B covers more of its whole"]
      : comparison > 0
        ? [`${fB} is larger`, `${fA} and ${fB} are equivalent`]
        : [`${fA} is larger`, `${fA} and ${fB} are equivalent`];
    const modes = [
      { id: "calibrate", stage: "check_same_size_whole", strand: "visual_models", prompt: `Bar A shows ${fA} of a ${item.wholeA}-unit whole and bar B shows ${fB} of a ${item.wholeB}-unit whole. Is it fair to compare their shaded fractions yet?`, expected: fairAnswer, choices: [fairAnswer, same ? "No, equal wholes can never be compared" : "Yes, shaded colour is enough", "Yes, denominator size is all that matters", "No fractions can be shown with bars"], hints: ["Compare the full bar lengths before the shaded parts.", same ? "The whole lengths match." : "The whole lengths do not match."], explanation: same ? "The two complete bars have equal length, so their fraction parts can be compared fairly." : "Fractions describe parts of a whole. Different-size wholes must be calibrated to the same size before their shaded amounts are compared.", purpose: "same_whole_calibration" },
      { id: "model", stage: "select_fair_visual_model", strand: "visual_models", prompt: `Which model gives a fair visual comparison of ${fA} and ${fB}?`, expected: "Two equal-length bars, each split into its stated number of equal parts", choices: ["Two equal-length bars, each split into its stated number of equal parts", "A short bar for the first fraction and a long bar for the second", "Two bars with unequal parts", "Only two shaded pieces with the wholes hidden"], hints: ["The whole bars must match in length.", "Every part within each bar must be equal."], explanation: "Equal-length wholes and equal partitions make the fraction endpoints meaningful and prevent a misleading area comparison.", purpose: "fair_fraction_model" },
      { id: "compare", stage: "compare_after_calibration", strand: "comparison", prompt: `After matching the whole sizes, compare ${fA} and ${fB}.`, expected: larger, choices: [larger, ...comparisonDistractors, "The larger denominator always wins"], hints: ["Use equal-length fraction bars or compare the shaded endpoints.", "Check the value, not just the denominator."], explanation: comparison === 0 ? `${fA} and ${fB} reach the same endpoint on equal wholes, so they are equivalent.` : `${comparison > 0 ? fA : fB} reaches farther on an equal whole, so it is the larger fraction.`, purpose: "same_whole_fraction_comparison" },
      { id: "reason", stage: "repair_unequal_whole_reasoning", strand: "reasoning", prompt: `A mission scout compares ${fA} of a ${item.wholeA}-unit bar with ${fB} of a ${item.wholeB}-unit bar without checking the wholes. What is the best correction?`, expected: "Match the whole sizes first, then compare the fraction endpoints", choices: ["Match the whole sizes first, then compare the fraction endpoints", "Choose the bar with more shaded centimetres", "Choose the fraction with the larger denominator", "Add both denominators before comparing"], hints: ["A fraction is relative to its whole.", "Calibrate before deciding."], explanation: "Absolute shaded length can mislead when wholes differ. Matching the whole sizes makes the fraction comparison valid.", purpose: "unequal_whole_misconception_repair" },
    ];
    for (const mode of modes) variants.push(makeVariant({ ...mode, id: `${prefix}whole-${item.id}-${mode.id}`, format: "tap-choice", blueprint: "same-whole-calibration", misconception: "unequal_wholes", coverage: ["same_whole", "visual_model", mode.strand, "misconception"], body: { bar_a: { whole_length_units: item.wholeA, numerator: item.nA, denominator: item.dA }, bar_b: { whole_length_units: item.wholeB, numerator: item.nB, denominator: item.dB }, same_size_wholes: same } }));
  }
  return variants.slice(0, count);
}

function equivalenceCandidates(count) {
  const variants = [];
  for (const item of equivalentPairs) {
    const base = fraction(item.n, item.d);
    const equivalent = fraction(item.en, item.ed);
    const factor = item.en / item.n;
    const modes = [
      { id: "match", stage: "align_equivalent_bars", strand: "equivalence", prompt: `Which fraction bar reaches the same endpoint as ${base}?`, expected: equivalent, choices: [equivalent, fraction(item.n, item.ed), fraction(item.en, item.d), fraction(Math.min(item.ed, item.en + 1), item.ed)], hints: ["Use equal-length wholes and align the shaded endpoints.", `Split each ${item.d === 1 ? "whole" : `${ordinalPart(item.d)}`} into ${factor} equal smaller parts.`], explanation: `${base} and ${equivalent} cover the same amount of an equal-size whole. Both numerator and denominator were multiplied by ${factor}.`, purpose: "common_equivalent_fraction_match" },
      { id: "missing", stage: "complete_equivalent_fraction", strand: "equivalence", prompt: `Complete the equivalence: ${base} = ?/${item.ed}.`, expected: String(item.en), choices: [String(item.en), String(item.n), String(item.ed), String(Math.min(item.ed - 1, item.en + item.d))], hints: [`The denominator was multiplied by ${factor}.`, "Multiply the numerator by the same factor."], explanation: `${item.d} × ${factor} = ${item.ed}, so ${item.n} × ${factor} = ${item.en}. Therefore ${base} = ${equivalent}.`, purpose: "equivalent_missing_numerator" },
      { id: "line", stage: "place_equivalents_on_number_line", strand: "number_lines", prompt: `On a 0-to-1 number line, which statement about ${base} and ${equivalent} is correct?`, expected: "They belong at the same point", choices: ["They belong at the same point", `${equivalent} is farther right because its numbers are larger`, `${base} is farther right because its denominator is smaller`, "They cannot appear on one number line"], hints: ["Equivalent fractions have the same value.", "Use the aligned fraction bars to locate one shared endpoint."], explanation: `${base} = ${equivalent}, so both labels mark the same position on a 0-to-1 number line.`, purpose: "equivalent_number_line_position" },
    ];
    for (const mode of modes) variants.push(makeVariant({ ...mode, id: `${prefix}equivalent-${item.n}-${item.d}-${item.en}-${item.ed}-${mode.id}`, format: "fraction-bar-match", blueprint: "common-equivalent-bar-matches", misconception: "surface_shading_match", coverage: ["equivalence", "visual_model", mode.strand, "reasoning"], body: { target_fraction: base, equivalent_fraction: equivalent, scale_factor: factor, bars: [{ numerator: item.n, denominator: item.d }, { numerator: item.en, denominator: item.ed }], number_line: mode.id === "line" ? { minimum: 0, maximum: 1, shared_value: item.n / item.d } : undefined } }));
  }
  return variants.slice(0, count);
}

function operationCandidates(count) {
  const variants = [];
  for (const item of operationCases) {
    const result = item.operation === "add" ? item.a + item.b : item.a - item.b;
    const symbol = item.operation === "add" ? "+" : "−";
    const expression = `${fraction(item.a, item.d)} ${symbol} ${fraction(item.b, item.d)}`;
    const answer = fraction(result, item.d);
    const wrongDenominator = item.operation === "add" ? item.d * 2 : 0;
    const modes = [
      { id: "build", stage: `build_same_denominator_${item.operation}`, strand: item.operation === "add" ? "addition" : "subtraction", prompt: `Build and solve ${expression}.`, expected: answer, choices: [answer, fraction(result, wrongDenominator), fraction(item.operation === "add" ? Math.abs(item.a - item.b) : item.a + item.b, item.d), fraction(item.operation === "add" ? (result < item.d ? result + 1 : result - 1) : Math.max(0, result - 1), item.d)], hints: [`Every tile is ${fraction(1, item.d)}.`, `${item.operation === "add" ? "Combine" : "Remove"} the numerators and keep the denominator ${item.d}.`], explanation: `${item.operation === "add" ? "Combining" : "Removing"} equal ${ordinalPart(item.d)} changes the number of parts from ${item.a} by ${item.b}, but the part name remains ${ordinalPart(item.d)}. The result is ${answer}.`, purpose: "same_denominator_operation_build" },
      { id: "reason", stage: "explain_denominator_stays_fixed", strand: "reasoning", prompt: `Why does the denominator stay ${item.d} in ${expression}?`, expected: `The parts are ${ordinalPart(item.d)} before and after, so only the number of parts changes`, choices: [`The parts are ${ordinalPart(item.d)} before and after, so only the number of parts changes`, "The denominator is ignored in every fraction calculation", `The denominators should be ${item.operation === "add" ? "added" : "subtracted"} after counting`, "The whole changes size during the calculation"], hints: ["Say what one tile is called.", "The size of each equal part does not change."], explanation: `Both fractions count ${ordinalPart(item.d)} of the same-size whole. ${item.operation === "add" ? "Adding" : "Subtracting"} changes how many are counted, not their denominator.`, purpose: "same_denominator_reasoning" },
    ];
    for (const mode of modes) variants.push(makeVariant({ ...mode, id: `${prefix}operation-${item.operation}-${item.a}-${item.b}-${item.d}-${mode.id}`, format: "same-denominator-build", blueprint: "same-denominator-add-subtract-builds", misconception: item.operation === "add" ? "adds_denominators" : "subtracts_denominators", coverage: [mode.strand, "same_denominator", "visual_model", "misconception"], body: { operation: item.operation, first_numerator: item.a, second_numerator: item.b, denominator: item.d, result_numerator: result, result_within_one_whole: result <= item.d } }));
  }
  for (const item of quantityCases) {
    const groupSize = item.total / item.d;
    const answerValue = groupSize * item.n;
    variants.push(makeVariant({
      id: `${prefix}quantity-${item.n}-${item.d}-of-${item.total}`, format: "same-denominator-build", blueprint: "same-denominator-add-subtract-builds", stage: "find_fraction_of_quantity", strand: "fractions_of_quantities",
      prompt: `A supply cache contains ${item.total} counters. What is ${fraction(item.n, item.d)} of the counters?`, expected: String(answerValue), choices: [String(answerValue), String(groupSize + item.n), String(item.total - item.d), String(Math.min(item.total, answerValue + item.d))],
      hints: [`Share ${item.total} counters into ${item.d} equal groups.`, `One group has ${groupSize}; count ${item.n} ${item.n === 1 ? "group" : "groups"}.`],
      explanation: `${item.total} ÷ ${item.d} = ${groupSize} in each equal group. ${groupSize} × ${item.n} = ${answerValue}, so ${fraction(item.n, item.d)} of ${item.total} is ${answerValue}.`, purpose: "fraction_of_quantity_equal_groups", misconception: "multiplies_total_by_denominator", coverage: ["fractions_of_quantities", "equal_groups", "manipulative", "reasoning"], body: { fraction: fraction(item.n, item.d), total_quantity: item.total, equal_groups: item.d, group_size: groupSize, groups_selected: item.n },
    }));
  }
  return variants.slice(0, count);
}

function hundredthsCandidates(count) {
  const variants = [];
  for (const value of hundredthsValues) {
    const tens = Math.floor(value / 10);
    const ones = value % 10;
    const direction = value <= 50 ? "up" : "down";
    const step = value % 3 === 0 ? 5 : value % 2 === 0 ? 2 : 1;
    const next = direction === "up" ? value + step : value - step;
    const modes = [
      { id: "grid", stage: "count_hundred_square", strand: "hundredths", prompt: `A 10 by 10 grid has ${value} cells marked. What fraction of the whole is marked?`, expected: fraction(value, 100), choices: [fraction(value, 100), fraction(value, 10), fraction(value === 50 ? 40 : 100 - value, 100), fraction(reverseDigits(value), 100)], hints: ["The whole grid contains 100 equal cells.", `Count ${tens} full rows of ten and ${ones} extra ${ones === 1 ? "cell" : "cells"}.`], explanation: `${value} marked cells out of 100 equal cells is ${fraction(value, 100)}.`, purpose: "hundred_square_fraction_count" },
      { id: "regroup", stage: "connect_tenths_and_hundredths", strand: "tenths_hundredths", prompt: `How can ${value}/100 be described using tenths and hundredths?`, expected: `${tens} tenths and ${ones} hundredths`, choices: [`${tens} tenths and ${ones} hundredths`, `${ones} tenths and ${tens} hundredths`, `${value} tenths`, `${tens + ones} hundredths`], hints: ["Ten hundredths make one tenth.", `Regroup ${tens * 10} hundredths into ${tens} ${tens === 1 ? "tenth" : "tenths"}.`], explanation: `${value} hundredths contains ${tens} complete groups of ten hundredths and ${ones} more hundredths, so it is ${tens} tenths and ${ones} hundredths.`, purpose: "tenths_hundredths_regrouping" },
      { id: "line", stage: "count_hundredths_on_number_line", strand: "number_lines", prompt: `Start at ${value}/100 and count ${direction} by ${step} hundredths. Where is the next point?`, expected: fraction(next, 100), choices: [fraction(next, 100), fraction(direction === "up" ? value + 10 : value - 10, 100), fraction(value, 10), fraction(direction === "up" ? value - step : value + step, 100)], hints: ["Keep the denominator 100.", `${direction === "up" ? "Add" : "Subtract"} ${step} from the numerator.`], explanation: `${value} ${direction === "up" ? "+" : "−"} ${step} = ${next}, so the next number-line point is ${fraction(next, 100)}.`, purpose: "hundredths_number_line_count" },
    ];
    for (const mode of modes) variants.push(makeVariant({ ...mode, id: `${prefix}hundredths-${value}-${mode.id}`, format: "hundred-square-count", blueprint: "hundredths-grid-counts", misconception: "tenths_hundredths_confusion", coverage: ["hundredths", mode.strand, "number_line", "visual_model", "misconception"], body: { grid_rows: 10, grid_columns: 10, marked_cells: value, full_tenths_rows: tens, extra_hundredths: ones, number_line: mode.id === "line" ? { minimum: 0, maximum: 1, start_numerator: value, step_hundredths: direction === "up" ? step : -step } : undefined } }));
  }
  return variants.slice(0, count);
}

function retrievalCandidates(count) {
  const variants = [];
  for (const item of mixedCases) {
    const fA = fraction(item.nA, item.dA);
    const fB = fraction(item.nB, item.dB);
    const comparison = compareFractions(item.nA, item.dA, item.nB, item.dB);
    const comparisonAnswer = comparison === 0 ? `${fA} = ${fB}` : comparison > 0 ? `${fA} > ${fB}` : `${fA} < ${fB}`;
    const quantityNumerator = item.nA;
    const quantityDenominator = item.dA;
    const adjustedTotal = item.total - (item.total % quantityDenominator);
    const quantityAnswer = adjustedTotal / quantityDenominator * quantityNumerator;
    const modes = [
      { id: "compare", stage: "mixed_fraction_comparison", strand: "comparison", prompt: `Choose the correct comparison for ${fA} and ${fB}.`, expected: comparisonAnswer, choices: [comparisonAnswer, comparison === 0 ? `${fA} > ${fB}` : comparison > 0 ? `${fA} < ${fB}` : `${fA} > ${fB}`, comparison === 0 ? `${fA} < ${fB}` : `${fA} = ${fB}`, "The fraction with the larger denominator is always larger"], hints: ["Use equal-length bars, a shared number line or equivalent fractions.", "Do not compare denominators alone."], explanation: comparison === 0 ? `Both fractions reach the same point because ${item.nA * item.dB} = ${item.nB * item.dA}; aligned bars confirm that the values are equal.` : `${item.nA} × ${item.dB} ${comparison > 0 ? ">" : "<"} ${item.nB} × ${item.dA}, so ${comparisonAnswer}; equal-whole bars show the same ordering.`, purpose: "mixed_fraction_comparison" },
      { id: "diagnose", stage: "diagnose_fraction_misconception", strand: "misconceptions", prompt: `While comparing ${fA} with ${fB}, a scout says '${comparison > 0 ? fB : fA} is larger because its denominator is larger.' Which response repairs the reasoning?`, expected: "Use same-size wholes and compare values; a larger denominator means smaller unit parts, not automatically a larger fraction", choices: ["Use same-size wholes and compare values; a larger denominator means smaller unit parts, not automatically a larger fraction", "The scout is always correct", "Add the numerator and denominator of each fraction", "Use different-size wholes to make the pieces match"], hints: ["The denominator names the number of equal parts.", "More equal parts make each unit part smaller when the whole is fixed."], explanation: `Denominator size alone cannot decide a non-unit fraction comparison. Equal wholes, fraction bars, equivalence or a number line show the actual values.`, purpose: "larger_denominator_misconception_repair" },
      { id: "quantity", stage: "retrieve_fraction_of_quantity", strand: "fractions_of_quantities", prompt: `At the supply station, what is ${fraction(quantityNumerator, quantityDenominator)} of ${adjustedTotal}?`, expected: String(quantityAnswer), choices: [String(quantityAnswer), String(quantityAnswer + 1), String(quantityAnswer - 1), String(quantityAnswer + quantityDenominator)], hints: [`Divide ${adjustedTotal} into ${quantityDenominator} equal groups.`, `Select ${quantityNumerator} of those groups.`], explanation: `${adjustedTotal} ÷ ${quantityDenominator} = ${adjustedTotal / quantityDenominator}, then ${adjustedTotal / quantityDenominator} × ${quantityNumerator} = ${quantityAnswer}; this selects the required equal groups.`, purpose: "spaced_fraction_of_quantity" },
    ];
    for (const mode of modes) variants.push(makeVariant({ ...mode, id: `${prefix}retrieval-${item.nA}-${item.dA}-${item.nB}-${item.dB}-${mode.id}`, format: "tap-choice", blueprint: "fraction-retrieval-expedition", misconception: mode.id === "quantity" ? "fraction_of_quantity_one_group_only" : "larger_denominator_larger_fraction", coverage: [mode.strand, "reasoning", "misconception", "spaced_retrieval"], body: { fraction_a: fA, fraction_b: fB, comparison: comparisonAnswer, quantity_total: mode.id === "quantity" ? adjustedTotal : undefined, review_interval_days: [1, 3, 7, 14, 30][variants.length % 5] } }));
  }
  return variants.slice(0, count);
}

function makeVariant({ id, format, blueprint, stage, strand, prompt, choices, expected, hints, explanation, purpose, misconception, coverage, body }) {
  const band = bandFor(blueprint, stage);
  const mission = missionFor(strand, stage, id);
  return {
    id,
    format,
    body: {
      prompt,
      choices: rotate(unique(choices), id.length % choices.length),
      ...body,
      strand,
      coverage_tags: coverage,
      conceptual_progression: stage,
      difficulty_band: band,
      evidence_purpose: purpose,
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
      response_mode: "tap_keyboard_switch_numeric_oral_or_partner_recorded",
      interaction_support: { keyboard: true, switch_scan: true, touch: true, numeric_entry: true, oral_or_partner_recording: true, drag_required: false, undo_available: true },
      send_scaffolds: { one_decision_per_screen: true, persistent_fraction_language: true, worked_first_step_option: true, sentence_frame: true, no_time_limit: true, reread_and_recount: true },
      dyslexia_support: { increased_spacing: true, adjustable_line_length: true, tinted_background_option: true, readable_font_option: true, numerator_denominator_alignment: true },
      manipulative_route: manipulativeFor(format, strand),
      alternatives: { visual: "static patterned bars, grids, counters or number-line points with labels", tactile: "adult-prepared fraction strips, counters or raised number-line markers with matching text labels", text: "linear part-whole description and numeric table; no colour or spatial precision is required" },
      reduced_visual_load: true,
      reduced_motion_alternative: "instant before-and-after states with numbered text steps",
      feedback_mode: "confirm the valid strategy step, then repair one misconception with the model still visible",
      mission,
      pressure_rules: { timer: false, speed_score: false, streak_loss: false, lives: false, public_ranking: false, retry_cost: false },
    },
    expected_answer: { value: expected },
    hints,
    explanation,
    feedback: { correct: `Mission evidence secured: ${purpose.replaceAll("_", " ")}.`, repair: repairFor(strand, stage), retry: "The route stays open. Keep the useful clue and test one new strategy." },
    difficulty: difficultyFor(band),
    status: "review",
    misconception_tag: misconception,
    animation_hook: animationFor(strand),
  };
}

function missionFor(strand, stage, id) {
  const sectors = { visual_models: "Calibration Causeway", comparison: "Comparator Cliffs", reasoning: "Reasoning Ruins", equivalence: "Equivalence Bridge", number_lines: "Number-Line Ridge", addition: "Combine Camp", subtraction: "Difference Docks", fractions_of_quantities: "Supply Split Station", hundredths: "Hundred-Square Observatory", tenths_hundredths: "Place-Value Pass", misconceptions: "Decoy Detector", spaced_retrieval: "Return Route" };
  const tools = { equivalence: "align endpoints", number_lines: "locate the shared point", addition: "lock the denominator", subtraction: "remove equal parts", fractions_of_quantities: "divide into equal groups, then select groups", comparison: "calibrate wholes before comparing", hundredths: "count full rows, then single cells", tenths_hundredths: "regroup ten hundredths as one tenth" };
  const sector = sectors[strand] ?? "Fraction Frontier";
  return {
    campaign: "Fraction Frontier: Restore the Five Navigation Beacons",
    sector,
    role: "strategy navigator",
    mission_code: id.slice(-24),
    brief: `Secure the ${sector} route by choosing evidence, not by guessing quickly.`,
    strategic_tool: tools[strand] ?? "check the whole, equal parts and fraction value",
    intel_sequence: ["inspect the representation", "choose a strategy", "check the result against the whole"],
    reward: { item: "navigation-beacon shard", earned_for: "using a valid fraction strategy or completing a repair", collection_effect: "reveals another map route without changing task difficulty" },
    retry_protocol: "No lives are lost; a misconception choice reveals a targeted clue and preserves correct work.",
    stage,
  };
}

function validateBank(packData, curatedItems, generated) {
  const pilot = packData.practice.variant_targets.pilot;
  if (curatedItems.length !== 5) throw new Error(`Expected five curated variants, found ${curatedItems.length}.`);
  if (generated.length !== pilot - curatedItems.length || curatedItems.length + generated.length !== pilot) throw new Error(`Pilot bank must contain exactly ${pilot} variants.`);
  const blueprintMap = new Map(packData.variant_blueprints.map((item) => [item.id, item]));
  const ids = new Set(); const signatures = new Set();
  for (const variant of [...curatedItems, ...generated]) {
    if (ids.has(variant.id)) throw new Error(`Duplicate id ${variant.id}.`); ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${normalise(variant.expected_answer?.value)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`); signatures.add(signature);
  }
  const coverage = new Set(); const formats = new Set(); const blueprints = new Set(); const bands = new Set();
  for (const variant of generated) {
    const blueprint = blueprintMap.get(variant.body.variant_blueprint_id);
    if (!blueprint || variant.format !== blueprint.format) throw new Error(`${variant.id} does not match its blueprint format.`);
    if (variant.status !== "review") throw new Error(`${variant.id} must remain in review.`);
    if (!Array.isArray(variant.body.choices) || variant.body.choices.length < 4 || new Set(variant.body.choices).size !== variant.body.choices.length) throw new Error(`${variant.id} has invalid choices.`);
    if (variant.body.choices.filter((choice) => choice === variant.expected_answer.value).length !== 1) throw new Error(`${variant.id} must contain its answer exactly once.`);
    if (!variant.body.interaction_support?.keyboard || !variant.body.interaction_support?.switch_scan || variant.body.interaction_support?.drag_required !== false) throw new Error(`${variant.id} lacks supported interactions.`);
    if (!variant.body.send_scaffolds?.one_decision_per_screen || !variant.body.dyslexia_support?.numerator_denominator_alignment || !variant.body.manipulative_route || !variant.body.alternatives?.tactile || !variant.body.alternatives?.text) throw new Error(`${variant.id} lacks SEND/manipulative routes.`);
    if (variant.body.reduced_visual_load !== true || Object.values(variant.body.pressure_rules).some((value) => value !== false)) throw new Error(`${variant.id} introduces pressure.`);
    if (variant.body.mission?.campaign !== "Fraction Frontier: Restore the Five Navigation Beacons" || !variant.body.mission?.strategic_tool || !variant.body.mission?.reward || !/No lives/.test(variant.body.mission?.retry_protocol)) throw new Error(`${variant.id} lacks strategic mission gamification.`);
    if (!variant.feedback?.repair || !variant.feedback?.retry || variant.hints.length < 2 || variant.explanation.length < 45) throw new Error(`${variant.id} lacks feedback.`);
    validateMath(variant);
    for (const tag of variant.body.coverage_tags) coverage.add(tag);
    formats.add(variant.format); blueprints.add(variant.body.variant_blueprint_id); bands.add(variant.body.difficulty_band);
  }
  const allocation = combinedAllocation(curatedItems, generated);
  for (const [blueprint, expected] of Object.entries(pilotAllocation)) if (allocation[blueprint] !== expected) throw new Error(`${blueprint} expected ${expected}, found ${allocation[blueprint] ?? 0}.`);
  assertCovered("formats", new Set(packData.practice.formats), formats);
  assertCovered("blueprints", new Set(blueprintMap.keys()), blueprints);
  assertCovered("difficulty bands", new Set([...packData.practice.difficulty_bands, ...packData.variant_blueprints.map((item) => item.difficulty_band)]), bands);
  assertCovered("curriculum coverage", new Set(["same_whole", "equivalence", "tenths_hundredths", "hundredths", "addition", "subtraction", "fractions_of_quantities", "number_line", "visual_model", "comparison", "reasoning", "misconception"]), coverage);
}

function validateMath(variant) {
  const body = variant.body;
  if (body.scale_factor && body.target_fraction && body.equivalent_fraction) {
    const [a, b] = parseFraction(body.target_fraction); const [c, d] = parseFraction(body.equivalent_fraction);
    if (a * d !== b * c) throw new Error(`${variant.id} has invalid equivalence.`);
  }
  if (body.operation) {
    const expected = body.operation === "add" ? body.first_numerator + body.second_numerator : body.first_numerator - body.second_numerator;
    if (body.result_numerator !== expected || expected < 0 || expected > body.denominator) throw new Error(`${variant.id} has invalid operation metadata.`);
  }
  if (body.total_quantity) {
    if (body.total_quantity % body.equal_groups !== 0 || body.group_size * body.equal_groups !== body.total_quantity) throw new Error(`${variant.id} has invalid quantity grouping.`);
  }
  if (body.marked_cells !== undefined && (body.marked_cells < 0 || body.marked_cells > 100 || body.full_tenths_rows * 10 + body.extra_hundredths !== body.marked_cells)) throw new Error(`${variant.id} has invalid hundred-square data.`);
}

function manipulativeFor(format, strand) {
  if (strand === "fractions_of_quantities") return "Use counters in equal hoops; keyboard and switch controls offer divide, select group and undo.";
  if (format === "fraction-bar-match") return "Stack equal-length patterned fraction strips and compare labelled endpoints without dragging.";
  if (format === "same-denominator-build") return "Use labelled equal-part tiles with add, remove, group and denominator-lock controls.";
  if (format === "hundred-square-count") return "Use a numbered 10 by 10 grid with add ten, add one, remove and direct numeric entry.";
  return "Use same-whole bars, counters or a raised 0-to-1 number line with stepper controls.";
}
function repairFor(strand, stage) {
  if (stage.includes("whole")) return "Match the full whole lengths, then compare the shaded endpoints.";
  if (strand === "equivalence" || strand === "number_lines") return "Align equal-length bars and multiply or divide numerator and denominator by the same factor.";
  if (strand === "addition" || strand === "subtraction") return "Name one equal part, lock the denominator, then recount only the numerator.";
  if (strand === "fractions_of_quantities") return "Share the total into denominator-many equal groups, then select numerator-many groups.";
  if (strand === "hundredths" || strand === "tenths_hundredths") return "Count complete rows of ten hundredths, then the remaining single cells.";
  return "Use equal wholes or a shared number line and test the misconception against the model.";
}
function animationFor(strand) { return ({ equivalence: "fraction-bar-align", number_lines: "fraction-number-line-marker", addition: "numerator-counter-snap", subtraction: "fraction-tiles-remove", fractions_of_quantities: "equal-groups-supply-sort", hundredths: "hundred-square-fill", tenths_hundredths: "hundredths-regroup-ten", comparison: "denominator-piece-compare" }[strand] ?? "fraction-mission-map-check"); }
function bandFor(blueprint, stage) { if (blueprint === "same-whole-calibration") return stage.includes("reason") ? "developing" : "intro"; if (blueprint === "common-equivalent-bar-matches") return stage.includes("line") ? "expected" : "developing"; if (blueprint === "same-denominator-add-subtract-builds") return stage.includes("quantity") || stage.includes("reason") ? "secure" : "expected"; if (blueprint === "hundredths-grid-counts") return stage.includes("line") ? "stretch" : "secure"; return "retrieval"; }
function difficultyFor(band) { return { intro: 2, developing: 4, expected: 5, secure: 7, stretch: 8, retrieval: 5 }[band]; }
function compareFractions(nA, dA, nB, dB) { return Math.sign(nA * dB - nB * dA); }
function fraction(n, d) { return `${n}/${d}`; }
function parseFraction(value) { return value.split("/").map(Number); }
function reverseDigits(value) { return Number(String(value).padStart(2, "0").split("").reverse().join("")); }
function ordinalPart(denominator) { return ({ 2: "halves", 3: "thirds", 4: "quarters", 5: "fifths", 6: "sixths", 7: "sevenths", 8: "eighths", 9: "ninths", 10: "tenths", 12: "twelfths" })[denominator] ?? `${denominator}ths`; }
function curatedBlueprint(variant) { const map = { "ma-y4-fractions-q-half-equivalent": "common-equivalent-bar-matches", "ma-y4-fractions-q-add-fifths": "same-denominator-add-subtract-builds", "ma-y4-fractions-q-third-sixth-compare": "fraction-retrieval-expedition", "ma-y4-fractions-q-hundredths-37": "hundredths-grid-counts", "ma-y4-fractions-q-subtract-eighths": "same-denominator-add-subtract-builds" }; const value = map[variant.id]; if (!value) throw new Error(`No curated blueprint assignment for ${variant.id}.`); return value; }
function combinedAllocation(curatedItems, generated) { const counts = countBy(curatedItems, curatedBlueprint); for (const variant of generated) counts[variant.body.variant_blueprint_id] = (counts[variant.body.variant_blueprint_id] ?? 0) + 1; return counts; }
function allocationSummary(curatedItems, generated) { return Object.entries(combinedAllocation(curatedItems, generated)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function assertCovered(label, required, actual) { const missing = [...required].filter((value) => !actual.has(value)); if (missing.length) throw new Error(`Missing ${label}: ${missing.join(", ")}.`); }
function countBy(items, keyFor) { const counts = {}; for (const item of items) { const key = keyFor(item); counts[key] = (counts[key] ?? 0) + 1; } return counts; }
function summary(items, keyFor) { return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function unique(items) { return [...new Set(items)]; }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function capitalise(value) { return `${value.charAt(0).toUpperCase()}${value.slice(1)}`; }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
