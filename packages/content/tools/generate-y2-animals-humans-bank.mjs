#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packPath = path.resolve(argValue("--pack") ?? path.join(repoRoot, "packages/content/packs/sc-y2-animals-including-humans.pack.sample.json"));
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y2-animals-humans-bank-";
const reviewBatch = "y2-animals-humans-pilot-a";
const reviewDays = [1, 3, 7, 14, 30];
const allocation = {
  "offspring-adult-feature-matches": 48,
  "life-cycles-with-change": 48,
  "survival-needs-not-wants": 48,
  "food-variety-and-body-care": 48,
  "exercise-and-hygiene-retrieval": 48,
};

const pairs = [
  pair("kitten", "cat", "mammal", "fur, four legs and cat-shaped ears"), pair("puppy", "dog", "mammal", "fur, four legs and a dog-shaped face"),
  pair("lamb", "sheep", "mammal", "four legs and a woolly coat"), pair("calf", "cow", "mammal", "four legs, hooves and a cow-shaped face"),
  pair("foal", "horse", "mammal", "long legs, hooves and a mane beginning to grow"), pair("piglet", "pig", "mammal", "four legs, trotters and a snout"),
  pair("duckling", "duck", "bird", "a bill, two legs and developing feathers"), pair("chick", "chicken", "bird", "a beak, two legs and developing feathers"),
  pair("gosling", "goose", "bird", "a beak, webbed feet and developing feathers"), pair("cygnet", "swan", "bird", "a long neck, beak and webbed feet"),
  pair("baby", "adult human", "human", "the same basic body parts, with growth in size and skills"), pair("tadpole", "adult frog", "amphibian", "a changing body that develops legs as it grows"),
  pair("caterpillar", "adult butterfly", "insect", "a very different young form that later develops wings"), pair("fry", "adult fish", "fish", "fins, a tail and a fish-shaped body"),
];

const cycles = [
  cycle("frog", ["frogspawn", "tadpole", "froglet", "adult frog"], "The tadpole develops legs and its body changes before adulthood."),
  cycle("butterfly", ["egg", "caterpillar", "chrysalis", "adult butterfly"], "The caterpillar and adult butterfly look very different."),
  cycle("chicken", ["egg", "chick", "young chicken", "adult chicken"], "The chick grows and develops adult feathers."),
  cycle("human", ["baby", "child", "young person", "adult human"], "Humans grow in size and develop skills over time."),
  cycle("duck", ["egg", "duckling", "young duck", "adult duck"], "A duckling grows larger and develops adult feathers."),
  cycle("beetle", ["egg", "larva", "pupa", "adult beetle"], "The larva changes form before becoming an adult beetle."),
  cycle("fish", ["egg", "fry", "young fish", "adult fish"], "A fry grows larger while retaining fish features such as fins."),
  cycle("dog", ["newborn puppy", "puppy", "young dog", "adult dog"], "The puppy grows larger and develops adult features."),
];

const animals = [
  { name: "rabbit", food: "plants", shelter: "a safe dry shelter" }, { name: "duck", food: "suitable food", shelter: "a safe resting place" },
  { name: "dog", food: "suitable food", shelter: "a safe place to rest" }, { name: "frog", food: "suitable small animals", shelter: "a safe habitat" },
  { name: "fish", food: "suitable food", shelter: "a safe water habitat" }, { name: "sheep", food: "plants", shelter: "protection from unsafe weather" },
  { name: "human", food: "food", shelter: "a safe place to live" }, { name: "bird", food: "suitable food", shelter: "a safe nesting or resting place" },
];

const meals = [
  ["rice", "beans", "carrots", "yoghurt or a suitable alternative"], ["flatbread", "lentils", "cucumber", "fruit"],
  ["potato", "fish or beans", "peas", "fruit"], ["noodles", "tofu", "mixed vegetables", "fruit"],
  ["pasta", "chickpeas", "tomato", "cheese or a suitable alternative"], ["oats", "milk or a suitable alternative", "banana", "seeds if suitable"],
  ["couscous", "chicken or beans", "pepper", "yoghurt or a suitable alternative"], ["corn", "black beans", "avocado", "fruit"],
];

const movements = [
  ["walking", "heart and muscles work harder"], ["dancing", "the body moves and works harder"], ["wheeling", "the body moves and muscles work"],
  ["swimming", "many muscles move"], ["playground movement", "the body bends, reaches and moves"], ["stretching and active movement", "muscles move through a comfortable range"],
  ["cycling", "legs and heart work harder"], ["inclusive ball play", "movement can be adapted for different bodies"],
];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y2-animals-including-humans") throw new Error("This generator only supports the Year 2 animals-including-humans pack.");
const curated = (pack.question_variants ?? []).filter((v) => !v.id.startsWith(prefix));
const curatedSnapshot = JSON.stringify(curated.map(removeScienceContract));
const curatedCounts = countBy(curated, (v) => v.body?.variant_blueprint_id);
const targets = Object.fromEntries(Object.entries(allocation).map(([id, total]) => [id, total - (curatedCounts[id] ?? 0)]));
for (const [id, count] of Object.entries(targets)) if (count < 0) throw new Error(`Curated variants exceed allocation for ${id}.`);

const generated = [
  ...offspringCandidates(targets["offspring-adult-feature-matches"]),
  ...cycleCandidates(targets["life-cycles-with-change"]),
  ...needsCandidates(targets["survival-needs-not-wants"]),
  ...foodCandidates(targets["food-variety-and-body-care"]),
  ...healthCandidates(targets["exercise-and-hygiene-retrieval"]),
];
const enrichedCurated = curated.map(enrichVariant);
const enrichedGenerated = generated.map(enrichVariant);
pack.question_variants = [...enrichedCurated, ...enrichedGenerated];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Review-stage Year 2 animals-including-humans pack with a deterministic 240-variant pilot bank. Five curated variants are unchanged. Generated tasks cover named offspring and adults, growth and life-stage ordering, observable comparison across animal groups, survival needs, evidence-based enquiry, food variety and appropriate amounts, inclusive exercise, hygiene, misconception repair and transfer. Health content remains age appropriate, non-medical and free from body, family, food or circumstance judgement. Every generated task includes picture, sequence or evidence interactions, sensory-safe reduced-load SEND routes, alternative inputs, rich feedback and pressure-free nature/health missions without timers, streaks, lives or loss. Selected animal-name and short-context narration references ElevenLabs assets held for human listening review; browser TTS is prohibited. Independent science, safeguarding, accessibility, narration and renderer review remains required before promotion.";

validateBank(pack, enrichedCurated, curatedSnapshot, enrichedGenerated);
enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y2-animals-humans-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y2-animals-humans-bank blueprints=${summary(pack.question_variants, (v) => v.body.variant_blueprint_id)}`);
console.log(`y2-animals-humans-bank formats=${summary(pack.question_variants, (v) => v.format)}`);
console.log(`y2-animals-humans-bank concepts=${summary(generated, (v) => v.body.concept_focus)}`);
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y2-animals-humans-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 2 animals/humans bank is out of date; run generate-y2-animals-humans-bank.mjs --write.");
  console.log("y2-animals-humans-bank deterministic check passed");
} else console.log("y2-animals-humans-bank dry-run; pass --write to update the pack");

function offspringCandidates(count) {
  const modes = ["named_offspring_match", "observable_feature_match", "animal_group_compare", "growth_evidence", "misconception_repair"];
  return Array.from({ length: count }, (_, i) => {
    const item = pairs[i % pairs.length], mode = modes[i % modes.length], distractors = adultDistractors(item, i);
    if (mode === "animal_group_compare") {
      const other = pairs[(i + 5) % pairs.length];
      const answer = `${item.offspring} and ${other.offspring} are both offspring, but they belong to different animal groups.`;
      return science({ id: `group-compare-${slug(item.offspring)}-${i + 1}`, format: "offspring-adult-match", blueprint: "offspring-adult-feature-matches", band: "developing", concept: mode,
        prompt: `Wildlife-card mission ${i + 1}: compare a ${item.offspring} (${item.group}) and a ${other.offspring} (${other.group}). Which evidence statement is careful?`,
        body: { subjects: [item.offspring, other.offspring], animal_groups: [item.group, other.group], choices: [answer, "They must be the same group because both are young.", "The smaller picture must show a different kind of animal."], evidence_cards: [item.feature, other.feature] }, answer,
        hints: ["Offspring describes a life stage, not an animal group.", "Use named groups and observable features, not picture size."], explanation: `${item.offspring} is a young ${item.adult} in the ${item.group} group; ${other.offspring} is a young ${other.adult} in the ${other.group} group.`, correct: "Comparison uses named groups and observable evidence.", repair: "Label each card YOUNG, ADULT and ANIMAL GROUP separately, then compare one observable feature at a time.", tag: "young_animals_assumed_same_group", hook: "wildlife-card-compare" });
    }
    if (mode === "growth_evidence") {
      const answer = `A sequence of dated observations shows the ${item.offspring} developing toward an ${item.adult}.`;
      return science({ id: `growth-evidence-${slug(item.offspring)}-${i + 1}`, format: "offspring-adult-match", blueprint: "offspring-adult-feature-matches", band: "expected", concept: mode,
        prompt: `Observation-log mission ${i + 1}: which evidence best supports that a ${item.offspring} grows into an ${item.adult}?`,
        body: { offspring: item.offspring, adult: item.adult, choices: [answer, "One picture looks cute.", "The adult picture is larger on the screen."], observation_method: "same_named_kind_observed_at_several_life_stages", ethical_observation_only: true }, answer,
        hints: ["Good growth evidence is collected over time.", "Picture size on a screen is not body-growth evidence."], explanation: `Repeated, dated observations of the same kind of animal show changes over time. ${item.feature} can support identification.`, correct: "Longitudinal observation selected as evidence of growth.", repair: "Order three dated cards for the same animal kind and identify one feature that changes and one that helps identify the kind.", tag: "single_picture_proves_growth", hook: "observation-log" });
    }
    if (mode === "misconception_repair") {
      const answer = `Young animals can change as they grow; use the life-stage name and evidence, not “small adult” shape alone.`;
      return science({ id: `repair-${slug(item.offspring)}-${i + 1}`, format: "offspring-adult-match", blueprint: "offspring-adult-feature-matches", band: "developing", concept: mode,
        prompt: `Ranger-repair mission ${i + 1}: a helper says every offspring is simply a tiny-looking adult. Which repair is scientific?`,
        body: { example_pair: [item.offspring, item.adult], choices: [answer, "Always choose the smallest picture.", "All young animals must look identical to adults."], feature_evidence: item.feature }, answer,
        hints: ["Some offspring resemble adults; others change greatly.", "Named stages and observations are stronger than size guesses."], explanation: `A ${item.offspring} grows into an ${item.adult}, but appearance can change. Tadpoles and caterpillars are clear examples of young forms unlike adults.`, correct: "The small-adult misconception is repaired using varied examples.", repair: "Compare one similar-looking pair and one changed-form pair; name both life stages before matching.", tag: "young_looks_like_small_adult", hook: "ranger-repair" });
    }
    const answer = item.adult;
    return science({ id: `${mode}-${slug(item.offspring)}-${i + 1}`, format: "offspring-adult-match", blueprint: "offspring-adult-feature-matches", band: "intro", concept: mode,
      prompt: `Offspring-trail mission ${i + 1}: which adult does a ${item.offspring} grow into?`,
      body: { offspring: item.offspring, animal_group: item.group, choices: rotate([answer, ...distractors], i % 3), observable_feature_clue: item.feature, picture_cards: true }, answer,
      hints: [`Use the name ${item.offspring}, not which picture looks smallest.`, `Look for ${item.feature}.`], explanation: `A ${item.offspring} is the offspring of a ${item.adult}. It grows and develops into an adult ${item.adult}.`, correct: `Offspring matched to adult using name and features: ${item.offspring} → ${item.adult}.`, repair: "Keep the offspring card, reveal its spoken/written name and compare one shared or developing feature across two adult choices.", tag: "size_or_cuteness_matching", hook: "young-adult-feature-match", audioScript: i % 3 === 0 ? `Which adult does a ${item.offspring} grow into?` : undefined });
  });
}

function cycleCandidates(count) {
  const modes = ["life_stage_order", "changed_form_sequence", "missing_stage", "before_after_reasoning", "longitudinal_evidence", "compare_life_cycles"];
  return Array.from({ length: count }, (_, i) => {
    const item = cycles[i % cycles.length], mode = modes[i % modes.length], order = item.stages;
    if (mode === "missing_stage") {
      const gap = 1 + (i % (order.length - 2)), answer = order[gap];
      return science({ id: `missing-${slug(item.animal)}-${gap}-${i + 1}`, format: "life-cycle-sequence", blueprint: "life-cycles-with-change", band: "developing", concept: mode,
        prompt: `Life-stage bridge ${i + 1}: which stage fills the gap for the ${item.animal}?`, body: { animal: item.animal, sequence: order.map((x, n) => n === gap ? null : x), choices: stageChoices(answer, item, i), missing_position: gap + 1 }, answer,
        hints: ["Use the stage before and after the gap.", item.change], explanation: `${order.join(" → ")} is the age-appropriate sequence. ${item.change}`, correct: `Missing life stage restored: ${answer}.`, repair: "Reveal the first and adult stages, then compare only two possible middle-stage cards using picture and name clues.", tag: "life_stages_out_of_order", hook: "life-stage-gap" });
    }
    if (mode === "before_after_reasoning") {
      const stage = 1 + (i % (order.length - 1)), answer = order[stage - 1];
      return science({ id: `before-${slug(item.animal)}-${stage}-${i + 1}`, format: "life-cycle-sequence", blueprint: "life-cycles-with-change", band: "expected", concept: mode,
        prompt: `Sequence-evidence mission ${i + 1}: which stage comes immediately before ${order[stage]} in the ${item.animal} sequence?`, body: { animal: item.animal, target_stage: order[stage], choices: stageChoices(answer, item, i), relation: "immediately_before", sequence_strip_available: true }, answer,
        hints: ["Immediately before means the neighbouring earlier stage.", "Use the ordered strip, not which picture is smallest."], explanation: `${answer} comes immediately before ${order[stage]} in ${order.join(" → ")}.`, correct: "Before/after reasoning follows ordered life-stage evidence.", repair: "Place only the target and its two neighbouring stage cards, then point left-to-right through time.", tag: "before_after_reversed", hook: "sequence-evidence" });
    }
    if (mode === "longitudinal_evidence") {
      const answer = "Photographs or drawings labelled at several dates show observable change over time.";
      return science({ id: `evidence-${slug(item.animal)}-${i + 1}`, format: "life-cycle-sequence", blueprint: "life-cycles-with-change", band: "secure", concept: mode,
        prompt: `Field-journal mission ${i + 1}: which record is best evidence of growth in a ${item.animal}?`, body: { animal: item.animal, choices: [answer, "One unlabelled adult picture.", "A guess based on which image is largest."], observation_schedule: ["first observation", "later observation", "final observation"], safe_non_intrusive_observation: true }, answer,
        hints: ["Growth is change over time.", "Use repeated observations with labels or dates."], explanation: `Several dated observations can show the order and observable changes. ${item.change}`, correct: "Repeated observation over time selected as growth evidence.", repair: "Compare a single picture with a three-date sequence and identify what additional evidence the sequence provides.", tag: "single_picture_proves_growth", hook: "field-journal-dates" });
    }
    if (mode === "compare_life_cycles") {
      const other = cycles[(i + 3) % cycles.length], answer = `Both have young stages that grow into adults, but their stage names and visible changes can differ.`;
      return science({ id: `compare-${slug(item.animal)}-${slug(other.animal)}-${i + 1}`, format: "life-cycle-sequence", blueprint: "life-cycles-with-change", band: "secure", concept: mode,
        prompt: `Life-cycle compare mission ${i + 1}: compare the ${item.animal} and ${other.animal}. Which statement fits the evidence?`, body: { animals: [item.animal, other.animal], sequences: [item.stages, other.stages], choices: [answer, "All animals have exactly the same named stages.", "Only animals that look similar can grow into adults."] }, answer,
        hints: ["Look for the shared idea of offspring growing into adults.", "Do not expect every stage name or body change to match."], explanation: `${item.animal}: ${item.stages.join(" → ")}. ${other.animal}: ${other.stages.join(" → ")}. Both show growth, with different details.`, correct: "Life cycles compared using shared pattern and observable differences.", repair: "Circle OFFSPRING and ADULT in both sequences, then underline one differing stage name or visible change.", tag: "all_life_cycles_identical", hook: "life-cycle-compare" });
    }
    return science({ id: `${mode}-${slug(item.animal)}-${i + 1}`, format: "life-cycle-sequence", blueprint: "life-cycles-with-change", band: mode === "changed_form_sequence" ? "developing" : "intro", concept: mode,
      prompt: `Life-cycle trail ${i + 1}: put the ${item.animal} stages in time order.`, body: { animal: item.animal, cards: rotate(order, i % order.length), stage_count: order.length, picture_sequence: true }, answer: order,
      hints: ["Begin with the earliest young stage and end with the adult.", item.change], explanation: `${order.join(" → ")}. ${item.change}`, correct: `Life stages ordered from earliest to adult for the ${item.animal}.`, repair: "Keep correctly placed first/adult cards, add one middle stage at a time and use static arrows to show time direction.", tag: "young_looks_like_small_adult", hook: "life-stage-card-link", audioScript: i % 4 === 0 ? `Put the ${item.animal} life stages in order.` : undefined });
  });
}

function needsCandidates(count) {
  const modes = ["needs_sort", "need_or_want", "survival_reason", "compare_animals", "evidence_from_scene", "misconception_repair"];
  return Array.from({ length: count }, (_, i) => {
    const animal = animals[i % animals.length], mode = modes[i % modes.length], core = ["air", "water", animal.food, animal.shelter];
    if (mode === "need_or_want") {
      const target = ["toy", "decorative ribbon", "music player", "sticker"][i % 4], answer = `${target} may be enjoyable or useful, but it is not a basic survival need like air, water or food.`;
      return science({ id: `want-${slug(animal.name)}-${i + 1}`, format: "basic-needs-sort", blueprint: "survival-needs-not-wants", band: "developing", concept: mode,
        prompt: `Need-or-want mission ${i + 1}: where should “${target}” go for a general ${animal.name} example?`, body: { animal: animal.name, target_card: target, trays: ["basic survival need", "nice or useful but not a survival need"], choices: [answer, `${target} is as necessary for survival as air.`, "Anything enjoyable is a survival need."], no_personal_deprivation_context: true }, answer,
        hints: ["Ask whether the animal must have it to stay alive.", "Wants can matter to comfort without being basic survival needs."], explanation: answer, correct: "Want separated neutrally from survival needs.", repair: "Sort air, water and food first, then compare the target card using the question “must this be present for survival?”", tag: "wants_as_survival_needs", hook: "need-want-trays" });
    }
    if (mode === "survival_reason") {
      const need = ["air", "water", "food", "shelter"][i % 4], reason = need === "air" ? "for breathing or gas exchange" : need === "water" ? "for the body to work and avoid drying out" : need === "food" ? "for energy and materials for growth" : "for protection and a safe place suitable for the animal";
      return science({ id: `reason-${slug(animal.name)}-${need}-${i + 1}`, format: "basic-needs-sort", blueprint: "survival-needs-not-wants", band: "expected", concept: mode,
        prompt: `Evidence-link mission ${i + 1}: why does a ${animal.name} need ${need}?`, body: { animal: animal.name, need, choices: [reason, "because every animal wants the same toy", "because it makes the animal look tidy"], because_frame: `A ${animal.name} needs ${need} because ...` }, answer: reason,
        hints: ["Link the need to staying alive or protection.", "Use a body or habitat reason, not appearance."], explanation: `A ${animal.name} needs ${need} ${reason}.`, correct: "Survival need linked to an age-appropriate function.", repair: "Match one need icon to one simple function icon, then complete the because frame by pointing or AAC.", tag: "need_without_survival_reason", hook: "need-reason-link" });
    }
    if (mode === "compare_animals") {
      const other = animals[(i + 3) % animals.length], answer = `Both need air, water and suitable food; the shelter and food examples may differ with the animal and habitat.`;
      return science({ id: `needs-compare-${slug(animal.name)}-${slug(other.name)}-${i + 1}`, format: "basic-needs-sort", blueprint: "survival-needs-not-wants", band: "secure", concept: mode,
        prompt: `Habitat compare mission ${i + 1}: compare the basic needs of a ${animal.name} and ${other.name}.`, body: { animals: [animal.name, other.name], need_sets: [core, ["air", "water", other.food, other.shelter]], choices: [answer, "Different animals never share any needs.", "Every animal needs exactly the same shelter and food."], venn_sort_available: true }, answer,
        hints: ["Look for shared broad needs first.", "Then notice that suitable foods and safe places can differ."], explanation: answer, correct: "Shared survival needs and animal-specific examples compared carefully.", repair: "Place AIR and WATER in a shared area, then discuss one suitable food or shelter example for each animal.", tag: "all_animals_need_identical_things", hook: "habitat-needs-compare" });
    }
    if (mode === "evidence_from_scene") {
      const answer = `The scene shows access to water, suitable food, air and ${animal.shelter}.`;
      return science({ id: `scene-${slug(animal.name)}-${i + 1}`, format: "basic-needs-sort", blueprint: "survival-needs-not-wants", band: "expected", concept: mode,
        prompt: `Habitat-evidence mission ${i + 1}: which observation supports that the pictured ${animal.name} has its basic needs available?`, body: { animal: animal.name, scene_evidence: core, choices: [answer, "The picture has a bright border.", "The animal is the largest object in the picture."], observation_only_no_animal_handling: true }, answer,
        hints: ["Choose evidence about survival resources.", "Picture decoration and image size are not biological evidence."], explanation: answer, correct: "Observable habitat evidence linked to survival needs.", repair: "Cover decorative details and highlight only labelled food, water, air and safe-place evidence.", tag: "decorative_detail_used_as_evidence", hook: "habitat-evidence-lens" });
    }
    if (mode === "misconception_repair") {
      const answer = "Sort by whether the item is necessary for staying alive, not whether it is enjoyable.";
      return science({ id: `needs-repair-${slug(animal.name)}-${i + 1}`, format: "basic-needs-sort", blueprint: "survival-needs-not-wants", band: "expected", concept: mode,
        prompt: `Survival-board repair ${i + 1}: a helper puts toys beside water as equal survival needs. Which rule repairs the sort?`, body: { animal: animal.name, choices: [answer, "Anything colourful is a survival need.", "Only things an animal likes are needs."], safe_general_context: true }, answer,
        hints: ["Needs and wants are not insults or rewards.", "Ask what is essential for survival."], explanation: `Air, water and suitable food are basic survival needs; many animals also need suitable shelter. Toys can be enjoyable without being survival needs.`, correct: "Need/want misconception repaired without shaming.", repair: "Use two neutral trays labelled MUST HAVE TO SURVIVE and NICE OR USEFUL, then sort only three clear cards.", tag: "wants_as_survival_needs", hook: "survival-board-repair" });
    }
    return science({ id: `needs-${slug(animal.name)}-${i + 1}`, format: "basic-needs-sort", blueprint: "survival-needs-not-wants", band: "intro", concept: mode,
      prompt: `Survival-kit mission ${i + 1}: select the basic needs for a general ${animal.name} example.`, body: { animal: animal.name, need_cards: core, distractor_cards: ["toy", "sticker", "music"], expected_groups: { basic_needs: core, wants_or_extras: ["toy", "sticker", "music"] } }, answer: core,
      hints: ["A basic need supports staying alive.", "Sort wants neutrally; something can be enjoyable without being a survival need."], explanation: `A ${animal.name} needs air, water, ${animal.food} and ${animal.shelter}.`, correct: "Basic survival needs selected and separated from extras.", repair: "Start with air and water, add suitable food, then discuss the safe-place card; keep extras in a neutral separate tray.", tag: "wants_as_survival_needs", hook: "survival-kit-sort" });
  });
}

function foodCandidates(count) {
  const modes = ["food_variety", "right_amounts_language", "meal_compare", "body_care_reason", "allergy_culture_inclusion", "misconception_repair"];
  return Array.from({ length: count }, (_, i) => {
    const foods = meals[i % meals.length], mode = modes[i % modes.length], answer = foods;
    if (mode === "right_amounts_language") {
      const statement = "Humans need suitable amounts of different food types; needs can vary and this is not a judgement about bodies.";
      return science({ id: `amounts-${i + 1}`, format: "healthy-choice-explain", blueprint: "food-variety-and-body-care", band: "secure", concept: mode,
        prompt: `Body-care language mission ${i + 1}: which statement is scientific and respectful?`, body: { choices: [statement, "One food must be eaten all the time.", "A person's body size tells us whether they are good or bad."], no_weight_calorie_or_diet_content: true }, answer: statement,
        hints: ["Use variety and suitable amounts language.", "Science descriptions should not judge people or body shapes."], explanation: statement, correct: "Respectful Year 2 food language selected.", repair: "Replace moral labels with the words variety, different types and suitable amounts; remove body-size claims.", tag: "food_or_people_morally_labelled", hook: "respectful-language-board" });
    }
    if (mode === "meal_compare") {
      const repeated = [foods[0], foods[0], foods[0]], statement = "The first selection shows more different food types; one meal does not label a person or food as good or bad.";
      return science({ id: `meal-compare-${i + 1}`, format: "healthy-choice-explain", blueprint: "food-variety-and-body-care", band: "expected", concept: mode,
        prompt: `Food-card compare ${i + 1}: compare a varied selection with ${repeated.join(", ")}. Which explanation is careful?`, body: { selections: [foods, repeated], choices: [statement, "The repeated food makes a person bad.", "Only one food type is ever needed."], comparison_focus: "variety_not_morality" }, answer: statement,
        hints: ["Count different food types, not moral labels.", "This is about one selection, not judging a person."], explanation: statement, correct: "Food selections compared using variety rather than judgement.", repair: "Sort cards into food-type groups, count represented groups and use “more/less variety” sentence stems.", tag: "single_food_or_moral_labels", hook: "food-card-compare" });
    }
    if (mode === "body_care_reason") {
      const statement = "Different food types provide different things the body uses for energy, growth and working well.";
      return science({ id: `food-reason-${i + 1}`, format: "healthy-choice-explain", blueprint: "food-variety-and-body-care", band: "secure", concept: mode,
        prompt: `Evidence-link mission ${i + 1}: why is food variety useful for humans?`, body: { food_cards: foods, choices: [statement, "It changes whether a person is good.", "Only the colour of food matters."], reason_categories: ["energy", "growth", "body working"] }, answer: statement,
        hints: ["Use a body-function reason.", "Avoid promises that one food does everything."], explanation: statement, correct: "Food variety linked to simple body-care functions.", repair: "Match two different food cards to two broad body-use icons, then state that varied foods contribute in different ways.", tag: "one_food_does_everything", hook: "food-body-evidence-link" });
    }
    if (mode === "allergy_culture_inclusion") {
      const statement = "Different culturally familiar foods and suitable allergy-aware alternatives can still provide variety.";
      return science({ id: `inclusive-food-${i + 1}`, format: "healthy-choice-explain", blueprint: "food-variety-and-body-care", band: "secure", concept: mode,
        prompt: `Inclusive-menu mission ${i + 1}: which statement respects different diets while keeping the science idea of variety?`, body: { example_foods: foods, choices: [statement, "Everyone must eat exactly the same named foods.", "A food allergy should be ignored."], allergy_safety: "follow_trusted_adult_and_health_guidance_no_personal_advice" }, answer: statement,
        hints: ["Food variety can be built in many ways.", "Suitable alternatives matter when a food is not safe or appropriate."], explanation: statement, correct: "Variety described inclusively without personal dietary advice.", repair: "Swap one example food for a suitable alternative card in the same broad role and keep the variety pattern visible.", tag: "one_meal_pattern_for_everyone", hook: "inclusive-menu" });
    }
    if (mode === "misconception_repair") {
      const statement = "Replace “good/bad food” with evidence about variety, suitable amounts and how foods contribute to body care.";
      return science({ id: `food-repair-${i + 1}`, format: "healthy-choice-explain", blueprint: "food-variety-and-body-care", band: "expected", concept: mode,
        prompt: `Language-repair mission ${i + 1}: a helper calls foods and people good or bad. Which repair is scientific?`, body: { choices: [statement, "Keep judging people by one meal.", "Say one repeated food is all a body needs."], safeguarding_note: "no_body_or_family_judgement" }, answer: statement,
        hints: ["Describe evidence, not a person's worth.", "Use variety and suitable amounts."], explanation: statement, correct: "Moral labels replaced by scientific, respectful language.", repair: "Cross out judgement words and choose from neutral evidence stems: “shows variety”, “one type”, or “suitable alternative”.", tag: "single_food_or_moral_labels", hook: "language-repair" });
    }
    return science({ id: `food-variety-${i + 1}`, format: "healthy-choice-explain", blueprint: "food-variety-and-body-care", band: "developing", concept: mode,
      prompt: `Variety-plate mission ${i + 1}: choose the selection showing different types of food.`, body: { varied_selection: foods, choices: [foods, [foods[0], foods[0], foods[0]], ["non-food objects"]], inclusive_note: "examples allow suitable cultural, allergy-aware and sensory alternatives" }, answer,
      hints: ["Look for different types rather than one repeated item.", "Do not label food or people as good or bad."], explanation: `${foods.join(", ")} shows a variety of food types. Different suitable selections can also show variety.`, correct: "Food variety identified without moral or body labels.", repair: "Group the cards by type, keep one clear example from several groups and offer picture/text alternatives.", tag: "single_food_or_moral_labels", hook: "variety-plate" });
  });
}

function healthCandidates(count) {
  const modes = ["exercise_variety", "exercise_effect", "handwashing_order", "hygiene_reason", "inclusive_movement", "misconception_repair", "enquiry_transfer", "spaced_retrieval"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length], [movement, effect] = movements[i % movements.length], day = reviewDays[i % reviewDays.length];
    if (mode === "handwashing_order") {
      const sequence = ["wet hands", "use soap", "rub all hand surfaces", "rinse", "dry hands"];
      return science({ id: `handwash-${i + 1}`, format: "healthy-choice-explain", blueprint: "exercise-and-hygiene-retrieval", band: "developing", concept: mode,
        prompt: `Hygiene-sequence mission ${i + 1}: put the handwashing picture cards in a sensible order.`, body: { cards: rotate(sequence, i % sequence.length), sensory_alternatives: "visual steps, adult support and suitable fragrance-free options where available", purpose: "reduce_germs_and_care_for_body" }, answer: sequence,
        hints: ["Soap is used before rinsing.", "Drying comes after rinsing."], explanation: `${sequence.join(" → ")}. This routine helps remove dirt and reduce the spread of germs.`, correct: "Handwashing stages ordered with a calm hygiene reason.", repair: "Keep first and last cards, add one middle picture at a time and use a static visual schedule.", tag: "hygiene_only_tidy", hook: "handwash-static-sequence" });
    }
    if (mode === "hygiene_reason") {
      const actions = [["brush teeth", "remove food and plaque as part of caring for teeth"], ["wash hands after using the toilet", "reduce the spread of germs"], ["cover a cough with a tissue or elbow", "reduce droplets spreading"], ["wash hands before handling food", "reduce germs moving onto food"]];
      const [action, reason] = actions[i % actions.length];
      return science({ id: `hygiene-reason-${i + 1}`, format: "healthy-choice-explain", blueprint: "exercise-and-hygiene-retrieval", band: "expected", concept: mode,
        prompt: `Body-care evidence mission ${i + 1}: why can “${action}” be a useful hygiene action?`, body: { action, choices: [reason, "to win a race", "only to make objects look straight"], calm_germ_language: true, no_medical_advice: true }, answer: reason,
        hints: ["Hygiene is about caring for the body and reducing germs.", "Choose a reason linked to the action."], explanation: `${action} can ${reason}.`, correct: "Hygiene action linked to an appropriate care reason.", repair: "Match the action card to REDUCE GERMS or CARE FOR TEETH/BODY, then complete the because frame.", tag: "hygiene_only_tidy", hook: "hygiene-reason-link" });
    }
    if (mode === "inclusive_movement" || mode === "exercise_variety") {
      const statement = `${movement} can count as exercise because ${effect}; exercise does not have to be a race or one particular sport.`;
      return science({ id: `${mode}-${slug(movement)}-${i + 1}`, format: "healthy-choice-explain", blueprint: "exercise-and-hygiene-retrieval", band: "developing", concept: mode,
        prompt: `Movement-map mission ${i + 1}: which statement about ${movement} is scientific and inclusive?`, body: { movement, choices: [statement, "Only the fastest runner exercises.", "Mobility aids mean movement cannot be exercise."], adaptations_welcome: true, no_performance_scoring: true }, answer: statement,
        hints: ["Exercise means movement that makes the body work harder.", "People can move in different suitable ways."], explanation: statement, correct: "Inclusive movement identified as exercise using body-work evidence.", repair: "Compare several movement cards and point to the common evidence icon: body or muscles working harder.", tag: "exercise_only_sport_or_fastest", hook: "inclusive-movement-map" });
    }
    if (mode === "exercise_effect") {
      const answer = `${movement} can make the heart, breathing or muscles work harder in an age-appropriate way.`;
      return science({ id: `exercise-effect-${slug(movement)}-${i + 1}`, format: "healthy-choice-explain", blueprint: "exercise-and-hygiene-retrieval", band: "expected", concept: mode,
        prompt: `Movement-evidence mission ${i + 1}: what observable clue can show the body is working harder during ${movement}?`, body: { movement, choices: [answer, "The person wins every time.", "Their body has a particular shape."], observe_without_measurement: ["breathing may become quicker", "body may feel warmer", "muscles are moving"] }, answer,
        hints: ["Use what the body is doing, not winning or appearance.", "Different people show effort differently."], explanation: answer, correct: "Exercise linked to observable body-work evidence without comparison or judgement.", repair: "Choose one neutral observation such as muscles moving or breathing changing; remove speed and body-shape clues.", tag: "exercise_only_sport_or_fastest", hook: "movement-evidence" });
    }
    if (mode === "misconception_repair") {
      const answer = "Exercise includes many suitable ways of moving; hygiene reduces germs and cares for the body, not merely tidiness.";
      return science({ id: `health-repair-${i + 1}`, format: "healthy-choice-explain", blueprint: "exercise-and-hygiene-retrieval", band: "secure", concept: mode,
        prompt: `Health-guide repair ${i + 1}: choose the statement that repairs two common misconceptions.`, body: { choices: [answer, "Only competitive sport counts, and neat toys prevent germs.", "Exercise and hygiene depend on being the fastest."], teach_back_frame: "Exercise can be __ because __. Hygiene helps by __." }, answer,
        hints: ["Exercise is broader than sport.", "Hygiene has a germ/body-care reason."], explanation: answer, correct: "Exercise and hygiene misconceptions repaired with inclusive evidence.", repair: "Sort movement and hygiene cards separately, then attach one evidence reason to each category.", tag: "exercise_only_sport_or_hygiene_only_tidy", hook: "health-guide-repair" });
    }
    if (mode === "enquiry_transfer") {
      const answer = "Use the same simple movement for a short agreed time, observe before/after clues safely, and compare only the observations.";
      return science({ id: `enquiry-${i + 1}`, format: "healthy-choice-explain", blueprint: "exercise-and-hygiene-retrieval", band: "secure", concept: mode,
        prompt: `Safe-enquiry mission ${i + 1}: how could a class observe that movement makes bodies work harder without racing?`, body: { choices: [answer, "Make everyone compete until exhausted.", "Judge body shapes from pictures."], practical_safety: "teacher_led_optional_suitable_movement_stop_if_uncomfortable_no_medical_measurement", observation_options: ["breathing description", "warmth description", "muscles used"], participation_alternatives: ["observe", "move in a suitable way", "record picture cards"] }, answer,
        hints: ["Keep the activity suitable, optional and teacher-led.", "Observe changes, not winners."], explanation: answer, correct: "A safe, fair, non-competitive observation plan selected.", repair: "Remove competition and body judgement, keep one agreed movement/observation, and offer observer or recorder roles.", tag: "exercise_enquiry_as_race", hook: "safe-enquiry-board" });
    }
    const action = i % 2 ? movement : "wash hands with soap and water at an appropriate time";
    const answer = i % 2 ? `${movement} is exercise because ${effect}.` : "Handwashing helps reduce the spread of germs.";
    return science({ id: `retrieval-${slug(action)}-${i + 1}`, format: "healthy-choice-explain", blueprint: "exercise-and-hygiene-retrieval", band: "retrieval", concept: mode,
      prompt: `Nature-health revisit ${i + 1}: after ${day} days, choose the evidence-based explanation for “${action}”.`, body: { action, choices: [answer, "It matters only if someone wins.", "It changes whether a person is good or bad."], review_interval_days: day }, answer,
      hints: ["Link movement to the body working harder, or hygiene to reducing germs/body care.", "Avoid judging speed, appearance or people."], explanation: answer, correct: "Health idea retrieved with an evidence-based, respectful explanation.", repair: "Return to the movement/effect or hygiene/reason matching cards, then retry without losing prior correct work.", tag: "health_action_without_reason", hook: "nature-health-revisit", audioScript: i % 4 === 0 ? `Choose the evidence-based explanation for ${action}.` : undefined });
  });
}

function science({ id, format, blueprint, band, concept, prompt, body, answer, hints, explanation, correct, repair, tag, hook, audioScript }) {
  const audio = audioScript ? { audio_required: true, narration_script: audioScript, audio_asset_id: `narration-${prefix}${id}`, audio_provider: "ElevenLabs", audio_asset_status: "required_human_listening_review", human_listening_approval_required: true, browser_tts_allowed: false, browser_tts_fallback: "prohibited", audio_replay_unlimited: true, unavailable_audio_state: "honest_not_ready_use_picture_text_and_adult_read_route" } : { audio_required: false, audio_route: "not_needed_for_this_picture_sequence_or_evidence_task" };
  return {
    id: `${prefix}${id}`, format,
    body: {
      prompt, ...body, ...audio, concept_focus: concept,
      interaction_mode: "tap_drag_keyboard_switch_eye_gaze_aac_point_or_adult_scribed",
      supported_interaction: "An adult or peer may read labels, scan cards, move the child's named choice or record an indicated explanation without supplying the science answer.",
      picture_route: "Large clear cards with concise alt descriptions, one focal organism or action and no distressing imagery.",
      sequence_route: "Static left-to-right stage or action strip with first/next/adult or before/after labels.",
      evidence_route: "Choose or point to one observable feature, dated sequence, survival resource or body-care reason.",
      send_support: { one_concept_per_panel: true, reduced_choice_mode: true, symbol_and_text_labels: true, colour_not_required: true, predictable_card_positions: true, adult_scribed_equal_evidence: true },
      sensory_safe_route: "No sudden sounds, flashing, realistic germ close-ups, distressing animal scenes or compulsory tactile materials; quiet static mode is complete.",
      visual_route: "Low-clutter cards, generous spacing, optional plain backgrounds and feature hotspots described in text.",
      processing_route: "Reveal one comparison, stage or reason at a time; preserve correct cards and allow repeated viewing.",
      motor_alternative: "Tap, keyboard, switch scan, eye gaze, AAC, pointing or adult-scribed choices can replace dragging, speech and handwriting.",
      low_visual_load: true, reduced_motion: "static_before_after_or_instant_card_placement", preserve_correct_work: true, undo_available: true,
      no_timer: true, speed_score_allowed: false, microphone_required: false, handwriting_required: false, retry_without_penalty: true,
      gamification: { mission: "help a calm nature and health team organise one evidence card", reward: "one observation leaf for a careful match, sequence or reason", lives: false, streaks: false, loss_on_error: false, leaderboard: false, speed_bonus: false, retry_message: "Your correct evidence stays. Choose another clue or route and continue." },
      age_appropriate_scope: "observable_growth_basic_survival_needs_and_general_human_body_care_not_medical_advice",
      difficulty_band: band, evidence_purpose: concept, variant_blueprint_id: blueprint, review_batch: reviewBatch,
    },
    expected_answer: Array.isArray(answer) && concept.includes("order") || concept.includes("sequence") ? { sequence: answer } : { value: answer },
    hints, explanation,
    feedback: { correct, repair, science_evidence: explanation, support_message: "Picture choice, sequencing, pointing, eye gaze, AAC and adult-scribed explanations carry equal evidence; speed, speech and handwriting are not scored." },
    difficulty: band === "intro" ? 2 : band === "developing" ? 3 : band === "expected" ? 4 : band === "secure" ? 5 : 4,
    status: "review", misconception_tag: tag, animation_hook: hook,
  };
}

function enrichVariant(variant) {
  const body = variant.body ?? {};
  const responseModes = ["tap", "keyboard", "switch", "eye_gaze", "aac", "adult_scribed"];
  let scienceContract;
  if (variant.format === "offspring-adult-match") {
    scienceContract = {
      kind: "offspring_adult_evidence",
      mode: body.subjects ? "comparison" : "match_or_explain",
      subject_keys: body.subjects ? ["subjects", "animal_groups"] : ["offspring", "adult", "animal_group"].filter((key) => body[key] !== undefined),
      evidence_keys: ["observable_feature_clue", "evidence_cards", "feature_evidence"].filter((key) => body[key] !== undefined),
      response_modes: responseModes,
      drag_required: false,
      preserve_correct_work: true,
    };
  } else if (variant.format === "life-cycle-sequence") {
    scienceContract = {
      kind: "life_cycle_sequence",
      mode: body.sequences ? "compare_sequences" : body.sequence ? "ordered_gap_or_relation" : "sequence_build",
      sequence_keys: ["cards", "sequence", "sequences"].filter((key) => body[key] !== undefined),
      response_modes: responseModes,
      drag_required: false,
      preserve_correct_work: true,
    };
  } else if (variant.format === "basic-needs-sort") {
    scienceContract = {
      kind: "needs_evidence_sort",
      mode: body.need_cards ? "sort_cards" : body.target_card ? "need_or_want" : "need_reason",
      input_keys: ["need_cards", "distractor_cards", "target_card", "trays", "need", "choices"].filter((key) => body[key] !== undefined),
      response_modes: responseModes,
      drag_required: false,
      preserve_correct_work: true,
    };
  } else if (variant.format === "healthy-choice-explain") {
    scienceContract = {
      kind: "health_evidence_explain",
      mode: body.varied_selection || body.selections ? "variety_compare" : body.movement || body.action ? "body_care_reason" : "evidence_choice",
      input_keys: ["varied_selection", "selections", "movement", "action", "choices", "observation_options"].filter((key) => body[key] !== undefined),
      response_modes: responseModes,
      drag_required: false,
      preserve_correct_work: true,
    };
  }
  return scienceContract ? { ...variant, body: { ...body, science_contract: scienceContract } } : variant;
}

function validateBank(currentPack, curated, snapshot, generated) {
  if (curated.length !== 5) throw new Error(`Expected 5 curated variants, found ${curated.length}.`);
  if (JSON.stringify(curated.map(removeScienceContract)) !== snapshot) throw new Error("Curated variants changed during generation.");
  if (currentPack.question_variants.length !== 240 || generated.length !== 235) throw new Error("Pilot must contain 5 curated and 235 generated variants.");
  const ids = currentPack.question_variants.map((v) => v.id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate variant IDs found.");
  const counts = countBy(currentPack.question_variants, (v) => v.body.variant_blueprint_id);
  for (const [id, total] of Object.entries(allocation)) if (counts[id] !== total) throw new Error(`${id} expected ${total}, found ${counts[id] ?? 0}.`);
  for (const variant of currentPack.question_variants.filter((v) => ["offspring-adult-match", "life-cycle-sequence", "basic-needs-sort", "healthy-choice-explain"].includes(v.format))) validateScienceContract(variant);
  const concepts = new Set(generated.map((v) => v.body.concept_focus));
  for (const c of ["named_offspring_match", "observable_feature_match", "animal_group_compare", "growth_evidence", "life_stage_order", "changed_form_sequence", "longitudinal_evidence", "needs_sort", "need_or_want", "survival_reason", "compare_animals", "food_variety", "right_amounts_language", "body_care_reason", "exercise_variety", "exercise_effect", "handwashing_order", "hygiene_reason", "enquiry_transfer", "spaced_retrieval"]) if (!concepts.has(c)) throw new Error(`Missing concept ${c}.`);
  for (const v of generated) {
    const b = v.body;
    if (!b.send_support?.reduced_choice_mode || !b.picture_route || !b.sequence_route || !b.evidence_route || !b.sensory_safe_route || !b.motor_alternative || !b.low_visual_load) throw new Error(`Missing SEND/sensory route in ${v.id}.`);
    if (!v.feedback?.correct || !v.feedback?.repair || !v.feedback?.science_evidence) throw new Error(`Missing rich feedback in ${v.id}.`);
    if (!b.no_timer || b.speed_score_allowed || b.gamification?.lives || b.gamification?.streaks || b.gamification?.loss_on_error) throw new Error(`Pressure mechanic in ${v.id}.`);
    if (b.audio_required) {
      if (b.audio_provider !== "ElevenLabs" || b.audio_asset_status !== "required_human_listening_review" || !b.human_listening_approval_required || b.browser_tts_allowed !== false || b.browser_tts_fallback !== "prohibited") throw new Error(`Audio policy failure in ${v.id}.`);
    } else if (b.audio_asset_id || b.audio_provider) throw new Error(`Unnecessary audio reference in ${v.id}.`);
  }
}

function validateScienceContract(variant) {
  const body = variant.body ?? {};
  const contract = body.science_contract;
  const requiredResponseModes = ["tap", "keyboard", "switch", "eye_gaze", "aac", "adult_scribed"];
  if (!contract || contract.drag_required !== false || contract.preserve_correct_work !== true || !Array.isArray(contract.response_modes) || requiredResponseModes.some((mode) => !contract.response_modes.includes(mode))) throw new Error(`${variant.id} lacks an accessible science contract.`);
  if (!Array.isArray(contract.input_keys) && !Array.isArray(contract.subject_keys) && !Array.isArray(contract.sequence_keys)) throw new Error(`${variant.id} lacks backend input semantics.`);
  if (contract.mode === "sort_cards" && (!body.need_cards || !body.distractor_cards)) throw new Error(`${variant.id} lacks need-sort card inputs.`);
  if (contract.mode === "compare_sequences" && (!body.sequences || body.sequences.length < 2)) throw new Error(`${variant.id} lacks comparable life-cycle sequences.`);
  if (contract.mode === "variety_compare" && !body.varied_selection && !body.selections) throw new Error(`${variant.id} lacks health comparison inputs.`);
}

function removeScienceContract(variant) {
  const { science_contract: _scienceContract, ...body } = variant.body ?? {};
  return { ...variant, body };
}

function pair(offspring, adult, group, feature) { return { offspring, adult, group, feature }; }
function cycle(animal, stages, change) { return { animal, stages, change }; }
function adultDistractors(item, i) { return pairs.filter((p) => p.adult !== item.adult).map((p) => p.adult).filter((x, n, a) => a.indexOf(x) === n).slice(i % 4, i % 4 + 2); }
function stageChoices(answer, item, i) { const extras = cycles.flatMap((c) => c.stages).filter((s) => !item.stages.includes(s)); return rotate([...new Set([answer, extras[i % extras.length], extras[(i + 5) % extras.length]])], i % 3); }
function rotate(items, n) { const a = [...items], k = a.length ? n % a.length : 0; return a.slice(k).concat(a.slice(0, k)); }
function slug(text) { return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function countBy(items, fn) { const out = {}; for (const item of items) { const key = fn(item); out[key] = (out[key] ?? 0) + 1; } return out; }
function summary(items, fn) { return Object.entries(countBy(items, fn)).sort(([a], [b]) => String(a).localeCompare(String(b))).map(([k, v]) => `${k}:${v}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
