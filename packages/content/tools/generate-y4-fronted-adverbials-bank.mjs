#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packPath = path.resolve(argValue("--pack") ?? path.join(repoRoot, "packages/content/packs/en-y4-writing-fronted-adverbials.pack.sample.json"));
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "en-y4-fronted-adverbials-bank-";
const reviewBatch = "y4-fronted-adverbials-pilot-a";
const reviewDays = [1, 3, 7, 14, 30];
const allocation = {
  "adverbial-type-sorts": 44,
  "front-the-phrase-builds": 44,
  "comma-placement-edits": 44,
  "opener-choice-for-effect": 44,
  "fronted-adverbial-retrieval": 44,
};

const sentences = [
  sentence("narrative", "A moment later", "time", "the hidden door swung open", "the hidden door swung open a moment later", "sequence the next event"),
  sentence("narrative", "At the edge of the forest", "place", "a narrow path disappeared into the mist", "a narrow path disappeared into the mist at the edge of the forest", "establish the setting"),
  sentence("narrative", "Without a sound", "manner", "the fox slipped between the trees", "the fox slipped between the trees without a sound", "emphasise quiet movement"),
  sentence("narrative", "Every night", "frequency", "the lighthouse beam swept across the bay", "the lighthouse beam swept across the bay every night", "show a repeated event"),
  sentence("explanation", "During evaporation", "time", "liquid water changes into water vapour", "liquid water changes into water vapour during evaporation", "signal the stage being explained"),
  sentence("explanation", "Inside the cloud", "place", "tiny water droplets gather together", "tiny water droplets gather together inside the cloud", "locate the process"),
  sentence("explanation", "Gradually", "manner", "the cooled material becomes solid", "the cooled material gradually becomes solid", "show a slow process"),
  sentence("explanation", "In most cycles", "frequency", "the same stages repeat", "the same stages repeat in most cycles", "show a usual pattern without claiming always"),
  sentence("instructions", "Before you begin", "time", "collect the equipment and read the safety note", "collect the equipment and read the safety note before you begin", "sequence preparation"),
  sentence("instructions", "At the top of the page", "place", "write a clear title", "write a clear title at the top of the page", "locate an instruction"),
  sentence("instructions", "With clean hands", "manner", "place the ingredients into the bowl", "place the ingredients into the bowl with clean hands", "emphasise how to act"),
  sentence("instructions", "After each observation", "frequency", "record the result in the table", "record the result in the table after each observation", "show a repeated checking routine"),
  sentence("recount", "Early on Tuesday morning", "time", "our class boarded the coach", "our class boarded the coach early on Tuesday morning", "place an event on the timeline"),
  sentence("recount", "At the museum entrance", "place", "the guide welcomed our group", "the guide welcomed our group at the museum entrance", "show where the event happened"),
  sentence("recount", "With great care", "manner", "we sketched the fragile object", "we sketched the fragile object with great care", "emphasise careful action"),
  sentence("recount", "On every stop of the trail", "frequency", "we added a note to our field journal", "we added a note to our field journal on every stop of the trail", "show repeated action"),
  sentence("information", "In winter", "time", "the animal grows a thicker coat", "the animal grows a thicker coat in winter", "organise seasonal information"),
  sentence("information", "Across the Arctic tundra", "place", "low plants grow close to the ground", "low plants grow close to the ground across the Arctic tundra", "locate information"),
  sentence("information", "In a tightly packed group", "manner", "the birds conserve warmth", "the birds conserve warmth in a tightly packed group", "explain how something happens"),
  sentence("information", "Usually", "frequency", "the nocturnal animal rests during daylight", "the nocturnal animal usually rests during daylight", "show a typical rather than certain pattern"),
];

const paragraphContexts = [
  paragraph("narrative", "The corridor was silent. ___, the floorboard creaked beneath Imani's foot. She froze and listened.", ["Without warning", "Every Tuesday", "Beside the recipe"], "Without warning", "emphasise a sudden change in the action"),
  paragraph("narrative", "The boat reached the island at dusk. ___, the crew tied the rope and carried supplies ashore. Later, they set up camp.", ["At the wooden jetty", "Usually", "With a blue pencil"], "At the wooden jetty", "connect the action to its new place"),
  paragraph("explanation", "Water vapour rises and cools. ___, tiny droplets form a cloud. When the droplets become heavy, rain may fall.", ["As the air cools", "Under the desk", "Every weekend"], "As the air cools", "link a process stage to its time or condition"),
  paragraph("instructions", "Gather a pot, compost and a seed. ___, fill most of the pot with compost. Next, make a small hole.", ["First", "Across the ocean", "With surprise"], "First", "signal the opening step"),
  paragraph("recount", "We arrived at the reserve before lunch. ___, a ranger showed us the observation route. Afterwards, our groups began the survey.", ["At the visitor centre", "Silently and secretly", "Every century"], "At the visitor centre", "connect the event to its location"),
  paragraph("information", "Otters hunt in and around rivers. ___, they may feed on fish, frogs and other small animals. Their food varies between habitats.", ["Depending on the habitat", "Suddenly", "After stirring twice"], "Depending on the habitat", "qualify the information accurately"),
];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "en-y4-writing-fronted-adverbials") throw new Error("This generator only supports the Year 4 fronted-adverbials pack.");
const curated = (pack.question_variants ?? []).filter((v) => !v.id.startsWith(prefix));
const curatedSnapshot = JSON.stringify(curated);
const curatedBlueprint = new Map([
  ["en-y4-writing-fronted-adverbials-q-comma-after-sunset", "comma-placement-edits"],
  ["en-y4-writing-fronted-adverbials-q-type-place", "adverbial-type-sorts"],
  ["en-y4-writing-fronted-adverbials-q-build-careful-steps", "front-the-phrase-builds"],
]);
const curatedCounts = countBy(curated, (v) => v.body?.variant_blueprint_id ?? curatedBlueprint.get(v.id));
const targets = Object.fromEntries(Object.entries(allocation).map(([id, total]) => [id, total - (curatedCounts[id] ?? 0)]));
for (const [id, count] of Object.entries(targets)) if (count < 0) throw new Error(`Curated variants exceed allocation for ${id}.`);

const generated = [
  ...typeCandidates(targets["adverbial-type-sorts"]),
  ...buildCandidates(targets["front-the-phrase-builds"]),
  ...commaCandidates(targets["comma-placement-edits"]),
  ...effectCandidates(targets["opener-choice-for-effect"]),
  ...retrievalCandidates(targets["fronted-adverbial-retrieval"]),
];
pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Review-stage Year 4 fronted-adverbials pack with a deterministic 220-variant pilot bank. Three curated variants are unchanged. Generated tasks cover time, place, manner and frequency adverbials; full-opener comma boundaries; moving adverbials while preserving meaning; purposeful sequence, cohesion and emphasis; subjects and coordinating-link distinctions; overuse/misuse editing; clause mapping; misconception repair and spaced transfer across narrative, explanation, instructions, recount and information writing. Every generated task includes sentence builders, clause maps, punctuation editors or meaning comparisons, dyslexia/SEND chunking, visual and alternative inputs, rich corrective feedback and pressure-free publishing missions without timers, streaks, lives or loss. Selected sentence and paragraph narration references ElevenLabs assets held for human listening review; browser TTS is prohibited. Independent English, accessibility, narration and renderer review remains required before promotion.";

validateBank(pack, curated, curatedSnapshot, generated, curatedBlueprint);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y4-fronted-adverbials-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y4-fronted-adverbials-bank blueprints=${summary(pack.question_variants, (v) => v.body?.variant_blueprint_id ?? curatedBlueprint.get(v.id))}`);
console.log(`y4-fronted-adverbials-bank formats=${summary(pack.question_variants, (v) => v.format)}`);
console.log(`y4-fronted-adverbials-bank genres=${summary(generated, (v) => v.body.genre)}`);
console.log(`y4-fronted-adverbials-bank types=${summary(generated, (v) => v.body.adverbial_type ?? "mixed")}`);
console.log(`y4-fronted-adverbials-bank concepts=${summary(generated, (v) => v.body.concept_focus)}`);
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y4-fronted-adverbials-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 4 fronted-adverbials bank is out of date; run generate-y4-fronted-adverbials-bank.mjs --write.");
  console.log("y4-fronted-adverbials-bank deterministic check passed");
} else console.log("y4-fronted-adverbials-bank dry-run; pass --write to update the pack");

function typeCandidates(count) {
  const modes = ["type_recognition", "meaning_question", "adverbial_or_subject", "adverbial_or_link", "frequency_recognition", "misconception_repair"];
  return Array.from({ length: count }, (_, i) => {
    const item = sentences[i % sentences.length], mode = modes[i % modes.length];
    if (mode === "adverbial_or_subject") {
      const subject = subjectOf(item.clause), answer = { fronted_adverbial: item.opener, subject };
      return writing({ id: `subject-${slug(item.opener)}-${i + 1}`, format: "sort-choice", blueprint: "adverbial-type-sorts", band: "developing", concept: mode, item,
        prompt: `Clause-map mission ${i + 1}: separate the fronted adverbial from the subject.`, body: { sentence: `${item.opener}, ${item.clause}.`, cards: [item.opener, subject], trays: ["fronted adverbial", "subject"], expected_groups: answer }, answer,
        hints: ["Find who or what performs the main-clause action.", `Ask ${questionFor(item.type)} for the opener.`], explanation: `“${item.opener}” tells ${item.type}; “${subject}” is the subject of the main clause.`, correct: "Fronted adverbial and subject distinguished by their jobs.", repair: "Bracket the opener, then underline the main-clause verb and ask who or what performs it.", tag: "fronted_adverbial_confused_with_subject", hook: "clause-map" });
    }
    if (mode === "adverbial_or_link") {
      const answer = { adverbial: item.opener, coordinating_link: "and" };
      return writing({ id: `link-${slug(item.opener)}-${i + 1}`, format: "sort-choice", blueprint: "adverbial-type-sorts", band: "expected", concept: mode, item,
        prompt: `Word-job sort ${i + 1}: distinguish the opener from the coordinating link.`, body: { cards: [item.opener, "and"], trays: ["adds when/where/how/how often detail", "coordinates words or clauses"], expected_groups: answer, sample_sentence: `${item.opener}, ${item.clause}, and another related action followed.` }, answer,
        hints: ["An adverbial adds circumstance detail.", "And coordinates; it does not itself tell when, where, how or how often."], explanation: `“${item.opener}” is an adverbial; “and” is a coordinating conjunction/link.`, correct: "Adverbial detail distinguished from a coordinating link.", repair: "Ask the four adverbial questions for each card; place AND under JOINS instead.", tag: "coordinating_link_called_adverbial", hook: "word-job-sort" });
    }
    if (mode === "misconception_repair") {
      const answer = "Find the main-clause action, then ask when, where, how or how often; do not label the subject or any first phrase automatically.";
      return writing({ id: `type-repair-${slug(item.opener)}-${i + 1}`, format: "sort-choice", blueprint: "adverbial-type-sorts", band: "expected", concept: mode, item,
        prompt: `Opener-repair mission ${i + 1}: which routine identifies a genuine fronted adverbial?`, body: { sentence: `${item.opener}, ${item.clause}.`, choices: [answer, "Call every first word an adverbial.", "Choose the noun doing the action."], clause_map_available: true }, answer,
        hints: ["A position at the front is not enough by itself.", "The phrase must add circumstance detail to the action."], explanation: `${answer} Here, “${item.opener}” answers ${questionFor(item.type)}.`, correct: "Recognition misconception repaired with meaning and clause structure.", repair: "Reveal the main clause first, identify its subject/action, then test the opener with four question cards.", tag: "not_adverbial_detail", hook: "opener-repair" });
    }
    const answer = mode === "meaning_question" ? questionFor(item.type) : item.type;
    return writing({ id: `${mode}-${slug(item.opener)}-${i + 1}`, format: "sort-choice", blueprint: "adverbial-type-sorts", band: mode === "type_recognition" ? "intro" : "developing", concept: mode, item,
      prompt: mode === "meaning_question" ? `Meaning-question mission ${i + 1}: which question does “${item.opener}” answer?` : `Adverbial-type mission ${i + 1}: classify “${item.opener}”.`, body: { phrase: item.opener, sentence: `${item.opener}, ${item.clause}.`, choices: mode === "meaning_question" ? ["when?", "where?", "how?", "how often?", "who or what?"] : ["time", "place", "manner", "frequency", "subject"], phrase_chunk: item.opener.split(" ") }, answer,
      hints: ["Read the main action, then ask what detail the phrase adds.", `${item.opener} answers ${questionFor(item.type)}.`], explanation: `“${item.opener}” is a ${item.type} adverbial because it answers ${questionFor(item.type)}.`, correct: `${item.type} adverbial identified from meaning.`, repair: "Keep the phrase as one chunk and compare only the four circumstance questions plus WHO/WHAT for subject.", tag: "not_adverbial_detail", hook: "adverbial-card-scan", audioScript: i % 4 === 0 ? `${item.opener}, ${item.clause}.` : undefined });
  });
}

function buildCandidates(count) {
  const modes = ["front_phrase", "move_preserve_meaning", "sentence_builder", "clause_map", "meaning_comparison", "frequency_builder"];
  return Array.from({ length: count }, (_, i) => {
    const item = sentences[i % sentences.length], mode = modes[i % modes.length], fronted = `${item.opener}, ${item.clause}.`;
    if (mode === "move_preserve_meaning" || mode === "meaning_comparison") {
      const answer = "The main event and circumstance stay the same; fronting changes emphasis and guides the reader first to the adverbial detail.";
      return writing({ id: `${mode}-${slug(item.opener)}-${i + 1}`, format: "sentence-build", blueprint: "front-the-phrase-builds", band: "expected", concept: mode, item,
        prompt: `Meaning-preserving move ${i + 1}: compare “${capitalise(item.endSentence)}.” with “${fronted}”`, body: { original_sentence: `${capitalise(item.endSentence)}.`, moved_sentence: fronted, choices: [answer, "The subject changes into the opener.", "The event becomes the opposite."], meaning_elements: { event: item.clause, circumstance: item.opener, changed_effect: item.effect } }, answer,
        hints: ["Check who did what in both sentences.", "The adverbial moves; the core event remains."], explanation: `${answer} In this context, the fronted version can ${item.effect}.`, correct: "Adverbial movement compared without inventing a meaning change.", repair: "Highlight the same event and circumstance in both versions, then identify only the changed emphasis/order.", tag: "moving_adverbial_changes_event", hook: "meaning-comparison" });
    }
    if (mode === "clause_map") {
      const answer = [item.opener, ",", subjectOf(item.clause), predicateOf(item.clause), "."];
      return writing({ id: `clause-map-${slug(item.opener)}-${i + 1}`, format: "sentence-build", blueprint: "front-the-phrase-builds", band: "expected", concept: mode, item,
        prompt: `Clause-map builder ${i + 1}: place opener, comma, subject and predicate in order.`, body: { tiles: rotate(answer, i % answer.length), slots: ["fronted adverbial", "comma boundary", "subject", "predicate", "full stop"], role_labels: true }, answer,
        hints: ["The fronted adverbial is outside the main-clause subject/predicate structure.", "The comma marks the boundary before the main clause."], explanation: `${answer.join(" ")} The opener adds ${item.type} detail; the subject and predicate form the main clause.`, correct: "Sentence assembled with clause roles and boundary visible.", repair: "Place subject and predicate together first, then add the opener and comma before them.", tag: "fronted_adverbial_confused_with_subject", hook: "clause-map-builder" });
    }
    const answer = [item.opener, ",", item.clause, "."];
    return writing({ id: `${mode}-${slug(item.opener)}-${i + 1}`, format: "sentence-build", blueprint: "front-the-phrase-builds", band: mode === "front_phrase" ? "developing" : "expected", concept: mode, item,
      prompt: `Sentence-track mission ${i + 1}: move the ${item.type} detail to the front and build the complete sentence.`, body: { source_sentence: `${capitalise(item.endSentence)}.`, tiles: rotate(answer, i % answer.length), slots: ["opener", "comma", "main clause", "end mark"], main_clause: item.clause, meaning_check: item.effect }, answer,
      hints: ["Move the whole phrase as one chunk.", "Place the comma after the opener and before the complete main clause."], explanation: `${fronted} The moved phrase preserves the circumstance and can ${item.effect}.`, correct: "Grammatical sentence built with a fronted adverbial and comma.", repair: "Keep the main clause intact, move only the adverbial tile to the first slot and insert the comma boundary.", tag: "missing_comma", hook: "sentence-train-front", audioScript: i % 5 === 0 ? `${capitalise(item.endSentence)}. ${fronted}` : undefined });
  });
}

function commaCandidates(count) {
  const modes = ["place_comma", "multiword_boundary", "remove_wrong_comma", "single_word_adverbial", "subject_boundary", "edit_two_errors", "misconception_repair"];
  return Array.from({ length: count }, (_, i) => {
    const item = sentences[i % sentences.length], mode = modes[i % modes.length], correct = `${item.opener}, ${item.clause}.`, first = item.opener.split(" ")[0], rest = item.opener.split(" ").slice(1).join(" ");
    if (mode === "remove_wrong_comma") {
      const wrong = rest ? `${first}, ${rest} ${item.clause}.` : `${item.opener}, ${subjectOf(item.clause)}, ${predicateOf(item.clause)}.`;
      return writing({ id: `remove-${slug(item.opener)}-${i + 1}`, format: "punctuation-edit", blueprint: "comma-placement-edits", band: "expected", concept: mode, item,
        prompt: `Comma-rescue mission ${i + 1}: move the comma to mark the whole opener.`, body: { text: wrong, choices: [correct, wrong, `${item.opener} ${subjectOf(item.clause)}, ${predicateOf(item.clause)}.`], incorrect_boundary: rest ? first.length : item.opener.length + subjectOf(item.clause).length, correct_boundary_after: item.opener }, answer: correct,
        hints: ["Read the entire opener as one meaning chunk.", "The comma comes before the main-clause subject."], explanation: `The full fronted adverbial is “${item.opener}”, so the correct sentence is “${correct}”`, correct: "Misplaced comma moved to the full-opener boundary.", repair: "Bracket the opener, remove internal commas and place one comma immediately after the bracket.", tag: "comma_after_first_word", hook: "comma-rescue" });
    }
    if (mode === "edit_two_errors") {
      const wrong = `${first}, ${rest || ""} ${uncapitalise(item.clause)}`.replace(/  +/g, " ");
      return writing({ id: `two-errors-${slug(item.opener)}-${i + 1}`, format: "punctuation-edit", blueprint: "comma-placement-edits", band: "secure", concept: mode, item,
        prompt: `Publishing-check mission ${i + 1}: repair the opener comma and sentence ending.`, body: { text: wrong, edits_required: ["move comma after full opener", "add full stop"], choices: [correct, `${item.opener} ${item.clause}.`, `${first}, ${rest} ${item.clause}.`] }, answer: correct,
        hints: ["Fix the internal sentence boundary first.", "Then check the sentence starts and ends correctly."], explanation: `“${correct}” places the comma after the complete opener and includes the full stop.`, correct: "Opener boundary and sentence ending both repaired.", repair: "Use the editing order OPENER CHUNK → COMMA → MAIN CLAUSE → END MARK.", tag: "comma_after_first_word", hook: "publishing-check" });
    }
    if (mode === "misconception_repair") {
      const answer = "Bracket the whole fronted adverbial, then put one comma after the bracket—not automatically after the first word.";
      return writing({ id: `comma-repair-${slug(item.opener)}-${i + 1}`, format: "punctuation-edit", blueprint: "comma-placement-edits", band: "secure", concept: mode, item,
        prompt: `Comma-rule repair ${i + 1}: which routine fixes first-word comma placement?`, body: { sentence_without_comma: `${item.opener} ${item.clause}.`, choices: [answer, "Put a comma after every first word.", "Put a comma inside the subject."], full_opener: item.opener }, answer,
        hints: ["The opener may contain one word or several.", "Meaning decides the chunk boundary."], explanation: `${answer} Here the bracket is [${item.opener}],.`, correct: "Comma misconception repaired with full-phrase bracketing.", repair: "Tap every word in the opener chunk, close the bracket and place one comma at its right edge.", tag: "comma_after_first_word", hook: "comma-rule-repair" });
    }
    const answer = correct;
    return writing({ id: `${mode}-${slug(item.opener)}-${i + 1}`, format: "punctuation-edit", blueprint: "comma-placement-edits", band: mode === "place_comma" ? "developing" : "expected", concept: mode, item,
      prompt: `Comma-checkpoint ${i + 1}: punctuate the fronted adverbial boundary.`, body: { text: `${item.opener} ${item.clause}.`, choices: [correct, `${first}, ${rest} ${item.clause}.`.replace(/  +/g, " "), `${item.opener} ${subjectOf(item.clause)}, ${predicateOf(item.clause)}.`], numbered_boundaries: boundaryLabels(item.opener, item.clause), correct_boundary_after: item.opener }, answer,
      hints: ["Find the whole phrase answering the adverbial question.", "Place the comma before the main-clause subject."], explanation: `“${item.opener}” is the complete fronted adverbial, so “${correct}” is correctly punctuated.`, correct: "Comma placed at the opener/main-clause boundary.", repair: "Use the clause map, bracket the opener and choose the numbered boundary immediately after it.", tag: "comma_after_first_word", hook: "comma-position-test", audioScript: i % 4 === 0 ? correct : undefined });
  });
}

function effectCandidates(count) {
  const modes = ["purposeful_opener", "sequence_cohesion", "setting_emphasis", "manner_emphasis", "frequency_precision", "overuse_edit", "misuse_edit"];
  return Array.from({ length: count }, (_, i) => {
    const paragraph = paragraphContexts[i % paragraphContexts.length], mode = modes[i % modes.length], answer = paragraph.answer;
    if (mode === "overuse_edit") {
      const repeated = "Suddenly, the gate opened. Suddenly, the dog barked. Suddenly, the visitors entered. Suddenly, the guide began speaking.";
      const repair = "Keep “Suddenly” only where a genuinely abrupt event needs emphasis; vary or remove the other openings according to time, place and focus.";
      return writing({ id: `overuse-${i + 1}`, format: "sort-choice", blueprint: "opener-choice-for-effect", band: "secure", concept: mode, genre: paragraph.genre,
        prompt: `Overuse editor ${i + 1}: which revision advice improves this paragraph?`, body: { paragraph: repeated, choices: [repair, "Add Suddenly to every sentence in the text.", "Delete all sentence openings regardless of meaning."], repeated_opener: "Suddenly", revision_map: ["abrupt emphasis", "time", "place", "no fronted adverbial needed"] }, answer: repair,
        hints: ["A fronted adverbial is a purposeful choice, not a requirement in every sentence.", "Reserve repeated emphatic openings for deliberate effect."], explanation: repair, correct: "Overuse identified and revised according to purpose.", repair: "Label each sentence's needed relationship before choosing an opener; allow NO OPENER where flow is already clear.", tag: "fronted_adverbial_every_sentence", hook: "overuse-editor" });
    }
    if (mode === "misuse_edit") {
      const wrong = paragraph.choices.find((x) => x !== answer), repair = `Replace “${wrong}” with “${answer}” because it ${paragraph.effect}.`;
      return writing({ id: `misuse-${i + 1}`, format: "sort-choice", blueprint: "opener-choice-for-effect", band: "secure", concept: mode, genre: paragraph.genre,
        prompt: `Meaning-fit editor ${i + 1}: an irrelevant opener was chosen. Which edit restores cohesion?`, body: { paragraph_with_gap: paragraph.text, used_opener: wrong, choices: [repair, "Keep the opener because any opening phrase works.", "Replace it with the subject of the sentence."], candidate_openers: paragraph.choices }, answer: repair,
        hints: ["The opener must express a real relationship to the sentence and paragraph.", `Look for an opener that will ${paragraph.effect}.`], explanation: repair, correct: "Misused opener replaced by a context-purposeful choice.", repair: "State the needed relationship first, then compare only openers that express that relationship.", tag: "opener_does_not_fit_meaning", hook: "meaning-fit-editor" });
    }
    return writing({ id: `${mode}-${i + 1}`, format: "sort-choice", blueprint: "opener-choice-for-effect", band: mode === "purposeful_opener" ? "expected" : "secure", concept: mode, genre: paragraph.genre,
      prompt: `Paragraph-opening mission ${i + 1}: choose the opener that best helps the reader.`, body: { paragraph_with_gap: paragraph.text, choices: rotate(paragraph.choices, i % paragraph.choices.length), intended_effect: paragraph.effect, compare_after_insertion: true }, answer,
      hints: ["Decide what relationship the gap needs: sequence, place, manner, frequency or emphasis.", `Choose the opener that will ${paragraph.effect}.`], explanation: `“${answer}” fits because it helps ${paragraph.effect}. Other choices are grammatical fragments but do not fit the paragraph relationship.`, correct: "Opener chosen for a clear cohesive or emphatic purpose.", repair: "Highlight the sentences before and after the gap, name the needed relationship and test two opener substitutions.", tag: "style_choice_without_context", hook: "opener-effect-compare", audioScript: i % 4 === 0 ? paragraph.text.replace("___", answer) : undefined });
  });
}

function retrievalCandidates(count) {
  const modes = ["type_retrieval", "comma_retrieval", "move_retrieval", "meaning_retrieval", "genre_transfer", "overuse_transfer", "clause_role_retrieval", "edit_transfer"];
  return Array.from({ length: count }, (_, i) => {
    const item = sentences[i % sentences.length], mode = modes[i % modes.length], day = reviewDays[i % reviewDays.length], correct = `${item.opener}, ${item.clause}.`;
    if (mode === "type_retrieval") {
      return retrieve({ id: `type-${slug(item.opener)}-${i + 1}`, concept: mode, item, prompt: `Type revisit ${i + 1}: after ${day} days, classify “${item.opener}”.`, body: { phrase: item.opener, choices: ["time", "place", "manner", "frequency", "subject"], review_interval_days: day }, answer: item.type,
        explanation: `“${item.opener}” is ${item.type} because it answers ${questionFor(item.type)}.`, tag: "not_adverbial_detail" });
    }
    if (mode === "comma_retrieval") {
      return retrieve({ id: `comma-${slug(item.opener)}-${i + 1}`, concept: mode, item, prompt: `Comma revisit ${i + 1}: choose the correctly punctuated sentence.`, body: { text_without_comma: `${item.opener} ${item.clause}.`, choices: [correct, `${item.opener.split(" ")[0]}, ${item.opener.split(" ").slice(1).join(" ")} ${item.clause}.`, `${item.opener} ${subjectOf(item.clause)}, ${predicateOf(item.clause)}.`], review_interval_days: day }, answer: correct,
        explanation: `The comma follows the complete opener “${item.opener}”.`, tag: "comma_after_first_word" });
    }
    if (mode === "move_retrieval" || mode === "meaning_retrieval") {
      const answer = [item.opener, ",", item.clause, "."];
      return retrieve({ id: `${mode}-${slug(item.opener)}-${i + 1}`, concept: mode, item, prompt: `Sentence-move revisit ${i + 1}: front the adverbial without changing the event meaning.`, body: { source_sentence: `${capitalise(item.endSentence)}.`, tiles: rotate(answer, i % answer.length), meaning_to_preserve: { action: item.clause, circumstance: item.opener }, review_interval_days: day }, answer,
        explanation: `${correct} The same event and circumstance remain; only emphasis/order changes.`, tag: "moving_adverbial_changes_event" });
    }
    if (mode === "genre_transfer") {
      const paragraph = paragraphContexts.find((x) => x.genre === item.genre) ?? paragraphContexts[0];
      return retrieve({ id: `genre-${item.genre}-${i + 1}`, concept: mode, item, prompt: `Genre-transfer revisit ${i + 1}: choose an opener that fits this ${item.genre} context.`, body: { paragraph_with_gap: paragraph.text, choices: paragraph.choices, intended_effect: paragraph.effect, review_interval_days: day }, answer: paragraph.answer,
        explanation: `“${paragraph.answer}” suits the ${item.genre} context because it helps ${paragraph.effect}.`, tag: "same_opener_for_every_genre" });
    }
    if (mode === "overuse_transfer") {
      const answer = "Use a fronted adverbial only where it clarifies sequence, place, manner, frequency or emphasis; vary or omit it elsewhere.";
      return retrieve({ id: `overuse-${i + 1}`, concept: mode, item, prompt: `Style revisit ${i + 1}: which rule prevents fronted-adverbial overuse?`, body: { choices: [answer, "Begin every sentence with Suddenly.", "Never use fronted adverbials."], review_interval_days: day }, answer,
        explanation: answer, tag: "fronted_adverbial_every_sentence" });
    }
    if (mode === "clause_role_retrieval") {
      const answer = { opener: item.opener, subject: subjectOf(item.clause), predicate: predicateOf(item.clause) };
      return retrieve({ id: `roles-${slug(item.opener)}-${i + 1}`, concept: mode, item, prompt: `Clause-role revisit ${i + 1}: map opener, subject and predicate.`, body: { sentence: correct, cards: Object.values(answer), role_slots: Object.keys(answer), review_interval_days: day }, answer,
        explanation: `Opener: “${item.opener}”; subject: “${subjectOf(item.clause)}”; predicate: “${predicateOf(item.clause)}”.`, tag: "fronted_adverbial_confused_with_subject" });
    }
    const answer = correct;
    return retrieve({ id: `edit-${slug(item.opener)}-${i + 1}`, concept: mode, item, prompt: `Publishing revisit ${i + 1}: repair the sentence opener and boundary.`, body: { draft: `${item.opener} ${item.clause}.`, choices: [correct, `${item.opener}, and ${item.clause}.`, `${item.opener.split(" ")[0]}, ${item.opener.split(" ").slice(1).join(" ")} ${item.clause}.`], review_interval_days: day }, answer,
      explanation: `${correct} The opener adds ${item.type} detail and the comma marks the main-clause boundary.`, tag: "missing_comma" });
  });
}

function retrieve({ id, concept, item, prompt, body, answer, explanation, tag }) {
  return writing({ id, format: "punctuation-edit", blueprint: "fronted-adverbial-retrieval", band: "retrieval", concept, item, prompt, body, answer,
    hints: ["Find the main-clause action and test when, where, how or how often.", "Bracket the whole opener before checking the comma or effect."], explanation, correct: `Spaced fronted-adverbial knowledge retained. ${explanation}`, repair: "Return to the opener/comma/main-clause track, preserve correct chunks and retry with two choices.", tag, hook: "publishing-retrieval" });
}

function writing({ id, format, blueprint, band, concept, item, genre, prompt, body, answer, hints, explanation, correct, repair, tag, hook, audioScript }) {
  const actualGenre = genre ?? item?.genre ?? "mixed";
  const audio = audioScript ? { audio_required: true, narration_script: audioScript, audio_asset_id: `narration-${prefix}${id}`, audio_provider: "ElevenLabs", audio_asset_status: "required_human_listening_review", human_listening_approval_required: true, browser_tts_allowed: false, browser_tts_fallback: "prohibited", audio_replay_unlimited: true, unavailable_audio_state: "honest_not_ready_keep_sentence_text_clause_map_and_adult_read_route" } : { audio_required: false, audio_route: "not_needed_for_this_visual_builder_sort_or_edit" };
  const sequence = Array.isArray(answer);
  return {
    id: `${prefix}${slug(blueprint)}-${id}`, format,
    body: {
      prompt, ...body, ...audio, genre: actualGenre, adverbial_type: item?.type, concept_focus: concept,
      interaction_mode: "build_map_sort_edit_compare_tap_keyboard_switch_eye_gaze_aac_or_adult_scribed",
      supported_interaction: "An adult or peer may read, scan, move the learner's named tile or record an indicated explanation without supplying the grammatical decision.",
      sentence_builder_route: "Large opener, comma, subject, predicate and end-mark tiles with automatic snap and text labels.",
      clause_map_route: "Fronted adverbial is bracketed separately from main-clause subject and predicate; role labels remain visible.",
      punctuation_editor_route: "Numbered word boundaries allow comma placement by tap, keyboard, switch, eye gaze or pointing.",
      meaning_comparison_route: "Original and moved versions appear side by side with event, circumstance and changed emphasis highlighted separately.",
      dyslexia_support: { opener_chunking: true, one_sentence_per_panel: true, line_focus: true, adjustable_spacing_and_font: true, phrase_level_replay: true, colour_not_required: true, spelling_and_handwriting_not_scored: true },
      visual_route: "Low-clutter sentence track, generous spacing, persistent chunk brackets and no meaning encoded through colour alone.",
      processing_route: "Use FIND ACTION–ASK QUESTION–BRACKET OPENER–PLACE COMMA–REREAD, one decision at a time with preserved work.",
      motor_alternative: "Tap, keyboard, switch scan, eye gaze, AAC, pointing or adult-scribed tile placement can replace dragging, speech and handwriting.",
      low_visual_load: true, reduced_motion: "static_tiles_instant_boundary_marks_and_side_by_side_versions", preserve_correct_work: true, undo_available: true,
      no_timer: true, speed_score_allowed: false, microphone_required: false, handwriting_required: false, retry_without_penalty: true,
      gamification: { mission: "prepare one calm sentence or paragraph for publication", reward: "one publishing seal for a clear opener, comma or purposeful effect", lives: false, streaks: false, loss_on_error: false, leaderboard: false, speed_bonus: false, retry_message: "Your accurate sentence chunks stay. Choose another grammar clue or edit and continue." },
      difficulty_band: band, evidence_purpose: concept, variant_blueprint_id: blueprint, review_batch: reviewBatch,
    },
    expected_answer: sequence ? { sequence: answer } : { value: answer }, hints, explanation,
    feedback: { correct, repair, grammar_evidence: explanation, support_message: "Sorting, building, boundary selection, pointing, eye gaze, AAC and adult-scribed explanations carry equal evidence; speed, spelling and handwriting are not scored here." },
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
  for (const c of ["type_recognition", "meaning_question", "adverbial_or_subject", "adverbial_or_link", "frequency_recognition", "front_phrase", "move_preserve_meaning", "sentence_builder", "clause_map", "meaning_comparison", "place_comma", "multiword_boundary", "remove_wrong_comma", "single_word_adverbial", "subject_boundary", "edit_two_errors", "purposeful_opener", "sequence_cohesion", "setting_emphasis", "manner_emphasis", "frequency_precision", "overuse_edit", "misuse_edit", "genre_transfer", "clause_role_retrieval", "edit_transfer"]) if (!concepts.has(c)) throw new Error(`Missing concept ${c}.`);
  for (const type of ["time", "place", "manner", "frequency"]) if (!generated.some((v) => v.body.adverbial_type === type)) throw new Error(`Missing adverbial type ${type}.`);
  for (const genre of ["narrative", "explanation", "instructions", "recount", "information"]) if (!generated.some((v) => v.body.genre === genre)) throw new Error(`Missing genre ${genre}.`);
  for (const v of generated) {
    const b = v.body;
    if (!b.dyslexia_support?.opener_chunking || !b.sentence_builder_route || !b.clause_map_route || !b.punctuation_editor_route || !b.meaning_comparison_route || !b.motor_alternative || !b.low_visual_load) throw new Error(`Missing SEND/dyslexia route in ${v.id}.`);
    if (!v.feedback?.correct || !v.feedback?.repair || !v.feedback?.grammar_evidence) throw new Error(`Missing rich feedback in ${v.id}.`);
    if (!b.no_timer || b.speed_score_allowed || b.gamification?.lives || b.gamification?.streaks || b.gamification?.loss_on_error) throw new Error(`Pressure mechanic in ${v.id}.`);
    if (b.audio_required) {
      if (b.audio_provider !== "ElevenLabs" || b.audio_asset_status !== "required_human_listening_review" || !b.human_listening_approval_required || b.browser_tts_allowed !== false || b.browser_tts_fallback !== "prohibited") throw new Error(`Audio policy failure in ${v.id}.`);
    } else if (b.audio_asset_id || b.audio_provider) throw new Error(`Unnecessary audio reference in ${v.id}.`);
  }
}

function sentence(genre, opener, type, clause, endSentence, effect) { return { genre, opener, type, clause, endSentence, effect }; }
function paragraph(genre, text, choices, answer, effect) { return { genre, text, choices, answer, effect }; }
function questionFor(type) { return ({ time: "when?", place: "where?", manner: "how?", frequency: "how often?" })[type]; }
function clauseParts(clause) {
  const words = clause.split(" ");
  const verbs = new Set(["swung", "disappeared", "slipped", "swept", "changes", "gather", "becomes", "repeat", "collect", "write", "place", "record", "boarded", "welcomed", "sketched", "added", "grows", "grow", "conserve", "rests"]);
  const verbIndex = words.findIndex((word) => verbs.has(word.toLowerCase()));
  if (verbIndex === 0) return { subject: "you (understood)", predicate: clause };
  if (verbIndex > 0) return { subject: words.slice(0, verbIndex).join(" "), predicate: words.slice(verbIndex).join(" ") };
  throw new Error(`No main-clause verb mapped for: ${clause}`);
}
function subjectOf(clause) { return clauseParts(clause).subject; }
function predicateOf(clause) { return clauseParts(clause).predicate; }
function boundaryLabels(opener, clause) { const words = `${opener} ${clause}`.split(" "); return words.slice(0, -1).map((word, i) => ({ after_word: word, boundary_number: i + 1 })); }
function capitalise(text) { return text[0].toUpperCase() + text.slice(1); }
function uncapitalise(text) { return text[0].toLowerCase() + text.slice(1); }
function rotate(items, n) { const a = [...items], k = a.length ? n % a.length : 0; return a.slice(k).concat(a.slice(0, k)); }
function slug(text) { return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function countBy(items, fn) { const out = {}; for (const item of items) { const key = fn(item); out[key] = (out[key] ?? 0) + 1; } return out; }
function summary(items, fn) { return Object.entries(countBy(items, fn)).sort(([a], [b]) => String(a).localeCompare(String(b))).map(([k, v]) => `${k}:${v}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
