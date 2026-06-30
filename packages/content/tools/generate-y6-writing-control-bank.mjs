#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/en-y6-writing-control.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "en-y6-writing-control-bank-";
const pilotTarget = 240;

if (write && check) throw new Error("Choose either --write or --check, not both.");

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "en-y6-writing-control") throw new Error("This generator only supports the Year 6 writing-control pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 5) throw new Error(`Expected exactly 5 curated variants, found ${curated.length}. Refusing to overwrite possible authored work.`);

ensureBlueprints(pack);

const contexts = [
  { key: "museum", name: "Mina", group: "curators", place: "local museum", item: "model boat", project: "harbour exhibition" },
  { key: "wetland", name: "Ari", group: "survey team", place: "wetland reserve", item: "field camera", project: "bird survey" },
  { key: "library", name: "Zara", group: "reading group", place: "community library", item: "story map", project: "history display" },
  { key: "workshop", name: "Noor", group: "design team", place: "repair workshop", item: "solar lantern", project: "energy project" },
];

const audienceCases = [
  { key: "report", text: "Loads of people left stuff everywhere.", purpose: "a neutral report to the school council", answer: "Many visitors left litter across the site.", wrong: ["People were super messy everywhere.", "The litter situation was, like, awful.", "All visitors deliberately ruined the site."] },
  { key: "peer", text: "Transportation of the aforementioned chart is requested.", purpose: "a friendly message to a classmate", answer: "Could you bring the chart tomorrow, please?", wrong: ["Chart conveyance is hereby mandated.", "Bring it now or else.", "The chart shall be transported by the recipient."] },
  { key: "welcome", text: "Attendance at the event is formally acknowledged.", purpose: "a warm spoken welcome for families", answer: "Welcome—we are delighted that you could join us.", wrong: ["Participants shall enter the premises.", "Yo, everyone, get in.", "Your attendance has been processed."] },
  { key: "instructions", text: "Maybe sort of turn the equipment off if you fancy it.", purpose: "clear safety instructions", answer: "Switch off the approved classroom equipment before opening the case.", wrong: ["Equipment offness is conceptually preferable.", "Just try the case until it opens.", "You might possibly do something safe."] },
  { key: "persuade", text: "The ramp is a thing we could maybe have.", purpose: "a reasoned proposal for improving access", answer: "Installing a ramp would allow more visitors to enter independently.", wrong: ["A ramp would be awesome, obviously.", "Everyone definitely demands this exact ramp.", "Ramp. Access. Good."] },
  { key: "diary", text: "The participant experienced significant apprehension prior to the event.", purpose: "a personal diary reflection", answer: "I was nervous before the event began.", wrong: ["The subject manifested pre-event apprehension.", "Nerves occurred in the participant unit.", "One was formally nervous pursuant to the event."] },
];

const sentenceCases = [
  { key: "overload", text: "The storm arrived and the trees bent and the path flooded and the team turned back because it was unsafe.", purpose: "guide the reader through events and cause", answer: "The storm arrived, and the trees bent in the wind. When the path flooded, the team turned back because it was unsafe.", wrong: ["The storm and and trees and path and team.", "The storm, arrived the trees, bent unsafe.", "Turned back storm path because trees."] },
  { key: "fragment", text: "Because the warning light flashed.", purpose: "complete the cause-and-response meaning", answer: "Because the warning light flashed, the {group} checked the control panel.", wrong: ["Because the warning light.", "The group. Because checked.", "Flashed because, the panel."] },
  { key: "run-on", text: "The doors opened the visitors entered the {place}.", purpose: "separate two complete events clearly", answer: "The doors opened, and the visitors entered the {place}.", wrong: ["The doors, opened the visitors, entered.", "Because the doors opened and.", "The visitors the doors entered."] },
  { key: "short-result", text: "After checking every connection twice and replacing the loose cable, the {group} found that the signal returned.", purpose: "foreground the final result", answer: "The {group} checked every connection twice and replaced the loose cable. The signal returned.", wrong: ["The group checked. Every connection because signal.", "Returned signal group cable twice.", "The signal returned because and after."] },
  { key: "parallel", text: "The team measured the frame, checking the joints and the result was recorded.", purpose: "create a controlled parallel list", answer: "The team measured the frame, checked the joints and recorded the result.", wrong: ["The team measure, checked and recording.", "Measured frame and the team checking.", "The result measured the team."] },
  { key: "subordination", text: "Rain entered the case, the label became damaged.", purpose: "make cause explicit without a comma splice", answer: "Because rain entered the case, the label became damaged.", wrong: ["Rain entered, because the label.", "The label, became rain damaged.", "Rain entered the case the label damaged."] },
];

const viewpointCases = [
  { key: "first-person", text: "The report follows {name}'s personal experience, but shifts to 'you' halfway through.", purpose: "maintain a first-person reflective viewpoint", answer: "I entered the {place} and noticed the {item} immediately.", wrong: ["You entered and I notice it.", "They entered and you noticed my item.", "One enters, and I were noticing."] },
  { key: "third-person", text: "A biography begins with '{name} examined the design.'", purpose: "maintain third-person biographical viewpoint", answer: "They recorded each revision before testing it.", wrong: ["I recorded my revision.", "You record each revision.", "We are {name} and tested it."] },
  { key: "objective", text: "I absolutely loved how brilliant the results were.", purpose: "an objective investigation report", answer: "The results showed a consistent increase across the three trials.", wrong: ["The results were amazingly perfect.", "I reckon the results totally won.", "Everyone must love these results."] },
  { key: "close-view", text: "The narrative stays close to {name}, who cannot see behind the closed door.", purpose: "preserve the character's limited knowledge", answer: "{Name} heard a chair scrape, but could not tell who was inside.", wrong: ["Unknown to {name}, the director hid the map inside.", "{Name} knew every thought in the building.", "The narrator proves who was inside without a clue."] },
  { key: "formal-consistency", text: "The evidence supports the proposal. Also, it is kinda brilliant.", purpose: "maintain a measured formal register", answer: "The evidence supports the proposal. Furthermore, it addresses the main concern.", wrong: ["The evidence is, like, into the proposal.", "The proposal totally works.", "The evidence vibes with it."] },
  { key: "spoken", text: "The speaker is addressing younger pupils directly.", purpose: "use an encouraging spoken register", answer: "You can test your idea, change one part and try again.", wrong: ["Participants shall undertake iterative modification.", "One's hypothesis requires procedural recalibration.", "Your wrong idea must be discarded."] },
];

const vocabularyCases = [
  { key: "calm", text: "The guide ___ the pupils to the exit.", purpose: "a calm, precise action", answer: "directed", wrong: ["shoved", "zoomed", "messed"] },
  { key: "quick", text: "The wren ___ between the benches.", purpose: "a sudden, rapid movement", answer: "darted", wrong: ["went", "occupied", "announced"] },
  { key: "careful", text: "{Name} ___ the fragile label before moving it.", purpose: "a close, careful examination", answer: "examined", wrong: ["looked-ish at", "wrecked", "ignored"] },
  { key: "hesitant", text: "{Name}'s hand ___ above the {item}.", purpose: "hesitation before touching", answer: "hovered", wrong: ["was", "attacked", "calculated"] },
  { key: "gather", text: "Visitors ___ around the new display.", purpose: "people gathering closely with interest", answer: "clustered", wrong: ["stood", "escaped", "vanished"] },
  { key: "fade", text: "The final note of music ___ through the {place}.", purpose: "a gradual decrease in sound", answer: "faded", wrong: ["stopped", "exploded", "argued"] },
];

const cohesionCases = [
  { key: "contrast", text: "The first design was cheap. ___, it did not provide enough space.", purpose: "signal contrast", answer: "However", wrong: ["Therefore", "Similarly", "Earlier"] },
  { key: "result", text: "The path flooded. ___, the survey was moved indoors.", purpose: "signal result", answer: "Consequently", wrong: ["Meanwhile", "For example", "Nearby"] },
  { key: "reference", text: "{Name} put the {item} beside the camera before moving it.", purpose: "make the moved object clear", answer: "Repeat 'the {item}' if that object moved.", wrong: ["Replace both nouns with 'it'.", "Keep the ambiguity.", "Delete the movement."] },
  { key: "repetition", text: "The solar cell converts light. The solar cell must face the source.", purpose: "retain a precise technical topic chain", answer: "Keep 'solar cell' because exact repetition supports clarity.", wrong: ["Replace it with 'shiny thing'.", "Use a new vague synonym each time.", "Delete the second subject."] },
  { key: "overlink", text: "The alarm sounded and then the doors opened and then the crowd moved.", purpose: "show time without repetitive linking", answer: "The alarm sounded. Moments later, the doors opened and the crowd moved.", wrong: ["And then the alarm and then.", "Add 'however' everywhere.", "Delete the sequence."] },
  { key: "reset", text: "The {project} is named, then several other nouns intervene before the final paragraph uses 'it'.", purpose: "restore a recoverable topic chain", answer: "Repeat the precise project name at the return point.", wrong: ["Add more unspecified pronouns.", "Invent an unrelated synonym.", "Remove the topic entirely."] },
];

const paragraphCases = [
  { key: "topic", text: "A paragraph begins with one claim, moves to an unrelated history, then ends with a different recommendation.", purpose: "control one main paragraph focus", answer: "Keep the claim and its evidence together; move the separate history or recommendation to a purposeful paragraph.", wrong: ["Keep every idea because longer paragraphs are stronger.", "Remove all paragraph breaks.", "Order sentences by length."] },
  { key: "evidence", text: "The claim appears in paragraph one, but its strongest evidence is hidden two paragraphs later.", purpose: "place evidence where its relationship is clear", answer: "Move the strongest evidence beside the claim, then explain how it supports the point.", wrong: ["Leave the evidence distant to surprise the reader.", "Delete the claim.", "Repeat the evidence without explanation."] },
  { key: "sequence", text: "Instructions present the final check before the equipment is assembled.", purpose: "control chronological paragraph order", answer: "Order preparation, assembly, test and final check in the sequence the reader must follow.", wrong: ["Keep the final check first because it sounds important.", "Order steps alphabetically.", "Remove sequence cues and headings."] },
  { key: "contrast", text: "One paragraph mixes advantages and limitations without signalling the change.", purpose: "control a comparison paragraph", answer: "Group supporting points, then signal the shift to limitations with a precise contrast sentence.", wrong: ["Alternate randomly between positive and negative points.", "Use 'however' before every sentence.", "Delete all limitations."] },
  { key: "opening-close", text: "A report introduction gives detailed results, while the conclusion introduces a new method.", purpose: "give paragraphs distinct roles", answer: "Use the introduction for purpose and scope, results paragraphs for findings, and the conclusion for judgement rather than new method detail.", wrong: ["Put every detail in the introduction.", "Introduce new evidence only in the conclusion.", "Use identical paragraphs."] },
  { key: "narrative", text: "A narrative paragraph describes entering the room, then jumps to next morning and back without cues.", purpose: "control narrative time and paragraph breaks", answer: "Keep the immediate scene together and begin a new paragraph with a clear cue for the next morning.", wrong: ["Switch time mid-sentence repeatedly.", "Remove all time cues.", "Keep every event in one paragraph."] },
];

const tenseCases = [
  { key: "past", text: "The {group} entered the {place} and records the temperature.", purpose: "maintain past tense", answer: "The {group} entered the {place} and recorded the temperature.", wrong: ["The group enters and recorded.", "The group entering and records.", "The temperature entered the group."] },
  { key: "person", text: "I checked the first label, and then you measured the case.", purpose: "maintain first-person account of one writer's actions", answer: "I checked the first label, and then I measured the case.", wrong: ["I checked, then you measured my action.", "They checked and I measures.", "You and I becomes it."] },
  { key: "earlier", text: "The team returned to base. They discovered the fault before that.", purpose: "make the earlier past event explicit", answer: "The team returned to base. Earlier, they had discovered the fault.", wrong: ["Earlier, they discover it.", "They will discover it before returning yesterday.", "Nearby, tomorrow had discovered."] },
  { key: "present", text: "The guide explains the route and described the final viewpoint.", purpose: "maintain present tense in a current guide", answer: "The guide explains the route and describes the final viewpoint.", wrong: ["The guide explained and describes.", "The guide explaining and described.", "The viewpoint guides the explain."] },
  { key: "deliberate", text: "The {item} stands in the gallery today. It was recovered in 1986.", purpose: "preserve a deliberate present-to-past shift", answer: "Keep the shift because 'today' and 'in 1986' clearly mark different time frames.", wrong: ["Force every verb into present.", "Force every verb into past and remove current status.", "Add a random connective."] },
  { key: "viewpoint", text: "A third-person biography suddenly says, 'I redesigned the frame.'", purpose: "maintain third-person viewpoint", answer: "Replace 'I redesigned' with '{name} redesigned' unless the text clearly introduces a quotation.", wrong: ["Change every sentence to second person.", "Keep the unexplained switch.", "Delete the redesign."] },
];

const editingCases = [
  { key: "meaning", text: "An edit shortens every sentence but removes who completed each action.", purpose: "edit for clarity without hiding responsibility", answer: "Restore necessary subjects; concise writing is not controlled if agency becomes unclear.", wrong: ["Keep it because short always means clear.", "Add more unspecified pronouns.", "Delete the actions."] },
  { key: "certainty", text: "The evidence is limited, but the draft says the footprint must belong to a fox.", purpose: "match certainty to evidence", answer: "The footprint might belong to a fox.", wrong: ["The footprint definitely belongs to a fox.", "The footprint cannot maybe belong.", "Delete all reference to evidence."] },
  { key: "register", text: "The formal report says, 'The results were super amazing.'", purpose: "preserve result while controlling register", answer: "The results showed a substantial increase.", wrong: ["The results were totally brilliant.", "Amazingness occurred.", "Everyone loved the results."] },
  { key: "voice", text: "The procedure should focus on the sample, but says, 'We heated the sample.'", purpose: "foreground the procedure's affected material", answer: "The sample was heated for two minutes.", wrong: ["We were the sample heating.", "The sample heated us.", "For two minutes was heat."] },
  { key: "overedit", text: "A clear sentence is repeatedly altered only to sound more complex.", purpose: "retain meaningful control", answer: "Keep the clearest accurate version when added complexity creates no useful effect.", wrong: ["Always choose the longest sentence.", "Add punctuation at every pause.", "Make every sentence passive."] },
  { key: "fact", text: "An edit changes 'three trials' to 'many trials' because it sounds smoother.", purpose: "preserve factual meaning", answer: "Keep 'three trials' because cohesion and style edits must not alter the evidence.", wrong: ["Use 'many' because vagueness sounds formal.", "Remove the number.", "Invent more trials."] },
];

const punctuationCases = [
  { key: "semicolon", text: "The lights flickered the generator had failed.", purpose: "link two closely related independent clauses", answer: "The lights flickered; the generator had failed.", wrong: ["The lights; flickered because the generator.", "The lights flickered the; generator failed.", "Because the lights; the generator."] },
  { key: "colon", text: "The kit contained three items a map, a torch and a notebook.", purpose: "introduce a list after a complete clause", answer: "The kit contained three items: a map, a torch and a notebook.", wrong: ["The kit contained: three items.", "The kit: contained three items.", "Because the kit contained: three."] },
  { key: "dash", text: "One object remained unchecked the {item}.", purpose: "emphasise the final revealing detail", answer: "One object remained unchecked—the {item}.", wrong: ["One—object remained unchecked.", "One object—remained—unchecked.", "Because one object remained—the item."] },
  { key: "rhythm", text: "The trolley clattered and the doors banged and everyone spoke and the {item} beeped softly.", purpose: "use sentence rhythm to foreground the quiet final sound", answer: "The trolley clattered, the doors banged and everyone spoke at once. Then the {item} gave one soft beep.", wrong: ["Clattered. Doors. Everyone. Item.", "Join every action with more 'and'.", "Remove the quiet sound."] },
  { key: "parenthesis", text: "The {item} which arrived on Monday was inspected first.", purpose: "mark supplementary information about the only named item", answer: "The {item} (which arrived on Monday) was inspected first.", wrong: ["The item which (arrived on Monday was) inspected.", "The (item which arrived) on Monday.", "The item which arrived on Monday) was inspected("] },
  { key: "restraint", text: "The draft adds a dash, colon and semicolon to one short clause.", purpose: "avoid decorative overpunctuation", answer: "Use only punctuation required by the grammatical structure and intended emphasis.", wrong: ["Keep all marks because advanced punctuation is always better.", "Add another dash.", "Replace every full stop with a semicolon."] },
];

const genreCases = [
  { key: "report-to-speech", text: "The report states: 'The survey recorded a 20% increase.'", purpose: "transfer the information into a clear spoken presentation", answer: "Our survey found a 20% increase—here is what that means for the project.", wrong: ["Aforementioned increase is hereby vocalised.", "It went up loads, trust me.", "Delete the finding for a better speech."] },
  { key: "diary-to-report", text: "Diary: 'I was thrilled when the first seed opened.'", purpose: "transfer the event into an objective report", answer: "The first seed germinated on day six.", wrong: ["The amazing seed made everyone thrilled.", "I loved the seed in the formal report.", "Seeds are always exciting."] },
  { key: "notes-to-narrative", text: "Notes: door opened; room silent; {name} hesitated.", purpose: "transfer notes into controlled narrative", answer: "The door opened onto a silent room. {Name} reached for the handle again—then stopped.", wrong: ["Door room silent hesitate.", "The door opened and then and then.", "A formal report hereby records hesitation."] },
  { key: "report-to-leaflet", text: "Report: 'The eastern path lacks a level entrance.'", purpose: "transfer evidence into a concise persuasive leaflet", answer: "Support a level eastern entrance so more visitors can use the path independently.", wrong: ["The path is bad and everyone hates it.", "Levelness shall be implemented.", "Ignore the evidence and use a slogan only."] },
  { key: "interview-to-bio", text: "Interview: 'I tested the frame five times before it held.'", purpose: "transfer a quotation into third-person biography", answer: "{Name} tested the frame five times before the design held.", wrong: ["I tested my frame in the biography.", "You tested it five times.", "The frame definitely never failed."] },
  { key: "story-to-summary", text: "A full scene describes the team finding, checking and securing the missing {item}.", purpose: "transfer the scene into a concise summary", answer: "The {group} recovered and secured the missing {item} after checking its condition.", wrong: ["Something happened with it.", "Repeat every line of dialogue.", "Add an unrelated explanation."] },
];

const candidates = [
  ...expand("audience", 24, audienceCases, buildAudience),
  ...expand("sentences", 24, sentenceCases, buildSentence),
  ...expand("viewpoint", 24, viewpointCases, buildViewpoint),
  ...expand("vocabulary", 24, vocabularyCases, buildVocabulary),
  ...expand("cohesion", 24, cohesionCases, buildCohesion),
  ...expand("paragraphs", 23, paragraphCases, buildParagraph),
  ...expand("tense-person", 23, tenseCases, buildTense),
  ...expand("editing", 23, editingCases, buildEditing),
  ...expand("punctuation", 23, punctuationCases, buildPunctuation),
  ...expand("genre", 23, genreCases, buildGenre),
];

pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.adaptive_support.audio_first = "Where listening materially supports register, rhythm or sentence comparison, optional playback uses only ElevenLabs assets after human listening approval. Browser TTS is prohibited; every task remains complete through visible text, chunking, line focus and adult or partner reading.";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Production-wave review bank reaches the 240-item pilot target with five preserved curated questions and 235 deterministic candidates covering audience and purpose, sentence length and structure, viewpoint and register, precise vocabulary, cohesion, paragraph control, tense and person consistency, meaning-preserving editing, punctuation and rhythm, and genre transfer. Generated candidates include SEND/dyslexia routes, chunking, model comparisons, supported non-drag interactions, rich formative feedback, and pressure-free publishing/story missions. Optional ElevenLabs references appear only where listening supports register, rhythm or sentence comparison, require human review, and never use browser TTS. Independent English, teacher, SEND, accessibility, safeguarding, audio and renderer review remains required before promotion.";

validateBank(pack, curated, candidates);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`writing-control-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`writing-control-bank strands=${summary(candidates, (variant) => variant.body.writing_strand)}`);
console.log(`writing-control-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`writing-control-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`writing-control-bank optional_audio=${candidates.filter((variant) => variant.body.audio_optional).length}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`writing-control-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 6 writing-control bank is out of date; run generate-y6-writing-control-bank.mjs --write.");
  console.log("writing-control-bank deterministic check passed");
} else {
  console.log("writing-control-bank dry-run; pass --write to update the pack");
}

function buildAudience(item, context, index, id) { return candidate({ id, format: "register-slider", blueprint: "register-adjustment-edits", band: "expected", strand: "audience_purpose", context, prompt: `Audience desk ${index + 1}: rewrite '${fill(item.text, context)}' for ${fill(item.purpose, context)}.`, text: item.text, choices: [item.answer, ...item.wrong], answer: item.answer, purpose: item.purpose, model: item.answer, hints: ["Identify audience, purpose and form before selecting vocabulary and tone.", "Keep the original information; formal does not mean needlessly complicated, and informal does not mean unclear."], explanation: `${fill(item.answer, context)} fits ${fill(item.purpose, context)} while preserving the intended information and using an appropriate level of precision and directness.`, tag: "register_mismatch", repair: "Compare audience-purpose cards and highlight only the language choices that create register before rehearsing the revision.", audioHelpful: true }); }
function buildSentence(item, context, index, id) { return candidate({ id, format: "sentence-control-panel", blueprint: "sentence-clarity-control", band: "secure", strand: "sentence_length_structure", context, prompt: `Sentence-control panel ${index + 1}: which edit will ${fill(item.purpose, context)}?`, text: item.text, choices: [item.answer, ...item.wrong], answer: item.answer, purpose: item.purpose, model: item.answer, hints: ["Mark each subject-verb unit and the relationship between ideas.", "Choose sentence length and structure for meaning; neither long nor short is automatically better."], explanation: `${fill(item.answer, context)} controls clause boundaries and sentence length to ${fill(item.purpose, context)} without losing participants, sequence or cause.`, tag: "overloaded_sentence", repair: "Place one clause per line, label the relationship, then compare the original and revised rhythm with static chunk cards.", audioHelpful: true }); }
function buildViewpoint(item, context, index, id) { return candidate({ id, format: "register-slider", blueprint: "viewpoint-tense-person-control", band: "secure", strand: "viewpoint_register", context, prompt: `Viewpoint studio ${index + 1}: '${fill(item.text, context)}' Which version will ${fill(item.purpose, context)}?`, text: item.text, choices: [item.answer, ...item.wrong], answer: item.answer, purpose: item.purpose, model: item.answer, hints: ["Track who is speaking or observing and what that viewpoint can know.", "Keep person and register consistent unless a quotation or deliberate shift is clearly introduced."], explanation: `${fill(item.answer, context)} maintains the intended viewpoint and register while keeping knowledge, agency and audience relationship accurate.`, tag: "viewpoint_person_shift", repair: "Use first-, second- and third-person cards plus a knowledge boundary box before selecting the revision.", audioHelpful: true }); }
function buildVocabulary(item, context, index, id) { return candidate({ id, format: "effect-edit", blueprint: "precision-and-tone-edits", band: "secure", strand: "precise_vocabulary", context, prompt: `Vocabulary lens ${index + 1}: choose the word for ${fill(item.purpose, context)} in '${fill(item.text, context)}'`, text: item.text, choices: [item.answer, ...item.wrong], answer: item.answer, purpose: item.purpose, model: fill(item.text, context).replace("___", fill(item.answer, context)), hints: ["Test denotation first: does the word accurately name the action or quality?", "Then test connotation and register; reject intensity or sophistication that distorts meaning."], explanation: `'${fill(item.answer, context)}' precisely creates ${fill(item.purpose, context)}. The alternatives are vague, inaccurate or introduce an unintended tone.`, tag: "vocabulary_without_effect", repair: "Compare a plain word, precise candidate and distorted candidate using meaning-and-tone columns plus an optional glossary.", audioHelpful: false }); }
function buildCohesion(item, context, index, id) { const retrieval = index % 2 === 1; return candidate({ id, format: "effect-edit", blueprint: retrieval ? "writing-control-retrieval" : "precision-and-tone-edits", band: retrieval ? "retrieval" : "secure", strand: "cohesion", context, prompt: `Cohesion check ${index + 1}: '${fill(item.text, context)}' Which edit will ${fill(item.purpose, context)}?`, text: item.text, choices: [item.answer, ...item.wrong], answer: item.answer, purpose: item.purpose, model: item.answer, hints: ["Name the relationship or referent before choosing a link.", "Preserve precise repetition when substitution or pronouns would become vague."], explanation: `${fill(item.answer, context)} creates a recoverable relationship or topic chain and avoids decorative linking, ambiguity or needless variation.`, tag: item.key === "reference" ? "unclear_reference" : "cohesion_device_as_decoration", repair: "Use a reference/thread map and compare the paragraph with and without the proposed device.", audioHelpful: false }); }
function buildParagraph(item, context, index, id) { return candidate({ id, format: "sentence-control-panel", blueprint: "paragraph-control-and-cohesion", band: "stretch", strand: "paragraph_control", context, prompt: `Paragraph architect ${index + 1}: '${fill(item.text, context)}' Which plan will ${fill(item.purpose, context)}?`, text: item.text, choices: [item.answer, ...item.wrong], answer: item.answer, purpose: item.purpose, model: item.answer, hints: ["Give each paragraph one main role in the whole text.", "Place claims beside evidence, events in usable order, and paragraph breaks where focus, time or speaker changes."], explanation: `${fill(item.answer, context)} controls paragraph focus and progression while making relationships explicit and preserving the text's intended content.`, tag: "paragraph_as_length_only", repair: "Use movable heading-summary cards with one PURPOSE label per paragraph, then preview the whole-text route before editing sentences.", audioHelpful: false }); }
function buildTense(item, context, index, id) { return candidate({ id, format: "register-slider", blueprint: "viewpoint-tense-person-control", band: "secure", strand: "tense_person_consistency", context, prompt: `Consistency track ${index + 1}: '${fill(item.text, context)}' Which decision will ${fill(item.purpose, context)}?`, text: item.text, choices: [item.answer, ...item.wrong], answer: item.answer, purpose: item.purpose, model: item.answer, hints: ["Place events on a timeline and identify the narrator or grammatical person.", "Repair accidental shifts but preserve deliberate changes with clear time, speaker or quotation cues."], explanation: `${fill(item.answer, context)} keeps tense and person aligned with the intended timeline and viewpoint without flattening a purposeful shift.`, tag: item.key === "deliberate" ? "all_shifts_wrong" : "accidental_tense_person_shift", repair: "Use a timeline and person track above each sentence, then change only the first mismatch and reread the sequence.", audioHelpful: true }); }
function buildEditing(item, context, index, id) { const retrieval = index % 3 === 2; return candidate({ id, format: retrieval ? "effect-edit" : "sentence-control-panel", blueprint: retrieval ? "writing-control-retrieval" : "sentence-clarity-control", band: retrieval ? "retrieval" : "secure", strand: "editing_for_meaning", context, prompt: `Meaning edit ${index + 1}: '${fill(item.text, context)}' Which revision will ${fill(item.purpose, context)}?`, text: item.text, choices: [item.answer, ...item.wrong], answer: item.answer, purpose: item.purpose, model: item.answer, hints: ["State who did what, when, with what certainty and for which audience before editing.", "Change one control feature and compare the original and revision across the whole meaning."], explanation: `${fill(item.answer, context)} improves control while preserving factual content, agency, certainty, sequence and purpose.`, tag: "edit_changes_meaning", repair: "Keep before-and-after panels visible, allow unlimited undo, and use a WHO-WHAT-WHEN-CERTAINTY checklist.", audioHelpful: false }); }
function buildPunctuation(item, context, index, id) { return candidate({ id, format: "punctuation-purpose", blueprint: "punctuation-for-purpose", band: "expected", strand: "punctuation_rhythm", context, prompt: `Punctuation and rhythm desk ${index + 1}: '${fill(item.text, context)}' Which edit will ${fill(item.purpose, context)}?`, text: item.text, choices: [item.answer, ...item.wrong], answer: item.answer, purpose: item.purpose, model: item.answer, hints: ["Check grammatical structure before listening for emphasis or rhythm.", "Use punctuation to clarify a boundary, introduction, interruption or parenthesis; avoid adding marks for display."], explanation: `${fill(item.answer, context)} uses punctuation and sentence rhythm to ${fill(item.purpose, context)} while remaining grammatically controlled.`, tag: "decorative_punctuation", repair: "Compare static clause maps first, then use reviewed playback only to hear the effect of two grammatically valid versions.", audioHelpful: true }); }
function buildGenre(item, context, index, id) { return candidate({ id, format: "multiple_choice", blueprint: "audience-purpose-genre-transfer", band: "expected", strand: "genre_transfer", context, prompt: `Genre transfer ${index + 1}: '${fill(item.text, context)}' Which version will ${fill(item.purpose, context)} while preserving the core information?`, text: item.text, choices: [item.answer, ...item.wrong], answer: item.answer, purpose: item.purpose, model: item.answer, hints: ["Identify what information must survive the transfer before changing style.", "Adjust viewpoint, register, structure and detail selection to the destination genre rather than copying surface features."], explanation: `${fill(item.answer, context)} preserves the core event or evidence while adapting viewpoint, register, structure and emphasis for the new genre.`, tag: "genre_as_surface_features", repair: "Use SOURCE INFORMATION and DESTINATION CONTROL columns, then compare a model pair with the same content in two genres.", audioHelpful: true }); }

function candidate({ id, format, blueprint, band, strand, context, prompt, text, choices, answer, purpose, model, hints, explanation, tag, repair, audioHelpful }) {
  const fullId = `${prefix}${id}`;
  const filledChoices = choices.map((choice) => fill(choice, context));
  const filledAnswer = fill(answer, context);
  const choiceSet = [...new Set(filledChoices)];
  while (choiceSet.length < 4) choiceSet.push(`Unsupported revision ${choiceSet.length + 1}`);
  const richExplanation = `${explanation} Another revision remains reviewable only if it preserves meaning and explains a deliberate effect for the stated audience and purpose.`;
  return {
    id: fullId,
    format,
    body: {
      prompt,
      original: fill(text, context),
      choices: rotate(choiceSet, fullId.length % choiceSet.length),
      intended_purpose: fill(purpose, context),
      model_comparison: { original: fill(text, context), controlled_model: fill(model, context), compare: ["meaning", "audience", "structure", "viewpoint", "effect"] },
      writing_strand: strand,
      difficulty_band: band,
      evidence_purpose: `${strand}_purpose_choice_effect`,
      variant_blueprint_id: blueprint,
      review_batch: "production-wave",
      source_text_remains_visible: true,
      response_mode: "tap_keyboard_switch_oral_or_partner_response",
      interaction_support: { keyboard: true, switch_scan: true, touch: true, oral_or_partner_response: true, precision_drag_required: false, move_up_down_controls: true, undo_available: true },
      dyslexia_support: { increased_spacing: true, adjustable_line_length: true, line_focus: true, tinted_background_option: true, readable_font_option: true, clause_chunking: true, one_sentence_focus: true },
      scaffold_routes: { visual: "colour-independent clause, timeline or paragraph map", text: "numbered chunked versions with control labels", oral: "rehearse and explain the purpose before terminology is required", reduced_choice: "compare original with one model before restoring all choices", glossary: "audience, purpose, register, viewpoint, cohesion, emphasis and rhythm" },
      timer_allowed: false,
      speed_score_allowed: false,
      leaderboard_allowed: false,
      audio_optional: audioHelpful,
      audio_asset_id: audioHelpful ? `narration-${fullId}` : null,
      audio_provider: audioHelpful ? "ElevenLabs" : null,
      audio_asset_status: audioHelpful ? "required_human_listening_review" : "not_requested_text_routes_complete",
      human_listening_approval_required: audioHelpful,
      browser_tts_allowed: false,
      publishing_mission: { desk: `${context.place} publishing desk`, objective: `prepare a controlled page for the ${context.project}`, strategic_unlock: "identify audience and purpose, choose one control, then explain its meaning effect", reward: "add one reviewed page or story panel to the shared publication", loss_on_error: false, streak_pressure: false, retry_message: "This draft revealed a useful control mismatch. Restore the original, compare one feature, and revise when ready." },
    },
    expected_answer: { value: filledAnswer },
    hints,
    explanation: richExplanation,
    feedback: { correct: `Publishing decision supported. ${richExplanation}`, purpose_feedback: "Name the audience, purpose and genre demand that the revision meets.", meaning_feedback: "Confirm that participants, facts, sequence, certainty and viewpoint remain accurate.", control_feedback: "Identify the sentence, vocabulary, cohesion, punctuation, paragraph or register control that changed.", revision_feedback: repair },
    difficulty: { expected: 5, secure: 7, stretch: 8, retrieval: 5 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: format === "register-slider" ? "register-slider-shift" : format === "punctuation-purpose" ? "punctuation-purpose-snap" : format === "sentence-control-panel" ? "sentence-untangle" : "reader-effect-meter",
  };
}

function expand(label, count, cases, builder) {
  return Array.from({ length: count }, (_, index) => {
    const item = cases[index % cases.length];
    const context = contexts[Math.floor(index / cases.length) % contexts.length];
    return builder(item, context, index, `${label}-${item.key}-${context.key}`);
  });
}

function ensureBlueprints(currentPack) {
  const additions = [
    { id: "viewpoint-tense-person-control", format: "register-slider", count: 300, difficulty_band: "secure", misconception_tag: "viewpoint_person_shift", purpose: "Maintain or deliberately shift viewpoint, person, tense and register for a stated writing purpose.", generation_pattern: "viewpoint/timeline brief + mismatched draft + controlled revisions + meaning check", review_notes: "Distinguish accidental shifts from clearly cued quotations, flashbacks and current commentary.", source: "ai_drafted_teacher_reviewed" },
    { id: "paragraph-control-and-cohesion", format: "sentence-control-panel", count: 300, difficulty_band: "stretch", misconception_tag: "paragraph_as_length_only", purpose: "Control paragraph focus, evidence placement, progression and whole-text cohesion.", generation_pattern: "paragraph summaries + purpose labels + reorder/group/edit choices + whole-text preview", review_notes: "Avoid teaching paragraphing as a fixed length rule; accept purposeful alternatives when justified.", source: "ai_drafted_teacher_reviewed" },
    { id: "audience-purpose-genre-transfer", format: "multiple_choice", count: 300, difficulty_band: "expected", misconception_tag: "genre_as_surface_features", purpose: "Transfer core information between genres by controlling audience, viewpoint, register, structure and emphasis.", generation_pattern: "source genre + destination brief + controlled versions + preserved-information check", review_notes: "Ensure transfer changes form and selection without inventing or losing core facts.", source: "ai_drafted_teacher_reviewed" },
  ];
  for (const blueprint of additions) if (!currentPack.variant_blueprints.some((existing) => existing.id === blueprint.id)) currentPack.variant_blueprints.push(blueprint);
}

function validateBank(currentPack, authored, generated) {
  if (authored.length !== 5) throw new Error(`Expected five curated variants, found ${authored.length}.`);
  if (generated.length !== pilotTarget - authored.length || currentPack.question_variants.length !== pilotTarget) throw new Error(`Expected ${pilotTarget} total variants with ${pilotTarget - authored.length} generated.`);
  const blueprints = new Map(currentPack.variant_blueprints.map((item) => [item.id, item]));
  const formats = new Set(currentPack.practice.formats);
  const ids = new Set();
  const signatures = new Set();
  const strands = new Set();
  const actualFormats = new Set();
  const actualBlueprints = new Set();
  let optionalAudioCount = 0;
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
    if (!item.body.model_comparison?.original || !item.body.model_comparison?.controlled_model || item.body.model_comparison?.compare?.length < 5) throw new Error(`${item.id} lacks model comparison.`);
    if (!item.body.interaction_support?.keyboard || !item.body.interaction_support?.switch_scan || !item.body.interaction_support?.oral_or_partner_response || item.body.interaction_support?.precision_drag_required !== false) throw new Error(`${item.id} lacks supported interactions.`);
    if (!item.body.dyslexia_support?.increased_spacing || !item.body.dyslexia_support?.line_focus || !item.body.dyslexia_support?.clause_chunking || !item.body.scaffold_routes?.visual || !item.body.scaffold_routes?.text || !item.body.scaffold_routes?.oral || !item.body.scaffold_routes?.reduced_choice) throw new Error(`${item.id} lacks SEND/dyslexia scaffolds.`);
    if (item.body.browser_tts_allowed !== false) throw new Error(`${item.id} permits browser TTS.`);
    if (item.body.audio_optional) {
      optionalAudioCount += 1;
      if (item.body.audio_provider !== "ElevenLabs" || item.body.audio_asset_status !== "required_human_listening_review" || item.body.human_listening_approval_required !== true || !item.body.audio_asset_id) throw new Error(`${item.id} violates reviewed-audio policy.`);
    } else if (item.body.audio_provider !== null || item.body.audio_asset_id !== null || item.body.human_listening_approval_required !== false) throw new Error(`${item.id} requests unnecessary audio.`);
    if (item.body.timer_allowed !== false || item.body.speed_score_allowed !== false || item.body.leaderboard_allowed !== false || item.body.publishing_mission?.loss_on_error !== false || item.body.publishing_mission?.streak_pressure !== false || !item.body.publishing_mission?.strategic_unlock) throw new Error(`${item.id} has unsuitable mission gamification.`);
    if (!item.feedback?.correct || !item.feedback?.purpose_feedback || !item.feedback?.meaning_feedback || !item.feedback?.control_feedback || !item.feedback?.revision_feedback || item.hints.length < 2 || item.explanation.length < 110) throw new Error(`${item.id} lacks rich feedback.`);
    if (!Array.isArray(item.body.choices) || item.body.choices.length < 4 || new Set(item.body.choices).size !== item.body.choices.length || item.body.choices.filter((choice) => choice === item.expected_answer.value).length !== 1) throw new Error(`${item.id} has invalid choices.`);
    strands.add(item.body.writing_strand);
    actualFormats.add(item.format);
    actualBlueprints.add(item.body.variant_blueprint_id);
  }
  if (optionalAudioCount < 1 || optionalAudioCount >= generated.length) throw new Error(`Optional audio must be selective; found ${optionalAudioCount}/${generated.length}.`);
  requireCoverage("strands", ["audience_purpose", "sentence_length_structure", "viewpoint_register", "precise_vocabulary", "cohesion", "paragraph_control", "tense_person_consistency", "editing_for_meaning", "punctuation_rhythm", "genre_transfer"], strands);
  requireCoverage("formats", [...formats], actualFormats);
  requireCoverage("blueprints", [...blueprints.keys()], actualBlueprints);
}

function requireCoverage(label, required, actual) { const missing = required.filter((item) => !actual.has(item)); if (missing.length) throw new Error(`Generated bank is missing ${label}: ${missing.join(", ")}.`); }
function fill(value, context) { return String(value).replaceAll("{name}", context.name).replaceAll("{Name}", context.name).replaceAll("{group}", context.group).replaceAll("{place}", context.place).replaceAll("{item}", context.item).replaceAll("{project}", context.project); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function summary(items, keyFor) { const counts = new Map(); for (const item of items) counts.set(keyFor(item), (counts.get(keyFor(item)) ?? 0) + 1); return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
