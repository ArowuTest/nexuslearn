#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/sc-y6-evolution-and-inheritance.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y6-evolution-and-inheritance-bank-";
const pilotTarget = 240;
const reviewBatch = "y6-evolution-inheritance-pilot-a";

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y6-evolution-and-inheritance") throw new Error("This generator only supports the Year 6 evolution-and-inheritance pack.");
const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 4) throw new Error(`Expected exactly 4 curated variants, found ${curated.length}.`);
const curatedSnapshot = JSON.stringify(curated);

const inheritanceCases = [
  { key: "fox-cubs", evidence: "Fox cubs share fox characteristics with their parents but differ in coat shade and body size.", answer: "same kind with normal inherited and other within-species variation; not exact copies", wrong: ["exact copies of one parent", "a new species because individuals differ", "every difference must have been learned"], class: "variation" },
  { key: "pea-colour", evidence: "Across controlled plant crosses, seed colour patterns repeatedly appear in offspring even when pots and care are matched.", answer: "evidence supports an inherited contribution to seed colour in these plants", wrong: ["watering directly paints each seed colour", "every offspring must have exactly the parent's colour", "one plant proves a simple rule for every species"], class: "inherited_evidence" },
  { key: "leaf-light", evidence: "Cuttings of the same plant type grow larger, thinner leaves in shade and smaller, thicker leaves in bright light.", answer: "the light environment contributes to the observed leaf differences", wrong: ["shade permanently changes inherited information by need", "the acquired leaf size must pass unchanged to every offspring", "all variation is inherited"], class: "environmental_evidence" },
  { key: "tree-scar", evidence: "A tree trunk is scarred by storm damage after it has grown.", answer: "an acquired injury; the scar itself is not an inherited characteristic passed to seeds", wrong: ["an inherited adaptation produced because the tree needed it", "proof that all offspring will have the same scar", "a change of species"], class: "acquired" },
  { key: "trained-dog", evidence: "A dog learns a trained route through repeated practice.", answer: "a learned characteristic; the trained route itself is not inherited by puppies", wrong: ["puppies are born knowing the exact route", "training changes the species", "every behaviour is inherited"], class: "learned" },
  { key: "sunflower-height", evidence: "Related sunflower seedlings vary in height, and plants with less water also grow less.", answer: "both inherited variation and environment may contribute; this evidence does not separate their exact effects", wrong: ["height is caused only by inheritance", "height is caused only by water", "short plants chose an inherited change"], class: "insufficient_mixed" },
  { key: "bird-beaks", evidence: "Young birds are the same species as their parents but show a range of beak depths.", answer: "offspring are the same kind, while beak-depth variation exists within the population", wrong: ["each chick is an exact copy", "different beak depth means different species", "food directly gives every chick the same inherited beak"], class: "variation" },
  { key: "plant-cutting", evidence: "A plant cutting and its source grow in different light and develop different stem lengths.", answer: "environment can alter growth, so appearance alone does not prove an inherited difference", wrong: ["different stem length proves different species", "the cutting evolved during its lifetime", "all stem length is learned"], class: "environmental_evidence" },
  { key: "shell-sample", evidence: "Snail offspring resemble their parents but a family sample contains several shell patterns.", answer: "shared species characteristics and variation can occur together among related offspring", wrong: ["only one shell pattern can belong to the species", "offspring copy one parent exactly", "every pattern is caused by shell use"], class: "variation" },
  { key: "unknown-cause", evidence: "Two seedlings differ in colour, but their parentage and growing conditions were not recorded.", answer: "insufficient evidence to decide whether inheritance, environment or both contributed", wrong: ["colour must be inherited", "colour must be environmental", "the seedlings changed because they wanted different colours"], class: "insufficient" },
];

const adaptationCases = [
  { key: "drought-roots", environment: "repeated drought", variation: "some plants already have inherited deeper-root variation", advantage: "reach more available water and leave more offspring", trait: "deeper roots" },
  { key: "snow-fur", environment: "long snowy seasons", variation: "predators already vary in inherited fur shade", advantage: "paler individuals are less visible to prey and leave more offspring", trait: "pale fur" },
  { key: "dark-rock-shell", environment: "dark rocky shore", variation: "snails already vary in inherited shell shade", advantage: "darker shells are less visible to predators and their bearers leave more offspring", trait: "dark shell shade" },
  { key: "hard-seeds", environment: "a period when mostly hard seeds are available", variation: "birds already vary in inherited beak depth", advantage: "deeper-beaked birds open more seeds and leave more offspring", trait: "deeper beaks" },
  { key: "waxy-leaves", environment: "dry, windy habitat", variation: "plants already vary in inherited waxy leaf covering", advantage: "waxy leaves reduce water loss and those plants leave more offspring", trait: "waxy leaf covering" },
  { key: "wet-habitat", environment: "waterlogged habitat", variation: "plants already vary in root-air-space characteristics", advantage: "individuals with more air spaces tolerate low-oxygen mud and leave more offspring", trait: "more root air spaces" },
  { key: "insect-treatment", environment: "repeated exposure to one pest-control treatment", variation: "a few insects already have inherited variation linked to survival", advantage: "those insects survive more often and leave more offspring", trait: "treatment-survival variation" },
  { key: "environment-switch", environment: "snow melts and dark ground becomes common", variation: "the population already contains inherited light and dark fur shades", advantage: "darker individuals may now be less visible and leave more offspring", trait: "dark fur shade" },
];

const fossilCases = [
  { key: "forms-through-time", evidence: "Older dated layers contain form A; younger dated layers contain a related form B with a different chamber shape.", answer: "The evidence supports related forms with different features living at different times; it does not show one buried individual changing.", wrong: ["The buried fossil changed its chamber after death.", "Every intermediate organism must be preserved.", "The younger layer caused organisms to need a new chamber."], bound: "related_forms_different_times" },
  { key: "record-gap", evidence: "Fossils occur in layers dated 120 and 80 million years ago, with no suitable exposed rock from the interval between.", answer: "There is a gap in available evidence; absence of exposed fossils does not prove no organisms lived during the interval.", wrong: ["Nothing lived between the two dates.", "The fossil record is complete despite missing rock.", "The older fossil lived continuously for 40 million years."], bound: "gap_not_absence" },
  { key: "marine-layer", evidence: "A dated inland rock layer contains many marine-shell fossils and sediment features associated with shallow water.", answer: "The evidence supports a cautious inference that this place had a marine environment when the layer formed.", wrong: ["The shells prove the site has always been dry land.", "Every marine species that lived there is preserved.", "Humans watched the layer form."], bound: "past_environment" },
  { key: "rare-fossilisation", evidence: "One species is known from a few hard-part fossils; soft tissues and many habitats rarely preserve remains.", answer: "The fossils provide useful but incomplete evidence; the number found is not the exact past population size.", wrong: ["The number of fossils equals the number that lived.", "Missing soft tissues prove the organisms lacked them.", "A few fossils make all inference impossible."], bound: "preservation_bias" },
  { key: "ordered-layers", evidence: "Undisturbed layers are labelled oldest at the bottom and youngest at the top, with supplied dates confirming the order.", answer: "Fossils in the lower dated layer are older than fossils in the upper dated layer in this sequence.", wrong: ["Upper fossils are always older because they are easier to find.", "All fossils in every location follow one simple stack.", "Layer position gives exact age without dates or context."], bound: "relative_chronology" },
  { key: "missing-feature", evidence: "Two fossils preserve different teeth but neither preserves fur, skin or colour.", answer: "Teeth can be compared, but fur, skin and colour cannot be concluded from these fossils alone.", wrong: ["Both animals definitely had identical fur.", "Neither animal had skin because it was not fossilised.", "Teeth reveal exact colour."], bound: "feature_not_preserved" },
  { key: "first-found", evidence: "The oldest fossil found so far for a group is dated 70 million years ago, but older suitable layers are poorly sampled.", answer: "The group lived by 70 million years ago; the evidence does not prove that was the exact first appearance.", wrong: ["The group began on the exact day the fossil formed.", "No older members could have existed.", "The fossil record has no sampling gaps."], bound: "first_appearance_caution" },
  { key: "trace-fossil", evidence: "A rock layer contains preserved trackways but no body fossils.", answer: "The tracks provide evidence that moving organisms were present, while their exact species may remain uncertain.", wrong: ["No organism was present because there is no body fossil.", "The track maker's full appearance is known exactly.", "Tracks are not fossil evidence."], bound: "trace_evidence" },
];

const retrievalCases = [
  { key: "variation", prompt: "What is within-species variation?", answer: "Differences among individuals of the same species", wrong: ["Every individual changing species", "A need-driven change in one lifetime", "All offspring being identical"], tag: "offspring_exact_copy" },
  { key: "inheritance", prompt: "Which statement about offspring is precise?", answer: "They are normally the same kind as their parents but vary and are not exact copies", wrong: ["They copy one parent exactly", "Every acquired feature is inherited", "Any difference makes a new species"], tag: "offspring_exact_copy" },
  { key: "adaptation", prompt: "Which definition is evidence-based?", answer: "An inherited characteristic that gives an advantage in a particular environment and can affect reproductive success", wrong: ["Any feature that seems useful", "A change an individual chooses when needed", "A feature helpful in every environment"], tag: "every_useful_feature_adaptation" },
  { key: "evolution", prompt: "What changes during evolution at this level?", answer: "Proportions of inherited characteristics in populations across many generations", wrong: ["One individual deliberately rewrites inherited features", "Every organism becomes identical", "A fossil changes after burial"], tag: "individual_evolves" },
  { key: "selection-chain", prompt: "Which order gives the causal chain?", answer: "existing inherited variation → different survival/reproduction → trait proportions change over generations", wrong: ["need → individual changes → offspring copy it", "environment directly creates the same trait in all individuals", "fossil → individual chooses a feature"], tag: "need_driven_change" },
  { key: "context", prompt: "Why is an adaptation environment-specific?", answer: "The same inherited feature may give an advantage in one environment but not another", wrong: ["Every useful feature helps everywhere", "The environment rewards effort", "Individuals predict future habitats"], tag: "every_useful_feature_adaptation" },
  { key: "fossil", prompt: "What can fossils provide?", answer: "Incomplete evidence about organisms and environments in the past", wrong: ["A complete record of every organism", "Proof that missing species never existed", "Direct observation by modern humans"], tag: "fossil_record_complete" },
  { key: "individual-population", prompt: "Which statement separates individual and population change?", answer: "Individuals live and reproduce; inherited trait proportions can change in populations across generations", wrong: ["An individual evolves a needed inherited feature", "Populations change because every member chooses together", "One lifetime is the same as many generations"], tag: "individual_evolves" },
  { key: "evidence-limit", prompt: "A fossil does not preserve colour. What is the careful conclusion?", answer: "Colour is not known from that fossil evidence alone", wrong: ["The organism had no colour", "Its exact colour can be guessed from the rock", "The fossil record is complete"], tag: "fossil_record_complete" },
  { key: "model", prompt: "What is a limitation of a simplified population simulation?", answer: "It can test a causal pattern but omits many interacting real-world factors", wrong: ["It predicts every real population exactly", "It shows individuals choosing traits", "A model cannot provide any evidence"], tag: "model_as_complete_reality" },
];

const candidates = [
  ...expand("inheritance", 48, inheritanceCases, buildInheritance),
  ...expand("adaptation", 47, adaptationCases, buildAdaptation),
  ...Array.from({ length: 47 }, (_, index) => buildPopulation(index)),
  ...expand("fossil", 47, fossilCases, buildFossil),
  ...expand("retrieval", 47, retrievalCases, buildRetrieval),
];

pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Year 6 evolution-and-inheritance pilot reaches 240 variants with four curated questions preserved semantically unchanged and 236 deterministic review candidates. Coverage follows a causal progression from within-species variation and careful inheritance evidence to environment-specific adaptation, differential survival/reproduction and population trait-frequency change across generations, then fossils and dated/ordered layers as incomplete evidence. Need-driven change, individual-evolves, exact-copy, every-useful-feature-is-adaptation and complete-fossil-record misconceptions are explicitly repaired. All four declared formats and five blueprints include patterned/labelled population tables, inheritance sorts, fossil investigations and causal explain choices, with simplified-count SEND, static, keyboard, switch and no-drag alternatives. Selected narration references require produced, human-reviewed ElevenLabs assets; browser TTS is prohibited. Independent science, teacher, SEND, accessibility, safeguarding, audio and renderer review remains required before promotion.";

validateBank(pack, curated, candidates, curatedSnapshot);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`evolution-inheritance-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`evolution-inheritance-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`evolution-inheritance-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`evolution-inheritance-bank audio_refs=${candidates.filter((variant) => variant.body.audio_asset_id).length}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`evolution-inheritance-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 6 evolution-inheritance bank is out of date; run generate-y6-evolution-inheritance-bank.mjs --write.");
  console.log("evolution-inheritance-bank deterministic check passed");
} else {
  console.log("evolution-inheritance-bank dry-run; pass --write to update the pack");
}

function buildInheritance(item, index, id) {
  return candidate({ id, index, format: "inheritance-sort", blueprint: "offspring-variation-sorts", band: index < 16 ? "developing" : "expected", strand: "variation_inheritance_environment", prompt: `Inheritance evidence sort ${index + 1}: ${item.evidence} Which classification is justified?`, choices: [item.answer, ...item.wrong], answer: item.answer, hints: ["Separate same-kind shared characteristics from variation among individuals.", "Classify evidence as inherited contribution, environmental/acquired contribution or insufficient; avoid claiming one simple cause without evidence."], explanation: `${item.answer}. The conclusion uses the supplied evidence without making offspring exact copies or treating an acquired change as inherited.`, tag: item.class === "variation" ? "offspring_exact_copy" : item.class.startsWith("insufficient") ? "inheritance_overclaim" : "acquired_characteristic_inherited", body: { evidence: item.evidence, evidence_class: item.class, categories: ["inherited evidence", "environmental or acquired evidence", "normal variation", "insufficient evidence"], integrity: { type: "inheritance", key: item.key, class: item.class, expected: item.answer }, non_sensitive_example: true }, repair: "Use SAME KIND / VARIES / INHERITED EVIDENCE / ENVIRONMENTAL OR ACQUIRED / INSUFFICIENT cards, with one evidence sentence visible at a time." });
}

function buildAdaptation(item, index, id) {
  const answer = `Existing ${item.variation}; in ${item.environment}, ${item.advantage}; if the variation is inherited, ${item.trait} can become more common in the population over many generations.`;
  const wrong = [`Individuals develop ${item.trait} because they need it, then pass the acquired change on.`, `The environment directly gives every organism identical ${item.trait} in one generation.`, `${item.trait} is an adaptation in every environment simply because it can be useful.`];
  return candidate({ id, index, format: "explain-choice", blueprint: "adaptation-causal-chains", band: index < 16 ? "expected" : "secure", strand: "adaptation_causal_chain", prompt: `Causal-chain expedition ${index + 1}: explain possible adaptation in ${item.environment}.`, choices: [answer, ...wrong], answer, hints: ["Begin with variation already present before the environmental pressure.", "Link inherited variation to different survival or reproduction, then to population proportions across generations."], explanation: `${answer} This is population-level change, not a purposeful inherited change made by one individual.`, tag: item.key === "environment-switch" ? "feature_useful_everywhere" : "need_driven_change", body: { environment: item.environment, existing_variation: item.variation, differential_outcome: item.advantage, focal_trait: item.trait, causal_links: ["existing inherited variation", "environment-specific advantage", "differential survival or reproduction", "population proportion change", "many generations"], integrity: { type: "adaptation", key: item.key, expected: answer } }, repair: "Build VARIATION ALREADY EXISTS → ENVIRONMENT → DIFFERENT OUTCOME → MORE OFFSPRING → POPULATION PROPORTION CHANGES, rejecting any chain that starts with need." });
}

function buildPopulation(index) {
  const environments = [
    { key: "drought", traitA: "deep-root pattern", traitB: "shallow-root pattern", advantageA: true },
    { key: "snow", traitA: "pale-fur pattern", traitB: "dark-fur pattern", advantageA: true },
    { key: "dark-rock", traitA: "light-shell pattern", traitB: "dark-shell pattern", advantageA: false },
    { key: "hard-seed", traitA: "deep-beak pattern", traitB: "shallow-beak pattern", advantageA: true },
    { key: "wetland", traitA: "more-root-air-space pattern", traitB: "less-root-air-space pattern", advantageA: true },
    { key: "light-ground", traitA: "dark-body pattern", traitB: "light-body pattern", advantageA: false },
  ];
  const setting = environments[index % environments.length];
  const family = Math.floor(index / environments.length) % 5;
  const startA = 30 + (index % 4) * 10;
  const direction = setting.advantageA ? 1 : -1;
  const step = 5;
  const generations = Array.from({ length: 4 }, (_, generation) => {
    const a = startA + direction * step * generation;
    return { generation, trait_a: a, trait_b: 100 - a, total: 100 };
  });
  const endA = generations.at(-1).trait_a;
  const change = endA - startA;
  let prompt;
  let answer;
  let wrong;
  let questionType;
  if (family === 0) {
    answer = `${setting.traitA} changed by ${change} percentage points, from ${startA}% to ${endA}%.`;
    prompt = "Calculate the change in the trait-A proportion from generation 0 to generation 3.";
    wrong = [`It changed by ${Math.abs(change)} individuals but percentages cannot be compared.`, "Every individual changed trait during its lifetime.", "The population total changed from 100 to 200."];
    questionType = "proportion_change";
  } else if (family === 1) {
    const advantaged = setting.advantageA ? setting.traitA : setting.traitB;
    answer = `${advantaged} was associated with greater reproductive success in this model, so its proportion increased across generations.`;
    prompt = "Which causal interpretation matches the population table?";
    wrong = [`Individuals chose ${advantaged} because they needed it.`, "The environment created the same inherited trait in every organism.", "The table proves the trait is helpful in every environment." ];
    questionType = "causal_interpretation";
  } else if (family === 2) {
    const currentlyAdvantaged = setting.advantageA ? setting.traitA : setting.traitB;
    const alternative = setting.advantageA ? setting.traitB : setting.traitA;
    answer = `If the environment changes so ${alternative} gives greater reproductive success, the trend could reverse over later generations.`;
    prompt = `What is a cautious prediction if the environment changes and ${currentlyAdvantaged} no longer gives the advantage?`;
    wrong = ["The current trend must continue forever.", "Every individual will immediately swap its inherited trait.", "Environment never affects which variation is advantageous."];
    questionType = "environment_switch";
  } else if (family === 3) {
    answer = "The simplified model shows one causal pattern but omits mutation, migration, chance, multiple traits and changing environments.";
    prompt = "Which limitation should accompany the conclusion?";
    wrong = ["The model predicts every real population exactly.", "The model proves individuals choose inherited changes.", "A model with counts has no limitations."];
    questionType = "model_limit";
  } else {
    const advantagedStart = setting.advantageA ? startA : 100 - startA;
    const advantagedEnd = setting.advantageA ? endA : 100 - endA;
    answer = `The advantaged pattern rose from ${advantagedStart}% to ${advantagedEnd}%, consistent with differential reproduction across generations.`;
    prompt = "Use the first and last rows as evidence for a concise conclusion.";
    wrong = ["One organism evolved all the population's changes.", "The data show no proportion change.", "The trait must be advantageous in every habitat." ];
    questionType = "evidence_conclusion";
  }
  return candidate({ id: `population-${String(index + 1).padStart(3, "0")}-${setting.key}-${family}`, index, format: "population-simulation", blueprint: "multi-generation-population-models", band: family === 0 ? "expected" : "secure", strand: "multi_generation_population_change", prompt: `Population model ${index + 1} (${setting.key} environment): ${prompt}`, choices: [answer, ...wrong], answer, hints: ["Check that each generation totals 100, then compare proportions rather than following one individual.", "Use existing inherited variation, differential reproduction and many generations; keep the conclusion limited to this model and environment."], explanation: `${answer} The labelled patterns track population proportions, not individuals changing inherited traits during life.`, tag: family === 3 ? "model_as_complete_reality" : family === 2 ? "feature_useful_everywhere" : "individual_evolves", body: { environment: setting.key, trait_labels: { trait_a: setting.traitA, trait_b: setting.traitB }, pattern_coding: { trait_a: "diagonal stripe", trait_b: "dot pattern" }, generations, question_type: questionType, model_scope: "simplified_two_variant_population_with_fixed_total", integrity: { type: "population", setting: setting.key, advantageA: setting.advantageA, startA, endA, change, generations, questionType, expected: answer } }, repair: "Switch to a four-row generation table with patterned labels, verify each row totals 100 and describe which proportion changed before adding a causal explanation." });
}

function buildFossil(item, index, id) {
  const offset = Math.floor(index / fossilCases.length) * 3;
  const ages = [120 + offset, 90 + offset, 60 + offset, 30 + offset];
  return candidate({ id, index, format: "fossil-evidence", blueprint: "fossil-evidence-claims", band: index < 16 ? "expected" : "stretch", strand: "fossil_chronology_and_bounded_inference", prompt: `Fossil case ${index + 1}: which conclusion fits the dated layers?`, choices: [item.answer, ...item.wrong], answer: item.answer, hints: ["Use the supplied dates or stated undisturbed order; older ages are farther in the past.", "Fossilisation is uncommon and preservation is incomplete, so separate supported inference from absence or completeness claims."], explanation: `${item.answer} The claim stays within the dated/ordered evidence and acknowledges what the fossil record does not preserve.`, tag: "fossil_record_complete", body: { layer_order: "oldest_to_youngest", layer_ages_millions_years: ages, evidence: item.evidence, evidence_bound: item.bound, record_complete: false, integrity: { type: "fossil", key: item.key, ages, bound: item.bound, expected: item.answer } }, repair: "Use a dated oldest-to-youngest list, mark preserved evidence and gaps separately, then choose SUPPORTED / POSSIBLE / NOT SHOWN / OVERCLAIM." });
}

function buildRetrieval(item, index, id) {
  return candidate({ id, index, format: "explain-choice", blueprint: "evolution-inheritance-retrieval", band: index % 5 === 0 ? "retrieval" : "developing", strand: "causal_vocabulary_retrieval", prompt: `Expedition retrieval ${index + 1}: ${item.prompt}`, choices: [item.answer, ...item.wrong], answer: item.answer, hints: ["Choose the option that names the correct level: individual, offspring, population or fossil evidence.", "Use precise causal language and avoid need, choice, exact-copy or complete-record claims."], explanation: `${item.answer}. This keeps inheritance, environment, population generations and evidence limits distinct.`, tag: item.tag, body: { retrieval_focus: item.key, causal_language_required: true, integrity: { type: "retrieval", key: item.key, expected: item.answer } }, repair: "Use one low-reading-load card with the sentence stems VARIATION EXISTS…, IN THIS ENVIRONMENT…, OVER GENERATIONS…, or THE FOSSIL EVIDENCE SHOWS…." });
}

function candidate({ id, index, format, blueprint, band, strand, prompt, choices, answer, hints, explanation, tag, body, repair }) {
  const fullId = `${prefix}${id}`;
  const rotatedChoices = rotate([...new Set(choices)], index % choices.length);
  const fullExplanation = explanation.length >= 100 ? explanation : `${explanation} The causal level and evidence boundary remain explicit.`;
  const useAudio = index % 16 === 0;
  const audio = useAudio ? { audio_optional: true, audio_asset_id: `narration-${fullId}`, audio_provider: "ElevenLabs", audio_asset_status: "required_human_listening_review", human_listening_approval_required: true, audio_route: "chunked_causal_or_evidence_narration" } : { audio_required: false };
  return {
    id: fullId,
    format,
    body: {
      prompt,
      choices: rotatedChoices,
      ...body,
      biology_strand: strand,
      difficulty_band: band,
      evidence_purpose: `${blueprint}_causal_evidence_explanation`,
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
      response_mode: "touch_keyboard_switch_eye_gaze_aac_point_or_adult_recorded",
      supported_interaction: "Select evidence, population rows, fossil claims or causal-chain links by touch, keyboard, switch scanning, eye-gaze dwell, AAC/pointing or learner-directed adult recording; numbered positions replace dragging and speech or handwriting is optional.",
      interaction_route: { touch: true, keyboard: true, switch_scan: true, eye_gaze: true, aac_or_point: true, adult_recorded: true, drag_required: false, handwriting_required: false, speech_required: false },
      accessibility_support: { data_table_or_list_alternative: true, patterned_and_labelled_traits: true, simplified_count_view: true, same_causal_reasoning_in_simplified_view: true, one_causal_link_at_a_time: true, correct_links_preserved: true },
      non_sensitive_family_examples: true,
      colour_independent: true,
      static_reduced_motion_route: true,
      reduced_visual_load: true,
      undo_available: true,
      retry_without_penalty: true,
      timer_allowed: false,
      speed_score_allowed: false,
      streaks_allowed: false,
      lives_allowed: false,
      browser_tts_allowed: false,
      browser_tts_fallback: "prohibited",
      ...audio,
      gamification: { mission: "restore one calm expedition evidence chain", reward: "a field-lab evidence marker", timer: false, streak: false, lives: false, loss_on_error: false, retry_message: "That explanation gives the expedition useful evidence. Keep correct links and dated layers, open one causal clue and retry without losing progress." },
    },
    expected_answer: { value: answer },
    hints,
    explanation: fullExplanation,
    feedback: {
      correct: `The causal chain or fossil evidence supports the accepted response. ${fullExplanation}`,
      repair,
      evidence: `Check whether variation existed first, whether it is inherited, which environment affects outcomes, how reproduction changes population proportions, or what the dated fossil evidence actually preserves. Accepted response: ${answer}`,
      misconception_check: tag,
      check_prompt: format === "population-simulation" ? "Do generation totals balance, which trait proportion changed, and is the explanation population-level?" : format === "fossil-evidence" ? "Which dated layer or preserved feature supports the claim, and what gap limits it?" : "Does the explanation distinguish inherited variation from environmental or acquired change and avoid exact-copy language?",
      support_message: "Use labelled patterns, tables, lists, static panels and one causal link at a time. Touch, keyboard, switch, eye gaze, AAC/pointing and adult recording are equivalent; no timer, speech, handwriting, colour inference or drag is required.",
      retry: "Correct evidence, links and generation rows remain visible. Use one causal or chronology clue, then retry without penalty.",
    },
    difficulty: { developing: 4, expected: 6, secure: 7, stretch: 8, retrieval: 5 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: format === "inheritance-sort" ? "population-variation-scan" : format === "population-simulation" ? "population-generation-run" : format === "fossil-evidence" ? "fossil-layer-evidence-link" : "selection-chain-build",
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
    if (variant.body.choices.length !== 4 || !variant.body.choices.includes(variant.expected_answer.value)) throw new Error(`${variant.id} has an invalid answer set.`);
    if (!variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.evidence || !variant.feedback?.check_prompt || variant.hints.length < 2 || variant.explanation.length < 90) throw new Error(`${variant.id} lacks rich feedback.`);
    const route = variant.body.interaction_route;
    if (!route?.touch || !route?.keyboard || !route?.switch_scan || !route?.eye_gaze || !route?.aac_or_point || !route?.adult_recorded || route.drag_required !== false || route.handwriting_required !== false || route.speech_required !== false) throw new Error(`${variant.id} lacks accessible routes.`);
    if (!variant.body.accessibility_support?.data_table_or_list_alternative || !variant.body.accessibility_support?.simplified_count_view || !variant.body.accessibility_support?.same_causal_reasoning_in_simplified_view || variant.body.colour_independent !== true || variant.body.static_reduced_motion_route !== true) throw new Error(`${variant.id} lacks SEND/static support.`);
    if (variant.body.timer_allowed !== false || variant.body.speed_score_allowed !== false || variant.body.streaks_allowed !== false || variant.body.lives_allowed !== false || variant.body.gamification?.loss_on_error !== false) throw new Error(`${variant.id} introduces pressure.`);
    if (variant.body.browser_tts_allowed !== false || variant.body.browser_tts_fallback !== "prohibited") throw new Error(`${variant.id} permits browser TTS.`);
    if (variant.body.audio_asset_id && (variant.body.audio_provider !== "ElevenLabs" || variant.body.audio_asset_status !== "required_human_listening_review" || variant.body.human_listening_approval_required !== true || variant.body.audio_route !== "chunked_causal_or_evidence_narration")) throw new Error(`${variant.id} has invalid audio metadata.`);
  }
  for (const format of currentPack.practice.formats) if (!generated.some((variant) => variant.format === format)) throw new Error(`Declared format ${format} is unused.`);
  const allocation = { "offspring-variation-sorts": 48, "adaptation-causal-chains": 47, "multi-generation-population-models": 47, "fossil-evidence-claims": 47, "evolution-inheritance-retrieval": 47 };
  for (const [blueprint, expected] of Object.entries(allocation)) {
    const actual = generated.filter((variant) => variant.body.variant_blueprint_id === blueprint).length;
    if (actual !== expected) throw new Error(`${blueprint} expected ${expected}, found ${actual}.`);
  }
}

function validateScience(variant) {
  const i = variant.body.integrity;
  if (i.expected !== variant.expected_answer.value) throw new Error(`${variant.id} changed its canonical answer.`);
  if (i.type === "inheritance") {
    const source = inheritanceCases.find((item) => item.key === i.key);
    if (!source || source.answer !== i.expected || source.class !== i.class) throw new Error(`${variant.id} has invalid inheritance evidence.`);
  } else if (i.type === "adaptation") {
    const source = adaptationCases.find((item) => item.key === i.key);
    if (!source || !i.expected.includes("Existing") || !i.expected.includes("more offspring") || !i.expected.includes("many generations")) throw new Error(`${variant.id} lacks the causal adaptation chain.`);
    if (/because they need|decides? to|directly gives every/i.test(i.expected)) throw new Error(`${variant.id} uses need-driven change.`);
  } else if (i.type === "population") {
    if (i.generations.length !== 4 || i.generations.some((row, index) => row.generation !== index || row.trait_a + row.trait_b !== 100 || row.total !== 100 || row.trait_a < 0 || row.trait_b < 0)) throw new Error(`${variant.id} has invalid population arithmetic.`);
    if (i.endA - i.startA !== i.change || i.generations[0].trait_a !== i.startA || i.generations.at(-1).trait_a !== i.endA) throw new Error(`${variant.id} has inconsistent trait change.`);
  } else if (i.type === "fossil") {
    const source = fossilCases.find((item) => item.key === i.key);
    if (!source || source.answer !== i.expected || source.bound !== i.bound) throw new Error(`${variant.id} has invalid fossil evidence.`);
    if (i.ages.some((age, index) => index > 0 && age >= i.ages[index - 1])) throw new Error(`${variant.id} has invalid oldest-to-youngest chronology.`);
    if (/^(The fossil record is complete|Every individual|Missing fossils prove no organisms)/i.test(i.expected)) throw new Error(`${variant.id} overclaims fossil evidence.`);
  } else if (i.type === "retrieval") {
    const source = retrievalCases.find((item) => item.key === i.key);
    if (!source || source.answer !== i.expected) throw new Error(`${variant.id} has invalid retrieval science.`);
  } else throw new Error(`${variant.id} has unknown science integrity type ${i.type}.`);
}

function rotate(values, by) { const offset = by % values.length; return [...values.slice(offset), ...values.slice(0, offset)]; }
function normalise(value) { return JSON.stringify(value).toLowerCase().replaceAll(/[^a-z0-9]+/g, " ").trim(); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
function summary(items, keyFor) { const counts = new Map(); for (const item of items) counts.set(keyFor(item), (counts.get(keyFor(item)) ?? 0) + 1); return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(","); }
