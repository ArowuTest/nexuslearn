#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/sc-y1-animals-including-humans.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y1-animals-humans-bank-";
const reviewBatch = "y1-animals-humans-pilot-a";
const pilotAllocation = {
  "common-animal-audio-identification": 40,
  "five-vertebrate-group-sorts": 40,
  "animal-structure-comparisons": 40,
  "human-body-sense-matches": 40,
  "animal-evidence-retrieval-transfer": 40,
};

const animals = [
  animal("dog", "mammal", "fur", "four legs", "paws", "puppy", "adult dog"),
  animal("cat", "mammal", "fur", "four legs", "paws", "kitten", "adult cat"),
  animal("rabbit", "mammal", "fur", "four legs", "long ears", "young rabbit", "adult rabbit"),
  animal("cow", "mammal", "hair", "four legs", "hooves", "calf", "adult cow"),
  animal("human", "mammal", "some body hair", "two legs", "hands", "baby", "adult human"),
  animal("whale", "mammal", "smooth skin", "flippers", "tail flukes", "calf", "adult whale"),
  animal("robin", "bird", "feathers", "two legs", "beak", "chick", "adult robin"),
  animal("duck", "bird", "feathers", "two legs", "webbed feet", "duckling", "adult duck"),
  animal("chicken", "bird", "feathers", "two legs", "beak", "chick", "adult chicken"),
  animal("owl", "bird", "feathers", "two legs", "wings", "owlet", "adult owl"),
  animal("penguin", "bird", "feathers", "two legs", "flipper-shaped wings", "chick", "adult penguin"),
  animal("goldfish", "fish", "scales", "fins", "gills", "young goldfish", "adult goldfish"),
  animal("salmon", "fish", "scales", "fins", "gills", "young salmon", "adult salmon"),
  animal("shark", "fish", "rough skin", "fins", "gills", "shark pup", "adult shark"),
  animal("frog", "amphibian", "smooth moist skin", "four legs as an adult", "wide mouth", "tadpole", "adult frog"),
  animal("toad", "amphibian", "bumpy skin", "four legs as an adult", "wide mouth", "tadpole", "adult toad"),
  animal("newt", "amphibian", "smooth moist skin", "four legs as an adult", "long tail", "newt larva", "adult newt"),
  animal("snake", "reptile", "dry scales", "no legs", "forked tongue", "hatchling", "adult snake"),
  animal("lizard", "reptile", "dry scales", "four legs", "long tail", "hatchling", "adult lizard"),
  animal("tortoise", "reptile", "dry scaly skin", "four legs", "hard shell", "hatchling", "adult tortoise"),
  animal("crocodile", "reptile", "dry scales", "four legs", "long snout", "hatchling", "adult crocodile"),
];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y1-animals-including-humans") throw new Error("This generator only supports the Year 1 animals including humans pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedCounts = countBy(curated, (variant) => variant.body?.variant_blueprint_id);
const targets = Object.fromEntries(Object.entries(pilotAllocation).map(([id, target]) => [id, target - (curatedCounts[id] ?? 0)]));
for (const [id, target] of Object.entries(targets)) if (target < 0) throw new Error(`Curated variants exceed the allocation for ${id}.`);

const generated = [
  ...identificationCandidates(targets["common-animal-audio-identification"]),
  ...groupCandidates(targets["five-vertebrate-group-sorts"]),
  ...comparisonCandidates(targets["animal-structure-comparisons"]),
  ...senseCandidates(targets["human-body-sense-matches"]),
  ...retrievalCandidates(targets["animal-evidence-retrieval-transfer"]),
];

pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa.notes = "Review-stage Year 1 animals-including-humans pack with a deterministic 200-item pilot bank. Four curated variants are preserved alongside candidates covering familiar animal identification, body parts and coverings, the five broad vertebrate groups, human senses, simple shared animal needs, growth from young to adult, evidence-based comparisons and misconception repair. Every generated item includes clear visual descriptions, tactile or object alternatives, supported response routes, explicit evidence feedback, unlimited thinking time and low-pressure explorer missions rewarded for observing and explaining rather than speed. Species, image, inclusion, safeguarding, teacher and renderer review remains required before promotion.";

validateBank(pack, curated, generated);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y1-animals-humans-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y1-animals-humans-bank blueprints=${summary(pack.question_variants, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`y1-animals-humans-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y1-animals-humans-bank concepts=${summary(generated, (variant) => variant.body.concept_focus)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y1-animals-humans-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 1 animals-and-humans bank is out of date; run generate-y1-animals-humans-bank.mjs --write.");
  console.log("y1-animals-humans-bank deterministic check passed");
} else {
  console.log("y1-animals-humans-bank dry-run; pass --write to update the pack");
}

function identificationCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = animals[index % animals.length];
    const mode = Math.floor(index / animals.length) % 2;
    if (mode === 0) {
      const choices = rotate(unique([item.name, ...animalDistractors(item)]), index % 3);
      return candidate({
        id: `identify-${item.name}-${index + 1}`, format: "feature-tap", blueprint: "common-animal-audio-identification", band: "intro", concept: "animal_identification",
        prompt: `Explorer scan ${index + 1}: which animal has the pictured ${item.covering}, ${item.limbs} and ${item.feature}?`,
        body: { animal: item.name, picture_description: `A calm side view of a ${item.name}, clearly showing ${item.covering}, ${item.limbs} and ${item.feature}.`, choices, hotspots: [item.covering, item.limbs, item.feature], interaction_mode: "choose_animal_or_point_to_matching_model" }, answer: item.name,
        hints: ["Look at the whole body shape before choosing.", `Notice the ${item.feature} and ${item.covering}.`],
        explanation: `The picture shows a ${item.name}. Its visible features include ${item.covering}, ${item.limbs} and ${item.feature}.`, difficulty: 2, tag: "single_striking_feature", hook: "explorer-feature-lens",
        correctFeedback: `Animal record found: ${item.name}. You used more than one visible feature.`, repair: "Keep one correct observation, reveal one body-part label, then compare the full animal shapes again.",
        tactile: `Use a raised-outline ${item.name} card with separate textures for ${item.covering} and ${item.feature}, plus an adult audio description.`,
      });
    }
    const answer = item.feature;
    const choices = rotate(unique([answer, item.covering, item.limbs, "wings"]), index % 4);
    return candidate({
      id: `part-${item.name}-${index + 1}`, format: "feature-tap", blueprint: "common-animal-audio-identification", band: "intro", concept: "body_part_identification",
      prompt: `Body-part trail ${index + 1}: which labelled feature belongs on the ${item.name} model?`,
      body: { animal: item.name, picture_description: `A labelled outline of a ${item.name} with a blank marker beside its ${item.feature}.`, choices, hotspots: choices, interaction_mode: "tap_label_keyboard_switch_or_place_tactile_token" }, answer,
      hints: ["Listen to each body-part label.", `Find the part described as ${item.feature}.`],
      explanation: `The marked body part is ${item.feature}. A ${item.name} also has ${item.covering} and ${item.limbs}.`, difficulty: 2, tag: "all_bodies_like_humans", hook: "explorer-body-map",
      correctFeedback: `Body map updated: ${item.feature} belongs on this ${item.name} model.`, repair: "Compare the blank marker with the raised-outline or audio-described model, then choose one label at a time.",
      tactile: `Use a raised animal outline and a detachable textured token shaped for ${item.feature}; allow hand-under-hand guidance only with consent.`,
    });
  });
}

function groupCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = animals[(index * 5 + 3) % animals.length];
    const groupFeatures = featureForGroup(item.group);
    const choices = rotate(unique([item.group, ...groupDistractors(item.group, index)]), index % 3);
    return candidate({
      id: `group-${item.name}-${index + 1}`, format: "picture-sort", blueprint: "five-vertebrate-group-sorts", band: "developing", concept: "vertebrate_grouping",
      prompt: `Wildlife log ${index + 1}: place the ${item.name} in its broad animal group using body clues.`,
      body: { animal: item.name, choices, group_mats: choices, picture_description: `A clear ${item.name} showing ${item.covering}, ${item.limbs} and ${item.feature}.`, evidence_features: groupFeatures, habitat_not_decisive: true, interaction_mode: "tap_group_keyboard_switch_partner_scan_or_place_card" }, answer: item.group,
      hints: ["Where an animal lives is not enough to decide its group.", `Use this group clue: ${groupFeatures.join(" and ")}.`],
      explanation: `A ${item.name} is a ${item.group}. Useful clues are ${groupFeatures.join(" and ")}; habitat alone does not name the group.`, difficulty: 3 + (index % 2), tag: item.name === "whale" || item.name === "penguin" ? "habitat_only_grouping" : "one_feature_decides_every_group", hook: "explorer-group-camp",
      correctFeedback: `Group log complete: ${item.name} → ${item.group}, supported by body evidence.`, repair: "Return the card to OBSERVE. Reveal covering, breathing or body-shape clues one at a time before sorting again.",
      tactile: `Use an embossed ${item.name} card and five audio-labelled group mats with distinct edge shapes, not colour alone.`,
    });
  });
}

function comparisonCandidates(count) {
  const pairs = [
    ["dog", "duck"], ["goldfish", "whale"], ["frog", "lizard"], ["human", "cat"], ["robin", "penguin"],
    ["snake", "rabbit"], ["tortoise", "duck"], ["shark", "salmon"], ["cow", "chicken"], ["newt", "frog"],
    ["owl", "cat"], ["crocodile", "goldfish"], ["whale", "human"],
  ];
  return Array.from({ length: count }, (_, index) => {
    const [leftName, rightName] = pairs[index % pairs.length];
    const left = animals.find((item) => item.name === leftName);
    const right = animals.find((item) => item.name === rightName);
    const mode = Math.floor(index / pairs.length) % 3;
    if (mode === 1) return growthComparison(left, right, index);
    if (mode === 2) return needsComparison(left, right, index);
    const sameGroup = left.group === right.group;
    const answer = sameGroup ? `Both are ${left.group}s, but their visible body shapes are not exactly the same.` : `They belong to different groups and have different visible body features.`;
    const choices = rotate([answer, "They are the same kind of animal because both can move.", "Every animal has the same body parts as a human."], index % 3);
    return candidate({
      id: `compare-structure-${slug(left.name)}-${slug(right.name)}-${index + 1}`, format: "feature-tap", blueprint: "animal-structure-comparisons", band: "expected", concept: "body_structure_comparison",
      prompt: `Compare station ${index + 1}: which statement best compares the ${left.name} and ${right.name}?`,
      body: { animals: [left.name, right.name], paired_picture_descriptions: [describe(left), describe(right)], choices, feature_rows: ["covering", "limbs or fins", "other visible feature"], interaction_mode: "choose_statement_or_build_same_different_chart" }, answer,
      hints: ["Name one feature on each animal.", "Sharing one feature does not make two animals exactly the same."],
      explanation: `${left.name}: ${left.covering}, ${left.limbs}, ${left.feature}. ${right.name}: ${right.covering}, ${right.limbs}, ${right.feature}. ${answer}`, difficulty: 4, tag: "all_bodies_like_humans", hook: "explorer-compare-panels",
      correctFeedback: "Comparison recorded with observable body evidence, not just size, colour or habitat.", repair: "Use the SAME/DIFFERENT chart. Compare covering first, then limbs or fins, then one other feature.",
      tactile: `Use two raised-outline animal cards and textured feature tokens for ${left.covering} and ${right.covering}.`,
    });
  });
}

function growthComparison(left, right, index) {
  const answer = `Both can grow from a young animal into an adult of the same kind.`;
  const choices = rotate([answer, "Young animals stay the same size forever.", "Every young animal looks exactly like a small human."], index % 3);
  return candidate({
    id: `compare-growth-${slug(left.name)}-${slug(right.name)}-${index + 1}`, format: "feature-tap", blueprint: "animal-structure-comparisons", band: "expected", concept: "animal_growth",
    prompt: `Growth trail ${index + 1}: what is true about the ${left.young} and ${right.young}?`,
    body: { animals: [left.name, right.name], growth_cards: [[left.young, left.adult], [right.young, right.adult]], choices, interaction_mode: "match_young_adult_cards_or_choose_statement" }, answer,
    hints: ["Match each young animal to the same kind of adult.", "Animals grow and may change as they become adults."],
    explanation: `A ${left.young} can grow into an ${left.adult}; a ${right.young} can grow into an ${right.adult}. They grow, but one kind does not grow into another kind.`, difficulty: 4, tag: "young_animal_is_different_kind", hook: "explorer-growth-path",
    correctFeedback: "Growth paths linked: each young animal matches its own kind of adult.", repair: "Use one pair at a time. Match the animal name first, then notice changes in size or body shape.",
    tactile: "Use paired YOUNG and ADULT cards with matching edge notches and audio labels; do not rely on picture size alone.",
  });
}

function needsComparison(left, right, index) {
  const answer = "Both need water, food and air to stay alive.";
  const choices = rotate([answer, "Only pets need water and food.", "Animals need the same favourite food as humans."], index % 3);
  return candidate({
    id: `compare-needs-${slug(left.name)}-${slug(right.name)}-${index + 1}`, format: "feature-tap", blueprint: "animal-structure-comparisons", band: "expected", concept: "basic_animal_needs",
    prompt: `Needs station ${index + 1}: which need is shared by the ${left.name} and ${right.name}?`,
    body: { animals: [left.name, right.name], choices, need_symbols: ["water", "suitable food", "air", "safe suitable place"], qualification: "foods_and_places_differ_between_animals", interaction_mode: "choose_shared_need_or_place_need_tokens" }, answer,
    hints: ["Think about what keeps an animal alive.", "Different animals may eat different foods, but all need suitable food."],
    explanation: `${left.name}s and ${right.name}s both need water, suitable food and air. Their foods, bodies and suitable places can differ.`, difficulty: 4, tag: "pets_only_have_needs", hook: "explorer-needs-kit",
    correctFeedback: "Shared need found. The exact food or suitable place can differ between animals.", repair: "Sort NEEDS from LIKES. Use the water, suitable-food and air symbols before discussing different homes.",
    tactile: "Use tactile water-drop, food-bowl and air-swirl symbols with spoken labels; no real food or animal contact is required.",
  });
}

function senseCandidates(count) {
  const senses = [
    sense("sight", "eyes", "noticing the shape of a road sign", ["eyes", "ears", "nose"]),
    sense("hearing", "ears", "noticing a doorbell sound", ["ears", "eyes", "tongue"]),
    sense("smell", "nose", "noticing the smell of soap", ["nose", "ears", "hands"]),
    sense("taste", "tongue", "noticing a sweet taste in familiar safe food", ["tongue", "eyes", "ears"]),
    sense("touch", "skin", "noticing that a smooth cloth feels soft", ["skin", "nose", "eyes"]),
    sense("sight", "eyes", "noticing a large printed shape", ["eyes", "tongue", "ears"]),
    sense("hearing", "ears", "noticing a spoken name", ["ears", "nose", "skin"]),
    sense("smell", "nose", "noticing the smell of a flower from a safe distance", ["nose", "eyes", "tongue"]),
    sense("taste", "tongue", "noticing a salty taste in familiar safe food", ["tongue", "hands", "ears"]),
    sense("touch", "skin", "noticing that a cool spoon feels cool", ["skin", "eyes", "nose"]),
  ];
  return Array.from({ length: count }, (_, index) => {
    const item = senses[index % senses.length];
    const choices = rotate(item.choices, index % item.choices.length);
    return candidate({
      id: `sense-${item.sense}-${index + 1}`, format: "sense-match", blueprint: "human-body-sense-matches", band: "secure", concept: "human_senses",
      prompt: `Sense signal ${index + 1}: which body part is linked with ${item.context}?`,
      body: { sense: item.sense, context: item.context, choices, body_outline_hotspots: choices, sensory_exposure_required: false, inclusive_note: "People may experience senses differently and may use glasses, hearing devices, canes, AAC or other support.", interaction_mode: "tap_body_part_keyboard_switch_eye_gaze_aac_or_partner_scan" }, answer: item.part,
      hints: [`The sense is ${item.sense}.`, `The body part linked with ${item.sense} is ${item.part}.`],
      explanation: `${item.part} are linked with ${item.sense}. People may experience ${item.sense} differently or use helpful devices; no real sensory test is needed.`, difficulty: 3, tag: "sense_linked_to_object", hook: "explorer-sense-signal",
      correctFeedback: `Sense link made: ${item.part} → ${item.sense}.`, repair: "Hide the object picture, replay the sense word and match it to one body-part symbol.",
      tactile: `Use a tactile human outline with a removable ${item.part} symbol and spoken labels; accept pointing, signing, AAC or adult-observed responses.`,
    });
  });
}

function retrievalCandidates(count) {
  const modes = ["group", "needs", "growth", "human", "compare"];
  return Array.from({ length: count }, (_, index) => {
    const item = animals[(index * 4 + 1) % animals.length];
    const mode = modes[index % modes.length];
    if (mode === "needs") return retrievalNeed(item, index);
    if (mode === "growth") return retrievalGrowth(item, index);
    if (mode === "human") return retrievalHuman(index);
    if (mode === "compare") return retrievalCompare(item, animals[(index * 7 + 6) % animals.length], index);
    const choices = rotate(unique([item.group, ...groupDistractors(item.group, index)]), index % 3);
    return candidate({
      id: `retrieve-group-${item.name}-${index + 1}`, format: "picture-sort", blueprint: "animal-evidence-retrieval-transfer", band: "retrieval", concept: "group_evidence_retrieval",
      prompt: `Explorer revisit ${index + 1}: sort the ${item.name}, then choose the body clue that supports your choice.`,
      body: { animal: item.name, choices, accepted_evidence: featureForGroup(item.group), picture_description: describe(item), interaction_mode: "sort_then_choose_evidence_or_give_oral_aac_reason", review_interval_days: [1, 3, 7, 14, 30][index % 5] }, answer: item.group,
      hints: ["Name one body feature before choosing a group.", "Do not use habitat as the only clue."], explanation: `${item.name} belongs to the ${item.group} group. ${featureForGroup(item.group).join(" and ")} support the choice.`, difficulty: 3, tag: "habitat_only_grouping", hook: "explorer-revisit-map",
      correctFeedback: `Revisit complete: ${item.name} is a ${item.group}, with evidence.`, repair: "Reopen the feature card, choose one observable clue, then scan the audio-labelled group mats again.", tactile: `Use an embossed ${item.name} card and group mats with unique edge shapes and audio labels.`,
    });
  });
}

function retrievalNeed(item, index) {
  const answer = "water, suitable food and air";
  const choices = rotate([answer, "only a toy and a name", "the same food as every other animal"], index % 3);
  return candidate({
    id: `retrieve-needs-${item.name}-${index + 1}`, format: "picture-sort", blueprint: "animal-evidence-retrieval-transfer", band: "retrieval", concept: "basic_animal_needs",
    prompt: `Supply mission ${index + 1}: which set shows basic needs shared by the ${item.name} and other animals?`,
    body: { animal: item.name, choices, symbol_sets: choices, interaction_mode: "choose_symbol_set_keyboard_switch_or_partner_scan", review_interval_days: [1, 3, 7, 14, 30][index % 5] }, answer,
    hints: ["Choose what helps animals stay alive.", "Suitable foods can be different for different animals."], explanation: `A ${item.name}, like other animals, needs water, suitable food and air. A suitable safe place also helps it live and grow.`, difficulty: 3, tag: "pets_only_have_needs", hook: "explorer-supply-pack",
    correctFeedback: "Basic-needs kit complete: water, suitable food and air.", repair: "Sort each symbol into NEED or NOT A BASIC NEED, with audio labels and one choice shown at a time.", tactile: "Use tactile water, food and air symbols; no feeding, tasting or contact with a live animal is required.",
  });
}

function retrievalGrowth(item, index) {
  const answer = `${item.young} → ${item.adult}`;
  const wrongAdult = item.name === "cat" ? "adult robin" : "adult cat";
  const choices = rotate([answer, `${item.adult} → ${item.young}`, `${item.young} → ${wrongAdult}`], index % 3);
  return candidate({
    id: `retrieve-growth-${item.name}-${index + 1}`, format: "picture-sort", blueprint: "animal-evidence-retrieval-transfer", band: "retrieval", concept: "animal_growth",
    prompt: `Growth-map revisit ${index + 1}: which arrow shows the ${item.name} growing from young to adult?`,
    body: { animal: item.name, choices, stage_cards: [item.young, item.adult], interaction_mode: "order_cards_choose_arrow_or_say_sequence", review_interval_days: [1, 3, 7, 14, 30][index % 5] }, answer,
    hints: ["Put the young animal first.", "The adult must be the same kind of animal."], explanation: `The forward growth sequence is ${answer}. Animals grow; the adult does not change backwards into its own young stage.`, difficulty: 3, tag: "young_animal_is_different_kind", hook: "explorer-growth-revisit",
    correctFeedback: `Growth arrow placed: ${answer}.`, repair: "Use the YOUNG and ADULT audio labels, match the animal kind, then place the forward arrow.", tactile: "Use two stage cards with matching animal-shaped edge notches and a tactile forward arrow.",
  });
}

function retrievalHuman(index) {
  const answer = "Humans are animals in the mammal group.";
  const choices = rotate([answer, "Humans are not animals.", "Humans belong to the bird group."], index % 3);
  return candidate({
    id: `retrieve-human-${index + 1}`, format: "picture-sort", blueprint: "animal-evidence-retrieval-transfer", band: "retrieval", concept: "humans_are_mammals",
    prompt: `Human-animal link ${index + 1}: which statement belongs in the science explorer log?`, body: { animal: "human", choices, interaction_mode: "tap_keyboard_switch_aac_or_partner_scan", review_interval_days: [1, 3, 7, 14, 30][index % 5] }, answer,
    hints: ["Humans are living animals.", "The broad group for humans is mammals."], explanation: answer, difficulty: 3, tag: "humans_not_animals", hook: "explorer-human-link",
    correctFeedback: "Explorer log updated: humans are mammals and animals.", repair: "Place the human card inside ANIMALS first, then inside the audio-labelled MAMMALS group.", tactile: "Use nesting tactile mats labelled LIVING THINGS, ANIMALS and MAMMALS with partner-assisted placement.",
  });
}

function retrievalCompare(left, right, index) {
  const answer = `${left.name} has ${left.covering}; ${right.name} has ${right.covering}.`;
  const choices = rotate([answer, "They must have the same covering because both are animals.", "The larger picture shows the larger animal in real life."], index % 3);
  return candidate({
    id: `retrieve-compare-${left.name}-${right.name}-${index + 1}`, format: "picture-sort", blueprint: "animal-evidence-retrieval-transfer", band: "retrieval", concept: "evidence_based_comparison",
    prompt: `Evidence revisit ${index + 1}: which statement compares the pictured body coverings?`, body: { animals: [left.name, right.name], choices, picture_descriptions: [describe(left), describe(right)], interaction_mode: "choose_statement_point_to_coverings_or_use_aac", review_interval_days: [1, 3, 7, 14, 30][index % 5] }, answer,
    hints: ["Look at the covering on each body.", "Picture size and habitat do not answer this question."], explanation: answer, difficulty: 3, tag: "all_animals_same_covering", hook: "explorer-evidence-revisit",
    correctFeedback: "Covering comparison recorded from visible evidence.", repair: "Reveal one animal at a time, name its covering, then join the two observations in one sentence.", tactile: `Use separate texture swatches representing ${left.covering} and ${right.covering}, with spoken animal labels.`,
  });
}

function candidate({ id, format, blueprint, band, concept, prompt, body, answer, hints, explanation, difficulty, tag, hook, correctFeedback, repair, tactile }) {
  return {
    id: `${prefix}${id}`,
    format,
    body: {
      prompt, ...body,
      concept_focus: concept,
      response_mode: "tap_drag_keyboard_switch_eye_gaze_aac_oral_or_adult_scribed",
      supported_interaction: "adult_or_peer_may_read_scan_point_place_and_record_without_supplying_the_science_answer",
      visual_route: "large anatomically clear still images, high-contrast labels and complete text descriptions",
      tactile_route: tactile,
      audio_labels: true,
      audio_replay: true,
      reduced_motion: "static_cards_and_instant_selection",
      no_timer: true,
      speed_score_allowed: false,
      retry_without_penalty: true,
      preserve_correct_observations: true,
      safety_note: "Use images, models or clean teacher-provided replicas; do not touch, feed, taste or approach unknown animals.",
      gamification: { mission: "add one evidence badge to the Fantastic Explorer Field Guide", reward: "a calm map star for observing, sorting or explaining", loss_on_error: false, streak_pressure: false, leaderboard: false, retry_message: "Your useful observations stay in the field guide. Open another clue and try again." },
      difficulty_band: band,
      evidence_purpose: blueprint.replaceAll("-", "_"),
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
    },
    expected_answer: { value: answer }, hints, explanation,
    feedback: { correct: correctFeedback, repair, evidence: explanation, observation_praise: "A careful body-part or feature observation is useful even when the group choice needs another look." },
    difficulty, status: "review", misconception_tag: tag, animation_hook: hook,
  };
}

function validateBank(currentPack, authored, generated) {
  if (authored.length !== 4) throw new Error(`Expected exactly 4 curated variants, found ${authored.length}. Refusing to overwrite possible authored work.`);
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
    if (!variant.body.visual_route || !variant.body.tactile_route || !variant.body.supported_interaction) throw new Error(`${variant.id} lacks SEND observation routes.`);
    if (!variant.body.response_mode.includes("keyboard") || !variant.body.response_mode.includes("switch") || !variant.body.response_mode.includes("eye_gaze") || !variant.body.response_mode.includes("aac")) throw new Error(`${variant.id} lacks supported response routes.`);
    if (variant.body.no_timer !== true || variant.body.speed_score_allowed !== false || variant.body.retry_without_penalty !== true || variant.body.gamification?.streak_pressure !== false || variant.body.gamification?.loss_on_error !== false) throw new Error(`${variant.id} introduces pressure.`);
    if (!variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.evidence || !variant.feedback?.observation_praise) throw new Error(`${variant.id} lacks rich feedback.`);
    const choices = variant.body.choices;
    if (!Array.isArray(choices) || choices.length < 3 || new Set(choices.map((choice) => JSON.stringify(choice))).size !== choices.length) throw new Error(`${variant.id} has invalid choices.`);
    if (choices.filter((choice) => JSON.stringify(choice) === JSON.stringify(variant.expected_answer.value)).length !== 1) throw new Error(`${variant.id} must offer exactly one expected answer.`);
    if (variant.body.prompt.length > 130) throw new Error(`${variant.id} prompt is too long for Year 1.`);
    if (/all (fish|birds|mammals|reptiles|amphibians) (live|have|can)/i.test(`${variant.body.prompt} ${variant.explanation}`)) throw new Error(`${variant.id} uses an unsafe universal group claim.`);
  }
  const allocation = countBy(currentPack.question_variants, (variant) => variant.body.variant_blueprint_id);
  for (const [id, expected] of Object.entries(pilotAllocation)) if (allocation[id] !== expected) throw new Error(`${id} expected ${expected}, found ${allocation[id] ?? 0}.`);
  const concepts = new Set(generated.map((variant) => variant.body.concept_focus));
  for (const concept of ["body_part_identification", "vertebrate_grouping", "human_senses", "basic_animal_needs", "animal_growth", "evidence_based_comparison"]) if (!concepts.has(concept)) throw new Error(`Missing concept ${concept}.`);
}

function animal(name, group, covering, limbs, feature, young, adult) { return { name, group, covering, limbs, feature, young, adult }; }
function sense(senseName, part, context, choices) { return { sense: senseName, part, context, choices }; }
function describe(item) { return `A calm clear ${item.name} image showing ${item.covering}, ${item.limbs} and ${item.feature}.`; }
function featureForGroup(group) {
  return {
    mammal: ["hair or fur is visible on many familiar examples", "mothers feed milk to their young"],
    bird: ["feathers", "a beak"],
    fish: ["fins", "gills"],
    amphibian: ["smooth or bumpy skin", "a life that can change greatly from young to adult"],
    reptile: ["dry scaly skin", "a body shape that can differ from mammals and birds"],
  }[group];
}
function animalDistractors(item) { return animals.filter((other) => other.name !== item.name && other.group !== item.group).slice(0, 2).map((other) => other.name); }
function groupDistractors(group, index) { const groups = ["fish", "amphibian", "reptile", "bird", "mammal"].filter((name) => name !== group); return rotate(groups, index % groups.length).slice(0, 2); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function unique(items) { return [...new Set(items)]; }
function slug(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function normalise(value) { return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " "); }
function countBy(items, keyFor) { const result = {}; for (const item of items) { const key = keyFor(item); result[key] = (result[key] ?? 0) + 1; } return result; }
function summary(items, keyFor) { return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
