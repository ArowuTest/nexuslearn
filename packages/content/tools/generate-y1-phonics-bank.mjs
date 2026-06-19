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
  "cat", "map", "sat", "tap", "cap", "mat", "fan", "man", "pan", "van", "bag", "rag", "tag", "jam", "ham",
  "pen", "hen", "ten", "den", "men", "bed", "red", "fed", "leg", "peg", "net", "pet", "vet", "jet", "web",
  "sit", "pin", "tin", "fin", "win", "lip", "dip", "rip", "fig", "pig", "dig", "bin", "hit", "fit", "kit",
  "cot", "hot", "pot", "dot", "log", "dog", "fog", "hop", "mop", "top", "sun", "run", "fun", "cup", "bus",
];

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "en-y1-phonics-blend-cvc-words") throw new Error("This generator only supports the Year 1 phonics blending flagship.");
const authored = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const candidates = words.flatMap((word) => variantsFor(word));
pack.question_variants = [...authored, ...candidates];
pack.version = "0.2.0";
pack.qa.notes = "Flagship authoring bank includes a curated 60-word CVC review set across audio blending, middle-vowel listening and word building. Candidates remain non-runtime until teacher, phonics and accessibility review.";
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
  const choices = distractors(word);
  const variants = [];
  if (word !== "cat") {
    variants.push({
      id: `${prefix}audio-${word}`,
      format: "audio_blend",
      body: commonBody(sounds, choices, "short-vowel-audio-blends", "listen_then_blend"),
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
        ...commonBody(sounds, choices, "middle-vowel-contrast-choices", "audio_first_choice"),
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
        prompt: `Build the word ${word}.`,
        sounds,
        tiles: buildTiles(sounds),
        response_mode: "tap_or_keyboard_tiles",
        audio_replay: true,
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

function commonBody(sounds, choices, blueprint, responseMode) {
  return {
    prompt: `Blend ${sounds.join("-")}.`,
    sounds,
    choices,
    response_mode: responseMode,
    audio_replay: true,
    picture_reveal: "after_sound_choice",
    visual_load: "low",
    evidence_purpose: "cvc_blending",
    variant_blueprint_id: blueprint,
    review_batch: "y1-phonics-pilot-a",
  };
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
