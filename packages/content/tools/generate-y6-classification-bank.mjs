#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/sc-y6-classification.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y6-classification-bank-";
const pilotTarget = 240;

if (write && check) throw new Error("Choose either --write or --check, not both.");

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y6-classification") throw new Error("This generator only supports the Year 6 classification pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 5) throw new Error(`Expected exactly 5 curated variants, found ${curated.length}. Refusing to overwrite possible authored work.`);

ensureBlueprints(pack);

const missions = [
  { key: "wetland", place: "Wetland field station", habitat: "pond and reedbed", reward: "field-guide page" },
  { key: "woodland", place: "Woodland survey camp", habitat: "leaf litter and tree canopy", reward: "canopy evidence badge" },
  { key: "coast", place: "Coastal research post", habitat: "rock pool and dune", reward: "shoreline key card" },
  { key: "meadow", place: "Meadow biodiversity base", habitat: "grassland and hedgerow", reward: "pollinator map tile" },
  { key: "lab", place: "Micro-life observation lab", habitat: "prepared classroom samples", reward: "microscope log stamp" },
];

const observableCases = [
  { key: "backbone", evidence: "an internal skeleton with a backbone", answer: "useful evidence for placing the organism among vertebrates", wrong: ["only evidence about habitat", "a colour preference", "proof that the organism is a mammal"] },
  { key: "feathers", evidence: "feathers covering the body", answer: "strong observable evidence for the bird group", wrong: ["proof that it lives only in trees", "evidence for the fish group", "a feature shared by every vertebrate"] },
  { key: "six-legs", evidence: "six jointed legs and three main body parts", answer: "evidence consistent with an insect", wrong: ["evidence for an arachnid", "proof of a backbone", "a rule based only on size"] },
  { key: "eight-legs", evidence: "eight jointed legs and two main body regions", answer: "evidence consistent with an arachnid", wrong: ["evidence for an insect", "proof that it is a reptile", "evidence based on habitat alone"] },
  { key: "flowers", evidence: "flowers followed by seeds", answer: "useful evidence for a flowering plant", wrong: ["proof that it is a fungus", "evidence that every plant has flowers", "a rule based on picture brightness"] },
  { key: "spores", evidence: "spore-producing structures and no flowers observed", answer: "useful evidence for a non-flowering plant such as a fern", wrong: ["proof that it is an animal", "evidence that it makes cones", "a judgement about attractiveness"] },
  { key: "soft-body", evidence: "a soft unsegmented body, with a shell in this specimen", answer: "evidence consistent with a mollusc", wrong: ["proof that all molluscs have shells", "evidence for a vertebrate", "a habitat-only classification"] },
  { key: "hair-milk", evidence: "hair and evidence that young are fed milk", answer: "strong evidence for the mammal group", wrong: ["proof that it must live on land", "evidence for all animals", "a rule based on name length"] },
];

const keyCases = [
  { key: "snail", organism: "pond snail", evidence: ["no backbone", "soft body", "shell"], route: "Backbone? no -> jointed legs? no -> soft body? yes -> mollusc", answer: "mollusc", wrong: ["fish", "insect", "flowering plant"] },
  { key: "spider", organism: "garden spider", evidence: ["no backbone", "eight jointed legs", "two main body regions"], route: "Backbone? no -> jointed legs? yes -> six legs? no -> eight legs? yes -> arachnid", answer: "arachnid", wrong: ["insect", "reptile", "mollusc"] },
  { key: "beetle", organism: "beetle", evidence: ["no backbone", "six jointed legs", "three main body parts"], route: "Backbone? no -> jointed legs? yes -> six legs? yes -> insect", answer: "insect", wrong: ["arachnid", "amphibian", "annelid"] },
  { key: "frog", organism: "adult frog", evidence: ["backbone", "moist skin", "life cycle includes an aquatic larval stage"], route: "Backbone? yes -> feathers? no -> hair? no -> moist skin and aquatic larval stage? yes -> amphibian", answer: "amphibian", wrong: ["reptile", "fish", "insect"] },
  { key: "fern", organism: "fern", evidence: ["plant structures", "no flowers", "spores beneath fronds"], route: "Animal features? no -> photosynthetic plant? yes -> flowers? no -> spores? yes -> non-flowering plant", answer: "non-flowering plant", wrong: ["flowering plant", "fungus", "micro-organism"] },
  { key: "oak", organism: "oak tree", evidence: ["plant structures", "flowers are small", "seeds form as acorns"], route: "Plant? yes -> produces flowers and seeds? yes -> flowering plant", answer: "flowering plant", wrong: ["non-flowering plant", "fungus", "invertebrate"] },
  { key: "salmon", organism: "salmon", evidence: ["backbone", "gills", "fins"], route: "Backbone? yes -> feathers? no -> gills and fins? yes -> fish", answer: "fish", wrong: ["amphibian", "mammal", "mollusc"] },
  { key: "blackbird", organism: "blackbird", evidence: ["backbone", "feathers", "beak"], route: "Backbone? yes -> feathers? yes -> bird", answer: "bird", wrong: ["mammal", "reptile", "insect"] },
];

const domainCases = [
  { key: "yeast", prompt: "Yeast cells are living fungi often used in bread making. Which claim is supported?", answer: "Yeast is a micro-organism that can be useful in food production.", wrong: ["All fungi are visible mushrooms.", "Every micro-organism causes illness.", "Yeast is a tiny animal."] },
  { key: "bacteria-decompose", prompt: "Evidence shows bacteria breaking down dead material in compost. Which claim is careful?", answer: "Some bacteria act as decomposers and recycle materials.", wrong: ["All bacteria are harmful.", "Dead material is a classification group.", "Bacteria are non-living dust."] },
  { key: "bacteria-harmful", prompt: "A reviewed source identifies one bacterium that can cause disease. What follows?", answer: "That bacterium can be harmful, but the evidence does not show that all bacteria are harmful.", wrong: ["All micro-organisms are dangerous.", "No bacteria can be useful.", "Anything microscopic is a bacterium."] },
  { key: "fungus", prompt: "A mushroom has no chlorophyll and produces spores. Which broad grouping is supported?", answer: "It is a fungus, not a plant simply because it grows in soil.", wrong: ["It is a plant because it does not move.", "It is an animal because it consumes materials.", "Its habitat proves its group."] },
  { key: "flowering", prompt: "A buttercup produces flowers and seeds. Which plant group evidence is strongest?", answer: "Flowers and seeds support classification as a flowering plant.", wrong: ["Yellow colour alone proves the group.", "All plants make visible flowers.", "Living in a meadow is enough."] },
  { key: "conifer", prompt: "A conifer produces seeds in cones but no flowers. Which claim is supported?", answer: "It is a seed-producing non-flowering plant in this Year 6 grouping.", wrong: ["All non-flowering plants reproduce only by spores.", "It is a fungus because it has no flowers.", "Needle-shaped leaves make it an animal."] },
  { key: "animal", prompt: "A specimen feeds, moves independently and has animal body structures. Which broad group is supported?", answer: "The evidence supports classification as an animal before a more specific group is tested.", wrong: ["Movement alone proves it is a mammal.", "Habitat decides the complete classification.", "Every living thing that moves is a vertebrate."] },
  { key: "microscopic-alga", prompt: "A microscopic organism contains chlorophyll and photosynthesises. Which conclusion is careful?", answer: "It is a photosynthetic micro-organism; more evidence is needed for a narrower group.", wrong: ["It must be a large flowering plant.", "Every green speck is the same species.", "Microscopic means harmful."] },
];

const vertebrateCases = [
  { key: "mammal", evidence: "backbone, hair and young fed milk", answer: "mammal", wrong: ["bird", "reptile", "insect"] },
  { key: "bird", evidence: "backbone and feathers", answer: "bird", wrong: ["mammal", "fish", "arachnid"] },
  { key: "fish", evidence: "backbone, gills and fins", answer: "fish", wrong: ["amphibian", "mollusc", "bird"] },
  { key: "amphibian", evidence: "backbone, moist skin and an aquatic larval stage", answer: "amphibian", wrong: ["reptile", "fish", "annelid"] },
  { key: "reptile", evidence: "backbone and dry scaly skin", answer: "reptile", wrong: ["amphibian", "mammal", "insect"] },
  { key: "insect", evidence: "no backbone, six jointed legs and three main body parts", answer: "insect", wrong: ["arachnid", "crustacean", "bird"] },
  { key: "arachnid", evidence: "no backbone, eight jointed legs and two main body regions", answer: "arachnid", wrong: ["insect", "mollusc", "reptile"] },
  { key: "annelid", evidence: "no backbone and a long segmented body without jointed legs", answer: "annelid worm", wrong: ["mollusc", "fish", "insect"] },
];

const evidenceCases = [
  { key: "habitat", claim: "The duck and duckweed are the same group because both live in a pond.", answer: "Reject: shared habitat is context; compare animal and plant characteristics.", wrong: ["Accept because habitat always defines biological group.", "Compare their picture colours.", "Group them because their names start alike."] },
  { key: "colour", claim: "Two beetles are different major groups because one is green and one is brown.", answer: "Reject: colour may vary; test stable structural features such as legs and body parts.", wrong: ["Accept because colour is always the strongest feature.", "Use which beetle looks larger.", "Classify by favourite colour."] },
  { key: "one-feature", claim: "The organism has wings, so it must be a bird.", answer: "Reject: insects and some other animals have wings; check backbone and feathers.", wrong: ["Accept because only birds have wings.", "Use flight height instead.", "Ignore all other evidence."] },
  { key: "source", claim: "A card says the specimen has a backbone, but the photograph cannot show inside it.", answer: "Use the stated reviewed evidence; internal characteristics can be supported by reliable observations or records.", wrong: ["Ignore all internal features.", "Guess from habitat.", "Use colour because it is visible."] },
  { key: "multiple", claim: "A mystery animal has eight legs. Is that enough for the narrowest classification?", answer: "Eight legs supports arachnid, but check jointed legs and body-region evidence too.", wrong: ["One number always proves a species.", "Eight legs means insect.", "Habitat is the only next check."] },
  { key: "negative", claim: "No flowers were seen during one winter visit, so the plant never flowers.", answer: "The observation is limited; use seasonal records or other reproductive evidence before concluding.", wrong: ["Absence in one visit proves it never flowers.", "Winter habitat defines the group.", "Leaf colour proves seed type."] },
  { key: "micro", claim: "The sample contains tiny moving dots, so they are all living micro-organisms.", answer: "Size and movement in one view are insufficient; use controlled observation and reviewed evidence.", wrong: ["Every tiny dot is alive.", "Every moving speck is harmful.", "Name the organisms without more evidence."] },
  { key: "repeat", claim: "One uncertain measurement disagrees with three clear feature records.", answer: "Repeat the uncertain observation and weigh the consistent relevant evidence.", wrong: ["Discard every previous record.", "Choose the most surprising result.", "Classify by the recorder's preference."] },
];

const ambiguityCases = [
  { key: "all-yes", set: "oak, fern, mushroom and snail", question: "Is it a living thing?", answer: "Revise it because every card follows the same yes branch.", wrong: ["Keep it because a key should never split cards.", "Replace it with 'Is it interesting?'", "Use picture colour instead."] },
  { key: "subjective", set: "beetle, spider, snail and worm", question: "Is it creepy?", answer: "Replace it with a testable structural question such as 'Does it have jointed legs?'.", wrong: ["Keep it because opinions are observable.", "Ask whether its name sounds nice.", "Sort by who likes it."] },
  { key: "unclear-size", set: "oak leaf, fern frond, moss and grass", question: "Is it big?", answer: "Specify a measurable threshold or choose a more stable biological feature.", wrong: ["Keep 'big' because everyone judges size identically.", "Use green/not green from one photo.", "Ask whether it lives outside."] },
  { key: "season", set: "flowering plants photographed in winter", question: "Can you see a flower now?", answer: "Use records of flower or seed production, because a single seasonal image may be incomplete.", wrong: ["Classify every plant without a visible winter flower as a fern.", "Use brightness instead.", "Assume photographs show every life stage."] },
  { key: "unknown", set: "four mystery invertebrates", question: "Does it have a backbone?", answer: "The question is valid but does not split this all-invertebrate set; choose a jointed-leg or body-segmentation question next.", wrong: ["The question is scientifically false.", "Guess the names instead.", "Move one card randomly to the yes branch."] },
  { key: "shell", set: "snail, slug, mussel and earthworm", question: "Does it have a shell?", answer: "Useful first split, but it cannot alone identify every organism; continue with further evidence questions.", wrong: ["A single question must always name every card.", "No shell means vertebrate.", "Shell colour identifies the species."] },
  { key: "missing-evidence", set: "a blurred mystery organism card", question: "Does it have six legs?", answer: "Mark the route unresolved until clearer leg evidence is available; do not guess.", wrong: ["Choose yes because insects are common.", "Choose no because the image is blurred.", "Classify from the habitat label alone."] },
  { key: "overlap", set: "bat, bird, butterfly and flying fish", question: "Can it move through the air?", answer: "Use backbone, feathers and leg/body evidence because flight does not map to one group.", wrong: ["Put every flying organism in the bird group.", "Flight proves vertebrate.", "Use speed as the only group rule."] },
];

const misconceptionCases = [
  { key: "all-microbes", claim: "All micro-organisms are harmful.", answer: "Reject: micro-organisms can be helpful, harmful or neutral; classify claims using specific evidence.", tag: "all_microbes_harmful" },
  { key: "habitat", claim: "Everything living in water belongs to the same biological group.", answer: "Reject: habitat is not enough; compare characteristics such as backbone, plant structures and body form.", tag: "habitat_as_group" },
  { key: "name-guess", claim: "A classification key is a way to guess an organism from its name.", answer: "Reject: follow each yes/no question using the supplied characteristic evidence.", tag: "key_as_name_guess" },
  { key: "weak-rule", claim: "A useful key question can be based on which organism looks nicest.", answer: "Reject: key questions must be testable, unambiguous and able to split the current set usefully.", tag: "weak_feature_rule" },
  { key: "all-plants-flower", claim: "All plants produce flowers.", answer: "Reject: flowering plants do, while ferns and mosses reproduce using spores and conifers produce seeds in cones.", tag: "all_plants_flower" },
  { key: "all-invertebrates-insects", claim: "Every animal without a backbone is an insect.", answer: "Reject: invertebrates include insects, arachnids, molluscs, annelids and other groups.", tag: "invertebrate_means_insect" },
  { key: "single-feature", claim: "One shared feature always proves two organisms are in the same narrow group.", answer: "Reject: use a relevant combination of characteristics and state when evidence is insufficient.", tag: "one_visible_feature_only" },
  { key: "key-never-revise", claim: "If a key sends every organism down one branch, the organisms are wrong.", answer: "Reject: test and revise the question so it creates a useful evidence-based split.", tag: "weak_feature_rule" },
];

const candidates = [
  ...expand("observable", 34, observableCases, buildObservable),
  ...expand("keys", 34, keyCases, buildKey),
  ...expand("domains", 34, domainCases, buildDomain),
  ...expand("vertebrates", 34, vertebrateCases, buildVertebrate),
  ...expand("evidence", 33, evidenceCases, buildEvidence),
  ...expand("ambiguity", 33, ambiguityCases, buildAmbiguity),
  ...expand("misconceptions", 33, misconceptionCases, buildMisconception),
];

pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Depth-wave review bank reaches the 240-item pilot target with five preserved curated questions and 235 deterministic candidates covering observable characteristics, classification-key navigation and construction, micro-organisms/plants/animals, vertebrate and invertebrate groups, evidence quality, ambiguity and misconception repair. Generated candidates provide SEND multimodal routes, keyboard/switch/oral and non-drag interactions, rich evidence-and-revision feedback, calm microorganism language and field-research missions without timers, lost lives or streak pressure. Human science, teacher, SEND, accessibility, safeguarding, organism-example and renderer review remains required before promotion.";

validateBank(pack, curated, candidates);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`classification-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`classification-bank strands=${summary(candidates, (variant) => variant.body.classification_strand)}`);
console.log(`classification-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`classification-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`classification-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 6 classification bank is out of date; run generate-y6-classification-bank.mjs --write.");
  console.log("classification-bank deterministic check passed");
} else {
  console.log("classification-bank dry-run; pass --write to update the pack");
}

function buildObservable(item, mission, index, id) { return candidate({ id, format: "feature-sort", blueprint: "observable-feature-sorts", band: "intro", strand: "observable_characteristics", mission, prompt: `Feature survey ${index + 1}: the evidence card says '${item.evidence}'. What is its best classification use?`, choices: [item.answer, ...item.wrong], answer: item.answer, evidence: [item.evidence], route: "observe -> name characteristic -> choose supported group use", hints: ["Use a biological characteristic rather than colour, preference or location.", "Ask whether the evidence supports a broad group or a narrower one; do not claim more than it shows."], explanation: `${item.answer}. The characteristic is observable or supported by a reviewed record and is relevant to grouping, while the distractors overclaim or use unrelated context.`, tag: "one_visible_feature_only", repair: "Match a photograph, simple-text feature chip and tactile outline card to the same non-colour characteristic." }); }
function buildKey(item, mission, index, id) {
  const builder = index % 2 === 1;
  return candidate({ id, format: builder ? "key-builder" : "classification-key", blueprint: builder ? "key-question-builds" : "branching-key-navigation", band: builder ? "expected" : "developing", strand: "classification_keys", mission, prompt: builder ? `Key-builder mission ${index + 1}: evidence for the ${item.organism} is ${item.evidence.join(", ")}. Which route correctly uses answerable yes/no questions?` : `Key route ${index + 1}: follow '${item.route}' for the ${item.organism}. Which group is reached?`, choices: builder ? [item.route, "Guess from the habitat before reading features", "Choose the group whose name sounds similar", "Ask an opinion question at each branch"] : [item.answer, ...item.wrong], answer: builder ? item.route : item.answer, evidence: item.evidence, route: item.route, hints: ["Answer one yes/no question from the supplied evidence before moving to the next branch.", "A useful route narrows the set; it does not guess from name, habitat or picture colour."], explanation: `${item.route}, reaching ${item.answer}. Each decision is supported by a stated characteristic and the route remains reproducible for another researcher.`, tag: builder ? "weak_feature_rule" : "key_as_name_guess", repair: "Use static numbered breadcrumbs, yes/no buttons and a text-only branch list; allow backtracking without losing progress." });
}
function buildDomain(item, mission, index, id) { return candidate({ id, format: "claim-evidence-explain", blueprint: index % 2 ? "microorganism-claim-evidence" : "classification-claims-and-ambiguity", band: "secure", strand: "microorganisms_plants_animals", mission, prompt: `Living-groups briefing ${index + 1}: ${item.prompt}`, choices: [item.answer, ...item.wrong], answer: item.answer, evidence: [item.prompt], route: "claim -> relevant evidence -> cautious group conclusion", hints: ["Separate organism size, habitat and effect from biological group evidence.", "Use 'some', 'can' or 'more evidence is needed' when the evidence does not justify an all-or-nothing claim."], explanation: `${item.answer} The conclusion matches the evidence without treating every micro-organism, plant, animal, bacterium or fungus as identical.`, tag: item.key.includes("bacteria") || item.key === "yeast" ? "all_microbes_harmful" : "broad_group_overgeneralisation", repair: "Choose a photo/diagram, narrated evidence card, simple-text claim and concrete sorting token, then connect only evidence that supports the claim." }); }
function buildVertebrate(item, mission, index, id) { return candidate({ id, format: "feature-sort", blueprint: "major-group-evidence", band: "expected", strand: "vertebrate_invertebrate_groups", mission, prompt: `Major-group station ${index + 1}: an organism has ${item.evidence}. Which Year 6 group is best supported?`, choices: [item.answer, ...item.wrong], answer: item.answer, evidence: item.evidence.split(", "), route: "backbone decision -> structural features -> supported major group", hints: ["First decide whether backbone evidence places it among vertebrates or invertebrates.", "Then use feathers, hair/milk, gills/fins, skin, legs or body segmentation to narrow the group."], explanation: `${item.answer} is supported by ${item.evidence}. These characteristics are more reliable than habitat, colour, size or a familiar name.`, tag: item.answer === "insect" ? "invertebrate_means_insect" : "habitat_as_group", repair: "Use a backbone yes/no mat followed by labelled group feature cards; reveal one characteristic family at a time." }); }
function buildEvidence(item, mission, index, id) { return candidate({ id, format: "claim-evidence-explain", blueprint: "classification-claims-and-ambiguity", band: "secure", strand: "evidence", mission, prompt: `Evidence tribunal ${index + 1}: a researcher claims, '${item.claim}' Which response uses classification evidence carefully?`, choices: [item.answer, ...item.wrong], answer: item.answer, evidence: [item.claim], route: "identify claim -> test evidence relevance and sufficiency -> accept, limit or reject", hints: ["Ask whether the feature is stable, relevant and actually observed or reliably recorded.", "Distinguish evidence that supports a broad group from evidence sufficient for a narrow identification."], explanation: `${item.answer} This response weighs relevance, reliability and sufficiency instead of accepting a claim from one weak feature or context detail.`, tag: "insufficient_evidence_overclaim", repair: "Sort evidence cards into SUPPORTS, DOES NOT SUPPORT and NEEDS MORE OBSERVATION, with a spoken or text justification option." }); }
function buildAmbiguity(item, mission, index, id) { return candidate({ id, format: "key-builder", blueprint: "key-question-builds", band: "expected", strand: "ambiguity", mission, prompt: `Key quality lab ${index + 1}: for ${item.set}, the proposed question is '${item.question}' Which revision decision is best?`, choices: [item.answer, ...item.wrong], answer: item.answer, evidence: [item.set, item.question], route: "test wording -> preview yes/no split -> check unresolved cards -> revise", hints: ["A question must be answerable consistently from available evidence.", "Preview both branches: a valid question can still be unhelpful if every current card follows one branch."], explanation: `${item.answer} Good keys use precise, observable questions, handle missing evidence honestly and are revised when a branch is ambiguous or unhelpful.`, tag: "weak_feature_rule", repair: "Preview each card under YES, NO or EVIDENCE MISSING columns, then edit one phrase and retest the split." }); }
function buildMisconception(item, mission, index, id) { return candidate({ id, format: "classification-key", blueprint: "classification-retrieval", band: "retrieval", strand: "misconceptions", mission, prompt: `Field-guide review ${index + 1}: a learner says, '${item.claim}' Which response repairs the idea?`, choices: [item.answer, "Accept the claim because it sounds like a familiar rule.", "Say only that it is wrong without using evidence.", "Classify by colour, habitat or preference instead."], answer: item.answer, evidence: [item.claim], route: "spot misconception -> test with counterexample or feature evidence -> state replacement rule", hints: ["Find a counterexample or classification feature that tests the claim.", "Give a replacement rule that can be reused in the next key or evidence task."], explanation: `${item.answer} The repair replaces an overgeneralisation with an evidence-based classification action and supports future key decisions.`, tag: item.tag, repair: "Offer a feature sort, static key, narrated evidence or oral teach-back route, then test the corrected rule on a new organism." }); }

function candidate({ id, format, blueprint, band, strand, mission, prompt, choices, answer, evidence, route, hints, explanation, tag, repair }) {
  const fullId = `${prefix}${id}`;
  const uniqueChoices = rotate([...new Set(choices)], fullId.length % new Set(choices).size);
  const richExplanation = `${explanation} The classification remains open to revision if new reliable characteristics are added.`;
  return {
    id: fullId,
    format,
    body: {
      prompt,
      choices: uniqueChoices,
      evidence,
      classification_route: route,
      classification_strand: strand,
      difficulty_band: band,
      evidence_purpose: `${strand}_observe_classify_explain`,
      variant_blueprint_id: blueprint,
      review_batch: "depth-wave",
      response_mode: "tap_keyboard_switch_oral_or_partner_response",
      interaction_support: { keyboard: true, switch_scan: true, touch: true, oral_or_partner_response: true, precision_drag_required: false, yes_no_buttons: true, move_controls: true, undo_and_backtrack: true },
      multimodal_routes: { visual: "labelled organism diagram with non-colour feature markers", text: "simple-text evidence chips and numbered key breadcrumbs", audio_or_adult_read: "organism name, evidence and branch question without supplying the answer", tactile_or_manipulative: "unpowered organism and feature cards on yes/no or group mats", reduced_load: "one organism, question and evidence family visible at a time" },
      colour_required: false,
      timer_allowed: false,
      speed_score_allowed: false,
      leaderboard_allowed: false,
      field_mission: { place: mission.place, habitat_context: mission.habitat, strategic_unlock: "record a characteristic, follow or revise the key, then justify the group", reward: `add one ${mission.reward} to the shared biodiversity atlas`, loss_on_error: false, streak_pressure: false, retry_message: "The observation gives the team a useful clue. Keep the evidence, revise one branch or claim, and continue when ready." },
    },
    expected_answer: { value: answer },
    hints,
    explanation: richExplanation,
    feedback: { correct: `Field record supported. ${richExplanation}`, evidence_feedback: "Name the exact characteristic that supports the route or claim.", ambiguity_check: "State whether the evidence is sufficient, missing, seasonal, variable or open to more than one route.", revision_feedback: repair, misconception_repair: `That option may fit '${tag}'. Test it against the evidence rather than a name, habitat, colour or preference.` },
    difficulty: { intro: 2, developing: 4, expected: 5, secure: 7, retrieval: 5 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: format === "classification-key" ? "branching-key-route" : format === "key-builder" ? "key-question-test" : format === "feature-sort" ? "feature-chip-focus" : "evidence-claim-link",
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
    { id: "major-group-evidence", format: "feature-sort", count: 300, difficulty_band: "expected", misconception_tag: "habitat_as_group", purpose: "Use combinations of backbone, covering, limb and body-structure evidence to classify vertebrate and invertebrate groups.", generation_pattern: "feature record + backbone split + major-group choices + evidence explanation", review_notes: "Avoid implying that one habitat, colour or exceptional feature defines the whole group.", source: "ai_drafted_teacher_reviewed" },
    { id: "classification-claims-and-ambiguity", format: "claim-evidence-explain", count: 300, difficulty_band: "secure", misconception_tag: "insufficient_evidence_overclaim", purpose: "Evaluate evidence sufficiency, ambiguous observations and broad claims across plants, animals, fungi and micro-organisms.", generation_pattern: "claim + evidence cards + sufficient/limited/ambiguous decision + revision", review_notes: "Keep micro-organism and illness references calm, factual and non-alarming.", source: "ai_drafted_teacher_reviewed" },
  ];
  for (const blueprint of additions) if (!currentPack.variant_blueprints.some((existing) => existing.id === blueprint.id)) currentPack.variant_blueprints.push(blueprint);
}

function validateBank(currentPack, authored, generated) {
  if (authored.length !== 5) throw new Error(`Expected five curated variants, found ${authored.length}.`);
  if (generated.length !== pilotTarget - authored.length || currentPack.question_variants.length !== pilotTarget) throw new Error(`Expected ${pilotTarget} total variants with ${pilotTarget - authored.length} generated.`);
  const blueprints = new Map(currentPack.variant_blueprints.map((item) => [item.id, item]));
  const formats = new Set(currentPack.practice.formats);
  const ids = new Set();
  const signatures = new Set();
  const strands = new Set();
  const actualFormats = new Set();
  const actualBlueprints = new Set();
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
    if (!item.body.evidence?.length || !item.body.classification_route) throw new Error(`${item.id} lacks evidence or a classification route.`);
    if (!item.body.interaction_support?.keyboard || !item.body.interaction_support?.switch_scan || !item.body.interaction_support?.oral_or_partner_response || item.body.interaction_support?.precision_drag_required !== false) throw new Error(`${item.id} lacks supported interactions.`);
    if (!item.body.multimodal_routes?.visual || !item.body.multimodal_routes?.text || !item.body.multimodal_routes?.audio_or_adult_read || !item.body.multimodal_routes?.tactile_or_manipulative || !item.body.multimodal_routes?.reduced_load) throw new Error(`${item.id} lacks SEND multimodal routes.`);
    if (item.body.timer_allowed !== false || item.body.speed_score_allowed !== false || item.body.leaderboard_allowed !== false || item.body.field_mission?.loss_on_error !== false || item.body.field_mission?.streak_pressure !== false || !item.body.field_mission?.strategic_unlock) throw new Error(`${item.id} has unsuitable field-research gamification.`);
    if (!item.feedback?.correct || !item.feedback?.evidence_feedback || !item.feedback?.ambiguity_check || !item.feedback?.revision_feedback || !item.feedback?.misconception_repair || item.hints.length < 2 || item.explanation.length < 100) throw new Error(`${item.id} lacks rich feedback.`);
    if (!Array.isArray(item.body.choices) || item.body.choices.length < 4 || new Set(item.body.choices).size !== item.body.choices.length || item.body.choices.filter((choice) => choice === item.expected_answer.value).length !== 1) throw new Error(`${item.id} has invalid choices.`);
    strands.add(item.body.classification_strand);
    actualFormats.add(item.format);
    actualBlueprints.add(item.body.variant_blueprint_id);
  }
  requireCoverage("strands", ["observable_characteristics", "classification_keys", "microorganisms_plants_animals", "vertebrate_invertebrate_groups", "evidence", "ambiguity", "misconceptions"], strands);
  requireCoverage("formats", [...formats], actualFormats);
  requireCoverage("blueprints", [...blueprints.keys()], actualBlueprints);
}

function requireCoverage(label, required, actual) { const missing = required.filter((item) => !actual.has(item)); if (missing.length) throw new Error(`Generated bank is missing ${label}: ${missing.join(", ")}.`); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function summary(items, keyFor) { const counts = new Map(); for (const item of items) counts.set(keyFor(item), (counts.get(keyFor(item)) ?? 0) + 1); return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
