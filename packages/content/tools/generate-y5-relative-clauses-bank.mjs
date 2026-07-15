#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/en-y5-relative-clauses.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "en-y5-relative-clauses-bank-";
const pilotTarget = 240;
const reviewBatch = "y5-relative-clauses-pilot-a";

if (write && check) throw new Error("Choose either --write or --check, not both.");

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "en-y5-relative-clauses") throw new Error("This generator only supports the Year 5 relative-clauses pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 4) throw new Error(`Expected exactly 4 curated variants, found ${curated.length}.`);
const curatedSnapshot = JSON.stringify(curated.map(removeClauseContract));

const contexts = [
  { key: "observatory", genre: "information", person: "Asha", role: "astronomer", thing: "telescope", place: "observatory", time: "the winter evening", possession: "lens", action: "mapped the comet trail" },
  { key: "wetland", genre: "field report", person: "Milo", role: "ranger", thing: "camera", place: "wetland hide", time: "the spring survey", possession: "notebook", action: "recorded the nesting birds" },
  { key: "museum", genre: "recount", person: "Safiya", role: "curator", thing: "model ship", place: "maritime gallery", time: "the reopening day", possession: "display case", action: "checked the new labels" },
  { key: "garden", genre: "instructions", person: "Theo", role: "gardener", thing: "seed tray", place: "school greenhouse", time: "the planting session", possession: "watering can", action: "prepared the compost" },
  { key: "coast", genre: "narrative", person: "Imani", role: "rescue volunteer", thing: "signal lamp", place: "clifftop station", time: "the foggy morning", possession: "radio", action: "guided the walkers" },
  { key: "library", genre: "explanation", person: "Nia", role: "librarian", thing: "archive box", place: "local library", time: "the history workshop", possession: "catalogue", action: "sorted the photographs" },
  { key: "workshop", genre: "instructions", person: "Ravi", role: "engineer", thing: "solar car", place: "design workshop", time: "the final test", possession: "toolkit", action: "adjusted the axle" },
  { key: "woodland", genre: "field report", person: "Elena", role: "ecologist", thing: "tracking card", place: "woodland clearing", time: "the dawn count", possession: "field guide", action: "identified the footprints" },
];

const linkItems = [
  { key: "who-person", prompt: "Choose the clearest link for a person carrying out the action", stem: "The {role}, ___ {action}, shared the findings.", answer: "who", choices: ["who", "where", "when", "whose"], relation: "person", note: "Who points back to the person; in some restrictive contexts that can also refer to people, but this named-person insertion uses who naturally." },
  { key: "which-thing", prompt: "Choose the link for additional information about a thing", stem: "The {thing}, ___ had been checked twice, was ready.", answer: "which", choices: ["which", "where", "when", "whose"], relation: "thing", note: "Which points back to the thing and the commas show additional information; that is not used in this comma-marked version." },
  { key: "where-place", prompt: "Choose the link that means in or at this place", stem: "We returned to the {place}, ___ the team compared its notes.", answer: "where", choices: ["where", "who", "when", "whose"], relation: "place", note: "Where links the action to the place and means at that place." },
  { key: "when-time", prompt: "Choose the link that points to a time", stem: "I remember {time}, ___ everyone worked quietly.", answer: "when", choices: ["when", "which", "where", "whose"], relation: "time", note: "When points back to the named time and locates the action then." },
  { key: "whose-possession", prompt: "Choose the link that shows possession", stem: "The {role}, ___ {possession} was beside the map, led the check.", answer: "whose", choices: ["whose", "who", "which", "where"], relation: "possession", note: "Whose links the possessed object to the person; it is not simply a plural form of who." },
  { key: "identify-antecedent", prompt: "Choose the noun phrase described by the relative clause", stem: "{Person} opened the {thing}, which contained the final record.", answer: "the {thing}", choices: ["the {thing}", "{Person}", "the final record", "the opening"], relation: "antecedent", note: "Which contained the final record sits beside and points back to the thing." },
  { key: "question-word", prompt: "Choose the sentence in which where introduces a relative clause", stem: "Which use of where describes a noun?", answer: "The {place}, where the team met, had a wide entrance.", choices: ["The {place}, where the team met, had a wide entrance.", "Where did the team meet?", "I asked where the team met.", "Where is marked on the map."], relation: "place", note: "In the accepted sentence, where the team met describes the place; the other uses ask or report a question." },
  { key: "valid-alternative", prompt: "Choose the accurate editing comment without claiming only one form is always possible", stem: "The {thing} that the team checked was ready.", answer: "That is valid here; which could also be valid in a restrictive version with the same intended meaning.", choices: ["That is valid here; which could also be valid in a restrictive version with the same intended meaning.", "Only that can ever refer to a thing.", "Which can only refer to a person.", "Every relative clause must use who."], relation: "valid alternatives", note: "Relative choices depend on meaning and sentence pattern, so an editor should not invent an absolute rule where alternatives work." },
];

const combineItems = [
  { key: "person-embedded", sources: ["{Person} welcomed the visitors.", "{Person} is the {role}."], answer: "{Person}, who is the {role}, welcomed the visitors.", wrong: ["{Person} welcomed the visitors, who is the {role}.", "Who is the {role} {Person} welcomed the visitors.", "{Person}, where is the {role}, welcomed the visitors."], position: "embedded" },
  { key: "thing-end", sources: ["The team repaired the {thing}.", "The {thing} had stopped working."], answer: "The team repaired the {thing} that had stopped working.", wrong: ["The team that had stopped working repaired the {thing}.", "The team repaired that had stopped working the {thing}.", "That had stopped working the team repaired the {thing}."], position: "end" },
  { key: "place-end", sources: ["This is the {place}.", "The team stores its equipment there."], answer: "This is the {place} where the team stores its equipment.", wrong: ["This where the team stores its equipment is the {place}.", "This is where the {place} the team stores its equipment.", "This is the {place} who stores the equipment."], position: "end" },
  { key: "time-end", sources: ["Everyone remembers {time}.", "The project began then."], answer: "Everyone remembers {time}, when the project began.", wrong: ["Everyone remembers when {time} the project began.", "Everyone, when the project began, remembers {time}.", "Everyone remembers {time}, whose the project began."], position: "end" },
  { key: "possession-embedded", sources: ["The {role} led the demonstration.", "The {role}'s {possession} was on the desk."], answer: "The {role}, whose {possession} was on the desk, led the demonstration.", wrong: ["The {role}, who {possession} was on the desk, led the demonstration.", "The {possession}, whose {role} led the demonstration, was a person.", "Whose {possession} was on the desk the {role} led."], position: "embedded" },
  { key: "avoid-distance", sources: ["The {thing} stood beside the cabinet.", "The {thing} contained the samples."], answer: "The {thing}, which contained the samples, stood beside the cabinet.", wrong: ["The {thing} stood beside the cabinet, which contained the samples.", "The cabinet stood beside the {thing}, which contained the samples.", "Which contained the samples stood the {thing} beside the cabinet."], position: "embedded" },
  { key: "retain-meaning", sources: ["The team visited the {place}.", "{Person} had recommended the {place}."], answer: "The team visited the {place} that {Person} had recommended.", wrong: ["The team that {Person} had recommended visited the {place}.", "{Person} visited the team that recommended the {place}.", "The {place} visited the team that {Person} recommended."], position: "end" },
  { key: "genre-control", sources: ["Check the {thing}.", "The {thing} is listed in step three."], answer: "Check the {thing} that is listed in step three.", wrong: ["Check that is listed in step three the {thing}.", "The {thing} checks step three that is listed.", "Who is listed in step three check the {thing}."], position: "end" },
];

const thatItems = [
  { key: "relative-that", text: "The {thing} that passed the test was returned to the team.", question: "Which explanation identifies relative that?", answer: "That passed the test describes the {thing}.", choices: ["That passed the test describes the {thing}.", "That introduces a reported thought.", "That points at something without a noun.", "That begins a question."], omission: "unsafe_subject" },
  { key: "complement-that", text: "The {role} reported that the {thing} had passed the test.", question: "Which explanation is accurate?", answer: "That introduces what was reported; it does not describe a noun here.", choices: ["That introduces what was reported; it does not describe a noun here.", "That describes the {role}.", "That describes the test.", "Every that begins a relative clause."], omission: "not_relative" },
  { key: "object-omission", text: "The {thing} that {Person} checked was ready.", question: "Which edited version can keep the same meaning?", answer: "The {thing} {Person} checked was ready.", choices: ["The {thing} {Person} checked was ready.", "The {thing} checked was ready.", "That {Person} checked was ready.", "The {thing} who {Person} checked was ready."], omission: "safe_object" },
  { key: "subject-no-omission", text: "The {thing} that contained the samples was sealed.", question: "Why should that remain in this version?", answer: "That is the subject of contained, so removing it would leave the relative clause without its subject.", choices: ["That is the subject of contained, so removing it would leave the relative clause without its subject.", "That must remain in every relative clause.", "Samples is always a relative pronoun.", "Removing that would change a place into a time."], omission: "unsafe_subject" },
  { key: "demonstrative", text: "That was the {thing} on the table.", question: "Which test shows that is not introducing a relative clause?", answer: "No clause after that describes an antecedent noun.", choices: ["No clause after that describes an antecedent noun.", "Every sentence beginning with that is relative.", "The word table is a relative pronoun.", "Was always begins a relative clause."], omission: "not_relative" },
  { key: "which-object-omission", text: "The {thing} which {Person} selected was displayed.", question: "Which formal edit is grammatically possible here?", answer: "The {thing} {Person} selected was displayed.", choices: ["The {thing} {Person} selected was displayed.", "The {thing} selected was displayed by nobody.", "Which {Person} selected the {thing} was displayed.", "The {thing} where {Person} selected was displayed."], omission: "safe_object" },
  { key: "nonrestrictive-no-omission", text: "The {thing}, which {Person} selected, was displayed.", question: "Which comment is accurate for this comma-marked additional clause?", answer: "Keep which; an implied pronoun is not used in this non-restrictive pattern.", choices: ["Keep which; an implied pronoun is not used in this non-restrictive pattern.", "Delete which because all object pronouns disappear.", "Replace which with where because commas are present.", "Delete both commas and the main verb."], omission: "unsafe_nonrestrictive" },
  { key: "antecedent-test", text: "I know that {Person} checked the {thing}.", question: "What happens when you try the antecedent-arrow test?", answer: "That does not point back to a noun; it introduces the content of what is known.", choices: ["That does not point back to a noun; it introduces the content of what is known.", "That points back to I.", "That describes {Person} as a noun.", "The {thing} is an implied pronoun."], omission: "not_relative" },
];

const punctuationItems = [
  { key: "embedded-extra", raw: "{Person} who is the {role} {action}.", answer: "{Person}, who is the {role}, {action}.", wrong: ["{Person} who, is the {role} {action}.", "{Person}, who is the {role} {action}.", "{Person} who is, the {role}, {action}."], meaning: "The named person is already identified; the clause adds non-essential information.", comma: "paired" },
  { key: "thing-extra", raw: "The {thing} which had been restored stood by the entrance.", answer: "The {thing}, which had been restored, stood by the entrance.", wrong: ["The {thing} which, had been restored stood by the entrance.", "The {thing}, which had been restored stood by the entrance.", "The {thing} which had, been restored, stood by the entrance."], meaning: "The context identifies one particular thing and adds its restored state.", comma: "paired" },
  { key: "restrictive-no-comma", raw: "The card that shows the final result belongs in the report.", answer: "The card that shows the final result belongs in the report.", wrong: ["The card, that shows the final result, belongs in the report.", "The card that, shows the final result belongs in the report.", "The card, that shows the final result belongs, in the report."], meaning: "The clause identifies which card is meant, so this intended meaning uses no commas.", comma: "none" },
  { key: "end-extra", raw: "The team returned to the {place} which had reopened that morning.", answer: "The team returned to the {place}, which had reopened that morning.", wrong: ["The team returned, to the {place} which had reopened that morning.", "The team returned to the {place} which, had reopened that morning.", "The team, returned to the {place}, which had reopened that morning."], meaning: "The context already identifies the place; the ending adds information about it.", comma: "opening" },
  { key: "meaning-pair", raw: "Compare: The folders which had blue labels were moved. / The folders, which had blue labels, were moved.", answer: "Without commas, the clause can identify a subset; with commas, it presents the blue labels as additional information about all the identified folders.", wrong: ["The commas never affect interpretation.", "Every which-clause must have commas.", "A comma changes folders into a person.", "Only the version without commas is grammatical in every context."], meaning: "Punctuation works with context and intended meaning, not a mechanical all-relative-clauses rule.", comma: "meaning_compare" },
  { key: "main-clause-test", raw: "The {thing}, which the team tested twice, remained stable.", answer: "The {thing} remained stable.", wrong: ["Which the team tested twice.", "The team twice.", "The {thing}, remained."], meaning: "Removing the inserted additional clause reveals a complete main clause.", comma: "removal_test" },
  { key: "no-comma-overclaim", raw: "The visitor who booked the quiet room arrived first.", answer: "No comma is needed for the intended identifying meaning, although another context could make the clause additional.", wrong: ["Who-clauses never use commas.", "All relative clauses need two commas.", "A comma is forbidden after every person noun.", "Punctuation is unrelated to meaning."], meaning: "The sentence identifies which visitor; the decision is tied to that context.", comma: "none" },
  { key: "embedded-control", raw: "The {place} where the group first met now has step-free access.", answer: "The {place} where the group first met now has step-free access.", wrong: ["The {place}, where the group first met, now has step-free access.", "The {place} where, the group first met now has step-free access.", "The {place}, where the group first met now, has step-free access."], meaning: "Here the where-clause identifies the place intended; do not add commas merely because a relative word appears.", comma: "none" },
];

const revisionItems = [
  { key: "ambiguous-nearby", genre: "narrative", text: "The guide placed the map beside the lantern, which had a torn corner.", answer: "The guide placed the map, which had a torn corner, beside the lantern.", wrong: ["The guide, which had a torn corner, placed the map beside the lantern.", "The guide placed which had a torn corner beside the lantern.", "The guide placed the map beside the lantern which was ambiguous."], effect: "places the clause beside map so the antecedent is clear" },
  { key: "remove-overload", genre: "information", text: "The {thing}, which was useful, which was in the {place}, which the team liked, was displayed.", answer: "The useful {thing} was displayed in the {place}, where visitors could examine it.", wrong: ["Keep every clause because more clauses always improve writing.", "The {thing} which which which was displayed.", "Delete the main clause and keep only the extra details."], effect: "keeps useful information while reducing clause overload" },
  { key: "precise-detail", genre: "field report", text: "The {role}, who was nice, {action}.", answer: "The {role}, who had trained the survey team, {action}.", wrong: ["The {role}, who was very very nice, {action}.", "Who had trained the team the {role}.", "The {role}, where was nice, {action}."], effect: "replaces a vague judgement with relevant information" },
  { key: "instruction-clarity", genre: "instructions", text: "Put the card in the tray which has a green label.", answer: "Put the card in the tray that has a green label.", wrong: ["Put which has a green label the card in the tray.", "Put the tray in the card that has a green label.", "Add commas automatically around that has a green label."], effect: "keeps the identifying clause next to tray and preserves the instruction" },
  { key: "end-position", genre: "recount", text: "We met {Person}. {Person} had organised {time}.", answer: "We met {Person}, who had organised {time}.", wrong: ["We, who had organised {time}, met {Person}.", "Who had organised {time} we met {Person}.", "We met, when had organised, {Person}."], effect: "combines the recount smoothly and keeps the person reference clear" },
  { key: "avoid-redundancy", genre: "explanation", text: "A thermometer is an instrument which is an instrument that measures temperature.", answer: "A thermometer is an instrument that measures temperature.", wrong: ["A thermometer which which measures is an instrument.", "Keep both repetitions because relative clauses require them.", "A temperature is an instrument that measures a thermometer."], effect: "removes repeated wording without losing the definition" },
  { key: "whose-clarity", genre: "information", text: "The scientist had a notebook. Its pages contained the readings.", answer: "The scientist had a notebook whose pages contained the readings.", wrong: ["The scientist, whose had pages, contained the readings.", "The pages whose scientist had a notebook.", "The scientist had whose notebook pages readings."], effect: "uses whose to express possession clearly" },
  { key: "valid-voice", genre: "narrative", text: "The boat that crossed the bay carried the message.", answer: "Keep the sentence: the identifying clause is clear and purposeful; an editor need not replace every that with which.", wrong: ["Replace that because it is never valid.", "Add commas because every relative clause needs them.", "Delete the clause even though it identifies the boat."], effect: "respects a valid authorial choice and avoids a prescriptive overclaim" },
];

const candidates = [
  ...expand("links", 47, linkItems, buildLink),
  ...expand("combine", 47, combineItems, buildCombine),
  ...expand("that-implied", 47, thatItems, buildThat),
  ...expand("punctuation", 47, punctuationItems, buildPunctuation),
  ...expand("revision", 48, revisionItems, buildRevision),
];

const enrichedCurated = curated.map(enrichVariant);
const enrichedCandidates = candidates.map(enrichVariant);
pack.question_variants = [...enrichedCurated, ...enrichedCandidates];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Year 5 relative-clause pilot bank reaches 240 variants with four curated questions preserved unchanged and 236 deterministic review candidates. Coverage includes meaning-matched relative links, antecedent clarity, embedded and end-position clauses, carefully bounded restrictive/non-restrictive punctuation, relative that and safe implied-pronoun decisions, ambiguity repair and genre transfer. Every generated item has dyslexia/SEND chunking, non-drag alternative inputs, rich evidence-led feedback and pressure-free publishing missions. Selected narration references require produced, human-reviewed ElevenLabs assets; browser TTS is prohibited. Independent English, teacher, SEND, accessibility, safeguarding, audio and renderer review remains required before promotion.";

validateBank(pack, enrichedCurated, enrichedCandidates, curatedSnapshot);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`relative-clauses-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`relative-clauses-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`relative-clauses-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`relative-clauses-bank audio_refs=${candidates.filter((variant) => variant.body.audio_asset_id).length}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`relative-clauses-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 5 relative-clauses bank is out of date; run generate-y5-relative-clauses-bank.mjs --write.");
  console.log("relative-clauses-bank deterministic check passed");
} else {
  console.log("relative-clauses-bank dry-run; pass --write to update the pack");
}

function buildLink(item, context, index, id) {
  return candidate({ id, index, context, format: "clause-link-map", blueprint: "antecedent-and-relative-link", band: index < 16 ? "developing" : index < 38 ? "expected" : "secure", strand: "relative_link_and_antecedent", prompt: `Meaning-link mission ${index + 1}: ${fill(item.prompt, context)}.`, body: { sentence: fill(item.stem, context), relationship: item.relation, choices: fillAll(item.choices, context), accepted_alternatives_note: item.key === "valid-alternative" ? "More than one form can be valid in a suitable context; judge the editing claim." : "The task wording and punctuation establish the intended relationship." }, answer: fill(item.answer, context), hints: ["Find the antecedent before choosing a link.", `Name the intended relationship: ${item.relation}.`], explanation: fill(item.note, context), tag: item.key === "identify-antecedent" ? "unclear_antecedent" : item.key === "question-word" ? "question_word_assumed_relative" : "relative_word_by_habit", repair: "Use the clause map: antecedent -> relationship -> possible link -> complete-sentence reread." });
}

function buildCombine(item, context, index, id) {
  return candidate({ id, index, context, format: "sentence-combiner", blueprint: "combine-with-clear-placement", band: index < 15 ? "developing" : index < 38 ? "expected" : "secure", strand: "clear_clause_placement", prompt: `Clause-combining desk ${index + 1}: combine both source sentences without losing meaning or creating an unclear antecedent.`, body: { source_sentences: fillAll(item.sources, context), clause_position: item.position, choices: [fill(item.answer, context), ...fillAll(item.wrong, context)], move_controls: ["select_chunk", "move_left", "move_right", "undo"] }, answer: fill(item.answer, context), hints: ["Keep the relative clause beside the noun it describes.", "Remove the repeated noun, then reread the complete main clause."], explanation: `${fill(item.answer, context)} The relative clause sits next to its intended antecedent and both source meanings remain available.`, tag: "distant_antecedent", repair: "Display the two source sentences above a chunked sentence row; connect the clause to its noun before choosing embedded or end position." });
}

function buildThat(item, context, index, id) {
  return candidate({ id, index, context, format: "clause-link-map", blueprint: "relative-that-and-implied-pronoun", band: index < 16 ? "expected" : index < 38 ? "secure" : "stretch", strand: "relative_that_and_implied_pronoun", prompt: `That-and-zero test ${index + 1}: ${fill(item.question, context)}`, body: { sentence: fill(item.text, context), omission_classification: item.omission, choices: fillAll(item.choices, context), antecedent_arrow_test: true, omission_rule: "Omit an object relative pronoun only where the relationship remains clear; do not omit a subject relative pronoun or the pronoun in a non-restrictive clause." }, answer: fill(item.answer, context), hints: ["Ask whether the clause describes an antecedent noun.", "If testing omission, check whether the relative word is the clause subject or object."], explanation: `${fill(item.answer, context)} The antecedent and subject/object tests explain the decision; the form is not chosen by a blanket rule.`, tag: item.omission === "safe_object" ? "omission_without_subject_object_test" : "every_that_relative", repair: "Draw an antecedent arrow, box the relative clause, then label its subject and object before removing or retaining a word." });
}

function buildPunctuation(item, context, index, id) {
  return candidate({ id, index, context, format: "relative-clause-editor", blueprint: "embedded-clause-punctuation", band: index < 14 ? "developing" : index < 37 ? "expected" : "secure", strand: "punctuation_and_meaning", prompt: `Punctuation-and-meaning edit ${index + 1}: choose the version or explanation that matches the stated context.`, body: { unedited_text: fill(item.raw, context), intended_meaning: fill(item.meaning, context), comma_decision: item.comma, choices: [fill(item.answer, context), ...fillAll(item.wrong, context)], bounded_rule: "Comma decisions depend on whether the clause adds non-restrictive information or identifies the intended noun in context; not every relative clause takes commas." }, answer: fill(item.answer, context), hints: ["Decide whether the noun is already identified or the clause selects which one.", "For an inserted additional clause, test the main sentence without it and check paired punctuation."], explanation: `${fill(item.answer, context)} ${fill(item.meaning, context)}`, tag: item.comma === "none" ? "comma_every_relative" : "embedded_clause_boundary", repair: "Show the antecedent, relative clause and remaining main clause as separate chunks; compare meaning before selecting comma boundaries." });
}

function buildRevision(item, context, index, id) {
  return candidate({ id, index, context, format: "reader-effect-choice", blueprint: "purposeful-clause-revision", band: index < 16 ? "expected" : index < 38 ? "secure" : "stretch", strand: "purposeful_revision_and_transfer", prompt: `Publishing mission ${index + 1} (${item.genre}): which edit improves control while preserving the intended information and voice?`, body: { original: fill(item.text, context), genre: item.genre, choices: [fill(item.answer, context), ...fillAll(item.wrong, context)], before_after_meaning_check: true }, answer: fill(item.answer, context), hints: ["Name the antecedent and the useful information before editing.", "Prefer the clearest version, not automatically the one with the most clauses."], explanation: `${fill(item.answer, context)} This ${fill(item.effect, context)} and preserves the ${item.genre} purpose.`, tag: item.key === "ambiguous-nearby" ? "distant_antecedent" : item.key === "remove-overload" ? "clause_overload" : "revision_changes_meaning", repair: "Keep the original visible, make one clause-level change, then compare antecedent clarity, retained information and sentence rhythm." });
}

function candidate({ id, index, context, format, blueprint, band, strand, prompt, body, answer, hints, explanation, tag, repair }) {
  const fullId = `${prefix}${id}`;
  const fullExplanation = explanation.length >= 90
    ? explanation
    : `${explanation} This keeps the relative-clause relationship explicit and preserves the intended sentence meaning for the reader.`;
  const preparedBody = Array.isArray(body.choices)
    ? { ...body, choices: rotate([...new Set(body.choices)], index % body.choices.length) }
    : body;
  const audio = index % 12 === 0 ? {
    audio_optional: true,
    audio_asset_id: `narration-${fullId}`,
    audio_provider: "ElevenLabs",
    audio_asset_status: "required_human_listening_review",
    human_listening_approval_required: true,
  } : { audio_required: false };
  return {
    id: fullId,
    format,
    body: {
      prompt,
      ...preparedBody,
      relative_clause_strand: strand,
      difficulty_band: band,
      evidence_purpose: `${strand}_meaning_and_sentence_control`,
      variant_blueprint_id: blueprint,
      genre_context: context.genre,
      review_batch: reviewBatch,
      response_mode: "touch_keyboard_switch_eye_gaze_aac_or_adult_scribed_choice",
      supported_interaction: "Select clauses, links, punctuation or edits by touch, keyboard, switch scanning, eye-gaze dwell, AAC/pointing or learner-directed adult scribing; move menus and numbered positions replace fine dragging, and speech or handwriting is never mandatory.",
      interaction_route: { touch: true, keyboard: true, switch_scan: true, eye_gaze: true, aac_or_point: true, adult_scribed: true, fine_drag_required: false, handwriting_required: false, speech_required: false },
      dyslexia_support: { clause_chunking: true, adjustable_spacing: true, readable_font_option: true, line_focus: true, antecedent_arrow_text_equivalent: true, one_decision_at_a_time: true },
      reduced_visual_load: true,
      source_text_remains_visible: true,
      undo_available: true,
      retry_without_penalty: true,
      timer_allowed: false,
      speed_score_allowed: false,
      streaks_allowed: false,
      lives_allowed: false,
      browser_tts_allowed: false,
      browser_tts_fallback: "prohibited",
      ...audio,
      gamification: { mission: "restore one clear link in the calm publishing map", reward: "a page marker for explaining a sentence decision", timer: false, streak: false, lives: false, loss_on_error: false, retry_message: "That version gives the editor useful evidence. Keep the clear parts, open one clause clue and revise without losing progress." },
    },
    expected_answer: { value: answer },
    hints,
    explanation: fullExplanation,
    feedback: {
      correct: `The sentence evidence supports the accepted response. ${fullExplanation}`,
      repair,
      evidence: `Check the relative clause against its antecedent, intended relationship, complete main clause and reader meaning. Accepted response: ${answer}`,
      misconception_check: tag,
      support_message: "Use chunked text, an antecedent map, touch, keyboard, switch, eye gaze, AAC/pointing or adult-scribed response. Rereading may be silent or use approved audio; no timer, handwriting, speech or precision drag is required.",
      retry: "Correct links and punctuation remain visible. Use one hint, compare the complete sentence and retry without penalty.",
    },
    difficulty: { developing: 4, expected: 5, secure: 7, stretch: 8 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: format === "clause-link-map" ? "antecedent-arrow-trace" : format === "sentence-combiner" ? "clause-position-dock" : format === "relative-clause-editor" ? "punctuation-meaning-compare" : "publishing-revision-map",
  };
}

function enrichVariant(variant) {
  const body = variant.body ?? {};
  return {
    ...variant,
    body: {
      ...body,
      clause_mapping_contract: {
        kind: "relative_clause_mapping",
        mode: body.variant_blueprint_id ?? "clause_link_and_meaning",
        evidence_steps: ["identify_antecedent", "map_clause_boundary", "check_meaning_effect"],
        response_modes: ["touch", "keyboard", "switch", "eye_gaze", "aac", "adult_scribed"],
        precision_drag_required: false,
        speech_required: false,
        handwriting_required: false,
        preserve_correct_work: true,
        untimed: true,
      },
    },
  };
}

function validateClauseContract(variant) {
  const contract = variant.body?.clause_mapping_contract;
  const requiredResponseModes = ["touch", "keyboard", "switch", "eye_gaze", "aac", "adult_scribed"];
  const requiredEvidence = ["identify_antecedent", "map_clause_boundary", "check_meaning_effect"];
  if (!contract || contract.kind !== "relative_clause_mapping" || !contract.mode || contract.precision_drag_required !== false || contract.speech_required !== false || contract.handwriting_required !== false || contract.preserve_correct_work !== true || contract.untimed !== true || requiredResponseModes.some((mode) => !contract.response_modes?.includes(mode)) || requiredEvidence.some((step) => !contract.evidence_steps?.includes(step))) throw new Error(`${variant.id} lacks an accessible relative-clause mapping contract.`);
}

function expand(label, count, items, builder) {
  return Array.from({ length: count }, (_, index) => {
    const item = items[index % items.length];
    const context = contexts[(Math.floor(index / items.length) + index) % contexts.length];
    return builder(item, context, index, `${label}-${String(index + 1).padStart(3, "0")}-${item.key}-${context.key}`);
  });
}

function validateBank(currentPack, authored, generated, authoredSnapshot) {
  if (authored.length !== 4 || JSON.stringify(currentPack.question_variants.slice(0, 4).map(removeClauseContract)) !== authoredSnapshot) throw new Error("Curated variants changed or moved.");
  if (generated.length !== 236 || currentPack.question_variants.length !== pilotTarget) throw new Error(`Expected 236 generated and ${pilotTarget} total variants.`);
  const blueprints = new Map(currentPack.variant_blueprints.map((item) => [item.id, item]));
  const formats = new Set(currentPack.practice.formats);
  const ids = new Set();
  const signatures = new Set();
  for (const variant of currentPack.question_variants) {
    if (ids.has(variant.id)) throw new Error(`Duplicate id ${variant.id}.`);
    ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${normalise(variant.expected_answer)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate format/prompt/answer signature ${variant.id}.`);
    signatures.add(signature);
    validateClauseContract(variant);
  }
  for (const variant of generated) {
    const blueprint = blueprints.get(variant.body.variant_blueprint_id);
    if (!blueprint || blueprint.format !== variant.format || !formats.has(variant.format)) throw new Error(`${variant.id} has invalid format or blueprint.`);
    if (!variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.evidence || !variant.feedback?.support_message || variant.hints.length < 2 || variant.explanation.length < 70) throw new Error(`${variant.id} lacks rich feedback.`);
    if (!variant.body.interaction_route?.touch || !variant.body.interaction_route?.keyboard || !variant.body.interaction_route?.switch_scan || !variant.body.interaction_route?.eye_gaze || !variant.body.interaction_route?.aac_or_point || !variant.body.interaction_route?.adult_scribed || variant.body.interaction_route?.fine_drag_required !== false || variant.body.interaction_route?.handwriting_required !== false || variant.body.interaction_route?.speech_required !== false) throw new Error(`${variant.id} lacks equivalent accessible input routes.`);
    if (!variant.body.dyslexia_support?.clause_chunking || !variant.body.dyslexia_support?.line_focus || variant.body.reduced_visual_load !== true) throw new Error(`${variant.id} lacks dyslexia/SEND support.`);
    if (variant.body.timer_allowed !== false || variant.body.speed_score_allowed !== false || variant.body.streaks_allowed !== false || variant.body.lives_allowed !== false || variant.body.gamification?.loss_on_error !== false) throw new Error(`${variant.id} introduces performance pressure.`);
    if (variant.body.browser_tts_allowed !== false || variant.body.browser_tts_fallback !== "prohibited") throw new Error(`${variant.id} permits browser TTS.`);
    if (variant.body.audio_asset_id && (variant.body.audio_provider !== "ElevenLabs" || variant.body.audio_asset_status !== "required_human_listening_review" || variant.body.human_listening_approval_required !== true)) throw new Error(`${variant.id} has an unreviewed audio route.`);
    if (variant.body.omission_classification === "unsafe_subject" && /can keep the same meaning/i.test(variant.body.prompt)) throw new Error(`${variant.id} risks teaching invalid subject-pronoun omission.`);
    if (variant.body.bounded_rule && /^every relative clause (takes|needs) commas/i.test(variant.body.bounded_rule.trim())) throw new Error(`${variant.id} overclaims comma use.`);
  }
  const expected = { "antecedent-and-relative-link": 47, "combine-with-clear-placement": 47, "relative-that-and-implied-pronoun": 47, "embedded-clause-punctuation": 47, "purposeful-clause-revision": 48 };
  for (const [blueprint, count] of Object.entries(expected)) {
    const actual = generated.filter((variant) => variant.body.variant_blueprint_id === blueprint).length;
    if (actual !== count) throw new Error(`Blueprint ${blueprint} expected ${count}, found ${actual}.`);
  }
}

function removeClauseContract(variant) {
  const { clause_mapping_contract: _clauseContract, ...body } = variant.body ?? {};
  return { ...variant, body };
}

function fill(value, context) {
  return String(value)
    .replaceAll("{Person}", context.person)
    .replaceAll("{person}", context.person)
    .replaceAll("{role}", context.role)
    .replaceAll("{thing}", context.thing)
    .replaceAll("{place}", context.place)
    .replaceAll("{time}", context.time)
    .replaceAll("{possession}", context.possession)
    .replaceAll("{action}", context.action);
}

function fillAll(values, context) { return values.map((value) => fill(value, context)); }
function rotate(values, by) { const offset = by % values.length; return [...values.slice(offset), ...values.slice(0, offset)]; }
function normalise(value) { return JSON.stringify(value).toLowerCase().replaceAll(/[^a-z0-9]+/g, " ").trim(); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
function summary(items, keyFor) { const counts = new Map(); for (const item of items) counts.set(keyFor(item), (counts.get(keyFor(item)) ?? 0) + 1); return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(","); }
