#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/ma-y6-statistics.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y6-statistics-bank-";
const pilotTarget = 240;
const reviewBatch = "y6-statistics-pilot-a";

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y6-statistics") throw new Error("This generator only supports the Year 6 statistics pack.");
const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 5) throw new Error(`Expected exactly 5 curated variants, found ${curated.length}.`);
const curatedSnapshot = JSON.stringify(curated.map(removeStatisticsContract));

const contexts = [
  { key: "rain", measure: "rainfall", unit: "mm" },
  { key: "temperature", measure: "temperature", unit: "°C" },
  { key: "water", measure: "water collected", unit: "litres" },
  { key: "visitors", measure: "visitors", unit: "people" },
  { key: "energy", measure: "energy generated", unit: "kWh" },
  { key: "distance", measure: "distance travelled", unit: "km" },
];

const candidates = [
  ...Array.from({ length: 47 }, (_, index) => buildGraph(index)),
  ...Array.from({ length: 47 }, (_, index) => buildPie(index)),
  ...Array.from({ length: 47 }, (_, index) => buildMean(index)),
  ...Array.from({ length: 47 }, (_, index) => buildDetective(index)),
  ...Array.from({ length: 47 }, (_, index) => buildRetrieval(index)),
];

const enrichedCurated = curated.map(enrichVariant);
const enrichedCandidates = candidates.map(enrichVariant);
pack.question_variants = [...enrichedCurated, ...enrichedCandidates];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Year 6 statistics pilot reaches 240 variants with five curated questions preserved semantically unchanged and 235 deterministic review candidates. All five declared interaction formats are used across non-unit line-graph scales, justified and unjustified interpolation, comparison/difference/change problems, exact pie fractions/percentages/angles/totals, means of three to six values, missing-value reasoning, fair-share interpretation, data-claim critique, representation choice and transfer. Generated items provide graph-table/text equivalents, keyboard/no-drag routes, high contrast, reduced-data and static reduced-motion alternatives with pressure-free data-detective missions. Selected graph narration references are produced, human-reviewed ElevenLabs sonified point summaries only; browser TTS is prohibited. Independent mathematics, teacher, SEND, accessibility, safeguarding, audio and renderer review remains required before promotion.";

validateBank(pack, enrichedCurated, enrichedCandidates, curatedSnapshot);
enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`statistics-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`statistics-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`statistics-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`statistics-bank audio_refs=${candidates.filter((variant) => variant.body.audio_asset_id).length}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`statistics-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 6 statistics bank is out of date; run generate-y6-statistics-bank.mjs --write.");
  console.log("statistics-bank deterministic check passed");
} else {
  console.log("statistics-bank dry-run; pass --write to update the pack");
}

function buildGraph(index) {
  const family = index % 7;
  const context = family === 3 ? [contexts[2], contexts[3], contexts[4]][index % 3] : contexts[index % contexts.length];
  const interval = [2, 5, 10, 20, 25][index % 5];
  const base = interval * (2 + Math.floor(index / 7) % 4);
  const values = [base, base + 2 * interval, base + 5 * interval, base + 3 * interval];
  const labels = ["09:00", "10:00", "11:00", "12:00"];
  let prompt;
  let answer;
  let choices;
  let integrity;
  let interpolation = "not_requested";
  if (family === 0) {
    answer = `${values[2]} ${context.unit}`;
    prompt = `Read the value at 11:00.`;
    integrity = { type: "graph_read", values, position: 2, expected: answer };
    choices = unitChoices(values[2], context.unit, interval);
  } else if (family === 1) {
    const result = Math.abs(values[3] - values[0]);
    answer = `${result} ${context.unit}`;
    prompt = `Find the difference between 09:00 and 12:00.`;
    integrity = { type: "graph_difference", values, positions: [0, 3], expected: answer };
    choices = unitChoices(result, context.unit, interval);
  } else if (family === 2) {
    const result = values[2] - values[1];
    answer = `${result} ${context.unit}`;
    prompt = `Calculate the signed change from 10:00 to 11:00.`;
    integrity = { type: "graph_change", values, positions: [1, 2], expected: answer };
    choices = unitChoices(result, context.unit, interval);
  } else if (family === 3) {
    const result = values[0] + values[3];
    answer = `${result} ${context.unit}`;
    prompt = `Find the combined value at 09:00 and 12:00.`;
    integrity = { type: "graph_sum", values, positions: [0, 3], expected: answer };
    choices = unitChoices(result, context.unit, interval);
  } else if (family === 4) {
    const left = base;
    const right = base + 4 * interval;
    const result = base + 2 * interval;
    answer = `${result} ${context.unit}`;
    prompt = `The straight segment from 10:00 (${left} ${context.unit}) to 12:00 (${right} ${context.unit}) is stated to represent steady change. Estimate the value at 11:00.`;
    integrity = { type: "graph_interpolate", left, right, fraction: 0.5, justified: true, expected: answer };
    choices = unitChoices(result, context.unit, interval);
    interpolation = "justified_by_explicit_steady_change_model";
  } else if (family === 5) {
    answer = "Cannot determine the exact value from these data";
    prompt = `Measurements were taken only at 10:00 and 12:00. The joining line is a visual guide, and no steady-change assumption is given. What was the exact value at 11:00?`;
    integrity = { type: "graph_interpolate", left: values[1], right: values[2], justified: false, expected: answer };
    choices = [answer, `${(values[1] + values[2]) / 2} ${context.unit}`, `${values[1]} ${context.unit}`, `${values[2]} ${context.unit}`];
    interpolation = "not_justified_without_measurement_or_model";
  } else {
    const result = (values[2] - values[0]) + Math.abs(values[3] - values[1]);
    answer = `${result} ${context.unit}`;
    prompt = `Add the increase from 09:00 to 11:00 to the absolute difference between 10:00 and 12:00.`;
    integrity = { type: "graph_multistep", values, expected: answer };
    choices = unitChoices(result, context.unit, interval);
  }
  return candidate({ index, family: `graph-${family}`, format: "graph-reader", blueprint: "line-graph-scale-reads", band: family < 2 ? "developing" : family < 5 ? "expected" : "secure", prompt: `Graph trace ${index + 1}: ${prompt}`, choices, answer, hints: [`Read one interval as ${interval} ${context.unit}; do not count spaces as single units.`, family === 5 ? "A joined line does not guarantee an unmeasured exact value unless the context supplies that model." : "Trace each required point to the equivalent table, keep units, then perform the named operation."], explanation: graphExplanation(integrity, context.unit), tag: family === 5 ? "unsupported_interpolation" : "interval_as_one", body: { graph_type: "line_graph", title: context.measure, x_axis_label: "time", y_axis_label: `${context.measure} (${context.unit})`, y_axis_min: 0, y_axis_interval: interval, data_points: labels.map((label, position) => ({ label, value: values[position] })), equivalent_table: true, interpolation_policy: interpolation, integrity }, repair: "Read TITLE / AXES / INTERVAL / UNIT first, trace only the needed points and use the table equivalent; interpolate only when a measurement or explicit model justifies it." });
}

function buildPie(index) {
  const family = index % 8;
  const round = Math.floor(index / 8);
  let prompt;
  let answer;
  let choices;
  let integrity;
  if (family === 0) {
    const denominator = [2, 3, 4, 5, 6, 8][round % 6];
    const numerator = 1 + round % Math.max(1, denominator - 1);
    const total = denominator * (12 + round * 2);
    const result = total * numerator / denominator;
    answer = result;
    prompt = `${numerator}/${denominator} of a total of ${total} responses is one sector. How many responses is that?`;
    choices = numberChoices(result);
    integrity = { type: "pie_fraction_count", numerator, denominator, total, expected: answer };
  } else if (family === 1) {
    const percent = [10, 20, 25, 40, 50, 60, 75][round % 7];
    const total = 200 + round * 100;
    const result = total * percent / 100;
    answer = result;
    prompt = `${percent}% of a pie chart with total ${total} belongs to a category. Find its count.`;
    choices = numberChoices(result);
    integrity = { type: "pie_percent_count", percent, total, expected: answer };
  } else if (family === 2) {
    const angle = [45, 60, 72, 90, 120, 144, 180][round % 7];
    const divisor = 360 / gcd(360, angle);
    const total = divisor * (10 + round);
    const result = total * angle / 360;
    answer = result;
    prompt = `A ${angle}° sector belongs to a pie chart representing ${total} items. Find the sector count.`;
    choices = numberChoices(result);
    integrity = { type: "pie_angle_count", angle, total, expected: answer };
  } else if (family === 3) {
    const known = [20, 35, 15];
    const result = 100 - known.reduce((sum, value) => sum + value, 0);
    answer = `${result}%`;
    prompt = `Three sectors are ${known.join("%, ")}%. What percentage is the missing sector?`;
    choices = percentChoices(result);
    integrity = { type: "pie_missing_percent", known, expected: answer };
  } else if (family === 4) {
    const denominator = [3, 4, 5, 6, 8][round % 5];
    const count = denominator * (7 + round);
    const sectorCount = count / denominator;
    answer = count;
    prompt = `A 1/${denominator} sector represents ${sectorCount} people. What total does the whole pie chart represent?`;
    choices = numberChoices(count);
    integrity = { type: "pie_total_from_fraction", denominator, sectorCount, expected: answer };
  } else if (family === 5) {
    const total = 120 + round * 24;
    const first = total / 2;
    const second = total / 4;
    const result = first - second;
    answer = result;
    prompt = `In a total of ${total}, one sector is 1/2 and another is 1/4. How many more are in the larger sector?`;
    choices = numberChoices(result);
    integrity = { type: "pie_compare", total, fractions: [[1, 2], [1, 4]], expected: answer };
  } else if (family === 6) {
    const denominator = [2, 3, 4, 5, 6, 8, 10][round % 7];
    const numerator = 1 + round % (denominator - 1);
    const result = 360 * numerator / denominator;
    answer = `${result}°`;
    prompt = `Construct a sector for ${numerator}/${denominator} of a pie chart. What central angle is required?`;
    choices = angleChoices(result);
    integrity = { type: "pie_fraction_angle", numerator, denominator, expected: answer };
  } else {
    const known = [90, 120, 60];
    const result = 360 - known.reduce((sum, value) => sum + value, 0);
    answer = `${result}°`;
    prompt = `Three sectors have angles ${known.join("°, ")}°. Find the missing sector angle.`;
    choices = angleChoices(result);
    integrity = { type: "pie_missing_angle", known, expected: answer };
  }
  return candidate({ index, family: `pie-${family}`, format: "pie-chart-builder", blueprint: "pie-chart-fraction-total-links", band: family < 3 ? "expected" : family < 6 ? "secure" : "stretch", prompt: `Pie construction ${index + 1}: ${prompt}`, choices, answer, hints: ["Label the whole as 100% = 360° = the stated total.", "Convert the sector fraction, percentage or angle into the same representation as the question before calculating."], explanation: pieExplanation(integrity), tag: "sector_without_total", body: { whole_percent: 100, whole_angle: 360, integrity, text_sector_table: true, construction_controls: ["fraction", "percentage", "angle", "count"] }, repair: "Use a four-column WHOLE / FRACTION / PERCENT / ANGLE / COUNT table and preserve any correctly linked values before recalculating the missing one." });
}

function buildMean(index) {
  const family = index % 5;
  const count = 3 + index % 4;
  const target = 10 + Math.floor(index / 5) * 3 + index % 3;
  const offsets = { 3: [-2, 0, 2], 4: [-3, -1, 1, 3], 5: [-4, -2, 0, 2, 4], 6: [-5, -3, -1, 1, 3, 5] }[count];
  const values = offsets.map((offset) => target + offset);
  let prompt;
  let answer;
  let choices;
  let integrity;
  if (family === 0) {
    answer = target;
    prompt = `Find the mean of ${values.join(", ")}.`;
    choices = numberChoices(answer);
    integrity = { type: "mean_calculate", values, expected: answer };
  } else if (family === 1) {
    const known = values.slice(0, -1);
    const missing = values.at(-1);
    answer = missing;
    prompt = `The mean of ${count} values is ${target}. The known values are ${known.join(", ")}. Find the missing value.`;
    choices = numberChoices(answer);
    integrity = { type: "mean_missing", known, count, mean: target, expected: answer };
  } else if (family === 2) {
    answer = `${target} is the fair-share value because the total ${target * count} is shared equally among ${count} data points.`;
    prompt = `Which interpretation explains the mean of ${values.join(", ")}?`;
    choices = [answer, `${target} is simply the largest value.`, `${target} is the range between greatest and least.`, `${target * count} is the fair share for each data point.`];
    integrity = { type: "mean_interpret", values, mean: target, expected: answer };
  } else if (family === 3) {
    const second = Array(count).fill(target);
    answer = `Both sets have mean ${target}, but the first set has greater spread.`;
    prompt = `Compare Set A: ${values.join(", ")} and Set B: ${second.join(", ")}.`;
    choices = [answer, "Set A has a greater mean because its values vary.", "Set B has no mean because all values match.", "The means cannot be compared without a pie chart."];
    integrity = { type: "mean_compare_spread", first: values, second, mean: target, expected: answer };
  } else {
    const added = target + 2 * (count + 1);
    const newMean = target + 2;
    answer = newMean;
    prompt = `The values ${values.join(", ")} have mean ${target}. One value, ${added}, is added. Find the new mean.`;
    choices = numberChoices(answer);
    integrity = { type: "mean_add_value", values, added, expected: answer };
  }
  return candidate({ index, family: `mean-${family}`, format: "mean-balancer", blueprint: "mean-fair-share-problems", band: family < 2 ? "expected" : family < 4 ? "secure" : "stretch", prompt: `Mean balance ${index + 1}: ${prompt}`, choices, answer, hints: ["Find or reconstruct the total, then share it equally across the number of values.", family === 1 ? "Required total = mean × number of values; subtract the known values." : "Use labelled stack heights or the equivalent total-and-count table."], explanation: meanExplanation(integrity), tag: family === 2 || family === 3 ? "mean_as_procedure_only" : "mean_total_or_count_error", body: { values, value_count: count, fair_share_model: true, integrity, static_before_after_stacks: true }, repair: "Use no-drag plus/minus stack controls or a static TOTAL ÷ NUMBER OF VALUES table; keep the total and count visible separately." });
}

function buildDetective(index) {
  const family = index % 8;
  const base = 20 + Math.floor(index / 8) * 5;
  const cases = [
    { display: { A: base + 12, B: base + 5 }, claim: `A is 7 greater than B.`, answer: "Supported by the data", reason: `${base + 12} - ${base + 5} = 7.`, key: "difference_supported" },
    { display: { exercise_minutes: [20, 40], test_scores: [62, 71] }, claim: "More exercise caused the higher score.", answer: "Not enough information", reason: "The data show an association for two observations but do not isolate cause.", key: "causation_unsupported" },
    { display: { axis_start: 95, values: [97, 99] }, claim: "The second value is about twice the first because its bar looks twice as tall.", answer: "Refuted by the labelled values", reason: "99 is not twice 97; the truncated axis exaggerates the visual difference.", key: "truncated_axis" },
    { display: { Monday: base, Wednesday: base + 10 }, claim: "Tuesday's exact value was halfway between Monday and Wednesday.", answer: "Not enough information", reason: "No Tuesday measurement or steady-change assumption is supplied.", key: "unsupported_interpolation" },
    { display: { sector: "25%", total: "not stated" }, claim: "Exactly 25 people are in the sector.", answer: "Not enough information", reason: "25% gives a proportion, but a count needs the total.", key: "pie_total_missing" },
    { display: { setA: [0, 10, 20], setB: [10, 10, 10] }, claim: "The two groups have identical data because both means are 10.", answer: "Refuted by the data", reason: "The means match, but Set A varies and Set B does not.", key: "mean_hides_spread" },
    { display: { distance: "12 km", time: "12 minutes" }, claim: "The two values are equal because both are 12.", answer: "Refuted by the units", reason: "The numbers match but measure different quantities and cannot be treated as equal data values.", key: "unit_mismatch" },
    { display: { survey: "20 Year 6 pupils from one class" }, claim: "Every child in England prefers the same option.", answer: "Not enough information", reason: "One small class sample cannot justify a national universal claim.", key: "sample_overclaim" },
  ];
  const item = cases[family];
  const answer = `${item.answer} — ${item.reason}`;
  return candidate({ index, family: `detective-${family}`, format: "data-detective", blueprint: "data-claim-critiques", band: family < 2 ? "expected" : "secure", prompt: `Data-detective case ${index + 1}: Display ${JSON.stringify(item.display)} Claim: “${item.claim}”`, choices: [answer, `Supported — the largest-looking mark proves the claim.`, `Refuted — every data claim is false.`, `Not enough information — labels and values never provide evidence.`], answer, hints: ["Check title, labels, units, scale, total and what was actually measured.", "Classify the claim as supported, refuted or not shown; do not infer causation or missing values without evidence."], explanation: `${answer} The judgement is limited to what the display and context actually record.`, tag: item.key, body: { display: item.display, claim: item.claim, integrity: { type: "detective", key: item.key, expected: answer }, checklist: ["title", "labels", "scale", "units", "context", "total_if_needed"] }, repair: "Use a static TITLE / LABELS / SCALE / UNITS / CONTEXT checklist, highlight the exact evidence and state what additional data would be needed." });
}

function buildRetrieval(index) {
  const family = index % 10;
  const cases = [
    { prompt: "An axis is labelled 0, 20, 40, 60. What is one interval worth?", answer: "20", wrong: ["1", "4", "60"], type: "retrieval_scale", data: { interval: 20 } },
    { prompt: "When is interpolation between two plotted times justified?", answer: "When the context states or supports a suitable between-point model, such as steady change", wrong: ["Whenever points are joined", "Whenever the midpoint looks neat", "When no labels are shown"], type: "retrieval_interpolation" },
    { prompt: "A 90° pie sector is what fraction of the whole?", answer: "1/4", wrong: ["1/2", "1/3", "1/90"], type: "retrieval_pie", data: { angle: 90, fraction: [1, 4] } },
    { prompt: "A pie sector is 30%. What else is needed to find its exact count?", answer: "The total represented by the whole pie chart", wrong: ["Its colour", "A line graph", "The mean only"], type: "retrieval_total" },
    { prompt: "Which equation finds the mean of five values?", answer: "total of the values ÷ 5", wrong: ["largest value ÷ 5", "total × 5", "range ÷ 5"], type: "retrieval_mean" },
    { prompt: "The mean of four values is 12. What is their total?", answer: "48", wrong: ["3", "12", "16"], type: "retrieval_mean_total", data: { count: 4, mean: 12 } },
    { prompt: "Which display best shows change in a continuous measurement over time?", answer: "A line graph with labelled time and measurement axes", wrong: ["An unlabelled pie chart", "A single number", "A decorative picture"], type: "retrieval_representation" },
    { prompt: "Which display best shows how one whole is divided among categories?", answer: "A pie chart with a stated total or proportions", wrong: ["A line graph implying time change", "An unlabelled axis", "A mean with no categories"], type: "retrieval_representation" },
    { prompt: "Two sets have the same mean. What may still differ?", answer: "Their spread and individual values", wrong: ["Their mean", "The definition of total", "The number 360 in every case"], type: "retrieval_spread" },
    { prompt: "Before accepting a graph claim, what should be checked?", answer: "Labels, scale, units, context and the exact data used", wrong: ["Only the steepest line", "Only the brightest sector", "Whether the claim sounds confident"], type: "retrieval_claim" },
  ];
  const item = cases[family];
  return candidate({ index, family: `retrieval-${family}`, format: "multiple_choice", blueprint: "statistics-retrieval", band: index % 5 === 0 ? "retrieval" : "developing", prompt: `Statistics retrieval ${index + 1}: ${item.prompt}`, choices: [item.answer, ...item.wrong], answer: item.answer, hints: ["Identify whether the question is about scale, part-whole, fair share, change or evidence.", "Use the smallest labelled table or equation that preserves the units and context."], explanation: `${item.answer}. This applies the relevant statistics definition or representation rule without relying on visual appearance alone.`, tag: item.type.includes("mean") ? "mean_as_procedure_only" : item.type.includes("pie") || item.type.includes("total") ? "sector_without_total" : "conclusion_without_context", body: { integrity: { type: item.type, ...item.data, expected: item.answer }, reduced_retrieval_display: true }, repair: "Use one compact definition card and one worked representation, then complete a scale / total / mean / evidence sentence stem." });
}

function candidate({ index, family, format, blueprint, band, prompt, choices, answer, hints, explanation, tag, body, repair }) {
  const id = `${prefix}${blueprint}-${String(index + 1).padStart(3, "0")}-${family}`;
  const rotatedChoices = rotate([...new Set(choices)], index % choices.length);
  const fullExplanation = explanation.length >= 95 ? explanation : `${explanation} The labels, units and context remain attached to the result.`;
  const useAudio = ["graph-reader", "data-detective"].includes(format) && index % 10 === 0;
  const audio = useAudio ? { audio_optional: true, audio_asset_id: `sonified-points-${id}`, audio_provider: "ElevenLabs", audio_asset_status: "required_human_listening_review", human_listening_approval_required: true, audio_route: "sonified_point_summary_with_labels_and_units" } : { audio_required: false };
  return {
    id,
    format,
    body: {
      prompt,
      choices: rotatedChoices,
      ...body,
      difficulty_band: band,
      evidence_purpose: `${blueprint}_read_calculate_interpret`,
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
      response_mode: "touch_keyboard_switch_eye_gaze_aac_or_adult_scribed_choice",
      supported_interaction: "Trace points, choose sectors, balance values or judge claims using touch, keyboard, switch scanning, eye-gaze dwell, AAC/pointing or learner-directed adult scribing; typed values, steppers and numbered positions replace dragging and handwriting.",
      interaction_route: { touch: true, keyboard: true, switch_scan: true, eye_gaze: true, aac_or_point: true, adult_scribed: true, drag_required: false, handwriting_required: false, speech_required: false },
      accessibility_support: { text_table_equivalent: true, high_contrast_option: true, reduced_data_mode: true, persistent_labels_units: true, one_operation_at_a_time: true, correct_work_preserved: true },
      colour_independent_markers: true,
      static_reduced_motion_route: true,
      reduced_visual_load: true,
      undo_available: true,
      retry_without_penalty: true,
      timer_allowed: false,
      speed_score_allowed: false,
      streaks_allowed: false,
      lives_allowed: false,
      browser_tts_allowed: false,
      browser_tts_fallback: "prohibited",
      ...audio,
      gamification: { mission: "solve one calm data-observatory case", reward: "a data-detective evidence marker", timer: false, streak: false, lives: false, loss_on_error: false, retry_message: "That reading gives the observatory useful evidence. Keep correct labels and values, open one scale or total clue and retry without losing progress." },
    },
    expected_answer: { value: answer },
    hints,
    explanation: fullExplanation,
    feedback: {
      correct: `The representation and exact data support the accepted response. ${fullExplanation}`,
      repair,
      evidence: `Check title, labels, scale, units, whole total or fair-share equation before calculating. Accepted response: ${answer}.`,
      misconception_check: tag,
      check_prompt: format === "graph-reader" ? "Which labelled points and interval reproduce the result, and is interpolation justified?" : format === "pie-chart-builder" ? "Do fractions total 1, percentages 100% and angles 360°, and does the count use the stated whole?" : format === "mean-balancer" ? "Does total ÷ number of values reproduce the mean, including any missing value?" : "Which exact data support, refute or fail to show the claim?",
      support_message: "Use graph-table, sector-table, fair-share stacks or static claim cards. Touch, keyboard, switch, eye gaze, AAC/pointing and adult scribing are equivalent; no timer, speech, handwriting or drag is required.",
      retry: "Correct labels, points and calculations remain visible. Use one scale, whole or fair-share clue, then retry without penalty.",
    },
    difficulty: { developing: 4, expected: 6, secure: 7, stretch: 8, retrieval: 5 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: format === "graph-reader" ? "graph-point-trace" : format === "pie-chart-builder" ? "pie-sector-to-count" : format === "mean-balancer" ? "mean-stack-balance" : format === "data-detective" ? "data-detective-lens" : "statistics-retrieval-card",
  };
}

function enrichVariant(variant) {
  const body = variant.body ?? {};
  return {
    ...variant,
    body: {
      ...body,
      statistics_reasoning_contract: {
        kind: "statistics_data_reasoning",
        mode: body.variant_blueprint_id ?? "data_read_compare_explain",
        evidence_steps: ["read_scale_and_labels", "select_relevant_data", "calculate_or_compare", "explain_in_context"],
        response_modes: ["touch", "keyboard", "switch", "eye_gaze", "aac", "adult_scribed"],
        drag_required: false,
        timed: false,
        preserve_correct_work: true,
        reduced_visual_load_supported: true,
        uncertainty_and_context_supported: true,
      },
    },
  };
}

function validateStatisticsContract(variant) {
  const contract = variant.body?.statistics_reasoning_contract;
  const requiredResponseModes = ["touch", "keyboard", "switch", "eye_gaze", "aac", "adult_scribed"];
  const requiredSteps = ["read_scale_and_labels", "select_relevant_data", "calculate_or_compare", "explain_in_context"];
  if (!contract || contract.kind !== "statistics_data_reasoning" || !contract.mode || contract.drag_required !== false || contract.timed !== false || contract.preserve_correct_work !== true || contract.reduced_visual_load_supported !== true || contract.uncertainty_and_context_supported !== true || requiredResponseModes.some((mode) => !contract.response_modes?.includes(mode)) || requiredSteps.some((step) => !contract.evidence_steps?.includes(step))) throw new Error(`${variant.id} lacks an accessible statistics reasoning contract.`);
}

function validateBank(currentPack, authored, generated, authoredSnapshot) {
  if (authored.length !== 5 || JSON.stringify(currentPack.question_variants.slice(0, 5).map(removeStatisticsContract)) !== authoredSnapshot) throw new Error("Curated variants changed or moved.");
  if (generated.length !== 235 || currentPack.question_variants.length !== pilotTarget) throw new Error("Expected 235 generated and 240 total variants.");
  const blueprintMap = new Map(currentPack.variant_blueprints.map((item) => [item.id, item]));
  const declaredFormats = new Set(currentPack.practice.formats);
  const ids = new Set();
  const signatures = new Set();
  for (const variant of currentPack.question_variants) {
    if (ids.has(variant.id)) throw new Error(`Duplicate id ${variant.id}.`);
    ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${normalise(variant.expected_answer)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate format/prompt/answer signature ${variant.id}.`);
    signatures.add(signature);
    validateStatisticsContract(variant);
  }
  for (const variant of generated) {
    const blueprint = blueprintMap.get(variant.body.variant_blueprint_id);
    const retrievalException = blueprint?.id === "statistics-retrieval" && variant.format === "multiple_choice";
    if (!blueprint || (!retrievalException && blueprint.format !== variant.format) || !declaredFormats.has(variant.format)) throw new Error(`${variant.id} has invalid format or blueprint.`);
    validateIntegrity(variant);
    if (variant.body.choices.length !== 4 || !variant.body.choices.includes(variant.expected_answer.value)) throw new Error(`${variant.id} has an invalid answer set.`);
    if (!variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.evidence || !variant.feedback?.check_prompt || variant.hints.length < 2 || variant.explanation.length < 90) throw new Error(`${variant.id} lacks rich feedback.`);
    const route = variant.body.interaction_route;
    if (!route?.touch || !route?.keyboard || !route?.switch_scan || !route?.eye_gaze || !route?.aac_or_point || !route?.adult_scribed || route.drag_required !== false || route.handwriting_required !== false || route.speech_required !== false) throw new Error(`${variant.id} lacks accessible routes.`);
    if (!variant.body.accessibility_support?.text_table_equivalent || !variant.body.accessibility_support?.high_contrast_option || !variant.body.accessibility_support?.reduced_data_mode || variant.body.colour_independent_markers !== true || variant.body.static_reduced_motion_route !== true) throw new Error(`${variant.id} lacks accessible representation alternatives.`);
    if (variant.body.timer_allowed !== false || variant.body.speed_score_allowed !== false || variant.body.streaks_allowed !== false || variant.body.lives_allowed !== false || variant.body.gamification?.loss_on_error !== false) throw new Error(`${variant.id} introduces pressure.`);
    if (variant.body.browser_tts_allowed !== false || variant.body.browser_tts_fallback !== "prohibited") throw new Error(`${variant.id} permits browser TTS.`);
    if (variant.body.audio_asset_id && (variant.body.audio_provider !== "ElevenLabs" || variant.body.audio_asset_status !== "required_human_listening_review" || variant.body.human_listening_approval_required !== true || variant.body.audio_route !== "sonified_point_summary_with_labels_and_units" || !["graph-reader", "data-detective"].includes(variant.format))) throw new Error(`${variant.id} has invalid sonification metadata.`);
  }
  for (const format of currentPack.practice.formats) if (!generated.some((variant) => variant.format === format)) throw new Error(`Declared format ${format} is unused.`);
  for (const blueprint of currentPack.variant_blueprints) {
    const count = generated.filter((variant) => variant.body.variant_blueprint_id === blueprint.id).length;
    if (count !== 47) throw new Error(`${blueprint.id} expected 47 generated variants, found ${count}.`);
  }
}

function removeStatisticsContract(variant) {
  const { statistics_reasoning_contract: _statisticsContract, ...body } = variant.body ?? {};
  return { ...variant, body };
}

function validateIntegrity(variant) {
  const i = variant.body.integrity;
  let actual;
  if (i.type === "graph_read") actual = `${i.values[i.position]} ${unitFromAnswer(i.expected)}`;
  else if (i.type === "graph_difference") actual = `${Math.abs(i.values[i.positions[1]] - i.values[i.positions[0]])} ${unitFromAnswer(i.expected)}`;
  else if (i.type === "graph_change") actual = `${i.values[i.positions[1]] - i.values[i.positions[0]]} ${unitFromAnswer(i.expected)}`;
  else if (i.type === "graph_sum") actual = `${i.values[i.positions[0]] + i.values[i.positions[1]]} ${unitFromAnswer(i.expected)}`;
  else if (i.type === "graph_multistep") actual = `${(i.values[2] - i.values[0]) + Math.abs(i.values[3] - i.values[1])} ${unitFromAnswer(i.expected)}`;
  else if (i.type === "graph_interpolate") actual = i.justified ? `${i.left + (i.right - i.left) * i.fraction} ${unitFromAnswer(i.expected)}` : "Cannot determine the exact value from these data";
  else if (i.type === "pie_fraction_count") actual = i.total * i.numerator / i.denominator;
  else if (i.type === "pie_percent_count") actual = i.total * i.percent / 100;
  else if (i.type === "pie_angle_count") actual = i.total * i.angle / 360;
  else if (i.type === "pie_missing_percent") actual = `${100 - i.known.reduce((sum, value) => sum + value, 0)}%`;
  else if (i.type === "pie_total_from_fraction") actual = i.sectorCount * i.denominator;
  else if (i.type === "pie_compare") actual = i.total * i.fractions[0][0] / i.fractions[0][1] - i.total * i.fractions[1][0] / i.fractions[1][1];
  else if (i.type === "pie_fraction_angle") actual = `${360 * i.numerator / i.denominator}°`;
  else if (i.type === "pie_missing_angle") actual = `${360 - i.known.reduce((sum, value) => sum + value, 0)}°`;
  else if (i.type === "mean_calculate") actual = mean(i.values);
  else if (i.type === "mean_missing") actual = i.mean * i.count - i.known.reduce((sum, value) => sum + value, 0);
  else if (i.type === "mean_interpret") actual = `${i.mean} is the fair-share value because the total ${i.mean * i.values.length} is shared equally among ${i.values.length} data points.`;
  else if (i.type === "mean_compare_spread") actual = `Both sets have mean ${i.mean}, but the first set has greater spread.`;
  else if (i.type === "mean_add_value") actual = (i.values.reduce((sum, value) => sum + value, 0) + i.added) / (i.values.length + 1);
  else if (i.type === "detective") actual = i.expected;
  else if (i.type === "retrieval_scale") actual = String(i.interval);
  else if (i.type === "retrieval_pie") actual = `${i.fraction[0]}/${i.fraction[1]}`;
  else if (i.type === "retrieval_mean_total") actual = String(i.count * i.mean);
  else if (i.type.startsWith("retrieval_")) actual = i.expected;
  else throw new Error(`${variant.id} has unknown integrity type ${i.type}.`);
  if (actual !== i.expected || actual !== variant.expected_answer.value) throw new Error(`${variant.id} failed arithmetic/data integrity: ${actual} != ${i.expected}.`);
  if (variant.format === "graph-reader") {
    if (!(variant.body.y_axis_interval > 0) || variant.body.data_points.some((point) => !Number.isFinite(point.value))) throw new Error(`${variant.id} has an invalid graph scale or point.`);
  }
  if (variant.format === "mean-balancer") {
    const values = i.values ?? i.first ?? [...(i.known ?? []), actual];
    if (values.length < 3 || values.length > 6) throw new Error(`${variant.id} has a mean outside the 3–6 value scope.`);
  }
}

function graphExplanation(i, unit) {
  if (i.type === "graph_read") return `The traced point is ${i.values[i.position]} ${unit}; the table confirms the same labelled value.`;
  if (i.type === "graph_difference") return `The difference is |${i.values[i.positions[1]]} - ${i.values[i.positions[0]]}| = ${Math.abs(i.values[i.positions[1]] - i.values[i.positions[0]])} ${unit}.`;
  if (i.type === "graph_change") return `The signed change is ${i.values[i.positions[1]]} - ${i.values[i.positions[0]]} = ${i.values[i.positions[1]] - i.values[i.positions[0]]} ${unit}.`;
  if (i.type === "graph_sum") return `The combined value is ${i.values[i.positions[0]]} + ${i.values[i.positions[1]]} = ${i.values[i.positions[0]] + i.values[i.positions[1]]} ${unit}.`;
  if (i.type === "graph_interpolate" && i.justified) return `The explicit steady-change model makes the halfway estimate ${i.left} + (${i.right} - ${i.left}) ÷ 2 = ${i.left + (i.right - i.left) / 2} ${unit}.`;
  if (i.type === "graph_interpolate") return "The exact intermediate value cannot be determined because it was not measured and no steady-change model was supplied.";
  return `The two required changes total ${(i.values[2] - i.values[0]) + Math.abs(i.values[3] - i.values[1])} ${unit}; each point is read from the stated scale first.`;
}

function pieExplanation(i) {
  if (i.type === "pie_fraction_count") return `${i.numerator}/${i.denominator} of ${i.total} is ${i.total} ÷ ${i.denominator} × ${i.numerator} = ${i.expected}.`;
  if (i.type === "pie_percent_count") return `${i.percent}% of ${i.total} is ${i.total} × ${i.percent}/100 = ${i.expected}.`;
  if (i.type === "pie_angle_count") return `${i.angle}° is ${i.angle}/360 of the circle, so ${i.total} × ${i.angle}/360 = ${i.expected}.`;
  if (i.type === "pie_missing_percent") return `Pie percentages total 100%; 100 - (${i.known.join(" + ")}) = ${i.expected}.`;
  if (i.type === "pie_total_from_fraction") return `If 1/${i.denominator} is ${i.sectorCount}, the whole is ${i.sectorCount} × ${i.denominator} = ${i.expected}.`;
  if (i.type === "pie_compare") return `The difference is ${i.total}/2 - ${i.total}/4 = ${i.expected}.`;
  if (i.type === "pie_fraction_angle") return `A full circle is 360°, so ${i.numerator}/${i.denominator} × 360° = ${i.expected}.`;
  return `Pie angles total 360°; subtracting ${i.known.join("°, ")}° gives ${i.expected}.`;
}

function meanExplanation(i) {
  if (i.type === "mean_calculate") return `${i.values.join(" + ")} = ${i.values.reduce((sum, value) => sum + value, 0)}; dividing by ${i.values.length} gives mean ${i.expected}.`;
  if (i.type === "mean_missing") return `The required total is ${i.mean} × ${i.count} = ${i.mean * i.count}; subtracting known values ${i.known.join(", ")} gives ${i.expected}.`;
  if (i.type === "mean_interpret") return i.expected;
  if (i.type === "mean_compare_spread") return `${i.expected} Set A ranges from ${Math.min(...i.first)} to ${Math.max(...i.first)}, while Set B is balanced already.`;
  return `The old total is ${i.values.reduce((sum, value) => sum + value, 0)}; adding ${i.added} and sharing among ${i.values.length + 1} values gives ${i.expected}.`;
}

function unitFromAnswer(answer) { return String(answer).replace(/^-?\d+(?:\.\d+)?\s*/, ""); }
function mean(values) { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function gcd(a, b) { while (b) [a, b] = [b, a % b]; return a; }
function numberChoices(answer) { const delta = Math.max(1, Math.round(Math.max(1, Math.abs(answer)) / 10)); return [answer, answer + delta, Math.max(0, answer - delta), answer + 2 * delta]; }
function unitChoices(answer, unit, interval) { return [`${answer} ${unit}`, `${answer + interval} ${unit}`, `${Math.max(0, answer - interval)} ${unit}`, `${answer + 2 * interval} ${unit}`]; }
function percentChoices(answer) { return distinctLabelledChoices(answer, "%", [answer + 10, Math.max(0, answer - 10), 100 - answer, answer + 20, Math.max(0, answer - 20)]); }
function angleChoices(answer) { return distinctLabelledChoices(answer, "°", [Math.min(360, answer + 30), Math.max(0, answer - 30), 360 - answer, Math.min(360, answer + 60), Math.max(0, answer - 60)]); }
function distinctLabelledChoices(answer, suffix, candidates) {
  const values = [answer, ...candidates].filter((value, index, all) => all.indexOf(value) === index);
  for (let step = 1; values.length < 4; step += 1) {
    const candidate = answer + step;
    if (!values.includes(candidate)) values.push(candidate);
  }
  return values.slice(0, 4).map((value) => `${value}${suffix}`);
}
function rotate(values, by) { const offset = by % values.length; return [...values.slice(offset), ...values.slice(0, offset)]; }
function normalise(value) { return JSON.stringify(value).toLowerCase().replaceAll(/[^a-z0-9]+/g, " ").trim(); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
function summary(items, keyFor) { const counts = new Map(); for (const item of items) counts.set(keyFor(item), (counts.get(keyFor(item)) ?? 0) + 1); return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(","); }
