#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/en-y1-phonics-form-lowercase-letters.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "en-y1-letter-formation-bank-";
const reviewBatch = "y1-letter-formation-pilot-a";
const pilotAllocation = {
  "start-point-taps": 36,
  "guided-letter-traces": 36,
  "direction-choice-repairs": 36,
  "letter-family-retrieval": 36,
  "word-link-transfer": 36,
};

const letters = [
  letter("a", "round-start", "near top on the right", ["curve anticlockwise to close the round part", "move down to finish"], "apple"),
  letter("b", "down-then-around", "at the top", ["move straight down", "go back up to the middle", "curve right and around"], "bat"),
  letter("c", "round-start", "near top on the right", ["curve anticlockwise around", "stop before closing"], "cat"),
  letter("d", "round-start", "near top on the right", ["curve anticlockwise to make a round part", "go up tall", "move straight down"], "dog"),
  letter("e", "round-start", "in the middle", ["move across", "curve up and anticlockwise around"], "hen"),
  letter("f", "tall-down", "at the top", ["curve over and move down", "lift and cross in the middle"], "fan"),
  letter("g", "round-start", "near top on the right", ["curve anticlockwise to close the round part", "move down below the line", "curve left to finish"], "gap"),
  letter("h", "down-then-over", "at the top", ["move straight down", "go back up to the middle", "curve over and down"], "hat"),
  letter("i", "short-down", "at the middle line", ["move straight down", "lift and add a dot above"], "sit"),
  letter("j", "short-down", "at the middle line", ["move down below the line", "curve left", "lift and add a dot above"], "jam"),
  letter("k", "down-and-diagonal", "at the top", ["move straight down", "go to the middle", "slant in then slant out"], "kit"),
  letter("l", "tall-down", "at the top", ["move straight down to the line"], "leg"),
  letter("m", "down-then-over", "at the middle line", ["move straight down", "go back up", "curve over and down twice"], "map"),
  letter("n", "down-then-over", "at the middle line", ["move straight down", "go back up", "curve over and down once"], "net"),
  letter("o", "round-start", "near top on the right", ["curve anticlockwise all the way around", "close the shape"], "pot"),
  letter("p", "down-then-around", "at the middle line", ["move down below the line", "go back up", "curve right and around"], "pen"),
  letter("q", "round-start", "near top on the right", ["curve anticlockwise to close the round part", "move down below the line", "finish with a small right flick"], "queen"),
  letter("r", "down-then-over", "at the middle line", ["move straight down", "go back up", "curve a little over to the right"], "rat"),
  letter("s", "turning-curve", "near the top", ["curve left", "turn back right and curve to the bottom"], "sun"),
  letter("t", "tall-down", "near the top", ["move straight down", "lift and cross near the middle"], "tap"),
  letter("u", "down-and-curve", "at the middle line", ["move down", "curve along the bottom and up", "move down to finish"], "cup"),
  letter("v", "diagonal", "at the middle line", ["slant down", "slant up"], "van"),
  letter("w", "diagonal", "at the middle line", ["slant down and up", "slant down and up again"], "web"),
  letter("x", "diagonal", "at the middle line", ["slant down right", "lift", "slant down left across the first line"], "fox"),
  letter("y", "down-and-curve", "at the middle line", ["slant or curve down and up", "move down below the line to finish"], "yes"),
  letter("z", "diagonal", "at the middle line", ["move across", "slant down left", "move across to the right"], "zip"),
];

const familyDescriptions = {
  "round-start": "begin with a round or curved movement",
  "down-then-around": "begin with a down stroke and later add a round movement",
  "down-then-over": "begin down, return, then move over",
  "short-down": "use a short down stroke and a separate dot where shown",
  "tall-down": "begin high with a tall down movement",
  "down-and-diagonal": "combine a down stroke with slanting strokes",
  "turning-curve": "use a curve that changes direction",
  "down-and-curve": "move down and curve through the lower part",
  diagonal: "use one or more slanting strokes",
};

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "en-y1-phonics-form-lowercase-letters") throw new Error("This generator only supports the Year 1 lowercase-letter-formation pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedCounts = countBy(curated, curatedBlueprint);
const targets = Object.fromEntries(Object.entries(pilotAllocation).map(([id, target]) => [id, target - (curatedCounts[id] ?? 0)]));
for (const [id, target] of Object.entries(targets)) if (target < 0) throw new Error(`Curated variants exceed the allocation for ${id}.`);

const generated = [
  ...startPointCandidates(targets["start-point-taps"]),
  ...traceCandidates(targets["guided-letter-traces"]),
  ...directionCandidates(targets["direction-choice-repairs"]),
  ...retrievalCandidates(targets["letter-family-retrieval"]),
  ...transferCandidates(targets["word-link-transfer"]),
];

pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Review-stage Year 1 lowercase-letter-formation pack with a deterministic 180-item pilot bank. Three curated variants are preserved alongside candidates covering recognition, start points, movement paths, orientation, formation families, b/d/p/q and other discrimination support, and transfer to letters within familiar words. Generated tasks separate formation knowledge from fine-motor performance through visual, verbal, tactile, switch, eye-gaze and path-choice alternatives. Referenced narration follows the ElevenLabs policy: browser TTS is prohibited and every asset remains unavailable pending human listening review. Joyful quest progress rewards noticing and choosing strategies, never speed, precision-only scoring or streaks. Handwriting-style, phonics, motor-access, teacher, renderer and human-listening review remains required before promotion.";

validateBank(pack, curated, generated);
enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y1-letter-formation-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y1-letter-formation-bank blueprints=${summary(pack.question_variants, assignedBlueprint)}`);
console.log(`y1-letter-formation-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y1-letter-formation-bank concepts=${summary(generated, (variant) => variant.body.concept_focus)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y1-letter-formation-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 1 letter-formation bank is out of date; run generate-y1-letter-formation-bank.mjs --write.");
  console.log("y1-letter-formation-bank deterministic check passed");
} else {
  console.log("y1-letter-formation-bank dry-run; pass --write to update the pack");
}

function startPointCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = letters[index % letters.length];
    const choices = rotate(unique([item.start, ...startDistractors(item.start)]), index % 3);
    return choiceCandidate({
      id: `start-${item.name}-${index + 1}`, format: "start-point-tap", blueprint: "start-point-taps", band: "intro", concept: "start_point",
      prompt: `Letter-path quest ${index + 1}: where does the displayed lowercase ${item.name} begin in this handwriting model?`,
      body: { letter: item.name, choices, start_dots: choices, displayed_model_style: "unjoined_lowercase_school_model", interaction_mode: "tap_dot_keyboard_switch_eye_gaze_or_place_start_token" }, answer: item.start,
      hints: ["Find the glowing start dot before thinking about the whole path.", `This ${item.name} begins ${item.start}.`],
      explanation: `In this displayed model, lowercase ${item.name} starts ${item.start}. School handwriting styles can vary, so follow the shown model.`,
      difficulty: 2, tag: "wrong_start_point", hook: "quest-start-rune", correct: `Start rune found for ${item.name}: ${item.start}.`, repair: "Hide the finish and show only the start dot, baseline and middle line. Choose or place the start token without tracing.",
    });
  });
}

function traceCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = letters[index % letters.length];
    const supportRound = Math.floor(index / letters.length);
    const support = ["solid wide trail", "dotted wide trail", "start dot and numbered turns"][supportRound % 3];
    return traceCandidate({
      id: `trace-${item.name}-${index + 1}`, blueprint: "guided-letter-traces", band: "developing", concept: "guided_movement_path",
      prompt: `Glow-trail quest ${index + 1}: show the lowercase ${item.name} path using the route that works for you.`,
      body: { letter: item.name, start_point: item.start, movement_steps: item.steps, trace_support: support, tolerance: "wide", displayed_model_style: "unjoined_lowercase_school_model", fading_support: supportRound > 0, path_choice_alternative: pathChoices(item), interaction_mode: "trace_point_select_arrows_eye_gaze_verbalise_or_air_write" },
      rubric: [startRubric(item), "movement_steps_in_displayed_order", "recognisable_path_or_correct_non_motor_selection"],
      hints: [`Start ${item.start}.`, `Say or select the steps: ${item.steps.join("; ")}.`],
      explanation: `The displayed ${item.name} path starts ${item.start}, then: ${item.steps.join("; ")}. A correct verbal, arrow-card or path-choice response shows the same knowledge as tracing.`,
      difficulty: 3 + supportRound, tag: "shape_not_path", hook: "quest-glow-trail", correct: `Path knowledge shown for ${item.name}. Motor neatness and speed are not scored.`, repair: "Keep the correct start. Replay one movement step, select its arrow or guide a large counter along the path before trying the next step.",
    });
  });
}

function directionCandidates(count) {
  const reversalPairs = [["b", "d"], ["p", "q"], ["m", "n"], ["u", "n"], ["v", "w"], ["i", "j"], ["c", "o"], ["f", "t"], ["g", "q"]];
  return Array.from({ length: count }, (_, index) => {
    if (index >= 26) {
      const [targetName, contrastName] = reversalPairs[(index - 26) % reversalPairs.length];
      const item = byLetter(targetName);
      const contrast = byLetter(contrastName);
      const answer = `${targetName}: start ${item.start}; ${item.steps.join(", then ")}`;
      const choices = rotate([answer, `${contrastName}: start ${contrast.start}; ${contrast.steps.join(", then ")}`, `${targetName}: copy its final shape from the bottom without a start point`], index % 3);
      return choiceCandidate({
        id: `discriminate-${targetName}-${contrastName}-${index + 1}`, format: "audio-choice", blueprint: "direction-choice-repairs", band: "expected", concept: "orientation_discrimination",
        prompt: `Mirror-map quest ${index + 1}: which spoken and static-arrow path makes lowercase ${targetName}, not ${contrastName}?`,
        body: { letter: targetName, contrast_letter: contrastName, choices, static_arrow_models: choices, letters_shown_together: false, interaction_mode: "listen_choose_keyboard_switch_eye_gaze_or_build_arrows" }, answer,
        hints: [`Name the letter you need: ${targetName}.`, `Check its start: ${item.start}, then follow the movement direction.`],
        explanation: `Lowercase ${targetName} uses this modelled path: start ${item.start}; ${item.steps.join("; ")}. The ${contrastName} path is different. This is orientation practice, not a memory or speed test.`, difficulty: 4, tag: "letter_reversal_or_orientation", hook: "quest-mirror-map", correct: `${targetName} path distinguished from ${contrastName} using start and direction.`, repair: "Show one letter at a time. Place a start token, then compare the first movement only before adding later steps.",
      });
    }
    const item = letters[index];
    const answer = `${item.steps.join(", then ")}.`;
    const choices = rotate([answer, reversedPath(item), `Start at the bottom and copy the finished ${item.name} shape backwards.`], index % 3);
    return choiceCandidate({
      id: `direction-${item.name}-${index + 1}`, format: "audio-choice", blueprint: "direction-choice-repairs", band: "expected", concept: "movement_direction",
      prompt: `Arrow-path quest ${index + 1}: which movement sequence forms lowercase ${item.name} in the displayed model?`,
      body: { letter: item.name, choices, static_arrow_models: choices, reduced_motion_default: true, interaction_mode: "choose_path_listen_keyboard_switch_or_place_arrow_cards" }, answer,
      hints: [`Start ${item.start}.`, `Follow the steps in order rather than copying only the final shape.`],
      explanation: `The modelled ${item.name} path is: ${item.steps.join("; ")}. Starting at the bottom or reversing the order can change its orientation or fluency.`, difficulty: 4, tag: "wrong_direction", hook: "quest-arrow-path", correct: `Direction route unlocked for ${item.name}.`, repair: "Freeze the model into numbered static arrows. Choose the first movement, then reveal the next movement only.",
    });
  });
}

function retrievalCandidates(count) {
  const reversalSets = [["b", "d", "p"], ["p", "q", "b"], ["m", "n", "h"], ["u", "n", "v"], ["v", "w", "x"], ["i", "j", "l"]];
  return Array.from({ length: count }, (_, index) => {
    const item = letters[index % letters.length];
    const mode = index % 3;
    if (mode === 0) {
      const familyNames = Object.keys(familyDescriptions);
      const familyName = familyNames[Math.floor(index / 3) % familyNames.length];
      const familyItem = letters.find((other) => other.family === familyName);
      const familyMates = letters.filter((other) => other.family === familyName && other.name !== familyItem.name).slice(0, 2).map((other) => other.name);
      const answer = familyName;
      const choices = rotate(unique([answer, ...familyDistractors(familyName, index)]), index % 3);
      return choiceCandidate({
        id: `family-${familyItem.name}-${index + 1}`, format: "start-point-tap", blueprint: "letter-family-retrieval", band: "retrieval", concept: "formation_family",
        prompt: `Movement-family revisit ${index + 1}: which family fits lowercase ${familyItem.name}?`,
        body: { letter: familyItem.name, choices, family_examples: [familyItem.name, ...familyMates], family_description: familyDescriptions[familyName], review_interval_days: reviewDay(index), interaction_mode: "choose_family_match_cards_or_give_verbal_reason" }, answer,
        hints: ["Think about the first movement, not the letter sound.", `${familyName} letters ${familyDescriptions[familyName]}.`], explanation: `${familyItem.name} belongs to the ${familyName} family in this pack because its modelled path ${familyDescriptions[familyName]}.`, difficulty: 3, tag: "family_by_shape_only", hook: "quest-family-grove", correct: `${familyItem.name} linked to ${familyName} by movement.`, repair: "Replay the first movement and compare two family cards at a time. Letter families are helpful practice groups, not a speed test.",
      });
    }
    if (mode === 1) {
      const set = reversalSets[index % reversalSets.length];
      const target = set.includes(item.name) ? item.name : set[0];
      const targetData = byLetter(target);
      const choices = rotate(set, index % set.length);
      return choiceCandidate({
        id: `recognise-${target}-${index + 1}`, format: "start-point-tap", blueprint: "letter-family-retrieval", band: "retrieval", concept: "letter_recognition_and_reversal_support",
        prompt: `Letter-lantern revisit ${index + 1}: choose lowercase ${target} after hearing its start and path clue.`,
        body: { letter: target, choices, path_clue: `starts ${targetData.start}; ${targetData.steps.join("; ")}`, letters_presented_one_at_a_time_option: true, review_interval_days: reviewDay(index), interaction_mode: "choose_letter_keyboard_switch_eye_gaze_or_tactile_card" }, answer: target,
        hints: [`Say the target name: ${target}.`, `Use the start and movement clue, not left-right guessing.`], explanation: `This is lowercase ${target}. It starts ${targetData.start} and follows its own movement path, which helps distinguish its orientation from similar letters.`, difficulty: 3, tag: "letter_reversal_or_orientation", hook: "quest-letter-lantern", correct: `${target} recognised using a movement clue.`, repair: "Remove one distractor, present letters separately and place the start dot before comparing their orientations.",
      });
    }
    const answer = item.start;
    const choices = rotate(unique([answer, ...startDistractors(answer)]), index % 3);
    return choiceCandidate({
      id: `recall-start-${item.name}-${index + 1}`, format: "start-point-tap", blueprint: "letter-family-retrieval", band: "retrieval", concept: "start_and_path_retrieval",
      prompt: `Trail-memory revisit ${index + 1}: where does lowercase ${item.name} start in the shown model?`, body: { letter: item.name, choices, review_interval_days: reviewDay(index), interaction_mode: "tap_keyboard_switch_eye_gaze_or_place_start_token" }, answer,
      hints: ["Picture the first movement only.", `The model starts ${item.start}.`], explanation: `Lowercase ${item.name} starts ${item.start} in this model before ${item.steps[0]}.`, difficulty: 3, tag: "wrong_start_point", hook: "quest-trail-memory", correct: `Start point recalled for ${item.name}.`, repair: "Use the family card, baseline and middle line; reveal the start dot without requiring a trace.",
    });
  });
}

function transferCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = letters[index % letters.length];
    const word = item.word;
    const targetIndex = word.indexOf(item.name);
    return traceCandidate({
      id: `transfer-${item.name}-${word}-${index + 1}`, blueprint: "word-link-transfer", band: "stretch", concept: "writing_transfer",
      prompt: `Word-bridge quest ${index + 1}: find lowercase ${item.name} in “${word}”, then show its movement path your way.`,
      body: { letter: item.name, word, target_letter_index: targetIndex, word_display: word.split("").map((character, position) => ({ character, target: position === targetIndex })), start_point: item.start, movement_steps: item.steps, tolerance: "wide", whole_word_writing_required: false, path_choice_alternative: pathChoices(item), interaction_mode: "trace_target_select_path_point_verbalise_air_write_or_use_letter_card" },
      rubric: ["recognises_target_letter_in_word", startRubric(item), "shows_path_knowledge_by_motor_or_non_motor_route"],
      hints: [`Find ${item.name} in ${word}; you do not have to write the whole word.`, `Start ${item.start}, then ${item.steps[0]}.`],
      explanation: `The target ${item.name} appears in ${word}. Its displayed formation starts ${item.start} and follows: ${item.steps.join("; ")}. Finding and forming the target letter transfers the skill without requiring full-word handwriting.`, difficulty: 5, tag: "word_writing_motor_overload", hook: "quest-word-bridge", correct: `Word bridge built: ${item.name} recognised in ${word} and its path shown.`, repair: "Cover the other letters, keep only the target visible and choose trace, arrows, verbal steps, eye-gaze or a tactile letter card.",
    });
  });
}

function choiceCandidate({ id, format, blueprint, band, concept, prompt, body, answer, hints, explanation, difficulty, tag, hook, correct, repair }) {
  return commonCandidate({ id, format, blueprint, band, concept, prompt, body, expected: { value: answer }, hints, explanation, difficulty, tag, hook, correct, repair });
}

function traceCandidate({ id, blueprint, band, concept, prompt, body, rubric, hints, explanation, difficulty, tag, hook, correct, repair }) {
  return commonCandidate({ id, format: "trace-path", blueprint, band, concept, prompt, body, expected: { rubric }, hints, explanation, difficulty, tag, hook, correct, repair });
}

function commonCandidate({ id, format, blueprint, band, concept, prompt, body, expected, hints, explanation, difficulty, tag, hook, correct, repair }) {
  const fullId = `${prefix}${id}`;
  return {
    id: fullId,
    format,
    body: {
      prompt, ...body,
      concept_focus: concept,
      response_mode: "touch_stylus_mouse_keyboard_switch_eye_gaze_verbal_tactile_or_adult_scribed",
      motor_alternatives: { tracing_required: false, select_correct_path: true, sequence_arrow_cards: true, verbalise_movements: true, eye_gaze_choice: true, tactile_letter_route: true, adult_guided_large_movement_with_consent: true },
      dysgraphia_support: { wide_path: true, large_scale_option: true, stabilised_input_option: true, rest_breaks: true, no_neatness_score: true, motor_output_separate_from_formation_knowledge: true },
      visual_support: { start_dot: true, baseline_and_middle_line: true, numbered_arrows: true, one_step_at_a_time: true, high_contrast_option: true, left_right_words_not_used_alone: true },
      verbal_route: "listen_to_or_say_start_then_movement_steps",
      supported_interaction: "adult_or_peer_may_read_scan_position_materials_and_record_path_choices_without_moving_for_the_learner",
      audio_replay: true,
      audio_asset_id: `narration-${fullId}`,
      audio_provider: "ElevenLabs",
      audio_asset_status: "required_human_listening_review",
      human_listening_approval_required: true,
      browser_tts_allowed: false,
      browser_tts_fallback: "prohibited",
      unavailable_audio_state: "honest_not_ready_visual_and_tactile_routes_remain",
      reduced_motion: "static_numbered_arrows",
      no_timer: true,
      speed_score_allowed: false,
      precision_only_score_allowed: false,
      retry_without_penalty: true,
      preserve_correct_start_and_steps: true,
      gamification: { mission: "restore a glowing rune trail in the Joyful Letter Quest", reward: "one calm quest spark for noticing a start, path or letter link", loss_on_error: false, streak_pressure: false, leaderboard: false, speed_bonus: false, retry_message: "Your correct trail pieces stay. Choose another route and add the next step." },
      difficulty_band: band,
      evidence_purpose: blueprint.replaceAll("-", "_"),
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
    },
    expected_answer: expected,
    hints,
    explanation,
    feedback: { correct, repair, path_evidence: explanation, motor_affirmation: "Formation knowledge can be shown by tracing, choosing, pointing, speaking or arranging arrows; motor neatness is not the learning judgement." },
    difficulty,
    status: "review",
    misconception_tag: tag,
    animation_hook: hook,
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
    if (!variant.body.motor_alternatives || variant.body.motor_alternatives.tracing_required !== false || !variant.body.dysgraphia_support?.motor_output_separate_from_formation_knowledge) throw new Error(`${variant.id} lacks motor alternatives.`);
    if (!variant.body.response_mode.includes("keyboard") || !variant.body.response_mode.includes("switch") || !variant.body.response_mode.includes("eye_gaze") || !variant.body.response_mode.includes("tactile")) throw new Error(`${variant.id} lacks SEND response routes.`);
    if (variant.body.audio_provider !== "ElevenLabs" || variant.body.audio_asset_status !== "required_human_listening_review" || variant.body.human_listening_approval_required !== true || variant.body.browser_tts_allowed !== false || variant.body.browser_tts_fallback !== "prohibited") throw new Error(`${variant.id} violates audio policy.`);
    if (variant.body.no_timer !== true || variant.body.speed_score_allowed !== false || variant.body.precision_only_score_allowed !== false || variant.body.gamification?.streak_pressure !== false || variant.body.gamification?.loss_on_error !== false) throw new Error(`${variant.id} introduces pressure.`);
    if (!variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.path_evidence || !variant.feedback?.motor_affirmation) throw new Error(`${variant.id} lacks rich feedback.`);
    if (variant.format === "trace-path") {
      if (!Array.isArray(variant.expected_answer.rubric) || variant.expected_answer.rubric.length < 3 || !variant.body.path_choice_alternative) throw new Error(`${variant.id} lacks trace and non-trace evidence.`);
    } else {
      const choices = variant.body.choices;
      if (!Array.isArray(choices) || choices.length < 3 || new Set(choices).size !== choices.length) throw new Error(`${variant.id} has invalid choices.`);
      if (choices.filter((choice) => choice === variant.expected_answer.value).length !== 1) throw new Error(`${variant.id} must offer exactly one expected answer.`);
    }
    if (variant.body.prompt.length > 130) throw new Error(`${variant.id} prompt is too long for Year 1.`);
  }
  const allocation = countBy(currentPack.question_variants, assignedBlueprint);
  for (const [id, expected] of Object.entries(pilotAllocation)) if (allocation[id] !== expected) throw new Error(`${id} expected ${expected}, found ${allocation[id] ?? 0}.`);
  const letterCoverage = new Set(generated.map((variant) => variant.body.letter));
  for (const item of letters) if (!letterCoverage.has(item.name)) throw new Error(`Missing lowercase ${item.name}.`);
  const concepts = new Set(generated.map((variant) => variant.body.concept_focus));
  for (const concept of ["start_point", "guided_movement_path", "movement_direction", "orientation_discrimination", "formation_family", "letter_recognition_and_reversal_support", "writing_transfer"]) if (!concepts.has(concept)) throw new Error(`Missing concept ${concept}.`);
}

function curatedBlueprint(variant) {
  const map = {
    "en-y1-phonics-form-lowercase-letters-q-c-start": "start-point-taps",
    "en-y1-phonics-form-lowercase-letters-q-c-direction": "direction-choice-repairs",
    "en-y1-phonics-form-lowercase-letters-q-trace-c": "guided-letter-traces",
  };
  const value = map[variant.id];
  if (!value) throw new Error(`No curated blueprint assignment for ${variant.id}.`);
  return value;
}
function assignedBlueprint(variant) { return variant.body?.variant_blueprint_id ?? curatedBlueprint(variant); }
function letter(name, family, start, steps, word) { return { name, family, start, steps, word }; }
function byLetter(name) { return letters.find((item) => item.name === name); }
function startRubric(item) { return `starts_${slug(item.start)}`; }
function pathChoices(item) { return [item.steps, [...item.steps].reverse(), ["copy the final shape from any point"]]; }
function reversedPath(item) { return item.steps.length === 1 ? "Start at the bottom and move straight up." : `${[...item.steps].reverse().join(", then ")}.`; }
function startDistractors(correct) { return ["at the bottom", "at the middle on the left", "at the top"].filter((value) => value !== correct).slice(0, 2); }
function familyDistractors(correct, index) { return rotate(Object.keys(familyDescriptions).filter((family) => family !== correct), index % 5).slice(0, 2); }
function reviewDay(index) { return [1, 3, 7, 14, 30][index % 5]; }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function unique(items) { return [...new Set(items)]; }
function slug(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function normalise(value) { return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " "); }
function countBy(items, keyFor) { const result = {}; for (const item of items) { const key = keyFor(item); result[key] = (result[key] ?? 0) + 1; } return result; }
function summary(items, keyFor) { return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
