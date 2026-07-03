#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/sc-y7-forces.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y7-forces-bank-";
const target = 240;
const batch = "y7-forces-depth-pilot-a";

if (write && check) throw new Error("Choose --write or --check, not both.");
const sourceText = await readFile(packPath, "utf8");
const pack = JSON.parse(sourceText);
if (pack.pack_id !== "sc-y7-forces") throw new Error("This generator only supports sc-y7-forces.");
const curated = (pack.question_variants ?? []).filter((v) => !v.id.startsWith(prefix));
if (curated.length !== 4) throw new Error(`Expected 4 curated variants, found ${curated.length}.`);
const curatedSnapshot = JSON.stringify(curated);

const routes = [
  { key: "diagram", label: "labelled force diagram", support: "Thick patterned arrows begin at the named object; direction and relative length are also written in text." },
  { key: "list", label: "described-image list", support: "A numbered force list gives name, object, direction and magnitude without requiring sight of a diagram." },
  { key: "cards", label: "static force cards", support: "Large-print cards can be selected by touch, keyboard, switch or eye gaze without dragging." },
  { key: "table", label: "force evidence table", support: "One axis is shown at a time in a low-clutter table with persistent units." },
];
const directions = new Set(["left", "right", "up", "down"]);

const generated = [
  ...Array.from({ length: 48 }, (_, i) => buildArrow(i)),
  ...Array.from({ length: 47 }, (_, i) => buildSort(i)),
  ...Array.from({ length: 47 }, (_, i) => buildResultant(i)),
  ...Array.from({ length: 47 }, (_, i) => buildPoe(i)),
  ...Array.from({ length: 47 }, (_, i) => buildRetrieval(i)),
];

pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa = { ...pack.qa, readiness_status: "draft", notes: "Expanded deterministic Year 7 forces pilot bank; generated variants require curriculum, teacher and accessibility review." };
validateBank(pack, curated, generated);
if (JSON.stringify(pack.question_variants.slice(0, 4)) !== curatedSnapshot) throw new Error("Curated variants changed during generation.");
const output = `${JSON.stringify(pack, null, 2)}\n`;
if (write) { await writeFile(packPath, output, "utf8"); console.log(`Wrote ${relative(packPath)} with ${pack.question_variants.length} variants.`); }
else if (check) { if (sourceText !== output) throw new Error(`${relative(packPath)} is not deterministic; run --write.`); console.log(`Check passed: ${relative(packPath)} is deterministic.`); }
else console.log(`Validated ${generated.length} candidates; use --write or --check.`);
console.log(`Blueprints: ${summary(generated, (v) => v.body.variant_blueprint_id)}`);
console.log(`Formats (total): ${summary(pack.question_variants, (v) => v.format)}`);
console.log(`Audio refs: ${pack.question_variants.filter((v) => v.audio_ref).length}`);

function buildArrow(i) {
  const route = routes[i % routes.length];
  const mode = i % 8;
  const n = 4 + (i % 7);
  const cases = [
    { object: "book", system: "book only", context: "a book resting on a horizontal table", forces: [F("weight", "gravity", "down", n, "non-contact"), F("normal contact", "table on book", "up", n, "contact")], answer: `weight ${n} N down and normal contact ${n} N up, both starting on the book`, tag: "arrows_show_motion_not_force" },
    { object: "cart", system: "cart only", context: "a cart pushed right across a rough floor", forces: [F("push", "hand on cart", "right", n + 3, "contact"), F("friction", "floor on cart", "left", n, "contact")], answer: `push ${n + 3} N right and friction ${n} N left, both starting on the cart`, tag: "arrows_show_motion_not_force" },
    { object: "magnet A", system: "magnet A only", context: "magnet A repelled left by magnet B placed to its right", forces: [F("magnetic force", "magnet B on magnet A", "left", n, "non-contact")], answer: `magnetic force ${n} N left, starting on magnet A`, tag: "non_contact_requires_touch" },
    { object: "hanging lamp", system: "lamp only", context: "a lamp hanging motionless from a vertical cable", forces: [F("weight", "Earth on lamp", "down", n, "non-contact"), F("tension", "cable on lamp", "up", n, "contact")], answer: `weight ${n} N down and tension ${n} N up, both starting on the lamp`, tag: "balanced_means_no_forces" },
    { object: "parachutist", system: "parachutist and parachute", context: "a descending parachutist slowing down", forces: [F("weight", "Earth on system", "down", n, "non-contact"), F("drag", "air on system", "up", n + 3, "contact")], answer: `weight ${n} N down and drag ${n + 3} N up, both starting on the parachutist-parachute system`, tag: "arrows_point_with_motion" },
    { object: "toy boat", system: "boat only", context: "a toy boat moving right at constant velocity", forces: [F("thrust", "propeller-water interaction on boat", "right", n, "contact"), F("drag", "water on boat", "left", n, "contact")], answer: `thrust ${n} N right and drag ${n} N left, both starting on the boat`, tag: "motion_requires_forward_resultant" },
    { object: "charged pith ball", system: "pith ball only", context: "a positively charged pith ball attracted right toward a negative plate", forces: [F("electrostatic force", "plate on pith ball", "right", n, "non-contact")], answer: `electrostatic force ${n} N right, starting on the pith ball`, tag: "non_contact_requires_touch" },
    { object: "crate", system: "crate only", context: "a crate pulled right by a rope over a rough floor", forces: [F("tension", "rope on crate", "right", n + 2, "contact"), F("friction", "floor on crate", "left", n, "contact")], answer: `tension ${n + 2} N right and friction ${n} N left, both starting on the crate`, tag: "friction_always_harmful" },
  ];
  const c = cases[mode];
  const choices = [c.answer, wrongOrigin(c), wrongDirection(c), wrongMagnitude(c)];
  return candidate({ i, id: `arrow-${i + 1}-${route.key}`, format: "force-arrow-model", blueprint: "force-arrow-placement", band: "developing", tag: c.tag, prompt: `${route.label}: model the forces on ${c.context}. Choose the canonical arrow description.`, answer: c.answer, choices, explanation: arrowExplanation(c), hints: ["Name the object or system before drawing any arrow.", "Start each arrow on that object; arrow direction is force direction and length represents relative magnitude, not travel."], route, integrity: { kind: "force_model", object: c.object, system: c.system, forces: c.forces, expected_resultants: resultants(c.forces) } });
}

function buildSort(i) {
  const route = routes[i % routes.length];
  const n = 5 + (i % 8);
  const mode = i % 5;
  const cases = [
    { object: "parked bicycle", system: "bicycle only", state: "stationary", forces: [F("weight", "Earth on bicycle", "down", n, "non-contact"), F("normal contact", "ground on bicycle", "up", n, "contact")], answer: "balanced forces; stationary velocity stays unchanged", tag: "balanced_means_no_forces" },
    { object: "steady trolley", system: "trolley only", state: "constant velocity right", forces: [F("pull", "hand on trolley", "right", n, "contact"), F("friction and drag", "surroundings on trolley", "left", n, "contact")], answer: "balanced forces; constant rightward velocity stays unchanged", tag: "motion_requires_forward_resultant" },
    { object: "speeding-up cart", system: "cart only", state: "moving right", forces: [F("push", "hand on cart", "right", n + 4, "contact"), F("friction", "floor on cart", "left", n, "contact")], answer: "unbalanced forces; resultant is 4 N right", tag: "force_runs_out" },
    { object: "book on table", system: "book only", state: "stationary", forces: [F("weight", "Earth on book", "down", n, "non-contact")], answer: `missing normal contact force of ${n} N upward from the table on the book`, tag: "balanced_means_no_forces" },
    { object: "lamp on cable", system: "lamp only", state: "stationary", forces: [F("tension", "cable on lamp", "up", n, "contact")], answer: `missing weight force of ${n} N downward from Earth on the lamp`, tag: "weight_mass_confusion" },
  ];
  const c = cases[mode];
  const choices = [c.answer, "balanced means no forces act", "unbalanced because the object is moving", "the arrows show the object's path rather than forces"];
  return candidate({ i, id: `sort-${i + 1}-${route.key}`, format: "free-body-style-sort", blueprint: "free-body-balanced-sorts", band: "intro", tag: c.tag, prompt: `${route.label}: inspect the described forces on the ${c.object}, which is ${c.state}. Classify the model or diagnose its missing force.`, answer: c.answer, choices, explanation: sortExplanation(c), hints: ["Add signed force components on each axis; do not infer resultant from motion alone.", "Balanced means zero resultant, not zero individual forces; a missing partner may be needed for the stated unchanged motion."], route, integrity: { kind: mode < 3 ? "motion_model" : "missing_force", object: c.object, system: c.system, initial_state: c.state, forces: c.forces, expected_resultants: resultants(c.forces), missing: mode === 3 ? F("normal contact", "table on book", "up", n, "contact") : mode === 4 ? F("weight", "Earth on lamp", "down", n, "non-contact") : null, expected_answer: c.answer } });
}

function buildResultant(i) {
  const route = routes[i % routes.length];
  const left = 6 + (i % 9);
  const delta = [0, 2, 4, -2, -4][i % 5];
  const right = left + delta;
  const velocity = ["stationary", "moving right", "moving right", "moving left", "moving left"][i % 5];
  const forces = [F("rightward force", "external agent on object", "right", right, "contact"), F("leftward resistance", "surroundings on object", "left", left, "contact")];
  const rx = right - left;
  const implication = motionImplication(rx, velocity);
  const answer = `${Math.abs(rx)} N ${rx === 0 ? "resultant" : rx > 0 ? "right" : "left"}; ${implication}`;
  const choices = [answer, `${right + left} N right; moving requires a forward resultant`, `${Math.abs(rx)} N ${rx > 0 ? "left" : "right"}; arrows follow the path`, `0 N resultant; balanced means no forces act`];
  return candidate({ i, id: `resultant-${i + 1}-${route.key}`, format: "explain-choice", blueprint: "resultant-motion-explanations", band: "expected", tag: rx === 0 ? "motion_requires_forward_resultant" : i % 2 ? "arrows_point_with_motion" : "force_runs_out", prompt: `${route.label}: an object is ${velocity}. It has ${right} N right and ${left} N left. Calculate the 1D resultant and state the immediate velocity implication.`, answer, choices, explanation: `Taking right as positive gives ${right} N - ${left} N = ${rx} N. ${rx === 0 ? "Zero resultant means velocity stays unchanged, whether stationary or already moving steadily." : `The resultant points ${rx > 0 ? "right" : "left"}, so velocity changes in that direction: ${implication}.`} A resultant explains change in velocity, not motion itself.`, hints: ["Choose a positive direction and add signed force components with units.", "Compare resultant direction with the current velocity; zero resultant means unchanged velocity."], route, integrity: { kind: "motion_model", object: "test object", system: "test object only", initial_state: velocity, forces, expected_resultants: { x: rx, y: 0 }, expected_implication: implication, expected_answer: answer } });
}

function buildPoe(i) {
  const route = routes[i % routes.length];
  const n = 6 + (i % 7);
  const mode = i % 5;
  const cases = [
    { object: "cart", system: "cart only", safe: "A simulation changes only the applied push while cart mass, surface and starting velocity stay fixed.", before: [F("push", "simulation hand on cart", "right", n, "contact"), F("friction", "surface on cart", "left", n, "contact")], after: [F("push", "simulation hand on cart", "right", n + 3, "contact"), F("friction", "surface on cart", "left", n, "contact")], initial: "moving right", changed: "push magnitude", prediction: "the cart's rightward velocity increases", observation: "equal-time position gaps become larger", tag: "larger_object_means_larger_acceleration" },
    { object: "parachute model", system: "model and canopy", safe: "A safe screen simulation increases canopy area while mass, air conditions and initial downward velocity stay fixed.", before: [F("weight", "Earth on system", "down", n, "non-contact"), F("drag", "air on system", "up", n - 2, "contact")], after: [F("weight", "Earth on system", "down", n, "non-contact"), F("drag", "air on system", "up", n + 2, "contact")], initial: "moving down", changed: "drag magnitude", prediction: "the downward velocity decreases", observation: "downward speed becomes smaller after the change", tag: "arrows_point_with_motion" },
    { object: "magnet cart", system: "magnet cart only", safe: "A simulation moves a second magnet closer without touching; cart mass, track and pole orientation stay fixed.", before: [F("magnetic force", "fixed magnet on cart", "right", n - 2, "non-contact"), F("friction", "track on cart", "left", n - 2, "contact")], after: [F("magnetic force", "fixed magnet on cart", "right", n + 2, "non-contact"), F("friction", "track on cart", "left", n - 2, "contact")], initial: "stationary", changed: "magnetic force magnitude", prediction: "the cart begins changing velocity rightward", observation: "the cart's rightward velocity increases from zero", tag: "non_contact_requires_touch" },
    { object: "book", system: "book only", safe: "A simulation changes from a horizontal table to a gently tilted support; book, surface material and gravity stay fixed.", before: [F("weight component along surface", "Earth on book", "right", n - 2, "non-contact"), F("friction", "surface on book", "left", n - 2, "contact")], after: [F("weight component along surface", "Earth on book", "right", n, "non-contact"), F("friction", "surface on book", "left", n - 2, "contact")], initial: "stationary", changed: "component of weight along surface", prediction: "the book begins changing velocity down the slope", observation: "the book starts moving down the slope", tag: "friction_always_harmful" },
    { object: "two equal carts", system: "one selected cart", safe: "A simulation compares equal-mass carts using the same track and starting state, changing only resultant force.", before: [F("push", "launcher on cart", "right", n, "contact"), F("resistance", "track on cart", "left", n - 2, "contact")], after: [F("push", "launcher on cart", "right", n + 2, "contact"), F("resistance", "track on cart", "left", n - 2, "contact")], initial: "stationary", changed: "resultant force through push magnitude", prediction: "the cart with larger resultant has the larger acceleration", observation: "its velocity changes more during the same time interval", tag: "larger_object_means_larger_acceleration" },
  ];
  const c = cases[mode];
  const beforeR = resultants(c.before);
  const afterR = resultants(c.after);
  const answer = `${c.prediction}; observation: ${c.observation}; explanation: resultant changes from ${vectorText(beforeR)} to ${vectorText(afterR)}`;
  const choices = [answer, "motion continues only until the original force runs out", "the arrows must point along the object's path, regardless of force", "the result proves every other variable is irrelevant in all contexts"];
  return candidate({ i, id: `poe-${i + 1}-${route.key}`, format: "prediction-observation-explanation", blueprint: "force-poe-tests", band: "secure", tag: c.tag, prompt: `${route.label}: predict, reveal and explain what happens to the ${c.object} when ${c.changed} changes.`, setup: c.safe, answer, choices, explanation: `${c.prediction[0].toUpperCase()}${c.prediction.slice(1)} because the signed resultant changes from ${vectorText(beforeR)} to ${vectorText(afterR)} while the named controls stay fixed. The observation '${c.observation}' supports this model but does not prove it applies beyond the tested conditions.`, hints: ["Calculate the before and after resultant before revealing the observation.", "Link the changed velocity to the changed resultant, then state which variables were controlled and what the evidence cannot establish."], route, integrity: { kind: "poe", object: c.object, system: c.system, initial_state: c.initial, before_forces: c.before, after_forces: c.after, before_resultants: beforeR, after_resultants: afterR, changed_variable: c.changed, changed_force_count: changedForceCount(c.before, c.after), prediction: c.prediction, observation: c.observation, controls_stated: true, safe_context: true, expected_answer: answer } });
}

function buildRetrieval(i) {
  const route = routes[i % routes.length];
  const mode = i % 10;
  const n = 5 + (i % 6);
  const cases = [
    { tag: "contact_non_contact_confusion", prompt: "Which classification is correct?", answer: "friction is contact; gravity and magnetic force can act without contact", distractors: ["gravity is contact because objects touch Earth", "friction is non-contact", "all forces require visible touching"], explanation: "Friction needs interacting surfaces in contact. Gravity and magnetic forces can act across a gap; identifying the interaction is stronger evidence than relying on whether motion is visible." },
    { tag: "weight_mass_confusion", prompt: "Which statement distinguishes mass and weight?", answer: `mass is measured in kg; weight is a gravitational force measured in N`, distractors: ["mass and weight are both measured in N", "weight is the amount of matter in kg", "mass changes whenever support force changes"], explanation: "Mass describes how much matter/inertia an object has and is measured in kilograms. Weight is the gravitational force on that mass and is measured in newtons." },
    { tag: "balanced_means_no_forces", prompt: `A book has ${n} N weight down and ${n} N support up. What follows?`, answer: "the forces are balanced and the book's velocity remains unchanged", distractors: ["no forces act", "it must be moving upward", "weight and mass cancel because they are the same quantity"], explanation: `The two forces act on the same book in opposite directions with equal magnitude, giving 0 N resultant. Individual forces still act; zero resultant means unchanged velocity.` },
    { tag: "motion_requires_forward_resultant", prompt: `A train moves right at constant velocity. What does a simple horizontal force model imply?`, answer: "the horizontal resultant is zero, so driving and resistive forces balance", distractors: ["a forward resultant is required to keep it moving", "no forces act because speed is constant", "the force has run out"], explanation: "Constant velocity means no acceleration, so the horizontal resultant is zero in this model. A driving force may still act, balanced by drag and friction." },
    { tag: "action_reaction_cancel_one_object", prompt: "A hand pushes a cart and the cart pushes the hand. Why do these interaction forces not cancel on the cart?", answer: "the forces act on different objects; only forces on the chosen cart are added for its resultant", distractors: ["they cancel because every action has a reaction", "the cart's force acts on itself", "reaction forces exist only after motion starts"], explanation: "The hand-on-cart force acts on the cart, while the cart-on-hand force acts on the hand. A free-body-style model sums only forces acting on its named object or system." },
    { tag: "friction_always_harmful", prompt: "Which statement gives evidence-bounded uses of friction?", answer: "friction can oppose sliding but also provides grip for walking, tyres and brakes", distractors: ["friction is always harmful and should be zero", "friction always acts forward", "friction is stored inside an object until it runs out"], explanation: "Friction opposes relative sliding or attempted sliding at a contact. It can dissipate energy, yet controlled friction also supplies useful grip and braking." },
    { tag: "force_runs_out", prompt: "A puck is pushed and then released in a low-friction simulation. Which model is sound?", answer: "the push stops at release; velocity can continue while small resistance gradually changes it", distractors: ["stored push force travels inside the puck until it runs out", "motion proves a forward force remains", "all forces disappear at release"], explanation: "A contact push acts only during contact. Motion does not need a forward resultant; after release, the current velocity persists unless a resultant such as resistance changes it." },
    { tag: "larger_object_means_larger_acceleration", prompt: "Two objects have different masses. What information is needed to compare acceleration?", answer: "compare both resultant force and mass; size alone is insufficient", distractors: ["the visually larger object always accelerates more", "only the largest individual force matters", "mass is irrelevant whenever forces are shown"], explanation: "Acceleration depends on resultant force and mass. A picture's size does not establish either quantity, so both must be known before comparing acceleration." },
    { tag: "model_limit_overclaim", prompt: "What is a limitation of a simple force-arrow model?", answer: "it represents named forces, directions and relative magnitudes but may omit deformation, changing drag or three-dimensional detail", distractors: ["it shows the exact path travelled", "it proves the force cause from arrow appearance alone", "every arrow is a force exerted by the object on itself"], explanation: "A force-arrow model is useful for interactions and resultants on a named system. It is not a path diagram and may simplify changing, distributed or three-dimensional effects." },
    { tag: "arrows_point_with_motion", prompt: "A parachutist moves downward while slowing. Which arrow relation is possible?", answer: "upward drag is larger than downward weight, giving an upward resultant", distractors: ["all arrows must point downward with motion", "downward motion requires a downward resultant", "balanced means no forces"], explanation: "Velocity is downward, but slowing requires acceleration and resultant upward. Force arrows encode force direction, not the object's path or current velocity." },
  ];
  const c = cases[mode];
  return candidate({ i, id: `retrieval-${i + 1}-${route.key}`, format: "explain-choice", blueprint: "forces-retrieval", band: "retrieval", tag: c.tag, prompt: `${route.label}: ${c.prompt}`, answer: c.answer, choices: [c.answer, ...c.distractors], explanation: c.explanation, hints: ["Name the object/system and the interaction before deciding what an arrow or claim means.", "Separate current velocity from resultant force, which explains change in velocity."], route, integrity: { kind: "concept", object: conceptObject(mode), system: `${conceptObject(mode)} only unless the prompt explicitly names a combined system`, canonical_claim: c.answer, concept_code: c.tag, exact_units_if_numeric: true } });
}

function candidate({ i, id, format, blueprint, band, tag, prompt, setup = null, answer, choices, explanation, hints, route, integrity }) {
  const completed = completeChoices(unique(choices), answer);
  const rotated = rotate(completed, i % completed.length);
  if (rotated.length !== 4 || rotated.filter((v) => same(v, answer)).length !== 1) throw new Error(`${id} has invalid answer choices.`);
  const canonicalIntegrity = { ...integrity, expected_answer: answer };
  const canonicalForces = forceSets(canonicalIntegrity);
  return {
    id: `${prefix}${id}`,
    format,
    body: {
      prompt: `${blueprint} mission ${i + 1}: ${prompt}`,
      simulation_setup: setup,
      choices: rotated,
      physics_integrity: canonicalIntegrity,
      canonical_arrow_specs: canonicalForces.map(({ phase, force }) => ({ phase, force_name: force.name, interaction: force.interaction, origin: canonicalIntegrity.object, target_system: canonicalIntegrity.system, direction: force.direction, magnitude_N: force.magnitude_N, relative_length_units: force.magnitude_N, contact_class: force.contact_class })),
      described_image: describedImage(canonicalIntegrity, canonicalForces),
      text_equivalent: `Named object/system: ${canonicalIntegrity.object} / ${canonicalIntegrity.system}. ${describedImage(canonicalIntegrity, canonicalForces)} Choices: ${rotated.join(" | ")}.`,
      variant_blueprint_id: blueprint,
      review_batch: batch,
      difficulty_band: band,
      coverage_tags: coverageFor(tag, integrity.kind),
      misconception_choice_map: misconceptionMap(rotated, answer, tag),
      response_mode: "touch_keyboard_switch_eye_gaze_aac_point_or_adult_recorded",
      supported_interactions: ["touch_select", "keyboard", "switch_scan", "eye_gaze", "aac", "point", "adult_recorded"],
      interaction_support: { touch: true, keyboard: true, switch_scan: true, eye_gaze: true, aac: true, point_or_partner_scan: true, adult_recorded: true, precision_drag_required: false, handwriting_required: false, speech_required: false, undo_available: true },
      equivalent_simplified_view: "Show the same named object and reasoning with one axis, at most two opposing arrows, persistent N labels and one question at a time.",
      low_sensory: true,
      colour_independent_patterns: true,
      static_alternative: "A no-motion panel lists every force by agent-on-object, direction and magnitude; prediction and observation are revealed on separate learner-controlled cards.",
      reduced_motion_alternative: "Instant before/after panels with no animation, flicker, pulsing or moving arrows.",
      safety_note: safetyFor(canonicalIntegrity.kind),
      evidence_boundary: "The force model supports the stated prediction under the named conditions; it does not prove an untested cause or represent the object's travelled path.",
      timed: false,
      timer_allowed: false,
      speed_score_allowed: false,
      streak_required: false,
      leaderboard_allowed: false,
      browser_tts_allowed: false,
      audio_policy: "Audio is optional and never required. Any future narration must reference a produced, human-reviewed ElevenLabs asset; browser TTS is prohibited.",
      spaced_retrieval: { interval: ["same_session", "next_session", "3_days", "7_days"][i % 4], change_access_route_without_changing_reasoning: true },
    },
    expected_answer: { value: answer },
    hints,
    explanation,
    feedback: {
      correct: `Force model verified. ${explanation}`,
      try_again: `No time or progress is lost. ${hints[0]}`,
      misconception: `The '${tag.replaceAll("_", " ")}' idea conflicts with the named interactions or resultant evidence. ${hints[1]}`,
      evidence: evidenceFor(canonicalIntegrity),
      arrow_check: "Each force arrow begins on the named object, points in the force direction, and uses length only for relative magnitude; it is not a path arrow.",
      system_check: `Add only forces acting on ${canonicalIntegrity.system}; interaction partners acting on other objects do not cancel within this system.`,
      support: "Use the described-image list, static one-axis diagram, keyboard, switch scan, eye gaze, AAC/pointing or adult-recorded response with identical science reasoning.",
    },
    gamification: { mission: missionFor(canonicalIntegrity.kind), objective: "Repair one calm Force Observatory model and log the evidence before reveal.", reward: `private_force_badge_${(i % 9) + 1}`, no_timer: true, no_speed_reward: true, no_lost_lives: true, no_streak_pressure: true, leaderboard: false, retry_encouraged: true, prediction_before_reveal: canonicalIntegrity.kind === "poe" },
    difficulty: { intro: 3, developing: 5, expected: 6, secure: 8, retrieval: 5 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: format === "prediction-observation-explanation" ? "force-poe-static-reveal" : format === "force-arrow-model" ? "force-arrow-origin-check" : "force-resultant-evidence-lock",
  };
}

function validateBank(current, authored, candidates) {
  if (authored.length !== 4 || candidates.length !== 236 || current.question_variants.length !== target) throw new Error("Variant or curated count failed.");
  const blueprints = new Map(current.variant_blueprints.map((b) => [b.id, b]));
  const formats = new Set(current.practice.formats);
  const ids = new Set();
  const signatures = new Set();
  for (const v of current.question_variants) {
    if (ids.has(v.id)) throw new Error(`Duplicate id ${v.id}.`);
    ids.add(v.id);
    const signature = `${v.format}|${normalise(v.body?.prompt)}|${JSON.stringify(v.expected_answer)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate signature ${v.id}.`);
    signatures.add(signature);
  }
  const actualBlueprints = new Set();
  const actualFormats = new Set();
  const coverage = new Set();
  const requiredCoverage = new Set(["contact_forces", "non_contact_forces", "force_arrows", "weight_mass", "gravity_support", "friction_drag", "tension_thrust", "magnetic_electrostatic", "balanced_stationary", "balanced_constant_velocity", "resultant_force", "velocity_change", "missing_force", "poe", "model_limits", "misconceptions", "spaced_retrieval"]);
  for (const v of candidates) {
    const bp = blueprints.get(v.body.variant_blueprint_id);
    if (!bp || bp.format !== v.format || !formats.has(v.format)) throw new Error(`${v.id} mismatches blueprint/format.`);
    if (v.status !== "review" || v.body.review_batch !== batch) throw new Error(`${v.id} lacks review provenance.`);
    if (v.body.prompt.length > 360) throw new Error(`${v.id} prompt exceeds 360 characters.`);
    if (!v.body.described_image || !v.body.text_equivalent || !v.body.equivalent_simplified_view || !v.body.static_alternative || !v.body.reduced_motion_alternative || !v.body.safety_note) throw new Error(`${v.id} lacks access or safety metadata.`);
    if (!v.body.interaction_support?.keyboard || !v.body.interaction_support?.switch_scan || !v.body.interaction_support?.eye_gaze || !v.body.interaction_support?.aac || v.body.interaction_support.precision_drag_required !== false || v.body.interaction_support.handwriting_required !== false || v.body.interaction_support.speech_required !== false) throw new Error(`${v.id} lacks accessible input routes.`);
    if (v.body.timed || v.body.timer_allowed || v.body.speed_score_allowed || v.body.streak_required || v.body.leaderboard_allowed || v.body.browser_tts_allowed !== false) throw new Error(`${v.id} introduces pressure or browser TTS.`);
    if (!v.feedback?.correct || !v.feedback?.try_again || !v.feedback?.misconception || !v.feedback?.evidence || !v.feedback?.arrow_check || !v.feedback?.system_check || !v.feedback?.support || v.explanation.length < 65) throw new Error(`${v.id} lacks rich feedback.`);
    if (!Array.isArray(v.body.choices) || v.body.choices.length !== 4 || new Set(v.body.choices.map(serialise)).size !== 4 || v.body.choices.filter((x) => same(x, v.expected_answer.value)).length !== 1) throw new Error(`${v.id} has invalid answer placement.`);
    if (Object.keys(v.body.misconception_choice_map).length !== 3) throw new Error(`${v.id} lacks named distractor mappings.`);
    validatePhysics(v);
    actualBlueprints.add(v.body.variant_blueprint_id);
    actualFormats.add(v.format);
    for (const tag of v.body.coverage_tags) coverage.add(tag);
  }
  requireAll("blueprints", new Set(blueprints.keys()), actualBlueprints);
  requireAll("formats", formats, actualFormats);
  requireAll("coverage", requiredCoverage, coverage);
  const expectedBlueprints = { "force-arrow-placement": 48, "free-body-balanced-sorts": 47, "resultant-motion-explanations": 47, "force-poe-tests": 47, "forces-retrieval": 47 };
  const bCounts = countBy(candidates, (v) => v.body.variant_blueprint_id);
  for (const [key, n] of Object.entries(expectedBlueprints)) if (bCounts[key] !== n) throw new Error(`${key} expected ${n}, found ${bCounts[key] ?? 0}.`);
  const fCounts = countBy(current.question_variants, (v) => v.format);
  for (const [key, n] of Object.entries({ "force-arrow-model": 49, "free-body-style-sort": 48, "explain-choice": 95, "prediction-observation-explanation": 48 })) if (fCounts[key] !== n) throw new Error(`${key} expected ${n}, found ${fCounts[key] ?? 0}.`);
  if (candidates.some((v) => v.audio_ref || /browser tts allowed/i.test(JSON.stringify(v)))) throw new Error("Unexpected audio reference or browser-TTS permission.");
}

function validatePhysics(v) {
  const m = v.body.physics_integrity;
  if (!m?.object || !m?.system || !m.kind) throw new Error(`${v.id} lacks named object/system integrity.`);
  for (const spec of v.body.canonical_arrow_specs) {
    if (spec.origin !== m.object || spec.target_system !== m.system) throw new Error(`${v.id} has an arrow with wrong origin/system.`);
    if (!directions.has(spec.direction) || !Number.isInteger(spec.magnitude_N) || spec.magnitude_N <= 0 || spec.relative_length_units !== spec.magnitude_N) throw new Error(`${v.id} has invalid arrow direction/magnitude.`);
  }
  if (m.kind === "force_model" || m.kind === "motion_model" || m.kind === "missing_force") {
    const recomputed = resultants(m.forces);
    if (!same(recomputed, m.expected_resultants)) throw new Error(`${v.id} resultant mismatch.`);
    if (m.kind === "motion_model" && m.expected_implication && m.expected_implication !== motionImplication(recomputed.x, m.initial_state)) throw new Error(`${v.id} motion implication mismatch.`);
    if (m.kind === "missing_force") { const complete = resultants([...m.forces, m.missing]); if (complete.x !== 0 || complete.y !== 0) throw new Error(`${v.id} missing force does not balance model.`); }
  } else if (m.kind === "poe") {
    if (!same(resultants(m.before_forces), m.before_resultants) || !same(resultants(m.after_forces), m.after_resultants)) throw new Error(`${v.id} POE resultant mismatch.`);
    if (m.changed_force_count !== 1 || changedForceCount(m.before_forces, m.after_forces) !== 1 || !m.controls_stated || !m.safe_context || !v.body.simulation_setup) throw new Error(`${v.id} POE does not isolate one safe change.`);
  } else if (m.kind === "concept") {
    if (!m.canonical_claim || m.exact_units_if_numeric !== true) throw new Error(`${v.id} concept integrity incomplete.`);
  } else throw new Error(`${v.id} has unknown integrity kind.`);
  if (v.expected_answer.value !== m.expected_answer && m.expected_answer !== undefined) throw new Error(`${v.id} exact answer mismatch.`);
}

function F(name, interaction, direction, magnitude_N, contact_class) { if (!directions.has(direction) || !Number.isInteger(magnitude_N) || magnitude_N <= 0) throw new Error(`Invalid force ${name}.`); return { name, interaction, direction, magnitude_N, unit: "N", contact_class }; }
function resultants(forces) { let x = 0; let y = 0; for (const force of forces) { if (force.unit !== "N") throw new Error(`Force ${force.name} lacks N units.`); if (force.direction === "right") x += force.magnitude_N; else if (force.direction === "left") x -= force.magnitude_N; else if (force.direction === "up") y += force.magnitude_N; else if (force.direction === "down") y -= force.magnitude_N; else throw new Error(`Unknown direction ${force.direction}.`); } return { x, y }; }
function changedForceCount(before, after) { const keys = new Set([...before.map((f) => f.name), ...after.map((f) => f.name)]); let count = 0; for (const key of keys) { const a = before.find((f) => f.name === key); const b = after.find((f) => f.name === key); if (!a || !b || a.direction !== b.direction || a.magnitude_N !== b.magnitude_N || a.interaction !== b.interaction) count++; } return count; }
function motionImplication(rx, state) { if (rx === 0) return state === "stationary" ? "remains stationary" : "continues at constant velocity"; if (state === "stationary") return `begins changing velocity ${rx > 0 ? "right" : "left"}`; const movingRight = /right/.test(state); const movingLeft = /left/.test(state); if ((rx > 0 && movingRight) || (rx < 0 && movingLeft)) return "speeds up"; if ((rx < 0 && movingRight) || (rx > 0 && movingLeft)) return "slows down"; return `changes velocity ${rx > 0 ? "right" : "left"}`; }
function vectorText(r) { if (r.x === 0 && r.y === 0) return "0 N"; const parts = []; if (r.x) parts.push(`${Math.abs(r.x)} N ${r.x > 0 ? "right" : "left"}`); if (r.y) parts.push(`${Math.abs(r.y)} N ${r.y > 0 ? "up" : "down"}`); return parts.join(" and "); }
function forceSets(m) { if (m.kind === "poe") return [...m.before_forces.map((force) => ({ phase: "before", force })), ...m.after_forces.map((force) => ({ phase: "after", force }))]; const values = [...(m.forces ?? []).map((force) => ({ phase: "model", force }))]; if (m.missing) values.push({ phase: "missing-force repair", force: m.missing }); return values; }
function describedImage(m, sets) { if (!sets.length) return `Concept evidence card for ${m.object}; no force diagram is required.`; return sets.map(({ phase, force }) => `${phase}: ${force.name}, ${force.magnitude_N} N ${force.direction}, starts on ${m.object}, interaction ${force.interaction}, ${force.contact_class}`).join("; "); }

function wrongOrigin(c) { return c.answer.replaceAll(`starting on ${c.object}`, "starting beside the object as a path marker").replaceAll(`starting on the ${c.object}`, "starting beside the object as a path marker").replaceAll("starting on the parachutist-parachute system", "starting below the system as a travel path"); }
function wrongDirection(c) { const swap = { left: "right", right: "left", up: "down", down: "up" }; const f = c.forces[0]; return `${f.name} ${f.magnitude_N} N ${swap[f.direction]}, because arrows point with expected motion`;
}
function wrongMagnitude(c) { const f = c.forces[0]; return `${f.name} ${f.magnitude_N + 3} N ${f.direction}, with every other arrow the same length regardless of force`;
}
function arrowExplanation(c) { const r = resultants(c.forces); return `The named system is ${c.system}. ${c.forces.map((f) => `${f.name} is ${f.magnitude_N} N ${f.direction} (${f.interaction})`).join("; ")}. Every arrow begins on ${c.object}; relative length encodes magnitude. The resultant is ${vectorText(r)}, not a path of travel.`; }
function sortExplanation(c) { const r = resultants(c.forces); if (c.answer.startsWith("missing")) return `The shown model has resultant ${vectorText(r)} and cannot represent the stated unchanged stationary velocity. ${c.answer[0].toUpperCase()}${c.answer.slice(1)} completes the forces acting on ${c.system}; forces on other interaction partners are excluded.`; return `Forces on ${c.system} add to ${vectorText(r)}. ${c.answer}. Balanced forces can act on stationary and constant-velocity objects; motion alone does not identify the resultant.`; }
function conceptObject(mode) { return ["force classification card", "sample object", "book", "train", "cart", "shoe-ground contact", "puck", "two compared objects", "force-arrow model", "parachutist"][mode]; }

function coverageFor(tag, kind) {
  const base = ["force_arrows", "resultant_force", "misconceptions", "spaced_retrieval", "model_limits"];
  const byKind = { force_model: ["contact_forces", "non_contact_forces", "gravity_support", "friction_drag", "tension_thrust", "magnetic_electrostatic"], motion_model: ["balanced_stationary", "balanced_constant_velocity", "velocity_change"], missing_force: ["missing_force", "gravity_support"], poe: ["poe", "velocity_change", "friction_drag", "magnetic_electrostatic"], concept: ["contact_forces", "non_contact_forces", "weight_mass", "balanced_stationary", "balanced_constant_velocity", "velocity_change", "missing_force", "friction_drag", "tension_thrust", "magnetic_electrostatic"] };
  return [...new Set([...base, ...(byKind[kind] ?? []), tag])];
}
function evidenceFor(m) { if (m.kind === "poe") return `Recomputed resultants are ${vectorText(m.before_resultants)} before and ${vectorText(m.after_resultants)} after one named change; controls bound the conclusion.`; if (m.kind === "concept") return "Use the named interaction, object/system, units and a counterexample where appropriate; do not infer force merely from motion."; const r = m.expected_resultants; return `Signed force components recompute to ${vectorText(r)} on ${m.system}; zero resultant means unchanged velocity, not absent forces.`; }
function safetyFor(kind) { return kind === "poe" ? "Use the described screen simulation or teacher-approved low-force classroom model. Do not drop masses, launch objects, use mains electricity, strong magnets near devices/implants, or create unsafe trip hazards." : "Reason from the supplied model. Any optional practical uses light classroom objects under adult-approved conditions and has a no-touch simulation alternative."; }
function missionFor(kind) { return ({ force_model: "Anchor the Force Arrows", motion_model: "Balance the Motion Beacon", missing_force: "Recover the Missing Interaction", poe: "Run the Prediction Observatory", concept: "Audit the Force Evidence Archive" })[kind]; }
function misconceptionMap(choices, answer, tag) { const map = {}; const fallbacks = [tag, "force_motion_or_arrow_confusion", "system_or_magnitude_error"]; let i = 0; for (const choice of choices) if (!same(choice, answer)) map[serialise(choice)] = fallbacks[i++]; return map; }
function completeChoices(values, answer) { const result = [...values]; const fallbacks = ["The evidence is insufficient because no object or system is named", "All arrows represent the path travelled", "Balanced forces mean that no interactions exist", "Force magnitude has no units"]; for (const x of fallbacks) if (result.length < 4 && !result.some((v) => same(v, x)) && !same(x, answer)) result.push(x); return result.slice(0, 4); }
function unique(values) { const seen = new Set(); return values.filter((v) => { const key = serialise(v); if (seen.has(key)) return false; seen.add(key); return true; }); }
function same(a, b) { return serialise(a) === serialise(b); }
function serialise(value) { return JSON.stringify(value); }
function rotate(values, amount) { const offset = amount % values.length; return values.slice(offset).concat(values.slice(0, offset)); }
function requireAll(label, required, actual) { const missing = [...required].filter((x) => !actual.has(x)); if (missing.length) throw new Error(`Missing ${label}: ${missing.join(", ")}.`); }
function countBy(values, fn) { const out = {}; for (const value of values) { const key = fn(value); out[key] = (out[key] ?? 0) + 1; } return out; }
function summary(values, fn) { return Object.entries(countBy(values, fn)).sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `${k}:${n}`).join(", "); }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function argValue(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
