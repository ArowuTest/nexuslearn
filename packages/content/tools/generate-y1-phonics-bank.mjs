#!/usr/bin/env node
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
const authored = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix)).map(normaliseAuthored);
const candidates = words.flatMap((word) => variantsFor(word));
pack.question_variants = [...authored, ...candidates];
pack.version = "0.3.0";
pack.practice.variant_targets.pilot = 300;
pack.practice.variant_targets.release = 600;
pack.qa.readiness_status = "draft";
pack.qa.notes = "Flagship authoring bank includes 300 tasks across a curated 100-word, single-letter basic-code CVC set. Every task is held in review until its SSP progression mapping, produced phoneme audio, independent teacher review and accessibility acceptance are complete.";
console.log(`phonics-bank authored=${authored.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`phonics-bank formats=${formatSummary(candidates)}`);
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

function normaliseAuthored(variant) {
  const expected = variant.expected_answer?.value;
  const word = Array.isArray(expected) ? expected.join("") : String(expected ?? "");
  if (!words.includes(word)) return variant;
  const sounds = [...word];
  const phonemeIDs = sounds.map((letter) => phonemes[letter]);
  return {
    ...variant,
    status: "review",
    body: {
      ...variant.body,
      prompt: variant.format === "word-build" ? "Listen, then build the word." : "Listen to the sounds, blend them, then choose the word.",
      sounds,
      phoneme_ids: phonemeIDs,
      audio_asset_status: "required",
      audio_asset_ids: [...phonemeIDs.map(assetID), `word-${word}`],
      gpc_progression_stage: "single-letter-basic-code",
      ssp_programme_mapping: "required_before_pilot",
      evidence_purpose: variant.format === "word-build" ? "sound_order_and_grapheme_build" : "cvc_blending",
      variant_blueprint_id: variant.format === "word-build" ? "sound-order-word-builds" : variant.format === "tap-choice" ? "middle-vowel-contrast-choices" : "short-vowel-audio-blends",
      review_batch: "y1-phonics-pilot-a",
    },
  };
}

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
