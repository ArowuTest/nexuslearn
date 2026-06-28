#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packPath = path.resolve(argValue("--pack") ?? path.join(repoRoot, "packages/content/packs/sc-y7-particles-states-of-matter.pack.sample.json"));
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y7-particles-states-of-matter-bank-";
const contexts = ["water", "wax", "oxygen", "iron", "ethanol", "carbon dioxide", "cooking oil"];
const pilotTarget = 240;

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y7-particles-states-of-matter") throw new Error("This generator only supports the Year 7 particle-model flagship.");
const authored = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix)).map((variant) => ({
  ...variant,
  body: {
    ...variant.body,
    particle_count_invariant: true,
    particle_size_invariant: true,
    evidence_purpose: variant.format === "model-sort" ? "state_model_identification" : variant.format === "particle-simulation" ? "energy_and_state_prediction" : "misconception_explanation",
    variant_blueprint_id: variant.format === "model-sort" ? "state-model-sorts" : variant.format === "particle-simulation" ? "energy-change-state-tests" : "change-of-state-explanations",
    review_batch: "y7-particles-proof-items",
  },
}));
const establishedCandidates = [...modelSortCandidates(), ...simulationCandidates(), ...explanationCandidates()];
const extensionCandidates = [
  ...diffusionMissionCandidates(),
  ...conservationMissionCandidates(),
  ...temperatureMissionCandidates(),
  ...evidenceMissionCandidates(),
  ...modelLimitMissionCandidates(),
];
const candidates = [...establishedCandidates, ...extensionCandidates];
validateBank(pack, authored, establishedCandidates, extensionCandidates);
pack.question_variants = [...authored, ...candidates];
pack.version = "0.2.0";
pack.qa.notes = "Year 7 particle flagship reaches the 240-item pilot target with three preserved curated variants, the complete established generated bank, and deterministic mission candidates spanning particle models, state changes, conservation, diffusion, temperature and energy, evidence, misconceptions and model limitations. Every generated model preserves particle count and particle size and provides supported SEND interactions, static and reduced-motion alternatives, and rich low-pressure feedback; review candidates still require independent science-teacher, accessibility, safeguarding and simulation-usability review before promotion.";
console.log(`particle-bank authored=${authored.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`particle-bank formats=${formatSummary(candidates)}`);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`particle-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 7 particle bank is out of date; run generate-y7-particle-bank.mjs --write.");
  console.log("particle-bank deterministic check passed");
} else {
  console.log("particle-bank dry-run; pass --write to update the pack");
}

function modelSortCandidates() {
  const variants = [];
  const states = [
    { state: "solid", expected: "model_with_close_fixed_particles", clue: "close together in fixed positions", movement: "vibrate" },
    { state: "liquid", expected: "model_with_close_sliding_particles", clue: "close together without a fixed pattern", movement: "slide past each other" },
    { state: "gas", expected: "model_with_far_apart_random_particles", clue: "far apart in a random arrangement", movement: "move freely" },
  ];
  for (const state of states) {
    for (let set = 1; set <= 12; set += 1) {
      variants.push({
        id: `${prefix}model-${state.state}-${set}`,
        format: "model-sort",
        body: {
          prompt: `Model set ${set}: which chamber represents a ${state.state}?`,
          choices: ["A", "B", "C"],
          correct_state: state.state,
          required_features: [state.clue, state.movement],
          particle_count_invariant: true,
          particle_size_invariant: true,
          response_mode: "visual_or_described_model_choice",
          evidence_purpose: "state_model_identification",
          variant_blueprint_id: "state-model-sorts",
          review_batch: "y7-particles-pilot-a",
        },
        expected_answer: { value: state.expected },
        hints: [`Look for particles that are ${state.clue}.`, `In a ${state.state}, particles ${state.movement}.`],
        explanation: `A ${state.state} model shows particles ${state.clue}; they ${state.movement}.`,
        difficulty: 3 + (set % 3),
        status: "review",
        misconception_tag: state.state === "solid" ? "solid_particles_do_not_move" : "state_model_confusion",
        animation_hook: "three-state-particle-compare",
      });
    }
  }
  return variants;
}

function simulationCandidates() {
  const transitions = [
    { id: "melt", start: "solid", direction: "increase", final: "liquid", expected: "Particles move more and can slide past each other", tag: "melting_destroys_particles" },
    { id: "freeze", start: "liquid", direction: "decrease", final: "solid", expected: "Particles move less and settle into fixed positions", tag: "particles_expand" },
    { id: "evaporate", start: "liquid", direction: "increase", final: "gas", expected: "Particles move faster and become much farther apart", tag: "particles_expand" },
    { id: "condense", start: "gas", direction: "decrease", final: "liquid", expected: "Particles move less and become close enough to slide past each other", tag: "melting_destroys_particles" },
    { id: "warm-solid", start: "solid", direction: "small_increase", final: "solid", expected: "Particles vibrate more but remain in fixed positions", tag: "solid_particles_do_not_move" },
    { id: "cool-gas", start: "gas", direction: "small_decrease", final: "gas", expected: "Particles move more slowly but remain far apart", tag: "state_model_confusion" },
  ];
  const variants = [];
  for (const context of contexts) {
    for (const transition of transitions) {
      const choices = [
        transition.expected,
        "The particles become larger",
        "Some particles disappear",
        "The particles stop existing as the same substance",
      ];
      variants.push({
        id: `${prefix}simulation-${slug(context)}-${transition.id}`,
        format: "particle-simulation",
        body: {
          prompt: `Use the energy control for ${context}. What does the model show when energy has a ${transition.direction.replaceAll("_", " ")}?`,
          start_state: transition.start,
          target_state: transition.final,
          energy_change: transition.direction,
          control: "energy",
          choices: rotate(choices, variants.length % choices.length),
          particle_count_invariant: true,
          particle_size_invariant: true,
          freeze_frame_available: true,
          evidence_purpose: "energy_and_state_prediction",
          variant_blueprint_id: "energy-change-state-tests",
          review_batch: "y7-particles-pilot-a",
        },
        expected_answer: { value: transition.expected },
        hints: ["Track movement and arrangement.", "Particle size and particle count do not change in this model."],
        explanation: `${transition.expected}. The model keeps the same particles and changes their movement or arrangement.`,
        difficulty: transition.direction.startsWith("small") ? 7 : 5 + (contexts.indexOf(context) % 2),
        status: "review",
        misconception_tag: transition.tag,
        animation_hook: "energy-slider-melt",
      });
    }
  }
  return variants;
}

function explanationCandidates() {
  const claims = [
    { id: "solid-motion", prompt: "A learner says solid particles are completely still.", expected: "Solid particles vibrate in fixed positions", tag: "solid_particles_do_not_move" },
    { id: "particle-size", prompt: "A learner says heating makes each particle expand.", expected: "Heating changes particle movement and spacing, not particle size", tag: "particles_expand" },
    { id: "melting-count", prompt: "A learner says particles disappear when a solid melts.", expected: "The same particles remain while their arrangement and movement change", tag: "melting_destroys_particles" },
    { id: "gas-empty", prompt: "A learner says the gaps in a gas are filled with more gas particles.", expected: "The model shows particles far apart with empty space between them", tag: "state_model_confusion" },
    { id: "liquid-fixed", prompt: "A learner says liquid particles stay in a fixed pattern.", expected: "Liquid particles stay close but can move past each other", tag: "state_model_confusion" },
    { id: "new-particles", prompt: "A learner says cooling creates new particles.", expected: "Cooling reduces movement; it does not create particles", tag: "melting_destroys_particles" },
  ];
  const variants = [];
  for (const context of contexts) {
    for (const claim of claims) {
      const choices = [
        claim.expected,
        "The learner is correct because particles change identity",
        "The particles become larger or smaller to make the state",
        "The number of particles changes whenever energy changes",
      ];
      variants.push({
        id: `${prefix}explain-${slug(context)}-${claim.id}`,
        format: "explain-choice",
        body: {
          prompt: `${claim.prompt} Which explanation best corrects the model for ${context}?`,
          choices: rotate(choices, variants.length % choices.length),
          particle_count_invariant: true,
          particle_size_invariant: true,
          evidence_purpose: "misconception_explanation",
          variant_blueprint_id: "change-of-state-explanations",
          review_batch: "y7-particles-pilot-a",
        },
        expected_answer: { value: claim.expected },
        hints: ["Keep particle identity and count constant.", "Describe arrangement, spacing and movement."],
        explanation: `${claim.expected}. Particle models explain changes through movement, spacing and arrangement.`,
        difficulty: 6 + (contexts.indexOf(context) % 3),
        status: "review",
        misconception_tag: claim.tag,
        animation_hook: "particle-count-lock",
      });
    }
  }
  return variants;
}

function diffusionMissionCandidates() {
  const cases = [
    {
      key: "bromine-jars",
      prompt: "A barrier between a brown bromine-gas jar and a clear air jar is removed. What will the particle model show?",
      answer: "Random motion and collisions spread bromine particles from the more concentrated region until the colour is even",
      distractors: ["Air particles pull the bromine upwards", "Bromine particles grow until they fill both jars", "New bromine particles appear in the clear jar"],
      explanation: "Diffusion is the overall spreading caused by random particle motion and collisions. The particles keep the same count and size in the closed two-jar system.",
      misconception: "diffusion_requires_a_force",
    },
    {
      key: "perfume-room",
      prompt: "A perfume bottle is opened at mission control. Why can its smell later be detected across the room?",
      answer: "Perfume particles move randomly among air particles and spread from the concentrated source",
      distractors: ["The smell travels as one invisible sheet", "Air changes into perfume particles", "Perfume particles become larger as they travel"],
      explanation: "Perfume particles diffuse through the spaces between moving air particles; the model does not require every particle to follow one direct path.",
      misconception: "diffusion_is_a_direct_path",
    },
    {
      key: "dye-water",
      prompt: "A drop of food dye is placed in still water. Which prediction best uses the particle model?",
      answer: "Dye particles will gradually spread through the water even without stirring",
      distractors: ["Dye can spread only if a spoon pushes it", "Water particles turn into dye particles", "The dye particles steadily increase in size"],
      explanation: "Both dye and water particles move. Their random motion and collisions produce diffusion without bulk stirring.",
      misconception: "diffusion_needs_stirring",
    },
    {
      key: "warm-cold-dye",
      prompt: "Equal dye drops enter equal cups of warm and cold water. Where should the model predict faster spreading?",
      answer: "In warm water, because particles have greater average kinetic energy and move faster",
      distractors: ["In cold water, because gaps become empty", "At the same rate, because temperature never affects motion", "In warm water, because each dye particle expands"],
      explanation: "Higher temperature is represented by greater average particle kinetic energy, so random mixing is usually faster; particle size remains fixed.",
      misconception: "temperature_does_not_affect_diffusion",
    },
    {
      key: "gel-crystal",
      prompt: "A coloured crystal slowly spreads through a clear gel over several days. What does this evidence support?",
      answer: "Particles can diffuse through the gel, although the spreading is much slower than in a gas",
      distractors: ["The crystal makes coloured particles from nothing", "The gel flows across the dish like a gas", "Diffusion happens instantly in every state"],
      explanation: "The growing coloured region supports slow particle movement through the gel. Rate depends on the material and conditions.",
      misconception: "diffusion_is_instant",
    },
    {
      key: "membrane",
      prompt: "Small dissolved particles cross a membrane but larger particles do not. Which model claim fits the observation?",
      answer: "The membrane model has openings that the smaller represented particles can pass through",
      distractors: ["The membrane destroys larger particles", "All particles pass because particles have no size", "Small particles are pulled through because they are colder"],
      explanation: "A selective-barrier model can explain different passage, but its drawn openings and particles are representations rather than a scale picture.",
      misconception: "all_particles_cross_membranes_equally",
    },
    {
      key: "dynamic-equilibrium",
      prompt: "Dye is evenly spread through water. What should a particle animation show next?",
      answer: "Particles keep moving randomly, with no lasting concentration difference across the container",
      distractors: ["All particles stop once the colour is even", "Dye particles disappear into the water", "Particles line up in fixed positions"],
      explanation: "Even concentration does not mean still particles. Random movement continues while there is no net spreading in one direction.",
      misconception: "equilibrium_particles_stop",
    },
    {
      key: "solid-boundary",
      prompt: "Two clean metal blocks remain pressed together for years and atoms are later detected across the boundary. What is the cautious conclusion?",
      answer: "Very slow diffusion can occur in solids over long times; the evidence does not mean the blocks melted",
      distractors: ["Solid particles never move, so the detection must be impossible", "The atoms crossed because they grew larger", "Every solid diffuses as quickly as a gas"],
      explanation: "Particles in solids vibrate and, over long times in some conditions, limited diffusion can occur. One result does not set the rate for every solid.",
      misconception: "diffusion_only_in_fluids",
    },
  ];
  return missionVariants("diffusion", "particle-simulation", "energy-change-state-tests", cases);
}

function conservationMissionCandidates() {
  const cases = [
    {
      key: "compressed-syringe",
      prompt: "A sealed syringe of air is compressed. Which before-and-after particle model is valid?",
      answer: "The same number of same-sized particles occupy less space and collide more often",
      distractors: ["Each particle becomes smaller", "Some particles are crushed out of existence", "More air particles are created by the plunger"],
      explanation: "Compression changes particle spacing and collision frequency, not particle count or particle size in the closed syringe.",
      misconception: "compression_changes_particle_size",
    },
    {
      key: "sealed-melting",
      prompt: "Ice melts in a sealed container on a balance. Which particle account conserves matter?",
      answer: "The same water particles change arrangement and movement, so the closed-system mass stays constant",
      distractors: ["Melting removes the cold particles", "Liquid particles weigh less than solid particles", "Water particles grow to make the liquid"],
      explanation: "A physical state change rearranges the same substance. In a closed system no particles enter or leave, so mass is conserved.",
      misconception: "state_change_changes_mass",
    },
    {
      key: "sealed-evaporation",
      prompt: "Water evaporates inside a sealed transparent vessel. What should the complete model preserve?",
      answer: "Every water particle, including those now far apart in the gas above the liquid",
      distractors: ["Only particles still visible in the liquid", "Fewer particles because gas has no mass", "Larger gas particles replacing the liquid particles"],
      explanation: "Evaporated particles remain water particles and remain inside the closed vessel even when individual particles cannot be seen.",
      misconception: "evaporated_particles_vanish",
    },
    {
      key: "condensation-window",
      prompt: "Water vapour condenses on a cold lid in a closed box. Which inventory is scientifically consistent?",
      answer: "Particle count and identity stay constant while gas particles become close enough to form liquid droplets",
      distractors: ["The cold lid creates new water particles", "Particles shrink into droplets", "Air particles transform into water particles"],
      explanation: "Condensation changes movement, spacing and arrangement. It does not create particles or alter their size.",
      misconception: "condensation_creates_water",
    },
    {
      key: "salt-solution",
      prompt: "Salt dissolves in water in a sealed flask. Which claim best tracks matter?",
      answer: "Salt particles remain present but become distributed among water particles, so total mass is conserved",
      distractors: ["Salt particles cease to exist because they cannot be seen", "Water particles turn into salt", "Dissolving makes every particle larger"],
      explanation: "Loss of visibility is not loss of matter. A particle model represents dissolved salt as dispersed while keeping the closed-system inventory.",
      misconception: "dissolving_destroys_solute",
    },
    {
      key: "dry-ice-box",
      prompt: "Solid carbon dioxide changes directly to gas in a sealed box. Which conservation statement is correct?",
      answer: "Carbon dioxide particle identity and total count remain constant while spacing and movement change",
      distractors: ["Solid particles split into air particles", "Gas particles have no mass", "Sublimation increases particle size"],
      explanation: "Sublimation is a physical state change. The closed-system model must retain the same carbon dioxide particles.",
      misconception: "sublimation_destroys_matter",
    },
    {
      key: "open-beaker",
      prompt: "An open beaker loses mass as water evaporates. Does this break conservation of matter?",
      answer: "No; water particles leave the measured beaker system and enter the surrounding air",
      distractors: ["Yes; evaporation destroys matter", "Yes; gas particles have negative mass", "No; the remaining particles grow to replace the lost mass"],
      explanation: "Conservation depends on the system boundary. The beaker is open, so its measured mass can fall while matter is conserved in beaker plus surroundings.",
      misconception: "open_system_mass_loss_is_destruction",
    },
    {
      key: "wax-cycle",
      prompt: "Wax melts and then freezes without burning. Which mission log is valid?",
      answer: "The same wax particles cycle between close fixed and close sliding arrangements",
      distractors: ["Freezing creates replacement particles", "Melting turns wax particles into heat", "The particles change size on each cycle"],
      explanation: "Reversible physical changes alter arrangement and movement. The particle inventory and particle size remain invariant.",
      misconception: "reversible_change_replaces_particles",
    },
  ];
  return missionVariants("conservation", "explain-choice", "change-of-state-explanations", cases);
}

function temperatureMissionCandidates() {
  const cases = [
    {
      key: "warm-gas",
      prompt: "A sealed gas is warmed but remains a gas. What should the energy slider change first?",
      answer: "The particles' average speed and collision rate increase while their size and count stay fixed",
      distractors: ["Every particle expands", "New fast particles replace slow ones", "All particles move at exactly the same speed"],
      explanation: "Temperature is linked to average kinetic energy. Individual speeds vary, while warming raises the average.",
      misconception: "all_particles_same_speed",
    },
    {
      key: "cool-liquid",
      prompt: "A liquid cools without freezing. Which freeze-frame comparison is best?",
      answer: "Particles remain close and able to slide, but move more slowly on average",
      distractors: ["Particles become completely still", "Particle count falls with temperature", "Each particle becomes smaller"],
      explanation: "Cooling lowers average kinetic energy. Before freezing, the arrangement remains liquid-like and motion continues.",
      misconception: "cooling_stops_particles",
    },
    {
      key: "melting-plateau",
      prompt: "Energy enters a pure solid while its temperature stays constant during melting. Where does the model place the change?",
      answer: "Energy changes the particle arrangement so fixed positions break down, rather than increasing average speed at that moment",
      distractors: ["Energy is destroyed during melting", "Particles expand until they touch", "The thermometer stops working at a state change"],
      explanation: "During the change of state, transferred energy supports the arrangement change; a constant temperature does not mean no energy transfer.",
      misconception: "constant_temperature_means_no_energy_transfer",
    },
    {
      key: "boil-evaporate",
      prompt: "Which observation correctly distinguishes boiling from evaporation?",
      answer: "Boiling forms vapour throughout a liquid at its boiling point; evaporation can occur at the surface below it",
      distractors: ["Only boiling is a liquid-to-gas change", "Evaporation happens because surface particles disappear", "Boiling makes gas particles larger"],
      explanation: "Both processes transfer particles from liquid to gas. Their location and conditions differ, not particle identity or size.",
      misconception: "evaporation_only_at_boiling_point",
    },
    {
      key: "condense-transfer",
      prompt: "A gas condenses on a cold surface. Which energy account is best?",
      answer: "Particles transfer energy to the surroundings, move less on average and become close together",
      distractors: ["Cold is transferred into the particles", "Particles lose all energy and stop", "The surface creates smaller particles"],
      explanation: "Condensation involves energy transfer from the substance to its surroundings and a change to a close liquid arrangement.",
      misconception: "cold_is_a_substance",
    },
    {
      key: "temperature-average",
      prompt: "One particle in a warm sample is moving slowly. Does that disprove the temperature model?",
      answer: "No; temperature relates to average kinetic energy, so individual particles can have different speeds",
      distractors: ["Yes; every particle at one temperature must have one speed", "No; temperature measures particle size", "Yes; slow particles are a different state"],
      explanation: "A particle model describes a distribution of speeds. Temperature is an average property, not a speed label for each particle.",
      misconception: "temperature_is_each_particle_speed",
    },
    {
      key: "compressed-gas",
      prompt: "A gas model is compressed into half the volume without losing particles. What must not change in the drawing?",
      answer: "Particle count and particle diameter; only spacing and collision patterns may change",
      distractors: ["Particle diameter must halve", "Half the particles must vanish", "Gas particles must become liquid particles"],
      explanation: "Macroscopic volume is represented mainly by spacing. Drawing smaller particles would incorrectly change the particle-size invariant.",
      misconception: "volume_is_particle_size",
    },
    {
      key: "thermal-equilibrium",
      prompt: "Warm and cool sealed objects touch until they reach the same temperature. Which particle account fits?",
      answer: "Energy transfers from the warmer object to the cooler one until their average kinetic energies correspond to the same temperature",
      distractors: ["Cold particles flow into the warm object", "The objects exchange particle identities", "All particles stop at the same temperature"],
      explanation: "Energy transfer reduces the temperature difference. Matter does not need to cross the boundary and microscopic motion continues.",
      misconception: "cold_flows",
    },
  ];
  return missionVariants("temperature-energy", "particle-simulation", "energy-change-state-tests", cases);
}

function evidenceMissionCandidates() {
  const cases = [
    {
      key: "brownian-motion",
      prompt: "Smoke specks seen through a microscope jiggle unpredictably. What can this indirectly support?",
      answer: "Unseen air particles collide with the larger visible specks from changing directions",
      distractors: ["The visible specks are individual air particles", "The specks move because all particles choose random routes", "The microscope creates particle motion"],
      explanation: "The specks are much larger than air particles. Their irregular motion is indirect evidence consistent with many unseen collisions.",
      misconception: "visible_specks_are_molecules",
    },
    {
      key: "gas-pressure",
      prompt: "A pressure sensor reading rises when a sealed gas is heated at fixed volume. Which model link is supported?",
      answer: "Faster average motion produces more frequent and forceful collisions with the container walls",
      distractors: ["Heating adds particles through the sealed wall", "Particles expand and permanently press together", "Pressure rises because particles stop colliding"],
      explanation: "The pressure observation is consistent with a collision model while particle number and container volume are controlled.",
      misconception: "pressure_is_particle_size",
    },
    {
      key: "diffusion-repeat",
      prompt: "A class repeats warm- and cold-water dye trials. Which evidence would strengthen the temperature claim?",
      answer: "Repeated warm trials show a consistently shorter spreading time while drop size, volume and container are controlled",
      distractors: ["One warm trial looks more colourful", "Different amounts of dye are used in every cup", "Only the predicted result is recorded"],
      explanation: "Repeated measurements and controlled variables make the comparison stronger; colour intensity alone can confound amount with rate.",
      misconception: "single_observation_proves_claim",
    },
    {
      key: "melting-mass-data",
      prompt: "A sealed container has the same measured mass before and after ice melts. What does the result justify?",
      answer: "It supports conservation during melting but does not directly show the microscopic particle arrangement",
      distractors: ["It proves particles are drawn exactly to scale", "It proves no energy entered", "It shows liquid particles have no movement"],
      explanation: "Mass data support a conserved inventory. Arrangement and motion are explanatory model features inferred with other evidence.",
      misconception: "one_measurement_proves_whole_model",
    },
    {
      key: "gas-fills-container",
      prompt: "A gas spreads to every part of containers with different shapes. Which particle idea best explains the pattern?",
      answer: "Particles move freely in many directions with large spaces between them",
      distractors: ["Gas particles have the same shape as each container", "Particles are fixed in a hidden lattice", "New particles appear in empty corners"],
      explanation: "Free random motion explains filling available space without changing individual particle size or creating particles.",
      misconception: "gas_particles_match_container_shape",
    },
    {
      key: "liquid-volume",
      prompt: "A liquid changes shape between two measuring vessels but keeps the same volume. Which model feature is consistent?",
      answer: "Close particles can move past one another while remaining difficult to compress",
      distractors: ["Particles stretch into the vessel shape", "Liquid particles are fixed in rows", "The particle count changes to fit each vessel"],
      explanation: "A close but mobile arrangement accounts for flow and retained volume. The dots themselves do not take the vessel's shape.",
      misconception: "particles_change_shape_with_container",
    },
    {
      key: "model-prediction",
      prompt: "A model predicts faster gas diffusion at higher temperature. What is the strongest next scientific step?",
      answer: "Test the prediction with controlled measurements and revise the model if repeatable evidence disagrees",
      distractors: ["Accept it because the animation looks convincing", "Change the data until they match", "Treat the model as a direct photograph"],
      explanation: "Models earn usefulness through testable predictions and revision against evidence, not visual realism alone.",
      misconception: "models_cannot_be_revised",
    },
    {
      key: "open-closed-evidence",
      prompt: "Evaporation lowers the mass of an open beaker but not a sealed apparatus. What key evidence idea resolves the difference?",
      answer: "The chosen system boundary determines whether escaping gas particles remain included in the measurement",
      distractors: ["Conservation works only in sealed glass", "Open air destroys water particles", "A lid changes particle mass"],
      explanation: "Including the surroundings restores the complete matter account. Evidence must be interpreted using an explicit system boundary.",
      misconception: "conservation_depends_on_container_material",
    },
  ];
  return missionVariants("evidence", "explain-choice", "change-of-state-explanations", cases);
}

function modelLimitMissionCandidates() {
  const cases = [
    {
      key: "not-to-scale",
      prompt: "A chamber diagram uses large circles with modest gaps. Which caution belongs in the mission report?",
      answer: "The circles and gaps are not to scale, so the diagram shows patterns rather than real relative sizes and distances",
      distractors: ["Real particles are visible circles of that size", "Every gap contains drawn invisible circles", "The particle count must equal the real sample count"],
      explanation: "Particle diagrams deliberately magnify particles and show very few of them. Their strength is relational, not scale accuracy.",
      misconception: "particle_diagram_is_scale_photo",
    },
    {
      key: "two-dimensional",
      prompt: "Why is a flat particle diagram incomplete even when its arrangement is useful?",
      answer: "Real particles occupy and move through three dimensions, while the diagram shows a two-dimensional slice",
      distractors: ["Particles become flat inside containers", "A flat diagram cannot represent any evidence", "The missing dimension contains no particles"],
      explanation: "A two-dimensional display can compare spacing and order, but it cannot show the full three-dimensional arrangement or every collision.",
      misconception: "model_has_every_dimension",
    },
    {
      key: "forces-omitted",
      prompt: "A simple state model shows dots and motion arrows but no attractions. What should a learner conclude?",
      answer: "The model can compare arrangement and motion but cannot fully explain state stability or change without interactions between particles",
      distractors: ["No forces act between real particles", "Arrows are attractive forces", "Particle count explains every state property"],
      explanation: "Simple models omit interactions to reduce load. That helps one purpose but limits explanations that depend on forces and energy.",
      misconception: "omitted_feature_does_not_exist",
    },
    {
      key: "speed-arrows",
      prompt: "A freeze-frame gives every gas particle an identical arrow. What limitation should be flagged?",
      answer: "Real particles have a range of speeds and continually changing directions, so one identical-arrow snapshot is simplified",
      distractors: ["Gas particles always move in parallel", "Arrows show particles growing", "A freeze-frame proves particles stop between frames"],
      explanation: "Motion arrows are useful cues, but a real sample has varied speeds and collision-driven changes that one frame cannot capture.",
      misconception: "all_gas_particles_move_identically",
    },
    {
      key: "colours-symbolic",
      prompt: "Blue dots represent water particles and red dots represent ethanol particles. What must the key make clear?",
      answer: "The colours are labels chosen to distinguish substances, not claims about the particles' real colours",
      distractors: ["Water particles are naturally blue", "Colour determines particle speed", "Changing the key changes the substance"],
      explanation: "Model colour is symbolic. Labels, shapes and patterns should also carry meaning so colour is not the only access route.",
      misconception: "model_colour_is_real",
    },
    {
      key: "identical-balls",
      prompt: "A model draws every substance as one identical ball. Which question can it not answer well?",
      answer: "How particles of different substances differ in composition, structure or interactions",
      distractors: ["Whether gas particles are generally farther apart", "Whether solid particles vibrate", "Whether a closed state change conserves particle count"],
      explanation: "Identical balls support basic state comparisons but hide molecular structure and substance-specific interactions.",
      misconception: "all_substances_same_particles",
    },
    {
      key: "model-choice",
      prompt: "Two models explain diffusion: a static dot picture and a controllable collision animation with a text trace. Which is more useful for predicting rate?",
      answer: "The controllable model, if its assumptions and limits are stated and its predictions are checked against evidence",
      distractors: ["Whichever model has brighter colours", "The static model because simpler always means more accurate", "Both must be true photographs of particles"],
      explanation: "Model quality depends on purpose, assumptions, testable output and evidence. More detail helps only when it represents the relevant process responsibly.",
      misconception: "most_attractive_model_is_best",
    },
  ];
  return missionVariants("model-limitations", "model-sort", "state-model-sorts", cases);
}

function missionVariants(strand, format, blueprint, cases) {
  const representations = [
    { key: "sim", label: "Simulation feed", staticAlternative: "numbered freeze-frames with a text description and evidence table" },
    { key: "cards", label: "Evidence-card route", staticAlternative: "large-print evidence cards in a fixed reading order" },
    { key: "audio", label: "Audio mission log", staticAlternative: "concise transcript with labelled particle-state descriptions" },
  ];
  const missionNames = {
    diffusion: "Rescue the Atmosphere Lab",
    conservation: "Seal the Matter Vault",
    "temperature-energy": "Stabilise the Energy Core",
    evidence: "Rebuild the Evidence Beacon",
    "model-limitations": "Debug the Hologram Deck",
  };
  const variants = [];
  for (const item of cases) {
    for (const representation of representations) {
      const index = variants.length;
      const hints = hintPair(strand, item);
      variants.push({
        id: `${prefix}mission-${slug(strand)}-${item.key}-${representation.key}`,
        format,
        body: {
          prompt: `${representation.label}: ${item.prompt}`,
          choices: rotate([item.answer, ...item.distractors], index % 4),
          particle_count_invariant: true,
          particle_size_invariant: true,
          evidence_purpose: `${slug(strand).replaceAll("-", "_")}_reasoning`,
          variant_blueprint_id: blueprint,
          review_batch: "y7-particles-pilot-b",
          difficulty_band: ["developing", "expected", "secure", "stretch"][index % 4],
          coverage_tags: [strand, "particle_count_invariant", "particle_size_invariant", "evidence_and_misconception"],
          response_mode: "tap_keyboard_switch_or_oral_choice",
          supported_interactions: ["tap", "keyboard", "switch_scan", "oral_choice"],
          keyboard_instructions: "Use arrow keys to review each numbered choice, then Enter to select and check.",
          switch_scan_order: "mission_prompt_then_model_or_evidence_then_choices_then_hint_then_check",
          audio_replay: true,
          timed: false,
          drag_required: false,
          colour_required: false,
          visual_load: "adjustable",
          static_alternative: representation.staticAlternative,
          reduced_motion_alternative: "learner-controlled single-step freeze-frames with no automatic movement or flashing",
          model_description_available: true,
          manipulative_alternative: "same-sized magnetic particle counters on a state mat, with an inventory rail that prevents adding, removing or resizing counters",
          sentence_stem: sentenceStem(strand),
          simulation_controls: ["play_one_step", "pause", "replay_description", "show_particle_inventory", "compare_before_after", "reset"],
          model_limit: "The dots, arrows, colours, gaps, times and two-dimensional layout are representations and are not a scale view of real particles.",
        },
        expected_answer: { value: item.answer },
        hints,
        explanation: item.explanation,
        feedback: {
          correct: `Mission evidence secured. ${item.explanation}`,
          try_again: `No timer and no lost lives. ${hints[0]}`,
          misconception: `Check the invariant counters before deciding. ${hints[1]}`,
          model_limit: "Use the model only for the feature named in the question; its symbols and scale are simplified.",
        },
        gamification: {
          mission: missionNames[strand],
          objective: "Secure one scientifically justified particle-model decision.",
          reward: `restore_${slug(strand)}_beacon_${(index % 8) + 1}`,
          progress_feedback: "one personal mission node restored without speed scoring, streak loss or motor-precision scoring",
          no_timer: true,
          no_lost_lives: true,
          replay_encouraged: true,
        },
        difficulty: 4 + (index % 5),
        status: "review",
        misconception_tag: item.misconception,
        animation_hook: animationFor(strand),
      });
    }
  }
  return variants;
}

function hintPair(strand, item) {
  const first = {
    diffusion: "Track random movement, collisions and the concentration pattern over time.",
    conservation: "Draw a boundary around the system, then inventory particles before and after.",
    "temperature-energy": "Compare average movement, spacing and arrangement; temperature is not particle size.",
    evidence: "Separate the observation from the model claim it supports.",
    "model-limitations": "Ask what the representation helps explain and which real features it leaves out.",
  }[strand];
  return [first, `Reject the '${item.misconception.replaceAll("_", " ")}' idea while keeping particle count and particle size unchanged.`];
}

function sentenceStem(strand) {
  return {
    diffusion: "The particles spread because ___; the evidence is ___.",
    conservation: "Inside the system boundary, the same particles ___ while ___.",
    "temperature-energy": "When energy is transferred, average particle motion ___ while count and size ___.",
    evidence: "The observation ___ supports the claim ___, but it does not show ___.",
    "model-limitations": "This model is useful for ___, but it cannot show ___ accurately.",
  }[strand];
}

function animationFor(strand) {
  return {
    diffusion: "diffusion-concentration-trace",
    conservation: "particle-inventory-lock",
    "temperature-energy": "energy-slider-state-trace",
    evidence: "evidence-model-linker",
    "model-limitations": "model-limit-debugger",
  }[strand];
}

function validateBank(currentPack, curated, established, extension) {
  if (curated.length !== 3) throw new Error(`Expected exactly 3 curated variants, found ${curated.length}. Refusing to overwrite possible authored work.`);
  if (established.length !== 120) throw new Error(`Expected all 120 established generated variants, found ${established.length}.`);
  if (extension.length !== pilotTarget - curated.length - established.length) {
    throw new Error(`Expected ${pilotTarget - curated.length - established.length} extension candidates, found ${extension.length}.`);
  }
  const all = [...curated, ...established, ...extension];
  if (all.length !== pilotTarget || currentPack.practice?.variant_targets?.pilot !== pilotTarget) {
    throw new Error(`Particle bank must exactly meet its ${pilotTarget}-variant pilot target.`);
  }
  const ids = new Set();
  const signatures = new Set();
  const requiredExtensionCoverage = new Set(["diffusion", "conservation", "temperature-energy", "evidence", "model-limitations"]);
  const actualExtensionCoverage = new Set();
  for (const variant of all) {
    if (ids.has(variant.id)) throw new Error(`Duplicate variant id ${variant.id}.`);
    ids.add(variant.id);
    const signature = `${variant.format}|${String(variant.body?.prompt ?? "").trim().toLowerCase()}|${JSON.stringify(variant.expected_answer)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`);
    signatures.add(signature);
  }
  for (const variant of extension) {
    const strand = variant.body.coverage_tags[0];
    actualExtensionCoverage.add(strand);
    if (variant.body.particle_count_invariant !== true || variant.body.particle_size_invariant !== true) throw new Error(`${variant.id} violates a particle invariant.`);
    if (variant.body.timed || variant.body.drag_required || variant.body.colour_required) throw new Error(`${variant.id} violates the supported interaction contract.`);
    if (variant.body.supported_interactions.length < 4 || !variant.body.static_alternative || !variant.body.reduced_motion_alternative || !variant.body.sentence_stem) throw new Error(`${variant.id} lacks SEND alternatives.`);
    if (!variant.feedback?.correct || !variant.feedback?.try_again || !variant.feedback?.misconception || !variant.feedback?.model_limit) throw new Error(`${variant.id} lacks rich feedback.`);
    if (!variant.gamification?.no_timer || !variant.gamification?.no_lost_lives) throw new Error(`${variant.id} has unsuitable gamification.`);
    if (variant.body.choices.filter((choice) => choice === variant.expected_answer.value).length !== 1) throw new Error(`${variant.id} must contain its answer exactly once.`);
  }
  for (const strand of requiredExtensionCoverage) {
    if (!actualExtensionCoverage.has(strand)) throw new Error(`Extension is missing ${strand} coverage.`);
  }
}

function rotate(items, amount) {
  return items.slice(amount).concat(items.slice(0, amount));
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function formatSummary(variants) {
  const counts = {};
  for (const variant of variants) counts[variant.format] = (counts[variant.format] ?? 0) + 1;
  return Object.entries(counts).sort().map(([format, count]) => `${format}:${count}`).join(",");
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function relative(file) {
  return path.relative(repoRoot, file).replaceAll("\\", "/");
}
