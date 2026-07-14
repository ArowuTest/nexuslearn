#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/ma-y2-measures.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const generatedPrefix = "ma-y2-measures-bank-";
const reviewBatch = "y2-measures-pilot-a";
const pilotAllocation = {
  "tool-unit-choice-and-estimate": 55,
  "read-clear-standard-scales": 55,
  "compare-order-and-record-measures": 49,
  "money-values-and-combinations": 49,
  "time-to-five-minutes-and-intervals": 52,
};

if (write && check) throw new Error("Choose either --write or --check, not both.");

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y2-measures") {
  throw new Error("This generator only supports the Year 2 measures pack.");
}

const beforeVariants = structuredClone(pack.question_variants ?? []);
const beforeCore = coreSnapshot(beforeVariants);
const beforeBlueprints = sortedCounts(beforeVariants, (variant) => variant.body?.variant_blueprint_id);
const beforeMissingFeedback = countMissingFeedback(beforeVariants);
const beforeMissingRoute = countMissingRoute(beforeVariants);
const authored = beforeVariants.filter((variant) => !variant.id.startsWith(generatedPrefix)).map(enrichVariant);
const authoredByBlueprint = countBy(authored, (variant) => variant.body?.variant_blueprint_id);
const generatedTargets = Object.fromEntries(
  Object.entries(pilotAllocation).map(([blueprint, total]) => [blueprint, total - (authoredByBlueprint[blueprint] ?? 0)]),
);
for (const [blueprint, count] of Object.entries(generatedTargets)) {
  if (count < 0) throw new Error(`Authored items exceed the pilot allocation for ${blueprint}.`);
}

const candidates = [
  ...toolUnitCandidates(generatedTargets["tool-unit-choice-and-estimate"]),
  ...scaleReadCandidates(generatedTargets["read-clear-standard-scales"]),
  ...compareCandidates(generatedTargets["compare-order-and-record-measures"]),
  ...moneyCandidates(generatedTargets["money-values-and-combinations"]),
  ...timeCandidates(
    generatedTargets["time-to-five-minutes-and-intervals"],
    new Set(authored.filter((variant) => variant.format === "clock-face-build").map((variant) => variant.expected_answer?.digital_time)),
  ),
].map(enrichVariant);

pack.question_variants = [...authored, ...candidates];
pack.version = "0.3.0";
pack.qa.notes = "Quality-hardened deterministic 260-item Year 2 measurement pilot. IDs, answers, five curated cores, blueprint allocation, representations, arithmetic and curriculum scope remain unchanged. Every variant now has concept-specific correct feedback, misconception repair, mathematical evidence and strategy support, plus explicit touch, keyboard, switch, eye-gaze, AAC/adult-supported and no-drag response routes. Speech and handwriting are optional, retry is pressure-free, and dyscalculia supports preserve units, benchmarks, scale intervals, running totals and static clock/text equivalents. Variant narration remains selectively absent; any future narration must use produced, human-reviewed ElevenLabs assets and browser TTS is prohibited. Independent mathematics, SEND, renderer and classroom review remain required before promotion.";

validateBank(pack, authored, candidates);
validateHardening(pack.question_variants, beforeCore, beforeBlueprints);
const afterMissingFeedback = countMissingFeedback(pack.question_variants);
const afterMissingRoute = countMissingRoute(pack.question_variants);

console.log(`y2-measures-bank authored=${authored.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`y2-measures-bank blueprints=${summary(pack.question_variants, (variant) => variant.body?.variant_blueprint_id)}`);
console.log(`y2-measures-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
const bandByBlueprint = Object.fromEntries(pack.variant_blueprints.map((blueprint) => [blueprint.id, blueprint.difficulty_band]));
console.log(`y2-measures-bank bands=${summary(pack.question_variants, (variant) => bandByBlueprint[variant.body?.variant_blueprint_id])}`);
console.log(`y2-measures-bank missing_feedback before=${beforeMissingFeedback} after=${afterMissingFeedback}`);
console.log(`y2-measures-bank missing_route before=${beforeMissingRoute} after=${afterMissingRoute}`);

const nextText = `${JSON.stringify(pack, null, 2)}\n`;
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y2-measures-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) {
    throw new Error("Year 2 measures bank is out of date; run generate-y2-measures-bank.mjs --write.");
  }
  console.log("y2-measures-bank deterministic check passed");
} else {
  console.log("y2-measures-bank dry-run; pass --write to update the pack");
}

function toolUnitCandidates(count) {
  const tasks = [
    task("pencil", "the length of a pencil", "ruler", "centimetres", "15 cm"),
    task("book", "the width of a reading book", "ruler", "centimetres", "20 cm"),
    task("ribbon", "the length of a craft ribbon", "ruler", "centimetres", "50 cm"),
    task("door", "the height of a classroom door", "metre stick", "metres", "2 m"),
    task("room", "the length of a classroom", "trundle wheel", "metres", "8 m"),
    task("playground", "the width of a playground", "trundle wheel", "metres", "20 m"),
    task("apple", "the mass of an apple", "balance scales", "grams", "150 g"),
    task("toy-car", "the mass of a toy car", "balance scales", "grams", "200 g"),
    task("flour-bag", "the mass of a bag of flour", "balance scales", "kilograms", "1 kg"),
    task("school-bag", "the mass of a packed school bag", "balance scales", "kilograms", "3 kg"),
    task("cup", "the capacity of a cup", "measuring jug", "millilitres", "250 ml"),
    task("small-bottle", "the capacity of a small water bottle", "measuring jug", "millilitres", "500 ml"),
    task("large-jug", "the capacity of a large jug", "measuring jug", "litres", "2 l"),
    task("bucket", "the capacity of a bucket", "measuring jug", "litres", "5 l"),
    task("classroom-temperature", "the temperature of a classroom", "thermometer", "degrees Celsius", "20 degrees Celsius"),
    task("cool-day", "the outdoor temperature on a cool day", "thermometer", "degrees Celsius", "10 degrees Celsius"),
    task("warm-water", "the temperature of warm water", "thermometer", "degrees Celsius", "30 degrees Celsius"),
    task("icy-water", "the temperature of icy water", "thermometer", "degrees Celsius", "0 degrees Celsius"),
  ];
  const openings = ["Help Nixi", "Help Pip", "At the measure station, help Bo"];
  return Array.from({ length: count }, (_, index) => {
    const item = tasks[index % tasks.length];
    const toolChoices = rotate(toolChoicesFor(item.tool), index % 3);
    const unitChoices = rotate(unitChoicesFor(item.unit), (index + 1) % 3);
    const estimateChoices = rotate(estimateChoicesFor(item.estimate), (index + 2) % 3);
    return {
      id: `${generatedPrefix}tool-${item.id}-${Math.floor(index / tasks.length) + 1}`,
      format: "measure-tool-select",
      body: {
        prompt: `${openings[Math.floor(index / tasks.length)]} choose a tool, unit and sensible estimate for ${item.job}.`,
        measuring_job: item.job,
        tool_choices: toolChoices,
        unit_choices: unitChoices,
        estimate_choices: estimateChoices,
        response_mode: "tap_keyboard_switch_or_oral",
        no_timer: true,
        difficulty_band: "intro",
        evidence_purpose: "tool_unit_and_estimate_choice",
        variant_blueprint_id: "tool-unit-choice-and-estimate",
        review_batch: reviewBatch,
      },
      expected_answer: { tool: item.tool, unit: item.unit, estimate: item.estimate },
      hints: ["Name what is being measured first.", "Match the job to a tool, then choose a unit that fits its size."],
      explanation: `${sentenceStart(item.tool)} measures ${item.job.replace(/^the /, "")}; ${item.unit} and ${item.estimate} are sensible choices.`,
      difficulty: 2 + (index % 2),
      status: "review",
      misconception_tag: "unsuitable_unit_or_tool",
      animation_hook: "tool-unit-match-snap",
    };
  });
}

function scaleReadCandidates(count) {
  const scaleTypes = [
    { id: "ruler", tool: "ruler", start: 0, interval: 1, unit: "cm", firstIndex: 4 },
    { id: "balance", tool: "balance scale", start: 0, interval: 50, unit: "g", firstIndex: 2 },
    { id: "jug", tool: "measuring jug", start: 0, interval: 50, unit: "ml", firstIndex: 1 },
    { id: "thermometer", tool: "thermometer", start: -10, interval: 2, unit: "degrees Celsius", firstIndex: 2 },
  ];
  const usedPerType = new Map();
  return Array.from({ length: count }, (_, index) => {
    const spec = scaleTypes[index % scaleTypes.length];
    const sequence = usedPerType.get(spec.id) ?? 0;
    usedPerType.set(spec.id, sequence + 1);
    const pointerIndex = spec.firstIndex + sequence;
    const value = spec.start + spec.interval * pointerIndex;
    const choices = rotate([
      measureLabel(value, spec.unit),
      measureLabel(value - spec.interval, spec.unit),
      measureLabel(value + spec.interval, spec.unit),
    ], index % 3);
    return {
      id: `${generatedPrefix}scale-${spec.id}-${sequence + 1}`,
      format: "scale-read",
      body: {
        prompt: `Read the marked ${spec.tool}. Choose the value and its unit.`,
        scale: {
          tool: spec.tool,
          labelled_start: spec.start,
          interval_size: spec.interval,
          pointer_interval_index: pointerIndex,
          unit: spec.unit,
          magnification_available: true,
        },
        choices,
        response_mode: "tap_keyboard_switch_or_oral",
        static_scale_available: true,
        difficulty_band: "developing",
        evidence_purpose: "zero_start_and_interval_reading",
        variant_blueprint_id: "read-clear-standard-scales",
        review_batch: reviewBatch,
      },
      expected_answer: { value, unit: spec.unit },
      hints: ["Find the labelled start before counting.", `Each space changes by ${measureLabel(spec.interval, spec.unit)}.`],
      explanation: `Starting at ${measureLabel(spec.start, spec.unit)} and counting ${pointerIndex} equal intervals gives ${measureLabel(value, spec.unit)}.`,
      difficulty: 3 + (sequence % 3),
      status: "review",
      misconception_tag: sequence % 2 === 0 ? "counts_ticks_not_intervals" : "wrong_start_point",
      animation_hook: "zero-start-interval-highlight",
    };
  });
}

function compareCandidates(count) {
  const measures = [
    { id: "cm", unit: "cm", base: 12, step: 2 },
    { id: "m", unit: "m", base: 3, step: 1 },
    { id: "g", unit: "g", base: 100, step: 50 },
    { id: "kg", unit: "kg", base: 2, step: 1 },
    { id: "ml", unit: "ml", base: 200, step: 50 },
    { id: "l", unit: "l", base: 1, step: 1 },
    { id: "temperature", unit: "degrees Celsius", base: 4, step: 2 },
    { id: "minutes", unit: "minutes", base: 10, step: 5 },
  ];
  const usedPerUnit = new Map();
  return Array.from({ length: count }, (_, index) => {
    const spec = measures[index % measures.length];
    const sequence = usedPerUnit.get(spec.id) ?? 0;
    usedPerUnit.set(spec.id, sequence + 1);
    const anchor = spec.base + sequence * spec.step * 2;
    const relation = sequence % 3;
    const left = relation === 0 ? anchor : relation === 1 ? anchor - spec.step : anchor + spec.step;
    const right = anchor;
    const symbol = left === right ? "=" : left < right ? "<" : ">";
    return {
      id: `${generatedPrefix}compare-${spec.id}-${sequence + 1}`,
      format: "measure-compare-symbol",
      body: {
        prompt: `Compare ${measureLabel(left, spec.unit)} and ${measureLabel(right, spec.unit)}. Which symbol makes the statement true?`,
        sentence_left: measureLabel(left, spec.unit),
        sentence_right: measureLabel(right, spec.unit),
        left_value: left,
        right_value: right,
        unit: spec.unit,
        choices: rotate([">", "<", "="], index % 3),
        response_mode: "tap_keyboard_switch_or_oral",
        difficulty_band: "expected",
        evidence_purpose: "same_unit_measure_comparison",
        variant_blueprint_id: "compare-order-and-record-measures",
        review_batch: reviewBatch,
      },
      expected_answer: { value: symbol },
      hints: ["Check that both records use the same unit.", "Compare the number values, then say the symbol aloud."],
      explanation: `${measureLabel(left, spec.unit)} ${symbol} ${measureLabel(right, spec.unit)}.`,
      difficulty: 4 + (sequence % 2),
      status: "review",
      misconception_tag: "appearance_over_recorded_measure",
      animation_hook: "comparison-symbol-bridge",
    };
  });
}

function moneyCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const targetPence = 5 + index * 5;
    const exact = coinsFor(targetPence);
    const low = coinsFor(targetPence - (index % 2 === 0 ? 1 : 2));
    const high = coinsFor(targetPence + (index % 2 === 0 ? 2 : 1));
    const choices = rotate([exact, low, high], index % 3);
    return {
      id: `${generatedPrefix}money-${targetPence}p`,
      format: "coin-combination-build",
      body: {
        prompt: `Which coin set makes ${moneyLabel(targetPence)} exactly?`,
        target: moneyLabel(targetPence),
        target_pence: targetPence,
        choices,
        running_total_available: true,
        coin_text_labels: true,
        response_mode: "tap_keyboard_switch_or_coin_builder",
        difficulty_band: "secure",
        evidence_purpose: "coin_value_and_equivalence",
        variant_blueprint_id: "money-values-and-combinations",
        review_batch: reviewBatch,
      },
      expected_answer: { value: exact, total: moneyLabel(targetPence), total_pence: targetPence },
      hints: ["Read each coin value instead of counting the coins.", "Use the running total to check each set."],
      explanation: `${exact.join(" + ")} totals ${moneyLabel(targetPence)} exactly.`,
      difficulty: 5 + (targetPence > 100 ? 1 : 0),
      status: "review",
      misconception_tag: "coin_count_over_value",
      animation_hook: "coin-equivalence-stack",
    };
  });
}

function timeCandidates(count, reservedTimes) {
  const slots = [];
  for (let cursor = 0; slots.length < count; cursor += 1) {
    const slot = (cursor * 37 + 5) % 144;
    const hour = Math.floor(slot / 12) + 1;
    const minute = (slot % 12) * 5;
    if (!reservedTimes.has(digitalTime(hour, minute))) slots.push(slot);
  }
  return slots.map((slot, index) => {
    const hour = Math.floor(slot / 12) + 1;
    const minute = (slot % 12) * 5;
    const correct = clockDescription(hour, minute);
    const wrongMinute = clockDescription(hour, (minute + 5) % 60);
    const wrongHour = clockDescription(nextHour(hour), minute);
    return {
      id: `${generatedPrefix}time-${String(hour).padStart(2, "0")}-${String(minute).padStart(2, "0")}`,
      format: "clock-face-build",
      body: {
        prompt: `Build ${timeWords(hour, minute)} on the clock.`,
        spoken_time: timeWords(hour, minute),
        target_hour: hour,
        target_minute: minute,
        choices: rotate([correct, wrongMinute, wrongHour], index % 3),
        response_mode: "tap_keyboard_switch_or_clock_builder",
        text_equivalent_available: true,
        static_clock_available: true,
        difficulty_band: "retrieval",
        evidence_purpose: "time_to_five_minutes",
        variant_blueprint_id: "time-to-five-minutes-and-intervals",
        review_batch: reviewBatch,
      },
      expected_answer: { value: correct, digital_time: digitalTime(hour, minute) },
      hints: ["Count around the clock in five-minute steps for the long hand.", "Then place the short hand to show the hour it has passed or is moving towards."],
      explanation: `${sentenceStart(timeWords(hour, minute))} is ${digitalTime(hour, minute)}; ${correct}.`,
      difficulty: minute === 15 || minute === 30 || minute === 45 ? 5 : 6,
      status: "review",
      misconception_tag: minute === 15 || minute === 45 ? "quarter_to_quarter_past_confusion" : "hour_minute_hand_confusion",
      animation_hook: minute === 15 || minute === 45 ? "quarter-segment-clock-highlight" : "clock-five-minute-step",
    };
  });
}

function validateBank(currentPack, curated, generated) {
  if (currentPack.question_variants.length !== currentPack.practice.variant_targets.pilot) {
    throw new Error(`Expected ${currentPack.practice.variant_targets.pilot} pilot variants, found ${currentPack.question_variants.length}.`);
  }
  if (curated.length !== 5) throw new Error(`Expected to preserve 5 curated variants, found ${curated.length}.`);
  const blueprints = new Map((currentPack.variant_blueprints ?? []).map((blueprint) => [blueprint.id, blueprint]));
  const ids = new Set();
  const signatures = new Set();
  for (const variant of currentPack.question_variants) {
    if (ids.has(variant.id)) throw new Error(`Duplicate variant id ${variant.id}.`);
    ids.add(variant.id);
    const signature = `${variant.format}|${variant.body?.prompt?.trim().toLowerCase().replace(/\s+/g, " ")}|${JSON.stringify(variant.expected_answer)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`);
    signatures.add(signature);
    const blueprint = blueprints.get(variant.body?.variant_blueprint_id);
    if (!blueprint) throw new Error(`${variant.id} is not linked to an existing blueprint.`);
    if (variant.format !== blueprint.format) throw new Error(`${variant.id} format does not match ${blueprint.id}.`);
  }
  for (const variant of generated) {
    if (variant.status !== "review") throw new Error(`${variant.id} must remain in review.`);
    if (variant.body?.difficulty_band !== blueprints.get(variant.body.variant_blueprint_id)?.difficulty_band) {
      throw new Error(`${variant.id} does not use its blueprint difficulty band.`);
    }
    validateDeterministicAnswer(variant);
    validatePrompt(variant);
  }
  const actualAllocation = countBy(currentPack.question_variants, (variant) => variant.body?.variant_blueprint_id);
  for (const [blueprint, expected] of Object.entries(pilotAllocation)) {
    if (actualAllocation[blueprint] !== expected) {
      throw new Error(`${blueprint} expected ${expected} pilot items, found ${actualAllocation[blueprint] ?? 0}.`);
    }
  }
}

function enrichVariant(variant) {
  const body = variant.body ?? {};
  const builderContract = variant.format === "coin-combination-build"
    ? { kind: "coin_combination", target_key: "target_pence", option_value_type: "coin_set", running_total: true, drag_required: false, response_modes: ["tap", "keyboard", "switch", "eye_gaze", "aac"] }
    : variant.format === "clock-face-build"
      ? { kind: "clock_face", hour_key: "target_hour", minute_key: "target_minute", text_equivalent_key: "digital_time", minute_step: 5, drag_required: false, response_modes: ["tap", "keyboard", "switch", "eye_gaze", "aac"] }
      : null;
  const hasAudioReference = Boolean(body.audio_asset_id || body.audio_asset_ids?.length);
  const audioPolicy = hasAudioReference ? {
    audio_provider: "ElevenLabs",
    audio_production_policy: "produced_and_human_listening_reviewed_assets_only",
    human_listening_approval_required: true,
    browser_tts_allowed: false,
    browser_tts_fallback: "prohibited",
  } : {
    audio_required: false,
    audio_route: "not_required_for_this_visual_numeric_or_symbolic_measurement_task",
    audio_policy: "if_narration_is_added_use_produced_human_reviewed_ElevenLabs_assets_only",
    browser_tts_allowed: false,
    browser_tts_fallback: "prohibited",
  };
  return {
    ...variant,
    ...(variant.format === "measure-tool-select" ? { expected_answer: { ...variant.expected_answer, value: measurementAnswerValue(variant.expected_answer) } } : {}),
    body: {
      ...body,
      ...(builderContract ? { builder_contract: builderContract } : {}),
      ...(variant.format === "measure-tool-select" ? { choices: measurementChoices(variant) } : {}),
      ...audioPolicy,
      interaction_route: {
        touch: touchRoute(variant.format),
        keyboard: "Tab through the representation and choices; use arrow keys or plus/minus controls where offered, then Enter or Space to select and check.",
        switch_scan: "Scan prompt, representation, choices or controls, check and retry in a fixed order; activate one item at a time.",
        eye_gaze: "Use large dwell-select targets with adjustable dwell time and a confirm step for tools, scale values, symbols, coin sets and clock controls.",
        aac_or_adult_supported: "The learner may point, use AAC or direct an adult to select, enter or move the named response without the adult supplying the mathematical decision.",
        drag_required: false,
      },
      accessible_response_route: "Touch, keyboard, switch, eye gaze, pointing/AAC and adult-supported entry provide equivalent mathematical evidence; dragging, speech and handwriting are optional and never scored.",
      representation_access: representationAccess(variant.format),
      dyscalculia_support: {
        quantity_named_before_number: true,
        unit_kept_with_value: true,
        benchmark_or_known_fact_available: true,
        one_decision_or_interval_at_a_time: true,
        visual_and_text_equivalents: true,
        correct_intermediate_work_preserved: true,
      },
      reduced_load_route: "Show one tool/unit/estimate decision, scale interval, comparison, coin running total or clock hand at a time while keeping the unit and correct work visible.",
      no_mandatory_dragging: true,
      no_mandatory_handwriting: true,
      no_mandatory_speech: true,
      microphone_required: false,
      handwriting_required: false,
      retry_without_penalty: true,
      no_timer: true,
      speed_score_allowed: false,
      preserve_correct_work: true,
      undo_available: true,
      pressure_rules: { timer: false, speed_score: false, streaks: false, lives: false, loss_on_error: false, public_ranking: false, retry_cost: false },
    },
    feedback: feedbackFor(variant),
  };
}

function feedbackFor(variant) {
  const evidence = mathematicalEvidence(variant);
  return {
    correct: correctFeedback(variant),
    repair: repairFeedback(variant),
    mathematical_evidence: evidence,
    misconception_support: `${variant.misconception_tag}: ${repairFeedback(variant)}`,
    strategy_support: strategySupport(variant.format),
    support_message: "Concrete, visual, text, touch, keyboard, switch, eye-gaze, AAC and adult-supported routes are equally valid; speed, dragging, speech and handwriting are not scored.",
    retry: "Your correct measure, unit, interval, coin total or clock-hand decision stays. Open one targeted representation and retry without losing progress.",
  };
}

function correctFeedback(variant) {
  const answer = variant.expected_answer;
  if (variant.format === "measure-tool-select") return `You matched the measuring job to ${answer.tool} and ${answer.unit}${answer.estimate ? `, with the sensible estimate ${answer.estimate}` : ""}.`;
  if (variant.format === "scale-read") return `You read the marked scale as ${measureLabel(answer.value, answer.unit)} by using its start and equal intervals.`;
  if (variant.format === "measure-compare-symbol") return `You compared measures in the same unit and chose ${answer.value}, so ${variant.body.sentence_left} ${answer.value} ${variant.body.sentence_right}.`;
  if (variant.format === "coin-combination-build") return `You added coin values—not coin count—and made ${answer.total} exactly with ${answer.value.join(" + ")}.`;
  return `You coordinated the minute and hour hands to show ${answer.digital_time}: ${answer.value}.`;
}

function repairFeedback(variant) {
  const tag = variant.misconception_tag;
  if (tag === "unsuitable_unit_or_tool") return "Name the quantity first—length, mass, capacity or temperature—then match its tool, choose a suitably sized unit and compare the estimate with a familiar benchmark.";
  if (tag === "counts_ticks_not_intervals") return "Find the labelled start and interval size, place a finger/focus marker in each space, and count equal intervals rather than counting every line.";
  if (tag === "wrong_start_point") return "Locate zero or the stated start mark first, then count equal intervals from that point to the pointer; do not treat the edge of the picture as zero.";
  if (tag === "appearance_over_recorded_measure") return "Keep both unit labels visible, compare the recorded numbers in the same unit and then select >, < or =; object or container appearance is not the measure.";
  if (tag === "coin_count_over_value") return "Read each denomination, add a running value total and stop only when it equals the target; more coins do not necessarily mean more money.";
  if (tag === "quarter_to_quarter_past_confusion") return "Mark 15 minutes: minute hand on 3 means quarter past; minute hand on 9 means quarter to the next hour. Then place the hour hand between the correct hours.";
  return "Separate the hands: count the long minute hand in five-minute steps first, then place the short hour hand on, just after, halfway between or nearly at the correct hour.";
}

function mathematicalEvidence(variant) {
  const answer = variant.expected_answer;
  if (variant.format === "measure-tool-select") return `${answer.tool} measures the requested quantity; ${answer.unit} records it appropriately${answer.estimate ? ` and ${answer.estimate} is the selected benchmark-sized estimate` : ""}.`;
  if (variant.format === "scale-read") {
    const scale = variant.body.scale;
    if (Number.isFinite(scale.labelled_start) && Number.isFinite(scale.interval_size) && Number.isFinite(scale.pointer_interval_index)) return `${scale.labelled_start} + ${scale.pointer_interval_index} × ${scale.interval_size} = ${answer.value} ${answer.unit}.`;
    return `The measure runs from ${scale.start_mark} ${scale.unit} to ${scale.end_mark} ${scale.unit}, giving ${answer.value} ${answer.unit}.`;
  }
  if (variant.format === "measure-compare-symbol") return `${variant.body.sentence_left} ${answer.value} ${variant.body.sentence_right}; both records use ${variant.body.unit ?? "the same shown unit"}.`;
  if (variant.format === "coin-combination-build") return `${answer.value.join(" + ")} = ${answer.total}; the denomination sum, not the number of coins, is the evidence.`;
  return `${answer.digital_time} is represented by ${answer.value}; the long hand gives minutes and the short hand shows the hour position.`;
}

function strategySupport(format) {
  return {
    "measure-tool-select": "Use QUANTITY → TOOL → UNIT → BENCHMARK ESTIMATE.",
    "scale-read": "Use START → INTERVAL SIZE → COUNT SPACES → SAY VALUE WITH UNIT.",
    "measure-compare-symbol": "Use SAME UNIT → COMPARE VALUES → READ THE SYMBOL SENTENCE.",
    "coin-combination-build": "Use READ DENOMINATIONS → RUNNING TOTAL → EXACT TARGET CHECK.",
    "clock-face-build": "Use MINUTE HAND IN FIVES → HOUR HAND POSITION → DIGITAL/TEXT CHECK.",
  }[format];
}

function touchRoute(format) {
  return {
    "measure-tool-select": "Tap one tool, one unit and one estimate card, then tap check.",
    "scale-read": "Tap a magnified mark or choose its labelled numeric value; precise pointer dragging is not required.",
    "measure-compare-symbol": "Tap >, < or = beside the two persistent same-unit records.",
    "coin-combination-build": "Tap a prepared coin set or use labelled add/remove steppers and a running total; coin dragging is optional.",
    "clock-face-build": "Tap a prepared clock state or use separate labelled five-minute and hour-hand steppers; hand dragging is optional.",
  }[format];
}

function representationAccess(format) {
  return {
    "measure-tool-select": "Concrete-tool photographs, simple icons and a text table name each quantity, tool, unit and benchmark without colour-only meaning.",
    "scale-read": "A magnified static scale, numbered tick/interval list and typed value alternative preserve start, interval and unit evidence.",
    "measure-compare-symbol": "Recorded values remain visible with symbol words greater than, less than and equal to available beside >, < and =.",
    "coin-combination-build": "UK denominations have large text labels, optional simplified outlines and a running pence total; real-coin handling is not required.",
    "clock-face-build": "Static high-contrast clock, separate hour/minute controls, five-minute number track and full text/digital equivalent avoid analogue-only access.",
  }[format];
}

function validateHardening(variants, beforeCoreSnapshot, beforeBlueprintCounts) {
  if (variants.length !== 260) throw new Error(`Expected 260 variants, found ${variants.length}.`);
  if (new Set(variants.map((variant) => variant.id)).size !== 260) throw new Error("Variant IDs are not unique.");
  if (JSON.stringify(coreSnapshot(variants)) !== JSON.stringify(beforeCoreSnapshot)) throw new Error("Hardening changed variant IDs, answers, arithmetic, representations, curriculum content or ordering.");
  if (JSON.stringify(sortedCounts(variants, (variant) => variant.body?.variant_blueprint_id)) !== JSON.stringify(beforeBlueprintCounts)) throw new Error("Blueprint allocation changed during hardening.");
  if (countMissingFeedback(variants) !== 0) throw new Error("At least one variant still lacks complete feedback.");
  if (countMissingRoute(variants) !== 0) throw new Error("At least one variant still lacks a complete interaction route.");
  for (const variant of variants) {
    const body = variant.body;
    const hasAudioReference = Boolean(body.audio_asset_id || body.audio_asset_ids?.length);
    if (hasAudioReference) {
      if (body.audio_provider !== "ElevenLabs" || body.audio_production_policy !== "produced_and_human_listening_reviewed_assets_only" || !body.human_listening_approval_required || body.browser_tts_allowed !== false || body.browser_tts_fallback !== "prohibited") throw new Error(`Audio policy failed in ${variant.id}.`);
    } else if (body.audio_required !== false || body.audio_provider || body.browser_tts_allowed !== false || body.browser_tts_fallback !== "prohibited") throw new Error(`Selective no-audio policy failed in ${variant.id}.`);
    if (!body.no_timer || body.speed_score_allowed || body.pressure_rules?.streaks || body.pressure_rules?.lives || body.pressure_rules?.loss_on_error) throw new Error(`Pressure mechanic found in ${variant.id}.`);
  }
}

function coreSnapshot(variants) { return variants.map(stripEnrichment); }
function stripEnrichment(variant) {
  const copy = structuredClone(variant); delete copy.feedback;
  if (copy.format === "measure-tool-select") delete copy.body.choices;
  if (copy.format === "measure-tool-select" && copy.expected_answer) delete copy.expected_answer.value;
  for (const key of ["builder_contract", "interaction_route", "accessible_response_route", "representation_access", "dyscalculia_support", "reduced_load_route", "no_mandatory_dragging", "no_mandatory_handwriting", "no_mandatory_speech", "microphone_required", "handwriting_required", "retry_without_penalty", "no_timer", "speed_score_allowed", "preserve_correct_work", "undo_available", "pressure_rules", "audio_required", "audio_route", "audio_policy", "audio_provider", "audio_production_policy", "human_listening_approval_required", "browser_tts_allowed", "browser_tts_fallback"]) delete copy.body[key];
  return copy;
}
function countMissingFeedback(variants) { return variants.filter((variant) => !variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.mathematical_evidence || !variant.feedback?.misconception_support || !variant.feedback?.strategy_support).length; }
function countMissingRoute(variants) { return variants.filter((variant) => { const body = variant.body ?? {}, route = body.interaction_route ?? {}; return !route.touch || !route.keyboard || !route.switch_scan || !route.eye_gaze || !route.aac_or_adult_supported || route.drag_required !== false || body.no_mandatory_dragging !== true || body.no_mandatory_handwriting !== true || body.no_mandatory_speech !== true; }).length; }
function sortedCounts(items, keyFor) { return Object.fromEntries(Object.entries(countBy(items, keyFor)).sort(([left], [right]) => String(left).localeCompare(String(right)))); }

function validateDeterministicAnswer(variant) {
  if (variant.format === "measure-tool-select") {
    const answer = variant.expected_answer;
    for (const key of ["tool_choices", "unit_choices", "estimate_choices"]) {
      if (new Set(variant.body[key]).size !== variant.body[key].length) throw new Error(`${variant.id} repeats a ${key} option.`);
    }
    if (!variant.body.tool_choices.includes(answer.tool) || !variant.body.unit_choices.includes(answer.unit) || !variant.body.estimate_choices.includes(answer.estimate)) {
      throw new Error(`${variant.id} does not offer every expected selection.`);
    }
    if (!variant.body.choices?.includes(measurementAnswerValue(answer))) throw new Error(`${variant.id} omits its structured answer card.`);
  } else if (variant.format === "scale-read") {
    const scale = variant.body.scale;
    const calculated = scale.labelled_start + scale.interval_size * scale.pointer_interval_index;
    if (calculated !== variant.expected_answer.value) throw new Error(`${variant.id} has a non-deterministic scale answer.`);
    if (!variant.body.choices.includes(measureLabel(calculated, scale.unit))) throw new Error(`${variant.id} omits the scale answer choice.`);
  } else if (variant.format === "measure-compare-symbol") {
    const { left_value: left, right_value: right } = variant.body;
    const calculated = left === right ? "=" : left < right ? "<" : ">";
    if (calculated !== variant.expected_answer.value) throw new Error(`${variant.id} has an incorrect comparison answer.`);
  } else if (variant.format === "coin-combination-build") {
    if (variant.body.builder_contract?.kind !== "coin_combination" || variant.body.builder_contract?.target_key !== "target_pence" || variant.body.builder_contract?.running_total !== true) {
      throw new Error(`${variant.id} is missing its coin builder contract.`);
    }
    const totals = variant.body.choices.map(coinTotal);
    if (coinTotal(variant.expected_answer.value) !== variant.body.target_pence) throw new Error(`${variant.id} has an incorrect coin total.`);
    if (totals.filter((total) => total === variant.body.target_pence).length !== 1) throw new Error(`${variant.id} must have exactly one correct coin set.`);
  } else if (variant.format === "clock-face-build") {
    if (variant.body.builder_contract?.kind !== "clock_face" || variant.body.builder_contract?.hour_key !== "target_hour" || variant.body.builder_contract?.minute_key !== "target_minute" || variant.body.builder_contract?.minute_step !== 5) {
      throw new Error(`${variant.id} is missing its clock builder contract.`);
    }
    const calculated = clockDescription(variant.body.target_hour, variant.body.target_minute);
    if (calculated !== variant.expected_answer.value || !variant.body.choices.includes(calculated)) throw new Error(`${variant.id} has an incorrect clock answer.`);
  }
  if (Array.isArray(variant.body.choices)) {
    const keys = variant.body.choices.map((choice) => JSON.stringify(choice));
    if (new Set(keys).size !== keys.length) throw new Error(`${variant.id} repeats an answer choice.`);
  }
}

function validatePrompt(variant) {
  const prompt = variant.body.prompt.toLowerCase();
  if (variant.format === "measure-tool-select") {
    if (prompt.includes(variant.expected_answer.tool.toLowerCase()) || prompt.includes(variant.expected_answer.unit.toLowerCase())) {
      throw new Error(`${variant.id} leaks its tool or unit answer in the prompt.`);
    }
  } else if (variant.format === "scale-read") {
    if (/\bends? at\b|\bshows? \d/.test(prompt)) throw new Error(`${variant.id} leaks its scale answer in the prompt.`);
  } else if (variant.format === "measure-compare-symbol" && [">", "<", "="].some((symbol) => prompt.includes(symbol))) {
    throw new Error(`${variant.id} leaks its comparison symbol in the prompt.`);
  } else if (variant.format === "clock-face-build" && prompt.includes("minute hand")) {
    throw new Error(`${variant.id} leaks its clock-hand answer in the prompt.`);
  }
}

function task(id, job, tool, unit, estimate) {
  return { id, job, tool, unit, estimate };
}

function measurementChoices(variant) {
  const answer = variant.expected_answer ?? {};
  const tools = Array.isArray(variant.body?.tool_choices) ? variant.body.tool_choices.filter((item) => typeof item === "string") : [];
  const units = Array.isArray(variant.body?.unit_choices) ? variant.body.unit_choices.filter((item) => typeof item === "string") : [];
  const estimates = Array.isArray(variant.body?.estimate_choices) ? variant.body.estimate_choices.filter((item) => typeof item === "string") : [];
  if (typeof answer.tool !== "string" || typeof answer.unit !== "string" || tools.length < 2 || units.length < 2) return [];
  const make = (tool, unit, estimate) => [tool, unit, estimate].filter(Boolean).join(" · ");
  const wrongTool = tools.find((item) => item !== answer.tool) ?? answer.tool;
  const wrongUnit = units.find((item) => item !== answer.unit) ?? answer.unit;
  const estimate = typeof answer.estimate === "string" ? answer.estimate : undefined;
  const wrongEstimate = estimates.find((item) => item !== estimate) ?? estimate;
  return Array.from(new Set([make(answer.tool, answer.unit, estimate), make(wrongTool, answer.unit, estimate), make(answer.tool, wrongUnit, wrongEstimate)]));
}

function measurementAnswerValue(answer) {
  return [answer.tool, answer.unit, typeof answer.estimate === "string" ? answer.estimate : undefined].filter(Boolean).join(" · ");
}

function toolChoicesFor(correct) {
  const distractors = {
    ruler: ["thermometer", "measuring jug"],
    "metre stick": ["balance scales", "thermometer"],
    "trundle wheel": ["measuring jug", "balance scales"],
    "balance scales": ["ruler", "thermometer"],
    "measuring jug": ["ruler", "balance scales"],
    thermometer: ["measuring jug", "metre stick"],
  };
  return [correct, ...distractors[correct]];
}

function unitChoicesFor(correct) {
  const distractors = {
    centimetres: ["litres", "degrees Celsius"],
    metres: ["grams", "millilitres"],
    grams: ["centimetres", "litres"],
    kilograms: ["metres", "millilitres"],
    millilitres: ["grams", "degrees Celsius"],
    litres: ["centimetres", "kilograms"],
    "degrees Celsius": ["litres", "metres"],
  };
  return [correct, ...distractors[correct]];
}

function estimateChoicesFor(correct) {
  const number = Number.parseInt(correct, 10);
  const suffix = correct.slice(String(number).length);
  if (number === 0) return [correct, `10${suffix}`, `20${suffix}`];
  if (number === 1) return [correct, `2${suffix}`, `5${suffix}`];
  return [correct, `${Math.max(1, Math.round(number / 2))}${suffix}`, `${number * 2}${suffix}`];
}

function coinsFor(totalPence) {
  const denominations = [200, 100, 50, 20, 10, 5, 2, 1];
  const coins = [];
  let remainder = totalPence;
  for (const denomination of denominations) {
    while (remainder >= denomination) {
      coins.push(coinLabel(denomination));
      remainder -= denomination;
    }
  }
  return coins;
}

function coinTotal(coins) {
  return coins.reduce((total, coin) => total + (coin.startsWith("£") ? Number(coin.slice(1)) * 100 : Number(coin.slice(0, -1))), 0);
}

function coinLabel(pence) {
  return pence >= 100 ? `£${pence / 100}` : `${pence}p`;
}

function moneyLabel(pence) {
  if (pence < 100) return `${pence}p`;
  const pounds = Math.floor(pence / 100);
  const remainder = pence % 100;
  return remainder === 0 ? `£${pounds}` : `£${pounds}.${String(remainder).padStart(2, "0")}`;
}

function clockDescription(hour, minute) {
  const minuteHand = minute === 0 ? 12 : minute / 5;
  let hourHand;
  if (minute === 0) hourHand = `hour hand on ${hour}`;
  else if (minute < 30) hourHand = `hour hand just after ${hour}`;
  else if (minute === 30) hourHand = `hour hand halfway between ${hour} and ${nextHour(hour)}`;
  else hourHand = `hour hand nearly at ${nextHour(hour)}`;
  return `minute hand on ${minuteHand} and ${hourHand}`;
}

function timeWords(hour, minute) {
  if (minute === 0) return `${hour} o'clock`;
  if (minute === 15) return `quarter past ${hour}`;
  if (minute === 30) return `half past ${hour}`;
  if (minute === 45) return `quarter to ${nextHour(hour)}`;
  if (minute < 30) return `${minute} minutes past ${hour}`;
  return `${60 - minute} minutes to ${nextHour(hour)}`;
}

function digitalTime(hour, minute) {
  return `${hour}:${String(minute).padStart(2, "0")}`;
}

function nextHour(hour) {
  return hour === 12 ? 1 : hour + 1;
}

function measureLabel(value, unit) {
  return `${value} ${unit}`;
}

function sentenceStart(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function rotate(items, amount) {
  const offset = amount % items.length;
  return items.slice(offset).concat(items.slice(0, offset));
}

function countBy(items, keyFor) {
  const counts = {};
  for (const item of items) {
    const key = keyFor(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function summary(items, keyFor) {
  return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(",");
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function relative(file) {
  return path.relative(repoRoot, file).replaceAll("\\", "/");
}
