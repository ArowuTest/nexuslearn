#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packPath = path.resolve(argValue("--pack") ?? path.join(repoRoot, "packages/content/packs/en-y3-writing-paragraph-grouping.pack.sample.json"));
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "en-y3-paragraph-grouping-bank-";
const reviewBatch = "y3-paragraph-grouping-pilot-a";
const reviewDays = [1, 3, 7, 14, 30];
const allocation = {
  "related-sentence-pairs": 44,
  "theme-label-choices": 44,
  "paragraph-bundle-sorts": 44,
  "odd-sentence-repairs": 44,
  "paragraph-grouping-retrieval": 44,
};

const documents = [
  doc("narrative", "The hidden cave", [
    para("the cave entrance", "The cave entrance looked difficult to enter.", ["A narrow crack opened between two rocks.", "Cold air drifted from the darkness.", "Loose stones covered the ground beside the gap."], ["At first", "Nearby"]),
    para("exploring inside", "Inside, the explorers moved carefully through the cave.", ["Their torch beams swept across the walls.", "Mina stepped around a deep puddle.", "A distant dripping sound echoed ahead."], ["Inside", "As they continued"]),
    para("finding the chamber", "Eventually, the tunnel opened into a wide chamber.", ["Crystal shapes glittered above them.", "The group paused to sketch what they could see.", "They agreed to return with their teacher."], ["Eventually", "There"]),
  ]),
  doc("narrative", "The storm shelter", [
    para("the storm arriving", "Dark clouds gathered as the storm approached.", ["Wind bent the branches towards the ground.", "Rain began to hammer the windows.", "Thunder rolled across the hills."], ["Soon", "Outside"]),
    para("moving to shelter", "The family moved into the safest room.", ["They brought a torch and a radio.", "Everyone stayed away from the windows.", "The dog settled beside the chairs."], ["Quickly", "Inside"]),
    para("the storm passing", "Later, the storm weakened and the sky grew brighter.", ["The rain softened to a gentle patter.", "Birds began calling from the hedge again.", "The family checked the garden from indoors."], ["Later", "Afterwards"]),
  ]),
  doc("instructions", "Planting a bean seed", [
    para("preparing the equipment", "First, gather everything needed for planting.", ["Choose a small pot with drainage holes.", "Collect compost, a bean seed and some water.", "Protect the work surface before beginning."], ["First", "Before planting"]),
    para("planting the seed", "Next, plant the bean seed at a suitable depth.", ["Fill most of the pot with compost.", "Make a small hole and place the seed inside.", "Cover the seed gently with more compost."], ["Next", "Then"]),
    para("caring for the seed", "Finally, care for the planted seed as it begins to grow.", ["Water the compost so it is damp, not flooded.", "Place the pot where it can receive suitable light.", "Check the compost regularly over the next days."], ["Finally", "Over time"]),
  ]),
  doc("instructions", "Making a museum label", [
    para("choosing information", "Begin by choosing the most useful facts for visitors.", ["Record the object's name and age if known.", "Select one fact about how it was used.", "Leave out details that do not help explain the object."], ["Begin", "First"]),
    para("drafting the label", "Next, draft the label in clear sentences.", ["Put related facts together.", "Explain unfamiliar words briefly.", "Keep each sentence focused on the object."], ["Next", "When drafting"]),
    para("checking the label", "At the end, edit the label for clarity.", ["Check names and dates carefully.", "Read the sentences in a sensible order.", "Correct punctuation before displaying it."], ["At the end", "Finally"]),
  ]),
  doc("explanation", "How rain forms", [
    para("water entering the air", "Water enters the air as invisible water vapour.", ["Warmth causes water to evaporate from seas, rivers and wet ground.", "The water vapour rises with warmer air.", "This stage moves water away from Earth's surface."], ["First", "As a result"]),
    para("clouds forming", "Higher in the sky, cooling water vapour forms tiny droplets.", ["The air is cooler at greater heights.", "Tiny droplets gather around small particles.", "Millions of droplets together can form a cloud."], ["Higher up", "When it cools"]),
    para("rain falling", "Rain falls when cloud droplets become large and heavy enough.", ["Small droplets join to make larger drops.", "Gravity pulls the drops towards the ground.", "The water may collect in rivers, soil and seas."], ["Eventually", "Then"]),
  ]),
  doc("explanation", "How a seed grows", [
    para("germination beginning", "Germination begins when a seed has suitable conditions.", ["The seed takes in water.", "Warmth helps the changes inside the seed begin.", "A tiny root starts to grow downwards."], ["At first", "When conditions are suitable"]),
    para("the shoot emerging", "Next, a shoot grows upwards towards the light.", ["The shoot pushes through the soil.", "The first leaves begin to unfold.", "The young plant starts making food in its leaves."], ["Next", "Above the soil"]),
    para("the plant developing", "Over time, the plant grows more roots, leaves and a stronger stem.", ["Roots collect water and minerals from the soil.", "Leaves receive light.", "The stem supports the growing plant."], ["Over time", "As it develops"]),
  ]),
  doc("recount", "A visit to the museum", [
    para("travelling to the museum", "On Tuesday morning, our class travelled to the city museum.", ["We met beside the school gate after registration.", "The coach journey took about thirty minutes.", "Our teacher reminded us of the visit plan."], ["On Tuesday morning", "During the journey"]),
    para("exploring the galleries", "At the museum, we explored two history galleries.", ["A guide showed us tools from a Roman kitchen.", "We sketched patterns from an old mosaic.", "Small labels explained where each object was found."], ["At the museum", "Later"]),
    para("reflecting afterwards", "Back at school, we discussed the most useful evidence from the visit.", ["Groups compared their sketches and notes.", "Several pupils chose an object to research further.", "We added new questions to our history display."], ["Back at school", "Afterwards"]),
  ]),
  doc("recount", "The pond survey", [
    para("preparing for the survey", "Before the survey, we prepared our observation sheets.", ["We checked the safety rules with an adult.", "Each group chose a recording role.", "We packed pencils and identification charts."], ["Before the survey", "First"]),
    para("observing the pond", "At the pond, we recorded plants and animals from the path.", ["We saw pond skaters moving across the surface.", "Reeds grew thickly near one bank.", "We made tally marks without touching wildlife."], ["At the pond", "During the observation"]),
    para("comparing results", "After the survey, the groups compared their records.", ["One group had observed more birds near the trees.", "We discussed how time and weather could affect results.", "The class saved questions for another visit."], ["After the survey", "Finally"]),
  ]),
  doc("information", "River otters", [
    para("otter habitat", "River otters live around clean waterways with suitable shelter.", ["They may rest in holes among roots or riverbanks.", "Vegetation can provide cover near the water.", "Their habitat needs access to both water and land."], ["In their habitat", "Nearby"]),
    para("otter food", "Otters feed on animals found in and around the water.", ["Fish can form part of their diet.", "They may also eat frogs or small water animals.", "Food availability can vary between places and seasons."], ["For food", "Depending on the habitat"]),
    para("otter adaptations", "Several body features help otters move and hunt in water.", ["Their streamlined shape helps them swim.", "Webbed feet can push against the water.", "Thick fur helps protect their bodies in cold water."], ["In the water", "These features"]),
  ]),
  doc("information", "Volcanoes", [
    para("where volcanoes form", "Many volcanoes form near the edges of large pieces of Earth's crust.", ["These pieces are called tectonic plates.", "Movement at some plate edges allows melted rock to rise.", "Not every plate edge has the same type of volcano."], ["In many places", "At some edges"]),
    para("what happens during an eruption", "During an eruption, material escapes through openings in the volcano.", ["Melted rock at the surface is called lava.", "Ash and gases may also be released.", "Eruptions can differ greatly in strength and length."], ["During an eruption", "At the surface"]),
    para("how scientists observe volcanoes", "Scientists collect different kinds of evidence to monitor volcanoes.", ["They measure small movements in the ground.", "They observe gases and changes in temperature.", "Several pieces of evidence are compared before conclusions are made."], ["To monitor them", "By comparing evidence"]),
  ]),
];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "en-y3-writing-paragraph-grouping") throw new Error("This generator only supports the Year 3 paragraph-grouping pack.");
const curated = (pack.question_variants ?? []).filter((v) => !v.id.startsWith(prefix));
const curatedSnapshot = JSON.stringify(curated);
const curatedBlueprint = new Map([
  ["en-y3-writing-paragraph-grouping-q-same-idea", "related-sentence-pairs"],
  ["en-y3-writing-paragraph-grouping-q-theme-label", "theme-label-choices"],
  ["en-y3-writing-paragraph-grouping-q-odd-sentence", "odd-sentence-repairs"],
]);
const curatedCounts = countBy(curated, (v) => v.body?.variant_blueprint_id ?? curatedBlueprint.get(v.id));
const targets = Object.fromEntries(Object.entries(allocation).map(([id, total]) => [id, total - (curatedCounts[id] ?? 0)]));
for (const [id, count] of Object.entries(targets)) if (count < 0) throw new Error(`Curated variants exceed allocation for ${id}.`);

const generated = [
  ...relatedCandidates(targets["related-sentence-pairs"]),
  ...themeCandidates(targets["theme-label-choices"]),
  ...bundleCandidates(targets["paragraph-bundle-sorts"]),
  ...repairCandidates(targets["odd-sentence-repairs"]),
  ...retrievalCandidates(targets["paragraph-grouping-retrieval"]),
];
pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Review-stage Year 3 paragraph-grouping pack with a deterministic 220-variant pilot bank. Three curated variants are unchanged. Generated tasks cover grouping related ideas, paragraph focus and purpose, broad topic sentences, supporting-detail order, genuine focus/time/place/speaker shifts, split/merge editing, basic cohesion and sequence, planning, drafting and editing across narrative, instructions, explanation, recount and information writing, misconception repair and spaced transfer. Every generated task includes sentence-card, paragraph-builder, boundary-editor or planning-map interactions, dyslexia/SEND chunking, visual and alternative-input routes, rich corrective feedback and pressure-free publishing missions without timers, streaks, lives or loss. Selected passage narration references ElevenLabs assets held for human listening review; browser TTS is prohibited. Independent English, accessibility, narration and renderer review remains required before promotion.";

validateBank(pack, curated, curatedSnapshot, generated, curatedBlueprint);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y3-paragraph-grouping-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y3-paragraph-grouping-bank blueprints=${summary(pack.question_variants, (v) => v.body?.variant_blueprint_id ?? curatedBlueprint.get(v.id))}`);
console.log(`y3-paragraph-grouping-bank formats=${summary(pack.question_variants, (v) => v.format)}`);
console.log(`y3-paragraph-grouping-bank genres=${summary(generated, (v) => v.body.genre)}`);
console.log(`y3-paragraph-grouping-bank concepts=${summary(generated, (v) => v.body.concept_focus)}`);
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y3-paragraph-grouping-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 3 paragraph-grouping bank is out of date; run generate-y3-paragraph-grouping-bank.mjs --write.");
  console.log("y3-paragraph-grouping-bank deterministic check passed");
} else console.log("y3-paragraph-grouping-bank dry-run; pass --write to update the pack");

function relatedCandidates(count) {
  const modes = ["related_pair", "same_focus_evidence", "different_focus", "supporting_detail", "surface_word_trap", "time_place_shift"];
  return Array.from({ length: count }, (_, i) => {
    const document = documents[i % documents.length], mode = modes[i % modes.length], p = document.paragraphs[i % 3], other = document.paragraphs[(i + 1) % 3];
    if (mode === "different_focus" || mode === "time_place_shift") {
      const answer = `Start a new paragraph because the writing shifts from “${p.focus}” to “${other.focus}”.`;
      return writing({ id: `${mode}-${slug(document.title)}-${i + 1}`, format: "sentence-sort", blueprint: "related-sentence-pairs", band: "developing", concept: mode, genre: document.genre,
        prompt: `Focus-shift mission ${i + 1}: should these sentences share a paragraph?`, body: { document_title: document.title, sentence_cards: [p.details[0], other.details[0]], focus_labels: [p.focus, other.focus], choices: [answer, "Keep them together because both sentences are similar lengths.", "Split after every sentence."], boundary_reason: mode === "time_place_shift" ? "focus/time/place shift" : "focus shift" }, answer,
        hints: ["Name what each sentence is mostly about.", "A genuine focus, time or place change can justify a new paragraph."], explanation: answer, correct: "Paragraph decision justified by a genuine focus shift.", repair: "Place one focus label above each card; if the labels differ meaningfully, show a boundary between them.", tag: "paragraph_by_length_or_every_sentence", hook: "focus-shift-boundary" });
    }
    if (mode === "surface_word_trap") {
      const trap = other.details.find((x) => x.split(" ").some((w) => p.details.join(" ").includes(w))) ?? other.details[1];
      const answer = p.details[1];
      return writing({ id: `surface-trap-${slug(document.title)}-${i + 1}`, format: "sentence-sort", blueprint: "related-sentence-pairs", band: "expected", concept: mode, genre: document.genre,
        prompt: `Meaning-not-matching-words mission ${i + 1}: which card belongs with “${p.topic}”?`, body: { document_title: document.title, anchor_sentence: p.topic, choices: [answer, trap, other.topic], paragraph_focus: p.focus, shared_word_warning: true }, answer,
        hints: ["A repeated word does not guarantee the same paragraph focus.", `Choose the sentence that supports “${p.focus}”.`], explanation: `“${answer}” develops ${p.focus}. The other cards shift to ${other.focus} or merely share surface vocabulary.`, correct: "Related sentence chosen by meaning, not repeated words.", repair: "Hide repeated-word highlighting and complete “This sentence adds information about…” for each option.", tag: "theme_by_surface", hook: "meaning-not-surface" });
    }
    const answer = p.details[1];
    return writing({ id: `${mode}-${slug(document.title)}-${i + 1}`, format: "sentence-sort", blueprint: "related-sentence-pairs", band: "intro", concept: mode, genre: document.genre,
      prompt: `Sentence-card mission ${i + 1}: which detail belongs with the paragraph focus “${p.focus}”?`, body: { document_title: document.title, anchor_sentence: p.topic, choices: rotate([answer, other.details[0], other.topic], i % 3), paragraph_focus: p.focus, relation_check: "adds_relevant_information" }, answer,
      hints: ["Say the paragraph focus in a short phrase.", "Choose a card that adds information about that same focus."], explanation: `“${answer}” supports ${p.focus}, so it belongs with “${p.topic}”.`, correct: "Supporting sentence matched to paragraph focus.", repair: "Keep the focus label visible, reduce to two cards and finish the sentence “This tells me more about…”.", tag: "unrelated_same_paragraph", hook: "idea-card-match", audioScript: i % 4 === 0 ? `${p.topic} ${answer}` : undefined });
  });
}

function themeCandidates(count) {
  const modes = ["focus_label", "broad_topic_sentence", "purpose_choice", "too_narrow_label", "too_broad_label", "topic_sentence_repair"];
  return Array.from({ length: count }, (_, i) => {
    const document = documents[i % documents.length], p = document.paragraphs[i % 3], other = document.paragraphs[(i + 1) % 3], mode = modes[i % modes.length];
    if (mode === "broad_topic_sentence" || mode === "topic_sentence_repair") {
      const answer = p.topic;
      return writing({ id: `${mode}-${slug(document.title)}-${i + 1}`, format: "theme-choice", blueprint: "theme-label-choices", band: "developing", concept: mode, genre: document.genre,
        prompt: `Topic-sentence mission ${i + 1}: choose the sentence broad enough to introduce all three supporting details.`, body: { document_title: document.title, details: p.details, choices: [answer, p.details[0], other.topic], paragraph_focus: p.focus, broad_enough_check: true }, answer,
        hints: ["A topic sentence introduces the whole paragraph focus.", "A single small detail is usually too narrow."], explanation: `“${answer}” introduces ${p.focus} broadly enough for all supporting details.`, correct: "Broad topic sentence matched to the complete paragraph.", repair: "Place all details under each candidate; reject any candidate that covers only one detail or a different focus.", tag: "topic_sentence_is_one_small_detail", hook: "topic-sentence-umbrella" });
    }
    if (mode === "purpose_choice") {
      const purpose = purposeFor(document.genre, p.focus);
      return writing({ id: `purpose-${slug(document.title)}-${i + 1}`, format: "theme-choice", blueprint: "theme-label-choices", band: "expected", concept: mode, genre: document.genre,
        prompt: `Paragraph-purpose mission ${i + 1}: what is this paragraph mainly doing?`, body: { document_title: document.title, paragraph: [p.topic, ...p.details], choices: [purpose, purposeFor(document.genre, other.focus), "changing topic after every sentence"], focus: p.focus }, answer: purpose,
        hints: ["Ask what the paragraph helps the reader understand or follow.", "Use the genre and the shared focus."], explanation: `The paragraph groups details about ${p.focus}; its purpose is ${purpose}.`, correct: "Paragraph purpose identified from genre and focus.", repair: "Choose a genre purpose stem—describe, explain, recount, instruct or inform—then attach the focus label.", tag: "purpose_based_on_one_sentence", hook: "paragraph-purpose-tag" });
    }
    const answer = p.focus;
    const distractor = mode === "too_narrow_label" ? specificDetailLabel(p.details[0]) : mode === "too_broad_label" ? `${document.genre} writing` : other.focus;
    return writing({ id: `${mode}-${slug(document.title)}-${i + 1}`, format: "theme-choice", blueprint: "theme-label-choices", band: mode === "focus_label" ? "intro" : "developing", concept: mode, genre: document.genre,
      prompt: `Theme-ribbon mission ${i + 1}: choose the best focus label for this sentence cluster.`, body: { document_title: document.title, sentence_cluster: [p.topic, ...p.details], choices: [answer, distractor, other.focus], label_check: "covers_all_sentences_without_being_vague" }, answer,
      hints: ["The label should cover every sentence.", "Avoid a label that is one tiny detail or so broad it says little."], explanation: `“${answer}” covers the whole cluster. The alternatives are too narrow, too broad or about ${other.focus}.`, correct: "Paragraph focus label is broad, specific and evidence-based.", repair: "Point to each sentence while testing the label; keep it only if every sentence fits naturally.", tag: "theme_by_surface", hook: "theme-ribbon-tie" });
  });
}

function bundleCandidates(count) {
  const modes = ["two_bundle_sort", "three_bundle_sort", "support_order", "paragraph_build", "plan_to_draft", "cohesion_sequence"];
  return Array.from({ length: count }, (_, i) => {
    const document = documents[i % documents.length], mode = modes[i % modes.length], a = document.paragraphs[i % 3], b = document.paragraphs[(i + 1) % 3], c = document.paragraphs[(i + 2) % 3];
    if (mode === "support_order" || mode === "cohesion_sequence") {
      const answer = orderedParagraph(document.genre, a);
      return writing({ id: `${mode}-${slug(document.title)}-${i + 1}`, format: "paragraph-build", blueprint: "paragraph-bundle-sorts", band: "expected", concept: mode, genre: document.genre,
        prompt: `Paragraph-order mission ${i + 1}: arrange the topic sentence and details into a clear paragraph.`, body: { document_title: document.title, cards: rotate(answer, i % answer.length), paragraph_focus: a.focus, cohesion_options: a.cohesion, ordering_reason: orderingReason(document.genre) }, answer,
        hints: ["Usually establish the paragraph focus before supporting details.", orderingHint(document.genre)], explanation: `${answer.join(" ")} The order supports ${a.focus} using ${orderingReason(document.genre)}.`, correct: "Topic sentence and supporting details ordered coherently.", repair: "Keep the topic sentence first, group details by time, cause or logical closeness and add one suitable linking phrase.", tag: "order_by_sentence_length", hook: "paragraph-order-strip" });
    }
    if (mode === "plan_to_draft") {
      const answer = [a.topic, ...a.details];
      return writing({ id: `plan-draft-${slug(document.title)}-${i + 1}`, format: "paragraph-build", blueprint: "paragraph-bundle-sorts", band: "secure", concept: mode, genre: document.genre,
        prompt: `Plan-to-draft mission ${i + 1}: use the focus and note cards to build one paragraph draft.`, body: { document_title: document.title, planning_map: { focus: a.focus, notes: a.details }, topic_sentence_choices: [a.topic, a.details[0], b.topic], builder_slots: ["topic sentence", "support", "support", "support"], oral_draft_accepted: true }, answer,
        hints: ["Turn the broad focus into a topic sentence.", "Expand each relevant note once; do not add a new focus."], explanation: `The plan for ${a.focus} becomes a topic sentence followed by related supporting details.`, correct: "Planning notes expanded into one focused paragraph draft.", repair: "Keep the plan visible beside the draft; tick each used note and move any new-focus sentence to a later paragraph plan.", tag: "plan_notes_mixed_across_focuses", hook: "plan-to-draft-builder" });
    }
    const groups = mode === "three_bundle_sort" ? [a, b, c] : [a, b];
    const cards = groups.flatMap((p) => [p.topic, p.details[0], p.details[1]]);
    const answer = Object.fromEntries(groups.map((p) => [p.focus, [p.topic, p.details[0], p.details[1]]]));
    return writing({ id: `${mode}-${slug(document.title)}-${i + 1}`, format: "paragraph-build", blueprint: "paragraph-bundle-sorts", band: mode === "two_bundle_sort" ? "developing" : "expected", concept: mode, genre: document.genre,
      prompt: `Publishing-desk mission ${i + 1}: sort the mixed cards into ${groups.length} focused paragraph bundles.`, body: { document_title: document.title, sentence_cards: rotate(cards, i % cards.length), paragraph_zones: groups.map((p) => p.focus), expected_groups: answer, planning_map_available: true }, answer,
      hints: ["Label each paragraph focus before moving cards.", "Every sentence in a bundle should develop the same focus."], explanation: groups.map((p) => `${p.focus}: ${[p.topic, p.details[0], p.details[1]].join(" ")}`).join(" | "), correct: `${groups.length} paragraph bundles organised by related ideas.`, repair: "Show one focus zone at a time, place its broad topic sentence, then test each remaining detail against that label.", tag: "unrelated_same_paragraph", hook: "paragraph-bundle-sort", audioScript: i % 5 === 0 ? cards.join(" ") : undefined });
  });
}

function repairCandidates(count) {
  const modes = ["odd_sentence", "split_focus_shift", "split_time_place_shift", "merge_related_draft", "speaker_shift", "boundary_misconception", "edit_explanation"];
  return Array.from({ length: count }, (_, i) => {
    const document = documents[i % documents.length], mode = modes[i % modes.length], a = document.paragraphs[i % 3], b = document.paragraphs[(i + 1) % 3];
    if (mode === "odd_sentence") {
      const odd = b.details[1];
      return writing({ id: `odd-${slug(document.title)}-${i + 1}`, format: "sentence-sort", blueprint: "odd-sentence-repairs", band: "secure", concept: mode, genre: document.genre,
        prompt: `Revision-basket mission ${i + 1}: which sentence changes the paragraph focus?`, body: { document_title: document.title, paragraph_focus: a.focus, sentence_cards: [a.topic, a.details[0], odd, a.details[2]], choices: [odd, a.details[0], a.details[2]] }, answer: odd,
        hints: [`Keep the focus “${a.focus}” in mind.`, "The odd sentence may be well written but belongs elsewhere."], explanation: `“${odd}” develops ${b.focus}, not ${a.focus}; it should move to another paragraph rather than be deleted automatically.`, correct: "Off-focus sentence identified and routed to a more suitable paragraph.", repair: "Read the focus label before every card and move only the card that answers a different focus question.", tag: "unrelated_same_paragraph", hook: "odd-sentence-revision-basket" });
    }
    if (mode === "merge_related_draft") {
      const answer = "Merge the sentences into one paragraph because they all develop the same focus.";
      return writing({ id: `merge-${slug(document.title)}-${i + 1}`, format: "sentence-sort", blueprint: "odd-sentence-repairs", band: "secure", concept: mode, genre: document.genre,
        prompt: `Over-split draft mission ${i + 1}: four related sentences were each put on a new line. What edit improves grouping?`, body: { draft_lines: [a.topic, ...a.details], focus: a.focus, choices: [answer, "Keep four paragraphs because every sentence needs a break.", "Merge with a different-focus paragraph too."], merge_preview: [a.topic, ...a.details] }, answer,
        hints: ["A paragraph can contain several related sentences.", "Check whether the focus changes between lines."], explanation: `All four sentences develop ${a.focus}, so one paragraph is clearer than a paragraph after every sentence.`, correct: "Over-split related sentences merged into one paragraph.", repair: "Tie every line to the same focus label, then remove boundaries that have no focus, time, place or speaker shift.", tag: "paragraph_after_every_sentence", hook: "merge-related-lines" });
    }
    if (mode === "speaker_shift") {
      const cards = ["‘We should follow the river,’ said Mei.", "She pointed towards the valley.", "‘The hill path looks safer,’ replied Arun.", "He unfolded the map again."];
      const answer = 2;
      return writing({ id: `speaker-${i + 1}`, format: "sentence-sort", blueprint: "odd-sentence-repairs", band: "secure", concept: mode, genre: "narrative",
        prompt: `Dialogue-boundary mission ${i + 1}: before which card should a new paragraph begin because the speaker changes?`, body: { sentence_cards: cards, boundary_positions: [1, 2, 3], speaker_labels: ["Mei", "Mei action", "Arun", "Arun action"], new_speaker_new_paragraph: true }, answer,
        hints: ["Track who is speaking.", "A new speaker normally begins a new paragraph in dialogue."], explanation: `A new paragraph begins before card 3 (boundary position ${answer}) because the speaker changes from Mei to Arun.`, correct: "Dialogue boundary placed at a genuine speaker shift.", repair: "Label each speech card with its speaker, attach nearby action to that speaker and place a boundary when the label changes.", tag: "speaker_change_ignored", hook: "dialogue-speaker-boundary" });
    }
    if (mode === "boundary_misconception") {
      const answer = "Start a new paragraph for a meaningful focus, time, place or speaker shift—not because a sentence is long or a page line ends.";
      return writing({ id: `boundary-rule-${slug(document.title)}-${i + 1}`, format: "sentence-sort", blueprint: "odd-sentence-repairs", band: "secure", concept: mode, genre: document.genre,
        prompt: `Boundary-rule mission ${i + 1}: which editing rule is reliable?`, body: { choices: [answer, "Start a new paragraph after every sentence.", "Start a new paragraph whenever a sentence is long."], example_focuses: [a.focus, b.focus] }, answer,
        hints: ["Paragraphs organise meaning.", "Layout and sentence length alone do not create a new focus."], explanation: answer, correct: "Reliable paragraph-boundary rule selected.", repair: "Cross out length and line-ending rules; highlight only focus, time, place and speaker evidence.", tag: "order_by_sentence_length", hook: "boundary-rule-check" });
    }
    const answer = 4;
    const combined = [a.topic, ...a.details, b.topic, ...b.details];
    return writing({ id: `${mode}-${slug(document.title)}-${i + 1}`, format: "sentence-sort", blueprint: "odd-sentence-repairs", band: "secure", concept: mode, genre: document.genre,
      prompt: `Boundary-editor mission ${i + 1}: place one paragraph break where the draft shifts from “${a.focus}” to “${b.focus}”.`, body: { document_title: document.title, sentence_cards: combined, boundary_positions: [2, 3, 4, 5, 6], focus_before: a.focus, focus_after: b.focus, shift_type: mode === "split_time_place_shift" ? "time/place and focus" : "focus" }, answer,
      hints: ["Find the first sentence that starts the new focus.", `Keep all details about ${a.focus} together first.`], explanation: `The break goes before “${b.topic}”, at boundary position ${answer}, because the paragraph focus shifts to ${b.focus}.`, correct: "Draft split at the first sentence of a genuine new focus.", repair: "Colour-free bracket each focus using labels, then place the boundary between the two brackets.", tag: "unrelated_same_paragraph", hook: "boundary-editor" });
  });
}

function retrievalCandidates(count) {
  const modes = ["planning_map", "plan_draft", "draft_edit", "cohesion_edit", "sequence_transfer", "genre_transfer", "focus_retrieval", "boundary_transfer"];
  return Array.from({ length: count }, (_, i) => {
    const document = documents[i % documents.length], p = document.paragraphs[i % 3], next = document.paragraphs[(i + 1) % 3], mode = modes[i % modes.length], day = reviewDays[i % reviewDays.length];
    if (mode === "planning_map") {
      const answer = { focus: p.focus, notes: p.details };
      return writing({ id: `plan-${slug(document.title)}-${i + 1}`, format: "theme-choice", blueprint: "paragraph-grouping-retrieval", band: "retrieval", concept: mode, genre: document.genre,
        prompt: `Planning-map mission ${i + 1}: after ${day} days, choose the focus and notes for one paragraph.`, body: { document_title: document.title, possible_focuses: [p.focus, next.focus, document.title], note_cards: rotate([...p.details, next.details[0]], i % 4), planning_map_slots: ["focus", "detail", "detail", "detail"], review_interval_days: day }, answer,
        hints: ["Choose one manageable paragraph focus.", "Keep notes that develop that focus; save another focus for a new box."], explanation: `Focus: ${p.focus}. Supporting notes: ${p.details.join("; ")}.`, correct: "Planning map groups related notes before drafting.", repair: "Fill the focus box first, then ask “does this note tell me more about that focus?” for each card.", tag: "plan_notes_mixed_across_focuses", hook: "planning-map" });
    }
    if (mode === "plan_draft" || mode === "draft_edit") {
      const answer = [p.topic, ...p.details];
      return writing({ id: `${mode}-${slug(document.title)}-${i + 1}`, format: "theme-choice", blueprint: "paragraph-grouping-retrieval", band: "retrieval", concept: mode, genre: document.genre,
        prompt: `Drafting-desk mission ${i + 1}: choose the paragraph draft that follows the plan for “${p.focus}”.`, body: { planning_map: { focus: p.focus, notes: p.details }, draft_choices: [answer, [p.topic, p.details[0], next.details[0]], [p.details[0]]], edit_checklist: ["one focus", "broad topic sentence", "related details", "sensible order"], review_interval_days: day }, answer,
        hints: ["Match every draft sentence to the plan focus.", "The draft should develop, not merely repeat, the topic sentence."], explanation: `The complete draft keeps one focus, introduces ${p.focus} and develops it with all three planned details.`, correct: "Plan, draft and edit stages connected.", repair: "Place the plan beside each draft, tick matching details and move any new-focus sentence to a separate plan box.", tag: "draft_ignores_plan_focus", hook: "drafting-desk" });
    }
    if (mode === "cohesion_edit") {
      const linker = p.cohesion[0], answer = `${linker}, ${lowerFirst(p.details[0])}`;
      return writing({ id: `cohesion-${slug(document.title)}-${i + 1}`, format: "theme-choice", blueprint: "paragraph-grouping-retrieval", band: "retrieval", concept: mode, genre: document.genre,
        prompt: `Cohesion-tool mission ${i + 1}: choose a simple linking phrase that makes the relationship clear without changing focus.`, body: { paragraph_focus: p.focus, previous_sentence: p.topic, next_sentence: p.details[0], choices: [answer, `In a completely different topic, ${lowerFirst(p.details[0])}`, next.details[0]], cohesion_purpose: document.genre === "instructions" || document.genre === "recount" ? "sequence" : "connection_or_location", review_interval_days: day }, answer,
        hints: ["A cohesive phrase should clarify time, place or connection.", "It must not pretend the paragraph has changed focus."], explanation: `“${linker}” links the supporting detail to ${p.focus} and suits this ${document.genre} paragraph.`, correct: "Basic cohesion improved while preserving paragraph focus.", repair: "Choose from only time, place or connection linkers and test whether the relationship is genuinely present.", tag: "random_linker_added", hook: "cohesion-tool" });
    }
    if (mode === "genre_transfer") {
      const purpose = purposeFor(document.genre, p.focus), answer = `${document.genre}: ${purpose}`;
      return writing({ id: `genre-${slug(document.title)}-${i + 1}`, format: "theme-choice", blueprint: "paragraph-grouping-retrieval", band: "retrieval", concept: mode, genre: document.genre,
        prompt: `Genre-transfer mission ${i + 1}: which genre-and-purpose label matches this paragraph plan?`, body: { title: document.title, focus: p.focus, notes: p.details, choices: [answer, `instructions: describe an unrelated setting`, `narrative: list equipment without sequence`], review_interval_days: day }, answer,
        hints: ["Use the title, focus and kind of details.", "Paragraph grouping works across genres, but purposes and ordering differ."], explanation: `This is ${document.genre} writing; the paragraph purpose is ${purpose}.`, correct: "Paragraph focus transferred with genre-aware purpose.", repair: "Match the notes to one genre verb—narrate, instruct, explain, recount or inform—then restate the focus.", tag: "same_paragraph_pattern_for_every_genre", hook: "genre-transfer" });
    }
    if (mode === "boundary_transfer") {
      const answer = `Begin a new paragraph before “${next.topic}” because the focus changes from ${p.focus} to ${next.focus}.`;
      return writing({ id: `boundary-transfer-${slug(document.title)}-${i + 1}`, format: "theme-choice", blueprint: "paragraph-grouping-retrieval", band: "retrieval", concept: mode, genre: document.genre,
        prompt: `Editing-return mission ${i + 1}: where should this two-focus draft split?`, body: { draft: [p.topic, p.details[0], p.details[1], next.topic, next.details[0]], choices: [answer, "After every sentence.", "No break, because all sentences share the same title."], review_interval_days: day }, answer,
        hints: ["A title can contain several paragraph focuses.", "Find the first sentence that introduces the new focus."], explanation: answer, correct: "Boundary rule transferred to a fresh genre and draft.", repair: "Label each sentence with one of the two focus cards and place the break where labels first change.", tag: "whole_piece_one_paragraph", hook: "editing-return" });
    }
    if (mode === "sequence_transfer") {
      const answer = orderedParagraph(document.genre, p);
      return writing({ id: `sequence-${slug(document.title)}-${i + 1}`, format: "theme-choice", blueprint: "paragraph-grouping-retrieval", band: "retrieval", concept: mode, genre: document.genre,
        prompt: `Sequence-return mission ${i + 1}: order the paragraph so the reader can follow its ${orderingReason(document.genre)}.`, body: { cards: rotate(answer, i % answer.length), focus: p.focus, review_interval_days: day }, answer,
        hints: ["Keep the topic sentence and focus visible.", orderingHint(document.genre)], explanation: `${answer.join(" ")} This order supports ${orderingReason(document.genre)}.`, correct: "Supporting details sequenced for the genre and focus.", repair: "Keep the topic sentence first, number time/cause/step details and compare only adjacent cards.", tag: "order_by_sentence_length", hook: "sequence-return" });
    }
    const answer = p.focus;
    return writing({ id: `focus-${slug(document.title)}-${i + 1}`, format: "theme-choice", blueprint: "paragraph-grouping-retrieval", band: "retrieval", concept: mode, genre: document.genre,
      prompt: `Focus-recall mission ${i + 1}: after ${day} days, choose the focus covering every sentence in this cluster.`, body: { sentence_cluster: [p.topic, ...p.details], choices: [p.focus, next.focus, document.title], review_interval_days: day }, answer,
      hints: ["Choose a label broad enough for every sentence but narrower than the whole title.", "Test each sentence against the focus."], explanation: `“${p.focus}” covers the topic sentence and all supporting details.`, correct: "Paragraph focus retrieved and checked against the full cluster.", repair: "Highlight what each sentence adds, then choose the shared idea repeated across all four notes.", tag: "theme_by_surface", hook: "focus-recall", audioScript: i % 4 === 0 ? [p.topic, ...p.details].join(" ") : undefined });
  });
}

function writing({ id, format, blueprint, band, concept, genre, prompt, body, answer, hints, explanation, correct, repair, tag, hook, audioScript }) {
  const audio = audioScript ? { audio_required: true, narration_script: audioScript, audio_asset_id: `narration-${prefix}${id}`, audio_provider: "ElevenLabs", audio_asset_status: "required_human_listening_review", human_listening_approval_required: true, browser_tts_allowed: false, browser_tts_fallback: "prohibited", audio_replay_unlimited: true, unavailable_audio_state: "honest_not_ready_keep_sentence_cards_text_and_adult_read_route" } : { audio_required: false, audio_route: "not_needed_for_this_visual_sort_builder_editor_or_plan" };
  const sequence = Array.isArray(answer);
  return {
    id: `${prefix}${id}`, format,
    body: {
      prompt, ...body, ...audio, genre, concept_focus: concept,
      interaction_mode: "sort_build_select_boundary_tap_keyboard_switch_eye_gaze_aac_or_adult_scribed",
      supported_interaction: "An adult or peer may read cards, scan options, move the learner's named sentence or record an indicated explanation without deciding the paragraph structure.",
      sentence_card_sort_route: "One sentence per large numbered card with phrase-level replay and named paragraph zones.",
      paragraph_builder_route: "Focus label, topic-sentence slot and supporting-detail slots remain visible; correct cards are preserved.",
      boundary_editor_route: "Numbered spaces between sentences accept a tap, keyboard command, switch selection, eye gaze or pointing response.",
      planning_map_route: "One focus box and three short note boxes can be completed with text, symbols, oral dictation or adult scribing.",
      dyslexia_support: { one_sentence_per_card: true, sentence_chunking: true, line_focus: true, adjustable_spacing_and_font: true, phrase_level_replay: true, colour_not_required: true, writing_mechanics_not_scored_during_grouping: true },
      visual_route: "Low-clutter notebook view, persistent focus labels, generous spacing and no meaning carried by colour alone.",
      processing_route: "Reveal one group or boundary decision at a time, allow unlimited rereading, reduce choices and preserve correct placements.",
      motor_alternative: "Tap, keyboard, switch scan, eye gaze, AAC, pointing or adult-scribed card placement can replace dragging, speech and handwriting.",
      low_visual_load: true, reduced_motion: "static_snap_states_and_instant_boundary_marks", preserve_correct_work: true, undo_available: true,
      no_timer: true, speed_score_allowed: false, microphone_required: false, handwriting_required: false, spelling_accuracy_scored: false, retry_without_penalty: true,
      gamification: { mission: "prepare a calm explorer-journal page for publishing", reward: "one publishing seal for a clear focus, boundary or sequence", lives: false, streaks: false, loss_on_error: false, leaderboard: false, speed_bonus: false, retry_message: "Your well-placed sentences stay. Choose another focus clue or edit and continue." },
      difficulty_band: band, evidence_purpose: concept, variant_blueprint_id: blueprint, review_batch: reviewBatch,
    },
    expected_answer: sequence ? { sequence: answer } : { value: answer }, hints, explanation,
    feedback: { correct, repair, writing_evidence: explanation, support_message: "Sorting, pointing, boundary selection, eye gaze, AAC, oral drafting and adult-scribed plans carry equal evidence; speed, spelling and handwriting are not scored here." },
    difficulty: band === "intro" ? 3 : band === "developing" ? 4 : band === "expected" ? 5 : band === "secure" ? 6 : 5,
    status: "review", misconception_tag: tag, animation_hook: hook,
  };
}

function validateBank(currentPack, curated, snapshot, generated, curatedBlueprint) {
  if (curated.length !== 3) throw new Error(`Expected 3 curated variants, found ${curated.length}.`);
  if (JSON.stringify(curated) !== snapshot) throw new Error("Curated variants changed during generation.");
  if (currentPack.question_variants.length !== 220 || generated.length !== 217) throw new Error("Pilot must contain 3 curated and 217 generated variants.");
  const ids = currentPack.question_variants.map((v) => v.id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate variant IDs found.");
  const counts = countBy(currentPack.question_variants, (v) => v.body?.variant_blueprint_id ?? curatedBlueprint.get(v.id));
  for (const [id, total] of Object.entries(allocation)) if (counts[id] !== total) throw new Error(`${id} expected ${total}, found ${counts[id] ?? 0}.`);
  const concepts = new Set(generated.map((v) => v.body.concept_focus));
  for (const c of ["related_pair", "same_focus_evidence", "different_focus", "time_place_shift", "focus_label", "broad_topic_sentence", "purpose_choice", "two_bundle_sort", "three_bundle_sort", "support_order", "plan_to_draft", "cohesion_sequence", "odd_sentence", "split_focus_shift", "split_time_place_shift", "merge_related_draft", "speaker_shift", "boundary_misconception", "planning_map", "plan_draft", "draft_edit", "cohesion_edit", "sequence_transfer", "genre_transfer", "boundary_transfer"]) if (!concepts.has(c)) throw new Error(`Missing concept ${c}.`);
  for (const genre of ["narrative", "instructions", "explanation", "recount", "information"]) if (!generated.some((v) => v.body.genre === genre)) throw new Error(`Missing genre ${genre}.`);
  for (const v of generated) {
    const b = v.body;
    if (!b.dyslexia_support?.one_sentence_per_card || !b.sentence_card_sort_route || !b.paragraph_builder_route || !b.boundary_editor_route || !b.planning_map_route || !b.motor_alternative || !b.low_visual_load) throw new Error(`Missing SEND/dyslexia route in ${v.id}.`);
    if (!v.feedback?.correct || !v.feedback?.repair || !v.feedback?.writing_evidence) throw new Error(`Missing rich feedback in ${v.id}.`);
    if (!b.no_timer || b.speed_score_allowed || b.gamification?.lives || b.gamification?.streaks || b.gamification?.loss_on_error) throw new Error(`Pressure mechanic in ${v.id}.`);
    if (b.audio_required) {
      if (b.audio_provider !== "ElevenLabs" || b.audio_asset_status !== "required_human_listening_review" || !b.human_listening_approval_required || b.browser_tts_allowed !== false || b.browser_tts_fallback !== "prohibited") throw new Error(`Audio policy failure in ${v.id}.`);
    } else if (b.audio_asset_id || b.audio_provider) throw new Error(`Unnecessary audio reference in ${v.id}.`);
  }
}

function doc(genre, title, paragraphs) { return { genre, title, paragraphs }; }
function para(focus, topic, details, cohesion) { return { focus, topic, details, cohesion }; }
function purposeFor(genre, focus) { return ({ narrative: `develop the story by describing ${focus}`, instructions: `guide the reader through ${focus}`, explanation: `explain how or why ${focus}`, recount: `recount what happened during ${focus}`, information: `inform the reader about ${focus}` })[genre]; }
function orderingReason(genre) { return ({ narrative: "story sequence and focus", instructions: "step sequence", explanation: "cause-and-process sequence", recount: "time sequence", information: "logical grouping" })[genre]; }
function orderingHint(genre) { return ({ narrative: "Order events and description so the scene or action develops clearly.", instructions: "Put actions in the order the reader must carry them out.", explanation: "Move from cause or earlier stage to result or later stage.", recount: "Use the order in which events happened.", information: "Place closely related facts together in a logical order." })[genre]; }
function orderedParagraph(genre, p) { return [p.topic, ...p.details]; }
function specificDetailLabel(sentence) { return sentence.replace(/[.?!]$/, "").toLowerCase(); }
function lowerFirst(text) { return text[0].toLowerCase() + text.slice(1); }
function rotate(items, n) { const a = [...items], k = a.length ? n % a.length : 0; return a.slice(k).concat(a.slice(0, k)); }
function slug(text) { return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function countBy(items, fn) { const out = {}; for (const item of items) { const key = fn(item); out[key] = (out[key] ?? 0) + 1; } return out; }
function summary(items, fn) { return Object.entries(countBy(items, fn)).sort(([a], [b]) => String(a).localeCompare(String(b))).map(([k, v]) => `${k}:${v}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
