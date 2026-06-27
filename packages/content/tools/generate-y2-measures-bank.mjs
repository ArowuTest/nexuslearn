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

const authored = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(generatedPrefix));
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
];

pack.question_variants = [...authored, ...candidates];
pack.version = "0.2.0";
pack.qa.notes = "Review-stage Year 2 measurement pack with a deterministic 260-item pilot bank apportioned across tool and unit choice, clear scale reading, measure comparison, UK money combinations and time to five minutes. Generated candidates require independent mathematics, SEND, renderer and classroom review before promotion.";

validateBank(pack, authored, candidates);

console.log(`y2-measures-bank authored=${authored.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`y2-measures-bank blueprints=${summary(pack.question_variants, (variant) => variant.body?.variant_blueprint_id)}`);
console.log(`y2-measures-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
const bandByBlueprint = Object.fromEntries(pack.variant_blueprints.map((blueprint) => [blueprint.id, blueprint.difficulty_band]));
console.log(`y2-measures-bank bands=${summary(pack.question_variants, (variant) => bandByBlueprint[variant.body?.variant_blueprint_id])}`);

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

function validateDeterministicAnswer(variant) {
  if (variant.format === "measure-tool-select") {
    const answer = variant.expected_answer;
    for (const key of ["tool_choices", "unit_choices", "estimate_choices"]) {
      if (new Set(variant.body[key]).size !== variant.body[key].length) throw new Error(`${variant.id} repeats a ${key} option.`);
    }
    if (!variant.body.tool_choices.includes(answer.tool) || !variant.body.unit_choices.includes(answer.unit) || !variant.body.estimate_choices.includes(answer.estimate)) {
      throw new Error(`${variant.id} does not offer every expected selection.`);
    }
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
    const totals = variant.body.choices.map(coinTotal);
    if (coinTotal(variant.expected_answer.value) !== variant.body.target_pence) throw new Error(`${variant.id} has an incorrect coin total.`);
    if (totals.filter((total) => total === variant.body.target_pence).length !== 1) throw new Error(`${variant.id} must have exactly one correct coin set.`);
  } else if (variant.format === "clock-face-build") {
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
