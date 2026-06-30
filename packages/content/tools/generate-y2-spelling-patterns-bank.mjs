#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/en-y2-spelling-patterns.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "en-y2-spelling-patterns-bank-";
const reviewBatch = "y2-spelling-patterns-pilot-a";
const pilotAllocation = {
  "heard-sound-pattern-sorts": 44,
  "same-phoneme-different-graphemes": 44,
  "segment-and-build-reviewed-words": 44,
  "year-two-suffix-transformations": 44,
  "spaced-pattern-retrieval": 44,
};

const patternSets = [
  pattern("j-dge-g", "/dʒ/", ["dge", "g"], { dge: ["badge", "bridge"], g: ["giant", "magic"] }, "The /dʒ/ phoneme is written dge in badge and bridge, and g in giant and magic."),
  pattern("j-ge-dge", "/dʒ/", ["ge", "dge"], { ge: ["age", "huge"], dge: ["edge", "fudge"] }, "The words share /dʒ/ at the end but use reviewed spellings ge or dge."),
  pattern("s-c-s", "/s/", ["c", "s"], { c: ["city", "race"], s: ["sip", "mess"] }, "The /s/ phoneme can be written c in city and race, or s in sip and mess."),
  pattern("n-kn-n", "/n/", ["kn", "n"], { kn: ["knock", "knee"], n: ["name", "nest"] }, "At the start of knock and knee, kn writes /n/; name and nest use n."),
  pattern("n-gn-n", "/n/", ["gn", "n"], { gn: ["gnat", "gnaw"], n: ["nail", "net"] }, "At the start of gnat and gnaw, gn writes /n/; nail and net use n."),
  pattern("r-wr-r", "/r/", ["wr", "r"], { wr: ["wrist", "wrap"], r: ["rain", "red"] }, "At the start of wrist and wrap, wr writes /r/; rain and red use r."),
  pattern("l-le-el", "/əl/", ["le", "el"], { le: ["table", "little"], el: ["camel", "tunnel"] }, "The final unstressed /əl/ sound is written le in table and little, and el in camel and tunnel."),
  pattern("l-le-al", "/əl/", ["le", "al"], { le: ["candle", "bottle"], al: ["metal", "animal"] }, "The final unstressed /əl/ sound is written le or al in these reviewed words."),
  pattern("ee-ey-ee", "/iː/ or final /i/", ["ey", "ee"], { ey: ["key", "donkey"], ee: ["green", "tree"] }, "These reviewed words use ey or ee for their taught long or final /i/ spelling pattern."),
  pattern("igh-y-igh", "/aɪ/", ["y", "igh"], { y: ["cry", "fly"], igh: ["night", "light"] }, "The /aɪ/ phoneme is written y at the end of cry and fly, and igh in night and light."),
  pattern("u-o-u", "/ʌ/", ["o", "u"], { o: ["mother", "brother"], u: ["sun", "cup"] }, "The /ʌ/ phoneme is written o in mother and brother, and u in sun and cup."),
  pattern("er-or-ir", "/ɜː/", ["or", "ir"], { or: ["word", "work"], ir: ["bird", "girl"] }, "The /ɜː/ phoneme is written or after w in word and work, and ir in bird and girl."),
];

const buildWords = [
  build("badge", ["b", "a", "dge"], "dge", "/dʒ/", ["b", "a", "dge", "g", "ge"]),
  build("bridge", ["b", "r", "i", "dge"], "dge", "/dʒ/", ["b", "r", "i", "dge", "g", "ge"]),
  build("giant", ["g", "i", "a", "n", "t"], "g", "/dʒ/", ["j", "g", "i", "a", "n", "t"]),
  build("magic", ["m", "a", "g", "i", "c"], "g", "/dʒ/", ["m", "a", "j", "g", "i", "c"]),
  build("city", ["c", "i", "t", "y"], "c", "/s/", ["s", "c", "i", "t", "y"]),
  build("race", ["r", "a_e", "c"], "c", "/s/", ["r", "a_e", "s", "c"]),
  build("knock", ["kn", "o", "ck"], "kn", "/n/", ["n", "kn", "o", "k", "ck"]),
  build("knee", ["kn", "ee"], "kn", "/n/", ["n", "kn", "e", "ee"]),
  build("gnat", ["gn", "a", "t"], "gn", "/n/", ["n", "gn", "a", "t"]),
  build("gnaw", ["gn", "aw"], "gn", "/n/", ["n", "gn", "or", "aw"]),
  build("wrist", ["wr", "i", "s", "t"], "wr", "/r/", ["r", "wr", "i", "s", "t"]),
  build("wrap", ["wr", "a", "p"], "wr", "/r/", ["r", "wr", "a", "p"]),
  build("table", ["t", "a_e", "b", "le"], "le", "/əl/", ["t", "a_e", "b", "el", "le"]),
  build("little", ["l", "i", "tt", "le"], "le", "/əl/", ["l", "i", "t", "tt", "el", "le"]),
  build("camel", ["c", "a", "m", "el"], "el", "/əl/", ["c", "a", "m", "le", "el"]),
  build("animal", ["a", "n", "i", "m", "al"], "al", "/əl/", ["a", "n", "i", "m", "le", "al"]),
  build("key", ["k", "ey"], "ey", "final /iː/", ["k", "ee", "ey"]),
  build("donkey", ["d", "o", "n", "k", "ey"], "ey", "final /i/", ["d", "o", "n", "k", "ee", "ey"]),
  build("cry", ["c", "r", "y"], "y", "/aɪ/", ["c", "r", "igh", "y"]),
  build("fly", ["f", "l", "y"], "y", "/aɪ/", ["f", "l", "igh", "y"]),
  build("mother", ["m", "o", "th", "er"], "o", "/ʌ/", ["m", "u", "o", "th", "er"]),
  build("brother", ["b", "r", "o", "th", "er"], "o", "/ʌ/", ["b", "r", "u", "o", "th", "er"]),
  build("word", ["w", "or", "d"], "or", "/ɜː/", ["w", "ir", "or", "d"]),
  build("work", ["w", "or", "k"], "or", "/ɜː/", ["w", "ir", "or", "k"]),
];

const suffixCases = [
  suffix("enjoy", "ment", "enjoyment", "keep the base word, then add ment", "keep"),
  suffix("pay", "ment", "payment", "keep the final y after a vowel, then add ment", "keep_y_after_vowel"),
  suffix("sad", "ness", "sadness", "keep the base word, then add ness", "keep"),
  suffix("happy", "ness", "happiness", "change consonant-plus-y to i, then add ness", "y_to_i"),
  suffix("kind", "ness", "kindness", "keep the base word, then add ness", "keep"),
  suffix("help", "ful", "helpful", "keep the base word, then add ful", "keep"),
  suffix("play", "ful", "playful", "keep the final y after a vowel, then add ful", "keep_y_after_vowel"),
  suffix("hope", "ful", "hopeful", "drop the final e, then add ful", "drop_e"),
  suffix("care", "less", "careless", "keep the final e, then add less", "keep_e"),
  suffix("hope", "less", "hopeless", "keep the final e, then add less", "keep_e"),
  suffix("bad", "ly", "badly", "keep the base word, then add ly", "keep"),
  suffix("happy", "ly", "happily", "change consonant-plus-y to i, then add ly", "y_to_i"),
  suffix("slow", "ly", "slowly", "keep the base word, then add ly", "keep"),
  suffix("fast", "er", "faster", "keep the base word, then add er", "keep"),
  suffix("fast", "est", "fastest", "keep the base word, then add est", "keep"),
  suffix("big", "er", "bigger", "double the final consonant after one short vowel, then add er", "double_final"),
  suffix("big", "est", "biggest", "double the final consonant after one short vowel, then add est", "double_final"),
  suffix("nice", "er", "nicer", "drop the final e, then add er", "drop_e"),
  suffix("nice", "est", "nicest", "drop the final e, then add est", "drop_e"),
  suffix("run", "ing", "running", "double the final consonant after one short vowel, then add ing", "double_final"),
  suffix("hike", "ing", "hiking", "drop the final e, then add ing", "drop_e"),
  suffix("copy", "ed", "copied", "change consonant-plus-y to i, then add ed", "y_to_i"),
  suffix("copy", "ing", "copying", "keep y before ing, then add ing", "keep_y_ing"),
  suffix("cry", "ed", "cried", "change y to i, then add ed", "y_to_i"),
  suffix("cry", "ing", "crying", "keep y before ing, then add ing", "keep_y_ing"),
  suffix("fly", "es", "flies", "change consonant-plus-y to i, then add es", "y_to_i"),
];

const exceptionWords = [
  exceptionWord("because", ["be", "cause"]), exceptionWord("people", ["peo", "ple"]), exceptionWord("beautiful", ["beau", "ti", "ful"]),
  exceptionWord("every", ["eve", "ry"]), exceptionWord("everybody", ["every", "body"]), exceptionWord("children", ["child", "ren"]),
  exceptionWord("could", ["c", "ould"]), exceptionWord("should", ["sh", "ould"]), exceptionWord("would", ["w", "ould"]),
  exceptionWord("whole", ["wh", "ole"]), exceptionWord("who", ["wh", "o"]), exceptionWord("any", ["a", "ny"]),
  exceptionWord("many", ["ma", "ny"]), exceptionWord("again", ["a", "gain"]), exceptionWord("water", ["wa", "ter"]),
  exceptionWord("money", ["mo", "ney"]), exceptionWord("busy", ["bu", "sy"]), exceptionWord("clothes", ["clo", "thes"]),
  exceptionWord("hour", ["h", "our"]), exceptionWord("Christmas", ["Christ", "mas"]),
];

const prefixCases = [
  { base: "kind", prefix: "un", result: "unkind", meaning: "not kind" },
  { base: "happy", prefix: "un", result: "unhappy", meaning: "not happy" },
  { base: "fair", prefix: "un", result: "unfair", meaning: "not fair" },
  { base: "tie", prefix: "un", result: "untie", meaning: "reverse the action of tying" },
  { base: "do", prefix: "un", result: "undo", meaning: "reverse the action of doing" },
  { base: "pack", prefix: "un", result: "unpack", meaning: "take things out after packing" },
];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "en-y2-spelling-patterns") throw new Error("This generator only supports the Year 2 spelling-patterns pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedCounts = countBy(curated, (variant) => variant.body?.variant_blueprint_id);
const targets = Object.fromEntries(Object.entries(pilotAllocation).map(([id, target]) => [id, target - (curatedCounts[id] ?? 0)]));
for (const [id, target] of Object.entries(targets)) if (target < 0) throw new Error(`Curated variants exceed the allocation for ${id}.`);

const generated = [
  ...heardSortCandidates(targets["heard-sound-pattern-sorts"]),
  ...contrastCandidates(targets["same-phoneme-different-graphemes"]),
  ...buildCandidates(targets["segment-and-build-reviewed-words"]),
  ...suffixCandidates(targets["year-two-suffix-transformations"]),
  ...retrievalCandidates(targets["spaced-pattern-retrieval"]),
];

pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa.notes = "Review-stage Year 2 spelling-patterns pack with a deterministic 220-item pilot bank. Four curated variants are preserved alongside candidates covering the pack's statutory grapheme contrasts, reviewed word building, common exception words, suffix transformations, prior-taught un- prefix application, morphology, short dictation/application, misconception repair and spaced retrieval. Listening is referenced only where a whole word, shared phoneme or dictated sentence is pedagogically necessary. Those references are ElevenLabs-only, blocked pending SSP-specialist human listening review, and never use browser TTS or ungated pure-phoneme clips. Every generated task includes grapheme/morpheme chunking, dyslexia-friendly visual and phonological supports, non-drag interaction routes, rich corrective feedback and untimed word-workshop missions. SSP sequence mapping, pronunciation, dialect, morphology, teacher, SEND and renderer review remains required before promotion.";

validateBank(pack, curated, generated);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y2-spelling-patterns-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y2-spelling-patterns-bank blueprints=${summary(pack.question_variants, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`y2-spelling-patterns-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y2-spelling-patterns-bank concepts=${summary(generated, (variant) => variant.body.concept_focus)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y2-spelling-patterns-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 2 spelling-patterns bank is out of date; run generate-y2-spelling-patterns-bank.mjs --write.");
  console.log("y2-spelling-patterns-bank deterministic check passed");
} else {
  console.log("y2-spelling-patterns-bank dry-run; pass --write to update the pack");
}

function heardSortCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = patternSets[index % patternSets.length];
    const round = Math.floor(index / patternSets.length);
    const words = Object.values(item.groups).flat();
    return sortCandidate({
      id: `heard-${item.id}-${index + 1}`, blueprint: "heard-sound-pattern-sorts", band: "intro", concept: "heard_word_grapheme_sort",
      prompt: `Listening-door mission ${index + 1}: hear each reviewed whole word, then sort by the grapheme writing ${item.phoneme}.`,
      body: { target_phoneme_id: item.phoneme, words: rotate(words, index % words.length), pattern_columns: item.columns, expected_groups: item.groups, target_graphemes_revealed_after_sort: true, interaction_mode: "tap_drag_keyboard_switch_partner_scan_or_place_word_cards" }, expected: item.groups,
      audioWords: words,
      hints: ["Listen to the complete word first.", "Then uncover and check the decisive grapheme; sound alone cannot choose the spelling."],
      explanation: `${item.explanation} These are word-specific reviewed spellings, not a new universal pronunciation rule.`, difficulty: 3 + (round % 2), tag: "sound_only_choice", hook: "word-workshop-listening-door",
      correct: "Whole words sorted by visible grapheme evidence after listening.", repair: "Keep the shared phoneme fixed, reveal one target grapheme at a time and move only one word card before checking.",
    });
  });
}

function contrastCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = patternSets[(index * 5 + 1) % patternSets.length];
    const round = Math.floor(index / patternSets.length);
    const words = Object.values(item.groups).flat();
    const pairA = item.groups[item.columns[0]];
    const pairB = item.groups[item.columns[1]];
    return sortCandidate({
      id: `contrast-${item.id}-${index + 1}`, blueprint: "same-phoneme-different-graphemes", band: "developing", concept: "same_phoneme_different_graphemes",
      prompt: `Grapheme-bridge mission ${index + 1}: compare the words sharing ${item.phoneme} and sort by the letters actually used.`,
      body: { target_phoneme_id: item.phoneme, words: rotate([pairA[0], pairB[0], pairA[1], pairB[1]], index % 4), pattern_columns: item.columns, expected_groups: item.groups, comparison_pairs: [[pairA[0], pairB[0]], [pairA[1], pairB[1]]], no_invented_position_rule: true, interaction_mode: "sort_highlight_grapheme_keyboard_switch_or_aac_explain" }, expected: item.groups,
      audioWords: words,
      hints: ["The phoneme can stay the same while the grapheme changes.", `Underline ${item.columns.join(" or ")} in each printed word.`], explanation: `${item.explanation} Learn the spelling with each word and the adopted SSP sequence.`, difficulty: 4 + (round % 2), tag: "one_sound_one_spelling", hook: "word-workshop-grapheme-bridge",
      correct: "Shared phoneme separated from its different word-specific graphemes.", repair: "Place one word from each column side by side, replay both approved whole words and underline only the target graphemes.",
    });
  });
}

function buildCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = buildWords[index % buildWords.length];
    const round = Math.floor(index / buildWords.length);
    return wordCandidate({
      id: `build-${item.word}-${index + 1}`, blueprint: "segment-and-build-reviewed-words", band: "expected", concept: "segment_and_build_taught_word",
      prompt: `Sound-box mission ${index + 1}: hear the approved whole word “${item.word}”, segment it, then build with taught tiles.`,
      body: { target_word: item.word, build_units: item.units, tiles: rotate(unique(item.tiles), index % item.tiles.length), sound_boxes: item.units.length, target_pattern: item.pattern, target_phoneme_id: item.phoneme, split_grapheme_notation: "underscore links a split grapheme where used", grapheme_order_check: true, interaction_mode: "tap_drag_keyboard_switch_eye_gaze_or_direct_adult_tiles" }, expected: item.units,
      audio: audioForWord(item.word),
      hints: ["Say or hear the whole word, then work left to right.", `Check the taught target grapheme ${item.pattern}; do not choose by word shape.`], explanation: `${item.word} is built as ${item.units.join(" | ")}. The target grapheme ${item.pattern} writes ${item.phoneme} in this reviewed word.`, difficulty: 5 + (round % 2), tag: "word_shape_guess", hook: "word-workshop-sound-boxes",
      correct: `Graphemes built in order for ${item.word}.`, repair: "Hide the picture, keep meaning confirmed, reveal one sound box at a time and compare each selected grapheme with the reviewed word card.",
    });
  });
}

function suffixCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = suffixCases[index % suffixCases.length];
    const round = Math.floor(index / suffixCases.length);
    const choices = rotate(suffixChoices(item), index % 4);
    return suffixCandidate({
      id: `suffix-${item.base}-${item.suffix}-${index + 1}`, concept: suffixConcept(item.rule),
      prompt: `Suffix-workbench mission ${index + 1}: change ${item.base} to ${item.result} by adding -${item.suffix}.`,
      body: { base_word: item.base, suffix: item.suffix, transformation_rule: item.rule, transformation_steps: transformationSteps(item), choices, morpheme_chunks: [item.base, item.suffix], meaning_link: `${item.result} keeps a meaning link to ${item.base}`, interaction_mode: "choose_transform_move_tiles_keyboard_switch_or_verbalise_steps" }, answer: item.result,
      hints: [`Separate the base ${item.base} from the suffix ${item.suffix}.`, item.instruction], explanation: `${sentenceStart(item.instruction)} to make ${item.result}. The base word and suffix are checked as meaningful parts.`, difficulty: 5 + (round % 2), tag: "suffix_base_change_omitted", hook: suffixHook(item.rule),
      correct: `Base change and suffix checked: ${item.base} → ${item.result}.`, repair: "Keep the base and suffix on separate trays. Complete the keep, drop, change or double step before joining them.",
    });
  });
}

function retrievalCandidates(count) {
  const modes = ["exception", "dictation", "prefix", "pattern", "morphology", "repair"];
  return Array.from({ length: count }, (_, index) => {
    const mode = modes[index % modes.length];
    if (mode === "dictation") return dictationCandidate(index);
    if (mode === "prefix") return prefixCandidate(index);
    if (mode === "pattern") return patternBuildCandidate(index);
    if (mode === "morphology") return morphologyCandidate(index);
    if (mode === "repair") return misconceptionCandidate(index);
    return exceptionCandidate(index);
  });
}

function exceptionCandidate(index) {
  const item = exceptionWords[(Math.floor(index / 6) * 3) % exceptionWords.length];
  const tiles = unique([...item.chunks, ...exceptionDistractors(item)]);
  return wordCandidate({
    id: `review-exception-${slug(item.word)}-${index + 1}`, blueprint: "spaced-pattern-retrieval", band: "retrieval", concept: "common_exception_word_retrieval",
    prompt: `Memory-map mission ${index + 1}: build the common exception word “${item.word}” from its reviewed chunks.`,
    body: { target_word: item.word, build_units: item.chunks, tiles: rotate(tiles, index % tiles.length), chunk_type: "orthographic_memory_chunks_not_pure_phoneme_boxes", grapheme_by_grapheme_check: true, review_interval_days: reviewDay(index), interaction_mode: "tap_tiles_keyboard_switch_eye_gaze_or_direct_adult" }, expected: item.chunks,
    hints: ["Say the whole word and recall its tricky written part.", `Build the reviewed chunks in order: ${item.chunks.map(() => "__").join(" | ")}.`], explanation: `${item.word} is a common exception word in this review set. Its memory chunks are ${item.chunks.join(" | ")}; check every letter against the reviewed card.`, difficulty: 4, tag: "regularises_exception_word", hook: "word-workshop-memory-map",
    correct: `Common exception word checked letter by letter: ${item.word}.`, repair: "Reveal the tricky chunk, cover it, rebuild it and compare every grapheme without a timer.",
  });
}

function dictationCandidate(index) {
  const items = [
    ["badge", ["b", "a", "dge"], "The badge is on the bag."], ["knee", ["kn", "ee"], "My knee is muddy."],
    ["wrist", ["wr", "i", "s", "t"], "The band is on my wrist."], ["city", ["c", "i", "t", "y"], "The city is busy."],
    ["word", ["w", "or", "d"], "Write one word."], ["happiness", ["happi", "ness"], "Happiness filled the room."],
    ["careless", ["care", "less"], "Do not be careless with the paint."], ["because", ["be", "cause"], "We stayed in because it rained."],
  ];
  const [word, chunks, sentence] = items[Math.floor(index / 5) % items.length];
  const tiles = unique([...chunks, ...chunks.map((chunk) => chunk === "dge" ? "ge" : chunk === "kn" ? "n" : `${chunk}x`)]);
  return wordCandidate({
    id: `review-dictation-${word}-${index + 1}`, blueprint: "spaced-pattern-retrieval", band: "retrieval", concept: "dictation_application",
    prompt: `Dictation-path mission ${index + 1}: hear the reviewed sentence, then build the target word “${word}”.`,
    body: { target_word: word, dictation_sentence: sentence, build_units: chunks, tiles: rotate(tiles, index % tiles.length), sentence_meaning_preview_available: true, target_word_replay_available: true, handwriting_not_required: true, review_interval_days: reviewDay(index), interaction_mode: "listen_build_keyboard_switch_eye_gaze_or_adult_scribed" }, expected: chunks,
    audio: audioForSentence(word, sentence),
    hints: ["Listen to the sentence for meaning, then replay the target word.", "Build the target in chunks and compare every grapheme."], explanation: `The target is ${word}, built as ${chunks.join(" | ")}. The sentence supplies meaning; the reviewed spelling card supplies final grapheme evidence.`, difficulty: 4, tag: "sound_only_choice", hook: "word-workshop-dictation-path",
    correct: `Dictated target built and checked: ${word}.`, repair: "Replay the whole sentence, then the target word. Reveal one chunk boundary and rebuild without requiring handwriting or speech recording.",
  });
}

function prefixCandidate(index) {
  const item = prefixCases[Math.floor(index / 5) % prefixCases.length];
  return wordCandidate({
    id: `review-prefix-${item.result}-${index + 1}`, blueprint: "spaced-pattern-retrieval", band: "retrieval", concept: "prefix_un_morphology",
    prompt: `Meaning-gate mission ${index + 1}: add the prior-taught prefix un- to ${item.base} to make a word meaning “${item.meaning}”.`,
    body: { target_word: item.result, base_word: item.base, prefix: item.prefix, build_units: [item.prefix, item.base], tiles: rotate([item.prefix, item.base, "re", `${item.base}e`], index % 4), morpheme_chunks: [item.prefix, item.base], base_change: "none", review_interval_days: reviewDay(index), interaction_mode: "join_morpheme_tiles_keyboard_switch_or_say_meaning" }, expected: [item.prefix, item.base],
    hints: ["A prefix goes before the base word.", `Keep ${item.base} unchanged and place un before it.`], explanation: `${item.prefix} + ${item.base} = ${item.result}, meaning ${item.meaning}. The base stays unchanged in this task.`, difficulty: 4, tag: "prefix_placed_after_base", hook: "word-workshop-meaning-gate",
    correct: `Prefix and base joined: ${item.result}.`, repair: "Place PREFIX before BASE on two labelled slots, read the meaning, then join the chunks without a motor-speed demand.",
  });
}

function patternBuildCandidate(index) {
  const item = buildWords[(index * 3 + 2) % buildWords.length];
  return wordCandidate({
    id: `review-pattern-${item.word}-${index + 1}`, blueprint: "spaced-pattern-retrieval", band: "retrieval", concept: "spaced_grapheme_pattern_retrieval",
    prompt: `Pattern-return mission ${index + 1}: rebuild ${item.word} and underline the grapheme ${item.pattern}.`,
    body: { target_word: item.word, build_units: item.units, tiles: rotate(unique(item.tiles), index % item.tiles.length), target_pattern: item.pattern, no_audio_needed: true, reviewed_word_card_available_after_attempt: true, review_interval_days: reviewDay(index), interaction_mode: "build_select_grapheme_keyboard_switch_or_point" }, expected: item.units,
    hints: ["Use the remembered written pattern, then check the word card.", `Find ${item.pattern} in the completed word.`], explanation: `${item.word} uses ${item.pattern} for ${item.phoneme} in this reviewed word. The visible grapheme, not a guessed pronunciation rule, decides the spelling.`, difficulty: 4, tag: "one_sound_one_spelling", hook: "word-workshop-pattern-return",
    correct: `Pattern retrieved and checked in ${item.word}.`, repair: "Compare one known contrast word, reveal the target grapheme, then rebuild left to right using generous spacing.",
  });
}

function morphologyCandidate(index) {
  const item = suffixCases[(index * 7 + 4) % suffixCases.length];
  const chunks = morphologyChunks(item);
  return wordCandidate({
    id: `review-morphology-${item.result}-${index + 1}`, blueprint: "spaced-pattern-retrieval", band: "retrieval", concept: "morphology_application",
    prompt: `Morpheme-map mission ${index + 1}: build ${item.result}, then link it to base ${item.base} and suffix -${item.suffix}.`,
    body: { target_word: item.result, base_word: item.base, suffix: item.suffix, build_units: chunks, tiles: rotate(unique([...chunks, item.base, item.suffix, `${item.base}${item.suffix}`]), index % 4), transformation_rule: item.rule, meaning_link: true, review_interval_days: reviewDay(index), interaction_mode: "build_chunks_match_base_suffix_keyboard_switch_or_aac" }, expected: chunks,
    hints: ["Name the base meaning first.", item.instruction], explanation: `${sentenceStart(item.instruction)} to make ${item.result}. The spelling keeps a meaning link to ${item.base}.`, difficulty: 4, tag: "suffix_base_change_omitted", hook: "word-workshop-morpheme-map",
    correct: `Morpheme map linked ${item.result} to ${item.base} + ${item.suffix}.`, repair: "Return to separate BASE, CHANGE and SUFFIX panels and complete one transformation step at a time.",
  });
}

function misconceptionCandidate(index) {
  const cases = [
    { word: "knock", chunks: ["kn", "o", "ck"], claim: "The word can be built as n-o-k because that sounds close enough.", repair: "Use the reviewed word-specific graphemes kn and ck, then check every letter.", tag: "sound_only_choice" },
    { word: "giant", chunks: ["g", "i", "a", "n", "t"], claim: "The /dʒ/ sound must always use dge.", repair: "The reviewed word giant uses g for /dʒ/; one phoneme can have different graphemes.", tag: "one_sound_one_spelling" },
    { word: "happier", chunks: ["happi", "er"], claim: "Add er straight to happy to make happyer.", repair: "Change consonant-plus-y to i before adding er: happi + er.", tag: "suffix_base_change_omitted" },
    { word: "because", chunks: ["be", "cause"], claim: "Choose a word because its outline looks longest.", repair: "Build because from reviewed chunks and compare every grapheme, not its outline.", tag: "word_shape_guess" },
    { word: "wrist", chunks: ["wr", "i", "s", "t"], claim: "The word should begin with r because /r/ is heard.", repair: "The reviewed spelling wrist begins wr; hearing must be checked against word-specific graphemes.", tag: "sound_only_choice" },
  ];
  const item = cases[Math.floor(index / 6) % cases.length];
  const tiles = unique([...item.chunks, ...item.chunks.map((chunk, chunkIndex) => chunkIndex === 0 ? chunk.replace(/^kn|^wr|^g/, "n") || "n" : `${chunk}e`)]);
  return wordCandidate({
    id: `review-repair-${item.word}-${index + 1}`, blueprint: "spaced-pattern-retrieval", band: "retrieval", concept: "spelling_misconception_repair",
    prompt: `Repair-bench mission ${index + 1}: the claim says, “${item.claim}” Rebuild the reviewed word ${item.word}.`,
    body: { target_word: item.word, misconception_claim: item.claim, repair_explanation: item.repair, build_units: item.chunks, tiles: rotate(tiles, index % tiles.length), reviewed_word_card_available_after_attempt: true, review_interval_days: reviewDay(index), interaction_mode: "diagnose_build_keyboard_switch_eye_gaze_or_adult_scribed" }, expected: item.chunks,
    hints: ["Name what is wrong with the claim.", item.repair], explanation: `${item.repair} The repaired build is ${item.chunks.join(" | ")} = ${item.word}.`, difficulty: 4, tag: item.tag, hook: "word-workshop-repair-bench",
    correct: `Misconception repaired and ${item.word} checked grapheme by grapheme.`, repair: "Keep any correct chunks, reveal the decisive grapheme or base change and rebuild one position at a time.",
  });
}

function sortCandidate({ id, blueprint, band, concept, prompt, body, expected, audioWords, hints, explanation, difficulty, tag, hook, correct, repair }) {
  const fullId = `${prefix}${id}`;
  return commonCandidate({ id: fullId, format: "pattern-sort", blueprint, band, concept, prompt, body: { ...body, ...audioForWords(audioWords) }, expected: { value: expected }, hints, explanation, difficulty, tag, hook, correct, repair });
}

function wordCandidate({ id, blueprint, band, concept, prompt, body, expected, audio, hints, explanation, difficulty, tag, hook, correct, repair }) {
  const fullId = `${prefix}${id}`;
  return commonCandidate({ id: fullId, format: "word-build", blueprint, band, concept, prompt, body: { ...body, ...(audio ?? {}) }, expected: { value: expected }, hints, explanation, difficulty, tag, hook, correct, repair });
}

function suffixCandidate({ id, concept, prompt, body, answer, hints, explanation, difficulty, tag, hook, correct, repair }) {
  const fullId = `${prefix}${id}`;
  return commonCandidate({ id: fullId, format: "suffix-transform", blueprint: "year-two-suffix-transformations", band: "secure", concept, prompt, body, expected: { value: answer }, hints, explanation, difficulty, tag, hook, correct, repair });
}

function commonCandidate({ id, format, blueprint, band, concept, prompt, body, expected, hints, explanation, difficulty, tag, hook, correct, repair }) {
  return {
    id,
    format,
    body: {
      prompt, ...body,
      concept_focus: concept,
      response_mode: "tap_drag_keyboard_switch_eye_gaze_aac_oral_or_adult_scribed",
      supported_interaction: "adult_or_peer_may_read scan position tiles and record without supplying the spelling answer",
      dyslexia_support: { one_word_per_row: true, generous_spacing: true, adjustable_font_and_background: true, grapheme_underlining: true, chunked_view: true, line_focus: true, colour_not_required: true },
      phonological_support: { whole_word_first: true, oral_segmenting_allowed: true, sound_boxes_optional: true, no_accent_penalty: true, no_microphone_required: true },
      morphology_support: { base_prefix_suffix_trays: true, meaning_link_visible: true, transformation_steps_separate: true },
      motor_alternative: "tap, keyboard, switch, eye-gaze, partner-assisted scanning or verbal tile order can replace dragging and handwriting",
      audio_policy: body.audio_required ? "required_only_for_listening_target" : "not_referenced_for_this_item",
      reduced_motion: "static_listen_sort_build_check_panels",
      no_timer: true,
      speed_score_allowed: false,
      microphone_required: false,
      retry_without_penalty: true,
      preserve_correct_graphemes: true,
      gamification: { mission: "restore a word bridge, grapheme gate or morpheme map", reward: "one calm word-spark for a checked grapheme or transformation", loss_on_error: false, streak_pressure: false, leaderboard: false, speed_bonus: false, retry_message: "Your correct graphemes stay in place. Open another clue and continue." },
      ssp_programme_mapping: "required_before_pilot",
      difficulty_band: band,
      evidence_purpose: blueprint.replaceAll("-", "_"),
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
    },
    expected_answer: expected,
    hints,
    explanation,
    feedback: { correct, repair, grapheme_evidence: explanation, support_message: "Chunking, pointing, tile placement and adult-scribed responses carry equal evidence; speed and handwriting neatness are not scored." },
    difficulty,
    status: "review",
    misconception_tag: tag,
    animation_hook: hook,
  };
}

function validateBank(currentPack, authored, generated) {
  if (authored.length !== 4) throw new Error(`Expected exactly 4 curated variants, found ${authored.length}. Refusing to overwrite possible authored work.`);
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
    if (!blueprint || variant.format !== blueprint.format || variant.body.difficulty_band !== blueprint.difficulty_band) throw new Error(`${variant.id} does not match its blueprint.`);
    if (variant.status !== "review" || variant.body.review_batch !== reviewBatch) throw new Error(`${variant.id} must remain in review.`);
    if (!variant.body.dyslexia_support?.grapheme_underlining || !variant.body.dyslexia_support?.chunked_view || !variant.body.phonological_support?.whole_word_first || !variant.body.motor_alternative || !variant.body.supported_interaction) throw new Error(`${variant.id} lacks SEND support.`);
    if (!variant.body.response_mode.includes("keyboard") || !variant.body.response_mode.includes("switch") || !variant.body.response_mode.includes("eye_gaze") || !variant.body.response_mode.includes("aac")) throw new Error(`${variant.id} lacks supported responses.`);
    if (variant.body.no_timer !== true || variant.body.speed_score_allowed !== false || variant.body.microphone_required !== false || variant.body.gamification?.streak_pressure !== false || variant.body.gamification?.loss_on_error !== false) throw new Error(`${variant.id} introduces pressure.`);
    if (!variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.grapheme_evidence || !variant.feedback?.support_message) throw new Error(`${variant.id} lacks rich feedback.`);
    if (variant.body.audio_required) {
      if (variant.body.audio_provider !== "ElevenLabs" || variant.body.audio_asset_status !== "required_human_listening_review" || variant.body.specialist_review_status !== "ssp_review_required" || variant.body.human_listening_approval_required !== true || variant.body.browser_tts_allowed !== false || variant.body.browser_tts_fallback !== "prohibited") throw new Error(`${variant.id} violates reviewed-audio policy.`);
    } else if (variant.body.audio_asset_id || variant.body.whole_word_audio_asset_ids) {
      throw new Error(`${variant.id} references audio where hearing is not required.`);
    }
    if (variant.format === "pattern-sort") {
      const expected = variant.expected_answer.value;
      const assigned = Object.values(expected).flat();
      if (assigned.length !== variant.body.words.length || new Set(assigned).size !== assigned.length || assigned.some((word) => !variant.body.words.includes(word))) throw new Error(`${variant.id} has an invalid sort key.`);
    } else if (variant.format === "word-build") {
      if (!Array.isArray(variant.expected_answer.value) || variant.expected_answer.value.length < 2 || !Array.isArray(variant.body.tiles)) throw new Error(`${variant.id} has an invalid build key.`);
    } else {
      const choices = variant.body.choices;
      if (!Array.isArray(choices) || choices.length < 3 || new Set(choices).size !== choices.length || !choices.includes(variant.expected_answer.value)) throw new Error(`${variant.id} has invalid suffix choices.`);
    }
    if (variant.body.prompt.length > 170) throw new Error(`${variant.id} prompt is too long for Year 2.`);
  }
  const allocation = countBy(currentPack.question_variants, (variant) => variant.body.variant_blueprint_id);
  for (const [id, expected] of Object.entries(pilotAllocation)) if (allocation[id] !== expected) throw new Error(`${id} expected ${expected}, found ${allocation[id] ?? 0}.`);
  const concepts = new Set(generated.map((variant) => variant.body.concept_focus));
  for (const concept of ["heard_word_grapheme_sort", "same_phoneme_different_graphemes", "segment_and_build_taught_word", "suffix_keep", "suffix_y_to_i", "suffix_drop_e", "suffix_double_final", "common_exception_word_retrieval", "dictation_application", "prefix_un_morphology", "morphology_application", "spelling_misconception_repair"]) if (!concepts.has(concept)) throw new Error(`Missing concept ${concept}.`);
}

function pattern(id, phoneme, columns, groups, explanation) { return { id, phoneme, columns, groups, explanation }; }
function build(word, units, patternText, phoneme, tiles) { return { word, units, pattern: patternText, phoneme, tiles }; }
function suffix(base, suffixText, result, instruction, rule) { return { base, suffix: suffixText, result, instruction, rule }; }
function exceptionWord(word, chunks) { return { word, chunks }; }
function audioForWords(words) { return { audio_required: true, whole_word_audio_asset_ids: words.map((word) => `word-${slug(word)}`), audio_provider: "ElevenLabs", audio_asset_status: "required_human_listening_review", specialist_review_status: "ssp_review_required", human_listening_approval_required: true, browser_tts_allowed: false, browser_tts_fallback: "prohibited", unavailable_audio_state: "honest_not_ready_no_listening_assessment", pure_phoneme_audio_referenced: false, audio_replay_unlimited: true }; }
function audioForWord(word) { return { audio_required: true, audio_asset_id: `word-${slug(word)}`, audio_provider: "ElevenLabs", audio_asset_status: "required_human_listening_review", specialist_review_status: "ssp_review_required", human_listening_approval_required: true, browser_tts_allowed: false, browser_tts_fallback: "prohibited", unavailable_audio_state: "honest_not_ready_no_listening_assessment", pure_phoneme_audio_referenced: false, audio_replay_unlimited: true }; }
function audioForSentence(word, sentence) { return { audio_required: true, audio_asset_id: `dictation-${slug(word)}-${hashText(sentence)}`, audio_provider: "ElevenLabs", audio_asset_status: "required_human_listening_review", specialist_review_status: "ssp_review_required", human_listening_approval_required: true, browser_tts_allowed: false, browser_tts_fallback: "prohibited", unavailable_audio_state: "honest_not_ready_no_dictation_assessment", pure_phoneme_audio_referenced: false, audio_replay_unlimited: true }; }
function suffixChoices(item) { const choices = [item.result, `${item.base}${item.suffix}`, item.rule === "y_to_i" ? `${item.base.slice(0, -1)}${item.suffix}` : `${item.base.slice(0, -1)}${item.suffix}`, `${item.base}${item.suffix}e`]; for (let n = 1; new Set(choices).size < 4; n += 1) choices.push(`${item.result}${n}`); return [...new Set(choices)].slice(0, 4); }
function transformationSteps(item) { return ["show base word", item.instruction, `check ${item.result}`]; }
function suffixConcept(rule) { return { keep: "suffix_keep", keep_y_after_vowel: "suffix_keep", keep_e: "suffix_keep", keep_y_ing: "suffix_keep", y_to_i: "suffix_y_to_i", drop_e: "suffix_drop_e", double_final: "suffix_double_final" }[rule]; }
function suffixHook(rule) { return { y_to_i: "word-workshop-y-to-i", drop_e: "word-workshop-drop-e", double_final: "word-workshop-double-final" }[rule] ?? "word-workshop-keep-base"; }
function morphologyChunks(item) { if (item.rule === "y_to_i") return [item.base.slice(0, -1) + "i", item.suffix]; if (item.rule === "drop_e") return [item.base.slice(0, -1), item.suffix]; if (item.rule === "double_final") return [item.base + item.base.at(-1), item.suffix]; return [item.base, item.suffix]; }
function exceptionDistractors(item) { return item.chunks.map((chunk, index) => index === 0 ? `${chunk}e` : `${chunk}a`).filter((chunk) => !item.chunks.includes(chunk)); }
function reviewDay(index) { return [1, 3, 7, 14, 30][index % 5]; }
function hashText(value) { let hash = 0; for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0; return hash.toString(36); }
function sentenceStart(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function unique(items) { return [...new Set(items)]; }
function slug(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function normalise(value) { return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " "); }
function countBy(items, keyFor) { const result = {}; for (const item of items) { const key = keyFor(item); result[key] = (result[key] ?? 0) + 1; } return result; }
function summary(items, keyFor) { return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
