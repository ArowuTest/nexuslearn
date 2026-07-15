#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/ma-y5-number-decimals-percentages.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y5-number-decimals-percentages-bank-";
const pilotTarget = 240;

if (write && check) throw new Error("Choose either --write or --check, not both.");

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y5-number-decimals-percentages") {
  throw new Error("This generator only supports the Year 5 decimals and percentages pack.");
}

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 3) {
  throw new Error(`Expected exactly 3 curated variants, found ${curated.length}. Refusing to overwrite possible authored work.`);
}

ensureExpandedBlueprints(pack);

const coreBands = ["intro", "developing", "expected", "secure", "stretch"];
const retrievalBands = ["retrieval", "intro", "developing", "expected", "secure", "stretch"];
const commonPercents = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95];
const numberLinePercents = [3, 7, 12, 18, 24, 29, 33, 41, 48, 52, 59, 64, 71, 76, 83, 92];
const retrievalPercents = [1, 4, 8, 10, 12, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 99];
const contextStations = [
  { key: "habitat", subject: "habitat survey cards checked", unit: "cards" },
  { key: "reading", subject: "reading challenge pages completed", unit: "pages" },
  { key: "seed", subject: "seed tray spaces planted", unit: "spaces" },
  { key: "trail", subject: "nature trail markers inspected", unit: "markers" },
  { key: "display", subject: "museum display labels prepared", unit: "labels" },
  { key: "recycling", subject: "recycling samples sorted correctly", unit: "samples" },
  { key: "weather", subject: "weather observations recorded", unit: "observations" },
];

const comparisonCases = [
  { key: "forty-thirty-five", left: "0.4", leftValue: 40, right: "35%", rightValue: 35 },
  { key: "twenty-five-three-tenths", left: "25%", leftValue: 25, right: "0.3", rightValue: 30 },
  { key: "sixty-two-fifths", left: "60%", leftValue: 60, right: "2/5", rightValue: 40 },
  { key: "seven-eight-hundredths", left: "7%", leftValue: 7, right: "0.08", rightValue: 8 },
  { key: "three-quarters-seventy", left: "3/4", leftValue: 75, right: "70%", rightValue: 70 },
  { key: "fifty-five-half", left: "0.55", leftValue: 55, right: "1/2", rightValue: 50 },
  { key: "fifteen-two-tenths", left: "15%", leftValue: 15, right: "0.2", rightValue: 20 },
  { key: "eighty-four-fifths", left: "80%", leftValue: 80, right: "4/5", rightValue: 80 },
  { key: "thirty-three-tenths", left: "30%", leftValue: 30, right: "0.3", rightValue: 30 },
  { key: "ninety-eighty-five", left: "0.9", leftValue: 90, right: "85%", rightValue: 85 },
];

const candidates = [
  ...buildPercentGridCandidates(),
  ...buildEquivalenceCandidates(),
  ...buildSingleDigitPlaceValueCandidates(),
  ...buildContextCandidates(),
  ...buildRetrievalCandidates(),
  ...buildNumberLineCandidates(),
  ...buildComparisonEstimationCandidates(),
];

const enrichedCurated = curated.map(enrichVariant);
const enrichedCandidates = candidates.map(enrichVariant);
validateBank(pack, enrichedCurated, enrichedCandidates);
pack.question_variants = [...enrichedCurated, ...enrichedCandidates];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Review-stage Year 5 decimals and percentages bank reaches the 240-item pilot target with three preserved curated questions and deterministic candidates across seven blueprints and four renderer-supported formats. Generated candidates require curriculum, teacher, accessibility and safeguarding review before promotion.";

enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`decimals-percentages-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`decimals-percentages-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`decimals-percentages-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`decimals-percentages-bank bands=${summary(candidates, (variant) => variant.body.difficulty_band)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`decimals-percentages-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) {
    throw new Error("Year 5 decimals and percentages bank is out of date; run generate-y5-decimals-percentages-bank.mjs --write.");
  }
  console.log("decimals-percentages-bank deterministic check passed");
} else {
  console.log("decimals-percentages-bank dry-run; pass --write to update the pack");
}

function ensureExpandedBlueprints(currentPack) {
  addUnique(currentPack.objective.mastery.required_formats, "number-line");
  addUnique(currentPack.practice.formats, "number-line");
  const additions = [
    {
      id: "decimal-number-line-reasoning",
      format: "number-line",
      count: 300,
      difficulty_band: "developing",
      misconception_tag: "decimal_digits_not_magnitude",
      purpose: "Locate, compare and interpret decimal hundredths and percentages on a zero-to-one number line.",
      generation_pattern: "0-to-1 number line + decimal/percent marker + locate, compare or justify choice",
      review_notes: "Use labelled static alternatives and avoid judging magnitude by digit length.",
      source: "ai_drafted_teacher_reviewed",
    },
    {
      id: "comparison-estimation-reasoning",
      format: "match-choice",
      count: 300,
      difficulty_band: "secure",
      misconception_tag: "representation_size_mismatch",
      purpose: "Compare mixed representations, estimate against useful benchmarks and justify contextual decisions.",
      generation_pattern: "mixed decimal/fraction/percent pair or context + benchmark + evidence-based choice",
      review_notes: "Include equality cases and require conversion to a shared representation before comparison.",
      source: "ai_drafted_teacher_reviewed",
    },
  ];
  for (const blueprint of additions) {
    if (!currentPack.variant_blueprints.some((existing) => existing.id === blueprint.id)) {
      currentPack.variant_blueprints.push(blueprint);
    }
  }
}

function buildPercentGridCandidates() {
  const variants = [];
  for (const [valueIndex, percent] of commonPercents.entries()) {
    for (let mode = 0; mode < 2; mode += 1) {
      const index = valueIndex * 2 + mode;
      const shaded = percent;
      const answer = mode === 0 ? `${percent}%` : `${percent}/100`;
      const choices = mode === 0
        ? uniqueRotate([answer, `${Math.floor(percent / 10)}%`, `${100 - percent}%`, `${percent}`], index)
        : uniqueRotate([answer, `${Math.floor(percent / 10)}/100`, `${percent}/10`, `100/${percent}`], index);
      const prompt = mode === 0
        ? `Grid mission ${index + 1}: ${shaded} of 100 equal squares are shaded. What percentage is shaded?`
        : `Grid mission ${index + 1}: ${percent}% of a hundred grid is shaded. Which fraction with denominator 100 records the shaded part?`;
      variants.push(makeVariant({
        id: `grid-${percent}-${mode + 1}`,
        format: "hundred-grid",
        blueprint: "percent-grid-builds",
        band: coreBands[index % coreBands.length],
        evidencePurpose: "percent_as_parts_per_hundred",
        prompt,
        body: { grid_rows: 10, grid_columns: 10, shaded_cells: shaded, choices, representation_rule: "one_square_is_one_hundredth" },
        answer,
        hints: ["The whole grid contains 100 equal squares.", "Percent means out of 100, so count shaded hundredths without treating them as whole ones."],
        explanation: `${shaded} shaded squares represent ${shaded} hundredths of the whole grid. Therefore the shaded amount is ${percent}% and can be written ${percent}/100.`,
        misconception: "percent_as_whole_number",
        animation: "hundred-grid-fill",
        index,
      }));
    }
  }
  return variants;
}

function buildEquivalenceCandidates() {
  const variants = [];
  for (const [valueIndex, percent] of commonPercents.entries()) {
    for (let mode = 0; mode < 2; mode += 1) {
      const index = valueIndex * 2 + mode;
      const decimal = decimalFor(percent);
      const fraction = `${percent}/100`;
      const simple = simplify(percent, 100);
      const answer = mode === 0 ? decimal : `${percent}% = ${fraction} = ${decimal}${simple === fraction ? "" : ` = ${simple}`}`;
      const choices = mode === 0
        ? decimalChoices(percent, index)
        : uniqueRotate([
          answer,
          `${percent}% = ${Math.floor(percent / 10)}/100 = ${decimalFor(Math.floor(percent / 10))}`,
          `${percent}% = ${percent}/10 = ${decimalFor(Math.min(100, percent * 10))}`,
          `${percent}% = 100/${percent} = ${decimalFor(100 - percent)}`,
        ], index);
      const prompt = mode === 0
        ? `Equivalence bridge ${index + 1}: Which decimal has the same value as ${percent}%?`
        : `Equivalence bridge ${index + 1}: Which chain represents one unchanged value?`;
      variants.push(makeVariant({
        id: `equivalence-${percent}-${mode + 1}`,
        format: "match-choice",
        blueprint: "fraction-decimal-percent-matches",
        band: coreBands[(index + 1) % coreBands.length],
        evidencePurpose: "fraction_decimal_percent_equivalence",
        prompt,
        body: { starting_representation: `${percent}%`, hundredths_fraction: fraction, choices, same_whole_required: true },
        answer,
        hints: ["Write the percentage as parts out of 100 first.", `Place ${percent} hundredths in decimal place value, then simplify the fraction only if useful.`],
        explanation: `${percent}% means ${fraction}. ${percent} hundredths is ${decimal}${simple === fraction ? "." : `, and ${fraction} simplifies to ${simple}.`} Every correct representation names the same part of one whole.`,
        misconception: "representations_unrelated",
        animation: "representation-align",
        index,
      }));
    }
  }
  return variants;
}

function buildSingleDigitPlaceValueCandidates() {
  const variants = [];
  for (let index = 0; index < 32; index += 1) {
    const percent = (index % 9) + 1;
    const mode = index % 4;
    const decimal = decimalFor(percent);
    let prompt;
    let answer;
    let choices;
    if (mode === 0) {
      prompt = `Place-value repair ${index + 1}: Write ${percent}% as a decimal.`;
      answer = decimal;
      choices = decimalChoices(percent, index);
    } else if (mode === 1) {
      prompt = `Place-value repair ${index + 1}: Which digit placement represents ${percent} hundredths?`;
      answer = `0 ones, 0 tenths, ${percent} hundredths`;
      choices = uniqueRotate([answer, `0 ones, ${percent} tenths, 0 hundredths`, `${percent} ones, 0 tenths, 0 hundredths`, `0 ones, ${percent} tenths, ${percent} hundredths`], index);
    } else if (mode === 2) {
      prompt = `Place-value repair ${index + 1}: A learner writes ${percent}% as 0.${percent}. Which correction is valid?`;
      answer = `${percent}% is ${decimal} because it is ${percent} hundredths`;
      choices = uniqueRotate([answer, `${percent}% is 0.${percent} because percent means tenths`, `${percent}% is ${percent}.0 because the percent sign disappears`, `${percent}% is ${decimalFor(percent * 10)} because every decimal needs one digit`], index);
    } else {
      prompt = `Place-value repair ${index + 1}: Which comparison correctly distinguishes ${percent}% from ${percent * 10}%?`;
      answer = `${decimal} is one tenth of ${decimalFor(percent * 10)}`;
      choices = uniqueRotate([answer, `${decimal} equals ${decimalFor(percent * 10)}`, `${decimal} is ten times ${decimalFor(percent * 10)}`, `${percent}% and ${percent * 10}% both mean ${percent} hundredths`], index);
    }
    variants.push(makeVariant({
      id: `single-digit-${percent}-${index + 1}`,
      format: "place-value-build",
      blueprint: "single-digit-percent-place-value",
      band: coreBands[(index + 2) % coreBands.length],
      evidencePurpose: "single_digit_percent_hundredths_place_value",
      prompt,
      body: { percent, place_value_columns: ["ones", "tenths", "hundredths"], choices, linked_hundred_grid_cells: percent },
      answer,
      hints: ["Percent means hundredths, not tenths.", `Keep the leading zero and place ${percent} in the hundredths column: ${decimal}.`],
      explanation: `${percent}% is ${percent}/100, so its decimal is ${decimal}. The zero in the tenths place matters because 0.${percent} represents ${percent} tenths, which is ten times as large.`,
      misconception: "seven_percent_as_point_seven",
      animation: "hundredths-column-build",
      index,
    }));
  }
  return variants;
}

function buildContextCandidates() {
  const variants = [];
  const values = [20, 35, 50, 65, 80];
  for (const [contextIndex, context] of contextStations.entries()) {
    for (let mode = 0; mode < 5; mode += 1) {
      const index = contextIndex * 5 + mode;
      const percent = values[(contextIndex + mode) % values.length];
      let prompt;
      let answer;
      let choices;
      if (mode === 0) {
        prompt = `Eco-meter mission ${index + 1}: ${percent} of 100 ${context.unit} show ${context.subject}. What percentage is this?`;
        answer = `${percent}%`;
        choices = percentChoices(percent, index);
      } else if (mode === 1) {
        prompt = `Eco-meter mission ${index + 1}: The meter shows ${percent}% for ${context.subject}. Which decimal records the same part?`;
        answer = decimalFor(percent);
        choices = decimalChoices(percent, index);
      } else if (mode === 2) {
        const threshold = percent - 5;
        prompt = `Eco-meter mission ${index + 1}: The target is at least ${threshold}%. The result is ${percent}%. Which conclusion is justified?`;
        answer = `The target is met because ${percent}% is greater than ${threshold}%`;
        choices = uniqueRotate([answer, `The target is missed because ${percent} has fewer digits`, `The result and target cannot be compared`, `The target is met only if the meter reaches 100%`], index);
      } else if (mode === 3) {
        const remainder = 100 - percent;
        prompt = `Eco-meter mission ${index + 1}: ${percent}% of the ${context.unit} are complete. What percentage remains to reach the whole?`;
        answer = `${remainder}%`;
        choices = percentChoices(remainder, index);
      } else {
        const benchmark = nearestBenchmark(percent);
        prompt = `Eco-meter mission ${index + 1}: Which benchmark is closest to the ${percent}% result?`;
        answer = `${benchmark}%`;
        choices = uniqueRotate([answer, "0%", "50%", "100%", "25%", "75%"], index);
      }
      variants.push(makeVariant({
        id: `context-${context.key}-${mode + 1}`,
        format: "hundred-grid",
        blueprint: "eco-meter-contexts",
        band: coreBands[(index + 3) % coreBands.length],
        evidencePurpose: "contextual_percent_decimal_estimation_reasoning",
        prompt,
        body: { context: context.subject, whole: 100, filled_units: percent, choices, meter_static_labels: [0, 25, 50, 75, 100] },
        answer,
        hints: ["Treat the full meter as 100 equal parts.", "Translate to hundredths or compare with 0%, 25%, 50%, 75% and 100% before deciding."],
        explanation: contextExplanation(mode, percent, answer),
        misconception: mode === 3 ? "part_and_remainder_confusion" : mode === 4 ? "poor_benchmark_estimate" : "percent_as_whole_number",
        animation: "percent-meter-fill",
        index,
      }));
    }
  }
  return variants;
}

function buildRetrievalCandidates() {
  const variants = [];
  for (const [valueIndex, percent] of retrievalPercents.entries()) {
    for (let mode = 0; mode < 2; mode += 1) {
      const index = valueIndex * 2 + mode;
      const answer = mode === 0 ? decimalFor(percent) : `${percent}/100`;
      const prompt = mode === 0
        ? `Retrieval bridge ${index + 1}: Match ${percent}% to its decimal.`
        : `Retrieval bridge ${index + 1}: Match ${decimalFor(percent)} to a fraction with denominator 100.`;
      const choices = mode === 0 ? decimalChoices(percent, index) : fractionChoices(percent, index);
      variants.push(makeVariant({
        id: `retrieval-${percent}-${mode + 1}`,
        format: "match-choice",
        blueprint: "percent-retrieval-mix",
        band: retrievalBands[index % retrievalBands.length],
        evidencePurpose: "spaced_fraction_decimal_percent_retrieval",
        prompt,
        body: { percent, decimal: decimalFor(percent), hundredths_fraction: `${percent}/100`, choices, retrieval_interval_options_days: [1, 3, 7, 14, 30] },
        answer,
        hints: ["Use the shared denominator of 100.", "Read the decimal digits by place value, including a zero placeholder when needed."],
        explanation: `${percent}% means ${percent}/100, and ${percent} hundredths is ${decimalFor(percent)}. The three notations identify the same point between zero and one.`,
        misconception: percent < 10 ? "seven_percent_as_point_seven" : "representations_unrelated",
        animation: "representation-align",
        index,
      }));
    }
  }
  return variants;
}

function buildNumberLineCandidates() {
  const variants = [];
  for (const [valueIndex, percent] of numberLinePercents.entries()) {
    for (let mode = 0; mode < 2; mode += 1) {
      const index = valueIndex * 2 + mode;
      const decimal = decimalFor(percent);
      const neighbour = percent < 50 ? percent + 7 : percent - 7;
      let prompt;
      let answer;
      let choices;
      if (mode === 0) {
        prompt = `Number-line mission ${index + 1}: Marker M is ${percent} hundredths from 0 on a 0-to-1 line. Which decimal labels M?`;
        answer = decimal;
        choices = decimalChoices(percent, index);
      } else {
        prompt = `Number-line mission ${index + 1}: Marker A is ${percent}% and marker B is ${neighbour}%. Which statement is correct?`;
        answer = percent > neighbour ? "A is farther right because it has the greater value" : "B is farther right because it has the greater value";
        choices = uniqueRotate([answer, "The marker with more written digits is farther right", "Both markers belong at the same point", "Percentages cannot be placed on a decimal number line"], index);
      }
      variants.push(makeVariant({
        id: `number-line-${percent}-${mode + 1}`,
        format: "number-line",
        blueprint: "decimal-number-line-reasoning",
        band: coreBands[(index + 1) % coreBands.length],
        evidencePurpose: "decimal_percent_number_line_magnitude",
        prompt,
        body: { number_line: { start: 0, end: 1, major_interval: 0.1, static_tick_table: true }, marker_percent: percent, choices, direct_entry_or_choice: true },
        answer,
        hints: ["Convert each percentage to hundredths between 0 and 1.", "Greater values lie farther right; digit count does not decide magnitude."],
        explanation: mode === 0
          ? `${percent} hundredths is ${decimal}, so marker M belongs ${percent}/100 of the distance from 0 to 1. The number line represents magnitude, not merely digit order.`
          : `The farther-right marker has the greater hundredths value. Converting both percentages to decimals gives ${decimalFor(percent)} and ${decimalFor(neighbour)}, which makes the comparison visible.`,
        misconception: "decimal_digits_not_magnitude",
        animation: "number-line-marker-step",
        index,
      }));
    }
  }
  return variants;
}

function buildComparisonEstimationCandidates() {
  const variants = [];
  for (const [caseIndex, item] of comparisonCases.entries()) {
    for (let mode = 0; mode < 3; mode += 1) {
      const index = caseIndex * 3 + mode;
      let prompt;
      let answer;
      let choices;
      if (mode === 0) {
        prompt = `Comparison console ${index + 1}: Compare ${item.left} and ${item.right}. Which statement is true?`;
        answer = comparisonStatement(item);
        choices = uniqueRotate([answer, `${item.left} and ${item.right} cannot be compared`, "The form with more symbols is greater", reverseComparisonStatement(item)], index);
      } else if (mode === 1) {
        const focus = item.leftValue;
        const benchmark = nearestBenchmark(focus);
        prompt = `Estimation console ${index + 1}: Which quarter benchmark is closest to ${item.left}?`;
        answer = `${benchmark}%`;
        choices = uniqueRotate([answer, "0%", "25%", "50%", "75%", "100%"], index);
      } else {
        const larger = Math.max(item.leftValue, item.rightValue);
        prompt = `Reasoning console ${index + 1}: A learner judges ${item.left} and ${item.right} only by their written digits. Which repair is strongest?`;
        answer = `Convert both to hundredths: ${item.leftValue}/100 and ${item.rightValue}/100, then compare ${larger} hundredths with the other value`;
        choices = uniqueRotate([answer, "Count the symbols in each form", "Percent is always greater than a decimal", "A fraction is always the smallest form"], index);
      }
      variants.push(makeVariant({
        id: `compare-estimate-${item.key}-${mode + 1}`,
        format: "match-choice",
        blueprint: "comparison-estimation-reasoning",
        band: coreBands[(index + 4) % coreBands.length],
        evidencePurpose: "mixed_representation_comparison_and_estimation",
        prompt,
        body: { left_representation: item.left, right_representation: item.right, left_hundredths: item.leftValue, right_hundredths: item.rightValue, choices, benchmark_set_percent: [0, 25, 50, 75, 100] },
        answer,
        hints: ["Convert both values to hundredths or decimals before comparing.", "For estimation, measure distance to neighbouring benchmarks rather than choosing by appearance."],
        explanation: comparisonExplanation(mode, item),
        misconception: mode === 1 ? "poor_benchmark_estimate" : "representation_size_mismatch",
        animation: "representation-compare-align",
        index,
      }));
    }
  }
  return variants;
}

function makeVariant({ id, format, blueprint, band, evidencePurpose, prompt, body, answer, hints, explanation, misconception, animation, index }) {
  return {
    id: `${prefix}${id}`,
    format,
    body: {
      prompt,
      ...body,
      evidence_purpose: evidencePurpose,
      variant_blueprint_id: blueprint,
      review_batch: "y5-decimals-percentages-pilot-a",
      difficulty_band: band,
      response_mode: responseMode(format),
      interaction_metadata: {
        keyboard: "All cells, digits, markers and choices are reachable in a logical order with visible focus and direct-entry alternatives.",
        switch: "Single-switch scanning supports select, increment, decrement, undo, hear again and submit without drag timing.",
        static_alternative: "A labelled grid, place-value table or tick table provides the complete quantities without animation.",
        reduced_motion: "Representation changes update instantly or one step at a time; no sweeping meters, sliding digits or moving markers are required.",
        visual_access: "Patterns, labels and spoken counts supplement colour; zoom and high-contrast modes preserve grid and decimal-point clarity.",
        audio_and_language: "Prompts, values and feedback have sentence-level read-aloud, replay and explicit readings such as seven hundredths.",
      },
      feedback: {
        success: "The representation is verified by the shared hundredths value, not by appearance alone.",
        retry: feedbackFor(misconception),
        strategy_prompt: "Convert to hundredths, align place value or locate the value between 0 and 1 before trying again.",
      },
      gamification: {
        mission: missionFor(blueprint),
        success_condition: "Verify the choice with a grid count, place-value statement, equivalent representation, number-line position or benchmark comparison.",
        feedback: "A justified conversion restores one bridge segment; speed, streaks and motor precision do not affect progress.",
        no_time_pressure: true,
      },
    },
    expected_answer: { value: answer },
    hints,
    explanation,
    difficulty: difficultyFor(band, index),
    status: "review",
    misconception_tag: misconception,
    animation_hook: animation,
  };
}

function validateBank(currentPack, authored, generated) {
  if (generated.length !== pilotTarget - authored.length) {
    throw new Error(`Expected ${pilotTarget - authored.length} generated candidates, found ${generated.length}.`);
  }
  const all = [...authored, ...generated];
  if (all.length !== pilotTarget) throw new Error(`Pilot bank must contain exactly ${pilotTarget} variants.`);
  const ids = new Set(all.map((variant) => variant.id));
  if (ids.size !== all.length) throw new Error("Variant ids are not unique.");

  const requiredBlueprints = new Set(currentPack.variant_blueprints.map((blueprint) => blueprint.id));
  const actualBlueprints = new Set(generated.map((variant) => variant.body.variant_blueprint_id));
  assertCovered("blueprint", requiredBlueprints, actualBlueprints);
  const requiredFormats = new Set(currentPack.practice.formats);
  const actualFormats = new Set(generated.map((variant) => variant.format));
  assertCovered("format", requiredFormats, actualFormats);
  const requiredBands = new Set([...currentPack.practice.difficulty_bands, ...currentPack.variant_blueprints.map((blueprint) => blueprint.difficulty_band)]);
  const actualBands = new Set(generated.map((variant) => variant.body.difficulty_band));
  assertCovered("difficulty band", requiredBands, actualBands);

  const signatures = new Set();
  for (const candidate of all) {
    const signature = `${candidate.format}|${candidate.body?.prompt?.trim().toLowerCase()}|${JSON.stringify(candidate.expected_answer)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature: ${candidate.id}.`);
    signatures.add(signature);
  }
  for (const candidate of all.filter((variant) => ["hundred-grid", "place-value-build"].includes(variant.format))) validateBuilderContract(candidate);
  for (const candidate of generated) {
    if (candidate.status !== "review") throw new Error(`${candidate.id} is not review status.`);
    if (!requiredBlueprints.has(candidate.body.variant_blueprint_id)) throw new Error(`${candidate.id} has an unknown blueprint.`);
    if (!candidate.body.evidence_purpose || !candidate.body.review_batch) throw new Error(`${candidate.id} lacks review provenance.`);
    if (candidate.explanation.length < 100) throw new Error(`${candidate.id} explanation is too weak.`);
    if (!Array.isArray(candidate.body.choices) || !candidate.body.choices.includes(candidate.expected_answer.value)) throw new Error(`${candidate.id} answer is absent from its choices.`);
    if (new Set(candidate.body.choices).size !== candidate.body.choices.length) throw new Error(`${candidate.id} has duplicate choices.`);
    if ("answer" in candidate.body || "correct_answer" in candidate.body) throw new Error(`${candidate.id} leaks its answer in body metadata.`);
    for (const key of ["keyboard", "switch", "static_alternative", "reduced_motion", "visual_access", "audio_and_language"]) {
      if (!candidate.body.interaction_metadata?.[key]) throw new Error(`${candidate.id} lacks ${key} interaction metadata.`);
    }
    if (!candidate.body.feedback?.retry || !candidate.body.gamification?.success_condition || candidate.body.gamification.no_time_pressure !== true) {
      throw new Error(`${candidate.id} lacks feedback or meaningful low-pressure gamification.`);
    }
  }
}

function enrichVariant(variant) {
  const body = { ...(variant.body ?? {}) };
  const responseModes = ["tap", "keyboard", "switch", "eye_gaze", "aac"];
  if (variant.format === "hundred-grid") {
    const inferred = body.filled_units ?? inferPercent(variant);
    if (body.shaded_cells === undefined && body.filled_units === undefined) {
      body.grid_rows = 10;
      body.grid_columns = 10;
      body.shaded_cells = inferred;
      body.representation_rule = "one_square_is_one_hundredth";
    }
    const contextMeter = body.filled_units !== undefined;
    body.builder_contract = contextMeter
      ? {
        kind: "hundred_grid",
        mode: "context_meter",
        whole_key: "whole",
        filled_units_key: "filled_units",
        meter_labels_key: "meter_static_labels",
        total_cells: 100,
        drag_required: false,
        response_modes: responseModes,
      }
      : {
        kind: "hundred_grid",
        mode: "shaded_grid",
        rows_key: "grid_rows",
        columns_key: "grid_columns",
        shaded_cells_key: "shaded_cells",
        representation_rule: "one_square_is_one_hundredth",
        total_cells: 100,
        drag_required: false,
        response_modes: responseModes,
      };
  } else if (variant.format === "place-value-build") {
    const percent = body.percent ?? inferPercent(variant);
    body.percent = percent;
    body.place_value_columns = body.place_value_columns ?? ["ones", "tenths", "hundredths"];
    body.linked_hundred_grid_cells = body.linked_hundred_grid_cells ?? percent;
    body.builder_contract = {
      kind: "place_value_hundredths",
      percent_key: "percent",
      columns_key: "place_value_columns",
      linked_grid_cells_key: "linked_hundred_grid_cells",
      decimal_places: ["ones", "tenths", "hundredths"],
      total_cells: 100,
      drag_required: false,
      response_modes: responseModes,
    };
  }
  return variant.format === "hundred-grid" || variant.format === "place-value-build" ? { ...variant, body } : variant;
}

function validateBuilderContract(variant) {
  const body = variant.body ?? {};
  const contract = body.builder_contract;
  const requiredResponseModes = ["tap", "keyboard", "switch", "eye_gaze", "aac"];
  if (!contract || contract.drag_required !== false || requiredResponseModes.some((mode) => !contract.response_modes?.includes(mode))) {
    throw new Error(`${variant.id} lacks an accessible Year 5 representation contract.`);
  }
  if (variant.format === "hundred-grid") {
    if (contract.kind !== "hundred_grid" || contract.total_cells !== 100) throw new Error(`${variant.id} has the wrong hundred-grid contract.`);
    if (contract.mode === "shaded_grid") {
      if (body[contract.rows_key] !== 10 || body[contract.columns_key] !== 10 || body.representation_rule !== "one_square_is_one_hundredth") throw new Error(`${variant.id} must expose a 10 by 10 hundredths grid.`);
      const shaded = body[contract.shaded_cells_key];
      if (!Number.isInteger(shaded) || shaded < 0 || shaded > 100) throw new Error(`${variant.id} has invalid shaded-cell data.`);
    } else if (contract.mode === "context_meter") {
      if (body[contract.whole_key] !== 100 || !Number.isInteger(body[contract.filled_units_key]) || body[contract.filled_units_key] < 0 || body[contract.filled_units_key] > 100) throw new Error(`${variant.id} has invalid context-meter data.`);
      if (JSON.stringify(body[contract.meter_labels_key]) !== JSON.stringify([0, 25, 50, 75, 100])) throw new Error(`${variant.id} lacks fixed benchmark labels.`);
    } else {
      throw new Error(`${variant.id} has an unknown hundred-grid mode.`);
    }
  } else if (variant.format === "place-value-build") {
    if (contract.kind !== "place_value_hundredths" || contract.total_cells !== 100) throw new Error(`${variant.id} has the wrong place-value contract.`);
    if (JSON.stringify(body[contract.columns_key]) !== JSON.stringify(["ones", "tenths", "hundredths"])) throw new Error(`${variant.id} lacks the expected place-value columns.`);
    if (!Number.isInteger(body[contract.percent_key]) || body[contract.percent_key] < 0 || body[contract.percent_key] > 100 || body[contract.linked_grid_cells_key] !== body[contract.percent_key]) throw new Error(`${variant.id} has inconsistent hundredths linkage.`);
  }
}

function inferPercent(variant) {
  const value = String(variant.expected_answer?.value ?? "");
  const fractionMatch = value.match(/^(\d+)\/100$/);
  if (fractionMatch) return Number(fractionMatch[1]);
  const percentMatch = value.match(/^(\d+)%/);
  if (percentMatch) return Number(percentMatch[1]);
  const decimal = Number(value);
  if (Number.isFinite(decimal) && decimal >= 0 && decimal <= 1) return Math.round(decimal * 100);
  throw new Error(`${variant.id} does not expose an inferable percentage for its representation contract.`);
}

function contextExplanation(mode, percent, answer) {
  if (mode === 0) return `${percent} out of 100 is ${percent}%, because the percent symbol records how many hundredths of the complete set are represented.`;
  if (mode === 1) return `${percent}% is ${percent}/100, which is ${decimalFor(percent)} in decimal notation. The context changes, but the place-value relationship does not.`;
  if (mode === 2) return `${answer}. Converting both readings to hundredths makes the comparison direct and avoids judging by digit count or visual meter length alone.`;
  if (mode === 3) return `The whole is 100%. Subtracting the completed ${percent}% leaves ${100 - percent}%, so the completed and remaining parts recombine to exactly 100%.`;
  return `${percent}% is closest to ${nearestBenchmark(percent)}% among the quarter benchmarks because its numerical distance to that benchmark is smallest.`;
}

function comparisonStatement(item) {
  if (item.leftValue === item.rightValue) return `${item.left} is equal to ${item.right}`;
  return item.leftValue > item.rightValue ? `${item.left} is greater than ${item.right}` : `${item.left} is less than ${item.right}`;
}

function reverseComparisonStatement(item) {
  if (item.leftValue === item.rightValue) return `${item.left} is not equal to ${item.right}`;
  return item.leftValue > item.rightValue ? `${item.left} is less than ${item.right}` : `${item.left} is greater than ${item.right}`;
}

function comparisonExplanation(mode, item) {
  if (mode === 0) return `${item.left} represents ${item.leftValue} hundredths and ${item.right} represents ${item.rightValue} hundredths. Comparing a shared unit gives the valid relation: ${comparisonStatement(item)}.`;
  if (mode === 1) return `${item.left} represents ${item.leftValue}%. Its closest quarter benchmark is ${nearestBenchmark(item.leftValue)}%, found by comparing numerical distances to 0%, 25%, 50%, 75% and 100%.`;
  return `Writing both quantities as hundredths gives ${item.leftValue}/100 and ${item.rightValue}/100. This exposes their magnitude and repairs the unreliable strategy of comparing notation or digit count.`;
}

function feedbackFor(misconception) {
  const feedback = {
    percent_as_whole_number: "Return to the 100 equal parts: the numeral tells how many hundredths, not how many whole ones.",
    representations_unrelated: "Anchor the fraction, decimal and percentage to one unchanged hundred-grid amount.",
    seven_percent_as_point_seven: "Place the digit in hundredths and compare the chosen decimal with ten times as many shaded squares.",
    part_and_remainder_confusion: "Check that completed percent plus remaining percent recombines to 100%.",
    poor_benchmark_estimate: "Measure the value's distance from the two neighbouring quarter benchmarks.",
    decimal_digits_not_magnitude: "Place both values between 0 and 1; farther right means greater, regardless of digit count.",
    representation_size_mismatch: "Convert both representations to hundredths before comparing.",
  };
  return feedback[misconception] ?? "Return to a shared whole of 100 and explain the value using place value.";
}

function missionFor(blueprint) {
  const missions = {
    "percent-grid-builds": "Calibrate the hundred-grid scanner.",
    "fraction-decimal-percent-matches": "Reconnect the equivalence bridge.",
    "single-digit-percent-place-value": "Repair the hundredths console.",
    "eco-meter-contexts": "Verify a community data meter.",
    "percent-retrieval-mix": "Confirm a spaced representation log.",
    "decimal-number-line-reasoning": "Position the navigation marker.",
    "comparison-estimation-reasoning": "Choose and defend an efficient benchmark strategy.",
  };
  return missions[blueprint];
}

function responseMode(format) {
  if (format === "hundred-grid") return "keyboard_switch_touch_numeric_or_partner_grid_choice";
  if (format === "place-value-build") return "keyboard_switch_direct_entry_or_partner_place_value_build";
  if (format === "number-line") return "keyboard_switch_direct_entry_static_tick_or_partner_marker_choice";
  return "keyboard_switch_touch_voice_or_partner_match_choice";
}

function decimalChoices(percent, index) {
  const correct = decimalFor(percent);
  const distractors = [...new Set([
    decimalString(percent / 10),
    decimalString(percent / 1000),
    decimalFor(Math.max(0, 100 - percent)),
    decimalFor(Math.min(100, percent + 10)),
    decimalFor(Math.max(0, percent - 10)),
  ])].filter((value) => value !== correct);
  return rotate([correct, ...distractors.slice(0, 3)], index % 4);
}

function fractionChoices(percent, index) {
  const correct = `${percent}/100`;
  const distractors = [...new Set([`${Math.floor(percent / 10)}/100`, `${percent}/10`, `100/${percent}`, `${100 - percent}/100`])].filter((value) => value !== correct);
  return rotate([correct, ...distractors.slice(0, 3)], index % 4);
}

function percentChoices(percent, index) {
  const correct = `${percent}%`;
  const distractors = [...new Set([`${Math.floor(percent / 10)}%`, `${100 - percent}%`, `${Math.min(100, percent + 10)}%`, `${Math.max(0, percent - 10)}%`])].filter((value) => value !== correct);
  return rotate([correct, ...distractors.slice(0, 3)], index % 4);
}

function uniqueRotate(values, amount) {
  const unique = [...new Set(values)];
  const rotated = rotate(unique, amount % unique.length);
  return rotated;
}

function decimalFor(percent) {
  return decimalString(percent / 100);
}

function decimalString(value) {
  return Number(value.toFixed(3)).toString();
}

function simplify(numerator, denominator) {
  const divisor = gcd(numerator, denominator);
  return `${numerator / divisor}/${denominator / divisor}`;
}

function gcd(a, b) {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right !== 0) [left, right] = [right, left % right];
  return left;
}

function nearestBenchmark(percent) {
  return [0, 25, 50, 75, 100].reduce((best, candidate) => Math.abs(candidate - percent) < Math.abs(best - percent) ? candidate : best, 0);
}

function difficultyFor(band, index) {
  const ranges = {
    intro: [2, 3],
    developing: [4, 5],
    expected: [5, 6],
    secure: [7, 8],
    stretch: [8, 9],
    retrieval: [3, 5],
  };
  const [minimum, maximum] = ranges[band];
  return minimum + (index % (maximum - minimum + 1));
}

function assertCovered(label, required, actual) {
  const missing = [...required].filter((value) => !actual.has(value));
  if (missing.length > 0) throw new Error(`Missing ${label} coverage: ${missing.join(", ")}.`);
}

function addUnique(items, value) {
  if (!items.includes(value)) items.push(value);
}

function rotate(items, amount) {
  return items.slice(amount).concat(items.slice(0, amount));
}

function summary(items, select) {
  const counts = new Map();
  for (const item of items) {
    const key = select(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(",");
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function relative(file) {
  return path.relative(repoRoot, file).replaceAll("\\", "/");
}
