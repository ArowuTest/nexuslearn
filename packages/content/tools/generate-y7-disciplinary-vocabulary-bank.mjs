#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packPath = path.resolve(argValue("--pack") ?? path.join(repoRoot, "packages/content/packs/en-y7-disciplinary-vocabulary.pack.sample.json"));
const write = process.argv.includes("--write"), check = process.argv.includes("--check");
const prefix = "en-y7-disciplinary-vocabulary-bank-", pilotTarget = 260, reviewBatch = "y7-disciplinary-vocabulary-depth-a";
if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8"), pack = JSON.parse(originalText);
if (pack.pack_id !== "en-y7-disciplinary-vocabulary") throw new Error("This generator only supports the Year 7 disciplinary-vocabulary pack.");
const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 5) throw new Error(`Expected exactly 5 curated variants, found ${curated.length}. Refusing to overwrite possible authored work.`);

const routes = [
  ["tiles", "Word-part tile route", "labelled morpheme tiles and persistent context"],
  ["table", "Discipline-table route", "subject, clue, meaning and non-example columns"],
  ["audio", "Optional audio route", "approved narration reference with visible transcript"],
  ["static", "Static glossary route", "large-print cards with line focus and no motion"],
];

const morph = [
  mo("reconstruct", "History", "Historians reconstruct events from records.", [["re-", "again"], ["construct", "build"]], "build or piece together again", "verb", "History context narrows the prediction to rebuilding an account from evidence."),
  mo("transport", "Geography", "Railways transport goods between regions.", [["trans-", "across"], ["port", "carry"]], "carry across or move from place to place", "verb", "The Latin root supports the prediction; context rules out a literal hand-carried load."),
  mo("interdependent", "Geography", "The settlements are interdependent because each supplies the other.", [["inter-", "between"], ["depend", "rely"], ["-ent", "having a quality"]], "relying on one another", "adjective", "The parts suggest mutual reliance and the sentence confirms it."),
  mo("photosynthesis", "Science", "Plants use photosynthesis to make glucose using light.", [["photo-", "light"], ["synthesis", "putting together"]], "a process using light to build glucose", "noun", "Greek-derived parts offer a clue; the science definition supplies the precise process."),
  mo("chronology", "History", "Arrange the events in chronology before explaining causes.", [["chrono-", "time"], ["-logy", "study or account"]], "the time order of events", "noun", "The time root and history context select ordered sequence."),
  mo("geothermal", "Geography", "The region uses geothermal energy from hot rocks underground.", [["geo-", "Earth"], ["thermal", "heat-related"]], "relating to heat from within Earth", "adjective", "Earth plus heat provides a useful prediction confirmed by context."),
  mo("microscope", "Science", "Use a microscope to view cells too small to see unaided.", [["micro-", "small"], ["-scope", "instrument for viewing"]], "an instrument for viewing very small objects", "noun", "The roots predict a viewing tool and the laboratory sentence confirms it."),
  mo("democracy", "History and Citizenship", "In a democracy, citizens help choose representatives.", [["demo-", "people"], ["-cracy", "rule or government"]], "government involving rule by the people", "noun", "Greek roots support the core idea, but real democratic systems require fuller study."),
  mo("biodiversity", "Science and Geography", "The survey compared biodiversity in two habitats.", [["bio-", "life"], ["diversity", "variety"]], "the variety of living organisms in an area", "noun", "The parts predict variety of life and context provides the habitat scale."),
  mo("equilateral", "Mathematics", "An equilateral triangle has three equal sides.", [["equi-", "equal"], ["lateral", "side-related"]], "having equal sides", "adjective", "The parts predict equal sides and the sentence gives the exact mathematical condition."),
  mo("spectator", "English and PE", "The spectator watched the match and described it.", [["spect", "look or see"], ["-ator", "person who does"]], "a person who watches an event", "noun", "The root relates to seeing, while context determines the modern role."),
];

const poly = [
  po("evidence", [["English", "quotation or detail from a text"], ["Science", "observation or measurement supporting a conclusion"], ["History", "source detail supporting an interpretation"]]),
  po("source", [["History", "document, object or account used as evidence"], ["Geography", "place where a river begins"], ["English", "text from which evidence is selected"]]),
  po("table", [["Mathematics", "values arranged in rows and columns"], ["Science", "observations or measurements in rows and columns"], ["Everyday", "furniture with a raised flat surface"]]),
  po("volume", [["Mathematics", "space occupied by a three-dimensional object"], ["Science", "space occupied by a substance"], ["Music", "perceived loudness of sound"]]),
  po("current", [["Geography", "continuous movement of water or air"], ["Physics", "rate of flow of electric charge"], ["Everyday", "belonging to the present time"]]),
  po("function", [["Mathematics", "rule mapping each allowed input to one output"], ["Computing", "named reusable block of code"], ["Everyday", "purpose or job of something"]]),
  po("character", [["English", "person or figure represented in a text"], ["Computing", "letter, digit, space or text symbol"], ["Everyday", "distinctive qualities of a person or thing"]]),
  po("mean", [["Mathematics", "total divided by the number of values"], ["Everyday verb", "intend or signify"], ["Everyday adjective", "unkind or ungenerous"]]),
  po("power", [["Mathematics", "exponent showing repeated multiplication"], ["Physics", "rate of energy transfer"], ["History and Politics", "ability to control or influence"]]),
  po("cell", [["Biology", "basic structural unit of a living organism"], ["Computing", "one box in a spreadsheet"], ["Electricity", "a single electrical source"]]),
  po("model", [["Science", "simplified representation used to explain or predict"], ["Mathematics", "mathematical representation of a situation"], ["Everyday", "example or physical representation"]]),
];

const purposes = [
  pu("analyse", "History", "examine source details and relationships methodically", "retell events without selecting evidence"),
  pu("evaluate", "Science", "judge evidence strength using stated criteria", "say whether the result feels good"),
  pu("significant", "History", "important because of a supported effect or consequence", "large in physical size only"),
  pu("factor", "Mathematics", "number or expression that divides or multiplies to form another", "any fact mentioned in prose"),
  pu("structure", "English", "organised arrangement of parts in a text", "material frame of a building only"),
  pu("process", "Geography", "linked series of changes shaping a system", "one labelled object"),
  pu("interpret", "Music", "make reasoned performance choices from notation and context", "change every note without justification"),
  pu("distribution", "Geography", "spatial pattern showing where something is found", "sharing sweets equally only"),
  pu("scale", "Mathematics and Geography", "relationship between representation and actual size or distance", "how heavy an object is"),
  pu("network", "Computing", "connected devices that communicate and share resources", "unrelated objects in one room"),
];

const glossaries = [
  gl("ecosystem", "Science", "organisms and non-living environment interacting", "organisms linked with soil, water, light and air", "The pond ecosystem includes organisms and physical conditions.", "one organism alone"),
  gl("coefficient", "Mathematics", "number multiplying a variable", "the 4 attached to x in 4x", "In 4x, the coefficient is 4.", "the exponent in x squared"),
  gl("monarchy", "History", "system with a monarch as head of state", "a crown linked to institutions and laws", "The powers of a monarchy differ across times and places.", "every elected presidency"),
  gl("erosion", "Geography", "wearing away and movement of rock or soil", "waves removing cliff material", "Coastal erosion changes a cliff over time.", "sediment being deposited"),
  gl("metaphor", "English", "comparison stating that one thing is another", "two unlike ideas directly linked", "The metaphor presents time as a thief.", "a literal time measurement"),
  gl("algorithm", "Computing", "precise sequence of steps for a task", "numbered instructions with a clear end", "The algorithm checks each value in order.", "unordered incomplete instructions"),
  gl("frequency", "Physics", "number of waves or cycles per second", "wave peaks counted over one second", "Higher frequency means more vibrations each second.", "sound loudness"),
  gl("gradient", "Mathematics", "vertical change divided by horizontal change", "rise divided by run", "The line has gradient 2 because y rises 2 for each 1 across.", "the y-intercept alone"),
  gl("variable", "Science", "factor changed, measured or controlled", "change-measure-control table", "The independent variable is deliberately changed.", "the conclusion"),
  gl("inference", "English", "conclusion drawn from evidence and reasoning", "text clue linked to a justified idea", "Dialogue supports an inference about the character.", "unsupported guess"),
  gl("democracy", "Citizenship", "system in which people participate in political decisions", "citizens, elections and accountable institutions", "Democratic systems use different structures for representation.", "one person with unchecked power"),
];

const precision = [
  pr("evaporate", "Science", "The liquid began to ___ from the surface.", "evaporate", ["disappear", "escape", "do a vanishing"]),
  pr("suggests", "History", "The source ___ that trade increased but does not prove the amount.", "suggests", ["screams", "guarantees", "sort of says"]),
  pr("erodes", "Geography", "Flowing water gradually ___ the river bank.", "erodes", ["messes with", "deletes", "does something to"]),
  pr("calculate", "Mathematics", "Use the formula to ___ the area.", "calculate", ["guess", "chat about", "dramatically uncover"]),
  pr("implies", "English", "The repeated image ___ that the speaker feels trapped.", "implies", ["proves forever", "does a hint", "shouts"]),
  pr("iterate", "Computing", "The loop will ___ through each list item.", "iterate", ["wander", "repeat randomly", "be fancy"]),
  pr("contrast", "Art", "The artist uses tonal ___ to separate the foreground.", "contrast", ["difference stuff", "loudness", "argument"]),
  pr("tempo", "Music", "The conductor increased the ___ while controlling dynamics.", "tempo", ["volume", "pitch colour", "music speed thing"]),
  pr("respiration", "Science", "Cells transfer energy through aerobic ___.", "respiration", ["breathing only", "burning", "energy making"]),
  pr("corroborate", "History", "Compare accounts to ___ the claim with independent evidence.", "corroborate", ["decorate", "repeat loudly", "automatically prove"]),
  pr("proportional", "Mathematics", "The graph through the origin shows a ___ relationship.", "proportional", ["random", "roughly same-ish", "parallel"]),
];

const retrieval = [
  rt("morph", "The prefix re- in revise most often contributes which idea?", "again", ["under", "between", "without"], "The prefix often contributes again, although context still fixes the precise meaning.", "morphology_as_decoration", ["morphology", "etymology"]),
  rt("observe", "In science, what does observe mean?", "notice and record using senses or instruments", ["celebrate a holiday", "state a preference", "invent a result"], "Science uses observe for noticing and recording evidence under stated conditions.", "everyday_meaning_overrides_subject_context", ["context", "subject_specific_meanings"]),
  rt("family", "Which word belongs to the construct family?", "construction", ["contrast", "constant", "consequence"], "Construct and construction share a root and related build meaning.", "spelling_overlap_means_family", ["word_families", "morphology"]),
  rt("volume", "In mathematics, what does volume mean?", "space occupied by a three-dimensional object", ["loudness", "a book in a series", "importance"], "Subject clues select the geometrical meaning from several meanings.", "one_word_one_meaning", ["polysemy", "subject_specific_meanings"]),
  rt("register", "Best formal replacement for kids in a school report?", "pupils", ["tiny humans", "youngsters!!!", "offspring"], "Pupils fits the formal school context without ranking home language or dialect.", "formal_means_longest", ["register", "precise_use"]),
  rt("suggest", "Which verb fits data that support but do not prove a claim?", "suggest", ["guarantee", "shout", "decorate"], "Suggest accurately limits evidence strength instead of overstating certainty.", "impressive_word_not_precise", ["precise_use", "context"]),
  rt("etymology", "What is the safest use of etymology?", "use word history as a clue, then check modern context and definition", ["assume old meaning is exact", "ignore the sentence", "split every word anywhere"], "Meanings change, so word history must be checked against current use.", "etymology_is_current_definition", ["etymology", "context"]),
  rt("suffix", "What does -tion often signal?", "a noun naming an action, process or result", ["past-tense verb", "place name", "comparison word"], "The suffix often forms nouns, while the base and context supply the full meaning.", "suffix_gives_complete_definition", ["morphology", "word_families"]),
  rt("source", "Why can source differ in History and Geography?", "one word form can carry related but distinct disciplinary meanings", ["one subject is wrong", "spelling changes secretly", "context never matters"], "Polysemy allows context and disciplinary purpose to select a meaning.", "one_word_one_meaning", ["polysemy", "subject_specific_meanings"]),
  rt("nonexample", "Why include a non-example on a glossary card?", "to mark the boundary of meaning and prevent overgeneralisation", ["make the card longer", "replace the definition", "test handwriting speed"], "A good non-example clarifies what the concept excludes.", "definition_without_transfer", ["context", "misconceptions"]),
];

const morphologyCandidates = cross(morph, routes, (x, r, i) => variant({ id: `morph-${x.word}-${r[0]}`, format: "morphology-builder", blueprint: "morpheme-meaning-builds", band: "developing", strand: "morphology", coverage: ["morphology", "etymology", "word_families", "context"], prompt: `${r[1]}: predict '${x.word}' in ${x.subject}.`, body: { word: x.word, subject: x.subject, context_sentence: x.sentence, morphemes: x.parts.map(([part, meaning]) => ({ part, meaning })), predicted_word_class: x.wordClass, choices: rotate([x.answer, "meaning chosen only from appearance", "longest possible definition", "unrelated everyday meaning"], i), representation: r[2] }, answer: x.answer, hints: ["Combine each labelled part and note the likely word class.", "Check against the complete subject sentence; etymology is a clue, not certainty."], explanation: `${x.word} means ${x.answer}. ${x.note}`, tag: "morphology_as_decoration", repair: "Build part -> contribution -> prediction -> context check, then consult the glossary.", index: i }));
const contextCandidates = cross(poly, routes, (x, r, i) => variant({ id: `context-${x.word}-${r[0]}`, format: "discipline-context-sort", blueprint: "everyday-technical-context-sorts", band: "expected", strand: "polysemy", coverage: ["polysemy", "context", "subject_specific_meanings"], prompt: `${r[1]}: match each disciplinary meaning of '${x.word}'.`, body: { word: x.word, cards: x.uses.map(([subject, meaning]) => ({ subject, sentence_clue: `${subject} use`, meaning })), choices: x.uses.map((u) => u[1]), representation: r[2] }, answer: x.uses.map(([subject, meaning]) => `${subject}: ${meaning}`), hints: ["Read the subject and sentence clue first.", "Do not force one familiar meaning into every discipline."], explanation: `${x.word} is polysemous: ${x.uses.map(([s, m]) => `${s} uses it for ${m}`).join("; ")}.`, tag: "everyday_meaning_overrides_subject_context", repair: "Use a subject-clue-meaning table and name the clue ruling out another meaning.", index: i }));
const purposeCandidates = cross(purposes, routes, (x, r, i) => variant({ id: `purpose-${x.word}-${r[0]}`, format: "discipline-context-sort", blueprint: "discipline-purpose-sorters", band: "secure", strand: "subject_specific_meanings", coverage: ["subject_specific_meanings", "context", "precise_use", "register"], prompt: `${r[1]}: which meaning of '${x.word}' fits ${x.subject}?`, body: { word: x.word, subject: x.subject, cards: [{ subject: x.subject, purpose: x.answer }], choices: rotate([x.answer, x.nonexample, "topic association only", "impressive but unsupported meaning"], i), representation: r[2] }, answer: x.answer, hints: ["Identify the job the word performs in this discipline.", "Choose by supplied purpose, not topic or length."], explanation: `In ${x.subject}, ${x.word} means ${x.answer}. '${x.nonexample}' is a boundary non-example.`, tag: "topic_association_sorting", repair: "Complete: In this subject, the word helps the writer to ___; the clue is ___.", index: i }));
const glossaryCandidates = cross(glossaries, routes, (x, r, i) => { const answer = `${x.meaning} | ${x.visual} | ${x.example} | non-example: ${x.nonexample}`; return variant({ id: `glossary-${x.word}-${r[0]}`, format: "visual-glossary-card", blueprint: "visual-glossary-card-completions", band: "intro", strand: "word_families", coverage: ["context", "precise_use", "word_families", "subject_specific_meanings"], prompt: `${r[1]}: choose the accurate ${x.subject} card for '${x.word}'.`, body: { word: x.word, subject: x.subject, choices: rotate([answer, `${x.nonexample} | unrelated visual | vague sentence`, `${x.meaning} | example changes meaning`, "decorative definition chosen for length"], i), card_fields: ["meaning", "visual_anchor", "accurate_sentence", "non_example"], representation: r[2] }, answer, hints: ["Check the subject meaning and accurate sentence.", "A non-example should mark the concept boundary."], explanation: `The card defines ${x.word} as ${x.meaning}, anchors it with ${x.visual}, uses it accurately and contrasts ${x.nonexample}.`, tag: "definition_without_transfer", repair: "Reveal meaning, visual, use and non-example one field at a time.", index: i }); });
const precisionCandidates = cross(precision, routes, (x, r, i) => variant({ id: `precision-${x.key}-${r[0]}`, format: "precision-choice", blueprint: "precision-register-choices", band: "secure", strand: "register", coverage: ["register", "precise_use", "subject_specific_meanings"], prompt: `${r[1]}: choose the precise ${x.subject} word for '${x.sentence}'`, body: { subject: x.subject, sentence: x.sentence, choices: rotate([x.answer, ...x.distractors], i), register_note: "school disciplinary writing; dialect and home language are not ranked", representation: r[2] }, answer: x.answer, hints: ["Check exact meaning, grammar, audience and purpose.", "Do not choose by length, rarity or dramatic sound."], explanation: `${x.answer} fits the ${x.subject} meaning and grammar. Alternatives are vague, informal for this purpose or technically different.`, tag: "impressive_word_not_precise", repair: "Read each choice in the gap and select by fitness, not prestige.", index: i })).slice(0, 43);
const retrievalCandidates = cross(retrieval, routes, (x, r, i) => variant({ id: `retrieval-${x.key}-${r[0]}`, format: "sentence-fit", blueprint: "disciplinary-vocabulary-retrieval", band: "retrieval", strand: x.coverage[0], coverage: [...x.coverage, "retrieval"], prompt: `${r[1]}: ${x.prompt}`, body: { choices: rotate([x.answer, ...x.distractors], i), retrieval_interval_days: [1, 3, 7, 14, 30][i % 5], glossary_preview_available: true, representation: r[2] }, answer: x.answer, hints: ["Use word part, sentence and discipline together.", "Reject choices that are merely familiar, long or topic-related."], explanation: x.explanation, tag: x.tag, repair: "Preview the glossary, highlight the decisive clue and retry without speed scoring.", index: i }));

const generated = [...morphologyCandidates, ...contextCandidates, ...purposeCandidates, ...glossaryCandidates, ...precisionCandidates, ...retrievalCandidates];
pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.adaptive_support.audio_first = "Optional prompt, sentence and glossary playback uses only referenced ElevenLabs assets after human listening approval. Browser TTS is prohibited; visible text, line focus, partner reading and AAC routes remain complete when audio is unavailable.";
pack.qa.notes = "Year 7 disciplinary vocabulary reaches the 260-item pilot target with five preserved curated variants and 255 deterministic review candidates covering morphology, context, polysemy, subject-specific meanings, register, precise use, word families, etymology and misconceptions across disciplines. Every generated item includes SEND scaffolds, supported non-drag routes, rich feedback, optional human-reviewed ElevenLabs references with browser TTS prohibited, and private knowledge missions without timers, lives, streak pressure, leaderboards or peer comparison. Independent English, disciplinary, teacher, SEND, accessibility, safeguarding, audio, renderer and pilot review remain required before promotion.";
validateBank(pack, curated, generated);

enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`disciplinary-vocabulary-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`disciplinary-vocabulary-bank blueprints=${summary(generated, (v) => v.body.variant_blueprint_id)}`);
console.log(`disciplinary-vocabulary-bank strands=${summary(generated, (v) => v.body.vocabulary_strand)}`);
if (write) { await writeFile(packPath, nextText, "utf8"); console.log(`disciplinary-vocabulary-bank written ${relative(packPath)}`); }
else if (check) { if (originalText !== nextText) throw new Error("Year 7 disciplinary-vocabulary bank is out of date; run generate-y7-disciplinary-vocabulary-bank.mjs --write."); console.log("disciplinary-vocabulary-bank deterministic check passed"); }
else console.log("disciplinary-vocabulary-bank dry-run; pass --write to update the pack");

function variant({ id, format, blueprint, band, strand, coverage, prompt, body, answer, hints, explanation, tag, repair, index }) {
  const fullId = `${prefix}${id}`, rich = explanation.length < 90 ? `${explanation} Discipline and context remain part of the meaning check.` : explanation;
  return { id: fullId, format, body: { prompt, ...body, vocabulary_strand: strand, coverage_tags: [...new Set([...coverage, "misconceptions"])], evidence_purpose: `${strand}_disciplinary_reasoning`, variant_blueprint_id: blueprint, review_batch: reviewBatch, difficulty_band: band, response_mode: "tap_keyboard_switch_eye_gaze_aac_oral_partner_or_adult_scribed", supported_interactions: ["tap", "keyboard", "switch_scan", "eye_gaze", "aac", "oral_response", "partner_scan", "adult_scribed"], interaction_support: { keyboard: true, switch_scan: true, touch: true, eye_gaze: true, aac: true, oral_or_partner_response: true, precision_drag_required: false, move_up_down_alternative: true, undo_available: true }, send_scaffolds: { one_step_prompt: true, reduced_language_route: true, persistent_glossary: true, line_focus: true, increased_spacing: true, readable_font_option: true, sentence_rehearsal: true }, static_alternative: "numbered text cards, fixed word-part table and persistent subject sentence", reduced_motion_alternative: "instant outlines with no moving tiles or countdown", visual_anchor_text_labelled: true, sentence_stems: ["The part ___ contributes ___.", "In this subject, ___ means ___.", "This fits because ___."], timer_allowed: false, speed_score_allowed: false, leaderboard_allowed: false, peer_comparison_allowed: false, audio_optional: true, audio_asset_id: `narration-${fullId}`, audio_provider: "ElevenLabs", audio_voice_profile: "calm_UK_secondary_narration_subject_to_approval", audio_asset_status: "required_human_listening_review", human_listening_approval_required: true, browser_tts_allowed: false, browser_tts_fallback: "prohibited", unavailable_audio_state: "complete_visible_text_partner_or_aac_route" }, expected_answer: { value: answer }, hints, explanation: rich, feedback: { correct: `Knowledge link verified. ${rich}`, try_again: `No timer and no lost progress. ${hints[0]}`, misconception: `The '${tag.replaceAll("_", " ")}' route does not fit the evidence. ${hints[1]}`, strategy: repair, context_check: "Use parts, grammar, discipline and purpose together; no single clue is automatically decisive.", register_check: "Select for fitness, not prestige; dialect and home language are not errors outside the stated purpose.", etymology_limit: "Word history shows patterns, but modern meaning needs context and a trusted current definition." }, gamification: { mission: missionFor(strand), objective: "Restore one knowledge-map link by justifying a precise meaning.", reward: `private_knowledge_node_${(index % 8) + 1}`, individual_progress_only: true, no_timer: true, no_lost_lives: true, no_streak_pressure: true, leaderboard: false, peer_comparison: false, replay_encouraged: true }, difficulty: { intro: 3, developing: 5, expected: 6, secure: 8, retrieval: 5 }[band], status: "review", misconception_tag: tag, animation_hook: hookFor(strand) };
}

function validateBank(currentPack, authored, candidates) {
  if (authored.length !== 5 || candidates.length !== 255 || currentPack.question_variants.length !== pilotTarget) throw new Error("Bank must contain 5 curated and 255 generated variants.");
  const blueprints = new Map(currentPack.variant_blueprints.map((b) => [b.id, b])), formats = new Set(currentPack.practice.formats), ids = new Set(), signatures = new Set(), coverage = new Set(), actualFormats = new Set(), actualBlueprints = new Set();
  for (const v of currentPack.question_variants) { if (ids.has(v.id)) throw new Error(`Duplicate id ${v.id}.`); ids.add(v.id); const s = `${v.format}|${normalise(v.body?.prompt)}|${JSON.stringify(v.expected_answer)}`; if (signatures.has(s)) throw new Error(`Duplicate signature ${v.id}.`); signatures.add(s); }
  for (const v of candidates) {
    const b = blueprints.get(v.body.variant_blueprint_id); if (!b || b.format !== v.format || b.difficulty_band !== v.body.difficulty_band || !formats.has(v.format) || v.status !== "review") throw new Error(`${v.id} has invalid blueprint, format or status.`);
    if (!v.body.interaction_support?.keyboard || !v.body.interaction_support?.switch_scan || !v.body.interaction_support?.eye_gaze || !v.body.interaction_support?.aac || v.body.interaction_support?.precision_drag_required !== false || !v.body.send_scaffolds?.line_focus || !v.body.static_alternative) throw new Error(`${v.id} lacks SEND support.`);
    if (v.body.timer_allowed || v.body.speed_score_allowed || v.body.leaderboard_allowed || v.body.peer_comparison_allowed || !v.feedback?.strategy || !v.feedback?.context_check || !v.feedback?.register_check || !v.feedback?.etymology_limit || v.explanation.length < 80) throw new Error(`${v.id} lacks feedback or pressure safeguards.`);
    if (v.body.audio_optional !== true || v.body.audio_provider !== "ElevenLabs" || v.body.audio_asset_status !== "required_human_listening_review" || v.body.human_listening_approval_required !== true || v.body.browser_tts_allowed !== false || v.body.browser_tts_fallback !== "prohibited") throw new Error(`${v.id} violates audio policy.`);
    if (!v.gamification?.individual_progress_only || !v.gamification?.no_timer || !v.gamification?.no_lost_lives || !v.gamification?.no_streak_pressure || v.gamification?.leaderboard || v.gamification?.peer_comparison) throw new Error(`${v.id} has unsuitable gamification.`);
    if (Array.isArray(v.expected_answer.value)) { if (v.format !== "discipline-context-sort" || v.expected_answer.value.length !== v.body.cards.length) throw new Error(`${v.id} has invalid structured answer.`); }
    else if (!Array.isArray(v.body.choices) || new Set(v.body.choices).size !== v.body.choices.length || v.body.choices.filter((x) => x === v.expected_answer.value).length !== 1) throw new Error(`${v.id} answer is not offered exactly once.`);
    for (const tag of v.body.coverage_tags) coverage.add(tag); actualFormats.add(v.format); actualBlueprints.add(v.body.variant_blueprint_id);
  }
  requireCoverage("content", new Set(["morphology", "context", "polysemy", "subject_specific_meanings", "register", "precise_use", "word_families", "etymology", "misconceptions"]), coverage); requireCoverage("formats", formats, actualFormats); requireCoverage("blueprints", new Set(blueprints.keys()), actualBlueprints);
  const allocation = countBy(candidates, (v) => v.body.variant_blueprint_id), expected = { "morpheme-meaning-builds": 44, "everyday-technical-context-sorts": 44, "discipline-purpose-sorters": 40, "visual-glossary-card-completions": 44, "precision-register-choices": 43, "disciplinary-vocabulary-retrieval": 40 };
  for (const [id, count] of Object.entries(expected)) if (allocation[id] !== count) throw new Error(`${id} expected ${count}, found ${allocation[id]}.`);
}

function mo(word, subject, sentence, parts, answer, wordClass, note) { return { word, subject, sentence, parts, answer, wordClass, note }; }
function po(word, uses) { return { word, uses }; }
function pu(word, subject, answer, nonexample) { return { word, subject, answer, nonexample }; }
function gl(word, subject, meaning, visual, example, nonexample) { return { word, subject, meaning, visual, example, nonexample }; }
function pr(key, subject, sentence, answer, distractors) { return { key, subject, sentence, answer, distractors }; }
function rt(key, prompt, answer, distractors, explanation, tag, coverage) { return { key, prompt, answer, distractors, explanation, tag, coverage }; }
function missionFor(s) { return ({ morphology: "Decode the Word-Part Archive", context: "Calibrate the Context Compass", polysemy: "Map the Many-Meaning Network", subject_specific_meanings: "Restore the Discipline Docks", register: "Tune the Precision Register", precise_use: "Repair the Exact-Meaning Lens", word_families: "Reconnect the Word-Family Tree", etymology: "Audit the Word-History Vault" })[s] ?? "Restore the Knowledge Atlas"; }
function hookFor(s) { return ({ morphology: "morpheme-tile-split", context: "context-clue-highlight", polysemy: "discipline-context-dock", subject_specific_meanings: "discipline-purpose-lock", register: "register-slider-fit", precise_use: "precision-word-fit", word_families: "word-family-branch", etymology: "etymology-context-bridge" })[s] ?? "knowledge-link-lock"; }
function cross(items, routeItems, builder) { const out = []; for (const item of items) for (const route of routeItems) out.push(builder(item, route, out.length)); return out; }
function requireCoverage(label, required, actual) { const missing = [...required].filter((x) => !actual.has(x)); if (missing.length) throw new Error(`Missing ${label}: ${missing.join(", ")}.`); }
function countBy(items, keyFor) { const counts = {}; for (const item of items) { const key = keyFor(item); counts[key] = (counts[key] ?? 0) + 1; } return counts; }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function summary(items, keyFor) { const counts = countBy(items, keyFor); return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
