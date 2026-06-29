#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/ma-y1-number-bonds.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y1-number-bonds-bank-";
const reviewBatch = "y1-number-bonds-pilot-a";
const pilotAllocation = {
  "small-whole-concrete-splits": 40,
  "bonds-to-ten-frame-complements": 40,
  "teen-whole-part-builds": 40,
  "turnaround-related-fact-choices": 40,
  "spaced-bond-retrieval-and-transfer": 40,
};

const treasureSets = ["moon gems", "shell tokens", "golden seeds", "map stars", "crystal keys", "rainbow pebbles", "dragon scales", "story coins"];
const representations = ["part-whole pots", "two-colour counters", "bead string", "number track", "ten-frame", "twenty-frame"];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y1-number-bonds") throw new Error("This generator only supports the Year 1 number-bonds pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedCounts = countBy(curated, (variant) => variant.body?.variant_blueprint_id);
const targets = Object.fromEntries(Object.entries(pilotAllocation).map(([id, target]) => [id, target - (curatedCounts[id] ?? 0)]));
for (const [id, target] of Object.entries(targets)) if (target < 0) throw new Error(`Curated variants exceed the allocation for ${id}.`);

const generated = [
  ...smallWholeCandidates(targets["small-whole-concrete-splits"]),
  ...tenFrameCandidates(targets["bonds-to-ten-frame-complements"]),
  ...teenWholeCandidates(targets["teen-whole-part-builds"]),
  ...relatedFactCandidates(targets["turnaround-related-fact-choices"]),
  ...retrievalCandidates(targets["spaced-bond-retrieval-and-transfer"]),
];

pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa.notes = "Review-stage Year 1 number-bonds pack with a deterministic 200-item pilot bank. Three curated variants are preserved alongside candidates covering conserved part-whole splits to 5, complements and all systematic bonds to 10, flexible bonds within 20, missing parts, one-up/one-down patterns, turnaround addition facts and related subtraction checks. Generated items offer counters, tactile pots, frames, bead strings, number tracks, verbal routes and supported interactions. Feedback separates parts from wholes and repairs guessing, double-counting and unrelated-fact misconceptions. Joyful treasure missions reward building and checking without timers, speed bonuses, streak loss or precision-only demands. Independent mathematics, SEND, narration and renderer review remains required before promotion.";

validateBank(pack, curated, generated);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y1-number-bonds-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y1-number-bonds-bank blueprints=${summary(pack.question_variants, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`y1-number-bonds-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y1-number-bonds-bank concepts=${summary(generated, (variant) => variant.body.concept_focus)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y1-number-bonds-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 1 number-bonds bank is out of date; run generate-y1-number-bonds-bank.mjs --write.");
  console.log("y1-number-bonds-bank deterministic check passed");
} else {
  console.log("y1-number-bonds-bank dry-run; pass --write to update the pack");
}

function smallWholeCandidates(count) {
  const facts = [];
  for (let whole = 3; whole <= 5; whole += 1) for (let part = 0; part <= whole; part += 1) facts.push({ whole, part, missing: whole - part });
  return Array.from({ length: count }, (_, index) => {
    const item = facts[index % facts.length];
    const treasure = treasureSets[Math.floor(index / facts.length) % treasureSets.length];
    const model = representations[index % 4];
    return candidate({
      id: `small-${item.whole}-${item.part}-${index + 1}`, format: "part-whole-build", blueprint: "small-whole-concrete-splits", band: "intro", concept: "conserved_small_whole_split",
      prompt: `Treasure split ${index + 1}: ${item.whole} ${treasure} make the whole. Put ${item.part} in one part. How many fill the other part?`,
      body: { whole: item.whole, given_part: item.part, missing_part: item.missing, counter_count: item.whole, choices: rotate(numberChoices(item.missing, item.whole, item.part), index % 4), representation: model, conservation_rule: "every_object_belongs_to_exactly_one_part", interaction_mode: "drag_tap_auto_place_keyboard_switch_or_say_count" }, answer: item.missing,
      hints: [`Keep all ${item.whole} ${treasure} visible.`, `Move ${item.part} into one pot, then count the ${item.missing} in the other pot.`],
      explanation: `${item.part} and ${item.missing} are the two parts. Together they make the whole ${item.whole}: ${item.part} + ${item.missing} = ${item.whole}. No object is lost or counted twice.`, difficulty: 2, tag: "objects_lost_or_double_counted", hook: "treasure-two-pots",
      correct: `Treasure conserved: ${item.part} and ${item.missing} make ${item.whole}.`, repair: "Return every counter to the WHOLE tray, count once, then move each counter into exactly one part pot.",
      concrete: `Use ${item.whole} large counters and two tactile pots; auto-place and adult-assisted counting are available.`, visual: "A static whole tray and two clearly bounded part pots use shape labels as well as colour.",
    });
  });
}

function tenFrameCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const filled = index % 11;
    const empty = 10 - filled;
    const round = Math.floor(index / 11);
    const layout = ["canonical left-to-right", "five-and-some", "two-colour split", "tactile cell map"][round % 4];
    return candidate({
      id: `ten-${filled}-${index + 1}`, format: "ten-frame-split", blueprint: "bonds-to-ten-frame-complements", band: "developing", concept: round === 3 ? "systematic_bonds_to_ten" : "complement_to_ten",
      prompt: `Make-ten vault ${index + 1}: ${filled} spaces are filled. How many more counters complete the ten-frame?`,
      body: { whole: 10, filled, empty, given_part: filled, missing_part: empty, choices: rotate(numberChoices(empty, 10, filled), index % 4), frame_layout: layout, systematic_neighbours: { previous: filled > 0 ? [filled - 1, empty + 1] : null, current: [filled, empty], next: filled < 10 ? [filled + 1, empty - 1] : null }, interaction_mode: "tap_empty_cells_choose_number_keyboard_switch_or_place_tokens" }, answer: empty,
      hints: ["The whole frame has ten spaces.", `Count the ${empty} empty spaces; filled and empty spaces together total ten.`],
      explanation: `${filled} and ${empty} make 10. When the filled part goes up by one, the empty part goes down by one, so the whole stays 10.`, difficulty: 3, tag: filled === empty ? "parts_must_be_different" : "missing_part_guess", hook: "treasure-ten-frame-vault",
      correct: `Vault complete: ${filled} + ${empty} = 10.`, repair: "Touch or hear each empty frame cell once, then check that filled plus empty accounts for all ten spaces.",
      concrete: "Use a tactile ten-frame with fixed cell boundaries and counters, or a bead string stopped at ten.", visual: "Canonical five-and-ten structure remains visible; cell patterns are audio-described and never colour-only.",
    });
  });
}

function teenWholeCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const whole = 11 + (index % 10);
    const round = Math.floor(index / 10);
    const part = teenPart(whole, round);
    const missing = whole - part;
    const model = ["full ten and loose ones", "twenty-frame split", "bead string", "part-whole bar"][round % 4];
    return candidate({
      id: `teen-${whole}-${part}-${index + 1}`, format: "part-whole-build", blueprint: "teen-whole-part-builds", band: "expected", concept: round === 0 ? "ten_and_some_bond" : "flexible_bond_within_twenty",
      prompt: `Crystal chest ${index + 1}: the whole is ${whole}. One part is ${part}. What is the missing part?`,
      body: { whole, given_part: part, missing_part: missing, choices: rotate(numberChoices(missing, whole, part), index % 4), representation: model, ten_structure: { full_ten_visible: true, extra_ones: whole - 10 }, equation_model: `${part} + ? = ${whole}`, interaction_mode: "build_frame_choose_keyboard_switch_number_track_or_say" }, answer: missing,
      hints: ["Keep the whole and given part visible.", round === 0 ? `See one full ten and ${whole - 10} extra ones.` : `Count from ${part} to ${whole}, or cover ${part} in the whole.`],
      explanation: `${part} and ${missing} make ${whole}: ${part} + ${missing} = ${whole}. The full ten and extra ones stay visible; no column method is needed.`, difficulty: 4, tag: "missing_part_guess", hook: "treasure-crystal-chest",
      correct: `Chest balanced: ${part} and ${missing} make ${whole}.`, repair: "Build the whole on a twenty-frame, cover the known part and count only the uncovered counters.",
      concrete: `Use ${whole} counters on a tactile twenty-frame, a bead string or two part pots.`, visual: "A full ten is bracketed beside extra ones, with the given and missing parts labelled by pattern and text.",
    });
  });
}

function relatedFactCandidates(count) {
  const facts = bondFacts().filter((item) => item.whole >= 5);
  return Array.from({ length: count }, (_, index) => {
    const item = facts[(index * 7 + 3) % facts.length];
    const mode = index % 4;
    let answer;
    let prompt;
    let choices;
    let concept;
    if (mode === 0) {
      answer = `${item.part} + ${item.other} = ${item.whole}`;
      prompt = `Which addition fact matches the model with whole ${item.whole} and parts ${item.part} and ${item.other}?`;
      choices = equationChoices(answer, `${item.part} + ${item.whole} = ${item.part + item.whole}`, `${item.whole} + ${item.other} = ${item.whole + item.other}`);
      concept = "addition_from_part_whole";
    } else if (mode === 1) {
      answer = `${item.other} + ${item.part} = ${item.whole}`;
      prompt = `Turn the two parts around. Which addition fact keeps the same whole ${item.whole}?`;
      choices = equationChoices(answer, `${item.whole} + ${item.part} = ${item.whole + item.part}`, `${item.other} + ${item.whole} = ${item.other + item.whole}`);
      concept = "turnaround_addition";
    } else if (mode === 2) {
      answer = `${item.whole} − ${item.part} = ${item.other}`;
      prompt = `Cover the part ${item.part} in the whole ${item.whole}. Which subtraction shows the other part?`;
      choices = equationChoices(answer, `${item.part} − ${item.other} = ${Math.max(0, item.part - item.other)}`, `${item.whole} − ${item.other} = ${item.part}`);
      concept = "related_subtraction";
    } else {
      answer = `${item.part} + ${item.other} = ${item.whole} and ${item.whole} − ${item.part} = ${item.other}`;
      prompt = `Which pair of facts uses the same whole ${item.whole} and parts ${item.part} and ${item.other}?`;
      choices = [answer, `${item.part} + ${item.whole} = ${item.part + item.whole} and ${item.whole} − ${item.other} = ${item.part}`, `${item.part} − ${item.other} = ${Math.max(0, item.part - item.other)} and ${item.whole} + ${item.other} = ${item.whole + item.other}`];
      concept = "inverse_fact_link";
    }
    return candidate({
      id: `facts-${item.whole}-${item.part}-${mode}-${index + 1}`, format: "tap-choice", blueprint: "turnaround-related-fact-choices", band: "secure", concept,
      prompt: `Fact-key quest ${index + 1}: ${prompt}`, body: { model: { whole: item.whole, parts: [item.part, item.other] }, choices: rotate(unique(choices), index % choices.length), choice_audio: true, representation: representations[index % representations.length], interaction_mode: "tap_keyboard_switch_eye_gaze_or_build_equation_cards" }, answer,
      hints: ["Name the whole and both parts before reading the signs.", mode >= 2 ? "Subtraction starts with the whole and removes one part." : "Turning the parts around does not change the whole."],
      explanation: `The same model has whole ${item.whole} and parts ${item.part} and ${item.other}. Its linked facts include ${item.part} + ${item.other} = ${item.whole}, ${item.other} + ${item.part} = ${item.whole}, ${item.whole} − ${item.part} = ${item.other} and ${item.whole} − ${item.other} = ${item.part}.`, difficulty: 5, tag: mode === 1 ? "turnaround_changes_whole" : "facts_seen_as_unrelated", hook: "treasure-fact-key",
      correct: "Fact key matched to one whole and its two parts.", repair: "Place WHOLE and PART labels on the model, then build each equation with spoken symbol cards before choosing.",
      concrete: "Use a tactile part-whole tray and movable numeral, plus, minus and equals cards with audio labels.", visual: "The same model stays fixed while only equation cards turn or cover a part.",
    });
  });
}

function retrievalCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const mode = index % 5;
    if (mode === 3) return patternCandidate(index);
    const facts = bondFacts();
    const item = facts[(index * 11 + 5) % facts.length];
    const treasure = treasureSets[index % treasureSets.length];
    if (mode === 4) return representationCandidate(item, index);
    const answer = item.other;
    const story = mode === 0
      ? `${item.part} ${treasure} are in one pouch. The two pouches hold ${item.whole} altogether. How many are hidden?`
      : mode === 1
        ? `The whole is ${item.whole}. Cover the part ${item.part}. How many remain visible?`
        : `${item.part} and a missing part make ${item.whole}. What is missing?`;
    return candidate({
      id: `retrieve-${mode}-${item.whole}-${item.part}-${index + 1}`, format: "tap-choice", blueprint: "spaced-bond-retrieval-and-transfer", band: "retrieval", concept: mode === 0 ? "story_bond_transfer" : mode === 1 ? "subtraction_as_missing_part" : "mixed_missing_part_retrieval",
      prompt: `Map revisit ${index + 1}: ${story}`, body: { whole: item.whole, given_part: item.part, missing_part: item.other, choices: rotate(numberChoices(answer, item.whole, item.part), index % 4), representation: representations[index % representations.length], review_interval_days: [1, 3, 7, 14, 30][index % 5], interaction_mode: "choose_build_point_keyboard_switch_aac_or_say" }, answer,
      hints: ["Find the whole and the known part.", "Build or picture the whole, then count the other part."], explanation: `${item.part} and ${item.other} make ${item.whole}. The missing part is ${item.other}, checked by ${item.whole} − ${item.part} = ${item.other}.`, difficulty: item.whole <= 10 ? 3 : 4, tag: "missing_part_guess", hook: "treasure-map-revisit",
      correct: `Map clue solved: ${item.part} and ${item.other} make ${item.whole}.`, repair: "Choose one representation, build the whole, cover the known part and count the uncovered part without any timer.",
      concrete: `Use ${item.whole} counters, a bead string or tactile frame.`, visual: "A picture-supported one-sentence story can switch to a static part-whole or frame view.",
    });
  });
}

function patternCandidate(index) {
  const whole = index % 2 === 0 ? 10 : 20;
  const start = (Math.floor(index / 5) * 2) % (whole - 2);
  const rows = [[start, whole - start], [start + 1, whole - start - 1], [start + 2, whole - start - 2]];
  const answer = "The first part goes up by 1 while the second part goes down by 1, so the whole stays the same.";
  const choices = rotate([answer, "Both parts go up by 1, so the whole stays the same.", "The parts change randomly and do not show a pattern."], index % 3);
  return candidate({
    id: `pattern-${whole}-${start}-${index + 1}`, format: "tap-choice", blueprint: "spaced-bond-retrieval-and-transfer", band: "retrieval", concept: "systematic_one_up_one_down_pattern",
    prompt: `Pattern vault ${index + 1}: compare these three bond rows for whole ${whole}. What pattern keeps the whole unchanged?`, body: { whole, systematic_rows: rows, choices, representation: "ordered part-whole table with frames", review_interval_days: [1, 3, 7, 14, 30][index % 5], interaction_mode: "choose_explanation_move_one_counter_or_say_pattern" }, answer,
    hints: ["Compare the first part down the rows.", "Now compare the second part; check each row still totals the same whole."], explanation: `The rows are ${rows.map(([a, b]) => `${a} + ${b} = ${whole}`).join("; ")}. One part increases as the other decreases, preserving the whole.`, difficulty: 4, tag: "pattern_changes_whole", hook: "treasure-pattern-vault",
    correct: `Systematic pattern found for whole ${whole}.`, repair: "Move exactly one counter from the second part to the first between rows, then recount the unchanged whole.",
    concrete: `Use ${whole} counters in two tactile pots and move one counter per step.`, visual: "Aligned rows and arrows show +1 on one part and −1 on the other without relying on colour.",
  });
}

function representationCandidate(item, index) {
  const answer = `${item.part} and ${item.other} make ${item.whole}`;
  const choices = rotate([answer, `${item.whole} is a part and ${item.part} is the whole`, "The models show different totals because they look different"], index % 3);
  return candidate({
    id: `representation-${item.whole}-${item.part}-${index + 1}`, format: "tap-choice", blueprint: "spaced-bond-retrieval-and-transfer", band: "retrieval", concept: "representation_equivalence",
    prompt: `Treasure translator ${index + 1}: which sentence matches the frame, bead string and part-whole model?`, body: { whole: item.whole, parts: [item.part, item.other], choices, representations: ["frame", "bead string", "part-whole model"], same_quantity_check: true, review_interval_days: [1, 3, 7, 14, 30][index % 5], interaction_mode: "choose_match_point_to_parts_keyboard_switch_or_aac" }, answer,
    hints: ["The pictures look different but show the same amounts.", "Name the two parts, then the whole."], explanation: `Each representation shows parts ${item.part} and ${item.other} making whole ${item.whole}. Changing the model does not change the bond.`, difficulty: 4, tag: "representation_changes_quantity", hook: "treasure-model-translator",
    correct: "Three representations linked to the same number bond.", repair: "Match each part across the models with number labels, then check the whole remains the same.",
    concrete: "Use counters, a bead string and a tactile part-whole tray side by side.", visual: "Equivalent models share number labels and text descriptions; colour is optional rather than essential.",
  });
}

function candidate({ id, format, blueprint, band, concept, prompt, body, answer, hints, explanation, difficulty, tag, hook, correct, repair, concrete, visual }) {
  const fullId = `${prefix}${id}`;
  return {
    id: fullId,
    format,
    body: {
      prompt, ...body,
      concept_focus: concept,
      response_mode: "tap_drag_keyboard_switch_eye_gaze_aac_oral_or_adult_scribed",
      supported_interaction: "adult_or_peer_may_read_scan_auto_place_and_record_without_supplying_the_number_bond",
      concrete_route: concrete,
      visual_route: visual,
      tactile_route: "raised whole-and-part boundaries, large counters and braille or tactile numeral labels where used",
      verbal_route: "say or hear: part, part, whole; then state the matching bond",
      audio_replay: true,
      audio_asset_id: `narration-${fullId}`,
      audio_provider: "ElevenLabs",
      audio_asset_status: "required_human_listening_review",
      human_listening_approval_required: true,
      browser_tts_allowed: false,
      reduced_motion: "instant_counter_state_and_static_before_after",
      preserve_correct_counters: true,
      undo_available: true,
      no_timer: true,
      speed_score_allowed: false,
      retry_without_penalty: true,
      gamification: { mission: "unlock a joyful treasure map by building and checking one number bond", reward: "one calm treasure spark for a completed model or check", loss_on_error: false, streak_pressure: false, leaderboard: false, speed_bonus: false, retry_message: "Your correctly placed treasure stays. Choose another model or clue and continue." },
      difficulty_band: band,
      evidence_purpose: blueprint.replaceAll("-", "_"),
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
    },
    expected_answer: { value: answer }, hints, explanation,
    feedback: { correct, repair, bond_evidence: explanation, strategy_praise: "Building, seeing, touching, pointing, saying or using a known fact are equally valued; speed is not evidence." },
    difficulty, status: "review", misconception_tag: tag, animation_hook: hook,
  };
}

function validateBank(currentPack, authored, generated) {
  if (authored.length !== 3) throw new Error(`Expected exactly 3 curated variants, found ${authored.length}. Refusing to overwrite possible authored work.`);
  if (currentPack.question_variants.length !== currentPack.practice.variant_targets.pilot) throw new Error(`Expected ${currentPack.practice.variant_targets.pilot} variants, found ${currentPack.question_variants.length}.`);
  const blueprints = new Map(currentPack.variant_blueprints.map((blueprint) => [blueprint.id, blueprint]));
  const ids = new Set();
  const signatures = new Set();
  for (const variant of currentPack.question_variants) {
    if (ids.has(variant.id)) throw new Error(`Duplicate id ${variant.id}.`);
    ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${JSON.stringify(variant.expected_answer)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`);
    signatures.add(signature);
  }
  for (const variant of generated) {
    const blueprint = blueprints.get(variant.body.variant_blueprint_id);
    if (!blueprint || variant.format !== blueprint.format || variant.body.difficulty_band !== blueprint.difficulty_band) throw new Error(`${variant.id} does not match its blueprint.`);
    if (variant.status !== "review" || variant.body.review_batch !== reviewBatch) throw new Error(`${variant.id} must remain in review.`);
    if (!variant.body.concrete_route || !variant.body.visual_route || !variant.body.tactile_route || !variant.body.supported_interaction) throw new Error(`${variant.id} lacks SEND representations.`);
    if (!variant.body.response_mode.includes("keyboard") || !variant.body.response_mode.includes("switch") || !variant.body.response_mode.includes("eye_gaze") || !variant.body.response_mode.includes("aac")) throw new Error(`${variant.id} lacks supported response routes.`);
    if (variant.body.audio_provider !== "ElevenLabs" || variant.body.audio_asset_status !== "required_human_listening_review" || variant.body.browser_tts_allowed !== false) throw new Error(`${variant.id} violates audio policy.`);
    if (variant.body.no_timer !== true || variant.body.speed_score_allowed !== false || variant.body.gamification?.streak_pressure !== false || variant.body.gamification?.loss_on_error !== false) throw new Error(`${variant.id} introduces pressure.`);
    if (!variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.bond_evidence || !variant.feedback?.strategy_praise) throw new Error(`${variant.id} lacks rich feedback.`);
    const choices = variant.body.choices;
    if (!Array.isArray(choices) || choices.length < 3 || new Set(choices.map((choice) => JSON.stringify(choice))).size !== choices.length) throw new Error(`${variant.id} has invalid choices.`);
    if (choices.filter((choice) => JSON.stringify(choice) === JSON.stringify(variant.expected_answer.value)).length !== 1) throw new Error(`${variant.id} must offer exactly one expected answer.`);
    if (variant.body.prompt.length > 150) throw new Error(`${variant.id} prompt is too long for Year 1.`);
    for (const value of bondNumbers(variant)) if (value < 0 || value > 20) throw new Error(`${variant.id} uses ${value} outside 0–20.`);
  }
  const allocation = countBy(currentPack.question_variants, (variant) => variant.body.variant_blueprint_id);
  for (const [id, expected] of Object.entries(pilotAllocation)) if (allocation[id] !== expected) throw new Error(`${id} expected ${expected}, found ${allocation[id] ?? 0}.`);
  const concepts = new Set(generated.map((variant) => variant.body.concept_focus));
  for (const concept of ["conserved_small_whole_split", "complement_to_ten", "systematic_bonds_to_ten", "ten_and_some_bond", "flexible_bond_within_twenty", "turnaround_addition", "related_subtraction", "inverse_fact_link", "systematic_one_up_one_down_pattern", "representation_equivalence"]) if (!concepts.has(concept)) throw new Error(`Missing concept ${concept}.`);
}

function bondFacts() { const facts = []; for (let whole = 3; whole <= 20; whole += 1) for (let part = 0; part <= whole; part += 1) facts.push({ whole, part, other: whole - part }); return facts; }
function teenPart(whole, round) { if (round === 0) return 10; if (round === 1) return whole - 10; if (round === 2) return Math.floor(whole / 2); return Math.max(0, whole - 5); }
function numberChoices(answer, whole, part) { const values = [answer, whole, part, answer < 20 ? answer + 1 : answer - 1].filter((value) => Number.isInteger(value) && value >= 0 && value <= 20); for (let step = 1; new Set(values).size < 4; step += 1) { if (answer - step >= 0) values.push(answer - step); if (answer + step <= 20) values.push(answer + step); } return [...new Set(values)].slice(0, 4); }
function equationChoices(answer, wrongA, wrongB) { return unique([answer, wrongA, wrongB, answer.replace(" = ", " + 1 = ")]).slice(0, 4); }
function bondNumbers(variant) { const body = variant.body; return [body.whole, body.given_part, body.missing_part, body.filled, body.empty, ...(body.parts ?? []), ...(body.systematic_rows ?? []).flat(), ...body.choices.filter((choice) => typeof choice === "number"), typeof variant.expected_answer.value === "number" ? variant.expected_answer.value : undefined].filter((value) => typeof value === "number" && Number.isFinite(value)); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function unique(items) { return [...new Set(items)]; }
function normalise(value) { return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " "); }
function countBy(items, keyFor) { const result = {}; for (const item of items) { const key = keyFor(item); result[key] = (result[key] ?? 0) + 1; } return result; }
function summary(items, keyFor) { return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
