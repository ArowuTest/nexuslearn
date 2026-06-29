#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/en-y6-writing-cohesion-devices.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "en-y6-writing-cohesion-bank-";
const pilotTarget = 240;

if (write && check) throw new Error("Choose either --write or --check, not both.");

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "en-y6-writing-cohesion-devices") throw new Error("This generator only supports the Year 6 writing-cohesion pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 3) throw new Error(`Expected exactly 3 curated variants, found ${curated.length}. Refusing to overwrite possible authored work.`);

ensureBlueprints(pack);

const contexts = [
  { key: "museum", name: "Mina", group: "curators", place: "local museum", item: "model boat", project: "harbour exhibition" },
  { key: "wetland", name: "Ari", group: "survey team", place: "wetland reserve", item: "field camera", project: "bird survey" },
  { key: "library", name: "Zara", group: "reading group", place: "community library", item: "story map", project: "history display" },
  { key: "workshop", name: "Noor", group: "design team", place: "repair workshop", item: "solar lantern", project: "energy project" },
  { key: "observatory", name: "Leo", group: "research team", place: "observatory", item: "star chart", project: "night-sky report" },
];

const paragraphItems = [
  { key: "cause", p1: "The inspection found a crack in the {item}.", p2: "The {group} removed it from the public display.", relation: "cause and result", answer: "For this reason,", wrong: ["Meanwhile,", "For example,", "In the distance,"] },
  { key: "contrast", p1: "The first design was inexpensive.", p2: "It did not provide enough room for visitors.", relation: "contrast", answer: "However,", wrong: ["Therefore,", "Similarly,", "Earlier,"] },
  { key: "addition", p1: "The revised {project} includes clearer labels.", p2: "It provides a quiet route through the {place}.", relation: "an additional supporting point", answer: "Furthermore,", wrong: ["Nevertheless,", "As a result,", "Previously,"] },
  { key: "example", p1: "Several changes would make the {place} easier to use.", p2: "Lower labels would help younger visitors read about the {item}.", relation: "general statement followed by an example", answer: "For example,", wrong: ["Consequently,", "On the contrary,", "Meanwhile,"] },
  { key: "time", p1: "In spring, the {group} approved the plan.", p2: "In July, {name} checked the completed work.", relation: "a later stage", answer: "Several months later,", wrong: ["For this reason,", "In contrast,", "Nearby,"] },
  { key: "return", p1: "The opening explains why the {project} began. Two paragraphs describe the investigation.", p2: "The final paragraph considers the original problem again.", relation: "a return to the main issue", answer: "Returning to the original question,", wrong: ["At the same time,", "For instance,", "Across the road,"] },
  { key: "no-link", p1: "The {group} photographed every stage of the repair.", p2: "The photographs provide a complete record of the work.", relation: "a direct continuation already made clear by repeated reference", answer: "No added linking phrase", wrong: ["Nevertheless,", "On the contrary,", "A century later,"] },
  { key: "similarity", p1: "The older {item} used a light wooden frame.", p2: "The replacement also uses a lightweight frame.", relation: "similarity", answer: "Similarly,", wrong: ["Instead,", "Consequently,", "Finally,"] },
];

const referenceItems = [
  { key: "this-system", text: "The {group} installed channels that carried rain into a tank. This system reduced the use of mains water.", reference: "This system", answer: "the channels carrying rain into the tank", wrong: ["the group", "mains water", "the tank alone"] },
  { key: "these-records", text: "{Name} photographed each stage and dated the notes. These records helped explain the repair.", reference: "These records", answer: "the dated photographs and notes", wrong: ["the repair", "each stage alone", "the group"] },
  { key: "former", text: "The {group} compared the original {item} with a digital model. The former showed marks left by years of use.", reference: "The former", answer: "the original item", wrong: ["the digital model", "the group", "the years"] },
  { key: "such-changes", text: "Labels can use larger print and shorter lines. Such changes can make information easier to track.", reference: "Such changes", answer: "using larger print and shorter lines", wrong: ["the information", "tracking labels", "the {place}"] },
  { key: "there", text: "{Name} moved the meeting to the quiet room at the {place}. There, the {group} compared both proposals.", reference: "There", answer: "the quiet room", wrong: ["both proposals", "the meeting", "the group"] },
  { key: "ambiguous-it", text: "{Name} placed the {item} beside the camera before moving it to the cabinet.", reference: "it", answer: "Repeat 'the {item}' if that is what moved, because 'it' could also mean the camera.", wrong: ["Keep 'it' because every reader must guess the same referent.", "Replace both nouns with 'it'.", "Delete the intended movement."] },
  { key: "they", text: "The {group} thanked the volunteers after they completed the survey.", reference: "they", answer: "Repeat 'the volunteers' if the volunteers completed the survey.", wrong: ["Keep 'they' although two plural groups are possible.", "Delete the survey.", "Replace every noun with 'they'."] },
  { key: "determiner-chain", text: "A guide was placed beside the {item}. The guide included a map. This map showed the quiet route.", reference: "A guide -> The guide -> a map -> This map", answer: "a clear reference chain that introduces and then identifies each noun", wrong: ["four unrelated objects", "a chain based only on repeated colour", "proof that all determiners are interchangeable"] },
];

const adverbialItems = [
  { key: "next", relation: "the next stage in an ordered process", answer: "Next,", wrong: ["In contrast,", "Nearby,", "For example,"] },
  { key: "simultaneous", relation: "an event happening at the same time", answer: "Meanwhile,", wrong: ["As a result,", "Previously,", "In particular,"] },
  { key: "result", relation: "a result caused by the previous paragraph", answer: "Consequently,", wrong: ["On the other hand,", "At first,", "Beyond the gate,"] },
  { key: "contrast", relation: "a limitation that contrasts with the previous claim", answer: "However,", wrong: ["Similarly,", "Afterwards,", "For instance,"] },
  { key: "place", relation: "a move from inside to outside the {place}", answer: "Outside,", wrong: ["Therefore,", "In addition,", "Eventually,"] },
  { key: "earlier", relation: "an event before the main past narrative", answer: "Earlier that morning,", wrong: ["As a result,", "Nearby,", "In conclusion,"] },
  { key: "specific", relation: "one precise case within a general point", answer: "In particular,", wrong: ["Nevertheless,", "After that,", "Across the road,"] },
  { key: "no-adverbial", relation: "a close continuation where subject repetition already makes the link clear", answer: "Use no extra adverbial", wrong: ["Nevertheless,", "A century later,", "On the contrary,"] },
];

const tenseItems = [
  { key: "past-consistency", text: "The {group} entered the {place} and records the temperature.", purpose: "maintain a past-tense report", answer: "The {group} entered the {place} and recorded the temperature.", wrong: ["The {group} enters the {place} and recorded the temperature.", "The group entering and records.", "The temperature entered the group."] },
  { key: "earlier-past", text: "The team returned to base. They discovered the fault before that.", purpose: "make the earlier event clear from a past viewpoint", answer: "The team returned to base. Earlier, they had discovered the fault.", wrong: ["The team returned. Earlier, they discover the fault.", "They will discover it before they returned.", "Nearby, they had discovered tomorrow."] },
  { key: "present-report", text: "The guide explains the route and described the final viewpoint.", purpose: "maintain present tense in a current guide", answer: "The guide explains the route and describes the final viewpoint.", wrong: ["The guide explained the route and describes it.", "The guide explaining and described.", "The viewpoint explains the guide."] },
  { key: "deliberate-shift", text: "The {item} stands in the gallery today. It was recovered in 1986.", purpose: "move deliberately from present status to past history", answer: "Keep the shift because 'today' and 'in 1986' clearly mark two time frames.", wrong: ["Make every verb present even though the recovery is past.", "Make every verb past and remove current status.", "Add 'Meanwhile' to hide the shift."] },
  { key: "future-plan", text: "The {group} completed the survey and will publish the report next week.", purpose: "link completed work to a stated future action", answer: "Keep the deliberate past-to-future shift because the time marker makes it clear.", wrong: ["Change 'will publish' to 'published' and alter the plan.", "Use random tenses for variety.", "Delete the time marker."] },
  { key: "past-progressive", text: "While {name} checked the labels, the {group} measured the route.", purpose: "show two actions happening during the same past period", answer: "While {name} was checking the labels, the {group} was measuring the route.", wrong: ["While {name} will check, the group measured yesterday tomorrow.", "While checking, the route was the group.", "Both actions had finish now."] },
  { key: "present-perfect", text: "The repair is complete, and the result matters now.", purpose: "link completed work to the present", answer: "The {group} has completed the repair, so the {item} is ready.", wrong: ["The group had complete the repair now.", "The group has completing it yesterday tomorrow.", "The item completed the group."] },
  { key: "timeline-check", text: "Paragraph 1 narrates yesterday's test. Paragraph 2 unexpectedly switches to present without a time cue.", purpose: "repair an accidental shift", answer: "Return paragraph 2 to past tense or add a genuine present-time reason for the shift.", wrong: ["Keep every unexplained shift because variety creates cohesion.", "Add a place adverbial instead.", "Remove all verbs."] },
];

const repetitionItems = [
  { key: "technical", text: "The solar cell converts light into electricity. The solar cell must face the light source.", answer: "Keep 'solar cell' because it is the precise technical term and the repetition remains clear.", wrong: ["Replace it with 'shiny thing'.", "Use a different vague synonym every time.", "Delete the second subject."] },
  { key: "pronoun", text: "{Name} checked the {item}. {Name} then carried the {item} to the workbench.", answer: "{Name} checked the {item}. They then carried it to the workbench.", wrong: ["{Name} checked it. It carried them.", "They checked it before any referent is named.", "The object did a thing with it."] },
  { key: "those", text: "Three route maps were tested. The route maps with larger labels were easiest to follow.", answer: "Three route maps were tested. Those with larger labels were easiest to follow.", wrong: ["Things with labels were easiest.", "Three routes became labels.", "Those was route maps."] },
  { key: "lexical", text: "The display explores rivers. It includes maps of streams and photographs of the estuary.", answer: "Keep the related terms because they build a precise topic chain without pretending they mean exactly the same thing.", wrong: ["Replace every term with 'water thing'.", "Call each feature an estuary.", "Remove all topic vocabulary."] },
  { key: "reset", text: "The {project} is named in paragraph one. Two paragraphs discuss testing before the final paragraph returns to it.", answer: "Repeat the precise project name at the return point so the reader can recover the main thread.", wrong: ["Use 'it' after several possible referents.", "Invent an unrelated synonym.", "Remove the topic from the ending."] },
  { key: "ambiguous-one", text: "The blue {item} stood beside a smaller model. {Name} moved one to the cabinet.", answer: "Name the intended object because 'one' could refer to either model.", wrong: ["Keep 'one' because ambiguity creates cohesion.", "Replace both objects with 'it'.", "Guess from the colour."] },
  { key: "demonstrative", text: "Visitors requested shorter lines. Shorter lines were added to the guide.", answer: "Visitors requested shorter lines. This change was made in the guide.", wrong: ["Visitors requested it. This did it.", "The guide requested visitors.", "Lines changed the visitors."] },
  { key: "meaning-change", text: "The survey recorded accessibility barriers. An edit replaces 'barriers' with 'decorations'.", answer: "Reject the substitution because it changes the meaning rather than improving cohesion.", wrong: ["Accept every different word to avoid repetition.", "Delete 'accessibility'.", "Choose the longer word."] },
];

const ellipsisItems = [
  { key: "colour", text: "Mina chose the blue folder; Ari chose the green folder.", answer: "Mina chose the blue folder; Ari, the green.", wrong: ["Mina chose; Ari the green folder.", "Mina the blue; Ari chose.", "Remove both verbs and all folder references."] },
  { key: "inspect", text: "Some volunteers inspected the roof; others inspected the doors.", answer: "Some volunteers inspected the roof; others, the doors.", wrong: ["Some volunteers the roof; others inspected.", "Some inspected; the doors.", "Remove 'others' so the subject is unknown."] },
  { key: "modal", text: "Will the {group} finish today? They might finish today.", answer: "Will the {group} finish today? They might.", wrong: ["Will finish? Might today.", "The group? They.", "Remove the modal that carries the meaning."] },
  { key: "comparison", text: "The first route was wider than the second route was wide.", answer: "The first route was wider than the second.", wrong: ["The first wider the second.", "The route was than.", "Remove 'second' so the comparison disappears."] },
  { key: "auxiliary", text: "Zara has completed the labels, and Noor has completed the map.", answer: "Zara has completed the labels, and Noor the map.", wrong: ["Zara completed, and Noor has.", "Has the labels and Noor map.", "Delete both subjects."] },
  { key: "ambiguity", text: "The east room has two exits; the west room has one exit.", answer: "The east room has two exits; the west, one.", wrong: ["The east has; west one.", "Two exits; one.", "Remove the room contrast."] },
  { key: "no-ellipsis", text: "{Name} repaired the {item}. Later, the {group} repaired the display case.", answer: "Keep both verbs because different subjects and separated events make the repetition useful.", wrong: ["Delete every repeated verb automatically.", "Remove both subjects.", "Use ellipsis even when the remaining sentence is unclear."] },
  { key: "dots", text: "A learner says ellipsis always means writing three dots.", answer: "Explain that grammatical ellipsis can omit repeated words when the meaning remains recoverable.", wrong: ["Agree that only three dots count.", "Omit any words at random.", "Use ellipsis whenever a sentence feels long."] },
];

const sequenceItems = [
  { key: "instructions", stages: ["measure the space", "mark the position", "fit the {item}"], answer: "First, measure the space. Next, mark the position. Finally, fit the {item}.", wrong: ["Finally measure; earlier fit; meanwhile mark.", "Fit before measuring.", "Use random order for variety."] },
  { key: "report", stages: ["gather evidence", "compare proposals", "recommend one"], answer: "Evidence gathering -> comparison -> recommendation", wrong: ["Recommendation -> no evidence -> comparison", "Comparison -> recommendation -> evidence", "All stages are interchangeable"] },
  { key: "cause", stages: ["heavy rain damaged the path", "the route closed temporarily"], answer: "The path was damaged. As a result, the route closed temporarily.", wrong: ["The route closed. For example, rain is weather.", "Meanwhile caused the path.", "Use alphabetical order."] },
  { key: "flashback", stages: ["present visit begins", "earlier design decision", "present visit continues"], answer: "Present visit -> Earlier, the design had changed -> return to present visit", wrong: ["Earlier event -> unrelated future -> no return", "Present visit -> unexplained tense switch", "Random paragraph order"] },
  { key: "headings", stages: ["Problem", "Evidence", "Proposed change", "Review"], answer: "Problem -> Evidence -> Proposed change -> Review", wrong: ["Review -> Problem -> no evidence", "Evidence -> Review -> random change", "Use the same heading four times"] },
  { key: "simultaneous", stages: ["{name} checks labels", "the {group} measures the route"], answer: "While {name} checks the labels, the {group} measures the route.", wrong: ["Finally, both actions happened first.", "Because {name} checks, the group is a route.", "Earlier tomorrow, both happen."] },
  { key: "return", stages: ["state claim", "present evidence", "return to claim with judgement"], answer: "Claim -> evidence -> Returning to the claim, reasoned judgement", wrong: ["Judgement -> missing evidence -> new claim", "Evidence without a topic", "Repeat the claim unchanged three times"] },
  { key: "paragraphs", stages: ["introduce {project}", "explain method", "present finding", "evaluate limitation"], answer: "Introduction -> method -> finding -> limitation", wrong: ["Limitation -> introduction -> method -> hidden finding", "Finding -> unrelated introduction", "Order paragraphs by length"] },
];

const editingItems = [
  { key: "overlink", text: "The alarm sounded and then the doors opened and then the group moved forward.", answer: "The alarm sounded. Moments later, the doors opened and the group moved forward.", wrong: ["And then the alarm and then.", "Add 'however' before every clause.", "Delete the event sequence."] },
  { key: "wrong-link", text: "The guide uses larger print. However, it also uses shorter lines, which support the same goal.", answer: "Replace 'However' with 'In addition' because the second point supports the first.", wrong: ["Keep contrast because every paragraph needs it.", "Replace it with 'Yesterday'.", "Delete the supporting point."] },
  { key: "reference", text: "{Name} showed the {item} to a curator after they repaired it.", answer: "Name who repaired the {item}, because both people are possible referents.", wrong: ["Replace both people with 'they'.", "Delete the repair.", "Assume every reader guesses alike."] },
  { key: "tense", text: "The {group} tested the route and recorded the results. They recommend a wider gate.", answer: "Use 'recommended' for a past report, unless a deliberate present recommendation is clearly introduced.", wrong: ["Use a different tense in every sentence.", "Delete the recommendation.", "Add 'Meanwhile' without repairing time."] },
  { key: "voice", text: "{Name} wrote: 'The little {item} waited on the shelf.' An editor wants to remove every repeated noun and image.", answer: "Retain purposeful wording and edit only links that confuse; cohesion should not erase voice.", wrong: ["Replace every noun.", "Add formal links everywhere.", "Remove the image."] },
  { key: "missing-topic", text: "Paragraph one names the {project}. Later paragraphs use 'it', 'this' and 'that' after several other nouns.", answer: "Repeat the precise project name at a reset point, then use references while they remain clear.", wrong: ["Use more pronouns to hide the topic.", "Invent unrelated synonyms.", "Delete the naming paragraph."] },
  { key: "false-sequence", text: "An evidence paragraph begins 'Finally,' although it is not the final stage.", answer: "Choose an opener that states the real evidence relationship instead of a false sequence cue.", wrong: ["Keep 'Finally' because it sounds formal.", "Move the paragraph and break the logic.", "Delete the evidence."] },
  { key: "meaning", text: "An edit makes every sentence shorter but removes who completed each action.", answer: "Restore necessary subjects; smoother wording is not cohesive if responsibility becomes unclear.", wrong: ["Keep it because short always means clear.", "Add unspecified pronouns.", "Delete the actions."] },
];

const candidates = [
  ...expand("paragraph-links", 30, paragraphItems, buildParagraph),
  ...expand("reference-chains", 30, referenceItems, buildReference),
  ...expand("adverbials", 30, adverbialItems, buildAdverbial),
  ...expand("tense", 30, tenseItems, buildTense),
  ...expand("repetition", 30, repetitionItems, buildRepetition),
  ...expand("ellipsis", 29, ellipsisItems, buildEllipsis),
  ...expand("sequencing", 29, sequenceItems, buildSequence),
  ...expand("editing", 29, editingItems, buildEditing),
];

pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.adaptive_support.audio_first = "Optional paragraph and sentence playback uses only ElevenLabs assets after human listening approval. Browser TTS is prohibited; when audio is unavailable, visible text, line focus, chunked paragraphs and adult or partner reading routes remain complete.";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Depth-wave review bank reaches the 240-item pilot target with three preserved curated questions and 237 deterministic candidates covering paragraph links, reference chains, adverbials, tense consistency and deliberate shifts, repetition/substitution, grammatical ellipsis, sequencing and meaning-preserving editing. Generated candidates include SEND/dyslexia scaffolds, supported non-drag interactions, rich relationship/reference/meaning feedback, pressure-free publishing missions and optional ElevenLabs references requiring human listening approval; browser TTS is prohibited. Independent English, teacher, SEND, accessibility, safeguarding, audio and renderer review remains required before promotion.";

validateBank(pack, curated, candidates);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`writing-cohesion-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`writing-cohesion-bank strands=${summary(candidates, (variant) => variant.body.cohesion_strand)}`);
console.log(`writing-cohesion-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`writing-cohesion-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`writing-cohesion-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 6 writing-cohesion bank is out of date; run generate-y6-writing-cohesion-bank.mjs --write.");
  console.log("writing-cohesion-bank deterministic check passed");
} else {
  console.log("writing-cohesion-bank dry-run; pass --write to update the pack");
}

function buildParagraph(item, context, index, id) { const p1 = fill(item.p1, context); const p2 = fill(item.p2, context); return candidate({ id, format: "paragraph-edit", blueprint: "transition-purpose-choices", band: "expected", strand: "paragraph_links", context, prompt: `Paragraph route ${index + 1}: Paragraph 1 says '${p1}' Paragraph 2 says '${p2}' Which opening accurately signals ${item.relation}?`, text: `${p1}\n\n${p2}`, choices: [item.answer, ...item.wrong], answer: item.answer, relationship: item.relation, hints: ["Name the relationship in plain words before choosing a link.", "Reread with and without the signpost; reject wording that changes the logic."], explanation: `'${item.answer}' accurately signals ${item.relation}. It guides the reader without inventing a contrast, cause, time shift or example that the paragraphs do not contain.`, tag: item.key === "no-link" ? "link_every_paragraph" : "transition_as_decoration", repair: "Use relationship-labelled cards and include NO ADDED LINK as a genuine option before rereading both paragraphs." }); }
function buildReference(item, context, index, id) { const text = fill(item.text, context); return candidate({ id, format: "pronoun-link", blueprint: "pronoun-reference-links", band: "developing", strand: "reference_chains", context, prompt: `Reference thread ${index + 1}: in '${text}', what does '${fill(item.reference, context)}' refer to or require?`, text, choices: [item.answer, ...item.wrong], answer: item.answer, relationship: "reference expression to clear antecedent", hints: ["Trace backwards to the nearest noun or idea that makes complete sense.", "Substitute the referent into the sentence; if two meanings remain possible, repeat a precise noun."], explanation: `${fill(item.answer, context)} This keeps number and meaning consistent across the chain instead of asking the reader to guess from proximity alone.`, tag: item.key.includes("ambiguous") || item.key === "they" ? "unclear_pronoun_reference" : "nearest_noun_only", repair: "Show one reference at a time with numbered arrows to possible antecedents, then test each substitution aloud or silently." }); }
function buildAdverbial(item, context, index, id) { return candidate({ id, format: "paragraph-edit", blueprint: "transition-purpose-choices", band: "expected", strand: "adverbials", context, prompt: `Adverbial desk ${index + 1}: a paragraph needs to show ${fill(item.relation, context)}. Which opening fits?`, text: fill(item.relation, context), choices: [item.answer, ...item.wrong], answer: item.answer, relationship: fill(item.relation, context), hints: ["Sort the relationship as time, place, number, addition, contrast, cause or direct continuation.", "A formal-sounding adverbial is not useful if its meaning is wrong."], explanation: `'${item.answer}' matches ${fill(item.relation, context)}. The choice earns its place by making the relationship accurate rather than merely decorating the paragraph.`, tag: item.key === "no-adverbial" ? "link_every_sentence" : "transition_as_decoration", repair: "Group adverbial cards by relationship and test the no-link card before choosing; retain punctuation with each card." }); }
function buildTense(item, context, index, id) { return candidate({ id, format: "paragraph-edit", blueprint: "tense-and-sequence-links", band: "secure", strand: "tense_consistency", context, prompt: `Timeline edit ${index + 1}: '${fill(item.text, context)}' Which decision will ${fill(item.purpose, context)}?`, text: fill(item.text, context), choices: [item.answer, ...item.wrong], answer: item.answer, relationship: fill(item.purpose, context), hints: ["Place each event on a past-present-future timeline before editing verbs.", "Keep consistent tense within one time frame, but preserve deliberate shifts that have clear time cues."], explanation: `${fill(item.answer, context)} The verb forms align with the intended timeline; cohesion means controlled time relationships, not forcing every verb into one tense.`, tag: item.key.includes("deliberate") || item.key === "future-plan" ? "all_tense_shifts_wrong" : "accidental_tense_shift", repair: "Use one timeline lane per paragraph, place event cards first, then select complete verb phrases while keeping time markers visible." }); }
function buildRepetition(item, context, index, id) { const mapped = index % 2 === 1; return candidate({ id, format: "cohesion-thread", blueprint: mapped ? "cohesion-thread-maps" : "repetition-substitution-ellipsis", band: mapped ? "secure" : "expected", strand: "repetition_substitution", context, prompt: `Word-chain review ${index + 1}: '${fill(item.text, context)}' Which decision creates a clear lexical/reference chain without changing meaning?`, text: fill(item.text, context), choices: [item.answer, ...item.wrong], answer: item.answer, relationship: "precise repetition, safe substitution and recoverable topic chain", hints: ["Mark exact topic terms, then identify references or substitutions whose meaning remains recoverable.", "Keep necessary repetition when a synonym would become vague, inaccurate or ambiguous."], explanation: `${fill(item.answer, context)} Cohesion depends on a recoverable topic chain; variety is useful only when it preserves the same intended people, objects and ideas.`, tag: item.key === "meaning-change" ? "substitution_changes_meaning" : "synonym_at_all_costs", repair: "Display repeated terms and substitutions in parallel columns, then connect only words that retain the intended meaning." }); }
function buildEllipsis(item, context, index, id) { return candidate({ id, format: "cohesion-thread", blueprint: "repetition-substitution-ellipsis", band: "expected", strand: "ellipsis", context, prompt: `Ellipsis test ${index + 1}: '${fill(item.text, context)}' Which edit omits recoverable repetition without hiding meaning?`, text: fill(item.text, context), choices: [item.answer, ...item.wrong], answer: item.answer, relationship: "grammatical ellipsis of recoverable repeated wording", hints: ["Identify exactly which repeated words the reader can recover from the first clause.", "Reread the shortened version: keep subjects, contrasts and auxiliaries needed for meaning."], explanation: `${fill(item.answer, context)} This uses grammatical ellipsis only where repeated wording is recoverable; ellipsis is not simply adding three dots or deleting words at random.`, tag: item.key === "dots" ? "ellipsis_only_three_dots" : "ellipsis_hides_meaning", repair: "Strike through only repeated recoverable words, show the full version underneath, and restore any word needed to identify subject, action or contrast." }); }
function buildSequence(item, context, index, id) { return candidate({ id, format: "paragraph-edit", blueprint: "tense-and-sequence-links", band: "secure", strand: "sequencing", context, prompt: `Sequence board ${index + 1}: the stages are ${fillAll(item.stages, context).join("; ")}. Which order and linking plan is coherent?`, text: fillAll(item.stages, context).join(" | "), choices: [item.answer, ...item.wrong], answer: item.answer, relationship: "logical, chronological or argument sequence", hints: ["Arrange events or ideas by dependency before choosing signposts.", "Use time links for chronology, result links for cause, and return phrases for argument structure."], explanation: `${fill(item.answer, context)} The sequence preserves chronology or logic and uses links that describe the real relationship rather than forcing a decorative order.`, tag: "sequence_words_without_logic", repair: "Use numbered paragraph cards with move-up/down controls, then read the complete route before adding one relationship label." }); }
function buildEditing(item, context, index, id) { const retrieval = index % 4 === 3; return candidate({ id, format: retrieval ? "pronoun-link" : "paragraph-edit", blueprint: retrieval ? "cohesion-retrieval" : "overlinking-repairs", band: retrieval ? "retrieval" : "stretch", strand: "editing_for_meaning", context, prompt: `Publishing edit ${index + 1}: '${fill(item.text, context)}' Which revision improves cohesion while preserving information and voice?`, text: fill(item.text, context), choices: [item.answer, ...item.wrong], answer: item.answer, relationship: "integrated meaning-preserving cohesion edit", hints: ["State who did what, when and why before changing any link.", "Edit one feature, then compare the original and revision across the whole paragraph."], explanation: `${fill(item.answer, context)} The edit repairs the cohesion mismatch while preserving participants, sequence, logic, register and purposeful voice.`, tag: item.key === "overlink" ? "conjunction_overuse" : "edit_masks_meaning", repair: "Keep before-and-after panels visible, allow unlimited undo, and use a WHO-WHAT-WHEN-WHY meaning checklist after each edit." }); }

function candidate({ id, format, blueprint, band, strand, context, prompt, text, choices, answer, relationship, hints, explanation, tag, repair }) {
  const fullId = `${prefix}${id}`;
  const filledChoices = choices.map((choice) => fill(choice, context));
  const filledAnswer = fill(answer, context);
  const choiceSet = [...new Set(filledChoices)];
  while (choiceSet.length < 4) choiceSet.push(`Unsupported edit ${choiceSet.length + 1}`);
  const richExplanation = `${explanation} A different revision remains reviewable only when its changed relationship and meaning are explicitly justified.`;
  return {
    id: fullId,
    format,
    body: {
      prompt,
      text,
      choices: rotate(choiceSet, fullId.length % choiceSet.length),
      intended_relationship: relationship,
      cohesion_strand: strand,
      difficulty_band: band,
      evidence_purpose: `${strand}_relationship_reference_meaning`,
      variant_blueprint_id: blueprint,
      review_batch: "depth-wave",
      source_text_remains_visible: true,
      response_mode: "tap_keyboard_switch_oral_or_partner_response",
      interaction_support: { keyboard: true, switch_scan: true, touch: true, oral_or_partner_response: true, precision_drag_required: false, move_up_down_controls: true, undo_available: true },
      dyslexia_support: { increased_spacing: true, adjustable_line_length: true, line_focus: true, tinted_background_option: true, readable_font_option: true, chunked_paragraph_view: true, reference_word_focus: true },
      scaffold_routes: { visual: "colour-independent thread map and timeline", text: "numbered sentences with relationship labels", oral: "rehearse both versions and explain the link", reduced_choice: "compare original with one candidate before restoring all options", glossary: "reference, adverbial, substitution, ellipsis and tense with examples" },
      timer_allowed: false,
      speed_score_allowed: false,
      leaderboard_allowed: false,
      audio_optional: true,
      audio_asset_id: `narration-${fullId}`,
      audio_provider: "ElevenLabs",
      audio_asset_status: "required_human_listening_review",
      human_listening_approval_required: true,
      browser_tts_allowed: false,
      publishing_mission: { desk: `${context.place} publishing desk`, objective: `prepare a clear page for the ${context.project}`, strategic_unlock: "name the relationship, make one edit, then verify meaning across the paragraph", reward: "add one reviewed page tile to the shared publication", loss_on_error: false, streak_pressure: false, retry_message: "This draft revealed a useful thread break. Restore the original, revise one link, and reread when ready." },
    },
    expected_answer: { value: filledAnswer },
    hints,
    explanation: richExplanation,
    feedback: { correct: `Page link approved for review. ${richExplanation}`, relationship_feedback: "Name the time, cause, contrast, addition, sequence or reference relationship created by the edit.", reference_feedback: "Trace every pronoun, determiner, substitution or omitted word to a recoverable source.", meaning_check: "Confirm that people, actions, timing, logic and voice remain accurate.", revision_feedback: repair },
    difficulty: { developing: 4, expected: 5, secure: 7, stretch: 8, retrieval: 5 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: format === "pronoun-link" ? "pronoun-link-lock" : format === "cohesion-thread" ? "cohesion-thread-build" : "link-card-snap",
  };
}

function expand(label, count, items, builder) {
  return Array.from({ length: count }, (_, index) => {
    const item = items[index % items.length];
    const context = contexts[Math.floor(index / items.length) % contexts.length];
    return builder(item, context, index, `${label}-${item.key}-${context.key}`);
  });
}

function ensureBlueprints(currentPack) {
  const additions = [
    { id: "tense-and-sequence-links", format: "paragraph-edit", count: 300, difficulty_band: "secure", misconception_tag: "accidental_tense_shift", purpose: "Maintain or deliberately shift tense while sequencing events and argument stages coherently.", generation_pattern: "paragraph timeline + verb track + sequence cards + meaning-preserving edit", review_notes: "Distinguish accidental shifts from purposeful shifts marked by clear time references.", source: "ai_drafted_teacher_reviewed" },
    { id: "repetition-substitution-ellipsis", format: "cohesion-thread", count: 300, difficulty_band: "expected", misconception_tag: "ellipsis_hides_meaning", purpose: "Balance precise repetition, safe substitution and grammatical ellipsis while retaining recoverable meaning.", generation_pattern: "topic/reference chain + full and reduced versions + recoverability test", review_notes: "Do not equate grammatical ellipsis solely with three-dot punctuation or reward deletion that creates ambiguity.", source: "ai_drafted_teacher_reviewed" },
  ];
  for (const blueprint of additions) if (!currentPack.variant_blueprints.some((existing) => existing.id === blueprint.id)) currentPack.variant_blueprints.push(blueprint);
}

function validateBank(currentPack, authored, generated) {
  if (authored.length !== 3) throw new Error(`Expected three curated variants, found ${authored.length}.`);
  if (generated.length !== pilotTarget - authored.length || currentPack.question_variants.length !== pilotTarget) throw new Error(`Expected ${pilotTarget} total variants with ${pilotTarget - authored.length} generated.`);
  const blueprints = new Map(currentPack.variant_blueprints.map((item) => [item.id, item]));
  const formats = new Set(currentPack.practice.formats);
  const ids = new Set();
  const signatures = new Set();
  const strands = new Set();
  const actualFormats = new Set();
  const actualBlueprints = new Set();
  for (const item of currentPack.question_variants) {
    if (ids.has(item.id)) throw new Error(`Duplicate id ${item.id}.`);
    ids.add(item.id);
    const signature = `${item.format}|${normalise(item.body?.prompt)}|${normalise(item.expected_answer?.value)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${item.id}.`);
    signatures.add(signature);
  }
  for (const item of generated) {
    const blueprint = blueprints.get(item.body.variant_blueprint_id);
    if (!blueprint || blueprint.format !== item.format || blueprint.difficulty_band !== item.body.difficulty_band) throw new Error(`${item.id} does not match its blueprint format and band.`);
    if (!formats.has(item.format) || item.status !== "review" || !item.body.source_text_remains_visible) throw new Error(`${item.id} has unsupported format, status or hidden source text.`);
    if (!item.body.interaction_support?.keyboard || !item.body.interaction_support?.switch_scan || !item.body.interaction_support?.oral_or_partner_response || item.body.interaction_support?.precision_drag_required !== false) throw new Error(`${item.id} lacks supported interactions.`);
    if (!item.body.dyslexia_support?.increased_spacing || !item.body.dyslexia_support?.line_focus || !item.body.dyslexia_support?.chunked_paragraph_view || !item.body.scaffold_routes?.visual || !item.body.scaffold_routes?.text || !item.body.scaffold_routes?.oral || !item.body.scaffold_routes?.reduced_choice) throw new Error(`${item.id} lacks SEND/dyslexia scaffolds.`);
    if (item.body.audio_provider !== "ElevenLabs" || item.body.audio_asset_status !== "required_human_listening_review" || item.body.human_listening_approval_required !== true || item.body.browser_tts_allowed !== false) throw new Error(`${item.id} violates audio policy.`);
    if (item.body.timer_allowed !== false || item.body.speed_score_allowed !== false || item.body.leaderboard_allowed !== false || item.body.publishing_mission?.loss_on_error !== false || item.body.publishing_mission?.streak_pressure !== false || !item.body.publishing_mission?.strategic_unlock) throw new Error(`${item.id} has unsuitable publishing gamification.`);
    if (!item.feedback?.correct || !item.feedback?.relationship_feedback || !item.feedback?.reference_feedback || !item.feedback?.meaning_check || !item.feedback?.revision_feedback || item.hints.length < 2 || item.explanation.length < 110) throw new Error(`${item.id} lacks rich feedback.`);
    if (!Array.isArray(item.body.choices) || item.body.choices.length < 4 || new Set(item.body.choices).size !== item.body.choices.length || item.body.choices.filter((choice) => choice === item.expected_answer.value).length !== 1) throw new Error(`${item.id} has invalid choices.`);
    strands.add(item.body.cohesion_strand);
    actualFormats.add(item.format);
    actualBlueprints.add(item.body.variant_blueprint_id);
  }
  requireCoverage("strands", ["paragraph_links", "reference_chains", "adverbials", "tense_consistency", "repetition_substitution", "ellipsis", "sequencing", "editing_for_meaning"], strands);
  requireCoverage("formats", [...formats], actualFormats);
  requireCoverage("blueprints", [...blueprints.keys()], actualBlueprints);
}

function requireCoverage(label, required, actual) { const missing = required.filter((item) => !actual.has(item)); if (missing.length) throw new Error(`Generated bank is missing ${label}: ${missing.join(", ")}.`); }
function fill(value, context) { return String(value).replaceAll("{name}", context.name).replaceAll("{Name}", context.name).replaceAll("{group}", context.group).replaceAll("{place}", context.place).replaceAll("{item}", context.item).replaceAll("{project}", context.project); }
function fillAll(items, context) { return items.map((item) => fill(item, context)); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function summary(items, keyFor) { const counts = new Map(); for (const item of items) counts.set(keyFor(item), (counts.get(keyFor(item)) ?? 0) + 1); return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
