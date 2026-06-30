#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packPath = path.resolve(argValue("--pack") ?? path.join(repoRoot, "packages/content/packs/sc-y2-living-things-and-habitats.pack.sample.json"));
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y2-living-habitats-bank-";
const reviewBatch = "y2-living-habitats-pilot-a";
const reviewDays = [1, 3, 7, 14, 30];
const allocation = {
  "clear-life-status-evidence": 44,
  "boundary-case-life-history": 44,
  "habitat-needs-evidence": 44,
  "microhabitat-observation-transfer": 44,
  "simple-food-chain-builds": 44,
};

const lifeItems = [
  life("potted bean plant", "living now", "It grows and needs water and light."), life("earthworm", "living now", "It feeds, grows and responds to its surroundings."),
  life("oak tree", "living now", "It grows, needs resources and produces new growth."), life("garden snail", "living now", "It feeds, grows and responds to its surroundings."),
  life("grass plant", "living now", "It grows and needs water and light."), life("bird", "living now", "It feeds, breathes, grows and responds."),
  life("fallen dry leaf", "was once living", "It was part of a living plant but is no longer alive."), life("dead twig fallen from a tree", "was once living", "It grew as part of a living tree but is no longer alive."),
  life("shed feather", "was once living material", "It was produced by a living bird but is not itself alive now."), life("empty seashell", "was once living material", "It was made by a living animal but is not alive now."),
  life("rock", "never alive", "It has no life history and was never a living thing."), life("glass marble", "never alive", "Glass has never been alive."),
  life("metal key", "never alive", "Metal has never been alive."), life("plastic toy insect", "never alive", "It may move when pushed, but it has never been alive."),
];

const boundaryItems = [
  boundary("dry bean seed", "living now (dormant)", ["seed", "germinating seed", "young plant"], "It can germinate and grow when conditions are suitable."),
  boundary("spring bulb", "living now (dormant)", ["bulb", "shoot emerging", "growing plant"], "It can grow new shoots when conditions are suitable."),
  boundary("wooden spoon", "made from something once living", ["living tree", "cut wood", "wooden spoon"], "Its wood came from a living tree; the spoon is not alive."),
  boundary("sheet of paper", "made from something once living", ["living tree", "wood fibres", "paper"], "Its fibres came from trees; the sheet is not alive."),
  boundary("cotton cloth", "made from something once living", ["living cotton plant", "cotton fibres", "cloth"], "Its fibres came from a plant; the cloth is not alive."),
  boundary("fallen autumn leaf", "was once living", ["leaf on living tree", "leaf changes colour", "fallen leaf"], "It was alive as part of the tree and is no longer alive after falling and dying."),
];

const habitats = [
  habitat("woodlouse", "under a damp log", ["damp", "shade", "shelter", "decaying plant material"], "The damp sheltered space helps it avoid drying out and provides food."),
  habitat("earthworm", "damp soil", ["moisture", "soil", "decaying material", "shelter below ground"], "Damp soil provides suitable moisture, shelter and food material."),
  habitat("frog", "pond edge", ["water", "damp shelter", "small-animal food", "plants"], "A pond edge provides water, shelter and suitable food nearby."),
  habitat("duck", "pond and bank", ["water", "suitable food", "safe resting place", "air"], "The pond and bank provide water, food and places to rest."),
  habitat("bee", "flower-rich garden", ["flower nectar and pollen", "air", "shelter", "nesting places nearby"], "Flowers provide food and the habitat includes places to shelter or nest."),
  habitat("rabbit", "meadow and hedgerow", ["plant food", "water", "cover", "burrowing ground"], "Plants provide food and the ground and hedgerow provide cover."),
  habitat("crab", "rock pool", ["seawater", "food", "rock crevices", "shelter"], "The rock pool provides seawater, food and sheltering spaces."),
  habitat("small fish", "freshwater pond", ["water", "oxygen in water", "suitable food", "plant shelter"], "The pond provides water conditions, food and places among plants."),
  habitat("caterpillar", "leafy plant", ["leaves as food", "air", "cover among leaves", "suitable temperature"], "The plant supplies food and some shelter."),
  habitat("blue tit", "woodland and gardens", ["insect and seed food", "water", "trees for shelter", "nesting places"], "Trees and plants support food, shelter and nesting places."),
];

const microhabitats = [
  micro("under a log", "damp, shaded and sheltered", ["woodlouse", "slug"], "sunny open paving"),
  micro("leaf litter", "shaded with decaying leaves and shelter", ["millipede", "woodlouse"], "bare dry playground"),
  micro("damp soil", "moist, dark and protected below the surface", ["earthworm", "small soil animals"], "dry metal tray"),
  micro("tree bark crevice", "narrow, sheltered and textured", ["small insects", "spider"], "open water"),
  micro("pond edge", "damp with water, plants and cover", ["frog", "pond snail"], "dry cupboard"),
  micro("long grass", "sheltered among stems with plant food nearby", ["grasshopper", "small insects"], "smooth indoor desk"),
  micro("compost surface", "damp with decaying plant material", ["woodlouse", "small decomposer animals"], "clean dry stone"),
  micro("under a safely lifted stone", "shaded, sheltered and often damp", ["slug", "woodlouse"], "sunny wall top"),
];

const chains = [
  chain("meadow", ["grass", "grasshopper", "frog"]), chain("garden", ["cabbage leaf", "caterpillar", "blue tit"]),
  chain("hedgerow", ["seeds", "mouse", "owl"]), chain("meadow", ["grass", "rabbit", "fox"]),
  chain("garden", ["leaf", "snail", "thrush"]), chain("pond", ["algae", "water flea", "small fish"]),
  chain("woodland", ["oak leaf", "caterpillar", "blue tit"]), chain("field", ["grass", "vole", "owl"]),
];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y2-living-things-and-habitats") throw new Error("This generator only supports the Year 2 living-things-and-habitats pack.");
const curated = (pack.question_variants ?? []).filter((v) => !v.id.startsWith(prefix));
const curatedSnapshot = JSON.stringify(curated);
const curatedCounts = countBy(curated, (v) => v.body?.variant_blueprint_id);
const targets = Object.fromEntries(Object.entries(allocation).map(([id, total]) => [id, total - (curatedCounts[id] ?? 0)]));
for (const [id, count] of Object.entries(targets)) if (count < 0) throw new Error(`Curated variants exceed allocation for ${id}.`);

const generated = [
  ...clearStatusCandidates(targets["clear-life-status-evidence"]),
  ...boundaryCandidates(targets["boundary-case-life-history"]),
  ...habitatCandidates(targets["habitat-needs-evidence"]),
  ...microhabitatCandidates(targets["microhabitat-observation-transfer"]),
  ...foodChainCandidates(targets["simple-food-chain-builds"]),
];
pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Review-stage Year 2 living-things-and-habitats pack with a deterministic 220-variant pilot bank. Four curated variants are unchanged. Generated tasks cover evidence-based living/once-living/never-alive classification, age-appropriate boundary cases, habitats and microhabitats, how conditions meet basic needs, local observation and seasonal variation, plant-animal dependence, simple producer-consumer food chains, misconception repair and transfer. Food-chain arrows consistently mean food is eaten by eater. Every generated task includes picture sorting, habitat/evidence mapping, chain building or safe observation routes, sensory-safe reduced-load SEND supports, alternative inputs, rich feedback and pressure-free exploration without timers, streaks, lives or loss. Selected narration references ElevenLabs assets held for human listening review; browser TTS is prohibited. Independent science, fieldwork safety, accessibility, narration and renderer review remains required before promotion.";

validateBank(pack, curated, curatedSnapshot, generated);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y2-living-habitats-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y2-living-habitats-bank blueprints=${summary(pack.question_variants, (v) => v.body.variant_blueprint_id)}`);
console.log(`y2-living-habitats-bank formats=${summary(pack.question_variants, (v) => v.format)}`);
console.log(`y2-living-habitats-bank concepts=${summary(generated, (v) => v.body.concept_focus)}`);
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y2-living-habitats-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 2 living-habitats bank is out of date; run generate-y2-living-habitats-bank.mjs --write.");
  console.log("y2-living-habitats-bank deterministic check passed");
} else console.log("y2-living-habitats-bank dry-run; pass --write to update the pack");

function clearStatusCandidates(count) {
  const modes = ["classify_with_evidence", "movement_not_enough", "life_history_choice", "evidence_not_appearance", "not_enough_evidence", "three_way_sort"];
  return Array.from({ length: count }, (_, i) => {
    const item = lifeItems[i % lifeItems.length], mode = modes[i % modes.length];
    if (mode === "movement_not_enough") {
      const answer = `${item.name} is classified using life-process or life-history evidence, not movement alone.`;
      return science({ id: `movement-${slug(item.name)}-${i + 1}`, format: "life-status-sort", blueprint: "clear-life-status-evidence", band: "developing", concept: mode,
        prompt: `Evidence-lens mission ${i + 1}: a helper uses only movement to classify ${item.name}. Which repair is scientific?`, body: { item: item.name, choices: [answer, "Anything still is dead.", "Anything moving is living."], relevant_evidence: item.evidence }, answer,
        hints: ["Moving toys are not alive, and many living things may appear still.", "Use growth, needs, response or life history."], explanation: `${item.name}: ${item.evidence} Its evidence category is “${item.status}”.`, correct: "Classification uses evidence beyond movement.", repair: "Compare a moving toy with a still plant, then open one growth/needs/life-history card for each.", tag: "movement_only_life", hook: "movement-evidence-repair" });
    }
    if (mode === "not_enough_evidence") {
      const answer = "Ask for more evidence such as growth over time, needs, response or life history before deciding.";
      return science({ id: `more-evidence-${slug(item.name)}-${i + 1}`, format: "life-status-sort", blueprint: "clear-life-status-evidence", band: "secure", concept: mode,
        prompt: `Mystery-picture mission ${i + 1}: a still close-up has no label or history. What is the best next step?`, body: { mystery_image: "ambiguous still close-up", choices: [answer, "Call it dead because it is still.", "Call it living because it looks natural."], not_enough_evidence_option: true }, answer,
        hints: ["Observation comes before inference.", "A still image may hide important evidence."], explanation: `It is scientifically careful to request more evidence rather than force a classification from appearance alone.`, correct: "Insufficient evidence recognised appropriately.", repair: "Separate the OBSERVE and DECIDE cards, add one labelled evidence card, then classify only if the evidence supports it.", tag: "appearance_only_classification", hook: "mystery-evidence-request" });
    }
    if (mode === "three_way_sort") {
      const selected = [lifeItems[i % 6], lifeItems[6 + (i % 4)], lifeItems[10 + (i % 4)]];
      const answer = Object.fromEntries(selected.map((x) => [x.name, x.status]));
      return science({ id: `sort-three-${i + 1}`, format: "life-status-sort", blueprint: "clear-life-status-evidence", band: "expected", concept: mode,
        prompt: `Three-tray mission ${i + 1}: sort each item using its evidence card.`, body: { items: selected.map((x) => ({ name: x.name, evidence: x.evidence })), trays: ["living now", "was once living/material", "never alive"], expected_groups: answer }, answer,
        hints: ["Ask: alive now, connected to past life, or never alive?", "Do not sort by colour, stillness or texture."], explanation: selected.map((x) => `${x.name}: ${x.status} because ${x.evidence}`).join(" "), correct: "Three life-status categories separated using evidence.", repair: "Sort one clear living item and one rock first, then place the once-living example using its history card.", tag: "still_or_brown_means_dead", hook: "three-life-status-trays" });
    }
    const answer = item.status;
    return science({ id: `${mode}-${slug(item.name)}-${i + 1}`, format: "life-status-sort", blueprint: "clear-life-status-evidence", band: mode === "classify_with_evidence" ? "intro" : "developing", concept: mode,
      prompt: `Life-status mission ${i + 1}: classify ${item.name} using the evidence, not appearance.`, body: { item: item.name, observation: item.evidence, choices: ["living now", "was once living", "was once living material", "never alive"], life_history_timeline_available: true }, answer,
      hints: ["Ask whether it is alive now or has a past connection to life.", item.evidence], explanation: `${item.name} is classified as ${item.status}. ${item.evidence}`, correct: `Evidence supports “${item.status}”.`, repair: "Keep the evidence card open, remove colour and movement clues, and compare only the current-life and life-history questions.", tag: "appearance_only_classification", hook: "life-status-evidence", audioScript: i % 4 === 0 ? `Classify ${item.name} using the evidence card.` : undefined });
  });
}

function boundaryCandidates(count) {
  const modes = ["dormancy_evidence", "material_history", "timeline_order", "boundary_compare", "misconception_repair", "evidence_explanation"];
  return Array.from({ length: count }, (_, i) => {
    const item = boundaryItems[i % boundaryItems.length], mode = modes[i % modes.length];
    if (mode === "timeline_order") return science({ id: `timeline-${slug(item.name)}-${i + 1}`, format: "life-status-sort", blueprint: "boundary-case-life-history", band: "developing", concept: mode,
      prompt: `Life-history trail ${i + 1}: order the evidence cards for ${item.name}.`, body: { item: item.name, cards: rotate(item.timeline, i % item.timeline.length), timeline_direction: "earlier_to_later" }, answer: item.timeline,
      hints: ["Start with the living source or earliest stage.", "End with the current item or growing stage."], explanation: `${item.timeline.join(" → ")}. ${item.evidence}`, correct: "Life-history evidence ordered from earlier to later.", repair: "Keep the clear first and current-item cards, then place one middle transformation or growth card.", tag: "current_appearance_erases_history", hook: "life-history-timeline" });
    if (mode === "boundary_compare") {
      const other = boundaryItems[(i + 2) % boundaryItems.length], answer = `${item.name}: ${item.status}; ${other.name}: ${other.status}. Their evidence histories decide, not colour or stillness.`;
      return science({ id: `boundary-compare-${slug(item.name)}-${i + 1}`, format: "life-status-sort", blueprint: "boundary-case-life-history", band: "secure", concept: mode,
        prompt: `Boundary-case compare ${i + 1}: compare ${item.name} and ${other.name}. Which explanation uses life history?`, body: { items: [item.name, other.name], timelines: [item.timeline, other.timeline], choices: [answer, "Both are dead because neither moves.", "Both have the same status because they look brown."] }, answer,
        hints: ["Trace each item separately through time.", "Dormant living things and manufactured natural materials differ."], explanation: answer, correct: "Boundary cases distinguished by life history.", repair: "Place the two timelines side by side and point to GROWS LATER or CAME FROM LIVING SOURCE evidence.", tag: "still_or_brown_means_dead", hook: "boundary-case-compare" });
    }
    if (mode === "misconception_repair") {
      const answer = "Stillness or brown colour is not enough; use germination, growth or source-material history.";
      return science({ id: `boundary-repair-${slug(item.name)}-${i + 1}`, format: "life-status-sort", blueprint: "boundary-case-life-history", band: "expected", concept: mode,
        prompt: `Evidence-repair mission ${i + 1}: which rule fixes “all still or brown things are dead”?`, body: { example: item.name, choices: [answer, "All brown things share one life status.", "Anything made by people was never linked to life."], evidence_sequence: item.timeline }, answer,
        hints: ["A seed can be dormant; wood came from a tree.", "Use what happened before and what can happen next."], explanation: `${item.name}: ${item.evidence}`, correct: "Appearance misconception repaired with life-history evidence.", repair: "Cover colour and movement details, then reveal only the before/after sequence and one evidence sentence.", tag: "still_or_brown_means_dead", hook: "boundary-evidence-repair" });
    }
    const answer = item.status;
    return science({ id: `${mode}-${slug(item.name)}-${i + 1}`, format: "life-status-sort", blueprint: "boundary-case-life-history", band: mode === "dormancy_evidence" ? "developing" : "expected", concept: mode,
      prompt: `Life-history evidence mission ${i + 1}: which description best fits ${item.name}?`, body: { item: item.name, timeline: item.timeline, choices: [item.status, "never connected to life", "living only because it is brown"], evidence_card: item.evidence }, answer,
      hints: ["Use the sequence before judging its current appearance.", item.evidence], explanation: `${item.name} is ${item.status}. ${item.evidence}`, correct: `Boundary case classified with timeline evidence: ${item.status}.`, repair: "Open the first and last timeline cards, name whether growth can continue or material came from a living source, then retry.", tag: "still_or_brown_means_dead", hook: "life-history-sequences" });
  });
}

function habitatCandidates(count) {
  const modes = ["habitat_match", "need_condition_link", "compare_habitats", "plant_animal_dependence", "seasonal_context", "misconception_repair"];
  return Array.from({ length: count }, (_, i) => {
    const item = habitats[i % habitats.length], mode = modes[i % modes.length], wrong = habitats[(i + 4) % habitats.length];
    if (mode === "compare_habitats") {
      const answer = `${item.place} provides more of the listed needs for the ${item.organism} than ${wrong.place}; the decision uses conditions, not picture colour.`;
      return science({ id: `habitat-compare-${slug(item.organism)}-${i + 1}`, format: "habitat-evidence-map", blueprint: "habitat-needs-evidence", band: "secure", concept: mode,
        prompt: `Habitat compare mission ${i + 1}: compare ${item.place} with ${wrong.place} for a ${item.organism}.`, body: { organism: item.organism, habitats: [item.place, wrong.place], need_condition_matrix: { [item.place]: item.conditions, [wrong.place]: wrong.conditions }, choices: [answer, "Choose whichever picture has matching colours.", "Choose the largest picture."], likely_not_guaranteed: true }, answer,
        hints: ["Match needs to measured or labelled conditions.", "Suitable means evidence supports likelihood, not every individual must be found there."], explanation: `${item.place}: ${item.reason}`, correct: "Habitat comparison uses need-condition evidence.", repair: "Hide decorative art and connect one need icon to one condition label in each habitat.", tag: "picture_matching_habitat", hook: "habitat-condition-compare" });
    }
    if (mode === "plant_animal_dependence") {
      const answer = `Plants can provide food or shelter for ${item.organism}; animals can also affect plants through feeding, pollination or seed movement, depending on the example.`;
      return science({ id: `dependence-${slug(item.organism)}-${i + 1}`, format: "habitat-evidence-map", blueprint: "habitat-needs-evidence", band: "secure", concept: mode,
        prompt: `Living-link mission ${i + 1}: which statement carefully describes plant-animal dependence in ${item.place}?`, body: { organism: item.organism, habitat: item.place, choices: [answer, "Plants and animals never depend on each other.", "Every animal uses every plant in exactly the same way."], dependency_examples: item.conditions.filter((x) => /food|plant|flower|leaf|seed|shelter|cover/.test(x)) }, answer,
        hints: ["Look for food, shelter, pollination or seed movement links.", "Use “can” and the evidence for this example."], explanation: answer, correct: "Plant-animal dependence described at an age-appropriate level.", repair: "Connect one plant resource card to one animal need, then add only an observed animal-to-plant link if evidence is provided.", tag: "plants_and_animals_independent", hook: "living-link-map" });
    }
    if (mode === "seasonal_context") {
      const answer = "Season can change food, shade, moisture or shelter, so observations may differ; the habitat still needs evidence at that time.";
      return science({ id: `season-${slug(item.organism)}-${i + 1}`, format: "habitat-evidence-map", blueprint: "habitat-needs-evidence", band: "secure", concept: mode,
        prompt: `Season-window mission ${i + 1}: why might observations of ${item.organism} in ${item.place} differ across the year?`, body: { organism: item.organism, habitat: item.place, seasonal_variables: ["food availability", "moisture", "light", "shelter", "temperature"], choices: [answer, "The organism changes into a never-alive object each winter.", "Picture colour alone controls where it lives."], observation_not_guarantee: true }, answer,
        hints: ["Conditions and available resources can change with season.", "Not seeing an organism once does not prove it never uses the habitat."], explanation: answer, correct: "Seasonal variation linked to observable habitat conditions.", repair: "Compare two dated habitat cards and highlight one changed condition before making a cautious likelihood statement.", tag: "one_observation_always_true", hook: "season-window" });
    }
    if (mode === "misconception_repair") {
      const answer = "Choose using food, water, shelter, light or physical conditions—not matching colours or picture size.";
      return science({ id: `habitat-repair-${slug(item.organism)}-${i + 1}`, format: "habitat-evidence-map", blueprint: "habitat-needs-evidence", band: "expected", concept: mode,
        prompt: `Habitat-map repair ${i + 1}: which rule fixes colour-only habitat matching?`, body: { organism: item.organism, choices: [answer, "Matching colours prove a habitat is suitable.", "The biggest scene is always best."], need_cards: item.conditions }, answer,
        hints: ["Ask what the organism needs.", "Then find matching conditions or resources."], explanation: `${item.place} is supported by evidence: ${item.reason}`, correct: "Habitat misconception repaired with needs evidence.", repair: "Use a plain text condition table, match one need at a time and remove all decorative image cues.", tag: "picture_matching_habitat", hook: "habitat-map-repair" });
    }
    const answer = mode === "need_condition_link" ? item.reason : item.place;
    return science({ id: `${mode}-${slug(item.organism)}-${i + 1}`, format: "habitat-evidence-map", blueprint: "habitat-needs-evidence", band: mode === "habitat_match" ? "developing" : "expected", concept: mode,
      prompt: mode === "habitat_match" ? `Habitat explorer ${i + 1}: which place is suitable for a ${item.organism}, using the evidence cards?` : `Needs-link mission ${i + 1}: why can ${item.place} suit a ${item.organism}?`,
      body: { organism: item.organism, habitat_choices: [item.place, wrong.place, "decorative indoor shelf"], need_cards: item.conditions, choices: mode === "need_condition_link" ? [item.reason, "The colours match.", "It is the largest picture."] : undefined, because_frame: `${item.place} can suit ${item.organism} because ...` }, answer,
      hints: ["Match the organism's needs to habitat conditions.", "Ignore decorative colour and picture size."], explanation: `${item.place} can suit a ${item.organism}. ${item.reason}`, correct: "Habitat selected or explained using relevant conditions.", repair: "Keep the organism need cards visible and compare only two plain habitat condition lists.", tag: "picture_matching_habitat", hook: "need-condition-link", audioScript: i % 4 === 0 ? `Which habitat evidence suits a ${item.organism}?` : undefined });
  });
}

function microhabitatCandidates(count) {
  const modes = ["local_observation", "microhabitat_match", "compare_conditions", "safe_enquiry_plan", "seasonal_observation", "distribution_evidence", "transfer"];
  return Array.from({ length: count }, (_, i) => {
    const item = microhabitats[i % microhabitats.length], mode = modes[i % modes.length], day = reviewDays[i % reviewDays.length];
    if (mode === "safe_enquiry_plan") {
      const answer = "Observe with an adult, avoid tasting or handling, use a viewing tray if directed, replace logs/stones gently and wash hands afterwards.";
      return science({ id: `safe-enquiry-${i + 1}`, format: "habitat-evidence-map", blueprint: "microhabitat-observation-transfer", band: "secure", concept: mode,
        prompt: `Fieldwork-plan mission ${i + 1}: choose the safest respectful plan for observing ${item.place}.`, body: { microhabitat: item.place, choices: [answer, "Pull animals from their habitat and keep them.", "Taste plants to identify them."], adult_supervision_required: true, no_tasting_or_unapproved_touching: true, restore_habitat: true }, answer,
        hints: ["Observe without harming living things or habitats.", "Follow adult instructions and wash hands after fieldwork."], explanation: answer, correct: "Safe, respectful local observation plan selected.", repair: "Remove handling/tasting actions and order the cards: adult check, observe, record, replace, wash hands.", tag: "fieldwork_without_safety", hook: "safe-fieldwork-plan" });
    }
    if (mode === "compare_conditions") {
      const answer = `${item.place} is ${item.conditions}, unlike ${item.contrast}; this evidence makes ${item.likely[0]} more likely there, not guaranteed.`;
      return science({ id: `micro-compare-${slug(item.place)}-${i + 1}`, format: "habitat-evidence-map", blueprint: "microhabitat-observation-transfer", band: "secure", concept: mode,
        prompt: `Microhabitat compare ${i + 1}: which explanation uses the condition observations?`, body: { places: [item.place, item.contrast], observations: [item.conditions, "contrasting conditions"], likely_organisms: item.likely, choices: [answer, "The animal must be there because colours match.", "One visit proves it is always there."], likelihood_language_required: true }, answer,
        hints: ["Compare dampness, light, shelter and food evidence.", "Say more likely, not certain."], explanation: answer, correct: "Microhabitat distribution explained cautiously from conditions.", repair: "Place condition cards under each location, then choose “more likely” before naming one organism.", tag: "one_observation_always_true", hook: "microhabitat-compare" });
    }
    if (mode === "seasonal_observation") {
      const answer = "Record the date and conditions; moisture, light, temperature and organisms observed can change across seasons.";
      return science({ id: `micro-season-${slug(item.place)}-${i + 1}`, format: "habitat-evidence-map", blueprint: "microhabitat-observation-transfer", band: "secure", concept: mode,
        prompt: `Season log mission ${i + 1}: how should explorers compare ${item.place} observations made months apart?`, body: { place: item.place, record_fields: ["date", "weather", "damp/dry", "light/shade", "organisms seen"], choices: [answer, "Assume the first visit is always true.", "Ignore conditions and compare picture colours."], review_interval_days: day }, answer,
        hints: ["Record context alongside what was seen.", "Absence on one visit does not prove an organism never occurs there."], explanation: answer, correct: "Seasonal microhabitat observations include context and cautious conclusions.", repair: "Add DATE and CONDITIONS to each observation card, then compare one variable at a time.", tag: "seasonal_context_ignored", hook: "season-log" });
    }
    if (mode === "distribution_evidence") {
      const answer = `Repeated observations find more ${item.likely[0]} in ${item.place} than ${item.contrast}, alongside ${item.conditions}.`;
      return science({ id: `distribution-${slug(item.place)}-${i + 1}`, format: "habitat-evidence-map", blueprint: "microhabitat-observation-transfer", band: "secure", concept: mode,
        prompt: `Evidence-table mission ${i + 1}: which result supports that ${item.likely[0]} is more likely in ${item.place}?`, body: { organism: item.likely[0], places: [item.place, item.contrast], choices: [answer, "One picture has nicer colours.", "The observer wanted that result."], repeated_observations: true, simple_tally_available: true }, answer,
        hints: ["Use repeated counts and recorded conditions.", "Preferences are not habitat evidence."], explanation: answer, correct: "Repeated observation and condition evidence linked to distribution.", repair: "Compare two simple tally rows and one condition column; state only which location had more observations.", tag: "preference_used_as_evidence", hook: "distribution-evidence-table" });
    }
    const answer = mode === "microhabitat_match" ? item.place : `${item.likely.join(" and ")} may be found because the place is ${item.conditions}.`;
    return science({ id: `${mode}-${slug(item.place)}-${i + 1}`, format: "habitat-evidence-map", blueprint: "microhabitat-observation-transfer", band: mode === "local_observation" ? "developing" : "expected", concept: mode,
      prompt: mode === "microhabitat_match" ? `Small-place mission ${i + 1}: choose the microhabitat matching “${item.conditions}”.` : `Observation transfer ${i + 1}: what might explorers predict for ${item.place}, and why?`,
      body: { microhabitat: item.place, condition_observation: item.conditions, likely_organisms: item.likely, contrast_place: item.contrast, choices: mode === "microhabitat_match" ? [item.place, item.contrast, "inside a sealed box"] : [answer, "An organism is guaranteed because the picture matches.", "Conditions do not matter."], safe_observation: "adult_led_look_only_restore_any_cover_wash_hands", review_interval_days: mode === "transfer" ? day : undefined }, answer,
      hints: ["Use moisture, light, shelter and food evidence.", "Predictions say may or likely, not guaranteed."], explanation: `${item.place} is ${item.conditions}; ${item.likely.join(" and ")} may be more likely there.`, correct: "Microhabitat prediction uses observable conditions and cautious language.", repair: "Match one condition card to one organism need, then choose MAY BE FOUND rather than MUST BE FOUND.", tag: "picture_matching_habitat", hook: "microhabitat-observation" });
  });
}

function foodChainCandidates(count) {
  const modes = ["chain_order", "arrow_meaning", "producer_identification", "consumer_roles", "habitat_chain", "dependence_change", "misconception_repair", "spaced_transfer"];
  return Array.from({ length: count }, (_, i) => {
    const item = chains[i % chains.length], [producer, firstConsumer, secondConsumer] = item.organisms, mode = modes[i % modes.length], day = reviewDays[i % reviewDays.length];
    if (mode === "arrow_meaning") {
      const answer = "is eaten by; the arrow points from food to eater";
      return chainTask({ id: `arrow-${slug(producer)}-${i + 1}`, concept: mode, prompt: `Arrow-label mission ${i + 1}: what does the arrow mean in ${producer} → ${firstConsumer}?`, item,
        body: { arrow: [producer, firstConsumer], choices: [answer, "is bigger than", "walks towards"], arrow_semantics: "food_to_eater_is_eaten_by" }, answer,
        explanation: `${producer} is eaten by ${firstConsumer}; the arrow shows the feeding link from food to eater.`, tag: "arrow_direction_confusion", hook: "food-arrow-label" });
    }
    if (mode === "producer_identification") {
      const answer = producer;
      return chainTask({ id: `producer-${slug(producer)}-${i + 1}`, concept: mode, prompt: `Producer mission ${i + 1}: which card starts the ${item.habitat} food chain by making its own food using light?`, item,
        body: { choices: rotate(item.organisms, i % 3), producer_definition: "green plant or alga makes its own food using light", age_appropriate_language: true }, answer,
        explanation: `${producer} is the producer. ${firstConsumer} and ${secondConsumer} are consumers because they eat plants or other animals.`, tag: "largest_animal_starts_chain", hook: "producer-start-card" });
    }
    if (mode === "consumer_roles") {
      const answer = `${firstConsumer} and ${secondConsumer} are consumers because they get food by eating plants or animals.`;
      return chainTask({ id: `consumers-${slug(firstConsumer)}-${i + 1}`, concept: mode, prompt: `Consumer-card mission ${i + 1}: which statement correctly labels the consumers?`, item,
        body: { choices: [answer, `${producer} is a consumer because it is first.`, "Only the biggest animal is a consumer."], role_labels: { [producer]: "producer", [firstConsumer]: "consumer", [secondConsumer]: "consumer" } }, answer,
        explanation: answer, tag: "consumer_means_largest", hook: "consumer-role-cards" });
    }
    if (mode === "dependence_change") {
      const answer = `If less ${producer} is available, the ${firstConsumer} may have less food, which can also affect the ${secondConsumer}.`;
      return chainTask({ id: `dependence-${slug(producer)}-${i + 1}`, concept: mode, prompt: `Dependence mission ${i + 1}: what might happen if much less ${producer} were available in this habitat?`, item,
        body: { changed_resource: producer, choices: [answer, "Nothing in the chain can be affected.", `${secondConsumer} becomes a producer.`], cautious_language: "may_not_certain" }, answer,
        explanation: `The chain shows feeding dependence: ${producer} → ${firstConsumer} → ${secondConsumer}. Changes at one link may affect later links.`, tag: "food_chain_links_independent", hook: "dependence-chain-change" });
    }
    if (mode === "misconception_repair") {
      const answer = "Start with the producer and point every arrow from food to the organism that eats it.";
      return chainTask({ id: `chain-repair-${slug(producer)}-${i + 1}`, concept: mode, prompt: `Food-chain repair ${i + 1}: which rule fixes arrows drawn by size or travel direction?`, item,
        body: { choices: [answer, "Point toward the biggest animal.", "Point in whichever direction the animal walks."], read_aloud_chain: `${producer} is eaten by ${firstConsumer}, which is eaten by ${secondConsumer}` }, answer,
        explanation: `${producer} → ${firstConsumer} → ${secondConsumer}; each arrow means “is eaten by”.`, tag: "arrow_direction_confusion", hook: "chain-arrow-repair" });
    }
    if (mode === "habitat_chain") {
      const answer = item.organisms;
      return chainTask({ id: `habitat-${slug(item.habitat)}-${i + 1}`, concept: mode, prompt: `Habitat-chain mission ${i + 1}: build a simple chain using organisms linked to the ${item.habitat}.`, item,
        body: { habitat: item.habitat, cards: rotate(item.organisms, i % 3), habitat_evidence: `${producer}, ${firstConsumer} and ${secondConsumer} can be linked in this simplified ${item.habitat} example` }, answer,
        explanation: `${item.organisms.join(" → ")} is a simple ${item.habitat} chain; arrows mean “is eaten by”.`, tag: "organisms_chosen_without_habitat_link", hook: "habitat-to-chain" });
    }
    const answer = item.organisms;
    return chainTask({ id: `${mode}-${slug(producer)}-${i + 1}`, concept: mode, prompt: mode === "spaced_transfer" ? `Memory-chain mission ${i + 1}: after ${day} days, rebuild the chain and label its arrows.` : `Food-chain builder ${i + 1}: order the cards from producer to consumers.`, item,
      body: { cards: rotate(item.organisms, i % 3), expected_arrow_label: "is eaten by", review_interval_days: mode === "spaced_transfer" ? day : undefined }, answer,
      explanation: `${producer} → ${firstConsumer} → ${secondConsumer}. ${producer} is the producer; the others are consumers; arrows point food to eater.`, tag: "arrow_direction_confusion", hook: "simple-chain-build", audioScript: i % 4 === 0 ? `Build the food chain. ${producer} is eaten by ${firstConsumer}, which is eaten by ${secondConsumer}.` : undefined });
  });
}

function chainTask({ id, concept, prompt, item, body, answer, explanation, tag, hook, audioScript }) {
  return science({ id, format: "food-chain-build", blueprint: "simple-food-chain-builds", band: concept === "chain_order" ? "developing" : "retrieval", concept, prompt,
    body: { habitat: item.habitat, organisms: item.organisms, producer: item.organisms[0], consumers: item.organisms.slice(1), arrow_semantics: "food_to_eater_is_eaten_by", ...body }, answer,
    hints: ["Start with the green plant or alga producer.", "Read each arrow as “is eaten by”."], explanation, correct: `Food-chain evidence is consistent. ${explanation}`, repair: "Keep the producer first, place one eater at a time and speak or reveal “is eaten by” over every arrow.", tag, hook, audioScript });
}

function science({ id, format, blueprint, band, concept, prompt, body, answer, hints, explanation, correct, repair, tag, hook, audioScript }) {
  const audio = audioScript ? { audio_required: true, narration_script: audioScript, audio_asset_id: `narration-${prefix}${id}`, audio_provider: "ElevenLabs", audio_asset_status: "required_human_listening_review", human_listening_approval_required: true, browser_tts_allowed: false, browser_tts_fallback: "prohibited", audio_replay_unlimited: true, unavailable_audio_state: "honest_not_ready_use_picture_text_and_adult_read_route" } : { audio_required: false, audio_route: "not_needed_for_this_picture_sort_map_chain_or_observation_task" };
  const sequence = Array.isArray(answer) && (format === "food-chain-build" || concept.includes("timeline") || concept.includes("sort"));
  return {
    id: `${prefix}${id}`, format,
    body: {
      prompt, ...body, ...audio, concept_focus: concept,
      interaction_mode: "tap_drag_keyboard_switch_eye_gaze_aac_point_or_adult_scribed",
      supported_interaction: "An adult or peer may read, scan, move the child's named card or record an indicated explanation without supplying the science decision.",
      picture_sort_route: "Large clear item cards with concise alt descriptions and evidence revealed separately from decorative appearance.",
      habitat_map_route: "Plain need-condition table or labelled habitat picture with one evidence link at a time.",
      chain_builder_route: "Three large slots with persistent producer and “is eaten by” arrow labels.",
      observation_route: "Use safe look-only local observation, dated picture records or provided evidence; no organism handling is required.",
      send_support: { one_relationship_per_panel: true, reduced_choice_mode: true, symbol_and_text_labels: true, colour_not_required: true, predictable_card_positions: true, not_enough_evidence_option: true },
      sensory_safe_route: "No sudden sounds, flashing, graphic death/predation, compulsory textures or startling animal movement; quiet static mode is complete.",
      visual_route: "Low-clutter cards, plain backgrounds, generous spacing and evidence icons paired with text.",
      processing_route: "Follow observe–evidence–decide–explain, revealing only one comparison or relationship at a time and preserving correct work.",
      motor_alternative: "Tap, keyboard, switch scan, eye gaze, AAC, pointing or adult-scribed choices can replace dragging, speech and handwriting.",
      low_visual_load: true, reduced_motion: "static_before_after_or_instant_card_placement", preserve_correct_work: true, undo_available: true,
      no_timer: true, speed_score_allowed: false, microphone_required: false, handwriting_required: false, retry_without_penalty: true,
      gamification: { mission: "help a calm habitat explorer organise one evidence link", reward: "one explorer leaf for a careful sort, map, observation or chain", lives: false, streaks: false, loss_on_error: false, leaderboard: false, speed_bonus: false, retry_message: "Your correct evidence stays. Choose another clue or route and continue." },
      age_appropriate_scope: "observable_life_history_habitat_needs_local_observation_and_simple_food_to_eater_chains",
      difficulty_band: band, evidence_purpose: concept, variant_blueprint_id: blueprint, review_batch: reviewBatch,
    },
    expected_answer: sequence ? { sequence: answer } : { value: answer }, hints, explanation,
    feedback: { correct, repair, science_evidence: explanation, support_message: "Picture sorting, mapping, pointing, eye gaze, AAC and adult-scribed explanations carry equal evidence; speed, speech and handwriting are not scored." },
    difficulty: band === "intro" ? 2 : band === "developing" ? 3 : band === "expected" ? 4 : band === "secure" ? 5 : 4,
    status: "review", misconception_tag: tag, animation_hook: hook,
  };
}

function validateBank(currentPack, curated, snapshot, generated) {
  if (curated.length !== 4) throw new Error(`Expected 4 curated variants, found ${curated.length}.`);
  if (JSON.stringify(curated) !== snapshot) throw new Error("Curated variants changed during generation.");
  if (currentPack.question_variants.length !== 220 || generated.length !== 216) throw new Error("Pilot must contain 4 curated and 216 generated variants.");
  const ids = currentPack.question_variants.map((v) => v.id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate variant IDs found.");
  const counts = countBy(currentPack.question_variants, (v) => v.body.variant_blueprint_id);
  for (const [id, total] of Object.entries(allocation)) if (counts[id] !== total) throw new Error(`${id} expected ${total}, found ${counts[id] ?? 0}.`);
  const concepts = new Set(generated.map((v) => v.body.concept_focus));
  for (const c of ["classify_with_evidence", "movement_not_enough", "not_enough_evidence", "dormancy_evidence", "material_history", "boundary_compare", "habitat_match", "need_condition_link", "plant_animal_dependence", "seasonal_context", "local_observation", "safe_enquiry_plan", "seasonal_observation", "distribution_evidence", "chain_order", "arrow_meaning", "producer_identification", "consumer_roles", "dependence_change", "spaced_transfer"]) if (!concepts.has(c)) throw new Error(`Missing concept ${c}.`);
  for (const v of generated) {
    const b = v.body;
    if (!b.send_support?.reduced_choice_mode || !b.picture_sort_route || !b.habitat_map_route || !b.chain_builder_route || !b.observation_route || !b.sensory_safe_route || !b.motor_alternative || !b.low_visual_load) throw new Error(`Missing SEND/sensory route in ${v.id}.`);
    if (!v.feedback?.correct || !v.feedback?.repair || !v.feedback?.science_evidence) throw new Error(`Missing rich feedback in ${v.id}.`);
    if (!b.no_timer || b.speed_score_allowed || b.gamification?.lives || b.gamification?.streaks || b.gamification?.loss_on_error) throw new Error(`Pressure mechanic in ${v.id}.`);
    if (v.format === "food-chain-build" && b.arrow_semantics !== "food_to_eater_is_eaten_by") throw new Error(`Food-chain arrow policy failure in ${v.id}.`);
    if (b.audio_required) {
      if (b.audio_provider !== "ElevenLabs" || b.audio_asset_status !== "required_human_listening_review" || !b.human_listening_approval_required || b.browser_tts_allowed !== false || b.browser_tts_fallback !== "prohibited") throw new Error(`Audio policy failure in ${v.id}.`);
    } else if (b.audio_asset_id || b.audio_provider) throw new Error(`Unnecessary audio reference in ${v.id}.`);
  }
}

function life(name, status, evidence) { return { name, status, evidence }; }
function boundary(name, status, timeline, evidence) { return { name, status, timeline, evidence }; }
function habitat(organism, place, conditions, reason) { return { organism, place, conditions, reason }; }
function micro(place, conditions, likely, contrast) { return { place, conditions, likely, contrast }; }
function chain(habitatName, organisms) { return { habitat: habitatName, organisms }; }
function rotate(items, n) { const a = [...items], k = a.length ? n % a.length : 0; return a.slice(k).concat(a.slice(0, k)); }
function slug(text) { return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function countBy(items, fn) { const out = {}; for (const item of items) { const key = fn(item); out[key] = (out[key] ?? 0) + 1; } return out; }
function summary(items, fn) { return Object.entries(countBy(items, fn)).sort(([a], [b]) => String(a).localeCompare(String(b))).map(([k, v]) => `${k}:${v}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
