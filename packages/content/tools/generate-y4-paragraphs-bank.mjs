#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/en-y4-paragraphs.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "en-y4-paragraphs-bank-";
const reviewBatch = "y4-paragraphs-depth-pilot-a";
const pilotAllocation = {
  "one-idea-sentence-sorts": 48,
  "topic-sentence-signposts": 48,
  "paragraph-break-focus-shifts": 48,
  "linking-language-bridges": 48,
  "paragraph-organisation-retrieval": 48,
};

const cases = [
  paragraphCase("rainforest", "information report", "how rainforest animals use different parts of the forest", "Rainforest animals are suited to different layers of their forest home.", ["Bright frogs shelter among damp leaves on the forest floor.", "Sloths move slowly through branches high in the canopy.", "Toucans reach fruit with their long bills.", "Jaguars travel quietly beneath dense plants."], "The bus stopped outside the museum.", "Toucans have long bills.", "A museum visit can be exciting.", "forest-floor animals", "canopy and tree animals", "These examples show how rainforest habitats provide different food and shelter.", ["The forest has several layers.", "For example, sloths and toucans use the trees.", "Other animals search for food near the ground.", "Together, the layers create many habitats."], ["Sloths use the high branches.", "Toucans also feed in the canopy.", "addition", "Also"]),
  paragraphCase("vegetables", "instructions", "how to sow and care for vegetable seeds", "Growing vegetables begins with careful preparation and regular care.", ["First, loosen the soil with a small fork.", "Next, sow the seeds in shallow rows.", "Water the rows gently so the seeds stay in place.", "Later, thin crowded shoots to give them space."], "The goalkeeper dived to save the shot.", "Carrot seeds are tiny.", "Football teams need a goalkeeper.", "preparing and sowing", "watering and later care", "Following the steps in order gives each seed a good start.", ["Loosen the soil.", "Sow the seeds in rows.", "Water the planted rows.", "Thin the shoots after they appear."], ["The seeds had just been sown.", "They needed gentle watering.", "cause", "Therefore"]),
  paragraphCase("storm-sea", "narrative", "a boat facing a sudden storm at sea", "The calm voyage changed as a dangerous storm gathered around the boat.", ["Dark clouds folded over the horizon.", "A sharp wind pulled at the sail.", "Waves crashed across the bow.", "The small boat rocked beneath the crew."], "At lunchtime, I chose a cheese sandwich.", "The sail pulled tight.", "Sunny beaches are relaxing.", "the approaching storm", "the boat and crew in the rough sea", "Every new detail makes the journey feel more dangerous.", ["The horizon darkened.", "The wind strengthened.", "Waves began to strike the boat.", "The crew secured the sail."], ["The sea had been calm at dawn.", "By midday, waves were crashing over the bow.", "contrast", "However"]),
  paragraphCase("cave", "narrative", "moving from a cave setting to Maya entering it", "The cave entrance felt cold, narrow and uncertain.", ["The entrance narrowed between wet rocks.", "Drops of water tapped in the darkness.", "Maya lifted her torch.", "She took one careful step inside."], "A bright kite crossed the playing field.", "Drops of water tapped on the rocks.", "Kites need steady wind.", "the cave setting", "Maya's actions", "The paragraph shift lets the reader move from seeing the place to following Maya.", ["The entrance was narrow.", "The rocks felt cold and damp.", "Maya switched on her torch.", "She entered the cave."], ["The cave was almost dark.", "Because of this, Maya raised her torch.", "cause", "Because of this"]),
  paragraphCase("bees", "explanation", "how bees share work in a colony", "A bee colony depends on different bees carrying out connected jobs.", ["Worker bees collect nectar and pollen.", "Some workers care for young bees inside the hive.", "The queen lays eggs for the colony.", "Bees fan their wings to help control the hive's temperature."], "The Moon travels around Earth.", "Worker bees collect nectar.", "Spacecraft need careful designs.", "jobs outside the hive", "jobs inside the hive", "These linked roles help the colony survive.", ["Worker bees search for food.", "They carry nectar and pollen home.", "Other workers care for the hive.", "The colony benefits from the shared work."], ["Workers collect food outside.", "Meanwhile, other bees care for the hive.", "simultaneous", "Meanwhile"]),
  paragraphCase("museum", "recount", "a class visit to a local museum", "Our museum visit combined close observation with practical activities.", ["First, a guide showed us the Roman gallery.", "We sketched a patterned pot in our notebooks.", "After lunch, we handled replica objects.", "Finally, we shared our favourite discoveries."], "A striker scored in the final minute.", "We sketched one pot.", "Football matches can change quickly.", "the morning gallery visit", "the afternoon activities", "The visit helped us notice how objects reveal information about the past.", ["We arrived and met the guide.", "We explored the Roman gallery.", "After lunch, we handled replicas.", "Before leaving, we shared discoveries."], ["We finished our gallery sketches.", "After lunch, we handled replica objects.", "time", "After lunch"]),
  paragraphCase("ada", "biography", "Ada Lovelace's interest in mathematics and computing ideas", "Ada Lovelace used her strong interest in mathematics to explore new ideas about calculating machines.", ["As a child, Ada studied mathematics carefully.", "Later, she worked with Charles Babbage's plans for an Analytical Engine.", "Her notes described how a machine might follow a sequence of instructions.", "Today, her work is remembered in the history of computing."], "A blue whale can be longer than a bus.", "Ada wrote detailed notes.", "Ocean animals need clean habitats.", "Ada's early learning", "her later work and legacy", "Her ideas connected mathematical thinking with the possibilities of machines.", ["Ada developed a strong interest in mathematics.", "She studied Babbage's machine plans.", "She wrote about sequences of instructions.", "Her work later became important to computing history."], ["Ada studied mathematics when she was young.", "Later, she explored ideas for calculating machines.", "time", "Later"]),
  paragraphCase("council", "persuasive letter", "why the school should improve recycling", "Our school can reduce waste by making recycling clearer and easier.", ["More labelled bins would help pupils sort materials correctly.", "Posters could remind everyone which items can be recycled.", "A class rota could check that bins are used properly.", "These changes would reduce the amount sent to general waste."], "Dinosaurs lived millions of years ago.", "We need more bins.", "Fossils teach us about ancient life.", "the current recycling problem", "practical solutions and benefits", "A simple shared plan would make a lasting difference.", ["Explain the waste problem.", "Propose clearly labelled bins.", "Add reminders and a checking rota.", "End with the expected benefit."], ["The current bins are confusing.", "Therefore, clearer labels would help pupils sort waste.", "cause", "Therefore"]),
  paragraphCase("lost-dog", "narrative", "the search for a lost dog and its safe return", "When the garden gate swung open, the search for Patch began at once.", ["The empty lead lay beside the open gate.", "We followed muddy paw prints towards the park.", "A bark sounded behind the old bandstand.", "Patch bounded out and pushed his nose into my hand."], "Volcanoes can release hot rock and ash.", "The lead was red.", "Volcanic eruptions reshape land.", "discovering Patch is missing", "finding Patch in the park", "The final action changes the search from worry to relief.", ["We noticed the open gate.", "We followed the paw prints.", "We heard a bark near the bandstand.", "We found Patch safely."], ["We could not see Patch near the gate.", "Then a bark came from the bandstand.", "time", "Then"]),
  paragraphCase("weather", "explanation", "how a school weather station records conditions", "A school weather station uses several instruments to build a daily record.", ["A thermometer measures air temperature.", "A rain gauge collects and measures rainfall.", "A wind vane shows wind direction.", "The readings are entered in a weather log at set times."], "The cake baked for thirty minutes.", "The rain gauge is made of plastic.", "Baking changes ingredients into a cake.", "the measuring instruments", "recording and using the readings", "Together, the measurements help the class compare weather over time.", ["Check each instrument at the agreed time.", "Read its scale carefully.", "Record every result in the log.", "Compare the entry with earlier days."], ["Each instrument measures one condition.", "Also, every reading is stored in the same log.", "addition", "Also"]),
  paragraphCase("garden-diary", "diary", "protecting seedlings during a frosty day", "Today's frost meant the young seedlings needed extra care.", ["In the morning, ice silvered the edge of each tray.", "I checked the leaves for damage.", "Before sunset, I covered the seedlings with fleece.", "By afternoon, the sheltered plants had lifted their leaves."], "The train arrived beside platform four.", "The frost looked white.", "Railway stations use clear signs.", "the frosty morning", "protecting the plants and seeing recovery", "The day ended with the seedlings safer from another cold night.", ["I noticed frost on the trays.", "I checked the seedlings.", "I added a protective cover.", "Later, the leaves began to recover."], ["The forecast warned of another cold night.", "For this reason, I covered the seedlings.", "cause", "For this reason"]),
  paragraphCase("library-event", "formal letter", "inviting families to a library story event", "Our library is holding a family story event to celebrate reading together.", ["The event will begin at six o'clock on Friday.", "A storyteller will read two adventure tales.", "Families can join a short illustration workshop.", "Please reserve a free place at the library desk."], "Coral reefs support many sea creatures.", "The event starts at six.", "Oceans cover most of Earth's surface.", "the event time and purpose", "activities and booking information", "We hope many families will join the evening.", ["State the purpose of the event.", "Give the date and start time.", "Describe the planned activities.", "Explain how to reserve a place."], ["The storyteller will read first.", "Afterwards, families can join the workshop.", "time", "Afterwards"]),
];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "en-y4-paragraphs") throw new Error("This generator only supports the Year 4 paragraphs pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedAllocation = countBy(curated, curatedBlueprint);
const targets = Object.fromEntries(Object.entries(pilotAllocation).map(([id, total]) => [id, total - (curatedAllocation[id] ?? 0)]));
for (const [blueprint, count] of Object.entries(targets)) if (count < 0) throw new Error(`Curated variants exceed ${blueprint}.`);

const candidates = [
  ...sortCandidates(targets["one-idea-sentence-sorts"]),
  ...topicCandidates(targets["topic-sentence-signposts"]),
  ...breakCandidates(targets["paragraph-break-focus-shifts"]),
  ...linkCandidates(targets["linking-language-bridges"]),
  ...retrievalCandidates(targets["paragraph-organisation-retrieval"]),
];

pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.adaptive_support.audio_first = "Optional sentence and paragraph playback uses only ElevenLabs assets after human listening approval. Browser TTS is prohibited; visible text, sentence cards, line focus and adult or partner reading routes remain complete when audio is unavailable.";
pack.qa.notes = "Review-stage Year 4 paragraphs pack with a deterministic 240-item pilot bank and five preserved curated variants. The bank covers paragraph purpose, topic sentences, grouping related ideas, planned sequencing, cohesion, splitting and merging, meaning-preserving editing and misconception repair across narrative, reports, explanations, instructions, recounts, biography, letters and diary writing. Generated candidates include SEND and dyslexia scaffolds, optional human-reviewed ElevenLabs references with browser TTS prohibited, supported interactions, rich feedback and untimed publishing missions. Independent English, teacher, accessibility, safeguarding, audio and renderer review remain required before promotion.";
validateBank(pack, curated, candidates);

console.log(`y4-paragraphs-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`y4-paragraphs-bank blueprints=${allocationSummary(curated, candidates)}`);
console.log(`y4-paragraphs-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y4-paragraphs-bank bands=${summary(candidates, (variant) => variant.body.difficulty_band)}`);
console.log(`y4-paragraphs-bank strands=${summary(candidates, (variant) => variant.body.paragraph_strand)}`);

const nextText = `${JSON.stringify(pack, null, 2)}\n`;
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y4-paragraphs-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 4 paragraphs bank is out of date; run generate-y4-paragraphs-bank.mjs --write.");
  console.log("y4-paragraphs-bank deterministic check passed");
} else {
  console.log("y4-paragraphs-bank dry-run; pass --write to update the pack");
}

function sortCandidates(count) {
  const variants = [];
  for (const item of cases) {
    const relatedGroup = item.details.slice(0, 3).join(" ");
    variants.push(candidate({ id: `belongs-${item.id}`, format: "paragraph-sort", blueprint: "one-idea-sentence-sorts", strand: "related_ideas", stage: "select_related_sentence", item, prompt: `For a ${item.genre} paragraph about ${item.theme}, which sentence belongs?`, answer: item.details[0], choices: [item.details[0], item.rogue, item.unrelatedTopic, "The paragraph changes to a completely different event."], hints: ["Name the paragraph's one main idea.", "Test each sentence against that theme."], explanation: `'${item.details[0]}' directly develops ${item.theme}; the other choices move to another topic.`, purpose: "theme_sentence_match", misconception: "unrelated_ideas_same_paragraph" }));
    variants.push(candidate({ id: `rogue-${item.id}`, format: "paragraph-sort", blueprint: "one-idea-sentence-sorts", strand: "misconceptions", stage: "remove_rogue_sentence", item, prompt: `Which sentence should leave this ${item.genre} paragraph about ${item.theme}?`, answer: item.rogue, choices: [item.rogue, ...item.details.slice(0, 3)], hints: ["Three choices develop the named theme.", "Move the sentence that starts a different topic."], explanation: `'${item.rogue}' does not develop ${item.theme}, so it belongs elsewhere or should be removed.`, purpose: "rogue_sentence_identification", misconception: "unrelated_ideas_same_paragraph" }));
    variants.push(candidate({ id: `group-${item.id}`, format: "paragraph-sort", blueprint: "one-idea-sentence-sorts", strand: "related_ideas", stage: "choose_coherent_sentence_group", item, prompt: `Which group forms one coherent paragraph section about ${item.theme}?`, answer: relatedGroup, choices: [relatedGroup, `${item.details[0]} ${item.rogue} ${item.details[1]}`, `${item.rogue} ${item.unrelatedTopic}`, `${item.details[2]} ${item.rogue}`], hints: ["Every sentence in the group needs a shared focus.", "Reject a group with even one topic jump."], explanation: "The selected group keeps all three sentences on the same theme and can be developed as one paragraph. ", purpose: "related_sentence_grouping", misconception: "unrelated_ideas_same_paragraph" }));
    variants.push(candidate({ id: `purpose-${item.id}`, format: "paragraph-sort", blueprint: "one-idea-sentence-sorts", strand: "paragraph_purpose", stage: "explain_paragraph_purpose", item, prompt: `What is the main organising purpose of this ${item.genre} paragraph?`, answer: `To group connected sentences about ${item.theme}`, choices: [`To group connected sentences about ${item.theme}`, "To start a new paragraph after every full stop", "To make every paragraph the same length", "To collect unrelated facts in one block"], hints: ["Paragraphing organises meaning, not page shape alone.", "Use the shared idea named in the details."], explanation: `The paragraph's purpose is to guide the reader through connected information about ${item.theme}.`, purpose: "paragraph_purpose_reasoning", misconception: "paragraph_length_rule" }));
  }
  return variants.slice(0, count);
}

function topicCandidates(count) {
  const variants = [];
  for (const item of cases) {
    variants.push(candidate({ id: `topic-${item.id}`, format: "topic-sentence-choice", blueprint: "topic-sentence-signposts", strand: "topic_sentences", stage: "choose_broad_topic_sentence", item, prompt: `Which topic sentence introduces all four ${item.genre} details about ${item.theme}?`, answer: item.topic, choices: [item.topic, item.narrowTopic, item.unrelatedTopic, item.details[0]], hints: ["Read every detail before choosing.", "The topic sentence must be broad enough for all the details."], explanation: `'${item.topic}' introduces the complete theme rather than only one detail or an unrelated subject.`, purpose: "whole_paragraph_topic_sentence", misconception: "topic_sentence_too_narrow" }));
    variants.push(candidate({ id: `narrow-${item.id}`, format: "topic-sentence-choice", blueprint: "topic-sentence-signposts", strand: "misconceptions", stage: "reject_narrow_topic_sentence", item, prompt: `Why is '${item.narrowTopic}' too narrow as the topic sentence for this paragraph?`, answer: "It matches only one detail instead of introducing the whole paragraph", choices: ["It matches only one detail instead of introducing the whole paragraph", "It is too short to be a sentence", "Every topic sentence must be a question", "It includes a noun"], hints: ["Count how many details the sentence can introduce.", "A topic sentence acts as a signpost for the whole paragraph."], explanation: `The narrow choice covers only one fact, while the paragraph develops ${item.theme} more broadly.`, purpose: "narrow_topic_sentence_repair", misconception: "topic_sentence_too_narrow" }));
    variants.push(candidate({ id: `topic-purpose-${item.id}`, format: "topic-sentence-choice", blueprint: "topic-sentence-signposts", strand: "paragraph_purpose", stage: "match_topic_to_genre_purpose", item, prompt: `Which opening best fits the purpose of this ${item.genre}?`, answer: item.topic, choices: [item.topic, item.unrelatedTopic, "This paragraph contains four sentences.", "Everything is interesting in some way."], hints: [`Think about what a ${item.genre} needs to tell the reader.`, "Choose an opening that names the paragraph focus."], explanation: `'${item.topic}' fits the genre and clearly establishes ${item.theme} as the paragraph focus.`, purpose: "genre_topic_purpose_match", misconception: "topic_sentence_unrelated" }));
    variants.push(candidate({ id: `topic-edit-${item.id}`, format: "topic-sentence-choice", blueprint: "topic-sentence-signposts", strand: "editing", stage: "edit_topic_sentence", item, prompt: `An editor replaces '${item.narrowTopic}' with which sentence to cover every supporting detail?`, answer: item.topic, choices: [item.topic, item.narrowTopic, item.rogue, item.unrelatedTopic], hints: ["Keep the existing details in view.", "Choose the smallest edit that broadens the focus accurately."], explanation: `Replacing the narrow opening with '${item.topic}' creates a signpost that covers all the supporting details.`, purpose: "topic_sentence_edit", misconception: "topic_sentence_too_narrow" }));
  }
  return variants.slice(0, count);
}

function breakCandidates(count) {
  const variants = [];
  for (const item of cases) {
    const text = item.details.join(" ");
    const breakAnswer = `Place the break after sentence 2, where the focus changes from ${item.focusOne} to ${item.focusTwo}`;
    const sequenceAnswer = item.sequence.join(" → ");
    variants.push(candidate({ id: `break-${item.id}`, format: "paragraph-break-edit", blueprint: "paragraph-break-focus-shifts", strand: "splitting_merging", stage: "split_at_focus_change", item, prompt: `Where should this ${item.genre} draft split into two focused paragraphs?`, displayText: text, answer: breakAnswer, choices: [breakAnswer, "Place a break after every sentence", "Place the break halfway through sentence 1", "Use no break even though the focus changes"], hints: [`Sentences 1–2 focus on ${item.focusOne}.`, `Sentences 3–4 focus on ${item.focusTwo}.`], explanation: `The break after sentence 2 separates ${item.focusOne} from ${item.focusTwo}, helping the reader notice the planned shift.`, purpose: "focus_shift_paragraph_break", misconception: "paragraph_after_every_sentence" }));
    variants.push(candidate({ id: `merge-${item.id}`, format: "paragraph-break-edit", blueprint: "paragraph-break-focus-shifts", strand: "splitting_merging", stage: "merge_related_single_sentence_paragraphs", item, prompt: `Two one-sentence paragraphs both develop ${item.focusOne}. Which edit improves the draft?`, answer: "Merge them because they share one focus, unless a deliberate emphasis is needed", choices: ["Merge them because they share one focus, unless a deliberate emphasis is needed", "Keep every sentence as a separate paragraph", "Delete one sentence without reading it", `Move one sentence into the ${item.focusTwo} section even if it does not fit`], hints: ["Check whether the focus changes between the sentences.", "Paragraph length alone does not decide a break."], explanation: `Sentences on ${item.focusOne} can form one developed paragraph; merging avoids unnecessary choppiness without hiding a focus change.`, purpose: "related_paragraph_merge", misconception: "paragraph_after_every_sentence" }));
    variants.push(candidate({ id: `sequence-${item.id}`, format: "paragraph-break-edit", blueprint: "paragraph-break-focus-shifts", strand: "sequencing", stage: "order_paragraph_events_or_ideas", item, prompt: `For this planned ${item.genre} structure, which sequence is coherent?`, answer: sequenceAnswer, choices: [sequenceAnswer, [...item.sequence].reverse().join(" → "), `${item.sequence[2]} → ${item.rogue} → ${item.sequence[0]} → ${item.sequence[1]}`, `${item.sequence[1]} → ${item.sequence[3]} → ${item.sequence[0]} → ${item.sequence[2]}`], hints: ["Use chronology or logical dependency for this planned structure.", "Keep the topic introduction or first necessary step before later detail."], explanation: `The selected order preserves the intended progression of the ${item.genre} and keeps each stage connected.`, purpose: "paragraph_sequence_order", misconception: "sequence_words_without_logic" }));
    variants.push(candidate({ id: `split-edit-${item.id}`, format: "paragraph-break-edit", blueprint: "paragraph-break-focus-shifts", strand: "editing", stage: "edit_split_and_merge_decisions", item, prompt: `Which editing rule best improves paragraph boundaries in this draft about ${item.theme}?`, answer: "Merge sentences that share a focus and split when the focus, time, place or speaker genuinely changes", choices: ["Merge sentences that share a focus and split when the focus, time, place or speaker genuinely changes", "Insert a break after every sentence", "Use one paragraph for the entire text", "Split only when a page line ends"], hints: ["Base boundaries on meaning.", "Check focus, time, place and speaker changes."], explanation: "Good paragraph editing balances grouping and separation: connected ideas stay together, while genuine shifts receive a clear boundary.", purpose: "paragraph_boundary_editing_rule", misconception: "paragraph_length_rule" }));
  }
  return variants.slice(0, count);
}

function linkCandidates(count) {
  const variants = [];
  for (const item of cases) {
    const [first, second, relation, linker] = item.link;
    variants.push(candidate({ id: `link-${item.id}`, format: "linking-word-choice", blueprint: "linking-language-bridges", strand: "cohesion", stage: "choose_logical_link", item, prompt: `Choose the link that accurately signals ${relation}: '${first}' ___ '${second}'`, answer: linker, choices: [linker, ...["However", "Meanwhile", "Therefore", "Later", "Also", "For example"].filter((choice) => choice !== linker).slice(0, 3)], hints: ["Name the relationship before choosing.", "Reread both sentences with the link."], explanation: `'${linker}' accurately signals ${relation}; the other choices would invent a different relationship.`, purpose: "logical_link_choice", misconception: "linker_without_logic" }));
    variants.push(candidate({ id: `link-sequence-${item.id}`, format: "linking-word-choice", blueprint: "linking-language-bridges", strand: "sequencing", stage: "choose_sequence_signpost", item, prompt: `Which signpost helps the reader follow this planned order: ${item.sequence[0]} → ${item.sequence[1]}?`, answer: item.genre === "instructions" ? "Next" : "Then", choices: [item.genre === "instructions" ? "Next" : "Then", "However", "For this reason", "In contrast"], hints: ["The second event follows the first.", "Use a time or order signpost, not contrast or cause unless the plan shows it."], explanation: `The sequence signpost shows progression from the first planned stage to the next without changing the logic.`, purpose: "sequence_link_choice", misconception: "sequence_words_without_logic" }));
    variants.push(candidate({ id: `cohesion-${item.id}`, format: "linking-word-choice", blueprint: "linking-language-bridges", strand: "cohesion", stage: "maintain_topic_chain", item, prompt: `Which sentence keeps a clear topic chain after '${item.topic}'?`, answer: item.details[0], choices: [item.details[0], item.rogue, item.unrelatedTopic, "It did that thing over there."], hints: ["Keep the paragraph theme recoverable.", "Reject a vague reference or topic jump."], explanation: `'${item.details[0]}' develops the topic introduced by the signpost and keeps the paragraph cohesive.`, purpose: "topic_chain_cohesion", misconception: "vague_link_or_reference" }));
    variants.push(candidate({ id: `link-effect-${item.id}`, format: "linking-word-choice", blueprint: "linking-language-bridges", strand: "editing", stage: "edit_link_for_meaning", item, prompt: `In the ${item.genre} paragraph about ${item.theme}, an editor inserts '${linker}' between two sentences. What should the editor verify?`, answer: `That the link really expresses ${relation} and does not change the intended meaning`, choices: [`That the link really expresses ${relation} and does not change the intended meaning`, "That the link is the longest available word", "That every sentence has a different link", "That the paragraph becomes exactly four lines"], hints: ["Links describe relationships; they are not decoration.", "Compare the meaning before and after the edit."], explanation: `A cohesive link earns its place only when it accurately expresses ${relation} and preserves the paragraph's meaning.`, purpose: "meaning_preserving_link_edit", misconception: "linker_without_logic" }));
  }
  return variants.slice(0, count);
}

function retrievalCandidates(count) {
  const variants = [];
  for (const item of cases) {
    variants.push(candidate({ id: `review-sort-${item.id}`, format: "paragraph-sort", blueprint: "paragraph-organisation-retrieval", strand: "related_ideas", stage: "spaced_theme_match", item, prompt: `Publishing warm-up (${item.genre}): which sentence stays on ${item.theme}?`, answer: item.details[1], choices: [item.details[1], item.rogue, item.unrelatedTopic, "A completely separate idea begins."], hints: ["Name the theme in a few words.", "Choose the sentence that develops it."], explanation: `'${item.details[1]}' belongs because it adds information about ${item.theme}.`, purpose: "spaced_theme_match", misconception: "unrelated_ideas_same_paragraph", retrieval: true }));
    variants.push(candidate({ id: `review-topic-${item.id}`, format: "paragraph-sort", blueprint: "paragraph-organisation-retrieval", strand: "topic_sentences", stage: "spaced_topic_check", item, prompt: `Publishing warm-up: which opening covers all details in the ${item.id} file?`, answer: item.topic, choices: [item.topic, item.narrowTopic, item.rogue, item.unrelatedTopic], hints: ["Check every supporting detail.", "Reject an opening that covers only one sentence."], explanation: `'${item.topic}' is broad enough to introduce the whole planned paragraph.`, purpose: "spaced_topic_sentence", misconception: "topic_sentence_too_narrow", retrieval: true }));
    variants.push(candidate({ id: `review-break-${item.id}`, format: "paragraph-sort", blueprint: "paragraph-organisation-retrieval", strand: "splitting_merging", stage: "spaced_break_decision", item, prompt: `Publishing warm-up: the focus moves from ${item.focusOne} to ${item.focusTwo}. What should the writer do?`, answer: "Start a new paragraph at the focus change", choices: ["Start a new paragraph at the focus change", "Start a new paragraph after every sentence", "Hide the focus change in one long block", "Delete both sections"], hints: ["Paragraph boundaries help signal a new focus.", "Do not split merely because one sentence ended."], explanation: `A new paragraph clearly marks the move from ${item.focusOne} to ${item.focusTwo}.`, purpose: "spaced_focus_break", misconception: "paragraph_after_every_sentence", retrieval: true }));
    variants.push(candidate({ id: `review-edit-${item.id}`, format: "paragraph-sort", blueprint: "paragraph-organisation-retrieval", strand: "editing", stage: "spaced_paragraph_edit", item, prompt: `Publishing warm-up: which edit preserves meaning and improves the ${item.genre} paragraph about ${item.theme}?`, answer: "Keep related details together, remove the rogue sentence and retain the planned order", choices: ["Keep related details together, remove the rogue sentence and retain the planned order", "Reorder every sentence randomly", "Add a new paragraph after every full stop", "Replace the topic sentence with an unrelated fact"], hints: ["Check theme, grouping and sequence.", "Make the smallest changes that improve reader guidance."], explanation: "The selected edit strengthens organisation while preserving the paragraph's intended information, order and genre purpose.", purpose: "spaced_integrated_edit", misconception: "editing_changes_meaning", retrieval: true }));
  }
  return variants.slice(0, count);
}

function candidate({ id, format, blueprint, strand, stage, item, prompt, displayText = null, answer, choices, hints, explanation, purpose, misconception, retrieval = false }) {
  const fullId = `${prefix}${id}`;
  const band = bandFor(blueprint, stage);
  return {
    id: fullId,
    format,
    body: {
      prompt,
      ...(displayText ? { display_text: displayText } : {}),
      choices: rotate(unique(choices), fullId.length % choices.length),
      genre: item.genre,
      theme: item.theme,
      paragraph_strand: strand,
      coverage_tags: coverageFor(strand, stage),
      conceptual_progression: stage,
      difficulty_band: band,
      evidence_purpose: purpose,
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
      response_mode: "tap_keyboard_switch_move_buttons_typed_oral_or_partner_recorded",
      interaction_support: { keyboard: true, switch_scan: true, touch: true, move_up_down_buttons: true, typed: true, oral_or_partner_recording: true, drag_required: false, undo_available: true },
      send_scaffolds: { one_decision_per_screen: true, sentence_cards: true, persistent_theme_label: true, paragraph_boundary_preview: true, reduced_choice_mode: true, no_time_limit: true },
      dyslexia_support: { increased_spacing: true, adjustable_line_length: true, tinted_background_option: true, readable_font_option: true, line_focus: true, chunked_paragraph_view: true },
      scaffold_routes: { visual: "labelled idea islands, topic signposts and static paragraph boundaries", text: "numbered sentence list, theme table and before-and-after draft", oral: "optional adult or partner reading and oral explanation", concrete: "printed sentence strips grouped under theme cards" },
      reduced_visual_load: true,
      reduced_motion_alternative: "instant card placement and static before-and-after paragraph panels",
      audio_optional: true,
      audio_asset_id: `narration-${fullId}`,
      audio_provider: "ElevenLabs",
      audio_asset_status: "required_human_listening_review",
      human_listening_approval_required: true,
      browser_tts_allowed: false,
      publishing_mission: missionFor(item, strand, stage, fullId),
      pressure_rules: { timer: false, speed_score: false, streak_loss: false, lives: false, public_ranking: false, retry_cost: false },
      review_interval_days: retrieval ? [1, 3, 7, 14, 30][fullId.length % 5] : undefined,
    },
    expected_answer: { value: answer },
    hints,
    explanation,
    feedback: { correct: `Page structure approved: ${purpose.replaceAll("_", " ")}.`, repair: repairFor(strand, stage), reader_check: "Name the paragraph focus, test every sentence against it and explain where the reader needs a boundary or link.", edit_check: "Compare the draft before and after; preserve information, sequence and genre purpose.", retry: "The publishing desk keeps every useful sentence. Revise one organisation choice without a timer or penalty." },
    difficulty: difficultyFor(band),
    status: "review",
    misconception_tag: misconception,
    animation_hook: animationFor(strand),
  };
}

function missionFor(item, strand, stage, id) {
  const desks = { paragraph_purpose: "Purpose Briefing Desk", topic_sentences: "Topic Beacon Studio", related_ideas: "Idea-Island Sort Room", sequencing: "Sequence Board", cohesion: "Cohesion Bridge Desk", splitting_merging: "Paragraph Boundary Press", editing: "Final Proof Workbench", misconceptions: "Draft Repair Bay" };
  const tools = { paragraph_purpose: "state what this paragraph helps the reader understand", topic_sentences: "test the opening against every supporting detail", related_ideas: "name the one idea and remove topic jumps", sequencing: "order by time, logic or dependency before adding signposts", cohesion: "name the real relationship before choosing a link", splitting_merging: "merge shared focus and split genuine changes", editing: "make one change, preserve meaning and reread the whole paragraph", misconceptions: "replace the length rule with a meaning-based decision" };
  return { campaign: "The Lantern Press: Publish the Living Atlas", edition: item.genre, desk: desks[strand], mission_code: id.slice(-30), objective: `Complete the ${stage.replaceAll("_", " ")} edit for the ${item.id} page.`, strategic_tool: tools[strand], publishing_protocol: ["name purpose and audience", "identify the paragraph focus", "group and sequence related sentences", "reread for cohesion and meaning"], reward: { item: "reviewed atlas page seal", earned_for: "using an organising strategy or completing a repair", effect: "adds a private page to the edition without increasing speed, pressure or difficulty" }, retry_protocol: "No lives, pages or progress are lost; the desk preserves useful sentences and opens one targeted organisation clue." };
}

function validateBank(packData, curatedItems, generated) {
  const pilot = packData.practice.variant_targets.pilot;
  if (curatedItems.length !== 5) throw new Error(`Expected five curated variants, found ${curatedItems.length}.`);
  if (generated.length !== pilot - curatedItems.length || curatedItems.length + generated.length !== pilot) throw new Error(`Pilot bank must contain exactly ${pilot} variants.`);
  const blueprintMap = new Map(packData.variant_blueprints.map((item) => [item.id, item]));
  const ids = new Set(); const signatures = new Set(); const coverage = new Set(); const genres = new Set(); const formats = new Set(); const blueprints = new Set(); const bands = new Set();
  for (const variant of [...curatedItems, ...generated]) {
    if (ids.has(variant.id)) throw new Error(`Duplicate id ${variant.id}.`); ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${normalise(variant.expected_answer?.value)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`); signatures.add(signature);
  }
  for (const variant of generated) {
    const blueprint = blueprintMap.get(variant.body.variant_blueprint_id);
    if (!blueprint || variant.format !== blueprint.format) throw new Error(`${variant.id} does not match its blueprint format.`);
    if (variant.status !== "review") throw new Error(`${variant.id} must remain in review.`);
    if (!Array.isArray(variant.body.choices) || variant.body.choices.length < 4 || new Set(variant.body.choices).size !== variant.body.choices.length) throw new Error(`${variant.id} has invalid choices.`);
    if (variant.body.choices.filter((choice) => choice === variant.expected_answer.value).length !== 1) throw new Error(`${variant.id} must contain its answer exactly once.`);
    if (!variant.body.interaction_support?.keyboard || !variant.body.interaction_support?.switch_scan || variant.body.interaction_support?.drag_required !== false) throw new Error(`${variant.id} lacks supported interactions.`);
    if (!variant.body.send_scaffolds?.sentence_cards || !variant.body.dyslexia_support?.line_focus || !variant.body.scaffold_routes?.visual || !variant.body.scaffold_routes?.text || !variant.body.scaffold_routes?.oral || !variant.body.scaffold_routes?.concrete || variant.body.reduced_visual_load !== true) throw new Error(`${variant.id} lacks SEND/dyslexia scaffolds.`);
    if (variant.body.audio_provider !== "ElevenLabs" || variant.body.audio_asset_status !== "required_human_listening_review" || variant.body.human_listening_approval_required !== true || variant.body.browser_tts_allowed !== false) throw new Error(`${variant.id} violates audio policy.`);
    if (Object.values(variant.body.pressure_rules).some((value) => value !== false) || !/No lives/.test(variant.body.publishing_mission?.retry_protocol) || !variant.body.publishing_mission?.strategic_tool) throw new Error(`${variant.id} lacks pressure-free publishing missions.`);
    if (!variant.feedback?.repair || !variant.feedback?.reader_check || !variant.feedback?.edit_check || !variant.feedback?.retry || variant.hints.length < 2 || variant.explanation.length < 60) throw new Error(`${variant.id} lacks rich feedback.`);
    for (const tag of variant.body.coverage_tags) coverage.add(tag);
    genres.add(variant.body.genre); formats.add(variant.format); blueprints.add(variant.body.variant_blueprint_id); bands.add(variant.body.difficulty_band);
  }
  const allocation = combinedAllocation(curatedItems, generated);
  for (const [blueprint, expected] of Object.entries(pilotAllocation)) if (allocation[blueprint] !== expected) throw new Error(`${blueprint} expected ${expected}, found ${allocation[blueprint] ?? 0}.`);
  assertCovered("formats", new Set(packData.practice.formats), formats);
  assertCovered("blueprints", new Set(blueprintMap.keys()), blueprints);
  assertCovered("difficulty bands", new Set([...packData.practice.difficulty_bands, ...packData.variant_blueprints.map((item) => item.difficulty_band)]), bands);
  assertCovered("paragraph coverage", new Set(["paragraph_purpose", "topic_sentences", "related_ideas", "sequencing", "cohesion", "splitting_merging", "editing", "misconceptions"]), coverage);
  assertCovered("genre coverage", new Set(["narrative", "information report", "instructions", "explanation", "recount", "biography", "persuasive letter", "diary", "formal letter"]), genres);
}

function paragraphCase(id, genre, theme, topic, details, rogue, narrowTopic, unrelatedTopic, focusOne, focusTwo, conclusion, sequence, link) { return { id, genre, theme, topic, details, rogue, narrowTopic, unrelatedTopic, focusOne, focusTwo, conclusion, sequence, link }; }
function coverageFor(strand, stage) { const tags = new Set([strand]); if (stage.includes("misconception") || strand === "misconceptions") tags.add("misconceptions"); return [...tags]; }
function bandFor(blueprint, stage) { if (blueprint === "one-idea-sentence-sorts") return stage.includes("purpose") || stage.includes("group") ? "developing" : "intro"; if (blueprint === "topic-sentence-signposts") return stage.includes("edit") || stage.includes("reject") ? "expected" : "developing"; if (blueprint === "paragraph-break-focus-shifts") return stage.includes("sequence") || stage.includes("split_and_merge") ? "secure" : "expected"; if (blueprint === "linking-language-bridges") return stage.includes("edit") || stage.includes("maintain") ? "stretch" : "secure"; return "retrieval"; }
function difficultyFor(band) { return { intro: 3, developing: 4, expected: 5, secure: 7, stretch: 8, retrieval: 5 }[band]; }
function repairFor(strand, stage) { if (strand === "topic_sentences") return "Read every detail, state what they share and choose an opening broad enough for all of them."; if (strand === "related_ideas") return "Write the theme above the cards and test each sentence; move any card that begins a different topic."; if (strand === "sequencing") return "Arrange events or ideas by chronology or dependency before adding one accurate signpost."; if (strand === "cohesion") return "Name the relationship in plain words, test the link and reject wording that changes the logic."; if (strand === "splitting_merging") return "Merge sentences with one shared focus; add a boundary only when focus, time, place or speaker genuinely changes."; if (strand === "editing") return "Make one organisation edit, compare before and after, and restore any information or voice that was lost."; if (strand === "misconceptions" || stage.includes("misconception")) return "Ignore paragraph length and decide from purpose, shared focus and the reader's need for a clear boundary."; return "State what the paragraph helps the reader understand, then check that each sentence contributes to that purpose."; }
function animationFor(strand) { return ({ paragraph_purpose: "purpose-page-compass", topic_sentences: "topic-signpost-test", related_ideas: "idea-island-sort", sequencing: "sequence-card-route", cohesion: "linking-bridge-build", splitting_merging: "paragraph-break-gate", editing: "before-after-proof", misconceptions: "companion-paragraph-regroup" })[strand]; }
function curatedBlueprint(variant) { const map = { "en-y4-paragraphs-q-rainforest-belongs": "one-idea-sentence-sorts", "en-y4-paragraphs-q-topic-stormy-sea": "topic-sentence-signposts", "en-y4-paragraphs-q-break-setting-character": "paragraph-break-focus-shifts", "en-y4-paragraphs-q-rogue-sentence-garden": "one-idea-sentence-sorts", "en-y4-paragraphs-q-link-because": "linking-language-bridges" }; const value = map[variant.id]; if (!value) throw new Error(`No curated blueprint assignment for ${variant.id}.`); return value; }
function combinedAllocation(curatedItems, generated) { const counts = countBy(curatedItems, curatedBlueprint); for (const variant of generated) counts[variant.body.variant_blueprint_id] = (counts[variant.body.variant_blueprint_id] ?? 0) + 1; return counts; }
function allocationSummary(curatedItems, generated) { return Object.entries(combinedAllocation(curatedItems, generated)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function assertCovered(label, required, actual) { const missing = [...required].filter((value) => !actual.has(value)); if (missing.length) throw new Error(`Missing ${label}: ${missing.join(", ")}.`); }
function countBy(items, keyFor) { const counts = {}; for (const item of items) { const key = keyFor(item); counts[key] = (counts[key] ?? 0) + 1; } return counts; }
function summary(items, keyFor) { return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function unique(items) { return [...new Set(items)]; }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
