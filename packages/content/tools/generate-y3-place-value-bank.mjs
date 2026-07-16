#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/ma-y3-place-value-to-1000.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y3-place-value-to-1000-bank-";
const reviewBatch = "y3-place-value-pilot-a";

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y3-place-value-to-1000") {
  throw new Error("This generator only supports the Year 3 place value to 1000 pack.");
}

for (const variant of pack.question_variants ?? []) {
  if (typeof variant.explanation === "string" && variant.explanation.includes(" The expected response is ")) {
    variant.explanation = variant.explanation.split(" The expected response is ")[0];
  }
}

const beforeVariants = structuredClone(pack.question_variants ?? []);
const beforeCore = coreSnapshot(beforeVariants);
const beforeBlueprints = sortedCounts(beforeVariants, (variant) => variant.body?.variant_blueprint_id);
const beforeMissingFeedback = countMissingFeedback(beforeVariants);
const beforeMissingRoute = countMissingRoute(beforeVariants);
const authored = beforeVariants.filter((variant) => !variant.id.startsWith(prefix)).map(enrichVariant);
const candidates = [
  ...buildReadCandidates(),
  ...zeroPlaceholderCandidates(),
  ...compareOrderLocateCandidates(),
  ...changeByTenHundredCandidates(),
  ...mixedRetrievalCandidates(),
].map(enrichVariant);

validateBank(pack, authored, candidates);
pack.question_variants = [...authored, ...candidates];
pack.version = "0.3.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Quality-hardened Year 3 place-value pack with the same four curated variants and 216 deterministic pilot candidates. IDs, answers, blueprint allocation, arithmetic, representations and scope remain unchanged. Every variant now has concept-specific correct feedback, place-value/representation evidence, misconception repair and a targeted check prompt. Explicit touch, keyboard, switch, eye-gaze, AAC/point/adult-scribed routes remove mandatory dragging, handwriting and speech. HTO charts, base-ten models, calibrated number lines, before/after 10-or-100 changes and dyscalculia supports remain pressure-free. Narration stays selectively absent; any future narration must use produced, human-reviewed ElevenLabs assets and browser TTS is prohibited. Curriculum, teacher, accessibility and safeguarding checks remain required before promotion.";
validateHardening(pack.question_variants, beforeCore, beforeBlueprints);
const afterMissingFeedback = countMissingFeedback(pack.question_variants);
const afterMissingRoute = countMissingRoute(pack.question_variants);

enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y3-place-value-bank authored=${authored.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`y3-place-value-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`y3-place-value-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`y3-place-value-bank bands=${summary(candidates, (variant) => variant.body.difficulty_band)}`);
console.log(`y3-place-value-bank coverage=${summaryCoverage(candidates)}`);
console.log(`y3-place-value-bank missing_feedback before=${beforeMissingFeedback} after=${afterMissingFeedback}`);
console.log(`y3-place-value-bank missing_route before=${beforeMissingRoute} after=${afterMissingRoute}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y3-place-value-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) {
    throw new Error("Year 3 place-value bank is out of date; run generate-y3-place-value-bank.mjs --write.");
  }
  console.log("y3-place-value-bank deterministic check passed");
} else {
  console.log("y3-place-value-bank dry-run; pass --write to update the pack");
}

function buildReadCandidates() {
  const numbers = [123, 146, 178, 214, 237, 265, 319, 342, 386, 421, 458, 532, 567, 614, 648, 725, 759, 831, 864, 932, 956, 987];
  const variants = [];
  for (const number of numbers) {
    const digits = placeDigits(number);
    const buildIndex = variants.length;
    variants.push({
      id: `${prefix}build-${number}`,
      format: "base-ten-build",
      body: {
        prompt: `Build ${number} using hundreds, tens and ones at the island supply camp.`,
        target: number,
        available_units: ["hundred", "ten", "one"],
        accepted_exchange: "10 ones = 1 ten; 10 tens = 1 hundred",
        coverage_tags: ["compose", "flexible_representation", "reasoning"],
        conceptual_progression: "compose_quantity_then_match_numeral",
        ...interactionMetadata("base-ten-build", buildIndex),
        evidence_purpose: "quantity_numeral_match",
        variant_blueprint_id: "build-read-three-digit-numbers",
      },
      expected_answer: { value: digits },
      hints: [
        `Start with ${digits.hundreds} hundred${digits.hundreds === 1 ? "" : "s"}.`,
        `Then add ${digits.tens} ten${digits.tens === 1 ? "" : "s"} and ${digits.ones} one${digits.ones === 1 ? "" : "s"}.`,
      ],
      explanation: `${number} is ${digits.hundreds} hundreds, ${digits.tens} tens and ${digits.ones} ones: ${expandedForm(number)}.`,
      difficulty: difficultyFor(bandFor(buildIndex)),
      status: "review",
      misconception_tag: "digit_face_value",
      animation_hook: "supplies-group-by-place",
    });

    const decomposeIndex = variants.length;
    const expected = expandedForm(number);
    variants.push(makeChoice({
      id: `${prefix}decompose-${number}`,
      format: "base-ten-build",
      prompt: `The supply counter shows ${number}. Which expanded form decomposes it correctly?`,
      choices: rotate([expected, ...expandedDistractors(number)], decomposeIndex % 4),
      expected,
      hints: ["Read the hundreds, tens and ones columns separately.", `The digit ${digits.tens} in the tens place is worth ${digits.tens * 10}.`],
      explanation: `${number} decomposes as ${expected}. Each digit keeps the value of its place.`,
      blueprint: "build-read-three-digit-numbers",
      evidencePurpose: "numeral_expanded_form_match",
      misconception: "digit_face_value",
      animation: "partition-links-lock",
      bandIndex: decomposeIndex,
      coverageTags: ["decompose", "flexible_representation", "misconception"],
      progressionStage: "decompose_numeral_by_place",
      body: { target: number, place_digits: digits },
    }));
  }
  return variants;
}

function zeroPlaceholderCandidates() {
  const numbers = [101, 105, 109, 203, 207, 304, 308, 402, 407, 502, 506, 603, 607, 704, 708, 802, 805, 901, 905, 470, 820];
  const variants = [];
  for (const number of numbers) {
    const digits = placeDigits(number);
    const expanded = expandedForm(number);
    const expandedIndex = variants.length;
    variants.push(makeChoice({
      id: `${prefix}zero-expanded-${number}`,
      format: "place-value-chart",
      prompt: `Which expanded form preserves every place in ${number}?`,
      choices: rotate([expanded, ...zeroExpandedDistractors(number)], expandedIndex % 4),
      expected: expanded,
      hints: [digits.tens === 0 ? "The tens column is empty, so the zero must stay as a placeholder." : "The ones column is empty, so the numeral ends in zero.", "Do not shift a digit into an empty place."],
      explanation: `${number} has ${digits.hundreds} hundreds, ${digits.tens} tens and ${digits.ones} ones, so it is ${expanded}.`,
      blueprint: "zero-placeholder-and-partition",
      evidencePurpose: "zero_placeholder_expanded_form",
      misconception: "zero_removed_or_shifted",
      animation: "empty-tens-placeholder",
      bandIndex: expandedIndex + 1,
      coverageTags: ["zero_placeholder", "decompose", "misconception"],
      progressionStage: "preserve_empty_place_in_expanded_form",
      body: { number, place_digits: digits },
    }));

    const chartIndex = variants.length;
    variants.push(makeChoice({
      id: `${prefix}zero-chart-${number}`,
      format: "place-value-chart",
      prompt: `An HTO chart shows ${digits.hundreds} hundreds, ${digits.tens} tens and ${digits.ones} ones. Which numeral belongs beside it?`,
      choices: rotate(numberDistractors(number), chartIndex % 4),
      expected: number,
      hints: ["Keep one digit in each labelled H, T and O column.", digits.tens === 0 ? "Write zero in the empty tens place." : "Write zero in the empty ones place."],
      explanation: `The chart records ${digits.hundreds} in hundreds, ${digits.tens} in tens and ${digits.ones} in ones, making ${number}.`,
      blueprint: "zero-placeholder-and-partition",
      evidencePurpose: "hto_chart_to_numeral",
      misconception: "zero_removed_or_shifted",
      animation: "empty-tens-placeholder",
      bandIndex: chartIndex + 1,
      coverageTags: ["zero_placeholder", "compose", "misconception"],
      progressionStage: "record_empty_place_in_numeral",
      body: { number, place_digits: digits },
    }));
  }

  variants.push(makeChoice({
    id: `${prefix}zero-chart-900-check`,
    format: "place-value-chart",
    prompt: "Which HTO description records 900 without removing either empty place?",
    choices: ["9 hundreds, 0 tens, 0 ones", "9 tens, 0 ones", "0 hundreds, 9 tens, 0 ones", "9 hundreds, 9 tens, 9 ones"],
    expected: "9 hundreds, 0 tens, 0 ones",
    hints: ["Nine hundred needs a 9 in the hundreds column.", "Both tens and ones columns are empty and need zero placeholders."],
    explanation: "900 has 9 hundreds, no tens and no ones, so both zero placeholders remain.",
    blueprint: "zero-placeholder-and-partition",
    evidencePurpose: "double_zero_placeholder",
    misconception: "zero_removed_or_shifted",
    animation: "empty-tens-placeholder",
    bandIndex: variants.length + 1,
    coverageTags: ["zero_placeholder", "reasoning", "misconception"],
    progressionStage: "preserve_two_empty_places",
    body: { number: 900, place_digits: placeDigits(900) },
  }));
  return variants;
}

function compareOrderLocateCandidates() {
  const variants = [];
  const pairs = [[347, 374], [608, 680], [721, 712], [905, 950], [438, 483], [699, 696], [801, 810], [264, 246], [550, 505], [919, 991]];
  for (const [left, right] of pairs) {
    const greater = Math.max(left, right);
    const decision = comparisonDecision(left, right);
    const compareIndex = variants.length;
    variants.push(makeChoice({
      id: `${prefix}compare-${left}-${right}`,
      format: "number-line-compare",
      prompt: `Which number is greater: ${left} or ${right}?`,
      choices: rotate([greater, Math.min(left, right), "They are equal", "There is not enough information"], compareIndex % 4),
      expected: greater,
      hints: ["Compare hundreds first, then tens, then ones.", `The ${decision.place} place is the first place that differs.`],
      explanation: `${greater} is greater. ${decision.explanation}`,
      blueprint: "compare-order-and-locate",
      evidencePurpose: "left_to_right_comparison",
      misconception: "compare_later_digit_first",
      animation: "left-to-right-compare",
      bandIndex: compareIndex + 2,
      coverageTags: ["compare", "reasoning", "misconception"],
      progressionStage: "compare_from_highest_place",
      body: { numbers: [left, right], greater, deciding_place: decision.place },
    }));

    const reasonIndex = variants.length;
    variants.push(makeChoice({
      id: `${prefix}compare-reason-${left}-${right}`,
      format: "number-line-compare",
      prompt: `Why is ${greater} greater when ${left} and ${right} are compared?`,
      choices: rotate([decision.explanation, ...comparisonReasonDistractors(decision.place)], reasonIndex % 4),
      expected: decision.explanation,
      hints: ["Align both numbers in HTO columns.", `Stop at the first difference in the ${decision.place} place.`],
      explanation: decision.explanation,
      blueprint: "compare-order-and-locate",
      evidencePurpose: "comparison_place_reason",
      misconception: "compare_later_digit_first",
      animation: "left-to-right-compare",
      bandIndex: reasonIndex + 2,
      coverageTags: ["compare", "reasoning", "misconception"],
      progressionStage: "justify_comparison_by_place",
      body: { numbers: [left, right], greater, deciding_place: decision.place },
    }));
  }

  const sets = [[312, 321, 231], [405, 450, 504], [678, 687, 768], [902, 920, 209], [555, 505, 550], [749, 794, 479]];
  for (const numbers of sets) {
    for (const direction of ["ascending", "descending"]) {
      const index = variants.length;
      const ordered = [...numbers].sort((a, b) => direction === "ascending" ? a - b : b - a);
      const expected = ordered.join(", ");
      variants.push(makeChoice({
        id: `${prefix}order-${direction}-${numbers.join("-")}`,
        format: "number-line-compare",
        prompt: `Choose the ${direction} order for ${numbers.join(", ")}.`,
        choices: rotate(orderChoices(numbers, expected), index % 4),
        expected,
        hints: [direction === "ascending" ? "Start with the least number." : "Start with the greatest number.", "Compare hundreds, then tens, then ones for close numbers."],
        explanation: `${expected} is ${direction} order because each number is ${direction === "ascending" ? "greater than" : "less than"} the number before it.`,
        blueprint: "compare-order-and-locate",
        evidencePurpose: "three_digit_ordering",
        misconception: "compare_later_digit_first",
        animation: "left-to-right-compare",
        bandIndex: index + 2,
        coverageTags: ["order", "compare", "reasoning"],
        progressionStage: "order_multiple_numbers",
        body: { numbers, direction },
      }));
    }
  }

  const estimates = [
    ["halfway between 200 and 300", 250, [250, 205, 300, 350], 200, 300],
    ["a little after 400 and before 450", 420, [420, 480, 350, 450], 400, 500],
    ["halfway between 700 and 800", 750, [750, 705, 800, 850], 700, 800],
    ["just after 600 on a 0 to 1000 line", 620, [620, 260, 800, 1000], 0, 1000],
    ["three quarters of the way from 900 to 1000", 975, [975, 925, 750, 1000], 900, 1000],
    ["halfway between 100 and 200", 150, [150, 105, 200, 250], 100, 200],
    ["close to 340 between 300 and 400", 340, [340, 304, 430, 390], 300, 400],
    ["just before 500 between 400 and 500", 490, [490, 410, 590, 450], 400, 500],
    ["one quarter of the way from 800 to 900", 825, [825, 875, 820, 900], 800, 900],
    ["near 560 between 500 and 600", 560, [560, 650, 506, 590], 500, 600],
    ["halfway between 0 and 1000", 500, [500, 50, 100, 1000], 0, 1000],
  ];
  for (let item = 0; item < estimates.length; item += 1) {
    const [description, expected, choices, minimum, maximum] = estimates[item];
    const index = variants.length;
    variants.push(makeChoice({
      id: `${prefix}estimate-line-${item + 1}`,
      format: "number-line-compare",
      prompt: `A marker is ${description}. What is the best estimate for its value?`,
      choices: rotate(choices, index % 4),
      expected,
      hints: [`Use the labelled endpoints ${minimum} and ${maximum}.`, "Use halfway or quarter points before choosing the closest value."],
      explanation: `${expected} best matches a marker ${description}.`,
      blueprint: "compare-order-and-locate",
      evidencePurpose: "calibrated_number_line_estimation",
      misconception: "compare_later_digit_first",
      animation: "place-value-line-marker",
      bandIndex: index + 2,
      coverageTags: ["number_line", "estimation", "reasoning"],
      progressionStage: "estimate_position_on_calibrated_line",
      body: { minimum, maximum, marker_description: description, estimated_value: expected },
    }));
  }
  return variants;
}

function changeByTenHundredCandidates() {
  const starts = [195, 205, 289, 310, 395, 405, 589, 610, 795, 805, 890];
  const changes = [-100, -10, 10, 100];
  const variants = [];
  for (const start of starts) {
    for (const change of changes) {
      if (start === 195 && change === -100) continue;
      const result = start + change;
      const places = changedPlaces(start, result);
      const expected = `${result}; ${placePhrase(places)}`;
      const index = variants.length;
      variants.push(makeChoice({
        id: `${prefix}change-${start}-${change > 0 ? "plus" : "minus"}-${Math.abs(change)}`,
        format: "change-by-10-100",
        prompt: `Find ${Math.abs(change)} ${change > 0 ? "more" : "less"} than ${start}. Which answer also names the digits that change?`,
        choices: rotate(changeChoices(start, change, result, places), index % 4),
        expected,
        hints: [change === 10 ? "Add one ten; the ones stay fixed." : change === -10 ? "Remove one ten; the ones stay fixed." : change === 100 ? "Add one hundred." : "Remove one hundred.", places.length > 1 ? "A boundary exchange makes more than one digit change." : `Only the ${places[0]} digit changes here.`],
        explanation: `${start} ${change > 0 ? "+" : "-"} ${Math.abs(change)} = ${result}. ${capitalise(placePhrase(places))}.`,
        blueprint: "ten-hundred-more-less-boundaries",
        evidencePurpose: Math.abs(change) === 10 ? "ten_more_less" : "hundred_more_less",
        misconception: "wrong_place_changes",
        animation: places.length > 1 ? "boundary-change-explain" : "number-line-place-jump",
        bandIndex: index + 3,
        coverageTags: ["reasoning", "misconception", Math.abs(change) === 10 ? "change_by_10" : "change_by_100", ...(places.length > 1 ? ["boundary_exchange"] : [])],
        progressionStage: places.length > 1 ? "change_across_place_boundary" : "change_one_place_value",
        body: { start, change, result, changed_places: places, number_line_jump: change },
      }));
    }
  }
  return variants;
}

function mixedRetrievalCandidates() {
  return [
    ...flexibleRepresentationRetrieval(),
    ...digitValueRetrieval(),
    ...estimationRetrieval(),
    ...reasoningRetrieval(),
    ...misconceptionRetrieval(),
  ];
}

function flexibleRepresentationRetrieval() {
  const numbers = [243, 356, 481, 527, 634, 742, 815, 928, 670, 904];
  return numbers.map((number, index) => {
    const digits = placeDigits(number);
    const expected = `${digits.hundreds - 1} hundreds, ${digits.tens + 10} tens and ${digits.ones} ones`;
    return makeChoice({
      id: `${prefix}retrieve-flex-${number}`,
      format: "place-value-chart",
      prompt: `Which different partition has the same total as ${number}?`,
      choices: rotate([expected, `${digits.hundreds} hundreds, ${digits.tens + 1} tens and ${digits.ones} ones`, `${digits.hundreds - 1} hundreds, ${digits.tens} tens and ${digits.ones} ones`, `${digits.hundreds} hundreds, ${digits.ones} tens and ${digits.tens} ones`], index % 4),
      expected,
      hints: ["Exchange one hundred for ten tens.", "Check that the total value stays unchanged."],
      explanation: `One hundred can be exchanged for ten tens, so ${number} can be shown as ${expected}.`,
      blueprint: "mixed-place-value-retrieval",
      evidencePurpose: "flexible_partition_equivalence",
      misconception: "digit_face_value",
      animation: "partition-links-lock",
      bandIndex: index + 4,
      coverageTags: ["flexible_representation", "compose", "decompose", "reasoning"],
      progressionStage: "rename_without_changing_total",
      body: { number, standard_partition: digits, exchange: "one_hundred_for_ten_tens" },
    });
  });
}

function digitValueRetrieval() {
  const cases = [[472, 4, 400], [638, 3, 30], [915, 5, 5], [284, 8, 80], [761, 7, 700], [349, 9, 9], [826, 2, 20], [593, 5, 500], [417, 1, 10], [685, 6, 600]];
  return cases.map(([number, digit, expected], index) => makeChoice({
    id: `${prefix}retrieve-value-${number}-${digit}`,
    format: "place-value-chart",
    prompt: `What is the value of the digit ${digit} in ${number}?`,
    choices: rotate(unique([expected, digit, digit * 10, digit * 100, number]).slice(0, 4), index % 4),
    expected,
    hints: ["Place the number in an HTO chart.", "Say the digit, its place and its value."],
    explanation: `In ${number}, the digit ${digit} is in the ${placeName(expected)} place, so its value is ${expected}.`,
    blueprint: "mixed-place-value-retrieval",
    evidencePurpose: "digit_place_value",
    misconception: "digit_face_value",
    animation: "digit-place-value-link",
    bandIndex: index + 5,
    coverageTags: ["reasoning", "misconception", "decompose"],
    progressionStage: "retrieve_digit_place_and_value",
    body: { number, selected_digit: digit, digit_value: expected },
  }));
}

function estimationRetrieval() {
  const cases = [
    ["between 300 and 400, a little after 350", 360, [360, 306, 430, 390]],
    ["between 600 and 700, close to 620", 620, [620, 260, 680, 720]],
    ["halfway between 800 and 900", 850, [850, 805, 900, 950]],
    ["between 100 and 200, close to 190", 190, [190, 109, 290, 150]],
    ["one quarter of the way from 400 to 500", 425, [425, 475, 420, 500]],
    ["three quarters of the way from 200 to 300", 275, [275, 225, 250, 300]],
    ["just after 700 on a 0 to 1000 line", 720, [720, 270, 800, 1000]],
    ["close to 980 between 900 and 1000", 980, [980, 908, 920, 1000]],
  ];
  return cases.map(([description, expected, choices], index) => makeChoice({
    id: `${prefix}retrieve-estimate-${index + 1}`,
    format: "place-value-chart",
    prompt: `A number-line marker is ${description}. Which value is the best estimate?`,
    choices: rotate(choices, index % 4),
    expected,
    hints: ["Use the labelled endpoints before estimating.", "Compare hundreds first, then judge the smaller interval."],
    explanation: `${expected} best matches a marker ${description}.`,
    blueprint: "mixed-place-value-retrieval",
    evidencePurpose: "number_line_estimation_retrieval",
    misconception: "compare_later_digit_first",
    animation: "place-value-line-marker",
    bandIndex: index + 6,
    coverageTags: ["number_line", "estimation", "reasoning"],
    progressionStage: "retrieve_calibrated_estimation",
    body: { marker_description: description, estimated_value: expected, representation_switch: "chart_to_number_line" },
  }));
}

function reasoningRetrieval() {
  const cases = [
    ["Which statement about 684 is true?", "684 is 6 hundreds, 8 tens and 4 ones", ["684 is 6 hundreds, 4 tens and 8 ones", "The 6 is worth 6", "The 8 is worth 800"]],
    ["Which statement correctly compares 730 and 703?", "730 is greater because 3 tens is greater than 0 tens", ["703 is greater because 3 ones is greater than 0 ones", "They are equal", "The ones place must be compared first"]],
    ["Which statement about 508 is true?", "The zero keeps the tens place empty", ["The zero can be removed to make 58", "The 8 is worth 80", "508 has 5 tens"]],
    ["Which statement explains 10 more than 296?", "306 is 10 more because one ten crosses a hundreds boundary", ["297 is 10 more", "396 is 10 more", "Every digit increases by 1"]],
    ["Which representation equals 450?", "4 hundreds and 5 tens", ["4 tens and 5 ones", "45 hundreds", "4 hundreds and 5 ones"]],
    ["Which number lies between 399 and 401?", 400, [390, 410, 499]],
    ["Which statement explains why 872 > 827?", "The hundreds match, then 7 tens is greater than 2 tens", ["2 ones is greater than 7 ones", "872 has more digits", "Compare ones first"]],
    ["Which statement describes 100 less than 640?", "540; only the hundreds digit changes", ["630; only the tens digit changes", "639; only the ones digit changes", "740; the hundreds digit increases"]],
  ];
  return cases.map(([prompt, expected, distractors], index) => makeChoice({
    id: `${prefix}retrieve-reason-${index + 1}`,
    format: "place-value-chart",
    prompt,
    choices: rotate([expected, ...distractors], index % 4),
    expected,
    hints: ["Use an HTO chart or number line to test each claim.", "Choose the statement whose place values preserve the number."],
    explanation: `${expected}. The place-value model confirms this statement.`,
    blueprint: "mixed-place-value-retrieval",
    evidencePurpose: "mixed_place_value_reasoning",
    misconception: index % 2 === 0 ? "zero_removed_or_shifted" : "compare_later_digit_first",
    animation: "active-place-outline",
    bandIndex: index + 7,
    coverageTags: ["reasoning", "misconception", "flexible_representation"],
    progressionStage: "select_and_check_place_value_claim",
    body: { reasoning_case: index + 1 },
  }));
}

function misconceptionRetrieval() {
  const cases = [
    ["A learner says the 7 in 742 is worth 7. Which repair is correct?", "Place 7 in the hundreds column and build 700", ["Move 7 to the ones column", "Remove the 7", "Call every 7 seven ones"]],
    ["A learner writes 305 as 35. Which repair is correct?", "Keep zero in the tens place: 3 hundreds, 0 tens, 5 ones", ["Move 5 into the tens place", "Write 3005", "Remove the empty column"]],
    ["A learner says 509 > 590 because 9 > 0. Which repair is correct?", "Compare hundreds, then tens: 9 tens makes 590 greater", ["Compare ones only", "Add both numbers", "Longer numerals are always greater"]],
    ["A learner finds 10 more than 428 by writing 429. Which repair is correct?", "Add one ten to make 438; the ones stay 8", ["Add one one", "Add one hundred", "Increase every digit"]],
    ["A learner says 6 hundreds and 14 tens is not a valid build. Which repair is correct?", "It is 740 because 14 tens can exchange for 1 hundred and 4 tens", ["It is 614", "It is 640", "Tens can never be more than 9 in a build"]],
    ["A learner places 680 before 608 in ascending order. Which repair is correct?", "Both have 6 hundreds; 0 tens is less than 8 tens, so 608 comes first", ["Compare ones first", "680 comes first because 8 is smaller", "The numbers are equal"]],
    ["A learner says 100 less than 805 is 804. Which repair is correct?", "Remove one hundred to make 705; tens and ones stay the same", ["Remove one one", "Remove one ten", "Change every digit"]],
  ];
  return cases.map(([prompt, expected, distractors], index) => makeChoice({
    id: `${prefix}retrieve-repair-${index + 1}`,
    format: "place-value-chart",
    prompt,
    choices: rotate([expected, ...distractors], index % 4),
    expected,
    hints: ["Rebuild the number in labelled HTO columns.", "Check that the repair preserves each digit's place value."],
    explanation: `${expected}. This directly repairs the place-value misconception.`,
    blueprint: "mixed-place-value-retrieval",
    evidencePurpose: "misconception_diagnosis_and_repair",
    misconception: ["digit_face_value", "zero_removed_or_shifted", "compare_later_digit_first", "wrong_place_changes"][index % 4],
    animation: "empty-tens-placeholder",
    bandIndex: index + 8,
    coverageTags: ["misconception", "reasoning", "flexible_representation"],
    progressionStage: "diagnose_and_repair_error",
    body: { repair_case: index + 1 },
  }));
}

function makeChoice({ id, format, prompt, choices, expected, hints, explanation, blueprint, evidencePurpose, misconception, animation, bandIndex, coverageTags, progressionStage, body }) {
  const difficultyBand = bandFor(bandIndex);
  return {
    id,
    format,
    body: {
      prompt,
      choices,
      ...body,
      coverage_tags: coverageTags,
      conceptual_progression: progressionStage,
      ...interactionMetadata(format, bandIndex),
      evidence_purpose: evidencePurpose,
      variant_blueprint_id: blueprint,
    },
    expected_answer: { value: expected },
    hints,
    explanation,
    difficulty: difficultyFor(difficultyBand),
    status: "review",
    misconception_tag: misconception,
    animation_hook: animation,
  };
}

function interactionMetadata(format, bandIndex) {
  const alternatives = {
    "base-ten-build": "labelled_H_T_O_table_with_unit_counts_and_exchange_buttons",
    "place-value-chart": "spoken_H_T_O_rows_with_numeral_and_expanded_form",
    "number-line-compare": "ordered_text_ticks_with_relative_position_description",
    "change-by-10-100": "before_and_after_H_T_O_tables_with_written_jump_equation",
  };
  return {
    difficulty_band: bandFor(bandIndex),
    review_batch: reviewBatch,
    response_mode: format === "base-ten-build" ? "tap_keyboard_switch_or_stepper" : "tap_keyboard_switch_or_oral_choice",
    audio_replay: true,
    timed: false,
    drag_required: false,
    colour_required: false,
    visual_load: "low",
    keyboard_instructions: format === "base-ten-build" ? "Use H, T and O stepper controls, then Enter to check." : "Use arrow keys to review choices, then Enter to select.",
    switch_scan_order: "prompt_then_model_then_controls_or_choices_then_check",
    static_alternative: alternatives[format],
    reduced_motion_alternative: "labelled_before_and_after_panels_with_instant_text_feedback",
    model_description_available: true,
    feedback_mode: "preserve_correct_places_then_offer_one_place_value_clue",
    world_context: "explorer_island_supply_camp",
    progress_feedback: "supply_map_progress_without_speed_or_streak_scoring",
  };
}

function validateBank(packData, authored, generated) {
  const pilot = packData.practice?.variant_targets?.pilot;
  if (authored.length !== 4) throw new Error(`Expected four curated variants, found ${authored.length}.`);
  if (generated.length !== pilot - authored.length) throw new Error(`Expected ${pilot - authored.length} generated candidates, found ${generated.length}.`);
  if (authored.length + generated.length !== pilot) throw new Error(`Pilot bank must contain exactly ${pilot} variants.`);

  const blueprintIDs = new Set((packData.variant_blueprints ?? []).map((blueprint) => blueprint.id));
  const formats = new Set(packData.practice?.formats ?? []);
  const bands = new Set([...(packData.practice?.difficulty_bands ?? []), ...(packData.variant_blueprints ?? []).map((blueprint) => blueprint.difficulty_band)]);
  const requiredCoverage = new Set(["compose", "decompose", "compare", "order", "number_line", "estimation", "zero_placeholder", "flexible_representation", "reasoning", "misconception"]);
  const actualBlueprints = new Set();
  const actualFormats = new Set();
  const actualBands = new Set();
  const actualCoverage = new Set();
  const ids = new Set();
  const signatures = new Set();

  for (const variant of [...authored, ...generated]) {
    if (ids.has(variant.id)) throw new Error(`Duplicate variant id ${variant.id}.`);
    ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${stableStringify(variant.expected_answer)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`);
    signatures.add(signature);
  }

  for (const variant of generated) {
    if (variant.status !== "review") throw new Error(`${variant.id} must remain in review.`);
    if (!blueprintIDs.has(variant.body?.variant_blueprint_id)) throw new Error(`${variant.id} has an unknown blueprint.`);
    if (!formats.has(variant.format)) throw new Error(`${variant.id} has unsupported format ${variant.format}.`);
    if (Array.isArray(variant.body?.choices) && variant.body.choices.filter((choice) => choice === variant.expected_answer?.value).length !== 1) {
      throw new Error(`${variant.id} must contain its expected choice exactly once.`);
    }
    if (!Array.isArray(variant.hints) || variant.hints.length < 2 || !variant.explanation) throw new Error(`${variant.id} needs two hints and an explanation.`);
    if (String(variant.body.prompt).length > 220) throw new Error(`${variant.id} prompt is too long for Year 3.`);
    if (variant.format === "base-ten-build" && variant.body.target && !variant.body.choices) {
      const expected = placeDigits(variant.body.target);
      if (stableStringify(variant.expected_answer?.value) !== stableStringify(expected)) throw new Error(`${variant.id} has an incorrect base-ten build.`);
    }
    if (variant.format === "change-by-10-100" && variant.body.start + variant.body.change !== variant.body.result) {
      throw new Error(`${variant.id} has an incorrect 10 or 100 change.`);
    }
    if (variant.body.greater && variant.body.greater !== Math.max(...variant.body.numbers)) throw new Error(`${variant.id} has an incorrect comparison.`);
    actualBlueprints.add(variant.body.variant_blueprint_id);
    actualFormats.add(variant.format);
    actualBands.add(variant.body.difficulty_band);
    for (const tag of variant.body.coverage_tags ?? []) actualCoverage.add(tag);
  }

  for (const variant of [...authored, ...generated]) validatePlaceValueContract(variant);

  assertCovered("blueprints", blueprintIDs, actualBlueprints);
  assertCovered("formats", formats, actualFormats);
  assertCovered("difficulty bands", bands, actualBands);
  assertCovered("curriculum coverage", requiredCoverage, actualCoverage);
}

function enrichVariant(variant) {
  const body = variant.body ?? {};
  const hasAudioReference = Boolean(body.audio_asset_id || body.audio_asset_ids?.length);
  const audioPolicy = hasAudioReference ? {
    audio_provider: "ElevenLabs",
    audio_production_policy: "produced_and_human_listening_reviewed_assets_only",
    human_listening_approval_required: true,
    browser_tts_allowed: false,
    browser_tts_fallback: "prohibited",
  } : {
    audio_required: false,
    audio_route: "not_required_labelled_models_numbers_and_text_are_complete",
    audio_policy: "if_narration_is_added_use_produced_human_reviewed_ElevenLabs_assets_only",
    browser_tts_allowed: false,
    browser_tts_fallback: "prohibited",
  };
  return {
    ...variant,
    body: {
      ...body,
      ...audioPolicy,
      interaction_route: {
        touch: "Tap labelled H, T or O steppers, a number-line position or a numbered choice; precise block or marker dragging is optional.",
        keyboard: "Tab through the model and controls; use H/T/O or arrow-key steppers and Enter or Space to select and check.",
        switch_scan: "Scan prompt, HTO/model or number line, controls/choices, check and retry in a fixed order with one activation per decision.",
        eye_gaze: "Use large dwell-select HTO controls, number-line labels and choices with adjustable dwell time and confirmation.",
        aac_point_adult_scribed: "The learner may point, use AAC or direct an adult to enter, move or record the indicated value without the adult supplying the place-value decision.",
        drag_required: false,
      },
      accessible_response_route: "Touch, keyboard, switch, eye gaze, AAC, pointing and adult-scribed responses provide equivalent mathematical evidence; dragging, handwriting and speech are never mandatory.",
      base_ten_route: "Hundreds squares, tens rods and ones use shape, text and numeric value labels; add/remove steppers and a linear HTO count table replace dragging.",
      place_value_chart_route: "Persistent hundreds, tens and ones headings hold one digit each, including explicit zero placeholders and expanded-value links.",
      number_line_route: "Calibrated endpoints, halfway/quarter anchors, typed value entry and labelled jump buttons provide static alternatives to marker movement.",
      change_model_route: "Before/after HTO charts and a labelled +10, −10, +100 or −100 jump show which places change and which value stays fixed.",
      dyscalculia_support: { place_headings_persistent: true, zero_placeholders_explicit: true, digit_and_value_shown_together: true, one_place_or_step_at_a_time: true, quantity_numeral_link: true, boundary_exchange_visible: true, correct_places_preserved: true },
      reduced_load_route: "Reveal one place, exchange, comparison decision or number-line anchor at a time while retaining the target number and correct work.",
      no_mandatory_dragging: true,
      no_mandatory_handwriting: true,
      no_mandatory_speech: true,
      microphone_required: false,
      handwriting_required: false,
      drag_required: false,
      retry_without_penalty: true,
      no_timer: true,
      speed_score_allowed: false,
      preserve_correct_work: true,
      undo_available: true,
      pressure_rules: { timer: false, speed_score: false, streaks: false, lives: false, loss_on_error: false, public_ranking: false, retry_cost: false },
      place_value_contract: placeValueContract(variant),
    },
    feedback: feedbackFor(variant),
  };
}

function placeValueContract(variant) {
  const body = variant.body ?? {};
  const responseModes = ["touch", "keyboard", "switch", "eye_gaze", "aac", "adult_scribed"];
  if (variant.format === "base-ten-build") {
    const structured = body.target !== undefined || body.place_digits !== undefined;
    return {
      kind: "hundreds_tens_ones_model",
      mode: structured ? (body.choices ? "choice_with_model" : "direct_model") : "authored_choice",
      target_key: structured && body.target !== undefined ? "target" : null,
      place_digits_key: body.place_digits !== undefined ? "place_digits" : null,
      model_key: "available_units",
      exchange_rules_key: "accepted_exchange",
      response_modes: responseModes,
      drag_required: false,
      preserve_correct_places: true,
    };
  }
  if (variant.format === "place-value-chart") {
    const structured = body.target !== undefined || body.place_digits !== undefined;
    return {
      kind: "place_value_chart",
      mode: structured ? "chart_evidence_choice" : "authored_choice",
      target_key: body.target !== undefined ? "target" : null,
      place_digits_key: body.place_digits !== undefined ? "place_digits" : null,
      choices_key: "choices",
      zero_placeholder_supported: true,
      response_modes: responseModes,
      drag_required: false,
      preserve_correct_places: true,
    };
  }
  if (variant.format === "number-line") {
    const structured = body.minimum !== undefined && body.maximum !== undefined;
    return {
      kind: "calibrated_number_line",
      mode: structured ? "benchmark_estimate" : "authored_choice",
      minimum_key: structured ? "minimum" : null,
      maximum_key: structured ? "maximum" : null,
      benchmarks_key: body.benchmarks !== undefined ? "benchmarks" : null,
      response_modes: responseModes,
      drag_required: false,
      preserve_correct_places: true,
    };
  }
  if (variant.format === "number-line-compare") {
    const structured = Array.isArray(body.numbers) && Array.isArray(body.choices);
    return {
      kind: "place_value_comparison",
      mode: structured ? "aligned_magnitude_choice" : "authored_choice",
      numbers_key: structured ? "numbers" : null,
      choices_key: structured ? "choices" : null,
      deciding_place_key: body.deciding_place !== undefined ? "deciding_place" : null,
      response_modes: responseModes,
      drag_required: false,
      preserve_correct_places: true,
    };
  }
  if (variant.format === "change-by-10-100") {
    const structured = body.start !== undefined && body.change !== undefined && body.result !== undefined;
    return {
      kind: "place_value_change",
      mode: structured ? "before_after_change" : "authored_choice",
      start_key: structured ? "start" : null,
      change_key: structured ? "change" : null,
      result_key: structured ? "result" : null,
      changed_places_key: body.changed_places !== undefined ? "changed_places" : null,
      response_modes: responseModes,
      drag_required: false,
      preserve_correct_places: true,
    };
  }
  if (variant.format === "tap-choice") {
    return {
      kind: "place_value_evidence_choice",
      mode: body.evidence_purpose !== undefined ? "evidence_linked_choice" : "authored_choice",
      choices_key: "choices",
      evidence_purpose_key: body.evidence_purpose !== undefined ? "evidence_purpose" : null,
      response_modes: responseModes,
      drag_required: false,
      preserve_correct_places: true,
    };
  }
  return null;
}

function validatePlaceValueContract(variant) {
  const body = variant.body ?? {};
  const contract = body.place_value_contract;
  const requiredResponseModes = ["touch", "keyboard", "switch", "eye_gaze", "aac", "adult_scribed"];
  if (!contract || contract.drag_required !== false || contract.preserve_correct_places !== true || requiredResponseModes.some((mode) => !contract.response_modes?.includes(mode))) throw new Error(`${variant.id} lacks an accessible place-value contract.`);
  if (variant.format === "base-ten-build") {
    if (contract.kind !== "hundreds_tens_ones_model") throw new Error(`${variant.id} has the wrong HTO model contract.`);
    if (contract.mode !== "direct_model" && contract.mode !== "choice_with_model" && contract.mode !== "authored_choice") throw new Error(`${variant.id} has an unknown HTO mode.`);
    if (contract.mode !== "authored_choice" && body[contract.target_key] === undefined && body[contract.place_digits_key] === undefined) throw new Error(`${variant.id} lacks HTO model data.`);
  } else if (variant.format === "place-value-chart") {
    if (contract.kind !== "place_value_chart") throw new Error(`${variant.id} has the wrong place-value chart contract.`);
    if (contract.mode === "chart_evidence_choice" && !Array.isArray(body[contract.choices_key])) throw new Error(`${variant.id} lacks place-value chart choices.`);
    if (contract.mode !== "chart_evidence_choice" && contract.mode !== "authored_choice") throw new Error(`${variant.id} has an unknown chart mode.`);
  } else if (variant.format === "number-line") {
    if (contract.kind !== "calibrated_number_line") throw new Error(`${variant.id} has the wrong calibrated line contract.`);
    if (contract.mode === "benchmark_estimate" && (body[contract.minimum_key] === undefined || body[contract.maximum_key] === undefined || body[contract.minimum_key] >= body[contract.maximum_key])) throw new Error(`${variant.id} lacks valid number-line bounds.`);
    if (contract.mode !== "benchmark_estimate" && contract.mode !== "authored_choice") throw new Error(`${variant.id} has an unknown number-line mode.`);
  } else if (variant.format === "number-line-compare") {
    if (contract.kind !== "place_value_comparison") throw new Error(`${variant.id} has the wrong place-value comparison contract.`);
    if (contract.mode === "aligned_magnitude_choice" && (!Array.isArray(body[contract.numbers_key]) || body[contract.numbers_key].length < 2 || !Array.isArray(body[contract.choices_key]))) throw new Error(`${variant.id} lacks comparison inputs.`);
    if (contract.mode !== "aligned_magnitude_choice" && contract.mode !== "authored_choice") throw new Error(`${variant.id} has an unknown comparison mode.`);
  } else if (variant.format === "change-by-10-100") {
    if (contract.kind !== "place_value_change") throw new Error(`${variant.id} has the wrong place-value change contract.`);
    if (contract.mode === "before_after_change" && body[contract.start_key] + body[contract.change_key] !== body[contract.result_key]) throw new Error(`${variant.id} has invalid place-value change arithmetic.`);
    if (contract.mode !== "before_after_change" && contract.mode !== "authored_choice") throw new Error(`${variant.id} has an unknown place-value change mode.`);
  } else if (variant.format === "tap-choice") {
    if (contract.kind !== "place_value_evidence_choice") throw new Error(`${variant.id} has the wrong place-value choice contract.`);
    if (contract.mode === "evidence_linked_choice" && !Array.isArray(body[contract.choices_key])) throw new Error(`${variant.id} lacks place-value evidence choices.`);
    if (contract.mode !== "evidence_linked_choice" && contract.mode !== "authored_choice") throw new Error(`${variant.id} has an unknown place-value choice mode.`);
  }
}

function feedbackFor(variant) {
  return {
    correct: correctFeedback(variant),
    representation_evidence: representationEvidence(variant),
    repair: repairFeedback(variant),
    misconception_check: variant.misconception_tag,
    check_prompt: checkPrompt(variant),
    strategy_support: strategySupport(variant),
    support_message: "Base-ten, HTO chart, number-line, touch, keyboard, switch, eye-gaze, AAC and adult-scribed routes are equally valid; speed, dragging, speech and handwriting are not scored.",
    retry: "Your correct places, digits and number-line anchors stay. Open one representation or check prompt, then retry without losing progress.",
  };
}

function correctFeedback(variant) {
  const answer = answerText(variant.expected_answer);
  if (variant.misconception_tag === "digit_face_value") return `“${answer}” correctly links each digit to its hundreds, tens or ones value and keeps the represented total unchanged.`;
  if (variant.misconception_tag === "zero_removed_or_shifted") return `“${answer}” keeps zero in the empty place so the other digits retain their correct hundreds, tens and ones values.`;
  if (variant.misconception_tag === "compare_later_digit_first") return `“${answer}” follows magnitude evidence by comparing hundreds first, then tens and ones, or by using the calibrated number-line position.`;
  return `“${answer}” applies the stated change of 10 or 100 and correctly identifies every digit changed by any boundary exchange.`;
}

function representationEvidence(variant) {
  const body = variant.body, answer = answerText(variant.expected_answer);
  if (variant.format === "base-ten-build") return `${body.target ?? "The target"} is represented with hundreds, tens and ones; the accepted equality 10 ones = 1 ten and 10 tens = 1 hundred preserves the total. Answer: ${answer}.`;
  if (body.place_digits) return `HTO evidence: ${body.place_digits.hundreds} hundreds, ${body.place_digits.tens} tens and ${body.place_digits.ones} ones. This supports ${answer}.`;
  if (body.number != null) { const digits = placeDigits(body.number); return `HTO evidence for ${body.number}: ${digits.hundreds} hundreds, ${digits.tens} tens and ${digits.ones} ones. This supports ${answer}.`; }
  if (body.start != null && body.change != null) return `${body.start} ${body.change >= 0 ? "+" : "−"} ${Math.abs(body.change)} = ${body.result}; comparing the before/after HTO charts shows ${body.changed_places?.join(", ") ?? variant.expected_answer.changed_places ?? "the stated places"} change.`;
  if (body.numbers) return `Align ${body.numbers.join(" and ")} in HTO columns and stop at the first unequal place${body.deciding_place ? `, the ${body.deciding_place}` : ""}; this supports ${answer}.`;
  if (body.minimum != null && body.maximum != null) return `The marker is calibrated between ${body.minimum} and ${body.maximum}; benchmark points support the estimate ${answer}.`;
  return `${variant.explanation} The number, chart, partition or line describes the same place-value quantity.`;
}

function repairFeedback(variant) {
  if (variant.misconception_tag === "digit_face_value") return "Place the numeral in an HTO chart, point to the target digit's column and say digit–place–value, for example 4–hundreds–400. Build or partition that value before choosing.";
  if (variant.misconception_tag === "zero_removed_or_shifted") return "Keep one position for H, T and O. Put 0 in every empty column, then read all three columns without shifting a digit left or right; check by rebuilding the quantity.";
  if (variant.misconception_tag === "compare_later_digit_first") return "Align the numbers and compare from the greatest place: hundreds, then tens, then ones. Stop at the first difference, or use labelled number-line anchors before estimating.";
  return "Show the start in an HTO chart, make exactly one ±10 or ±100 jump, exchange ten equal units if a boundary is crossed, and compare before/after digits while checking that unaffected places keep their value.";
}

function checkPrompt(variant) {
  if (variant.misconception_tag === "digit_face_value") return "Which H, T or O column contains the digit, and what quantity does that digit represent there?";
  if (variant.misconception_tag === "zero_removed_or_shifted") return "Which place has no units, and where must zero remain so no other digit shifts?";
  if (variant.misconception_tag === "compare_later_digit_first") return "What is the greatest place where the numbers differ, or which labelled anchors bound the marker?";
  return "Did the jump change tens or hundreds, and did crossing a boundary require an exchange while ones stayed fixed for a 10-change?";
}

function strategySupport(variant) {
  if (variant.misconception_tag === "digit_face_value") return "Use BUILD/CHART → DIGIT → PLACE → VALUE → TOTAL CHECK.";
  if (variant.misconception_tag === "zero_removed_or_shifted") return "Use H–T–O SLOTS → PLACE DIGITS → FILL EMPTY PLACE WITH 0 → READ BACK.";
  if (variant.misconception_tag === "compare_later_digit_first") return "Use ALIGN → HUNDREDS → TENS → ONES, or ENDPOINTS → BENCHMARK → ESTIMATE.";
  return "Use START HTO → ONE ±10/±100 JUMP → EXCHANGE IF NEEDED → COMPARE CHANGED PLACES → INVERSE CHECK.";
}

function answerText(answer) {
  if (answer == null) return "the selected answer";
  if (answer.value && typeof answer.value === "object") return `${answer.value.hundreds} hundreds, ${answer.value.tens} tens and ${answer.value.ones} ones`;
  if (answer.reason) return `${answer.value}; ${answer.reason}`;
  if (answer.changed_places) return `${answer.value}; ${answer.changed_places}`;
  return String(answer.value ?? answer);
}

function validateHardening(variants, beforeCoreSnapshot, beforeBlueprintCounts) {
  if (variants.length !== 220) throw new Error(`Expected 220 variants, found ${variants.length}.`);
  if (new Set(variants.map((variant) => variant.id)).size !== 220) throw new Error("Variant IDs are not unique.");
  if (JSON.stringify(coreSnapshot(variants)) !== JSON.stringify(beforeCoreSnapshot)) throw new Error("Hardening changed IDs, answers, curated content, arithmetic, representations or mathematical scope.");
  if (JSON.stringify(sortedCounts(variants, (variant) => variant.body?.variant_blueprint_id)) !== JSON.stringify(beforeBlueprintCounts)) throw new Error("Blueprint allocation changed during hardening.");
  if (countMissingFeedback(variants) !== 0) throw new Error("At least one variant still lacks concept-specific feedback.");
  if (countMissingRoute(variants) !== 0) throw new Error("At least one variant still lacks a complete interaction route.");
  for (const variant of variants) {
    const body = variant.body, hasAudioReference = Boolean(body.audio_asset_id || body.audio_asset_ids?.length);
    if (hasAudioReference) {
      if (body.audio_provider !== "ElevenLabs" || body.audio_production_policy !== "produced_and_human_listening_reviewed_assets_only" || !body.human_listening_approval_required || body.browser_tts_allowed !== false || body.browser_tts_fallback !== "prohibited") throw new Error(`Audio policy failed in ${variant.id}.`);
    } else if (body.audio_required !== false || body.audio_provider || body.browser_tts_allowed !== false || body.browser_tts_fallback !== "prohibited") throw new Error(`Selective no-audio policy failed in ${variant.id}.`);
    if (!body.no_timer || body.speed_score_allowed || body.pressure_rules?.streaks || body.pressure_rules?.lives || body.pressure_rules?.loss_on_error) throw new Error(`Pressure mechanic found in ${variant.id}.`);
  }
}

function coreSnapshot(variants) { return variants.map(stripEnrichment); }
function stripEnrichment(variant) {
  const copy = structuredClone(variant); delete copy.feedback;
  if (typeof copy.explanation === "string") copy.explanation = copy.explanation.split(" The expected response is ")[0];
  for (const key of ["interaction_route", "accessible_response_route", "base_ten_route", "place_value_chart_route", "number_line_route", "change_model_route", "dyscalculia_support", "reduced_load_route", "no_mandatory_dragging", "no_mandatory_handwriting", "no_mandatory_speech", "microphone_required", "handwriting_required", "drag_required", "retry_without_penalty", "no_timer", "speed_score_allowed", "preserve_correct_work", "undo_available", "pressure_rules", "place_value_contract", "audio_required", "audio_route", "audio_policy", "audio_provider", "audio_production_policy", "human_listening_approval_required", "browser_tts_allowed", "browser_tts_fallback"]) delete copy.body[key];
  return copy;
}
function countMissingFeedback(variants) { return variants.filter((variant) => !variant.feedback?.correct || !variant.feedback?.representation_evidence || !variant.feedback?.repair || !variant.feedback?.misconception_check || !variant.feedback?.check_prompt).length; }
function countMissingRoute(variants) { return variants.filter((variant) => { const body = variant.body ?? {}, route = body.interaction_route ?? {}; return !route.touch || !route.keyboard || !route.switch_scan || !route.eye_gaze || !route.aac_point_adult_scribed || route.drag_required !== false || body.no_mandatory_dragging !== true || body.no_mandatory_handwriting !== true || body.no_mandatory_speech !== true; }).length; }
function sortedCounts(items, keyFor) { const counts = {}; for (const item of items) { const key = keyFor(item); counts[key] = (counts[key] ?? 0) + 1; } return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => String(left).localeCompare(String(right)))); }

function assertCovered(label, required, actual) {
  const missing = [...required].filter((value) => value && !actual.has(value));
  if (missing.length > 0) throw new Error(`Generated bank is missing ${label}: ${missing.join(", ")}.`);
}

function placeDigits(number) {
  return { hundreds: Math.floor(number / 100), tens: Math.floor(number / 10) % 10, ones: number % 10 };
}

function expandedForm(number) {
  const { hundreds, tens, ones } = placeDigits(number);
  return [hundreds * 100, tens * 10, ones].filter((value) => value > 0).join(" + ");
}

function expandedDistractors(number) {
  const { hundreds, tens, ones } = placeDigits(number);
  const correct = expandedForm(number);
  const pool = [
    `${hundreds} + ${tens} + ${ones}`,
    `${hundreds * 10} + ${tens * 10} + ${ones}`,
    `${hundreds * 100} + ${ones * 10} + ${tens}`,
    `${hundreds * 100} + ${tens} + ${ones * 10}`,
    `${hundreds * 100} + ${(tens + 1) * 10} + ${ones}`,
  ];
  return unique(pool.filter((choice) => choice !== correct)).slice(0, 3);
}

function zeroExpandedDistractors(number) {
  const digits = placeDigits(number);
  const correct = expandedForm(number);
  const shifted = digits.tens === 0
    ? [`${digits.hundreds * 10} + ${digits.ones}`, `${digits.hundreds * 100} + ${digits.ones * 10}`, `${digits.hundreds} + ${digits.ones}`]
    : [`${digits.hundreds * 100} + ${digits.tens}`, `${digits.hundreds * 10} + ${digits.tens * 10}`, `${digits.hundreds} + ${digits.tens}`];
  return unique(shifted.filter((choice) => choice !== correct)).slice(0, 3);
}

function numberDistractors(number) {
  const digits = placeDigits(number);
  const pool = [number, digits.hundreds * 10 + digits.ones, digits.hundreds * 100 + digits.ones * 10, digits.hundreds * 100 + digits.tens, Number(`${digits.hundreds}${digits.ones}${digits.tens}`)];
  return unique(pool).slice(0, 4);
}

function comparisonDecision(left, right) {
  const a = placeDigits(left);
  const b = placeDigits(right);
  if (a.hundreds !== b.hundreds) return { place: "hundreds", explanation: `${Math.max(a.hundreds, b.hundreds)} hundreds is greater than ${Math.min(a.hundreds, b.hundreds)} hundreds` };
  if (a.tens !== b.tens) return { place: "tens", explanation: `The hundreds are equal, then ${Math.max(a.tens, b.tens)} tens is greater than ${Math.min(a.tens, b.tens)} tens` };
  return { place: "ones", explanation: `The hundreds and tens are equal, then ${Math.max(a.ones, b.ones)} ones is greater than ${Math.min(a.ones, b.ones)} ones` };
}

function comparisonReasonDistractors(place) {
  return unique(["Compare the ones before the other places", "The longer-looking numeral is greater", `The ${place} digits should be ignored`, "Add the two numerals before comparing"]).slice(0, 3);
}

function orderChoices(numbers, expected) {
  const [a, b, c] = numbers;
  return unique([expected, [a, c, b].join(", "), [b, a, c].join(", "), [c, a, b].join(", "), [...numbers].reverse().join(", ")]).slice(0, 4);
}

function changedPlaces(start, result) {
  const before = placeDigits(start);
  const after = placeDigits(result);
  return ["hundreds", "tens", "ones"].filter((place) => before[place] !== after[place]);
}

function placePhrase(places) {
  if (places.length === 1) return `the ${places[0]} digit changes`;
  if (places.length === 2) return `the ${places[0]} and ${places[1]} digits change`;
  return "the hundreds, tens and ones digits change";
}

function changeChoices(start, change, result, places) {
  const expected = `${result}; ${placePhrase(places)}`;
  const wrongChanges = unique([change / 10, change * 10, change > 0 ? -change : Math.abs(change)]).filter((value) => value !== change);
  const pool = [expected];
  for (let index = 0; index < wrongChanges.length && pool.length < 4; index += 1) {
    const wrongResult = start + wrongChanges[index];
    if (wrongResult >= 0 && wrongResult <= 1000) pool.push(`${wrongResult}; ${placePhrase(changedPlaces(start, wrongResult))}`);
  }
  for (const wrongPlace of ["the ones digit changes", "the tens digit changes", "the hundreds digit changes", "every digit changes"]) {
    if (pool.length >= 4) break;
    if (wrongPlace !== placePhrase(places)) pool.push(`${result}; ${wrongPlace}`);
  }
  return unique(pool).slice(0, 4);
}

function placeName(value) {
  if (value >= 100) return "hundreds";
  if (value >= 10) return "tens";
  return "ones";
}

function bandFor(index) {
  return ["intro", "developing", "expected", "secure", "stretch", "retrieval"][index % 6];
}

function difficultyFor(band) {
  return { intro: 2, developing: 3, expected: 5, secure: 6, stretch: 7, retrieval: 5 }[band];
}

function rotate(items, amount) {
  const offset = amount % items.length;
  return items.slice(offset).concat(items.slice(0, offset));
}

function unique(items) {
  return [...new Set(items)];
}

function capitalise(value) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function normalise(value) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function summary(variants, key) {
  const counts = new Map();
  for (const variant of variants) counts.set(key(variant), (counts.get(key(variant)) ?? 0) + 1);
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([name, count]) => `${name}:${count}`).join(",");
}

function summaryCoverage(variants) {
  const counts = new Map();
  for (const variant of variants) for (const tag of variant.body.coverage_tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([tag, count]) => `${tag}:${count}`).join(",");
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function relative(file) {
  return path.relative(repoRoot, file).replaceAll("\\", "/");
}
