#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/sc-y1-plants-identify-common.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y1-plants-identify-bank-";
const reviewBatch = "y1-plants-identify-pilot-a";
const pilotAllocation = {
  "common-plant-audio-cards": 36,
  "wild-garden-tree-sorts": 36,
  "evergreen-season-choices": 36,
  "plant-feature-retrieval": 36,
  "garden-observation-transfer": 36,
};

const plants = [
  plant("daisy", "wild plant", "small white petals around a yellow centre", ["roots", "stem", "leaves", "flower"], "often seen in short grass", "wild_context"),
  plant("dandelion", "wild plant", "yellow flower head and toothed leaves", ["root", "stem", "leaves", "flower"], "often grows without being planted", "wild_context"),
  plant("buttercup", "wild plant", "small shiny-looking yellow flowers", ["roots", "stem", "leaves", "flower"], "often seen in grassy places", "wild_context"),
  plant("white clover", "wild plant", "leaves in groups of three and round flower heads", ["roots", "creeping stem", "leaves", "flowers"], "often grows in lawns and fields", "wild_context"),
  plant("cow parsley", "wild plant", "clusters of tiny white flowers on tall stems", ["roots", "stem", "leaves", "flowers"], "often seen beside paths and hedges", "wild_context"),
  plant("sunflower", "garden plant", "large flower head on a tall sturdy stem", ["roots", "stem", "leaves", "flower"], "shown planted in a labelled garden bed", "garden_context"),
  plant("rose", "garden plant", "layered flower petals and a woody thorny stem", ["roots", "stem", "leaves", "flower"], "shown in a cared-for garden border", "garden_context"),
  plant("tulip", "garden plant", "cup-shaped flower and long smooth-edged leaves", ["roots", "stem", "leaves", "flower"], "shown planted in an ordered garden bed", "garden_context"),
  plant("daffodil", "garden plant", "yellow trumpet-shaped flower and narrow leaves", ["roots", "stem", "leaves", "flower"], "shown planted beside a garden path", "garden_context"),
  plant("lavender", "garden plant", "narrow grey-green leaves and purple flower spikes", ["roots", "woody stems", "leaves", "flowers"], "shown in a labelled herb garden", "garden_context"),
  plant("oak", "tree", "lobed leaves, branching trunk and acorns in season", ["roots", "trunk", "branches", "leaves"], "a broad deciduous tree", "deciduous"),
  plant("horse chestnut", "tree", "large hand-shaped leaves and a branching trunk", ["roots", "trunk", "branches", "leaves"], "a broad deciduous tree", "deciduous"),
  plant("silver birch", "tree", "pale bark and small toothed leaves", ["roots", "trunk", "branches", "leaves"], "a deciduous tree with pale bark", "deciduous"),
  plant("sycamore", "tree", "broad five-lobed leaves and winged seeds in season", ["roots", "trunk", "branches", "leaves"], "a broad deciduous tree", "deciduous"),
  plant("pine", "tree", "needle-like leaves and cones", ["roots", "trunk", "branches", "needles"], "an evergreen tree", "evergreen"),
  plant("fir", "tree", "flat needle-like leaves on branching twigs", ["roots", "trunk", "branches", "needles"], "an evergreen tree", "evergreen"),
  plant("holly", "tree", "thick glossy leaves, often with spiny edges", ["roots", "trunk", "branches", "leaves"], "an evergreen tree in this reviewed example", "evergreen"),
];

const seasonTrees = [
  seasonTree("oak", "deciduous", ["spring: new leaves appear", "summer: a full green leafy crown", "autumn: many leaves change colour and fall", "winter: many branches are bare"], "Oak usually loses many leaves in autumn and is often bare in winter."),
  seasonTree("silver birch", "deciduous", ["spring: small new leaves", "summer: green leaves", "autumn: many yellowing leaves fall", "winter: many bare fine branches"], "Silver birch is deciduous and usually loses its leaves seasonally."),
  seasonTree("horse chestnut", "deciduous", ["spring: buds open", "summer: large green leaves", "autumn: many leaves brown and fall", "winter: branches are mostly bare"], "Horse chestnut is deciduous in the UK seasonal record."),
  seasonTree("sycamore", "deciduous", ["spring: new leaves", "summer: green leafy crown", "autumn: many leaves fall", "winter: mostly bare branches"], "Sycamore is deciduous and its visible leaf cover changes across the year."),
  seasonTree("pine", "evergreen", ["spring: green needles", "summer: green needles", "autumn: green needles remain", "winter: green needles remain"], "Pine keeps green needles throughout the year, although individual old needles can still fall."),
  seasonTree("fir", "evergreen", ["spring: green needles", "summer: green needles", "autumn: green needles remain", "winter: green needles remain"], "Fir is evergreen and remains green through the seasons."),
  seasonTree("holly", "evergreen", ["spring: green leaves", "summer: green leaves", "autumn: green leaves remain", "winter: many green leaves remain"], "This holly example is evergreen and keeps green leaves through the year."),
];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y1-plants-identify-common") throw new Error("This generator only supports the Year 1 common-plants pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedCounts = countBy(curated, curatedBlueprint);
const targets = Object.fromEntries(Object.entries(pilotAllocation).map(([id, target]) => [id, target - (curatedCounts[id] ?? 0)]));
for (const [id, target] of Object.entries(targets)) if (target < 0) throw new Error(`Curated variants exceed the allocation for ${id}.`);

const generated = [
  ...nameCandidates(targets["common-plant-audio-cards"]),
  ...sortCandidates(targets["wild-garden-tree-sorts"]),
  ...seasonCandidates(targets["evergreen-season-choices"]),
  ...featureCandidates(targets["plant-feature-retrieval"]),
  ...transferCandidates(targets["garden-observation-transfer"]),
];

pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Review-stage Year 1 common-plants pack with a deterministic 180-item pilot bank. Three curated variants are preserved alongside candidates covering familiar UK wild and garden plants, common trees, plant parts, observation language, broad grouping, evergreen and deciduous seasonal evidence, and misconception repair. Wild/garden classifications are tied to the pictured context rather than treated as permanent boundaries, while seasonal claims use usually/many and acknowledge natural variation. Every generated item includes reviewed visual descriptions, optional tactile replicas, complete text routes, supported response modes, explicit evidence feedback and joyful untimed garden missions. Unknown, thorny or potentially harmful plants are never handled, smelled or tasted. Referenced narration is ElevenLabs-gated for human listening review with browser TTS prohibited. Independent botany, image, SEND, safeguarding, teacher and renderer review remains required before promotion.";

validateBank(pack, curated, generated);
enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y1-plants-identify-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y1-plants-identify-bank blueprints=${summary(pack.question_variants, assignedBlueprint)}`);
console.log(`y1-plants-identify-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y1-plants-identify-bank concepts=${summary(generated, (variant) => variant.body.concept_focus)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y1-plants-identify-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 1 plant-identification bank is out of date; run generate-y1-plants-identify-bank.mjs --write.");
  console.log("y1-plants-identify-bank deterministic check passed");
} else {
  console.log("y1-plants-identify-bank dry-run; pass --write to update the pack");
}

function nameCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = plants[index % plants.length];
    const round = Math.floor(index / plants.length);
    const choices = rotate(unique([item.name, ...plantDistractors(item, index)]), index % 3);
    return candidate({
      id: `name-${slug(item.name)}-${index + 1}`, format: "audio-choice", blueprint: "common-plant-audio-cards", band: "intro", concept: "common_plant_naming",
      prompt: `Garden-card mission ${index + 1}: which common plant matches the picture and spoken clues?`, body: { plant: item.name, choices, reviewed_picture_description: pictureDescription(item), clue_features: [item.feature, item.context], picture_choices_revealed_after_clue: true, interaction_mode: "tap_picture_keyboard_switch_eye_gaze_or_choose_name_card" }, answer: item.name,
      hints: ["Look at more than the flower colour.", `Notice ${item.feature}.`], explanation: `The reviewed card shows ${item.name}: ${item.feature}. ${sentenceStart(item.context)}.`, difficulty: 2 + (round % 2), tag: "name_from_flower_colour_only", hook: "garden-name-card",
      correct: `Plant card identified: ${item.name}.`, repair: "Keep one correct observation, reveal one leaf, stem or trunk clue, then compare two plant cards again.",
      tactile: `Use a raised ${item.name} picture card and separate replica leaf/flower symbols; no real plant contact is required.`,
    });
  });
}

function sortCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = plants[(index * 5 + 2) % plants.length];
    const choices = rotate([item.group, ...groupDistractors(item.group)], index % 3);
    return candidate({
      id: `sort-${slug(item.name)}-${index + 1}`, format: "picture-sort", blueprint: "wild-garden-tree-sorts", band: "developing", concept: "wild_garden_tree_grouping",
      prompt: `Garden-map sort ${index + 1}: which broad basket best fits this pictured ${item.name}?`, body: { plant: item.name, choices, reviewed_picture_description: pictureDescription(item), context_evidence: item.context, group_rule: "pictured_context_and_observable_structure", context_not_permanent_species_label: item.group !== "tree", interaction_mode: "tap_sort_keyboard_switch_partner_scan_or_place_card" }, answer: item.group,
      hints: [item.group === "tree" ? "Look for a trunk and branches." : "Use the pictured growing context as well as the plant features.", "A flower is a plant part, not the only kind of plant."],
      explanation: item.group === "tree" ? `${sentenceStart(item.name)} is a tree, and a tree is a plant. The visible trunk and branches support the sort.` : `In this reviewed picture, ${item.name} is shown as a ${item.group}: ${item.context}. The same species can sometimes grow in a different place, so context matters.`, difficulty: 3, tag: item.group === "tree" ? "trees_not_plants" : "flower_only_category", hook: "garden-map-baskets",
      correct: `Plant sorted using the stated rule: ${item.group}.`, repair: "Say the basket rule, inspect trunk/stem and context evidence, then sort without using preference or flower colour.",
      tactile: "Use three tactile basket mats with distinct edge shapes and an embossed plant card; adult placement may follow the learner's direction.",
    });
  });
}

function seasonCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = seasonTrees[index % seasonTrees.length];
    const round = Math.floor(index / seasonTrees.length);
    const mode = round % 3;
    if (mode === 1) return seasonalEvidenceCandidate(item, index);
    if (mode === 2) return deciduousMeaningCandidate(item, index);
    const answer = item.type;
    const choices = rotate([answer, item.type === "evergreen" ? "deciduous" : "evergreen", "cannot decide from flowers alone"], index % 3);
    return candidate({
      id: `season-type-${slug(item.name)}-${index + 1}`, format: "observe-tap", blueprint: "evergreen-season-choices", band: "expected", concept: "evergreen_deciduous_identification",
      prompt: `Season-panel mission ${index + 1}: what does the year-long evidence show about this ${item.name}?`, body: { plant: item.name, choices, season_panels: item.panels, evidence_scope: "reviewed_year_sequence", interaction_mode: "tap_label_keyboard_switch_eye_gaze_or_choose_evidence_card" }, answer,
      hints: ["Compare green leaves or needles across all four season panels.", item.type === "evergreen" ? "Evergreen trees stay green through the year." : "Deciduous trees usually lose many leaves seasonally."], explanation: item.explanation, difficulty: 4, tag: item.type === "evergreen" ? "evergreen_flowers" : "deciduous_means_dead", hook: "garden-season-panels",
      correct: `Season evidence linked to ${item.type}.`, repair: "Hide flower and fruit clues. Compare only leaves or needles in spring, summer, autumn and winter.",
      tactile: "Use four season cards with leaf-present, needle-present and bare-branch tactile symbols plus full text descriptions.",
    });
  });
}

function seasonalEvidenceCandidate(item, index) {
  const answer = item.type === "evergreen" ? "green leaves or needles are visible in every season panel" : "many leaves are present in summer but branches are mostly bare in winter";
  const choices = rotate([answer, "the tree has flowers in one picture", "the background colour changes between pictures"], index % 3);
  return candidate({
    id: `season-evidence-${slug(item.name)}-${index + 1}`, format: "observe-tap", blueprint: "evergreen-season-choices", band: "expected", concept: "seasonal_evidence_observation",
    prompt: `Season detective ${index + 1}: which observation supports calling this ${item.name} ${item.type}?`, body: { plant: item.name, tree_type: item.type, choices, season_panels: item.panels, interaction_mode: "choose_observation_point_to_panels_keyboard_switch_or_say" }, answer,
    hints: ["Use leaves or needles, not flower colour.", "Compare more than one season."], explanation: `${sentenceStart(answer)}. ${item.explanation}`, difficulty: 4, tag: "single_season_proves_tree_type", hook: "garden-season-detective",
    correct: "Season claim supported with leaf or needle evidence.", repair: "Place SUMMER and WINTER cards side by side, then describe only what is visible on the branches.", tactile: "Use paired summer/winter branch cards with removable leaf or needle tokens; touch is optional.",
  });
}

function deciduousMeaningCandidate(item, index) {
  const answer = item.type === "deciduous" ? "It is alive but usually loses many leaves for part of the year." : "It keeps green leaves or needles through the year, while some old ones may still fall.";
  const choices = rotate([answer, "It is dead whenever no flowers are visible.", "Evergreen means it must have green flowers."], index % 3);
  return candidate({
    id: `season-meaning-${slug(item.name)}-${index + 1}`, format: "observe-tap", blueprint: "evergreen-season-choices", band: "expected", concept: "seasonal_misconception_repair",
    prompt: `Tree-care clue ${index + 1}: which statement explains this ${item.type} seasonal pattern?`, body: { plant: item.name, tree_type: item.type, choices, season_panels: item.panels, variation_note: "timing and amount can vary with species, place and weather", interaction_mode: "choose_statement_listen_keyboard_switch_or_aac" }, answer,
    hints: ["Leaf change does not mean the tree is dead.", "Evergreen describes leaves or needles, not flowers."], explanation: `${answer} Timing and leaf fall can vary with species, place and weather.`, difficulty: 4, tag: item.type === "deciduous" ? "deciduous_means_dead" : "evergreen_flowers", hook: "garden-tree-care-clue",
    correct: "Seasonal idea repaired with careful plant language.", repair: "Match the words evergreen or deciduous to the leaf record, then cross out statements about flower colour or death.", tactile: "Use ALIVE, LEAVES PRESENT and MANY LEAVES FALL tactile statement cards with adult-read text.",
  });
}

function featureCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = plants[(index * 3 + 1) % plants.length];
    const mode = index % 3;
    if (mode === 0) return partCandidate(item, index);
    if (mode === 1) return observationCandidate(item, index);
    const choices = rotate(unique([item.name, ...plantDistractors(item, index)]), index % 3);
    return candidate({
      id: `retrieve-name-${slug(item.name)}-${index + 1}`, format: "audio-choice", blueprint: "plant-feature-retrieval", band: "retrieval", concept: "plant_name_retrieval",
      prompt: `Calm garden revisit ${index + 1}: which plant name matches these observed features?`, body: { plant: item.name, choices, feature_clues: [item.feature, item.context], reviewed_picture_description: pictureDescription(item), review_interval_days: reviewDay(index), interaction_mode: "choose_name_keyboard_switch_eye_gaze_or_tactile_card" }, answer: item.name,
      hints: ["Use at least two observed clues.", `Listen again for ${item.feature}.`], explanation: `${sentenceStart(item.name)} matches the observed clues: ${item.feature}; ${item.context}.`, difficulty: 3, tag: "name_from_flower_colour_only", hook: "garden-calm-revisit",
      correct: `Plant name retrieved: ${item.name}.`, repair: "Show one clear leaf/trunk clue and one context clue, then compare only two named cards.", tactile: `Use a raised ${item.name} card and feature tokens with audio labels; real plant handling is unnecessary.`,
    });
  });
}

function partCandidate(item, index) {
  const part = item.parts[index % item.parts.length];
  const distractors = ["stone", "wing", "wheel"].filter((value) => value !== part).slice(0, 2);
  const choices = rotate([part, ...distractors], index % 3);
  return candidate({
    id: `part-${slug(item.name)}-${slug(part)}-${index + 1}`, format: "audio-choice", blueprint: "plant-feature-retrieval", band: "retrieval", concept: "plant_part_identification",
    prompt: `Plant-part revisit ${index + 1}: which label belongs on the marked part of this ${item.name}?`, body: { plant: item.name, target_part: part, choices, plant_parts: item.parts, picture_hotspot_description: `The ${part} is outlined on the reviewed ${item.name} image.`, review_interval_days: reviewDay(index), interaction_mode: "tap_label_keyboard_switch_eye_gaze_or_place_part_token" }, answer: part,
    hints: ["Use the marked place on the plant.", `${sentenceStart(part)} is a plant part in this picture.`], explanation: `The marked structure is the ${part}. This ${item.name} card also shows ${item.parts.filter((value) => value !== part).join(", ")}.`, difficulty: 3, tag: "flower_is_whole_plant", hook: "garden-part-label",
    correct: `Plant part labelled: ${part}.`, repair: "Use the whole-plant outline, reveal one part boundary and match one audio/text label at a time.", tactile: `Use a raised whole-plant model with a detachable ${part} token; the learner may direct adult placement.`,
  });
}

function observationCandidate(item, index) {
  const answer = item.feature;
  const choices = rotate([answer, "It is the prettiest plant.", "It wants to grow near people."], index % 3);
  return candidate({
    id: `observe-${slug(item.name)}-${index + 1}`, format: "audio-choice", blueprint: "plant-feature-retrieval", band: "retrieval", concept: "evidence_based_observation",
    prompt: `Observation warm-up ${index + 1}: which sentence records visible evidence about the ${item.name}?`, body: { plant: item.name, choices, reviewed_picture_description: pictureDescription(item), fact_vs_opinion: true, review_interval_days: reviewDay(index), interaction_mode: "choose_observation_point_to_feature_keyboard_switch_or_say" }, answer,
    hints: ["Choose what can be seen or safely counted.", "Avoid opinions and ideas about what a plant wants."], explanation: `${sentenceStart(answer)} is an observation from the reviewed image. It does not guess feelings or purpose.`, difficulty: 3, tag: "opinion_or_intention_as_observation", hook: "garden-observation-warmup",
    correct: "Visible plant evidence recorded without guessing.", repair: "Use the sentence frame I can see __, then point to the matching part of the picture or model.", tactile: "Use raised feature symbols and a complete text description; no smell or direct plant touch is needed.",
  });
}

function transferCandidates(count) {
  const modes = ["observation", "group", "season", "parts", "misconception"];
  return Array.from({ length: count }, (_, index) => {
    const item = plants[(index * 7 + 4) % plants.length];
    const mode = modes[index % modes.length];
    if (mode === "group") return transferGroup(item, index);
    if (mode === "season") return transferSeason(index);
    if (mode === "parts") return transferParts(item, index);
    if (mode === "misconception") return transferMisconception(index);
    const answer = `I can see ${item.feature}.`;
    const choices = rotate([answer, "I know it is healthy because it looks happy.", "It is a tree because it is green."], index % 3);
    return candidate({
      id: `transfer-observe-${slug(item.name)}-${index + 1}`, format: "observe-tap", blueprint: "garden-observation-transfer", band: "stretch", concept: "observation_transfer",
      prompt: `Garden explorer ${index + 1}: which because-sentence begins with evidence from the new ${item.name} card?`, body: { plant: item.name, choices, reviewed_picture_description: pictureDescription(item), because_scaffold: "I think __ because I can see __.", interaction_mode: "choose_point_speech_aac_keyboard_switch_or_adult_scribed" }, answer,
      hints: ["Start with I can see.", "Name a plant part, shape, colour pattern or trunk feature without guessing."], explanation: `${answer} This is observable evidence that can support later naming or grouping.`, difficulty: 5, tag: "opinion_or_intention_as_observation", hook: "garden-explorer-lens",
      correct: "Explorer note begins with visible evidence.", repair: "Hide the group labels, select one visible feature hotspot, then complete I can see __.", tactile: "Use a raised feature card and sentence symbols; adult scribing is allowed.",
    });
  });
}

function transferGroup(item, index) {
  const answer = item.group === "tree" ? `tree, because I can see a trunk and branches` : `${item.group}, because ${item.context}`;
  const choices = rotate([answer, "flower, because only flowers count as plants", "my favourite group, because I like its colour"], index % 3);
  return candidate({
    id: `transfer-group-${slug(item.name)}-${index + 1}`, format: "observe-tap", blueprint: "garden-observation-transfer", band: "stretch", concept: "grouping_with_evidence",
    prompt: `Sorting explanation ${index + 1}: which answer uses the pictured rule and evidence for the ${item.name}?`, body: { plant: item.name, choices, group_rule: "wild plant, garden plant or tree in this pictured context", reviewed_picture_description: pictureDescription(item), interaction_mode: "choose_reason_point_speech_aac_or_partner_scan" }, answer,
    hints: ["Say the group first.", "Then name trunk/branch or pictured growing-context evidence."], explanation: `${sentenceStart(answer)}. Broad wild/garden sorting uses the shown context and does not mean the species can only grow there.`, difficulty: 5, tag: "sort_by_preference", hook: "garden-sorting-explanation",
    correct: "Group choice justified with an observable or context clue.", repair: "Use the frame It goes in __ because I can see __, with one group and one clue at a time.", tactile: "Use tactile group mats, plant card and BECAUSE connector; adult placement may follow eye-gaze or AAC.",
  });
}

function transferSeason(index) {
  const item = seasonTrees[index % seasonTrees.length];
  const answer = item.type === "evergreen" ? "evergreen, because green leaves or needles remain in all four panels" : "deciduous, because many leaves fall and winter branches are mostly bare";
  const choices = rotate([answer, "evergreen, because a flower is visible", "dead, because one winter panel has bare branches"], index % 3);
  return candidate({
    id: `transfer-season-${slug(item.name)}-${index + 1}`, format: "observe-tap", blueprint: "garden-observation-transfer", band: "stretch", concept: "seasonal_evidence_transfer",
    prompt: `Four-season garden ${index + 1}: which explanation fits the ${item.name} evidence?`, body: { plant: item.name, choices, season_panels: item.panels, variation_note: "season timing varies", interaction_mode: "choose_explanation_compare_panels_keyboard_switch_or_aac" }, answer,
    hints: ["Compare leaves or needles through the year.", "Bare winter branches do not mean a tree is dead."], explanation: `${sentenceStart(answer)}. ${item.explanation}`, difficulty: 5, tag: item.type === "evergreen" ? "evergreen_flowers" : "deciduous_means_dead", hook: "garden-four-season-transfer",
    correct: "Season type explained with evidence from several panels.", repair: "Compare summer and winter first, then check spring and autumn before choosing.", tactile: "Use four ordered season cards with removable leaf/needle symbols and complete text descriptions.",
  });
}

function transferParts(item, index) {
  const answer = `The ${item.parts.join(", ")} are all parts shown on this plant.`;
  const choices = rotate([answer, "Only the flower is the plant.", "Roots and stems are not plant parts because they may be hidden."], index % 3);
  return candidate({
    id: `transfer-parts-${slug(item.name)}-${index + 1}`, format: "observe-tap", blueprint: "garden-observation-transfer", band: "stretch", concept: "whole_plant_parts_transfer",
    prompt: `Whole-plant map ${index + 1}: which statement uses all the labelled ${item.name} evidence?`, body: { plant: item.name, choices, labelled_parts: item.parts, whole_plant_model: true, interaction_mode: "choose_statement_build_part_map_keyboard_switch_or_say" }, answer,
    hints: ["A flower can be one part of a plant.", "Include below-ground and above-ground parts shown in the model."], explanation: `A whole plant can include ${item.parts.join(", ")}. The visible flower or leaf is not the entire plant.`, difficulty: 5, tag: "flower_is_whole_plant", hook: "garden-whole-plant-map",
    correct: "Whole plant linked to several different parts.", repair: "Build the plant from root/trunk or stem upward, adding one labelled part at a time.", tactile: "Use a layered tactile plant model with detachable part labels; touch is optional.",
  });
}

function transferMisconception(index) {
  const cases = [
    ["Every plant has a flower visible all year.", "Not always. Plants have different stages, and flowers may be absent in a picture.", "flower_only_category"],
    ["A tree is not a plant.", "A tree is a kind of plant with structures such as roots, trunk, branches and leaves or needles.", "trees_not_plants"],
    ["Evergreen means green flowers.", "Evergreen describes leaves or needles staying green through the year.", "evergreen_flowers"],
    ["A bare deciduous tree in winter is dead.", "Not necessarily. Many deciduous trees are alive while their branches are bare in winter.", "deciduous_means_dead"],
    ["Wild plants can never appear in gardens.", "Wild/garden sorting can describe the pictured growing context; some wild plants also grow in gardens.", "wild_garden_fixed_boundary"],
  ];
  const [claim, answer, tag] = cases[index % cases.length];
  const choices = rotate([answer, "The claim is always true because one picture shows it.", "Choose by favourite colour instead of evidence."], index % 3);
  return candidate({
    id: `transfer-repair-${slug(tag)}-${index + 1}`, format: "observe-tap", blueprint: "garden-observation-transfer", band: "stretch", concept: "plant_misconception_repair",
    prompt: `Garden idea repair ${index + 1}: a learner says, “${claim}” Which response uses careful evidence?`, body: { claim, choices, interaction_mode: "choose_repair_listen_keyboard_switch_aac_or_teach_back" }, answer,
    hints: ["Look for every, never or always.", "Choose a response that names visible evidence or natural variation."], explanation: answer, difficulty: 5, tag, hook: "garden-idea-repair",
    correct: "Garden idea repaired with careful evidence language.", repair: "Replace every/never with a claim about the pictured plant or season record, then add one observation.", tactile: "Use THIS PICTURE, SOMETIMES and NOT ENOUGH EVIDENCE tactile cards with adult-read text.",
  });
}

function candidate({ id, format, blueprint, band, concept, prompt, body, answer, hints, explanation, difficulty, tag, hook, correct, repair, tactile }) {
  const fullId = `${prefix}${id}`;
  return {
    id: fullId,
    format,
    body: {
      prompt, ...body,
      concept_focus: concept,
      response_mode: "tap_drag_keyboard_switch_eye_gaze_aac_oral_or_adult_scribed",
      supported_interaction: "adult_or_peer_may_read_scan position cards and record without supplying the plant answer",
      visual_route: "large reviewed still image, uncluttered feature hotspots and complete alt description",
      tactile_route: tactile,
      text_route: "plain-language plant name, visible features, context and season evidence",
      sensory_choice: { real_plant_contact_required: false, replica_route: true, text_only_route: true, smell_or_taste_prohibited: true, gloves_or_tool_option: true, garden_sounds_default_off: true },
      safety_note: "Use reviewed images or clean teacher-approved replicas. Do not touch, pick, smell or taste unknown, thorny, irritating or potentially harmful plants; wash hands after optional known-sample handling.",
      audio_replay: true,
      audio_asset_id: `narration-${fullId}`,
      audio_provider: "ElevenLabs",
      audio_asset_status: "required_human_listening_review",
      human_listening_approval_required: true,
      browser_tts_allowed: false,
      reduced_motion: "static_cards_and_instant_selection",
      no_timer: true,
      speed_score_allowed: false,
      retry_without_penalty: true,
      preserve_correct_observations: true,
      gamification: { mission: "restore one trail, label or season page in the Joyful Garden Guide", reward: "one calm garden spark for observing or explaining", loss_on_error: false, streak_pressure: false, leaderboard: false, speed_bonus: false, retry_message: "Your useful observation stays in the guide. Open another clue and look again." },
      difficulty_band: band,
      evidence_purpose: blueprint.replaceAll("-", "_"),
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
    },
    expected_answer: { value: answer }, hints, explanation,
    feedback: { correct, repair, evidence: explanation, observation_praise: "A careful plant-part or seasonal observation remains useful even when the name or group needs another look." },
    difficulty, status: "review", misconception_tag: tag, animation_hook: hook,
  };
}

function validateBank(currentPack, authored, generated) {
  if (authored.length !== 3) throw new Error(`Expected exactly 3 curated variants, found ${authored.length}. Refusing to overwrite possible authored work.`);
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
    if (!variant.body.visual_route || !variant.body.tactile_route || !variant.body.text_route || !variant.body.supported_interaction) throw new Error(`${variant.id} lacks SEND routes.`);
    if (variant.body.sensory_choice?.real_plant_contact_required !== false || variant.body.sensory_choice?.text_only_route !== true || variant.body.sensory_choice?.smell_or_taste_prohibited !== true) throw new Error(`${variant.id} lacks sensory safety.`);
    if (!variant.body.response_mode.includes("keyboard") || !variant.body.response_mode.includes("switch") || !variant.body.response_mode.includes("eye_gaze") || !variant.body.response_mode.includes("aac")) throw new Error(`${variant.id} lacks supported responses.`);
    if (variant.body.audio_provider !== "ElevenLabs" || variant.body.audio_asset_status !== "required_human_listening_review" || variant.body.browser_tts_allowed !== false) throw new Error(`${variant.id} violates audio policy.`);
    if (variant.body.no_timer !== true || variant.body.speed_score_allowed !== false || variant.body.gamification?.streak_pressure !== false || variant.body.gamification?.loss_on_error !== false) throw new Error(`${variant.id} introduces pressure.`);
    if (!variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.evidence || !variant.feedback?.observation_praise) throw new Error(`${variant.id} lacks rich feedback.`);
    const choices = variant.body.choices;
    if (!Array.isArray(choices) || choices.length < 3 || new Set(choices.map((choice) => JSON.stringify(choice))).size !== choices.length) throw new Error(`${variant.id} has invalid choices.`);
    if (choices.filter((choice) => JSON.stringify(choice) === JSON.stringify(variant.expected_answer.value)).length !== 1) throw new Error(`${variant.id} must offer exactly one expected answer.`);
    if (variant.body.prompt.length > 150) throw new Error(`${variant.id} prompt is too long for Year 1.`);
    if (/all deciduous trees|every deciduous tree|all evergreen trees|every evergreen tree/i.test(`${variant.body.prompt} ${variant.explanation}`)) throw new Error(`${variant.id} uses an unsafe universal seasonal claim.`);
  }
  const allocation = countBy(currentPack.question_variants, assignedBlueprint);
  for (const [id, expected] of Object.entries(pilotAllocation)) if (allocation[id] !== expected) throw new Error(`${id} expected ${expected}, found ${allocation[id] ?? 0}.`);
  const concepts = new Set(generated.map((variant) => variant.body.concept_focus));
  for (const concept of ["common_plant_naming", "wild_garden_tree_grouping", "evergreen_deciduous_identification", "seasonal_evidence_observation", "plant_part_identification", "evidence_based_observation", "grouping_with_evidence", "seasonal_evidence_transfer", "plant_misconception_repair"]) if (!concepts.has(concept)) throw new Error(`Missing concept ${concept}.`);
}

function curatedBlueprint(variant) { const map = { "sc-y1-plants-identify-common-q-tree-plant": "common-plant-audio-cards", "sc-y1-plants-identify-common-q-evergreen": "evergreen-season-choices", "sc-y1-plants-identify-common-q-wild-plant": "wild-garden-tree-sorts" }; const value = map[variant.id]; if (!value) throw new Error(`No curated blueprint assignment for ${variant.id}.`); return value; }
function assignedBlueprint(variant) { return variant.body?.variant_blueprint_id ?? curatedBlueprint(variant); }
function plant(name, group, feature, parts, context, seasonType) { return { name, group, feature, parts, context, seasonType }; }
function seasonTree(name, type, panels, explanation) { return { name, type, panels, explanation }; }
function pictureDescription(item) { return `A calm whole-plant view of ${item.name}, showing ${item.parts.join(", ")}; ${item.feature}; ${item.context}.`; }
function plantDistractors(item, index) { return rotate(plants.filter((other) => other.name !== item.name && other.group !== item.group), index % 7).slice(0, 2).map((other) => other.name); }
function groupDistractors(correct) { return ["wild plant", "garden plant", "tree"].filter((group) => group !== correct); }
function reviewDay(index) { return [1, 3, 7, 14, 30][index % 5]; }
function sentenceStart(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function unique(items) { return [...new Set(items)]; }
function slug(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function normalise(value) { return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " "); }
function countBy(items, keyFor) { const result = {}; for (const item of items) { const key = keyFor(item); result[key] = (result[key] ?? 0) + 1; } return result; }
function summary(items, keyFor) { return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
