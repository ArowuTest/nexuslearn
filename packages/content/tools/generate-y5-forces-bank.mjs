#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/sc-y5-forces.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y5-forces-bank-";
const pilotTarget = 240;

if (write && check) throw new Error("Choose either --write or --check, not both.");

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y5-forces") throw new Error("This generator only supports the Year 5 forces pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 4) throw new Error(`Expected exactly 4 curated variants, found ${curated.length}. Refusing to overwrite possible authored work.`);

ensureBlueprints(pack);

const missions = [
  { key: "sky", place: "Sky Motion Laboratory", goal: "calibrate the falling-object simulator", reward: "motion-data badge" },
  { key: "water", place: "Blue Current Research Bay", goal: "map resistance in the test tank", reward: "current-map tile" },
  { key: "trail", place: "Trail Safety Design Hub", goal: "improve grip and movement models", reward: "surface-evidence marker" },
  { key: "mechanism", place: "Mechanism Rescue Workshop", goal: "restore the lifting and gear systems", reward: "mechanism module" },
];

const gravityCases = [
  { key: "unsupported", prompt: "A ball is released from a hand. Why does it begin moving towards the ground?", answer: "Gravity pulls the unsupported ball towards Earth.", wrong: ["The air pushes it down because all air moves downward.", "The ball has used up its support force.", "Gravity starts only after the ball moves."] },
  { key: "supported", prompt: "A book rests on a table. Which statement is accurate?", answer: "Gravity still pulls down, while the table provides an upward support force.", wrong: ["Gravity has switched off.", "The book has no weight while supported.", "Only an upward force acts."] },
  { key: "same-paper", prompt: "The same paper is dropped flat and crumpled from one height. Why may the crumpled paper arrive first?", answer: "Both experience gravity, but the flat paper has more air resistance.", wrong: ["Crumpling creates more gravity.", "Gravity stops acting on the flat paper.", "The flat paper loses its mass."] },
  { key: "mass-shape", prompt: "Two objects have different masses and shapes and reach the ground at different times. What can be concluded?", answer: "More control is needed because mass, shape and air resistance may all differ.", wrong: ["The heavier one always falls faster.", "Gravity acted on only one object.", "Shape can never affect falling."] },
  { key: "moon-claim", prompt: "A learner says gravity only exists near the classroom floor. Which correction fits the model?", answer: "Gravity is an attraction towards Earth and acts at height as well as near the floor.", wrong: ["Gravity is made by floors.", "Gravity exists only after contact.", "Higher objects have no weight."] },
  { key: "mass-weight", prompt: "Which statement keeps mass and weight distinct at Year 5 level?", answer: "Mass describes how much matter an object has; weight is the force of gravity on it.", wrong: ["Mass and weight are always identical words.", "Weight is the object's speed.", "Gravity changes matter into mass."] },
];

const resistanceCases = [
  { key: "parachute", prompt: "How can a simulator fairly test canopy area and fall time?", answer: "Change canopy area, measure fall time, and keep mass, material and drop height the same.", wrong: ["Change canopy area and mass together.", "Use different heights and guess.", "Measure canopy colour."] },
  { key: "streamline-air", prompt: "Two same-mass shapes move through air at the same starting speed. What should change?", answer: "Change shape only and measure travel time or slowing while other conditions stay the same.", wrong: ["Change shape, mass and speed.", "Measure which shape looks fastest.", "Remove repeated trials."] },
  { key: "water-shape", prompt: "How can water resistance be compared for two modelling-clay shapes?", answer: "Use equal masses, the same water path and release method, changing shape only.", wrong: ["Use different masses and depths.", "Push one shape harder.", "Compare them in different liquids."] },
  { key: "speed", prompt: "A virtual object moves faster through water and the resistance meter increases. What conclusion is cautious?", answer: "In the tested range, greater speed was linked with greater water resistance.", wrong: ["Water resistance is always identical at every speed.", "The result proves every fluid behaves exactly the same.", "Speed removed gravity."] },
  { key: "area", prompt: "A flat card and an edge-on card move through air. Which prediction is testable?", answer: "The larger area facing the air is likely to experience more air resistance in the matched test.", wrong: ["The larger area creates more gravity.", "Air resistance cannot affect motion.", "Colour decides resistance."] },
  { key: "fluid", prompt: "Which statement links air and water resistance accurately?", answer: "Both oppose motion through a fluid, but their effects depend on the tested object and conditions.", wrong: ["Only water can resist movement.", "Resistance always acts in the direction of motion.", "Every shape has the same resistance."] },
];

const frictionCases = [
  { key: "grip", prompt: "A textured shoe sole needs more pull before sliding on the same dry surface. Why?", answer: "Greater friction provides useful grip and opposes sliding.", wrong: ["Friction has disappeared.", "Gravity switched off.", "Smoothness always creates the most grip."] },
  { key: "slow", prompt: "A toy car travels less far on rough fabric than on a smooth board. Which explanation fits?", answer: "Greater friction on the rough fabric opposes the car's motion more strongly.", wrong: ["Rough fabric removes mass.", "Friction pushes the car forward.", "The car has no forces on the board."] },
  { key: "heat", prompt: "A simulator shows two surfaces warming slightly while rubbing. What is the careful explanation?", answer: "Friction can transfer some movement energy into heating at the contact surfaces.", wrong: ["Friction creates unlimited energy.", "Heating proves gravity stopped.", "Learners should rub real surfaces until hot."] },
  { key: "useful", prompt: "Why is friction useful when writing with a pencil?", answer: "Friction between pencil and paper helps leave a mark and control movement.", wrong: ["Friction is always harmful.", "The pencil floats because of friction.", "Paper removes gravity."] },
  { key: "lubrication", prompt: "A virtual axle turns more freely after lubricant is added. What changed?", answer: "Friction at the contact was reduced, so less input force was needed in this model.", wrong: ["The axle became massless.", "Lubricant increased gravity.", "All friction vanished everywhere."] },
  { key: "direction", prompt: "A box slides right across a surface. Which way does friction on the box act?", answer: "To the left, opposing the relative sliding motion.", wrong: ["To the right, always helping motion.", "Downwards as another name for weight.", "In no direction because the box moves."] },
];

const mechanismCases = [
  { key: "lever", prompt: "A lever pivot moves closer to the load. What likely trade-off occurs at the long input end?", answer: "A smaller input force may lift the load, but the input end moves farther.", wrong: ["The lever creates free energy.", "The load becomes massless.", "Input force and distance both become zero."] },
  { key: "lever-short", prompt: "The effort is applied closer to a lever pivot while the load stays fixed. What is likely?", answer: "A larger input force is likely because the input lever arm is shorter.", wrong: ["No force is needed.", "The lever removes gravity.", "The load's mass changes."] },
  { key: "fixed-pulley", prompt: "What can a single fixed pulley do in the model?", answer: "It can change the direction of the input force, allowing a downward pull to lift a load.", wrong: ["It always halves the force without any trade-off.", "It creates energy.", "It makes the load weightless."] },
  { key: "pulley-system", prompt: "A model adds supporting rope sections around moving pulleys. What qualitative trade-off is expected?", answer: "A smaller input force may be needed, but more rope must be pulled through a greater distance.", wrong: ["No rope movement is needed.", "The load vanishes.", "Force and movement both reduce to zero."] },
  { key: "gears-direction", prompt: "Two meshed gears turn. If the first turns clockwise, what happens to the second?", answer: "The second turns anticlockwise because meshed gears rotate in opposite directions.", wrong: ["It always turns clockwise.", "It cannot turn.", "Its mass changes direction."] },
  { key: "gears-size", prompt: "A small driving gear turns a larger gear. Which qualitative effect fits the model?", answer: "The larger gear turns more slowly but can produce a greater turning effect.", wrong: ["The larger gear turns faster with free force.", "Gear size has no effect.", "Both gears stop because sizes differ."] },
];

const fairTestCases = [
  { key: "surface", prompt: "How should surface type affect the distance a toy block slides?", answer: "Change surface type, measure slide distance, and keep block, start point and push setting the same.", wrong: ["Change surface and block mass.", "Push each trial differently.", "Measure surface colour."] },
  { key: "parachute", prompt: "How should canopy material affect parachute fall time?", answer: "Change material, measure fall time, and keep area, mass, shape and height the same.", wrong: ["Change material and area.", "Use different masses.", "Do one trial only and guess."] },
  { key: "water", prompt: "How should object shape affect sinking time in a safe simulator?", answer: "Change shape, measure time over the same path, and keep mass, material and release method the same.", wrong: ["Change shape and mass.", "Use different liquids.", "Push one object."] },
  { key: "repeat", prompt: "Why repeat each simulator trial?", answer: "Repeated results help identify variation and support a more dependable mean or pattern.", wrong: ["Repeats guarantee the prediction is correct.", "Repeats allow variables to change randomly.", "Only the fastest result should count."] },
  { key: "measure", prompt: "Which outcome measure best tests friction on a sliding block?", answer: "The pull force needed to start movement or a matched slide distance/time measure.", wrong: ["The researcher's favourite surface.", "The colour of the block.", "An unrelated air temperature reading."] },
  { key: "range", prompt: "A test uses only two canopy areas. Which conclusion is appropriate?", answer: "Describe the pattern for the two tested areas and avoid claiming it holds for every possible canopy.", wrong: ["State a universal law from two trials.", "Ignore the data.", "Claim material caused the result when material stayed the same."] },
];

const diagramCases = [
  { key: "fall", prompt: "Which force-arrow model fits a falling object moving downward through air?", answer: "A downward gravity arrow and an upward air-resistance arrow, with sizes described only from evidence.", wrong: ["Both arrows downward.", "No gravity arrow once moving.", "An air-resistance arrow pointing with the motion."] },
  { key: "table", prompt: "Which model fits a book resting on a table?", answer: "A downward gravity arrow and an upward support arrow shown as balanced in the model.", wrong: ["No forces because it is still.", "Only gravity with no support.", "Two horizontal arrows only."] },
  { key: "push", prompt: "A trolley accelerates right in the simulator. Which qualitative model fits?", answer: "The rightward driving force is greater than the opposing leftward forces in this model.", wrong: ["All arrows must be equal while speed changes.", "Friction points right.", "Gravity is the driving force along the floor."] },
  { key: "friction", prompt: "A block slides left. How should friction be drawn?", answer: "A rightward arrow at the contact, opposing the sliding motion.", wrong: ["A leftward arrow helping the slide.", "A downward arrow labelled friction.", "No arrow because motion exists."] },
  { key: "scale", prompt: "A diagram uses a longer arrow for one force without measurements. What should the caption say?", answer: "The arrow length is a qualitative model assumption unless force data support the comparison.", wrong: ["Arrow length is exact data automatically.", "Long arrows mean heavy objects only.", "Captions are unnecessary."] },
  { key: "contact", prompt: "Which forces in a shoe-on-floor model require contact?", answer: "Friction and support act at the contact; gravity acts without surface contact.", wrong: ["Gravity requires touching the floor.", "Friction acts across empty space.", "All forces are contact forces."] },
];

const evidenceCases = [
  { key: "table", prompt: "One canopy averages 2.1 s and a larger matched canopy 3.4 s. Which conclusion fits?", answer: "In this matched test, the larger canopy was linked with a longer fall time.", wrong: ["Large canopies always fall for exactly 3.4 s.", "Mass caused the difference although it was kept same.", "The data show no difference."] },
  { key: "overlap", prompt: "Repeated times for two shapes overlap widely. What should the researcher do?", answer: "Report the overlap, repeat carefully and avoid claiming a clear difference yet.", wrong: ["Choose the preferred shape.", "Use only the most extreme result.", "Claim certainty from one trial."] },
  { key: "friction", prompt: "A pull meter reads 2 N on smooth plastic and 5 N on rough fabric for the same block. What is supported?", answer: "More pull was needed on rough fabric in this test, consistent with greater friction.", wrong: ["Rough fabric always gives 5 N for every object.", "Gravity was greater on fabric.", "The block lost mass."] },
  { key: "gear", prompt: "A small gear makes four turns while a larger meshed gear makes one. What does the evidence show?", answer: "The larger gear turns more slowly in this arrangement.", wrong: ["The larger gear creates energy.", "Both gears turn in the same direction.", "Gear size changes mass."] },
  { key: "variable", prompt: "Circuit—sorry, force test A changes shape and mass; test B changes shape only. Which better isolates shape?", answer: "Test B, because only shape changes while mass is controlled.", wrong: ["Test A, because more changes give more evidence.", "Both are equally fair.", "Neither needs measurements."] },
  { key: "limit", prompt: "A model omits wind gusts and surface irregularities. How should results be described?", answer: "Useful for the controlled model, with limits when transferring to variable real conditions.", wrong: ["The model proves every real outcome.", "Models are useless if simplified.", "Omitted variables secretly stayed identical outdoors."] },
];

const predictionCases = [
  { key: "parachute", prompt: "A canopy area increases while mass and height stay same. What prediction is justified?", answer: "Fall time is likely to increase because greater area may increase air resistance.", wrong: ["Gravity will switch off.", "The result is certain for every material and size.", "Mass will increase automatically."] },
  { key: "streamline", prompt: "A shape becomes more streamlined in the same water test. What prediction fits?", answer: "It may experience less water resistance and travel the set path faster.", wrong: ["It will have no forces.", "It must become heavier.", "Water will stop resisting all objects."] },
  { key: "rough", prompt: "The same block moves onto a rougher surface with the same push. What is predicted?", answer: "It is likely to slow sooner or travel less far because friction may be greater.", wrong: ["It must speed up.", "Gravity disappears.", "Surface never affects motion."] },
  { key: "lever", prompt: "The input point moves farther from a lever pivot. What is predicted?", answer: "A smaller input force may produce the needed turning effect, with greater input movement distance.", wrong: ["No input movement is needed.", "The load becomes massless.", "The lever creates energy."] },
  { key: "gear", prompt: "A larger driven gear replaces a smaller driven gear. What is predicted?", answer: "The driven gear is likely to turn more slowly with a greater turning effect.", wrong: ["It must turn faster with no trade-off.", "Direction and speed cannot change.", "The driver stops automatically."] },
  { key: "uncertain", prompt: "Two variables will change in the next test. How certain should the prediction be?", answer: "State a cautious prediction because the effect of each changed variable cannot be isolated.", wrong: ["Make a certain claim.", "Ignore one variable after testing.", "Prediction is the same as evidence."] },
];

const misconceptionCases = [
  { key: "heavy", claim: "Heavier objects always fall faster.", answer: "Reject: shape and air resistance can change fall time; compare mass fairly before concluding.", tag: "heavy_always_falls_faster" },
  { key: "gravity-off", claim: "Gravity stops when an object rests on a table.", answer: "Reject: gravity still pulls down while the table provides an upward support force.", tag: "gravity_stops_when_supported" },
  { key: "friction-bad", claim: "Friction is always unwanted.", answer: "Reject: friction can slow motion or heat surfaces, but it also provides useful grip and control.", tag: "friction_only_bad" },
  { key: "resistance-direction", claim: "Air resistance pushes a falling object downward.", answer: "Reject: air resistance opposes motion, so it acts upward on a downward-moving object.", tag: "resistance_with_motion" },
  { key: "free-force", claim: "A mechanism creates extra force with no movement or distance trade-off.", answer: "Reject: mechanisms change force, direction, speed or distance and involve a trade-off.", tag: "mechanism_free_force" },
  { key: "many-variables", claim: "Changing mass, shape and height together gives stronger proof about shape.", answer: "Reject: change shape only to isolate its effect and keep the other conditions controlled.", tag: "multiple_variables_changed" },
];

const transferCases = [
  { key: "cycling", prompt: "Why might a cyclist adopt a more streamlined position in a model?", answer: "A smaller area facing the air may reduce air resistance, while safety and real conditions still matter.", wrong: ["It removes gravity.", "It guarantees unlimited speed.", "Shape never affects resistance."] },
  { key: "boat", prompt: "Why are some boat shapes streamlined?", answer: "The shape can reduce water resistance compared with a less streamlined shape under matched conditions.", wrong: ["It removes the boat's mass.", "Water stops exerting forces.", "Colour controls resistance."] },
  { key: "brakes", prompt: "How does friction transfer to bicycle brakes conceptually?", answer: "Contact friction opposes wheel motion and helps slow it, while real maintenance belongs to adults or trained users.", wrong: ["Brakes remove gravity.", "Friction makes wheels faster.", "Learners should test unsafe moving bicycles."] },
  { key: "crowbar", prompt: "How does a long lever transfer to lifting a tight lid in a safe model?", answer: "A longer input arm can allow a smaller force to have a greater turning effect, with more movement distance.", wrong: ["The lever creates energy.", "The lid becomes weightless.", "No input force is needed."] },
  { key: "crane", prompt: "How can pulley learning transfer to a model crane?", answer: "Pulley arrangements can change pull direction or reduce input force while requiring more rope movement.", wrong: ["Pulleys erase the load's weight.", "Every pulley halves force exactly without model data.", "No rope movement is needed."] },
  { key: "shoe", prompt: "How can surface evidence inform a shoe-sole design?", answer: "Test grip using controlled, safe surface simulations and choose texture from evidence rather than appearance.", wrong: ["Choose the brightest sole.", "Test on unsafe roads.", "Assume roughest is always best in every condition."] },
];

const candidates = [
  ...expand("gravity", 24, gravityCases, buildGravity),
  ...expand("resistance", 24, resistanceCases, buildResistance),
  ...expand("friction", 24, frictionCases, buildFriction),
  ...expand("mechanisms", 24, mechanismCases, buildMechanism),
  ...expand("fair-tests", 24, fairTestCases, buildFairTest),
  ...expand("diagrams", 24, diagramCases, buildDiagram),
  ...expand("evidence", 23, evidenceCases, buildEvidence),
  ...expand("prediction", 23, predictionCases, buildPrediction),
  ...expand("misconceptions", 23, misconceptionCases, buildMisconception),
  ...expand("transfer", 23, transferCases, buildTransfer),
];

pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.adaptive_support.audio_first = "Where listening materially supports motion sequencing, force-arrow descriptions or mechanism input/output comparison, optional playback uses only ElevenLabs assets after human listening approval. Browser TTS is prohibited; every task remains complete through static frames, text descriptions, tables and adult or partner reading.";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Third production-wave review bank reaches the 240-item pilot target with four preserved curated questions and 236 deterministic candidates covering gravity, air and water resistance, friction, levers/pulleys/gears, variables and fair tests, force diagrams/models, evidence, prediction, misconception repair and transfer. Generated candidates include SEND-accessible simulation, visual, text and concrete alternatives, supported non-drag interactions, rich corrective feedback and pressure-free investigation missions. Optional ElevenLabs references are limited to motion, force-model and mechanism comparisons, require human listening approval, and never use browser TTS. Human science, teacher, SEND, accessibility, safeguarding, audio and renderer review remains required before promotion.";

validateBank(pack, curated, candidates);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`forces-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`forces-bank strands=${summary(candidates, (variant) => variant.body.force_strand)}`);
console.log(`forces-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`forces-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`forces-bank optional_audio=${candidates.filter((variant) => variant.body.audio_optional).length}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`forces-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 5 forces bank is out of date; run generate-y5-forces-bank.mjs --write.");
  console.log("forces-bank deterministic check passed");
} else {
  console.log("forces-bank dry-run; pass --write to update the pack");
}

function buildGravity(item, mission, index, id) { return candidate({ id, format: "force-simulator", blueprint: "gravity-and-falling-models", band: "developing", strand: "gravity", mission, item, index, model: "gravity and resistance arrows with numbered fall frames", change: "support, shape or compared object as stated", measure: "motion direction or fall time", keepSame: "all non-tested variables", audioHelpful: true }); }
function buildResistance(item, mission, index, id) { return candidate({ id, format: "fair-test-plan", blueprint: "air-and-water-resistance-tests", band: "expected", strand: "air_water_resistance", mission, item, index, model: "matched air/water resistance trials and results table", change: "shape, area or speed named in the prompt", measure: "fall/travel time, distance or resistance meter", keepSame: "mass, path, release and material unless tested", audioHelpful: false }); }
function buildFriction(item, mission, index, id) { return candidate({ id, format: "evidence-explain", blueprint: "friction-grip-and-heating", band: "expected", strand: "friction", mission, item, index, model: "surface contact diagram with opposing friction arrow", change: "surface or contact condition stated", measure: "pull force, slide distance or observation", keepSame: "object, start and movement method", audioHelpful: false }); }
function buildMechanism(item, mission, index, id) { return candidate({ id, format: "mechanism-model", blueprint: "lever-pulley-gear-input-output", band: "secure", strand: "mechanisms", mission, item, index, model: "labelled input/output mechanism with force-distance or speed-direction comparison", change: "pivot, pulley support or gear size stated", measure: "input force/distance, direction or relative turning speed", keepSame: "load and remaining mechanism", audioHelpful: true }); }
function buildFairTest(item, mission, index, id) { return candidate({ id, format: "fair-test-plan", blueprint: "air-and-water-resistance-tests", band: "expected", strand: "variables_fair_tests", mission, item, index, model: "CHANGE-MEASURE-KEEP SAME investigation board", change: "single independent variable named", measure: "relevant force or motion outcome", keepSame: "all other important test conditions", audioHelpful: false }); }
function buildDiagram(item, mission, index, id) { return candidate({ id, format: "force-simulator", blueprint: "force-arrow-models", band: "intro", strand: "force_diagrams_models", mission, item, index, model: "static object, motion label and colour-independent force arrows", change: "force state or motion direction stated", measure: "qualitative arrow direction/balance", keepSame: "object and scenario", audioHelpful: true }); }
function buildEvidence(item, mission, index, id) { return candidate({ id, format: "evidence-explain", blueprint: "evidence-prediction-transfer", band: "secure", strand: "evidence", mission, item, index, model: "small result table paired with the force model", change: "tested variable from the evidence", measure: "reported observation or measurement", keepSame: "matched variables listed in the evidence", audioHelpful: false }); }
function buildPrediction(item, mission, index, id) { return candidate({ id, format: "evidence-explain", blueprint: "evidence-prediction-transfer", band: "secure", strand: "prediction", mission, item, index, model: "PREDICT-TEST-RECORD-EXPLAIN board", change: "single proposed change", measure: "predicted motion or force outcome", keepSame: "remaining conditions", audioHelpful: false }); }
function buildMisconception(item, mission, index, id) { const retrieval = index % 2 === 1; return candidate({ id, format: "evidence-explain", blueprint: retrieval ? "forces-model-critique-retrieval" : "evidence-prediction-transfer", band: retrieval ? "retrieval" : "secure", strand: "misconceptions", mission, item: { prompt: `A learner claims, '${item.claim}' Which response repairs the idea?`, answer: item.answer, wrong: ["Accept the claim because it uses a force word.", "Say only that it is wrong without evidence.", "Change several variables and guess."] }, index, model: "misconception claim beside corrected force/evidence model", change: "one claim feature", measure: "whether evidence supports the replacement rule", keepSame: "scenario meaning", audioHelpful: false, tagOverride: item.tag }); }
function buildTransfer(item, mission, index, id) { return candidate({ id, format: "evidence-explain", blueprint: "evidence-prediction-transfer", band: "secure", strand: "transfer", mission, item, index, model: "familiar force model linked to a new context with limitations box", change: "context feature stated", measure: "predicted force or motion effect", keepSame: "relevant comparison conditions", audioHelpful: false }); }

function candidate({ id, format, blueprint, band, strand, mission, item, index, model, change, measure, keepSame, audioHelpful, tagOverride }) {
  const fullId = `${prefix}${id}`;
  const choices = [item.answer, ...item.wrong];
  const choiceSet = [...new Set(choices)];
  while (choiceSet.length < 4) choiceSet.push(`Unsupported force claim ${choiceSet.length + 1}`);
  const explanation = `${item.answer} This conclusion names the relevant force or mechanism, matches the stated evidence and remains limited to the model or tested conditions.`;
  const tag = tagOverride ?? blueprintMisconception(blueprint);
  return {
    id: fullId,
    format,
    body: {
      prompt: `${mission.place} investigation ${index + 1}: ${item.prompt}`,
      choices: rotate(choiceSet, fullId.length % choiceSet.length),
      force_strand: strand,
      difficulty_band: band,
      evidence_purpose: `${strand}_predict_test_model_explain`,
      variant_blueprint_id: blueprint,
      review_batch: "third-production-wave",
      force_model: { model, motion_or_state_labelled: true, force_directions_text: true, arrow_lengths_qualitative_unless_measured: true, limitation_note: "The model simplifies real conditions and supports only the tested comparison." },
      investigation_plan: { change, measure, keep_same: keepSame, repeat_trials: true, conclusion_scope: "tested range only" },
      safety_context: "simulator_or_teacher_approved_classroom_model",
      learner_real_world_repair_required: false,
      response_mode: "tap_keyboard_switch_oral_or_partner_response",
      interaction_support: { keyboard: true, switch_scan: true, touch: true, oral_or_partner_response: true, precision_drag_required: false, increment_controls: true, undo_and_reset: true },
      multimodal_routes: { simulation: "slow, pause, replay and no-motion modes", visual: "numbered still frames and colour-independent arrows", text: "ordered force, variable, observation and conclusion description", concrete: "teacher-managed unpowered object, surface, arrow or mechanism cards", reduced_load: "one active variable and one evidence row at a time" },
      colour_required: false,
      timer_allowed: false,
      speed_score_allowed: false,
      leaderboard_allowed: false,
      audio_optional: audioHelpful,
      audio_asset_id: audioHelpful ? `narration-${fullId}` : null,
      audio_provider: audioHelpful ? "ElevenLabs" : null,
      audio_asset_status: audioHelpful ? "required_human_listening_review" : "not_requested_text_routes_complete",
      human_listening_approval_required: audioHelpful,
      browser_tts_allowed: false,
      mission: { objective: mission.goal, strategic_unlock: "predict, choose one fair change, inspect evidence, then revise or explain the model", reward: `add one ${mission.reward} to the shared research log`, loss_on_error: false, streak_pressure: false, retry_message: "The trial produced a useful clue. Keep the fair variables, repair one model link, and test again when ready." },
    },
    expected_answer: { value: item.answer },
    hints: ["Name the object, its motion or state, and the force or mechanism that could explain the change.", `Use the plan: change ${change}; measure ${measure}; keep ${keepSame}.`],
    explanation,
    feedback: { correct: `Investigation evidence secured. ${explanation}`, variable_feedback: "Credit a fair variable plan independently from the prediction.", model_feedback: "Check force direction, contact/non-contact status and whether arrow size is evidence-based.", evidence_feedback: "Link the changed variable to the measured result and limit the conclusion to tested conditions.", corrective_feedback: `That option may fit '${tag}'. Freeze the model, inspect one force or mechanism trade-off, and compare with the evidence.` },
    difficulty: { intro: 2, developing: 4, expected: 5, secure: 7, retrieval: 5 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: format === "mechanism-model" ? "lever-tradeoff-replay" : format === "fair-test-plan" ? "parachute-fair-test" : format === "force-simulator" ? "same-mass-shape-compare" : "evidence-row-highlight",
  };
}

function expand(label, count, cases, builder) {
  return Array.from({ length: count }, (_, index) => {
    const item = cases[index % cases.length];
    const mission = missions[Math.floor(index / cases.length) % missions.length];
    return builder(item, mission, index, `${label}-${item.key}-${mission.key}`);
  });
}

function ensureBlueprints(currentPack) {
  const additions = [
    { id: "force-arrow-models", format: "force-simulator", count: 280, difficulty_band: "intro", misconception_tag: "force_arrow_with_motion", purpose: "Read and critique qualitative force-arrow diagrams for supported, falling and sliding objects.", generation_pattern: "static object/motion state + labelled arrows + direction/balance/model-limit choice", review_notes: "Arrow lengths must be described as qualitative unless measurements justify magnitude.", source: "ai_drafted_teacher_reviewed" },
    { id: "evidence-prediction-transfer", format: "evidence-explain", count: 300, difficulty_band: "secure", misconception_tag: "overclaim_from_model", purpose: "Use data and force models to make cautious predictions, explain evidence and transfer ideas to new contexts.", generation_pattern: "scenario/table/model + prediction or transfer claim + evidence and limitation explanation", review_notes: "Conclusions must stay within tested ranges and state limitations when transferring from simulations.", source: "ai_drafted_teacher_reviewed" },
  ];
  for (const blueprint of additions) if (!currentPack.variant_blueprints.some((existing) => existing.id === blueprint.id)) currentPack.variant_blueprints.push(blueprint);
}

function validateBank(currentPack, authored, generated) {
  if (authored.length !== 4) throw new Error(`Expected four curated variants, found ${authored.length}.`);
  if (generated.length !== pilotTarget - authored.length || currentPack.question_variants.length !== pilotTarget) throw new Error(`Expected ${pilotTarget} total variants with ${pilotTarget - authored.length} generated.`);
  const blueprints = new Map(currentPack.variant_blueprints.map((item) => [item.id, item]));
  const formats = new Set(currentPack.practice.formats);
  const ids = new Set();
  const signatures = new Set();
  const strands = new Set();
  const actualFormats = new Set();
  const actualBlueprints = new Set();
  let optionalAudioCount = 0;
  for (const item of currentPack.question_variants) {
    if (ids.has(item.id)) throw new Error(`Duplicate id ${item.id}.`);
    ids.add(item.id);
    const signature = `${item.format}|${normalise(item.body?.prompt)}|${normalise(item.expected_answer?.value)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${item.id}.`);
    signatures.add(signature);
  }
  for (const item of generated) {
    const blueprint = blueprints.get(item.body.variant_blueprint_id);
    if (!blueprint || blueprint.format !== item.format || blueprint.difficulty_band !== item.body.difficulty_band) throw new Error(`${item.id} does not match its blueprint format and band.`);
    if (!formats.has(item.format) || item.status !== "review") throw new Error(`${item.id} has unsupported format or status.`);
    if (!item.body.force_model?.model || !item.body.force_model?.force_directions_text || !item.body.force_model?.arrow_lengths_qualitative_unless_measured || !item.body.investigation_plan?.change || !item.body.investigation_plan?.measure || !item.body.investigation_plan?.keep_same) throw new Error(`${item.id} lacks model or fair-test detail.`);
    if (!item.body.interaction_support?.keyboard || !item.body.interaction_support?.switch_scan || !item.body.interaction_support?.oral_or_partner_response || item.body.interaction_support?.precision_drag_required !== false) throw new Error(`${item.id} lacks supported interactions.`);
    if (!item.body.multimodal_routes?.simulation || !item.body.multimodal_routes?.visual || !item.body.multimodal_routes?.text || !item.body.multimodal_routes?.concrete || !item.body.multimodal_routes?.reduced_load) throw new Error(`${item.id} lacks SEND multimodal routes.`);
    if (item.body.browser_tts_allowed !== false) throw new Error(`${item.id} permits browser TTS.`);
    if (item.body.audio_optional) {
      optionalAudioCount += 1;
      if (item.body.audio_provider !== "ElevenLabs" || item.body.audio_asset_status !== "required_human_listening_review" || item.body.human_listening_approval_required !== true || !item.body.audio_asset_id) throw new Error(`${item.id} violates reviewed-audio policy.`);
    } else if (item.body.audio_provider !== null || item.body.audio_asset_id !== null || item.body.human_listening_approval_required !== false) throw new Error(`${item.id} requests unnecessary audio.`);
    if (item.body.timer_allowed !== false || item.body.speed_score_allowed !== false || item.body.leaderboard_allowed !== false || item.body.mission?.loss_on_error !== false || item.body.mission?.streak_pressure !== false || !item.body.mission?.strategic_unlock) throw new Error(`${item.id} has unsuitable investigation gamification.`);
    if (!item.feedback?.correct || !item.feedback?.variable_feedback || !item.feedback?.model_feedback || !item.feedback?.evidence_feedback || !item.feedback?.corrective_feedback || item.hints.length < 2 || item.explanation.length < 100) throw new Error(`${item.id} lacks rich feedback.`);
    if (!Array.isArray(item.body.choices) || item.body.choices.length < 4 || new Set(item.body.choices).size !== item.body.choices.length || item.body.choices.filter((choice) => choice === item.expected_answer.value).length !== 1) throw new Error(`${item.id} has invalid choices.`);
    strands.add(item.body.force_strand);
    actualFormats.add(item.format);
    actualBlueprints.add(item.body.variant_blueprint_id);
  }
  if (optionalAudioCount < 1 || optionalAudioCount >= generated.length) throw new Error(`Optional audio must be selective; found ${optionalAudioCount}/${generated.length}.`);
  requireCoverage("strands", ["gravity", "air_water_resistance", "friction", "mechanisms", "variables_fair_tests", "force_diagrams_models", "evidence", "prediction", "misconceptions", "transfer"], strands);
  requireCoverage("formats", [...formats], actualFormats);
  requireCoverage("blueprints", [...blueprints.keys()], actualBlueprints);
}

function blueprintMisconception(id) {
  return { "gravity-and-falling-models": "heavy_always_falls_faster", "air-and-water-resistance-tests": "multiple_variables_changed", "friction-grip-and-heating": "friction_only_bad", "lever-pulley-gear-input-output": "mechanism_free_force", "forces-model-critique-retrieval": "model_is_reality", "force-arrow-models": "force_arrow_with_motion", "evidence-prediction-transfer": "overclaim_from_model" }[id];
}
function requireCoverage(label, required, actual) { const missing = required.filter((item) => !actual.has(item)); if (missing.length) throw new Error(`Generated bank is missing ${label}: ${missing.join(", ")}.`); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function summary(items, keyFor) { const counts = new Map(); for (const item of items) counts.set(keyFor(item), (counts.get(keyFor(item)) ?? 0) + 1); return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
