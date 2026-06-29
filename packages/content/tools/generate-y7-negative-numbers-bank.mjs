#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/ma-y7-negative-numbers.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y7-negative-numbers-bank-";
const pilotTarget = 240;
const reviewBatch = "y7-negative-numbers-depth-pilot-a";

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y7-negative-numbers") throw new Error("This generator only supports the Year 7 negative-numbers pack.");
const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 4) throw new Error(`Expected exactly 4 curated variants, found ${curated.length}. Refusing to overwrite possible authored work.`);

const routes = [
  { key: "line", label: "Expedition number-line route", representation: "horizontal line with labelled zero, equal intervals and persistent arrows" },
  { key: "lift", label: "Vertical lift-map route", representation: "vertical scale with above/below reference labels and a text movement log" },
  { key: "counters", label: "Signed-counter route", representation: "embossed plus and minus counters with neutral zero-pair frames" },
  { key: "static", label: "Static coordinate-card route", representation: "large-print ordered cards and a no-motion calculation table" },
];

const contextCases = [
  { key: "temp-rise", prompt: "The temperature changes from -4 degrees C to 7 degrees C. What is the directed change?", start: -4, end: 7, change: 11, answer: 11, interpretation: "11 degrees C increase", explanation: "Moving from -4 to 0 is an increase of 4, then moving from 0 to 7 is another 7. The directed change is 7 - (-4) = +11.", tag: "subtracts_magnitudes_only", coverage: ["contexts", "directed_change", "addition_subtraction"] },
  { key: "temp-fall", prompt: "A sensor starts at 6 degrees C and falls by 9 degrees C. What is the final temperature?", start: 6, end: -3, change: -9, answer: -3, interpretation: "-3 degrees C", explanation: "A fall of 9 is a directed change of -9. Starting at 6 and moving 9 places left gives 6 + (-9) = -3.", tag: "negative_sign_as_subtraction", coverage: ["contexts", "directed_change", "addition_subtraction"] },
  { key: "lift-rise", prompt: "A lift starts on level -3 and rises 8 levels. Where does it finish?", start: -3, end: 5, change: 8, answer: 5, interpretation: "level 5", explanation: "Rising is a positive directed change. Starting at -3 and adding 8 crosses zero and ends at 5.", tag: "stops_at_zero", coverage: ["contexts", "directed_change", "number_lines"] },
  { key: "submersible-rise", prompt: "A submersible is at -12 m relative to sea level and rises 7 m. What is its new elevation?", start: -12, end: -5, change: 7, answer: -5, interpretation: "-5 m relative to sea level", explanation: "A rise of 7 moves right or upward on the signed scale. -12 + 7 = -5, which remains below the zero reference.", tag: "positive_change_means_positive_result", coverage: ["contexts", "directed_change", "addition_subtraction"] },
  { key: "ridge-descent", prompt: "A route marker is at 3 m relative to the base reference and descends 11 m. What is the new relative elevation?", start: 3, end: -8, change: -11, answer: -8, interpretation: "-8 m relative to the base reference", explanation: "Descending 11 is adding -11. From 3, move 3 to zero and 8 more below it, ending at -8.", tag: "negative_sign_as_subtraction", coverage: ["contexts", "directed_change", "addition_subtraction"] },
  { key: "score-gain", prompt: "A puzzle score is -5 after a penalty, then gains 12 points. What is the new score?", start: -5, end: 7, change: 12, answer: 7, interpretation: "7 points", explanation: "A gain is positive. Adding 12 to -5 moves through zero and lands on 7, so -5 + 12 = 7.", tag: "negative_start_forces_negative_answer", coverage: ["contexts", "directed_change", "addition_subtraction"] },
  { key: "score-penalty", prompt: "An expedition score is 8, then a 15-point penalty is applied. What is the new score?", start: 8, end: -7, change: -15, answer: -7, interpretation: "-7 points", explanation: "The penalty is a change of -15. Starting at 8 and moving 15 left gives 8 + (-15) = -7.", tag: "ignores_negative_change", coverage: ["contexts", "directed_change", "addition_subtraction"] },
  { key: "freezer-warm", prompt: "A freezer sensor warms from -18 degrees C by 6 degrees C. What does it read next?", start: -18, end: -12, change: 6, answer: -12, interpretation: "-12 degrees C", explanation: "Warming is a positive change, but the endpoint need not be positive. -18 + 6 = -12, so the sensor remains below zero.", tag: "positive_change_means_positive_result", coverage: ["contexts", "directed_change", "addition_subtraction"] },
  { key: "sea-cross", prompt: "A drone moves vertically from -9 m to 2 m relative to sea level. What is the directed change?", start: -9, end: 2, change: 11, answer: 11, interpretation: "+11 m", explanation: "Directed change is end minus start: 2 - (-9) = 11. The positive result records an upward change.", tag: "subtracts_magnitudes_only", coverage: ["contexts", "directed_change", "operation_reasoning"] },
  { key: "deeper-change", prompt: "A probe moves from -7 m to -15 m. What is the directed change?", start: -7, end: -15, change: -8, answer: -8, interpretation: "-8 m", explanation: "End minus start gives -15 - (-7) = -8. The negative sign records that the probe moved downward by 8 m.", tag: "distance_given_signed_direction", coverage: ["contexts", "directed_change", "distance"] },
  { key: "depth-distance", prompt: "What is the distance between elevations -14 m and 5 m?", start: -14, end: 5, change: 19, answer: 19, interpretation: "19 m distance", explanation: "Distance is non-negative. There are 14 units from -14 to zero and 5 more to 5, giving 19 m.", tag: "distance_is_negative", coverage: ["contexts", "distance", "number_lines"] },
  { key: "negative-distance", prompt: "What is the distance between -16 and -6 on a signed scale?", start: -16, end: -6, change: 10, answer: 10, interpretation: "10 units", explanation: "Distance is the absolute difference: |-6 - (-16)| = |10| = 10. Both endpoints being negative does not make the distance negative.", tag: "distance_is_negative", coverage: ["distance", "number_lines", "operation_reasoning"] },
];

const reasoningCases = [
  { key: "negative-order", prompt: "Which explanation correctly compares -9 and -4?", answer: "-4 is greater because it lies to the right of -9", distractors: ["-9 is greater because 9 is larger", "They are equal because both are negative", "Ignore both negative signs"], explanation: "Order depends on the complete signed values. -4 lies to the right of -9, so -4 is greater even though its magnitude is smaller.", tag: "magnitude_confused_with_order", coverage: ["ordering", "number_lines", "misconceptions"] },
  { key: "negative-sign", prompt: "In the number -6, what role does the negative sign have?", answer: "It is part of the signed value and places the number below zero", distractors: ["It is always an instruction to subtract", "It can be ignored during comparison", "It means the magnitude is positive six"], explanation: "A negative sign can identify a negative number, while a subtraction sign between expressions denotes an operation. Context and position distinguish these roles.", tag: "negative_sign_as_subtraction", coverage: ["operation_reasoning", "misconceptions"] },
  { key: "subtract-positive", prompt: "Why does 3 - 7 move left from 3?", answer: "Subtracting positive 7 is equivalent to adding -7", distractors: ["Every expression with two numbers moves left", "The answer must be positive", "Seven changes into zero"], explanation: "Rewrite subtraction as adding the opposite: 3 - 7 = 3 + (-7). Adding a negative change moves seven places left to -4.", tag: "subtraction_always_left", coverage: ["addition_subtraction", "operation_reasoning"] },
  { key: "subtract-negative", prompt: "Why does -5 - (-8) move right?", answer: "Subtracting -8 is adding its opposite, +8", distractors: ["Two negative signs can always be deleted", "Subtraction must move left", "The starting negative becomes positive first"], explanation: "The opposite of -8 is +8, so -5 - (-8) = -5 + 8 = 3. The direction follows the equivalent addition, not a slogan about adjacent signs.", tag: "subtraction_always_left", coverage: ["addition_subtraction", "operation_reasoning", "misconceptions"] },
  { key: "slogan-limit", prompt: "What is wrong with saying 'two negatives make a positive' in every situation?", answer: "The result depends on the operation; -3 + (-2) is -5, while subtracting -2 adds its opposite", distractors: ["The slogan proves every negative answer is positive", "Negative numbers cannot be added", "Signs never affect operations"], explanation: "Sign rules must be tied to a named operation. Adding two negative values differs from multiplying negatives or subtracting a negative.", tag: "sign_slogan_overgeneralised", coverage: ["addition_subtraction", "operation_reasoning", "misconceptions"] },
  { key: "distance-change", prompt: "How do distance and directed change differ for movement from 4 to -3?", answer: "The distance is 7, while the directed change is -7", distractors: ["Both are -7", "Both are 1", "Distance is -7 and change is 7"], explanation: "Distance records the non-negative separation |4 - (-3)| = 7. Directed change is end minus start, -3 - 4 = -7, including downward or leftward direction.", tag: "distance_given_signed_direction", coverage: ["distance", "directed_change", "operation_reasoning"] },
  { key: "opposite", prompt: "Which statement about opposites is correct?", answer: "A number and its opposite are the same distance from zero on different sides", distractors: ["The opposite is always smaller", "The opposite of -6 is -6", "Opposites have different magnitudes"], explanation: "Opposites have equal magnitude and positions reflected across zero. For example, -6 and 6 are both six units from zero.", tag: "opposite_confused_with_absolute", coverage: ["number_lines", "distance", "operation_reasoning"] },
  { key: "absolute", prompt: "What does |-12| represent?", answer: "The distance of -12 from zero, which is 12", distractors: ["A direction of -12", "Subtract 12 from zero twice", "A value smaller than -12"], explanation: "Absolute value measures distance from zero, so it is non-negative. The point -12 is twelve units from zero.", tag: "absolute_value_keeps_negative", coverage: ["distance", "number_lines", "misconceptions"] },
  { key: "zero", prompt: "Which statement about zero is accurate?", answer: "Zero is neither positive nor negative and is its own opposite", distractors: ["Zero is a negative number", "Zero lies to the right of every positive number", "Zero has distance one from itself"], explanation: "Zero is the reference separating positive and negative values. Its opposite is zero and its distance from itself is zero.", tag: "zero_is_positive", coverage: ["ordering", "number_lines", "operation_reasoning"] },
  { key: "commutative", prompt: "Which operation reasoning is valid?", answer: "Addition is commutative, so -3 + 8 equals 8 + (-3)", distractors: ["Subtraction is commutative, so 2 - 7 equals 7 - 2", "All signs can be reordered without brackets", "Distance and change are interchangeable"], explanation: "Addition can be reordered without changing the sum when each sign stays attached to its term. Subtraction is not commutative.", tag: "subtraction_commutative", coverage: ["addition_subtraction", "operation_reasoning"] },
  { key: "parentheses", prompt: "Why are brackets useful in 4 - (-3)?", answer: "They show that -3 is the complete number being subtracted", distractors: ["They multiply 4 and 3", "They remove all negative signs", "They make the answer negative"], explanation: "The brackets distinguish the negative sign belonging to -3 from the subtraction operation. Subtracting that complete value is equivalent to adding +3.", tag: "negative_sign_as_subtraction", coverage: ["addition_subtraction", "operation_reasoning"] },
  { key: "counterexample", prompt: "A learner says adding always makes a number greater. Which counterexample repairs the claim?", answer: "5 + (-8) = -3, which is less than 5", distractors: ["5 + 8 = 13", "-3 + 0 = -3", "8 - 5 = 3"], explanation: "Adding a negative value represents a negative directed change and can decrease the result. The effect depends on the sign of the addend, not the word adding alone.", tag: "addition_always_increases", coverage: ["addition_subtraction", "operation_reasoning", "misconceptions"] },
];

const retrievalCases = [
  { key: "opposite", prompt: "What is the opposite of -12?", answer: 12, choices: [12, -12, 0, 1], explanation: "The opposite lies the same distance from zero on the other side, so the opposite of -12 is 12.", tag: "opposite_confused_with_absolute", coverage: ["number_lines", "operation_reasoning"] },
  { key: "absolute", prompt: "Find |-9|.", answer: 9, choices: [9, -9, 0, 18], explanation: "Absolute value is distance from zero. -9 is nine units from zero, so |-9| = 9.", tag: "absolute_value_keeps_negative", coverage: ["distance", "number_lines"] },
  { key: "distance-cross", prompt: "Find the distance between -6 and 4.", answer: 10, choices: [10, -10, 2, 24], explanation: "There are six units from -6 to zero and four more to 4, so the distance is 10.", tag: "distance_is_negative", coverage: ["distance", "number_lines"] },
  { key: "change-down", prompt: "Find the directed change from 3 to -8.", answer: -11, choices: [-11, 11, -5, 5], explanation: "Directed change is end minus start: -8 - 3 = -11. The sign records movement left or downward.", tag: "distance_given_signed_direction", coverage: ["directed_change", "addition_subtraction"] },
  { key: "greatest", prompt: "Which integer is greater: -5 or -2? Enter the greater integer.", answer: -2, choices: [-2, -5, 2, 5], explanation: "-2 lies to the right of -5 on the number line, so -2 is greater.", tag: "magnitude_confused_with_order", coverage: ["ordering", "number_lines"] },
  { key: "add-cross", prompt: "Calculate -7 + 12.", answer: 5, choices: [5, -5, 19, -19], explanation: "Starting at -7 and moving twelve right crosses zero and lands at 5.", tag: "negative_start_forces_negative_answer", coverage: ["addition_subtraction", "number_lines"] },
  { key: "add-negative", prompt: "Calculate 6 + (-14).", answer: -8, choices: [-8, 8, 20, -20], explanation: "Adding -14 means moving fourteen left from 6, which lands at -8.", tag: "ignores_negative_change", coverage: ["addition_subtraction", "directed_change"] },
  { key: "subtract", prompt: "Calculate -3 - 8.", answer: -11, choices: [-11, 11, 5, -5], explanation: "Subtracting positive eight is adding -8. From -3, move eight left to -11.", tag: "subtraction_always_left", coverage: ["addition_subtraction", "operation_reasoning"] },
  { key: "subtract-negative", prompt: "Calculate 2 - (-9).", answer: 11, choices: [11, -7, 7, -11], explanation: "Subtracting -9 is adding its opposite, +9. Therefore 2 + 9 = 11.", tag: "sign_slogan_overgeneralised", coverage: ["addition_subtraction", "operation_reasoning"] },
  { key: "zero-pair", prompt: "Calculate -15 + 15.", answer: 0, choices: [0, -30, 30, 1], explanation: "-15 and 15 are opposites. Equal negative and positive changes form a zero pair, so the sum is 0.", tag: "opposites_do_not_cancel", coverage: ["addition_subtraction", "operation_reasoning"] },
  { key: "negative-pair", prompt: "Calculate -4 + (-6).", answer: -10, choices: [-10, 10, 2, -2], explanation: "Adding two negative values combines their negative changes: four left and six more left gives -10.", tag: "two_negatives_always_positive", coverage: ["addition_subtraction", "misconceptions"] },
];

const orderCandidates = Array.from({ length: 48 }, (_, index) => buildOrder(index));
const contextCandidates = cross(contextCases, routes, (item, route, index) => candidate({
  id: `context-${item.key}-${route.key}`, format: "operation-model", blueprint: "context-change-models", band: "developing", strand: item.coverage.includes("distance") ? "distance" : "contexts", coverage: item.coverage,
  prompt: `${route.label}: ${item.prompt}`, body: { start: item.start, end: item.end, directed_change: item.end - item.start, stated_change: item.change, interpretation: item.interpretation, choices: rotate(integerChoices(item.answer, [item.end - item.start, Math.abs(item.end - item.start), item.start + item.end, -item.answer]), index % 4), representation: route.representation }, answer: item.answer,
  hints: ["Mark the start and zero, then decide whether the required answer is an endpoint, directed change or non-negative distance.", "For directed change use end - start; for distance use the absolute difference."], explanation: item.explanation, tag: item.tag,
  concrete: "signed floor strip or vertical scale with a fixed zero reference and separate direction and distance cards", repair: "Record START, CHANGE, END and DISTANCE in separate boxes, then move one equal interval at a time or use the static difference table.", index,
}));
const operationCandidates = Array.from({ length: 48 }, (_, index) => buildOperation(index));
const reasoningCandidates = cross(reasoningCases, routes, (item, route, index) => candidate({
  id: `reason-${item.key}-${route.key}`, format: "reason-choice", blueprint: "sign-rule-reasoning-probes", band: "secure", strand: "operation_reasoning", coverage: item.coverage,
  prompt: `${route.label}: ${item.prompt}`, body: { choices: rotate([item.answer, ...item.distractors], index % 4), explanation_frame: "The sign means ___ in this operation, so the movement or comparison is ___.", representation: route.representation }, answer: item.answer,
  hints: ["Name the operation before applying any sign rule or movement direction.", "Check the complete signed values on a line and use a counterexample if the claim uses always or never."], explanation: item.explanation, tag: item.tag,
  concrete: "operation cards that separate unary negative, subtraction and signed movement, beside a fixed number line", repair: "Underline the operation sign and circle signs belonging to numbers, then rewrite subtraction as adding the opposite before reasoning.", index,
}));
const retrievalCandidates = cross(retrievalCases, routes, (item, route, index) => candidate({
  id: `retrieval-${item.key}-${route.key}`, format: "integer-input", blueprint: "negative-number-retrieval", band: "retrieval", strand: item.coverage[0], coverage: [...item.coverage, "retrieval"],
  prompt: `${route.label}: ${item.prompt}`, body: { choices: rotate(item.choices, index % 4), integer_input_required: true, retrieval_interval_days: [1, 3, 7, 14, 30][index % 5], representation: route.representation }, answer: item.answer,
  hints: ["Use the mini line, signed counters or opposite card before entering the integer.", "Keep direction, endpoint and distance as separate ideas, and check the sign of the final value."], explanation: item.explanation, tag: item.tag,
  concrete: "pocket number line and embossed signed counters with a zero-pair frame", repair: "Choose one strategy route, show one movement or zero-pair step, then enter the signed integer without a timer.", index,
}));

const generated = [...orderCandidates, ...contextCandidates, ...operationCandidates, ...reasoningCandidates, ...retrievalCandidates];
pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa.notes = "Year 7 negative numbers reaches the 240-item pilot target with four preserved curated variants and 236 deterministic review candidates covering ordering, number lines, integer addition and subtraction, neutral contexts, directed change, distance, operation reasoning and misconceptions. Every generated item includes labelled visual, tactile/concrete, static text and spoken routes; keyboard, switch, eye-gaze, AAC, oral and partner-mediated interactions; rich strategy and misconception feedback; and private expedition progress without timers, speed scores, lives, streak pressure, leaderboards or peer comparison. Independent mathematics, teacher, SEND, accessibility, safeguarding, renderer and pilot review remain required before promotion.";

validateBank(pack, curated, generated);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`negative-numbers-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`negative-numbers-bank blueprints=${summary(generated, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`negative-numbers-bank strands=${summary(generated, (variant) => variant.body.negative_number_strand)}`);
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`negative-numbers-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 7 negative-numbers bank is out of date; run generate-y7-negative-numbers-bank.mjs --write.");
  console.log("negative-numbers-bank deterministic check passed");
} else {
  console.log("negative-numbers-bank dry-run; pass --write to update the pack");
}

function buildOrder(index) {
  const route = routes[index % routes.length];
  const mode = index % 4;
  let values;
  let step;
  if (mode === 0) { const k = index % 4; values = [-12 - k, -5 + k, 0, 3 + k, 10 + k]; step = 1; }
  else if (mode === 1) { const k = index % 3; values = [-19 - k, -13 + k, -8 - k, -3 + k]; step = 1; }
  else if (mode === 2) { const k = (index % 3) * 2; values = [-18 + k, -10 + k, -2 + k, 6 + k, 14 + k]; step = 2; }
  else { const k = (index % 2) * 5; values = [-30 + k, -15 + k, 0 + k, 15 + k, 30 + k]; step = 5; }
  if (new Set(values).size !== values.length) throw new Error(`Order case ${index} generated duplicate values.`);
  const answer = [...values].sort((a, b) => a - b);
  const minimum = Math.floor((Math.min(...values) - step) / step) * step;
  const maximum = Math.ceil((Math.max(...values) + step) / step) * step;
  return candidate({
    id: `order-${index + 1}-${route.key}`, format: "number-line", blueprint: "signed-order-lines", band: "intro", strand: "ordering", coverage: ["ordering", "number_lines", "misconceptions"],
    prompt: `${route.label} ${index + 1}: place and order ${values.join(", ")} from least to greatest.`, body: { values, range: [minimum, maximum], step, partially_labelled: index % 2 === 0, representation: route.representation }, answer,
    hints: ["Equal intervals represent equal changes; values increase to the right or upward.", "For negative values, compare complete positions rather than the sizes of the digits."],
    explanation: `${answer.join(" < ")} because this is their left-to-right order on a line with equal intervals. Distance from zero is not the same as numerical order.`, tag: "magnitude_confused_with_order",
    concrete: "tactile floor line with a raised zero marker, equal interval notches and movable signed cards", repair: "Anchor zero and the scale step first, place one value at a time, then read from the least position to the greatest.", index,
  });
}

function buildOperation(index) {
  const route = routes[index % routes.length];
  const a = 2 + (index % 11);
  const b = 3 + ((index * 3) % 10);
  const mode = index % 8;
  const cases = [
    { left: -a, operation: "+", right: b },
    { left: a, operation: "+", right: -b },
    { left: -a, operation: "+", right: -b },
    { left: a, operation: "-", right: b },
    { left: -a, operation: "-", right: b },
    { left: a, operation: "-", right: -b },
    { left: -a, operation: "-", right: -b },
    { left: b, operation: "-", right: a },
  ];
  const item = cases[mode];
  const result = item.operation === "+" ? item.left + item.right : item.left - item.right;
  const equivalent = item.operation === "+" ? `${item.left} + (${item.right})` : `${item.left} + (${opposite(item.right)})`;
  const expression = `${item.left} ${item.operation} (${item.right})`;
  const choices = integerChoices(result, [-result, item.left + item.right, item.left - item.right, Math.abs(item.left) + Math.abs(item.right)]);
  return candidate({
    id: `operation-${index + 1}-${route.key}`, format: "operation-model", blueprint: "add-subtract-integer-models", band: "expected", strand: "addition_subtraction", coverage: ["addition_subtraction", "number_lines", "operation_reasoning", "misconceptions"],
    prompt: `${route.label} ${index + 1}: calculate ${expression} by rewriting subtraction as adding the opposite where needed.`, body: { expression, left: item.left, operation: item.operation, right: item.right, equivalent_addition: equivalent, result, movement: `${Math.abs(item.operation === "+" ? item.right : opposite(item.right))} places ${(item.operation === "+" ? item.right : opposite(item.right)) >= 0 ? "right" : "left"}`, choices: rotate(choices, index % 4), representation: route.representation }, answer: result,
    hints: ["If the operation is subtraction, keep the first number and add the opposite of the second number.", "The sign of the added value determines movement: positive right, negative left."],
    explanation: `${expression} becomes ${equivalent}. Starting at ${item.left}, the signed movement lands on ${result}; the operation and the signs keep their distinct roles.`,
    tag: item.operation === "-" ? "subtraction_always_left" : item.right < 0 ? "addition_always_increases" : "negative_start_forces_negative_answer",
    concrete: "signed counters with zero-pair frames beside a number line showing the equivalent-addition movement", repair: "Separate operation and number signs, rewrite as addition, then verify the same result with counters and one line movement.", index,
  });
}

function candidate({ id, format, blueprint, band, strand, coverage, prompt, body, answer, hints, explanation, tag, concrete, repair, index }) {
  const fullId = `${prefix}${id}`;
  return {
    id: fullId,
    format,
    body: {
      prompt,
      ...body,
      negative_number_strand: strand,
      coverage_tags: [...new Set([...coverage, "misconceptions"])],
      evidence_purpose: `${strand}_signed_number_reasoning`,
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
      difficulty_band: band,
      response_mode: "tap_keyboard_switch_eye_gaze_aac_oral_partner_or_adult_scribed",
      supported_interactions: ["tap", "keyboard", "switch_scan", "eye_gaze", "aac", "oral_response", "partner_scan", "adult_scribed"],
      interaction_support: { keyboard: true, switch_scan: true, touch: true, eye_gaze: true, aac: true, oral_or_partner_response: true, precision_drag_required: false, select_move_up_down_alternative: true, direct_integer_entry: true, undo_available: true },
      concrete_scaffold: concrete,
      visual_scaffold: "equal-interval number line or vertical scale with persistent zero, signed arrows and labels; colour is never the only cue",
      tactile_scaffold: "raised zero marker, interval notches, embossed plus/minus cards and signed counters",
      text_scaffold: "START, OPERATION or CHANGE, END and DISTANCE table with one signed step per line",
      static_alternative: "numbered positions, arrow description and calculation table containing the complete task without motion",
      reduced_motion_alternative: "instant before-and-after states with persistent arrow labels and no automatic travel animation",
      reduced_visual_load: true,
      one_movement_or_operation_per_screen_option: true,
      sentence_stems: ["The sign belongs to ___ and means ___.", "I start at ___ and move ___, so I finish at ___.", "The distance is ___ but the directed change is ___."],
      context_policy: "fictional, neutral expedition, temperature, elevation or score setting; no real debt, loss, competition or public ranking is required",
      timed: false,
      timer_allowed: false,
      speed_score_allowed: false,
      leaderboard_allowed: false,
      peer_comparison_allowed: false,
    },
    expected_answer: { value: answer },
    hints,
    explanation,
    feedback: {
      correct: `Expedition coordinate verified. ${explanation}`,
      try_again: `No timer and no lost progress. ${hints[0]}`,
      misconception: `The '${tag.replaceAll("_", " ")}' route conflicts with the signed model. ${hints[1]}`,
      strategy: repair,
      operation_check: "Name the operation, keep signs attached to numbers, and use adding the opposite only when rewriting subtraction.",
      distance_change_check: "Distance is non-negative separation; directed change is end minus start and keeps direction.",
    },
    gamification: {
      mission: missionFor(strand),
      objective: "Restore one expedition coordinate by justifying order, direction, endpoint or distance.",
      reward: `private_compass_marker_${(index % 8) + 1}`,
      strategy_choice: "Choose line, lift map, signed counters or static cards; route choice and replay are not scored.",
      individual_progress_only: true,
      no_timer: true,
      no_lost_lives: true,
      no_streak_pressure: true,
      leaderboard: false,
      peer_comparison: false,
      retry_encouraged: true,
    },
    difficulty: { intro: 3, developing: 5, expected: 6, secure: 8, retrieval: 5 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: hookFor(strand),
  };
}

function validateBank(currentPack, authored, candidates) {
  if (authored.length !== 4) throw new Error(`Expected exactly 4 curated variants, found ${authored.length}.`);
  if (candidates.length !== pilotTarget - authored.length || currentPack.question_variants.length !== pilotTarget) throw new Error(`Expected ${pilotTarget} total variants with ${pilotTarget - authored.length} generated.`);
  const blueprints = new Map(currentPack.variant_blueprints.map((blueprint) => [blueprint.id, blueprint]));
  const formats = new Set(currentPack.practice.formats);
  const requiredCoverage = new Set(["ordering", "number_lines", "addition_subtraction", "contexts", "directed_change", "distance", "operation_reasoning", "misconceptions"]);
  const actualCoverage = new Set();
  const actualFormats = new Set();
  const actualBlueprints = new Set();
  const ids = new Set();
  const signatures = new Set();
  for (const variant of currentPack.question_variants) {
    if (ids.has(variant.id)) throw new Error(`Duplicate id ${variant.id}.`);
    ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${JSON.stringify(variant.expected_answer)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`);
    signatures.add(signature);
  }
  for (const variant of candidates) {
    const blueprint = blueprints.get(variant.body.variant_blueprint_id);
    if (!blueprint || blueprint.format !== variant.format || blueprint.difficulty_band !== variant.body.difficulty_band) throw new Error(`${variant.id} does not match its blueprint.`);
    if (!formats.has(variant.format) || variant.status !== "review" || variant.body.review_batch !== reviewBatch) throw new Error(`${variant.id} has unsupported format, status or provenance.`);
    if (!variant.body.interaction_support?.keyboard || !variant.body.interaction_support?.switch_scan || !variant.body.interaction_support?.eye_gaze || !variant.body.interaction_support?.aac || variant.body.interaction_support?.precision_drag_required !== false) throw new Error(`${variant.id} lacks supported interactions.`);
    if (!variant.body.concrete_scaffold || !variant.body.visual_scaffold || !variant.body.tactile_scaffold || !variant.body.text_scaffold || !variant.body.static_alternative || variant.body.reduced_visual_load !== true) throw new Error(`${variant.id} lacks SEND visual or concrete scaffolds.`);
    if (variant.body.timed || variant.body.timer_allowed || variant.body.speed_score_allowed || variant.body.leaderboard_allowed || variant.body.peer_comparison_allowed) throw new Error(`${variant.id} introduces speed or social pressure.`);
    if (!variant.feedback?.correct || !variant.feedback?.try_again || !variant.feedback?.misconception || !variant.feedback?.strategy || !variant.feedback?.operation_check || !variant.feedback?.distance_change_check || variant.hints.length < 2 || variant.explanation.length < 60) throw new Error(`${variant.id} lacks rich feedback.`);
    if (!variant.gamification?.individual_progress_only || !variant.gamification?.no_timer || !variant.gamification?.no_lost_lives || !variant.gamification?.no_streak_pressure || variant.gamification?.leaderboard || variant.gamification?.peer_comparison) throw new Error(`${variant.id} has unsuitable gamification.`);
    if (Array.isArray(variant.expected_answer.value)) {
      if (variant.format !== "number-line" || variant.expected_answer.value.length !== variant.body.values.length || !isAscending(variant.expected_answer.value)) throw new Error(`${variant.id} has an invalid ordered answer.`);
    } else if (!Array.isArray(variant.body.choices) || new Set(variant.body.choices).size !== variant.body.choices.length || variant.body.choices.filter((choice) => choice === variant.expected_answer.value).length !== 1) {
      throw new Error(`${variant.id} must offer its answer exactly once.`);
    }
    if (variant.body.variant_blueprint_id === "context-change-models" && variant.body.directed_change !== variant.body.end - variant.body.start) throw new Error(`${variant.id} has inconsistent directed change.`);
    if (variant.body.variant_blueprint_id === "add-subtract-integer-models") {
      const expected = variant.body.operation === "+" ? variant.body.left + variant.body.right : variant.body.left - variant.body.right;
      if (variant.body.result !== expected || variant.expected_answer.value !== expected) throw new Error(`${variant.id} has inconsistent integer arithmetic.`);
    }
    for (const tag of variant.body.coverage_tags) actualCoverage.add(tag);
    actualFormats.add(variant.format);
    actualBlueprints.add(variant.body.variant_blueprint_id);
  }
  requireCoverage("content", requiredCoverage, actualCoverage);
  requireCoverage("formats", formats, actualFormats);
  requireCoverage("blueprints", new Set(blueprints.keys()), actualBlueprints);
  const allocation = countBy(candidates, (variant) => variant.body.variant_blueprint_id);
  const expectedAllocation = { "signed-order-lines": 48, "context-change-models": 48, "add-subtract-integer-models": 48, "sign-rule-reasoning-probes": 48, "negative-number-retrieval": 44 };
  for (const [id, expected] of Object.entries(expectedAllocation)) if (allocation[id] !== expected) throw new Error(`${id} expected ${expected}, found ${allocation[id] ?? 0}.`);
}

function integerChoices(answer, candidates) { const values = [answer]; for (const value of candidates) if (Number.isInteger(value) && !values.includes(value)) values.push(value); for (const fallback of [0, 1, -1, answer + 1, answer - 1]) if (values.length < 4 && !values.includes(fallback)) values.push(fallback); return values.slice(0, 4); }
function opposite(value) { return -value; }
function isAscending(values) { return values.every((value, index) => index === 0 || values[index - 1] < value); }
function missionFor(strand) { return { ordering: "Chart the Signed Ridge", number_lines: "Calibrate the Coordinate Trail", contexts: "Stabilise the Climate Camp", directed_change: "Decode the Expedition Movement Log", distance: "Measure the Zero-Crossing Route", addition_subtraction: "Repair the Integer Engine", operation_reasoning: "Audit the Sign-Rule Compass", retrieval: "Recover a Spaced Coordinate" }[strand] ?? "Restore the Negative Number Expedition Map"; }
function hookFor(strand) { return { ordering: "signed-line-scan", number_lines: "signed-line-position", contexts: "signed-context-align", directed_change: "directed-change-arrow", distance: "distance-bracket-trace", addition_subtraction: "opposite-transform-move", operation_reasoning: "sign-role-debug" }[strand] ?? "signed-coordinate-lock"; }
function cross(items, routeItems, builder) { const variants = []; for (const item of items) for (const route of routeItems) variants.push(builder(item, route, variants.length)); return variants; }
function requireCoverage(label, required, actual) { const missing = [...required].filter((item) => !actual.has(item)); if (missing.length) throw new Error(`Missing ${label} coverage: ${missing.join(", ")}.`); }
function countBy(items, keyFor) { const counts = {}; for (const item of items) { const key = keyFor(item); counts[key] = (counts[key] ?? 0) + 1; } return counts; }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function summary(items, keyFor) { const counts = countBy(items, keyFor); return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
