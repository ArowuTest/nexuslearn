#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/sc-y4-states-of-matter.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y4-states-of-matter-bank-";
const reviewBatch = "y4-states-matter-depth-pilot-a";
const pilotAllocation = {
  "observable-property-classification": 48,
  "heating-and-cooling-paths": 48,
  "temperature-observation-records": 48,
  "evaporation-condensation-evidence": 48,
  "state-properties-spaced-review": 48,
};

const materials = [
  ["wood", "wooden block", "solid", "keeps its own shape when moved", "does not flow to form a level surface", "occupies one fixed region"],
  ["sand", "dry sand", "solid", "each grain keeps its own shape", "many grains can pour past one another", "the grains form a pile rather than filling all space"],
  ["rice", "dry rice", "solid", "each grain remains a separate fixed shape", "many grains can be tipped between containers", "the grains leave spaces between them"],
  ["clay", "modelling clay", "solid", "keeps a shape until a force reshapes it", "does not make a level surface by itself", "occupies a fixed amount of space"],
  ["water", "liquid water", "liquid", "does not keep its own outline", "flows and forms a level surface", "keeps the same measured volume when transferred"],
  ["oil", "virtual cooking-oil sample", "liquid", "takes the shape of its container", "flows and forms a level surface", "keeps the same measured volume when transferred"],
  ["syrup", "virtual syrup sample", "liquid", "changes shape with the container", "flows slowly and forms a continuous surface", "keeps the same measured volume when transferred"],
  ["soap", "virtual liquid-soap sample", "liquid", "takes the container's shape", "flows slowly as one continuous material", "keeps the same measured volume when transferred"],
  ["air", "air in a sealed flexible bag", "gas", "has no fixed shape", "spreads through the available bag", "takes up space and resists being squeezed"],
  ["carbon-dioxide", "carbon dioxide in a sealed model container", "gas", "takes the container's shape", "spreads through the available space", "takes up space and has measurable mass in the model"],
  ["water-vapour", "water vapour in a closed virtual chamber", "gas", "has no fixed shape", "spreads through the chamber", "occupies the available space even though it is not visible"],
  ["helium", "helium in a sealed model balloon", "gas", "takes the balloon's shape", "spreads through the available balloon", "takes up space and contributes mass"],
].map(([id, sample, state, shape, flow, space]) => ({ id, sample, state, shape, flow, space }));

const changes = [
  ["ice-melt", "water", "solid ice", "liquid water", "heating", "melting", "freezing"],
  ["water-freeze", "water", "liquid water", "solid ice", "cooling", "freezing", "melting"],
  ["puddle-evaporate", "water", "liquid water", "water vapour", "heating from the surroundings", "evaporation", "condensation"],
  ["vapour-condense", "water", "water vapour", "liquid water", "cooling", "condensation", "evaporation"],
  ["wax-melt", "wax sample", "solid wax", "liquid wax", "heating in a virtual model", "melting", "freezing"],
  ["wax-freeze", "wax sample", "liquid wax", "solid wax", "cooling in a virtual model", "freezing", "melting"],
  ["chocolate-melt", "chocolate sample", "solid chocolate", "liquid chocolate", "heating in a virtual model", "melting", "freezing"],
  ["chocolate-freeze", "chocolate sample", "liquid chocolate", "solid chocolate", "cooling in a virtual model", "freezing", "melting"],
  ["butter-melt", "butter sample", "solid butter", "liquid butter", "heating in a virtual model", "melting", "freezing"],
  ["butter-freeze", "butter sample", "liquid butter", "solid butter", "cooling in a virtual model", "freezing", "melting"],
  ["fruit-ice-melt", "fruit-ice sample", "solid fruit ice", "liquid fruit mixture", "heating in a virtual model", "melting", "freezing"],
  ["droplet-freeze", "water", "liquid water droplet", "solid ice", "cooling in a virtual model", "freezing", "melting"],
].map(([id, material, start, end, direction, change, reverse]) => ({ id, material, start, end, direction, change, reverse }));

const temperatureCases = [
  tempCase("water-warm-a", "water sample A", [[-5, "solid"], [0, "solid and liquid observed"], [5, "liquid"]], "heating", "melting"),
  tempCase("water-cool-a", "water sample B", [[5, "liquid"], [0, "liquid and solid observed"], [-5, "solid"]], "cooling", "freezing"),
  tempCase("wax-warm", "wax sample A", [[40, "solid"], [50, "solid and liquid observed"], [60, "liquid"]], "heating", "melting"),
  tempCase("wax-cool", "wax sample B", [[60, "liquid"], [50, "liquid and solid observed"], [40, "solid"]], "cooling", "freezing"),
  tempCase("chocolate-warm", "chocolate sample A", [[20, "solid"], [30, "soft solid and liquid observed"], [40, "liquid"]], "heating", "melting"),
  tempCase("chocolate-cool", "chocolate sample B", [[40, "liquid"], [30, "liquid and soft solid observed"], [20, "solid"]], "cooling", "freezing"),
  tempCase("butter-warm", "butter sample A", [[10, "solid"], [25, "soft solid and liquid observed"], [35, "liquid"]], "heating", "melting"),
  tempCase("butter-cool", "butter sample B", [[35, "liquid"], [25, "liquid and soft solid observed"], [10, "solid"]], "cooling", "freezing"),
  tempCase("fruit-ice-warm", "fruit-ice sample A", [[-8, "solid"], [-1, "solid and liquid observed"], [4, "liquid"]], "heating", "melting"),
  tempCase("fruit-ice-cool", "fruit-ice sample B", [[4, "liquid"], [-1, "liquid and solid observed"], [-8, "solid"]], "cooling", "freezing"),
  tempCase("water-warm-b", "water sample C", [[-2, "solid"], [0, "solid and liquid observed"], [3, "liquid"]], "heating", "melting"),
  tempCase("water-cool-b", "water sample D", [[3, "liquid"], [0, "liquid and solid observed"], [-2, "solid"]], "cooling", "freezing"),
];

const processScenarios = [
  scenario("puddle", "A shallow puddle becomes smaller on a warm, breezy day; the ground beneath is waterproof.", "evaporation", "liquid water changes into water vapour at the surface", "moves water from the ground into the air"),
  scenario("washing", "Wet washing loses water while hanging outside without ever boiling.", "evaporation", "liquid water changes into water vapour from the fabric surface", "returns water from wet materials to the air"),
  scenario("wide-tray", "Equal water volumes are placed in a wide tray and a narrow jar; the wide tray loses water faster.", "evaporation", "a larger exposed surface allows faster evaporation in this test", "moves liquid water into the air"),
  scenario("covered-tray", "Equal trays are kept together; the uncovered tray loses more water than the covered tray.", "evaporation", "more water vapour can leave the uncovered surface", "adds water vapour to the air"),
  scenario("cold-can", "Droplets form outside a sealed cold can while the card beneath starts dry.", "condensation", "water vapour in the air cools and changes into liquid on the surface", "moves water from the air onto a cool surface"),
  scenario("bathroom-mirror", "Droplets appear on a cool mirror after warm water adds water vapour to the room.", "condensation", "water vapour cools at the mirror and becomes liquid", "returns water vapour to liquid water"),
  scenario("window", "Small droplets form on the cool inside surface of a sealed window.", "condensation", "water vapour in the indoor air cools into liquid droplets", "shows water moving from air to a surface"),
  scenario("cloud", "Moist air rises, cools and tiny liquid droplets form in a cloud model.", "condensation", "cooling water vapour changes it into tiny liquid droplets", "helps form clouds in the water cycle"),
  scenario("rain-cycle", "Cloud droplets join, become heavier and fall in the model water cycle.", "water cycle", "condensation forms droplets that can later fall as precipitation", "links condensation with precipitation"),
  scenario("dew", "Overnight, droplets form on cool grass even though no rain falls.", "condensation", "water vapour in the air cools into liquid on the grass", "returns atmospheric water to surfaces"),
  scenario("lid", "Droplets collect on the cool inside lid of a sealed water-cycle model.", "condensation", "water vapour cools at the lid and becomes liquid", "models cloud droplet formation and return"),
  scenario("sun-cycle", "Sunlight warms model seawater; its level lowers and droplets later form on a cool cover.", "water cycle", "evaporation is followed by condensation on the cooler cover", "links two state changes in a repeating water journey"),
];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y4-states-of-matter") throw new Error("This generator only supports the Year 4 states-of-matter pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedAllocation = countBy(curated, curatedBlueprint);
const targets = Object.fromEntries(Object.entries(pilotAllocation).map(([id, total]) => [id, total - (curatedAllocation[id] ?? 0)]));
for (const [blueprint, count] of Object.entries(targets)) if (count < 0) throw new Error(`Curated variants exceed ${blueprint}.`);

const candidates = [
  ...classificationCandidates(targets["observable-property-classification"]),
  ...changeCandidates(targets["heating-and-cooling-paths"]),
  ...temperatureCandidates(targets["temperature-observation-records"]),
  ...processCandidates(targets["evaporation-condensation-evidence"]),
  ...reviewCandidates(targets["state-properties-spaced-review"]),
];

pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Review-stage Year 4 states-of-matter pack with a deterministic 240-item pilot bank and four preserved curated variants. The progression uses observable, age-appropriate properties without microscopic models to classify solids, liquids and gases; explain melting, freezing, evaporation and condensation; connect the water cycle; interpret temperature evidence; plan fair tests; and repair misconceptions. Generated candidates include SEND multimodal and sensory-safe routes, supported interactions, investigation feedback and untimed missions. Independent science, teacher, accessibility, safeguarding and renderer review remain required before promotion.";
validateBank(pack, curated, candidates);

console.log(`y4-states-matter-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`y4-states-matter-bank blueprints=${allocationSummary(curated, candidates)}`);
console.log(`y4-states-matter-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y4-states-matter-bank bands=${summary(candidates, (variant) => variant.body.difficulty_band)}`);
console.log(`y4-states-matter-bank coverage=${coverageSummary(candidates)}`);

const nextText = `${JSON.stringify(pack, null, 2)}\n`;
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y4-states-matter-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 4 states-of-matter bank is out of date; run generate-y4-states-matter-bank.mjs --write.");
  console.log("y4-states-matter-bank deterministic check passed");
} else {
  console.log("y4-states-matter-bank dry-run; pass --write to update the pack");
}

function classificationCandidates(count) {
  const variants = [];
  for (const item of materials) {
    const classAnswer = `${item.sample} is classified as a ${item.state}`;
    const evidenceAnswer = item.state === "solid" ? item.shape : item.state === "liquid" ? `${item.flow} and ${item.space}` : `${item.flow} and ${item.space}`;
    const otherStates = ["solid", "liquid", "gas"].filter((state) => state !== item.state);
    variants.push(makeVariant({ id: `classify-${item.id}`, format: "property-sort", blueprint: "observable-property-classification", strand: "classification", stage: "classify_from_observable_properties", prompt: `Property tests show that ${item.sample} ${item.shape}, ${item.flow}, and ${item.space}. How should it be classified?`, answer: classAnswer, choices: [classAnswer, `${item.sample} is classified as a ${otherStates[0]}`, `${item.sample} is classified as a ${otherStates[1]}`, "There is not enough evidence because only hardness matters"], hints: ["Use shape, flow and container behaviour.", "Do not classify by one everyday word such as soft or pourable."], explanation: `The observations fit a ${item.state}: it ${evidenceAnswer}.`, purpose: "observable_state_classification", misconception: item.id === "sand" || item.id === "rice" ? "pourable_means_liquid" : "appearance_only_classification", body: { sample: item.sample, observations: [item.shape, item.flow, item.space], correct_state: item.state } }));
    variants.push(makeVariant({ id: `evidence-${item.id}`, format: "property-sort", blueprint: "observable-property-classification", strand: "properties", stage: "select_classification_evidence", prompt: `Which observation is most useful evidence for classifying ${item.sample} as ${item.state}?`, answer: evidenceAnswer, choices: [evidenceAnswer, "its label is easy to read", "the sample appears in a coloured container", "the sample has a familiar name"], hints: ["Choose an observable state property.", "Labels and colours do not decide state."], explanation: `'${evidenceAnswer}' describes how the sample behaves, so it is relevant classification evidence.`, purpose: "property_evidence_selection", misconception: "appearance_only_classification", body: { sample: item.sample, observations: [item.shape, item.flow, item.space], correct_state: item.state } }));
    variants.push(makeVariant({ id: `compare-${item.id}`, format: "property-sort", blueprint: "observable-property-classification", strand: item.state === "gas" ? "gases" : item.state === "liquid" ? "liquids" : "solids", stage: "compare_state_properties", prompt: `Which statement accurately describes ${item.sample}?`, answer: evidenceAnswer, choices: [evidenceAnswer, "it has no mass and takes up no space", "it must be a liquid because it can be moved", "it becomes a new material when transferred"], hints: ["Use only the stated tests.", "State is about observable behaviour, not whether a sample can be moved."], explanation: `The accurate description combines the observed shape, flow or space evidence without adding an unsupported claim.`, purpose: "state_property_comparison", misconception: item.state === "gas" ? "gas_has_no_mass_or_space" : "movement_decides_state", body: { sample: item.sample, observations: [item.shape, item.flow, item.space], correct_state: item.state } }));
    variants.push(makeVariant({ id: `repair-${item.id}`, format: "property-sort", blueprint: "observable-property-classification", strand: "misconceptions", stage: "repair_state_classification_misconception", prompt: `A learner classifies ${item.sample} using only the claim 'it can be poured or moved'. Which repair is best?`, answer: "Use shape, flow and occupation of space together before classifying", choices: ["Use shape, flow and occupation of space together before classifying", "Anything pourable is automatically liquid", "Anything soft is automatically gas", "Ignore observations and use the sample name"], hints: ["One action is not enough evidence.", "Compare the full property-test record."], explanation: "A reliable classification uses several observable properties together and handles tricky samples such as grains, thick liquids and gases.", purpose: "classification_misconception_repair", misconception: "pourable_means_liquid", body: { sample: item.sample, observations: [item.shape, item.flow, item.space], correct_state: item.state } }));
  }
  return variants.slice(0, count);
}

function changeCandidates(count) {
  const variants = [];
  for (const item of changes) {
    variants.push(makeVariant({ id: `change-${item.id}`, format: "state-change-model", blueprint: "heating-and-cooling-paths", strand: item.change, stage: "name_state_change", prompt: `${capitalise(item.start)} becomes ${item.end} during ${item.direction}. What is the change called?`, answer: item.change, choices: [item.change, item.reverse, item.change === "melting" ? "evaporation" : item.change === "freezing" ? "condensation" : "melting", "dissolving"], hints: [`Identify the start and end states.`, `${item.direction} gives the direction of the change.`], explanation: `${capitalise(item.change)} is the change from ${item.start} to ${item.end} in this ${item.material} model.`, purpose: "state_change_naming", misconception: "state_change_name_confusion", body: { material: item.material, start_state_description: item.start, end_state_description: item.end, temperature_direction: item.direction, change: item.change } }));
    variants.push(makeVariant({ id: `direction-${item.id}`, format: "state-change-model", blueprint: "heating-and-cooling-paths", strand: "heating_cooling", stage: "connect_temperature_direction", prompt: `Which temperature direction causes the model change from ${item.start} to ${item.end}?`, answer: item.direction, choices: [item.direction, item.direction.includes("heating") ? "cooling" : "heating", "no temperature change", "changing the label only"], hints: ["Compare the starting and ending state.", `The named change is ${item.change}.`], explanation: `${capitalise(item.direction)} is the stated direction that produces ${item.change} in this model.`, purpose: "temperature_direction_state_change", misconception: "heating_cooling_reversed", body: { material: item.material, start_state_description: item.start, end_state_description: item.end, temperature_direction: item.direction, change: item.change } }));
    variants.push(makeVariant({ id: `continuity-${item.id}`, format: "state-change-model", blueprint: "heating-and-cooling-paths", strand: "material_continuity", stage: "preserve_material_identity", prompt: `After ${item.change} changes ${item.start} into ${item.end}, which statement is accurate?`, answer: `It is still ${item.material}; its state changed`, choices: [`It is still ${item.material}; its state changed`, "A completely new material was created", "The material disappeared", "Its name must change because its shape changed"], hints: ["Track the material name before and after.", "A state change changes form, not identity."], explanation: `${capitalise(item.material)} remains the same material through this reversible model; only its state changes.`, purpose: "same_material_state_change", misconception: "new_substance_after_melting", body: { material: item.material, change: item.change, same_material: true } }));
    variants.push(makeVariant({ id: `reverse-${item.id}`, format: "state-change-model", blueprint: "heating-and-cooling-paths", strand: "reversible_changes", stage: "identify_reverse_change", prompt: `Which change returns ${item.material} from ${item.end} to ${item.start}, reversing ${item.change}?`, answer: item.reverse, choices: [item.reverse, item.change, "dissolving", "burning"], hints: ["Reverse the start and end states.", "Reverse the heating or cooling direction."], explanation: `${capitalise(item.reverse)} reverses ${item.change} by returning the same material from ${item.end} to ${item.start}.`, purpose: "reverse_state_change", misconception: "state_change_not_reversible", body: { material: item.material, forward_change: item.change, reverse_change: item.reverse, same_material: true } }));
  }
  return variants.slice(0, count);
}

function temperatureCandidates(count) {
  const variants = [];
  for (const item of temperatureCases) {
    const middle = item.rows[1];
    const interval = `${Math.min(item.rows[0].temperature_c, item.rows[2].temperature_c)}°C to ${Math.max(item.rows[0].temperature_c, item.rows[2].temperature_c)}°C, with mixed-state evidence at ${middle.temperature_c}°C`;
    variants.push(makeVariant({ id: `temperature-read-${item.id}`, format: "temperature-table", blueprint: "temperature-observation-records", strand: "temperature_evidence", stage: "read_temperature_observation", prompt: `According to the ${item.material} table, what was observed at ${middle.temperature_c}°C?`, answer: middle.observation, choices: [middle.observation, item.rows[0].observation, item.rows[2].observation, "no observation was recorded"], hints: ["Find the row with the named temperature.", "Read across to the observation column."], explanation: `The ${middle.temperature_c}°C row records '${middle.observation}', so that is the evidence from the table.`, purpose: "temperature_table_reading", misconception: "ignores_temperature_evidence", body: { material: item.material, temperature_direction: item.direction, temperature_table: item.rows, change: item.change } }));
    variants.push(makeVariant({ id: `temperature-change-${item.id}`, format: "temperature-table", blueprint: "temperature-observation-records", strand: "temperature_evidence", stage: "infer_change_from_ordered_observations", prompt: `The ${item.material} observations progress during ${item.direction}. Which change is supported?`, answer: item.change, choices: [item.change, item.change === "melting" ? "freezing" : "melting", "evaporation", "no state change"], hints: ["Read the rows in the investigation order.", "Compare the first and final states."], explanation: `The observations move from ${item.rows[0].observation} to ${item.rows[2].observation}, supporting ${item.change}.`, purpose: "temperature_change_inference", misconception: "heating_cooling_reversed", body: { material: item.material, temperature_direction: item.direction, temperature_table: item.rows, change: item.change } }));
    variants.push(makeVariant({ id: `temperature-interval-${item.id}`, format: "temperature-table", blueprint: "temperature-observation-records", strand: "reasoning", stage: "make_cautious_temperature_conclusion", prompt: `Which conclusion matches the resolution of the ${item.material} observations?`, answer: interval, choices: [interval, `The exact change temperature is proved to be ${item.rows[0].temperature_c}°C`, "Temperature has no connection with the observations", "Every material changes at the same temperature"], hints: ["Use the full observed interval.", "Do not claim more precision than the table provides."], explanation: `The coarse table shows the state change across an interval and mixed-state evidence at ${middle.temperature_c}°C; it does not establish an exact universal value.`, purpose: "cautious_temperature_interval", misconception: "false_temperature_precision", body: { material: item.material, temperature_direction: item.direction, temperature_table: item.rows, observed_interval: [item.rows[0].temperature_c, item.rows[2].temperature_c] } }));
    variants.push(makeVariant({ id: `temperature-fair-${item.id}`, format: "temperature-table", blueprint: "temperature-observation-records", strand: "fair_tests", stage: "plan_fair_temperature_test", prompt: `Which plan fairly tests how temperature affects the state of ${item.material}?`, answer: "Keep the sample amount, container and observation method fixed; change only temperature", choices: ["Keep the sample amount, container and observation method fixed; change only temperature", "Change the material and temperature together", "Use different amounts and containers at every reading", "Estimate temperature without a thermometer or supplied data"], hints: ["A fair test changes one variable.", "Keep the sample and observation method controlled."], explanation: `Changing only temperature allows differences in the recorded state of ${item.material} to be linked to temperature.`, purpose: "temperature_fair_test", misconception: "multiple_variables_changed", body: { material: item.material, changed_variable: "temperature", controlled_variables: ["sample amount", "container", "observation method"], temperature_table: item.rows } }));
  }
  return variants.slice(0, count);
}

function processCandidates(count) {
  const variants = [];
  for (const item of processScenarios) {
    variants.push(makeVariant({ id: `process-${item.id}`, format: "evidence-explain", blueprint: "evaporation-condensation-evidence", strand: processStrand(item.process), stage: "explain_everyday_state_change", prompt: `${item.description} Which explanation best fits?`, answer: item.explanation, choices: [item.explanation, "the water was destroyed", "the surface leaked without evidence", "evaporation and boiling are always identical"], hints: ["Use the observed temperature and surfaces.", "Name the state change without saying the water vanished."], explanation: `${capitalise(item.explanation)}. This accounts for the observations while keeping the material as water.`, purpose: "everyday_process_evidence", misconception: item.process === "evaporation" ? "evaporation_equals_boiling" : "condensation_is_leaking", body: { scenario: item.description, process: item.process, water_cycle_link: item.cycleLink } }));
    variants.push(makeVariant({ id: `misconception-${item.id}`, format: "evidence-explain", blueprint: "evaporation-condensation-evidence", strand: "misconceptions", stage: "repair_process_misconception", prompt: `Which statement avoids the 'water vanished or leaked' misconception in this scenario: ${item.description}`, answer: `The water changed state or location through ${item.process}; the observations do not show destruction`, choices: [`The water changed state or location through ${item.process}; the observations do not show destruction`, "Invisible water no longer exists", "Every droplet must have leaked through a solid surface", "All liquid-to-gas change requires boiling"], hints: ["Track where the water is before and after.", "Use the named process and the evidence."], explanation: `The evidence supports a change of state or location through ${item.process}, not destruction or an unsupported leak.`, purpose: "process_misconception_repair", misconception: item.process === "evaporation" ? "water_disappears" : "condensation_is_leaking", body: { scenario: item.description, process: item.process, water_cycle_link: item.cycleLink } }));
    variants.push(makeVariant({ id: `cycle-${item.id}`, format: "evidence-explain", blueprint: "evaporation-condensation-evidence", strand: "water_cycle", stage: "connect_process_to_water_cycle", prompt: `How does this observation connect to the water cycle? ${item.description}`, answer: item.cycleLink, choices: [item.cycleLink, "it proves water is destroyed after one change", "it shows state changes cannot reverse", "it removes water permanently from the cycle"], hints: ["Name where the water moves next.", "Use evaporation, condensation or precipitation as appropriate."], explanation: `${capitalise(item.cycleLink)}; the water cycle links changes of state and movement without the water ceasing to exist.`, purpose: "water_cycle_process_link", misconception: "water_cycle_destroys_water", body: { scenario: item.description, process: item.process, water_cycle_link: item.cycleLink } }));
    variants.push(makeVariant({ id: `fair-${item.id}`, format: "evidence-explain", blueprint: "evaporation-condensation-evidence", strand: "fair_tests", stage: "plan_fair_process_comparison", prompt: `For '${item.description}', which plan would fairly test one factor in the ${item.process} scenario?`, answer: "Use equal water amounts and matching containers; change one factor and record the same observation each time", choices: ["Use equal water amounts and matching containers; change one factor and record the same observation each time", "Change temperature, surface area and airflow together", "Use different water amounts without measuring", "Rely on touch, taste or smell instead of recorded evidence"], hints: ["Choose one independent variable.", "Keep amounts, containers and measuring method controlled."], explanation: "A one-variable comparison makes the observation interpretable and avoids unsafe or subjective sensory testing.", purpose: "process_fair_test", misconception: "multiple_variables_changed", body: { scenario: item.description, process: item.process, changed_variable: "one selected factor", controlled_variables: ["water amount", "container type", "observation method"] } }));
  }
  return variants.slice(0, count);
}

function reviewCandidates(count) {
  const variants = [];
  for (let index = 0; index < 12; index += 1) {
    const material = materials[index]; const change = changes[index]; const temp = temperatureCases[index]; const process = processScenarios[index];
    variants.push(makeVariant({ id: `review-state-${material.id}`, format: "property-sort", blueprint: "state-properties-spaced-review", strand: "classification", stage: "spaced_state_classification", prompt: `Review file: ${material.sample} ${material.shape} and ${material.flow}. Which state fits?`, answer: material.state, choices: [material.state, ...["solid", "liquid", "gas"].filter((value) => value !== material.state), "cannot classify from any observation"], hints: ["Use shape and flow together.", "Do not use pourability alone."], explanation: `The recorded properties match the observable behaviour of a ${material.state}.`, purpose: "spaced_state_classification", misconception: "appearance_only_classification", body: { sample: material.sample, observations: [material.shape, material.flow, material.space], review_interval_days: [1, 3, 7, 14, 30][index % 5] } }));
    variants.push(makeVariant({ id: `review-change-${change.id}`, format: "property-sort", blueprint: "state-properties-spaced-review", strand: change.change, stage: "spaced_change_name", prompt: `Review file: ${change.start} becomes ${change.end}. Name the change.`, answer: change.change, choices: [change.change, change.reverse, "dissolving", "no change"], hints: ["Identify the start and end states.", `The temperature direction is ${change.direction}.`], explanation: `${capitalise(change.change)} names the change from ${change.start} to ${change.end}, while ${change.material} remains the same material.`, purpose: "spaced_change_vocabulary", misconception: "state_change_name_confusion", body: { material: change.material, start_state_description: change.start, end_state_description: change.end, temperature_direction: change.direction, review_interval_days: [1, 3, 7, 14, 30][(index + 1) % 5] } }));
    variants.push(makeVariant({ id: `review-temperature-${temp.id}`, format: "property-sort", blueprint: "state-properties-spaced-review", strand: "temperature_evidence", stage: "spaced_temperature_evidence", prompt: `Review file: which evidence best supports ${temp.change} in ${temp.material}?`, answer: `The observations change from '${temp.rows[0].observation}' to '${temp.rows[2].observation}' as temperature changes`, choices: [`The observations change from '${temp.rows[0].observation}' to '${temp.rows[2].observation}' as temperature changes`, "the sample has a familiar name", "every material changes at the same temperature", "one temperature was guessed without observation"], hints: ["Compare the first and final table rows.", "Use temperature and state evidence together."], explanation: `The ordered observations link the temperature direction with the state change, providing stronger evidence than a label or guess.`, purpose: "spaced_temperature_reasoning", misconception: "ignores_temperature_evidence", body: { material: temp.material, temperature_table: temp.rows, review_interval_days: [1, 3, 7, 14, 30][(index + 2) % 5] } }));
    variants.push(makeVariant({ id: `review-process-${process.id}`, format: "property-sort", blueprint: "state-properties-spaced-review", strand: processStrand(process.process), stage: "spaced_process_evidence", prompt: `Review file: ${process.description} Which process or link fits?`, answer: process.explanation, choices: [process.explanation, "water was destroyed", "a leak is proven without evidence", "all state changes are boiling"], hints: ["Track the water before and after.", "Use the evidence to distinguish evaporation and condensation."], explanation: `${capitalise(process.explanation)}; this keeps the explanation tied to the observable scenario.`, purpose: "spaced_process_reasoning", misconception: "water_disappears_or_leaks", body: { scenario: process.description, process: process.process, review_interval_days: [1, 3, 7, 14, 30][(index + 3) % 5] } }));
  }
  return variants.slice(0, count);
}

function makeVariant({ id, format, blueprint, strand, stage, prompt, answer, choices, hints, explanation, purpose, misconception, body }) {
  const fullId = `${prefix}${id}`;
  const band = bandFor(blueprint, stage);
  return {
    id: fullId,
    format,
    body: {
      prompt,
      choices: rotate(unique(choices), fullId.length % choices.length),
      ...body,
      science_strand: strand,
      coverage_tags: coverageFor(strand, stage),
      model_level: "observable_properties_and_state_changes_only",
      conceptual_progression: stage,
      difficulty_band: band,
      evidence_purpose: purpose,
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
      response_mode: "tap_keyboard_switch_table_numeric_or_partner_recorded",
      interaction_support: { keyboard: true, switch_scan: true, touch: true, table_navigation: true, numeric_entry: true, partner_recording: true, drag_required: false, undo_available: true },
      send_routes: {
        visual: "static before-and-after state cards, patterned containers and labelled temperature tables",
        tactile: "adult-prepared room-temperature solid tokens, empty container shapes and state/change symbol cards; no hot, cold or wet contact required",
        text: "linear property record, temperature table and named start-change-end sequence",
        sensory_safe: "no tasting, smelling, splashing, forced touching, rapid vapour effects or real heating/cooling task",
      },
      reduced_visual_load: true,
      reduced_motion_alternative: "discrete still states and instant table updates with no swirling, dripping or flashing animation",
      investigation_safety: "Use virtual models or adult-provided data only; never taste samples, handle hot materials, touch unknown substances or rely on smell.",
      feedback_mode: "retain the valid observation, identify the changed variable and revise only the unsupported classification or process claim",
      mission: missionFor(strand, stage, fullId),
      pressure_rules: { timer: false, speed_score: false, streak_loss: false, lives: false, public_ranking: false, retry_cost: false },
    },
    expected_answer: { value: answer },
    hints,
    explanation,
    feedback: { correct: `Investigation record secured: ${purpose.replaceAll("_", " ")}.`, repair: repairFor(strand, stage), evidence_check: "Name the observation, temperature direction or controlled variable that supports the conclusion.", safety_reminder: "Use the visual, tactile-symbol or text route; no direct sensory exposure is required.", retry: "The observatory keeps every useful observation. Revise one claim without a timer or penalty." },
    difficulty: difficultyFor(band),
    status: "review",
    misconception_tag: misconception,
    animation_hook: animationFor(strand),
  };
}

function missionFor(strand, stage, id) {
  const stations = { classification: "Three-State Sorting Deck", properties: "Observable Properties Bench", solids: "Solid Survey Vault", liquids: "Liquid Flow Gallery", gases: "Gas Space Chamber", misconceptions: "Matter Myth Repair Bay", melting: "Melting Route", freezing: "Freezing Route", evaporation: "Evaporation Terrace", condensation: "Condensation Canopy", heating_cooling: "Heat–Cool Control", material_continuity: "Material Identity Archive", reversible_changes: "Reversible Path Loop", temperature_evidence: "Celsius Evidence Tower", reasoning: "Cautious Conclusion Desk", fair_tests: "Variable-Lock Lab", water_cycle: "Water Journey Observatory" };
  const tools = { classification: "compare shape, flow and occupied space", properties: "select an observation rather than an appearance", solids: "check whether each piece keeps its shape", liquids: "check flow, container shape and measured volume", gases: "check spreading, occupied space and compression evidence", misconceptions: "replace the shortcut with the full evidence record", melting: "trace solid → liquid with heating", freezing: "trace liquid → solid with cooling", evaporation: "track liquid water changing at a surface", condensation: "track water vapour cooling into liquid", heating_cooling: "connect direction of temperature change with the observed states", material_continuity: "keep the material name fixed while the state changes", reversible_changes: "reverse both the state path and temperature direction", temperature_evidence: "read temperature and observation from the same row", reasoning: "state only the precision supported by the table", fair_tests: "change one variable and lock the controls", water_cycle: "link evaporation, condensation and water movement" };
  return { campaign: "Climate Archive: Restore the Three-State Observatory", station: stations[strand], mission_code: id.slice(-30), objective: `Complete the ${stage.replaceAll("_", " ")} investigation using observable evidence.`, strategic_tool: tools[strand], investigation_protocol: ["observe without direct sensory exposure", "record state and temperature", "change one variable", "make a bounded evidence claim"], reward: { item: "climate archive lens", earned_for: "using a safe evidence strategy or completing a repair", effect: "restores an observatory route without adding speed, sensory load or difficulty" }, retry_protocol: "No lives, samples or progress are lost; valid observations stay recorded while a targeted evidence card opens." };
}

function validateBank(packData, curatedItems, generated) {
  const pilot = packData.practice.variant_targets.pilot;
  if (curatedItems.length !== 4) throw new Error(`Expected four curated variants, found ${curatedItems.length}.`);
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
    if (variant.body.choices.filter((choice) => choice === variant.expected_answer.value).length !== 1) throw new Error(`${variant.id} must contain its answer exactly once.`);
    if (/particle/i.test(JSON.stringify(variant))) throw new Error(`${variant.id} introduces a microscopic model.`);
    if (!variant.body.interaction_support?.keyboard || !variant.body.interaction_support?.switch_scan || variant.body.interaction_support?.drag_required !== false) throw new Error(`${variant.id} lacks supported interactions.`);
    if (!variant.body.send_routes?.visual || !variant.body.send_routes?.tactile || !variant.body.send_routes?.text || !variant.body.send_routes?.sensory_safe || variant.body.reduced_visual_load !== true) throw new Error(`${variant.id} lacks SEND sensory-safe routes.`);
    if (!/virtual models or adult-provided data/.test(variant.body.investigation_safety) || !/never taste/.test(variant.body.investigation_safety)) throw new Error(`${variant.id} lacks investigation safety.`);
    if (Object.values(variant.body.pressure_rules).some((value) => value !== false) || !/No lives/.test(variant.body.mission?.retry_protocol) || !variant.body.mission?.strategic_tool) throw new Error(`${variant.id} lacks low-pressure investigation missions.`);
    if (!variant.feedback?.repair || !variant.feedback?.evidence_check || !variant.feedback?.safety_reminder || !variant.feedback?.retry || variant.hints.length < 2 || variant.explanation.length < 60) throw new Error(`${variant.id} lacks rich feedback.`);
    validateScienceData(variant);
    for (const tag of variant.body.coverage_tags) coverage.add(tag);
    formats.add(variant.format); blueprints.add(variant.body.variant_blueprint_id); bands.add(variant.body.difficulty_band);
  }
  const allocation = combinedAllocation(curatedItems, generated);
  for (const [blueprint, expected] of Object.entries(pilotAllocation)) if (allocation[blueprint] !== expected) throw new Error(`${blueprint} expected ${expected}, found ${allocation[blueprint] ?? 0}.`);
  assertCovered("formats", new Set(packData.practice.formats), formats);
  assertCovered("blueprints", new Set(blueprintMap.keys()), blueprints);
  assertCovered("difficulty bands", new Set([...packData.practice.difficulty_bands, ...packData.variant_blueprints.map((item) => item.difficulty_band)]), bands);
  assertCovered("states coverage", new Set(["solids", "liquids", "gases", "melting", "freezing", "evaporation", "condensation", "water_cycle", "temperature_evidence", "fair_tests", "misconceptions"]), coverage);
}

function validateScienceData(variant) {
  if (variant.body.temperature_table) {
    for (const row of variant.body.temperature_table) if (!Number.isFinite(row.temperature_c) || !row.observation) throw new Error(`${variant.id} has invalid temperature evidence.`);
  }
  if (variant.body.science_strand === "fair_tests" && !variant.body.controlled_variables) throw new Error(`${variant.id} lacks controlled variables.`);
  if (variant.body.same_material !== undefined && variant.body.same_material !== true) throw new Error(`${variant.id} breaks material continuity.`);
}

function tempCase(id, material, rows, direction, change) { return { id, material, rows: rows.map(([temperature_c, observation]) => ({ temperature_c, observation })), direction, change }; }
function scenario(id, description, process, explanation, cycleLink) { return { id, description, process, explanation, cycleLink }; }
function processStrand(process) { return process === "water cycle" ? "water_cycle" : process; }
function coverageFor(strand, stage) { const tags = new Set([strand]); if (strand === "classification") { tags.add("solids"); tags.add("liquids"); tags.add("gases"); } if (stage.includes("fair")) tags.add("fair_tests"); if (stage.includes("misconception") || strand === "misconceptions") tags.add("misconceptions"); return [...tags]; }
function bandFor(blueprint, stage) { if (blueprint === "observable-property-classification") return stage.includes("classify") ? "intro" : "developing"; if (blueprint === "heating-and-cooling-paths") return stage.includes("reverse") || stage.includes("preserve") ? "secure" : "expected"; if (blueprint === "temperature-observation-records") return stage.includes("cautious") || stage.includes("fair") ? "stretch" : "expected"; if (blueprint === "evaporation-condensation-evidence") return stage.includes("fair") || stage.includes("cycle") ? "stretch" : "secure"; return "retrieval"; }
function difficultyFor(band) { return { intro: 3, developing: 4, expected: 5, secure: 7, stretch: 8, retrieval: 5 }[band]; }
function repairFor(strand, stage) { if (strand === "fair_tests") return "Choose one changed variable, keep amount, container and observation method fixed, then compare the recorded evidence."; if (strand === "temperature_evidence" || strand === "reasoning") return "Read temperature and observation from the same row, then make only the precision supported by the interval."; if (strand === "misconceptions") return "Track the material before and after, then replace the shortcut with shape, flow, space or state-change evidence."; if (strand === "water_cycle") return "Place evaporation before water enters the air and condensation before liquid droplets form."; if (["melting", "freezing", "evaporation", "condensation"].includes(strand)) return "Name the start state, temperature direction and end state before choosing the process."; return "Use all three observable property tests and avoid deciding from pourability, softness or visibility alone."; }
function animationFor(strand) { return ({ classification: "state-property-compare", properties: "property-evidence-focus", solids: "solid-shape-check", liquids: "liquid-flow-check", gases: "gas-space-model", misconceptions: "state-misconception-repair", melting: "solid-liquid-heat-arrow", freezing: "liquid-solid-cool-arrow", evaporation: "evaporation-evidence-trace", condensation: "condensation-source-reveal", heating_cooling: "temperature-state-linked", material_continuity: "same-material-state-track", reversible_changes: "state-change-reverse", temperature_evidence: "celsius-table-focus", reasoning: "evidence-interval-bracket", fair_tests: "state-variable-lock", water_cycle: "water-cycle-route" })[strand]; }
function curatedBlueprint(variant) { const map = { "sc-y4-states-of-matter-q-sand": "observable-property-classification", "sc-y4-states-of-matter-q-ice-heating": "heating-and-cooling-paths", "sc-y4-states-of-matter-q-evaporation": "evaporation-condensation-evidence", "sc-y4-states-of-matter-q-condensation": "evaporation-condensation-evidence" }; const value = map[variant.id]; if (!value) throw new Error(`No curated blueprint assignment for ${variant.id}.`); return value; }
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
