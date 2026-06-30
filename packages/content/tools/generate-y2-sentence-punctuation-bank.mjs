#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/en-y2-writing-sentence-punctuation.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "en-y2-sentence-punctuation-bank-";
const reviewBatch = "y2-sentence-punctuation-pilot-a";
const pilotAllocation = {
  "capital-and-full-stop-builds": 36,
  "question-mark-meaning-choices": 36,
  "sentence-boundary-edits": 36,
  "mixed-storybook-review": 36,
  "low-sensory-sentence-choices": 36,
};

const statements = [
  sentence("dog-runs", "The dog runs.", "statement"), sentence("mina-gate", "Mina opens the gate.", "statement"),
  sentence("kite-park", "A red kite floats above the park.", "statement"), sentence("frog-pond", "The small frog jumps into the pond.", "statement"),
  sentence("class-seeds", "Our class planted three seeds.", "statement"), sentence("moon-roof", "The moon shines above the roof.", "statement"),
  sentence("train-station", "The train stops beside the station.", "statement"), sentence("fox-log", "A fox rests near the fallen log.", "statement"),
  sentence("rain-window", "Soft rain taps the window.", "statement"), sentence("boat-bridge", "The paper boat drifts under the bridge.", "statement"),
  sentence("library-open", "The library opens after lunch.", "statement"), sentence("bees-flowers", "Three bees visit the purple flowers.", "statement"),
  sentence("cat-sleep", "My cat is sleeping on the chair.", "statement"), sentence("children-path", "The children follow the winding path.", "statement"),
];

const questions = [
  sentence("where-hat", "Where is my red hat?", "question"), sentence("can-moon", "Can you see the moon?", "question"),
  sentence("why-gate", "Why is the gate open?", "question"), sentence("when-lunch", "When does lunch begin?", "question"),
  sentence("how-snail", "How did the snail cross the path?", "question"), sentence("who-bag", "Who left this blue bag?", "question"),
  sentence("what-box", "What is inside the box?", "question"), sentence("which-book", "Which book belongs on this shelf?", "question"),
  sentence("where-bus", "Where will the bus stop?", "question"), sentence("did-rain", "Did the rain fill the pond?", "question"),
  sentence("could-help", "Could you help me find the map?", "question"), sentence("how-many", "How many shells did Arun collect?", "question"),
];

const commands = [
  sentence("close-door", "Close the door.", "command"), sentence("pass-brush", "Please pass the brush.", "command"),
  sentence("book-shelf", "Put the book on the shelf.", "command"), sentence("walk-line", "Walk carefully to the line.", "command"),
  sentence("mix-flour", "Mix the flour and water.", "command"), sentence("take-card", "Take one card from the pile.", "command"),
  sentence("wash-hands", "Wash your hands before lunch.", "command"), sentence("circle-noun", "Circle the noun in the sentence.", "command"),
  sentence("open-box", "Open the small green box.", "command"), sentence("write-name", "Write your name on the label.", "command"),
];

const exclamations = [
  sentence("bright-star", "What a bright star it is!", "exclamation"), sentence("huge-pumpkin", "What a huge pumpkin that is!", "exclamation"),
  sentence("snow-falls", "How softly the snow falls!", "exclamation"), sentence("rabbit-runs", "How quickly the rabbit runs!", "exclamation"),
  sentence("tower-built", "What an enormous tower you built!", "exclamation"), sentence("garden-colourful", "How colourful the garden looks!", "exclamation"),
  sentence("tiny-seed", "What a tiny seed that is!", "exclamation"), sentence("owl-quiet", "How quietly the owl flies!", "exclamation"),
];

const allFunctions = [...statements, ...questions, ...commands, ...exclamations];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "en-y2-writing-sentence-punctuation") throw new Error("This generator only supports the Year 2 sentence-punctuation pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedCounts = countBy(curated, curatedBlueprint);
const targets = Object.fromEntries(Object.entries(pilotAllocation).map(([id, target]) => [id, target - (curatedCounts[id] ?? 0)]));
for (const [id, target] of Object.entries(targets)) if (target < 0) throw new Error(`Curated variants exceed the allocation for ${id}.`);

const generated = [
  ...statementBuildCandidates(targets["capital-and-full-stop-builds"]),
  ...questionChoiceCandidates(targets["question-mark-meaning-choices"]),
  ...boundaryEditCandidates(targets["sentence-boundary-edits"]),
  ...storybookCandidates(targets["mixed-storybook-review"]),
  ...lowSensoryCandidates(targets["low-sensory-sentence-choices"]),
];

pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Review-stage Year 2 sentence-punctuation pack with a deterministic 180-item pilot bank. Three curated variants are preserved alongside candidates covering sentence boundaries, capital starts, full stops, question marks, exclamation marks, statement/question/command/exclamation recognition and construction, word order, proofreading, short story transfer, dictation/application and misconception repair. Exclamation tasks use the Year 2 What/How clause pattern rather than treating every excited utterance as the sentence type. Generated tasks provide word and clause chunking, line focus, static sentence paths, symbol-supported function cues, non-drag interactions and rich boundary-specific feedback without timers or public speed measures. Audio is referenced only for listening and dictation tasks, uses ElevenLabs assets blocked pending human review, and never falls back to browser TTS. Independent English, SEND, narration, safeguarding and renderer review remains required before promotion.";

validateBank(pack, curated, generated);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y2-sentence-punctuation-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y2-sentence-punctuation-bank blueprints=${summary(pack.question_variants, assignedBlueprint)}`);
console.log(`y2-sentence-punctuation-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y2-sentence-punctuation-bank concepts=${summary(generated, (variant) => variant.body.concept_focus)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y2-sentence-punctuation-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 2 sentence-punctuation bank is out of date; run generate-y2-sentence-punctuation-bank.mjs --write.");
  console.log("y2-sentence-punctuation-bank deterministic check passed");
} else {
  console.log("y2-sentence-punctuation-bank dry-run; pass --write to update the pack");
}

function statementBuildCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = statements[index % statements.length];
    const words = tokenise(item.text);
    const lowerStart = lowerFirst(words[0]);
    const tiles = rotate(unique([words[0], lowerStart, ...words.slice(1, -1), ".", "?", "!"]), index % Math.max(1, words.length));
    return buildCandidate({
      id: `statement-build-${item.id}-${index + 1}`, blueprint: "capital-and-full-stop-builds", band: "intro", concept: index % 3 === 2 ? "statement_word_order" : "capital_full_stop_sentence_build",
      prompt: `Sentence-path mission ${index + 1}: build the telling sentence “${stripEnd(item.text)}”.`,
      body: { target_sentence: item.text, sentence_function: "statement", tiles, ordered_tiles: words, slots: ["capital_start", "word_order", "end_mark"], chunk_model: chunkSentence(item.text), interaction_mode: "tap_order_keyboard_switch_eye_gaze_or_direct_adult_tiles" }, expected: words,
      hints: ["Put the capitalised first word at the start gate.", "Keep the words in meaning order and close the statement with a full stop."], explanation: `${item.text} begins with a capital letter, keeps a clear word order and ends with a full stop because it is a statement.`, difficulty: 2 + Math.floor(index / statements.length), tag: index % 3 === 2 ? "word_order_scrambled" : "missing_end_mark", hook: "sentence-path-build",
      correct: "Statement built from capital start to full-stop end gate.", repair: "Keep any correct word sequence, mark WHO/WHAT then WHAT HAPPENS, and add the capital and full stop only at the boundaries.",
    });
  });
}

function questionChoiceCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = questions[index % questions.length];
    const round = Math.floor(index / questions.length);
    const unpunctuated = stripEnd(item.text);
    const choices = rotate(["?", ".", "!"], index % 3);
    return choiceCandidate({
      id: `question-mark-${item.id}-${index + 1}`, blueprint: "question-mark-meaning-choices", band: "developing", concept: round % 2 === 0 ? "question_mark_by_meaning" : "question_statement_discrimination",
      prompt: `Asking-gate mission ${index + 1}: choose the end mark for “${unpunctuated}”`,
      body: { sentence_text: unpunctuated, sentence_function: "question", choices, asking_word: firstWord(item.text), meaning_cue: "the sentence asks for an answer", chunk_model: chunkSentence(item.text), interaction_mode: "tap_mark_keyboard_switch_eye_gaze_or_say_mark", ...audioForSentence(item.text, "listening_supports_question_meaning") }, answer: "?",
      hints: ["Ask what the sentence is doing, not only how the voice sounds.", "A sentence that asks something ends with a question mark."], explanation: `${item.text} asks something, so it ends with a question mark. The asking meaning is decisive; reviewed audio is optional support.`, difficulty: 3 + (round % 2), tag: "full_stop_for_question", hook: "asking-gate-choice",
      correct: "Question meaning matched to a question mark.", repair: "Highlight the asking word or verb, replay the reviewed sentence if available, and compare only question mark versus full stop.",
    });
  });
}

function boundaryEditCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = allFunctions[(index * 5 + 2) % allFunctions.length];
    const mode = index % 4;
    const broken = breakSentence(item, mode);
    const edits = editTargets(item, mode);
    return editCandidate({
      id: `boundary-edit-${item.id}-${mode}-${index + 1}`, blueprint: "sentence-boundary-edits", band: "expected", concept: mode === 2 ? "punctuation_position_repair" : mode === 3 ? "word_order_and_boundary_edit" : "capital_and_end_mark_proofreading",
      prompt: `Punctuation repair ${index + 1}: fix “${broken}”`,
      body: { source_text: broken, target_text: item.text, sentence_function: item.function, edit_targets: edits, end_mark_options: [".", "?", "!"], word_order_model: tokenise(item.text).slice(0, -1), chunk_model: chunkSentence(item.text), interaction_mode: "tap_replace_keyboard_switch_choose_corrected_sentence_or_adult_scribed" }, expected: item.text,
      hints: [functionHint(item.function), "Check the capital start, complete word order and one end mark at the sentence boundary."], explanation: `${item.text} is the repaired ${item.function}. ${boundaryExplanation(item)}`, difficulty: 4 + (mode === 3 ? 1 : 0), tag: mode === 2 ? "punctuation_after_every_word" : mode === 3 ? "word_order_scrambled" : "missing_end_mark", hook: "punctuation-repair-shop",
      correct: `Sentence repaired: ${item.text}`, repair: "Use three passes: read the complete idea, repair word order, then inspect only the start and end gates.",
    });
  });
}

function storybookCandidates(count) {
  const pairs = [
    [statements[1], questions[0]], [statements[3], commands[2]], [questions[6], statements[0]], [commands[6], statements[4]],
    [exclamations[0], statements[5]], [statements[8], exclamations[2]], [questions[9], commands[0]], [commands[4], questions[3]],
    [statements[11], questions[5]], [exclamations[4], commands[5]], [statements[12], questions[10]], [commands[8], exclamations[6]],
  ];
  return Array.from({ length: count }, (_, index) => {
    const [first, second] = pairs[index % pairs.length];
    const round = Math.floor(index / pairs.length);
    const target = `${first.text} ${second.text}`;
    const broken = storyBreak(first, second, index % 4);
    return editCandidate({
      id: `storybook-${first.id}-${second.id}-${index + 1}`, blueprint: "mixed-storybook-review", band: "retrieval", concept: index % 3 === 0 ? "two_sentence_boundary_transfer" : index % 3 === 1 ? "mixed_function_proofreading" : "misconception_repair_transfer",
      prompt: `Storybook check ${index + 1}: repair the two-sentence extract “${broken}”`,
      body: { source_text: broken, target_text: target, sentence_functions: [first.function, second.function], sentence_chunks: [chunkSentence(first.text), chunkSentence(second.text)], edit_targets: ["boundary_between_sentences", "capital_starts", "end_marks"], comprehension_not_assessed: true, review_interval_days: reviewDay(index), interaction_mode: "tap_boundaries_choose_corrected_extract_keyboard_switch_or_adult_scribed" }, expected: target,
      hints: ["Find where the first complete idea ends and the second begins.", "Check each sentence function before choosing its end mark."], explanation: `The corrected extract is ${target} Each complete idea has its own capital start and suitable end mark.`, difficulty: 4 + (round % 2), tag: index % 3 === 2 ? "punctuation_after_every_word" : "run_on_sentences", hook: "storybook-boundary-check",
      correct: "Two complete sentence paths repaired in the storybook extract.", repair: "Cover the second idea, repair the first sentence fully, then uncover and repair the second without a timer.",
    });
  });
}

function lowSensoryCandidates(count) {
  const modes = ["function", "construction", "dictation", "word_order", "repair", "transfer"];
  return Array.from({ length: count }, (_, index) => {
    const mode = modes[index % modes.length];
    if (mode === "dictation") return dictationCandidate(index);
    if (mode === "word_order") return wordOrderChoice(index);
    if (mode === "repair") return misconceptionChoice(index);
    if (mode === "construction") return constructionChoice(index);
    if (mode === "transfer") return transferChoice(index);
    return functionChoice(index);
  });
}

function functionChoice(index) {
  const item = allFunctions[(index * 7 + 3) % allFunctions.length];
  const choices = rotate([item.function, ...["statement", "question", "command", "exclamation"].filter((value) => value !== item.function).slice(0, 3)], index % 4);
  return choiceCandidate({
    id: `static-function-${item.id}-${index + 1}`, blueprint: "low-sensory-sentence-choices", band: "mixed", concept: "sentence_function_recognition",
    prompt: `Quiet function mission ${index + 1}: is “${item.text}” a statement, question, command or exclamation?`, body: { sentence_text: item.text, choices, static_function_cues: functionCues(item.function), exclamation_definition: "Year 2 exclamations in this bank begin What or How and contain a full clause", interaction_mode: "tap_choice_keyboard_switch_eye_gaze_or_aac" }, answer: item.function,
    hints: [functionHint(item.function), "Use the sentence meaning and structure, then check the end mark."], explanation: `${item.text} is a ${item.function}. ${functionExplanation(item.function)}`, difficulty: 4, tag: "end_mark_alone_names_function", hook: "quiet-function-cards",
    correct: `Sentence function recognised: ${item.function}.`, repair: "Use one static cue card for tells, asks, directs or exclaims, then reread the whole clause.",
  });
}

function constructionChoice(index) {
  const typeOrder = ["statement", "question", "command", "exclamation"];
  const type = typeOrder[Math.floor(index / 6) % typeOrder.length];
  const source = sourceFor(type)[index % sourceFor(type).length];
  const correct = source.text;
  const choices = rotate([correct, wrongMark(source), lowerFirstSentence(correct), scrambledSentence(correct)], index % 4);
  return choiceCandidate({
    id: `static-construct-${source.id}-${index + 1}`, blueprint: "low-sensory-sentence-choices", band: "mixed", concept: "sentence_function_construction",
    prompt: `Quiet construction ${index + 1}: which choice is a complete ${type}?`, body: { target_function: type, choices, function_cues: functionCues(type), chunk_model: chunkSentence(correct), interaction_mode: "choose_complete_sentence_keyboard_switch_or_point" }, answer: correct,
    hints: [functionHint(type), "Check capital, word order and the suitable end mark."], explanation: `${correct} is a complete ${type} with a capital start, coherent order and suitable ending.`, difficulty: 4, tag: "function_and_mark_mismatch", hook: "quiet-construction-cards",
    correct: `Complete ${type} selected and checked.`, repair: "Compare only two static choices, highlight the function cue and inspect the start and end boundaries.",
  });
}

function dictationCandidate(index) {
  const item = allFunctions[(index * 5 + 1) % allFunctions.length];
  const correct = item.text;
  const choices = rotate([correct, lowerFirstSentence(correct), wrongMark(item), punctuationEveryWord(correct)], index % 4);
  return choiceCandidate({
    id: `static-dictation-${item.id}-${index + 1}`, blueprint: "low-sensory-sentence-choices", band: "mixed", concept: "dictation_application",
    prompt: `Dictation mission ${index + 1}: hear the reviewed sentence, then choose the exact written sentence.`, body: { target_sentence: correct, sentence_function: item.function, choices, chunk_model: chunkSentence(correct), handwriting_required: false, interaction_mode: "listen_choose_keyboard_switch_eye_gaze_or_adult_scribed", ...audioForSentence(correct, "dictation_requires_hearing") }, answer: correct,
    hints: ["Listen once for meaning and again for the complete sentence.", "Check word order, capital start and the end mark."], explanation: `${correct} matches the reviewed dictation and has the correct boundaries for a ${item.function}.`, difficulty: 4, tag: "dictation_boundary_omitted", hook: "quiet-dictation-path",
    correct: "Dictated sentence matched word for word and boundary for boundary.", repair: "Replay by phrase, keep the printed chunks static and compare one difference at a time; no handwriting or microphone is required.",
  });
}

function wordOrderChoice(index) {
  const item = [...statements, ...commands][(index * 3 + 2) % (statements.length + commands.length)];
  const correct = item.text;
  const choices = rotate([correct, scrambledSentence(correct), lowerFirstSentence(correct), wrongMark(item)], index % 4);
  return choiceCandidate({
    id: `static-order-${item.id}-${index + 1}`, blueprint: "low-sensory-sentence-choices", band: "mixed", concept: "word_order_transfer",
    prompt: `Word-order mission ${index + 1}: which choice makes one clear ${item.function}?`, body: { target_function: item.function, choices, who_what_chunk: chunkSentence(correct)[0], happens_chunk: chunkSentence(correct)[1], interaction_mode: "choose_order_use_chunk_cards_keyboard_switch_or_aac" }, answer: correct,
    hints: ["Find who or what first, then what happens or what to do.", "Finish by checking the capital and end mark."], explanation: `${correct} puts the words in a clear order and closes the ${item.function} correctly.`, difficulty: 4, tag: "word_order_scrambled", hook: "quiet-word-order",
    correct: "Word order and sentence boundaries checked together.", repair: "Place WHO/WHAT and WHAT HAPPENS chunks first, then add boundary marks after the meaning is complete.",
  });
}

function misconceptionChoice(index) {
  const cases = [
    ["A capital letter is enough; an end mark is optional.", "A complete written sentence needs a capital start and a suitable end mark.", "missing_end_mark"],
    ["Every sentence should end with a full stop.", "Questions need question marks, while statements and most commands use full stops; Year 2 exclamations use exclamation marks.", "full_stop_for_question"],
    ["Put punctuation after every word.", "Keep the words together as one complete idea and place the end mark at its boundary.", "punctuation_after_every_word"],
    ["Any excited sentence is an exclamation sentence.", "In these Year 2 tasks, an exclamation begins What or How and contains a full clause.", "exclamation_definition_confusion"],
    ["A question mark is chosen only from a rising voice.", "Use the asking meaning and sentence structure; audio intonation is support, not the only evidence.", "intonation_only_question"],
  ];
  const [claim, answer, tag] = cases[Math.floor(index / 6) % cases.length];
  const choices = rotate([answer, "The claim is always correct.", "Choose the mark that looks most exciting."], index % 3);
  return choiceCandidate({
    id: `static-repair-${slug(tag)}-${index + 1}`, blueprint: "low-sensory-sentence-choices", band: "mixed", concept: "punctuation_misconception_repair",
    prompt: `Idea-repair mission ${index + 1}: “${claim}” Which response is accurate?`, body: { misconception_claim: claim, choices, interaction_mode: "choose_repair_keyboard_switch_aac_or_teach_back" }, answer,
    hints: ["Check start, meaning and end boundary.", "Choose the response that explains where and why punctuation is used."], explanation: answer, difficulty: 4, tag, hook: "quiet-idea-repair",
    correct: "Punctuation misconception repaired with a boundary or function rule.", repair: "Use a static start gate, function card and end gate to test the claim on one sentence.",
  });
}

function transferChoice(index) {
  const item = allFunctions[(index * 11 + 4) % allFunctions.length];
  const context = `Pip writes: ${lowerFirst(stripEnd(item.text))}`;
  const correct = item.text;
  const choices = rotate([correct, lowerFirstSentence(correct), wrongMark(item), punctuationEveryWord(correct)], index % 4);
  return choiceCandidate({
    id: `static-transfer-${item.id}-${index + 1}`, blueprint: "low-sensory-sentence-choices", band: "mixed", concept: "sentence_punctuation_transfer",
    prompt: `Transfer mission ${index + 1}: ${context}. Which edit is ready for the class book?`, body: { source_text: lowerFirst(stripEnd(item.text)), target_function: item.function, choices, application_context: "class book", interaction_mode: "choose_edit_keyboard_switch_eye_gaze_or_adult_scribed" }, answer: correct,
    hints: [functionHint(item.function), "Check the complete idea, capital start and suitable end mark."], explanation: `${correct} transfers the sentence-boundary and function rules into a new writing context.`, difficulty: 4, tag: "boundary_rule_not_transferred", hook: "quiet-transfer-page",
    correct: "Sentence punctuation transferred into the class-book context.", repair: "Use the same three-step check: complete idea, capital start, function-matched end mark.",
  });
}

function buildCandidate({ id, blueprint, band, concept, prompt, body, expected, hints, explanation, difficulty, tag, hook, correct, repair }) {
  const fullId = `${prefix}${id}`;
  return commonCandidate({ id: fullId, format: "sentence-build", blueprint, band, concept, prompt, body, expected: { value: expected }, hints, explanation, difficulty, tag, hook, correct, repair });
}

function choiceCandidate({ id, blueprint, band, concept, prompt, body, answer, hints, explanation, difficulty, tag, hook, correct, repair }) {
  const fullId = `${prefix}${id}`;
  return commonCandidate({ id: fullId, format: "tap-choice", blueprint, band, concept, prompt, body, expected: { value: answer }, hints, explanation, difficulty, tag, hook, correct, repair });
}

function editCandidate({ id, blueprint, band, concept, prompt, body, expected, hints, explanation, difficulty, tag, hook, correct, repair }) {
  const fullId = `${prefix}${id}`;
  return commonCandidate({ id: fullId, format: "punctuation-edit", blueprint, band, concept, prompt, body, expected: { value: expected }, hints, explanation, difficulty, tag, hook, correct, repair });
}

function commonCandidate({ id, format, blueprint, band, concept, prompt, body, expected, hints, explanation, difficulty, tag, hook, correct, repair }) {
  return {
    id,
    format,
    body: {
      prompt, ...body,
      concept_focus: concept,
      response_mode: "tap_drag_keyboard_switch_eye_gaze_aac_oral_or_adult_scribed",
      supported_interaction: "adult_or_peer_may read scan position tiles and record without supplying the punctuation answer",
      dyslexia_support: { sentence_chunking: true, one_sentence_per_panel: true, generous_spacing: true, line_focus: true, adjustable_font_and_background: true, punctuation_shape_labels: true, colour_not_required: true },
      visual_route: "static start gate, meaning or function card, word/clause chunks and end-mark gate",
      phonological_route: "optional oral rehearsal of the complete sentence without requiring speech recording",
      motor_alternative: "tap, keyboard, switch, eye-gaze, verbal tile order or adult-scribed response can replace dragging and handwriting",
      reduced_motion: "instant_placement_and_static_focus_outlines",
      no_timer: true,
      speed_score_allowed: false,
      microphone_required: false,
      retry_without_penalty: true,
      preserve_correct_words_and_boundaries: true,
      gamification: { mission: "repair a sentence path, asking gate or storybook page", reward: "one calm story-spark for a checked boundary or sentence function", loss_on_error: false, streak_pressure: false, leaderboard: false, speed_bonus: false, retry_message: "Your correct words and marks stay. Open another clue and continue." },
      difficulty_band: band,
      evidence_purpose: blueprint.replaceAll("-", "_"),
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
    },
    expected_answer: expected,
    hints,
    explanation,
    feedback: { correct, repair, boundary_evidence: explanation, support_message: "Chunking, pointing, tile order and adult-scribed edits carry equal evidence; speed, handwriting and speech production are not scored." },
    difficulty,
    status: "review",
    misconception_tag: tag,
    animation_hook: hook,
  };
}

function validateBank(currentPack, authored, generated) {
  if (authored.length !== 3) throw new Error(`Expected exactly 3 curated variants, found ${authored.length}. Refusing to overwrite possible authored work.`);
  if (currentPack.question_variants.length !== currentPack.practice.variant_targets.pilot) throw new Error(`Expected ${currentPack.practice.variant_targets.pilot} variants, found ${currentPack.question_variants.length}.`);
  const blueprints = new Map(currentPack.variant_blueprints.map((blueprint) => [blueprint.id, blueprint]));
  const ids = new Set();
  const signatures = new Set();
  for (const variant of currentPack.question_variants) {
    if (ids.has(variant.id)) throw new Error(`Duplicate id ${variant.id}.`);
    ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${JSON.stringify(variant.expected_answer)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`);
    signatures.add(signature);
  }
  for (const variant of generated) {
    const blueprint = blueprints.get(variant.body.variant_blueprint_id);
    if (!blueprint || variant.format !== blueprint.format) throw new Error(`${variant.id} does not match its blueprint format.`);
    if (blueprint.difficulty_band !== "mixed" && variant.body.difficulty_band !== blueprint.difficulty_band) throw new Error(`${variant.id} uses the wrong difficulty band.`);
    if (blueprint.difficulty_band === "mixed" && variant.body.difficulty_band !== "mixed") throw new Error(`${variant.id} must use the mixed band.`);
    if (variant.status !== "review" || variant.body.review_batch !== reviewBatch) throw new Error(`${variant.id} must remain in review.`);
    if (!variant.body.dyslexia_support?.sentence_chunking || !variant.body.dyslexia_support?.line_focus || !variant.body.visual_route || !variant.body.motor_alternative || !variant.body.supported_interaction) throw new Error(`${variant.id} lacks SEND support.`);
    if (!variant.body.response_mode.includes("keyboard") || !variant.body.response_mode.includes("switch") || !variant.body.response_mode.includes("eye_gaze") || !variant.body.response_mode.includes("aac")) throw new Error(`${variant.id} lacks supported responses.`);
    if (variant.body.no_timer !== true || variant.body.speed_score_allowed !== false || variant.body.microphone_required !== false || variant.body.gamification?.streak_pressure !== false || variant.body.gamification?.loss_on_error !== false) throw new Error(`${variant.id} introduces pressure.`);
    if (!variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.boundary_evidence || !variant.feedback?.support_message) throw new Error(`${variant.id} lacks rich feedback.`);
    if (variant.body.audio_required) {
      if (variant.body.audio_provider !== "ElevenLabs" || variant.body.audio_asset_status !== "required_human_listening_review" || variant.body.human_listening_approval_required !== true || variant.body.browser_tts_allowed !== false || variant.body.browser_tts_fallback !== "prohibited") throw new Error(`${variant.id} violates reviewed-audio policy.`);
    } else if (variant.body.audio_asset_id) {
      throw new Error(`${variant.id} references audio where hearing is not useful.`);
    }
    if (variant.format === "sentence-build") {
      if (!Array.isArray(variant.expected_answer.value) || variant.expected_answer.value.length < 3 || !Array.isArray(variant.body.tiles)) throw new Error(`${variant.id} has an invalid sentence build.`);
    } else if (variant.format === "tap-choice") {
      if (!Array.isArray(variant.body.choices) || variant.body.choices.length < 3 || new Set(variant.body.choices).size !== variant.body.choices.length || !variant.body.choices.includes(variant.expected_answer.value)) throw new Error(`${variant.id} has invalid choices.`);
    } else if (typeof variant.expected_answer.value !== "string" || !Array.isArray(variant.body.edit_targets)) {
      throw new Error(`${variant.id} has an invalid edit key.`);
    }
    if (variant.body.prompt.length > 190) throw new Error(`${variant.id} prompt is too long for Year 2.`);
  }
  const allocation = countBy(currentPack.question_variants, assignedBlueprint);
  for (const [id, expected] of Object.entries(pilotAllocation)) if (allocation[id] !== expected) throw new Error(`${id} expected ${expected}, found ${allocation[id] ?? 0}.`);
  const concepts = new Set(generated.map((variant) => variant.body.concept_focus));
  for (const concept of ["capital_full_stop_sentence_build", "statement_word_order", "question_mark_by_meaning", "capital_and_end_mark_proofreading", "punctuation_position_repair", "word_order_and_boundary_edit", "two_sentence_boundary_transfer", "sentence_function_recognition", "sentence_function_construction", "dictation_application", "word_order_transfer", "punctuation_misconception_repair", "sentence_punctuation_transfer"]) if (!concepts.has(concept)) throw new Error(`Missing concept ${concept}.`);
  for (const functionName of ["statement", "question", "command", "exclamation"]) if (!generated.some((variant) => variant.body.sentence_function === functionName || variant.body.target_function === functionName || variant.expected_answer.value === functionName || variant.body.sentence_functions?.includes(functionName))) throw new Error(`Missing ${functionName} coverage.`);
}

function curatedBlueprint(variant) { const map = { "en-y2-writing-sentence-punctuation-q-build-dog": "capital-and-full-stop-builds", "en-y2-writing-sentence-punctuation-q-question-hat": "question-mark-meaning-choices", "en-y2-writing-sentence-punctuation-q-edit-cat": "sentence-boundary-edits" }; const value = map[variant.id]; if (!value) throw new Error(`No curated blueprint assignment for ${variant.id}.`); return value; }
function assignedBlueprint(variant) { return variant.body?.variant_blueprint_id ?? curatedBlueprint(variant); }
function sentence(id, text, functionName) { return { id, text, function: functionName }; }
function sourceFor(type) { return { statement: statements, question: questions, command: commands, exclamation: exclamations }[type]; }
function tokenise(text) { const mark = text.at(-1); const words = text.slice(0, -1).split(" "); return [...words, mark]; }
function stripEnd(text) { return text.replace(/[.?!]$/, ""); }
function firstWord(text) { return stripEnd(text).split(" ")[0]; }
function lowerFirst(value) { return value.charAt(0).toLowerCase() + value.slice(1); }
function lowerFirstSentence(text) { return lowerFirst(text); }
function chunkSentence(text) { const words = stripEnd(text).split(" "); const pivot = Math.max(1, Math.ceil(words.length / 2)); return [words.slice(0, pivot).join(" "), words.slice(pivot).join(" "), text.at(-1)].filter(Boolean); }
function wrongMark(item) { const wrong = item.function === "question" ? "." : item.function === "exclamation" ? "?" : "!"; return `${stripEnd(item.text)}${wrong}`; }
function scrambledSentence(text) { const words = stripEnd(text).split(" "); if (words.length < 3) return `${words.reverse().join(" ")}${text.at(-1)}`; const scrambled = [words[1], words[0], ...words.slice(2)]; return `${scrambled.join(" ")}${text.at(-1)}`; }
function punctuationEveryWord(text) { return `${stripEnd(text).split(" ").join(". ")}${text.at(-1)}`; }
function breakSentence(item, mode) { const plain = stripEnd(item.text); if (mode === 0) return lowerFirst(plain); if (mode === 1) return plain; if (mode === 2) return plain.split(" ").join(". "); return lowerFirst(scrambledSentence(item.text).slice(0, -1)); }
function editTargets(item, mode) { if (mode === 0) return ["capital_start", "end_mark"]; if (mode === 1) return ["end_mark"]; if (mode === 2) return ["remove_internal_end_marks", "add_boundary_end_mark"]; return ["word_order", "capital_start", "end_mark"]; }
function storyBreak(first, second, mode) { if (mode === 0) return `${stripEnd(first.text)} ${lowerFirst(second.text)}`; if (mode === 1) return `${lowerFirst(stripEnd(first.text))} ${stripEnd(second.text)}`; if (mode === 2) return `${first.text} ${lowerFirst(stripEnd(second.text))}`; return `${stripEnd(first.text).split(" ").join(". ")} ${lowerFirst(stripEnd(second.text))}`; }
function functionHint(functionName) { return { statement: "A statement tells something and usually ends with a full stop.", question: "A question asks something and ends with a question mark.", command: "A command tells someone what to do and usually ends with a full stop.", exclamation: "In these Year 2 tasks, an exclamation begins What or How, contains a full clause and ends with an exclamation mark." }[functionName]; }
function functionExplanation(functionName) { return { statement: "It tells something.", question: "It asks something.", command: "It directs someone to act.", exclamation: "It begins What or How and expresses the exclamation as a full clause." }[functionName]; }
function functionCues(functionName) { return { statement: ["tells", "full stop"], question: ["asks", "question mark"], command: ["directs", "imperative verb", "usually full stop"], exclamation: ["What/How opening", "full clause", "exclamation mark"] }[functionName]; }
function boundaryExplanation(item) { return `It starts with a capital and ends with ${item.function === "question" ? "a question mark" : item.function === "exclamation" ? "an exclamation mark" : "a full stop"}.`; }
function audioForSentence(text, purpose) { return { audio_required: true, audio_purpose: purpose, audio_asset_id: `sentence-${slug(stripEnd(text))}`, audio_provider: "ElevenLabs", audio_asset_status: "required_human_listening_review", human_listening_approval_required: true, browser_tts_allowed: false, browser_tts_fallback: "prohibited", unavailable_audio_state: "honest_not_ready_text_and_visual_routes_remain", audio_replay_unlimited: true }; }
function reviewDay(index) { return [1, 3, 7, 14, 30][index % 5]; }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function unique(items) { return [...new Set(items)]; }
function slug(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function normalise(value) { return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " "); }
function countBy(items, keyFor) { const result = {}; for (const item of items) { const key = keyFor(item); result[key] = (result[key] ?? 0) + 1; } return result; }
function summary(items, keyFor) { return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
