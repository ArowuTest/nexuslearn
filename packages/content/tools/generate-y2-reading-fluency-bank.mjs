#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/en-y2-reading-fluency-reread.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "en-y2-reading-fluency-reread-bank-";
const reviewBatch = "y2-reading-fluency-pilot-a";
const pilotAllocation = {
  "model-listen-follow": 39,
  "phrase-chunk-practice": 43,
  "accuracy-not-speed-checks": 39,
  "reread-confidence-reflections": 30,
  "fluency-retrieval-phrases": 29,
};

const passages = [
  passage("boat", "The small boat rocked on the pond.", ["The small boat", "rocked on the pond."], "small", "tall", "Where did the boat rock?", "on the pond", ["under the bed", "at the station"], "Use a calm statement voice and stop at the full stop."),
  passage("rabbit", "After lunch, Mina fed the rabbit.", ["After lunch,", "Mina fed the rabbit."], "lunch", "school", "When did Mina feed the rabbit?", "after lunch", ["before breakfast", "at night"], "Make a short pause at the comma, then finish the statement."),
  passage("park-question", "Can you see the swings in the park?", ["Can you see", "the swings in the park?"], "swings", "boats", "What is the speaker asking about?", "the swings", ["a rabbit", "a train"], "Use a questioning voice and notice the question mark."),
  passage("puddle", "Watch out for the deep puddle!", ["Watch out", "for the deep puddle!"], "deep", "blue", "What warning is given?", "watch out for the puddle", ["feed the rabbit", "open the window"], "Use a clear warning voice and notice the exclamation mark."),
  passage("rain", "When the rain stopped, the children ran outside.", ["When the rain stopped,", "the children ran outside."], "stopped", "started", "What happened after the rain stopped?", "the children ran outside", ["the bus arrived", "the lights went out"], "Pause at the comma and keep the rest of the sentence together."),
  passage("bread", "Dad put the warm bread on the table.", ["Dad put the warm bread", "on the table."], "warm", "cold", "Where did Dad put the bread?", "on the table", ["in the pond", "under the tree"], "Use a calm statement voice and stop at the full stop."),
  passage("owl", "At night, the brown owl flew over the field.", ["At night,", "the brown owl flew", "over the field."], "brown", "green", "When did the owl fly?", "at night", ["after lunch", "on Saturday morning"], "Pause at the comma and group the action with where it happened."),
  passage("frog", "The little frog jumped over the wet log.", ["The little frog", "jumped over the wet log."], "over", "under", "What did the frog jump over?", "the wet log", ["the red bus", "the warm bread"], "Keep the action words together and stop at the full stop."),
  passage("sunny-park", "We went to the park because the sun was shining.", ["We went to the park", "because the sun was shining."], "because", "before", "Why did they go to the park?", "the sun was shining", ["the rain was heavy", "it was bedtime"], "Join the reason smoothly to the first part of the sentence."),
  passage("packed-bag", "First, Sam packed a drink and a map.", ["First,", "Sam packed a drink and a map."], "map", "coat", "What two things did Sam pack?", "a drink and a map", ["a kite and a ball", "bread and a scarf"], "Pause after First, then read the list smoothly."),
  passage("bus", "The red bus waited beside the school gate.", ["The red bus", "waited beside the school gate."], "beside", "inside", "Where did the bus wait?", "beside the school gate", ["under the pond", "above the clouds"], "Keep the place phrase together and stop at the full stop."),
  passage("puppy", "The sleepy puppy curled up on its soft bed.", ["The sleepy puppy", "curled up", "on its soft bed."], "sleepy", "noisy", "Where did the puppy curl up?", "on its soft bed", ["on the bus", "by the pond"], "Group who, what happened and where into smooth chunks."),
  passage("scarf-question", "Where is my blue scarf?", ["Where is", "my blue scarf?"], "blue", "red", "What is missing?", "a blue scarf", ["a silver key", "a green frog"], "Use a questioning voice and notice the question mark."),
  passage("castle", "What a huge sandcastle!", ["What a huge", "sandcastle!"], "huge", "tiny", "What does the speaker notice?", "a huge sandcastle", ["a small boat", "a dark sky"], "Use an amazed voice without rushing the words."),
  passage("bedtime", "Before bed, Asha chose a short story.", ["Before bed,", "Asha chose a short story."], "short", "long", "What did Asha choose?", "a short story", ["a warm coat", "a blue cup"], "Pause at the comma, then read the action as one chunk."),
  passage("moon", "The bright moon shone through the window.", ["The bright moon", "shone through the window."], "through", "under", "Where did the moon shine?", "through the window", ["inside the bag", "over the log"], "Keep the place phrase together and stop at the full stop."),
  passage("gate", "Ravi opened the gate and waved to his friend.", ["Ravi opened the gate", "and waved to his friend."], "waved", "whispered", "What else did Ravi do after opening the gate?", "he waved to his friend", ["he fed the rabbit", "he packed a map"], "Join the two actions smoothly around and."),
  passage("train", "The old train puffed slowly up the hill.", ["The old train", "puffed slowly", "up the hill."], "slowly", "quickly", "How did the train move?", "slowly", ["silently", "sideways"], "Use the chunks to make the movement sound steady."),
  passage("museum", "On Saturday, our family visited the museum.", ["On Saturday,", "our family visited the museum."], "Saturday", "Monday", "When did the family visit?", "on Saturday", ["at night", "before lunch"], "Pause after the opening time phrase."),
  passage("red-book", "Please put the red book back on the shelf.", ["Please put", "the red book", "back on the shelf."], "shelf", "floor", "Where should the book go?", "back on the shelf", ["into the pond", "under the bus"], "Read the request clearly and keep the place words together."),
  passage("bell", "When the bell rang, everyone walked into class.", ["When the bell rang,", "everyone walked into class."], "walked", "jumped", "What did everyone do when the bell rang?", "walked into class", ["ran to the pond", "opened a parcel"], "Pause at the comma and read the second chunk smoothly."),
];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "en-y2-reading-fluency-reread") throw new Error("This generator only supports the Year 2 reading fluency pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedAllocation = countBy(curated, curatedBlueprint);
const targets = Object.fromEntries(Object.entries(pilotAllocation).map(([blueprint, total]) => [blueprint, total - (curatedAllocation[blueprint] ?? 0)]));
for (const [blueprint, count] of Object.entries(targets)) if (count < 0) throw new Error(`Curated items exceed ${blueprint}.`);

const candidates = [
  ...modelCandidates(targets["model-listen-follow"]),
  ...phraseCandidates(targets["phrase-chunk-practice"]),
  ...accuracyCandidates(targets["accuracy-not-speed-checks"]),
  ...confidenceCandidates(targets["reread-confidence-reflections"]),
  ...retrievalCandidates(targets["fluency-retrieval-phrases"]),
];

const enrichedCurated = curated.map(enrichVariant);
const enrichedCandidates = candidates.map(enrichVariant);
pack.question_variants = [...enrichedCurated, ...enrichedCandidates];
pack.version = "0.2.0";
pack.qa.notes = "Review-stage Year 2 fluency pack with a deterministic 180-item pilot bank covering model following, accuracy, phrase chunking, punctuation-led expression, repeated reading, comprehension and self-monitoring. There are no speed scores, timers or leaderboards. Optional narration requires ElevenLabs production and human listening approval; browser TTS is prohibited. Independent English, SEND, audio, safeguarding and renderer review remain required before promotion.";
validateBank(pack, enrichedCurated, enrichedCandidates);

const blueprintById = new Map(pack.variant_blueprints.map((blueprint) => [blueprint.id, blueprint]));
console.log(`y2-fluency-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`y2-fluency-bank blueprints=${allocationSummary(curated, candidates)}`);
console.log(`y2-fluency-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y2-fluency-bank bands=${bandSummary(curated, candidates, blueprintById)}`);
console.log(`y2-fluency-bank interactions=${summary(candidates, (variant) => variant.body.interaction_mode)}`);

const nextText = `${JSON.stringify(pack, null, 2)}\n`;
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y2-fluency-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 2 reading fluency bank is out of date; run generate-y2-reading-fluency-bank.mjs --write.");
  console.log("y2-fluency-bank deterministic check passed");
} else {
  console.log("y2-fluency-bank dry-run; pass --write to update the pack");
}

function modelCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = passages[index % 20];
    const round = Math.floor(index / 20);
    if (round === 0) {
      const choices = rotate([item.text, omitWord(item.text, item.focus), replaceWord(item.text, item.focus, item.wrong)], index % 3);
      return candidate({
        id: `${prefix}model-follow-${item.id}`,
        format: "listen-read",
        blueprint: "model-listen-follow",
        band: "intro",
        prompt: "Listen to the approved model, follow each word, then choose the sentence that matches every word.",
        body: { target_text: item.text, choices, chunks: item.chunks, interaction_mode: "listen-follow-accurate-text" },
        answer: item.text,
        hints: ["Use line focus and replay one chunk at a time.", `Check the word '${item.focus}' as well as the sentence ending.`],
        explanation: `This choice keeps every word and punctuation mark from the model: ${item.text}`,
        difficulty: 2,
        tag: "speed_over_accuracy",
        hook: "word-follow-highlight",
        repair: "Slow the highlight, replay one chunk and point to each word before choosing again.",
      });
    }
    const choices = rotate([item.meaningAnswer, ...item.meaningDistractors], index % 3);
    return candidate({
      id: `${prefix}model-meaning-${item.id}`,
      format: "listen-read",
      blueprint: "model-listen-follow",
      band: "intro",
      prompt: `Listen, follow and reread: '${item.text}' ${item.meaningQuestion}`,
      body: { target_text: item.text, choices, chunks: item.chunks, interaction_mode: "model-reread-meaning-check" },
      answer: item.meaningAnswer,
      hints: ["Replay the chunk that holds the answer.", "Choose from the sentence, not from a guess."],
      explanation: `The reread shows that the answer is ${item.meaningAnswer}.`,
      difficulty: 3,
      tag: "meaning_lost_while_decoding",
      hook: "meaning-chunk-glow",
      repair: "Replay the meaning chunk, then say the answer in a short phrase before selecting it.",
    });
  });
}

function phraseCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = passages[index % passages.length];
    const round = Math.floor(index / passages.length);
    if (round === 0) {
      const correct = item.chunks.join(" / ");
      const choices = rotate([correct, wordByWord(item.text), awkwardChunk(item)], index % 3);
      return candidate({
        id: `${prefix}phrase-chunks-${item.id}`,
        format: "phrase-highlight",
        blueprint: "phrase-chunk-practice",
        band: "developing",
        prompt: `Chunk '${item.text}' Which choice keeps words that belong together?`,
        body: { target_text: item.text, choices, correct_chunks: item.chunks, interaction_mode: "meaningful-phrase-boundary-choice" },
        answer: correct,
        hints: ["Do not stop after every word.", "Keep the naming words and action words in meaningful groups."],
        explanation: `${correct} groups the sentence into meaningful reading chunks.`,
        difficulty: 3,
        tag: "word_by_word_reading",
        hook: "phrase-chunk-snap",
        repair: "Show one bordered chunk at a time, rehearse it, then join the chunks without a timer.",
      });
    }
    const choices = rotate([item.expression, "Read every word with the same flat voice and ignore the end mark.", "Rush to the final word without pausing."], index % 3);
    return candidate({
      id: `${prefix}phrase-expression-${item.id}`,
      format: "phrase-highlight",
      blueprint: "phrase-chunk-practice",
      band: "developing",
      prompt: `Reread '${item.text}' Which voice and pause choice helps the meaning?`,
      body: { target_text: item.text, choices, chunks: item.chunks, interaction_mode: "punctuation-expression-preview" },
      answer: item.expression,
      hints: ["Look at commas and the end mark.", "Choose expression that matches the meaning, not the loudest voice."],
      explanation: item.expression,
      difficulty: 4,
      tag: "ignores_punctuation_expression",
      hook: expressionHook(item.text),
      repair: "Highlight the punctuation, model the matching voice gently and invite an optional echo read.",
    });
  });
}

function accuracyCandidates(count) {
  const source = passages.slice(0, 19);
  return Array.from({ length: count }, (_, index) => {
    const item = source[index % source.length];
    const round = Math.floor(index / source.length);
    if (round === 0) {
      const readText = omitWord(item.text, item.focus);
      const choices = rotate(unique([item.focus, item.wrong, contentWord(item.text, item.focus)]), index % 3);
      return candidate({
        id: `${prefix}accuracy-skip-${item.id}`,
        format: "listen-read",
        blueprint: "accuracy-not-speed-checks",
        band: "expected",
        prompt: `Pip read '${readText}' Which word should be put back?`,
        body: { target_text: item.text, observed_read: readText, choices, chunks: item.chunks, interaction_mode: "skipped-word-self-check" },
        answer: item.focus,
        hints: ["Compare the target and read-back one chunk at a time.", "Accuracy means keeping every word; speed is not scored."],
        explanation: `${sentenceStart(item.focus)} was skipped. Putting it back restores the full sentence.`,
        difficulty: 4,
        tag: "speed_over_accuracy",
        hook: "skipped-word-glow",
        repair: "Use a static word window to compare each chunk and restore the missing word without restarting the whole task.",
      });
    }
    if (index % 2 === 0) {
      const readText = replaceWord(item.text, item.focus, item.wrong);
      const choices = rotate(unique([item.focus, item.wrong, contentWord(item.text, item.focus)]), index % 3);
      return candidate({
        id: `${prefix}accuracy-substitute-${item.id}`,
        format: "listen-read",
        blueprint: "accuracy-not-speed-checks",
        band: "expected",
        prompt: `The read-back used '${item.wrong}'. Which word matches the printed sentence?`,
        body: { target_text: item.text, observed_read: readText, choices, chunks: item.chunks, interaction_mode: "substituted-word-self-check" },
        answer: item.focus,
        hints: ["Look closely at the printed word.", "Replay the whole phrase after correcting it."],
        explanation: `${sentenceStart(item.focus)} matches the printed sentence; ${item.wrong} changes its meaning.`,
        difficulty: 5,
        tag: "guesses_familiar_word",
        hook: "substituted-word-compare",
        repair: "Magnify the changed word, compare its letters and reread the complete phrase after repair.",
      });
    }
    const mark = item.text.at(-1);
    const unpunctuated = item.text.slice(0, -1);
    return candidate({
      id: `${prefix}accuracy-punctuation-${item.id}`,
      format: "listen-read",
      blueprint: "accuracy-not-speed-checks",
      band: "expected",
      prompt: `The read-back ignored the end of '${unpunctuated}' Which mark should guide the voice?`,
      body: { target_text: item.text, observed_read: unpunctuated, choices: rotate([mark, ".", "?", "!"].filter((value, position, all) => all.indexOf(value) === position), index % 3), chunks: item.chunks, interaction_mode: "punctuation-self-check" },
      answer: mark,
      hints: ["Look at the printed sentence ending.", "The end mark helps the voice and the meaning."],
      explanation: `${mark} is the printed end mark and should guide the reread.`,
      difficulty: 5,
      tag: "ignores_punctuation_expression",
      hook: expressionHook(item.text),
      repair: "Reveal the end mark in a fixed high-contrast box, name its job and reread only the final chunk.",
    });
  });
}

function confidenceCandidates(count) {
  const source = passages.slice(0, 15);
  return Array.from({ length: count }, (_, index) => {
    const item = source[index % source.length];
    const round = Math.floor(index / source.length);
    if (round === 0) {
      const answer = "Reread to check every word, group phrases and understand the sentence.";
      return candidate({
        id: `${prefix}confidence-purpose-${item.id}`,
        format: "confidence-choice",
        blueprint: "reread-confidence-reflections",
        band: "secure",
        prompt: `First read complete: '${item.text}' Why could a calm reread help?`,
        body: { target_text: item.text, choices: rotate([answer, "Reread because the first read was a failure.", "Reread only to race another reader."], index % 3), interaction_mode: "first-read-reread-purpose-reflection" },
        answer,
        hints: ["Strong readers reread for different helpful reasons.", "Choose accuracy, phrasing and meaning rather than speed."],
        explanation: "Rereading is a normal strategy for checking words, phrasing and meaning.",
        difficulty: 4,
        tag: "reread_as_failure",
        hook: "sentence-path-smooth",
        repair: "Show first read and reread as two equal practice steps and remove all scores or racing language.",
      });
    }
    const answer = selfMonitorAnswer(item);
    return candidate({
      id: `${prefix}confidence-monitor-${item.id}`,
      format: "confidence-choice",
      blueprint: "reread-confidence-reflections",
      band: "secure",
      prompt: `Choose one helpful focus before rereading '${item.text}'`,
      body: { target_text: item.text, choices: rotate([answer, "Try to finish before anyone else.", "Skip a difficult chunk and do not return."], index % 3), interaction_mode: "choose-one-self-monitoring-focus" },
      answer,
      hints: ["Choose one small thing to notice.", "There is no timer and no public score."],
      explanation: `${answer} A single focus makes self-monitoring manageable.`,
      difficulty: 5,
      tag: "reread_as_failure",
      hook: "companion-reread-confidence",
      repair: "Offer one calm focus card—words, chunks, punctuation or meaning—and let the learner choose without judgement.",
    });
  });
}

function retrievalCandidates(count) {
  const source = passages.slice(0, 15);
  return Array.from({ length: count }, (_, index) => {
    const item = source[index % source.length];
    const round = Math.floor(index / source.length);
    if (round === 0) {
      const answer = item.chunks.join(" / ");
      return candidate({
        id: `${prefix}retrieval-chunks-${item.id}`,
        format: "phrase-highlight",
        blueprint: "fluency-retrieval-phrases",
        band: "retrieval",
        prompt: `Welcome back to '${item.text}' Which familiar chunking supports a smooth reread?`,
        body: { target_text: item.text, choices: rotate([answer, wordByWord(item.text), awkwardChunk(item)], index % 3), chunks: item.chunks, interaction_mode: "spaced-phrase-reread" },
        answer,
        hints: ["Use the chunking you practised before.", "Keep meaning together and pause only where it helps."],
        explanation: `${answer} preserves the familiar meaning groups.`,
        difficulty: 4,
        tag: "word_by_word_reading",
        hook: "phrase-chunk-glow",
        repair: "Restore the previous phrase borders and fade them only after a comfortable reread.",
      });
    }
    return candidate({
      id: `${prefix}retrieval-meaning-${item.id}`,
      format: "phrase-highlight",
      blueprint: "fluency-retrieval-phrases",
      band: "retrieval",
      prompt: `Reread the familiar sentence: '${item.text}' ${item.meaningQuestion}`,
      body: { target_text: item.text, choices: rotate([item.meaningAnswer, ...item.meaningDistractors], index % 3), chunks: item.chunks, interaction_mode: "spaced-reread-comprehension-check" },
      answer: item.meaningAnswer,
      hints: ["Reread the chunk that contains the clue.", "Meaning is part of fluent reading."],
      explanation: `The sentence says ${item.meaningAnswer}.`,
      difficulty: 5,
      tag: "meaning_lost_while_decoding",
      hook: "meaning-chunk-glow",
      repair: "Keep only the clue chunk visible, replay it if approved audio is ready and answer without any speed expectation.",
    });
  });
}

function candidate({ id, format, blueprint, band, prompt, body, answer, hints, explanation, difficulty, tag, hook, repair }) {
  return {
    id,
    format,
    body: {
      prompt,
      ...body,
      response_mode: "tap_keyboard_switch_speak_or_adult_record",
      dyslexia_support: { increased_spacing: true, line_focus: true, tinted_background_option: true, chunk_borders: true },
      reduced_visual_load: true,
      static_highlight_mode: true,
      oral_reading_optional: true,
      microphone_required: false,
      recording_required: false,
      timer_allowed: false,
      speed_score_allowed: false,
      leaderboard_allowed: false,
      audio_optional: true,
      audio_asset_id: `narration-${id}`,
      audio_provider: "ElevenLabs",
      audio_asset_status: "required_human_listening_review",
      human_listening_approval_required: true,
      browser_tts_allowed: false,
      low_pressure_reward: "calm reading-ribbon segment for using a strategy",
      difficulty_band: band,
      evidence_purpose: blueprint.replaceAll("-", "_"),
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
    },
    expected_answer: { value: answer },
    hints,
    explanation,
    feedback: { correct: "Careful reading matched the words, phrasing or meaning.", repair },
    difficulty,
    status: "review",
    misconception_tag: tag,
    animation_hook: hook,
  };
}

function enrichVariant(variant) {
  const body = variant.body ?? {};
  const responseModes = ["tap", "keyboard", "switch", "eye_gaze", "aac"];
  let fluencyContract;
  if (variant.format === "listen-read") {
    const structured = body.target_text !== undefined && Array.isArray(body.chunks);
    fluencyContract = {
      kind: "guided_reading",
      mode: structured ? "text_and_chunks" : "authored_choice",
      target_text_key: structured ? "target_text" : null,
      observed_read_key: body.observed_read !== undefined ? "observed_read" : null,
      chunks_key: structured ? "chunks" : null,
      audio_policy: "approved_elevenlabs_asset_only",
      drag_required: false,
      response_modes: responseModes,
      pressure_policy: "no_timer_no_speed_score_no_leaderboard",
    };
  } else if (variant.format === "phrase-highlight") {
    const structured = body.target_text !== undefined && Array.isArray(body.chunks);
    fluencyContract = {
      kind: "phrase_chunking",
      mode: structured ? "text_and_chunk_boundaries" : "authored_choice",
      target_text_key: structured ? "target_text" : null,
      chunks_key: structured ? "chunks" : null,
      audio_policy: "approved_elevenlabs_asset_only",
      drag_required: false,
      response_modes: responseModes,
      pressure_policy: "no_timer_no_speed_score_no_leaderboard",
    };
  } else if (variant.format === "confidence-choice") {
    const structured = body.target_text !== undefined;
    fluencyContract = {
      kind: "reread_reflection",
      mode: structured ? "self_monitoring_focus" : "authored_choice",
      target_text_key: structured ? "target_text" : null,
      audio_policy: "approved_elevenlabs_asset_only",
      drag_required: false,
      response_modes: responseModes,
      pressure_policy: "no_timer_no_speed_score_no_leaderboard",
    };
  }
  return fluencyContract ? { ...variant, body: { ...body, fluency_contract: fluencyContract } } : variant;
}

function validateBank(currentPack, authored, generated) {
  if (authored.length !== 3) throw new Error(`Expected 3 curated variants, found ${authored.length}.`);
  if (currentPack.question_variants.length !== currentPack.practice.variant_targets.pilot) throw new Error(`Expected 180 variants, found ${currentPack.question_variants.length}.`);
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
  for (const variant of currentPack.question_variants.filter((item) => ["listen-read", "phrase-highlight", "confidence-choice"].includes(item.format))) validateFluencyContract(variant);
  for (const variant of generated) {
    const blueprint = blueprints.get(variant.body.variant_blueprint_id);
    if (!blueprint || variant.format !== blueprint.format) throw new Error(`${variant.id} does not match an existing blueprint format.`);
    if (variant.body.difficulty_band !== blueprint.difficulty_band) throw new Error(`${variant.id} uses the wrong difficulty band.`);
    if (variant.status !== "review") throw new Error(`${variant.id} must remain in review.`);
    const choices = variant.body.choices;
    if (!Array.isArray(choices) || choices.length < 2 || new Set(choices).size !== choices.length) throw new Error(`${variant.id} has invalid choices.`);
    if (choices.filter((choice) => choice === variant.expected_answer.value).length !== 1) throw new Error(`${variant.id} must offer exactly one answer.`);
    if (!variant.body.response_mode.includes("keyboard") || !variant.body.response_mode.includes("switch") || variant.body.reduced_visual_load !== true || variant.body.static_highlight_mode !== true) throw new Error(`${variant.id} lacks a SEND route.`);
    if (!variant.body.dyslexia_support?.increased_spacing || !variant.body.dyslexia_support?.line_focus || !variant.body.dyslexia_support?.chunk_borders) throw new Error(`${variant.id} lacks dyslexia-friendly chunking.`);
    if (variant.body.timer_allowed !== false || variant.body.speed_score_allowed !== false || variant.body.leaderboard_allowed !== false) throw new Error(`${variant.id} introduces speed pressure.`);
    if (variant.body.audio_provider !== "ElevenLabs" || variant.body.audio_asset_status !== "required_human_listening_review" || variant.body.human_listening_approval_required !== true || variant.body.browser_tts_allowed !== false) throw new Error(`${variant.id} violates audio policy.`);
    if (!variant.feedback?.repair || variant.hints?.length < 2) throw new Error(`${variant.id} lacks rich feedback.`);
    if (variant.body.prompt.length > 150) throw new Error(`${variant.id} prompt is too long for Year 2.`);
    if (/api[_-]?key|secret|bearer\s|access[_-]?token/i.test(JSON.stringify(variant))) throw new Error(`${variant.id} contains secret-like text.`);
  }
  const allocation = combinedAllocation(authored, generated);
  for (const [blueprint, expected] of Object.entries(pilotAllocation)) if (allocation[blueprint] !== expected) throw new Error(`${blueprint} expected ${expected}, found ${allocation[blueprint] ?? 0}.`);
}

function validateFluencyContract(variant) {
  const body = variant.body ?? {};
  const contract = body.fluency_contract;
  const requiredResponseModes = ["tap", "keyboard", "switch", "eye_gaze", "aac"];
  if (!contract || contract.drag_required !== false || contract.pressure_policy !== "no_timer_no_speed_score_no_leaderboard" || requiredResponseModes.some((mode) => !contract.response_modes?.includes(mode))) throw new Error(`${variant.id} lacks a safe accessible reading-fluency contract.`);
  if (variant.format === "listen-read") {
    if (contract.kind !== "guided_reading") throw new Error(`${variant.id} has the wrong guided-reading contract.`);
    if (contract.mode === "text_and_chunks" && (!body[contract.target_text_key] || !Array.isArray(body[contract.chunks_key]) || body[contract.chunks_key].length < 2)) throw new Error(`${variant.id} lacks guided-reading text and chunks.`);
    if (contract.mode !== "text_and_chunks" && contract.mode !== "authored_choice") throw new Error(`${variant.id} has an unknown guided-reading mode.`);
  } else if (variant.format === "phrase-highlight") {
    if (contract.kind !== "phrase_chunking") throw new Error(`${variant.id} has the wrong phrase-chunking contract.`);
    if (contract.mode === "text_and_chunk_boundaries" && (!body[contract.target_text_key] || !Array.isArray(body[contract.chunks_key]) || body[contract.chunks_key].length < 2)) throw new Error(`${variant.id} lacks phrase boundaries.`);
    if (contract.mode !== "text_and_chunk_boundaries" && contract.mode !== "authored_choice") throw new Error(`${variant.id} has an unknown phrase-chunking mode.`);
  } else if (variant.format === "confidence-choice") {
    if (contract.kind !== "reread_reflection") throw new Error(`${variant.id} has the wrong reread-reflection contract.`);
    if (contract.mode === "self_monitoring_focus" && !body[contract.target_text_key]) throw new Error(`${variant.id} lacks a reread focus target.`);
    if (contract.mode !== "self_monitoring_focus" && contract.mode !== "authored_choice") throw new Error(`${variant.id} has an unknown reread-reflection mode.`);
  }
}

function curatedBlueprint(variant) {
  const map = {
    "en-y2-reading-fluency-reread-q-question-voice": "phrase-chunk-practice",
    "en-y2-reading-fluency-reread-q-skipped-word": "accuracy-not-speed-checks",
    "en-y2-reading-fluency-reread-q-reread-confidence": "reread-confidence-reflections",
  };
  const blueprint = map[variant.id];
  if (!blueprint) throw new Error(`No curated blueprint assignment for ${variant.id}.`);
  return blueprint;
}

function combinedAllocation(authored, generated) {
  const counts = countBy(authored, curatedBlueprint);
  for (const variant of generated) counts[variant.body.variant_blueprint_id] = (counts[variant.body.variant_blueprint_id] ?? 0) + 1;
  return counts;
}

function allocationSummary(authored, generated) {
  return Object.entries(combinedAllocation(authored, generated)).sort().map(([key, count]) => `${key}:${count}`).join(",");
}

function bandSummary(authored, generated, blueprints) {
  const assignments = [...authored.map(curatedBlueprint), ...generated.map((variant) => variant.body.variant_blueprint_id)];
  return summary(assignments, (blueprint) => blueprints.get(blueprint).difficulty_band);
}

function passage(id, text, chunks, focus, wrong, meaningQuestion, meaningAnswer, meaningDistractors, expression) {
  return { id, text, chunks, focus, wrong, meaningQuestion, meaningAnswer, meaningDistractors, expression };
}

function omitWord(text, word) {
  return text.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, "i"), "").replace(/\s{2,}/g, " ").replace(/\s+([,.!?])/g, "$1");
}

function replaceWord(text, word, replacement) {
  return text.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, "i"), replacement);
}

function contentWord(text, excluded) {
  const ignored = new Set(["the", "a", "an", "and", "to", "on", "in", "at", "is", "was", "we", "my", excluded.toLowerCase()]);
  return text.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).find((word) => word.length > 3 && !ignored.has(word)) ?? "sentence";
}

function wordByWord(text) {
  return text.replace(/([,.!?])/g, " $1").trim().split(/\s+/).join(" / ");
}

function awkwardChunk(item) {
  const words = item.text.split(" ");
  const correct = item.chunks.join(" / ");
  const wordSplit = wordByWord(item.text);
  for (const point of [1, words.length - 1, Math.floor(words.length / 2)]) {
    const candidate = [...words.slice(0, point), "/", ...words.slice(point)].join(" ");
    if (candidate !== correct && candidate !== wordSplit) return candidate;
  }
  throw new Error(`Could not make a distinct awkward chunk for ${item.id}.`);
}

function selfMonitorAnswer(item) {
  if (item.text.endsWith("?")) return "Notice the question mark and use a questioning voice.";
  if (item.text.endsWith("!")) return "Notice the exclamation mark and match the feeling or warning.";
  if (item.text.includes(",")) return "Pause briefly at the comma and keep each phrase together.";
  return "Check every word, then group the words into smooth meaning chunks.";
}

function expressionHook(text) {
  if (text.endsWith("?")) return "punctuation-voice-lift";
  if (text.endsWith("!")) return "exclamation-expression-cue";
  if (text.includes(",")) return "comma-pause-cue";
  return "full-stop-calm-finish";
}

function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function unique(items) { return [...new Set(items)]; }
function sentenceStart(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
function normalise(value) { return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " "); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function countBy(items, keyFor) { const counts = {}; for (const item of items) { const key = keyFor(item); counts[key] = (counts[key] ?? 0) + 1; } return counts; }
function summary(items, keyFor) { return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
