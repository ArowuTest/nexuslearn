#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/ma-y1-addition-and-subtraction-stories.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y1-add-subtract-stories-bank-";
const reviewBatch = "y1-add-subtract-stories-pilot-a";
const pilotAllocation = {
  "join-stories-build-and-count-on": 44,
  "separate-stories-whole-part-left": 44,
  "missing-part-story-balances": 44,
  "comparison-more-fewer-difference": 44,
  "mixed-story-spaced-transfer": 44,
};

const storyWorlds = [
  { object: "star tokens", place: "Moonlit Map", arrive: "glow onto the path", leave: "return to the sky pouch" },
  { object: "shells", place: "Singing Shore", arrive: "wash onto the sand", leave: "are carried to the tide tray" },
  { object: "acorns", place: "Oak Door Trail", arrive: "drop beside the door", leave: "are placed in the squirrel basket" },
  { object: "lanterns", place: "Firefly Forest", arrive: "light up", leave: "are gently switched off" },
  { object: "gem cards", place: "Crystal Cave", arrive: "slide from a clue box", leave: "are stored in the treasure drawer" },
  { object: "feathers", place: "Cloud Castle", arrive: "float onto the mat", leave: "are tucked into the wing bag" },
  { object: "flower badges", place: "Wonder Garden", arrive: "open on the mission board", leave: "are moved to the seed box" },
  { object: "robot bolts", place: "Tinker Station", arrive: "roll from the parts tube", leave: "are put in the repair tray" },
  { object: "pebbles", place: "Rainbow River", arrive: "appear beside the bridge", leave: "are moved to the bank" },
  { object: "book keys", place: "Whispering Library", arrive: "are found in a story chest", leave: "are returned to the key rack" },
  { object: "cloud puffs", place: "Skyship Deck", arrive: "drift into view", leave: "float beyond the sail" },
];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y1-addition-and-subtraction-stories") throw new Error("This generator only supports the Year 1 addition-and-subtraction stories pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedCounts = countBy(curated, (variant) => variant.body?.variant_blueprint_id);
const targets = Object.fromEntries(Object.entries(pilotAllocation).map(([id, target]) => [id, target - (curatedCounts[id] ?? 0)]));
for (const [id, target] of Object.entries(targets)) if (target < 0) throw new Error(`Curated variants exceed the allocation for ${id}.`);

const generated = [
  ...joinCandidates(targets["join-stories-build-and-count-on"]),
  ...separateCandidates(targets["separate-stories-whole-part-left"]),
  ...missingCandidates(targets["missing-part-story-balances"]),
  ...compareCandidates(targets["comparison-more-fewer-difference"]),
  ...mixedCandidates(targets["mixed-story-spaced-transfer"]),
];

pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa.notes = "Review-stage Year 1 addition-and-subtraction story pack with a deterministic 220-item pilot bank. Four curated variants are preserved alongside story structures for combining, joining change, separating change, comparison, missing parts, missing starts, inverse checking and representation matching within 0 to 20. Generated candidates include concrete and visual models, narration and SEND response routes, explicit strategy and misconception feedback, unlimited thinking time, and fantastic mission progress rewarded for modelling and checking rather than speed or streaks. Independent mathematics, teacher, accessibility, narration and renderer review remains required before promotion.";

validateBank(pack, curated, generated);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y1-add-subtract-stories-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y1-add-subtract-stories-bank blueprints=${summary(pack.question_variants, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`y1-add-subtract-stories-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y1-add-subtract-stories-bank structures=${summary(generated, (variant) => variant.body.story_structure)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y1-add-subtract-stories-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 1 addition-and-subtraction stories bank is out of date; run generate-y1-add-subtract-stories-bank.mjs --write.");
  console.log("y1-add-subtract-stories-bank deterministic check passed");
} else {
  console.log("y1-add-subtract-stories-bank dry-run; pass --write to update the pack");
}

function joinCandidates(count) {
  const facts = orderedFacts(joinFacts(), 37, 19).slice(0, count);
  return facts.map(({ start, change, result }, index) => {
    const world = storyWorlds[index % storyWorlds.length];
    const correct = result;
    const isCombine = index % 4 === 0;
    return candidate({
      id: `join-${start}-${change}-${index + 1}`, format: "story-mat", blueprint: "join-stories-build-and-count-on", band: "intro", structure: isCombine ? "combine_result_unknown" : "join_result_unknown",
      prompt: isCombine
        ? `At ${world.place}, one chest has ${start} ${world.object} and another has ${change}. How many are there altogether?`
        : `At ${world.place}, ${start} ${world.object} are ready. ${change} more ${world.arrive}. How many are there now?`,
      body: { start, change: { type: isCombine ? "combine_parts" : "join", amount: change }, result, objects: world.object, choices: rotate(numberChoices(correct, start, change), index % 4), equation_model: `${start} + ${change} = ${result}`, count_on_sequence: countOn(start, change), representation_choices: [isCombine ? "part-part-whole frame" : "start-change-result mat", "two ten-frames", "number track"] },
      answer: correct,
      hints: [`Keep the starting ${start} on the mat.`, change === 0 ? "No new objects join, so the amount stays the same." : `Count on ${change}: ${countOn(start, change).join(", ")}.`],
      explanation: isCombine
        ? `The two existing parts, ${start} and ${change}, combine to make the whole ${result}: ${start} + ${change} = ${result}.`
        : `${change} join the starting ${start}, so ${start} + ${change} = ${result}. Keeping the start group supports counting on instead of recounting all.`,
      difficulty: result <= 10 ? 2 : 3, tag: change === 0 ? "zero_change_changes_total" : "keyword_operation_guess", hook: "mission-arrival-build-check",
      correctFeedback: `Story matched: start ${start}, join ${change}, result ${result}.`, repair: "Build only what the story says: keep START still, place the joining part in CHANGE, then combine for RESULT.",
      concrete: `Use a START hoop with ${start} counters and a CHANGE tray with ${change}; auto-place and adult-count options are available.`,
      visual: "Three static labelled panels show START, JOIN and NOW; objects remain visible and evenly spaced.",
    });
  });
}

function separateCandidates(count) {
  const facts = orderedFacts(separateFacts(), 41, 23).slice(0, count);
  return facts.map(({ start, removed, left }, index) => {
    const world = storyWorlds[(index + 3) % storyWorlds.length];
    const correct = `${start} − ${removed} = ${left}`;
    const choices = rotate(unique([correct, `${start} + ${removed} = ${start + removed}`, `${left} − ${removed} = ${Math.max(0, left - removed)}`, `${removed} + ${left} = ${start}`]), index % 4);
    return candidate({
      id: `separate-${start}-${removed}-${index + 1}`, format: "picture-equation-match", blueprint: "separate-stories-whole-part-left", band: "developing", structure: "separate_result_unknown",
      prompt: `At ${world.place}, there are ${start} ${world.object}. ${removed} ${world.leave}. Which equation shows how many stay?`,
      body: { start, removed, left, objects: world.object, choices, away_tray_visible: true, equation_model: correct, representation_choices: ["whole-away-left mat", "crossed-out picture", "backward number-track hops"] },
      answer: correct,
      hints: [`Build the whole ${start} first.`, `Move ${removed} to the AWAY tray and count only the ${left} still on the story mat.`],
      explanation: `${removed} leave the whole ${start}, and ${left} remain. The matching equation is ${correct}. Removed objects stay visible in a separate tray but are not recounted as left.`,
      difficulty: start <= 10 ? 3 : 4, tag: removed === 0 ? "zero_change_changes_total" : "removed_objects_recounted", hook: "mission-whole-away-left",
      correctFeedback: `Equation matched: ${correct}. The away part and left part rebuild the whole ${start}.`, repair: "Point to WHOLE, move the leaving objects to AWAY, and count the objects still in LEFT before choosing an equation.",
      concrete: `Use ${start} counters with a tactile boundary between LEFT and AWAY, or select step-by-step auto-move.`,
      visual: "A static before-and-after picture keeps removed objects greyed in a separate away tray without hiding them.",
    });
  });
}

function missingCandidates(count) {
  const facts = orderedFacts(partFacts(), 43, 29).slice(0, count);
  return facts.map(({ whole, part, missing }, index) => {
    const world = storyWorlds[(index + 5) % storyWorlds.length];
    const mode = index % 4;
    let prompt;
    let equation;
    let answer;
    let structure;
    let explanation;
    if (mode === 0) {
      prompt = `${part} ${world.object} are silver. Some are gold. There are ${whole} altogether. How many are gold?`;
      equation = `${part} + ? = ${whole}`; answer = missing; structure = "combine_missing_part";
      explanation = `${part} and ${missing} combine to make ${whole}: ${part} + ${missing} = ${whole}.`;
    } else if (mode === 1) {
      prompt = `The ${world.place} balance says ${whole} is the same as ${part} plus a hidden part. What is hidden?`;
      equation = `${whole} = ${part} + ?`; answer = missing; structure = "reversed_equality_missing_part";
      explanation = `${whole} and ${part} + ${missing} have the same value. The equals sign means both sides balance.`;
    } else if (mode === 2) {
      prompt = `Some ${world.object} were ready. ${missing} more ${world.arrive}. Now there are ${whole}. How many were ready first?`;
      equation = `? + ${missing} = ${whole}`; answer = part; structure = "join_start_unknown";
      explanation = `${part} were ready and ${missing} joined, making ${whole}. Check: ${part} + ${missing} = ${whole}.`;
    } else {
      prompt = `${whole} ${world.object} were ready. Some ${world.leave}. ${part} stay. How many moved away?`;
      equation = `${whole} − ? = ${part}`; answer = missing; structure = "separate_change_unknown";
      explanation = `${missing} moved away because ${whole} − ${missing} = ${part}. Check by recombining ${part} + ${missing} = ${whole}.`;
    }
    return candidate({
      id: `missing-${whole}-${part}-${mode}-${index + 1}`, format: "missing-number-balance", blueprint: "missing-part-story-balances", band: "expected", structure,
      prompt, body: { equation, whole, known_part: part, hidden_value: answer, choices: rotate(numberChoices(answer, whole, part), index % 4), balance_verification: equation.replace("?", String(answer)), representation_choices: ["part-part-whole frame", "balance pans", "twenty-frame cover"] }, answer,
      hints: ["Build the whole, then mark the part you know.", "Count the uncovered or hidden part and check that both sides have the same value."],
      explanation: `${explanation} The blank can appear anywhere; equals means “has the same value as,” not “the answer comes next.”`,
      difficulty: whole <= 10 ? 4 : 5, tag: mode === 1 ? "equals_means_answer_next" : "blank_means_always_total", hook: "mission-balance-hidden-rune",
      correctFeedback: `Hidden value found: ${answer}. Replacing the blank makes the model and equation balance.`, repair: "Cover the unknown, build the known whole and part with counters, then count what must fill the gap. Check both sides.",
      concrete: `Use a tactile part-part-whole tray with ${whole} counters or equal balance strips; an adult may place counters as directed.`,
      visual: "A high-contrast frame labels WHOLE, KNOWN and HIDDEN without using colour as the only cue.",
    });
  });
}

function compareCandidates(count) {
  const facts = orderedFacts(compareFacts(), 47, 31).slice(0, count);
  return facts.map(({ larger, smaller, difference }, index) => {
    const world = storyWorlds[(index + 7) % storyWorlds.length];
    const askFewer = index % 2 === 1;
    const names = [["Mina", "Jo"], ["Ari", "Sol"], ["Nia", "Ben"], ["Kai", "Zara"]][index % 4];
    const prompt = askFewer
      ? `${names[0]} has ${larger} ${world.object}. ${names[1]} has ${smaller}. How many fewer does ${names[1]} have?`
      : `${names[0]} has ${larger} ${world.object}. ${names[1]} has ${smaller}. How many more does ${names[0]} have?`;
    return candidate({
      id: `compare-${larger}-${smaller}-${index + 1}`, format: "comparison-builder", blueprint: "comparison-more-fewer-difference", band: "secure", structure: askFewer ? "compare_fewer_unknown" : "compare_more_unknown",
      prompt, body: { amounts: { [names[0]]: larger, [names[1]]: smaller }, larger_amount: larger, smaller_amount: smaller, difference, choices: rotate(numberChoices(difference, larger, smaller), index % 4), model: "aligned_one_to_one_rows", equations: [`${larger} − ${smaller} = ${difference}`, `${smaller} + ${difference} = ${larger}`], representation_choices: ["aligned rows", "matching towers", "missing-addend bar"] }, answer: difference,
      hints: [`Match ${smaller} objects one to one in both rows.`, `Count the ${difference} unmatched objects in the longer row.`],
      explanation: `After ${smaller} pairs are matched, ${difference} are unmatched. The difference is ${difference}: ${larger} − ${smaller} = ${difference}, and ${smaller} + ${difference} = ${larger}.`,
      difficulty: larger <= 10 ? 5 : 6, tag: index % 3 === 0 ? "subtraction_only_take_away" : "compares_by_counting_both_rows", hook: "mission-rows-match-gap",
      correctFeedback: `Comparison complete: the unmatched gap is ${difference}.`, repair: "Do not combine both rows. Align one object from each row, then count only the unmatched gap.",
      concrete: `Build two tactile rows with equal spacing and a shared start line; auto-align and partner placement are available.`,
      visual: "Two numbered rows share the same baseline and spacing, with the unmatched gap bracketed and audio-described.",
    });
  });
}

function mixedCandidates(count) {
  const facts = orderedFacts(partFacts(), 53, 37);
  const intervals = [1, 3, 7, 14, 30];
  return Array.from({ length: count }, (_, index) => {
    const { whole, part, missing } = facts[index];
    const world = storyWorlds[(index + 9) % storyWorlds.length];
    const mode = index % 5;
    let prompt;
    let answer;
    let structure;
    let equation;
    if (mode === 0) { prompt = `${part} ${world.object} are on the map and ${missing} more join. How many are there altogether?`; answer = whole; structure = "mixed_join"; equation = `${part} + ${missing} = ${whole}`; }
    else if (mode === 1) { prompt = `${whole} ${world.object} are on the map. ${missing} move away. How many are left?`; answer = part; structure = "mixed_separate"; equation = `${whole} − ${missing} = ${part}`; }
    else if (mode === 2) { prompt = `One team has ${whole} ${world.object}; another has ${part}. What is the difference?`; answer = missing; structure = "mixed_compare"; equation = `${whole} − ${part} = ${missing}`; }
    else if (mode === 3) { prompt = `${part} ${world.object} and a hidden part make ${whole}. What is hidden?`; answer = missing; structure = "mixed_missing_part"; equation = `${part} + ${missing} = ${whole}`; }
    else { prompt = `A story model shows ${part} and ${missing} making ${whole}. Which subtraction uses the whole and known part to check the hidden part?`; answer = `${whole} − ${part} = ${missing}`; structure = "mixed_inverse_check"; equation = `${part} + ${missing} = ${whole}; ${whole} − ${part} = ${missing}`; }
    const choices = typeof answer === "number" ? numberChoices(answer, whole, part) : unique([answer, `${whole} + ${part} = ${whole + part}`, `${part} − ${missing} = ${Math.max(0, part - missing)}`, `${whole} − ${missing} = ${Math.max(0, part - 1)}`]);
    return candidate({
      id: `mixed-${mode}-${whole}-${part}-${index + 1}`, format: "tap-choice", blueprint: "mixed-story-spaced-transfer", band: "retrieval", structure,
      prompt: `Story mission ${index + 1}: ${prompt}`, body: { whole, part, other_part: missing, choices: rotate(choices, index % choices.length), equation_model: equation, review_interval_days: intervals[index % intervals.length], choose_strategy_first: ["build objects", "draw or view model", "use number track", "use related fact"], representation_choices: ["objects", "picture", "equation", "number track"] }, answer,
      hints: ["Decide what stays the same, what changes and what is unknown.", "Choose a model, solve it, then use a related addition or subtraction fact to check."],
      explanation: `The story structure is ${structure.replaceAll("_", " ")}. The matching check is ${equation}; the numbers describe one whole and its related parts.`,
      difficulty: whole <= 10 ? 3 : 4, tag: mode === 4 ? "inverse_facts_seen_as_unrelated" : "keyword_operation_guess", hook: "mission-story-portal-choice",
      correctFeedback: `Mission checked with ${equation}. Strategy choice matters; speed does not.`, repair: "Return to the story mat, label WHOLE and PARTS, and choose a concrete, picture or number-track route before retrying.",
      concrete: `Use counters, tactile numeral cards and a twenty-frame; partner-assisted scanning and adult scribing are allowed.`,
      visual: "A static story strip offers object, bar, number-track and equation views with consistent labels.",
    });
  });
}

function candidate({ id, format, blueprint, band, structure, prompt, body, answer, hints, explanation, difficulty, tag, hook, correctFeedback, repair, concrete, visual }) {
  return {
    id: `${prefix}${id}`,
    format,
    body: {
      prompt, ...body,
      story_structure: structure,
      response_mode: "tap_drag_keyboard_switch_eye_gaze_oral_aac_or_adult_scribed",
      supported_interaction: "adult_or_peer_may_read_scan_auto_place_and_record_without_supplying_the_mathematics",
      concrete_route: concrete,
      visual_route: visual,
      audio_replay: true,
      equation_audio: true,
      static_model: true,
      reduced_motion: "instant_before_change_after_panels",
      preserve_correct_objects_on_retry: true,
      undo_available: true,
      no_timer: true,
      speed_score_allowed: false,
      retry_without_penalty: true,
      gamification: { mission: "restore a story portal by building, solving and checking its number story", reward: "one map spark for completing a representation-and-check routine", loss_on_error: false, replay_penalty: false, streak_pressure: false, leaderboard: false, retry_message: "The portal kept your correct pieces. Check the story model and try another route." },
      difficulty_band: band,
      evidence_purpose: blueprint.replaceAll("-", "_"),
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
    },
    expected_answer: { value: answer }, hints, explanation,
    feedback: { correct: correctFeedback, repair, representation_check: explanation, strategy_praise: "You may build, point, draw, count or use a known fact; checking is valued more than speed." },
    difficulty, status: "review", misconception_tag: tag, animation_hook: hook,
  };
}

function validateBank(currentPack, authored, generated) {
  if (authored.length !== 4) throw new Error(`Expected exactly 4 curated variants, found ${authored.length}. Refusing to overwrite possible authored work.`);
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
    if (!variant.body.story_structure || !variant.body.concrete_route || !variant.body.visual_route || !variant.body.supported_interaction) throw new Error(`${variant.id} lacks representation or interaction support.`);
    if (!variant.body.response_mode.includes("keyboard") || !variant.body.response_mode.includes("switch") || !variant.body.response_mode.includes("eye_gaze") || !variant.body.response_mode.includes("aac")) throw new Error(`${variant.id} lacks SEND response routes.`);
    if (variant.body.no_timer !== true || variant.body.speed_score_allowed !== false || variant.body.retry_without_penalty !== true || variant.body.gamification?.streak_pressure !== false || variant.body.gamification?.loss_on_error !== false) throw new Error(`${variant.id} introduces performance pressure.`);
    if (!variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.representation_check || !variant.feedback?.strategy_praise) throw new Error(`${variant.id} lacks explicit feedback.`);
    const choices = variant.body.choices;
    if (!Array.isArray(choices) || choices.length < 3 || new Set(choices.map((choice) => JSON.stringify(choice))).size !== choices.length) throw new Error(`${variant.id} has invalid choices.`);
    if (choices.filter((choice) => JSON.stringify(choice) === JSON.stringify(variant.expected_answer.value)).length !== 1) throw new Error(`${variant.id} must offer exactly one expected answer.`);
    if (variant.body.prompt.length > 150) throw new Error(`${variant.id} prompt is too long for Year 1.`);
    for (const value of storyNumberValues(variant)) if (value < 0 || value > 20) throw new Error(`${variant.id} uses ${value} outside the Year 1 range.`);
  }
  const allocation = countBy(currentPack.question_variants, (variant) => variant.body.variant_blueprint_id);
  for (const [id, expected] of Object.entries(pilotAllocation)) if (allocation[id] !== expected) throw new Error(`${id} expected ${expected}, found ${allocation[id] ?? 0}.`);
  const structures = generated.map((variant) => variant.body.story_structure);
  for (const required of ["combine_result_unknown", "join_result_unknown", "separate_result_unknown", "combine_missing_part", "join_start_unknown", "separate_change_unknown", "compare_more_unknown", "compare_fewer_unknown", "mixed_inverse_check"]) if (!structures.includes(required)) throw new Error(`Missing story structure ${required}.`);
}

function joinFacts() { const facts = []; for (let start = 0; start <= 15; start += 1) for (let change = 0; change <= 9; change += 1) if (start + change <= 20) facts.push({ start, change, result: start + change }); return facts; }
function separateFacts() { const facts = []; for (let start = 3; start <= 20; start += 1) for (let removed = 0; removed <= start; removed += 1) facts.push({ start, removed, left: start - removed }); return facts; }
function partFacts() { const facts = []; for (let whole = 2; whole <= 20; whole += 1) for (let part = 0; part <= whole; part += 1) facts.push({ whole, part, missing: whole - part }); return facts; }
function compareFacts() { const facts = []; for (let larger = 1; larger <= 20; larger += 1) for (let smaller = 0; smaller < larger; smaller += 1) facts.push({ larger, smaller, difference: larger - smaller }); return facts; }
function orderedFacts(facts, multiplier, offset) { return facts.map((fact, index) => ({ fact, key: (index * multiplier + offset) % 997 })).sort((a, b) => a.key - b.key || JSON.stringify(a.fact).localeCompare(JSON.stringify(b.fact))).map(({ fact }) => fact); }
function countOn(start, amount) { return Array.from({ length: amount }, (_, index) => start + index + 1); }
function numberChoices(answer, a, b) { const values = [answer, a, b, answer < 20 ? answer + 1 : answer - 1].filter((value) => Number.isInteger(value) && value >= 0 && value <= 20); for (let step = 1; new Set(values).size < 4; step += 1) { if (answer - step >= 0) values.push(answer - step); if (answer + step <= 20) values.push(answer + step); } return [...new Set(values)].slice(0, 4); }
function storyNumberValues(variant) {
  const body = variant.body;
  const values = [body.start, body.removed, body.left, body.whole, body.known_part, body.hidden_value, body.larger_amount, body.smaller_amount, body.difference, body.part, body.other_part, body.change?.amount, ...Object.values(body.amounts ?? {}), ...body.choices.filter((choice) => typeof choice === "number")];
  if (typeof variant.expected_answer.value === "number") values.push(variant.expected_answer.value);
  return values.filter((value) => typeof value === "number" && Number.isFinite(value));
}
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function unique(items) { return [...new Set(items)]; }
function normalise(value) { return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " "); }
function countBy(items, keyFor) { const result = {}; for (const item of items) { const key = keyFor(item); result[key] = (result[key] ?? 0) + 1; } return result; }
function summary(items, keyFor) { return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
