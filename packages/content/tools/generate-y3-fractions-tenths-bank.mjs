#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/ma-y3-number-fractions-tenths.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y3-number-fractions-tenths-bank-";
const reviewBatch = "y3-fractions-tenths-pilot-a";

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y3-number-fractions-tenths") {
  throw new Error("This generator only supports the Year 3 fractions tenths pack.");
}

for (const variant of pack.question_variants ?? []) {
  if (typeof variant.explanation === "string" && variant.explanation.includes(" The expected response is ")) {
    variant.explanation = variant.explanation.split(" The expected response is ")[0];
  }
}

const beforeVariants = structuredClone(pack.question_variants ?? []);
const beforeCore = coreSnapshot(beforeVariants);
const beforeBlueprints = sortedCounts(beforeVariants, (variant) => variant.body?.variant_blueprint_id ?? "undefined");
const beforeMissingFeedback = countMissingFeedback(beforeVariants);
const beforeMissingRoute = countMissingRoute(beforeVariants);
const authored = beforeVariants.filter((variant) => !variant.id.startsWith(prefix)).map(enrichVariant);
const candidates = [
  ...equalTenthsBuilds(),
  ...numeratorDenominatorChoices(),
  ...numberLinePlacements(),
  ...retrievalMix(),
  ...contextualTransfer(),
].map(enrichVariant);

validateBank(pack, authored, candidates);
pack.question_variants = [...authored, ...candidates];
pack.version = "0.3.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Quality-hardened Year 3 tenths pack with the same three curated variants and 197 deterministic pilot candidates. IDs, answers, existing blueprint allocation (including the curated items' original absence of blueprint metadata), fraction arithmetic, equal-part models, number-line positions and scope remain unchanged. Every variant now has correct feedback, representation/equal-parts evidence, numerator-denominator or number-line repair, misconception identification and a targeted check prompt. Explicit touch, keyboard, switch, eye-gaze, AAC/point/adult-scribed routes remove mandatory dragging, handwriting and speech while preserving SEND/dyscalculia and pressure-free supports. Narration stays selectively absent; future narration must use produced, human-reviewed ElevenLabs assets and browser TTS is prohibited. Curriculum, teacher, accessibility and safeguarding checks remain required before promotion.";
validateHardening(pack.question_variants, beforeCore, beforeBlueprints);
const afterMissingFeedback = countMissingFeedback(pack.question_variants);
const afterMissingRoute = countMissingRoute(pack.question_variants);

enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y3-tenths-bank authored=${authored.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`y3-tenths-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`y3-tenths-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`y3-tenths-bank bands=${summary(candidates, (variant) => variant.body.difficulty_band)}`);
console.log(`y3-tenths-bank coverage=${summaryCoverage(candidates)}`);
console.log(`y3-tenths-bank missing_feedback before=${beforeMissingFeedback} after=${afterMissingFeedback}`);
console.log(`y3-tenths-bank missing_route before=${beforeMissingRoute} after=${afterMissingRoute}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y3-tenths-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) {
    throw new Error("Year 3 fractions tenths bank is out of date; run generate-y3-fractions-tenths-bank.mjs --write.");
  }
  console.log("y3-tenths-bank deterministic check passed");
} else {
  console.log("y3-tenths-bank dry-run; pass --write to update the pack");
}

function equalTenthsBuilds() {
  const representations = [
    { id: "bridge", label: "explorer bridge", unit: "planks", world: "river_bridge" },
    { id: "map-strip", label: "map route strip", unit: "sections", world: "island_map" },
    { id: "supply-row", label: "supply row", unit: "equal spaces", world: "base_camp" },
    { id: "water-gauge", label: "water gauge", unit: "equal bands", world: "expedition_gauge" },
  ];
  const variants = [];
  for (const representation of representations) {
    for (let shaded = 1; shaded <= 10; shaded += 1) {
      const index = variants.length;
      variants.push({
        id: `${prefix}build-${representation.id}-${shaded}`,
        format: "fraction-wall",
        body: {
          prompt: `Show ${numberWord(shaded)} tenths on the ${representation.label}.`,
          parts: 10,
          target_shaded: shaded,
          partition_requirement: "ten_equal_parts",
          representation: representation.id,
          coverage_tags: ["representation", "equivalence_partitioning", shaded === 10 ? "reasoning" : "equal_parts"],
          ...interactionMetadata("fraction-wall", representation.world, index),
          evidence_purpose: "equal_tenths_partition_and_build",
          variant_blueprint_id: "equal-tenths-builds",
        },
        expected_answer: { value: { shaded, parts: 10 } },
        hints: [
          `Check that all ten ${representation.unit} are equal in size.`,
          `Select ${shaded} of the 10 equal ${representation.unit}.`,
        ],
        explanation: `${capitalise(numberWord(shaded))} tenths means ${shaded} out of 10 equal parts${shaded === 10 ? ", which makes one whole" : ""}.`,
        difficulty: difficultyFor(bandFor(index)),
        status: "review",
        misconception_tag: "unequal_parts",
        animation_hook: shaded === 10 ? "bridge-planks-lock" : "fraction-wall-fill",
      });
    }
  }
  return variants;
}

function numeratorDenominatorChoices() {
  const representations = ["bridge planks", "map sections", "supply spaces", "gauge bands"];
  const variants = [];
  for (const representation of representations) {
    for (let shaded = 1; shaded <= 10; shaded += 1) {
      const index = variants.length;
      const expected = `${shaded}/10`;
      variants.push(makeChoice({
        id: `${prefix}name-${slug(representation)}-${shaded}`,
        format: "tap-choice",
        prompt: `${capitalise(numberWord(shaded))} of ten equal ${representation} are marked. Which fraction is marked?`,
        choices: rotate([expected, ...fractionDistractors(shaded)], index % 4),
        expected,
        hints: ["The numerator counts the marked parts.", "The denominator counts all the equal parts in the whole."],
        explanation: `${shaded} marked parts out of 10 equal parts is ${expected}. The numerator is ${shaded} and the denominator is 10.`,
        blueprint: "numerator-denominator-choices",
        evidencePurpose: "numerator_denominator_meaning",
        misconception: "denominator_as_shaded_parts",
        animation: "tenths-planks-glow",
        bandIndex: index + 1,
        coverageTags: ["representation", "misconception"],
        world: `fraction_${slug(representation)}`,
        body: { parts: 10, shaded, representation: slug(representation) },
      }));
    }
  }
  return variants;
}

function numberLinePlacements() {
  const lines = [
    { id: "plain", label: "number line", world: "number_line_station" },
    { id: "river", label: "river route", world: "river_crossing" },
    { id: "island", label: "island trail", world: "island_trail" },
    { id: "bridge", label: "bridge progress line", world: "bridge_progress" },
  ];
  const variants = [];
  for (const line of lines) {
    for (let numerator = 1; numerator <= 10; numerator += 1) {
      const index = variants.length;
      const equivalent = equivalentFor(numerator);
      variants.push({
        id: `${prefix}line-${line.id}-${numerator}`,
        format: "number-line",
        body: {
          prompt: `Place ${numerator}/10 on the ${line.label} from 0 to 1.`,
          minimum: 0,
          maximum: 1,
          ticks: 10,
          target: `${numerator}/10`,
          target_numerator: numerator,
          target_denominator: 10,
          equivalent_fraction: equivalent,
          coverage_tags: ["number_line", "representation", ...(equivalent ? ["equivalence_partitioning"] : [])],
          ...interactionMetadata("number-line", line.world, index + 2),
          evidence_purpose: "tenths_number_line_placement",
          variant_blueprint_id: "tenths-number-line-placement",
        },
        expected_answer: { value: numerator / 10 },
        hints: [
          "The interval from 0 to 1 is split into ten equal jumps.",
          `${numerator}/10 is the ${ordinal(numerator)} tick after 0${equivalent ? ` and is equivalent to ${equivalent}` : ""}.`,
        ],
        explanation: `${numerator}/10 is ${numerator} equal jumps of one tenth from 0${equivalent ? `; it is at the same point as ${equivalent}` : ""}.`,
        difficulty: difficultyFor(bandFor(index + 2)),
        status: "review",
        misconception_tag: "one_tenth_as_one",
        animation_hook: "tenths-number-line-step",
      });
    }
  }
  return variants;
}

function retrievalMix() {
  return [
    ...retrievalRepresentations(),
    ...retrievalEquivalence(),
    ...retrievalMisconceptions(),
    ...retrievalComparisons(),
  ];
}

function retrievalRepresentations() {
  const variants = [];
  for (let shaded = 1; shaded <= 10; shaded += 1) {
    const expected = `${shaded}/10`;
    variants.push(makeChoice({
      id: `${prefix}retrieve-representation-${shaded}`,
      format: "tap-choice",
      prompt: `A route strip has ten equal sections and ${numberWord(shaded)} are highlighted. Which fraction matches it?`,
      choices: rotate([expected, ...fractionDistractors(shaded)], shaded % 4),
      expected,
      hints: ["Count highlighted sections for the top number.", "Count all equal sections for the bottom number."],
      explanation: `${shaded} of 10 equal route sections are highlighted, so the fraction is ${expected}.`,
      blueprint: "tenths-retrieval-mix",
      evidencePurpose: "representation_retrieval",
      misconception: "denominator_as_shaded_parts",
      animation: "fraction-tile-hover",
      bandIndex: shaded + 3,
      coverageTags: ["representation", "misconception"],
      world: "route_strip_review",
      body: { parts: 10, shaded, representation: "route-strip" },
    }));
  }
  return variants;
}

function retrievalEquivalence() {
  const cases = [
    ["Which fraction is equivalent to 2/10?", "1/5", ["1/2", "2/5", "5/10"], "Two tenths can be grouped as one group of two out of five equal groups, so 2/10 = 1/5."],
    ["Which fraction is equivalent to 4/10?", "2/5", ["1/5", "4/5", "1/2"], "Four tenths make two groups of two tenths, so 4/10 = 2/5."],
    ["Which fraction is equivalent to 5/10?", "1/2", ["1/5", "2/5", "5/5"], "Five of ten equal parts cover half of the whole, so 5/10 = 1/2."],
    ["Which fraction is equivalent to 6/10?", "3/5", ["2/5", "4/5", "1/2"], "Six tenths make three groups of two tenths, so 6/10 = 3/5."],
    ["Which fraction is equivalent to 8/10?", "4/5", ["3/5", "2/5", "1/2"], "Eight tenths make four groups of two tenths, so 8/10 = 4/5."],
    ["Which amount is equivalent to 10/10?", "1 whole", ["1/10", "10 wholes", "one half"], "All ten tenths fill the whole, so 10/10 equals 1 whole."],
    ["Ten equal map sections are grouped into five equal pairs. What fraction of the map is one pair?", "1/5", ["1/10", "2/5", "5/10"], "The five equal pairs partition the whole into fifths, so one pair is 1/5."],
    ["Ten equal bridge planks are grouped into two equal sets. What fraction is one set?", "1/2", ["1/10", "2/10", "2/5"], "Two equal sets partition the bridge into halves, so one set is 1/2 or 5/10."],
    ["How many tenths are equivalent to one fifth?", "2/10", ["1/10", "5/10", "10/2"], "One fifth covers two of ten equal parts, so 1/5 = 2/10."],
  ];
  return cases.map(([prompt, expected, distractors, explanation], index) => makeChoice({
    id: `${prefix}retrieve-equivalence-${index + 1}`,
    format: "tap-choice",
    prompt,
    choices: rotate([expected, ...distractors], index % 4),
    expected,
    hints: ["Regroup the same ten equal parts without changing the amount.", "Equivalent fractions cover the same amount of the same whole."],
    explanation,
    blueprint: "tenths-retrieval-mix",
    evidencePurpose: "tenths_equivalence_and_partitioning",
    misconception: "unequal_parts",
    animation: "equal-parts-scan",
    bandIndex: index + 4,
    coverageTags: ["equivalence_partitioning", "reasoning"],
    world: "map_partition_lab",
    body: { representation: "regrouped-tenths" },
  }));
}

function retrievalMisconceptions() {
  const variants = [];
  for (let shaded = 1; shaded <= 10; shaded += 1) {
    const expected = `One whole split into 10 equal parts, with ${shaded} shaded`;
    const wrongShaded = shaded === 10 ? 9 : shaded + 1;
    variants.push(makeChoice({
      id: `${prefix}retrieve-model-check-${shaded}`,
      format: "tap-choice",
      prompt: `Which model can show ${shaded}/10 correctly?`,
      choices: rotate([
        expected,
        `One whole split into 10 unequal pieces, with ${shaded} shaded`,
        `Ten separate wholes, with ${shaded} whole shapes shaded`,
        `One whole split into 10 equal parts, with ${wrongShaded} shaded`,
      ], shaded % 4),
      expected,
      hints: ["A fraction model must begin with one agreed whole.", "Tenths require ten equal parts before any parts are shaded."],
      explanation: `${shaded}/10 needs one whole partitioned into 10 equal parts with exactly ${shaded} of those parts shaded.`,
      blueprint: "tenths-retrieval-mix",
      evidencePurpose: "misconception_model_check",
      misconception: "unequal_parts",
      animation: "equal-parts-scan",
      bandIndex: shaded + 5,
      coverageTags: ["misconception", "equivalence_partitioning", "reasoning"],
      world: "bridge_model_inspection",
      body: { target_fraction: `${shaded}/10`, model_check: "equal_parts_and_one_whole" },
    }));
  }
  return variants;
}

function retrievalComparisons() {
  const pairs = [[1, 3], [2, 7], [4, 5], [3, 9], [6, 8], [5, 10], [7, 9], [2, 6], [1, 8], [4, 10]];
  return pairs.map(([left, right], index) => {
    const expected = `${Math.max(left, right)}/10`;
    return makeChoice({
      id: `${prefix}retrieve-compare-${left}-${right}`,
      format: "tap-choice",
      prompt: `Two scouts travelled ${left}/10 and ${right}/10 of the same route. Which distance is greater?`,
      choices: rotate([expected, `${Math.min(left, right)}/10`, "They are equal", "There is not enough information"], index % 4),
      expected,
      hints: ["Both fractions refer to the same whole route.", "When denominators are both 10, compare the numerators."],
      explanation: `${expected} is greater because it contains more equal tenths of the same route.`,
      blueprint: "tenths-retrieval-mix",
      evidencePurpose: "same_denominator_comparison",
      misconception: "denominator_as_shaded_parts",
      animation: "tenths-number-line-step",
      bandIndex: index + 6,
      coverageTags: ["reasoning", "number_line"],
      world: "scout_route_compare",
      body: { left_fraction: `${left}/10`, right_fraction: `${right}/10`, same_whole: true },
    });
  });
}

function contextualTransfer() {
  const challenges = [
    [0, 1], [1, 3], [1, 5], [2, 5], [2, 7], [3, 6], [3, 9], [4, 5], [4, 8], [5, 7],
    [5, 10], [6, 8], [6, 10], [7, 9], [7, 10], [8, 9], [8, 10], [0, 5], [0, 10],
  ];
  const contexts = [
    { id: "bridge", prompt: "The explorer bridge", units: "planks", world: "river_bridge_repair" },
    { id: "map", prompt: "The island route", units: "sections", world: "island_route_unlock" },
  ];
  const variants = [];
  for (const context of contexts) {
    for (const [start, target] of challenges) {
      const index = variants.length;
      const add = target - start;
      variants.push({
        id: `${prefix}transfer-${context.id}-${start}-to-${target}`,
        format: "fraction-wall",
        body: {
          prompt: `${context.prompt} shows ${start}/10 complete. Add equal ${context.units} to reach ${target}/10. How many must be added?`,
          parts: 10,
          start_shaded: start,
          target_shaded: target,
          change_required: add,
          partition_requirement: "ten_equal_parts",
          coverage_tags: ["reasoning", "representation", "equivalence_partitioning"],
          ...interactionMetadata("fraction-wall", context.world, index + 3),
          evidence_purpose: "contextual_tenths_difference",
          variant_blueprint_id: "contextual-tenths-transfer",
        },
        expected_answer: { value: { add, shaded: target, parts: 10 } },
        hints: [
          `Start at ${start}/10 and count equal tenths until ${target}/10.`,
          `${target} - ${start} tells you how many equal ${context.units} to add.`,
        ],
        explanation: `${target} - ${start} = ${add}, so adding ${add} tenth${add === 1 ? "" : "s"} changes ${start}/10 to ${target}/10${target === 10 ? ", which completes one whole" : ""}.`,
        difficulty: difficultyFor(bandFor(index + 3)),
        status: "review",
        misconception_tag: start === 0 ? "one_tenth_as_one" : "unequal_parts",
        animation_hook: target === 10 ? "island-path-open" : "bridge-planks-lock",
      });
    }
  }
  return variants;
}

function makeChoice({ id, format, prompt, choices, expected, hints, explanation, blueprint, evidencePurpose, misconception, animation, bandIndex, coverageTags, world, body }) {
  const difficultyBand = bandFor(bandIndex);
  return {
    id,
    format,
    body: {
      prompt,
      choices,
      ...body,
      coverage_tags: coverageTags,
      ...interactionMetadata(format, world, bandIndex),
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

function interactionMetadata(format, worldContext, bandIndex) {
  const difficultyBand = bandFor(bandIndex);
  const choice = format === "tap-choice";
  return {
    difficulty_band: difficultyBand,
    review_batch: reviewBatch,
    response_mode: choice ? "tap_keyboard_switch_or_oral_choice" : "tap_keyboard_switch_or_number_input",
    audio_replay: true,
    timed: false,
    drag_required: false,
    colour_required: false,
    visual_load: "low",
    keyboard_instructions: choice ? "Use arrow keys to review choices, then Enter to select." : "Use arrow keys or the numbered position controls, then Enter to check.",
    switch_scan_order: choice ? "prompt_then_choices_then_check" : "prompt_then_equal_parts_or_ticks_then_check",
    static_alternative: choice ? "numbered_prompt_and_choice_list" : "labelled_ten-part_strip_or_number_line",
    reduced_motion_alternative: "instant_outline_and_text_feedback",
    world_context: worldContext,
    progress_feedback: "map_or_bridge_progress_without_speed_scoring",
  };
}

function validateBank(packData, authored, generated) {
  const pilot = packData.practice?.variant_targets?.pilot;
  if (authored.length !== 3) throw new Error(`Expected three curated variants, found ${authored.length}.`);
  if (generated.length !== pilot - authored.length) {
    throw new Error(`Expected ${pilot - authored.length} generated candidates, found ${generated.length}.`);
  }
  if (authored.length + generated.length !== pilot) throw new Error(`Pilot bank must contain exactly ${pilot} variants.`);

  const blueprintIDs = new Set((packData.variant_blueprints ?? []).map((blueprint) => blueprint.id));
  const formats = new Set(packData.practice?.formats ?? []);
  const bands = new Set([
    ...(packData.practice?.difficulty_bands ?? []),
    ...(packData.variant_blueprints ?? []).map((blueprint) => blueprint.difficulty_band),
  ]);
  const requiredCoverage = new Set(["representation", "number_line", "equivalence_partitioning", "reasoning", "misconception"]);
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
    if (!Array.isArray(variant.hints) || variant.hints.length < 2 || !variant.explanation) {
      throw new Error(`${variant.id} requires two useful hints and an explanation.`);
    }
    if (variant.format === "tap-choice") {
      const expected = variant.expected_answer?.value;
      const matches = (variant.body?.choices ?? []).filter((choice) => choice === expected).length;
      if (matches !== 1) throw new Error(`${variant.id} must contain its expected choice exactly once.`);
    }
    if (variant.format === "number-line") {
      const expected = variant.body.target_numerator / variant.body.target_denominator;
      if (variant.expected_answer?.value !== expected || variant.body.ticks !== 10) {
        throw new Error(`${variant.id} has an inconsistent number-line target.`);
      }
    }
    if (variant.format === "fraction-wall") {
      if (variant.body.parts !== 10 || variant.body.target_shaded < 1 || variant.body.target_shaded > 10) {
        throw new Error(`${variant.id} must use a valid ten-part whole.`);
      }
    }
    actualBlueprints.add(variant.body.variant_blueprint_id);
    actualFormats.add(variant.format);
    actualBands.add(variant.body.difficulty_band);
    for (const tag of variant.body.coverage_tags ?? []) actualCoverage.add(tag);
  }

  for (const variant of [...authored, ...generated]) validateFractionContract(variant);

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
    audio_route: "not_required_equal_part_models_fraction_labels_and_number_lines_are_complete",
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
        touch: "Tap equal parts, a labelled tenth position or a numbered choice; precise shading or marker dragging is optional.",
        keyboard: "Tab through the whole/model or number line; use arrows, numbered controls or direct fraction entry and Enter or Space to select and check.",
        switch_scan: "Scan prompt, whole/equal parts or line positions, choices/controls, check and retry in a fixed order.",
        eye_gaze: "Use large dwell-select equal-part tiles, fraction labels and tenth landing points with adjustable dwell time and confirmation.",
        aac_point_adult_scribed: "The learner may point, use AAC or direct an adult to shade, place or record the indicated fraction without the adult deciding the numerator, denominator or position.",
        drag_required: false,
      },
      accessible_response_route: "Touch, keyboard, switch, eye gaze, AAC, pointing and adult-scribed responses provide equivalent fraction evidence; dragging, handwriting and speech are never mandatory.",
      equal_parts_route: "One agreed whole is shown as ten equal, numbered parts with outlines, text labels and an equality check; uneven-part distractors remain explicitly unequal.",
      numerator_denominator_route: "The numerator is linked to selected/shaded parts and the denominator to all equal parts in the whole, with top/bottom labels and a sentence-frame alternative.",
      number_line_route: "The interval 0 to 1 has ten equal labelled jumps; direct tenth selection, keyboard steps and typed values replace marker dragging.",
      partition_repair_route: "Return to one whole, verify ten equal parts, count all parts for the denominator, count selected parts for the numerator, then map the same amount to equal jumps.",
      dyscalculia_support: { agreed_whole_persistent: true, equal_part_count_visible: true, numerator_denominator_labels: true, one_part_or_jump_at_a_time: true, same_whole_reminder: true, zero_and_one_anchors_persistent: true, correct_parts_preserved: true },
      reduced_load_route: "Reveal the whole, equality of parts, selected count and fraction/line position one stage at a time while preserving correct parts.",
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
      fraction_contract: fractionContract(variant),
    },
    feedback: feedbackFor(variant),
  };
}

function fractionContract(variant) {
  const body = variant.body ?? {};
  const responseModes = ["touch", "keyboard", "switch", "eye_gaze", "aac", "adult_scribed"];
  if (variant.format === "fraction-wall") {
    const structured = Number.isInteger(body.parts) && Number.isInteger(body.target_shaded);
    return {
      kind: "equal_parts_fraction_wall",
      mode: structured ? (body.change_required !== undefined ? "difference_builder" : "equal_parts_builder") : "authored_choice",
      whole_parts_key: structured ? "parts" : null,
      selected_parts_key: structured ? "target_shaded" : null,
      start_parts_key: body.start_shaded !== undefined ? "start_shaded" : null,
      change_key: body.change_required !== undefined ? "change_required" : null,
      denominator: structured ? 10 : null,
      same_whole_required: true,
      drag_required: false,
      response_modes: responseModes,
    };
  }
  if (variant.format === "number-line") {
    const structured = Number.isInteger(body.ticks) && body.target_numerator !== undefined && body.target_denominator !== undefined;
    return {
      kind: "tenths_number_line",
      mode: structured ? "zero_to_one_tenths" : "authored_choice",
      minimum_key: structured ? "minimum" : null,
      maximum_key: structured ? "maximum" : null,
      ticks_key: structured ? "ticks" : null,
      numerator_key: structured ? "target_numerator" : null,
      denominator_key: structured ? "target_denominator" : null,
      anchors_required: true,
      drag_required: false,
      response_modes: responseModes,
    };
  }
  if (variant.format === "tap-choice") {
    const evidenceKeys = ["parts", "shaded", "target_fraction", "left_fraction", "right_fraction", "same_whole", "representation"].filter((key) => body[key] !== undefined);
    return {
      kind: "fraction_evidence_choice",
      mode: evidenceKeys.length > 0 ? "evidence_linked_choice" : "authored_choice",
      evidence_keys: evidenceKeys,
      choices_key: "choices",
      same_whole_required: body.same_whole !== undefined ? body.same_whole : null,
      drag_required: false,
      response_modes: responseModes,
    };
  }
  return null;
}

function validateFractionContract(variant) {
  const body = variant.body ?? {};
  const contract = body.fraction_contract;
  const requiredResponseModes = ["touch", "keyboard", "switch", "eye_gaze", "aac", "adult_scribed"];
  if (!contract || contract.drag_required !== false || requiredResponseModes.some((mode) => !contract.response_modes?.includes(mode))) throw new Error(`${variant.id} lacks an accessible fractions contract.`);
  if (variant.format === "fraction-wall") {
    if (contract.kind !== "equal_parts_fraction_wall") throw new Error(`${variant.id} has the wrong fraction-wall contract.`);
    if (contract.mode === "equal_parts_builder" || contract.mode === "difference_builder") {
      if (body.parts !== 10 || !Number.isInteger(body.target_shaded) || body.target_shaded < 1 || body.target_shaded > 10) throw new Error(`${variant.id} lacks a valid ten-part whole.`);
      if (contract.mode === "difference_builder" && (!Number.isInteger(body.start_shaded) || !Number.isInteger(body.change_required) || body.start_shaded + body.change_required !== body.target_shaded)) throw new Error(`${variant.id} has invalid tenths change arithmetic.`);
    } else if (contract.mode !== "authored_choice") throw new Error(`${variant.id} has an unknown fraction-wall mode.`);
  } else if (variant.format === "number-line") {
    if (contract.kind !== "tenths_number_line") throw new Error(`${variant.id} has the wrong number-line contract.`);
    if (contract.mode === "zero_to_one_tenths" && (body.minimum !== 0 || body.maximum !== 1 || body.ticks !== 10 || body.target_numerator / body.target_denominator !== variant.expected_answer.value)) throw new Error(`${variant.id} has invalid tenths number-line semantics.`);
    if (contract.mode !== "zero_to_one_tenths" && contract.mode !== "authored_choice") throw new Error(`${variant.id} has an unknown number-line mode.`);
  } else if (variant.format === "tap-choice") {
    if (contract.kind !== "fraction_evidence_choice") throw new Error(`${variant.id} has the wrong fraction-choice contract.`);
    if (contract.mode === "evidence_linked_choice" && (!Array.isArray(contract.evidence_keys) || contract.evidence_keys.length === 0 || !Array.isArray(body.choices))) throw new Error(`${variant.id} lacks fraction evidence choices.`);
    if (contract.mode !== "evidence_linked_choice" && contract.mode !== "authored_choice") throw new Error(`${variant.id} has an unknown fraction-choice mode.`);
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
    support_message: "Equal-part models, number lines, touch, keyboard, switch, eye-gaze, AAC and adult-scribed routes are equally valid; speed, dragging, speech and handwriting are not scored.",
    retry: "Your correct whole, equal parts and tenth positions stay. Open one evidence or check prompt, then retry without losing progress.",
  };
}

function correctFeedback(variant) {
  const answer = answerText(variant.expected_answer);
  if (variant.misconception_tag === "unequal_parts") return `“${answer}” keeps one whole split or regrouped into equal parts, so the fraction amount and any equivalence are valid.`;
  if (variant.misconception_tag === "denominator_as_shaded_parts") return `“${answer}” uses the numerator for selected parts and denominator 10 for all ten equal parts of the whole.`;
  return `“${answer}” places or changes the fraction by equal one-tenth steps between 0 and 1 rather than treating one tenth as one whole.`;
}

function representationEvidence(variant) {
  const body = variant.body, answer = answerText(variant.expected_answer);
  const parts = body.parts ?? body.target_denominator ?? 10;
  const selected = body.target_shaded ?? body.shaded ?? body.target_numerator ?? body.start_shaded;
  if (variant.format === "fraction-wall") {
    if (body.change_required != null) return `The same whole has ${parts} equal parts: start ${body.start_shaded}/10, add ${body.change_required} equal tenths, reach ${body.target_shaded}/10. This supports ${answer}.`;
    return `The model uses one whole split into ${parts} equal parts with ${selected} selected, supporting ${answer}.`;
  }
  if (variant.format === "number-line") return `From 0 to 1 there are ${body.ticks ?? 10} equal jumps; ${body.target ?? `${body.target_numerator}/10`} is ${body.target_numerator ?? 1} one-tenth jump(s) from 0, at ${answer}.`;
  if (body.shaded != null) return `The representation has ${body.shaded} selected parts out of ${body.parts ?? 10} equal parts, so numerator = ${body.shaded} and denominator = ${body.parts ?? 10}; answer ${answer}.`;
  return `${variant.explanation} The same whole and equal-part count support ${answer}.`;
}

function repairFeedback(variant) {
  if (variant.misconception_tag === "unequal_parts") return "Identify one agreed whole, check that all parts are equal, and only then count or regroup them. If part sizes differ, repartition the whole before naming a fraction or claiming equivalence.";
  if (variant.misconception_tag === "denominator_as_shaded_parts") return "Count all equal parts in the whole for the denominator, then count only the selected or shaded parts for the numerator. Keep the denominator 10 even when the shaded count changes.";
  return "Anchor 0 and 1, split that interval into ten equal jumps and move one jump for each tenth. One tenth is the first point after 0, not the endpoint 1; use the fraction wall to match the same amount.";
}

function checkPrompt(variant) {
  if (variant.misconception_tag === "unequal_parts") return "Is there one agreed whole, and are every one of its parts equal before you count or regroup them?";
  if (variant.misconception_tag === "denominator_as_shaded_parts") return "How many equal parts make the whole, and how many of those parts are selected? Which number belongs below and above the fraction bar?";
  return "How many equal jumps are there from 0 to 1, and which one-tenth jump from 0 matches the target fraction?";
}

function strategySupport(variant) {
  if (variant.misconception_tag === "unequal_parts") return "Use WHOLE → CHECK EQUAL PARTS → COUNT/REGROUP → VERIFY SAME AMOUNT.";
  if (variant.misconception_tag === "denominator_as_shaded_parts") return "Use ALL EQUAL PARTS = DENOMINATOR → SELECTED PARTS = NUMERATOR → READ FRACTION.";
  return "Use 0 AND 1 ANCHORS → TEN EQUAL JUMPS → COUNT TENTHS FROM 0 → MATCH MODEL.";
}

function answerText(answer) {
  if (answer?.value && typeof answer.value === "object") {
    if (answer.value.add != null) return `add ${answer.value.add} tenths to make ${answer.value.shaded}/10`;
    return `${answer.value.shaded}/${answer.value.parts}`;
  }
  return String(answer?.value ?? answer);
}

function validateHardening(variants, beforeCoreSnapshot, beforeBlueprintCounts) {
  if (variants.length !== 200) throw new Error(`Expected 200 variants, found ${variants.length}.`);
  if (new Set(variants.map((variant) => variant.id)).size !== 200) throw new Error("Variant IDs are not unique.");
  if (JSON.stringify(coreSnapshot(variants)) !== JSON.stringify(beforeCoreSnapshot)) throw new Error("Hardening changed IDs, answers, curated content, fraction arithmetic, representations or scope.");
  if (JSON.stringify(sortedCounts(variants, (variant) => variant.body?.variant_blueprint_id ?? "undefined")) !== JSON.stringify(beforeBlueprintCounts)) throw new Error("Blueprint allocation changed during hardening.");
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
  for (const key of ["interaction_route", "accessible_response_route", "equal_parts_route", "numerator_denominator_route", "number_line_route", "partition_repair_route", "dyscalculia_support", "reduced_load_route", "no_mandatory_dragging", "no_mandatory_handwriting", "no_mandatory_speech", "microphone_required", "handwriting_required", "drag_required", "retry_without_penalty", "no_timer", "speed_score_allowed", "preserve_correct_work", "undo_available", "pressure_rules", "fraction_contract", "audio_required", "audio_route", "audio_policy", "audio_provider", "audio_production_policy", "human_listening_approval_required", "browser_tts_allowed", "browser_tts_fallback"]) delete copy.body[key];
  return copy;
}
function countMissingFeedback(variants) { return variants.filter((variant) => !variant.feedback?.correct || !variant.feedback?.representation_evidence || !variant.feedback?.repair || !variant.feedback?.misconception_check || !variant.feedback?.check_prompt).length; }
function countMissingRoute(variants) { return variants.filter((variant) => { const body = variant.body ?? {}, route = body.interaction_route ?? {}; return !route.touch || !route.keyboard || !route.switch_scan || !route.eye_gaze || !route.aac_point_adult_scribed || route.drag_required !== false || body.no_mandatory_dragging !== true || body.no_mandatory_handwriting !== true || body.no_mandatory_speech !== true; }).length; }
function sortedCounts(items, keyFor) { const counts = {}; for (const item of items) { const key = keyFor(item); counts[key] = (counts[key] ?? 0) + 1; } return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => String(left).localeCompare(String(right)))); }

function assertCovered(label, required, actual) {
  const missing = [...required].filter((value) => value && !actual.has(value));
  if (missing.length > 0) throw new Error(`Generated bank is missing ${label}: ${missing.join(", ")}.`);
}

function fractionDistractors(numerator) {
  const pool = [
    `10/${numerator}`,
    `${numerator}/${numerator}`,
    `${numerator === 1 ? 2 : numerator - 1}/10`,
    `${numerator === 10 ? 1 : numerator + 1}/10`,
    `1/${numerator}`,
    "1/10",
    "5/10",
    "9/10",
  ];
  const expected = `${numerator}/10`;
  return [...new Set(pool.filter((choice) => choice !== expected))].slice(0, 3);
}

function equivalentFor(numerator) {
  return { 2: "1/5", 4: "2/5", 5: "1/2", 6: "3/5", 8: "4/5", 10: "1 whole" }[numerator] ?? null;
}

function bandFor(index) {
  return ["intro", "developing", "expected", "secure", "stretch", "retrieval"][index % 6];
}

function difficultyFor(band) {
  return { intro: 2, developing: 3, expected: 5, secure: 6, stretch: 7, retrieval: 5 }[band];
}

function numberWord(value) {
  return ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][value];
}

function ordinal(value) {
  return ["zeroth", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"][value];
}

function rotate(items, amount) {
  const offset = amount % items.length;
  return items.slice(offset).concat(items.slice(0, offset));
}

function capitalise(value) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function normalise(value) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function summary(variants, key) {
  const counts = new Map();
  for (const variant of variants) counts.set(key(variant), (counts.get(key(variant)) ?? 0) + 1);
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([name, count]) => `${name}:${count}`).join(",");
}

function summaryCoverage(variants) {
  const counts = new Map();
  for (const variant of variants) {
    for (const tag of variant.body.coverage_tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([tag, count]) => `${tag}:${count}`).join(",");
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function relative(file) {
  return path.relative(repoRoot, file).replaceAll("\\", "/");
}
