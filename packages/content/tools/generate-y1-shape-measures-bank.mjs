#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/ma-y1-shape-and-measures.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "ma-y1-shape-measures-bank-";
const reviewBatch = "y1-shape-measures-pilot-a";
const pilotAllocation = {
  "shape-feature-and-family-sorts": 48,
  "position-direction-and-movement": 48,
  "fair-comparison-and-unit-measure": 48,
  "event-order-duration-and-coin-value": 48,
  "mixed-shape-measure-retrieval": 48,
};

const shapes = [
  shape("circle", "2-D", 0, 0, "one continuous curved edge", "a flat round shape", "roll is not used for a flat drawing"),
  shape("triangle", "2-D", 3, 3, "three straight sides", "a flat three-sided shape in any orientation", "orientation does not change its name"),
  shape("square", "2-D", 4, 4, "four equal straight sides", "a flat shape with four equal sides and four corners", "a rotated square stays a square"),
  shape("rectangle", "2-D", 4, 4, "four straight sides", "a flat four-sided shape with opposite sides equal", "it need not be shown with its longest sides horizontal"),
  shape("cube", "3-D", null, null, "six flat square faces", "a solid with six equal square faces", "it can stack and its name does not depend on colour"),
  shape("cuboid", "3-D", null, null, "six flat rectangular faces", "a box-shaped solid with six rectangular faces", "some faces may be square"),
  shape("pyramid", "3-D", null, null, "flat faces meeting at a point", "a solid with a base and triangular faces meeting at a point", "the reviewed model uses a square base"),
  shape("sphere", "3-D", null, null, "one curved surface and no flat faces", "a completely round solid", "it can roll in many directions"),
  shape("cylinder", "3-D", null, null, "two flat circular faces and one curved surface", "a solid with two circular ends", "it can roll on its curved surface and stack on a flat face"),
];

const positionCases = [
  position("above", "Place the star above the box.", "star above box", ["star above box", "star below box", "star inside box"]),
  position("below", "Place the shell below the bridge.", "shell below bridge", ["shell below bridge", "shell above bridge", "shell on bridge"]),
  position("inside", "Put the cube inside the hoop.", "cube inside hoop", ["cube inside hoop", "cube outside hoop", "cube beside hoop"]),
  position("outside", "Put the cone outside the basket.", "cone outside basket", ["cone outside basket", "cone inside basket", "cone under basket"]),
  position("beside", "Place the flag beside the tower.", "flag beside tower", ["flag beside tower", "flag inside tower", "flag above tower"]),
  position("between", "Put the sphere between the two blocks.", "sphere between two blocks", ["sphere between two blocks", "sphere above both blocks", "sphere behind one block"]),
  position("in front of", "Place the robot in front of the screen.", "robot in front of screen", ["robot in front of screen", "robot behind screen", "robot inside screen"]),
  position("behind", "Place the cart behind the gate.", "cart behind gate", ["cart behind gate", "cart in front of gate", "cart above gate"]),
  position("left of", "From the builder's view, put the key left of the map.", "key left of map from builder view", ["key left of map from builder view", "key right of map from builder view", "key on map"]),
  position("right of", "From the builder's view, put the gem right of the door.", "gem right of door from builder view", ["gem right of door from builder view", "gem left of door from builder view", "gem inside door"]),
  position("quarter turn", "Turn the arrow one quarter turn clockwise from up.", "arrow points right", ["arrow points right", "arrow points down", "arrow still points up"]),
  position("half turn", "Turn the arrow one half turn from up.", "arrow points down", ["arrow points down", "arrow points right", "arrow still points up"]),
];

const measureCases = [
  measure("ribbon", "length", "red ribbon", 8, "blue ribbon", 5, "equal cubes", "longer", "red ribbon", "align both starting ends"),
  measure("pencil", "length", "green pencil", 6, "yellow pencil", 9, "equal blocks", "shorter", "green pencil", "align both ends at zero"),
  measure("tower", "height", "block tower A", 10, "block tower B", 7, "equal cubes", "taller", "block tower A", "stand both towers on the same level surface"),
  measure("plant", "height", "model plant A", 4, "model plant B", 6, "equal strips", "shorter", "model plant A", "measure from the same baseline"),
  measure("bag", "mass", "bag A", 7, "bag B", 4, "equal balance weights", "heavier", "bag A", "use a balance rather than picture size"),
  measure("parcel", "mass", "parcel A", 3, "parcel B", 8, "equal balance weights", "lighter", "parcel A", "use a level balance comparison"),
  measure("jug", "capacity", "jug A", 6, "jug B", 9, "equal small cups", "holds less", "jug A", "fill with the same-size cup"),
  measure("bottle", "capacity", "bottle A", 10, "bottle B", 7, "equal small cups", "holds more", "bottle A", "count equal cupfuls without spilling"),
  measure("worm", "length", "model worm A", 11, "model worm B", 8, "equal tiles", "longer", "model worm A", "straighten both models and align starts"),
  measure("building", "height", "model building A", 5, "model building B", 5, "equal cubes", "same height", "both models", "use one baseline and equal units"),
  measure("rock", "mass", "rock A", 6, "large foam block", 2, "equal balance weights", "heavier", "rock A", "mass is tested, not guessed from size"),
  measure("container", "capacity", "short wide container", 8, "tall narrow container", 5, "equal small cups", "holds more", "short wide container", "capacity is tested, not guessed from height"),
];

const timeCases = [
  timeCase("morning-routine", ["wake up", "eat breakfast", "start school"], "event_order", "First wake up, next eat breakfast, then start school."),
  timeCase("planting", ["put soil in the pot", "plant the seed", "water the soil"], "event_order", "First add soil, next plant the seed, then water it."),
  timeCase("painting", ["open the paint box", "paint the picture", "wash the brush"], "event_order", "Open the paint box before painting and wash the brush afterwards."),
  timeCase("lunch", ["wash hands", "eat lunch", "clear the plate"], "event_order", "Wash hands before lunch and clear the plate after eating."),
  timeCase("day-language", ["morning", "afternoon", "evening", "night"], "time_of_day_order", "Morning comes before afternoon, then evening and night."),
  timeCase("week-start", ["Monday", "Tuesday", "Wednesday"], "day_order", "Tuesday is after Monday and before Wednesday."),
  timeCase("short-long", ["clap once", "sing a short song"], "duration_compare", "A single clap takes less time than singing the song."),
  timeCase("brush-build", ["brush teeth", "build a block tower"], "duration_compare", "The shown timer record says building the tower took longer."),
  timeCase("quick-slow", ["blink once", "walk across the playground"], "duration_compare", "A blink is quicker than the recorded playground walk."),
  timeCase("before-after", ["put on socks", "put on shoes"], "before_after", "Socks are put on before shoes in this instruction."),
  timeCase("today-tomorrow", ["today", "tomorrow"], "relative_day_language", "Tomorrow is the day after today."),
  timeCase("yesterday-today", ["yesterday", "today"], "relative_day_language", "Yesterday is the day before today."),
];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "ma-y1-shape-and-measures") throw new Error("This generator only supports the Year 1 shape-and-measures pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedCounts = countBy(curated, (variant) => variant.body?.variant_blueprint_id);
const targets = Object.fromEntries(Object.entries(pilotAllocation).map(([id, target]) => [id, target - (curatedCounts[id] ?? 0)]));
for (const [id, target] of Object.entries(targets)) if (target < 0) throw new Error(`Curated variants exceed the allocation for ${id}.`);

const generated = [
  ...shapeCandidates(targets["shape-feature-and-family-sorts"]),
  ...positionCandidates(targets["position-direction-and-movement"]),
  ...measureCandidates(targets["fair-comparison-and-unit-measure"]),
  ...timeCandidates(targets["event-order-duration-and-coin-value"]),
  ...retrievalCandidates(targets["mixed-shape-measure-retrieval"]),
];

pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa.notes = "Review-stage Year 1 shape-and-measures pack with a deterministic 240-item pilot bank. Five curated variants are preserved alongside candidates covering common 2-D and 3-D shape recognition and properties, varied orientation, referenced position, quarter and half turns, fair direct comparison and equal non-standard units for length, height, mass and capacity, plus event order, duration and time language. Generated candidates include concrete, tactile, visual, verbal and non-drag motor routes; feedback repairs appearance, alignment, unit-gap, capacity-height, size-mass and viewer-reference misconceptions. Joyful builder missions remain untimed and reward observing, comparing and checking rather than speed. Referenced audio is ElevenLabs-gated for human listening review with browser TTS prohibited. Independent mathematics, SEND, coin-image, narration and renderer review remains required before promotion.";

validateBank(pack, curated, generated);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y1-shape-measures-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y1-shape-measures-bank blueprints=${summary(pack.question_variants, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`y1-shape-measures-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y1-shape-measures-bank concepts=${summary(generated, (variant) => variant.body.concept_focus)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y1-shape-measures-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 1 shape-and-measures bank is out of date; run generate-y1-shape-measures-bank.mjs --write.");
  console.log("y1-shape-measures-bank deterministic check passed");
} else {
  console.log("y1-shape-measures-bank dry-run; pass --write to update the pack");
}

function shapeCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = shapes[index % shapes.length];
    const mode = Math.floor(index / shapes.length) % 3;
    if (mode === 1) return shapePropertyCandidate(item, index);
    if (mode === 2) return dimensionCandidate(item, index);
    const choices = rotate(unique([item.name, ...shapeDistractors(item, index)]), index % 3);
    return candidate({
      id: `shape-name-${item.name}-${index + 1}`, format: "shape-sort", blueprint: "shape-feature-and-family-sorts", band: "intro", concept: "shape_recognition",
      prompt: `Shape-yard build ${index + 1}: which name matches the outlined shape?`, body: { shape: item.name, dimension: item.dimension, choices, reviewed_shape_description: item.description, orientation: ["usual", "rotated", "tilted"][index % 3], size_and_colour_irrelevant: true, interaction_mode: "tap_sort_keyboard_switch_eye_gaze_or_place_shape_card" }, answer: item.name,
      hints: ["Ignore colour, size and which way it points.", `Use the defining clue: ${item.feature}.`], explanation: `The shape is a ${item.name} because ${item.feature}. ${sentenceStart(item.note)}.`, difficulty: 2, tag: "appearance_over_defining_features", hook: "builder-shape-outline",
      correct: `Shape identified by its properties: ${item.name}.`, repair: "Trace or hear the boundary and count sides, corners, faces or surfaces before choosing the name.",
      concrete: `Use a large ${item.name} model or raised outline with audio labels; handling is optional and an adult may position it.`, visual: "Show the same shape in varied colours, sizes and orientations beside a plain text description.",
    });
  });
}

function shapePropertyCandidate(item, index) {
  const answer = item.feature;
  const choices = rotate([answer, item.dimension === "2-D" ? "it is the brightest colour" : "it is shown larger than the other solids", item.dimension === "2-D" ? "it points upwards" : "it has no surfaces"], index % 3);
  return candidate({
    id: `shape-feature-${item.name}-${index + 1}`, format: "shape-sort", blueprint: "shape-feature-and-family-sorts", band: "intro", concept: "shape_properties",
    prompt: `Feature-brick ${index + 1}: which clue helps identify this ${item.name}?`, body: { shape: item.name, dimension: item.dimension, choices, feature_model: item.feature, reviewed_shape_description: item.description, interaction_mode: "choose_feature_count_touch_outline_or_say" }, answer,
    hints: ["Choose a side, corner, face or surface clue.", "Colour, size and orientation do not define the shape."], explanation: `${sentenceStart(item.name)}: ${item.feature}. This property is more useful than colour or display direction.`, difficulty: 2, tag: "appearance_over_defining_features", hook: "builder-feature-brick",
    correct: `Defining feature selected for ${item.name}.`, repair: "Use a raised edge or static highlight to examine one feature at a time, then compare only two choices.", concrete: `Use a tactile ${item.name} outline or solid plus countable feature markers.`, visual: "Highlight sides, corners, faces and curved surfaces one category at a time.",
  });
}

function dimensionCandidate(item, index) {
  const answer = item.dimension;
  const choices = ["2-D", "3-D", "cannot decide from colour"];
  return candidate({
    id: `shape-dimension-${item.name}-${index + 1}`, format: "shape-sort", blueprint: "shape-feature-and-family-sorts", band: "intro", concept: "two_d_three_d_distinction",
    prompt: `Flat-or-solid gate ${index + 1}: is the reviewed ${item.name} model 2-D or 3-D?`, body: { shape: item.name, choices: rotate(choices, index % 3), reviewed_shape_description: item.description, comparison_language: item.dimension === "2-D" ? "flat shape" : "solid shape", interaction_mode: "sort_flat_solid_keyboard_switch_or_point" }, answer,
    hints: [item.dimension === "2-D" ? "A 2-D shape is flat." : "A 3-D shape is solid and has surfaces.", "Do not decide from colour."], explanation: `A ${item.name} is ${item.dimension}: ${item.description}.`, difficulty: 2, tag: "flat_solid_confusion", hook: "builder-flat-solid-gate",
    correct: `${item.name} sorted as ${item.dimension}.`, repair: "Compare a raised flat outline with a solid model, or use the full text descriptions without requiring touch.", concrete: `Offer a flat ${item.name} card and, where relevant, a solid model for contrast.`, visual: "Use side-by-side flat and solid icons with complete descriptions.",
  });
}

function positionCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = positionCases[index % positionCases.length];
    const round = Math.floor(index / positionCases.length);
    const choices = rotate(item.choices, index % item.choices.length);
    return candidate({
      id: `position-${slug(item.word)}-${index + 1}`, format: "position-move", blueprint: "position-direction-and-movement", band: "developing", concept: item.word.includes("turn") ? "whole_half_quarter_turns" : "position_language",
      prompt: `Builder map ${index + 1}: ${item.instruction}`, body: { position_word: item.word, reference_frame: item.word.includes("left") || item.word.includes("right") ? "builder_view_marked_with_arrow" : "named_reference_object", choices, before_frame: "object at start marker", after_frame_options: choices, static_before_after_available: true, interaction_mode: "tap_destination_keyboard_switch_eye_gaze_or_choose_after_frame" }, answer: item.answer,
      hints: ["Find the named reference object or marked viewer first.", item.word.includes("turn") ? "A quarter turn is one of four equal turns; a half turn faces the opposite way." : `Listen for the position word ${item.word}.`],
      explanation: `${item.instruction} The matching result is ${item.answer}. The reference object or viewer stays clearly marked.`, difficulty: 3 + (round % 2), tag: item.word.includes("left") || item.word.includes("right") ? "viewer_object_position_confusion" : item.word.includes("turn") ? "turn_size_confusion" : "reference_object_ignored", hook: "builder-position-map",
      correct: `Position instruction completed: ${item.answer}.`, repair: "Freeze the scene, mark the reference object and viewer, then choose between two static after-frames without dragging.",
      concrete: "Use a tactile mat, one movable token and a fixed reference token; the learner may direct an adult's movement.", visual: "A plain scene labels the reference object and uses static before-and-after panels.",
    });
  });
}

function measureCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = measureCases[index % measureCases.length];
    const round = Math.floor(index / measureCases.length);
    const choices = rotate(unique([item.answer, item.a, item.b, "cannot decide without a fair comparison"]), index % 4);
    return candidate({
      id: `measure-${item.id}-${index + 1}`, format: "measure-compare", blueprint: "fair-comparison-and-unit-measure", band: "expected", concept: `${item.kind}_comparison`,
      prompt: `Measure station ${index + 1}: which is ${item.question}?`, body: { measure_kind: item.kind, objects: [{ id: item.a, units: item.aUnits }, { id: item.b, units: item.bUnits }], equal_non_standard_unit: item.unit, fair_method: item.method, choices, representation: measureRepresentation(item.kind), unit_layout: "equal_units_no_gaps_or_overlaps", interaction_mode: "auto_align_fill_balance_choose_keyboard_switch_or_say" }, answer: item.answer,
      hints: [measureHint(item.kind), `${sentenceStart(item.a)} measures ${item.aUnits} ${item.unit}; ${item.b} measures ${item.bUnits}.`],
      explanation: `${item.method}. Using ${item.unit}, ${item.a} measures ${item.aUnits} and ${item.b} measures ${item.bUnits}, so ${item.answer} is ${item.question}.`, difficulty: 4 + (round % 2), tag: measureTag(item), hook: "builder-measure-station",
      correct: `Fair ${item.kind} comparison complete: ${item.answer}.`, repair: measureRepair(item.kind),
      concrete: measureConcrete(item.kind), visual: `Use a static ${measureRepresentation(item.kind)} with equal units, text values and the fair method shown.`,
    });
  });
}

function timeCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = timeCases[index % timeCases.length];
    const round = Math.floor(index / timeCases.length);
    const isSequence = item.type.includes("order") || item.type === "event_order";
    let answer;
    let choices;
    let prompt;
    if (isSequence) {
      answer = item.events;
      choices = sequenceChoices(item.events);
      prompt = `Time trail ${index + 1}: listen, then choose the first-to-last order.`;
    } else if (item.type === "duration_compare") {
      answer = item.events.length === 2 ? `${item.events[0]} takes less time than ${item.events[1]}` : item.explanation;
      choices = [answer, `${item.events[1]} takes less time than ${item.events[0]}`, "Picture size tells which event takes longer"];
      prompt = `Duration bridge ${index + 1}: which statement matches the recorded event times?`;
    } else if (item.type === "before_after") {
      answer = `${item.events[0]} comes before ${item.events[1]}`;
      choices = [answer, `${item.events[1]} comes before ${item.events[0]}`, "Both happen at exactly the same time"];
      prompt = `Before-and-after path ${index + 1}: which statement matches the instruction?`;
    } else {
      answer = item.explanation;
      choices = [answer, "The two day words mean the same day.", "Picture position decides the day word."];
      prompt = `Day-word signal ${index + 1}: which explanation is correct?`;
    }
    return candidate({
      id: `time-${item.id}-${index + 1}`, format: "audio-sequence", blueprint: "event-order-duration-and-coin-value", band: "secure", concept: item.type,
      prompt, body: { events: item.events, choices: rotate(choices, index % choices.length), narration_script: timeNarration(item), sequence_type: item.type, audio_first: true, replay_whole_or_chunk: true, picture_position_randomised: true, formal_clock_reading_required: false, interaction_mode: "choose_sequence_number_cards_keyboard_switch_eye_gaze_or_say" }, answer,
      hints: [isSequence ? "Listen for first, next, after and last." : "Use the recorded order or duration, not picture size.", item.explanation], explanation: item.explanation, difficulty: 4 + (round % 2), tag: item.type === "duration_compare" ? "appearance_or_routine_guess" : "event_order_from_picture_position", hook: "builder-time-trail",
      correct: "Time-language evidence matched without speed scoring.", repair: "Replay one event or phrase at a time and place numbered cards or choose a static order; keep correct cards in place.",
      concrete: "Use large event cards, FIRST/NEXT/LAST or BEFORE/AFTER tactile labels and partner-assisted placement.", visual: "Show one event at a time, then reveal static numbered slots after listening.",
    });
  });
}

function retrievalCandidates(count) {
  const modes = ["shape", "position", "length_height", "mass_capacity", "time", "method"];
  return Array.from({ length: count }, (_, index) => {
    const mode = modes[index % modes.length];
    if (mode === "shape") return retrievalShape(index);
    if (mode === "position") return retrievalPosition(index);
    if (mode === "time") return retrievalTime(index);
    return retrievalMeasure(index, mode);
  });
}

function retrievalShape(index) {
  const item = shapes[(index * 2 + 1) % shapes.length];
  const answer = item.feature;
  const choices = rotate([answer, "its colour is the same as the builder flag", "it is facing the usual way"], index % 3);
  return candidate({
    id: `retrieve-shape-${item.name}-${index + 1}`, format: "feature-tap", blueprint: "mixed-shape-measure-retrieval", band: "retrieval", concept: "shape_feature_retrieval",
    prompt: `Builder revisit ${index + 1}: which feature confirms the rotated or resized shape is a ${item.name}?`, body: { shape: item.name, choices, representation_switch: item.dimension === "2-D" ? "raised_outline_and_picture" : "solid_model_and_text_view", review_interval_days: reviewDay(index), interaction_mode: "tap_feature_keyboard_switch_eye_gaze_or_say" }, answer,
    hints: ["Ignore orientation, size and colour.", `Check ${item.feature}.`], explanation: `${sentenceStart(item.name)} is identified by ${item.feature}, even when its appearance changes.`, difficulty: 3, tag: "appearance_over_defining_features", hook: "builder-feature-revisit",
    correct: `Shape property retrieved: ${item.feature}.`, repair: "Compare the same shape in two orientations and mark only sides, corners, faces or surfaces.", concrete: `Use a raised or solid ${item.name} model with feature markers.`, visual: "Use two sizes and orientations with the same defining features highlighted.",
  });
}

function retrievalPosition(index) {
  const item = positionCases[(index * 5 + 2) % positionCases.length];
  return candidate({
    id: `retrieve-position-${slug(item.word)}-${index + 1}`, format: "feature-tap", blueprint: "mixed-shape-measure-retrieval", band: "retrieval", concept: "position_retrieval",
    prompt: `Map-word revisit ${index + 1}: which after-frame matches “${item.instruction}”?`, body: { position_word: item.word, choices: rotate(item.choices, index % item.choices.length), reference_frame: "explicitly_marked", review_interval_days: reviewDay(index), interaction_mode: "choose_after_frame_keyboard_switch_or_direct_adult" }, answer: item.answer,
    hints: ["Mark the reference object or viewer first.", `Use the word ${item.word}.`], explanation: `The matching after-frame is ${item.answer}.`, difficulty: 3, tag: "viewer_object_position_confusion", hook: "builder-map-word-revisit",
    correct: `Position word retrieved: ${item.word}.`, repair: "Reduce to two static after-frames and point to the marked reference before choosing.", concrete: "Use one movable token on a tactile position mat; the learner may direct an adult.", visual: "Use a plain static scene with reference and viewer arrows clearly labelled.",
  });
}

function retrievalMeasure(index, mode) {
  const pool = measureCases.filter((item) => mode === "length_height" ? ["length", "height"].includes(item.kind) : mode === "mass_capacity" ? ["mass", "capacity"].includes(item.kind) : true);
  const item = pool[index % pool.length];
  const answer = item.method;
  const wrong = item.kind === "length" || item.kind === "height" ? "start at different places and compare the far ends" : item.kind === "mass" ? "choose the object that looks larger" : "choose the taller container without filling it";
  const choices = rotate([answer, wrong, "use different-sized units for each object"], index % 3);
  return candidate({
    id: `retrieve-measure-${item.id}-${index + 1}`, format: "feature-tap", blueprint: "mixed-shape-measure-retrieval", band: "retrieval", concept: mode === "method" ? "fair_measure_method_retrieval" : `${item.kind}_retrieval`,
    prompt: `Fair-measure revisit ${index + 1}: which method gives useful ${item.kind} evidence?`, body: { measure_kind: item.kind, choices, representation_switch: measureRepresentation(item.kind), review_interval_days: reviewDay(index), interaction_mode: "choose_method_point_to_model_keyboard_switch_or_aac" }, answer,
    hints: [measureHint(item.kind), "Use equal units and a shared starting condition where needed."], explanation: `${sentenceStart(item.method)} gives fair ${item.kind} evidence. Appearance alone is not enough.`, difficulty: 3, tag: measureTag(item), hook: "builder-fair-method-revisit",
    correct: `Fair ${item.kind} method retrieved.`, repair: measureRepair(item.kind), concrete: measureConcrete(item.kind), visual: `Show the fair and unfair ${measureRepresentation(item.kind)} side by side with text descriptions.`,
  });
}

function retrievalTime(index) {
  const item = timeCases[(index * 7 + 1) % timeCases.length];
  const answer = item.explanation;
  const choices = rotate([answer, "Picture size or screen position decides the time answer.", "All events take the same amount of time."], index % 3);
  return candidate({
    id: `retrieve-time-${item.id}-${index + 1}`, format: "feature-tap", blueprint: "mixed-shape-measure-retrieval", band: "retrieval", concept: "time_language_retrieval",
    prompt: `Time-word revisit ${index + 1}: which explanation matches the spoken event record?`, body: { events: item.events, choices, narration_script: timeNarration(item), review_interval_days: reviewDay(index), interaction_mode: "choose_listen_keyboard_switch_eye_gaze_or_say" }, answer,
    hints: ["Replay the order or duration clue.", "Do not use picture size or position as time evidence."], explanation: answer, difficulty: 3, tag: "appearance_or_routine_guess", hook: "builder-time-word-revisit",
    correct: "Time explanation matched to the spoken record.", repair: "Replay in chunks and use BEFORE/AFTER or QUICKER/LONGER symbol cards.", concrete: "Use tactile event cards and time-language labels with partner-assisted placement.", visual: "Use numbered static event cards and a text equivalent after replay.",
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
      response_mode: "tap_drag_keyboard_switch_eye_gaze_aac_oral_object_action_or_adult_scribed",
      supported_interaction: "adult_or_peer_may_read_scan_auto_align_move_models_and_record_without_supplying_the_mathematical_answer",
      concrete_route: concrete,
      tactile_route: "raised outlines or mats, large tokens and tactile labels; direct handling is optional",
      visual_route: visual,
      motor_alternative: "choose a static result, direct an adult, use switch scanning or describe the move instead of precision dragging",
      audio_replay: true,
      audio_asset_id: `narration-${fullId}`,
      audio_provider: "ElevenLabs",
      audio_asset_status: "required_human_listening_review",
      human_listening_approval_required: true,
      browser_tts_allowed: false,
      reduced_motion: "static_before_after_and_instant_state_change",
      no_timer: true,
      speed_score_allowed: false,
      retry_without_penalty: true,
      preserve_correct_observations: true,
      gamification: { mission: "help the Joyful Builder Crew restore a shape, map, measure or time station", reward: "one calm builder spark for a checked property or comparison", loss_on_error: false, streak_pressure: false, leaderboard: false, speed_bonus: false, retry_message: "Your correct building clues stay. Choose another tool or view and continue." },
      difficulty_band: band,
      evidence_purpose: blueprint.replaceAll("-", "_"),
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
    },
    expected_answer: { value: answer }, hints, explanation,
    feedback: { correct, repair, evidence: explanation, method_praise: "Concrete, visual, tactile, spoken and non-drag routes carry equal evidence; careful checking matters more than speed." },
    difficulty, status: "review", misconception_tag: tag, animation_hook: hook,
  };
}

function validateBank(currentPack, authored, generated) {
  if (authored.length !== 5) throw new Error(`Expected exactly 5 curated variants, found ${authored.length}. Refusing to overwrite possible authored work.`);
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
    if (!variant.body.concrete_route || !variant.body.visual_route || !variant.body.tactile_route || !variant.body.motor_alternative || !variant.body.supported_interaction) throw new Error(`${variant.id} lacks SEND routes.`);
    if (!variant.body.response_mode.includes("keyboard") || !variant.body.response_mode.includes("switch") || !variant.body.response_mode.includes("eye_gaze") || !variant.body.response_mode.includes("aac")) throw new Error(`${variant.id} lacks supported responses.`);
    if (variant.body.audio_provider !== "ElevenLabs" || variant.body.audio_asset_status !== "required_human_listening_review" || variant.body.browser_tts_allowed !== false) throw new Error(`${variant.id} violates audio policy.`);
    if (variant.body.no_timer !== true || variant.body.speed_score_allowed !== false || variant.body.gamification?.streak_pressure !== false || variant.body.gamification?.loss_on_error !== false) throw new Error(`${variant.id} introduces pressure.`);
    if (!variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.evidence || !variant.feedback?.method_praise) throw new Error(`${variant.id} lacks rich feedback.`);
    const choices = variant.body.choices;
    if (!Array.isArray(choices) || choices.length < 3 || new Set(choices.map((choice) => JSON.stringify(choice))).size !== choices.length) throw new Error(`${variant.id} has invalid choices.`);
    if (choices.filter((choice) => JSON.stringify(choice) === JSON.stringify(variant.expected_answer.value)).length !== 1) throw new Error(`${variant.id} must offer exactly one expected answer.`);
    if (variant.body.prompt.length > 150) throw new Error(`${variant.id} prompt is too long for Year 1.`);
  }
  const allocation = countBy(currentPack.question_variants, (variant) => variant.body.variant_blueprint_id);
  for (const [id, expected] of Object.entries(pilotAllocation)) if (allocation[id] !== expected) throw new Error(`${id} expected ${expected}, found ${allocation[id] ?? 0}.`);
  const concepts = new Set(generated.map((variant) => variant.body.concept_focus));
  for (const concept of ["shape_recognition", "shape_properties", "two_d_three_d_distinction", "position_language", "whole_half_quarter_turns", "length_comparison", "height_comparison", "mass_comparison", "capacity_comparison", "event_order", "duration_compare", "time_language_retrieval"]) if (!concepts.has(concept)) throw new Error(`Missing concept ${concept}.`);
}

function shape(name, dimension, sides, corners, feature, description, note) { return { name, dimension, sides, corners, feature, description, note }; }
function position(word, instruction, answer, choices) { return { word, instruction, answer, choices }; }
function measure(id, kind, a, aUnits, b, bUnits, unit, question, answer, method) { return { id, kind, a, aUnits, b, bUnits, unit, question, answer, method }; }
function timeCase(id, events, type, explanation) { return { id, events, type, explanation }; }
function shapeDistractors(item, index) { return rotate(shapes.filter((shapeItem) => shapeItem.name !== item.name && shapeItem.dimension === item.dimension), index % 5).slice(0, 2).map((shapeItem) => shapeItem.name); }
function sequenceChoices(events) { const reversed = [...events].reverse(); const moved = [...events.slice(1), events[0]]; return [events, reversed, moved]; }
function timeNarration(item) { return item.type.includes("order") || item.type === "event_order" ? item.events.map((event, index) => `${["First", "Next", "Then", "Last"][Math.min(index, 3)]}, ${event}.`).join(" ") : item.explanation; }
function measureRepresentation(kind) { return { length: "aligned start line with equal units", height: "shared baseline with equal units", mass: "balance and equal weights", capacity: "equal-cup fill record" }[kind]; }
function measureHint(kind) { return { length: "Align the starting ends and use equal units without gaps.", height: "Use the same baseline and equal units.", mass: "Use balance evidence; do not guess from object size.", capacity: "Use the same-size cup; do not guess from container height." }[kind]; }
function measureTag(item) { if (item.kind === "capacity") return "taller_means_more_capacity"; if (item.kind === "mass") return "larger_means_heavier"; return "unaligned_or_gapped_measure"; }
function measureRepair(kind) { return { length: "Move both starting ends to one line, remove gaps and recount equal units.", height: "Stand both models on one baseline and recount equal vertical units.", mass: "Use the balance or equal-weight record instead of picture size.", capacity: "Replay the equal-cup fill record and compare cup counts, not height." }[kind]; }
function measureConcrete(kind) { return { length: "Use ribbons and equal cubes on a tactile start line; auto-alignment is available.", height: "Use towers on one tactile baseline with equal cubes.", mass: "Use a teacher-managed balance or a static balance record with equal weights.", capacity: "Use sealed containers and dry equal scoops, or a static fill model; no pouring is required." }[kind]; }
function reviewDay(index) { return [1, 3, 7, 14, 30][index % 5]; }
function sentenceStart(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function unique(items) { return [...new Set(items)]; }
function slug(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function normalise(value) { return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " "); }
function countBy(items, keyFor) { const result = {}; for (const item of items) { const key = keyFor(item); result[key] = (result[key] ?? 0) + 1; } return result; }
function summary(items, keyFor) { return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
