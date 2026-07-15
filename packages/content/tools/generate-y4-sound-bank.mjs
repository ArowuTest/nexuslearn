#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/sc-y4-sound.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y4-sound-bank-";
const reviewBatch = "y4-sound-depth-pilot-a";
const pilotAllocation = {
  "find-the-vibrating-source": 48,
  "sound-travels-through-medium": 48,
  "pitch-pattern-investigations": 48,
  "volume-vibration-strength": 48,
  "distance-and-fainter-sound": 48,
};

const vibrationSources = [
  ["ruler", "a ruler held over a table edge", "the free end of the ruler", "moves quickly up and down", "the movement and sound stop together"],
  ["drum", "a gently tapped virtual drum", "the drum skin", "moves back and forth", "light grains on the model skin bounce while it vibrates"],
  ["fork", "a softly activated virtual tuning fork", "the two prongs", "move rapidly from side to side", "the sound fades as the prongs stop moving"],
  ["speaker", "a low-level model speaker", "the speaker cone", "moves in and out", "the cone becomes still when the signal stops"],
  ["voice", "a quiet humming voice model", "the vocal cords", "vibrate as air passes", "the model trace stops when the humming stops"],
  ["band", "a gently plucked elastic band", "the stretched band", "moves rapidly from side to side", "the sound ends as the band settles"],
  ["guitar", "a virtual guitar string", "the selected string", "moves from side to side", "the motion trace shrinks as the sound becomes fainter"],
  ["bell", "a softly struck virtual handbell", "the metal bell", "vibrates after the model clapper touches it", "the sound fades when the metal stops vibrating"],
  ["kazoo", "a virtual kazoo model", "the thin membrane", "vibrates when air passes across it", "the membrane is still before and after the airflow"],
  ["bottle", "a virtual bottle blown across gently", "the air column inside the bottle", "vibrates inside the container", "the sound stops when the airflow stops"],
  ["wooden-tongue", "a model wooden tongue instrument", "the flexible wooden tongue", "springs back and forth", "the sound and movement fade together"],
  ["triangle", "a softly activated virtual triangle", "the metal triangle", "vibrates after a gentle model tap", "the motion trace ends as the sound fades"],
].map(([id, source, part, movement, evidence]) => ({ id, source, part, movement, evidence }));

const mediaCases = [
  ["bell-air", "vibrating bell", "air", "ear diagram", "a classroom model"],
  ["speaker-air", "speaker cone", "air", "sound sensor", "a quiet studio model"],
  ["string-phone", "vibrating cup base", "taut string", "second cup", "a string-telephone model"],
  ["desk-solid", "gentle tap sensor", "wooden desk", "vibration sensor", "a solid-material model"],
  ["rail-solid", "virtual rail vibration", "steel rail", "remote sensor", "a virtual railway model"],
  ["water-speaker", "underwater model speaker", "water", "hydrophone sensor", "a virtual tank"],
  ["pool-pulse", "vibrating model plate", "water", "waterproof sensor", "a virtual pool model"],
  ["wall-solid", "model tapping point", "brick wall", "contact sensor", "a building simulation"],
  ["tube-air", "vibrating air at a tube entrance", "air in the tube", "sensor at the far end", "a tube model"],
  ["door-solid", "vibrating door panel", "solid door", "contact sensor", "a door model"],
  ["pipe-solid", "virtual pipe vibration", "metal pipe", "sensor clamp", "a safe virtual pipe test"],
  ["drum-air", "vibrating drum skin", "air", "sound meter", "a sound-lab model"],
].map(([id, source, medium, receiver, setting]) => ({ id, source, medium, receiver, setting }));

const pitchTests = [
  ["string-length", "virtual string", "length", "shorter", "higher", "same tightness and pluck strength"],
  ["string-tension", "virtual string", "tightness", "tighter", "higher", "same length and pluck strength"],
  ["ruler-overhang", "model ruler", "overhanging length", "shorter", "higher", "same ruler and gentle release distance"],
  ["tube-length", "virtual air tube", "tube length", "shorter", "higher", "same tube width and airflow"],
  ["wood-bar", "model wooden bar", "bar length", "shorter", "higher", "same material, width and gentle model tap"],
  ["metal-bar", "virtual metal bar", "bar length", "longer", "lower", "same material, thickness and model tap"],
  ["bottle-air", "virtual bottle", "air-column length", "shorter", "higher", "same bottle shape and airflow"],
  ["drum-size", "matched virtual drums", "drum-skin diameter", "smaller", "higher", "same material, tightness and gentle tap"],
  ["band-length", "elastic-band model", "vibrating length", "shorter", "higher", "same band and stretch"],
  ["band-tension", "elastic-band model", "tightness", "tighter", "higher", "same band length and gentle pluck"],
  ["xylophone-bar", "virtual xylophone bars", "bar length", "longer", "lower", "same material and model tap"],
  ["panpipe-tube", "virtual panpipe tubes", "air-column length", "shorter", "higher", "same tube width and airflow"],
].map(([id, source, feature, change, result, controls]) => ({ id, source, feature, change, result, controls }));

const volumeTests = [
  ["drum", "virtual drum skin", "gentle model tap", "stronger model tap"], ["ruler", "model ruler", "small safe release", "larger safe model release"],
  ["speaker", "speaker cone model", "small signal", "larger safe signal"], ["band", "elastic-band model", "gentle pluck", "stronger model pluck"],
  ["string", "virtual guitar string", "gentle pluck", "stronger model pluck"], ["bell", "virtual bell", "gentle model tap", "stronger model tap"],
  ["triangle", "virtual triangle", "gentle model tap", "stronger model tap"], ["wood-tongue", "wooden tongue model", "small release", "larger safe model release"],
  ["voice-trace", "neutral voice trace", "quiet voice model", "stronger voice model"], ["kazoo", "kazoo membrane model", "gentle airflow", "stronger safe model airflow"],
  ["bottle", "bottle air-column model", "gentle airflow", "stronger safe model airflow"], ["tambourine", "virtual tambourine skin", "gentle model tap", "stronger model tap"],
].map(([id, source, gentle, strong]) => ({ id, source, gentle, strong }));

const distanceCases = [
  ["buzzer", "steady virtual buzzer", [1, 3, 6], ["strong", "quieter", "faint"]], ["bell", "soft virtual bell loop", [1, 2, 5], ["strong", "medium", "faint"]],
  ["speaker", "low-level model speaker", [2, 4, 8], ["strong", "quieter", "faint"]], ["drum", "steady virtual drum signal", [1, 4, 7], ["strong", "quieter", "faint"]],
  ["chime", "gentle virtual chime", [1, 3, 9], ["strong", "quieter", "faint"]], ["tone", "steady safe tone model", [2, 5, 10], ["strong", "quieter", "faint"]],
  ["metronome", "virtual metronome click", [1, 2, 4], ["strong", "medium", "faint"]], ["radio", "low-level virtual radio", [1, 5, 8], ["strong", "quieter", "faint"]],
  ["rattle", "gentle model rattle", [1, 3, 7], ["strong", "quieter", "faint"]], ["triangle", "repeating virtual triangle", [2, 6, 12], ["strong", "quieter", "faint"]],
  ["hum", "steady neutral hum model", [1, 4, 10], ["strong", "quieter", "faint"]], ["signal", "steady lab signal", [3, 6, 12], ["strong", "quieter", "faint"]],
].map(([id, source, distances, readings]) => ({ id, source, distances, readings }));

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y4-sound") throw new Error("This generator only supports the Year 4 sound pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedAllocation = countBy(curated, curatedBlueprint);
const targets = Object.fromEntries(Object.entries(pilotAllocation).map(([id, total]) => [id, total - (curatedAllocation[id] ?? 0)]));
for (const [blueprint, count] of Object.entries(targets)) if (count < 0) throw new Error(`Curated variants exceed ${blueprint}.`);

const candidates = [
  ...vibrationCandidates(targets["find-the-vibrating-source"]),
  ...mediumCandidates(targets["sound-travels-through-medium"]),
  ...pitchCandidates(targets["pitch-pattern-investigations"]),
  ...volumeCandidates(targets["volume-vibration-strength"]),
  ...distanceCandidates(targets["distance-and-fainter-sound"]),
];

pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.adaptive_support.hearing_support = "Every task is fully solvable from labelled vibration models, tactile-style or physical-token alternatives and text tables. Audio is optional, gentle, replay-controlled and never the only source of evidence.";
pack.qa.notes = "Review-stage Year 4 sound pack with a deterministic 240-item pilot bank and five preserved curated variants. The progression covers vibration, sound travel through air, water and solids, pitch, volume, distance, pattern finding, fair tests, ear safety and named misconceptions. Generated candidates include SEND multimodal, tactile and text alternatives, supported non-drag interactions, investigation feedback and untimed sound-lab missions. Independent science, teacher, accessibility, safeguarding, audio-safety and renderer review remain required before promotion.";
validateBank(pack, curated, candidates);

console.log(`y4-sound-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`y4-sound-bank blueprints=${allocationSummary(curated, candidates)}`);
console.log(`y4-sound-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y4-sound-bank bands=${summary(candidates, (variant) => variant.body.difficulty_band)}`);
console.log(`y4-sound-bank coverage=${coverageSummary(candidates)}`);

enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y4-sound-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 4 sound bank is out of date; run generate-y4-sound-bank.mjs --write.");
  console.log("y4-sound-bank deterministic check passed");
} else {
  console.log("y4-sound-bank dry-run; pass --write to update the pack");
}

function vibrationCandidates(count) {
  const variants = [];
  for (const item of vibrationSources) {
    const tasks = [
      task("identify", "identify_vibrating_part", "vibration", `Which part makes the sound in ${item.source}?`, item.part, ["the nearby surface staying still", "the label on the model", "the empty space outside the model"], [`Look for the part that ${item.movement}.`, "The sound source is the part vibrating."], `${capitalise(item.part)} ${item.movement}; that quick back-and-forth movement produces the sound.`, "vibrating_source_identification"),
      task("evidence", "link_vibration_to_sound", "evidence", "Which observation best links vibration with the sound?", item.evidence, ["the source has a name", "the model changes colour", "the table remains in the same place"], ["Use an observation about movement and sound together.", "Reject details that do not change when the sound changes."], `${capitalise(item.evidence)}, providing evidence that the sound is linked to vibration.`, "vibration_sound_evidence"),
      task("stop", "predict_when_vibration_stops", "patterns", `What should happen when ${item.part} stops vibrating?`, "The sound stops or fades away", ["The sound becomes higher forever", "The source changes material", "Sound continues with no vibration"], ["Compare the source while moving and while still.", "A stopped source no longer passes on new sound vibrations."], "When the vibrating part becomes still, it no longer creates new sound vibrations, so the sound stops or fades.", "vibration_stop_pattern"),
      task("misconception", "repair_hit_only_misconception", "misconceptions", `A learner says '${item.source} can make sound only because it was hit.' Which correction fits?`, "Sound is linked to the part vibrating; hitting is only one possible way to start a vibration", ["Every sound source must be struck", "Sound appears before anything moves", "The object's colour produces sound"], ["Focus on what the source does after sound begins.", "Plucking, airflow and electrical signals can also begin vibrations."], "The important pattern is vibration, not one particular starting action. Different actions can set a sound source vibrating.", "sound_without_vibration_repair"),
    ];
    for (const t of tasks) variants.push(makeVariant({ ...t, id: `vibration-${item.id}-${t.id}`, format: "vibration-observation", blueprint: "find-the-vibrating-source", misconception: "sound_without_vibration", body: { source: item.source, vibrating_part: item.part, observed_movement: item.movement, stop_evidence: item.evidence } }));
  }
  return variants.slice(0, count);
}

function mediumCandidates(count) {
  const variants = [];
  for (const item of mediaCases) {
    const route = `${item.source} vibrates; ${item.medium} passes the vibration to the ${item.receiver}`;
    const tasks = [
      task("route", "trace_source_medium_receiver", "media", `In ${item.setting}, which route explains the sound journey?`, route, [`${item.receiver} sends sound backwards to the source`, "sound jumps through nothing", "pieces of the source travel into the receiver"], ["Start with the vibrating source.", `Name ${item.medium} as the material between source and receiver.`], `${capitalise(item.source)} begins the vibration, ${item.medium} is the medium, and the ${item.receiver} detects the arriving vibration.`, "source_medium_receiver_path"),
      task("name", "identify_medium", "media", `Which material carries the vibration in ${item.setting}?`, item.medium, [item.source, item.receiver, "empty space"], ["A medium is the material the vibration travels through.", "Do not choose the source or receiver."], `${capitalise(item.medium)} is the stated material connecting the vibrating source to the receiver.`, "medium_identification"),
      task("compare", "compare_media_evidence", "fair_tests", `In ${item.setting}, which plan fairly checks whether vibrations from the ${item.source} travel through ${item.medium}?`, `Keep the source and receiver fixed; change only whether the ${item.medium} connection is complete`, ["Change the source, receiver and medium together", "Use a louder source for only one test", "Move the receiver and change the medium at the same time"], ["A fair test changes one variable.", "Keep source action and receiver position controlled."], `Changing only the ${item.medium} connection lets the observed receiver response be linked to that medium.`, "medium_fair_comparison"),
      task("empty", "repair_empty_space_misconception", "misconceptions", `After tracing the ${item.source} through ${item.medium}, which statement correctly repairs the idea that sound travels through nothing?`, "Sound vibrations need a medium such as air, water or a solid to travel to a receiver", ["Sound always crosses empty space in the same way", "An ear creates the vibration before the source moves", "Only solids can carry sound"], ["List the material between source and receiver.", "Air, water and solids can all act as media."], "In the Year 4 model, vibrations are passed through a material medium; empty space does not provide particles or material to pass them along.", "empty_space_misconception_repair"),
    ];
    for (const t of tasks) variants.push(makeVariant({ ...t, id: `medium-${item.id}-${t.id}`, format: "medium-trace", blueprint: "sound-travels-through-medium", misconception: "sound_travels_through_empty_space", body: { source: item.source, medium: item.medium, receiver: item.receiver, setting: item.setting, route } }));
  }
  return variants.slice(0, count);
}

function pitchCandidates(count) {
  const variants = [];
  for (const item of pitchTests) {
    const prediction = `The ${item.change} ${item.source} makes a ${item.result}-pitched sound`;
    const tasks = [
      task("predict", "predict_pitch_pattern", "pitch", `The ${item.feature} becomes ${item.change}. What pattern is predicted?`, prediction, [`The sound becomes louder but pitch cannot change`, "The sound source stops being a vibration", "Distance changes instead of pitch"], ["High and low describe pitch.", `Use the pattern for ${item.feature}.`], `${capitalise(item.change)} ${item.feature} is linked with a ${item.result} pitch in this controlled ${item.source} model.`, "pitch_feature_prediction"),
      task("classify", "separate_pitch_from_volume", "pitch_volume", `For the ${item.source}, changing ${item.feature} makes the sound ${item.result}. Which property changed?`, "Pitch", ["Volume", "Distance", "Medium"], ["High or low means pitch.", "Loud or quiet means volume."], `${capitalise(item.result)} describes pitch, not volume. The test does not say that the sound became louder or quieter.`, "pitch_volume_classification"),
      task("fair", "plan_fair_pitch_test", "fair_tests", `Which plan fairly tests how ${item.feature} affects pitch?`, `Change only ${item.feature}; keep ${item.controls}`, ["Change length, strength and instrument together", "Use a different measuring method for each test", "Make one sound deliberately unsafe and loud"], ["Change one feature at a time.", `Keep ${item.controls}.`], `Controlling ${item.controls} means the pitch difference can be linked to the changed ${item.feature}.`, "pitch_fair_test"),
      task("evidence", "interpret_pitch_pattern", "patterns", `Three repeats show the ${item.change} model gives the ${item.result} pitch each time. Which conclusion is supported?`, `For this ${item.source}, ${item.change} ${item.feature} is linked with ${item.result} pitch`, ["Every louder sound must have this pitch", "Pitch and volume are the same property", "One result proves the rule for every possible instrument"], ["Use the repeated pattern from this setup.", "Keep the conclusion bounded to the tested source."], `The repeated observations support a pattern for the tested ${item.source}, while avoiding an unsupported claim about every sound source.`, "pitch_pattern_evidence"),
    ];
    for (const t of tasks) variants.push(makeVariant({ ...t, id: `pitch-${item.id}-${t.id}`, format: "pitch-volume-sort", blueprint: "pitch-pattern-investigations", misconception: "pitch_volume_confusion", body: { source: item.source, changed_feature: item.feature, change: item.change, observed_pitch: item.result, controlled_variables: item.controls, repeated_trials: 3 } }));
  }
  return variants.slice(0, count);
}

function volumeCandidates(count) {
  const variants = [];
  for (const item of volumeTests) {
    const tasks = [
      task("compare", "connect_vibration_strength_to_volume", "volume", `${item.source} is tested with a ${item.gentle} and a ${item.strong}. The stronger test has a larger vibration trace. What changes?`, "The sound is louder in the stronger-vibration test", ["The pitch must become higher", "The source stops vibrating", "The medium disappears"], ["Loud and quiet describe volume.", "Compare the size or strength of the vibration traces."], "A stronger vibration is linked with a louder sound from the same source; this is a volume pattern, not automatically a pitch change.", "volume_vibration_strength"),
      task("separate", "separate_volume_from_pitch", "pitch_volume", `For the ${item.source}, which statement keeps volume and pitch separate?`, "A sound can be high and quiet, or low and loud", ["Every high sound is loud", "Every quiet sound is low", "Pitch and volume are two names for one property"], ["Pitch is high or low.", "Volume is loud or quiet."], "Pitch and volume describe different properties, so changing vibration strength can change volume without fixing the pitch as high or low.", "pitch_volume_separation"),
      task("fair", "plan_fair_volume_test", "fair_tests", `For the ${item.source}, which plan fairly compares ${item.gentle} with ${item.strong}?`, "Use the same source and position; change only vibration strength; compare the safe visual meter", ["Move the meter and change the source", "Change strength, pitch feature and distance together", "Judge by preference without recording evidence"], ["Keep source, distance and medium the same.", "Change one variable: vibration strength."], "Keeping the source and measuring position fixed allows the visual meter difference to be linked to vibration strength.", "volume_fair_test"),
      task("safety", "choose_ear_safe_method", "ear_safety", `Which method safely investigates the ${item.gentle} and ${item.strong} for the ${item.source}?`, "Use optional gentle audio and compare labelled vibration traces or meter readings; never increase sound to discomfort", ["Place the source next to an ear", "Keep making the sound louder until it hurts", "Require headphones at maximum volume"], ["The investigation must not rely on loudness exposure.", "Visual, tactile and text evidence can replace audio."], "A gentle optional signal plus visual or tactile evidence investigates the pattern without exposing anyone to uncomfortable sound.", "ear_safe_volume_investigation"),
    ];
    for (const t of tasks) variants.push(makeVariant({ ...t, id: `volume-${item.id}-${t.id}`, format: "evidence-explain", blueprint: "volume-vibration-strength", misconception: t.strand === "ear_safety" ? "unsafe_loudness_investigation" : "loud_means_high_pitch", body: { source: item.source, gentle_action: item.gentle, stronger_action: item.strong, observations: ["both tests show vibration", "the stronger test has a larger vibration trace", "the source feature controlling pitch stays fixed"] } }));
  }
  return variants.slice(0, count);
}

function distanceCandidates(count) {
  const variants = [];
  for (const item of distanceCases) {
    const [near, middle, far] = item.distances;
    const table = item.distances.map((distance, index) => ({ distance_m: distance, relative_reading: item.readings[index] }));
    const tasks = [
      task("pattern", "identify_distance_pattern", "distance", `The same ${item.source} is measured at ${near} m, ${middle} m and ${far} m. What pattern fits the table?`, "The sound becomes fainter as distance from the source increases", ["The sound becomes louder with distance", "Distance changes pitch only", `The source stops vibrating at ${middle} m`], ["Read from the nearest to the farthest position.", "Fainter means a smaller or quieter reading."], "The source stays the same while the relative reading falls across the three distances, supporting the Year 4 distance pattern.", "distance_fainter_pattern"),
      task("fair", "plan_fair_distance_test", "fair_tests", `Which setup fairly tests how distance affects readings from the ${item.source}?`, "Keep the source, signal and medium fixed; move only the receiver to measured distances", ["Change the source and distance together", "Use a stronger signal at the far position", "Change the medium for every distance"], ["Change only receiver distance.", "Keep the source output and measuring method controlled."], "Moving only the receiver means changes in the recorded reading can be compared with distance from the same source.", "distance_fair_test"),
      task("predict", "predict_farther_sound", "patterns", `The receiver moves from ${middle} m to ${far} m from the unchanged ${item.source}. What is the best prediction?`, "The recorded sound will be fainter", ["The sound must become higher pitched", "The source will stop vibrating", "The sound will become louder"], ["Use the pattern in the table.", "The source and medium do not change."], `The farther position has the weaker relative reading, so a fainter observation is the evidence-based prediction.`, "distance_prediction"),
      task("repair", "repair_sudden_stop_misconception", "misconceptions", `For the ${item.source}, a learner says the sound vanishes completely just beyond ${middle} m. Which correction fits the evidence?`, "The sound becomes progressively fainter; whether it is detected depends on distance, source and receiver sensitivity", ["The source always stops at the middle marker", "Distance changes every sound into a higher pitch", "The medium disappears after the first marker"], ["Compare all three non-zero relative readings.", "Avoid claiming an exact cut-off that the table does not show."], "The observations show a gradual fainter pattern rather than a sudden stop at one fixed distance.", "distance_sudden_stop_repair"),
    ];
    for (const t of tasks) variants.push(makeVariant({ ...t, id: `distance-${item.id}-${t.id}`, format: "distance-sound-model", blueprint: "distance-and-fainter-sound", misconception: "sound_stops_suddenly", body: { source: item.source, distance_table: table, changed_variable: "receiver distance", controlled_variables: ["source signal", "medium", "receiver", "measuring method"] } }));
  }
  return variants.slice(0, count);
}

function task(id, stage, strand, prompt, expected, distractors, hints, explanation, purpose) { return { id, stage, strand, prompt, expected, choices: [expected, ...distractors], hints, explanation, purpose }; }

function makeVariant({ id, format, blueprint, stage, strand, prompt, expected, choices, hints, explanation, purpose, misconception, body }) {
  const fullId = `${prefix}${id}`;
  const band = bandFor(blueprint, stage);
  return {
    id: fullId,
    format,
    body: {
      prompt,
      choices: rotate(unique(choices), fullId.length % choices.length),
      ...body,
      strand,
      coverage_tags: coverageFor(strand, stage),
      conceptual_progression: stage,
      difficulty_band: band,
      evidence_purpose: purpose,
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
      response_mode: "tap_keyboard_switch_numeric_table_oral_or_partner_recorded",
      interaction_support: { keyboard: true, switch_scan: true, touch: true, table_navigation: true, oral_or_partner_recording: true, drag_required: false, undo_available: true },
      send_scaffolds: { one_variable_card: true, source_medium_receiver_strip: true, pitch_volume_word_bank: true, sentence_frame: true, repeated_observation: true, no_time_limit: true },
      alternatives: {
        visual: "labelled still vibration traces, source-medium-receiver diagrams and pattern-coded meters",
        tactile: "optional low-intensity tactile pulse pad or adult-prepared textured source, medium and receiver cards; never placed near the ear",
        text: "linear observation description and complete data table for every animation or sound",
        silent_mode: "all scientific evidence and feedback remain available with audio off",
      },
      reduced_visual_load: true,
      reduced_motion_alternative: "paired still frames and before-after tables with no pulsing or travelling-wave animation",
      audio_policy: { optional: true, gentle_default: true, comfortable_level_only: true, headphones_required: false, browser_generated_tone_allowed: false, human_audio_safety_review_required: true, stop_control_always_available: true },
      ear_safety: "Never place a source beside an ear, never increase volume to discomfort, stop audio if uncomfortable and use visual, tactile or text evidence instead.",
      investigation_feedback_mode: "preserve the prediction, compare it with the observation, identify the changed variable and revise only the unsupported claim",
      mission: missionFor(strand, stage, fullId),
      pressure_rules: { timer: false, speed_score: false, streak_loss: false, lives: false, public_ranking: false, retry_cost: false },
    },
    expected_answer: { value: expected },
    hints,
    explanation,
    feedback: {
      correct: `Signal finding secured: ${purpose.replaceAll("_", " ")}.`,
      repair: repairFor(strand, stage),
      investigation_check: "Name the source, identify what changed, compare the observations and keep the conclusion within the tested setup.",
      safety_reminder: "Audio is optional and gentle; visual, tactile and text routes provide the same evidence.",
      retry: "The lab keeps your useful observation. Change one reasoning step and test the pattern again without a timer or penalty.",
    },
    difficulty: difficultyFor(band),
    status: "review",
    misconception_tag: misconception,
    animation_hook: animationFor(strand),
  };
}

function missionFor(strand, stage, id) {
  const stations = { vibration: "Vibration Viewer", evidence: "Signal Evidence Bench", patterns: "Pattern Resonator", misconceptions: "Noise-Myth Repair Deck", media: "Medium Transit Tunnel", fair_tests: "Variable-Lock Chamber", pitch: "Pitch Observatory", pitch_volume: "Pitch–Volume Split Console", volume: "Amplitude Bay", ear_safety: "Quiet-Signal Safety Dock", distance: "Fainter-Signal Field" };
  const tools = { vibration: "slow the model and identify the moving part", evidence: "match movement and sound observations", patterns: "compare repeated results in order", misconceptions: "replace the unsupported claim with the observed pattern", media: "trace source → medium → receiver", fair_tests: "lock every control except one variable", pitch: "use high/low language and inspect the source feature", pitch_volume: "sort high/low from loud/quiet", volume: "compare vibration strength with the visual meter", ear_safety: "choose gentle optional audio or a silent evidence route", distance: "compare the unchanged source at measured distances" };
  return {
    campaign: "Resonance Research Fleet: Restore the Quiet Signal Network",
    station: stations[strand],
    mission_code: id.slice(-30),
    objective: `Complete the ${stage.replaceAll("_", " ")} investigation and file a safe evidence claim.`,
    strategic_tool: tools[strand],
    lab_protocol: ["predict without penalty", "lock the fair-test variables", "observe through any accessible mode", "revise the claim from evidence"],
    reward: { item: "resonance-map module", earned_for: "using a safe investigation strategy or completing a repair", effect: "restores a quiet signal route without increasing volume, speed or difficulty" },
    retry_protocol: "No lives, samples or progress are lost; the lab preserves useful observations and opens a targeted evidence hint.",
  };
}

function validateBank(packData, curatedItems, generated) {
  const pilot = packData.practice.variant_targets.pilot;
  if (curatedItems.length !== 5) throw new Error(`Expected five curated variants, found ${curatedItems.length}.`);
  if (generated.length !== pilot - curatedItems.length || curatedItems.length + generated.length !== pilot) throw new Error(`Pilot bank must contain exactly ${pilot} variants.`);
  const blueprintMap = new Map(packData.variant_blueprints.map((item) => [item.id, item]));
  const ids = new Set(); const signatures = new Set(); const coverage = new Set(); const formats = new Set(); const blueprints = new Set(); const bands = new Set();
  for (const variant of [...curatedItems, ...generated]) {
    if (ids.has(variant.id)) throw new Error(`Duplicate id ${variant.id}.`); ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${normalise(variant.expected_answer?.value)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`); signatures.add(signature);
  }
  for (const variant of generated) {
    const blueprint = blueprintMap.get(variant.body.variant_blueprint_id);
    if (!blueprint || variant.format !== blueprint.format) throw new Error(`${variant.id} does not match its blueprint format.`);
    if (variant.status !== "review") throw new Error(`${variant.id} must remain in review.`);
    if (!Array.isArray(variant.body.choices) || variant.body.choices.length < 4 || new Set(variant.body.choices).size !== variant.body.choices.length) throw new Error(`${variant.id} has invalid choices.`);
    if (variant.body.choices.filter((choice) => choice === variant.expected_answer.value).length !== 1) throw new Error(`${variant.id} must contain its expected answer exactly once.`);
    if (!variant.body.interaction_support?.keyboard || !variant.body.interaction_support?.switch_scan || variant.body.interaction_support?.drag_required !== false) throw new Error(`${variant.id} lacks supported interactions.`);
    if (!variant.body.send_scaffolds?.one_variable_card || !variant.body.alternatives?.visual || !variant.body.alternatives?.tactile || !variant.body.alternatives?.text || !variant.body.alternatives?.silent_mode) throw new Error(`${variant.id} lacks SEND multimodal alternatives.`);
    if (variant.body.audio_policy?.optional !== true || variant.body.audio_policy?.gentle_default !== true || variant.body.audio_policy?.browser_generated_tone_allowed !== false || variant.body.audio_policy?.human_audio_safety_review_required !== true) throw new Error(`${variant.id} violates sound audio policy.`);
    if (!/Never place a source beside an ear/.test(variant.body.ear_safety) || !/never increase volume to discomfort/.test(variant.body.ear_safety)) throw new Error(`${variant.id} lacks ear safety.`);
    if (Object.values(variant.body.pressure_rules).some((value) => value !== false) || !/No lives/.test(variant.body.mission?.retry_protocol) || !variant.body.mission?.strategic_tool) throw new Error(`${variant.id} lacks low-pressure mission design.`);
    if (!variant.feedback?.repair || !variant.feedback?.investigation_check || !variant.feedback?.safety_reminder || !variant.feedback?.retry || variant.hints.length < 2 || variant.explanation.length < 65) throw new Error(`${variant.id} lacks investigation feedback.`);
    validateScienceData(variant);
    for (const tag of variant.body.coverage_tags) coverage.add(tag);
    formats.add(variant.format); blueprints.add(variant.body.variant_blueprint_id); bands.add(variant.body.difficulty_band);
  }
  const allocation = combinedAllocation(curatedItems, generated);
  for (const [blueprint, expected] of Object.entries(pilotAllocation)) if (allocation[blueprint] !== expected) throw new Error(`${blueprint} expected ${expected}, found ${allocation[blueprint] ?? 0}.`);
  assertCovered("formats", new Set(packData.practice.formats), formats);
  assertCovered("blueprints", new Set(blueprintMap.keys()), blueprints);
  assertCovered("difficulty bands", new Set([...packData.practice.difficulty_bands, ...packData.variant_blueprints.map((item) => item.difficulty_band)]), bands);
  assertCovered("sound coverage", new Set(["vibration", "media", "pitch", "volume", "distance", "patterns", "fair_tests", "ear_safety", "misconceptions"]), coverage);
}

function validateScienceData(variant) {
  if (variant.body.distance_table) {
    const distances = variant.body.distance_table.map((row) => row.distance_m);
    if (!(distances[0] < distances[1] && distances[1] < distances[2])) throw new Error(`${variant.id} has unordered distance data.`);
    if (variant.body.distance_table.map((row) => row.relative_reading).join(",").includes("louder")) throw new Error(`${variant.id} has an invalid fainter-distance pattern.`);
  }
  if (variant.body.changed_feature && !variant.body.controlled_variables) throw new Error(`${variant.id} lacks pitch controls.`);
  if (variant.body.strand === "fair_tests" && !/fair|only|fixed|same|controlled/i.test(`${variant.body.prompt} ${variant.explanation}`)) throw new Error(`${variant.id} lacks one-variable fair-test language.`);
}

function coverageFor(strand, stage) { const tags = new Set([strand]); if (stage.includes("fair")) tags.add("fair_tests"); if (stage.includes("pattern") || stage.includes("predict")) tags.add("patterns"); if (stage.includes("repair") || stage.includes("misconception")) tags.add("misconceptions"); if (strand === "pitch_volume") { tags.add("pitch"); tags.add("volume"); } return [...tags]; }
function bandFor(blueprint, stage) { if (blueprint === "find-the-vibrating-source") return stage.includes("identify") ? "intro" : "developing"; if (blueprint === "sound-travels-through-medium") return stage.includes("compare") || stage.includes("repair") ? "secure" : "expected"; if (blueprint === "pitch-pattern-investigations") return stage.includes("fair") || stage.includes("interpret") ? "secure" : "expected"; if (blueprint === "volume-vibration-strength") return stage.includes("safety") || stage.includes("fair") ? "stretch" : "secure"; return stage.includes("repair") || stage.includes("fair") ? "stretch" : "secure"; }
function difficultyFor(band) { return { intro: 3, developing: 4, expected: 5, secure: 7, stretch: 8 }[band]; }
function repairFor(strand, stage) { if (strand === "ear_safety") return "Stop or mute audio, choose the visual, tactile or text route, and compare only safe gentle observations."; if (strand === "fair_tests") return "Lock source, receiver, medium and measuring method, then change only the named variable."; if (strand === "pitch_volume") return "Place high/low under PITCH and loud/quiet under VOLUME before rereading the observation."; if (strand === "media") return "Build the route with three cards: vibrating source, material medium, receiver."; if (strand === "distance") return "Read the distance table from near to far and describe the gradual change without inventing a sudden cut-off."; if (stage.includes("repair")) return "Return to the observed movement or pattern and replace the unsupported claim with one bounded to the evidence."; return "Name what vibrates, compare the stated observations and explain the pattern using one scientific word."; }
function animationFor(strand) { return ({ vibration: "source-vibration-scan", evidence: "vibration-evidence-link", patterns: "sound-pattern-table", misconceptions: "sound-misconception-repair", media: "medium-pulse-trace", fair_tests: "sound-variable-lock", pitch: "pitch-feature-compare", pitch_volume: "pitch-volume-companion-repair", volume: "vibration-strength-meter", ear_safety: "quiet-signal-safety-shield", distance: "distance-meter-fade" })[strand]; }
function curatedBlueprint(variant) { const map = { "sc-y4-sound-q-ruler-vibration": "find-the-vibrating-source", "sc-y4-sound-q-air-medium": "sound-travels-through-medium", "sc-y4-sound-q-short-string-pitch": "pitch-pattern-investigations", "sc-y4-sound-q-strong-drum-volume": "volume-vibration-strength", "sc-y4-sound-q-distance-fainter": "distance-and-fainter-sound" }; const value = map[variant.id]; if (!value) throw new Error(`No curated blueprint assignment for ${variant.id}.`); return value; }
function combinedAllocation(curatedItems, generated) { const counts = countBy(curatedItems, curatedBlueprint); for (const variant of generated) counts[variant.body.variant_blueprint_id] = (counts[variant.body.variant_blueprint_id] ?? 0) + 1; return counts; }
function allocationSummary(curatedItems, generated) { return Object.entries(combinedAllocation(curatedItems, generated)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function assertCovered(label, required, actual) { const missing = [...required].filter((value) => !actual.has(value)); if (missing.length) throw new Error(`Missing ${label}: ${missing.join(", ")}.`); }
function coverageSummary(variants) { const tags = new Set(); for (const variant of variants) for (const tag of variant.body.coverage_tags) tags.add(tag); return [...tags].sort().join(","); }
function countBy(items, keyFor) { const counts = {}; for (const item of items) { const key = keyFor(item); counts[key] = (counts[key] ?? 0) + 1; } return counts; }
function summary(items, keyFor) { return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function unique(items) { return [...new Set(items)]; }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function capitalise(value) { return `${value.charAt(0).toUpperCase()}${value.slice(1)}`; }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
