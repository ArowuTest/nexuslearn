#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/sc-y1-seasonal-changes.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y1-seasonal-changes-bank-";
const reviewBatch = "y1-seasonal-changes-pilot-a";
const pilotAllocation = {
  "current-weather-observation-cards": 44,
  "same-place-season-comparisons": 44,
  "tree-and-plant-change-evidence": 44,
  "daylight-pattern-comparisons": 44,
  "seasonal-evidence-spaced-review": 44,
};

const weatherScenes = [
  weather("sun-cloud", ["bright sunlight", "a few clouds"], "It is sunny with some cloud.", ["It is sunny with some cloud.", "It must be summer.", "No weather can happen together."], "sunny_cloudy"),
  weather("rain-wind", ["rain streaks", "a windsock stretched sideways"], "It is rainy and windy.", ["It is rainy and windy.", "Rain proves it is winter.", "The scene is dry and still."], "rainy_windy"),
  weather("overcast", ["the sky is covered by grey cloud", "no rain is visible"], "It is cloudy; this picture does not show rain.", ["It is cloudy; this picture does not show rain.", "Grey cloud proves it is autumn.", "It is snowing."], "cloudy"),
  weather("frost", ["white frost on grass", "thermometer reads 0 degrees Celsius"], "The observation shows frost and a temperature of 0 degrees Celsius.", ["The observation shows frost and a temperature of 0 degrees Celsius.", "The grass is covered in sand.", "Frost proves every day this season is cold."], "frosty"),
  weather("snow-cloud", ["snowflakes falling", "cloud covering the sky"], "It is snowy and cloudy.", ["It is snowy and cloudy.", "Snow can only be described as sunny.", "One snowy day tells the whole season."], "snowy_cloudy"),
  weather("mist", ["far trees look faint", "near objects remain clear"], "It is misty, so distant objects are harder to see.", ["It is misty, so distant objects are harder to see.", "The trees have disappeared forever.", "Mist proves it is spring."], "misty"),
  weather("showers-sun", ["wet ground", "a small dark cloud", "sunlight between clouds"], "The scene shows a sunny interval after a shower.", ["The scene shows a sunny interval after a shower.", "Rain and sunshine cannot happen on one day.", "Wet ground proves it is winter."], "changeable"),
  weather("still-clear", ["clear sky", "windsock hanging down"], "The sky is clear and the air appears still in this record.", ["The sky is clear and the air appears still in this record.", "A clear sky proves it is summer.", "A hanging windsock shows strong wind."], "clear_still"),
  weather("wind-cloud", ["cloudy sky", "leaves moving", "windsock lifted"], "It is cloudy and windy.", ["It is cloudy and windy.", "Moving leaves prove it is autumn.", "The air is still."], "cloudy_windy"),
  weather("rain-only", ["drops in a rain gauge", "wet paving"], "Rain is falling in this observation.", ["Rain is falling in this observation.", "Rain names the season.", "The paving is dry."], "rainy"),
  weather("thermometer-mild", ["thermometer reads 14 degrees Celsius", "clouds and dry ground"], "The recorded temperature is 14 degrees Celsius and the ground is dry.", ["The recorded temperature is 14 degrees Celsius and the ground is dry.", "It feels hot to everyone.", "The number proves which season it is."], "temperature_record"),
];

const placeComparisons = [
  place("park-tree", "park oak viewpoint", "January", "mostly bare branches and damp ground", "July", "many green leaves and dry ground", "leaf amount, leaf colour and ground condition changed", "plant_ground"),
  place("pond", "school pond viewpoint", "March", "frogspawn recorded at the edge and few open leaves nearby", "June", "no frogspawn visible and many open leaves", "the recorded animal evidence and nearby leaves changed", "animal_plant"),
  place("meadow", "meadow square", "April", "short grass with several daisies", "August", "taller dry-looking grass with fewer open daisies", "grass height, grass colour and visible flower number changed", "plant"),
  place("playground", "same playground corner", "December", "long noon shadow and bare deciduous branches", "June", "shorter noon shadow and leafy branches", "the noon shadow length and branch leaf cover changed", "daylight_plant"),
  place("bird-table", "garden bird table", "February survey", "six birds counted in ten minutes", "May survey", "three birds counted in ten minutes", "the count differed in these two timed surveys", "animal_count"),
  place("hedge", "same hedge section", "March", "buds and few open leaves", "May", "many open leaves and some flowers", "bud, leaf and flower observations changed", "plant"),
  place("path", "woodland path viewpoint", "October", "many fallen leaves on the path", "January", "fewer whole leaves and more bare ground visible", "the ground-cover evidence changed", "ground"),
  place("insect-square", "same flower-bed square", "July warm-day survey", "eight insects counted in five minutes", "January cold-day survey", "no insects seen in five minutes", "the observed insect count and temperature record differed", "animal_weather"),
  place("evergreen-bed", "same pine bed", "January", "green needles on branches", "July", "green needles and some new lighter shoots", "needles stayed green while some shoot growth changed", "evergreen_plant"),
  place("allotment", "same allotment bed", "April", "bare soil with small shoots", "September", "tall stems, leaves and fruits", "plant height and visible parts changed", "plant"),
  place("rain-log", "same school weather station", "Monday", "rain gauge 8 millimetres and cloudy sky", "Thursday", "rain gauge 0 millimetres and clear sky", "rainfall and sky observations differed between the two days", "weather_days"),
];

const plantSequences = [
  plantSeq("oak", "deciduous tree", ["spring: buds and new leaves", "summer: many green leaves", "autumn: many leaves change colour and fall", "winter: many branches are bare"], "spring → summer → autumn → winter", "A deciduous oak usually changes leaf cover across the year; bare winter branches do not mean it is dead."),
  plantSeq("silver birch", "deciduous tree", ["spring: small new leaves", "summer: green leafy branches", "autumn: many yellow leaves fall", "winter: many fine branches are bare"], "spring → summer → autumn → winter", "This silver birch record shows seasonal leaf change."),
  plantSeq("pine", "evergreen tree", ["spring: green needles and pale new shoots", "summer: green needles", "autumn: green needles remain", "winter: green needles remain"], "spring → summer → autumn → winter", "Pine keeps green needles through the year, though individual old needles can fall."),
  plantSeq("holly", "evergreen tree", ["spring: green leaves", "summer: green leaves", "autumn: many green leaves remain", "winter: many green leaves remain"], "spring → summer → autumn → winter", "This holly example remains green across the seasonal panels."),
  plantSeq("daffodil", "garden plant", ["winter: no shoot visible above soil", "early spring: shoot and leaves", "spring: open flower", "later spring: fading flower and green leaves"], "winter → early spring → spring → later spring", "No visible winter shoot does not prove the bulb is dead."),
  plantSeq("sunflower", "garden plant", ["spring: small seedling", "early summer: taller leafy stem", "late summer: open flower head", "autumn: dry seed head"], "spring → early summer → late summer → autumn", "This reviewed sunflower grows and changes over several observations."),
  plantSeq("bluebell", "wild plant", ["winter: no leaves visible above ground", "spring: leaves and blue flowers", "early summer: fading flowers", "later summer: above-ground parts no longer visible"], "winter → spring → early summer → later summer", "A plant can have no visible above-ground parts at one observation and still be living."),
  plantSeq("horse chestnut", "deciduous tree", ["winter: sticky buds on bare twigs", "spring: buds open into leaves", "summer: large green leaves", "autumn: many leaves brown and fall"], "winter → spring → summer → autumn", "The same tree shows buds, leaves and leaf fall over time."),
  plantSeq("grass patch", "mixed grass plants", ["March: short green shoots", "May: taller green blades", "July: some seed heads", "September: mixed green and brown blades"], "March → May → July → September", "This one patch changes over the recorded months; another patch may differ."),
  plantSeq("apple tree", "deciduous fruit tree", ["winter: bare twigs and buds", "spring: flowers", "summer: leaves and small fruits", "autumn: ripe fruits and some falling leaves"], "winter → spring → summer → autumn", "Flowers, fruits and leaves appear at different stages in this reviewed record."),
  plantSeq("fir", "evergreen tree", ["winter: green needles", "spring: green needles and new tips", "summer: green needles", "autumn: green needles remain"], "winter → spring → summer → autumn", "This fir remains green in all four observations."),
];

const daylightCases = [
  daylight("winter-summer", "winter", 8, "summer", 16, "summer has more daylight than winter in this model"),
  daylight("spring-winter", "spring", 13, "winter", 8, "spring has more daylight than winter in this model"),
  daylight("autumn-summer", "autumn", 11, "summer", 16, "autumn has less daylight than summer in this model"),
  daylight("same-spring", "spring day A", 13, "spring day B", 13, "the two strips show the same amount of daylight"),
  daylight("december-june", "December record", 8, "June record", 16, "June has a longer daylight strip than December"),
  daylight("march-june", "March record", 12, "June record", 16, "June has more daylight than March"),
  daylight("september-december", "September record", 12, "December record", 8, "September has more daylight than December"),
  daylight("weather-check", "rainy summer day", 15, "sunny winter day", 8, "the rainy summer strip still shows more daylight than the sunny winter strip"),
  daylight("cloud-check", "cloudy spring day", 13, "clear autumn day", 11, "the spring model shows more daylight even though it is cloudy"),
  daylight("shorter-choice", "winter", 8, "autumn", 11, "winter has the shorter daylight strip"),
  daylight("longer-choice", "spring", 13, "summer", 16, "summer has the longer daylight strip"),
];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y1-seasonal-changes") throw new Error("This generator only supports the Year 1 seasonal-changes pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedCounts = countBy(curated, (variant) => variant.body?.variant_blueprint_id);
const targets = Object.fromEntries(Object.entries(pilotAllocation).map(([id, target]) => [id, target - (curatedCounts[id] ?? 0)]));
for (const [id, target] of Object.entries(targets)) if (target < 0) throw new Error(`Curated variants exceed the allocation for ${id}.`);

const generated = [
  ...weatherCandidates(targets["current-weather-observation-cards"]),
  ...placeCandidates(targets["same-place-season-comparisons"]),
  ...plantCandidates(targets["tree-and-plant-change-evidence"]),
  ...daylightCandidates(targets["daylight-pattern-comparisons"]),
  ...retrievalCandidates(targets["seasonal-evidence-spaced-review"]),
];

pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa.notes = "Review-stage Year 1 seasonal-changes pack with a deterministic 220-item pilot bank. Four curated variants are preserved alongside candidates covering all four seasons, current weather, relative daylight, plant and tree changes, selected animal observations, same-place comparisons, evidence selection, misconception repair and simple longitudinal records. Generated claims distinguish a single day's weather from season, keep animal and plant findings tied to the observed sample, and use cautious language for natural variation. Every item offers visual, tactile-symbol, text and supported response routes without requiring outdoor or sensory exposure. Optional audio references are ElevenLabs-only, unavailable pending human listening review, and never fall back to browser TTS. Playful field missions remain untimed and reward noticing and comparing rather than speed. Independent science, geography/date context, image, SEND, safeguarding, narration and renderer review remains required before promotion.";

validateBank(pack, curated, generated);
enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y1-seasonal-changes-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y1-seasonal-changes-bank blueprints=${summary(pack.question_variants, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`y1-seasonal-changes-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y1-seasonal-changes-bank concepts=${summary(generated, (variant) => variant.body.concept_focus)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y1-seasonal-changes-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 1 seasonal-changes bank is out of date; run generate-y1-seasonal-changes-bank.mjs --write.");
  console.log("y1-seasonal-changes-bank deterministic check passed");
} else {
  console.log("y1-seasonal-changes-bank dry-run; pass --write to update the pack");
}

function weatherCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = weatherScenes[index % weatherScenes.length];
    const round = Math.floor(index / weatherScenes.length);
    return candidate({
      id: `weather-${item.id}-${index + 1}`, format: "weather-sort", blueprint: "current-weather-observation-cards", band: "intro", concept: "current_weather_observation",
      prompt: `Weather-window mission ${index + 1}: which sentence matches only the evidence in this current scene?`, body: { scene_id: item.id, observable_clues: item.clues, choices: rotate(item.choices, index % item.choices.length), weather_tags: item.tag.split("_"), more_than_one_weather_type_can_coexist: true, season_inference_requested: false, interaction_mode: "choose_sentence_point_to_clues_keyboard_switch_or_aac" }, answer: item.answer,
      hints: ["Describe what is visible or measured now.", "Do not name a season from one weather scene."], explanation: `${item.answer} The clues are ${item.clues.join(" and ")}. Weather can change within every season.`, difficulty: 2 + (round % 2), tag: "weather_equals_season", hook: "field-weather-window",
      correct: "Current weather described without turning it into a season rule.", repair: "Use the frame I can see __ now. Cross out choices that claim one day proves a season.",
      tactile: "Use optional weather-symbol cards and an adult-read clue list; no outdoor exposure or weather sound is required.",
    });
  });
}

function placeCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = placeComparisons[index % placeComparisons.length];
    const round = Math.floor(index / placeComparisons.length);
    const answer = item.answer;
    const choices = rotate([answer, "the place became a completely different place", "one weather clue proves the season and nothing else matters"], index % 3);
    return candidate({
      id: `place-${item.id}-${index + 1}`, format: "season-observe", blueprint: "same-place-season-comparisons", band: "developing", concept: item.focus.includes("animal") ? "same_place_animal_and_environment_comparison" : "same_place_longitudinal_comparison",
      prompt: `Same-place log ${index + 1}: what changed between these two dated observations?`, body: { place: item.place, first_observation: { date: item.dateA, evidence: item.evidenceA }, later_observation: { date: item.dateB, evidence: item.evidenceB }, choices, same_camera_view: true, comparison_focus: item.focus, claim_scope: "these_two_records", interaction_mode: "compare_panels_choose_keyboard_switch_eye_gaze_or_say" }, answer,
      hints: ["Check that both cards show the same place.", "Compare named plant, animal, ground, sky or measurement evidence."], explanation: `${sentenceStart(answer)} between ${item.dateA} and ${item.dateB}. This conclusion describes these records and does not make a rule for every year.`, difficulty: 3 + (round % 2), tag: item.focus === "weather_days" ? "daily_weather_vs_seasonal_change" : "single_day_decides_season", hook: "field-same-place-log",
      correct: "Repeated observations compared using visible or counted evidence.", repair: "Align the same viewpoint, reveal one evidence row at a time and complete Earlier __; later __.",
      tactile: "Use two dated tactile-symbol panels with the same place marker; adult description and text-only comparison are available.",
    });
  });
}

function plantCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = plantSequences[index % plantSequences.length];
    const round = Math.floor(index / plantSequences.length);
    const mode = round % 3;
    if (mode === 1) return plantEvidenceCandidate(item, index);
    if (mode === 2) return plantMisconceptionCandidate(item, index);
    const cards = rotate(item.stages, (index % (item.stages.length - 1)) + 1);
    return candidate({
      id: `plant-order-${item.id}-${index + 1}`, format: "picture-sequence", blueprint: "tree-and-plant-change-evidence", band: "expected", concept: "seasonal_plant_sequence",
      prompt: `Plant-year trail ${index + 1}: put the reviewed observation cards in recorded order.`, body: { plant: item.id, plant_type: item.type, event_cards: cards, ordered_model: item.stages, choices: sequenceChoices(item.stages), date_or_season_labels: true, interaction_mode: "order_cards_choose_sequence_keyboard_switch_or_number_cards" }, answer: item.stages,
      hints: ["Read or listen to each date or season label.", "Follow this plant's record rather than guessing one timetable for every plant."], explanation: `${item.order}. ${item.explanation}`, difficulty: 4, tag: item.type.includes("evergreen") ? "all_trees_lose_leaves" : "one_timetable_for_all_plants", hook: "field-plant-year-trail",
      correct: "Plant record sequenced using its own dated evidence.", repair: "Keep one correct card, replay the date label and place only the next observation; no speed score is used.",
      tactile: "Use ordered season/date slots and raised leaf, needle, bud or flower symbols; real plant handling is not required.",
    });
  });
}

function plantEvidenceCandidate(item, index) {
  const answer = item.type.includes("evergreen") ? "green needles or leaves remain across all four observations" : item.type.includes("deciduous") ? "leaf cover changes and many branches are bare in one seasonal panel" : "the same plant shows different visible stages across the dated cards";
  const choices = rotate([answer, "one flower colour proves the pattern for every plant", "the plant becomes a different object in each season"], index % 3);
  return candidate({
    id: `plant-evidence-${item.id}-${index + 1}`, format: "picture-sequence", blueprint: "tree-and-plant-change-evidence", band: "expected", concept: "plant_change_evidence",
    prompt: `Plant-evidence mission ${index + 1}: which observation supports the change claim for this ${item.id}?`, body: { plant: item.id, plant_type: item.type, stage_cards: item.stages, choices, claim_scope: "this_reviewed_sequence", interaction_mode: "choose_evidence_point_to_cards_keyboard_switch_or_aac" }, answer,
    hints: ["Compare more than one card.", "Use leaves, needles, buds, flowers or visible height rather than background colour."], explanation: `${sentenceStart(answer)}. ${item.explanation}`, difficulty: 4, tag: "single_picture_proves_seasonal_pattern", hook: "field-plant-evidence",
    correct: "Plant-change claim linked to repeated observations.", repair: "Compare two cards first and name one visible difference before reopening the full sequence.",
    tactile: "Use paired raised-symbol cards and a full text description; touching real plants is optional and unnecessary.",
  });
}

function plantMisconceptionCandidate(item, index) {
  const isEvergreen = item.type.includes("evergreen");
  const answer = isEvergreen ? "Evergreen trees can keep green leaves or needles in winter while shedding some old ones at other times." : "A plant with no visible leaves or shoot in one record may still be living.";
  const choices = rotate([answer, "Every tree must be bare in winter.", "No visible leaves always means the plant is dead."], index % 3);
  return candidate({
    id: `plant-repair-${item.id}-${index + 1}`, format: "picture-sequence", blueprint: "tree-and-plant-change-evidence", band: "expected", concept: "plant_season_misconception_repair",
    prompt: `Plant idea repair ${index + 1}: which statement fits this reviewed sequence without making an always-rule?`, body: { plant: item.id, plant_type: item.type, stage_cards: item.stages, choices, interaction_mode: "choose_repair_listen_keyboard_switch_or_teach_back" }, answer,
    hints: ["Look for always and every in the choices.", "Use this plant's repeated observations."], explanation: `${answer} ${item.explanation}`, difficulty: 4, tag: isEvergreen ? "all_trees_lose_leaves" : "dormant_plant_is_dead", hook: "field-plant-idea-repair",
    correct: "Plant idea repaired with cautious seasonal evidence.", repair: "Replace always with can, may or this record shows, then choose the matching observation.",
    tactile: "Use CAN, MAY and ALWAYS tactile word cards with adult-read stage descriptions.",
  });
}

function daylightCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = daylightCases[index % daylightCases.length];
    const round = Math.floor(index / daylightCases.length);
    const answer = item.answer;
    const choices = rotate([answer, "the sunnier weather card always has more daylight", "cloud makes daytime stop completely"], index % 3);
    return candidate({
      id: `daylight-${item.id}-${index + 1}`, format: "daylight-compare", blueprint: "daylight-pattern-comparisons", band: "secure", concept: item.id.includes("check") ? "daylight_weather_distinction" : "relative_daylight_comparison",
      prompt: `Daylight-strip mission ${index + 1}: which statement matches the two labelled 24-hour models?`, body: { strips: [{ label: item.labelA, daylight_units: item.unitsA, total_units: 24 }, { label: item.labelB, daylight_units: item.unitsB, total_units: 24 }], choices, pattern_and_text_labels: true, weather_card_separate: true, exact_clock_skill_required: false, interaction_mode: "choose_compare_count_units_keyboard_switch_or_say" }, answer,
      hints: ["Compare only the labelled daylight sections.", "Cloud, rain or sunshine is weather and does not replace the daylight strip evidence."], explanation: `${sentenceStart(answer)}: ${item.unitsA} daylight units for ${item.labelA} and ${item.unitsB} for ${item.labelB}. This is a relative model, not a weather claim.`, difficulty: 5 + (round % 2), tag: "daylight_equals_weather", hook: "field-daylight-strips",
      correct: "Daylight compared using labelled strip length, separate from weather.", repair: "Cover the weather cards, count the patterned daylight units and use more, less or same.",
      tactile: "Use two 24-cell tactile strips with raised daylight sections and spoken/text labels; colour is not the only cue.",
    });
  });
}

function retrievalCandidates(count) {
  const modes = ["season_order", "weather_repair", "multi_evidence", "animal_record", "longitudinal"];
  return Array.from({ length: count }, (_, index) => {
    const mode = modes[index % modes.length];
    if (mode === "season_order") return seasonOrderCandidate(index);
    if (mode === "weather_repair") return weatherRepairCandidate(index);
    if (mode === "animal_record") return animalRecordCandidate(index);
    if (mode === "longitudinal") return longitudinalCandidate(index);
    return multiEvidenceCandidate(index);
  });
}

function seasonOrderCandidate(index) {
  const starts = ["spring", "summer", "autumn", "winter"];
  const start = starts[Math.floor(index / 5) % starts.length];
  const order = rotate(["spring", "summer", "autumn", "winter"], starts.indexOf(start));
  const choices = sequenceChoices(order);
  return candidate({
    id: `review-season-order-${start}-${index + 1}`, format: "weather-sort", blueprint: "seasonal-evidence-spaced-review", band: "retrieval", concept: "four_season_order",
    prompt: `Season-wheel revisit ${index + 1}: choose the repeating four-season order beginning with ${start}.`, body: { choices, season_cards: order, cycle_repeats: true, interaction_mode: "choose_sequence_order_cards_keyboard_switch_or_say", review_interval_days: reviewDay(index) }, answer: order,
    hints: ["Use spring, summer, autumn and winter once each.", "After winter, the yearly cycle returns to spring."], explanation: `${order.join(" → ")} is the requested order. Seasons repeat as a yearly cycle.`, difficulty: 3, tag: "season_order_confusion", hook: "field-season-wheel-revisit",
    correct: "Four-season cycle ordered from the named start.", repair: "Use four tactile season cards and a circular mat; keep correctly placed neighbours.", tactile: "Use four tactile season symbols with audio/text names and partner-assisted placement.",
  });
}

function weatherRepairCandidate(index) {
  const cases = [
    ["It is raining in July, so it cannot be summer.", "Summer days can be rainy; one day's weather does not decide the season."],
    ["There is sunshine in January, so it must be summer.", "Winter days can be sunny; use date and longer-term evidence too."],
    ["Snow fell once, so every winter day will be snowy.", "One snowy day does not describe every winter day."],
    ["Autumn is always windy.", "Autumn can include windy days, but its weather varies."],
    ["Spring is never cold.", "Some spring days can be cold; weather changes from day to day."],
  ];
  const [claim, answer] = cases[Math.floor(index / 5) % cases.length];
  const choices = rotate([answer, "The claim is always correct.", "Weather and season mean exactly the same thing."], index % 3);
  return candidate({
    id: `review-weather-repair-${index + 1}`, format: "weather-sort", blueprint: "seasonal-evidence-spaced-review", band: "retrieval", concept: "weather_season_misconception_repair",
    prompt: `Weather idea repair ${index + 1}: “${claim}” Which response is careful?`, body: { claim, choices, interaction_mode: "choose_repair_listen_keyboard_switch_aac_or_teach_back", review_interval_days: reviewDay(index) }, answer,
    hints: ["One day does not define a whole season.", "Choose can or may rather than always or never."], explanation: answer, difficulty: 4, tag: "weather_equals_season", hook: "field-weather-idea-repair",
    correct: "Weather stereotype repaired with careful season language.", repair: "Underline always, never or must, then replace it with can or may and use the date evidence.", tactile: "Use WEATHER TODAY and SEASON cards plus CAN/ALWAYS tactile words with adult-read text.",
  });
}

function multiEvidenceCandidate(index) {
  const cases = [
    ["Compared with winter, this reviewed summer record has more daylight and many leaves on the oak.", ["longer daylight strip", "many green oak leaves"], ["one rainy hour", "a red coat"]],
    ["Compared with summer, this reviewed autumn record shows seasonal change.", ["shorter daylight strip", "many oak leaves changing colour and falling"], ["one sunny spell", "a blue bag"]],
    ["This reviewed spring record differs from winter.", ["buds opening on the hedge", "daylight strip longer than the winter strip"], ["one cold morning", "a yellow sign"]],
    ["This reviewed winter record differs from summer.", ["shorter daylight strip", "many bare branches on the deciduous tree"], ["one rainy shower", "people wearing boots"]],
  ];
  const [claim, useful, weak] = cases[Math.floor(index / 5) % cases.length];
  const answer = useful.join(" and ");
  const choices = rotate([answer, weak.join(" and "), `${useful[0]} and ${weak[0]}`], index % 3);
  return candidate({
    id: `review-multi-evidence-${index + 1}`, format: "weather-sort", blueprint: "seasonal-evidence-spaced-review", band: "retrieval", concept: "multiple_seasonal_evidence_choice",
    prompt: `Evidence-basket mission ${index + 1}: choose two observations that support the comparison.`, body: { claim, useful_evidence: useful, choices, two_evidence_items_required: true, interaction_mode: "choose_pair_point_keyboard_switch_eye_gaze_or_aac", review_interval_days: reviewDay(index) }, answer,
    hints: ["Choose longer-term plant or daylight evidence.", "A single weather moment or clothing colour is weak season evidence."], explanation: `${answer} support the claim: ${claim}`, difficulty: 4, tag: "single_day_decides_season", hook: "field-evidence-basket",
    correct: "Two useful seasonal observations selected.", repair: "Sort cards into repeated/seasonal evidence and one-moment clues, then choose one plant and one daylight card.", tactile: "Use tactile PLANT, DAYLIGHT and TODAY'S WEATHER card categories with text descriptions.",
  });
}

function animalRecordCandidate(index) {
  const cases = placeComparisons.filter((item) => item.focus.includes("animal"));
  const item = cases[Math.floor(index / 5) % cases.length];
  const answer = `${item.evidenceA}; later, ${item.evidenceB}`;
  const choices = rotate([answer, "Every animal everywhere followed the same pattern.", "The animal count proves the season without dates or other evidence."], index % 3);
  return candidate({
    id: `review-animal-${item.id}-${index + 1}`, format: "weather-sort", blueprint: "seasonal-evidence-spaced-review", band: "retrieval", concept: "seasonal_animal_observation",
    prompt: `Wildlife-log revisit ${index + 1}: which statement stays within this recorded animal evidence?`, body: { place: item.place, dates: [item.dateA, item.dateB], choices, evidence_cards: [item.evidenceA, item.evidenceB], sample_limited_claim: true, interaction_mode: "choose_statement_compare_counts_keyboard_switch_or_say", review_interval_days: reviewDay(index) }, answer,
    hints: ["Use the named place, dates and survey time.", "Do not turn one small record into a rule for every animal."], explanation: `${answer}. This describes the sample only; other days, places and years can differ.`, difficulty: 4, tag: "small_sample_universal_claim", hook: "field-wildlife-log",
    correct: "Animal observation kept tied to its dates and sample.", repair: "Add the words in this survey to the statement, then compare the two recorded observations.", tactile: "Use dated count cards with tactile counters and adult-read evidence; no live-animal contact is required.",
  });
}

function longitudinalCandidate(index) {
  const records = [
    ["oak leaf log", ["March: buds", "May: many new leaves", "July: full leafy crown", "October: many leaves changing colour"], "The repeated record shows leaf cover changing across months."],
    ["daylight class chart", ["December: 8 units", "March: 12 units", "June: 16 units", "September: 12 units"], "The model shows daylight increasing towards June and decreasing afterwards."],
    ["weekly rain log", ["week 1: 2 mm", "week 2: 9 mm", "week 3: 0 mm", "week 4: 5 mm"], "Rainfall varied across the four weeks; this alone does not name a season."],
    ["bulb-bed log", ["January: no shoots visible", "March: green shoots", "April: open flowers", "June: leaves fading"], "The same bulb bed showed different visible stages over time."],
  ];
  const [title, entries, answer] = records[Math.floor(index / 5) % records.length];
  const choices = rotate([answer, "One snapshot gives the same evidence as all four records.", "Every year must follow these exact dates."], index % 3);
  return candidate({
    id: `review-longitudinal-${slug(title)}-${index + 1}`, format: "weather-sort", blueprint: "seasonal-evidence-spaced-review", band: "retrieval", concept: "simple_longitudinal_observation",
    prompt: `Long-view mission ${index + 1}: which conclusion uses all four entries in the ${title}?`, body: { record_title: title, dated_entries: entries, choices, repeated_same_subject_or_method: true, interaction_mode: "choose_conclusion_order_cards_keyboard_switch_or_aac", review_interval_days: reviewDay(index) }, answer,
    hints: ["Use all four dated entries.", "Do not claim every year has exactly the same dates or amounts."], explanation: answer, difficulty: 4, tag: "snapshot_proves_whole_pattern", hook: "field-long-view-log",
    correct: "Longitudinal conclusion matched to repeated observations.", repair: "Place entries in date order, say what changes between neighbours and keep the claim limited to this record.", tactile: "Use four ordered date cards with raised evidence symbols and complete text descriptions.",
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
      supported_interaction: "adult_or_peer_may_read scan arrange cards and record without supplying the science answer",
      visual_route: "reviewed static scenes, matched viewpoints, patterned labels and complete image descriptions",
      tactile_route: tactile,
      text_route: "plain-language date, weather, plant, animal and daylight evidence panels",
      sensory_choice: { outdoor_observation_required: false, weather_exposure_required: false, sound_effects_default_off: true, touch_required: false, text_only_route: true },
      safety_note: "Use reviewed records, indoor models or observations from a safe supervised viewpoint. Do not require exposure to extreme weather, thunder sounds, direct sun viewing, unknown plants or live animals.",
      audio_optional: true,
      audio_asset_id: `narration-${fullId}`,
      audio_provider: "ElevenLabs",
      audio_asset_status: "required_human_listening_review",
      human_listening_approval_required: true,
      browser_tts_allowed: false,
      browser_tts_fallback: "prohibited",
      unavailable_audio_state: "honest_not_ready_visual_tactile_and_text_routes_remain",
      audio_replay_unlimited: true,
      reduced_motion: "static_dated_panels_and_instant_selection",
      no_timer: true,
      speed_score_allowed: false,
      retry_without_penalty: true,
      preserve_correct_observations: true,
      gamification: { mission: "restore a weather window, season trail or field-log page", reward: "one calm field spark for a careful observation or comparison", loss_on_error: false, streak_pressure: false, leaderboard: false, speed_bonus: false, retry_message: "Your useful observation stays in the field log. Open another evidence card and continue." },
      difficulty_band: band,
      evidence_purpose: blueprint.replaceAll("-", "_"),
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
    },
    expected_answer: { value: answer }, hints, explanation,
    feedback: { correct, repair, evidence: explanation, observation_praise: "A precise current-weather or dated observation stays useful even when the season conclusion needs another look." },
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
    if (variant.body.sensory_choice?.outdoor_observation_required !== false || variant.body.sensory_choice?.weather_exposure_required !== false || variant.body.sensory_choice?.text_only_route !== true) throw new Error(`${variant.id} lacks sensory safety.`);
    if (!variant.body.response_mode.includes("keyboard") || !variant.body.response_mode.includes("switch") || !variant.body.response_mode.includes("eye_gaze") || !variant.body.response_mode.includes("aac")) throw new Error(`${variant.id} lacks supported responses.`);
    if (variant.body.audio_optional !== true || variant.body.audio_provider !== "ElevenLabs" || variant.body.audio_asset_status !== "required_human_listening_review" || variant.body.browser_tts_allowed !== false || variant.body.browser_tts_fallback !== "prohibited") throw new Error(`${variant.id} violates optional-audio policy.`);
    if (variant.body.no_timer !== true || variant.body.speed_score_allowed !== false || variant.body.gamification?.streak_pressure !== false || variant.body.gamification?.loss_on_error !== false) throw new Error(`${variant.id} introduces pressure.`);
    if (!variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.evidence || !variant.feedback?.observation_praise) throw new Error(`${variant.id} lacks rich feedback.`);
    const choices = variant.body.choices;
    if (!Array.isArray(choices) || choices.length < 3 || new Set(choices.map((choice) => JSON.stringify(choice))).size !== choices.length) throw new Error(`${variant.id} has invalid choices.`);
    if (choices.filter((choice) => JSON.stringify(choice) === JSON.stringify(variant.expected_answer.value)).length !== 1) throw new Error(`${variant.id} must offer exactly one expected answer.`);
    if (variant.body.prompt.length > 150) throw new Error(`${variant.id} prompt is too long for Year 1.`);
    if (variant.body.concept_focus !== "weather_season_misconception_repair" && /every (summer|winter|spring|autumn) day|always (sunny|rainy|snowy|windy|cold|hot)/i.test(`${variant.body.prompt} ${variant.explanation}`)) throw new Error(`${variant.id} uses a fixed weather stereotype.`);
  }
  const allocation = countBy(currentPack.question_variants, (variant) => variant.body.variant_blueprint_id);
  for (const [id, expected] of Object.entries(pilotAllocation)) if (allocation[id] !== expected) throw new Error(`${id} expected ${expected}, found ${allocation[id] ?? 0}.`);
  const concepts = new Set(generated.map((variant) => variant.body.concept_focus));
  for (const concept of ["current_weather_observation", "same_place_longitudinal_comparison", "same_place_animal_and_environment_comparison", "seasonal_plant_sequence", "plant_change_evidence", "relative_daylight_comparison", "daylight_weather_distinction", "four_season_order", "weather_season_misconception_repair", "multiple_seasonal_evidence_choice", "seasonal_animal_observation", "simple_longitudinal_observation"]) if (!concepts.has(concept)) throw new Error(`Missing concept ${concept}.`);
}

function weather(id, clues, answer, choices, tag) { return { id, clues, answer, choices, tag }; }
function place(id, placeName, dateA, evidenceA, dateB, evidenceB, answer, focus) { return { id, place: placeName, dateA, evidenceA, dateB, evidenceB, answer, focus }; }
function plantSeq(id, type, stages, order, explanation) { return { id, type, stages, order, explanation }; }
function daylight(id, labelA, unitsA, labelB, unitsB, answer) { return { id, labelA, unitsA, labelB, unitsB, answer }; }
function sequenceChoices(items) { return [items, [...items].reverse(), [...items.slice(1), items[0]]]; }
function reviewDay(index) { return [1, 3, 7, 14, 30][index % 5]; }
function sentenceStart(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function slug(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function normalise(value) { return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " "); }
function countBy(items, keyFor) { const result = {}; for (const item of items) { const key = keyFor(item); result[key] = (result[key] ?? 0) + 1; } return result; }
function summary(items, keyFor) { return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
