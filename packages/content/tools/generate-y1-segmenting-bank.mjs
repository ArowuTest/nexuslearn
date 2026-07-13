#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packPath = path.resolve(argValue("--pack") ?? path.join(repoRoot, "packages/content/packs/en-y1-segmenting.pack.sample.json"));
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "en-y1-segmenting-bank-";
const reviewBatch = "y1-segmenting-pilot-a";
const allocation = {
  "oral-cvc-sound-counts": 48,
  "cvc-counter-segmenting": 48,
  "known-gpc-sound-box-builds": 48,
  "phoneme-position-contrast": 48,
  "spaced-segment-and-build-retrieval": 48,
};

const words = [
  w("at", ["a", "t"], ["/a/", "/t/"], "VC"), w("in", ["i", "n"], ["/i/", "/n/"], "VC"),
  w("on", ["o", "n"], ["/o/", "/n/"], "VC"), w("up", ["u", "p"], ["/u/", "/p/"], "VC"),
  w("it", ["i", "t"], ["/i/", "/t/"], "VC"), w("am", ["a", "m"], ["/a/", "/m/"], "VC"),
  w("sun", ["s", "u", "n"], ["/s/", "/u/", "/n/"], "CVC"), w("map", ["m", "a", "p"], ["/m/", "/a/", "/p/"], "CVC"),
  w("dog", ["d", "o", "g"], ["/d/", "/o/", "/g/"], "CVC"), w("cat", ["c", "a", "t"], ["/k/", "/a/", "/t/"], "CVC"),
  w("hat", ["h", "a", "t"], ["/h/", "/a/", "/t/"], "CVC"), w("cap", ["c", "a", "p"], ["/k/", "/a/", "/p/"], "CVC"),
  w("tap", ["t", "a", "p"], ["/t/", "/a/", "/p/"], "CVC"), w("mat", ["m", "a", "t"], ["/m/", "/a/", "/t/"], "CVC"),
  w("mop", ["m", "o", "p"], ["/m/", "/o/", "/p/"], "CVC"), w("cot", ["c", "o", "t"], ["/k/", "/o/", "/t/"], "CVC"),
  w("dot", ["d", "o", "t"], ["/d/", "/o/", "/t/"], "CVC"), w("log", ["l", "o", "g"], ["/l/", "/o/", "/g/"], "CVC"),
  w("fan", ["f", "a", "n"], ["/f/", "/a/", "/n/"], "CVC"), w("fin", ["f", "i", "n"], ["/f/", "/i/", "/n/"], "CVC"),
  w("bed", ["b", "e", "d"], ["/b/", "/e/", "/d/"], "CVC"), w("bid", ["b", "i", "d"], ["/b/", "/i/", "/d/"], "CVC"),
  w("fish", ["f", "i", "sh"], ["/f/", "/i/", "/ʃ/"], "CVC-digraph"), w("dish", ["d", "i", "sh"], ["/d/", "/i/", "/ʃ/"], "CVC-digraph"),
  w("ship", ["sh", "i", "p"], ["/ʃ/", "/i/", "/p/"], "CVC-digraph"), w("shop", ["sh", "o", "p"], ["/ʃ/", "/o/", "/p/"], "CVC-digraph"),
  w("chip", ["ch", "i", "p"], ["/tʃ/", "/i/", "/p/"], "CVC-digraph"), w("chop", ["ch", "o", "p"], ["/tʃ/", "/o/", "/p/"], "CVC-digraph"),
  w("thin", ["th", "i", "n"], ["/θ/", "/i/", "/n/"], "CVC-digraph"), w("ring", ["r", "i", "ng"], ["/r/", "/i/", "/ŋ/"], "CVC-digraph"),
  w("rain", ["r", "ai", "n"], ["/r/", "/eɪ/", "/n/"], "CVC-digraph"), w("main", ["m", "ai", "n"], ["/m/", "/eɪ/", "/n/"], "CVC-digraph"),
  w("boat", ["b", "oa", "t"], ["/b/", "/əʊ/", "/t/"], "CVC-digraph"), w("goat", ["g", "oa", "t"], ["/g/", "/əʊ/", "/t/"], "CVC-digraph"),
  w("feet", ["f", "ee", "t"], ["/f/", "/iː/", "/t/"], "CVC-digraph"), w("book", ["b", "oo", "k"], ["/b/", "/ʊ/", "/k/"], "CVC-digraph"),
  w("night", ["n", "igh", "t"], ["/n/", "/aɪ/", "/t/"], "CVC-trigraph"), w("light", ["l", "igh", "t"], ["/l/", "/aɪ/", "/t/"], "CVC-trigraph"),
  w("chair", ["ch", "air"], ["/tʃ/", "/eə/"], "CC-trigraph"), w("fair", ["f", "air"], ["/f/", "/eə/"], "CV-trigraph"),
  w("frog", ["f", "r", "o", "g"], ["/f/", "/r/", "/o/", "/g/"], "CCVC"), w("stop", ["s", "t", "o", "p"], ["/s/", "/t/", "/o/", "/p/"], "CCVC"),
  w("clap", ["c", "l", "a", "p"], ["/k/", "/l/", "/a/", "/p/"], "CCVC"), w("crab", ["c", "r", "a", "b"], ["/k/", "/r/", "/a/", "/b/"], "CCVC"),
  w("swim", ["s", "w", "i", "m"], ["/s/", "/w/", "/i/", "/m/"], "CCVC"), w("drum", ["d", "r", "u", "m"], ["/d/", "/r/", "/u/", "/m/"], "CCVC"),
  w("flag", ["f", "l", "a", "g"], ["/f/", "/l/", "/a/", "/g/"], "CCVC"), w("trip", ["t", "r", "i", "p"], ["/t/", "/r/", "/i/", "/p/"], "CCVC"),
  w("milk", ["m", "i", "l", "k"], ["/m/", "/i/", "/l/", "/k/"], "CVCC"), w("hand", ["h", "a", "n", "d"], ["/h/", "/a/", "/n/", "/d/"], "CVCC"),
  w("tent", ["t", "e", "n", "t"], ["/t/", "/e/", "/n/", "/t/"], "CVCC"), w("lamp", ["l", "a", "m", "p"], ["/l/", "/a/", "/m/", "/p/"], "CVCC"),
  w("nest", ["n", "e", "s", "t"], ["/n/", "/e/", "/s/", "/t/"], "CVCC"), w("jump", ["j", "u", "m", "p"], ["/dʒ/", "/u/", "/m/", "/p/"], "CVCC"),
  w("pond", ["p", "o", "n", "d"], ["/p/", "/o/", "/n/", "/d/"], "CVCC"), w("belt", ["b", "e", "l", "t"], ["/b/", "/e/", "/l/", "/t/"], "CVCC"),
  w("brush", ["b", "r", "u", "sh"], ["/b/", "/r/", "/u/", "/ʃ/"], "CCVC-digraph"), w("chest", ["ch", "e", "s", "t"], ["/tʃ/", "/e/", "/s/", "/t/"], "CVCC-digraph"),
  w("lunch", ["l", "u", "n", "ch"], ["/l/", "/u/", "/n/", "/tʃ/"], "CVCC-digraph"), w("paint", ["p", "ai", "n", "t"], ["/p/", "/eɪ/", "/n/", "/t/"], "CVCC-digraph"),
  w("toast", ["t", "oa", "s", "t"], ["/t/", "/əʊ/", "/s/", "/t/"], "CVCC-digraph"),
  w("crisp", ["c", "r", "i", "s", "p"], ["/k/", "/r/", "/i/", "/s/", "/p/"], "CCVCC"),
  w("stamp", ["s", "t", "a", "m", "p"], ["/s/", "/t/", "/a/", "/m/", "/p/"], "CCVCC"),
  w("plant", ["p", "l", "a", "n", "t"], ["/p/", "/l/", "/a/", "/n/", "/t/"], "CCVCC"),
  w("clamp", ["c", "l", "a", "m", "p"], ["/k/", "/l/", "/a/", "/m/", "/p/"], "CCVCC"),
  w("trust", ["t", "r", "u", "s", "t"], ["/t/", "/r/", "/u/", "/s/", "/t/"], "CCVCC"),
  w("spent", ["s", "p", "e", "n", "t"], ["/s/", "/p/", "/e/", "/n/", "/t/"], "CCVCC"),
  w("twist", ["t", "w", "i", "s", "t"], ["/t/", "/w/", "/i/", "/s/", "/t/"], "CCVCC"),
  w("grand", ["g", "r", "a", "n", "d"], ["/g/", "/r/", "/a/", "/n/", "/d/"], "CCVCC"),
  w("frost", ["f", "r", "o", "s", "t"], ["/f/", "/r/", "/o/", "/s/", "/t/"], "CCVCC"),
  w("blink", ["b", "l", "i", "n", "k"], ["/b/", "/l/", "/i/", "/n/", "/k/"], "CCVCC"),
];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "en-y1-segmenting") throw new Error("This generator only supports the Year 1 segmenting pack.");
const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedSnapshot = JSON.stringify(curated);
const curatedBlueprint = new Map([
  ["en-y1-segmenting-q-sun-count", "oral-cvc-sound-counts"],
  ["en-y1-segmenting-q-map-middle", "cvc-counter-segmenting"],
  ["en-y1-segmenting-q-dog-build", "known-gpc-sound-box-builds"],
]);
const curatedCounts = countBy(curated, (variant) => variant.body?.variant_blueprint_id ?? curatedBlueprint.get(variant.id));
const target = Object.fromEntries(Object.entries(allocation).map(([id, count]) => [id, count - (curatedCounts[id] ?? 0)]));
for (const [id, count] of Object.entries(target)) if (count < 0) throw new Error(`Curated variants exceed allocation for ${id}.`);

const generated = [
  ...countCandidates(target["oral-cvc-sound-counts"]),
  ...segmentCandidates(target["cvc-counter-segmenting"]),
  ...buildCandidates(target["known-gpc-sound-box-builds"]),
  ...positionCandidates(target["phoneme-position-contrast"]),
  ...retrievalCandidates(target["spaced-segment-and-build-retrieval"]),
];
pack.question_variants = [...curated, ...generated].map((variant) => variant.id === "en-y1-segmenting-q-map-middle" ? { ...variant, body: { ...variant.body, choices: ["first_box", "middle_box", "last_box"] } } : variant);
pack.version = "0.2.0";
pack.qa.notes = "Review-stage Year 1 segmenting pack with a deterministic 240-variant pilot bank. Three curated variants are unchanged. Generated tasks progress through two to five phonemes, CVC, CCVC, CVCC and SSP-taught digraph/trigraph handling; use sound buttons and phoneme frames; distinguish blending from segmenting; identify initial, medial and final phonemes; transfer to word building and spelling; repair misconceptions; and revisit learning through spaced retrieval. Every task is untimed and offers dyslexia/SEND visual, chunked, tap, keyboard, switch, eye-gaze and adult-scribed routes without mandatory speech or handwriting. Listening-dependent generated tasks reference ElevenLabs whole-word assets held for human/SSP listening review; browser TTS and automatic speech scoring are prohibited. SSP progression, accent, teacher, SEND and renderer review remain required before promotion.";

validateBank(pack, curated, curatedSnapshot, generated, curatedBlueprint);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y1-segmenting-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y1-segmenting-bank blueprints=${summary(pack.question_variants, (v) => v.body?.variant_blueprint_id ?? curatedBlueprint.get(v.id))}`);
console.log(`y1-segmenting-bank formats=${summary(pack.question_variants, (v) => v.format)}`);
console.log(`y1-segmenting-bank phoneme_counts=${summary(generated, (v) => v.body?.phoneme_count ?? v.body?.sound_boxes ?? "contrast")}`);
console.log(`y1-segmenting-bank concepts=${summary(generated, (v) => v.body.concept_focus)}`);
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y1-segmenting-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 1 segmenting bank is out of date; run generate-y1-segmenting-bank.mjs --write.");
  console.log("y1-segmenting-bank deterministic check passed");
} else console.log("y1-segmenting-bank dry-run; pass --write to update the pack");

function countCandidates(count) {
  return Array.from({ length: count }, (_, i) => {
    const item = wordAt(i, 0);
    return candidate({
      id: `count-${item.word}-${i + 1}`, format: "phoneme-count", blueprint: "oral-cvc-sound-counts", band: "intro",
      concept: i % 4 === 3 ? "digraph_or_trigraph_counts_as_one_phoneme" : "oral_phoneme_count",
      prompt: `Sound-garden mission ${i + 1}: hear “${item.word}”, then place one counter for each phoneme.`, item,
      body: { choices: countChoices(item.units.length, i), sound_buttons: item.units.map(() => "one_button"), picture_reveal: "after_first_listen", interaction_mode: "tap_counter_keyboard_switch_eye_gaze_or_direct_adult" },
      expected: { value: item.units.length, ordered_phonemes: item.phonemes }, audioWords: [item.word], difficulty: difficulty(item), tag: item.units.some((u) => u.length > 1) ? "letters_counted_not_phonemes" : "whole_word_repeated",
      hints: ["Hear the whole word once, then move one counter for each sound.", digraphHint(item)],
      explanation: `${cap(item.word)} has ${item.units.length} phonemes: ${item.phonemes.join(" – ")}. ${graphemeNote(item)}`,
      correct: `${item.units.length} separate phonemes represented in left-to-right order.`, repair: "Hide the letters, replay the reviewed whole word and reveal one empty frame at a time. Move one counter per heard phoneme, not one per written letter.", hook: "sound-garden-counter-path",
    });
  });
}

function segmentCandidates(count) {
  return Array.from({ length: count }, (_, i) => {
    const item = wordAt(i, 7);
    const focus = ["all", "initial", "medial", "final"][i % 4];
    const index = focusIndex(focus, item.units.length);
    return candidate({
      id: `segment-${item.word}-${focus}-${i + 1}`, format: "oral-segment", blueprint: "cvc-counter-segmenting", band: "developing",
      concept: focus === "all" ? "segment_not_blend" : `${focus}_phoneme_identification`,
      prompt: focus === "all" ? `Sound-train mission ${i + 1}: hear “${item.word}” and give every phoneme its own carriage.` : `Sound-train mission ${i + 1}: segment “${item.word}”, then find the ${focus} phoneme.`, item,
      body: { sound_boxes: item.units.length, focus_position: focus, selected_box: index + 1, sound_buttons: item.units.map((_, n) => ({ position: n + 1, label: "sound" })), segment_then_blend_check: true, interaction_mode: "tap_push_keyboard_switch_eye_gaze_aac_or_adult_observed" },
      expected: { value: item.phonemes, focus_phoneme: item.phonemes[index] }, audioWords: [item.word], difficulty: difficulty(item) + 1, tag: focus === "medial" ? "middle_phoneme_omitted" : "blend_given_instead_of_segment",
      hints: ["Segment means show the sounds separately; blend means sweep them back into the whole word.", `Touch ${item.units.length} frames from left to right.`],
      explanation: `${cap(item.word)} segments into ${item.phonemes.join(" – ")}; the ${focus === "all" ? "sounds stay separate before the blend check" : `${focus} phoneme is ${item.phonemes[index]}`}.`,
      correct: "Each phoneme has one ordered frame; the whole-word blend is checked only after segmenting.", repair: "Keep the whole-word card above the frame. Model separate counters first, then sweep beneath them once to show that blending is the reverse action.", hook: "sound-train-carriages",
    });
  });
}

function buildCandidates(count) {
  return Array.from({ length: count }, (_, i) => {
    const item = wordAt(i, 13);
    return candidate({
      id: `build-${item.word}-${i + 1}`, format: "sound-box-build", blueprint: "known-gpc-sound-box-builds", band: "expected", concept: "segment_to_spelling_transfer",
      prompt: `Word-workshop mission ${i + 1}: hear “${item.word}”, segment it, then replace each counter with one taught grapheme tile.`, item,
      body: { sound_boxes: item.units.length, tiles: rotate(unique([...item.units, ...distractorTiles(item)]), i % (item.units.length + 2)), build_units: item.units, sound_buttons: item.units.map((unit, n) => ({ position: n + 1, grapheme_reveal: unit })), one_grapheme_tile_may_have_multiple_letters: true, interaction_mode: "tap_drag_keyboard_switch_eye_gaze_or_direct_adult_tiles" },
      expected: { value: item.units }, audioWords: [item.word], difficulty: difficulty(item) + 1, tag: item.units.some((u) => u.length > 1) ? "digraph_split_across_boxes" : "grapheme_order_changed",
      hints: ["Use counters first so spelling does not replace listening.", `${graphemeNote(item)} Build from the first frame to the last.`],
      explanation: `${cap(item.word)} has ${item.units.length} phonemes and builds as ${item.units.join(" | ")}. ${graphemeNote(item)}`,
      correct: `Phonemes mapped in order to ${item.units.join(" | ")}.`, repair: "Keep correctly placed tiles. Return only the uncertain frame to a counter, replay the reviewed word and compare the taught grapheme card before replacing it.", hook: "word-workshop-frame-build",
    });
  });
}

function positionCandidates(count) {
  const pairs = minimalPairs();
  return Array.from({ length: count }, (_, i) => {
    const pair = pairs[i % pairs.length];
    const [a, b] = pair.words;
    const label = pair.index === 0 ? "initial" : pair.index === a.units.length - 1 ? "final" : "medial";
    return candidate({
      id: `contrast-${a.word}-${b.word}-${i + 1}`, format: "phoneme-count", blueprint: "phoneme-position-contrast", band: "secure", concept: `${label}_phoneme_contrast`,
      prompt: `Sound-detective mission ${i + 1}: hear “${a.word}” and “${b.word}”. Which phoneme position changed?`, item: a,
      body: { comparison_words: [a.word, b.word], comparison_frames: [a.phonemes, b.phonemes], choices: ["initial", "medial", "final"], changed_position: label, changed_phonemes: [a.phonemes[pair.index], b.phonemes[pair.index]], phoneme_count: a.units.length, interaction_mode: "tap_position_keyboard_switch_eye_gaze_point_or_aac" },
      expected: { value: label, changed_phonemes: [a.phonemes[pair.index], b.phonemes[pair.index]] }, audioWords: [a.word, b.word], difficulty: 4 + (a.units.length >= 4 ? 1 : 0), tag: "word_meaning_used_instead_of_sound_position",
      hints: ["Place both words in matching phoneme frames.", "Compare one frame at a time from left to right; keep matching sounds still."],
      explanation: `${cap(a.word)} and ${b.word} each have ${a.units.length} phonemes. Only the ${label} phoneme changes: ${a.phonemes[pair.index]} becomes ${b.phonemes[pair.index]}.`,
      correct: `${label} position identified by aligned phoneme evidence.`, repair: "Replay both reviewed words separately, align equal-length frames and cover every matching box. Name or point to the one uncovered position.", hook: "sound-detective-lantern",
    });
  });
}

function retrievalCandidates(count) {
  const modes = ["buttons", "missing", "blend", "spell", "position", "review"];
  return Array.from({ length: count }, (_, i) => {
    const item = wordAt(i, 23);
    const mode = modes[i % modes.length];
    const common = { item, audioWords: [], difficulty: Math.min(6, difficulty(item) + 1), blueprint: "spaced-segment-and-build-retrieval", band: "retrieval", hook: "memory-map-return", reviewDay: [1, 3, 7, 14, 30][i % 5] };
    if (mode === "buttons") return candidate({ ...common, id: `review-buttons-${item.word}-${i + 1}`, format: "phoneme-count", concept: "sound_button_grapheme_grouping", prompt: `Memory-map mission ${i + 1}: add one sound button per phoneme under the reviewed word ${item.word}.`, body: { printed_word: item.word, grapheme_groups: item.units, sound_button_count: item.units.length, no_audio_needed: true, interaction_mode: "tap_buttons_keyboard_switch_eye_gaze_or_direct_adult" }, expected: { value: item.units.length, groups: item.units }, tag: "button_per_letter", hints: ["A sound button belongs to a phoneme, not automatically to each letter.", digraphHint(item)], explanation: `${cap(item.word)} needs ${item.units.length} sound buttons under ${item.units.join(" | ")}.`, correct: "Sound buttons match phonemes and keep multi-letter graphemes together.", repair: "Draw grapheme loops first, then place one button beneath each loop. Keep colour optional and use raised counters if preferred." });
    if (mode === "missing") { const n = middleIndex(item.units.length); return candidate({ ...common, id: `review-missing-${item.word}-${i + 1}`, format: "oral-segment", concept: "missing_phoneme_repair", prompt: `Repair-cave mission ${i + 1}: one frame is empty in ${item.word}. Choose the missing phoneme.`, body: { target_word_card: item.word, frame_pattern: item.phonemes.map((p, x) => x === n ? "?" : p), missing_position: n + 1, choices: unique([item.phonemes[n], item.phonemes[0], item.phonemes.at(-1)]), no_audio_needed: true, interaction_mode: "tap_choice_keyboard_switch_eye_gaze_aac_or_adult_scribed" }, expected: { value: item.phonemes[n] }, tag: "middle_phoneme_omitted", hints: ["Touch the frames before and after the gap.", `The missing sound is in frame ${n + 1}.`], explanation: `${item.phonemes[n]} completes ${item.phonemes.join(" – ")} for ${item.word}.`, correct: "Missing phoneme restored without moving correct frames.", repair: "Preserve every correct frame, outline the gap and compare only two phoneme cards." }); }
    if (mode === "blend") return candidate({ ...common, id: `review-blend-${item.word}-${i + 1}`, format: "oral-segment", concept: "blend_versus_segment_repair", prompt: `Robot-radio mission ${i + 1}: which card segments ${item.word} instead of blending it?`, body: { target_word_card: item.word, choices: [{ label: item.phonemes.join(" – "), action: "segment" }, { label: item.word, action: "blend" }], no_audio_needed: true, interaction_mode: "tap_card_keyboard_switch_eye_gaze_point_or_aac" }, expected: { value: "segment" }, tag: "blend_given_instead_of_segment", hints: ["Segmenting keeps every phoneme separate.", "Blending joins the sounds to say the whole word."], explanation: `${item.phonemes.join(" – ")} is the segmented form; ${item.word} is the blended whole word.`, correct: "Separate phonemes distinguished from the whole-word blend.", repair: "Place counters with gaps for segment, then sweep beneath them for blend. Let the child point rather than speak." });
    if (mode === "spell") return candidate({ ...common, id: `review-spell-${item.word}-${i + 1}`, format: "sound-box-build", concept: "spelling_transfer_without_audio", prompt: `Message-builder mission ${i + 1}: use the picture and reviewed word card, cover the card, then rebuild ${item.word} in phoneme frames.`, body: { target_word: item.word, picture_label_confirmed: true, study_cover_build_check: true, build_units: item.units, tiles: rotate(unique([...item.units, ...distractorTiles(item)]), i % 3), sound_boxes: item.units.length, no_audio_needed: true, handwriting_not_required: true, interaction_mode: "tap_tiles_keyboard_switch_eye_gaze_or_direct_adult" }, expected: { value: item.units }, tag: "letter_string_not_phoneme_mapped", hints: ["Study the grapheme groups before covering the card.", "Build one phoneme frame at a time, then uncover and check."], explanation: `${cap(item.word)} transfers to spelling as ${item.units.join(" | ")}; each unit fills one phoneme frame.`, correct: "Spelling rebuilt and checked through phoneme-to-grapheme mapping.", repair: "Uncover only the uncertain grapheme group, trace it visually or tactually, cover it again and replace that tile without losing correct work." });
    if (mode === "position") { const n = [0, middleIndex(item.units.length), item.units.length - 1][Math.floor(i / 6) % 3]; const label = n === 0 ? "initial" : n === item.units.length - 1 ? "final" : "medial"; return candidate({ ...common, id: `review-position-${item.word}-${label}-${i + 1}`, format: "phoneme-count", concept: `${label}_phoneme_retrieval`, prompt: `Compass mission ${i + 1}: point to the ${label} phoneme in the reviewed frame for ${item.word}.`, body: { target_word_card: item.word, phoneme_frame: item.phonemes, target_position: label, no_audio_needed: true, interaction_mode: "tap_frame_keyboard_switch_eye_gaze_point_or_aac" }, expected: { value: item.phonemes[n], box: n + 1 }, tag: "position_label_reversed", hints: ["Initial means first; final means last; medial means inside the word.", "Track the frame from left to right."], explanation: `The ${label} phoneme in ${item.word} is ${item.phonemes[n]}, in frame ${n + 1}.`, correct: `${label} phoneme located in the ordered frame.`, repair: "Add a start flag and finish flag, then reduce the choice to the requested edge or inside frame." }); }
    return candidate({ ...common, id: `review-audio-${item.word}-${i + 1}`, format: "sound-box-build", concept: "spaced_oral_segment_and_build", prompt: `Echo-orbit mission ${i + 1}: after ${common.reviewDay} days, hear “${item.word}”, segment it and rebuild it.`, body: { sound_boxes: item.units.length, build_units: item.units, tiles: rotate(unique([...item.units, ...distractorTiles(item)]), i % 4), interaction_mode: "tap_drag_keyboard_switch_eye_gaze_or_direct_adult_tiles" }, expected: { value: item.units }, audioWords: [item.word], tag: "retrieval_order_changed", hints: ["Replay is unlimited and does not lower the result.", "Use counters before grapheme tiles if the sequence feels crowded."], explanation: `${cap(item.word)} has ${item.units.length} phonemes and builds as ${item.units.join(" | ")}. This return checks memory, not speed.`, correct: `Spaced retrieval retained the ordered phoneme-grapheme map.`, repair: "Return to the last successful support level: whole word, counters, then one grapheme at a time. Retry without penalty." });
  });
}

function candidate({ id, format, blueprint, band, concept, prompt, item, body, expected, audioWords = [], difficulty: level, tag, hints, explanation, correct, repair, hook, reviewDay }) {
  const audio = audioWords.length ? audioFor(audioWords) : { audio_required: false, audio_route: "not_needed_static_visual_or_adult_led_task" };
  return {
    id: `${prefix}${id}`, format,
    body: {
      prompt, target_word: body.target_word ?? item?.word, phoneme_units: item?.units, phoneme_ids: item?.phonemes, phoneme_count: item?.units.length, word_structure: item?.structure,
      ...body, ...(format === "oral-segment" && Array.isArray(expected.value) ? { tiles: expected.value } : {}), ...(format === "oral-segment" && Array.isArray(body.choices) && body.choices.every((item) => item && typeof item === "object") ? { choices: body.choices.map((item) => item.action ?? item.label).filter(Boolean) } : {}), ...audio, concept_focus: concept, variant_blueprint_id: blueprint, difficulty_band: band, review_interval_days: reviewDay,
      response_mode: "tap_keyboard_switch_eye_gaze_aac_point_or_adult_scribed",
      supported_interaction: "An adult or peer may replay, scan choices, move named counters or record the child's indicated answer without supplying a phoneme.",
      dyslexia_support: { one_word_per_panel: true, grapheme_chunking: true, visual_phoneme_frames: true, generous_spacing: true, adjustable_font_and_background: true, colour_not_required: true },
      visual_route: "Static whole-word or picture anchor above numbered left-to-right phoneme frames with optional sound buttons.",
      tactile_route: "Use counters, bottle tops or raised frame cards; say the whole word only if comfortable and never require touch materials.",
      processing_route: "Pause after the whole word, reveal one frame at a time and allow unlimited replay or adult repetition.",
      motor_alternative: "Tap, keyboard, switch scan, eye gaze, AAC, pointing or adult-scribed placement can replace dragging, speech and handwriting.",
      no_timer: true, speed_score_allowed: false, microphone_required: false, handwriting_required: false, retry_without_penalty: true, preserve_correct_work: true,
      gamification: { mission: "help the sound-garden crew map a word path", reward: "one calm sound-star for careful listening or checking", lives: false, loss_on_error: false, streaks: false, leaderboard: false, speed_bonus: false, retry_message: "Your correct frames stay. Open one clue and keep exploring." },
      evidence_purpose: concept, review_batch: reviewBatch,
    },
    expected_answer: expected, hints, explanation,
    feedback: { correct, repair, phoneme_evidence: explanation, support_message: "Pointing, counters, eye gaze, switch selection, AAC and adult-scribed responses carry equal evidence. Speech, handwriting and speed are not scored." },
    difficulty: Math.min(6, level), status: "review", misconception_tag: tag, animation_hook: hook,
  };
}

function audioFor(targetWords) {
  return {
    audio_required: true, audio_purpose: targetWords.length === 1 ? "hear_reviewed_whole_word_for_segmentation" : "compare_reviewed_whole_words",
    whole_word_audio_asset_ids: targetWords.map((word) => `word-${word}`), audio_provider: "ElevenLabs",
    audio_asset_status: "required_human_ssp_listening_review", human_listening_approval_required: true, ssp_specialist_approval_required: true,
    pure_phoneme_audio_used: false, browser_tts_allowed: false, browser_tts_fallback: "prohibited", automatic_speech_scoring: false,
    unavailable_audio_state: "honest_not_ready_use_adult_led_whole_word_or_choose_non_audio_route", audio_replay_unlimited: true,
  };
}

function validateBank(pack, curated, snapshot, generated, curatedBlueprint) {
  if (curated.length !== 3) throw new Error(`Expected 3 curated variants, found ${curated.length}.`);
  if (JSON.stringify(curated) !== snapshot) throw new Error("Curated variants changed during generation.");
  if (pack.question_variants.length !== 240 || generated.length !== 237) throw new Error("Pilot must contain 3 curated and 237 generated variants.");
  const ids = pack.question_variants.map((v) => v.id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate variant IDs found.");
  const counts = countBy(pack.question_variants, (v) => v.body?.variant_blueprint_id ?? curatedBlueprint.get(v.id));
  for (const [id, expected] of Object.entries(allocation)) if (counts[id] !== expected) throw new Error(`${id} expected ${expected}, found ${counts[id] ?? 0}.`);
  const phonemeCounts = new Set(generated.map((v) => v.body.phoneme_count).filter(Boolean));
  for (const n of [2, 3, 4, 5]) if (!phonemeCounts.has(n)) throw new Error(`Missing ${n}-phoneme coverage.`);
  const structures = new Set(generated.map((v) => v.body.word_structure));
  for (const s of ["CVC", "CCVC", "CVCC", "CCVCC", "CVC-digraph", "CVC-trigraph"]) if (!structures.has(s)) throw new Error(`Missing structure ${s}.`);
  const concepts = new Set(generated.map((v) => v.body.concept_focus));
  for (const c of ["segment_not_blend", "initial_phoneme_identification", "medial_phoneme_identification", "final_phoneme_identification", "segment_to_spelling_transfer", "blend_versus_segment_repair", "spaced_oral_segment_and_build"]) if (!concepts.has(c)) throw new Error(`Missing concept ${c}.`);
  for (const v of generated) {
    const b = v.body;
    if (!b.dyslexia_support?.grapheme_chunking || !b.dyslexia_support?.visual_phoneme_frames || !b.supported_interaction || !b.visual_route || !b.motor_alternative) throw new Error(`Missing SEND route in ${v.id}.`);
    if (!v.feedback?.correct || !v.feedback?.repair || !v.feedback?.phoneme_evidence) throw new Error(`Missing rich feedback in ${v.id}.`);
    if (!b.no_timer || b.speed_score_allowed || b.microphone_required || b.handwriting_required || b.gamification?.lives || b.gamification?.streaks || b.gamification?.loss_on_error) throw new Error(`Pressure or mandatory output route in ${v.id}.`);
    if (b.audio_required) {
      if (b.audio_provider !== "ElevenLabs" || b.audio_asset_status !== "required_human_ssp_listening_review" || !b.human_listening_approval_required || b.browser_tts_allowed !== false || b.browser_tts_fallback !== "prohibited" || b.pure_phoneme_audio_used !== false) throw new Error(`Audio policy failure in ${v.id}.`);
    } else if (b.whole_word_audio_asset_ids || b.audio_provider) throw new Error(`Unnecessary audio reference in ${v.id}.`);
  }
}

function minimalPairs() {
  const pairs = [];
  for (let i = 0; i < words.length; i++) for (let j = i + 1; j < words.length; j++) {
    const a = words[i], b = words[j];
    if (a.phonemes.length !== b.phonemes.length) continue;
    const diffs = a.phonemes.map((p, n) => p === b.phonemes[n] ? -1 : n).filter((n) => n >= 0);
    if (diffs.length === 1) pairs.push({ words: [a, b], index: diffs[0] });
  }
  return pairs;
}

function wordAt(index, offset) {
  const bands = [words.filter((x) => x.units.length === 2), words.filter((x) => x.units.length === 3), words.filter((x) => x.units.length === 4), words.filter((x) => x.units.length === 5)];
  const band = bands[(index + offset) % bands.length];
  return band[Math.floor((index + offset) / bands.length) % band.length];
}
function w(word, units, phonemes, structure) { return { word, units, phonemes, structure }; }
function focusIndex(focus, length) { return focus === "initial" ? 0 : focus === "final" ? length - 1 : middleIndex(length); }
function middleIndex(length) { return Math.floor((length - 1) / 2); }
function difficulty(item) { return item.units.length + (item.units.some((u) => u.length > 1) ? 1 : 0); }
function countChoices(n, i) { return rotate(unique([n, Math.max(1, n - 1), Math.min(6, n + 1)]), i % 3); }
function distractorTiles(item) { const pool = ["a", "e", "i", "o", "u", "sh", "ch", "ai", "ee", "oa", "igh", "air", "n", "t", "p"]; return pool.filter((x) => !item.units.includes(x)).slice(0, 3); }
function digraphHint(item) { const groups = item.units.filter((u) => u.length > 1); return groups.length ? `${groups.join(" and ")} ${groups.length === 1 ? "is" : "are"} a taught grapheme group; keep each group in one phoneme frame.` : "Each grapheme here represents one phoneme in its own frame."; }
function graphemeNote(item) { const groups = item.units.filter((u) => u.length > 1); return groups.length ? `${groups.join(" and ")} ${groups.length === 1 ? "uses more than one letter but represents one phoneme" : "use more than one letter for one phoneme each"}.` : "Here each phoneme is represented by one letter."; }
function rotate(items, n) { const a = [...items]; const k = a.length ? n % a.length : 0; return a.slice(k).concat(a.slice(0, k)); }
function unique(items) { return [...new Set(items)]; }
function cap(text) { return text[0].toUpperCase() + text.slice(1); }
function countBy(items, fn) { const out = {}; for (const item of items) { const key = fn(item); out[key] = (out[key] ?? 0) + 1; } return out; }
function summary(items, fn) { return Object.entries(countBy(items, fn)).sort(([a], [b]) => String(a).localeCompare(String(b))).map(([k, v]) => `${k}:${v}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
