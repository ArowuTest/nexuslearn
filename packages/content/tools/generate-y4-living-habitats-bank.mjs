#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packPath = path.resolve(argValue("--pack") ?? path.join(repoRoot, "packages/content/packs/sc-y4-living-things-and-habitats.pack.sample.json"));
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y4-living-habitats-bank-";
const reviewBatch = "y4-living-habitats-pilot-a";
const allocation = { "observable-feature-grouping": 48, "follow-branching-classification-keys": 48, "build-simple-identification-keys": 48, "habitat-change-impact-evidence": 48, "classification-and-habitat-retrieval": 48 };
const curatedIds = new Set([
  "sc-y4-living-things-and-habitats-q-feature-sort", "sc-y4-living-things-and-habitats-q-follow-key", "sc-y4-living-things-and-habitats-q-key-question", "sc-y4-living-things-and-habitats-q-pond-change", "sc-y4-living-things-and-habitats-q-bee-not-pest",
]);
const reviewDays = [1, 3, 7, 14, 30];
const organisms = [
  animal("robin", "vertebrate", "bird", ["feathers", "two legs", "wings", "beak"]),
  animal("brown trout", "vertebrate", "fish", ["fins", "scales", "gills", "streamlined body"]),
  animal("common frog", "vertebrate", "amphibian", ["four legs", "smooth moist skin", "no feathers"]),
  animal("fox", "vertebrate", "mammal", ["fur", "four legs", "external ears"]),
  animal("slow worm", "vertebrate", "reptile", ["dry scales", "no legs", "backbone shown on evidence card"]),
  animal("ladybird", "invertebrate", "insect", ["six legs", "one pair of antennae", "hard wing cases"]),
  animal("bumblebee", "invertebrate", "insect", ["six legs", "one pair of antennae", "wings"]),
  animal("garden spider", "invertebrate", "arachnid", ["eight legs", "no antennae", "two main body sections"]),
  animal("garden snail", "invertebrate", "mollusc", ["muscular foot", "tentacles", "shell on this specimen"]),
  animal("earthworm", "invertebrate", "segmented worm", ["segmented body", "no legs", "no shell"]),
  animal("woodlouse", "invertebrate", "crustacean", ["many jointed legs", "segmented plates", "one pair of antennae"]),
  animal("centipede", "invertebrate", "myriapod", ["many body segments", "many legs", "one pair of antennae"]),
];
const plants = [
  plant("daisy", "flowering plant", ["flowers shown", "broad leaves", "soft green stem"]),
  plant("oak tree", "flowering plant", ["broad leaves", "woody trunk", "acorns shown as fruits"]),
  plant("grass", "flowering plant", ["narrow leaves", "parallel veins", "tiny flowers shown on seed head"]),
  plant("bramble", "flowering plant", ["flowers or berries shown", "woody arching stem", "broad leaves"]),
  plant("fern", "non-flowering plant", ["fronds", "spore patches shown", "no flowers or seeds"]),
  plant("moss", "non-flowering plant", ["small leafy shoots", "spore capsules shown", "no flowers"]),
];
const keySets = [
  keySet(["robin", "common frog", "ladybird", "garden spider"], ["Does it have a backbone?", "Does it have feathers?", "Does it have six legs?"], "observable animal features"),
  keySet(["brown trout", "fox", "garden snail", "earthworm"], ["Does it have a backbone?", "Does it have fur?", "Does it have a shell?"], "backbone, fur and shell evidence"),
  keySet(["daisy", "grass", "fern", "moss"], ["Does the evidence card show flowers?", "Are the leaves narrow with parallel veins?", "Does it have fronds?"], "plant structures"),
  keySet(["bumblebee", "garden spider", "woodlouse", "centipede"], ["Does it have six legs?", "Does it have eight legs?", "Does it have one pair of legs on each shown body segment?"], "leg number and arrangement"),
  keySet(["oak tree", "bramble", "daisy", "fern"], ["Does it produce flowers or fruits?", "Does it have a woody trunk?", "Does it have woody arching stems?"], "flowers, fruits and woody stems"),
];
const changes = [
  change("pond", "increased shade", "less light reaches water plants and plant growth is recorded as lower", "pond snails and some insect larvae use plants for food or shelter", "Some animals may find less food or shelter; further counts would show whether their numbers change.", "human_or_natural"),
  change("school hedge", "hedge removed during nesting season", "fewer dense branches and nesting places remain", "birds use dense vegetation for shelter and nesting", "Some birds may have fewer safe nesting places, so work should avoid nesting season and follow expert guidance.", "negative_human"),
  change("park edge", "native hedge planted", "more flowers, leaves and dense cover are recorded over time", "insects use flowers for food and small animals use cover", "The change may increase food and shelter for some local organisms.", "positive_human"),
  change("stream", "litter enters the water", "plastic and cans cover parts of the bank and water surface", "stream organisms need suitable water, food and shelter", "Litter may damage habitat quality or trap animals; adults should arrange safe removal without pupils entering water.", "negative_human"),
  change("meadow", "grass cut very frequently", "fewer flowers reach flowering stage", "flower-visiting insects use nectar and pollen", "Some flower-visiting insects may find less food while frequent cutting continues.", "negative_human"),
  change("school garden", "small wildlife pond added", "a new area of still water and water plants is recorded", "some amphibians and insects use pond habitats", "The pond may provide habitat for additional organisms if it is maintained safely.", "positive_human"),
  change("woodland floor", "fallen logs removed", "less damp decaying-wood shelter remains", "woodlice and other small invertebrates use damp sheltered places", "Some damp-habitat invertebrates may be recorded less often in that area.", "negative_human"),
  change("woodland floor", "log pile created from untreated local wood", "more shaded crevices and decaying wood are available", "some fungi and invertebrates use damp decaying material", "The log pile may provide additional shelter and feeding places for some organisms.", "positive_human"),
  change("pond", "long dry period", "water level and shallow-water area decrease", "pond organisms depend on water and wet-edge shelter", "Some pond organisms may have less available habitat; the effect should be checked over time.", "natural"),
  change("urban garden", "bright lights remain on overnight", "night-time light levels increase", "some nocturnal animals use darkness for feeding or movement", "The lighting may change when some nocturnal animals visit; repeated observations could test this.", "negative_human"),
  change("roadside verge", "wildflower strip established", "more flowering plant species and flower cover are counted", "pollinating insects visit flowers for food", "More flower resources may support visits by a wider range of insects.", "positive_human"),
  change("field margin", "pesticide applied nearby", "fewer invertebrates are counted after application, alongside weather records", "birds and other animals may feed on invertebrates", "The pesticide may be linked to fewer invertebrates, but weather and repeated control-site evidence must also be considered.", "negative_human"),
];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y4-living-things-and-habitats") throw new Error("This generator only supports sc-y4-living-things-and-habitats.");
const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedSnapshot = JSON.stringify(curated);
if (curated.length !== 5 || curated.some((variant) => !curatedIds.has(variant.id))) throw new Error("Expected the five mapped curated variants.");
const curatedCounts = countBy(curated, (variant) => variant.body.variant_blueprint_id);
const targets = Object.fromEntries(Object.entries(allocation).map(([id, target]) => [id, target - (curatedCounts[id] ?? 0)]));
const generated = [
  ...featureCandidates(targets["observable-feature-grouping"]),
  ...followKeyCandidates(targets["follow-branching-classification-keys"]),
  ...buildKeyCandidates(targets["build-simple-identification-keys"]),
  ...habitatCandidates(targets["habitat-change-impact-evidence"]),
  ...retrievalCandidates(targets["classification-and-habitat-retrieval"]),
];
pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Deterministic 240-variant Year 4 living-things-and-habitats pilot preserving all five curated variants unchanged. Generated review tasks deepen observable-feature grouping; age-appropriate vertebrate, invertebrate and plant classification; following and building unambiguous branching keys; environmental-change evidence; cautious feature/habitat links; local no-touch enquiry; positive and negative human impacts; misconceptions and transfer. Every generated variant includes sensory-safe visual/text/no-touch routes, reduced load, alternative input, rich corrective feedback and pressure-free ecology missions. Selected narration references ElevenLabs assets requiring human listening review; browser TTS is prohibited. Independent science, teacher, accessibility, safeguarding and renderer review remains required before promotion.";
validateBank(pack, curated, curatedSnapshot, generated);

console.log(`y4-living-habitats-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y4-living-habitats-bank blueprints=${summary(pack.question_variants, (v) => v.body.variant_blueprint_id)}`);
console.log(`y4-living-habitats-bank formats=${summary(pack.question_variants, (v) => v.format)}`);
console.log(`y4-living-habitats-bank concepts=${summary(generated, (v) => v.body.concept_focus)}`);
console.log(`y4-living-habitats-bank audio=${summary(generated, (v) => v.body.audio_required ? "reviewed_reference" : "not_needed")}`);
enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
if (write) { await writeFile(packPath, nextText, "utf8"); console.log(`y4-living-habitats-bank written ${relative(packPath)}`); }
else if (check) { if (originalText !== nextText) throw new Error("Year 4 living-habitats bank is out of date; run generate-y4-living-habitats-bank.mjs --write."); console.log("y4-living-habitats-bank deterministic check passed"); }
else console.log("y4-living-habitats-bank dry-run; pass --write to update the pack");

function featureCandidates(count) {
  const modes = ["vertebrate_invertebrate", "vertebrate_group", "invertebrate_group", "flowering_nonflowering", "observable_rule", "multiple_valid_sorts", "subjective_group_repair", "feature_habitat_link"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length], organism = organisms[i % organisms.length], specimen = plants[i % plants.length];
    let prompt, answer, body, explanation, tag = "subjective_or_place_based_grouping";
    if (mode === "vertebrate_invertebrate") {
      answer = organism.backboneGroup; prompt = `Feature-sort ${i + 1}: classify the ${organism.name} using the backbone evidence card.`;
      body = { organism: organism.name, observable_features: organism.features, backbone_evidence: organism.backboneGroup === "vertebrate" ? "internal skeleton with backbone shown" : "no backbone shown in the supplied evidence", choices: ["vertebrate", "invertebrate"] };
      explanation = `The supplied evidence places the ${organism.name} with ${organism.backboneGroup}s. This grouping uses backbone evidence, not size or habitat.`;
    } else if (mode === "vertebrate_group") {
      const item = organisms.filter((o) => o.backboneGroup === "vertebrate")[i % 5]; answer = item.group; prompt = `Vertebrate feature-sort ${i + 1}: which broad group fits the ${item.name}?`;
      body = { organism: item.name, observable_features: item.features, choices: ["fish", "amphibian", "reptile", "bird", "mammal"] };
      explanation = `${item.name} is grouped as a ${item.group} using the shown features: ${item.features.join(", ")}.`;
    } else if (mode === "invertebrate_group") {
      const item = organisms.filter((o) => o.backboneGroup === "invertebrate")[i % 7]; answer = item.group; prompt = `Invertebrate feature-sort ${i + 1}: choose the group supported for the ${item.name}.`;
      body = { organism: item.name, observable_features: item.features, choices: unique([item.group, "insect", "arachnid", "mollusc", "segmented worm"]).slice(0, 4) };
      explanation = `The evidence supports ${item.group}: ${item.features.join(", ")}. “Small animal” does not automatically mean insect.`; tag = "all_small_animals_are_insects";
    } else if (mode === "flowering_nonflowering") {
      answer = specimen.group; prompt = `Plant feature-sort ${i + 1}: classify the ${specimen.name} from the supplied life-stage evidence.`;
      body = { plant: specimen.name, observable_features: specimen.features, choices: ["flowering plant", "non-flowering plant"] };
      explanation = `${specimen.name} is a ${specimen.group}; the card shows ${specimen.features.join(", ")}. Evidence may come from more than one season.`;
    } else if (mode === "observable_rule") {
      answer = "Group by an observable, consistently checkable feature such as backbone, leg number, feathers, shell, flowers or spores."; prompt = `Scientific-sort checkpoint ${i + 1}: choose a reliable rule for a mixed set of organism cards.`;
      body = { choices: [answer, "Group by scary and friendly.", "Group by favourite and not favourite.", "Group only by where each card was found."], rule_test: "another observer can apply it consistently" };
      explanation = answer;
    } else if (mode === "multiple_valid_sorts") {
      answer = "Both sorts can be useful if each uses a stated observable feature and every card is placed consistently."; prompt = `Two-sort comparison ${i + 1}: one learner sorts by backbone and another by wings. Which conclusion is scientific?`;
      body = { sort_a: "backbone or no backbone", sort_b: "wings shown or no wings shown", choices: [answer, "Only one grouping of living things can ever be correct.", "Any personal opinion is equally scientific."] };
      explanation = `Living things can be grouped in different useful ways; the rule and evidence must be explicit and consistently applied.`;
    } else if (mode === "subjective_group_repair") {
      answer = "Replace ‘good/bad’ or ‘scary/friendly’ with a feature that another observer can check."; prompt = `Respectful-classification repair ${i + 1}: fix a learner's “good animals and bad animals” sort.`;
      body = { choices: [answer, "Keep the labels because opinions are observable features.", "Stop classifying all unfamiliar organisms."], evidence_options: ["number of legs", "backbone evidence", "wings", "shell"] };
      explanation = `${answer} Scientific grouping describes features without blaming or valuing organisms.`;
    } else {
      answer = `The ${organism.features[0]} may help the ${organism.name} in some conditions, but this card alone does not prove why the feature arose.`; prompt = `Feature-and-habitat evidence ${i + 1}: choose the appropriately bounded statement.`;
      body = { organism: organism.name, feature: organism.features[0], choices: [answer, `The ${organism.name} chose to grow this feature because it needed it today.`, "One feature proves the organism can live in every habitat."] };
      explanation = `${answer} Use “may help” for a supported function link and avoid claiming an individual changed by choice.`; tag = "adaptation_need_causes_change";
    }
    return science({ id: `feature-${mode}-${i + 1}`, format: "feature-sort", blueprint: "observable-feature-grouping", band: i < 10 ? "developing" : "expected", concept: mode, prompt, body, answer, explanation, tag, hook: "feature-lens-scan", audioScript: i % 13 === 0 ? prompt : undefined });
  });
}

function followKeyCandidates(count) {
  const modes = ["follow_yes_no_path", "choose_first_question", "path_evidence_check", "do_not_skip_branch", "key_endpoint", "new_orientation_transfer", "key_misconception_repair"];
  return Array.from({ length: count }, (_, i) => {
    const set = keySets[i % keySets.length], target = set.names[i % set.names.length], card = cardFor(target), mode = modes[i % modes.length];
    const path = keyPath(target, set), endpoint = target;
    let prompt = `Branching-key trail ${i + 1}: use each yes/no question and identify the ${target} card.`, answer = endpoint;
    let body = { organism_card: card, key_questions: set.questions, recorded_path: path, choices: rotate(set.names, i), endpoint }, explanation = `Following only answers supported by the card gives ${path.join(" → ")} → ${endpoint}.`, tag = "classification_key_guessing";
    if (mode === "choose_first_question") {
      answer = set.questions[0]; prompt = `Key-entry checkpoint ${i + 1}: which first question begins a clear split for this set?`;
      body = { organism_set: set.names, question_bank: [set.questions[0], "Is it nice?", "Is it quite interesting?"], feature_basis: set.basis };
      explanation = `“${set.questions[0]}” has a checkable yes/no answer and begins separating the shown cards.`;
    } else if (mode === "path_evidence_check") {
      answer = "Check the current question against the card, record yes or no, then follow only that branch."; prompt = `Key-method checkpoint ${i + 1}: what should happen at every branch?`;
      body = { choices: [answer, "Guess the familiar name and jump to its endpoint.", "Follow both branches at once."], organism_card: card };
      explanation = answer;
    } else if (mode === "do_not_skip_branch") {
      answer = `Use all relevant branches; the final name ${target} is justified by the whole recorded path.`; prompt = `Skipped-branch repair ${i + 1}: a learner jumps from the first question straight to “${target}”. What is missing?`;
      body = { expected_path: path, choices: [answer, "Nothing; keys are guessing games.", "A personal preference question."], organism_card: card };
      explanation = answer;
    } else if (mode === "key_endpoint") {
      answer = target; prompt = `Endpoint check ${i + 1}: the answers are ${path.join(", ")}. Which endpoint is reached?`;
      body = { organism_card: card, answer_path: path, choices: rotate(set.names, i + 1) };
      explanation = `That answer sequence reaches ${target}; each decision is supported by the supplied features.`;
    } else if (mode === "new_orientation_transfer") {
      answer = target; prompt = `New-card transfer ${i + 1}: the picture is rotated, but the features are unchanged. Follow the key to identify it.`;
      body = { organism_card: card, orientation_changed: true, key_questions: set.questions, answer_path: path, choices: rotate(set.names, i + 2) };
      explanation = `Image orientation does not change observable classification features, so the endpoint remains ${target}.`; tag = "image_orientation_changes_group";
    } else if (mode === "key_misconception_repair") {
      answer = "Use only evidence visible or stated on the card; if evidence is missing, record ‘not enough evidence’ rather than inventing an answer."; prompt = `Key-evidence repair ${i + 1}: what if a branch asks about a feature the card does not show?`;
      body = { choices: [answer, "Choose yes because it reaches a preferred name.", "Choose no because unknown always means absent."], missing_evidence_allowed: true };
      explanation = answer;
    }
    return science({ id: `follow-key-${mode}-${i + 1}`, format: "classification-key", blueprint: "follow-branching-classification-keys", band: "expected", concept: mode, prompt, body, answer, explanation, tag, hook: "branching-key-path", audioScript: i % 15 === 0 ? prompt : undefined });
  });
}

function buildKeyCandidates(count) {
  const modes = ["choose_clear_question", "split_four_cards", "complete_second_branch", "validate_unique_endpoints", "repair_unclear_question", "alternative_valid_key", "local_key_builder"];
  return Array.from({ length: count }, (_, i) => {
    const set = keySets[i % keySets.length], mode = modes[i % modes.length], first = set.questions[0];
    let prompt = `Question-bank mission ${i + 1}: choose a clear first yes/no question for ${set.names.join(", ")}.`, answer = first, body = { organism_set: set.names, question_bank: [...set.questions, "Is it interesting?", "Is it small?"], expected_first_question: first }, explanation = `“${first}” is observable, yes/no and helps split the shown set.`, tag = "unclear_key_questions";
    if (mode === "split_four_cards") {
      answer = { first_question: first, remaining_questions: set.questions.slice(1), endpoints: set.names }; prompt = `Key studio ${i + 1}: build a complete key for ${set.names.join(", ")}.`;
      body = { organism_cards: set.names.map(cardFor), available_questions: set.questions, endpoint_check: "each card reached exactly once", multiple_valid_keys_accepted: true };
      explanation = `A valid key starts with a useful split, uses observable yes/no questions and leaves one unique card at each endpoint.`;
    } else if (mode === "complete_second_branch") {
      answer = set.questions[1]; prompt = `Branch builder ${i + 1}: after “${first}”, choose the next observable question for the remaining group.`;
      body = { first_question: first, remaining_cards: set.names.slice(1), choices: [answer, "Is it better?", "Does one learner like it?"] };
      explanation = `“${answer}” makes another checkable split without using opinion.`;
    } else if (mode === "validate_unique_endpoints") {
      answer = "Test every card from the first branch and confirm each endpoint identifies exactly one card."; prompt = `Key-validation lab ${i + 1}: how do you check that a finished key works?`;
      body = { choices: [answer, "Test only the easiest card.", "Accept two different cards at every endpoint."], organism_set: set.names };
      explanation = answer;
    } else if (mode === "repair_unclear_question") {
      answer = first; prompt = `Question repair ${i + 1}: replace “Is it quite small?” with a clear question for this set.`;
      body = { unclear_question: "Is it quite small?", choices: [first, "Is it nice?", "Is it a good organism?"], revision_reason: "observable and unambiguous from supplied evidence" };
      explanation = `Size words such as “quite small” need a defined measure; “${first}” is directly checkable on these cards.`;
    } else if (mode === "alternative_valid_key") {
      answer = "More than one key can be valid when every question is observable and every endpoint is unique."; prompt = `Key comparison ${i + 1}: two keys use different first questions but both identify all four cards. Which conclusion fits?`;
      body = { choices: [answer, "Only the key drawn first can be valid.", "Any vague question creates a valid key."], validation_rules: ["observable yes/no questions", "all cards tested", "unique endpoints"] };
      explanation = answer;
    } else if (mode === "local_key_builder") {
      answer = "Use photographs or teacher-prepared cards, record visible features and build the key without collecting or handling organisms."; prompt = `Local-key enquiry ${i + 1}: choose the respectful no-touch method.`;
      body = { choices: [answer, "Pull organisms from nests or shelters for a closer look.", "Taste or touch unknown plants."], local_observation: true };
      explanation = `${answer} This protects organisms and gives a complete visual/text alternative.`; tag = "unsafe_field_handling";
    }
    return science({ id: `build-key-${mode}-${i + 1}`, format: "key-builder", blueprint: "build-simple-identification-keys", band: "secure", concept: mode, prompt, body, answer, explanation, tag, hook: "key-builder-branch-check", audioScript: i % 16 === 0 ? prompt : undefined });
  });
}

function habitatCandidates(count) {
  const modes = ["recognise_environmental_change", "needs_impact_link", "positive_human_impact", "negative_human_impact", "cautious_adaptation_link", "before_after_evidence", "local_enquiry_plan", "fair_habitat_comparison"];
  return Array.from({ length: count }, (_, i) => {
    const item = changes[i % changes.length], mode = modes[i % modes.length];
    let prompt, answer, body, explanation, tag = "habitat_change_all_or_nothing";
    if (mode === "recognise_environmental_change") {
      answer = item.change; prompt = `Habitat evidence map ${i + 1}: identify the changed environmental condition in the before/after record.`;
      body = { habitat: item.habitat, before_after_evidence: item.evidence, choices: [item.change, "the organisms changed names", "nothing in the environment changed"] };
      explanation = `The recorded environmental change is ${item.change}: ${item.evidence}.`;
    } else if (mode === "needs_impact_link") {
      answer = item.effect; prompt = `Needs-and-impact map ${i + 1}: which cautious statement links the change to organism needs?`;
      body = { habitat: item.habitat, environmental_change: item.change, evidence: item.evidence, organism_need: item.need, choices: [item.effect, "Every organism will definitely die immediately.", "Environmental change can never affect living things."] };
      explanation = `${item.effect} This claim is bounded by the shown evidence and names what further observation could help.`;
    } else if (mode === "positive_human_impact" || mode === "negative_human_impact") {
      const wanted = mode.startsWith("positive") ? changes.filter((c) => c.kind === "positive_human") : changes.filter((c) => c.kind === "negative_human"); const selected = wanted[i % wanted.length]; answer = selected.effect;
      prompt = `${mode.startsWith("positive") ? "Habitat-help" : "Impact-review"} mission ${i + 1}: evaluate “${selected.change}” using the evidence.`;
      body = { habitat: selected.habitat, human_action: selected.change, evidence: selected.evidence, organism_need: selected.need, choices: [selected.effect, "All human actions have exactly the same effect.", "No evidence or monitoring is needed."], impact_direction: mode.startsWith("positive") ? "potentially positive" : "potentially negative" };
      explanation = `${selected.effect} Human impacts can be positive or negative and should be evaluated from specific evidence.`; tag = "all_human_change_same";
    } else if (mode === "cautious_adaptation_link") {
      const organism = organisms[i % organisms.length], feature = organism.features[0]; answer = `${feature} may help ${organism.name} meet a need in some habitats; the observation does not show an individual changed because it wanted to.`;
      prompt = `Feature-in-habitat map ${i + 1}: choose the evidence-bounded adaptation statement.`;
      body = { organism: organism.name, observable_feature: feature, choices: [answer, `${organism.name} decided to grow ${feature} today.`, `${feature} proves it is perfectly suited to every environment.`] };
      explanation = answer; tag = "adaptation_need_causes_change";
    } else if (mode === "before_after_evidence") {
      answer = "Record the changed condition and organism counts in the same way before and after, then describe association without claiming proof from one comparison."; prompt = `Longitudinal evidence ${i + 1}: which conclusion routine matches a before/after habitat study?`;
      body = { habitat: item.habitat, change: item.change, choices: [answer, "One sighting proves the change caused every difference.", "Ignore dates, effort and weather."], evidence_map: ["date", "conditions", "fixed observation area", "organism counts", "photograph or sketch"] };
      explanation = answer; tag = "correlation_claimed_as_proof";
    } else if (mode === "local_enquiry_plan") {
      answer = "Observe from the path, use photos or prepared cards, tally without touching, keep a safe distance from nests and water, and leave habitats as found."; prompt = `Local ecology enquiry ${i + 1}: choose the safe, respectful observation plan.`;
      body = { choices: [answer, "Lift every log and leave it overturned.", "Collect unknown plants and taste them.", "Enter water to count organisms."], recording_options: ["tally", "photograph with permission", "field sketch", "adult-scribed notes"] };
      explanation = `${answer} A virtual or teacher-provided dataset is an equally valid no-touch route.`; tag = "unsafe_field_handling";
    } else {
      answer = "Use equal-sized areas, the same observation time and method, repeat samples, and change only the habitat condition being compared where possible."; prompt = `Fair habitat comparison ${i + 1}: which plan compares two local areas fairly?`;
      body = { choices: [answer, "Search one area for ten minutes and the other for one minute.", "Use different counting rules in each area."], controlled_factors: ["area size", "observation time", "method", "time of day where possible"], repetitions: true };
      explanation = `${answer} Weather and other differences should be recorded as possible influences.`; tag = "unfair_habitat_comparison";
    }
    return science({ id: `habitat-${mode}-${i + 1}`, format: "habitat-change-evidence", blueprint: "habitat-change-impact-evidence", band: "secure", concept: mode, prompt, body, answer, explanation, tag, hook: "habitat-before-after-evidence", audioScript: i % 14 === 0 ? prompt : undefined });
  });
}

function retrievalCandidates(count) {
  const modes = ["feature_retrieval", "animal_group_retrieval", "plant_group_retrieval", "key_retrieval", "habitat_change_retrieval", "human_impact_retrieval", "enquiry_retrieval", "misconception_transfer"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length], day = reviewDays[i % reviewDays.length], organism = organisms[i % organisms.length], specimen = plants[i % plants.length], item = changes[i % changes.length];
    let prompt, answer, body, explanation, tag = "classification_key_guessing";
    if (mode === "feature_retrieval") { answer = organism.features[0]; prompt = `Feature return-route ${i + 1}: choose an observable feature shown for ${organism.name}.`; body = { choices: [answer, "friendly", "good"], review_interval_days: day }; explanation = `“${answer}” is observable; value judgements are not classification features.`; tag = "subjective_or_place_based_grouping"; }
    else if (mode === "animal_group_retrieval") { answer = organism.backboneGroup; prompt = `Animal-group return-route ${i + 1}: use the supplied backbone evidence to classify ${organism.name}.`; body = { features: organism.features, choices: ["vertebrate", "invertebrate"], review_interval_days: day }; explanation = `${organism.name} is grouped as a ${organism.backboneGroup} in this evidence set.`; tag = "size_used_for_backbone_group"; }
    else if (mode === "plant_group_retrieval") { answer = specimen.group; prompt = `Plant-group return-route ${i + 1}: use the life-stage feature card for ${specimen.name}.`; body = { features: specimen.features, choices: ["flowering plant", "non-flowering plant"], review_interval_days: day }; explanation = `${specimen.name}: ${specimen.group}, supported by ${specimen.features.join(", ")}.`; tag = "current_flower_visibility_only"; }
    else if (mode === "key_retrieval") { answer = "Answer the current yes/no question from the card, then follow only that branch."; prompt = `Key-method return-route ${i + 1}: recall the reliable branching routine.`; body = { choices: [answer, "Guess the endpoint first.", "Follow yes and no together."], review_interval_days: day }; explanation = answer; }
    else if (mode === "habitat_change_retrieval") { answer = item.effect; prompt = `Habitat return-route ${i + 1}: ${item.change} in the ${item.habitat}. Choose the claim supported by the evidence.`; body = { evidence: item.evidence, need: item.need, choices: [item.effect, "Every living thing is affected identically and immediately.", "No effect is ever possible."], review_interval_days: day }; explanation = item.effect; tag = "habitat_change_all_or_nothing"; }
    else if (mode === "human_impact_retrieval") { answer = "Human changes can have positive or negative effects; identify the action, habitat evidence and organism need before concluding."; prompt = `Human-impact return-route ${i + 1}: choose the balanced evidence rule.`; body = { choices: [answer, "Every human change is harmful.", "Every human change helps all species."], review_interval_days: day }; explanation = answer; tag = "all_human_change_same"; }
    else if (mode === "enquiry_retrieval") { answer = "Use equal observation effort, a no-touch route, repeated records and cautious conclusions."; prompt = `Enquiry return-route ${i + 1}: choose the fair and respectful fieldwork routine.`; body = { choices: [answer, "Handle every organism and compare unequal areas once.", "Disturb shelters to increase the count."], review_interval_days: day }; explanation = answer; tag = "unsafe_field_handling"; }
    else { answer = "Classify from observable evidence, follow every key branch, and use may/might for habitat effects when evidence is limited."; prompt = `Ecology-toolkit transfer ${i + 1}: which routine repairs guessing, opinion groups and all-or-nothing impact claims?`; body = { choices: [answer, "Use favourite groups and certain claims.", "Assume all small animals are insects."], review_interval_days: day }; explanation = answer; tag = "mixed_ecology_misconception"; }
    return science({ id: `retrieval-${mode}-${i + 1}`, format: "evidence-explain", blueprint: "classification-and-habitat-retrieval", band: "retrieval", concept: mode, prompt, body, answer, explanation, tag, hook: "ecology-evidence-return", audioScript: i % 17 === 0 ? prompt : undefined });
  });
}

function science({ id, format, blueprint, band, concept, prompt, body, answer, explanation, tag, hook, audioScript }) {
  const choices = body.choices ? rotate(unique(body.choices), id.length % body.choices.length) : undefined;
  const audio = audioScript ? { audio_required: true, narration_script: audioScript, audio_asset_id: `narration-${prefix}${id}`, audio_provider: "ElevenLabs", audio_asset_status: "required_human_listening_review", human_listening_approval_required: true, browser_tts_allowed: false, browser_tts_fallback: "prohibited", audio_replay_unlimited: true, unavailable_audio_state: "honest_not_ready_keep_text_feature_cards_key_list_and_adult_read_route" } : { audio_required: false, audio_route: "not_needed_text_cards_key_and_evidence_map_are_complete" };
  return {
    id: `${prefix}${id}`, format,
    body: {
      prompt, ...body, ...(choices ? { choices } : {}), ...audio, concept_focus: concept,
      interaction_mode: "sort_follow_key_build_map_compare_plan_tap_keyboard_switch_eye_gaze_aac_or_adult_scribed",
      supported_interaction: "An adult or peer may read, scan, move the learner's named card or record an indicated classification/explanation without supplying the science decision.",
      feature_sort_route: "Organism cards pair concise alt descriptions, labelled feature close-ups and text tables; groups accept selection or numbered placement instead of drag.",
      classification_key_route: "One yes/no branch appears at a time with a persistent evidence card, breadcrumb path and linear numbered-list equivalent.",
      habitat_evidence_map_route: "Before/after conditions, organism needs and possible effects occupy separate labelled columns and can be viewed sequentially.",
      enquiry_planner_route: "QUESTION–OBSERVE–KEEP FAIR–RECORD–CONCLUDE cards support photos, prepared datasets, tallies, pointing, AAC and adult scribing.",
      send_support: { one_feature_or_branch_at_a_time: true, reduced_choice_mode: true, predictable_card_positions: true, text_with_every_image: true, colour_not_required: true, correct_evidence_preserved: true, no_mandatory_touch_speech_or_drawing: true },
      sensory_safe_route: "No sudden sound, flashing, distressing harmed-animal imagery, strong smells or compulsory outdoor/specimen contact; virtual cards and supplied data are complete alternatives.",
      no_touch_route: "Observe from paths or use photographs, line drawings and teacher-prepared datasets; do not collect, taste, handle or disturb organisms, nests, water or shelters.",
      visual_route: "Low-clutter cards, generous spacing, labelled structures and pattern plus text rather than colour-only distinctions.",
      reduced_load_route: "Reveal one feature, key branch or evidence link at a time; hide decorative habitat detail and preserve correct choices.",
      motor_alternative: "Tap, keyboard, switch scan, eye gaze, AAC, pointing or adult-scribed selection replaces dragging, speech, drawing and handwriting.",
      local_enquiry_safety: "Adult-supervised observation from safe access points; follow site rules, avoid roads/deep water/unknown plants, protect nests and shelters, wash hands after optional approved outdoor work.",
      evidence_language: "Use may, might or could for plausible habitat effects unless repeated evidence supports a stronger conclusion; do not claim individuals changed features because they needed to.",
      low_visual_load: true, reduced_motion: "static_cards_instant_branch_highlight_no_distress_animation", preserve_correct_work: true, undo_available: true,
      no_timer: true, speed_score_allowed: false, microphone_required: false, handwriting_required: false, retry_without_penalty: true,
      gamification: { mission: "restore one calm evidence station on the Kind Ecology Trail", reward: "one habitat-map leaf for a respectful classification, key path or evidence link", lives: false, streaks: false, loss_on_error: false, leaderboard: false, speed_bonus: false, retry_message: "Your correct evidence stays. Inspect one feature, branch or habitat clue and continue without penalty." },
      difficulty_band: band, evidence_purpose: concept, variant_blueprint_id: blueprint, review_batch: reviewBatch,
    },
    expected_answer: { value: answer },
    hints: ["Use one observable feature, yes/no branch or recorded environmental change at a time.", "State only what the evidence supports; use may or might for a possible habitat effect."],
    explanation,
    feedback: { correct: `Ecology evidence secured through ${concept.replaceAll("_", " ")}. ${explanation}`, repair: repairFor(tag), science_evidence: explanation, respectful_message: "Organisms are described by observable features and evidence, never as good, bad, scary or useless.", retry: "Keep correct cards and branches, inspect the first unsupported choice, then retry without losing progress." },
    difficulty: band === "developing" ? 3 : band === "expected" ? 5 : band === "secure" ? 7 : 5,
    status: "review", misconception_tag: tag, animation_hook: hook,
  };
}

function validateBank(currentPack, preserved, snapshot, generatedVariants) {
  if (preserved.length !== 5 || JSON.stringify(preserved) !== snapshot) throw new Error("Curated preservation failed.");
  if (generatedVariants.length !== 235 || currentPack.question_variants.length !== 240 || currentPack.practice.variant_targets.pilot !== 240) throw new Error("Pilot must contain 5 curated and 235 generated variants.");
  const ids = currentPack.question_variants.map((v) => v.id); if (new Set(ids).size !== ids.length) throw new Error("Duplicate IDs found.");
  const signatures = new Map(); for (const v of generatedVariants) { const sig = `${v.format}|${v.body.prompt}|${JSON.stringify(v.expected_answer.value)}`; if (signatures.has(sig)) throw new Error(`Duplicate signature ${v.id} matches ${signatures.get(sig)}: ${sig}`); signatures.set(sig, v.id); }
  const counts = countBy(currentPack.question_variants, (v) => v.body.variant_blueprint_id); for (const [id, target] of Object.entries(allocation)) if (counts[id] !== target) throw new Error(`${id}: expected ${target}, found ${counts[id] ?? 0}.`);
  const concepts = new Set(generatedVariants.map((v) => v.body.concept_focus));
  for (const concept of ["vertebrate_invertebrate", "vertebrate_group", "invertebrate_group", "flowering_nonflowering", "observable_rule", "subjective_group_repair", "feature_habitat_link", "follow_yes_no_path", "path_evidence_check", "key_misconception_repair", "choose_clear_question", "split_four_cards", "validate_unique_endpoints", "local_key_builder", "recognise_environmental_change", "needs_impact_link", "positive_human_impact", "negative_human_impact", "cautious_adaptation_link", "before_after_evidence", "local_enquiry_plan", "fair_habitat_comparison"]) if (!concepts.has(concept)) throw new Error(`Missing concept ${concept}.`);
  for (const set of keySets) {
    const fingerprints = set.names.map((name) => keyPath(name, set).map((step) => step.endsWith(" yes") ? "yes" : "no").join("|"));
    if (new Set(fingerprints).size !== set.names.length) throw new Error(`Classification key does not uniquely separate: ${set.names.join(", ")} => ${fingerprints.join(", ")}.`);
  }
  for (const v of generatedVariants) {
    const b = v.body;
    if (!b.send_support?.reduced_choice_mode || !b.feature_sort_route || !b.classification_key_route || !b.habitat_evidence_map_route || !b.enquiry_planner_route || !b.sensory_safe_route || !b.no_touch_route || !b.visual_route || !b.reduced_load_route || !b.motor_alternative || !b.low_visual_load) throw new Error(`Missing SEND/no-touch route in ${v.id}.`);
    if (!b.evidence_language.includes("may") || !v.feedback?.correct || !v.feedback?.repair || !v.feedback?.science_evidence || !v.feedback?.respectful_message) throw new Error(`Missing evidence-rich feedback in ${v.id}.`);
    if (!b.no_timer || b.speed_score_allowed || b.gamification?.lives || b.gamification?.streaks || b.gamification?.loss_on_error || b.gamification?.speed_bonus) throw new Error(`Pressure mechanic in ${v.id}.`);
    if (b.audio_required) { if (b.audio_provider !== "ElevenLabs" || b.audio_asset_status !== "required_human_listening_review" || !b.human_listening_approval_required || b.browser_tts_allowed !== false || b.browser_tts_fallback !== "prohibited") throw new Error(`Audio policy failed in ${v.id}.`); }
    else if (b.audio_asset_id || b.audio_provider) throw new Error(`Unexpected audio reference in ${v.id}.`);
  }
}

function repairFor(tag) { const repairs = {
  subjective_or_place_based_grouping: "Replace opinion or location labels with one observable feature that another observer can apply consistently.",
  all_small_animals_are_insects: "Count legs and antennae and compare the supplied group feature cards; do not use size alone.",
  adaptation_need_causes_change: "Describe the shown feature and say it may help in stated conditions; remove claims about choice or immediate need-caused change.",
  classification_key_guessing: "Return to the current branch, check only its yes/no feature and record a breadcrumb before continuing.",
  image_orientation_changes_group: "Ignore picture rotation and compare the same labelled features.",
  unclear_key_questions: "Replace opinion or vague size words with an observable yes/no feature, then test every endpoint.",
  unsafe_field_handling: "Switch to photographs or observation from a path; leave organisms, nests, plants, logs and water undisturbed.",
  habitat_change_all_or_nothing: "Link one changed condition to one organism need and use may/might rather than predicting the same certain outcome for all.",
  all_human_change_same: "Name the specific action, evidence and organism need before judging a possible positive or negative effect.",
  correlation_claimed_as_proof: "Compare repeated, equally collected before/after or control-site evidence and describe association cautiously.",
  unfair_habitat_comparison: "Match area, observation time and method; repeat and record weather or other possible influences.",
  size_used_for_backbone_group: "Use the supplied backbone evidence, not body size or habitat.",
  current_flower_visibility_only: "Use life-stage evidence such as flowers, fruits, seeds or spores rather than today's visible flower alone.",
  mixed_ecology_misconception: "Return to OBSERVABLE FEATURE–YES/NO PATH–EVIDENCE-BOUNDED CLAIM and repair the first unsupported step.",
}; return repairs[tag] ?? "Return to one observable feature, branch or evidence link and repair only the first unsupported claim."; }

function animal(name, backboneGroup, group, features) { return { name, backboneGroup, group, features, kind: "animal" }; }
function plant(name, group, features) { return { name, group, features, kind: "plant" }; }
function keySet(names, questions, basis) { return { names, questions, basis }; }
function change(habitat, changedCondition, evidence, need, effect, kind) { return { habitat, change: changedCondition, evidence, need, effect, kind }; }
function cardFor(name) { const item = organisms.find((o) => o.name === name) ?? plants.find((p) => p.name === name); return { ...item }; }
function keyPath(target, set) { const card = cardFor(target); return set.questions.map((question) => `${question} ${featureAnswer(card, question) ? "yes" : "no"}`); }
function featureAnswer(card, question) {
  const q = question.toLowerCase(), features = card.features.map((feature) => feature.toLowerCase());
  if (q.includes("backbone")) return card.backboneGroup === "vertebrate";
  if (q.includes("feathers")) return features.some((feature) => feature.includes("feathers") && !feature.includes("no feathers"));
  if (q.includes("six legs")) return features.some((feature) => feature.includes("six legs"));
  if (q.includes("eight legs")) return features.some((feature) => feature.includes("eight legs"));
  if (q.includes("fur")) return features.some((feature) => feature.includes("fur"));
  if (q.includes("shell")) return features.some((feature) => feature.includes("shell") && !feature.startsWith("no shell"));
  if (q.includes("show flowers") || q.includes("produce flowers or fruits")) return card.group === "flowering plant";
  if (q.includes("narrow with parallel veins")) return features.some((feature) => feature.includes("narrow leaves"));
  if (q.includes("fronds")) return features.some((feature) => feature.includes("fronds"));
  if (q.includes("one pair of legs on each")) return card.group === "myriapod";
  if (q.includes("woody trunk")) return features.some((feature) => feature.includes("woody trunk"));
  if (q.includes("woody arching stems")) return features.some((feature) => feature.includes("woody arching stem"));
  throw new Error(`No feature evaluator for question: ${question}`);
}
function rotate(items, n) { const list = [...items], k = list.length ? n % list.length : 0; return list.slice(k).concat(list.slice(0, k)); }
function unique(items) { return [...new Set(items.map((item) => JSON.stringify(item)))].map((item) => JSON.parse(item)); }
function countBy(items, fn) { const out = {}; for (const item of items) { const key = fn(item); out[key] = (out[key] ?? 0) + 1; } return out; }
function summary(items, fn) { return Object.entries(countBy(items, fn)).sort(([a], [b]) => String(a).localeCompare(String(b))).map(([key, value]) => `${key}:${value}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
