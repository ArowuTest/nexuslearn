#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/ma-y7-ratio-proportion-tables.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y7-ratio-proportion-tables-bank-";
const target = 220;
const batch = "y7-ratio-proportion-depth-pilot-a";

if (write && check) throw new Error("Choose --write or --check, not both.");
const sourceText = await readFile(packPath, "utf8");
const pack = JSON.parse(sourceText);
if (pack.pack_id !== "ma-y7-ratio-proportion-tables") throw new Error("This generator only supports the Year 7 ratio/proportion tables pack.");
const curated = (pack.question_variants ?? []).filter((v) => !v.id.startsWith(prefix));
if (curated.length !== 3) throw new Error(`Expected 3 curated variants, found ${curated.length}.`);
const curatedSnapshot = JSON.stringify(curated.map(removeRatioContract));

const routes = [
  { key: "table", label: "ratio table", support: "A row-by-row table shows matching quantities and multiplier arrows." },
  { key: "line", label: "double number line", support: "Two aligned labelled scales and a text list show corresponding values." },
  { key: "bar", label: "bar model", support: "Equal-sized patterned parts are labelled; colour is never the only cue." },
  { key: "cards", label: "static card set", support: "Large-print number and unit cards can be selected or ordered without dragging." },
];
const contexts = [
  { a: "red counters", b: "blue counters", ua: "counters", ub: "counters" },
  { a: "oat scoops", b: "fruit scoops", ua: "scoops", ub: "scoops" },
  { a: "map centimetres", b: "ground kilometres", ua: "cm", ub: "km" },
  { a: "flour", b: "water", ua: "g", ub: "ml" },
  { a: "tickets", b: "cost", ua: "tickets", ub: "pounds" },
  { a: "distance", b: "time", ua: "km", ub: "minutes" },
];
const scaleFactors = [R(2), R(3), R(4), R(1, 2), R(3, 2), R(5, 2), R(2, 3)];

const generated = [
  ...Array.from({ length: 44 }, (_, i) => buildCounter(i)),
  ...Array.from({ length: 44 }, (_, i) => buildScale(i)),
  ...Array.from({ length: 43 }, (_, i) => buildReason(i)),
  ...Array.from({ length: 43 }, (_, i) => buildPartWhole(i)),
  ...Array.from({ length: 43 }, (_, i) => buildRetrieval(i)),
];

const enrichedCurated = curated.map(enrichVariant);
const enrichedGenerated = generated.map(enrichVariant);
pack.question_variants = [...enrichedCurated, ...enrichedGenerated];
pack.version = "0.2.0";
pack.qa = { ...pack.qa, readiness_status: "draft", notes: "Expanded deterministic Year 7 ratio/proportion pilot bank; generated variants require curriculum, teacher and accessibility review." };
validate(pack, enrichedCurated, enrichedGenerated);
if (JSON.stringify(enrichedCurated.map(removeRatioContract)) !== curatedSnapshot) throw new Error("Curated variants changed during generation.");

const output = `${JSON.stringify(pack, null, 2)}\n`;
if (write) {
  await writeFile(packPath, output, "utf8");
  console.log(`Wrote ${relative(packPath)} with ${pack.question_variants.length} variants.`);
} else if (check) {
  if (sourceText !== output) throw new Error(`${relative(packPath)} is not deterministic. Run this generator with --write.`);
  console.log(`Check passed: ${relative(packPath)} is deterministic.`);
} else {
  console.log(`Validated ${generated.length} candidates; use --write or --check.`);
}
console.log(`Blueprints: ${summary(generated, (v) => v.body.variant_blueprint_id)}`);
console.log(`Formats (total): ${summary(pack.question_variants, (v) => v.format)}`);
console.log(`Audio refs: ${pack.question_variants.filter((v) => v.audio_ref).length}`);

function buildCounter(i) {
  const route = routes[i % routes.length];
  const g = gcd(2 + (i % 7), 3 + ((i * 2) % 8));
  const x = (2 + (i % 7)) / g;
  const y = (3 + ((i * 2) % 8)) / g;
  const k = 2 + (i % 5);
  const shownA = x * k;
  const shownB = y * k;
  const mode = i % 4;
  if (mode === 0) return make({ i, id: `counter-order-${i + 1}`, format: "bar-model", blueprint: "ratio-counter-builds", band: "intro", tag: "swapped_ratio_order", prompt: `${route.label}: there are ${shownA} striped counters and ${shownB} dotted counters. Write striped:dotted in simplest form.`, answer: `${x}:${y}`, choices: [`${x}:${y}`, `${y}:${x}`, `${shownA}:${shownB}`, `${x}:${x + y}`], explanation: `Striped is named first, so the order is ${shownA}:${shownB}. Dividing both parts by ${k} gives ${x}:${y}; units cancel because both quantities are counters.`, hints: ["Follow the order named before the colon.", `Divide both parts by their common factor ${k}.`], route, integrity: { kind: "simplify", a: shownA, b: shownB, expected_a: x, expected_b: y } });
  if (mode === 1) return make({ i, id: `counter-units-${i + 1}`, format: "bar-model", blueprint: "ratio-counter-builds", band: "intro", tag: "units_ignored", prompt: `${route.label}: a model shows ${shownA} cm beside ${shownB} cm. Which simplest ratio compares first length:second length?`, answer: `${x}:${y}`, choices: [`${x}:${y}`, `${y}:${x}`, `${x} cm:${y} cm`, `${x}:${x + y}`], explanation: `Both measurements use centimetres, so compare ${shownA}:${shownB} and divide both by ${k}. The simplest ratio is ${x}:${y}, in the stated order.`, hints: ["Check that the measurements use the same unit.", "Simplify both parts by the same common factor."], route, integrity: { kind: "simplify", a: shownA, b: shownB, expected_a: x, expected_b: y } });
  if (mode === 2) return make({ i, id: `counter-equivalent-${i + 1}`, format: "bar-model", blueprint: "ratio-counter-builds", band: "developing", tag: "additive_not_multiplicative", prompt: `${route.label}: which ratio is equivalent to ${x}:${y}?`, answer: `${shownA}:${shownB}`, choices: [`${shownA}:${shownB}`, `${x + k}:${y + k}`, `${shownA}:${y}`, `${shownB}:${shownA}`], explanation: `${shownA}:${shownB} is made by multiplying both ${x} and ${y} by ${k}. Adding ${k} or scaling one part does not preserve the multiplicative relationship.`, hints: ["Look for one multiplier used on both parts.", `Test whether both parts were multiplied by ${k}.`], route, integrity: { kind: "equivalent", a: x, b: y, c: shownA, d: shownB } });
  return make({ i, id: `counter-compare-${i + 1}`, format: "bar-model", blueprint: "ratio-counter-builds", band: "developing", tag: "part_part_part_whole_confusion", prompt: `${route.label}: the ratio of square:circle tiles is ${x}:${y}. What fraction of all tiles are squares?`, answer: `${x}/${x + y}`, choices: [`${x}/${x + y}`, `${x}/${y}`, `${y}/${x + y}`, `${x + y}/${x}`], explanation: `There are ${x + y} equal parts altogether. Squares occupy ${x} of them, so the part-whole fraction is ${x}/${x + y}; ${x}:${y} itself compares two parts.`, hints: ["Add the ratio parts to find the whole.", "Use square parts over total parts."], route, integrity: { kind: "part_fraction", a: x, b: y, numerator: x, denominator: x + y } });
}

function buildScale(i) {
  const route = routes[i % routes.length];
  const factor = scaleFactors[i % scaleFactors.length];
  const den = factor.d;
  const a = den * (2 + (i % 5));
  const b = den * (3 + ((i * 2) % 6));
  const c = mul(R(a), factor);
  const d = mul(R(b), factor);
  const context = contexts[i % contexts.length];
  const askSecond = i % 2 === 0;
  const answer = askSecond ? fmt(d) : fmt(c);
  const choices = rationalChoices(askSecond ? d : c, [R((askSecond ? b : a) + factor.n), askSecond ? mul(R(b), R(factor.n)) : mul(R(a), R(factor.n)), askSecond ? c : d]);
  return make({ i, id: `scale-${i + 1}-${route.key}`, format: "ratio-table", blueprint: "ratio-table-scaling", band: "expected", tag: i % 3 === 0 ? "scales_one_part_only" : factor.d > 1 ? "divides_by_denominator_only" : "additive_not_multiplicative", prompt: `${route.label}: ${a} ${context.ua} of ${context.a} correspond to ${b} ${context.ub} of ${context.b}. A matching row uses scale factor ${fmt(factor)}. Find the missing ${askSecond ? context.b : context.a} value.`, answer, choices, explanation: `The relationship stays proportional only when both quantities use the same factor ${fmt(factor)}. ${a} × ${fmt(factor)} = ${fmt(c)} and ${b} × ${fmt(factor)} = ${fmt(d)}, so the missing value is ${answer} ${askSecond ? context.ub : context.ua}.`, hints: ["Write the same multiplier beside both columns.", `Multiply numerator first and divide by denominator ${factor.d}; do not round.`], route, integrity: { kind: "scale", a, b, factor, c, d, ask: askSecond ? "d" : "c" }, units: { left: context.ua, right: context.ub } });
}

function buildReason(i) {
  const route = routes[i % routes.length];
  const a = 2 + (i % 6);
  const b = 3 + ((i * 3) % 7);
  const k = 2 + (i % 4);
  const mode = i % 7;
  const cases = [
    { tag: "additive_not_multiplicative", prompt: `Which row keeps the ratio ${a}:${b}?`, answer: `${a * k}:${b * k}, because both parts are multiplied by ${k}`, distractors: [`${a + k}:${b + k}, because the same number was added`, `${a * k}:${b}, because only the first value changes`, `${b * k}:${a * k}, because order does not matter`] },
    { tag: "scales_one_part_only", prompt: `A table starts ${a}:${b}. Which proposed row is proportional?`, answer: `${a * k}:${b * k}; the same scale factor ${k} links both columns`, distractors: [`${a * k}:${b}; only one column was scaled`, `${a}:${b * k}; only one column was scaled`, `${a + k}:${b + k}; equal additions are enough`] },
    { tag: "swapped_ratio_order", prompt: `A recipe states flour:water = ${a}:${b}. Which statement keeps that order?`, answer: `For every ${a} g flour there are ${b} ml water`, distractors: [`For every ${b} g flour there are ${a} ml water`, `Flour is ${a}/${b} of the whole mixture`, `The units can be swapped with the numbers`] },
    { tag: "part_part_part_whole_confusion", prompt: `For a ratio ${a}:${b}, which claim about the first part is correct?`, answer: `It is ${a}/${a + b} of the total`, distractors: [`It is ${a}/${b} of the total`, `The total has ${b} parts`, `The colon means divide the total by ${b} only`] },
    { tag: "invalid_zero_division", prompt: `Which statement about a proportional table is valid?`, answer: `A zero input can pair with zero output, but a unit rate cannot be found by dividing by zero`, distractors: [`Divide by zero to find the unit rate`, `Any row containing zero proves every ratio is equivalent`, `A non-zero output can pair with zero input under direct proportion`] },
    { tag: "rounds_too_early", prompt: `Five badges cost £12 exactly. Which method gives the exact cost of 8 badges?`, answer: `Use £12 ÷ 5 = £2.40, then £2.40 × 8 = £19.20`, distractors: [`Round £2.40 to £2, then multiply to get £16`, `Add 3 to both 5 and 12 to get £15`, `Use 12 ÷ 8 and stop`] },
    { tag: "cross_multiplies_without_meaning", prompt: `Why does ${a}:${b} match ${a * k}:${b * k}?`, answer: `Both quantities are scaled by ${k}, so the multiplicative relationship is unchanged`, distractors: [`Cross multiplication is a rule that needs no quantities or units`, `The same number was added to both values`, `Only the larger number controls equivalence`] },
  ];
  const item = cases[mode];
  return make({ i, id: `reason-${i + 1}-${route.key}`, format: "reason-choice", blueprint: "additive-vs-multiplicative", band: "secure", tag: item.tag, prompt: `${route.label}: ${item.prompt}`, answer: item.answer, choices: [item.answer, ...item.distractors], explanation: reasonExplanation(item.tag, a, b, k), hints: ["Name the relationship and check both quantities, including units.", "A proportional pair has one common multiplier or one constant unit rate."], route, integrity: { kind: "reason", a, b, k, proportional_c: a * k, proportional_d: b * k, mode } });
}

function buildPartWhole(i) {
  const route = routes[i % routes.length];
  const a = 2 + (i % 6);
  const b = 3 + ((i * 2) % 7);
  const parts = a + b;
  const unit = 2 + (i % 8);
  const total = parts * unit;
  const mode = i % 4;
  const specs = [
    { prompt: `A patterned bar represents the ratio ${a}:${b} and a total of ${total} counters. How many counters are in the first part?`, answer: a * unit, choices: [a * unit, b * unit, unit, total - a], explanation: `The bar has ${parts} equal ratio parts. ${total} ÷ ${parts} = ${unit} per part, then ${a} × ${unit} = ${a * unit} counters in the first group.`, tag: "uses_ratio_number_as_quantity", ask: "first" },
    { prompt: `Two groups are in the ratio ${a}:${b}. The first group has ${a * unit} items. How many are in the second group?`, answer: b * unit, choices: [b * unit, parts * unit, a + b, a * unit + b], explanation: `${a} ratio parts represent ${a * unit}, so one part is ${unit}. The second group has ${b} parts: ${b} × ${unit} = ${b * unit}.`, tag: "additive_not_multiplicative", ask: "second" },
    { prompt: `A mixture has ${a} parts juice to ${b} parts water. What fraction of the whole mixture is water?`, answer: `${b}/${parts}`, choices: [`${b}/${parts}`, `${b}/${a}`, `${a}/${parts}`, `${parts}/${b}`], explanation: `Water uses ${b} parts out of ${parts} parts altogether, so its part-whole fraction is ${b}/${parts}. The ratio ${a}:${b} is part-part.`, tag: "part_part_part_whole_confusion", ask: "fraction_second" },
    { prompt: `A bar has ${a} patterned parts and ${b} plain parts. The plain section is ${b * unit} cm. What is the total length?`, answer: total, choices: [total, a * unit, b * unit, parts], explanation: `${b} parts measure ${b * unit} cm, so one part is ${unit} cm. There are ${parts} parts altogether, giving ${parts} × ${unit} = ${total} cm.`, tag: "treats_part_as_whole", ask: "total" },
  ];
  const s = specs[mode];
  return make({ i, id: `part-whole-${i + 1}-${route.key}`, format: "bar-model", blueprint: "part-part-part-whole", band: "developing", tag: s.tag, prompt: `${route.label}: ${s.prompt}`, answer: s.answer, choices: s.choices, explanation: s.explanation, hints: ["Count equal ratio parts before using the total or known part.", `There are ${parts} parts altogether; find one part when needed.`], route, integrity: { kind: "part_whole", a, b, parts, unit, total, ask: s.ask } });
}

function buildRetrieval(i) {
  const route = routes[i % routes.length];
  const mode = i % 5;
  const a = 2 + (i % 7);
  const b = 3 + ((i * 3) % 8);
  const k = 2 + (i % 5);
  if (mode === 0) return make({ i, id: `retrieve-unitary-${i + 1}`, format: "ratio-table", blueprint: "ratio-table-retrieval", band: "retrieval", tag: "divides_wrong_quantity", prompt: `${route.label}: ${a} notebooks cost £${a * k}. What is the exact cost of ${b} notebooks at the same stated rate?`, answer: b * k, choices: [b * k, a * k + b, a + b * k, k], explanation: `The unit cost is £${a * k} ÷ ${a} = £${k}. For ${b} notebooks, ${b} × £${k} = £${b * k}.`, hints: ["Find the amount for one notebook first.", "Multiply the exact unit value by the new number."], route, integrity: { kind: "unitary", known_count: a, known_total: a * k, new_count: b, expected: b * k }, units: { left: "notebooks", right: "pounds" } });
  if (mode === 1) return make({ i, id: `retrieve-map-${i + 1}`, format: "ratio-table", blueprint: "ratio-table-retrieval", band: "retrieval", tag: "units_ignored", prompt: `${route.label}: on a stated map scale, ${a} cm represents ${a * k} km. What ground distance does ${b} cm represent?`, answer: b * k, choices: [b * k, a * k + b, b, a * b * k], explanation: `${a * k} km ÷ ${a} cm = ${k} km per cm. Therefore ${b} cm represents ${b * k} km; the answer keeps the ground-distance unit.`, hints: ["Label each table column with cm or km.", "Find kilometres per centimetre, then scale."], route, integrity: { kind: "unitary", known_count: a, known_total: a * k, new_count: b, expected: b * k }, units: { left: "cm", right: "km" } });
  if (mode === 2) { const c = a + 1; const d = b + 2; const left = a * d; const right = c * b; const answer = left === right ? "The ratios are equivalent" : left > right ? `${a}:${b} has the greater first-to-second rate` : `${c}:${d} has the greater first-to-second rate`; return make({ i, id: `retrieve-compare-${i + 1}`, format: "ratio-table", blueprint: "ratio-table-retrieval", band: "stretch", tag: "compares_additive_difference", prompt: `${route.label}: compare ${a}:${b} and ${c}:${d}. Which conclusion is justified?`, answer, choices: [answer, "The ratio with the larger sum is always greater", "They are equivalent because both parts increased", "Compare only the first numbers"], explanation: `Compare equal denominators or products: ${a} × ${d} = ${left}, while ${c} × ${b} = ${right}. This compares the first-to-second rates without relying on additive differences.`, hints: ["Convert to a common second quantity or compare exact products.", "A larger total does not by itself mean a larger ratio."], route, integrity: { kind: "compare", a, b, c, d, left, right } }); }
  if (mode === 3) { const second = b === a ? b + 1 : b; return make({ i, id: `retrieve-nonprop-${i + 1}`, format: "ratio-table", blueprint: "ratio-table-retrieval", band: "stretch", tag: "assumes_every_table_proportional", prompt: `${route.label}: a table contains (${a}, ${a * k + 1}) and (${second}, ${second * k + 1}). Is it direct proportion?`, answer: "No; the output-to-input ratios differ because of the added 1", choices: ["No; the output-to-input ratios differ because of the added 1", "Yes; both rows use the same addition", "Yes; every increasing table is proportional", "No; direct proportion cannot contain whole numbers"], explanation: `Direct proportion requires one constant multiplier and includes the origin. Here outputs follow y = ${k}x + 1, so ${a * k + 1}/${a} and ${second * k + 1}/${second} differ; the shared addition does not make a proportion.`, hints: ["Test output ÷ input in both rows.", "Ask whether zero input would give zero output."], route, integrity: { kind: "non_proportional", a, b: second, k, y1: a * k + 1, y2: second * k + 1 } }); }
  const rate = 2 + (i % 4); return make({ i, id: `retrieve-currency-${i + 1}`, format: "ratio-table", blueprint: "ratio-table-retrieval", band: "expected", tag: "rounds_too_early", prompt: `${route.label}: in a fictional game, the stated exact rate is 1 sun token = ${rate} moon tokens. How many moon tokens match ${a} sun tokens?`, answer: a * rate, choices: [a * rate, a + rate, a, rate], explanation: `The exact stated rate is ${rate} moon tokens for each sun token. ${a} × ${rate} = ${a * rate} moon tokens; no live exchange rate or rounding is involved.`, hints: ["Write the units at the top of each column.", "Multiply by the exact number of moon tokens per sun token."], route, integrity: { kind: "unitary", known_count: 1, known_total: rate, new_count: a, expected: a * rate }, units: { left: "sun tokens", right: "moon tokens" } });
}

function make({ i, id, format, blueprint, band, tag, prompt, answer, choices, explanation, hints, route, integrity, units }) {
  const completed = completeChoices(unique(choices), answer);
  const rotated = rotate(completed, i % completed.length);
  const missionPrompt = `${blueprint} mission ${i + 1}: ${prompt}`;
  if (rotated.length !== 4 || rotated.filter((v) => same(v, answer)).length !== 1) throw new Error(`${id} does not have four unique choices with one answer.`);
  return {
    id: `${prefix}${id}`,
    format,
    body: {
      prompt: missionPrompt,
      choices: rotated,
      ratio_integrity: integrity,
      units: units ?? { left: "ratio part A", right: "ratio part B" },
      variant_blueprint_id: blueprint,
      review_batch: batch,
      difficulty_band: band,
      coverage_tags: coverageFor(tag, integrity.kind),
      misconception_choice_map: misconceptionMap(rotated, answer, tag),
      representation_route: route.support,
      equivalent_simplified_view: "Show one relationship at a time using a two-row table, labelled units and a single multiplier arrow; the mathematical demand stays unchanged.",
      text_equivalent: `Text route: ${missionPrompt} Choices: ${rotated.join(" | ")}.`,
      response_mode: "touch_keyboard_switch_eye_gaze_aac_point_or_adult_scribed",
      supported_interactions: ["touch_select", "keyboard", "switch_scan", "eye_gaze", "aac", "point", "adult_scribed"],
      interaction_support: { touch: true, keyboard: true, switch_scan: true, eye_gaze: true, aac: true, point_or_partner_scan: true, adult_scribed: true, precision_drag_required: false, handwriting_required: false, speech_required: false, undo_available: true },
      static_alternative: "All values, units, pattern labels and multiplier arrows are available in a static table or numbered list with no animation.",
      reduced_motion_alternative: "Instant before-and-after states; no moving counters, pulsing, flicker or automatic transitions.",
      low_sensory: true,
      reduced_visual_load: true,
      colour_independent: true,
      timed: false,
      timer_allowed: false,
      speed_score_allowed: false,
      streak_required: false,
      leaderboard_allowed: false,
      browser_tts_allowed: false,
      audio_policy: "No audio is required. Any future narration must use a produced, human-reviewed ElevenLabs asset reference; browser TTS is prohibited.",
      spaced_retrieval: { interval: ["same_session", "next_session", "3_days", "7_days"][i % 4], strategy_route_can_change: true },
    },
    expected_answer: { value: answer },
    hints,
    explanation,
    feedback: {
      correct: `Ratio link verified. ${explanation}`,
      try_again: `Nothing is lost and there is no timer. ${hints[0]}`,
      misconception: `The '${tag.replaceAll("_", " ")}' route breaks the stated relationship. ${hints[1]}`,
      evidence: evidenceFor(integrity.kind),
      check: "Check ratio order, write units, and verify that one exact multiplier or unit rate links every corresponding quantity.",
      support: "Use the same reasoning with the static table, double number line, patterned bar, keyboard choices, switch scan, eye gaze, AAC/pointing or an adult scribe.",
    },
    gamification: {
      mission: missionFor(integrity.kind),
      objective: "Repair one link in the calm Proportion Observatory and record the mathematical evidence.",
      reward: `private_ratio_constellation_${(i % 9) + 1}`,
      no_timer: true,
      no_speed_reward: true,
      no_lost_lives: true,
      no_streak_pressure: true,
      leaderboard: false,
      retry_encouraged: true,
      route_choice_unscored: true,
    },
    difficulty: { intro: 3, developing: 5, expected: 6, secure: 8, stretch: 9, retrieval: 5 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: format === "ratio-table" ? "ratio-table-link-check" : format === "bar-model" ? "patterned-ratio-bar" : "ratio-reason-audit",
  };
}

function enrichVariant(variant) {
  const body = variant.body ?? {};
  return {
    ...variant,
    body: {
      ...body,
      ratio_tables_contract: {
        kind: "year7_ratio_proportion_tables",
        evidence_steps: ["preserve_ratio_order", "label_units", "identify_shared_multiplier", "check_proportionality"],
        representation_routes: ["ratio_table", "double_number_line", "bar_model", "static_cards"],
        response_modes: ["touch", "keyboard", "switch", "eye_gaze", "aac", "adult_scribed"],
        precision_drag_required: false,
        handwriting_required: false,
        speech_required: false,
        timed: false,
        preserve_correct_work: true,
        misconception_mapping_required: true,
      },
    },
  };
}

function validateRatioContract(variant) {
  const contract = variant.body?.ratio_tables_contract;
  const requiredResponseModes = ["touch", "keyboard", "switch", "eye_gaze", "aac", "adult_scribed"];
  const requiredSteps = ["preserve_ratio_order", "label_units", "identify_shared_multiplier", "check_proportionality"];
  const requiredRoutes = ["ratio_table", "double_number_line", "bar_model", "static_cards"];
  if (!contract || contract.kind !== "year7_ratio_proportion_tables" || contract.precision_drag_required !== false || contract.handwriting_required !== false || contract.speech_required !== false || contract.timed !== false || contract.preserve_correct_work !== true || contract.misconception_mapping_required !== true || requiredResponseModes.some((mode) => !contract.response_modes?.includes(mode)) || requiredSteps.some((step) => !contract.evidence_steps?.includes(step)) || requiredRoutes.some((route) => !contract.representation_routes?.includes(route))) throw new Error(`${variant.id} lacks an accessible Year 7 ratio-table contract.`);
}

function validate(current, authored, candidates) {
  if (authored.length !== 3 || candidates.length !== 217 || current.question_variants.length !== target) throw new Error("Count or curated-count validation failed.");
  const ids = new Set();
  const signatures = new Set();
  for (const v of current.question_variants) {
    if (ids.has(v.id)) throw new Error(`Duplicate id: ${v.id}`);
    ids.add(v.id);
    const signature = `${v.format}|${normalise(v.body?.prompt)}|${JSON.stringify(v.expected_answer)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate signature: ${v.id}`);
    signatures.add(signature);
    validateRatioContract(v);
  }
  const blueprintMap = new Map(current.variant_blueprints.map((b) => [b.id, b]));
  const formatSet = new Set(current.practice.formats);
  const actualBlueprints = new Set();
  const actualFormats = new Set();
  const requiredTags = ["ratio_notation", "units", "part_part", "part_whole", "simplifying", "equivalent_ratios", "rational_scaling", "ratio_tables", "double_number_line", "bar_model", "missing_values", "unitary_method", "comparison", "direct_proportion", "non_proportional", "misconceptions", "spaced_retrieval"];
  const tags = new Set();
  for (const v of candidates) {
    const blueprint = blueprintMap.get(v.body.variant_blueprint_id);
    if (!blueprint || blueprint.format !== v.format) throw new Error(`${v.id} mismatches its blueprint format.`);
    if (!formatSet.has(v.format) || v.status !== "review") throw new Error(`${v.id} has unsupported format/status.`);
    if (v.body.prompt.length > 320) throw new Error(`${v.id} prompt exceeds 320 characters.`);
    if (!v.body.units?.left || !v.body.units?.right) throw new Error(`${v.id} lacks explicit unit metadata.`);
    if (!v.body.interaction_support?.keyboard || !v.body.interaction_support?.switch_scan || !v.body.interaction_support?.eye_gaze || !v.body.interaction_support?.aac || v.body.interaction_support.precision_drag_required !== false || v.body.interaction_support.handwriting_required !== false || v.body.interaction_support.speech_required !== false) throw new Error(`${v.id} lacks accessible routes.`);
    if (!v.body.static_alternative || !v.body.equivalent_simplified_view || !v.body.text_equivalent || !v.body.colour_independent || v.body.browser_tts_allowed !== false) throw new Error(`${v.id} lacks static/text/audio safeguards.`);
    if (v.body.timed || v.body.timer_allowed || v.body.speed_score_allowed || v.body.streak_required || v.body.leaderboard_allowed) throw new Error(`${v.id} introduces pressure.`);
    if (!v.feedback?.correct || !v.feedback?.try_again || !v.feedback?.misconception || !v.feedback?.evidence || !v.feedback?.check || !v.feedback?.support || v.hints.length < 2 || v.explanation.length < 50) throw new Error(`${v.id} lacks rich feedback.`);
    if (!Array.isArray(v.body.choices) || v.body.choices.length !== 4 || new Set(v.body.choices.map(serialise)).size !== 4 || v.body.choices.filter((x) => same(x, v.expected_answer.value)).length !== 1) throw new Error(`${v.id} has invalid answer placement.`);
    if (Object.keys(v.body.misconception_choice_map).length !== 3) throw new Error(`${v.id} distractors are not misconception-mapped.`);
    validateIntegrity(v);
    actualBlueprints.add(v.body.variant_blueprint_id);
    actualFormats.add(v.format);
    for (const tag of v.body.coverage_tags) tags.add(tag);
  }
  requireAll("blueprints", new Set(blueprintMap.keys()), actualBlueprints);
  requireAll("formats", formatSet, actualFormats);
  requireAll("coverage", new Set(requiredTags), tags);
  const expectedBlueprints = { "ratio-counter-builds": 44, "ratio-table-scaling": 44, "additive-vs-multiplicative": 43, "part-part-part-whole": 43, "ratio-table-retrieval": 43 };
  const blueprintCounts = countBy(candidates, (v) => v.body.variant_blueprint_id);
  for (const [key, value] of Object.entries(expectedBlueprints)) if (blueprintCounts[key] !== value) throw new Error(`${key}: expected ${value}, found ${blueprintCounts[key] ?? 0}.`);
  const totalFormats = countBy(current.question_variants, (v) => v.format);
  for (const [key, value] of Object.entries({ "bar-model": 88, "ratio-table": 88, "reason-choice": 44 })) if (totalFormats[key] !== value) throw new Error(`${key}: expected ${value}, found ${totalFormats[key] ?? 0}.`);
  if (candidates.some((v) => v.audio_ref || /browser tts allowed/i.test(JSON.stringify(v)))) throw new Error("Unexpected audio reference or browser-TTS permission.");
}

function removeRatioContract(variant) {
  const { ratio_tables_contract: _ratioContract, ...body } = variant.body ?? {};
  return { ...variant, body };
}

function validateIntegrity(v) {
  const m = v.body.ratio_integrity;
  const ans = v.expected_answer.value;
  if (!m?.kind) throw new Error(`${v.id} lacks integrity metadata.`);
  if (m.kind === "simplify") { const g = gcd(m.a, m.b); if (m.expected_a !== m.a / g || m.expected_b !== m.b / g || ans !== `${m.expected_a}:${m.expected_b}`) bad(v); }
  else if (m.kind === "equivalent") { if (m.a * m.d !== m.b * m.c || ans !== `${m.c}:${m.d}`) bad(v); }
  else if (m.kind === "part_fraction") { if (m.denominator !== m.a + m.b || m.numerator !== m.a || ans !== `${m.numerator}/${m.denominator}`) bad(v); }
  else if (m.kind === "scale") { const c = mul(R(m.a), m.factor); const d = mul(R(m.b), m.factor); if (!eq(c, m.c) || !eq(d, m.d) || ans !== fmt(m[m.ask])) bad(v); }
  else if (m.kind === "reason") { if (m.proportional_c !== m.a * m.k || m.proportional_d !== m.b * m.k) bad(v); }
  else if (m.kind === "part_whole") { if (m.parts !== m.a + m.b || m.total !== m.parts * m.unit) bad(v); if (m.ask === "first" && ans !== m.a * m.unit) bad(v); if (m.ask === "second" && ans !== m.b * m.unit) bad(v); if (m.ask === "fraction_second" && ans !== `${m.b}/${m.parts}`) bad(v); if (m.ask === "total" && ans !== m.total) bad(v); }
  else if (m.kind === "unitary") { const expected = div(R(m.known_total), R(m.known_count)); const result = mul(expected, R(m.new_count)); if (m.expected !== result.n / result.d || ans !== m.expected) bad(v); }
  else if (m.kind === "compare") { if (m.left !== m.a * m.d || m.right !== m.c * m.b) bad(v); }
  else if (m.kind === "non_proportional") { if (m.y1 !== m.a * m.k + 1 || m.y2 !== m.b * m.k + 1 || m.y1 * m.b === m.y2 * m.a) bad(v); }
  else bad(v);
}

function reasonExplanation(tag, a, b, k) {
  const map = {
    additive_not_multiplicative: `Equivalent ratios preserve a multiplicative relationship: ${a} × ${k} = ${a * k} and ${b} × ${k} = ${b * k}. Equal additions generally change the ratio.`,
    scales_one_part_only: `Both corresponding quantities need the same multiplier. Scaling only one part changes the comparison, while ${a}:${b} = ${a * k}:${b * k}.`,
    swapped_ratio_order: `Ratio order follows the named quantities. Flour:water ${a}:${b} means ${a} g flour for every ${b} ml water; reversing the words reverses the ratio.`,
    part_part_part_whole_confusion: `The colon compares ${a} parts with ${b} parts. The whole contains ${a + b} parts, so the first part is ${a}/${a + b} of the total, not ${a}/${b}.`,
    invalid_zero_division: "Direct proportion can include the origin (0,0), but division by zero is undefined. A non-zero output at zero input also contradicts y = kx.",
    rounds_too_early: "The stated cost gives an exact unit value of £2.40. Keeping that exact value until the final multiplication gives £19.20 and avoids accumulated rounding error.",
    cross_multiplies_without_meaning: `The products agree because one scale factor ${k} maps each original quantity to its partner. Product checks are evidence of equivalent rates, not a context-free trick.`,
  };
  return map[tag];
}

function coverageFor(tag, kind) {
  const base = ["ratio_notation", "units", "equivalent_ratios", "misconceptions", "spaced_retrieval"];
  const byKind = { simplify: ["simplifying", "part_part", "bar_model"], equivalent: ["simplifying", "part_part", "bar_model"], part_fraction: ["part_part", "part_whole", "bar_model"], scale: ["rational_scaling", "ratio_tables", "double_number_line", "missing_values"], reason: ["direct_proportion", "non_proportional", "comparison"], part_whole: ["part_part", "part_whole", "bar_model", "missing_values"], unitary: ["unitary_method", "ratio_tables", "missing_values"], compare: ["comparison", "ratio_tables"], non_proportional: ["direct_proportion", "non_proportional", "ratio_tables"] };
  return [...new Set([...base, ...(byKind[kind] ?? []), tag])];
}
function misconceptionMap(choices, answer, primary) { const result = {}; let n = 0; const fallbacks = [primary, "wrong_operation_or_scale", "ratio_order_or_unit_error"]; for (const choice of choices) if (!same(choice, answer)) result[serialise(choice)] = fallbacks[n++]; return result; }
function evidenceFor(kind) { return ({ simplify: "A valid simplification divides both parts by the same common factor.", equivalent: "Equivalent ratios have equal cross-products and one common scale factor.", part_fraction: "Part-whole evidence uses the named part over the sum of all ratio parts.", scale: "Each output equals its matching input multiplied by the same exact rational factor.", reason: "Accept the claim only when its multiplier, unit rate or counterexample supports every stated pair.", part_whole: "The bar uses equal-sized parts: total ÷ number of parts gives one part.", unitary: "Divide the known total by its count, then multiply the exact unit value by the new count.", compare: "Compare exact rates using a common denominator or meaningful cross-products.", non_proportional: "Direct proportion has a constant output/input rate and passes through the origin." })[kind]; }
function missionFor(kind) { return ({ simplify: "Calibrate the Ratio Lens", equivalent: "Link Equivalent Constellations", part_fraction: "Map Parts and Whole", scale: "Complete the Proportion Array", reason: "Audit a Ratio Claim", part_whole: "Restore the Patterned Bar", unitary: "Find the Unit Beacon", compare: "Compare Signal Rates", non_proportional: "Detect the False Proportion" })[kind]; }

function R(n, d = 1) { if (!Number.isInteger(n) || !Number.isInteger(d) || d === 0) throw new Error(`Invalid rational ${n}/${d}.`); const sign = d < 0 ? -1 : 1; const g = gcd(Math.abs(n), Math.abs(d)); return { n: sign * n / g, d: Math.abs(d) / g }; }
function mul(a, b) { return R(a.n * b.n, a.d * b.d); }
function div(a, b) { if (b.n === 0) throw new Error("Division by zero."); return R(a.n * b.d, a.d * b.n); }
function eq(a, b) { return a.n === b.n && a.d === b.d; }
function fmt(r) { return r.d === 1 ? String(r.n) : `${r.n}/${r.d}`; }
function rationalChoices(answer, candidates) { const result = [fmt(answer)]; for (const c of candidates) if (!result.includes(fmt(c))) result.push(fmt(c)); for (const c of [R(answer.n + answer.d, answer.d), R(Math.abs(answer.n - answer.d) || 1, answer.d), R(answer.n * 2, answer.d)]) if (result.length < 4 && !result.includes(fmt(c))) result.push(fmt(c)); return result.slice(0, 4); }
function gcd(a, b) { let x = Math.abs(a); let y = Math.abs(b); while (y) [x, y] = [y, x % y]; return x || 1; }
function bad(v) { throw new Error(`${v.id} failed deterministic rational/integer integrity.`); }
function unique(values) { const seen = new Set(); return values.filter((v) => { const key = serialise(v); if (seen.has(key)) return false; seen.add(key); return true; }); }
function completeChoices(values, answer) { const result = [...values]; const fallbacks = typeof answer === "number" ? [answer + 1, answer - 1, answer + 2, 0] : ["The two quantities may be changed independently", "The relationship is additive in every row", "Units and ratio order do not affect the comparison", "No relationship can be justified from the values"]; for (const value of fallbacks) if (result.length < 4 && !result.some((item) => same(item, value))) result.push(value); return result.slice(0, 4); }
function same(a, b) { return serialise(a) === serialise(b); }
function serialise(v) { return JSON.stringify(v); }
function rotate(values, amount) { const offset = amount % values.length; return values.slice(offset).concat(values.slice(0, offset)); }
function requireAll(label, required, actual) { const missing = [...required].filter((x) => !actual.has(x)); if (missing.length) throw new Error(`Missing ${label}: ${missing.join(", ")}.`); }
function countBy(values, fn) { const out = {}; for (const v of values) { const key = fn(v); out[key] = (out[key] ?? 0) + 1; } return out; }
function summary(values, fn) { return Object.entries(countBy(values, fn)).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`).join(", "); }
function normalise(v) { return String(v ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function argValue(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
