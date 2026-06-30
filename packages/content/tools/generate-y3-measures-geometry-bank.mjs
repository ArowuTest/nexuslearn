#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packPath = path.resolve(argValue("--pack") ?? path.join(repoRoot, "packages/content/packs/ma-y3-measures-and-geometry.pack.sample.json"));
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y3-measures-geometry-bank-";
const reviewBatch = "y3-measures-geometry-pilot-a";
const reviewDays = [1, 3, 7, 14, 30];
const allocation = {
  "choose-estimate-measure-compare": 44,
  "boundary-and-perimeter-reasoning": 44,
  "clock-reading-and-duration": 44,
  "turn-angle-and-line-properties": 44,
  "measure-geometry-spaced-retrieval": 44,
};

const measureObjects = [
  measure("pencil", "length", 16, "cm", [10, 25], "ruler"), measure("button thickness", "length", 4, "mm", [1, 10], "millimetre scale"),
  measure("classroom doorway height", "length", 2, "m", [1, 3], "metre stick"), measure("exercise book width", "length", 21, "cm", [15, 30], "ruler"),
  measure("paper clip length", "length", 32, "mm", [20, 50], "millimetre ruler"), measure("playground path", "length", 35, "m", [10, 80], "trundle wheel"),
  measure("apple", "mass", 180, "g", [100, 300], "balance scale"), measure("bag of flour", "mass", 1, "kg", [1, 2], "kilogram scale"),
  measure("school bag", "mass", 3, "kg", [1, 8], "kilogram scale"), measure("eraser", "mass", 24, "g", [10, 50], "gram scale"),
  measure("water bottle contents", "capacity", 500, "ml", [250, 1000], "measuring jug"), measure("large watering can", "capacity", 5, "l", [2, 10], "litre container"),
  measure("medicine spoon for a pretend measuring task", "capacity", 5, "ml", [1, 20], "millilitre spoon"), measure("bucket", "capacity", 8, "l", [4, 15], "litre container"),
];

const shape2D = [
  shape("equilateral triangle", 3, 3, 0, "three equal sides and three corners"), shape("right-angled triangle", 3, 3, 1, "three sides and one right angle"),
  shape("square", 4, 4, 4, "four equal sides and four right angles"), shape("rectangle", 4, 4, 4, "opposite sides equal and four right angles"),
  shape("pentagon", 5, 5, null, "five straight sides and five vertices"), shape("hexagon", 6, 6, null, "six straight sides and six vertices"),
];
const shape3D = [
  solid("cube", 6, 12, 8, "six square faces"), solid("cuboid", 6, 12, 8, "six rectangular faces, with squares possible"),
  solid("triangular prism", 5, 9, 6, "two triangular faces and three rectangular faces"), solid("square-based pyramid", 5, 8, 5, "one square base and four triangular faces"),
];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y3-measures-and-geometry") throw new Error("This generator only supports the Year 3 measures-and-geometry pack.");
const curated = (pack.question_variants ?? []).filter((v) => !v.id.startsWith(prefix));
const curatedSnapshot = JSON.stringify(curated);
const curatedCounts = countBy(curated, (v) => v.body?.variant_blueprint_id);
const targets = Object.fromEntries(Object.entries(allocation).map(([id, total]) => [id, total - (curatedCounts[id] ?? 0)]));
for (const [id, count] of Object.entries(targets)) if (count < 0) throw new Error(`Curated variants exceed allocation for ${id}.`);

const generated = [
  ...measureCandidates(targets["choose-estimate-measure-compare"]),
  ...perimeterCandidates(targets["boundary-and-perimeter-reasoning"]),
  ...timeCandidates(targets["clock-reading-and-duration"]),
  ...angleCandidates(targets["turn-angle-and-line-properties"]),
  ...retrievalCandidates(targets["measure-geometry-spaced-retrieval"]),
];
pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Review-stage Year 3 measures-and-geometry pack with a deterministic 220-variant pilot bank. Four curated variants are unchanged. Generated tasks cover estimating, choosing units, reading scales, comparing and calculating length/mass/capacity, taught integer unit relationships, perimeter of simple shapes, 12/24-hour time and durations, 2-D/3-D properties, right angles and turns, horizontal/vertical and parallel/perpendicular lines, misconceptions and spaced transfer. Money remains intentionally outside this pack, matching its source note and separate number-and-money practice. Every generated task offers aligned ruler/scale/jug/clock/shape manipulatives, concrete and non-visual tables, reduced-load SEND/dyscalculia routes, alternative inputs, rich feedback and pressure-free missions without timers, streaks, lives or loss. Selected narrated contexts reference ElevenLabs assets held for human listening review; browser TTS is prohibited. Independent mathematics, accessibility, narration and renderer review remains required before promotion.";

validateBank(pack, curated, curatedSnapshot, generated);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y3-measures-geometry-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y3-measures-geometry-bank blueprints=${summary(pack.question_variants, (v) => v.body.variant_blueprint_id)}`);
console.log(`y3-measures-geometry-bank formats=${summary(pack.question_variants, (v) => v.format)}`);
console.log(`y3-measures-geometry-bank concepts=${summary(generated, (v) => v.body.concept_focus)}`);
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y3-measures-geometry-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 3 measures/geometry bank is out of date; run generate-y3-measures-geometry-bank.mjs --write.");
  console.log("y3-measures-geometry-bank deterministic check passed");
} else console.log("y3-measures-geometry-bank dry-run; pass --write to update the pack");

function measureCandidates(count) {
  const modes = ["unit_choice", "estimate_then_measure", "scale_reading", "compare_measures", "add_measures", "subtract_measures", "integer_conversion", "misconception_repair"];
  return Array.from({ length: count }, (_, i) => {
    const item = measureObjects[i % measureObjects.length], mode = modes[i % modes.length], unitSet = unitsFor(item.quantity);
    if (mode === "unit_choice") {
      return maths({ id: `unit-${slug(item.object)}-${i + 1}`, format: "measure-and-compare", blueprint: "choose-estimate-measure-compare", band: "intro", concept: mode,
        prompt: `Survey-tool mission ${i + 1}: choose a sensible unit and instrument for ${item.object}.`, body: { object: item.object, quantity: item.quantity, unit_choices: unitSet, instrument_choices: instrumentsFor(item.quantity), expected_instrument: item.instrument, benchmark_range: item.range }, answer: { unit: item.unit, instrument: item.instrument },
        hints: [`First identify the quantity: ${item.quantity}.`, `Compare ${item.object} with a known ${item.unit} benchmark.`], explanation: `${item.unit} and a ${item.instrument} suit the ${item.quantity} of ${item.object}; a plausible value is around ${item.value} ${item.unit}.`, correct: "Quantity, unit and instrument matched sensibly.", repair: "Name the quantity first, compare the object with one visible unit benchmark and remove instruments for other quantities.", tag: "unit_chosen_by_number", hook: "benchmark-unit-compare" });
    }
    if (mode === "estimate_then_measure") {
      return maths({ id: `estimate-${slug(item.object)}-${i + 1}`, format: "measure-and-compare", blueprint: "choose-estimate-measure-compare", band: "developing", concept: mode,
        prompt: `Estimate-check mission ${i + 1}: choose a sensible range for ${item.object}, then reveal the measurement.`, body: { object: item.object, quantity: item.quantity, unit: item.unit, estimate_ranges: [item.range, [0, Math.max(1, item.range[0] - 1)], [item.range[1] * 3, item.range[1] * 5]], measured_value: item.value, instrument: item.instrument, estimate_not_exact_score: true }, answer: item.range,
        hints: ["An estimate is a sensible range, not a hurried exact answer.", `Use a familiar ${item.unit} benchmark.`], explanation: `${item.range[0]}–${item.range[1]} ${item.unit} is a sensible range; ${item.value} ${item.unit} falls inside it.`, correct: "Estimate checked against a measured value.", repair: "Show one benchmark unit beside the object, choose between two ranges and then compare the revealed measure.", tag: "estimate_treated_as_exact", hook: "estimate-do-check" });
    }
    if (mode === "scale_reading") {
      const interval = item.value >= 100 ? 50 : item.value >= 20 ? 2 : 1, start = Math.max(0, item.value - interval * 3), end = item.value + interval * 2;
      return maths({ id: `scale-${slug(item.object)}-${i + 1}`, format: "measure-and-compare", blueprint: "choose-estimate-measure-compare", band: "expected", concept: mode,
        prompt: `Scale-reader mission ${i + 1}: read the marked ${item.quantity} of ${item.object}.`, body: { object: item.object, quantity: item.quantity, unit: item.unit, scale_start: start, scale_end: end, interval, marked_value: item.value, aligned_zero_or_labelled_start: true, choices: numberChoices(item.value, interval) }, answer: item.value,
        hints: [`Each small interval represents ${interval} ${item.unit}.`, "Begin at the labelled start and count equal intervals."], explanation: `The marker aligns with ${item.value}, so the measure is ${item.value} ${item.unit}.`, correct: "Marked scale read using interval size and unit.", repair: "Enlarge the scale, label two neighbouring ticks and count intervals rather than lines from the start.", tag: "scale_ticks_counted_as_values", hook: "enlarged-scale-reader" });
    }
    if (mode === "integer_conversion") {
      const conversion = conversionFor(item.quantity, i), answer = conversion.answer;
      return maths({ id: `convert-${item.quantity}-${i + 1}`, format: "measure-and-compare", blueprint: "choose-estimate-measure-compare", band: "expected", concept: mode,
        prompt: `Unit-link mission ${i + 1}: complete ${conversion.prompt}.`, body: { quantity: item.quantity, from_unit: conversion.from, to_unit: conversion.to, relationship: conversion.relationship, group_model: conversion.groups, choices: conversion.choices }, answer,
        hints: [`Use ${conversion.relationship}.`, "Change the number and unit together so the quantity stays equal."], explanation: `${conversion.prompt} ${conversion.explanation}`, correct: "Equivalent integer measures linked using unit structure.", repair: "Build one larger unit from equal smaller-unit groups, then count groups rather than moving a decimal point by rule.", tag: "unit_number_changed_without_relationship", hook: "unit-group-link" });
    }
    const same = comparablePair(item.quantity, i), operation = mode === "subtract_measures" ? "−" : mode === "add_measures" ? "+" : "compare";
    const answer = operation === "−" ? Math.abs(same[0] - same[1]) : operation === "+" ? same[0] + same[1] : same[0] > same[1] ? ">" : same[0] < same[1] ? "<" : "=";
    return maths({ id: `${mode}-${item.quantity}-${same[0]}-${same[1]}-${i + 1}`, format: "measure-and-compare", blueprint: "choose-estimate-measure-compare", band: "expected", concept: mode,
      prompt: operation === "compare" ? `Measure-compare mission ${i + 1}: compare ${same[0]} ${item.unit} and ${same[1]} ${item.unit}.` : `Measure-calculation mission ${i + 1}: find ${same[0]} ${item.unit} ${operation} ${same[1]} ${item.unit}.`,
      body: { quantity: item.quantity, values: same, unit: item.unit, operation, choices: operation === "compare" ? [">", "<", "="] : numberChoices(answer, Math.max(1, Math.round(answer / 5))), same_unit_confirmed: true, strip_or_scale_model: true }, answer,
      hints: ["Check that both values use the same quantity and unit.", operation === "compare" ? "Compare the numbers only after checking units." : "Keep the unit with the result."], explanation: operation === "compare" ? `${same[0]} ${item.unit} ${answer} ${same[1]} ${item.unit}.` : `${same[0]} ${operation} ${same[1]} = ${answer} ${item.unit}.`, correct: "Measures compared or calculated with quantity and unit preserved.", repair: "Align both values on the same labelled strip or scale, then calculate and attach the linear/mass/capacity unit.", tag: "numbers_compared_without_units", hook: "measure-strip-calculate" });
  });
}

function perimeterCandidates(count) {
  const modes = ["rectangle_perimeter", "labelled_triangle", "grid_boundary", "missing_side", "compare_perimeters", "perimeter_expression", "area_confusion_repair"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length], unit = i % 2 ? "cm" : "m";
    if (mode === "rectangle_perimeter") {
      const l = 3 + (i % 9), w = 2 + ((i * 3) % 6), answer = 2 * (l + w);
      return perimeter({ id: `rectangle-${l}-${w}-${i + 1}`, concept: mode, prompt: `Boundary-route mission ${i + 1}: find the perimeter of a ${l} ${unit} by ${w} ${unit} rectangle.`, sides: [l, w, l, w], unit, answer,
        body: { shape: "rectangle", length: l, width: w, equivalent_expressions: [`${l} + ${w} + ${l} + ${w}`, `2 × (${l} + ${w})`] }, explanation: `${l} + ${w} + ${l} + ${w} = ${answer} ${unit}; all four outside sides are included once.`, tag: "perimeter_partial_or_area" });
    }
    if (mode === "labelled_triangle") {
      const sides = [3 + (i % 5), 4 + (i % 4), 5 + (i % 3)], answer = sides.reduce((a, b) => a + b, 0);
      return perimeter({ id: `triangle-${sides.join("-")}-${i + 1}`, concept: mode, prompt: `Triangle-trail mission ${i + 1}: add every labelled outside side.`, sides, unit, answer,
        body: { shape: "triangle", vertices_not_length: true }, explanation: `${sides.join(" + ")} = ${answer} ${unit}. Three vertices are not three units; perimeter adds side lengths.`, tag: "corners_counted_as_perimeter" });
    }
    if (mode === "grid_boundary") {
      const widths = [3 + (i % 4), 2 + (i % 3)], heights = [2 + (i % 3), 1 + (i % 2)], sides = [widths[0], heights[0], widths[0] - widths[1], heights[1], widths[1], heights[0] + heights[1]], answer = sides.reduce((a, b) => a + b, 0);
      return perimeter({ id: `grid-${i + 1}`, concept: mode, prompt: `Grid-boundary mission ${i + 1}: trace the rectilinear shape and total its outside unit lengths.`, sides, unit: "cm", answer,
        body: { shape: "rectilinear grid shape", square_grid_interval: 1, inside_squares_not_counted: true }, explanation: `The outside route has side lengths ${sides.join(", ")}; their total is ${answer} cm. Interior squares measure area, not perimeter.`, tag: "perimeter_partial_or_area" });
    }
    if (mode === "missing_side") {
      const known = [4 + (i % 6), 3 + (i % 5), 5 + (i % 4)], missing = 2 + (i % 6), total = known.reduce((a, b) => a + b, missing);
      return perimeter({ id: `missing-${total}-${missing}-${i + 1}`, concept: mode, prompt: `Missing-side mission ${i + 1}: a four-sided shape has perimeter ${total} ${unit}. Three sides are ${known.join(", ")} ${unit}. Find the fourth side.`, sides: [...known, null], unit, answer: missing,
        body: { given_perimeter: total, known_sides: known, inverse_check: `${total} − (${known.join(" + ")}) = ${missing}` }, explanation: `The known sides total ${known.reduce((a, b) => a + b, 0)} ${unit}; ${total} − ${known.reduce((a, b) => a + b, 0)} = ${missing} ${unit}.`, tag: "perimeter_total_used_as_side" });
    }
    if (mode === "compare_perimeters") {
      const a = [4 + (i % 5), 3 + (i % 4)], b = [5 + (i % 4), 2 + (i % 3)], pa = 2 * (a[0] + a[1]), pb = 2 * (b[0] + b[1]), answer = pa === pb ? "equal perimeters" : pa > pb ? "shape A" : "shape B";
      return perimeter({ id: `compare-${i + 1}`, concept: mode, prompt: `Perimeter-compare mission ${i + 1}: which rectangle has the greater perimeter?`, sides: [a[0], a[1], a[0], a[1]], unit, answer,
        body: { shape_a: { dimensions: a, perimeter: pa }, shape_b: { dimensions: b, perimeter: pb }, choices: ["shape A", "shape B", "equal perimeters"] }, explanation: `Shape A: ${pa} ${unit}. Shape B: ${pb} ${unit}. Therefore the result is ${answer}.`, tag: "largest_area_assumed_largest_perimeter" });
    }
    if (mode === "area_confusion_repair") {
      const answer = "Trace and add every outside side once, then use a length unit.";
      return perimeter({ id: `repair-${i + 1}`, concept: mode, prompt: `Perimeter-repair mission ${i + 1}: which rule fixes counting inside squares or corners?`, sides: [6, 4, 6, 4], unit: "cm", answer,
        body: { choices: [answer, "Count the squares inside and write square centimetres.", "Count only the corners."], boundary_trace_required: true }, explanation: `Perimeter is the total boundary length. It uses cm or m, not square units.`, tag: "perimeter_partial_or_area" });
    }
    const sides = [5 + (i % 6), 3 + (i % 4), 5 + (i % 6), 3 + (i % 4)], answer = sides.reduce((a, b) => a + b, 0), expression = sides.join(" + ");
    return perimeter({ id: `expression-${i + 1}`, concept: mode, prompt: `Boundary-expression mission ${i + 1}: choose the calculation that includes every outside side once.`, sides, unit, answer,
      body: { choices: [expression, `${sides[0]} + ${sides[1]}`, `${sides[0]} × ${sides[1]} square ${unit}`], correct_expression: expression }, explanation: `${expression} = ${answer} ${unit}.`, tag: "perimeter_partial_or_area" });
  });
}

function perimeter({ id, concept, prompt, sides, unit, answer, body, explanation, tag }) {
  return maths({ id, format: "perimeter-builder", blueprint: "boundary-and-perimeter-reasoning", band: concept.includes("repair") || concept.includes("compare") ? "secure" : "developing", concept, prompt,
    body: { side_lengths: sides, unit, trace_start_marker: true, complete_closed_boundary: true, ...body }, answer,
    hints: ["Mark one starting corner and trace all the way around.", "Add each outside side once and include a length unit."], explanation, correct: `Complete boundary accounted for. ${explanation}`, repair: "Keep correctly marked sides, number the uncounted boundary segments and close the route back at the start before adding.", tag, hook: "perimeter-route-close" });
}

function timeCandidates(count) {
  const modes = ["read_analogue", "twelve_to_twenty_four", "twenty_four_to_twelve", "finish_time", "start_time", "duration", "compare_durations", "misconception_repair"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length], hour = 8 + (i % 10), minute = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55][i % 12], start = toMinutes(hour, minute);
    if (mode === "read_analogue") {
      const answer = format12(hour, minute), clockHour = hour > 12 ? hour - 12 : hour;
      return timeTask({ id: `read-${hour}-${minute}-${i + 1}`, concept: mode, prompt: `Clock-reader mission ${i + 1}: read the analogue clock.`, answer,
        body: { analogue_clock: { hour_hand_between: minute ? [clockHour, (clockHour % 12) + 1] : [clockHour, clockHour], minute_hand_value: minute }, choices: timeChoices(start), separate_hour_minute_reading: true }, explanation: `The minute hand shows ${minute} minutes and the hour hand is ${minute ? "past " : "on "}${clockHour}; the time is ${answer}.`, tag: "minute_hand_read_as_hour" });
    }
    if (mode === "twelve_to_twenty_four" || mode === "twenty_four_to_twelve") {
      const afternoonHour = 13 + (i % 9), value = toMinutes(afternoonHour, minute), answer = mode === "twelve_to_twenty_four" ? format24(afternoonHour, minute) : format12(afternoonHour, minute, true);
      const source = mode === "twelve_to_twenty_four" ? format12(afternoonHour, minute, true) : format24(afternoonHour, minute);
      return timeTask({ id: `${mode}-${afternoonHour}-${minute}-${i + 1}`, concept: mode, prompt: `Time-notation mission ${i + 1}: convert ${source}.`, answer,
        body: { source_time: source, context: "afternoon (not noon or midnight)", choices: mode === "twelve_to_twenty_four" ? [answer, format24(afternoonHour - 12, minute), `${afternoonHour}:${minute + 12}`] : [answer, format12(afternoonHour - 12, minute), `${afternoonHour}:${pad(minute)} pm`], linked_clock_minutes: value }, explanation: `${source} and ${answer} name the same afternoon time.`, tag: "twelve_twenty_four_hour_confusion" });
    }
    if (mode === "misconception_repair") {
      const duration = 35 + (i % 4) * 10, finish = start + duration, wrong = `${hour}:${minute + duration}`;
      const answer = "Use a timeline, bridge through the next hour and keep minutes below 60.";
      return timeTask({ id: `repair-${hour}-${minute}-${i + 1}`, concept: mode, prompt: `Timeline-repair mission ${i + 1}: a helper writes ${wrong} for ${format24(hour, minute)} plus ${duration} minutes. Which repair works?`, answer,
        body: { start_time: format24(hour, minute), duration_minutes: duration, shown_error: wrong, correct_finish: format24m(finish), choices: [answer, "Keep adding to the minute digits beyond 59.", "Treat every clock number as five hours."], bridge_to_hour: 60 - minute }, explanation: `${format24(hour, minute)} plus ${duration} minutes is ${format24m(finish)}; clock minutes regroup after 60.`, tag: "clock_digits_subtracted" });
    }
    const duration = 20 + (i % 7) * 10, finish = start + duration;
    if (mode === "finish_time") return timeTask({ id: `finish-${start}-${duration}-${i + 1}`, concept: mode, prompt: `Expedition-time mission ${i + 1}: start at ${format24m(start)} and add ${duration} minutes.`, answer: format24m(finish),
      body: { start_time: format24m(start), duration_minutes: duration, suggested_jumps: timeJumps(start, duration), choices: timeChoices(finish), inverse_check: `count back ${duration} minutes` }, explanation: `${timeJumpExplanation(start, duration)} The finish is ${format24m(finish)}.`, tag: "clock_digits_subtracted", audioScript: i % 3 === 0 ? `The expedition starts at ${format12m(start)} and lasts ${duration} minutes. When does it finish?` : undefined });
    if (mode === "start_time") return timeTask({ id: `start-${finish}-${duration}-${i + 1}`, concept: mode, prompt: `Backward-timeline mission ${i + 1}: an event finishes at ${format24m(finish)} after ${duration} minutes. When did it start?`, answer: format24m(start),
      body: { finish_time: format24m(finish), duration_minutes: duration, backward_jumps: timeJumpsBack(finish, duration), choices: timeChoices(start), inverse_check: `${format24m(start)} + ${duration} minutes = ${format24m(finish)}` }, explanation: `Counting back ${duration} minutes from ${format24m(finish)} reaches ${format24m(start)}.`, tag: "finish_used_as_start" });
    if (mode === "compare_durations") {
      const other = duration + (i % 2 ? 15 : -10), answer = duration > other ? "event A" : duration < other ? "event B" : "equal";
      return timeTask({ id: `compare-${duration}-${other}-${i + 1}`, concept: mode, prompt: `Duration-compare mission ${i + 1}: event A lasts ${duration} minutes; event B lasts ${other} minutes. Which is longer?`, answer,
        body: { durations: [duration, other], choices: ["event A", "event B", "equal"], aligned_timeline_bars: true }, explanation: `${duration} minutes ${duration > other ? ">" : duration < other ? "<" : "="} ${other} minutes, so ${answer} is the result.`, tag: "clock_time_confused_with_duration" });
    }
    return timeTask({ id: `duration-${start}-${finish}-${i + 1}`, concept: mode, prompt: `Elapsed-time mission ${i + 1}: how long is it from ${format24m(start)} to ${format24m(finish)}?`, answer: duration,
      body: { start_time: format24m(start), finish_time: format24m(finish), timeline_jumps: timeJumps(start, duration), choices: numberChoices(duration, 10), unit: "minutes" }, explanation: `${timeJumpExplanation(start, duration)} The duration is ${duration} minutes.`, tag: "clock_digits_subtracted" });
  });
}

function timeTask({ id, concept, prompt, answer, body, explanation, tag, audioScript }) {
  return maths({ id, format: "time-line", blueprint: "clock-reading-and-duration", band: concept.includes("read") ? "developing" : "expected", concept, prompt, body, answer,
    hints: ["Read the hour and minute information separately.", "Use a timeline and bridge through an hour rather than treating time as ordinary base-ten digits."], explanation, correct: `Clock or timeline evidence agrees. ${explanation}`, repair: "Keep the start/finish marker, split the jump at the next hour and count the total elapsed minutes before checking notation.", tag, hook: "timeline-bridge-hour", audioScript });
}

function angleCandidates(count) {
  const modes = ["turn_fraction", "right_angle_rotated", "compare_to_right_angle", "horizontal_vertical", "parallel_lines", "perpendicular_lines", "shape_angle_property", "misconception_repair"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length], turns = ["quarter", "half", "three-quarter", "full"], turn = turns[i % turns.length];
    if (mode === "turn_fraction") {
      const answer = ({ quarter: 1, half: 2, "three-quarter": 3, full: 4 })[turn];
      return geometry({ id: `turn-${turn}-${i + 1}`, concept: mode, prompt: `Route-turn mission ${i + 1}: how many right angles are in a ${turn} turn?`, answer,
        body: { turn_fraction: turn, start_direction: ["north", "east", "south", "west"][i % 4], choices: [1, 2, 3, 4], quarter_turn_units: answer }, explanation: `A ${turn} turn contains ${answer} right-angle quarter turn${answer === 1 ? "" : "s"}.`, tag: "turn_fraction_confusion" });
    }
    if (mode === "right_angle_rotated") {
      return geometry({ id: `right-rotated-${i + 1}`, concept: mode, prompt: `Rotated-corner mission ${i + 1}: classify the square corner after it turns.`, answer: "right angle",
        body: { checker_rotation_degrees: [45, 90, 135, 225][i % 4], choices: ["right angle", "less than a right angle", "greater than a right angle"], square_corner_checker: true }, explanation: `Rotation changes orientation but not angle size. The square-corner checker still fits, so it is a right angle.`, tag: "right_angle_orientation" });
    }
    if (mode === "compare_to_right_angle") {
      const kind = ["less than a right angle", "right angle", "greater than a right angle"][i % 3];
      return geometry({ id: `compare-angle-${i + 1}`, concept: mode, prompt: `Angle-comparator mission ${i + 1}: compare the marked corner with a right-angle checker.`, answer: kind,
        body: { marked_angle_kind: kind, choices: ["less than a right angle", "right angle", "greater than a right angle"], orientation_randomised: true, checker_available: true }, explanation: `The checker shows that this angle is ${kind}. Orientation and side length do not decide angle size.`, tag: "sharp_corner_called_right_angle" });
    }
    if (mode === "horizontal_vertical") {
      const answer = i % 2 ? "vertical" : "horizontal";
      return geometry({ id: `orientation-${answer}-${i + 1}`, concept: mode, prompt: `Line-direction mission ${i + 1}: classify the highlighted straight line relative to the page and ground reference.`, answer,
        body: { line_orientation: answer, choices: ["horizontal", "vertical", "parallel", "perpendicular"], ground_reference_visible: true, linearised_description: answer === "horizontal" ? "runs left to right, level with the ground reference" : "runs up and down, at right angles to the ground reference" }, explanation: `${answer} describes the line's direction. Parallel and perpendicular compare pairs of lines instead.`, tag: "orientation_and_relationship_mixed" });
    }
    if (mode === "parallel_lines" || mode === "perpendicular_lines") {
      const answer = mode === "parallel_lines" ? "parallel" : "perpendicular";
      return geometry({ id: `${answer}-${i + 1}`, concept: mode, prompt: `Line-relationship mission ${i + 1}: classify the pair using its defining property.`, answer,
        body: { line_pair: answer === "parallel" ? "straight lines keep the same gap and do not meet" : "straight lines meet at a right angle", choices: ["parallel", "perpendicular", "neither"], right_angle_marker: answer === "perpendicular", equal_gap_markers: answer === "parallel" }, explanation: answer === "parallel" ? "Parallel lines stay the same distance apart and do not meet." : "Perpendicular lines meet at a right angle.", tag: "parallel_perpendicular_confusion" });
    }
    if (mode === "shape_angle_property") {
      const shapeItem = shape2D[i % shape2D.length], answer = shapeItem.rightAngles == null ? `${shapeItem.name} is identified by ${shapeItem.property}; right angles must be checked from the specific drawing.` : `${shapeItem.name} has ${shapeItem.rightAngles} right angle${shapeItem.rightAngles === 1 ? "" : "s"} in this stated form.`;
      return geometry({ id: `shape-angle-${slug(shapeItem.name)}-${i + 1}`, concept: mode, prompt: `Shape-property mission ${i + 1}: choose the accurate angle statement for a ${shapeItem.name}.`, answer,
        body: { shape: shapeItem.name, sides: shapeItem.sides, vertices: shapeItem.vertices, stated_right_angles: shapeItem.rightAngles, choices: [answer, "Every corner in every shape is a right angle.", "Turning the drawing changes its properties."] }, explanation: `${shapeItem.name}: ${shapeItem.property}.`, tag: "shape_orientation_changes_property" });
    }
    const answer = "Use a rotatable square-corner checker; parallel lines keep the same gap, while perpendicular lines meet at a right angle.";
    return geometry({ id: `geometry-repair-${i + 1}`, concept: mode, prompt: `Geometry-repair mission ${i + 1}: which rule fixes orientation and line-language errors?`, answer,
      body: { choices: [answer, "A right angle must point upright and parallel lines must meet.", "Any sharp-looking corner is a right angle."], checker_and_line_tests: true }, explanation: answer, tag: "right_angle_orientation" });
  });
}

function geometry({ id, concept, prompt, answer, body, explanation, tag }) {
  return maths({ id, format: "angle-line-sort", blueprint: "turn-angle-and-line-properties", band: "secure", concept, prompt, body, answer,
    hints: ["Use the defining property, not the drawing's orientation or colour.", "Rotate a square-corner checker or test whether line gaps stay equal."], explanation, correct: `Geometric property identified from its definition. ${explanation}`, repair: "Switch to a static checker or linearised description, preserve correct labels and compare one defining property at a time.", tag, hook: "right-angle-checker-rotate" });
}

function retrievalCandidates(count) {
  const modes = ["shape_2d_properties", "shape_3d_properties", "build_shape_from_properties", "mixed_measure_transfer", "perimeter_retrieval", "time_retrieval", "line_angle_retrieval", "misconception_transfer"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length], day = reviewDays[i % reviewDays.length];
    if (mode === "shape_2d_properties") {
      const item = shape2D[i % shape2D.length];
      return retrieve({ id: `2d-${slug(item.name)}-${i + 1}`, concept: mode, prompt: `2-D property mission ${i + 1}: choose the shape matching the stated properties.`, answer: item.name,
        body: { property_card: item.property, sides: item.sides, vertices: item.vertices, right_angles: item.rightAngles, choices: [item.name, shape2D[(i + 2) % shape2D.length].name, shape2D[(i + 4) % shape2D.length].name], orientation_randomised: true, review_interval_days: day }, explanation: `${item.name} matches: ${item.property}.`, tag: "shape_named_by_orientation" });
    }
    if (mode === "shape_3d_properties") {
      const item = shape3D[i % shape3D.length];
      return retrieve({ id: `3d-${slug(item.name)}-${i + 1}`, concept: mode, prompt: `3-D property mission ${i + 1}: identify the solid from faces, edges and vertices.`, answer: item.name,
        body: { faces: item.faces, edges: item.edges, vertices: item.vertices, face_description: item.property, choices: [item.name, shape3D[(i + 1) % shape3D.length].name, shape3D[(i + 2) % shape3D.length].name], build_with_faces_available: true, review_interval_days: day }, explanation: `${item.name} has ${item.faces} faces, ${item.edges} edges and ${item.vertices} vertices; ${item.property}.`, tag: "faces_edges_vertices_mixed" });
    }
    if (mode === "build_shape_from_properties") {
      const item = i % 2 ? shape2D[i % shape2D.length] : shape3D[i % shape3D.length];
      const answer = item.name;
      return retrieve({ id: `build-${slug(item.name)}-${i + 1}`, concept: mode, prompt: `Shape-studio mission ${i + 1}: choose or build the shape satisfying the property card.`, answer,
        body: { target: item.name, property_card: item.property, side_or_face_tiles: item.faces ? { faces: item.faces, edges: item.edges, vertices: item.vertices } : { sides: item.sides, vertices: item.vertices, right_angles: item.rightAngles }, choices: [item.name, "a shape with different stated properties"], construction_not_drawing_precision: true, review_interval_days: day }, explanation: `${item.name} satisfies the stated properties: ${item.property}.`, tag: "appearance_over_properties" });
    }
    if (mode === "mixed_measure_transfer") {
      const item = measureObjects[i % measureObjects.length], answer = `${item.value} ${item.unit}`;
      return retrieve({ id: `measure-${slug(item.object)}-${i + 1}`, concept: mode, prompt: `Measure-return mission ${i + 1}: select the sensible checked measure for ${item.object}.`, answer,
        body: { object: item.object, quantity: item.quantity, instrument: item.instrument, choices: [answer, `${item.value} ${wrongUnit(item.quantity)}`, `${item.value * 10} ${item.unit}`], benchmark_range: item.range, review_interval_days: day }, explanation: `${answer} is plausible and uses the correct unit for ${item.quantity}; the ${item.instrument} provides the check.`, tag: "unit_chosen_by_number" });
    }
    if (mode === "perimeter_retrieval") {
      const l = 4 + (i % 6), w = 2 + (i % 5), answer = 2 * (l + w);
      return retrieve({ id: `perimeter-${l}-${w}-${i + 1}`, concept: mode, prompt: `Boundary-return mission ${i + 1}: find the perimeter of a ${l} cm by ${w} cm rectangle.`, answer,
        body: { side_lengths: [l, w, l, w], unit: "cm", choices: numberChoices(answer, 4), complete_boundary_trace: true, review_interval_days: day }, explanation: `${l} + ${w} + ${l} + ${w} = ${answer} cm.`, tag: "perimeter_partial_or_area" });
    }
    if (mode === "time_retrieval") {
      const start = toMinutes(13 + (i % 5), [10, 20, 35, 45][i % 4]), duration = 25 + (i % 4) * 10, finish = start + duration, answer = format24m(finish);
      return retrieve({ id: `time-${start}-${duration}-${i + 1}`, concept: mode, prompt: `Timeline-return mission ${i + 1}: ${format24m(start)} plus ${duration} minutes finishes when?`, answer,
        body: { start_time: format24m(start), duration_minutes: duration, timeline_jumps: timeJumps(start, duration), choices: timeChoices(finish), review_interval_days: day }, explanation: `${timeJumpExplanation(start, duration)} Finish: ${answer}.`, tag: "clock_digits_subtracted", audioScript: i % 2 === 0 ? `The start time is ${format12m(start)}. The event lasts ${duration} minutes. When does it finish?` : undefined });
    }
    if (mode === "line_angle_retrieval") {
      const answer = i % 2 ? "perpendicular" : "parallel";
      return retrieve({ id: `line-${answer}-${i + 1}`, concept: mode, prompt: `Property-return mission ${i + 1}: classify the described line pair.`, answer,
        body: { description: answer === "parallel" ? "two straight lines keep the same distance apart" : "two straight lines meet at a right angle", choices: ["parallel", "perpendicular", "horizontal"], review_interval_days: day }, explanation: answer === "parallel" ? "Parallel lines maintain the same gap and do not meet." : "Perpendicular lines meet at a right angle.", tag: "parallel_perpendicular_confusion" });
    }
    const answer = "Name the quantity or property first, choose its matching tool or definition, then estimate or test before calculating.";
    return retrieve({ id: `repair-${i + 1}`, concept: mode, prompt: `Surveyor-toolkit mission ${i + 1}: which routine prevents unit, perimeter, time and geometry guesses?`, answer,
      body: { choices: [answer, "Choose the largest number and fastest answer.", "Use the same instrument and rule for every task."], review_interval_days: day }, explanation: answer, tag: "mixed_measure_geometry_guess" });
  });
}

function retrieve({ id, concept, prompt, answer, body, explanation, tag, audioScript }) {
  return maths({ id, format: "shape-property-build", blueprint: "measure-geometry-spaced-retrieval", band: "retrieval", concept, prompt, body, answer,
    hints: ["Name the quantity or property before choosing a method.", "Use a benchmark, complete trace, timeline or defining-property check."], explanation, correct: `Spaced measure/geometry evidence retained. ${explanation}`, repair: "Return to one concrete or linearised representation, keep correct intermediate evidence and retry without speed scoring.", tag, hook: "evidence-card-pin", audioScript });
}

function maths({ id, format, blueprint, band, concept, prompt, body, answer, hints, explanation, correct, repair, tag, hook, audioScript }) {
  const audio = audioScript ? { audio_required: true, narration_script: audioScript, audio_asset_id: `narration-${prefix}${id}`, audio_provider: "ElevenLabs", audio_asset_status: "required_human_listening_review", human_listening_approval_required: true, browser_tts_allowed: false, browser_tts_fallback: "prohibited", audio_replay_unlimited: true, unavailable_audio_state: "honest_not_ready_keep_visual_numeric_and_adult_read_route" } : { audio_required: false, audio_route: "not_needed_for_this_instrument_scale_shape_or_symbol_task" };
  return {
    id: `${prefix}${id}`, format,
    body: {
      prompt, ...body, ...audio, concept_focus: concept,
      interaction_mode: "measure_build_select_step_tap_keyboard_switch_eye_gaze_aac_or_adult_scribed",
      supported_interaction: "An adult or peer may read, scan, set the learner's named tool value or record an indicated explanation without supplying the measure or property.",
      ruler_scale_route: "Enlarged labelled major/minor ticks, snap-to-zero, numeric entry and a linear tick table replace precise dragging.",
      mass_capacity_route: "Balance masses and measuring-jug marks have object, numeric and non-visual table alternatives.",
      clock_timeline_route: "Hour and minute values are separate; static timelines accept typed or selected jumps and show morning/afternoon context.",
      shape_property_route: "Rotatable checker, face/edge/vertex cards and linearised side/line descriptions avoid orientation and visual-only demands.",
      dyscalculia_support: { quantity_before_number: true, unit_benchmarks: true, estimate_do_check_strip: true, one_interval_or_step_at_a_time: true, unit_kept_with_value: true, concrete_and_symbolic_link: true },
      visual_route: "One active instrument or property panel, high-contrast labelled ticks, large values, generous spacing and no colour-only meaning.",
      processing_route: "Reveal estimate, measure/describe and check stages separately; preserve correct sides, jumps and property labels.",
      motor_alternative: "Tap, numeric entry, keyboard, switch scan, eye gaze, AAC, pointing or adult-scribed values can replace dragging, rotating, speech and handwriting.",
      low_visual_load: true, reduced_motion: "static_before_after_frames_instant_hands_and_numbered_routes", preserve_correct_work: true, undo_available: true,
      no_timer: true, speed_score_allowed: false, microphone_required: false, handwriting_required: false, retry_without_penalty: true,
      gamification: { mission: "prepare one calm expedition survey decision", reward: "one evidence pin for a checked measure, route, time or property", lives: false, streaks: false, loss_on_error: false, leaderboard: false, speed_bonus: false, retry_message: "Your correct measurements and checks stay. Choose another tool or clue and continue." },
      money_scope: "not_in_this_pack_use_separate_number_and_money_practice",
      difficulty_band: band, evidence_purpose: concept, variant_blueprint_id: blueprint, review_batch: reviewBatch,
    },
    expected_answer: { value: answer }, hints, explanation,
    feedback: { correct, repair, mathematical_evidence: explanation, strategy_message: "Estimating, measuring, numeric entry, tracing, timeline jumps, pointing, eye gaze, AAC and adult-scribed explanations are equally valid; speed and drawing precision are not scored." },
    difficulty: band === "intro" ? 3 : band === "developing" ? 4 : band === "expected" ? 5 : band === "secure" ? 6 : 5,
    status: "review", misconception_tag: tag, animation_hook: hook,
  };
}

function validateBank(currentPack, curated, snapshot, generated) {
  if (curated.length !== 4) throw new Error(`Expected 4 curated variants, found ${curated.length}.`);
  if (JSON.stringify(curated) !== snapshot) throw new Error("Curated variants changed during generation.");
  if (currentPack.question_variants.length !== 220 || generated.length !== 216) throw new Error("Pilot must contain 4 curated and 216 generated variants.");
  const ids = currentPack.question_variants.map((v) => v.id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate variant IDs found.");
  const counts = countBy(currentPack.question_variants, (v) => v.body.variant_blueprint_id);
  for (const [id, total] of Object.entries(allocation)) if (counts[id] !== total) throw new Error(`${id} expected ${total}, found ${counts[id] ?? 0}.`);
  const concepts = new Set(generated.map((v) => v.body.concept_focus));
  for (const c of ["unit_choice", "estimate_then_measure", "scale_reading", "compare_measures", "add_measures", "subtract_measures", "integer_conversion", "rectangle_perimeter", "labelled_triangle", "grid_boundary", "missing_side", "compare_perimeters", "read_analogue", "twelve_to_twenty_four", "twenty_four_to_twelve", "finish_time", "start_time", "duration", "compare_durations", "turn_fraction", "right_angle_rotated", "compare_to_right_angle", "horizontal_vertical", "parallel_lines", "perpendicular_lines", "shape_2d_properties", "shape_3d_properties", "build_shape_from_properties"]) if (!concepts.has(c)) throw new Error(`Missing concept ${c}.`);
  for (const v of generated) {
    const b = v.body;
    if (!b.dyscalculia_support?.quantity_before_number || !b.ruler_scale_route || !b.mass_capacity_route || !b.clock_timeline_route || !b.shape_property_route || !b.motor_alternative || !b.low_visual_load) throw new Error(`Missing SEND/dyscalculia route in ${v.id}.`);
    if (!v.feedback?.correct || !v.feedback?.repair || !v.feedback?.mathematical_evidence) throw new Error(`Missing rich feedback in ${v.id}.`);
    if (!b.no_timer || b.speed_score_allowed || b.gamification?.lives || b.gamification?.streaks || b.gamification?.loss_on_error) throw new Error(`Pressure mechanic in ${v.id}.`);
    if (b.money_scope !== "not_in_this_pack_use_separate_number_and_money_practice") throw new Error(`Money scope missing in ${v.id}.`);
    if (b.audio_required) {
      if (b.audio_provider !== "ElevenLabs" || b.audio_asset_status !== "required_human_listening_review" || !b.human_listening_approval_required || b.browser_tts_allowed !== false || b.browser_tts_fallback !== "prohibited") throw new Error(`Audio policy failure in ${v.id}.`);
    } else if (b.audio_asset_id || b.audio_provider) throw new Error(`Unnecessary audio reference in ${v.id}.`);
  }
}

function measure(object, quantity, value, unit, range, instrument) { return { object, quantity, value, unit, range, instrument }; }
function shape(name, sides, vertices, rightAngles, property) { return { name, sides, vertices, rightAngles, property }; }
function solid(name, faces, edges, vertices, property) { return { name, faces, edges, vertices, property }; }
function unitsFor(quantity) { return quantity === "length" ? ["mm", "cm", "m"] : quantity === "mass" ? ["g", "kg", "ml"] : ["ml", "l", "g"]; }
function instrumentsFor(quantity) { return quantity === "length" ? ["ruler", "metre stick", "trundle wheel", "measuring jug"] : quantity === "mass" ? ["balance scale", "ruler", "clock"] : ["measuring jug", "litre container", "ruler"]; }
function comparablePair(quantity, i) { const base = quantity === "capacity" ? 100 + (i % 5) * 100 : quantity === "mass" ? 50 + (i % 6) * 25 : 10 + (i % 8) * 5; return [base, Math.max(1, base + (i % 2 ? 20 : -5))]; }
function conversionFor(quantity, i) { if (quantity === "length") { const cases = [{ prompt: "3 cm = __ mm", answer: 30, from: "cm", to: "mm", relationship: "1 cm = 10 mm", groups: 3, choices: [30, 3, 300], explanation: "Three groups of 10 mm make 30 mm." }, { prompt: "2 m = __ cm", answer: 200, from: "m", to: "cm", relationship: "1 m = 100 cm", groups: 2, choices: [200, 20, 2000], explanation: "Two groups of 100 cm make 200 cm." }]; return cases[i % 2]; } if (quantity === "mass") return { prompt: "2 kg = __ g", answer: 2000, from: "kg", to: "g", relationship: "1 kg = 1000 g", groups: 2, choices: [2000, 200, 20], explanation: "Two groups of 1000 g make 2000 g." }; return { prompt: "3 l = __ ml", answer: 3000, from: "l", to: "ml", relationship: "1 l = 1000 ml", groups: 3, choices: [3000, 300, 30], explanation: "Three groups of 1000 ml make 3000 ml." }; }
function numberChoices(n, step = 1) { return [...new Set([n, Math.max(0, n - step), n + step, n + 2 * step])]; }
function wrongUnit(quantity) { return quantity === "length" ? "kg" : quantity === "mass" ? "ml" : "cm"; }
function toMinutes(hour, minute) { return hour * 60 + minute; }
function pad(n) { return String(n).padStart(2, "0"); }
function format24(hour, minute) { return `${pad(hour)}:${pad(minute)}`; }
function format24m(minutes) { const day = 24 * 60, m = ((minutes % day) + day) % day; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; }
function format12(hour, minute, pm = false) { const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour; return `${h}:${pad(minute)}${pm || hour >= 12 ? " pm" : " am"}`; }
function format12m(minutes) { const m = ((minutes % 1440) + 1440) % 1440, h = Math.floor(m / 60); return format12(h, m % 60, h >= 12); }
function timeChoices(minutes) { return [...new Set([format24m(minutes), format24m(minutes - 10), format24m(minutes + 10), format24m(minutes + 60)])]; }
function timeJumps(start, duration) { const toHour = (60 - (start % 60)) % 60; if (!toHour || toHour >= duration) return [duration]; return [toHour, duration - toHour]; }
function timeJumpsBack(finish, duration) { const fromHour = finish % 60; if (!fromHour || fromHour >= duration) return [-duration]; return [-fromHour, -(duration - fromHour)]; }
function timeJumpExplanation(start, duration) { const jumps = timeJumps(start, duration), positions = [format24m(start)]; let current = start; for (const jump of jumps) { current += jump; positions.push(format24m(current)); } return `${positions.join(" → ")} uses jumps of ${jumps.join(" and ")} minutes.`; }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function slug(text) { return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function countBy(items, fn) { const out = {}; for (const item of items) { const key = fn(item); out[key] = (out[key] ?? 0) + 1; } return out; }
function summary(items, fn) { return Object.entries(countBy(items, fn)).sort(([a], [b]) => String(a).localeCompare(String(b))).map(([k, v]) => `${k}:${v}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
