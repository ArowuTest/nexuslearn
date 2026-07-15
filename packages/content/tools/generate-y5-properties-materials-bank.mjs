#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/sc-y5-properties-of-materials.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y5-properties-of-materials-bank-";
const pilotTarget = 240;
const reviewBatch = "y5-properties-materials-pilot-a";

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y5-properties-of-materials") throw new Error("This generator only supports the Year 5 properties-of-materials pack.");
const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 4) throw new Error(`Expected exactly 4 curated variants, found ${curated.length}.`);
const curatedSnapshot = JSON.stringify(curated);

const propertyCases = [
  { key: "cable-core", brief: "an electrical cable core", results: { copper: ["good electrical conductor", "flexible as a wire", "not magnetic in this test"], rubber: ["electrical insulator", "flexible", "water resistant"], glass: ["electrical insulator", "transparent", "brittle"] }, answer: "Choose copper because its tested electrical conductivity and wire flexibility match the cable-core purpose.", wrong: ["Choose rubber because every cable part must conduct.", "Choose glass because transparency proves conductivity.", "Copper is best for every purpose without further evidence."], properties: ["electrical conductivity", "flexibility"] },
  { key: "cable-cover", brief: "a flexible electrical cable covering", results: { rubber: ["electrical insulator", "flexible", "water resistant"], copper: ["good electrical conductor", "flexible as a wire"], steel: ["electrical conductor", "rigid in the sample"] }, answer: "Choose rubber because it is flexible and electrically insulating in the stated tests.", wrong: ["Choose copper because a covering should conduct electricity.", "Choose steel because magnetic materials are always safest.", "Any material works because coverings have no required properties."], properties: ["electrical insulation", "flexibility"] },
  { key: "pan-base", brief: "a pan base in a teacher-supervised heat model", results: { aluminium: ["good thermal conductor", "not magnetic in this test", "keeps shape"], wood: ["poor thermal conductor", "can char if overheated", "rigid"], acrylic: ["poor thermal conductor", "can soften with heat", "rigid when cool"] }, answer: "Choose aluminium because the test shows useful thermal conductivity and shape stability for this model.", wrong: ["Choose wood because poor conductivity heats food fastest.", "Choose acrylic because transparent means heat conducting.", "Aluminium is suitable for every object because it conducts heat."], properties: ["thermal conductivity", "shape stability"] },
  { key: "pan-handle", brief: "a pan-handle model kept away from direct flame", results: { wood: ["poor thermal conductor", "rigid", "opaque"], aluminium: ["good thermal conductor", "rigid"], copper: ["good thermal conductor", "rigid"] }, answer: "Choose wood because its low thermal conductivity reduces heat transfer along the handle in this comparison.", wrong: ["Choose copper because handles should transfer heat quickly.", "Choose aluminium because all metals stay cool.", "Choose wood because it is always safe at every temperature."], properties: ["thermal insulation", "rigidity"] },
  { key: "viewing-panel", brief: "a waterproof viewing panel", results: { acrylic: ["transparent", "water resistant", "rigid"], card: ["opaque", "absorbs water", "rigid when dry"], rubber: ["opaque", "water resistant", "flexible"] }, answer: "Choose acrylic because transparency, water resistance and rigidity all match the stated purpose.", wrong: ["Choose card because rigidity is the only relevant property.", "Choose rubber because waterproof always means transparent.", "Acrylic is best for every building purpose."], properties: ["transparency", "water resistance", "rigidity"] },
  { key: "magnetic-catch", brief: "the attracted part of a magnetic cupboard catch", results: { steel: ["attracted to the test magnet", "hard", "opaque"], aluminium: ["not attracted in this test", "rigid"], acrylic: ["not attracted", "rigid"] }, answer: "Choose steel because it was attracted by the magnet and remained rigid in the stated tests.", wrong: ["Choose aluminium because every metal is magnetic.", "Choose acrylic because transparency causes magnetism.", "Steel must be magnetic in every possible alloy and condition."], properties: ["magnetism", "rigidity"] },
  { key: "scratch-plate", brief: "a plate that should resist scratching by the tested tool", results: { ceramic: ["no scratch in this test", "rigid", "brittle if struck"], "soft plastic": ["deep scratch in this test", "flexible"], rubber: ["marked by the tool", "flexible"] }, answer: "Choose ceramic for scratch resistance in this test, while noting that brittleness may matter for impact use.", wrong: ["Choose ceramic because hardness and toughness mean exactly the same thing.", "Choose soft plastic because a deep scratch proves hardness.", "One scratch test proves ceramic suits every design."], properties: ["hardness", "brittleness limitation"] },
  { key: "fair-conductivity", brief: "a fair electrical-conductivity comparison using a low-voltage teacher-approved circuit", results: {}, answer: "Change only the material sample; keep sample dimensions, circuit, cell and contact arrangement the same, then record the same outcome measure.", wrong: ["Change the material and cell count together.", "Use different sample lengths and judge brightness by memory.", "Let learners connect unknown materials to mains electricity."], properties: ["fair test", "electrical conductivity"] },
  { key: "fair-hardness", brief: "a fair scratch-resistance comparison", results: {}, answer: "Use the same scratching tool, force, stroke length and sample thickness, changing only the material.", wrong: ["Use a different tool on every material.", "Change material and force together.", "Decide hardness from colour without testing."], properties: ["fair test", "hardness"] },
  { key: "fair-thermal", brief: "a safe virtual thermal-conductivity comparison", results: {}, answer: "Change only the material; keep dimensions, starting temperature, heat input, timing and sensor position the same.", wrong: ["Change material, thickness and heat input together.", "Touch heated samples to decide which feels hottest.", "Use an uncontrolled flame with no adult supervision."], properties: ["fair test", "thermal conductivity"] },
];

const dissolvingCases = [
  { key: "salt-remains", scenario: "Salt is stirred into room-temperature water until no crystals are visible; mass is unchanged in a closed model and salt is later recovered.", answer: "The salt dissolved and remains dispersed in the solution; recovery evidence shows it did not disappear.", wrong: ["The salt vanished because it cannot be seen.", "The salt melted even though no state-change evidence was recorded.", "Water changed permanently into salt."], rule: "dissolved_remains" },
  { key: "sugar-recovery", scenario: "Sugar dissolves in water in a controlled model. The water is then removed by supervised evaporation.", answer: "Evaporation removes the water and can recover sugar from the solution in this controlled model.", wrong: ["Filtration traps dissolved sugar as visible grains.", "A sieve separates individual dissolved particles.", "The sugar ceased to exist when it dissolved."], rule: "evaporate_solute" },
  { key: "sand-insoluble", scenario: "Equal spoonfuls of salt and sand are stirred separately in equal volumes of water; salt forms a clear solution but sand remains visible and settles.", answer: "Salt is soluble under these conditions; sand is insoluble and forms a mixture that can be filtered.", wrong: ["Both substances dissolved because both touched water.", "Sand melted and became a liquid.", "Salt can now be removed from its solution by ordinary filtration."], rule: "soluble_vs_insoluble" },
  { key: "rate-not-solubility", scenario: "Crushed sugar dissolves faster than a sugar cube in matched water, but equal final masses dissolve after enough time.", answer: "Smaller pieces increased the dissolving rate here; the evidence does not show a greater final solubility.", wrong: ["Crushing created more sugar.", "Faster dissolving always means more can dissolve.", "The cube was insoluble because it dissolved slowly."], rule: "rate_not_solubility" },
  { key: "temperature-test", scenario: "A class compares how much solute dissolves at two temperatures using equal water volumes and the same solute.", answer: "Temperature is the changed variable; water volume, solute, adding method and endpoint rule should be controlled.", wrong: ["Change temperature, water volume and solute together.", "Use different endpoint rules for each beaker.", "Taste each solution to compare it."], rule: "fair_solubility_temperature" },
  { key: "mass-closed", scenario: "Ten grams of salt are added to 100 grams of water in a sealed container; the salt dissolves.", answer: "The model predicts a total mass of 110 grams because dissolving redistributes the salt rather than removing matter.", wrong: ["The total becomes 100 grams because dissolved material has no mass.", "The total becomes 10 grams because water disappears.", "Mass cannot be discussed once a solution forms."], rule: "mass_conservation" },
  { key: "saturated", scenario: "More salt is added until some remains undissolved at the bottom despite continued stirring at the same temperature.", answer: "The solution cannot dissolve all the added salt under these conditions; the visible excess is undissolved solid.", wrong: ["The visible solid proves no salt dissolved.", "The water has become a solid.", "Stirring forever guarantees every amount will dissolve."], rule: "solubility_limit" },
  { key: "filter-solution", scenario: "A clear salt solution is poured through ordinary filter paper and no solid remains on the paper.", answer: "Ordinary filtration does not separate dissolved salt; recover it by removing water in a controlled evaporation model.", wrong: ["The salt is trapped invisibly on the filter paper.", "A larger sieve will catch dissolved salt.", "The result proves the salt disappeared."], rule: "filtration_not_solution" },
];

const separationCases = [
  { key: "gravel-sand", mixture: "dry gravel and sand", properties: "different particle sizes", answer: "Use a suitable sieve: sand passes through while larger gravel is retained.", wrong: ["Use evaporation although there is no liquid.", "Use a magnet although neither component is stated magnetic.", "Use filter paper on the dry mixture and expect particle-size grading."], methods: ["sieve"] },
  { key: "sand-water", mixture: "sand and water", properties: "sand is an insoluble solid with particles larger than filter pores", answer: "Filter the mixture: sand remains as residue and water passes through as filtrate.", wrong: ["Evaporate first even though the aim is to recover the water quickly.", "Use a magnet to attract water.", "Claim the sand dissolved because it is wet."], methods: ["filter"] },
  { key: "iron-sand", mixture: "iron filings and sand", properties: "iron is magnetic in the test; sand is not", answer: "Use a covered magnet to remove the iron filings from the sand.", wrong: ["Filter the dry mixture through paper.", "Dissolve both solids in water.", "Evaporate the sand."], methods: ["magnet"] },
  { key: "salt-solution", mixture: "salt dissolved in water", properties: "salt is dissolved and water can change state", answer: "Use controlled evaporation to remove water and recover salt; do not expect ordinary filtration to trap dissolved salt.", wrong: ["Filter out the dissolved salt.", "Use a sieve to catch salt particles in solution.", "Use a magnet because salt is always magnetic."], methods: ["evaporate"] },
  { key: "sand-salt", mixture: "sand and salt", properties: "salt is soluble in water; sand is insoluble", answer: "Add water to dissolve salt, filter out sand, then recover salt from the filtrate by controlled evaporation.", wrong: ["Filter the dry mixture once to separate salt from sand.", "Add water, then keep both salt and sand on the filter paper.", "Evaporate the dry mixture before using a property difference."], methods: ["dissolve", "filter", "evaporate"] },
  { key: "iron-sand-salt", mixture: "iron filings, sand and salt", properties: "iron is magnetic; salt is water-soluble; sand is insoluble", answer: "Remove iron with a magnet; dissolve salt in water; filter out sand; recover salt by controlled evaporation.", wrong: ["Filter the dry mixture once and recover all three components.", "Add water and claim dissolved salt stays with sand as residue.", "Evaporate first, then use no other method."], methods: ["magnet", "dissolve", "filter", "evaporate"] },
  { key: "gravel-iron-sand", mixture: "gravel, iron filings and sand", properties: "gravel is largest; iron is magnetic; sand is smaller and not magnetic", answer: "Sieve to remove gravel, then use a covered magnet to separate iron filings from sand.", wrong: ["Evaporate all three dry solids.", "Filter without adding liquid and expect all components in separate containers.", "Use only a magnet and claim gravel and sand are separated from each other."], methods: ["sieve", "magnet"] },
  { key: "muddy-water", mixture: "water and an insoluble fine solid allowed to settle", properties: "solid settles and does not dissolve", answer: "Careful decanting can remove much of the clear liquid, followed by filtration for finer solid particles.", wrong: ["A magnet always attracts mud.", "Evaporation is the only possible first step.", "The settled solid has dissolved."], methods: ["decant", "filter"] },
];

const changeCases = [
  { key: "ice", event: "Ice melts and the water is frozen again.", answer: "reversible: the change of state can recover solid water", wrong: ["irreversible because liquid looks different", "irreversible because every temperature change forms a new material", "insufficient because melting can never be observed"], class: "reversible", evidence: "state is changed and recovered" },
  { key: "wax", event: "Wax melts in a controlled model and solidifies on cooling without burning.", answer: "reversible: melting and solidifying change state without evidence of a new material", wrong: ["irreversible because the shape changed", "irreversible because all heating is burning", "reversible because any heated material is always recoverable"], class: "reversible", evidence: "state change and recovery" },
  { key: "salt-solution", event: "Salt dissolves in water and salt is recovered after controlled water removal.", answer: "reversible: dissolving and recovery return the original solute", wrong: ["irreversible because salt became invisible", "irreversible because a solution is a new element", "reversible only because filtration catches dissolved salt"], class: "reversible", evidence: "solute recovery" },
  { key: "dry-mix", event: "Iron filings and sand are mixed, then the iron is recovered with a magnet.", answer: "reversible: mixing did not form a new material and the components were separated", wrong: ["irreversible because two materials touched", "irreversible because the mixture looked different", "reversible because every mixture is always perfectly easy to separate"], class: "reversible", evidence: "component recovery" },
  { key: "burning", event: "A teacher demonstration burns a material and records ash, gas and new properties.", answer: "not usually reversible: evidence supports formation of new materials", wrong: ["reversible because cooling always restores burned material", "irreversible only because a flame looks dramatic", "reversible because ash is the same material with a new shape"], class: "irreversible", evidence: "new materials and changed properties" },
  { key: "rust", event: "Iron slowly forms rust with different properties and cannot be restored by simple separation.", answer: "not usually reversible: rust is a new material formed by a chemical change", wrong: ["reversible by sieving rust from iron", "reversible because the change was slow", "irreversible only because the colour changed"], class: "irreversible", evidence: "new material with different properties" },
  { key: "gas-evidence", event: "Two substances are mixed and bubbles appear, but no controls or gas test are recorded.", answer: "insufficient evidence: bubbles are an observation, but more evidence is needed to conclude a new material formed", wrong: ["irreversible because bubbles alone always prove a new substance", "reversible because every mixture can be filtered", "no change occurred because gases cannot be materials"], class: "insufficient", evidence: "single sign without corroboration" },
  { key: "colour-only", event: "A material looks darker after a test, but lighting, temperature and recovery were not checked.", answer: "insufficient evidence: colour appearance alone does not establish reversibility or a new material", wrong: ["irreversible because every colour change proves a reaction", "reversible because dark colours are physical changes", "no observation was made"], class: "insufficient", evidence: "appearance alone" },
];

const critiqueCases = [
  { key: "best", claim: "Steel is the best material.", evidence: "Only magnetism was tested; no purpose was stated.", answer: "insufficient: suitability needs a stated purpose and evidence for all relevant properties", wrong: ["support because magnetic always means best", "challenge because steel is never useful", "support because one property answers every design brief"], rule: "bounded_suitability" },
  { key: "metal-magnetic", claim: "Every metal is magnetic.", evidence: "Steel was attracted in the test; copper and aluminium were not.", answer: "challenge: the tested metals behaved differently, so being metal alone did not predict attraction", wrong: ["support because all shiny materials are magnetic", "support because steel represents every metal", "insufficient because observations never challenge claims"], rule: "magnetism_evidence" },
  { key: "transparent-conductor", claim: "Transparent materials conduct electricity.", evidence: "Acrylic and glass were transparent but did not complete the low-voltage test circuit.", answer: "challenge: transparency and electrical conductivity are different properties", wrong: ["support because light and electricity are identical", "support because clear means conductive", "insufficient because two properties cannot be compared"], rule: "properties_distinct" },
  { key: "dissolved-gone", claim: "Dissolved sugar has gone.", evidence: "Closed-system mass stayed constant and sugar was recovered after water removal.", answer: "challenge: mass and recovery evidence show the sugar remained in the solution", wrong: ["support because invisible means absent", "support because dissolving is burning", "insufficient because recovery is unrelated evidence"], rule: "dissolved_remains" },
  { key: "filter-salt", claim: "Filter paper removes salt from salt solution.", evidence: "The clear solution passed through with no salt residue.", answer: "challenge: ordinary filtration does not retain dissolved salt", wrong: ["support because filters catch every substance", "support because dissolved particles are large grains", "insufficient because the filtrate cannot contain solute"], rule: "filtration_not_solution" },
  { key: "dramatic", claim: "A dramatic change is always irreversible.", evidence: "Ice changed greatly in appearance when melting and froze again.", answer: "challenge: recoverability and new-material evidence matter more than dramatic appearance", wrong: ["support because visible changes are chemical", "support because liquids cannot become solids", "insufficient because recovery is not evidence"], rule: "recovery_over_appearance" },
  { key: "one-trial", claim: "Material A is always the hardest.", evidence: "One scratch test compared A and B with different tools.", answer: "insufficient: the comparison was not fair and cannot support an always claim", wrong: ["support because one result proves a universal claim", "challenge because A can never be hard", "support because changing tools improves fairness"], rule: "fair_test_limit" },
  { key: "thermal", claim: "The spoon that warmed fastest was the better thermal conductor.", evidence: "Matched spoons used equal dimensions, starting temperature, heating and sensor position across repeats.", answer: "support for these tested spoons and conditions, while avoiding a claim about every sample", wrong: ["support as a universal rule for all materials", "challenge because temperature data never show conduction", "insufficient because fair comparisons cannot provide evidence"], rule: "bounded_conductivity" },
  { key: "separation", claim: "A sieve is suitable for gravel and sand.", evidence: "The holes pass sand particles but retain the larger gravel pieces.", answer: "support: the useful particle-size difference matches the sieve", wrong: ["support because sieves dissolve sand", "challenge because particle size never matters", "insufficient because equipment needs no property reason"], rule: "particle_size_separation" },
  { key: "gas", claim: "Bubbles prove an irreversible change.", evidence: "No comparison, gas test or recovery evidence was collected.", answer: "insufficient: bubbles alone do not justify the full conclusion", wrong: ["support because one sign always proves a new material", "challenge because gases never form in changes", "support because recovery evidence is unnecessary"], rule: "single_sign_insufficient" },
];

const candidates = [
  ...expand("property", 48, propertyCases, buildProperty),
  ...expand("dissolving", 47, dissolvingCases, buildDissolving),
  ...expand("separation", 47, separationCases, buildSeparation),
  ...expand("change", 47, changeCases, buildChange),
  ...expand("critique", 47, critiqueCases, buildCritique),
];

pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Year 5 properties-of-materials pilot reaches 240 variants with four curated questions preserved unchanged and 236 deterministic review candidates. Coverage includes evidence-bounded comparison of hardness, solubility, transparency, thermal/electrical conductivity and magnetism; multi-property suitability; fair tests; dissolving and recovery; sieving, filtering, magnetism, decanting and controlled evaporation; reversible and irreversible changes; evidence interpretation, misconceptions and transfer. Every generated item includes sensory-safe/no-touch, reduced-load and alternative-input routes, rich corrective feedback and pressure-free lab missions. Selected narration references require produced, human-reviewed ElevenLabs assets; browser TTS is prohibited. Independent science, teacher, SEND, accessibility, safeguarding, audio and renderer review remains required before promotion.";

validateBank(pack, curated, candidates, curatedSnapshot);
enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`properties-materials-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`properties-materials-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`properties-materials-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`properties-materials-bank audio_refs=${candidates.filter((variant) => variant.body.audio_asset_id).length}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`properties-materials-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 5 properties-materials bank is out of date; run generate-y5-properties-materials-bank.mjs --write.");
  console.log("properties-materials-bank deterministic check passed");
} else {
  console.log("properties-materials-bank dry-run; pass --write to update the pack");
}

function buildProperty(item, index, id) {
  const fairTest = item.key.startsWith("fair-");
  return candidate({ id, index, format: "property-test-lab", blueprint: "property-test-and-material-choice", band: fairTest ? "secure" : index < 20 ? "developing" : "expected", strand: fairTest ? "fair_property_test" : "material_suitability", prompt: `Property laboratory ${index + 1}: choose the evidence-based decision for ${item.brief}.`, body: { test_results: item.results, relevant_properties: item.properties, fair_test_design: fairTest, choices: [item.answer, ...item.wrong], integrity: { type: "property", key: item.key, expected: item.answer }, claim_limit: "applies_only_to_the_stated_purpose_materials_and_test_conditions" }, answer: item.answer, hints: ["Match every required property to a test result or controlled variable.", "Reject absolute claims that go beyond the purpose, samples or conditions."], explanation: `${item.answer} The conclusion is limited to the stated design brief and evidence; another purpose could require a different property profile.`, tag: fairTest ? "uncontrolled_variables" : "one_property_fits_all", repair: fairTest ? "Use a CHANGE / MEASURE / KEEP SAME planner and select a virtual or teacher-demonstrated route before testing." : "Use a requirement-to-evidence table, score every relevant property and add one limitation to the recommendation." });
}

function buildDissolving(item, index, id) {
  return candidate({ id, index, format: "claim-evidence-explain", blueprint: "dissolving-solubility-and-recovery", band: index < 16 ? "developing" : index < 38 ? "expected" : "secure", strand: "dissolving_solution_recovery", prompt: `Solution evidence mission ${index + 1}: ${item.scenario} Which explanation is supported?`, body: { observation_set: item.scenario, particle_model_available: true, choices: [item.answer, ...item.wrong], integrity: { type: "dissolving", key: item.key, rule: item.rule, expected: item.answer }, practical_route: "virtual_or_teacher_supervised_only" }, answer: item.answer, hints: ["Separate what is visible from what mass or recovery evidence shows.", "Dissolving is not melting; choose a recovery method that matches a solution."], explanation: `${item.answer} This conclusion uses conservation, solubility or recovery evidence and does not claim that invisibility means absence.`, tag: item.rule === "filtration_not_solution" ? "filter_dissolved_solute" : "dissolved_means_gone", repair: "Show before/solution/recovery frames with a mass record and particle model; label solute, solvent and any undissolved solid separately." });
}

function buildSeparation(item, index, id) {
  return candidate({ id, index, format: "mixture-separation-planner", blueprint: "single-and-multistage-separation", band: item.methods.length === 1 ? "expected" : "secure", strand: "property_based_separation", prompt: `Separation route ${index + 1}: plan a valid route for ${item.mixture}.`, body: { mixture: item.mixture, component_property_evidence: item.properties, required_methods: item.methods, destination_tracking: true, choices: [item.answer, ...item.wrong], integrity: { type: "separation", key: item.key, methods: item.methods, expected: item.answer }, practical_route: "simulation_or_teacher_supervised_with_safe_disposal" }, answer: item.answer, hints: ["Name the useful property difference before choosing equipment.", "Track every component after each stage, including dissolved material in the filtrate."], explanation: `${item.answer} The ordered route uses ${item.methods.join(", ")} because of the stated particle-size, solubility, magnetism or state differences.`, tag: "equipment_without_property", repair: "Use a component-property-method-destination table, preserve correct stages and replace only the first method that cannot separate the stated components." });
}

function buildChange(item, index, id) {
  return candidate({ id, index, format: "change-evidence-sort", blueprint: "reversible-and-irreversible-evidence", band: item.class === "insufficient" ? "secure" : "expected", strand: "change_and_recovery_evidence", prompt: `Change evidence analyser ${index + 1}: ${item.event} Which conclusion is justified?`, body: { event: item.event, evidence_basis: item.evidence, conclusion_class: item.class, choices: [item.answer, ...item.wrong], integrity: { type: "change", key: item.key, class: item.class, expected: item.answer }, practical_route: "observation_cards_simulation_or_teacher_demonstration_only" }, answer: item.answer, hints: ["Ask whether original materials can be recovered and whether evidence supports new materials.", "One dramatic sign, colour change or temperature change is not proof by itself."], explanation: `${item.answer}. The key evidence is ${item.evidence}; the conclusion distinguishes recoverability from how striking the change looks.`, tag: item.class === "insufficient" ? "single_sign_proves_change" : "dramatic_means_irreversible", repair: "Sort cards into OBSERVATION / RECOVERY / NEW-MATERIAL EVIDENCE, then choose reversible, not usually reversible or insufficient evidence." });
}

function buildCritique(item, index, id) {
  return candidate({ id, index, format: "claim-evidence-explain", blueprint: "materials-claim-critique-retrieval", band: index % 5 === 0 ? "retrieval" : "secure", strand: "claim_evidence_transfer", prompt: `Evidence review ${index + 1}: support, challenge or insufficient?`, body: { claim: item.claim, evidence: item.evidence, choices: [item.answer, ...item.wrong], integrity: { type: "critique", key: item.key, rule: item.rule, expected: item.answer }, observation_inference_check: true }, answer: item.answer, hints: ["Use only the supplied observations or measurements.", "Check whether the claim is causal, universal or broader than the tested samples."], explanation: `${item.answer}. The judgement matches the evidence strength and avoids extending a result beyond the tested materials and conditions.`, tag: item.rule.includes("filter") ? "equipment_without_property" : item.rule.includes("dissolved") ? "dissolved_means_gone" : "claim_exceeds_evidence", repair: "Underline the exact claim, box the evidence and use SUPPORT / CHALLENGE / INSUFFICIENT sentence frames with one stated limitation." });
}

function candidate({ id, index, format, blueprint, band, strand, prompt, body, answer, hints, explanation, tag, repair }) {
  const fullId = `${prefix}${id}`;
  const choices = rotate([...new Set(body.choices)], index % body.choices.length);
  const fullExplanation = explanation.length >= 100 ? explanation : `${explanation} The property, observation and model boundary remain explicit.`;
  const audio = index % 15 === 0 ? { audio_optional: true, audio_asset_id: `narration-${fullId}`, audio_provider: "ElevenLabs", audio_asset_status: "required_human_listening_review", human_listening_approval_required: true } : { audio_required: false };
  return {
    id: fullId,
    format,
    body: {
      prompt, ...body, choices,
      materials_science_strand: strand,
      difficulty_band: band,
      evidence_purpose: `${strand}_observation_evidence_explanation`,
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
      response_mode: "touch_keyboard_switch_eye_gaze_aac_point_or_adult_recorded",
      supported_interaction: "Select tests, evidence, route stages or conclusions by touch, keyboard, switch scanning, eye-gaze dwell, AAC/pointing or learner-directed adult recording; numbered menus replace fine dragging, and speech, handwriting and material handling are optional.",
      interaction_route: { touch: true, keyboard: true, switch_scan: true, eye_gaze: true, aac_or_point: true, adult_recorded: true, fine_drag_required: false, handwriting_required: false, speech_required: false },
      send_support: { one_evidence_set_at_a_time: true, persistent_property_labels: true, symbol_and_text_routes: true, reduced_language_summary: true, correct_route_stages_preserved: true },
      sensory_safe_route: "Use photographs, labelled diagrams, data tables, sealed samples observed by an adult, or a simulation; no touching, smelling, tasting, heating, mains electricity, glass handling or unknown-substance contact is required.",
      no_touch_alternative: true,
      reduced_visual_load: true,
      static_text_equivalent: true,
      undo_available: true,
      retry_without_penalty: true,
      timer_allowed: false,
      speed_score_allowed: false,
      streaks_allowed: false,
      lives_allowed: false,
      browser_tts_allowed: false,
      browser_tts_fallback: "prohibited",
      ...audio,
      gamification: { mission: "restore one calm evidence station in the materials lab", reward: "a lab-map marker for an evidence-bounded explanation", timer: false, streak: false, lives: false, loss_on_error: false, retry_message: "That result gives the lab useful evidence. Keep correct observations and route stages, open one property clue and revise without losing progress." },
    },
    expected_answer: { value: answer },
    hints,
    explanation: fullExplanation,
    feedback: {
      correct: `The observations and material-property evidence support the accepted response. ${fullExplanation}`,
      repair,
      evidence: `Name the tested property or recovery evidence and limit the conclusion to the stated conditions. Accepted response: ${answer}`,
      misconception_check: tag,
      check_prompt: format === "property-test-lab" ? "Which property mattered, what changed, and what was kept the same?" : format === "mixture-separation-planner" ? "Which property difference makes each stage work, and where is every component afterwards?" : "Which observation supports recovery, a new material, or an insufficient-evidence conclusion?",
      support_message: "Visual, text, virtual and teacher-demonstrated evidence routes are equivalent. Respond by touch, keyboard, switch, eye gaze, AAC/pointing or adult recording; no timer, speech, handwriting, fine drag or material contact is required.",
      retry: "Correct observations and independent route stages remain visible. Use one property or evidence clue, then retry without penalty.",
    },
    difficulty: { developing: 4, expected: 6, secure: 7, retrieval: 5 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: format === "property-test-lab" ? "property-evidence-profile" : format === "mixture-separation-planner" ? "mixture-route-track" : format === "change-evidence-sort" ? "change-evidence-sort" : "claim-evidence-lock",
  };
}

function expand(label, count, items, builder) {
  return Array.from({ length: count }, (_, index) => {
    const item = items[index % items.length];
    return builder(item, index, `${label}-${String(index + 1).padStart(3, "0")}-${item.key}`);
  });
}

function validateBank(currentPack, authored, generated, authoredSnapshot) {
  if (authored.length !== 4 || JSON.stringify(currentPack.question_variants.slice(0, 4)) !== authoredSnapshot) throw new Error("Curated variants changed or moved.");
  if (generated.length !== 236 || currentPack.question_variants.length !== pilotTarget) throw new Error("Expected 236 generated and 240 total variants.");
  const blueprintMap = new Map(currentPack.variant_blueprints.map((item) => [item.id, item]));
  const formats = new Set(currentPack.practice.formats);
  const ids = new Set();
  const signatures = new Set();
  for (const variant of currentPack.question_variants) {
    if (ids.has(variant.id)) throw new Error(`Duplicate id ${variant.id}.`);
    ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${normalise(variant.expected_answer)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate format/prompt/answer signature ${variant.id}.`);
    signatures.add(signature);
  }
  for (const variant of generated) {
    const blueprint = blueprintMap.get(variant.body.variant_blueprint_id);
    if (!blueprint || blueprint.format !== variant.format || !formats.has(variant.format)) throw new Error(`${variant.id} has invalid format or blueprint.`);
    validateScience(variant);
    if (variant.body.choices.length < 3 || !variant.body.choices.includes(variant.expected_answer.value)) throw new Error(`${variant.id} does not offer its accepted answer.`);
    if (!variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.evidence || !variant.feedback?.check_prompt || variant.hints.length < 2 || variant.explanation.length < 90) throw new Error(`${variant.id} lacks rich feedback.`);
    const route = variant.body.interaction_route;
    if (!route?.touch || !route?.keyboard || !route?.switch_scan || !route?.eye_gaze || !route?.aac_or_point || !route?.adult_recorded || route.fine_drag_required !== false || route.handwriting_required !== false || route.speech_required !== false) throw new Error(`${variant.id} lacks accessible routes.`);
    if (!variant.body.send_support?.one_evidence_set_at_a_time || variant.body.no_touch_alternative !== true || variant.body.reduced_visual_load !== true) throw new Error(`${variant.id} lacks SEND or sensory-safe support.`);
    if (variant.body.timer_allowed !== false || variant.body.speed_score_allowed !== false || variant.body.streaks_allowed !== false || variant.body.lives_allowed !== false || variant.body.gamification?.loss_on_error !== false) throw new Error(`${variant.id} introduces pressure.`);
    if (variant.body.browser_tts_allowed !== false || variant.body.browser_tts_fallback !== "prohibited") throw new Error(`${variant.id} permits browser TTS.`);
    if (variant.body.audio_asset_id && (variant.body.audio_provider !== "ElevenLabs" || variant.body.audio_asset_status !== "required_human_listening_review" || variant.body.human_listening_approval_required !== true)) throw new Error(`${variant.id} has unreviewed audio metadata.`);
  }
  const allocation = { "property-test-and-material-choice": 48, "dissolving-solubility-and-recovery": 47, "single-and-multistage-separation": 47, "reversible-and-irreversible-evidence": 47, "materials-claim-critique-retrieval": 47 };
  for (const [blueprint, expected] of Object.entries(allocation)) {
    const actual = generated.filter((variant) => variant.body.variant_blueprint_id === blueprint).length;
    if (actual !== expected) throw new Error(`${blueprint} expected ${expected}, found ${actual}.`);
  }
}

function validateScience(variant) {
  const i = variant.body.integrity;
  if (i.expected !== variant.expected_answer.value) throw new Error(`${variant.id} changed its canonical science answer.`);
  if (i.type === "property") {
    const source = propertyCases.find((item) => item.key === i.key);
    if (!source || source.answer !== i.expected || source.properties.length < 2) throw new Error(`${variant.id} has an invalid property case.`);
    if (/best for every|always the best/i.test(i.expected)) throw new Error(`${variant.id} overclaims material suitability.`);
  } else if (i.type === "dissolving") {
    const source = dissolvingCases.find((item) => item.key === i.key);
    if (!source || source.answer !== i.expected || source.rule !== i.rule) throw new Error(`${variant.id} has an invalid dissolving rule.`);
    if (/filter.*dissolved (salt|sugar)|sieve.*dissolved/i.test(i.expected)) throw new Error(`${variant.id} incorrectly separates a solution.`);
  } else if (i.type === "separation") {
    const source = separationCases.find((item) => item.key === i.key);
    if (!source || source.answer !== i.expected || JSON.stringify(source.methods) !== JSON.stringify(i.methods)) throw new Error(`${variant.id} has an invalid separation route.`);
    if (/filter (out |the )?(dissolved )?(salt|sugar)/i.test(i.expected)) throw new Error(`${variant.id} incorrectly filters dissolved solute.`);
  } else if (i.type === "change") {
    const source = changeCases.find((item) => item.key === i.key);
    if (!source || source.answer !== i.expected || source.class !== i.class) throw new Error(`${variant.id} has an invalid change classification.`);
    if (i.class === "irreversible" && !/new material/i.test(i.expected)) throw new Error(`${variant.id} lacks new-material evidence.`);
    if (i.class === "insufficient" && !/insufficient evidence/i.test(i.expected)) throw new Error(`${variant.id} overstates a single sign.`);
  } else if (i.type === "critique") {
    const source = critiqueCases.find((item) => item.key === i.key);
    if (!source || source.answer !== i.expected || source.rule !== i.rule) throw new Error(`${variant.id} has an invalid evidence critique.`);
  } else throw new Error(`${variant.id} has unknown science integrity type ${i.type}.`);
}

function rotate(values, by) { const offset = by % values.length; return [...values.slice(offset), ...values.slice(0, offset)]; }
function normalise(value) { return JSON.stringify(value).toLowerCase().replaceAll(/[^a-z0-9]+/g, " ").trim(); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
function summary(items, keyFor) { const counts = new Map(); for (const item of items) counts.set(keyFor(item), (counts.get(keyFor(item)) ?? 0) + 1); return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(","); }
