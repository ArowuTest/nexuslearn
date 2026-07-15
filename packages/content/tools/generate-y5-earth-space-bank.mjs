#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/sc-y5-earth-space-models.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y5-earth-space-models-bank-";
const pilotTarget = 240;

if (write && check) throw new Error("Choose either --write or --check, not both.");

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y5-earth-space-models") {
  throw new Error("This generator only supports the Year 5 Earth and space models pack.");
}

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 3) {
  throw new Error(`Expected exactly 3 curated variants, found ${curated.length}. Refusing to overwrite possible authored work.`);
}

const coreBands = ["intro", "developing", "expected", "secure", "stretch"];
const retrievalBands = ["retrieval", "intro", "developing", "expected", "secure", "stretch"];
const motionRepresentations = [
  "an overhead arrow diagram",
  "a side-view snapshot sequence",
  "a labelled tabletop model",
  "a dotted path trace",
  "an audio-described model card",
  "a reduced-motion before-and-after pair",
];
const simulationViews = [
  "top-down model controls",
  "side-view model controls",
  "numbered freeze-frame controls",
  "audio-described step controls",
  "high-contrast static-and-play controls",
];
const retrievalViews = [
  "a labelled diagram",
  "a spoken model description",
  "a pair of static snapshots",
  "an evidence table",
];

const motionCases = [
  { key: "earth-axis", description: "Earth turns around its own axis while the Sun marker stays fixed", answer: "rotation", explanation: "This is rotation because Earth turns around an axis through itself; it is not travelling around another body.", tag: "rotate_orbit_confusion" },
  { key: "earth-sun", description: "Earth follows a complete path around the Sun", answer: "orbit", explanation: "This is an orbit because Earth travels on a path around the Sun, another body in the model.", tag: "rotate_orbit_confusion" },
  { key: "moon-earth", description: "The Moon follows a path around Earth", answer: "orbit", explanation: "This is an orbit because the Moon changes position along a path around Earth.", tag: "rotate_orbit_confusion" },
  { key: "globe-spin", description: "A globe turns in place around the rod through its poles", answer: "rotation", explanation: "The globe is rotating because it spins around its own axis without travelling around another object.", tag: "rotate_orbit_confusion" },
  { key: "earth-both", description: "Earth turns around its axis while also following its path around the Sun", answer: "both rotation and orbit", explanation: "Earth rotates around its axis and orbits the Sun at the same time; the two movements have different paths and timescales.", tag: "one_motion_only" },
  { key: "planet-both", description: "A planet spins on its axis as it travels around the Sun", answer: "both rotation and orbit", explanation: "The spin is rotation and the path around the Sun is an orbit, so the model shows both movements.", tag: "one_motion_only" },
  { key: "counter-loop", description: "A counter travels in a loop around a lamp without spinning in place", answer: "orbit", explanation: "The counter models an orbit because it travels around the lamp; whether it also spins is a separate question.", tag: "rotate_orbit_confusion" },
  { key: "ball-turn", description: "A marked ball turns so different parts face the lamp, but its centre stays in one place", answer: "rotation", explanation: "The ball rotates around its own centre, bringing different sides towards the light without orbiting the lamp.", tag: "sun_orbits_earth_daily" },
];

const dayNightCases = [
  { key: "lit-to-dark", observation: "A town marker moves from the lamp-facing half of the rotating globe to the half facing away", answer: "The town changes from day to night because Earth rotates it away from the Sun", explanation: "The lamp-facing half models daylight. As Earth rotates, the town moves onto the half facing away, so the model changes it to night.", tag: "sun_orbits_earth_daily" },
  { key: "dark-to-lit", observation: "A town marker moves from the dark half of the globe towards the lamp-facing half", answer: "The town changes from night to day because Earth rotates it towards the Sun", explanation: "Earth's rotation carries the town from the side facing away from the Sun onto the illuminated side, modelling the start of day.", tag: "sun_orbits_earth_daily" },
  { key: "opposite-towns", observation: "Town A faces the lamp while Town B is on the opposite side of the globe", answer: "Town A has day while Town B has night in this freeze-frame", explanation: "Only the half facing the light source is illuminated in this simple model, so opposite locations can have day and night at the same time.", tag: "whole_earth_daytime" },
  { key: "fixed-sun", observation: "The Sun marker remains fixed while the globe completes one turn around its axis", answer: "The rotating Earth produces one repeating sequence of day and night", explanation: "The model does not need the Sun to orbit Earth each day. One Earth rotation brings each location into and out of sunlight.", tag: "sun_orbits_earth_daily" },
  { key: "cloud-test", observation: "A cloud card covers one town briefly, but the rest of the lamp-facing half remains lit", answer: "Cloud can reduce local light but does not cause the worldwide day-night cycle", explanation: "The cloud changes light at one place, whereas Earth's rotation explains the repeating pattern of day and night across the globe.", tag: "clouds_cause_night" },
  { key: "lamp-off", observation: "A learner switches off the model lamp and calls the result night everywhere", answer: "This does not model ordinary night because the real Sun does not switch off each evening", explanation: "Ordinary night occurs when rotation turns a location away from the Sun. Switching off the lamp changes the light source and misrepresents the cause.", tag: "sun_switches_off" },
  { key: "apparent-sun", observation: "From one town marker, the Sun appears to move across the model sky while Earth turns", answer: "Earth's rotation can explain the Sun's apparent daily movement across the sky", explanation: "The observer turns with Earth, so the Sun appears to change position even though the daily model keeps the Sun fixed.", tag: "sun_orbits_earth_daily" },
  { key: "axis-turn", observation: "The globe turns around an imaginary line joining its poles", answer: "The line is Earth's axis and the turning is rotation", explanation: "Earth rotates around its axis. That turning changes which half faces the Sun and therefore explains day and night.", tag: "rotate_orbit_confusion" },
  { key: "one-turn", observation: "A town marker returns to the same lamp-facing position after one complete Earth rotation", answer: "The model represents approximately one day, about 24 hours", explanation: "A complete Earth rotation takes about 24 hours, returning a location to the same stage of its day-night cycle.", tag: "day_year_timescale_confusion" },
  { key: "model-limit", observation: "A small lamp is placed close to a globe so both fit on a classroom table", answer: "The model can show light direction and rotation but its sizes and distances are not to scale", explanation: "A useful model can explain which side is lit without copying the enormous real sizes and distances of Earth and the Sun.", tag: "model_is_exact_copy" },
];

const relativeMotionCases = [
  { key: "earth-around-sun", observation: "The Earth marker completes a path centred on the Sun marker", answer: "Earth orbits the Sun", explanation: "The path is centred on the Sun, so the model represents Earth travelling around the Sun rather than the Sun orbiting Earth.", tag: "sun_orbits_earth_yearly" },
  { key: "moon-around-earth", observation: "The Moon marker completes a smaller path centred on the moving Earth marker", answer: "The Moon orbits Earth", explanation: "The smaller path is centred on Earth, correctly representing the Moon's movement relative to Earth.", tag: "moon_orbits_sun_only" },
  { key: "nested-paths", observation: "Earth moves around the Sun while the Moon moves around Earth", answer: "The model needs a large Earth-Sun path and a smaller Moon-Earth path", explanation: "The nested paths preserve both relationships: Earth orbits the Sun and the Moon orbits Earth while travelling with it.", tag: "one_motion_only" },
  { key: "earth-year", observation: "Earth returns to the same point on its Sun-centred orbit after one complete circuit", answer: "One complete Earth orbit represents approximately one year", explanation: "A year is linked to Earth completing one orbit around the Sun, not to one rotation around its axis.", tag: "day_year_timescale_confusion" },
  { key: "moon-month", observation: "The Moon completes one path around Earth in roughly four weeks", answer: "The model links a lunar orbit to about a month, not to one day", explanation: "The Moon takes about four weeks to orbit Earth, much longer than Earth's approximately 24-hour rotation.", tag: "day_month_timescale_confusion" },
  { key: "planets-sun", observation: "Several planet markers follow different-sized paths with the Sun marker at the shared centre", answer: "The planets shown orbit the Sun on their own paths", explanation: "The shared Sun-centred paths represent planets moving relative to the Sun; they do not all orbit Earth.", tag: "all_planets_orbit_earth" },
  { key: "rotation-plus-year", observation: "Earth turns many times on its axis while moving once around the Sun", answer: "Many days occur during one year because rotation is much quicker than orbit", explanation: "Each rotation gives a day-night cycle, while the much slower complete orbit defines a year.", tag: "day_year_timescale_confusion" },
  { key: "path-centres", observation: "One arrow circles Earth and another arrow circles the Sun", answer: "The arrow's centre identifies the relationship: Moon-Earth or Earth-Sun", explanation: "To interpret an orbit model, track what body lies at the centre of each path rather than judging only the arrow's size.", tag: "orbit_path_centre_ignored" },
  { key: "scale-limit", observation: "The Moon, Earth and Sun pieces are large enough to handle and placed close together", answer: "The pieces show relative movement but not accurate sizes or distances", explanation: "Classroom models enlarge small bodies and compress huge distances, so movement can be useful even when scale is deliberately inaccurate.", tag: "model_is_exact_copy" },
  { key: "moving-viewpoint", observation: "From Earth, the Sun seems to travel around the sky, but a wider model shows Earth turning and orbiting", answer: "A wider model can explain apparent movement without making Earth the centre of the solar system", explanation: "What an observer sees from rotating Earth can differ from the wider movement model; apparent daily motion is not a daily Sun orbit.", tag: "sun_orbits_earth_daily" },
];

const moonLightCases = [
  { key: "ray-path", evidence: "A ray model shows light travelling Sun to Moon to an observer on Earth", answer: "The Moon is visible because its surface reflects sunlight towards the observer", explanation: "The evidence traces energy from the Sun to the Moon and then to the observer, so the Moon is acting as a reflector, not a light source.", tag: "moon_makes_light" },
  { key: "lamp-off", evidence: "A white Moon ball is visible when the lamp shines on it but not when the lamp is switched off", answer: "The test supports reflection because the ball is seen only when light reaches it", explanation: "Removing the light source removes the reflected light. The ball does not continue glowing as it would if it produced its own light.", tag: "moon_makes_light" },
  { key: "block-light", evidence: "An opaque screen is placed between the lamp and Moon ball, and the bright patch disappears", answer: "Blocking the incoming light stops reflection from the Moon ball", explanation: "The screen prevents light reaching the ball, so there is no light to reflect towards the observer in this model.", tag: "moon_makes_light" },
  { key: "daytime-moon", evidence: "The Moon is visible in a bright daytime sky while sunlight reaches it", answer: "Moon visibility is not limited to night because it reflects sunlight whenever geometry and sky conditions allow it to be seen", explanation: "The Moon does not need darkness to produce light. It can reflect sunlight during daytime as well as at night.", tag: "moon_only_visible_at_night" },
  { key: "lit-half", evidence: "A lamp illuminates the half of a Moon ball that faces the lamp", answer: "At any moment the Sun illuminates the half of the Moon facing it", explanation: "A spherical object receives direct sunlight on its Sun-facing half. What an Earth observer sees depends on viewing position, but the Moon still reflects sunlight.", tag: "moon_makes_light" },
  { key: "sun-moon-compare", evidence: "A source sensor detects light leaving the Sun model, while the Moon model is bright only when source light reaches it", answer: "The Sun is modelled as a light source and the Moon as a reflector", explanation: "The comparison separates producing light from reflecting it: the Moon model depends on incoming light from the source.", tag: "moon_makes_light" },
  { key: "surface", evidence: "Brighter and darker areas appear across the lit Moon model when light meets raised and lower surfaces", answer: "Surface features can change reflected brightness without the Moon making its own light", explanation: "Different angles and surface features reflect different amounts towards the observer; the original light still comes from the Sun.", tag: "bright_patch_is_light_source" },
  { key: "observer-line", evidence: "The Moon ball is lit, but the observer card is moved where reflected light does not reach it clearly", answer: "Being illuminated and being visible from one position are related but not identical", explanation: "Light must first reach the Moon and then travel towards the observer. The model therefore needs both an incoming and an outgoing light path.", tag: "light_stays_on_moon" },
  { key: "model-limit", evidence: "A torch and foam ball are used to represent the Sun and Moon at arm's length", answer: "The model demonstrates light direction and reflection but not real size, distance or brightness", explanation: "The torch-ball model is useful for tracing light, while its scale and brightness differ greatly from the real Sun-Moon system.", tag: "model_is_exact_copy" },
];

const retrievalCases = [
  { key: "rotate-word", observation: "Earth spins around its axis", answer: "rotate", choices: ["rotate", "orbit", "reflect", "block"], explanation: "Rotate means spin around an axis, which is the movement described for Earth here.", tag: "rotate_orbit_confusion" },
  { key: "orbit-word", observation: "Earth travels on a path around the Sun", answer: "orbit", choices: ["orbit", "rotate", "reflect", "shine"], explanation: "Orbit describes movement along a path around another body, so it fits Earth moving around the Sun.", tag: "rotate_orbit_confusion" },
  { key: "day-cause", observation: "A town moves onto the Sun-facing side as Earth turns", answer: "Earth's rotation", choices: ["Earth's rotation", "the Sun switching on", "cloud moving away", "the Moon making light"], explanation: "Rotation carries the town into the illuminated half of Earth, producing day at that location.", tag: "sun_orbits_earth_daily" },
  { key: "night-cause", observation: "A town moves onto the side facing away from the Sun", answer: "night at that town", choices: ["night at that town", "night everywhere", "the Sun stops shining", "the Moon blocks the Sun"], explanation: "The town is on Earth's unlit half in this model, so it experiences night while other places can have day.", tag: "whole_earth_daytime" },
  { key: "year-path", observation: "Earth completes one orbit of the Sun", answer: "approximately one year", choices: ["approximately one year", "approximately one day", "one night", "one Moon orbit"], explanation: "One complete Earth orbit around the Sun defines approximately one year.", tag: "day_year_timescale_confusion" },
  { key: "moon-path", observation: "The Moon follows a path centred on Earth", answer: "The Moon orbits Earth", choices: ["The Moon orbits Earth", "Earth orbits the Moon", "the Moon rotates Earth", "the Sun orbits the Moon daily"], explanation: "The centre of the path is Earth, so the diagram represents the Moon orbiting Earth.", tag: "moon_orbits_sun_only" },
  { key: "reflection", observation: "Sunlight reaches the Moon and then an observer", answer: "The Moon reflects sunlight", choices: ["The Moon reflects sunlight", "the Moon makes sunlight", "the Moon is burning", "the observer lights the Moon"], explanation: "The two-part light path shows sunlight reaching the Moon and being reflected towards the observer.", tag: "moon_makes_light" },
  { key: "model-scale", observation: "A classroom Sun and Earth are close together and similar in size", answer: "The model is not to scale", choices: ["The model is not to scale", "Earth and Sun are similar sizes", "the real distance is this small", "all models are exact copies"], explanation: "Classroom pieces compress size and distance so movement can be handled and observed; they are not accurate scale copies.", tag: "model_is_exact_copy" },
  { key: "both-motions", observation: "Earth spins while travelling around the Sun", answer: "rotation and orbit", choices: ["rotation and orbit", "reflection only", "orbit only", "rotation only"], explanation: "The spin is rotation and the Sun-centred path is an orbit, so both movements occur together.", tag: "one_motion_only" },
  { key: "evidence-model", observation: "A model keeps the Sun fixed and still produces day and night when Earth turns", answer: "Earth rotation is sufficient to explain the daily cycle", choices: ["Earth rotation is sufficient to explain the daily cycle", "the Sun must orbit Earth daily", "cloud causes night", "the model proves sizes are accurate"], explanation: "The test changes Earth's rotation while holding the Sun fixed, providing model evidence for rotation as the daily cause.", tag: "sun_orbits_earth_daily" },
  { key: "model-purpose", observation: "A learner compares arrows, light paths and labelled freeze-frames", answer: "Use the model features as evidence and state its limits", choices: ["Use the model features as evidence and state its limits", "assume every model is exact", "choose the brightest picture", "ignore labels and path centres"], explanation: "Scientific model reasoning uses represented features to support a claim while recognising what the model does not reproduce.", tag: "model_is_exact_copy" },
];

const candidates = [
  ...buildMotionCandidates(),
  ...buildDayNightCandidates(),
  ...buildRelativeMotionCandidates(),
  ...buildMoonLightCandidates(),
  ...buildRetrievalCandidates(),
];

validateBank(pack, curated, candidates);
pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Review-stage Year 5 Earth and space bank reaches the 240-item pilot target with three preserved curated questions and deterministic candidates across every blueprint and renderer-supported format. Generated models explicitly distinguish representation from reality and require curriculum, teacher, accessibility and safeguarding review before promotion.";

enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`earth-space-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`earth-space-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`earth-space-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`earth-space-bank bands=${summary(candidates, (variant) => variant.body.difficulty_band)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`earth-space-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) {
    throw new Error("Year 5 Earth and space bank is out of date; run generate-y5-earth-space-bank.mjs --write.");
  }
  console.log("earth-space-bank deterministic check passed");
} else {
  console.log("earth-space-bank dry-run; pass --write to update the pack");
}

function buildMotionCandidates() {
  const variants = [];
  for (const [caseIndex, item] of motionCases.entries()) {
    for (const [viewIndex, representation] of motionRepresentations.entries()) {
      const index = caseIndex * motionRepresentations.length + viewIndex;
      const choices = rotate(["rotation", "orbit", "both rotation and orbit", "neither rotation nor orbit"], index % 4);
      variants.push(makeVariant({
        id: `motion-${item.key}-${viewIndex + 1}`,
        format: "model-sort",
        blueprint: "rotate-orbit-sorts",
        band: coreBands[index % coreBands.length],
        evidencePurpose: "rotation_or_orbit_model_classification",
        prompt: `Observatory motion card ${index + 1} uses ${representation}: ${item.description}. Which classification fits the evidence?`,
        body: { model_description: item.description, representation, choices, classification_rule: "identify_axis_spin_and_path_centre" },
        answer: item.answer,
        hints: ["Ask whether the body turns around an axis through itself.", "Then ask whether it travels on a path around another body; both can happen together."],
        explanation: `${item.explanation} The classification follows the represented movement rather than the picture's size or speed.`,
        misconception: item.tag,
        animation: "motion-card-compare",
        index,
      }));
    }
  }
  return variants;
}

function buildDayNightCandidates() {
  const variants = [];
  for (const [caseIndex, item] of dayNightCases.entries()) {
    for (const [viewIndex, representation] of simulationViews.entries()) {
      const index = caseIndex * simulationViews.length + viewIndex;
      const choices = rotate([
        item.answer,
        "The Sun travels around Earth once each day",
        "Night begins because the Sun switches off",
        "Cloud cover creates night across the whole Earth",
      ], index % 4);
      variants.push(makeVariant({
        id: `day-night-${item.key}-${viewIndex + 1}`,
        format: "orbit-simulation",
        blueprint: "day-night-model-tests",
        band: coreBands[(index + 1) % coreBands.length],
        evidencePurpose: "day_night_rotation_model_test",
        prompt: `Day-night investigation ${index + 1} uses ${representation}. The model shows: ${item.observation}. Which conclusion is best supported?`,
        body: { observation: item.observation, controls: ["rotate Earth", "pause", "step backwards", "reset viewpoint"], choices, model_not_to_scale: true, freeze_frame_available: true, variable_changed: "Earth rotation" },
        answer: item.answer,
        hints: ["Track the town marker relative to the Sun-facing half.", "Use Earth rotation as the changed movement and reject explanations that switch off or move the Sun daily."],
        explanation: `${item.explanation} The model is not to scale, but its lit and unlit halves support this causal explanation.`,
        misconception: item.tag,
        animation: "day-night-rotation",
        index,
      }));
    }
  }
  return variants;
}

function buildRelativeMotionCandidates() {
  const variants = [];
  for (const [caseIndex, item] of relativeMotionCases.entries()) {
    for (const [viewIndex, representation] of simulationViews.entries()) {
      const index = caseIndex * simulationViews.length + viewIndex;
      const choices = rotate([
        item.answer,
        "Every body in the model travels around Earth",
        "The largest arrow must always be a rotation",
        "The model proves the displayed sizes and distances are exact",
      ], index % 4);
      variants.push(makeVariant({
        id: `relative-motion-${item.key}-${viewIndex + 1}`,
        format: "orbit-simulation",
        blueprint: "earth-sun-moon-relative-motion",
        band: coreBands[(index + 2) % coreBands.length],
        evidencePurpose: "relative_motion_path_and_timescale_reasoning",
        prompt: `Relative-motion investigation ${index + 1} uses ${representation}. Evidence: ${item.observation}. Which interpretation is scientifically useful?`,
        body: { observation: item.observation, controls: ["play one step", "trace path centre", "compare timescales", "show model limits"], choices, model_not_to_scale: true, freeze_frame_available: true, path_centres_labelled: true },
        answer: item.answer,
        hints: ["Identify what lies at the centre of each path.", "Separate rotation, daily timescale, lunar orbit and Earth orbit before judging the model."],
        explanation: `${item.explanation} The conclusion uses path and timescale evidence while keeping the model's scale limitations visible.`,
        misconception: item.tag,
        animation: "earth-orbit-snap",
        index,
      }));
    }
  }
  return variants;
}

function buildMoonLightCandidates() {
  const variants = [];
  for (const [caseIndex, item] of moonLightCases.entries()) {
    for (const [viewIndex, representation] of simulationViews.entries()) {
      const index = caseIndex * simulationViews.length + viewIndex;
      const choices = rotate([
        item.answer,
        "The Moon creates its own light whenever an observer looks at it",
        "The evidence shows that darkness produces moonlight",
        "The model proves the Moon and Sun have similar sizes and brightness",
      ], index % 4);
      variants.push(makeVariant({
        id: `moon-light-${item.key}-${viewIndex + 1}`,
        format: "explain-choice",
        blueprint: "moon-reflection-explanations",
        band: coreBands[(index + 3) % coreBands.length],
        evidencePurpose: "moon_reflection_evidence_explanation",
        prompt: `Moonlight evidence card ${index + 1} uses ${representation}. ${item.evidence}. Which explanation follows from the evidence?`,
        body: { evidence: item.evidence, light_path: ["Sun or model lamp", "Moon surface", "observer"], choices, model_not_to_scale: true, static_ray_diagram_available: true },
        answer: item.answer,
        hints: ["Trace where the light starts before it reaches the observer.", "Distinguish producing light from reflecting incoming light, then state what the model cannot show to scale."],
        explanation: `${item.explanation} This explanation follows the light path and does not treat the model as an exact copy of space.`,
        misconception: item.tag,
        animation: "moon-reflection-test",
        index,
      }));
    }
  }
  return variants;
}

function buildRetrievalCandidates() {
  const variants = [];
  for (const [caseIndex, item] of retrievalCases.entries()) {
    for (const [viewIndex, representation] of retrievalViews.entries()) {
      const index = caseIndex * retrievalViews.length + viewIndex;
      variants.push(makeVariant({
        id: `retrieval-${item.key}-${viewIndex + 1}`,
        format: "model-sort",
        blueprint: "earth-space-retrieval",
        band: retrievalBands[index % retrievalBands.length],
        evidencePurpose: "spaced_model_vocabulary_and_evidence_retrieval",
        prompt: `Retrieval log ${index + 1} presents ${representation}: ${item.observation}. Which response best matches the model evidence?`,
        body: { observation: item.observation, representation, choices: rotate(item.choices, index % item.choices.length), retrieval_interval_options_days: [1, 3, 7, 14, 30], model_not_to_scale: true },
        answer: item.answer,
        hints: ["Name the movement, light path or model feature shown.", "Check the path centre, lit side or scale note before selecting."],
        explanation: `${item.explanation} This concise retrieval decision keeps the scientific term connected to visible or described evidence.`,
        misconception: item.tag,
        animation: "observatory-star-chart",
        index,
      }));
    }
  }
  return variants;
}

function makeVariant({ id, format, blueprint, band, evidencePurpose, prompt, body, answer, hints, explanation, misconception, animation, index }) {
  return {
    id: `${prefix}${id}`,
    format,
    body: {
      prompt,
      ...body,
      model_not_to_scale: true,
      model_limit: "The representation supports reasoning about movement or light paths, not the real sizes, distances, speeds or brightness of space bodies.",
      evidence_purpose: evidencePurpose,
      variant_blueprint_id: blueprint,
      review_batch: "y5-earth-space-pilot-a",
      difficulty_band: band,
      response_mode: responseMode(format),
      interaction_metadata: {
        keyboard: "All controls, model cards and choices are reachable in a logical order with visible focus and no precision drag.",
        switch: "Single-switch scanning supports play or step, pause, select, undo, replay description and submit.",
        static_alternative: "Numbered freeze-frames, labelled arrows and a text evidence table provide the complete task without animation.",
        reduced_motion: "Movement defaults to learner-controlled single steps; no automatic spinning, sweeping orbit or flashing feedback is required.",
        visual_access: "Bodies, paths and lit regions use labels, shapes and patterns as well as colour, with zoom and high-contrast options.",
        audio_and_language: "Prompts, model states and feedback have sentence-level read-aloud, replay and concise vocabulary support.",
      },
      gamification: {
        mission: missionFor(blueprint),
        success_condition: "Select a scientifically accurate model claim and confirm it with the stated evidence or model limit.",
        feedback: "A verified model-and-evidence link restores one observatory record; speed and repeated animation do not affect progress.",
        no_time_pressure: true,
      },
    },
    expected_answer: { value: answer },
    hints,
    explanation,
    difficulty: difficultyFor(band, index),
    status: "review",
    misconception_tag: misconception,
    animation_hook: animation,
  };
}

function validateBank(currentPack, authored, generated) {
  if (generated.length !== pilotTarget - authored.length) {
    throw new Error(`Expected ${pilotTarget - authored.length} generated candidates, found ${generated.length}.`);
  }
  const all = [...authored, ...generated];
  if (all.length !== pilotTarget) throw new Error(`Pilot bank must contain exactly ${pilotTarget} variants.`);
  const ids = new Set(all.map((variant) => variant.id));
  if (ids.size !== all.length) throw new Error("Variant ids are not unique.");

  const requiredBlueprints = new Set(currentPack.variant_blueprints.map((blueprint) => blueprint.id));
  const actualBlueprints = new Set(generated.map((variant) => variant.body.variant_blueprint_id));
  assertCovered("blueprint", requiredBlueprints, actualBlueprints);
  const requiredFormats = new Set(currentPack.practice.formats);
  const actualFormats = new Set(generated.map((variant) => variant.format));
  assertCovered("format", requiredFormats, actualFormats);
  const requiredBands = new Set([...currentPack.practice.difficulty_bands, ...currentPack.variant_blueprints.map((blueprint) => blueprint.difficulty_band)]);
  const actualBands = new Set(generated.map((variant) => variant.body.difficulty_band));
  assertCovered("difficulty band", requiredBands, actualBands);

  const signatures = new Set();
  for (const candidate of all) {
    const signature = `${candidate.format}|${candidate.body?.prompt?.trim().toLowerCase()}|${JSON.stringify(candidate.expected_answer)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature: ${candidate.id}.`);
    signatures.add(signature);
  }
  for (const candidate of generated) {
    if (candidate.status !== "review") throw new Error(`${candidate.id} is not review status.`);
    if (!requiredBlueprints.has(candidate.body.variant_blueprint_id)) throw new Error(`${candidate.id} has an unknown blueprint.`);
    if (!candidate.body.evidence_purpose || !candidate.body.review_batch) throw new Error(`${candidate.id} lacks review provenance.`);
    if (candidate.explanation.length < 100) throw new Error(`${candidate.id} explanation is too weak.`);
    const options = candidate.body.choices;
    if (!Array.isArray(options) || !options.includes(candidate.expected_answer.value)) throw new Error(`${candidate.id} answer is absent from its choices.`);
    if ("answer" in candidate.body || "correct_answer" in candidate.body) throw new Error(`${candidate.id} leaks its answer in body metadata.`);
    for (const key of ["keyboard", "switch", "static_alternative", "reduced_motion", "visual_access", "audio_and_language"]) {
      if (!candidate.body.interaction_metadata?.[key]) throw new Error(`${candidate.id} lacks ${key} interaction metadata.`);
    }
    if (!candidate.body.gamification?.success_condition || candidate.body.gamification.no_time_pressure !== true) {
      throw new Error(`${candidate.id} lacks meaningful low-pressure gamification metadata.`);
    }
  }
}

function assertCovered(label, required, actual) {
  const missing = [...required].filter((value) => !actual.has(value));
  if (missing.length > 0) throw new Error(`Missing ${label} coverage: ${missing.join(", ")}.`);
}

function responseMode(format) {
  if (format === "orbit-simulation") return "step_pause_keyboard_switch_static_or_partner_control";
  if (format === "model-sort") return "keyboard_switch_touch_or_partner_scan_model_cards";
  return "keyboard_switch_touch_voice_or_partner_explanation_choice";
}

function missionFor(blueprint) {
  const missions = {
    "rotate-orbit-sorts": "Calibrate the observatory motion classifier.",
    "day-night-model-tests": "Repair the day-night evidence console.",
    "earth-sun-moon-relative-motion": "Reconstruct the nested orbit map.",
    "moon-reflection-explanations": "Restore the Moon light-path detector.",
    "earth-space-retrieval": "Verify a spaced observatory log.",
  };
  return missions[blueprint];
}

function difficultyFor(band, index) {
  const ranges = {
    intro: [2, 3],
    developing: [4, 5],
    expected: [5, 6],
    secure: [7, 8],
    stretch: [8, 9],
    retrieval: [3, 5],
  };
  const [minimum, maximum] = ranges[band];
  return minimum + (index % (maximum - minimum + 1));
}

function rotate(items, amount) {
  return items.slice(amount).concat(items.slice(0, amount));
}

function summary(items, select) {
  const counts = new Map();
  for (const item of items) {
    const key = select(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(",");
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function relative(file) {
  return path.relative(repoRoot, file).replaceAll("\\", "/");
}
