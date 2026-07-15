#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/sc-y2-plants.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y2-plants-bank-";
const reviewBatch = "y2-plants-pilot-a";
const pilotAllocation = {
  "seed-and-bulb-growth-sequences": 44,
  "dated-observation-comparisons": 44,
  "one-need-fair-comparisons": 44,
  "germination-and-healthy-growth-reasoning": 44,
  "suitable-not-maximum-retrieval": 44,
};

if (write && check) throw new Error("Choose either --write or --check, not both.");

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y2-plants") throw new Error("This generator only supports the Year 2 plants pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedCounts = countBy(curated, (variant) => variant.body?.variant_blueprint_id);
const targets = Object.fromEntries(Object.entries(pilotAllocation).map(([id, count]) => [id, count - (curatedCounts[id] ?? 0)]));
for (const [id, count] of Object.entries(targets)) {
  if (count < 0) throw new Error(`Curated variants exceed the allocation for ${id}.`);
}

const generated = [
  ...sequenceCandidates(targets["seed-and-bulb-growth-sequences"]),
  ...observationCandidates(targets["dated-observation-comparisons"]),
  ...fairComparisonCandidates(targets["one-need-fair-comparisons"]),
  ...germinationCandidates(targets["germination-and-healthy-growth-reasoning"]),
  ...retrievalCandidates(targets["suitable-not-maximum-retrieval"]),
];

pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa.notes = "Review-stage Year 2 plants pack with a deterministic 220-item pilot bank. Five curated variants are preserved alongside candidates covering seed and bulb growth, germination, dated observation, fair comparisons, suitable conditions, seasonal context and misconception repair. Every generated item includes SEND scaffolds, visual or tactile alternatives, supported response routes, evidence-rich feedback, safety-aware practical guidance and untimed low-pressure progress. Independent science, teacher, accessibility, safeguarding and renderer review is still required before promotion.";

validateBank(pack, curated, generated);

enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y2-plants-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y2-plants-bank blueprints=${summary(pack.question_variants, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`y2-plants-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y2-plants-bank misconceptions=${summary(pack.question_variants, (variant) => variant.misconception_tag)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y2-plants-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 2 plants bank is out of date; run generate-y2-plants-bank.mjs --write.");
  console.log("y2-plants-bank deterministic check passed");
} else {
  console.log("y2-plants-bank dry-run; pass --write to update the pack");
}

function sequenceCandidates(count) {
  const cases = [
    sequence("bean", "seed", ["dry bean seed", "first root emerges", "shoot rises", "leaves open", "larger bean plant"], "The root emerges before the shoot and leaves develop."),
    sequence("sunflower", "seed", ["sunflower seed", "first root emerges", "curved shoot appears", "first leaves open", "larger leafy plant"], "The young root starts water uptake before the leafy shoot develops."),
    sequence("pea", "seed", ["pea seed", "root grows down", "shoot grows up", "leaves unfold", "pea plant climbs"], "Roots and shoots develop in different directions as the pea grows."),
    sequence("cress", "seed", ["tiny cress seed", "root appears", "short shoot appears", "seed leaves open", "leafy cress plant"], "Small seeds still contain living material that can germinate."),
    sequence("pumpkin", "seed", ["flat pumpkin seed", "root emerges", "thick shoot appears", "seed leaves open", "larger vine plant"], "A pumpkin seed develops new structures rather than unfolding a tiny adult plant."),
    sequence("daffodil", "bulb", ["resting daffodil bulb", "roots grow", "green shoot appears", "leaves lengthen", "flowering plant"], "The bulb stores food and grows roots and a shoot."),
    sequence("tulip", "bulb", ["resting tulip bulb", "roots grow", "pointed shoot appears", "leaves unfold", "flowering plant"], "A tulip bulb can begin growth when seasonal conditions become suitable."),
    sequence("onion", "bulb", ["onion bulb", "new roots appear", "green shoot appears", "leaves lengthen", "larger onion plant"], "The bulb is a plant structure, not a seed."),
    sequence("hyacinth", "bulb", ["resting hyacinth bulb", "roots grow", "thick shoot appears", "leaves open", "flower spike develops"], "The visible stages show gradual growth from a bulb."),
    sequence("garlic", "bulb clove", ["garlic clove", "roots emerge", "green shoot appears", "leaves lengthen", "larger garlic plant"], "A garlic clove stores food that supports early growth."),
    sequence("acorn", "seed", ["acorn", "root breaks through", "shoot emerges", "first leaves open", "young oak sapling"], "A tree seed can take longer to develop than a classroom bean."),
  ];
  const views = ["picture cards", "raised-outline cards", "audio-described cards", "large-print word cards"];
  return Array.from({ length: count }, (_, index) => {
    const item = cases[index % cases.length];
    const view = views[Math.floor(index / cases.length) % views.length];
    const stages = rotate(item.stages, (index % (item.stages.length - 1)) + 1);
    return candidate({
      id: `sequence-${item.key}-${index + 1}`,
      format: "growth-sequence",
      blueprint: "seed-and-bulb-growth-sequences",
      band: "intro",
      prompt: `Growth trail ${index + 1}: put the ${item.key} ${view} in first-to-later order.`,
      body: { plant: item.key, starting_structure: item.start, stages, ordered_model: item.stages, season_note: seasonNote(item.key), interaction_mode: "order_cards_or_number_each_stage" },
      answer: item.stages,
      hints: ["Find the seed or bulb before looking for a root.", "Next find the first root, then follow the shoot and leaves."],
      explanation: `${item.stages.join(" → ")}. ${item.explanation} Different plants can grow at different rates.`,
      difficulty: 2 + (index % 3),
      tag: index % 4 === 0 ? "seed_is_not_living" : "tiny_adult_inside",
      hook: "calm-growth-card-order",
      correct: "Trail complete. You used visible stages to place growth forwards.",
      repair: `Keep the ${item.start} first. Look for the first root before the leafy stages.`,
      scaffold: "First I notice __. Next __ appears. Later the plant has __.",
      tactile: "Use five thick cards with a seed-or-bulb shape, root line, shoot line and leaf textures.",
      safety: "Use clean photographs or teacher-provided specimens; do not taste seeds, bulbs or plant parts.",
    });
  });
}

function observationCandidates(count) {
  const records = [
    record("bean", 3, 2, 0, "short pale shoot", 7, 6, 2, "green shoot with two leaves"),
    record("sunflower", 4, 3, 0, "curved shoot", 9, 9, 2, "upright shoot with two leaves"),
    record("pea", 5, 4, 2, "short green seedling", 12, 11, 6, "taller plant with six leaves"),
    record("cress", 2, 1, 0, "root just visible", 6, 4, 2, "small green seed leaves"),
    record("onion bulb", 1, 0, 0, "no shoot visible", 8, 5, 1, "one firm green shoot"),
    record("daffodil bulb", 6, 3, 1, "one short leaf", 13, 10, 3, "three longer green leaves"),
    record("bean", 8, 7, 2, "green leaves and firm stem", 15, 12, 5, "more green leaves and firm stem"),
    record("pea", 7, 8, 4, "upright green shoot", 14, 9, 4, "same leaves but stem is bent"),
    record("sunflower", 6, 8, 2, "green leaves", 13, 13, 4, "four green leaves"),
    record("tulip bulb", 4, 2, 1, "one pointed shoot", 11, 7, 2, "two firm green leaves"),
    record("acorn", 10, 3, 0, "shoot without open leaves", 24, 8, 3, "three open green leaves"),
  ];
  const representations = ["dated picture log", "large-print table", "audio-described log", "tactile height strip"];
  return Array.from({ length: count }, (_, index) => {
    const item = records[index % records.length];
    const representation = representations[Math.floor(index / records.length) % representations.length];
    const heightChange = item.later.height - item.early.height;
    const leafChange = item.later.leaves - item.early.leaves;
    const correct = `It grew ${heightChange} cm taller and the leaf count changed by ${leafChange}.`;
    const choices = rotate([correct, "It is happy because it is taller.", "Nothing changed between the dates.", "The plant chose to make leaves."], index % 4);
    return candidate({
      id: `observe-${slug(item.plant)}-${index + 1}`,
      format: "observation-record",
      blueprint: "dated-observation-comparisons",
      band: "developing",
      prompt: `Observation log ${index + 1}: which statement compares both dates for the ${item.plant}?`,
      body: { plant: item.plant, representation, observations: [item.early, item.later], choices, scale_cue: "centimetre ruler from soil line", interaction_mode: "choose_or_build_observation_sentence" },
      answer: correct,
      hints: ["Read the earlier and later dates.", "Subtract the heights, then compare the leaf counts."],
      explanation: `Height changed from ${item.early.height} cm to ${item.later.height} cm, and leaves changed from ${item.early.leaves} to ${item.later.leaves}. Colour and stem observations are useful too.`,
      difficulty: 3 + (index % 3),
      tag: index % 3 === 0 ? "height_only_health" : "guess_instead_of_observe",
      hook: "dated-log-evidence-highlight",
      correct: "Careful observer badge progress: you used a date, a measure and a count.",
      repair: "Try one evidence box at a time: date, height, leaves, then visible colour or stem shape.",
      scaffold: "On day __ it was __ cm with __ leaves. By day __, __ changed.",
      tactile: "Offer counting counters for leaves and a notched height strip; an adult may record the spoken comparison.",
      safety: "Measure a stable teacher-provided pot on a table; wash hands after handling soil and stop if any allergy is known.",
    });
  });
}

function fairComparisonCandidates(count) {
  const tests = [
    test("water-none", "water", "no water", "a suitable measured amount of water", "same light, warmth, plant type and time", "The watered plant grew new leaves; the unwatered plant wilted.", "This comparison suggests water helped these plants stay healthy during the test."),
    test("water-excess", "amount of water", "a suitable measured amount", "much more water with the pot left waterlogged", "same light, warmth, plant type and time", "The suitably watered plant stayed firm; the waterlogged plant became yellow and weak.", "For these plants, a suitable amount worked better than excess water."),
    test("light-dark", "light", "daylight", "a dark cupboard", "same water, warmth, plant type and time", "Both shoots lengthened, but the dark-grown shoot was pale and weak.", "Light was linked with healthier colour and strength after germination."),
    test("light-direction", "light direction", "light from above", "light from one side", "same water, warmth, plant type and time", "The second shoot bent towards the side light.", "The changed light direction was linked with different shoot direction."),
    test("temperature-cool", "temperature", "a suitably warm room", "a cooler safe place", "same water, light, seed type and time", "More seeds germinated in the suitably warm room during the recorded week.", "Suitable warmth supported more germination in this sample and time period."),
    test("temperature-hot", "temperature", "a suitably warm room", "a much hotter simulated setting", "same water, light, seed type and time", "The suitable group germinated; fewer seeds in the simulated hot group did.", "Hotter was not better in this model; plants need a suitable temperature."),
    test("two-changes", "water", "water with daylight", "no water in darkness", "plant type, warmth and time only", "Only the first plant grew strongly.", "The result cannot show whether water or light made the difference because two conditions changed."),
    test("soil-claim", "growing medium", "damp paper towel", "moist compost", "water, warmth, seed type and time", "Seeds in both groups began to germinate.", "This evidence does not support the claim that every seed must be in soil to germinate."),
    test("sample-size", "water", "one watered seed", "one unwatered seed", "light, warmth, seed type and time", "Only the watered seed germinated.", "This result is evidence for these seeds, but a larger repeated sample would give more confidence."),
    test("season", "seasonal temperature", "spring temperature record", "winter temperature record", "same seed model, water, light and observation time", "The spring model reached suitable warmth sooner.", "Season can change temperature and day length, but weather and species vary."),
    test("bulb-water", "water", "dry bulb pot", "suitably watered bulb pot", "same light, warmth, bulb type and time", "Roots and a shoot appeared in the suitably watered pot.", "The comparison suggests suitable water supported growth from these bulbs."),
  ];
  return Array.from({ length: count }, (_, index) => {
    const item = tests[index % tests.length];
    const correct = item.conclusion;
    const choices = rotate([correct, "The plant in the tallest pot proves the rule for every plant.", "More of every condition is always best.", "Plants decide whether they want to grow."], index % 4);
    return candidate({
      id: `fair-${item.key}-${index + 1}`,
      format: "plant-needs-test",
      blueprint: "one-need-fair-comparisons",
      band: "expected",
      prompt: `Fair-test station ${index + 1}: which conclusion is supported by this plant comparison?`,
      body: { changed_condition: item.condition, group_a: item.a, group_b: item.b, kept_same: item.same, observation: item.observation, choices, interaction_mode: "predict_reveal_compare_explain", prediction_not_scored: true },
      answer: correct,
      hints: ["Check what changed and what stayed the same.", `Use the result: ${item.observation}`],
      explanation: `${item.observation} ${item.conclusion} A result may vary, so the conclusion stays close to this evidence.`,
      difficulty: 4 + (index % 3),
      tag: item.key === "two-changes" ? "several_conditions_changed" : item.key === "soil-claim" ? "soil_is_food" : "universal_claim_from_one_test",
      hook: "one-change-evidence-reveal",
      correct: "Evidence link made. Your prediction could be different and still be a useful idea to test.",
      repair: `Point to the one changed condition (${item.condition}), then match your conclusion to the observed result.`,
      scaffold: "We changed __. We kept __ the same. We observed __. This suggests __.",
      tactile: "Use two matching pot mats, one removable condition token and raised SAME/CHANGED labels.",
      safety: "Use a simulation or an adult-led setup. Never use extreme heat, taste plants, or handle mould; adults dispose of spoiled material.",
    });
  });
}

function germinationCandidates(count) {
  const cases = [
    reason("dark-start", "A bean in darkness opened and a root appeared. Later its shoot was pale and weak.", "Stored food supported early germination, but the young plant needed light for continued healthy growth.", "germination_means_no_light_needed"),
    reason("water-start", "Dry seeds did not change. Similar seeds given water opened and grew roots.", "Water was linked with germination in this comparison.", "seed_is_not_living"),
    reason("warmth-start", "Wet seeds in a suitably warm place germinated sooner than matching wet seeds in a cool place.", "A suitable temperature affected how many seeds germinated during the recorded time.", "maximum_heat_is_best"),
    reason("bulb-stores", "A daffodil bulb grew roots and a shoot before its leaves were fully open.", "The bulb's stored food supported early growth while roots and leaves developed.", "bulb_is_a_seed"),
    reason("root-first", "The seed coat split and a root appeared before the shoot.", "The seed is germinating; the first root is an early visible stage.", "tiny_adult_inside"),
    reason("not-all", "Seven of ten seeds germinated under the same suitable conditions.", "The evidence describes this sample; suitable conditions do not guarantee every seed will germinate.", "conditions_guarantee_growth"),
    reason("soil-not-food", "Seedlings in compost and in a supported water culture both made new leaves when they had light and suitable conditions.", "Plants do not eat soil; the evidence shows growth can occur in different supported media.", "soil_is_food"),
    reason("height-health", "The dark-grown shoot was taller, pale and floppy; the light-grown shoot was shorter, green and firm.", "Height alone is not enough: colour and stem strength show the light-grown plant looked healthier.", "height_only_health"),
    reason("too-much-water", "A waterlogged seedling had yellow leaves while a suitably watered match had firm green leaves.", "A suitable amount of water supported healthier growth than excess water in this comparison.", "more_is_always_better"),
    reason("season-spring", "The same bulb bed had no visible shoots in January and shoots in March as conditions became warmer.", "Seasonal conditions can affect when growth is visible; the bulb was not necessarily dead in January.", "no_visible_growth_means_dead"),
    reason("seed-living", "A dry seed showed no movement, then formed a root after water and suitable warmth were provided.", "The seed was living but inactive before suitable germination conditions were present.", "seed_is_not_living"),
  ];
  return Array.from({ length: count }, (_, index) => {
    const item = cases[index % cases.length];
    const choices = rotate([item.answer, "The evidence proves the same result for every plant species.", "Plants grow because they want to reach a prize.", "The greatest amount of water, light and heat is always healthiest."], index % 4);
    return candidate({
      id: `reason-${item.key}-${index + 1}`,
      format: "evidence-choice",
      blueprint: "germination-and-healthy-growth-reasoning",
      band: "secure",
      prompt: `Plant detective card ${index + 1}: which explanation best fits the early and later evidence?`,
      body: { timeline_evidence: item.evidence, choices, interaction_mode: "listen_read_then_choose_or_say", evidence_chunks: ["early evidence", "later evidence", "best explanation"] },
      answer: item.answer,
      hints: ["Separate starting to grow from staying healthy later.", "Use may, can or suggests when the evidence is from one sample."],
      explanation: `${item.answer} The explanation uses the observations without turning one result into a rule for every plant.`,
      difficulty: 5 + (index % 2),
      tag: item.tag,
      hook: "early-later-evidence-lens",
      correct: "Case solved with evidence. You can revisit any card; there is no streak to lose.",
      repair: "Listen to the early evidence first, then the later evidence. Choose the explanation that fits both.",
      scaffold: "At first __. Later __. This suggests __, but it does not prove __ for every plant.",
      tactile: "Provide EARLY and LATER trays with one textured evidence symbol per statement and an adult reader if wanted.",
      safety: "Use recorded observations or clean teacher-managed samples; avoid unknown plants, mould and tasting.",
    });
  });
}

function retrievalCandidates(count) {
  const cases = [
    retrieve("water", "dry, suitably watered and waterlogged bean plants", "The suitably watered plant has firm green leaves; too little or too much water may reduce healthy growth.", "more_is_always_better"),
    retrieve("temperature", "cool, suitably warm and very hot simulated seed trays", "A suitable temperature supports germination; hottest is not automatically best.", "maximum_heat_is_best"),
    retrieve("light", "dark-grown and light-grown seedlings after germination", "The light-grown seedling's green leaves and firm stem are stronger health evidence than height alone.", "height_only_health"),
    retrieve("fair test", "two similar plants with only light changed", "Keeping water, temperature, plant type and time alike makes the light comparison clearer.", "several_conditions_changed"),
    retrieve("observation", "day 4 and day 10 cards", "Dates, height, leaf count, colour and stem shape provide observable evidence.", "guess_instead_of_observe"),
    retrieve("germination", "a seed with its first root showing", "Germination has begun because the seed has started to grow.", "germination_is_mature_growth"),
    retrieve("bulb", "a bulb with roots below and a shoot above", "A bulb stores food and can grow roots and a shoot; it is not the same structure as a seed.", "bulb_is_a_seed"),
    retrieve("season", "winter bulb bed and spring shoots", "Some plants show different stages in different seasons as light and temperature change.", "season_is_fixed_rule"),
    retrieve("living seed", "a dry seed before and after suitable conditions", "A seed can be living while inactive, then germinate when conditions are suitable.", "seed_is_not_living"),
    retrieve("cautious claim", "one class trial with eight seeds", "The result supports a claim about this sample, not every seed everywhere.", "universal_claim_from_one_test"),
    retrieve("plant health", "one tall pale plant and one shorter green firm plant", "Use several features, not height alone, when describing plant health.", "height_only_health"),
  ];
  const openings = ["Meadow map check", "Calm badge review", "Garden trail revisit", "No-rush recall card"];
  return Array.from({ length: count }, (_, index) => {
    const item = cases[index % cases.length];
    const correct = item.answer;
    const choices = rotate([correct, "The biggest amount is always healthiest.", "One result proves a rule for every plant.", "A plant changes because it decides to."], index % 4);
    return candidate({
      id: `retrieval-${slug(item.key)}-${index + 1}`,
      format: "fair-comparison",
      blueprint: "suitable-not-maximum-retrieval",
      band: "retrieval",
      prompt: `${openings[Math.floor(index / cases.length) % openings.length]} ${index + 1}: which statement uses the plant evidence?`,
      body: { focus: item.key, evidence_panel: item.evidence, choices, retrieval_round: Math.floor(index / cases.length) + 1, interaction_mode: "choose_point_or_say_with_optional_replay" },
      answer: correct,
      hints: ["Look for a suitable condition, not simply the greatest amount.", "Choose the claim that stays close to the named evidence."],
      explanation: `${item.answer} This review connects earlier learning to a fresh evidence card.`,
      difficulty: 3 + (Math.floor(index / cases.length) % 3),
      tag: item.tag,
      hook: "calm-retrieval-map-glow",
      correct: "Review point collected. Points show practice completed, not speed or perfect streaks.",
      repair: `Reopen the ${item.key} evidence panel and cross out claims using “always” or “every” without enough evidence.`,
      scaffold: "The evidence shows __. A suitable __ helps because __.",
      tactile: "Use three condition tokens and a tactile evidence card; allow pointing, eye-gaze, signing or partner-assisted scanning.",
      safety: "This is a recorded or simulated review. Any real planting remains adult-supported with handwashing and known non-toxic species.",
    });
  });
}

function candidate({ id, format, blueprint, band, prompt, body, answer, hints, explanation, difficulty, tag, hook, correct, repair, scaffold, tactile, safety }) {
  return {
    id: `${prefix}${id}`,
    format,
    body: {
      prompt,
      ...body,
      response_mode: "tap_drag_keyboard_switch_eye_gaze_or_oral",
      supported_interaction: "adult_or_peer_may_read_scan_point_and_record_without_answering",
      sentence_scaffold: scaffold,
      visual_access: "large_clear_images_high_contrast_labels_and_text_equivalent",
      tactile_alternative: tactile,
      audio_replay: true,
      static_evidence_panel: true,
      reduced_motion: "instant_state_change",
      no_timer: true,
      retry_without_penalty: true,
      low_pressure_progress: "one_calm_garden_map_point_for_completion_not_correctness",
      practical_safety: safety,
      difficulty_band: band,
      evidence_purpose: blueprint.replaceAll("-", "_"),
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
    },
    expected_answer: { value: answer },
    hints,
    explanation,
    feedback: { correct, repair, evidence: explanation },
    difficulty,
    status: "review",
    misconception_tag: tag,
    animation_hook: hook,
  };
}

function validateBank(currentPack, authored, generated) {
  if (authored.length !== 5) throw new Error(`Expected exactly 5 curated variants, found ${authored.length}. Refusing to overwrite possible authored work.`);
  if (currentPack.question_variants.length !== currentPack.practice.variant_targets.pilot) throw new Error(`Expected ${currentPack.practice.variant_targets.pilot} variants, found ${currentPack.question_variants.length}.`);
  const blueprints = new Map(currentPack.variant_blueprints.map((blueprint) => [blueprint.id, blueprint]));
  const ids = new Set();
  const signatures = new Set();
  for (const variant of currentPack.question_variants) {
    if (ids.has(variant.id)) throw new Error(`Duplicate variant id ${variant.id}.`);
    ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${JSON.stringify(variant.expected_answer)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`);
    signatures.add(signature);
  }
  for (const variant of generated) {
    const blueprint = blueprints.get(variant.body.variant_blueprint_id);
    if (!blueprint) throw new Error(`${variant.id} has no registered blueprint.`);
    if (variant.format !== blueprint.format || variant.body.difficulty_band !== blueprint.difficulty_band) throw new Error(`${variant.id} does not match its blueprint contract.`);
    if (variant.status !== "review" || variant.body.review_batch !== reviewBatch) throw new Error(`${variant.id} must remain a review candidate.`);
    if (!variant.body.response_mode.includes("keyboard") || !variant.body.response_mode.includes("switch") || !variant.body.response_mode.includes("eye_gaze")) throw new Error(`${variant.id} lacks supported response routes.`);
    for (const field of ["sentence_scaffold", "visual_access", "tactile_alternative", "supported_interaction", "practical_safety", "low_pressure_progress"]) {
      if (!variant.body[field]) throw new Error(`${variant.id} is missing ${field}.`);
    }
    if (variant.body.no_timer !== true || variant.body.retry_without_penalty !== true || variant.body.static_evidence_panel !== true) throw new Error(`${variant.id} lacks low-pressure access settings.`);
    if (!variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.evidence) throw new Error(`${variant.id} lacks rich feedback.`);
    const choices = variant.body.choices;
    if (choices) {
      if (new Set(choices.map((choice) => JSON.stringify(choice))).size !== choices.length) throw new Error(`${variant.id} repeats a choice.`);
      if (choices.filter((choice) => JSON.stringify(choice) === JSON.stringify(variant.expected_answer.value)).length !== 1) throw new Error(`${variant.id} must contain exactly one answer choice.`);
    } else if (variant.format !== "growth-sequence") {
      throw new Error(`${variant.id} has no choices.`);
    }
    if (variant.body.prompt.length > 130) throw new Error(`${variant.id} prompt is too long for Year 2.`);
  }
  const allocation = countBy(currentPack.question_variants, (variant) => variant.body.variant_blueprint_id);
  for (const [id, expected] of Object.entries(pilotAllocation)) if (allocation[id] !== expected) throw new Error(`${id} expected ${expected}, found ${allocation[id] ?? 0}.`);
}

function sequence(key, start, stages, explanation) { return { key, start, stages, explanation }; }
function record(plant, day1, height1, leaves1, description1, day2, height2, leaves2, description2) {
  return { plant, early: { day: day1, height: height1, leaves: leaves1, description: description1 }, later: { day: day2, height: height2, leaves: leaves2, description: description2 } };
}
function test(key, condition, a, b, same, observation, conclusion) { return { key, condition, a, b, same, observation, conclusion }; }
function reason(key, evidence, answer, tag) { return { key, evidence, answer, tag }; }
function retrieve(key, evidence, answer, tag) { return { key, evidence, answer, tag }; }
function seasonNote(key) {
  if (["daffodil", "tulip", "hyacinth"].includes(key)) return "Often visible in spring in the UK, but timing varies with species, place and weather.";
  if (key === "acorn") return "Acorns often fall in autumn; germination timing varies with conditions.";
  return "Classroom timing is one example and is not a fixed timetable for every plant.";
}
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function slug(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function normalise(value) { return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " "); }
function countBy(items, keyFor) { const result = {}; for (const item of items) { const key = keyFor(item); result[key] = (result[key] ?? 0) + 1; } return result; }
function summary(items, keyFor) { return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
