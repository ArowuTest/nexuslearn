#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packPath = path.resolve(argValue("--pack") ?? path.join(repoRoot, "packages/content/packs/en-y1-phonics-blend-cvc-words.pack.sample.json"));
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "en-y1-phonics-blend-cvc-words-bank-";
const words = [
  "bat", "cat", "dad", "fan", "fat", "gap", "gas", "ham", "hat", "jam", "lap", "man", "map", "mat", "nap", "pan", "pat", "rag", "ram", "ran", "rat", "sad", "sat", "tap", "van",
  "bed", "beg", "den", "fed", "get", "hen", "jet", "leg", "men", "met", "net", "peg", "pen", "pet", "red", "ten", "vet", "web", "wet", "yet",
  "big", "bin", "bit", "dig", "dip", "fig", "fin", "fit", "hid", "him", "hip", "hit", "kid", "kit", "lid", "lip", "pig", "pin", "rip", "sit",
  "bog", "cob", "cod", "cop", "cot", "dog", "dot", "fog", "got", "hop", "hot", "jog", "log", "lot", "mob", "mop", "top",
  "bud", "bug", "bun", "bus", "but", "cub", "cup", "cut", "dug", "fun", "gum", "gun", "hut", "jug", "mug", "mud", "run", "sun",
];
const phonemes = {
  a: "/a/", b: "/b/", c: "/k/", d: "/d/", e: "/e/", f: "/f/", g: "/g/", h: "/h/", i: "/i/",
  j: "/j/", k: "/k/", l: "/l/", m: "/m/", n: "/n/", o: "/o/", p: "/p/", r: "/r/", s: "/s/",
  t: "/t/", u: "/u/", v: "/v/", w: "/w/", y: "/y/",
};

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "en-y1-phonics-blend-cvc-words") throw new Error("This generator only supports the Year 1 phonics blending flagship.");
const beforeVariants = structuredClone(pack.question_variants ?? []);
const beforeCore = coreSnapshot(beforeVariants);
const beforeBlueprints = blueprintCounts(beforeVariants);
const beforeMissingFeedback = countMissingFeedback(beforeVariants);
const beforeMissingRoute = countMissingRoute(beforeVariants);
const authored = beforeVariants.filter((variant) => !variant.id.startsWith(prefix)).map(enrichVariant);
const candidates = words.flatMap((word) => variantsFor(word)).map(enrichVariant);
pack.question_variants = [...authored, ...candidates];
pack.version = "0.4.0";
pack.practice.variant_targets.pilot = 300;
pack.practice.variant_targets.release = 600;
pack.qa.readiness_status = "draft";
pack.qa.notes = "Quality-hardened flagship bank retains the same 300 tasks, IDs, answers, blueprint allocation, CVC corpus, GPC/phoneme data, SSP mapping state and audio references. Every variant now has misconception- and GPC-linked feedback, explicit touch/keyboard/switch/eye-gaze/adult-supported response routes, phoneme-frame and reduced-load supports, no mandatory speech or handwriting, and pressure-free retry. Audio remains restricted to produced and human-reviewed ElevenLabs assets; browser TTS is prohibited. Every task remains held in review until SSP progression mapping, produced phoneme audio, independent phonics-teacher review, child listening/usability review and accessibility acceptance are complete.";
validateHardening(pack.question_variants, beforeCore, beforeBlueprints);
const afterMissingFeedback = countMissingFeedback(pack.question_variants);
const afterMissingRoute = countMissingRoute(pack.question_variants);
console.log(`phonics-bank authored=${authored.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`phonics-bank formats=${formatSummary(candidates)}`);
console.log(`phonics-bank missing_feedback before=${beforeMissingFeedback} after=${afterMissingFeedback}`);
console.log(`phonics-bank missing_route before=${beforeMissingRoute} after=${afterMissingRoute}`);
enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`phonics-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 1 phonics bank is out of date; run generate-y1-phonics-bank.mjs --write.");
  console.log("phonics-bank deterministic check passed");
} else {
  console.log("phonics-bank dry-run; pass --write to update the pack");
}

function variantsFor(word) {
  const sounds = [...word];
  const phonemeIDs = sounds.map((letter) => phonemes[letter]);
  const choices = distractors(word);
  const variants = [];
  if (word !== "cat") {
    variants.push({
      id: `${prefix}audio-${word}`,
      format: "audio_blend",
      body: commonBody(word, sounds, phonemeIDs, choices, "short-vowel-audio-blends", "listen_then_blend"),
      expected_answer: { value: word },
      hints: ["Tap each sound once.", `Keep the middle sound ${sounds[1]} clear as you sweep.`],
      explanation: `The sounds ${sounds.join("-")} blend together to make ${word}.`,
      difficulty: difficulty(word, "audio"),
      status: "review",
      misconception_tag: "separate_sounds_not_blended",
      animation_hook: "blend-river-sweep",
    });
  }
  if (word !== "cot") {
    variants.push({
      id: `${prefix}listen-${word}`,
      format: "tap-choice",
      body: {
        ...commonBody(word, sounds, phonemeIDs, choices, "middle-vowel-contrast-choices", "audio_first_choice"),
        audio_cue: sounds.join("-"),
        focus_sound: sounds[1],
      },
      expected_answer: { value: word },
      hints: ["Replay the sounds.", `Listen carefully for ${sounds[1]} in the middle.`],
      explanation: `${sounds.join("-")} makes ${word}; the middle sound is ${sounds[1]}.`,
      difficulty: difficulty(word, "listen"),
      status: "review",
      misconception_tag: "middle_vowel_changed",
      animation_hook: "middle-sound-glow",
    });
  }
  if (word !== "map") {
    variants.push({
      id: `${prefix}build-${word}`,
      format: "word-build",
      body: {
        prompt: "Listen, then build the word.",
        sounds,
        phoneme_ids: phonemeIDs,
        tiles: buildTiles(sounds),
        response_mode: "tap_or_keyboard_tiles",
        audio_replay: true,
        audio_asset_status: "required",
        audio_asset_ids: [...phonemeIDs.map(assetID), `word-${word}`],
        gpc_progression_stage: "single-letter-basic-code",
        ssp_programme_mapping: "required_before_pilot",
        visual_load: "low",
        evidence_purpose: "sound_order_and_grapheme_build",
        variant_blueprint_id: "sound-order-word-builds",
        review_batch: "y1-phonics-pilot-a",
      },
      expected_answer: { value: sounds },
      hints: [`Start with ${sounds[0]}.`, `The last sound is ${sounds[2]}.`],
      explanation: `The word ${word} is built in the order ${sounds.join("-")}.`,
      difficulty: difficulty(word, "build"),
      status: "review",
      misconception_tag: "sound_order_gap",
      animation_hook: "word-sprout-build",
    });
  }
  return variants;
}

function commonBody(word, sounds, phonemeIDs, choices, blueprint, responseMode) {
  return {
    prompt: "Listen to the sounds, blend them, then choose the word.",
    sounds,
    phoneme_ids: phonemeIDs,
    choices,
    response_mode: responseMode,
    audio_replay: true,
    audio_asset_status: "required",
    audio_asset_ids: [...phonemeIDs.map(assetID), `word-${word}`],
    gpc_progression_stage: "single-letter-basic-code",
    ssp_programme_mapping: "required_before_pilot",
    picture_reveal: "after_sound_choice",
    visual_load: "low",
    evidence_purpose: "cvc_blending",
    variant_blueprint_id: blueprint,
    review_batch: "y1-phonics-pilot-a",
  };
}

function enrichVariant(variant) {
  const expected = variant.expected_answer?.value;
  const word = Array.isArray(expected) ? expected.join("") : String(expected ?? "");
  const sounds = variant.body?.sounds ?? [...word];
  const phonemeIDs = variant.body?.phoneme_ids ?? sounds.map((letter) => phonemes[letter]);
  const middleGPC = `${sounds[1]} represents ${phonemeIDs[1]}`;
  const misconception = variant.misconception_tag ?? (variant.format === "word-build" ? "sound_order_gap" : variant.format === "tap-choice" ? "middle_vowel_changed" : "separate_sounds_not_blended");
  return {
    ...variant,
    body: {
      ...variant.body,
      interaction_route: {
        touch: variant.format === "word-build" ? "Tap a grapheme tile, then tap its numbered phoneme-frame box; dragging is optional." : "Tap replay or a sound button, then tap the chosen whole word.",
        keyboard: "Tab through replay, sound buttons or tiles and choices; use Enter or Space to play, place or select.",
        switch_scan: "Scan in the order replay, first sound, middle sound, final sound, response choices, check and retry; activate one item at a time.",
        eye_gaze: "Use dwell-select on large replay, sound, grapheme and choice targets with adjustable dwell time and a confirm step.",
        adult_supported: "An adult may operate replay, scan choices or place the learner's indicated tile without blending, naming or choosing the answer for them.",
        drag_required: false,
      },
      supported_response_route: "Touch, keyboard, switch, eye gaze, AAC/pointing or adult-supported selection provide equivalent evidence; spoken responses and handwriting are optional and never scored.",
      phoneme_frame_route: `Three numbered boxes hold ${phonemeIDs.join(", ")} in order; each box pairs grapheme, phoneme label and replay without colour-only meaning.`,
      visual_access_route: "One low-clutter CVC row, large targets, adjustable spacing, clear focus, static sound buttons and picture reveal only after sound-based responding.",
      processing_support_route: "Replay individual produced phonemes or the reviewed whole word, keep first and final sounds visible, emphasise the middle GPC, and preserve correct selections during repair.",
      no_mandatory_speech: true,
      no_mandatory_handwriting: true,
      microphone_required: false,
      handwriting_required: false,
      retry_without_penalty: true,
      no_timer: true,
      speed_score_allowed: false,
      preserve_correct_work: true,
      undo_available: true,
      pressure_rules: { timer: false, speed_score: false, streaks: false, lives: false, loss_on_error: false, public_ranking: false, retry_cost: false },
      audio_provider: "ElevenLabs",
      audio_production_policy: "produced_and_human_listening_reviewed_assets_only",
      human_listening_approval_required: true,
      browser_tts_allowed: false,
      browser_tts_fallback: "prohibited",
      unavailable_audio_state: "honest_not_ready_block_audio_dependent_item_or_use_teacher_delivered_approved_equivalent_never_browser_tts",
    },
    feedback: {
      correct: correctFeedback(variant.format, word, sounds, phonemeIDs),
      repair: repairFeedback(misconception, word, sounds, phonemeIDs),
      evidence: `The response ${Array.isArray(expected) ? expected.join("-") : `“${word}”`} matches the ordered GPC evidence ${sounds.map((grapheme, index) => `${grapheme} → ${phonemeIDs[index]}`).join(", ")} and the blended whole word “${word}”.`,
      phonics_evidence: `First ${sounds[0]} → ${phonemeIDs[0]}; middle ${middleGPC}; final ${sounds[2]} → ${phonemeIDs[2]}; blend ${phonemeIDs.join(" ")} → “${word}”.`,
      support_message: "Replaying, tapping, keyboard selection, switch scanning, eye gaze, pointing/AAC and adult-operated choices are equally valid. Speech, handwriting and speed are not required.",
      misconception_check: misconception,
      retry: "Your correctly identified sounds stay in place. Replay one approved sound or use the three-box frame, then try again without losing progress.",
    },
  };
}

function correctFeedback(format, word, sounds, phonemeIDs) {
  if (format === "word-build") return `You matched ${sounds.join("-")} to ${phonemeIDs.join(" ")} in the right order, then built “${word}”.`;
  if (format === "tap-choice") return `You kept the first and final sounds steady, heard ${phonemeIDs[1]} for the middle grapheme ${sounds[1]}, and chose “${word}”.`;
  return `You kept ${phonemeIDs.join(" ")} in order and swept the three sounds together to read “${word}”.`;
}

function repairFeedback(misconception, word, sounds, phonemeIDs) {
  if (misconception === "middle_vowel_changed") return `Keep ${sounds[0]} → ${phonemeIDs[0]} and ${sounds[2]} → ${phonemeIDs[2]} fixed. Replay the middle ${sounds[1]} → ${phonemeIDs[1]}, compare only the middle grapheme in each choice, then blend ${phonemeIDs.join(" ")} into “${word}”.`;
  if (misconception === "sound_order_gap") return `Use the three numbered phoneme boxes. Replay and place ${sounds[0]} → ${phonemeIDs[0]} first, ${sounds[1]} → ${phonemeIDs[1]} in the middle and ${sounds[2]} → ${phonemeIDs[2]} last; point, tap, switch-select or eye-gaze each tile before blending “${word}”.`;
  return `Replay the approved sounds ${phonemeIDs.join(", ")} and keep them in order. Start the next sound before the previous one fades, without adding an “uh”, then sweep through to “${word}”.`;
}

function validateHardening(variants, beforeCoreSnapshot, beforeBlueprintCounts) {
  if (variants.length !== 300) throw new Error(`Expected 300 variants, found ${variants.length}.`);
  const ids = variants.map((variant) => variant.id);
  if (new Set(ids).size !== 300) throw new Error("Variant IDs are not unique.");
  const afterCore = coreSnapshot(variants);
  if (JSON.stringify(afterCore) !== JSON.stringify(beforeCoreSnapshot)) throw new Error("Quality hardening changed core variant content, IDs, answers, GPC/SSP/audio data or ordering.");
  if (JSON.stringify(blueprintCounts(variants)) !== JSON.stringify(beforeBlueprintCounts)) throw new Error("Blueprint allocation changed during hardening.");
  if (countMissingFeedback(variants) !== 0) throw new Error("At least one variant still lacks complete feedback.");
  if (countMissingRoute(variants) !== 0) throw new Error("At least one variant still lacks a complete response route.");
  for (const variant of variants) {
    const body = variant.body;
    if (body.audio_provider !== "ElevenLabs" || body.audio_production_policy !== "produced_and_human_listening_reviewed_assets_only" || !body.human_listening_approval_required || body.browser_tts_allowed !== false || body.browser_tts_fallback !== "prohibited") throw new Error(`Audio policy failed in ${variant.id}.`);
    if (body.audio_asset_status !== "required" || body.ssp_programme_mapping !== "required_before_pilot" || body.gpc_progression_stage !== "single-letter-basic-code") throw new Error(`Existing audio/SSP/GPC gate changed in ${variant.id}.`);
    if (!body.no_timer || body.speed_score_allowed || body.pressure_rules?.streaks || body.pressure_rules?.lives || body.pressure_rules?.loss_on_error) throw new Error(`Pressure mechanic found in ${variant.id}.`);
  }
}

function coreSnapshot(variants) { return variants.map(stripEnrichment); }

function stripEnrichment(variant) {
  const copy = structuredClone(variant);
  delete copy.feedback;
  for (const key of ["interaction_route", "supported_response_route", "phoneme_frame_route", "visual_access_route", "processing_support_route", "no_mandatory_speech", "no_mandatory_handwriting", "microphone_required", "handwriting_required", "retry_without_penalty", "no_timer", "speed_score_allowed", "preserve_correct_work", "undo_available", "pressure_rules", "audio_provider", "audio_production_policy", "human_listening_approval_required", "browser_tts_allowed", "browser_tts_fallback", "unavailable_audio_state"]) delete copy.body[key];
  return copy;
}

function countMissingFeedback(variants) { return variants.filter((variant) => !variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.evidence || !variant.feedback?.phonics_evidence || !variant.feedback?.support_message).length; }
function countMissingRoute(variants) { return variants.filter((variant) => { const body = variant.body ?? {}, route = body.interaction_route ?? {}; return !route.touch || !route.keyboard || !route.switch_scan || !route.eye_gaze || !route.adult_supported || route.drag_required !== false || body.no_mandatory_speech !== true || body.no_mandatory_handwriting !== true || body.retry_without_penalty !== true; }).length; }
function blueprintCounts(variants) { const counts = {}; for (const variant of variants) { const id = variant.body?.variant_blueprint_id; counts[id] = (counts[id] ?? 0) + 1; } return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))); }

function assetID(phoneme) {
  return `phoneme-${phoneme.replaceAll("/", "")}`;
}

function distractors(word) {
  const sameFrame = words.filter((candidate) => candidate !== word && candidate[0] === word[0] && candidate[2] === word[2]);
  const sameVowel = words.filter((candidate) => candidate !== word && candidate[1] === word[1]);
  const selected = [word];
  for (const candidate of [...sameFrame, ...sameVowel, ...words]) {
    if (!selected.includes(candidate)) selected.push(candidate);
    if (selected.length === 3) break;
  }
  return rotate(selected, words.indexOf(word) % selected.length);
}

function buildTiles(sounds) {
  const pool = ["s", "m", "t", "p", "n", "c", "d", "f", "h", "r", "l", "g", "a", "e", "i", "o", "u"];
  const tiles = [...sounds];
  for (const letter of pool) {
    if (!tiles.includes(letter)) tiles.push(letter);
    if (tiles.length === 6) break;
  }
  return rotate(tiles, words.indexOf(sounds.join("")) % tiles.length);
}

function difficulty(word, mode) {
  const vowel = word[1];
  const base = vowel === "a" ? 1 : vowel === "e" || vowel === "i" ? 2 : 3;
  return Math.min(5, base + (mode === "build" ? 1 : 0));
}

function rotate(items, amount) {
  return items.slice(amount).concat(items.slice(0, amount));
}

function formatSummary(variants) {
  const counts = {};
  for (const variant of variants) counts[variant.format] = (counts[variant.format] ?? 0) + 1;
  return Object.entries(counts).sort().map(([format, count]) => `${format}:${count}`).join(",");
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function relative(file) {
  return path.relative(repoRoot, file).replaceAll("\\", "/");
}
