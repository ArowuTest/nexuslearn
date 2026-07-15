#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/sc-y1-everyday-materials.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y1-everyday-materials-bank-";
const reviewBatch = "y1-everyday-materials-pilot-a";
const pilotAllocation = {
  "object-and-material-audio-matches": 44,
  "common-material-identification": 44,
  "single-property-evidence-tests": 44,
  "property-rule-comparison-sorts": 44,
  "materials-evidence-spaced-review": 44,
};

const objectSamples = [
  sample("metal-spoon", "spoon", "metal", "the whole spoon", "a smooth silver-coloured spoon with a clearly reflective metal surface"),
  sample("wood-spoon", "spoon", "wood", "the whole spoon", "a wooden cooking spoon with visible grain"),
  sample("plastic-spoon", "spoon", "plastic", "the whole spoon", "a single-colour plastic spoon with a moulded surface"),
  sample("glass-jar", "jar", "glass", "the jar wall", "a clear empty glass jar with a marked wall and no lid"),
  sample("plastic-bottle", "bottle", "plastic", "the bottle wall", "a clear flexible plastic bottle with its cap removed"),
  sample("metal-key", "key", "metal", "the whole key", "a plain metal key on a neutral background"),
  sample("wood-block", "block", "wood", "the whole block", "an unfinished wooden block with visible grain"),
  sample("plastic-block", "block", "plastic", "the whole block", "a moulded plastic building block"),
  sample("rock-pebble", "pebble", "rock", "the whole pebble", "a clean dry pebble with a natural stone surface"),
  sample("paper-bag", "bag", "paper", "the bag", "a plain brown paper bag"),
  sample("fabric-bag", "bag", "fabric", "the bag", "a woven cotton fabric bag"),
  sample("rubber-band", "band", "rubber", "the whole band", "a wide clean rubber band shown at rest"),
  sample("metal-pan", "pan", "metal", "the pan body", "a metal pan with the body clearly marked and handle ignored"),
  sample("glass-window", "window", "glass", "the clear pane", "a window with the glass pane marked, not the frame"),
  sample("wood-chair", "chair", "wood", "the marked wooden seat", "a chair with its wooden seat marked and other parts ignored"),
  sample("plastic-chair", "chair", "plastic", "the marked seat", "a one-piece moulded plastic chair"),
  sample("paper-page", "book page", "paper", "the marked page", "one plain paper page separated from the book cover"),
  sample("fabric-scarf", "scarf", "fabric", "the whole scarf", "a plain woven scarf without decorative beads"),
  sample("rubber-eraser", "eraser", "rubber", "the whole eraser", "a clean plain rubber eraser"),
  sample("water-cup", "water sample", "water", "the liquid inside a clear cup", "clear water in a sealed transparent cup, with the liquid marked"),
];

const propertyTests = [
  test("clear-plastic-light", "clear plastic sheet", "look at the same bold shape through the sample", "The shape can be seen clearly through it.", "transparent", ["opaque", "absorbent"], "light_view"),
  test("wood-light", "wooden block", "place the same bold shape behind the sample", "The shape cannot be seen through it.", "opaque", ["transparent", "bendy"], "light_view"),
  test("glass-light", "clear glass tile", "look at the same bold shape through an intact teacher-managed sample", "The shape can be seen clearly through it.", "transparent", ["rough", "opaque"], "light_view"),
  test("paper-water", "paper square", "adult places one small water drop on the sample", "The drop soaks in and leaves a wet patch.", "absorbent", ["not absorbent", "transparent"], "water_drop"),
  test("fabric-water", "cotton fabric square", "adult places one small water drop on the sample", "The drop soaks into the fabric.", "absorbent", ["not absorbent", "hard"], "water_drop"),
  test("plastic-water", "plastic sheet", "adult places one small water drop on the sample", "The drop stays on the surface and can be wiped away.", "not absorbent", ["absorbent", "rough"], "water_drop"),
  test("sponge-press", "clean sponge sample", "press gently with a modelled force", "The sample changes shape easily and springs back.", "soft", ["hard", "transparent"], "gentle_press"),
  test("rock-press", "smooth pebble", "press gently with the same modelled force", "The sample does not change shape.", "hard", ["soft", "absorbent"], "gentle_press"),
  test("rubber-stretch", "wide rubber band", "adult demonstrates a gentle stretch within a safe limit", "The sample becomes longer and returns towards its first shape.", "stretchy", ["stiff", "transparent"], "gentle_stretch"),
  test("wood-bend", "wooden craft stick model", "use a safe simulation of a gentle bend", "The sample keeps its straight shape in the model.", "stiff", ["bendy", "absorbent"], "bend_model"),
  test("fabric-bend", "fabric strip", "fold the sample gently", "The sample folds easily.", "bendy", ["stiff", "hard"], "fold"),
  test("sandpaper-touch", "sandpaper square", "use a visual close-up or touch with a tool if chosen", "The surface has many raised grains.", "rough", ["smooth", "transparent"], "surface_view"),
  test("plastic-surface", "smooth plastic tile", "use a visual close-up or touch with a tool if chosen", "The surface looks and feels even, without raised bumps.", "smooth", ["rough", "absorbent"], "surface_view"),
  test("foil-light", "clean metal foil", "compare reflected light in a still image", "A bright reflection can be seen on this sample.", "shiny", ["dull", "transparent"], "reflection_view"),
  test("unpolished-rock-light", "unpolished rock", "compare reflected light in a still image", "No bright reflection is seen on this sample.", "dull", ["shiny", "bendy"], "reflection_view"),
  test("card-water", "thick card square", "adult places one small water drop on the sample", "The drop begins to soak in and darken the card.", "absorbent", ["not absorbent", "transparent"], "water_drop"),
];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y1-everyday-materials") throw new Error("This generator only supports the Year 1 everyday-materials pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedCounts = countBy(curated, (variant) => variant.body?.variant_blueprint_id);
const targets = Object.fromEntries(Object.entries(pilotAllocation).map(([id, target]) => [id, target - (curatedCounts[id] ?? 0)]));
for (const [id, target] of Object.entries(targets)) if (target < 0) throw new Error(`Curated variants exceed the allocation for ${id}.`);

const generated = [
  ...objectMaterialCandidates(targets["object-and-material-audio-matches"]),
  ...materialIdentificationCandidates(targets["common-material-identification"]),
  ...propertyTestCandidates(targets["single-property-evidence-tests"]),
  ...ruleSortCandidates(targets["property-rule-comparison-sorts"]),
  ...retrievalCandidates(targets["materials-evidence-spaced-review"]),
];

pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa.notes = "Review-stage Year 1 everyday-materials pack with a deterministic 220-item pilot bank. Four curated variants are preserved alongside candidates covering object/material language, representative samples of wood, plastic, glass, metal, water and rock, simple property contrasts, rule-based grouping, evidence from sensory-safe modelled tests, and early suitability reasoning. Generated items avoid hidden-composition claims and treat each property conclusion as evidence about the tested sample rather than every example of a material. Every item includes visual, tactile-tool and text routes, opt-out from direct sensory contact, supported interaction, explicit evidence feedback and untimed joyful maker missions. Referenced narration remains unavailable pending ElevenLabs human listening review with browser TTS prohibited. Independent science, sample-image, SEND, safeguarding, teacher and renderer review remains required before promotion.";

validateBank(pack, curated, generated);
enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y1-everyday-materials-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y1-everyday-materials-bank blueprints=${summary(pack.question_variants, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`y1-everyday-materials-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y1-everyday-materials-bank concepts=${summary(generated, (variant) => variant.body.concept_focus)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y1-everyday-materials-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 1 everyday-materials bank is out of date; run generate-y1-everyday-materials-bank.mjs --write.");
  console.log("y1-everyday-materials-bank deterministic check passed");
} else {
  console.log("y1-everyday-materials-bank dry-run; pass --write to update the pack");
}

function objectMaterialCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = objectSamples[index % objectSamples.length];
    const round = Math.floor(index / objectSamples.length);
    const askObject = round % 3 === 2;
    const answer = askObject ? item.object : item.material;
    const choices = askObject
      ? rotate(unique([item.object, item.material, objectSamples[(index + 5) % objectSamples.length].object]), index % 3)
      : rotate(unique([item.material, item.object, otherMaterial(item.material, index)]), index % 3);
    return candidate({
      id: `object-${item.id}-${index + 1}`, format: "object-material-match", blueprint: "object-and-material-audio-matches", band: "intro", concept: askObject ? "object_name" : "object_material_distinction",
      prompt: askObject ? `Maker shelf ${index + 1}: what is the marked object called?` : `Maker shelf ${index + 1}: what material is the marked ${item.object} made from?`,
      body: { object: item.object, material: item.material, marked_part: item.part, reviewed_image_description: item.description, choices, object_label: item.object, material_label: item.material, hidden_composition_inference_allowed: false, interaction_mode: "tap_match_keyboard_switch_eye_gaze_or_place_label_card" }, answer,
      hints: askObject ? ["Name what the item is used or shaped as.", `${sentenceStart(item.object)} is the object name.`] : [`${sentenceStart(item.object)} is the object name.`, `The marked ${item.part} is made from ${item.material}.`],
      explanation: `${sentenceStart(item.object)} is the object. In this reviewed example, the marked ${item.part} is made from ${item.material}. Another ${item.object} could be made from a different material.`, difficulty: 2, tag: askObject ? "material_name_for_object" : "object_name_for_material", hook: "maker-made-from-link",
      correct: askObject ? `Object label matched: ${item.object}.` : `Made-from link matched: ${item.object} → ${item.material}.`, repair: "Keep separate OBJECT and MATERIAL label slots. Name the item first, then name what the marked part is made from.",
      tactile: `Use a clean replica or raised picture of the ${item.object} and a separate textured ${item.material} sample card; direct touch is optional.`,
    });
  });
}

function materialIdentificationCandidates(count) {
  const materials = ["wood", "plastic", "glass", "metal", "water", "rock", "paper", "fabric", "rubber"];
  return Array.from({ length: count }, (_, index) => {
    const material = materials[index % materials.length];
    const examples = objectSamples.filter((item) => item.material === material);
    const example = examples[index % Math.max(1, examples.length)] ?? materialFallback(material);
    const mode = Math.floor(index / materials.length) % 3;
    const sameObject = sameObjectPair(material);
    if (mode === 1 && sameObject?.length >= 2) {
      const objectName = sameObject[0].object;
      const answer = "yes, the object name can stay the same while the material changes";
      const choices = rotate([answer, "no, each object type can only be made from one material", "yes, because object and material mean the same thing"], index % 3);
      return candidate({
        id: `many-materials-${material}-${index + 1}`, format: "audio-choice", blueprint: "common-material-identification", band: "developing", concept: "one_object_different_materials",
        prompt: `Material clue ${index + 1}: can these reviewed ${objectName} examples have the same object name but different materials?`, body: { examples: sameObject.map((item) => item.id), choices, comparison_text: sameObject.map((item) => `${item.object}: ${item.material}`), interaction_mode: "choose_listen_keyboard_switch_or_match_object_material_labels" }, answer,
        hints: ["Keep the object name fixed.", "Compare what each example is made from."], explanation: `The examples are all called ${objectName}, but their materials can differ. Object type and material are different kinds of name.`, difficulty: 3, tag: "one_object_one_material", hook: "maker-same-object-different-material", correct: "Object name held steady while material labels changed.", repair: "Put the same OBJECT label under both pictures, then add a separate MATERIAL label to each.", tactile: "Use matching object-outline cards with different optional texture swatches and text labels.",
      });
    }
    const choices = rotate(unique([material, ...materialDistractors(material, index)]), index % 3);
    return candidate({
      id: `identify-${material}-${index + 1}`, format: "audio-choice", blueprint: "common-material-identification", band: "developing", concept: "common_material_identification",
      prompt: `Material clue ${index + 1}: which material name matches this reviewed sample?`, body: { target_material: material, sample_description: example.description, marked_part: example.part, choices, representative_sample_only: true, interaction_mode: "tap_label_keyboard_switch_eye_gaze_or_tactile_match" }, answer: material,
      hints: ["Use the marked sample, not the object's job.", `This representative sample is ${material}.`], explanation: `The reviewed sample is identified as ${material}. The claim is about this clear example and does not mean every ${material} sample looks identical.`, difficulty: 3, tag: "appearance_alone_names_material", hook: "maker-material-clue", correct: `Material sample identified: ${material}.`, repair: "Reveal the material label beside a close-up and compare only two representative samples before trying again.", tactile: `Offer a teacher-approved ${material} texture sample, a raised symbol and a written label; touching is optional and tool-mediated exploration is available.`,
    });
  });
}

function propertyTestCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = propertyTests[index % propertyTests.length];
    const round = Math.floor(index / propertyTests.length);
    const choices = rotate([item.conclusion, ...item.distractors], index % 3);
    return candidate({
      id: `test-${item.id}-${index + 1}`, format: "property-test", blueprint: "single-property-evidence-tests", band: "expected", concept: "simple_property_test",
      prompt: `Test bench ${index + 1}: what property does the evidence support for this ${item.sample} sample?`, body: { sample: item.sample, test: item.method, test_type: item.type, observation: item.observation, choices, evidence_scope: "this_tested_sample", prediction_optional_unscored: true, before_after_text: [`before: ${item.sample} ready`, `after: ${item.observation}`], interaction_mode: "predict_optional_reveal_choose_keyboard_switch_or_say" }, answer: item.conclusion,
      hints: ["Use what changed or stayed the same in the test.", `Observation: ${item.observation}`], explanation: `${item.observation} This evidence supports ${item.conclusion} for this tested ${item.sample} sample. It does not prove every sample of that material has every property.`, difficulty: 4 + (round % 2), tag: item.conclusion === "shiny" ? "shiny_means_metal" : "property_words_conflated", hook: "maker-test-before-after",
      correct: `Evidence matched to ${item.conclusion} for this sample.`, repair: "Return to the observation panel, hide unused property words and match one test result to one property.",
      tactile: `Use a sealed or clean teacher-approved ${item.sample} sample with a tool, glove or no-touch text route; direct sensory contact is never required.`,
      safety: testSafety(item.type),
    });
  });
}

function ruleSortCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = propertyTests[(index * 5 + 2) % propertyTests.length];
    const opposite = propertyOpposite(item.conclusion);
    const choices = rotate([item.conclusion, opposite, "cannot decide without the named test"], index % 3);
    const evidenceShown = index % 4 !== 3;
    const answer = evidenceShown ? item.conclusion : "cannot decide without the named test";
    return candidate({
      id: `sort-${item.id}-${index + 1}`, format: "rule-sort", blueprint: "property-rule-comparison-sorts", band: "secure", concept: evidenceShown ? "property_rule_grouping" : "cannot_decide_from_missing_evidence",
      prompt: `Sorting workshop ${index + 1}: use the rule ${item.conclusion} or ${opposite}. Where should the sample go?`, body: { sample: item.sample, sorting_rule: [item.conclusion, opposite], evidence: evidenceShown ? item.observation : "The photograph does not show the named test result.", choices, honest_cannot_decide_route: true, ignore_colour_and_object_use: true, interaction_mode: "place_in_hoop_choose_keyboard_switch_partner_scan_or_say_reason" }, answer,
      hints: evidenceShown ? ["Listen for the named rule.", `Use the test result: ${item.observation}`] : ["Do not guess from colour or object use.", "Choose cannot decide when the needed evidence is missing."],
      explanation: evidenceShown ? `${item.observation} Under the stated rule, this tested sample belongs with ${item.conclusion}. A different rule could group it another way.` : `The needed ${item.conclusion}/${opposite} evidence is not shown, so cannot decide is the careful scientific choice.`, difficulty: 5, tag: evidenceShown ? "sort_by_colour_or_use" : "guess_when_evidence_missing", hook: "maker-rule-hoops",
      correct: evidenceShown ? `Sample sorted by the named property rule: ${item.conclusion}.` : "Careful maker choice: more evidence is needed before sorting.", repair: "Say the rule aloud, cross out appearance or use clues that are not part of it, then point to the matching test evidence.",
      tactile: `Use two tactile hoops with audio/text rule labels and an evidence card; an adult may place the sample following the learner's choice.`,
      safety: testSafety(item.type),
    });
  });
}

function retrievalCandidates(count) {
  const suitability = [
    suit("rain-cover", "a model rain cover", "keep drops off the model", "clear plastic sheet", "not absorbent", ["paper tissue", "cotton fabric"]),
    suit("towel", "a small towel", "soak up a spill", "cotton fabric", "absorbent", ["glass tile", "metal foil"]),
    suit("window", "a model window", "let a picture be seen through", "clear plastic sheet", "transparent", ["wood block", "cardboard"]),
    suit("cushion", "a model cushion filling", "feel soft when gently pressed", "sponge", "soft", ["rock", "glass tile"]),
    suit("ruler", "a simple ruler", "stay straight during measuring", "wood", "stiff", ["fabric strip", "rubber band"]),
    suit("grip", "a stretchy loop", "stretch around a bundle", "rubber", "stretchy", ["rock", "glass"]),
    suit("display-card", "a display card", "take a drawn mark", "paper", "easy to mark", ["water", "smooth glass"]),
    suit("path", "a model path tile", "stay hard under a model foot", "rock", "hard", ["sponge", "fabric"]),
  ];
  return Array.from({ length: count }, (_, index) => {
    const mode = index % 4;
    if (mode === 0) return suitabilityCandidate(suitability[Math.floor(index / 4) % suitability.length], index);
    if (mode === 1) return retrievalObjectMaterial(index);
    if (mode === 2) return retrievalProperty(index);
    return retrievalMisconception(index);
  });
}

function suitabilityCandidate(item, index) {
  const answer = `${item.material}, because the tested sample is ${item.property}`;
  const choices = rotate([answer, `${item.wrong[0]}, because its colour is nicer`, `${item.wrong[1]}, because every material suits every job`], index % 3);
  return candidate({
    id: `suit-${item.id}-${index + 1}`, format: "evidence-tap", blueprint: "materials-evidence-spaced-review", band: "retrieval", concept: "simple_suitability_from_property",
    prompt: `Maker mission ${index + 1}: choose a material for ${item.object}. It must ${item.need}. Which choice uses evidence?`, body: { design_object: item.object, design_need: item.need, choices, tested_property: item.property, evidence_panel: `The ${item.material} sample was ${item.property} in the named test.`, interaction_mode: "choose_material_and_reason_keyboard_switch_aac_or_partner_scan", review_interval_days: reviewDay(index) }, answer,
    hints: ["Say what the object needs to do.", `Match that need to the tested property ${item.property}.`], explanation: `${sentenceStart(item.material)} is suitable for this model job because the tested sample is ${item.property}. This does not make it best for every job.`, difficulty: 4, tag: "appearance_instead_of_property", hook: "maker-design-mission",
    correct: `Design evidence linked: ${item.material} → ${item.property} → ${item.need}.`, repair: "Keep the job card visible, compare one tested property at a time and ignore colour preferences.", tactile: "Use material-symbol cards and a tactile property icon; a text-only evidence route is always available.", safety: "Use only models and reviewed sample evidence; do not test materials on bodies, with heat or with sharp/breakable objects.",
  });
}

function retrievalObjectMaterial(index) {
  const item = objectSamples[(index * 3 + 1) % objectSamples.length];
  const answer = `${item.object} is the object; ${item.material} is the material of the marked ${item.part}`;
  const choices = rotate([answer, `${item.material} is the object and ${item.object} is the material`, `${item.object} and ${item.material} are both object names`], index % 3);
  return candidate({
    id: `review-link-${item.id}-${index + 1}`, format: "evidence-tap", blueprint: "materials-evidence-spaced-review", band: "retrieval", concept: "object_material_retrieval",
    prompt: `Label-check mission ${index + 1}: which sentence correctly uses object and material?`, body: { object: item.object, material: item.material, marked_part: item.part, choices, reviewed_image_description: item.description, interaction_mode: "choose_sentence_match_labels_or_say", review_interval_days: reviewDay(index) }, answer,
    hints: ["Object tells what the item is.", "Material tells what the marked example is made from."], explanation: answer + ".", difficulty: 3, tag: "object_name_for_material", hook: "maker-label-check",
    correct: "Object and material labels placed in their different roles.", repair: "Use two sentence frames: This is a __. It is made from __.", tactile: "Use separate raised OBJECT and MATERIAL heading cards with audio and text labels.", safety: "Use a reviewed image or clean replica; direct handling is optional.",
  });
}

function retrievalProperty(index) {
  const item = propertyTests[(index * 7 + 4) % propertyTests.length];
  const choices = rotate([item.observation, "Its colour matches the maker badge.", "The object name proves the property without a test."], index % 3);
  return candidate({
    id: `review-property-${item.id}-${index + 1}`, format: "evidence-tap", blueprint: "materials-evidence-spaced-review", band: "retrieval", concept: "property_evidence_retrieval",
    prompt: `Evidence revisit ${index + 1}: which observation supports calling this sample ${item.conclusion}?`, body: { sample: item.sample, claim: item.conclusion, choices, test: item.method, interaction_mode: "choose_evidence_keyboard_switch_point_or_aac", review_interval_days: reviewDay(index) }, answer: item.observation,
    hints: ["Choose what was seen in the named test.", "Colour and object name are not test results for this property."], explanation: `${item.observation} This is the observation that supports ${item.conclusion} for this sample.`, difficulty: 3, tag: "claim_without_test_evidence", hook: "maker-evidence-revisit",
    correct: `Claim supported with the observed result: ${item.conclusion}.`, repair: "Match the claim to the before-and-after text panel, not to a picture preference.", tactile: "Use a tactile property symbol and an adult-read observation card; no direct test is required.", safety: testSafety(item.type),
  });
}

function retrievalMisconception(index) {
  const cases = [
    ["A shiny sample must be metal.", "Not always. Shiny describes a property; different materials can have shiny examples.", "shiny_means_metal"],
    ["Every object with the same name uses the same material.", "Not always. Spoons, chairs and bags can be made from different materials.", "one_object_one_material"],
    ["A material has only one property.", "A tested sample can have several properties, such as smooth and stiff.", "one_property_only"],
    ["We can sort by colour when the rule says absorbent.", "Use the named absorbent test evidence, not colour.", "sort_by_colour_or_use"],
    ["Hard and strong mean exactly the same thing.", "They are different property ideas; a simple press test only gives evidence about hardness.", "property_words_conflated"],
  ];
  const [claim, answer, tag] = cases[Math.floor(index / 4) % cases.length];
  const choices = rotate([answer, "The claim is always correct for every object.", "Choose by the brightest colour instead of evidence."], index % 3);
  return candidate({
    id: `review-repair-${slug(tag)}-${index + 1}`, format: "evidence-tap", blueprint: "materials-evidence-spaced-review", band: "retrieval", concept: "materials_misconception_repair",
    prompt: `Repair mission ${index + 1}: a maker says, “${claim}” Which response uses science evidence?`, body: { claim, choices, interaction_mode: "choose_repair_listen_keyboard_switch_or_teach_back", review_interval_days: reviewDay(index) }, answer,
    hints: ["Look for words such as every or always.", "Choose the response that names a test, sample or clear counterexample."], explanation: answer, difficulty: 4, tag, hook: "maker-idea-repair",
    correct: "Maker idea repaired with cautious, evidence-based language.", repair: "Replace always with a claim about the tested sample, then name the observation that supports it.", tactile: "Use TRUE FOR THIS SAMPLE and NOT ENOUGH EVIDENCE tactile cards with adult-read text.", safety: "Use provided evidence cards; no child-run test is required.",
  });
}

function candidate({ id, format, blueprint, band, concept, prompt, body, answer, hints, explanation, difficulty, tag, hook, correct, repair, tactile, safety = "Use reviewed images, simulations or adult-managed clean samples; stop or choose the text route if any sensory discomfort occurs." }) {
  const fullId = `${prefix}${id}`;
  return {
    id: fullId,
    format,
    body: {
      prompt, ...body,
      concept_focus: concept,
      response_mode: "tap_drag_keyboard_switch_eye_gaze_aac_oral_or_adult_scribed",
      supported_interaction: "adult_or_peer_may_read_scan_handle_tools_and_record_without_supplying_the_science_answer",
      visual_route: "large reviewed still image, marked target part, high-contrast icons and complete text description",
      tactile_route: tactile,
      text_route: "plain-language sample, test, observation and conclusion panels",
      sensory_choice: { direct_touch_required: false, no_touch_tool_route: true, text_only_route: true, gloves_optional: true, sound_effects_default_off: true, smell_or_taste_tasks_prohibited: true },
      safety_note: safety,
      audio_replay: true,
      audio_asset_id: `narration-${fullId}`,
      audio_provider: "ElevenLabs",
      audio_asset_status: "required_human_listening_review",
      human_listening_approval_required: true,
      browser_tts_allowed: false,
      reduced_motion: "static_before_after_and_instant_sort",
      no_timer: true,
      speed_score_allowed: false,
      retry_without_penalty: true,
      preserve_correct_observations: true,
      gamification: { mission: "help the Joyful Maker Guild label, test or choose materials for a model", reward: "one calm maker spark for an observation or evidence link", loss_on_error: false, streak_pressure: false, leaderboard: false, speed_bonus: false, retry_message: "Your useful observation stays on the maker board. Open another clue and try again." },
      difficulty_band: band,
      evidence_purpose: blueprint.replaceAll("-", "_"),
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
    },
    expected_answer: { value: answer }, hints, explanation,
    feedback: { correct, repair, evidence: explanation, observation_praise: "A precise observation is useful even when the material or property word needs another look." },
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
    if (!variant.body.visual_route || !variant.body.tactile_route || !variant.body.text_route || !variant.body.supported_interaction) throw new Error(`${variant.id} lacks SEND routes.`);
    if (variant.body.sensory_choice?.direct_touch_required !== false || variant.body.sensory_choice?.text_only_route !== true || variant.body.sensory_choice?.smell_or_taste_tasks_prohibited !== true) throw new Error(`${variant.id} lacks sensory-safe choice.`);
    if (!variant.body.response_mode.includes("keyboard") || !variant.body.response_mode.includes("switch") || !variant.body.response_mode.includes("eye_gaze") || !variant.body.response_mode.includes("aac")) throw new Error(`${variant.id} lacks supported responses.`);
    if (variant.body.audio_provider !== "ElevenLabs" || variant.body.audio_asset_status !== "required_human_listening_review" || variant.body.browser_tts_allowed !== false) throw new Error(`${variant.id} violates audio policy.`);
    if (variant.body.no_timer !== true || variant.body.speed_score_allowed !== false || variant.body.gamification?.streak_pressure !== false || variant.body.gamification?.loss_on_error !== false) throw new Error(`${variant.id} introduces pressure.`);
    if (!variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.evidence || !variant.feedback?.observation_praise) throw new Error(`${variant.id} lacks rich feedback.`);
    const choices = variant.body.choices;
    if (!Array.isArray(choices) || choices.length < 3 || new Set(choices.map((choice) => JSON.stringify(choice))).size !== choices.length) throw new Error(`${variant.id} has invalid choices.`);
    if (choices.filter((choice) => JSON.stringify(choice) === JSON.stringify(variant.expected_answer.value)).length !== 1) throw new Error(`${variant.id} must offer exactly one expected answer.`);
    if (variant.body.prompt.length > 150) throw new Error(`${variant.id} prompt is too long for Year 1.`);
    if (/every (wood|plastic|glass|metal|rock|paper|fabric|rubber) (is|has|can)/i.test(`${variant.body.prompt} ${variant.explanation}`)) throw new Error(`${variant.id} makes an unsafe universal property claim.`);
  }
  const allocation = countBy(currentPack.question_variants, (variant) => variant.body.variant_blueprint_id);
  for (const [id, expected] of Object.entries(pilotAllocation)) if (allocation[id] !== expected) throw new Error(`${id} expected ${expected}, found ${allocation[id] ?? 0}.`);
  const requiredMaterials = ["wood", "plastic", "glass", "metal", "water", "rock"];
  for (const material of requiredMaterials) if (!generated.some((variant) => variant.body.target_material === material || variant.body.material === material || normalise(variant.explanation).includes(material))) throw new Error(`Missing material ${material}.`);
  const concepts = new Set(generated.map((variant) => variant.body.concept_focus));
  for (const concept of ["object_material_distinction", "common_material_identification", "simple_property_test", "property_rule_grouping", "simple_suitability_from_property", "materials_misconception_repair"]) if (!concepts.has(concept)) throw new Error(`Missing concept ${concept}.`);
}

function sample(id, object, material, part, description) { return { id, object, material, part, description }; }
function test(id, sampleName, method, observation, conclusion, distractors, type) { return { id, sample: sampleName, method, observation, conclusion, distractors, type }; }
function suit(id, object, need, material, property, wrong) { return { id, object, need, material, property, wrong }; }
function materialFallback(material) { return { id: `${material}-sample`, object: `${material} sample`, material, part: "whole sample", description: `a teacher-reviewed representative ${material} sample` }; }
function sameObjectPair(material) { const item = objectSamples.find((sampleItem) => sampleItem.material === material && objectSamples.some((other) => other.object === sampleItem.object && other.material !== material)); return item ? objectSamples.filter((other) => other.object === item.object).slice(0, 3) : null; }
function otherMaterial(correct, index) { return rotate(["wood", "plastic", "glass", "metal", "water", "rock", "paper", "fabric", "rubber"].filter((material) => material !== correct), index % 8)[0]; }
function materialDistractors(correct, index) { return rotate(["wood", "plastic", "glass", "metal", "water", "rock", "paper", "fabric", "rubber"].filter((material) => material !== correct), index % 8).slice(0, 2); }
function propertyOpposite(property) { return { transparent: "opaque", opaque: "transparent", absorbent: "not absorbent", "not absorbent": "absorbent", soft: "hard", hard: "soft", stretchy: "stiff", stiff: "bendy", bendy: "stiff", rough: "smooth", smooth: "rough", shiny: "dull", dull: "shiny" }[property]; }
function testSafety(type) { return { water_drop: "Adult-managed tiny water drop on a tray; offer still images and text instead; wash hands and stop for allergies.", light_view: "Use intact teacher-managed or simulated samples; never handle broken glass or look at bright light sources.", gentle_press: "Use a simulation or clean soft sample; no forceful pressing and no body testing.", gentle_stretch: "Adult demonstration or simulation only; keep bands away from faces and do not overstretch.", bend_model: "Use a simulation; do not snap materials.", fold: "Use a clean sample or static before-and-after images.", surface_view: "Use a magnified image, tool or optional gentle touch; do not require direct sensory contact.", reflection_view: "Use a still image under ordinary room light; no bright beams or glare exposure." }[type]; }
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
