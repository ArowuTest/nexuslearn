#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/en-y6-grammar-precision.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "en-y6-grammar-precision-bank-";
const pilotTarget = 240;

if (write && check) throw new Error("Choose either --write or --check, not both.");

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "en-y6-grammar-precision") throw new Error("This generator only supports the Year 6 grammar-precision pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 4) throw new Error(`Expected exactly 4 curated variants, found ${curated.length}. Refusing to overwrite possible authored work.`);

ensureBlueprints(pack);

const contexts = [
  { key: "museum", name: "Mina", group: "curators", place: "local museum", item: "model boat", project: "harbour exhibition" },
  { key: "wetland", name: "Ari", group: "survey team", place: "wetland reserve", item: "field camera", project: "bird survey" },
  { key: "library", name: "Zara", group: "reading group", place: "community library", item: "story map", project: "history display" },
  { key: "workshop", name: "Noor", group: "design team", place: "repair workshop", item: "solar lantern", project: "energy project" },
  { key: "observatory", name: "Leo", group: "research team", place: "observatory", item: "star chart", project: "night-sky report" },
];

const ambiguityItems = [
  { key: "two-its", text: "{Name} placed the {item} beside the lamp before moving it to the window.", intention: "the item moved", answer: "{Name} placed the {item} beside the lamp before moving the {item} to the window.", wrong: ["{Name} placed it beside it before moving it.", "{Name} placed the {item} beside the lamp before moving it.", "It moved it beside the window."] },
  { key: "two-theys", text: "The {group} thanked the volunteers after they finished the survey.", intention: "the volunteers finished", answer: "The {group} thanked the volunteers after the volunteers finished the survey.", wrong: ["They thanked them after they finished it.", "The {group} thanked the volunteers after they finished.", "The survey thanked the volunteers."] },
  { key: "only", text: "{Name} only checked the labels on Tuesday.", intention: "Tuesday was the only day the labels were checked", answer: "{Name} checked the labels only on Tuesday.", wrong: ["Only {name} checked the labels on Tuesday.", "{Name} only checked the labels on Tuesday.", "{Name} checked only the labels on Tuesday."] },
  { key: "modifier", text: "Walking through the {place}, the {item} caught {name}'s attention.", intention: "the person was walking", answer: "Walking through the {place}, {name} noticed the {item}.", wrong: ["Walking through the {place}, the {item} noticed {name}.", "The {item}, walking through the {place}, caught attention.", "Through walking, attention caught the {item}."] },
  { key: "compound", text: "The {place} opened a small animal care room.", intention: "a care room for small animals, not a physically small room", answer: "The {place} opened a small-animal care room.", wrong: ["The {place} opened a small animal-care room.", "The {place}, opened a small animal care room.", "The {place} opened; a small animal care room."] },
  { key: "scope", text: "All the visitors did not see the {item}.", intention: "none of the visitors saw it", answer: "None of the visitors saw the {item}.", wrong: ["Not all visitors saw the {item}.", "All visitors did not nearly see it.", "The visitors all saw no not-item."] },
  { key: "reference", text: "A label was added to the case. This was damaged.", intention: "the case was damaged", answer: "A label was added to the damaged case.", wrong: ["A label was added to the case. This was damaged.", "This added it to that.", "A damaged label was added to the case."] },
  { key: "list-grouping", text: "The kit contains old maps, notebooks and pens with blue covers.", intention: "only the pens have blue covers", answer: "The kit contains old maps, notebooks and pens that have blue covers.", wrong: ["The kit contains blue-covered old maps, notebooks and pens.", "With blue covers, the kit contains everything.", "The kit contains old, maps notebooks, and pens with blue covers."] },
];

const punctuationItems = [
  { key: "semicolon", purpose: "join two closely related independent clauses", answer: "The warning light flashed; the team checked the panel.", wrong: ["The warning light; flashed across the panel.", "Because the warning light flashed; the team.", "The team checked; because the warning light flashed."] },
  { key: "colon-list", purpose: "introduce a list after a complete clause", answer: "The kit contained three items: a map, a torch and a notebook.", wrong: ["The kit contained: three items a map, a torch and a notebook.", "The kit: contained three items.", "Because the kit contained: three items."] },
  { key: "colon-explain", purpose: "introduce an explanation after a complete clause", answer: "The launch was delayed: thick cloud covered the sky.", wrong: ["The launch: was delayed thick cloud covered the sky.", "Because the launch was delayed: thick cloud.", "The launch was: delayed because."] },
  { key: "dash", purpose: "mark a deliberate interruption that adds a precise afterthought", answer: "One object remained unchecked—the {item}.", wrong: ["One—object remained unchecked the {item}.", "One object—remained—unchecked the {item}.", "Because one object remained—the {item}."] },
  { key: "parenthesis", purpose: "mark supplementary information that can be removed grammatically", answer: "The {item} (which arrived on Monday) was inspected first.", wrong: ["The {item} which (arrived on Monday was) inspected first.", "The (item which arrived) on Monday was inspected first.", "The {item} which arrived on Monday) was inspected first(" ] },
  { key: "relative-comma", purpose: "mark a non-restrictive relative clause about the only named item", answer: "The {item}, which stood by the entrance, was moved.", wrong: ["The {item} which, stood by the entrance was moved.", "The {item}, which stood by the entrance was moved.", "The {item} which stood, by the entrance, was moved."] },
  { key: "hyphen", purpose: "show that two words work together before a noun", answer: "The team designed a low-energy lighting system.", wrong: ["The team designed a low energy-lighting system.", "The team designed—a low energy lighting system.", "The team; designed a low energy lighting system."] },
  { key: "list-comma", purpose: "separate three coordinated items without splitting subject and verb", answer: "{Name} packed the map, the notebook and the camera.", wrong: ["{Name}, packed the map the notebook and the camera.", "{Name} packed, the map the notebook and the camera.", "{Name} packed the map the notebook, and, the camera."] },
];

const voiceItems = [
  { key: "object-focus", event: "inspect the {item}", purpose: "foreground the item because the inspector is unimportant", answer: "The {item} was inspected before noon.", wrong: ["The {group} inspected the {item} before noon.", "Before noon was inspecting the {item}.", "The {item} inspected the group."] },
  { key: "actor-focus", event: "discover a damaged panel", purpose: "credit the group that made the discovery", answer: "The {group} discovered the damaged panel.", wrong: ["The damaged panel was discovered.", "There was a discovery of being damaged.", "The panel discovered the {group}."] },
  { key: "method-focus", event: "record the results digitally", purpose: "focus on what happened to the results", answer: "The results were recorded digitally.", wrong: ["The {group} recorded the results digitally.", "Digitally recorded the results were by happening.", "The results recorded the team."] },
  { key: "responsibility", event: "approve the final safety check", purpose: "make responsibility explicit", answer: "The lead engineer approved the final safety check.", wrong: ["The final safety check was approved.", "Approval happened around the safety check.", "The check approved the engineer."] },
  { key: "unknown-doer", event: "remove the label overnight", purpose: "report the event when the doer is unknown", answer: "The label was removed overnight.", wrong: ["Someone definitely removed the label maliciously.", "The label removed overnight.", "Overnight was removing the label by unknown."] },
  { key: "process", event: "heat the solution to 60 degrees", purpose: "describe the procedure rather than the person", answer: "The solution was heated to 60 degrees.", wrong: ["We heated the solution to 60 degrees to show ourselves.", "The solution heated the scientist.", "Heating was solution at 60 degrees."] },
  { key: "same-meaning", event: "the team moved the {item}", purpose: "change voice but preserve participants and event", answer: "The {item} was moved by the {group}.", wrong: ["The {item} moved the {group}.", "The {group} was moved by the {item}.", "The {item} might have disappeared."] },
  { key: "not-tense", event: "the team completed the survey", purpose: "identify passive voice rather than merely past tense", answer: "The survey was completed by the {group}.", wrong: ["The {group} completed the survey.", "The {group} will complete the survey.", "The survey completes the group."] },
];

const registerItems = [
  { key: "formal-request", audience: "a formal request to a council", answer: "We would be grateful if the proposal could be reviewed.", wrong: ["Hey, can you look at this thing?", "You lot need to check it now.", "This proposal is, like, worth a glance."] },
  { key: "informal-message", audience: "a friendly message to a classmate", answer: "Hi—could you bring the story map tomorrow? Thanks!", wrong: ["The aforementioned map shall be conveyed on the following day.", "Compliance with map transportation is hereby requested.", "You are commanded to deliver the item."] },
  { key: "formal-report", audience: "an objective investigation report", answer: "The results indicate that the second material absorbed more water.", wrong: ["I reckon the second one was way better.", "It was super-soaky and awesome.", "You can totally tell which won."] },
  { key: "spoken-welcome", audience: "a warm spoken welcome for families", answer: "Welcome! We are delighted that you could join us this evening.", wrong: ["Attendance at the event is formally acknowledged.", "Yo, people, get inside.", "Participants shall occupy the premises."] },
  { key: "formal-complaint", audience: "a polite formal complaint", answer: "I am writing to explain why the delayed response caused difficulty.", wrong: ["Your reply was rubbish and took ages.", "So, basically, nobody got back to me.", "Fix this right now, okay?"] },
  { key: "instructions", audience: "clear safety instructions", answer: "Before opening the case, switch off the approved classroom equipment.", wrong: ["Maybe sort of turn things off if you fancy it.", "The offness of equipment is hereby conceptualised.", "Just mess with the case until it opens."] },
  { key: "consistent", audience: "a formal paragraph that must keep a consistent register", answer: "Furthermore, the evidence supports the revised proposal.", wrong: ["Also, the evidence is kinda into the new idea.", "And, like, the proposal totally works.", "The evidence vibes with it."] },
  { key: "not-always-formal", audience: "choose language suited to a supportive peer discussion", answer: "I see your point; could we test it with another example?", wrong: ["Your proposition requires immediate evidential substantiation.", "That is wrong. End of discussion.", "One hereby rejects your utterance."] },
];

const verbItems = [
  { key: "past-perfect", purpose: "show that inspection happened before the team arrived", answer: "When the team arrived, {name} had inspected the {item}.", wrong: ["When the team arrived, {name} has inspect the {item}.", "When the team had arrived, tomorrow {name} inspects it.", "When arriving, the item had inspect."] },
  { key: "present-perfect", purpose: "link a completed action to the present result", answer: "The {group} has completed the survey, so the report is ready.", wrong: ["The {group} have complete the survey.", "The {group} had completing it tomorrow.", "The survey has complete the group."] },
  { key: "progressive", purpose: "show an action continuing at a past moment", answer: "At noon, the {group} was checking the final section.", wrong: ["At noon, the {group} is checked the final section.", "At noon, the {group} were check the section.", "At noon, checking had the group."] },
  { key: "subjunctive", purpose: "use formal hypothetical language", answer: "If I were responsible for the display, I would move the {item}.", wrong: ["If I was be responsible, I move it.", "If I were responsible, I will moved it yesterday.", "If I am were responsible, it moved."] },
  { key: "standard-did", purpose: "use the standard past form after the subject", answer: "Yesterday, {name} did the final check.", wrong: ["Yesterday, {name} done the final check.", "Yesterday, {name} did completed the final check.", "Yesterday, {name} do the final check."] },
  { key: "agreement", purpose: "make the verb agree with the singular head noun", answer: "The collection of maps is stored safely.", wrong: ["The collection of maps are stored safely.", "The collection of maps be stored safely.", "The collection of maps were stores safely."] },
  { key: "tense-control", purpose: "maintain past tense in a report", answer: "The team measured the case and recorded the result.", wrong: ["The team measured the case and records the result.", "The team measures the case and recorded the result.", "The team measuring the case and record."] },
  { key: "modal-perfect", purpose: "express a possible explanation for an earlier event", answer: "The loose cable might have caused the interruption.", wrong: ["The loose cable might caused the interruption.", "The cable might has cause it.", "The loose cable will have definitely maybe caused it."] },
];

const sentenceItems = [
  { key: "fragment", purpose: "repair a subordinate-clause fragment", answer: "Because the alarm sounded, the {group} checked the panel.", wrong: ["Because the alarm sounded.", "The {group}. Because checked the panel.", "Because, the alarm, sounded the group."] },
  { key: "run-on", purpose: "separate two independent clauses clearly", answer: "The door opened, and the visitors entered.", wrong: ["The door opened the visitors entered.", "The door, opened the visitors, entered.", "Because the door opened and."] },
  { key: "subordination", purpose: "make the cause-and-result relationship explicit", answer: "Because rain entered the case, the label became damaged.", wrong: ["Rain entered the case, the label became damaged.", "The label became damaged although rain caused it as a contrast.", "Rain. Because the label."] },
  { key: "relative", purpose: "embed relevant identifying information", answer: "The camera that recorded the nest was moved indoors.", wrong: ["The camera that recorded the nest. Was moved indoors.", "The camera, that recorded, the nest was moved.", "That recorded the nest the camera indoors."] },
  { key: "parallel", purpose: "control a coordinated list with parallel verb forms", answer: "The team measured the frame, checked the joints and recorded the result.", wrong: ["The team measured the frame, checking the joints and the result was recorded.", "The team measure, checked and recording.", "Measured the frame and the team checking."] },
  { key: "pronoun-link", purpose: "join ideas without an unclear reference", answer: "{Name} showed the chart to the visitors, who asked several questions.", wrong: ["{Name} showed it to them, which asked questions.", "The chart showed {name}, who were questions.", "Who asked questions the chart."] },
  { key: "controlled-short", purpose: "use a short sentence to foreground a result after explanation", answer: "The team checked every connection twice. The signal returned.", wrong: ["The team checked. Every connection because twice the signal.", "The signal returned the team checked every connection twice because and.", "Twice. Connections. Returned."] },
  { key: "coordination", purpose: "show two equally weighted actions", answer: "{Name} opened the case, and the {group} photographed the contents.", wrong: ["Because {name} opened the case and the group.", "{Name} opened, and because photographed.", "The contents photographed the group opening."] },
];

const editingItems = [
  { key: "mixed-tense", text: "The {group} entered the {place} and records the temperature.", answer: "The {group} entered the {place} and recorded the temperature.", wrong: ["The {group} enters the {place} and recorded the temperature.", "The {group} entering and records.", "The temperature entered the group."] },
  { key: "comma-splice", text: "The test ended, the team saved the results.", answer: "The test ended; the team saved the results.", wrong: ["The test, ended the team saved, the results.", "Because the test ended; the team.", "The test ended the team saved the results."] },
  { key: "register-shift", text: "The evidence supports the proposal. Also, it is kinda brilliant.", answer: "The evidence supports the proposal. Furthermore, it addresses the main concern.", wrong: ["The evidence supports it. It is, like, brilliant.", "The evidence vibes with the proposal.", "The proposal is super good and formal."] },
  { key: "unclear-reference", text: "{Name} put the {item} beside the camera before moving it.", answer: "{Name} put the {item} beside the camera before moving the {item}.", wrong: ["{Name} put it beside it before moving it.", "It put {name} beside the camera.", "Before moving, it was beside it."] },
  { key: "passive-purpose", text: "The procedure focuses on the sample, but says, 'We heated the sample for two minutes.'", answer: "The sample was heated for two minutes.", wrong: ["We were the sample heating for two minutes.", "The sample heated us.", "For two minutes was heat."] },
  { key: "modal-overclaim", text: "The evidence is incomplete, but the report says, 'The mark must belong to a fox.'", answer: "The mark might belong to a fox.", wrong: ["The mark will definitely belong to a fox.", "The mark cannot maybe belong.", "The fox mark must certainly prove everything."] },
  { key: "punctuation-meaning", text: "The writer needs to introduce an explanation: 'The visit was cancelled heavy snow blocked the road.'", answer: "The visit was cancelled: heavy snow blocked the road.", wrong: ["The visit: was cancelled heavy snow blocked the road.", "The visit was; cancelled heavy snow.", "Because the visit was cancelled: heavy snow."] },
  { key: "over-edit", text: "A clear sentence is repeatedly altered only to sound more complex.", answer: "Keep the clearest grammatically accurate version when extra complexity adds no useful meaning effect.", wrong: ["Always choose the longest sentence.", "Add punctuation wherever a reader might pause.", "Change active to passive in every formal text."] },
];

const effectItems = [
  { key: "might-must", purpose: "show cautious possibility rather than certainty", answer: "Use 'might' because the evidence permits a possibility but does not prove it.", wrong: ["Use 'must' because all modal verbs have equal strength.", "Use 'will' because future tense means uncertainty.", "Remove the verb so no claim is made."] },
  { key: "dash-effect", purpose: "foreground one final item as a deliberate afterthought", answer: "Use a dash before the final item to create a marked interruption and emphasis.", wrong: ["Use a comma because punctuation only records breath.", "Use a semicolon before a noun phrase that cannot stand alone.", "Add several dashes around every word."] },
  { key: "active-effect", purpose: "make the group responsible for the decision", answer: "Use active voice and place the {group} as the subject.", wrong: ["Omit the actor in a passive clause.", "Change only the tense and call it active.", "Make the decision act on the group."] },
  { key: "passive-effect", purpose: "foreground the result when the actor is unknown", answer: "Use passive voice to place the affected result first and omit the unknown actor.", wrong: ["Invent an actor to make the sentence active.", "Use passive because it is always superior.", "Remove the result as well as the actor."] },
  { key: "short-result", purpose: "give the final result controlled prominence", answer: "Place the result in a concise sentence after the explanatory build-up.", wrong: ["Turn every sentence into a fragment.", "Join all clauses without punctuation.", "Repeat the result in every clause."] },
  { key: "formal-effect", purpose: "sound measured and objective in a report", answer: "Choose precise nouns and evidence verbs while avoiding chatty intensifiers.", wrong: ["Use slang to guarantee objectivity.", "Replace evidence with personal excitement.", "Use the longest available word regardless of meaning."] },
  { key: "colon-effect", purpose: "signal that the next clause explains the first", answer: "Use a colon after a complete clause when the following clause supplies its explanation.", wrong: ["Place a colon between subject and verb.", "Use a colon for every long pause.", "Use a hyphen to join two complete clauses."] },
  { key: "order-effect", purpose: "delay key information until the end without causing ambiguity", answer: "Keep references clear while placing the key result in the final syntactic position.", wrong: ["Hide every referent with 'it'.", "Move words randomly until the result is last.", "Create a dangling modifier to delay the subject."] },
];

const candidates = [
  ...expand("ambiguity", 30, ambiguityItems, buildAmbiguity),
  ...expand("punctuation", 30, punctuationItems, buildPunctuation),
  ...expand("voice", 30, voiceItems, buildVoice),
  ...expand("register", 30, registerItems, buildRegister),
  ...expand("verb-forms", 29, verbItems, buildVerb),
  ...expand("sentence-control", 29, sentenceItems, buildSentence),
  ...expand("editing", 29, editingItems, buildEditing),
  ...expand("meaning-effects", 29, effectItems, buildEffect),
];

pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.adaptive_support.audio_first = "Optional sentence and contrast playback uses only ElevenLabs assets after human listening approval. Browser TTS is prohibited; if audio is unavailable, visible text, clause chunking and adult or partner reading routes remain complete.";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Depth-wave review bank reaches the 240-item pilot target with four preserved curated questions and 236 deterministic candidates covering ambiguity, punctuation choice, active and passive voice, formal and informal register, verb forms, sentence control, integrated editing and meaning effects. Generated candidates include SEND/dyslexia scaffolds, supported non-drag interactions, rich purpose-and-meaning feedback, pressure-free editor missions and optional ElevenLabs references requiring human listening approval; browser TTS is prohibited. Independent English, teacher, SEND, accessibility, safeguarding, audio and renderer review remains required before promotion.";

validateBank(pack, curated, candidates);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`grammar-precision-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`grammar-precision-bank strands=${summary(candidates, (variant) => variant.body.grammar_strand)}`);
console.log(`grammar-precision-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`grammar-precision-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`grammar-precision-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 6 grammar-precision bank is out of date; run generate-y6-grammar-precision-bank.mjs --write.");
  console.log("grammar-precision-bank deterministic check passed");
} else {
  console.log("grammar-precision-bank dry-run; pass --write to update the pack");
}

function buildAmbiguity(item, context, index, id) { return candidate({ id, format: "grammar-repair", blueprint: "ks2-punctuation-precision-repairs", band: "secure", strand: "ambiguity", context, prompt: `Ambiguity desk ${index + 1}: '${fill(item.text, context)}' The intended meaning is: ${fill(item.intention, context)}. Which edit makes that meaning unambiguous?`, choices: [item.answer, ...item.wrong], answer: item.answer, hints: ["Mark every pronoun, modifier or word group that could attach in two places.", "Substitute each possible meaning, then choose the smallest edit that preserves the stated intention."], explanation: `${fill(item.answer, context)} This version fixes the reference, modifier position or grouping responsible for the ambiguity while preserving the intended event.`, tag: "ambiguous_structure", repair: "Display two possible meaning maps beside the sentence, then reconnect each modifier or reference to its intended target." }); }
function buildPunctuation(item, context, index, id) { return candidate({ id, format: index % 2 ? "grammar-repair" : "clause-map", blueprint: index % 2 ? "ks2-punctuation-precision-repairs" : "clause-role-and-boundary-maps", band: index % 2 ? "secure" : "developing", strand: "punctuation_choices", context, prompt: `Punctuation lab ${index + 1}: which sentence uses punctuation to ${item.purpose}?`, choices: [item.answer, ...item.wrong], answer: item.answer, hints: ["Test clause completeness and grammatical function before thinking about spoken pauses.", "Name the punctuation's job: boundary, introduction, interruption, parenthesis, list or compound modifier."], explanation: `${fill(item.answer, context)} The punctuation performs the stated grammatical function: ${item.purpose}. Its position is justified by structure and meaning, not merely by a pause.`, tag: "punctuation_by_pause", repair: "Use bracketed clause cards and a punctuation-function glossary, then test whether each side of a boundary can stand independently." }); }
function buildVoice(item, context, index, id) { return candidate({ id, format: "grammar-repair", blueprint: "active-passive-focus-edits", band: "expected", strand: "active_passive", context, prompt: `Voice console ${index + 1}: the event is '${fill(item.event, context)}'. To ${fill(item.purpose, context)}, which sentence has the best focus?`, choices: [item.answer, ...item.wrong], answer: item.answer, hints: ["Identify actor, action and affected participant before changing voice.", "Place the intended focus in subject position, but preserve every important participant and event detail."], explanation: `${fill(item.answer, context)} This active or passive choice matches the stated focus without implying that one voice is always more formal or generally better.`, tag: "voice_by_tense", repair: "Use actor-action-affected cards, then swap subject position while checking that the event roles and tense remain unchanged." }); }
function buildRegister(item, context, index, id) { return candidate({ id, format: "meaning-choice", blueprint: "formal-informal-register-decisions", band: "expected", strand: "formal_informal_register", context, prompt: `Register review ${index + 1}: choose the wording suited to ${fill(item.audience, context)}.`, choices: [item.answer, ...item.wrong], answer: item.answer, hints: ["Identify audience, purpose and medium before judging vocabulary.", "Check tone, contraction, precision and directness together; formal does not mean unnecessarily complicated."], explanation: `${fill(item.answer, context)} This wording fits ${fill(item.audience, context)} through an appropriate balance of precision, politeness and accessibility.`, tag: "formal_means_longest", repair: "Compare audience-purpose cards and highlight only the words that create the register, then rehearse a natural oral alternative." }); }
function buildVerb(item, context, index, id) { return candidate({ id, format: "grammar-repair", blueprint: "precise-verb-form-control", band: "expected", strand: "verb_forms", context, prompt: `Verb-form check ${index + 1}: which sentence correctly achieves this purpose: ${fill(item.purpose, context)}?`, choices: [item.answer, ...item.wrong], answer: item.answer, hints: ["Locate the time reference, subject and any auxiliary verb before choosing the main form.", "Read the complete verb phrase as a unit: modal or auxiliary plus participle or base form."], explanation: `${fill(item.answer, context)} The verb phrase is standard, agrees with its subject and expresses the intended time, aspect or hypothetical meaning.`, tag: "auxiliary_main_form_mismatch", repair: "Place time, subject, auxiliary and main-verb cards in separate labelled slots, then read the completed verb phrase aloud or silently." }); }
function buildSentence(item, context, index, id) { return candidate({ id, format: "clause-map", blueprint: "clause-role-and-boundary-maps", band: "developing", strand: "sentence_control", context, prompt: `Sentence-control map ${index + 1}: which sentence will ${fill(item.purpose, context)}?`, choices: [item.answer, ...item.wrong], answer: item.answer, hints: ["Mark each subject-verb unit and decide whether it is independent or subordinate.", "Check that coordination, subordination and relative clauses express the intended relationship without fragments or run-ons."], explanation: `${fill(item.answer, context)} The clause boundaries and links are grammatically complete and make the stated relationship controllable for the reader.`, tag: item.key === "fragment" ? "subordinate_fragment" : "clause_boundary_confusion", repair: "Use one clause per line with subject and verb labels, then connect clauses using a relationship arrow before adding punctuation." }); }
function buildEditing(item, context, index, id) {
  const route = index % 3;
  return candidate({ id, format: route === 0 ? "grammar-repair" : "multiple_choice", blueprint: route === 0 ? "ks2-punctuation-precision-repairs" : route === 1 ? "integrated-meaning-preserving-edits" : "grammar-precision-retrieval", band: route === 0 ? "secure" : route === 1 ? "stretch" : "retrieval", strand: "editing", context, prompt: `Editor mission ${index + 1}: '${fill(item.text, context)}' Which edit improves grammatical precision without changing the intended information?`, choices: [item.answer, ...item.wrong], answer: item.answer, hints: ["State who did what, when and with what certainty before editing.", "Change one feature, then compare the original and revision for voice, register, reference and meaning."], explanation: `${fill(item.answer, context)} This revision repairs the target mismatch while retaining the passage's participants, sequence, certainty and purpose.`, tag: item.key === "over-edit" ? "complexity_over_clarity" : "edit_changes_meaning", repair: "Keep before-and-after panels visible, undo freely, and use a meaning checklist after each single-feature edit." });
}
function buildEffect(item, context, index, id) { return candidate({ id, format: "meaning-choice", blueprint: "modality-strength-decisions", band: "expected", strand: "meaning_effects", context, prompt: `Meaning-effects studio ${index + 1}: the writer wants to ${fill(item.purpose, context)}. Which grammatical decision best achieves that effect?`, choices: [item.answer, ...item.wrong], answer: item.answer, hints: ["Translate the intended effect into certainty, focus, emphasis, relationship or register.", "Explain how the exact grammar changes what is foregrounded or how strongly the claim is made."], explanation: `${fill(item.answer, context)} This links a specific grammatical choice to the stated meaning effect without claiming that every reader must respond identically.`, tag: item.key === "might-must" ? "modal_interchangeability" : "feature_named_without_effect", repair: "Use a graded certainty line or focus map, compare only two minimally different versions, and complete the stem 'This choice makes...'." }); }

function candidate({ id, format, blueprint, band, strand, context, prompt, choices, answer, hints, explanation, tag, repair }) {
  const fullId = `${prefix}${id}`;
  const filledChoices = choices.map((choice) => fill(choice, context));
  const filledAnswer = fill(answer, context);
  const uniqueChoices = rotate([...new Set(filledChoices)], fullId.length % new Set(filledChoices).size);
  return {
    id: fullId,
    format,
    body: {
      prompt,
      choices: uniqueChoices,
      grammar_strand: strand,
      difficulty_band: band,
      evidence_purpose: `${strand}_form_meaning_purpose`,
      variant_blueprint_id: blueprint,
      review_batch: "depth-wave",
      intended_meaning_remains_visible: true,
      response_mode: "tap_keyboard_switch_oral_or_partner_response",
      interaction_support: { keyboard: true, switch_scan: true, touch: true, oral_or_partner_response: true, precision_drag_required: false, move_controls: true, undo_available: true },
      dyslexia_support: { increased_spacing: true, adjustable_line_length: true, line_focus: true, tinted_background_option: true, readable_font_option: true, chunked_clause_view: true, punctuation_name_option: true },
      scaffold_routes: { visual: "colour-independent clause and meaning map", text: "numbered alternatives with grammatical-role labels", oral: "rehearse the sentence and explain the choice without requiring terminology first", reduced_choice: "compare two minimally different options before restoring all choices", glossary: "persistent subject, object, clause, voice, modal and register definitions" },
      original_and_edit_visible: true,
      colour_required: false,
      timer_allowed: false,
      speed_score_allowed: false,
      leaderboard_allowed: false,
      audio_optional: true,
      audio_asset_id: `narration-${fullId}`,
      audio_provider: "ElevenLabs",
      audio_asset_status: "required_human_listening_review",
      human_listening_approval_required: true,
      browser_tts_allowed: false,
      editor_mission: {
        desk: `${context.place} precision desk`,
        objective: `restore one clear message for the ${context.project}`,
        strategic_unlock: "identify intended meaning, choose the grammatical tool, then justify its effect",
        reward: "add one reviewed sentence tile to the shared publication wall",
        loss_on_error: false,
        streak_pressure: false,
        retry_message: "This version reveals a useful mismatch. Restore the original, compare one feature, and revise when ready.",
      },
    },
    expected_answer: { value: filledAnswer },
    hints,
    explanation,
    feedback: { correct: `Edit approved for review. ${explanation}`, structural_check: "Name the clause, verb, voice, punctuation or register feature that changed.", meaning_check: "Confirm that participants, sequence, certainty and intended focus remain accurate.", repair, alternative_note: "If another version is defensible, explain its grammatical structure and resulting meaning before teacher review." },
    difficulty: { developing: 4, expected: 5, secure: 7, stretch: 8, retrieval: 5 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: format === "clause-map" ? "clause-boundary-test" : format === "meaning-choice" ? "meaning-focus-shift" : "grammar-tool-snap",
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
    { id: "formal-informal-register-decisions", format: "meaning-choice", count: 280, difficulty_band: "expected", misconception_tag: "formal_means_longest", purpose: "Select and explain register choices that fit audience, purpose and medium.", generation_pattern: "audience-purpose card + concise alternatives + register-effect explanation", review_notes: "Avoid presenting formal language as always better or needlessly complex.", source: "ai_drafted_teacher_reviewed" },
    { id: "precise-verb-form-control", format: "grammar-repair", count: 280, difficulty_band: "expected", misconception_tag: "auxiliary_main_form_mismatch", purpose: "Control standard verb forms, agreement, tense and aspect for precise time relationships.", generation_pattern: "time-purpose cue + minimally contrasted verb phrases + meaning check", review_notes: "Keep terminology supported by timelines and complete verb-phrase models.", source: "ai_drafted_teacher_reviewed" },
    { id: "integrated-meaning-preserving-edits", format: "multiple_choice", count: 260, difficulty_band: "stretch", misconception_tag: "edit_changes_meaning", purpose: "Edit interacting grammar features while preserving intended meaning, voice and register.", generation_pattern: "before passage + intended meaning + controlled revisions + effect justification", review_notes: "Teacher review should accept defensible alternatives only when their changed effect is explained.", source: "ai_drafted_teacher_reviewed" },
  ];
  for (const blueprint of additions) if (!currentPack.variant_blueprints.some((existing) => existing.id === blueprint.id)) currentPack.variant_blueprints.push(blueprint);
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
    if (!formats.has(item.format) || item.status !== "review") throw new Error(`${item.id} has unsupported format or status.`);
    if (!item.body.intended_meaning_remains_visible || !item.body.original_and_edit_visible) throw new Error(`${item.id} does not protect intended meaning.`);
    if (!item.body.interaction_support?.keyboard || !item.body.interaction_support?.switch_scan || !item.body.interaction_support?.oral_or_partner_response || item.body.interaction_support?.precision_drag_required !== false) throw new Error(`${item.id} lacks supported interactions.`);
    if (!item.body.dyslexia_support?.increased_spacing || !item.body.dyslexia_support?.line_focus || !item.body.dyslexia_support?.chunked_clause_view || !item.body.scaffold_routes?.visual || !item.body.scaffold_routes?.text || !item.body.scaffold_routes?.oral || !item.body.scaffold_routes?.reduced_choice) throw new Error(`${item.id} lacks SEND/dyslexia scaffolds.`);
    if (item.body.audio_provider !== "ElevenLabs" || item.body.audio_asset_status !== "required_human_listening_review" || item.body.human_listening_approval_required !== true || item.body.browser_tts_allowed !== false) throw new Error(`${item.id} violates audio policy.`);
    if (item.body.timer_allowed !== false || item.body.speed_score_allowed !== false || item.body.leaderboard_allowed !== false || item.body.editor_mission?.loss_on_error !== false || item.body.editor_mission?.streak_pressure !== false || !item.body.editor_mission?.strategic_unlock) throw new Error(`${item.id} has unsuitable editor gamification.`);
    if (!item.feedback?.correct || !item.feedback?.structural_check || !item.feedback?.meaning_check || !item.feedback?.repair || item.hints.length < 2 || item.explanation.length < 90) throw new Error(`${item.id} lacks rich feedback.`);
    if (!Array.isArray(item.body.choices) || item.body.choices.length < 4 || new Set(item.body.choices).size !== item.body.choices.length || item.body.choices.filter((choice) => choice === item.expected_answer.value).length !== 1) throw new Error(`${item.id} has invalid choices.`);
    strands.add(item.body.grammar_strand);
    actualFormats.add(item.format);
    actualBlueprints.add(item.body.variant_blueprint_id);
  }
  requireCoverage("strands", ["ambiguity", "punctuation_choices", "active_passive", "formal_informal_register", "verb_forms", "sentence_control", "editing", "meaning_effects"], strands);
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
