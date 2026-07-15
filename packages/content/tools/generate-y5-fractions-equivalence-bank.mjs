#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/ma-y5-number-fractions-equivalence.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y5-number-fractions-equivalence-bank-";
const pilotTarget = 240;
const bands = ["intro", "developing", "expected", "secure", "stretch", "retrieval"];

if (write && check) throw new Error("Choose either --write or --check, not both.");

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y5-number-fractions-equivalence") {
  throw new Error("This generator only supports the Year 5 fractions-equivalence pack.");
}

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 3) {
  throw new Error(`Expected exactly 3 curated variants, found ${curated.length}. Refusing to overwrite possible authored work.`);
}

ensureBlueprints(pack);

const candidates = [
  ...equivalentFractionCandidates(),       // 36
  ...simplifyingCandidates(),              // 32
  ...commonDenominatorCandidates(),        // 32
  ...improperMixedCandidates(),            // 32
  ...numberLineCandidates(),               // 28
  ...visualModelCandidates(),              // 28
  ...comparisonCandidates(),               // 28
  ...misconceptionReasoningCandidates(),   // 21
];

const enrichedCurated = curated.map(enrichVariant);
const enrichedCandidates = candidates.map(enrichVariant);
validateBank(pack, enrichedCurated, enrichedCandidates);
pack.question_variants = [...enrichedCurated, ...enrichedCandidates];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Wave-five review bank reaches the 240-item pilot target with three preserved curated questions and 237 deterministic candidates spanning equivalence, simplifying, common denominators, improper and mixed representations, number lines, visual models, comparison and misconception reasoning. Generated candidates include SEND scaffolds, supported non-drag interactions, manipulative and static alternatives, rich feedback and untimed low-pressure progress; human curriculum, teacher, accessibility and safeguarding review remains required before promotion.";

enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`fractions-equivalence-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`fractions-equivalence-bank strands=${summary(candidates, (variant) => variant.body.strand)}`);
console.log(`fractions-equivalence-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`fractions-equivalence-bank bands=${summary(candidates, (variant) => variant.body.difficulty_band)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`fractions-equivalence-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) {
    throw new Error("Year 5 fractions-equivalence bank is out of date; run generate-y5-fractions-equivalence-bank.mjs --write.");
  }
  console.log("fractions-equivalence-bank deterministic check passed");
} else {
  console.log("fractions-equivalence-bank dry-run; pass --write to update the pack");
}

function equivalentFractionCandidates() {
  const bases = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [2, 5], [3, 5], [4, 5], [1, 6], [5, 6], [3, 8], [7, 10]];
  const variants = [];
  for (const [baseIndex, [n, d]] of bases.entries()) {
    for (const factor of [2, 3, 4]) {
      const index = variants.length;
      const answer = fraction(n * factor, d * factor);
      variants.push(choiceVariant({
        id: `equivalent-${n}-${d}-x${factor}`,
        format: baseIndex % 2 ? "symbol-build" : "fraction-bar",
        blueprint: baseIndex % 2 ? "symbol-scale-lens" : "bar-subdivision-equivalence",
        strand: "equivalent_fractions",
        prompt: `Scale station ${index + 1}: multiply both parts of ${fraction(n, d)} by ${factor}. Which equivalent fraction is made?`,
        choices: [answer, fraction(n * factor, d), fraction(n, d * factor), fraction(n + factor, d + factor)],
        answer,
        hints: [`Say the rule aloud: multiply the top and bottom by ${factor}.`, `Use fraction tiles or draw ${d * factor} equal parts; ${n * factor} should be shaded.`],
        explanation: `${n} x ${factor} = ${n * factor} and ${d} x ${factor} = ${d * factor}. Scaling both parts by the same non-zero factor keeps the value unchanged, so ${fraction(n, d)} = ${answer}.`,
        misconception: "changes_one_number_only",
        coverage: ["equivalence", "multiplicative_reasoning", "visual_model"],
        manipulative: `Place a ${fraction(n, d)} fraction tile over ${d * factor} equal counters or bar sections.`,
        sentenceStem: `${fraction(n, d)} equals ___ because I multiplied both ___ and ___ by ___.`,
        index,
      }));
    }
  }
  return variants;
}

function simplifyingCandidates() {
  const cases = [[2, 4], [3, 6], [4, 6], [4, 8], [6, 8], [5, 10], [6, 10], [8, 10], [6, 12], [8, 12], [9, 12], [10, 15], [12, 16], [12, 18], [15, 20], [18, 24]];
  const variants = [];
  for (const [caseIndex, [n, d]] of cases.entries()) {
    const g = gcd(n, d);
    const simplest = fraction(n / g, d / g);
    for (let mode = 0; mode < 2; mode += 1) {
      const index = variants.length;
      const answer = mode === 0 ? simplest : `divide both by ${g}`;
      variants.push(choiceVariant({
        id: `simplify-${n}-${d}-${mode + 1}`,
        format: mode === 0 ? "fraction-bar" : "symbol-build",
        blueprint: "simplifying-by-common-factor",
        strand: "simplifying",
        prompt: mode === 0
          ? `Simplifying stop ${index + 1}: which fraction is ${fraction(n, d)} in its simplest form?`
          : `Simplifying stop ${index + 1}: which shared operation takes ${fraction(n, d)} straight to ${simplest}?`,
        choices: mode === 0
          ? [answer, fraction(n / g, d), fraction(n, d / g), fraction(d / g, n / g)]
          : [answer, `divide the numerator only by ${g}`, `subtract ${g} from both`, `divide both by ${Math.max(2, g - 1)}`],
        answer,
        hints: ["Find a factor shared by the numerator and denominator.", `Group both ${n} and ${d} into equal groups of ${g}; do not change only one number.`],
        explanation: `${g} is the greatest common factor of ${n} and ${d}. Dividing both by ${g} gives ${n / g}/${d / g}, so ${fraction(n, d)} = ${simplest} and the value is unchanged.`,
        misconception: "simplifies_one_part_only",
        coverage: ["simplifying", "common_factor", "equivalence"],
        manipulative: `Regroup a ${d}-section fraction strip into groups of ${g} equal sections.`,
        sentenceStem: `I divided the numerator and denominator by ___, so ___ = ___.`,
        index: index + caseIndex,
      }));
    }
  }
  return variants;
}

function commonDenominatorCandidates() {
  const pairs = [[[1, 2], [1, 3]], [[1, 2], [2, 5]], [[2, 3], [3, 4]], [[1, 4], [2, 3]], [[3, 5], [1, 2]], [[2, 5], [3, 10]], [[3, 4], [5, 8]], [[5, 6], [2, 3]], [[1, 3], [3, 5]], [[3, 8], [1, 4]], [[4, 5], [7, 10]], [[5, 12], [1, 3]], [[7, 8], [5, 6]], [[2, 9], [1, 6]], [[5, 6], [7, 9]], [[3, 10], [2, 5]]];
  const variants = [];
  for (const [[an, ad], [bn, bd]] of pairs) {
    const common = lcm(ad, bd);
    const converted = `${an * (common / ad)}/${common} and ${bn * (common / bd)}/${common}`;
    for (let mode = 0; mode < 2; mode += 1) {
      const index = variants.length;
      const answer = mode === 0 ? String(common) : converted;
      variants.push(choiceVariant({
        id: `common-denominator-${an}-${ad}-${bn}-${bd}-${mode + 1}`,
        format: "symbol-build",
        blueprint: "common-denominator-compare",
        strand: "common_denominators",
        prompt: mode === 0
          ? `Common-denominator bridge ${index + 1}: what is the least common denominator for ${fraction(an, ad)} and ${fraction(bn, bd)}?`
          : `Common-denominator bridge ${index + 1}: which pair rewrites ${fraction(an, ad)} and ${fraction(bn, bd)} with denominator ${common}?`,
        choices: mode === 0
          ? [answer, String(ad + bd), String(Math.max(ad, bd)), String(ad * bd + 1)]
          : [answer, `${an}/${common} and ${bn}/${common}`, `${an * (common / ad)}/${common} and ${bn}/${common}`, `${an * common}/${ad} and ${bn * common}/${bd}`],
        answer,
        hints: ["List multiples of each denominator until the first match.", `For denominator ${common}, multiply each numerator by the same factor used on its denominator.`],
        explanation: `${common} is the first shared multiple of ${ad} and ${bd}. The equivalent pair is ${converted}; a shared denominator makes the equal-sized parts visible without changing either value.`,
        misconception: "adds_denominators_to_compare",
        coverage: ["common_denominator", "equivalence", "comparison_preparation"],
        manipulative: `Align ${ad}-part and ${bd}-part fraction strips over a ${common}-part fraction wall.`,
        sentenceStem: `The common denominator is ___ because ___ and ___ are both factors of it.`,
        index,
      }));
    }
  }
  return variants;
}

function improperMixedCandidates() {
  const cases = [[3, 2], [5, 2], [7, 2], [4, 3], [5, 3], [7, 3], [8, 3], [10, 3], [5, 4], [7, 4], [9, 4], [11, 4], [6, 5], [8, 5], [11, 5], [13, 5]];
  const variants = [];
  for (const [n, d] of cases) {
    const whole = Math.floor(n / d);
    const remainder = n % d;
    const mixed = `${whole} ${remainder}/${d}`;
    for (let mode = 0; mode < 2; mode += 1) {
      const index = variants.length;
      const answer = mode === 0 ? mixed : fraction(n, d);
      variants.push(choiceVariant({
        id: `improper-mixed-${n}-${d}-${mode + 1}`,
        format: mode === 0 ? "fraction-bar" : "symbol-build",
        blueprint: "improper-mixed-equivalence",
        strand: "improper_mixed_representations",
        prompt: mode === 0
          ? `Representation swap ${index + 1}: which mixed number is equivalent to ${fraction(n, d)}?`
          : `Representation swap ${index + 1}: which improper fraction is equivalent to ${mixed}?`,
        choices: mode === 0
          ? [answer, `${whole} ${Math.min(d - 1, remainder + 1)}/${d}`, `${whole + 1} ${remainder}/${d}`, `${remainder} ${whole}/${d}`]
          : [answer, fraction(whole + remainder, d), fraction(whole * d, d), fraction(n + 1, d)],
        answer,
        hints: [`Make groups of ${d} ${d === 2 ? "halves" : "equal parts"} to build each whole.`, mode === 0 ? `${n} divided by ${d} is ${whole} remainder ${remainder}.` : `Multiply ${whole} by ${d}, then add ${remainder}.`],
        explanation: `${whole} whole${whole === 1 ? "" : "s"} use ${whole * d}/${d}, with ${remainder}/${d} left. Therefore ${fraction(n, d)} and ${mixed} name the same amount.`,
        misconception: "whole_number_not_counted_in_parts",
        coverage: ["improper_fraction", "mixed_number", "equivalence"],
        manipulative: `Build ${n} pieces using fraction tiles of size 1/${d}, then group complete wholes.`,
        sentenceStem: `There are ___ complete groups of ${d} and ___ parts left, so ___ = ___.`,
        index,
      }));
    }
  }
  return variants;
}

function numberLineCandidates() {
  const cases = [[1, 2, 2], [1, 3, 3], [2, 3, 2], [3, 4, 2], [2, 5, 3], [3, 5, 2], [4, 5, 2], [5, 6, 2], [3, 8, 2], [7, 10, 2], [5, 4, 2], [7, 4, 2], [5, 3, 3], [8, 5, 2]];
  const variants = [];
  for (const [n, d, factor] of cases) {
    const eq = fraction(n * factor, d * factor);
    const maximum = Math.ceil(n / d);
    for (let mode = 0; mode < 2; mode += 1) {
      const index = variants.length;
      const answer = mode === 0 ? "same point" : eq;
      variants.push(choiceVariant({
        id: `number-line-${n}-${d}-x${factor}-${mode + 1}`,
        format: "number-line",
        blueprint: "number-line-equivalence",
        strand: "number_lines",
        prompt: mode === 0
          ? `Number-line checkpoint ${index + 1}: where do ${fraction(n, d)} and ${eq} land on the same ${maximum === 1 ? "0-to-1" : `0-to-${maximum}`} line?`
          : `Number-line checkpoint ${index + 1}: marker M is at ${fraction(n, d)}. Which fraction also labels M?`,
        choices: mode === 0 ? [answer, `${eq} is farther right`, `${fraction(n, d)} is farther right`, "they cannot share a line"] : [answer, fraction(n, d * factor), fraction(n * factor, d), fraction(n + factor, d + factor)],
        answer,
        hints: ["Equivalent fractions occupy one location even when their numerals look different.", `Partition each unit into ${d * factor} equal intervals and count ${n * factor}.`],
        explanation: `${fraction(n, d)} x ${factor}/${factor} = ${eq}. Both labels therefore mark the same value and the same position on the number line.`,
        misconception: "larger_denominator_larger_fraction",
        coverage: ["number_line", "equivalence", maximum > 1 ? "beyond_one" : "unit_interval"],
        manipulative: `Lay a ${d}-partition strip above a ${d * factor}-partition strip and align both with the number line.`,
        sentenceStem: `The points coincide because I scaled ___ by ___.`,
        index,
        extraBody: { number_line: { minimum: 0, maximum, labelled_ticks: true }, fractions: [fraction(n, d), eq] },
      }));
    }
  }
  return variants;
}

function visualModelCandidates() {
  const cases = [[1, 2, 2], [1, 3, 2], [2, 3, 2], [1, 4, 3], [3, 4, 2], [2, 5, 2], [3, 5, 2], [4, 5, 2], [1, 6, 3], [5, 6, 2], [3, 8, 2], [5, 8, 2], [7, 10, 2], [9, 10, 2]];
  const variants = [];
  for (const [n, d, factor] of cases) {
    const eq = fraction(n * factor, d * factor);
    for (let mode = 0; mode < 2; mode += 1) {
      const index = variants.length;
      const answer = mode === 0
        ? `same-size wholes shading ${fraction(n, d)} and ${eq}`
        : "The wholes must be the same size";
      variants.push(choiceVariant({
        id: `visual-model-${n}-${d}-x${factor}-${mode + 1}`,
        format: "fraction-bar",
        blueprint: mode === 0 ? "bar-subdivision-equivalence" : "same-whole-fair-comparisons",
        strand: "visual_models",
        prompt: mode === 0
          ? `Model lab ${index + 1}: which labelled bar pair proves ${fraction(n, d)} = ${eq}?`
          : `Model lab ${index + 1}: before comparing bars for ${fraction(n, d)} and ${eq}, what must be checked?`,
        choices: mode === 0
          ? [answer, `different-size wholes shading ${fraction(n, d)} and ${eq}`, `same-size wholes shading ${fraction(n, d)} and ${fraction(n, d * factor)}`, `two unpartitioned shapes with no labels`]
          : [answer, "The denominators must look the same", "Both bars must use the same colour", "The larger denominator needs the longer bar"],
        answer,
        hints: ["Compare equal wholes before comparing their shaded parts.", `Subdivide every one of the ${d} parts into ${factor}; the shaded area should not move.`],
        explanation: `A fair model uses equal-sized wholes. Subdividing each ${fraction(n, d)} part into ${factor} makes ${eq} while preserving exactly the same shaded area.`,
        misconception: "different_wholes",
        coverage: ["visual_model", "same_whole", "equivalence"],
        manipulative: `Overlay transparent ${d}-part and ${d * factor}-part fraction strips of equal length.`,
        sentenceStem: `These models are equivalent because the wholes are ___ and the shaded amount is ___.`,
        index,
      }));
    }
  }
  return variants;
}

function comparisonCandidates() {
  const pairs = [[[1, 2], [2, 3]], [[3, 4], [2, 3]], [[2, 5], [1, 2]], [[3, 5], [5, 8]], [[5, 6], [7, 8]], [[3, 8], [2, 5]], [[7, 10], [3, 4]], [[4, 5], [5, 6]], [[5, 12], [1, 2]], [[7, 8], [8, 9]], [[5, 6], [4, 5]], [[2, 3], [7, 10]], [[3, 4], [6, 8]], [[4, 6], [2, 3]]];
  const variants = [];
  for (const [[an, ad], [bn, bd]] of pairs) {
    const common = lcm(ad, bd);
    const av = an * (common / ad);
    const bv = bn * (common / bd);
    const relation = av === bv ? "=" : av > bv ? ">" : "<";
    const evidence = `${av}/${common} ${relation} ${bv}/${common}`;
    for (let mode = 0; mode < 2; mode += 1) {
      const index = variants.length;
      const answer = mode === 0 ? relation : evidence;
      variants.push(choiceVariant({
        id: `compare-${an}-${ad}-${bn}-${bd}-${mode + 1}`,
        format: "symbol-build",
        blueprint: "common-denominator-compare",
        strand: "comparison",
        prompt: mode === 0
          ? `Comparison trail ${index + 1}: choose <, = or > for ${fraction(an, ad)} ___ ${fraction(bn, bd)}.`
          : `Comparison trail ${index + 1}: which common-denominator evidence justifies the comparison of ${fraction(an, ad)} and ${fraction(bn, bd)}?`,
        choices: mode === 0 ? [answer, ...["<", "=", ">"].filter((value) => value !== answer), "cannot tell"] : [answer, `${an}/${common} ${relation} ${bn}/${common}`, `${av}/${common} ${opposite(relation)} ${bv}/${common}`, `${ad}/${common} ${relation} ${bd}/${common}`],
        answer,
        hints: ["Rewrite both fractions using equal-sized parts.", `Use denominator ${common}; compare ${av} and ${bv}, including the possibility of equality.`],
        explanation: `With common denominator ${common}, the fractions become ${av}/${common} and ${bv}/${common}. Since ${av} ${relation} ${bv}, ${fraction(an, ad)} ${relation} ${fraction(bn, bd)}.`,
        misconception: "larger_denominator_larger_fraction",
        coverage: ["comparison", "common_denominator", av === bv ? "equivalence" : "magnitude"],
        manipulative: `Compare both values on a fraction wall partitioned into ${common} equal parts.`,
        sentenceStem: `I rewrote both fractions in ___ths. Because ___ ${relation} ___, the first fraction is ___.`,
        index,
      }));
    }
  }
  return variants;
}

function misconceptionReasoningCandidates() {
  const cases = [
    { key: "denominator-size", claim: "3/8 is greater than 3/5 because 8 is greater than 5.", answer: "Incorrect: with equal numerators, fifths are larger pieces than eighths, so 3/5 > 3/8.", tag: "larger_denominator_larger_fraction" },
    { key: "top-only", claim: "2/3 = 4/3 because the numerator was doubled.", answer: "Incorrect: the numerator and denominator must be scaled by the same factor; 2/3 = 4/6.", tag: "changes_one_number_only" },
    { key: "different-wholes", claim: "One half of a small bar must equal one half of a bar twice as long.", answer: "Incorrect for absolute amounts: fraction models can be compared fairly only when the wholes are the same size.", tag: "different_wholes" },
    { key: "add-parts", claim: "1/2 + a scale factor of 2 gives 3/4, so 1/2 = 3/4.", answer: "Incorrect: equivalence uses multiplication or division of both parts, so 1/2 x 2/2 = 2/4.", tag: "adds_to_scale" },
    { key: "cancel-unequally", claim: "6/8 simplifies to 3/8 because only 6 is even.", answer: "Incorrect: divide both numerator and denominator by 2, giving 3/4.", tag: "simplifies_one_part_only" },
    { key: "mixed", claim: "7/4 = 1 3/7 because 7 divided by 4 leaves 3.", answer: "Incorrect: the leftover pieces remain quarters, so 7/4 = 1 3/4.", tag: "remainder_changes_denominator" },
    { key: "same-point", claim: "2/3 and 4/6 need different number-line points because the labels differ.", answer: "Incorrect: equivalent labels identify the same value, so both land at the same point.", tag: "different_labels_different_values" },
  ];
  const frames = ["A learner says", "A partner explains", "A worked example states"];
  const variants = [];
  for (const [caseIndex, item] of cases.entries()) {
    for (const [frameIndex, frame] of frames.entries()) {
      const index = variants.length;
      variants.push(choiceVariant({
        id: `reasoning-${item.key}-${frameIndex + 1}`,
        format: frameIndex === 2 ? "symbol-build" : "fraction-bar",
        blueprint: "reasoning-misconception-diagnosis",
        strand: "reasoning_misconceptions",
        prompt: `Reasoning huddle ${index + 1}: ${frame}, '${item.claim}' Which response is mathematically fair and helpful?`,
        choices: [item.answer, "Correct, because the fraction with the larger written number is always greater.", "Incorrect, but there is no model or rule that can explain why.", "Correct only when the shaded colours match."],
        answer: item.answer,
        hints: ["Test the claim with a fraction wall, equal strips or a number line.", "Name the precise rule that works, then give a corrected example without blaming the learner."],
        explanation: `${item.answer} The correction identifies the mathematical idea and offers evidence that can be checked visually or symbolically.`,
        misconception: item.tag,
        coverage: ["reasoning", "misconception", "explanation"],
        manipulative: caseIndex % 2 ? "Use equal fraction strips and counters to test each step." : "Use a fraction wall and an unlabelled number line to test the claim.",
        sentenceStem: `I agree/disagree because ___. A model or calculation that shows this is ___.`,
        index,
      }));
    }
  }
  return variants;
}

function choiceVariant({ id, format, blueprint, strand, prompt, choices, answer, hints, explanation, misconception, coverage, manipulative, sentenceStem, index, extraBody = {} }) {
  const difficultyBand = bands[index % bands.length];
  const uniqueChoices = rotate([...new Set(choices)], index % Math.max(1, new Set(choices).size));
  return {
    id: `${prefix}${id}`,
    format,
    body: {
      prompt,
      choices: uniqueChoices,
      strand,
      coverage_tags: coverage,
      evidence_purpose: `${strand}_reasoning_and_representation`,
      variant_blueprint_id: blueprint,
      difficulty_band: difficultyBand,
      review_batch: "wave-five",
      response_mode: "tap_keyboard_switch_or_oral_choice",
      supported_interactions: ["tap", "keyboard", "switch_scan", "oral_choice"],
      keyboard_instructions: "Use arrow keys to review the numbered choices, then Enter to select and check.",
      switch_scan_order: "prompt_then_model_or_symbols_then_choices_then_check",
      audio_replay: true,
      timed: false,
      drag_required: false,
      colour_required: false,
      visual_load: "low",
      static_alternative: "labelled_text_model_with_numbered_choices",
      manipulative_alternative: manipulative,
      sentence_stem: sentenceStem,
      reduced_motion_alternative: "instant_outline_and_text_feedback",
      progress_feedback: "one_personal_path_step_without_speed_score_or_streak_loss",
      ...extraBody,
    },
    expected_answer: { value: answer },
    hints,
    explanation,
    feedback: {
      correct: `Yes. ${explanation}`,
      try_again: `No rush. Use this scaffold: ${hints[0]}`,
      misconception: `That choice may fit the '${misconception}' misconception. ${hints[1]}`,
    },
    gamification: {
      mode: "low_pressure_personal_progress",
      reward: index % 4 === 0 ? "add_one_piece_to_your_fraction_mosaic" : "reveal_one_calm_path_marker",
      no_timer: true,
      no_lost_lives: true,
      replay_encouraged: true,
    },
    difficulty: { intro: 2, developing: 3, expected: 5, secure: 6, stretch: 7, retrieval: 5 }[difficultyBand],
    status: "review",
    misconception_tag: misconception,
    animation_hook: format === "number-line" ? "equivalent-line-align" : format === "fraction-bar" ? "fraction-bar-subdivide" : "fraction-scale-lens",
  };
}

function enrichVariant(variant) {
  const body = variant.body ?? {};
  return {
    ...variant,
    body: {
      ...body,
      fraction_representation_contract: {
        kind: "fraction_representation_reasoning",
        mode: body.strand === "number_lines" ? "number_line_alignment" : body.strand === "visual_models" ? "same_whole_visual_model" : body.strand === "improper_mixed_representations" ? "whole_and_remainder_grouping" : body.strand === "common_denominators" || body.strand === "comparison" ? "common_denominator_bridge" : "symbol_and_model_link",
        representation_routes: ["fraction_bar", "fraction_wall", "number_line", "symbolic"],
        response_modes: ["touch", "keyboard", "switch", "eye_gaze", "aac", "adult_scribed"],
        drag_required: false,
        timed: false,
        preserve_correct_work: true,
        misconception_check_supported: true,
      },
    },
  };
}

function validateFractionContract(variant) {
  const contract = variant.body?.fraction_representation_contract;
  const requiredResponseModes = ["touch", "keyboard", "switch", "eye_gaze", "aac", "adult_scribed"];
  if (!contract || contract.kind !== "fraction_representation_reasoning" || !contract.mode || contract.drag_required !== false || contract.timed !== false || contract.preserve_correct_work !== true || contract.misconception_check_supported !== true || requiredResponseModes.some((mode) => !contract.response_modes?.includes(mode))) throw new Error(`${variant.id} lacks an accessible fraction representation contract.`);
  if (!Array.isArray(contract.representation_routes) || !["fraction_bar", "fraction_wall", "number_line", "symbolic"].every((route) => contract.representation_routes.includes(route))) throw new Error(`${variant.id} lacks equivalent fraction representation routes.`);
}

function ensureBlueprints(currentPack) {
  const additions = [
    { id: "simplifying-by-common-factor", format: "symbol-build", count: 280, difficulty_band: "developing", misconception_tag: "simplifies_one_part_only", purpose: "Simplify fractions by dividing numerator and denominator by a shared factor.", generation_pattern: "reducible fraction + shared factor + simplest-form or operation choice", review_notes: "Keep visual regrouping available and distinguish simplification from subtraction.", source: "ai_drafted_teacher_reviewed" },
    { id: "common-denominator-compare", format: "symbol-build", count: 300, difficulty_band: "secure", misconception_tag: "adds_denominators_to_compare", purpose: "Build common denominators and use them to compare fractions.", generation_pattern: "fraction pair + least common denominator + converted pair or comparison", review_notes: "Include equality cases and fraction-wall alternatives.", source: "ai_drafted_teacher_reviewed" },
    { id: "improper-mixed-equivalence", format: "fraction-bar", count: 260, difficulty_band: "expected", misconception_tag: "whole_number_not_counted_in_parts", purpose: "Connect improper fractions with equivalent mixed-number and bar representations.", generation_pattern: "improper fraction or mixed number + grouped unit bars + equivalent form", review_notes: "Models beyond one must show every whole at the same scale.", source: "ai_drafted_teacher_reviewed" },
    { id: "reasoning-misconception-diagnosis", format: "fraction-bar", count: 240, difficulty_band: "stretch", misconception_tag: "larger_denominator_larger_fraction", purpose: "Diagnose common fraction misconceptions and select a precise, supportive correction.", generation_pattern: "learner claim + visual or symbolic test + fair correction", review_notes: "Use non-judgemental language and accept equivalent evidence in open delivery.", source: "ai_drafted_teacher_reviewed" },
  ];
  for (const blueprint of additions) {
    if (!currentPack.variant_blueprints.some((existing) => existing.id === blueprint.id)) currentPack.variant_blueprints.push(blueprint);
  }
}

function validateBank(packData, authored, generated) {
  if (generated.length !== pilotTarget - authored.length) throw new Error(`Expected ${pilotTarget - authored.length} generated candidates, found ${generated.length}.`);
  if (authored.length + generated.length !== packData.practice?.variant_targets?.pilot) throw new Error("Bank must exactly meet the configured pilot target.");
  const ids = new Set();
  const signatures = new Set();
  const blueprintIDs = new Set(packData.variant_blueprints.map((blueprint) => blueprint.id));
  const formats = new Set(packData.practice.formats);
  const strands = new Set();
  const actualFormats = new Set();
  const actualBands = new Set();
  for (const variant of [...authored, ...generated]) {
    if (ids.has(variant.id)) throw new Error(`Duplicate variant id ${variant.id}.`);
    ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${JSON.stringify(variant.expected_answer)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`);
    signatures.add(signature);
    validateFractionContract(variant);
  }
  for (const variant of generated) {
    if (variant.status !== "review") throw new Error(`${variant.id} must remain in review.`);
    if (!formats.has(variant.format)) throw new Error(`${variant.id} uses unsupported format ${variant.format}.`);
    if (!blueprintIDs.has(variant.body.variant_blueprint_id)) throw new Error(`${variant.id} uses an unknown blueprint.`);
    if (variant.body.timed || variant.body.drag_required || variant.body.colour_required) throw new Error(`${variant.id} violates low-pressure or accessible interaction rules.`);
    if (variant.body.supported_interactions.length < 4 || !variant.body.static_alternative || !variant.body.manipulative_alternative || !variant.body.sentence_stem) throw new Error(`${variant.id} is missing SEND or interaction scaffolds.`);
    if (variant.hints.length < 2 || !variant.explanation || !variant.feedback?.correct || !variant.feedback?.try_again || !variant.feedback?.misconception) throw new Error(`${variant.id} lacks rich feedback.`);
    if (!variant.gamification?.no_timer || !variant.gamification?.no_lost_lives) throw new Error(`${variant.id} has unsuitable gamification.`);
    const matches = variant.body.choices.filter((choice) => choice === variant.expected_answer.value).length;
    if (matches !== 1) throw new Error(`${variant.id} must contain its answer exactly once.`);
    strands.add(variant.body.strand);
    actualFormats.add(variant.format);
    actualBands.add(variant.body.difficulty_band);
  }
  assertCoverage("strands", new Set(["equivalent_fractions", "simplifying", "common_denominators", "improper_mixed_representations", "number_lines", "visual_models", "comparison", "reasoning_misconceptions"]), strands);
  assertCoverage("formats", formats, actualFormats);
  assertCoverage("difficulty bands", new Set(bands), actualBands);
}

function assertCoverage(label, required, actual) {
  const missing = [...required].filter((value) => !actual.has(value));
  if (missing.length) throw new Error(`Generated bank is missing ${label}: ${missing.join(", ")}.`);
}

function fraction(n, d) { return `${n}/${d}`; }
function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
function lcm(a, b) { return (a * b) / gcd(a, b); }
function opposite(value) { return value === "<" ? ">" : value === ">" ? "<" : ">"; }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function summary(variants, key) { const counts = new Map(); for (const variant of variants) counts.set(key(variant), (counts.get(key(variant)) ?? 0) + 1); return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => `${name}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
