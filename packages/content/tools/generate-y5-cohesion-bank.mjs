#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/en-y5-cohesion.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "en-y5-cohesion-bank-";
const pilotTarget = 240;
const reviewBatch = "wave-six";

if (write && check) throw new Error("Choose either --write or --check, not both.");

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "en-y5-cohesion") throw new Error("This generator only supports the Year 5 cohesion pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 4) throw new Error(`Expected exactly 4 curated variants, found ${curated.length}. Refusing to overwrite possible authored work.`);

const contexts = [
  { key: "roof-garden", place: "roof garden", name: "Mina", group: "garden team", item: "water tank", topic: "rainwater system" },
  { key: "museum", place: "local museum", name: "Tomas", group: "curators", item: "model boat", topic: "harbour display" },
  { key: "wetland", place: "wetland reserve", name: "Ari", group: "survey team", item: "field notebook", topic: "bird survey" },
  { key: "library", place: "community library", name: "Zara", group: "reading group", item: "story map", topic: "local-history exhibition" },
  { key: "workshop", place: "repair workshop", name: "Noor", group: "design team", item: "solar lantern", topic: "energy project" },
  { key: "trail", place: "woodland trail", name: "Leo", group: "route planners", item: "direction sign", topic: "accessible path" },
];

const paragraphItems = [
  { key: "cause-result", first: "The {group} found that the {item} had been damaged overnight.", second: "They changed the plan and inspected the remaining equipment.", relationship: "cause and result", answer: "For this reason,", choices: ["For this reason,", "Meanwhile,", "For example,", "In the distance,"] },
  { key: "contrast", first: "The first proposal for the {topic} was inexpensive.", second: "It did not provide enough space for visitors.", relationship: "contrast", answer: "However,", choices: ["However,", "Therefore,", "Similarly,", "Earlier,"] },
  { key: "addition", first: "The new plan gives clear information about the {topic}.", second: "It includes a quiet area at the {place}.", relationship: "addition", answer: "In addition,", choices: ["In addition,", "As a result,", "On the other hand,", "Previously,"] },
  { key: "example", first: "Several changes could make the {place} easier to use.", second: "Lower labels would help children read about the {item}.", relationship: "general point followed by an example", answer: "For example,", choices: ["For example,", "Consequently,", "Nevertheless,", "At the same time,"] },
  { key: "later-time", first: "In spring, the {group} agreed the design for the {topic}.", second: "In July, {name} checked the completed work.", relationship: "later time", answer: "Several months later,", choices: ["Several months later,", "For this reason,", "In contrast,", "Nearby,"] },
  { key: "place-shift", first: "Inside the {place}, visitors studied the {item}.", second: "Outside, the {group} tested a new route.", relationship: "change of place", answer: "Beyond the building,", choices: ["Beyond the building,", "Therefore,", "Nevertheless,", "Firstly,"] },
  { key: "no-link", first: "The {group} recorded each stage of the {topic}.", second: "The photographs provide a clear record of the work.", relationship: "a direct continuation needing no extra signpost", answer: "No added linking phrase", choices: ["No added linking phrase", "Nevertheless,", "On the contrary,", "Five years earlier,"] },
  { key: "similarity", first: "The older {item} used a simple wooden frame.", second: "The replacement also uses a lightweight frame.", relationship: "similarity", answer: "Similarly,", choices: ["Similarly,", "Instead,", "As a consequence,", "Finally,"] },
];

const referenceItems = [
  { key: "this-system", text: "The {group} fitted channels that carried rain into the {item}. This system reduced the amount of mains water needed.", reference: "This system", answer: "the channels carrying rain into the item", choices: ["the channels carrying rain into the item", "the group", "mains water", "the amount needed"] },
  { key: "these-records", text: "{Name} photographed each stage and added dates to the notes. These records helped the {group} explain the project.", reference: "These records", answer: "the dated photographs and notes", choices: ["the dated photographs and notes", "the group", "the project", "each stage alone"] },
  { key: "the-plan", text: "A wide path and a resting place were suggested for the {place}. The plan was tested with visitors before work began.", reference: "The plan", answer: "the suggested wide path and resting place", choices: ["the suggested wide path and resting place", "the visitors", "the work", "the place only"] },
  { key: "they-group", text: "The {group} met {name} beside the {item}. They agreed to check the measurements again.", reference: "They", answer: "the group and {name}", choices: ["the group and {name}", "the item", "the measurements", "the place"] },
  { key: "such-changes", text: "Labels can use larger print and shorter lines. Such changes can make information easier to track.", reference: "Such changes", answer: "using larger print and shorter lines", choices: ["using larger print and shorter lines", "the information", "tracking labels", "the {place}"] },
  { key: "former", text: "The {group} compared the original {item} with a digital model. The former showed marks left by years of use.", reference: "The former", answer: "the original item", choices: ["the original item", "the digital model", "the group", "the years"] },
  { key: "this-finding", text: "The survey showed that most visitors paused near the {item}. This finding changed where the next label was placed.", reference: "This finding", answer: "that most visitors paused near the item", choices: ["that most visitors paused near the item", "the next label", "the survey sheet", "the place"] },
  { key: "there", text: "{Name} moved the discussion to the quiet room at the {place}. There, the {group} could compare both proposals.", reference: "There", answer: "the quiet room", choices: ["the quiet room", "both proposals", "the discussion", "the group"] },
];

const pronounItems = [
  { key: "ambiguous-it", text: "{Name} put the {item} beside the display case before moving it towards the window.", intention: "the item moved", answer: "{Name} put the {item} beside the display case before moving the {item} towards the window.", choices: ["{Name} put the {item} beside the display case before moving the {item} towards the window.", "{Name} put it beside it before moving it.", "{Name} moved it after it was beside it.", "The window moved the {item} beside the case."] },
  { key: "singular-they", text: "A visitor can ask at the desk if they need a large-print guide.", intention: "they refers clearly and inclusively to any visitor", answer: "Keep 'they' because it clearly refers to 'a visitor' without assuming gender.", choices: ["Keep 'they' because it clearly refers to 'a visitor' without assuming gender.", "Change 'they' to 'it' because visitor is singular.", "Delete 'a visitor' so the pronoun has no referent.", "Repeat 'visitor' after every verb."] },
  { key: "these-plural", text: "The {group} added a ramp and two resting benches. These made the route easier to use.", intention: "refer to all three additions", answer: "Replace 'These' with 'These additions'.", choices: ["Replace 'These' with 'These additions'.", "Replace 'These' with 'This'.", "Replace 'These' with 'It'.", "Delete the first sentence."] },
  { key: "its-owner", text: "The {item} was returned to the {group} after its label was repaired.", intention: "the item's label was repaired", answer: "Keep 'its' because the nearest sensible owner of the label is the item.", choices: ["Keep 'its' because the nearest sensible owner of the label is the item.", "Change 'its' to 'their' because every noun needs a plural pronoun.", "Delete 'label' because 'its' replaces it.", "Change 'its' to 'this' without naming a noun."] },
  { key: "those", text: "Some labels describe the {topic}; those beside the entrance give opening times.", intention: "those means labels", answer: "Keep 'those' because it substitutes for the plural noun 'labels'.", choices: ["Keep 'those' because it substitutes for the plural noun 'labels'.", "Change 'those' to 'that' because the entrance is singular.", "Change 'those' to 'there' because it names a place.", "Delete 'labels' from the first clause."] },
  { key: "this-idea", text: "{Name} suggested testing the route with wheelchair users. This idea was added to the plan.", intention: "refer to the whole suggestion", answer: "Keep 'This idea' because it sums up the complete suggestion.", choices: ["Keep 'This idea' because it sums up the complete suggestion.", "Change it to 'He' because ideas are people.", "Use 'These' although only one suggestion is named.", "Replace it with 'route' and alter the meaning."] },
  { key: "two-groups", text: "The {group} spoke to the volunteers after they finished the survey.", intention: "the volunteers finished", answer: "The {group} spoke to the volunteers after the volunteers finished the survey.", choices: ["The {group} spoke to the volunteers after the volunteers finished the survey.", "The {group} spoke to them after they finished it.", "They spoke after they finished.", "The survey spoke to the volunteers."] },
  { key: "determiner-chain", text: "A new guide was placed beside the {item}. The guide included a map. This map showed the quiet route.", intention: "build a clear noun-determiner chain", answer: "A new guide -> The guide -> a map -> This map", choices: ["A new guide -> The guide -> a map -> This map", "A new guide -> the item -> This map", "The guide -> the quiet route -> A new guide", "This map -> a map -> no earlier referent"] },
];

const adverbialItems = [
  { key: "next", relationship: "the next step", answer: "Next,", choices: ["Next,", "In contrast,", "Nearby,", "For example,"] },
  { key: "meanwhile", relationship: "an event happening at the same time", answer: "Meanwhile,", choices: ["Meanwhile,", "As a result,", "Previously,", "In particular,"] },
  { key: "because-result", relationship: "a result of the previous paragraph", answer: "Consequently,", choices: ["Consequently,", "On the other hand,", "At first,", "Beyond the gate,"] },
  { key: "contrast", relationship: "a contrasting limitation", answer: "However,", choices: ["However,", "Similarly,", "Afterwards,", "For instance,"] },
  { key: "place", relationship: "a move from inside to outside the {place}", answer: "Outside,", choices: ["Outside,", "Therefore,", "In addition,", "Eventually,"] },
  { key: "earlier", relationship: "a return to an event before the main narrative", answer: "Earlier that morning,", choices: ["Earlier that morning,", "As a result,", "Nearby,", "In conclusion,"] },
  { key: "specific", relationship: "one precise example of the general point", answer: "In particular,", choices: ["In particular,", "Nevertheless,", "After that,", "Across the road,"] },
  { key: "addition", relationship: "another supporting point", answer: "Furthermore,", choices: ["Furthermore,", "Instead,", "At dawn,", "For this reason,"] },
  { key: "no-adverbial", relationship: "a close continuation where the repeated subject already makes the link clear", answer: "Use no extra adverbial", choices: ["Use no extra adverbial", "Nevertheless,", "A century later,", "On the contrary,"] },
];

const repetitionItems = [
  { key: "technical-term", original: "The solar cell converts light into electricity. The solar cell must face the light source.", answer: "Keep 'solar cell' because it is the precise technical term and remains clear.", choices: ["Keep 'solar cell' because it is the precise technical term and remains clear.", "Replace it with 'shiny thing' to avoid all repetition.", "Use a different synonym in every sentence.", "Delete the second subject and leave the sentence incomplete."] },
  { key: "clear-pronoun", original: "{Name} checked the {item}. {Name} then carried the {item} to the workbench.", answer: "{Name} checked the {item}. They then carried it to the workbench.", choices: ["{Name} checked the {item}. They then carried it to the workbench.", "{Name} checked it. It then carried them to the workbench.", "They checked it. They carried it there.", "The object did something and then the thing moved."] },
  { key: "category-substitution", original: "Three route maps were tested. The route maps with larger labels were easiest to follow.", answer: "Three route maps were tested. Those with larger labels were easiest to follow.", choices: ["Three route maps were tested. Those with larger labels were easiest to follow.", "Three route maps were tested. Things were easiest.", "Three routes were tested. They became labels.", "Maps maps maps were easiest to follow."] },
  { key: "lexical-chain", original: "The exhibition explores local rivers. The display includes maps of streams and photographs of the estuary.", answer: "Keep 'rivers', 'streams' and 'estuary' because they form a clear topic chain without pretending they mean exactly the same thing.", choices: ["Keep 'rivers', 'streams' and 'estuary' because they form a clear topic chain without pretending they mean exactly the same thing.", "Replace all three with 'water' because precise meaning never matters.", "Call every feature an estuary even when it is not one.", "Remove the topic words so the paragraph has no subject."] },
  { key: "repeat-after-gap", original: "The {topic} was introduced in paragraph one. After two paragraphs about testing, the final paragraph returns to it.", answer: "Repeat the exact topic phrase at the return point so the reader can recover the main thread.", choices: ["Repeat the exact topic phrase at the return point so the reader can recover the main thread.", "Use 'it' even if several possible referents intervene.", "Invent an unrelated synonym to surprise the reader.", "Remove the topic from the final paragraph."] },
  { key: "avoid-ambiguous-one", original: "The blue {item} stood beside a smaller model. {Name} moved one to the cabinet.", answer: "Name the intended object instead of 'one' because two objects could fit.", choices: ["Name the intended object instead of 'one' because two objects could fit.", "Keep 'one' because ambiguity always creates cohesion.", "Replace both objects with 'it'.", "Delete the cabinet detail and guess the referent."] },
  { key: "controlled-repeat", original: "The safety check has three stages. First, check the frame. Next, check the fastenings. Finally, record the safety check.", answer: "Keep the final 'safety check' to reconnect the details to the named process.", choices: ["Keep the final 'safety check' to reconnect the details to the named process.", "Replace it with 'performance' although the meaning changes.", "Delete every repeated word including 'check'.", "Repeat 'safety check' before every noun."] },
  { key: "demonstrative", original: "Visitors requested shorter lines of text. Shorter lines of text were added to the new guide.", answer: "Visitors requested shorter lines of text. This change was added to the new guide.", choices: ["Visitors requested shorter lines of text. This change was added to the new guide.", "Visitors requested it. This was added to it.", "Visitors changed. Lines requested the guide.", "The new guide requested shorter visitors."] },
  { key: "meaning-change", original: "The survey recorded accessibility barriers. An edit replaces 'barriers' with 'decorations'.", answer: "Reject the substitution because 'decorations' changes the meaning rather than creating cohesion.", choices: ["Reject the substitution because 'decorations' changes the meaning rather than creating cohesion.", "Accept every synonym-like word to avoid repetition.", "Delete 'accessibility' and keep the changed meaning.", "Accept it because longer words are more cohesive."] },
];

const sequencingItems = [
  { key: "instructions", stages: ["measure the space", "mark the position", "fit the {item}"], answer: "First, measure the space. Next, mark the position. Finally, fit the {item}.", choices: ["First, measure the space. Next, mark the position. Finally, fit the {item}.", "Finally, measure. Earlier, fit. Meanwhile, mark.", "Fit the {item}; therefore measure the space yesterday.", "All steps happen in an unstated order."] },
  { key: "report", stages: ["the {group} gathered evidence", "they compared two plans", "they recommended one plan"], answer: "Evidence gathering -> comparison -> recommendation", choices: ["Evidence gathering -> comparison -> recommendation", "Recommendation -> no evidence -> comparison", "Comparison -> recommendation -> evidence gathering", "All stages are interchangeable"] },
  { key: "past-before-past", stages: ["{name} photographed the damage", "the {group} arrived"], answer: "When the {group} arrived, {name} had already photographed the damage.", choices: ["When the {group} arrived, {name} had already photographed the damage.", "When the {group} had arrived tomorrow, {name} photographs it.", "{Name} will photograph it before they arrived yesterday.", "The arrival and photograph have no time relationship."] },
  { key: "simultaneous", stages: ["{name} checked labels", "the {group} measured the route"], answer: "While {name} checked the labels, the {group} measured the route.", choices: ["While {name} checked the labels, the {group} measured the route.", "Finally, both actions happened first.", "Because {name} checked, the route caused the group.", "Earlier tomorrow, the actions have happened."] },
  { key: "flashback", stages: ["the present visit begins", "an earlier design decision is explained", "the present visit continues"], answer: "Present visit -> Earlier, the design had changed -> return to present visit", choices: ["Present visit -> Earlier, the design had changed -> return to present visit", "Earlier event -> unrelated future -> no return", "Present visit -> same event repeated without a cue", "Three paragraphs in random order"] },
  { key: "numbered", stages: ["first check", "second check", "final decision"], answer: "Firstly -> Secondly -> Finally", choices: ["Firstly -> Secondly -> Finally", "Finally -> Meanwhile -> Firstly", "Nearby -> However -> For example", "Therefore -> Earlier -> Outside"] },
  { key: "cause-not-time", stages: ["heavy rain damaged the path", "the route was temporarily closed"], answer: "The path was damaged. As a result, the route was temporarily closed.", choices: ["The path was damaged. As a result, the route was temporarily closed.", "The path was damaged. Meanwhile, it caused yesterday.", "The route closed. For example, rain is weather.", "The two facts are linked only by alphabetical order."] },
  { key: "headings", stages: ["Problem", "Evidence", "Proposed change", "Review"], answer: "Problem -> Evidence -> Proposed change -> Review", choices: ["Problem -> Evidence -> Proposed change -> Review", "Review -> Problem -> no evidence -> change", "Evidence -> Review -> Problem -> random change", "Use the same heading four times"] },
];

const editingItems = [
  { key: "too-many-therefores", text: "The path was muddy. Therefore, boots were needed. Therefore, the group walked slowly. Therefore, they reached the hide later.", answer: "Keep the first useful cause link, remove repeated 'Therefore' where sentence order already carries the meaning, then reread.", choices: ["Keep the first useful cause link, remove repeated 'Therefore' where sentence order already carries the meaning, then reread.", "Add 'Therefore' before every clause.", "Remove the factual sequence as well as the links.", "Replace each link with a random place adverbial."] },
  { key: "mismatched-however", text: "The guide uses larger print. However, it also uses shorter lines, which support the same goal.", answer: "Replace 'However' with 'In addition' because the second point supports rather than contrasts.", choices: ["Replace 'However' with 'In addition' because the second point supports rather than contrasts.", "Keep 'However' because every second sentence needs contrast.", "Replace it with 'Yesterday' although no time changes.", "Delete the second point and its meaning."] },
  { key: "ambiguous-chain", text: "{Name} showed the {item} to a curator after they repaired it.", answer: "Name who repaired the item, because both the person and curator are possible referents.", choices: ["Name who repaired the item, because both the person and curator are possible referents.", "Replace both people with 'they'.", "Delete the repair information.", "Assume every reader will make the same guess."] },
  { key: "tense-accident", text: "The {group} tested the route and recorded the results. They recommend a wider gate.", answer: "Use 'recommended' to maintain the past report, unless a deliberate present recommendation is clearly introduced.", choices: ["Use 'recommended' to maintain the past report, unless a deliberate present recommendation is clearly introduced.", "Change every verb to a different tense.", "Delete the recommendation.", "Add 'Meanwhile' without repairing the time shift."] },
  { key: "voice-preserved", text: "{Name} wrote: 'The little {item} waited on the shelf.' An editor wants to replace every repeated noun and image.", answer: "Retain purposeful wording and edit only links that confuse the reader; cohesion should not erase the writer's voice.", choices: ["Retain purposeful wording and edit only links that confuse the reader; cohesion should not erase the writer's voice.", "Replace every noun regardless of effect.", "Add a formal connective to every sentence.", "Remove the image so no wording repeats."] },
  { key: "missing-topic", text: "Paragraph one names the {topic}. Paragraphs two and three use 'it', 'this' and 'that' after several other nouns appear.", answer: "Repeat the precise topic at a useful reset point, then use references only while their meaning stays clear.", choices: ["Repeat the precise topic at a useful reset point, then use references only while their meaning stays clear.", "Use more pronouns to hide the topic.", "Replace the topic with unrelated synonyms.", "Delete the paragraph that names the topic."] },
  { key: "link-masks-logic", text: "The {item} was repaired. Nevertheless, it could be used safely because the repair succeeded.", answer: "Replace 'Nevertheless' with a result link or no link, because the safe use follows from the successful repair.", choices: ["Replace 'Nevertheless' with a result link or no link, because the safe use follows from the successful repair.", "Keep it because long connectives always improve flow.", "Change 'safely' to 'dangerously' to fit the connective.", "Remove the repair result."] },
  { key: "paragraph-purpose", text: "A paragraph explains evidence from the survey. Its opening says 'Finally,' although it is not the last stage.", answer: "Choose an opener that names the real relationship, such as 'The survey evidence shows', instead of a false sequence cue.", choices: ["Choose an opener that names the real relationship, such as 'The survey evidence shows', instead of a false sequence cue.", "Keep 'Finally' because it sounds formal.", "Move the paragraph to the end even if the argument breaks.", "Delete the evidence."] },
  { key: "reread-meaning", text: "An edit makes every sentence shorter but removes who completed each action at the {place}.", answer: "Restore the necessary subjects and reread the whole passage; smoother wording is not cohesive if responsibility becomes unclear.", choices: ["Restore the necessary subjects and reread the whole passage; smoother wording is not cohesive if responsibility becomes unclear.", "Keep the edit because short always means clear.", "Add more unspecified pronouns.", "Remove the actions whose subjects are unclear."] },
];

const candidates = [
  ...expand("paragraph-links", 34, paragraphItems, buildParagraphLink),
  ...expand("reference-chains", 34, referenceItems, buildReferenceChain),
  ...expand("pronouns-determiners", 34, pronounItems, buildPronounDeterminer),
  ...expand("adverbials", 34, adverbialItems, buildAdverbial),
  ...expand("repetition-substitution", 34, repetitionItems, buildRepetition),
  ...expand("sequencing", 33, sequencingItems, buildSequencing),
  ...expand("editing", 33, editingItems, buildEditing),
];

pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.adaptive_support.audio_first = "Optional whole-passage and sentence playback uses only ElevenLabs assets after human listening approval. Browser TTS is prohibited; if audio is unavailable, visible text, line focus and adult/partner reading routes remain complete.";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Wave-six review bank reaches the 240-item pilot target with four preserved curated questions and 236 deterministic candidates covering paragraph links, reference chains, pronouns and determiners, adverbials, repetition and substitution, sequencing, and meaning-preserving cohesion editing. SEND/dyslexia scaffolds, supported non-drag interactions, rich repair feedback, low-pressure reader-route progress and optional ElevenLabs references are included. Audio requires human listening approval and browser TTS is prohibited; independent English, teacher, SEND, accessibility, safeguarding, audio and renderer review remains required before promotion.";

validateBank(pack, curated, candidates);
enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`cohesion-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`cohesion-bank strands=${summary(candidates, (variant) => variant.body.cohesion_strand)}`);
console.log(`cohesion-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`cohesion-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`cohesion-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 5 cohesion bank is out of date; run generate-y5-cohesion-bank.mjs --write.");
  console.log("cohesion-bank deterministic check passed");
} else {
  console.log("cohesion-bank dry-run; pass --write to update the pack");
}

function buildParagraphLink(item, context, index, id) {
  const first = fill(item.first, context);
  const second = fill(item.second, context);
  return candidate({ id, format: "paragraph-order", blueprint: "adverbial-relationship-signposts", band: "expected", strand: "paragraph_links", prompt: `Paragraph-link route ${index + 1}: which opening accurately signals ${item.relationship} between the displayed paragraphs?`, body: { paragraph_one: first, paragraph_two: second, relationship: item.relationship, choices: fillAll(item.choices, context) }, answer: fill(item.answer, context), hints: ["Name the relationship in plain words before choosing a link.", "Reread both paragraphs with the choice; reject a link that changes their logic."], explanation: `'${fill(item.answer, context)}' accurately signals ${item.relationship}. It helps the reader connect the paragraph ideas without adding a relationship the content does not support.`, tag: item.key === "no-link" ? "link_every_paragraph" : "link_as_decoration", repair: `Label the relationship as ${item.relationship}, then compare the passage with and without an explicit signpost.` });
}

function buildReferenceChain(item, context, index, id) {
  const text = fill(item.text, context);
  return candidate({ id, format: "reference-map", blueprint: "clear-reference-chains", band: "developing", strand: "reference_chains", prompt: `Reference trail ${index + 1}: what does '${fill(item.reference, context)}' refer to in the displayed text?`, body: { text, reference: fill(item.reference, context), choices: fillAll(item.choices, context) }, answer: fill(item.answer, context), hints: ["Trace backwards to the nearest noun or idea that makes complete sense.", "Substitute your answer for the reference and reread the whole sentence."], explanation: `'${fill(item.reference, context)}' refers to ${fill(item.answer, context)}. Replacing the reference with that wording preserves the passage meaning and keeps the chain clear.`, tag: "nearest_noun_only", repair: "Use the text-list reference map: reference expression -> possible referents -> meaning check." });
}

function buildPronounDeterminer(item, context, index, id) {
  const text = fill(item.text, context);
  return candidate({ id, format: "reference-map", blueprint: "clear-reference-chains", band: "developing", strand: "pronouns_determiners", prompt: `Pronoun-and-determiner check ${index + 1}: which decision keeps the displayed meaning clear?`, body: { text, intended_meaning: fill(item.intention, context), choices: fillAll(item.choices, context) }, answer: fill(item.answer, context), hints: ["Circle each pronoun or determiner and draw a line to its referent.", "If two referents are possible, repeat a precise noun once rather than guessing."], explanation: `${fill(item.answer, context)} This choice makes number and reference agree while preserving the intended people, objects and actions.`, tag: item.key.includes("ambiguous") || item.key === "two-groups" ? "ambiguous_reference" : "pronoun_number_mismatch", repair: "Show one reference chain at a time and replace the target word with each possible referent before choosing." });
}

function buildAdverbial(item, context, index, id) {
  return candidate({ id, format: "paragraph-order", blueprint: "adverbial-relationship-signposts", band: "expected", strand: "adverbials", prompt: `Adverbial signpost ${index + 1}: a new paragraph at the ${context.place} needs to show ${fill(item.relationship, context)}. Which opening fits, including the option of no added adverbial?`, body: { relationship: fill(item.relationship, context), choices: fillAll(item.choices, context), punctuation_checked: true }, answer: fill(item.answer, context), hints: ["Sort the relationship as time, place, number, addition, contrast, cause or direct continuation.", "Read the paragraph opening aloud or silently; a formal-sounding link is not useful if its meaning is wrong."], explanation: `'${fill(item.answer, context)}' matches the stated relationship. The signpost earns its place by guiding the reader accurately, not merely by making the paragraph sound formal.`, tag: item.key === "no-adverbial" ? "link_every_sentence" : "link_as_decoration", repair: "Use labelled adverbial cards grouped by relationship, then test the no-link card as a genuine option." });
}

function buildRepetition(item, context, index, id) {
  const original = fill(item.original, context);
  return candidate({ id, format: "cohesion-edit", blueprint: "lexical-cohesion-balance", band: "expected", strand: "repetition_substitution", prompt: `Word-chain workshop ${index + 1}: which edit improves or preserves cohesion without masking meaning?`, body: { original, choices: fillAll(item.choices, context), exact_term_check: true }, answer: fill(item.answer, context), hints: ["Mark words that name the exact topic, then mark references that can safely substitute for them.", "Keep necessary repetition when a synonym would become vague or change the technical meaning."], explanation: `${fill(item.answer, context)} Cohesion depends on a recoverable topic chain; varied wording is useful only when the reader can retain the same precise meaning.`, tag: item.key === "meaning-change" ? "synonym_changes_meaning" : "synonym_at_all_costs", repair: "Compare the original and edited topic chains in parallel, highlighting exact terms separately from safe substitutions." });
}

function buildSequencing(item, context, index, id) {
  return candidate({ id, format: "paragraph-order", blueprint: "adverbial-relationship-signposts", band: "expected", strand: "sequencing", prompt: `Sequence board ${index + 1}: which order or wording makes the displayed relationship accurate?`, body: { stages: fillAll(item.stages, context), choices: fillAll(item.choices, context), move_controls: ["move_up", "move_down", "reset"] }, answer: fill(item.answer, context), hints: ["Place the events or ideas in their real logical or time order first.", "Then choose only the sequence or tense cues needed to make that order visible."], explanation: `${fill(item.answer, context)} This arrangement preserves the stated chronology or logic and uses cues that match it rather than forcing an unrelated connection.`, tag: item.key === "past-before-past" || item.key === "flashback" ? "accidental_tense_shift" : "sequence_words_without_logic", repair: "Use numbered paragraph cards with move-up and move-down controls, then read the complete order before checking." });
}

function buildEditing(item, context, index, id) {
  const text = fill(item.text, context);
  return candidate({ id, format: index % 2 ? "reader-effect-choice" : "cohesion-edit", blueprint: index % 2 ? "overlinking-reader-effect-repair" : item.key === "tense-accident" ? "tense-link-and-shift" : "lexical-cohesion-balance", band: index % 2 ? "stretch" : item.key === "tense-accident" ? "secure" : "expected", strand: "meaning_preserving_editing", prompt: `Reader test ${index + 1}: which edit improves cohesion while keeping the intended meaning visible?`, body: { text, choices: fillAll(item.choices, context), before_after_compare: true }, answer: fill(item.answer, context), hints: ["State the passage meaning before editing any links or references.", "After the edit, reread beyond the changed sentence and check who did what, when and why."], explanation: `${fill(item.answer, context)} The edit is justified by the relationship in the passage and protects its information, logic and voice rather than treating cohesion as decoration.`, tag: item.key === "too-many-therefores" ? "link_every_sentence" : item.key === "tense-accident" ? "accidental_tense_shift" : "edit_masks_meaning", repair: "Keep the original beside the edit, change one feature at a time, and use undo if the meaning or voice becomes less clear." });
}

function candidate({ id, format, blueprint, band, strand, prompt, body, answer, hints, explanation, tag, repair }) {
  const fullId = `${prefix}${id}`;
  const choices = rotate([...new Set(body.choices)], id.length % body.choices.length);
  return {
    id: fullId,
    format,
    body: {
      prompt,
      ...body,
      choices,
      cohesion_strand: strand,
      difficulty_band: band,
      evidence_purpose: `${strand}_meaning_preserving_choice`,
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
      meaning_preserved: true,
      source_text_remains_visible: true,
      response_mode: "tap_keyboard_switch_oral_or_partner_response",
      interaction_support: { keyboard: true, switch_scan: true, touch: true, oral_or_partner_response: true, precision_drag_required: false, move_up_down_alternative: true, undo_available: true },
      dyslexia_support: { increased_spacing: true, adjustable_line_length: true, line_focus: true, tinted_background_option: true, chunked_paragraph_view: true, readable_font_option: true, key_reference_bold_option: true },
      reduced_visual_load: true,
      one_link_family_per_screen_option: true,
      static_text_list_alternative: true,
      timer_allowed: false,
      speed_score_allowed: false,
      leaderboard_allowed: false,
      audio_optional: true,
      audio_asset_id: `narration-${fullId}`,
      audio_provider: "ElevenLabs",
      audio_asset_status: "required_human_listening_review",
      human_listening_approval_required: true,
      browser_tts_allowed: false,
      gamification: { purpose: "restore one reader-route connection after explaining a real cohesion link", reward: "one calm route thread or editor-journal stamp", loss_on_error: false, streak_pressure: false, retry_message: "That edit gives us useful reader evidence. Restore the original, test one link, and try again." },
    },
    expected_answer: { value: answer },
    hints,
    explanation,
    feedback: { correct: `The reader route is clear. ${explanation}`, repair, meaning_check: "Compare the original and chosen version: the people, actions, sequence and relationship should remain the same unless the task explicitly repairs one of them." },
    difficulty: { developing: 4, expected: 5, secure: 7, stretch: 8 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: format === "reference-map" ? "reference-arrow-trace" : format === "paragraph-order" ? "paragraph-route-lock" : format === "reader-effect-choice" ? "reader-route-thread" : "cohesion-edit-compare",
  };
}

function expand(label, count, items, builder) {
  return Array.from({ length: count }, (_, index) => {
    const item = items[index % items.length];
    const context = contexts[Math.floor(index / items.length) % contexts.length];
    return builder(item, context, index, `${label}-${item.key}-${context.key}`);
  });
}

function validateBank(currentPack, authored, generated) {
  if (authored.length !== 4) throw new Error(`Expected four curated variants, found ${authored.length}.`);
  if (generated.length !== pilotTarget - authored.length || currentPack.question_variants.length !== pilotTarget) throw new Error(`Expected ${pilotTarget} total variants with ${pilotTarget - authored.length} generated.`);
  const blueprints = new Map(currentPack.variant_blueprints.map((item) => [item.id, item]));
  const formats = new Set(currentPack.practice.formats);
  const ids = new Set();
  const signatures = new Set();
  const strands = new Set();
  const actualFormats = new Set();
  const actualBlueprints = new Set();
  for (const variant of currentPack.question_variants) {
    if (ids.has(variant.id)) throw new Error(`Duplicate id ${variant.id}.`);
    ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${normalise(variant.expected_answer?.value)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`);
    signatures.add(signature);
  }
  for (const variant of generated) {
    const blueprint = blueprints.get(variant.body.variant_blueprint_id);
    if (!blueprint || blueprint.format !== variant.format) throw new Error(`${variant.id} does not match its blueprint format.`);
    if (!formats.has(variant.format) || variant.status !== "review") throw new Error(`${variant.id} has unsupported format or status.`);
    if (!variant.body.meaning_preserved || !variant.body.source_text_remains_visible) throw new Error(`${variant.id} does not protect meaning during editing.`);
    if (!variant.body.interaction_support?.keyboard || !variant.body.interaction_support?.switch_scan || !variant.body.interaction_support?.oral_or_partner_response || variant.body.interaction_support?.precision_drag_required !== false) throw new Error(`${variant.id} lacks supported interactions.`);
    if (!variant.body.dyslexia_support?.increased_spacing || !variant.body.dyslexia_support?.line_focus || !variant.body.dyslexia_support?.chunked_paragraph_view || !variant.body.dyslexia_support?.readable_font_option || variant.body.reduced_visual_load !== true) throw new Error(`${variant.id} lacks SEND/dyslexia scaffolds.`);
    if (variant.body.timer_allowed !== false || variant.body.speed_score_allowed !== false || variant.body.leaderboard_allowed !== false || variant.body.gamification?.loss_on_error !== false || variant.body.gamification?.streak_pressure !== false) throw new Error(`${variant.id} introduces performance pressure.`);
    if (variant.body.audio_provider !== "ElevenLabs" || variant.body.audio_asset_status !== "required_human_listening_review" || variant.body.human_listening_approval_required !== true || variant.body.browser_tts_allowed !== false) throw new Error(`${variant.id} violates audio policy.`);
    if (!variant.feedback?.repair || !variant.feedback?.meaning_check || variant.hints.length < 2 || variant.explanation.length < 90) throw new Error(`${variant.id} lacks rich feedback.`);
    if (!Array.isArray(variant.body.choices) || variant.body.choices.length < 3 || new Set(variant.body.choices).size !== variant.body.choices.length) throw new Error(`${variant.id} has invalid choices.`);
    if (variant.body.choices.filter((choice) => choice === variant.expected_answer.value).length !== 1) throw new Error(`${variant.id} must contain its answer exactly once.`);
    strands.add(variant.body.cohesion_strand);
    actualFormats.add(variant.format);
    actualBlueprints.add(variant.body.variant_blueprint_id);
  }
  requireCoverage("strands", ["paragraph_links", "reference_chains", "pronouns_determiners", "adverbials", "repetition_substitution", "sequencing", "meaning_preserving_editing"], strands);
  requireCoverage("formats", [...formats], actualFormats);
  requireCoverage("blueprints", [...blueprints.keys()], actualBlueprints);
}

function requireCoverage(label, required, actual) { const missing = required.filter((item) => !actual.has(item)); if (missing.length) throw new Error(`Generated bank is missing ${label}: ${missing.join(", ")}.`); }
function fill(value, context) { return String(value).replaceAll("{name}", context.name).replaceAll("{Name}", context.name).replaceAll("{group}", context.group).replaceAll("{place}", context.place).replaceAll("{item}", context.item).replaceAll("{topic}", context.topic); }
function fillAll(items, context) { return items.map((item) => fill(item, context)); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function summary(items, keyFor) { const counts = new Map(); for (const item of items) counts.set(keyFor(item), (counts.get(keyFor(item)) ?? 0) + 1); return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
