#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packPath = path.resolve(argValue("--pack") ?? path.join(repoRoot, "packages/content/packs/en-y3-vocabulary.pack.sample.json"));
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "en-y3-vocabulary-bank-";
const reviewBatch = "y3-vocabulary-pilot-a";
const reviewDays = [1, 3, 7, 14, 30];
const allocation = {
  "explicit-context-clues": 44,
  "synonym-substitution-and-sense": 44,
  "morphology-plus-context": 44,
  "multiple-meaning-dictionary-selection": 44,
  "vocabulary-spaced-retrieval": 44,
};

const contexts = [
  context("parched", "very dry and needing water", "non-fiction", "After weeks without rain, the soil was parched. Cracks spread across the dusty ground, and the gardener carried extra water to the drooping plants.", ["weeks without rain", "Cracks spread across the dusty ground"], ["soaking wet", "newly frozen", "covered with flowers"]),
  context("glimpse", "a quick, brief look", "fiction", "Mina caught a glimpse of the fox before it vanished into the hedge. She had seen its red tail for only a second.", ["before it vanished", "for only a second"], ["a long careful study", "a loud warning", "a hidden footprint"]),
  context("startled", "suddenly surprised or alarmed", "fiction", "A book thudded onto the floor, and Dev was startled. He jumped, then turned quickly towards the unexpected sound.", ["He jumped", "unexpected sound"], ["calm and sleepy", "proud of winning", "unable to hear"]),
  context("fragile", "easy to break or damage", "non-fiction", "The museum worker carried the fragile bowl with both hands. She placed it gently on thick padding so it would not crack.", ["placed it gently", "so it would not crack"], ["very heavy", "brightly coloured", "easy to replace"]),
  context("vast", "extremely large", "fiction", "From the hill, Arlo saw a vast plain stretching towards the horizon. It seemed to continue farther than he could see.", ["stretching towards the horizon", "farther than he could see"], ["tiny and narrow", "crowded indoors", "dark and silent"]),
  context("scarce", "hard to find because there is not much", "non-fiction", "During the dry season, water became scarce. The small pools shrank, and animals travelled farther to find enough to drink.", ["small pools shrank", "travelled farther to find enough"], ["easy to find everywhere", "unsafe to touch", "frozen solid"]),
  context("drowsy", "sleepy and not fully alert", "fiction", "The warm carriage made Leila drowsy. Her eyelids drooped, and she yawned as the train rocked gently.", ["eyelids drooped", "she yawned"], ["angry and shouting", "wide awake", "hungry for lunch"]),
  context("swift", "moving or happening quickly", "poetry", "A swift shadow crossed the moonlit path. In a heartbeat, the owl had swept beyond the trees.", ["In a heartbeat", "swept beyond the trees"], ["slow and careful", "silent but still", "rough and uneven"]),
  context("ancient", "very old and from long ago", "non-fiction", "The archaeologists uncovered an ancient coin. It had been buried for hundreds of years beneath the ruined wall.", ["hundreds of years", "beneath the ruined wall"], ["made yesterday", "worth a lot of money", "shiny and round"]),
  context("gradually", "slowly over a period of time", "non-fiction", "The tadpole gradually developed legs. The change happened over many days rather than all at once.", ["over many days", "rather than all at once"], ["immediately", "secretly", "in the wrong order"]),
  context("cluster", "a close group of similar things", "poetry", "A cluster of stars shimmered above the roof. The small points of light seemed gathered closely together.", ["gathered closely together", "small points of light"], ["one object alone", "a straight path", "a loud sound"]),
  context("essential", "completely necessary", "non-fiction", "Clean water is essential for survival. Without it, the body cannot keep working properly.", ["for survival", "cannot keep working properly"], ["pleasant but optional", "rare and expensive", "difficult to carry"]),
];

const relationSets = [
  relation("quiet", "silent", "noisy", ["quiet", "silent", "hushed"], "The library became quiet when the reading began."),
  relation("happy", "cheerful", "miserable", ["pleased", "delighted", "overjoyed"], "Nora was happy when her seedling produced its first flower."),
  relation("cold", "chilly", "hot", ["cool", "chilly", "freezing"], "A cold wind swept across the playground."),
  relation("large", "big", "tiny", ["large", "huge", "enormous"], "A large wave rose beyond the harbour wall."),
  relation("walked", "strolled", "sprinted", ["strolled", "walked", "marched"], "The visitors walked calmly through the gallery."),
  relation("said", "spoke", "remained silent", ["whispered", "said", "shouted"], "‘The chick has hatched,’ Sam said to the group."),
  relation("looked", "glanced", "ignored", ["glanced", "looked", "stared"], "Iris looked at the map before choosing a path."),
  relation("bright", "shining", "dim", ["faint", "bright", "dazzling"], "The bright lantern lit the whole tent."),
];

const morphs = [
  morph("unhelpful", ["un", "help", "ful"], "not helpful", "The unhelpful sign gave no directions, so the walkers remained lost.", "gave no directions"),
  morph("careless", ["care", "less"], "not taking enough care", "The careless spill happened because the open bottle was swung around.", "open bottle was swung around"),
  morph("reusable", ["re", "use", "able"], "able to be used again", "The reusable bottle was washed and filled again the next day.", "washed and filled again"),
  morph("preview", ["pre", "view"], "see something before the main event", "We watched a preview before the full film was released.", "before the full film"),
  morph("misread", ["mis", "read"], "read incorrectly", "I misread the timetable and waited at the wrong platform.", "waited at the wrong platform"),
  morph("disagreement", ["dis", "agree", "ment"], "a situation in which people do not agree", "Their disagreement continued because one chose the river path and the other chose the hill path.", "one chose the river path and the other chose the hill path"),
  morph("hopeful", ["hope", "ful"], "feeling or showing hope", "Kai felt hopeful when the dark clouds began to move away before the picnic.", "clouds began to move away"),
  morph("slowly", ["slow", "ly"], "in a slow way", "The tortoise moved slowly, taking a long time to cross the path.", "taking a long time"),
  morph("darkness", ["dark", "ness"], "the state of being dark", "In the cave's darkness, the explorers switched on their torches.", "switched on their torches"),
  morph("enjoyment", ["enjoy", "ment"], "the feeling or state of enjoying something", "Her smile showed her enjoyment of the music.", "Her smile"),
  morph("impossible", ["im", "possible"], "not possible", "Crossing was impossible because the bridge had been removed.", "bridge had been removed"),
  morph("fearless", ["fear", "less"], "showing little or no fear", "The fearless rescuer entered the dark tunnel without hesitation.", "without hesitation"),
];

const dictionaries = [
  dict("bark", "The rough bark protected the tree trunk.", "noun", 1, [["the outer covering of a tree"], ["the short loud sound made by a dog"]]),
  dict("bat", "At dusk, a bat flew out of the cave.", "noun", 1, [["a flying mammal"], ["a piece of equipment used to hit a ball"]]),
  dict("light", "This empty box is light enough to carry with one hand.", "adjective", 2, [["brightness that lets us see"], ["not heavy"], ["to make something begin to burn"]]),
  dict("fair", "The teacher made a fair decision and listened to both teams.", "adjective", 1, [["reasonable and treating people equally"], ["pale in colour"], ["an outdoor event with rides and stalls"]]),
  dict("wave", "Priya gave a wave as the bus pulled away.", "noun", 2, [["a raised line of moving water"], ["a movement of the hand in greeting"]]),
  dict("bank", "The heron stood on the muddy bank beside the river.", "noun", 2, [["a business that keeps or lends money"], ["the land beside a river"]]),
  dict("spring", "A clear spring bubbled from the hillside.", "noun", 3, [["the season after winter"], ["a coiled piece of metal"], ["a place where water flows naturally from the ground"]]),
  dict("match", "The blue thread was a close match for the fabric.", "noun", 2, [["a small stick used to make a flame"], ["something very similar or suitable"], ["a sports contest"]]),
  dict("pupil", "The pupil checked the glossary before answering.", "noun", 1, [["a learner at school"], ["the dark opening in the centre of the eye"]]),
  dict("trunk", "The elephant lifted its trunk to spray water.", "noun", 2, [["the main woody stem of a tree"], ["the long flexible nose of an elephant"], ["a large storage box"]]),
  dict("jam", "Heavy traffic caused a jam near the bridge.", "noun", 2, [["a sweet fruit spread"], ["a crowded blockage"], ["a difficult situation"]]),
  dict("point", "Maya used the final fact as her strongest point.", "noun", 2, [["a sharp end"], ["an idea or reason in an argument"], ["a mark used in scoring"]]),
];

const phrases = [
  phrase("a blanket of mist", "thick mist spread over an area", "poetry", "The trees at the far edge almost disappeared from view."),
  phrase("butterflies in his stomach", "he felt nervous or excited", "fiction", "As the curtain rose, Ivo took a shaky breath."),
  phrase("her heart sank", "she suddenly felt disappointed or worried", "fiction", "The final bus had already left the empty stop."),
  phrase("time flew", "time seemed to pass very quickly", "fiction", "The craft session ended before Noor felt ready to stop."),
  phrase("a sea of faces", "a very large crowd of people", "fiction", "From the stage, rows of people filled the hall."),
  phrase("the wind whispered", "the wind made a soft, quiet sound", "poetry", "Leaves rustled gently along the hedge."),
  phrase("the fire roared", "the fire burned strongly with a loud sound", "poetry", "Flames leapt and crackled in the fireplace."),
  phrase("raining cats and dogs", "raining extremely heavily", "fiction", "Water drummed on the roof and rushed along the gutters."),
];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "en-y3-vocabulary") throw new Error("This generator only supports the Year 3 vocabulary pack.");
const curated = (pack.question_variants ?? []).filter((v) => !v.id.startsWith(prefix));
const curatedSnapshot = JSON.stringify(curated);
const curatedCounts = countBy(curated, (v) => v.body?.variant_blueprint_id);
const targets = Object.fromEntries(Object.entries(allocation).map(([id, total]) => [id, total - (curatedCounts[id] ?? 0)]));
for (const [id, count] of Object.entries(targets)) if (count < 0) throw new Error(`Curated variants exceed allocation for ${id}.`);

const generated = [
  ...contextCandidates(targets["explicit-context-clues"]),
  ...relationCandidates(targets["synonym-substitution-and-sense"]),
  ...morphologyCandidates(targets["morphology-plus-context"]),
  ...dictionaryCandidates(targets["multiple-meaning-dictionary-selection"]),
  ...retrievalCandidates(targets["vocabulary-spaced-retrieval"]),
];
pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Review-stage Year 3 vocabulary pack with a deterministic 220-variant pilot bank. Five curated variants are unchanged. Generated tasks cover sentence and paragraph context, evidence highlighting, synonyms, antonyms, shades of meaning, precise word choice, age-appropriate morphology and word families, multiple meanings, dictionary and glossary navigation, accessible figurative/idiomatic language, misconception repair and spaced fiction/poetry/non-fiction transfer. Every generated task includes dyslexia/SEND chunking, visual and alternative-input routes, rich corrective feedback and pressure-free word-explorer missions without timers, streaks, lives or loss. Selected passage and phrase read-aloud references ElevenLabs assets held for human listening review; browser TTS is prohibited. Independent English, dictionary, morphology, accessibility, narration and renderer review remains required before promotion.";

validateBank(pack, curated, curatedSnapshot, generated);
enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y3-vocabulary-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y3-vocabulary-bank blueprints=${summary(pack.question_variants, (v) => v.body.variant_blueprint_id)}`);
console.log(`y3-vocabulary-bank formats=${summary(pack.question_variants, (v) => v.format)}`);
console.log(`y3-vocabulary-bank genres=${summary(generated, (v) => v.body.genre ?? "reference")}`);
console.log(`y3-vocabulary-bank concepts=${summary(generated, (v) => v.body.concept_focus)}`);
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y3-vocabulary-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 3 vocabulary bank is out of date; run generate-y3-vocabulary-bank.mjs --write.");
  console.log("y3-vocabulary-bank deterministic check passed");
} else console.log("y3-vocabulary-bank dry-run; pass --write to update the pack");

function contextCandidates(count) {
  const modes = ["context_meaning", "clue_highlight", "clue_type", "contrast_or_result", "paragraph_sense_check", "misconception_repair"];
  return Array.from({ length: count }, (_, i) => {
    const item = contexts[i % contexts.length], mode = modes[i % modes.length];
    if (mode === "clue_highlight" || mode === "clue_type") {
      const answer = item.clues;
      return vocab({ id: `${mode}-${item.word}-${i + 1}`, format: "context-clue-map", blueprint: "explicit-context-clues", band: "developing", concept: mode,
        prompt: `Clue-map mission ${i + 1}: highlight the phrases that support “${item.word}” meaning “${item.meaning}”.`,
        body: { genre: item.genre, passage: item.passage, target_word: item.word, phrase_choices: [...item.clues, "the target word by itself", "an unrelated nearby noun"], clue_phrases: item.clues, clue_type_options: ["action/result", "explanation/example", "contrast", "unrelated detail"] }, answer,
        hints: ["A clue must help test the meaning in this passage.", "Choose phrases that show an action, result, explanation or contrast."], explanation: `${item.clues.join(" and ")} support “${item.meaning}”. Rereading the whole passage confirms the fit.`, correct: "Supporting context phrases highlighted and linked to meaning.", repair: "Hide illustrations, show one sentence at a time and compare one useful phrase with one merely nearby phrase.", tag: "nearby_word_assumed_clue", hook: "context-clue-thread", audioScript: i % 4 === 0 ? item.passage : undefined });
    }
    if (mode === "misconception_repair") {
      const answer = "Read the whole passage, choose a supported meaning, substitute it and reread to check sense.";
      return vocab({ id: `context-repair-${item.word}-${i + 1}`, format: "context-clue-map", blueprint: "explicit-context-clues", band: "expected", concept: mode,
        prompt: `Word-detective repair ${i + 1}: a reader guesses from one picture and ignores the passage. Which routine repairs this?`,
        body: { genre: item.genre, passage: item.passage, target_word: item.word, choices: [answer, "Choose the first familiar association.", "Explain only the picture colours."], routine: ["predict", "find clues", "test", "reread"] }, answer,
        hints: ["A first idea is a prediction, not proof.", "The final meaning must make the complete passage sensible."], explanation: `${answer} Here, ${item.clues.join(" and ")} support “${item.meaning}”.`, correct: "Unsupported-guess misconception repaired with the full routine.", repair: "Preserve the first prediction but label it TEST; add one decisive clue and substitute the meaning before confirming.", tag: "single_word_or_picture_guess", hook: "word-detective-repair" });
    }
    const choices = rotate([item.meaning, ...item.distractors], i % 4);
    return vocab({ id: `${mode}-${item.word}-${i + 1}`, format: "context-clue-map", blueprint: "explicit-context-clues", band: mode === "context_meaning" ? "intro" : "expected", concept: mode,
      prompt: `Context explorer ${i + 1}: what does “${item.word}” mean in this ${item.genre} passage?`,
      body: { genre: item.genre, passage: item.passage, target_word: item.word, choices, clue_phrases: item.clues, reread_check_required: true }, answer: item.meaning,
      hints: ["Read beyond the target word.", `Test your choice against ${item.clues[0]}.`], explanation: `In this passage, “${item.word}” means “${item.meaning}”. The clues ${item.clues.join(" and ")} make that meaning fit.`, correct: "Meaning selected and supported by passage evidence.", repair: "Keep the target and strongest clue visible, reduce to two meanings and reread with each substituted.", tag: "single_word_or_picture_guess", hook: "word-detective-journal", audioScript: i % 4 === 0 ? item.passage : undefined });
  });
}

function relationCandidates(count) {
  const modes = ["synonym_substitution", "antonym_choice", "shade_order", "precise_word_choice", "meaning_sort", "misconception_repair"];
  return Array.from({ length: count }, (_, i) => {
    const item = relationSets[i % relationSets.length], mode = modes[i % modes.length];
    if (mode === "shade_order") {
      const answer = item.shades;
      return vocab({ id: `shade-${item.word}-${i + 1}`, format: "meaning-substitute", blueprint: "synonym-substitution-and-sense", band: "expected", concept: mode,
        prompt: `Meaning-ladder mission ${i + 1}: order these related words from least to most intense.`, body: { words: rotate(item.shades, i % item.shades.length), source_sentence: item.sentence, scale_labels: ["least intense", "middle", "most intense"] }, answer,
        hints: ["All words are related, but their strength differs.", "Imagine the amount or intensity each word suggests."], explanation: `${item.shades.join(" → ")} moves from a milder to a stronger shade of meaning. Context can affect the best choice.`, correct: "Related words ordered by shade of meaning.", repair: "Compare only the mildest and strongest cards first, then place the middle word between them.", tag: "all_synonyms_exactly_equal", hook: "meaning-ladder" });
    }
    if (mode === "antonym_choice") {
      return vocab({ id: `antonym-${item.word}-${i + 1}`, format: "meaning-substitute", blueprint: "synonym-substitution-and-sense", band: "developing", concept: mode,
        prompt: `Opposite-path mission ${i + 1}: which word is an antonym of “${item.word}” in this context?`, body: { source_sentence: item.sentence, target_word: item.word, choices: [item.antonym, item.synonym, item.shades.at(-1)], relationship: "opposite_meaning" }, answer: item.antonym,
        hints: ["An antonym has an opposite meaning.", "Reread the sentence with the opposite to notice the changed meaning."], explanation: `“${item.antonym}” contrasts with “${item.word}” here; “${item.synonym}” is similar instead.`, correct: "Contextual antonym distinguished from synonyms.", repair: "Sort the three cards into SIMILAR and OPPOSITE, then test the opposite in the sentence.", tag: "associated_word_not_antonym", hook: "opposite-path" });
    }
    if (mode === "precise_word_choice") {
      const precise = item.shades[i % item.shades.length], answer = precise;
      const sentence = item.sentence.replace(item.word, "___");
      return vocab({ id: `precise-${item.word}-${i + 1}`, format: "meaning-substitute", blueprint: "synonym-substitution-and-sense", band: "secure", concept: mode,
        prompt: `Author-choice mission ${i + 1}: choose the most precise word for this intended strength: ${sentence}`, body: { sentence_with_gap: sentence, intended_word: precise, choices: rotate(item.shades, i % item.shades.length), intended_shade: i % item.shades.length, accepted_alternatives_note: "Accept another choice only with a context-consistent explanation." }, answer,
        hints: ["Think about strength and manner, not only basic meaning.", "Substitute each choice and compare the picture it creates."], explanation: `“${precise}” gives the intended shade in this item. Nearby alternatives are related but differ in strength or manner.`, correct: "Precise word chosen using shade and sentence fit.", repair: "Show a three-step strength scale, place each option, then reread the sentence with the intended clue highlighted.", tag: "familiar_word_always_best", hook: "author-choice-lens" });
    }
    if (mode === "meaning_sort") {
      const answer = { similar: [item.word, item.synonym], opposite: [item.antonym] };
      return vocab({ id: `sort-${item.word}-${i + 1}`, format: "meaning-substitute", blueprint: "synonym-substitution-and-sense", band: "developing", concept: mode,
        prompt: `Meaning-sort mission ${i + 1}: sort the words by their relationship in this context.`, body: { source_sentence: item.sentence, cards: rotate([item.word, item.synonym, item.antonym], i % 3), trays: ["similar", "opposite"], expected_groups: answer }, answer,
        hints: ["Test each word in the sentence.", "Similar does not always mean identical in every context."], explanation: `“${item.word}” and “${item.synonym}” are similar here; “${item.antonym}” has the opposite meaning.`, correct: "Synonym and antonym relationships sorted contextually.", repair: "Test one card at a time in the source sentence and ask whether the central meaning stays or reverses.", tag: "familiar_association_only", hook: "meaning-sort-trays" });
    }
    if (mode === "misconception_repair") {
      const answer = "A useful synonym must preserve the important meaning and grammar in this sentence, not merely be associated with the topic.";
      return vocab({ id: `relation-repair-${item.word}-${i + 1}`, format: "meaning-substitute", blueprint: "synonym-substitution-and-sense", band: "expected", concept: mode,
        prompt: `Substitution repair ${i + 1}: which rule fixes choosing an associated word as a synonym?`, body: { source_sentence: item.sentence, choices: [answer, "Any word from the same topic is a synonym.", "The longest word is most precise."], test_word: item.synonym }, answer,
        hints: ["Put the proposed word into the exact sentence.", "Check both meaning and grammar."], explanation: `${answer} “${item.synonym}” can preserve the central meaning of “${item.word}” here.`, correct: "Association misconception repaired with substitution.", repair: "Separate TOPIC-RELATED from SAME/SIMILAR MEANING, then reread one replacement in the source slot.", tag: "associated_word_not_synonym", hook: "substitution-repair" });
    }
    return vocab({ id: `synonym-${item.word}-${i + 1}`, format: "meaning-substitute", blueprint: "synonym-substitution-and-sense", band: "developing", concept: mode,
      prompt: `Meaning-swap mission ${i + 1}: which replacement keeps the important meaning of “${item.word}” here?`, body: { source_sentence: item.sentence, target_word: item.word, choices: [item.synonym, item.antonym, item.shades.at(-1)], substituted_sentence: item.sentence.replace(item.word, item.synonym) }, answer: item.synonym,
      hints: ["Substitute each option into the same slot.", "Choose the one that keeps meaning and grammar."], explanation: `“${item.synonym}” is a close synonym for “${item.word}” in this context.`, correct: "Meaning-preserving substitution selected.", repair: "Keep the sentence visible, reduce to synonym versus antonym and reread both versions aloud or silently.", tag: "familiar_association_only", hook: "sentence-meaning-swap" });
  });
}

function morphologyCandidates(count) {
  const modes = ["word_part_build", "root_meaning", "prefix_effect", "suffix_effect", "word_family", "context_confirmation"];
  return Array.from({ length: count }, (_, i) => {
    const item = morphs[i % morphs.length], mode = modes[i % modes.length], root = item.parts.length === 2 ? item.parts[0] : item.parts[1];
    if (mode === "word_family") {
      const family = wordFamily(root), answer = family;
      return vocab({ id: `family-${slug(root)}-${i + 1}`, format: "morphology-context-check", blueprint: "morphology-plus-context", band: "expected", concept: mode,
        prompt: `Word-family mission ${i + 1}: sort the related words built around “${root}”.`, body: { root, family_cards: rotate(family, i % family.length), distractor: unrelatedWord(root), family_definition: "words related through a shared base meaning", source_sentence: item.sentence }, answer,
        hints: ["Look for a shared base and a related meaning.", "A matching letter string without a meaning link is not enough."], explanation: `${family.join(", ")} form an age-appropriate word family around “${root}”; endings or prefixes adjust meaning or word job.`, correct: "Word-family members linked by base and meaning.", repair: "Highlight the shared base in each card and say the central meaning before examining added parts.", tag: "spelling_match_without_meaning", hook: "word-family-tree" });
    }
    if (mode === "context_confirmation") {
      return vocab({ id: `confirm-${item.word}-${i + 1}`, format: "morphology-context-check", blueprint: "morphology-plus-context", band: "secure", concept: mode,
        prompt: `Word-parts evidence mission ${i + 1}: choose the clue that confirms the proposed meaning of “${item.word}”.`, body: { word: item.word, word_parts: item.parts, proposed_meaning: item.meaning, sentence: item.sentence, clue_choices: [item.clue, "the target word alone", "a nearby short word"] }, answer: item.clue,
        hints: ["Word parts suggest a hypothesis.", "Context must confirm or revise the whole-word meaning."], explanation: `${item.parts.join(" + ")} suggests “${item.meaning}”, and “${item.clue}” confirms that meaning in the sentence.`, correct: "Morphology hypothesis confirmed with context.", repair: "Label the parts STARTING CLUE, then highlight the action/result phrase that tests the full meaning.", tag: "word_part_complete_answer", hook: "word-parts-context-lock" });
    }
    if (mode === "prefix_effect" || mode === "suffix_effect") {
      const affix = mode === "prefix_effect" ? item.parts[0] : item.parts.at(-1), answer = affixMeaning(affix);
      return vocab({ id: `${mode}-${item.word}-${i + 1}`, format: "morphology-context-check", blueprint: "morphology-plus-context", band: "expected", concept: mode,
        prompt: `Affix-tool mission ${i + 1}: what starting clue does “${affix}” add in “${item.word}”?`, body: { word: item.word, word_parts: item.parts, affix, choices: [answer, "It gives the full final meaning without context.", "It always changes the word into an animal."], sentence: item.sentence, context_clue: item.clue }, answer,
        hints: ["An affix gives a clue, not always a complete definition.", "Check the result in the sentence."], explanation: `“${affix}” gives the starting clue “${answer}”. Together the parts and context support “${item.meaning}”.`, correct: "Affix contribution separated from whole-word meaning.", repair: "Place ROOT and AFFIX on separate cards, state each contribution, then combine and test against the clue phrase.", tag: "word_part_complete_answer", hook: "affix-tool" });
    }
    if (mode === "root_meaning") {
      return vocab({ id: `root-${item.word}-${i + 1}`, format: "morphology-context-check", blueprint: "morphology-plus-context", band: "developing", concept: mode,
        prompt: `Root-finder mission ${i + 1}: which part carries the central starting idea in “${item.word}”?`, body: { word: item.word, word_parts: item.parts, choices: rotate(item.parts, i % item.parts.length), root, sentence: item.sentence }, answer: root,
        hints: ["Remove familiar prefixes or suffixes.", "The root is a starting clue; context still decides the final meaning."], explanation: `“${root}” carries the central starting idea; the other part or parts adjust it to make “${item.word}”, meaning “${item.meaning}” here.`, correct: "Root identified and kept as a starting clue.", repair: "Bracket the prefix/suffix, leave the base card visible and connect its meaning to the complete sentence.", tag: "word_part_complete_answer", hook: "root-finder" });
    }
    return vocab({ id: `build-${item.word}-${i + 1}`, format: "morphology-context-check", blueprint: "morphology-plus-context", band: "expected", concept: mode,
      prompt: `Word-part builder ${i + 1}: build “${item.word}”, predict its meaning, then check the sentence.`, body: { word: item.word, tiles: rotate([...item.parts, "x"], i % (item.parts.length + 1)), expected_parts: item.parts, sentence: item.sentence, meaning_choices: [item.meaning, "an unrelated familiar meaning", "the root meaning with no affix change"], context_clue: item.clue }, answer: item.parts,
      hints: ["Build the familiar meaningful parts in order.", `Use “${item.clue}” to test the whole-word meaning.`], explanation: `${item.parts.join(" + ")} builds “${item.word}”. The context confirms “${item.meaning}”.`, correct: "Word parts built and meaning checked in context.", repair: "Preserve correctly placed parts, reveal one boundary and compare the predicted meaning with the decisive sentence clue.", tag: "word_part_complete_answer", hook: "word-part-builder" });
  });
}

function dictionaryCandidates(count) {
  const modes = ["numbered_meaning", "definition_substitution", "word_class_check", "guide_word_search", "glossary_skill", "misconception_repair"];
  return Array.from({ length: count }, (_, i) => {
    const item = dictionaries[i % dictionaries.length], mode = modes[i % modes.length], entry = item.definitions.map((d, n) => ({ number: n + 1, definition: d[0] }));
    if (mode === "guide_word_search") {
      const bounds = guideWords(item.word), answer = `between ${bounds[0]} and ${bounds[1]}`;
      return vocab({ id: `guide-${item.word}-${i + 1}`, format: "dictionary-entry-check", blueprint: "multiple-meaning-dictionary-selection", band: "developing", concept: mode,
        prompt: `Dictionary-door mission ${i + 1}: which guide-word page could contain “${item.word}”?`, body: { target_word: item.word, page_choices: [answer, "before aardvark", "after zebra"], guide_words: bounds, alphabet_chunks: item.word.split("") }, answer,
        hints: ["Compare letters from left to right.", "Guide words show the first and last headwords on a page."], explanation: `Alphabetically, “${item.word}” fits ${answer}. Guide words help locate the entry before reading definitions.`, correct: "Dictionary entry located using alphabetical guide words.", repair: "Show one letter column at a time and compare only the target with the two guide words.", tag: "dictionary_page_guess", hook: "dictionary-guide-door" });
    }
    if (mode === "glossary_skill") {
      const answer = entry[item.correct - 1].definition;
      return vocab({ id: `glossary-${item.word}-${i + 1}`, format: "dictionary-entry-check", blueprint: "multiple-meaning-dictionary-selection", band: "expected", concept: mode,
        prompt: `Glossary mission ${i + 1}: a non-fiction glossary gives one topic meaning for “${item.word}”. Which definition matches the source sentence?`, body: { genre: "non-fiction", source_sentence: item.sentence, target_word: item.word, glossary_entries: [{ headword: item.word, definition: answer }, { headword: `${item.word}ly`, definition: "a different entry" }], choices: [answer, "the first familiar association", "a definition from another topic"] }, answer,
        hints: ["Find the headword exactly.", "Check that the glossary meaning makes the source sentence sensible."], explanation: `The glossary definition “${answer}” fits this sentence. A glossary is topic-focused, while a dictionary may list several meanings.`, correct: "Glossary headword and contextual definition matched.", repair: "Highlight the exact headword, read one short definition and substitute it into the source sentence.", tag: "reference_definition_not_checked", hook: "glossary-headword-check" });
    }
    if (mode === "misconception_repair") {
      const answer = "Read every relevant numbered meaning, check word class and substitute each possible meaning into the sentence.";
      return vocab({ id: `dictionary-repair-${item.word}-${i + 1}`, format: "dictionary-entry-check", blueprint: "multiple-meaning-dictionary-selection", band: "secure", concept: mode,
        prompt: `Definition repair ${i + 1}: which routine fixes always choosing definition 1?`, body: { source_sentence: item.sentence, target_word: item.word, entry, word_class: item.wordClass, choices: [answer, "Always choose the shortest definition.", "Ignore the sentence topic and grammar."] }, answer,
        hints: ["A word can have several meanings.", "Context and word class help select the matching one."], explanation: `${answer} Here, definition ${item.correct} fits: “${entry[item.correct - 1].definition}”.`, correct: "First-definition misconception repaired with contextual testing.", repair: "Show one numbered meaning at a time, substitute it and mark FITS or CONFLICTS before choosing.", tag: "first_definition_always", hook: "definition-repair" });
    }
    if (mode === "word_class_check") {
      return vocab({ id: `class-${item.word}-${i + 1}`, format: "dictionary-entry-check", blueprint: "multiple-meaning-dictionary-selection", band: "secure", concept: mode,
        prompt: `Word-job mission ${i + 1}: which word class label helps narrow “${item.word}” in this sentence?`, body: { source_sentence: item.sentence, target_word: item.word, entry, choices: [item.wordClass, item.wordClass === "noun" ? "verb" : "noun", "punctuation"], substitution_check: true }, answer: item.wordClass,
        hints: ["Look at the job the word performs in the sentence.", "Then inspect definitions with that word class."], explanation: `“${item.word}” is used as a ${item.wordClass} here. Definition ${item.correct}, “${entry[item.correct - 1].definition}”, fits.`, correct: "Word class used to narrow multiple meanings.", repair: "Bracket the target in the sentence, identify what it names/describes/does, then reopen only matching entry meanings.", tag: "word_class_ignored", hook: "word-job-label" });
    }
    const answer = mode === "definition_substitution" ? entry[item.correct - 1].definition : item.correct;
    return vocab({ id: `${mode}-${item.word}-${i + 1}`, format: "dictionary-entry-check", blueprint: "multiple-meaning-dictionary-selection", band: "secure", concept: mode,
      prompt: `Dictionary-lab mission ${i + 1}: which numbered meaning of “${item.word}” fits the source sentence?`, body: { source_sentence: item.sentence, target_word: item.word, word_class: item.wordClass, entry, choices: mode === "definition_substitution" ? entry.map((x) => x.definition) : entry.map((x) => x.number), chosen_definition_must_be_paraphrased: true }, answer,
      hints: ["Read all definitions before choosing.", "Substitute each likely definition and reread."], explanation: `Definition ${item.correct}, “${entry[item.correct - 1].definition}”, fits the context and grammar.`, correct: "Numbered meaning selected and checked in context.", repair: "Keep the source sentence visible, compare two definitions at a time and paraphrase the chosen one in simple words.", tag: "first_definition_always", hook: "dictionary-definition-test", audioScript: i % 5 === 0 ? item.sentence : undefined });
  });
}

function retrievalCandidates(count) {
  const modes = ["figurative_phrase", "simple_idiom", "fiction_transfer", "poetry_transfer", "nonfiction_transfer", "precise_choice_transfer", "routine_retrieval", "cross_genre_compare"];
  return Array.from({ length: count }, (_, i) => {
    const mode = modes[i % modes.length], phraseItem = phrases[i % phrases.length], contextItem = contexts[(i * 3) % contexts.length], day = reviewDays[i % reviewDays.length];
    if (mode === "figurative_phrase" || mode === "simple_idiom") {
      return vocab({ id: `${mode}-${slug(phraseItem.text)}-${i + 1}`, format: "phrase-meaning-explain", blueprint: "vocabulary-spaced-retrieval", band: "retrieval", concept: mode,
        prompt: `Phrase-path mission ${i + 1}: what does “${phraseItem.text}” mean in this ${phraseItem.genre} context?`, body: { genre: phraseItem.genre, phrase: phraseItem.text, clue_sentence: phraseItem.clue, choices: [phraseItem.meaning, "the words are all completely literal", "an unrelated feeling"], whole_phrase_bracket: true, review_interval_days: day }, answer: phraseItem.meaning,
        hints: ["Explain the whole phrase rather than each word separately.", `Use the clue: ${phraseItem.clue}`], explanation: `“${phraseItem.text}” means “${phraseItem.meaning}” here. ${phraseItem.clue} supports that reading.`, correct: "Accessible figurative or idiomatic phrase explained with context.", repair: "Place LITERAL and CONTEXTUAL cards side by side, test both against the clue sentence and keep the meaning that makes sense.", tag: "literal_phrase_only", hook: "phrase-meaning-compare", audioScript: i % 3 === 0 ? `${phraseItem.text}. ${phraseItem.clue}` : undefined });
    }
    if (mode === "routine_retrieval") {
      const answer = ["predict", "find clues", "test", "reread"];
      return vocab({ id: `routine-${i + 1}`, format: "phrase-meaning-explain", blueprint: "vocabulary-spaced-retrieval", band: "retrieval", concept: mode,
        prompt: `Word-detective toolkit ${i + 1}: after ${day} days, order the reusable meaning routine.`, body: { cards: rotate(answer, i % answer.length), review_interval_days: day, apply_to_word: contextItem.word, apply_to_passage: contextItem.passage }, answer,
        hints: ["A first meaning is a prediction.", "The final step checks that the whole text still makes sense."], explanation: `Predict → find clues → test → reread is a reusable routine across genres.`, correct: "Vocabulary routine retrieved in a useful order.", repair: "Keep PREDICT first and REREAD last, then place clue collection before testing.", tag: "guess_not_tested", hook: "vocabulary-routine-stamp" });
    }
    if (mode === "precise_choice_transfer") {
      const rel = relationSets[i % relationSets.length], answer = rel.shades.at(-1);
      return vocab({ id: `precise-transfer-${rel.word}-${i + 1}`, format: "phrase-meaning-explain", blueprint: "vocabulary-spaced-retrieval", band: "retrieval", concept: mode,
        prompt: `Revision-lens mission ${i + 1}: choose the strongest precise word for an intense version of this idea: “${rel.sentence}”`, body: { genre: "fiction", source_sentence: rel.sentence, choices: rel.shades, intended_shade: "strongest", review_interval_days: day }, answer,
        hints: ["The words are related but differ in strength.", "Choose the strongest only because this prompt asks for intense meaning."], explanation: `“${answer}” is the strongest option in ${rel.shades.join(", ")}. Another context might need a milder word.`, correct: "Precise word choice transferred using intended shade.", repair: "Rebuild the three-step intensity ladder, then match the requested strength label.", tag: "all_synonyms_exactly_equal", hook: "revision-lens" });
    }
    if (mode === "cross_genre_compare") {
      const other = contexts[(i * 3 + 2) % contexts.length], answer = "Use each passage's own clues; the same routine works, but clue types and language can differ by genre.";
      return vocab({ id: `cross-genre-${i + 1}`, format: "phrase-meaning-explain", blueprint: "vocabulary-spaced-retrieval", band: "secure", concept: mode,
        prompt: `Cross-genre mission ${i + 1}: compare solving “${contextItem.word}” in ${contextItem.genre} with “${other.word}” in ${other.genre}.`, body: { passages: [contextItem.passage, other.passage], targets: [contextItem.word, other.word], genres: [contextItem.genre, other.genre], choices: [answer, "Use the first dictionary definition for every genre.", "Pictures decide every meaning."], review_interval_days: day }, answer,
        hints: ["The evidence routine transfers across genres.", "Poetry may use comparison; non-fiction may explain directly."], explanation: answer, correct: "Vocabulary strategy transferred while respecting genre evidence.", repair: "Use identical PREDICT–CLUE–TEST–REREAD strips beside both passages, then mark the strongest clue in each.", tag: "genre_changes_evidence_rule", hook: "cross-genre-map" });
    }
    const genre = mode.startsWith("fiction") ? "fiction" : mode.startsWith("poetry") ? "poetry" : "non-fiction";
    const selected = contexts.find((x) => x.genre === genre) ?? contextItem;
    return vocab({ id: `${mode}-${selected.word}-${i + 1}`, format: "phrase-meaning-explain", blueprint: "vocabulary-spaced-retrieval", band: "retrieval", concept: mode,
      prompt: `Genre-return mission ${i + 1}: after ${day} days, explain “${selected.word}” in this ${genre} passage and select the strongest clue.`, body: { genre, passage: selected.passage, target_word: selected.word, choices: [selected.meaning, ...selected.distractors], clue_choices: [...selected.clues, "an unrelated detail"], review_interval_days: day }, answer: selected.meaning,
      hints: ["Predict the kind of meaning, then find the decisive clue.", "Substitute and reread before confirming."], explanation: `“${selected.word}” means “${selected.meaning}” here; ${selected.clues.join(" and ")} support it.`, correct: `Contextual meaning transferred successfully in ${genre}.`, repair: "Return to line focus, keep one decisive clue visible and test only two meanings before rereading.", tag: "single_word_or_picture_guess", hook: "genre-return", audioScript: i % 4 === 0 ? selected.passage : undefined });
  });
}

function vocab({ id, format, blueprint, band, concept, prompt, body, answer, hints, explanation, correct, repair, tag, hook, audioScript }) {
  const audio = audioScript ? { audio_required: true, narration_script: audioScript, audio_asset_id: `narration-${prefix}${id}`, audio_provider: "ElevenLabs", audio_asset_status: "required_human_listening_review", human_listening_approval_required: true, browser_tts_allowed: false, browser_tts_fallback: "prohibited", audio_replay_unlimited: true, unavailable_audio_state: "honest_not_ready_keep_text_phrase_list_and_adult_read_route" } : { audio_required: false, audio_route: "not_needed_for_this_visual_word_or_reference_task" };
  const sequence = Array.isArray(answer) && (concept.includes("order") || concept === "word_part_build" || concept === "routine_retrieval");
  return {
    id: `${prefix}${id}`, format,
    body: {
      prompt, ...body, ...audio, concept_focus: concept,
      interaction_mode: "highlight_sort_build_tap_keyboard_switch_eye_gaze_aac_or_adult_scribed",
      supported_interaction: "An adult or peer may read text, scan choices, select the learner's named phrase or record an indicated explanation without supplying the meaning.",
      context_highlight_route: "Select whole clue phrases from a list or passage; no precise mouse highlighting is required.",
      word_part_builder_route: "Large prefix, root and suffix tiles with spoken/text labels and automatic snap; morphology remains a hypothesis until context check.",
      meaning_sort_route: "Static labelled trays for similar, opposite, stronger, weaker, literal or contextual meanings.",
      glossary_dictionary_route: "Predictable heading order, one numbered meaning at a time, expanded abbreviations and substitution check.",
      dyslexia_support: { passage_chunking: true, line_focus: true, adjustable_spacing_and_font: true, phrase_list_selection: true, syllable_safe_word_replay: true, colour_not_required: true, decoding_not_scored: true },
      visual_route: "One target word and clue set per panel, persistent source text, generous spacing and optional removal of decorative pictures.",
      processing_route: "Use fixed PREDICT–CLUE–TEST–REREAD steps, unlimited rereading, reduced choices and preserved evidence selections.",
      motor_alternative: "Tap, keyboard, switch scan, eye gaze, AAC, pointing or adult-scribed choices can replace dragging, speech and handwriting.",
      low_visual_load: true, reduced_motion: "static_steps_and_user_controlled_reveals", preserve_correct_work: true, undo_available: true,
      no_timer: true, speed_score_allowed: false, microphone_required: false, handwriting_required: false, spelling_accuracy_scored: false, retry_without_penalty: true,
      gamification: { mission: "explore a calm word journal and test one meaning clue", reward: "one word-lens stamp for a supported meaning or reference check", lives: false, streaks: false, loss_on_error: false, leaderboard: false, speed_bonus: false, retry_message: "Your useful clues stay. Choose another tool or meaning and continue." },
      difficulty_band: band, evidence_purpose: concept, variant_blueprint_id: blueprint, review_batch: reviewBatch,
    },
    expected_answer: sequence ? { sequence: answer } : { value: answer }, hints, explanation,
    feedback: { correct, repair, language_evidence: explanation, support_message: "Highlighting, sorting, substitution, pointing, eye gaze, AAC and adult-scribed explanations carry equal evidence; decoding speed, spelling and handwriting are not scored." },
    difficulty: band === "intro" ? 3 : band === "developing" ? 4 : band === "expected" ? 5 : band === "secure" ? 6 : 5,
    status: "review", misconception_tag: tag, animation_hook: hook,
  };
}

function validateBank(currentPack, curated, snapshot, generated) {
  if (curated.length !== 5) throw new Error(`Expected 5 curated variants, found ${curated.length}.`);
  if (JSON.stringify(curated) !== snapshot) throw new Error("Curated variants changed during generation.");
  if (currentPack.question_variants.length !== 220 || generated.length !== 215) throw new Error("Pilot must contain 5 curated and 215 generated variants.");
  const ids = currentPack.question_variants.map((v) => v.id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate variant IDs found.");
  const counts = countBy(currentPack.question_variants, (v) => v.body.variant_blueprint_id);
  for (const [id, total] of Object.entries(allocation)) if (counts[id] !== total) throw new Error(`${id} expected ${total}, found ${counts[id] ?? 0}.`);
  const concepts = new Set(generated.map((v) => v.body.concept_focus));
  for (const c of ["context_meaning", "clue_highlight", "paragraph_sense_check", "synonym_substitution", "antonym_choice", "shade_order", "precise_word_choice", "meaning_sort", "word_part_build", "root_meaning", "prefix_effect", "suffix_effect", "word_family", "context_confirmation", "numbered_meaning", "word_class_check", "guide_word_search", "glossary_skill", "figurative_phrase", "simple_idiom", "fiction_transfer", "poetry_transfer", "nonfiction_transfer", "cross_genre_compare"]) if (!concepts.has(c)) throw new Error(`Missing concept ${c}.`);
  for (const genre of ["fiction", "poetry", "non-fiction"]) if (!generated.some((v) => v.body.genre === genre)) throw new Error(`Missing genre ${genre}.`);
  for (const v of generated) {
    const b = v.body;
    if (!b.dyslexia_support?.passage_chunking || !b.context_highlight_route || !b.word_part_builder_route || !b.meaning_sort_route || !b.glossary_dictionary_route || !b.motor_alternative || !b.low_visual_load) throw new Error(`Missing SEND/dyslexia route in ${v.id}.`);
    if (!v.feedback?.correct || !v.feedback?.repair || !v.feedback?.language_evidence) throw new Error(`Missing rich feedback in ${v.id}.`);
    if (!b.no_timer || b.speed_score_allowed || b.gamification?.lives || b.gamification?.streaks || b.gamification?.loss_on_error) throw new Error(`Pressure mechanic in ${v.id}.`);
    if (b.audio_required) {
      if (b.audio_provider !== "ElevenLabs" || b.audio_asset_status !== "required_human_listening_review" || !b.human_listening_approval_required || b.browser_tts_allowed !== false || b.browser_tts_fallback !== "prohibited") throw new Error(`Audio policy failure in ${v.id}.`);
    } else if (b.audio_asset_id || b.audio_provider) throw new Error(`Unnecessary audio reference in ${v.id}.`);
  }
}

function context(word, meaning, genre, passage, clues, distractors) { return { word, meaning, genre, passage, clues, distractors }; }
function relation(word, synonym, antonym, shades, sentence) { return { word, synonym, antonym, shades, sentence }; }
function morph(word, parts, meaning, sentence, clue) { return { word, parts, meaning, sentence, clue }; }
function dict(word, sentence, wordClass, correct, definitions) { return { word, sentence, wordClass, correct, definitions }; }
function phrase(text, meaning, genre, clue) { return { text, meaning, genre, clue }; }
function wordFamily(root) { const known = { help: ["help", "helpful", "helpless", "helpfully"], care: ["care", "careful", "careless", "carefully"], use: ["use", "reuse", "useful", "reusable"], agree: ["agree", "agreement", "disagree", "disagreement"], hope: ["hope", "hopeful", "hopeless", "hopefully"], enjoy: ["enjoy", "enjoyment", "enjoyable"] }; return known[root] ?? [root, `${root}ful`, `${root}less`]; }
function unrelatedWord(root) { return root === "care" ? "carpet" : root === "use" ? "usual" : "garden"; }
function affixMeaning(affix) { return ({ un: "not or opposite", dis: "not, opposite or apart", mis: "wrongly", re: "again", pre: "before", im: "not", ful: "full of or having", less: "without", able: "able to be", ly: "in that way", ness: "state or quality", ment: "result, action or state" })[affix] ?? "a clue that changes the root meaning"; }
function guideWords(word) { const first = `${word.slice(0, Math.max(1, word.length - 1))}a`, last = `${word}z`; return [first, last]; }
function rotate(items, n) { const a = [...items], k = a.length ? n % a.length : 0; return a.slice(k).concat(a.slice(0, k)); }
function slug(text) { return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function countBy(items, fn) { const out = {}; for (const item of items) { const key = fn(item); out[key] = (out[key] ?? 0) + 1; } return out; }
function summary(items, fn) { return Object.entries(countBy(items, fn)).sort(([a], [b]) => String(a).localeCompare(String(b))).map(([k, v]) => `${k}:${v}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
