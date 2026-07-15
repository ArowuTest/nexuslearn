#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/en-y4-grammar-choices.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "en-y4-grammar-choices-bank-";
const reviewBatch = "y4-grammar-choices-depth-pilot-a";
const pilotAllocation = {
  "clear-pronoun-reference": 52,
  "avoid-repetition-with-clarity": 52,
  "repair-ambiguous-pronouns": 52,
  "time-and-cause-link-choices": 52,
  "grammar-choice-retrieval": 52,
};

const referenceCases = [
  ["compass", "Leah checked the compass, then placed it beside the map.", "it", "the compass", "This compass beside me is calibrated.", "This", "the brass compass with the cracked lid"],
  ["shell", "The otter lifted a shell and carried it towards the pool.", "it", "the shell", "That shell across the pool is striped.", "That", "the striped shell from the deep pool"],
  ["seedlings", "Mina watered the seedlings because they were drooping.", "they", "the seedlings", "These seedlings in my tray need shade.", "These", "the young bean seedlings in the blue tray"],
  ["lanterns", "Ravi packed the lanterns before testing them outside.", "them", "the lanterns", "Those lanterns across the room are charged.", "Those", "the two rechargeable lanterns"],
  ["robot", "The robot reached the ramp, but it stopped before the edge.", "it", "the robot", "This robot beside us uses a small motor.", "This", "the silver robot with one square wheel"],
  ["books", "Asha sorted the library books and returned them to the trolley.", "them", "the library books", "Those books on the far trolley are returns.", "Those", "the green library books about wildlife"],
  ["coat", "Sam found the yellow coat and hung it beside the door.", "it", "the yellow coat", "That coat by the door has reflective strips.", "That", "the yellow coat with reflective strips"],
  ["keys", "The caretaker counted the keys before locking them in the cabinet.", "them", "the keys", "These keys in my hand open the storage rooms.", "These", "the labelled storage-room keys"],
  ["parcel", "Jo weighed the parcel, then carried it to the collection desk.", "it", "the parcel", "This parcel beside me needs a label.", "This", "the square parcel tied with green string"],
  ["posters", "The class designed the posters and displayed them in the hall.", "them", "the posters", "Those posters along the far wall explain recycling.", "Those", "the colourful recycling posters"],
  ["telescope", "Nia adjusted the telescope before covering it for the night.", "it", "the telescope", "That telescope near the dome is the largest.", "That", "the large telescope beneath the silver dome"],
  ["bottles", "Omar rinsed the bottles and placed them on the drying rack.", "them", "the bottles", "These bottles beside me are ready to reuse.", "These", "the clean glass bottles on the drying rack"],
  ["kite", "The kite crossed the field until it caught on a low branch.", "it", "the kite", "That kite above the field has a spotted tail.", "That", "the diamond-shaped kite with a spotted tail"],
  ["folders", "Priya labelled the folders before stacking them on the shelf.", "them", "the folders", "Those folders on the top shelf hold the surveys.", "Those", "the blue folders labelled surveys"],
  ["bridge", "The bridge shook in the wind, so the team checked it again.", "it", "the bridge", "This bridge beneath us uses wooden beams.", "This", "the narrow wooden bridge over the stream"],
  ["gloves", "Ivo washed the gloves and left them beside the sink.", "them", "the gloves", "These gloves beside the sink are now clean.", "These", "the thick gardening gloves"],
  ["camera", "The camera recorded the bird until its battery became low.", "its", "the camera's", "This camera beside me needs a new battery.", "This", "the motion-sensor camera near the feeder"],
].map(([id, sentence, pronoun, referent, determinerSentence, determiner, nounPhrase]) => ({ id, sentence, pronoun, referent, determinerSentence, determiner, nounPhrase }));

const repetitionCases = [
  ["dragon", "The dragon opened the gate. The dragon stepped into the cave.", "The dragon opened the gate. It stepped into the cave.", "the tired green dragon", "re-identifies the dragon with useful descriptive detail"],
  ["researcher", "The researcher checked the gauge. The researcher recorded the result.", "The researcher checked the gauge. She recorded the result.", "the careful weather researcher", "reminds the reader which researcher is meant"],
  ["fox", "The fox crossed the path. The fox disappeared beneath the hedge.", "The fox crossed the path. It disappeared beneath the hedge.", "the small red fox", "adds a precise image while keeping the same animal"],
  ["machine", "The machine clicked twice. The machine printed the card.", "The machine clicked twice. It printed the card.", "the ticket-printing machine", "identifies the machine by its purpose"],
  ["guide", "The guide unfolded the map. The guide pointed towards the ridge.", "The guide unfolded the map. They pointed towards the ridge.", "the experienced trail guide", "re-identifies the person without relying on gender"],
  ["boat", "The boat reached the jetty. The boat rocked against the ropes.", "The boat reached the jetty. It rocked against the ropes.", "the narrow wooden boat", "adds a useful physical detail"],
  ["owl", "The owl landed on the post. The owl watched the field.", "The owl landed on the post. It watched the field.", "the pale barn owl", "names the animal more precisely"],
  ["team", "The team tested the model. The team changed one variable.", "The team tested the model. They changed one variable.", "the bridge-design team", "specifies which team is acting"],
  ["train", "The train entered the tunnel. The train slowed near the platform.", "The train entered the tunnel. It slowed near the platform.", "the evening passenger train", "places the train more precisely in the account"],
  ["plant", "The plant leaned towards the window. The plant had broad leaves.", "The plant leaned towards the window. It had broad leaves.", "the broad-leaved bean plant", "combines identifying details into one noun phrase"],
  ["curator", "The curator opened the case. The curator examined the coin.", "The curator opened the case. They examined the coin.", "the museum's coin curator", "clarifies the curator's role"],
  ["dog", "The dog waited beside the stile. The dog lifted one paw.", "The dog waited beside the stile. It lifted one paw.", "the muddy sheepdog", "adds a relevant visual detail"],
  ["parcel", "The parcel arrived on Tuesday. The parcel had no return label.", "The parcel arrived on Tuesday. It had no return label.", "the unlabelled square parcel", "foregrounds the detail important to the problem"],
  ["bell", "The bell swung above the door. The bell rang when visitors entered.", "The bell swung above the door. It rang when visitors entered.", "the brass door bell", "identifies which bell is meant"],
  ["path", "The path curved around the pond. The path became muddy near the gate.", "The path curved around the pond. It became muddy near the gate.", "the narrow pond-side path", "locates the path precisely"],
  ["notebook", "The notebook lay beneath the chair. The notebook contained the measurements.", "The notebook lay beneath the chair. It contained the measurements.", "the missing field notebook", "signals why this notebook matters"],
  ["actor", "The actor checked the prop. The actor walked towards the stage.", "The actor checked the prop. They walked towards the stage.", "the actor playing the explorer", "distinguishes this actor from others"],
].map(([id, repeated, clearEdit, nounPhrase, nounPhraseEffect]) => ({ id, repeated, clearEdit, nounPhrase, nounPhraseEffect }));

const editCases = [
  ["gate", "The team opens the gate and checked the path.", "The team opened the gate and checked the path.", "Before sunrise the team checked the gate.", "Before sunrise, the team checked the gate.", "We was ready to leave.", "We were ready to leave."],
  ["compass", "Maya finds the compass and placed it on the desk.", "Maya found the compass and placed it on the desk.", "After the search Maya labelled the compass.", "After the search, Maya labelled the compass.", "She done the final check.", "She did the final check."],
  ["river", "The river rises and flooded the lower path.", "The river rose and flooded the lower path.", "During the storm the river rose quickly.", "During the storm, the river rose quickly.", "They was watching the gauge.", "They were watching the gauge."],
  ["message", "Owen reads the message and called the office.", "Owen read the message and called the office.", "Owen shouted Wait for me!", "Owen shouted, “Wait for me!”", "I seen the warning earlier.", "I saw the warning earlier."],
  ["robot", "The robot turns left and stopped at the line.", "The robot turned left and stopped at the line.", "When the light flashed the robot stopped.", "When the light flashed, the robot stopped.", "It don't cross the red line.", "It doesn't cross the red line."],
  ["boxes", "Nia lifts the box and carried it upstairs.", "Nia lifted the box and carried it upstairs.", "Beside the stairs three boxes waited.", "Beside the stairs, three boxes waited.", "Them boxes are too heavy.", "Those boxes are too heavy."],
  ["museum", "The guide unlocks the case and removed the cover.", "The guide unlocked the case and removed the cover.", "The guide said Please stand back.", "The guide said, “Please stand back.”", "The coin were inside the case.", "The coin was inside the case."],
  ["rain", "Rain begins and soaked the posters.", "Rain began and soaked the posters.", "Without warning the rain began.", "Without warning, the rain began.", "We could of moved them sooner.", "We could have moved them sooner."],
  ["owl", "The owl lands and watched the field.", "The owl landed and watched the field.", "At midnight the owl left the post.", "At midnight, the owl left the post.", "The owl don't call every night.", "The owl doesn't call every night."],
  ["bridge", "The workers tighten the bolts and tested the bridge.", "The workers tightened the bolts and tested the bridge.", "Before the test the workers checked each bolt.", "Before the test, the workers checked each bolt.", "They should of checked twice.", "They should have checked twice."],
  ["seed", "The seed splits and sent out a root.", "The seed split and sent out a root.", "After several days a root appeared.", "After several days, a root appeared.", "It growed towards the water.", "It grew towards the water."],
  ["concert", "The orchestra tunes and began the piece.", "The orchestra tuned and began the piece.", "Aisha whispered The concert is starting.", "Aisha whispered, “The concert is starting.”", "We was sitting near the front.", "We were sitting near the front."],
  ["trail", "The walkers reach the fork and chose the left path.", "The walkers reached the fork and chose the left path.", "Beyond the old bridge the trail divided.", "Beyond the old bridge, the trail divided.", "This route is more better.", "This route is better."],
  ["parcel", "The courier weighs the parcel and added a label.", "The courier weighed the parcel and added a label.", "On Tuesday morning the parcel arrived.", "On Tuesday morning, the parcel arrived.", "He brung it to the desk.", "He brought it to the desk."],
  ["theatre", "The actor checks the script and walked onstage.", "The actor checked the script and walked onstage.", "The director called Places everyone!", "The director called, “Places, everyone!”", "They was waiting in the wings.", "They were waiting in the wings."],
  ["experiment", "The class measures the liquid and wrote the result.", "The class measured the liquid and wrote the result.", "At the end of the test the class compared results.", "At the end of the test, the class compared results.", "We done three repeats.", "We did three repeats."],
  ["camera", "The camera records the fox and switched off.", "The camera recorded the fox and switched off.", "Near the feeder the camera detected movement.", "Near the feeder, the camera detected movement.", "It had went into sleep mode.", "It had gone into sleep mode."],
].map(([id, inconsistentTense, tenseCorrection, unpunctuated, punctuationCorrection, nonstandard, standard]) => ({ id, inconsistentTense, tenseCorrection, unpunctuated, punctuationCorrection, nonstandard, standard }));

const linkCases = [
  ["flood", "The path was flooded", "the hikers chose a safer route", "cause", "so", "Because the path was flooded, the hikers chose a safer route."],
  ["battery", "The battery was flat", "the lamp stayed dark", "cause", "so", "Because the battery was flat, the lamp stayed dark."],
  ["soil", "The soil felt dry", "Priya watered the plant", "cause", "so", "Because the soil felt dry, Priya watered the plant."],
  ["label", "The label was unclear", "the curator checked the catalogue", "cause", "so", "Because the label was unclear, the curator checked the catalogue."],
  ["wind", "The wind became stronger", "the team lowered the kite", "cause", "so", "Because the wind became stronger, the team lowered the kite."],
  ["museum", "the museum opened", "the guide checked every display", "time", "before", "Before the museum opened, the guide checked every display."],
  ["music", "the music ended", "the dancers froze", "time", "when", "When the music ended, the dancers froze."],
  ["storm", "the storm passed", "the crew inspected the roof", "time", "after", "After the storm passed, the crew inspected the roof."],
  ["timer", "the timer was running", "the group watched for changes", "time", "while", "While the timer was running, the group watched for changes."],
  ["lesson", "the science lesson", "we tested the materials", "time", "during", "During the science lesson, we tested the materials."],
].map(([id, first, second, relationship, linker, fronted]) => ({ id, first, second, relationship, linker, fronted }));

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "en-y4-grammar-choices") throw new Error("This generator only supports the Year 4 grammar choices pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedAllocation = countBy(curated, curatedBlueprint);
const targets = Object.fromEntries(Object.entries(pilotAllocation).map(([id, total]) => [id, total - (curatedAllocation[id] ?? 0)]));
for (const [blueprint, count] of Object.entries(targets)) if (count < 0) throw new Error(`Curated variants exceed ${blueprint}.`);

const candidates = [
  ...referenceCandidates(targets["clear-pronoun-reference"]),
  ...repetitionCandidates(targets["avoid-repetition-with-clarity"]),
  ...editCandidates(targets["repair-ambiguous-pronouns"]),
  ...linkCandidates(targets["time-and-cause-link-choices"]),
  ...retrievalCandidates(targets["grammar-choice-retrieval"]),
];

pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.adaptive_support.audio_first = "Optional sentence-level narration uses only ElevenLabs assets after human listening approval. Browser TTS is prohibited; punctuation tasks use neutral or delayed playback when intonation could reveal the answer, and every item remains fully solvable from visible text.";
pack.qa.notes = "Review-stage Year 4 grammar choices pack with a deterministic 260-item pilot bank and five preserved curated variants. The bank develops tense consistency, pronouns and determiners, punctuation, noun phrases, adverbials, Standard English, purposeful sentence choices and meaning effects alongside cohesion. Generated candidates include SEND and dyslexia scaffolds, optional human-reviewed ElevenLabs references with browser TTS prohibited, supported interactions, rich editing feedback and untimed editor missions. Independent English, teacher, accessibility, safeguarding, audio and renderer review remain required before promotion.";
validateBank(pack, curated, candidates);

console.log(`y4-grammar-choices-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`y4-grammar-choices-bank blueprints=${allocationSummary(curated, candidates)}`);
console.log(`y4-grammar-choices-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y4-grammar-choices-bank bands=${summary(candidates, (variant) => variant.body.difficulty_band)}`);
console.log(`y4-grammar-choices-bank strands=${summary(candidates, (variant) => variant.body.grammar_strand)}`);

enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y4-grammar-choices-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 4 grammar choices bank is out of date; run generate-y4-grammar-choices-bank.mjs --write.");
  console.log("y4-grammar-choices-bank deterministic check passed");
} else {
  console.log("y4-grammar-choices-bank dry-run; pass --write to update the pack");
}

function referenceCandidates(count) {
  const variants = [];
  for (const item of referenceCases) {
    variants.push(choiceVariant({ id: `reference-${item.id}`, format: "pronoun-cohesion-choice", blueprint: "clear-pronoun-reference", strand: "pronouns", stage: "identify_clear_referent", prompt: `In '${item.sentence}', what does '${item.pronoun}' refer to?`, answer: item.referent, choices: [item.referent, "the person doing the action", "the final place in the sentence", "the action word"], hints: ["Ask who or what receives the action.", `Replace '${item.pronoun}' with each choice and reread.`], explanation: `'${item.pronoun}' refers to ${item.referent}; that replacement preserves the sentence meaning.`, purpose: "pronoun_referent_identification", misconception: "unclear_pronoun_reference", body: { sentence: item.sentence, pronoun: item.pronoun, referent: item.referent } }));
    variants.push(choiceVariant({ id: `determiner-${item.id}`, format: "pronoun-cohesion-choice", blueprint: "clear-pronoun-reference", strand: "determiners", stage: "choose_demonstrative_determiner", prompt: `Complete the sentence: '${item.determinerSentence.replace(item.determiner, "___")}'`, answer: item.determiner, choices: [item.determiner, item.determiner === "This" ? "That" : item.determiner === "That" ? "This" : item.determiner === "These" ? "Those" : "These", "Every", "An"], hints: ["Check whether the noun is singular or plural.", "Use the distance clue in the sentence."], explanation: `'${item.determiner}' agrees with the noun and matches whether the item is near or farther away.`, purpose: "determiner_number_and_distance", misconception: "determiner_agreement", body: { sentence: item.determinerSentence, determiner: item.determiner } }));
    variants.push(choiceVariant({ id: `meaning-${item.id}`, format: "pronoun-cohesion-choice", blueprint: "clear-pronoun-reference", strand: "meaning_effects", stage: "compare_pronoun_and_noun_phrase_effect", prompt: `Two objects could be meant by '${item.pronoun}'. Which choice restores precise meaning?`, answer: item.nounPhrase, choices: [item.nounPhrase, item.pronoun, "that thing", "something nearby"], hints: ["Choose words that identify one exact noun.", "A short pronoun is not helpful if two referents are possible."], explanation: `'${item.nounPhrase}' re-identifies the intended noun precisely, while the pronoun could leave the reader guessing.`, purpose: "reference_meaning_effect", misconception: "unclear_pronoun_reference", body: { ambiguous_pronoun: item.pronoun, precise_noun_phrase: item.nounPhrase } }));
  }
  return variants.slice(0, count);
}

function repetitionCandidates(count) {
  const variants = [];
  for (const item of repetitionCases) {
    variants.push(choiceVariant({ id: `repetition-${item.id}`, format: "noun-pronoun-repair", blueprint: "avoid-repetition-with-clarity", strand: "pronouns", stage: "avoid_repetition_clearly", prompt: `Editor proof: choose the clearest edit for '${item.repeated}'`, answer: item.clearEdit, choices: [item.clearEdit, item.repeated, item.repeated.replaceAll(/The |the /g, "It "), "Replace every noun with 'it'."], hints: ["Remove one unnecessary repeat.", "Keep a pronoun only when its referent is clear."], explanation: `${item.clearEdit} avoids repetition and still makes the actor or object clear.`, purpose: "clear_pronoun_repetition_repair", misconception: "over_repeats_noun", body: { original: item.repeated, edited: item.clearEdit } }));
    variants.push(choiceVariant({ id: `noun-phrase-${item.id}`, format: "noun-pronoun-repair", blueprint: "avoid-repetition-with-clarity", strand: "noun_phrases", stage: "choose_precise_noun_phrase", prompt: `Which noun phrase adds useful identifying detail?`, answer: item.nounPhrase, choices: [item.nounPhrase, "the nice amazing thing", "it quickly", "because the object"], hints: ["Keep detail that helps identify the noun.", "Reject vague praise and words that do not form a noun phrase."], explanation: `'${item.nounPhrase}' is grammatical and adds precise identifying detail rather than an adjective pile.`, purpose: "purposeful_noun_phrase_choice", misconception: "vague_noun_phrase", body: { noun_phrase: item.nounPhrase } }));
    variants.push(choiceVariant({ id: `effect-${item.id}`, format: "noun-pronoun-repair", blueprint: "avoid-repetition-with-clarity", strand: "meaning_effects", stage: "explain_noun_phrase_effect", prompt: `What is the main effect of using '${item.nounPhrase}' instead of a bare pronoun here?`, answer: item.nounPhraseEffect, choices: [item.nounPhraseEffect, "it makes every sentence shorter regardless of clarity", "it changes the event into the future tense", "it removes the noun from the reader's attention"], hints: ["Ask what information the noun phrase gives.", "Focus on clarity and meaning, not word count alone."], explanation: `The noun phrase ${item.nounPhraseEffect}; this is a purposeful meaning effect rather than repetition for its own sake.`, purpose: "noun_phrase_meaning_effect", misconception: "shorter_is_always_clearer", body: { noun_phrase: item.nounPhrase, meaning_effect: item.nounPhraseEffect } }));
  }
  return variants.slice(0, count);
}

function editCandidates(count) {
  const variants = [];
  for (const item of editCases) {
    variants.push(choiceVariant({ id: `tense-${item.id}`, format: "cohesion-edit", blueprint: "repair-ambiguous-pronouns", strand: "tense", stage: "repair_tense_consistency", prompt: `Which edit keeps the sentence consistently in the past tense? Original: '${item.inconsistentTense}'`, answer: item.tenseCorrection, choices: [item.tenseCorrection, item.inconsistentTense, item.tenseCorrection.replace(/ed\b/g, "s"), "Change only the final punctuation."], hints: ["Find both verb phrases.", "Make both actions belong to the same past-time sequence."], explanation: `'${item.tenseCorrection}' uses compatible past-tense verbs, so the timeline remains clear.`, purpose: "tense_consistency_edit", misconception: "shifts_tense_unnecessarily", body: { original: item.inconsistentTense, edited: item.tenseCorrection, intended_tense: "past" } }));
    variants.push(choiceVariant({ id: `punctuation-${item.id}`, format: "cohesion-edit", blueprint: "repair-ambiguous-pronouns", strand: "punctuation", stage: "repair_punctuation_for_clarity", prompt: `Which punctuation edit is correct? Original: '${item.unpunctuated}'`, answer: item.punctuationCorrection, choices: [item.punctuationCorrection, item.unpunctuated, `${item.unpunctuated},`, item.unpunctuated.replace(/ /, "; ")], hints: ["Identify whether the sentence opens with an adverbial or contains direct speech.", "Use punctuation to show the sentence structure."], explanation: `'${item.punctuationCorrection}' marks the grammatical boundary clearly and helps the reader group the sentence correctly.`, purpose: "punctuation_clarity_edit", misconception: "punctuation_by_pause_only", body: { original: item.unpunctuated, edited: item.punctuationCorrection } }));
    variants.push(choiceVariant({ id: `standard-${item.id}`, format: "cohesion-edit", blueprint: "repair-ambiguous-pronouns", strand: "standard_english", stage: "choose_standard_english_form", prompt: `Choose the Standard English form for formal writing: '${item.nonstandard}'`, answer: item.standard, choices: [item.standard, item.nonstandard, item.standard.replace(/\.$/, " and."), "Leave out the verb completely."], hints: ["Check the verb form and subject agreement.", "Choose the form expected in Standard English writing."], explanation: `'${item.standard}' uses the Standard English verb or determiner form while preserving the intended meaning.`, purpose: "standard_english_choice", misconception: "nonstandard_form_in_formal_writing", body: { nonstandard: item.nonstandard, standard: item.standard } }));
  }
  return variants.slice(0, count);
}

function linkCandidates(count) {
  const variants = [];
  for (const item of linkCases) {
    const joined = item.relationship === "cause" ? `${item.first}, ${item.linker} ${item.second}.` : `${capitalise(item.linker)} ${item.first}, ${item.second}.`;
    const adverbial = item.relationship === "cause" ? `Because ${item.first.toLowerCase()}` : `${capitalise(item.linker)} ${item.first}`;
    const linkAnswer = item.relationship === "cause" ? item.linker : capitalise(item.linker);
    const linkPrompt = item.relationship === "cause" ? `Choose the best link: ${item.first}, ___ ${item.second}.` : `Choose the best opening: ___ ${item.first}, ${item.second}.`;
    const linkChoices = item.relationship === "cause"
      ? [item.linker, ...["during", "although", "meanwhile", "before"].filter((choice) => choice !== item.linker)].slice(0, 4)
      : [capitalise(item.linker), ...["Because", "Although", "Therefore", "So"].filter((choice) => choice !== capitalise(item.linker))].slice(0, 4);
    const tasks = [
      ["link", "sentence_choices", "choose_logical_link", linkPrompt, linkAnswer, linkChoices, `'${linkAnswer}' accurately signals the ${item.relationship} relationship between the ideas.`, "logical_link_choice"],
      ["fronted", "adverbials", "build_fronted_adverbial", `Which fronted adverbial accurately introduces the sentence?`, adverbial, [adverbial, "Without any relationship", "Very amazingly", "The result quickly"], `${adverbial} tells the reader ${item.relationship === "cause" ? "why the result happened" : "when the event happened"}.`, "fronted_adverbial_choice"],
      ["comma", "punctuation", "punctuate_fronted_adverbial", `Which sentence correctly punctuates the opening adverbial?`, item.fronted, [item.fronted, item.fronted.replace(",", ""), item.fronted.replace(",", ";"), `${item.fronted},`], `The comma after the fronted adverbial marks where the main clause begins.`, "fronted_adverbial_comma"],
      ["effect", "meaning_effects", "explain_link_meaning_effect", `What meaning does '${item.linker}' add in this sentence? ${joined}`, item.relationship === "cause" ? "It shows that the second event is a result of the first" : "It places the events in a clear time relationship", [item.relationship === "cause" ? "It shows that the second event is a result of the first" : "It places the events in a clear time relationship", "It makes the sentence louder", "It changes both nouns into pronouns", "It removes the order or reason"], `The linker makes the intended ${item.relationship} relationship explicit for the reader.`, "link_meaning_effect"],
      ["choice", "sentence_choices", "compare_sentence_choices", `Which sentence choice preserves the intended ${item.relationship} relationship?`, item.fronted, [item.fronted, `${item.second}. ${capitalise(item.first)}.`, `${item.first}, although ${item.second}.`, `${item.first} and perhaps something unrelated.`], `'${item.fronted}' orders the clauses and names the intended relationship without adding a contradiction.`, "purposeful_sentence_choice"],
    ];
    for (const [id, strand, stage, prompt, answer, choices, explanation, purpose] of tasks) variants.push(choiceVariant({ id: `link-${item.id}-${id}`, format: "time-cause-link-choice", blueprint: "time-and-cause-link-choices", strand, stage, prompt: `Editor bridge: ${prompt}`, answer, choices, hints: ["Name the relationship before choosing.", "Reread the complete sentence and reject choices that change the meaning."], explanation, purpose, misconception: "linker_without_logic", body: { first_idea: item.first, second_idea: item.second, relationship: item.relationship, linker: item.linker, completed_sentence: item.fronted } }));
  }
  return variants.slice(0, count);
}

function retrievalCandidates(count) {
  const variants = [];
  for (let index = 0; index < 13; index += 1) {
    const ref = referenceCases[index]; const rep = repetitionCases[index]; const edit = editCases[index]; const link = linkCases[index % linkCases.length];
    variants.push(choiceVariant({ id: `retrieval-reference-${ref.id}`, format: "tap-choice", blueprint: "grammar-choice-retrieval", strand: "pronouns", stage: "spaced_pronoun_reference", prompt: `Quick edit: in '${ref.sentence}', what does '${ref.pronoun}' mean?`, answer: ref.referent, choices: [ref.referent, "the nearest noun regardless of meaning", "the place", "the action"], hints: ["Replace the pronoun and reread.", "Choose the noun that preserves meaning."], explanation: `'${ref.pronoun}' points to ${ref.referent}; the other choices do not fit the action.`, purpose: "spaced_pronoun_reference", misconception: "unclear_pronoun_reference", body: { review_interval_days: [1, 3, 7, 14, 30][index % 5] } }));
    variants.push(choiceVariant({ id: `retrieval-punctuation-${edit.id}`, format: "tap-choice", blueprint: "grammar-choice-retrieval", strand: "punctuation", stage: "spaced_punctuation_edit", prompt: `Quick edit: choose the correctly punctuated sentence for '${edit.unpunctuated}'.`, answer: edit.punctuationCorrection, choices: [edit.punctuationCorrection, edit.unpunctuated, `${edit.unpunctuated},`, edit.unpunctuated.replace(/ /, "; ")], hints: ["Find the clause or speech boundary.", "Choose punctuation that makes the structure visible."], explanation: `'${edit.punctuationCorrection}' uses punctuation to show the intended grammatical grouping.`, purpose: "spaced_punctuation_choice", misconception: "punctuation_by_pause_only", body: { review_interval_days: [1, 3, 7, 14, 30][(index + 1) % 5] } }));
    variants.push(choiceVariant({ id: `retrieval-standard-${edit.id}`, format: "tap-choice", blueprint: "grammar-choice-retrieval", strand: index % 2 ? "standard_english" : "tense", stage: "spaced_standard_or_tense_edit", prompt: index % 2 ? `Quick edit: choose the Standard English form of '${edit.nonstandard}'.` : `Quick edit: repair the tense in '${edit.inconsistentTense}'.`, answer: index % 2 ? edit.standard : edit.tenseCorrection, choices: index % 2 ? [edit.standard, edit.nonstandard, "Remove the verb", "Add an unrelated adverb"] : [edit.tenseCorrection, edit.inconsistentTense, "Move the full stop", "Change both nouns"], hints: ["Check the verb form.", "Preserve the intended meaning and timeline."], explanation: index % 2 ? `'${edit.standard}' is the Standard English form for this formal sentence.` : `'${edit.tenseCorrection}' keeps the actions on one clear past timeline.`, purpose: "spaced_form_choice", misconception: index % 2 ? "nonstandard_form_in_formal_writing" : "shifts_tense_unnecessarily", body: { review_interval_days: [1, 3, 7, 14, 30][(index + 2) % 5] } }));
    variants.push(choiceVariant({ id: `retrieval-effect-${rep.id}`, format: "tap-choice", blueprint: "grammar-choice-retrieval", strand: index % 2 ? "noun_phrases" : "adverbials", stage: "spaced_meaning_effect", prompt: index % 2 ? `In the ${rep.id} edit, which choice identifies the noun precisely?` : `In the ${rep.id} edit, which opening clearly signals the ${link.relationship} relationship?`, answer: index % 2 ? rep.nounPhrase : (link.relationship === "cause" ? `Because ${link.first.toLowerCase()}` : `${capitalise(link.linker)} ${link.first}`), choices: index % 2 ? [rep.nounPhrase, "the nice thing", "it somehow", "because it"] : [link.relationship === "cause" ? `Because ${link.first.toLowerCase()}` : `${capitalise(link.linker)} ${link.first}`, "Very suddenly", "The object", "Without a clear link"], hints: ["Choose grammar that helps the reader follow meaning.", "Reject vague or structurally incomplete choices."], explanation: index % 2 ? `'${rep.nounPhrase}' gives precise identifying detail and helps the reader track the intended noun.` : `The opening names the intended ${link.relationship} relationship before the main clause, helping the reader connect the ideas.`, purpose: "spaced_meaning_choice", misconception: "choice_without_meaning", body: { review_interval_days: [1, 3, 7, 14, 30][(index + 3) % 5] } }));
  }
  return variants.slice(0, count);
}

function choiceVariant({ id, format, blueprint, strand, stage, prompt, answer, choices, hints, explanation, purpose, misconception, body }) {
  const fullId = `${prefix}${id}`;
  const band = bandFor(blueprint, stage);
  return {
    id: fullId,
    format,
    body: {
      prompt,
      choices: rotate(unique(choices), fullId.length % choices.length),
      ...body,
      grammar_strand: strand,
      coverage_tags: coverageFor(strand),
      conceptual_progression: stage,
      difficulty_band: band,
      evidence_purpose: purpose,
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
      response_mode: "tap_keyboard_switch_typed_oral_or_partner_recorded",
      interaction_support: { keyboard: true, switch_scan: true, touch: true, typed: true, oral_or_partner_recording: true, drag_required: false, undo_available: true },
      send_scaffolds: { one_edit_per_screen: true, sentence_chunking: true, noun_pronoun_threads: true, tense_timeline: true, punctuation_overlay: true, no_time_limit: true },
      dyslexia_support: { increased_spacing: true, adjustable_line_length: true, tinted_background_option: true, readable_font_option: true, line_focus: true, morpheme_safe_highlighting: true },
      reduced_visual_load: true,
      static_alternative: "numbered sentence and edit cards with before-and-after text; no drag, animation or colour distinction required",
      reduced_motion_alternative: "instant before-and-after edit panels with persistent labels",
      audio_optional: true,
      audio_asset_id: `narration-${fullId}`,
      audio_provider: "ElevenLabs",
      audio_asset_status: "required_human_listening_review",
      human_listening_approval_required: true,
      browser_tts_allowed: false,
      punctuation_audio_reveal_policy: strand === "punctuation" ? "neutral_or_after_first_attempt" : "not_applicable",
      editor_mission: missionFor(strand, stage, fullId),
      pressure_rules: { timer: false, speed_score: false, streak_loss: false, lives: false, public_ranking: false, retry_cost: false },
    },
    expected_answer: { value: answer },
    hints,
    explanation,
    feedback: { correct: `Edit accepted: ${purpose.replaceAll("_", " ")}.`, repair: repairFor(strand), meaning_check: "Reread the full sentence and explain what changed for the reader.", distractor_check: "Reject edits that alter the intended tense, reference, relationship or meaning.", retry: "The draft keeps every useful choice. Reopen one editor tool and try again without a timer or penalty." },
    difficulty: difficultyFor(band),
    status: "review",
    misconception_tag: misconception,
    animation_hook: animationFor(strand),
  };
}

function missionFor(strand, stage, id) {
  const desks = { tense: "Timeline Desk", pronouns: "Reference Room", determiners: "Determiner Lens", punctuation: "Punctuation Press", noun_phrases: "Noun-Phrase Studio", adverbials: "Adverbial Map", standard_english: "Register Desk", sentence_choices: "Sentence Assembly", meaning_effects: "Meaning Lens" };
  const tools = { tense: "place every verb on one intended timeline", pronouns: "trace each pronoun to one clear noun", determiners: "check number and near/far reference", punctuation: "mark the grammatical boundary, not just a breath", noun_phrases: "keep precise identifying detail", adverbials: "name time or cause before choosing the opening", standard_english: "check subject agreement and the formal verb form", sentence_choices: "name the relationship before selecting a structure", meaning_effects: "compare what each edit makes clearer, stronger or different" };
  return { campaign: "The Living Draft: Restore the Editor's Atlas", desk: desks[strand], mission_code: id.slice(-30), objective: `Complete the ${stage.replaceAll("_", " ")} edit while preserving intended meaning.`, strategic_tool: tools[strand], editorial_protocol: ["read for intended meaning", "identify the grammar choice", "test the complete sentence", "explain the effect on the reader"], reward: { item: "atlas proof seal", earned_for: "using an editor strategy or completing a repair", effect: "restores a page route without increasing speed, pressure or difficulty" }, retry_protocol: "No lives, pages or progress are lost; the workbench preserves useful edits and opens a targeted reader-clarity hint." };
}

function validateBank(packData, curatedItems, generated) {
  const pilot = packData.practice.variant_targets.pilot;
  if (curatedItems.length !== 5) throw new Error(`Expected five curated variants, found ${curatedItems.length}.`);
  if (generated.length !== pilot - curatedItems.length || curatedItems.length + generated.length !== pilot) throw new Error(`Pilot bank must contain exactly ${pilot} variants.`);
  const blueprintMap = new Map(packData.variant_blueprints.map((item) => [item.id, item]));
  const ids = new Set(); const signatures = new Set(); const coverage = new Set(); const formats = new Set(); const blueprints = new Set(); const bands = new Set();
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
    if (!variant.body.send_scaffolds?.one_edit_per_screen || !variant.body.dyslexia_support?.line_focus || variant.body.reduced_visual_load !== true) throw new Error(`${variant.id} lacks SEND/dyslexia scaffolds.`);
    if (variant.body.audio_provider !== "ElevenLabs" || variant.body.audio_asset_status !== "required_human_listening_review" || variant.body.human_listening_approval_required !== true || variant.body.browser_tts_allowed !== false) throw new Error(`${variant.id} violates audio policy.`);
    if (Object.values(variant.body.pressure_rules).some((value) => value !== false) || !/No lives/.test(variant.body.editor_mission?.retry_protocol) || !variant.body.editor_mission?.strategic_tool) throw new Error(`${variant.id} lacks low-pressure editor missions.`);
    if (!variant.feedback?.repair || !variant.feedback?.meaning_check || !variant.feedback?.distractor_check || !variant.feedback?.retry || variant.hints.length < 2 || variant.explanation.length < 55) throw new Error(`${variant.id} lacks feedback.`);
    for (const tag of variant.body.coverage_tags) coverage.add(tag);
    formats.add(variant.format); blueprints.add(variant.body.variant_blueprint_id); bands.add(variant.body.difficulty_band);
  }
  const allocation = combinedAllocation(curatedItems, generated);
  for (const [blueprint, expected] of Object.entries(pilotAllocation)) if (allocation[blueprint] !== expected) throw new Error(`${blueprint} expected ${expected}, found ${allocation[blueprint] ?? 0}.`);
  assertCovered("formats", new Set(packData.practice.formats), formats);
  assertCovered("blueprints", new Set(blueprintMap.keys()), blueprints);
  assertCovered("difficulty bands", new Set([...packData.practice.difficulty_bands, ...packData.variant_blueprints.map((item) => item.difficulty_band)]), bands);
  assertCovered("grammar coverage", new Set(["tense", "pronouns", "determiners", "punctuation", "noun_phrases", "adverbials", "standard_english", "sentence_choices", "meaning_effects"]), coverage);
}

function coverageFor(strand) { return [strand]; }
function bandFor(blueprint, stage) { if (blueprint === "clear-pronoun-reference") return stage.includes("identify") ? "intro" : "developing"; if (blueprint === "avoid-repetition-with-clarity") return stage.includes("effect") ? "expected" : "developing"; if (blueprint === "repair-ambiguous-pronouns") return stage.includes("punctuation") || stage.includes("standard") ? "secure" : "expected"; if (blueprint === "time-and-cause-link-choices") return stage.includes("effect") || stage.includes("compare") ? "stretch" : "secure"; return "retrieval"; }
function difficultyFor(band) { return { intro: 3, developing: 4, expected: 5, secure: 7, stretch: 8, retrieval: 5 }[band]; }
function repairFor(strand) { return ({ tense: "Place each verb on a past, present or future timeline and make the sequence consistent.", pronouns: "Draw a reference line from the pronoun to one noun; if two lines are possible, restore a name or noun phrase.", determiners: "Check singular or plural first, then use the near/far clue to choose this, that, these or those.", punctuation: "Identify the grammatical boundary or speech first, then add only the punctuation that marks it.", noun_phrases: "Keep details that identify the noun and remove vague praise or words that do not belong in the phrase.", adverbials: "Name the time or cause relationship, build the opening phrase and mark it with a comma.", standard_english: "Check subject–verb agreement and choose the Standard English form while preserving meaning.", sentence_choices: "State the intended relationship, then test each complete sentence against it.", meaning_effects: "Compare both versions and explain what becomes clearer or more precise for the reader." })[strand]; }
function animationFor(strand) { return ({ tense: "tense-timeline-align", pronouns: "pronoun-thread-scan", determiners: "determiner-distance-lens", punctuation: "punctuation-boundary-mark", noun_phrases: "noun-phrase-detail-build", adverbials: "adverbial-route-map", standard_english: "register-choice-check", sentence_choices: "sentence-bridge-lock", meaning_effects: "meaning-lens-compare" })[strand]; }
function curatedBlueprint(variant) { const map = { "en-y4-grammar-choices-q-pronoun-clear-otter": "clear-pronoun-reference", "en-y4-grammar-choices-q-avoid-dragon-repeat": "avoid-repetition-with-clarity", "en-y4-grammar-choices-q-ambiguous-she": "repair-ambiguous-pronouns", "en-y4-grammar-choices-q-cause-link": "time-and-cause-link-choices", "en-y4-grammar-choices-q-time-preposition": "time-and-cause-link-choices" }; const value = map[variant.id]; if (!value) throw new Error(`No curated blueprint assignment for ${variant.id}.`); return value; }
function combinedAllocation(curatedItems, generated) { const counts = countBy(curatedItems, curatedBlueprint); for (const variant of generated) counts[variant.body.variant_blueprint_id] = (counts[variant.body.variant_blueprint_id] ?? 0) + 1; return counts; }
function allocationSummary(curatedItems, generated) { return Object.entries(combinedAllocation(curatedItems, generated)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function assertCovered(label, required, actual) { const missing = [...required].filter((value) => !actual.has(value)); if (missing.length) throw new Error(`Missing ${label}: ${missing.join(", ")}.`); }
function countBy(items, keyFor) { const counts = {}; for (const item of items) { const key = keyFor(item); counts[key] = (counts[key] ?? 0) + 1; } return counts; }
function summary(items, keyFor) { return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function unique(items) { return [...new Set(items)]; }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function capitalise(value) { return `${value.charAt(0).toUpperCase()}${value.slice(1)}`; }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
