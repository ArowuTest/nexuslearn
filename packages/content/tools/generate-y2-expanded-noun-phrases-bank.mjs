#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/en-y2-expanded-noun-phrases.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "en-y2-expanded-noun-phrases-bank-";
const reviewBatch = "y2-expanded-noun-phrases-pilot-a";
const pilotAllocation = {
  "find-noun-and-phrase-boundary": 41,
  "one-useful-detail-builds": 47,
  "two-details-order-and-comma": 47,
  "edit-for-clear-useful-detail": 46,
  "expanded-phrase-sentence-transfer": 39,
};

if (write && check) throw new Error("Choose either --write or --check, not both.");

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "en-y2-expanded-noun-phrases") {
  throw new Error("This generator only supports the Year 2 expanded noun phrases pack.");
}

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedAllocation = countBy(curated, curatedBlueprint);
const generatedTargets = Object.fromEntries(
  Object.entries(pilotAllocation).map(([blueprint, total]) => [blueprint, total - (curatedAllocation[blueprint] ?? 0)]),
);
for (const [blueprint, count] of Object.entries(generatedTargets)) {
  if (count < 0) throw new Error(`Curated items exceed the pilot allocation for ${blueprint}.`);
}

const candidates = [
  ...identificationCandidates(generatedTargets["find-noun-and-phrase-boundary"]),
  ...oneDetailCandidates(generatedTargets["one-useful-detail-builds"]),
  ...twoDetailCandidates(generatedTargets["two-details-order-and-comma"]),
  ...editingCandidates(generatedTargets["edit-for-clear-useful-detail"]),
  ...sentenceTransferCandidates(generatedTargets["expanded-phrase-sentence-transfer"]),
];

const enrichedCurated = curated.map(enrichVariant);
const enrichedCandidates = candidates.map(enrichVariant);
pack.question_variants = [...enrichedCurated, ...enrichedCandidates];
pack.version = "0.2.0";
pack.qa.notes = "Review-stage Year 2 expanded noun phrase pack with a deterministic 220-item pilot bank covering noun identification, purposeful construction, reviewed two-detail punctuation, reader-focused editing, oral rehearsal and transfer into complete sentences. Optional narration references require ElevenLabs production and human listening approval; browser TTS is prohibited. Independent English, SEND, bias, audio and renderer review remain required before promotion.";

validateBank(pack, enrichedCurated, enrichedCandidates);

const blueprintById = new Map(pack.variant_blueprints.map((blueprint) => [blueprint.id, blueprint]));
console.log(`y2-enp-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`y2-enp-bank blueprints=${allocationSummary(curated, candidates)}`);
console.log(`y2-enp-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y2-enp-bank bands=${bandSummary(curated, candidates, blueprintById)}`);
console.log(`y2-enp-bank interactions=${summary(candidates, (variant) => variant.body.interaction_mode)}`);

const nextText = `${JSON.stringify(pack, null, 2)}\n`;
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y2-enp-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) {
    throw new Error("Year 2 expanded noun phrase bank is out of date; run generate-y2-expanded-noun-phrases-bank.mjs --write.");
  }
  console.log("y2-enp-bank deterministic check passed");
} else {
  console.log("y2-enp-bank dry-run; pass --write to update the pack");
}

function identificationCandidates(count) {
  const examples = [
    phrase("tiny-green-frog", "the tiny green frog", "frog", "hopped away"),
    phrase("bright-red-kite", "a bright red kite", "kite", "flew above us"),
    phrase("noisy-blue-train", "the noisy blue train", "train", "stopped at the station"),
    phrase("soft-wool-scarf", "my soft wool scarf", "scarf", "kept me warm"),
    phrase("tall-oak-tree", "the tall oak tree", "tree", "shaded the bench"),
    phrase("old-stone-bridge", "an old stone bridge", "bridge", "crossed the stream"),
    phrase("round-silver-coin", "this round silver coin", "coin", "rolled under the table"),
    phrase("small-wooden-boat", "the small wooden boat", "boat", "bobbed on the pond"),
    phrase("long-muddy-path", "the long muddy path", "path", "led to the gate"),
    phrase("yellow-raincoat", "a yellow raincoat", "raincoat", "hung by the door"),
    phrase("spotted-farm-dog", "the spotted farm dog", "dog", "barked once"),
    phrase("cold-clear-pond", "the cold clear pond", "pond", "shone in the sun"),
    phrase("striped-beach-towel", "a striped beach towel", "towel", "dried in the breeze"),
    phrase("busy-city-bus", "the busy city bus", "bus", "turned the corner"),
    phrase("dark-night-sky", "the dark night sky", "sky", "filled with stars"),
    phrase("smooth-glass-jar", "a smooth glass jar", "jar", "stood on the shelf"),
    phrase("little-garden-snail", "the little garden snail", "snail", "slid over a leaf"),
    phrase("fresh-bread-loaf", "the fresh bread loaf", "loaf", "cooled on a tray"),
    phrase("quiet-reading-corner", "the quiet reading corner", "corner", "felt calm"),
    phrase("large-cardboard-box", "a large cardboard box", "box", "held the costumes"),
  ];
  return Array.from({ length: count }, (_, index) => {
    const item = examples[index % examples.length];
    const round = Math.floor(index / examples.length);
    if (round === 0) {
      const words = item.text.replace(/[.]/g, "").split(" ");
      const choices = rotate(unique([item.noun, ...words.filter((word) => word !== item.noun).slice(0, 3)]), index % 4);
      return candidate({
        id: `${prefix}identify-${item.id}`,
        format: "phrase-or-sentence",
        blueprint: "find-noun-and-phrase-boundary",
        band: "intro",
        taskType: "identify_noun",
        prompt: `Find the noun in '${item.text}'. Which word names who or what?`,
        body: { text: item.text, choices, interaction_mode: "noun-anchor-highlight" },
        answer: item.noun,
        hints: ["Ask who or what the words are about.", "The other words belong with and tell more about the naming word."],
        explanation: `${sentenceStart(item.noun)} is the noun because it names who or what the phrase is about.`,
        difficulty: 2,
        tag: "detail_called_noun",
        hook: "noun-anchor-reveal",
        repair: `Lock ${item.noun} into the noun slot, then point each detail back to it.`,
      });
    }
    const complete = index % 2 === 0;
    const text = complete ? `${sentenceStart(item.text)} ${item.predicate}.` : item.text;
    const answer = complete ? "complete sentence" : "noun phrase";
    return candidate({
      id: `${prefix}boundary-${item.id}`,
      format: "phrase-or-sentence",
      blueprint: "find-noun-and-phrase-boundary",
      band: "intro",
      taskType: "phrase_boundary",
      prompt: `Read '${text}' Is it a noun phrase or a complete sentence?`,
      body: { text, choices: ["noun phrase", "complete sentence"], interaction_mode: "phrase-verb-slot-check" },
      answer,
      hints: ["Find the noun phrase first.", "A complete sentence also tells what happens or what something is."],
      explanation: complete
        ? `This is a complete sentence because it includes the noun phrase, a verb and an end mark.`
        : `This is a noun phrase. It names something but does not yet tell what happens.`,
      difficulty: 3,
      tag: complete ? "detail_called_noun" : "phrase_replaces_sentence",
      hook: "missing-verb-slot",
      repair: complete ? "Highlight the verb that completes the sentence." : "Place the phrase in the who-or-what slot and leave the verb slot visibly empty.",
    });
  });
}

function oneDetailCandidates(count) {
  const items = [
    detail("rocket-lunchbox", "lunchbox", "find the one with a silver rocket", "the lunchbox with a silver rocket"),
    detail("white-paws-cat", "cat", "identify the cat with white paws", "the cat with white paws"),
    detail("rusty-key", "key", "find the old key in the drawer", "the rusty key"),
    detail("yellow-coat", "coat", "choose the coat that can be spotted quickly", "the yellow coat"),
    detail("spiral-shell", "shell", "identify the shell with a spiral pattern", "the spiral shell"),
    detail("torn-map", "map", "find the map with a torn corner", "the map with a torn corner"),
    detail("striped-cup", "cup", "choose the cup with a blue stripe", "the cup with a blue stripe"),
    detail("dinosaur-book", "book", "find the book with a dinosaur cover", "the book with a dinosaur cover"),
    detail("door-seven", "door", "tell the visitor which door to use", "the door with number seven"),
    detail("hollow-tree", "tree", "identify the tree with a hollow trunk", "the tree with a hollow trunk"),
    detail("red-chest-bird", "bird", "identify the bird with a red chest", "the bird with a red chest"),
    detail("spotty-sock", "sock", "find the sock with green spots", "the sock with green spots"),
    detail("sharp-pencil", "pencil", "choose a pencil ready for neat drawing", "the sharp pencil"),
    detail("muddy-path", "path", "warn which path is muddy", "the muddy path"),
    detail("window-chair", "chair", "show which chair is beside the window", "the chair by the window"),
    detail("ribbon-parcel", "parcel", "find the parcel tied with blue ribbon", "the parcel with blue ribbon"),
    detail("diamond-kite", "kite", "identify the kite by its shape", "the diamond-shaped kite"),
    detail("floppy-ear-rabbit", "rabbit", "identify the rabbit with floppy ears", "the rabbit with floppy ears"),
    detail("feather-hat", "hat", "find the hat with a feather", "the hat with a feather"),
    detail("red-door-house", "house", "identify the house with a red door", "the house with a red door"),
    detail("star-ball", "ball", "find the ball with yellow stars", "the ball with yellow stars"),
    detail("pond-bench", "bench", "show which bench is beside the pond", "the bench beside the pond"),
    detail("cracked-tile", "tile", "find the tile with a small crack", "the tile with a small crack"),
  ];
  return Array.from({ length: count }, (_, index) => {
    const item = items[index % items.length];
    const round = Math.floor(index / items.length);
    const clue = `use the detail '${detailWords(item.answer, item.noun)}'`;
    const choices = rotate([
      item.answer,
      `the lovely nice ${item.noun}`,
      `the ${item.noun} quickly`,
    ], index % 3);
    return candidate({
      id: `${prefix}one-detail-${item.id}-${round + 1}`,
      format: "noun-phrase-builder",
      blueprint: "one-useful-detail-builds",
      band: "developing",
      taskType: "purposeful_build",
      prompt: `${round === 0 ? "Reader clue" : "Rehearsal card"}: ${clue}. Build the clearest noun phrase.`,
      body: {
        base_noun: item.noun,
        reader_purpose: clue,
        choices,
        tiles: phraseTiles(item.answer),
        interaction_mode: round === 0 ? "reader-purpose-tile-builder" : "listen-build-oral-rehearsal",
        oral_rehearsal: oralRoute(),
      },
      answer: item.answer,
      hints: ["Keep the noun as the anchor.", "Choose one detail that does the reader's job."],
      explanation: `${sentenceStart(item.answer)} is useful because it helps the reader ${item.purpose}.`,
      difficulty: 3 + round,
      tag: "adjective_pile",
      hook: round === 0 ? "detail-narrows-choice" : "phrase-into-sentence",
      repair: "Remove praise words and unrelated words, then keep the detail that helps this reader.",
    });
  });
}

function twoDetailCandidates(count) {
  const items = [
    two("small-spotted-dog", "dog", "help a reader picture the dog", "the small, spotted dog", true),
    two("cold-sparkling-stream", "stream", "describe the stream in a story", "the cold, sparkling stream", true),
    two("soft-stripy-scarf", "scarf", "identify the scarf by feel and pattern", "the soft, stripy scarf", true),
    two("tall-shady-tree", "tree", "choose a tree for a cool resting place", "the tall, shady tree", true),
    two("tiny-silver-key", "key", "identify the key by size and colour", "the tiny, silver key", true),
    two("bright-noisy-parrot", "parrot", "help a reader imagine the parrot", "the bright, noisy parrot", true),
    two("smooth-round-pebble", "pebble", "describe the pebble's feel and shape", "the smooth, round pebble", true),
    two("long-winding-path", "path", "describe the path through the woods", "the long, winding path", true),
    two("warm-woolly-jumper", "jumper", "describe a cosy jumper", "the warm, woolly jumper", true),
    two("large-empty-box", "box", "identify the box by size and what is inside", "the large, empty box", true),
    two("crisp-red-apple", "apple", "describe the apple's feel and colour", "the crisp, red apple", true),
    two("dark-stormy-sky", "sky", "set the scene before rain", "the dark, stormy sky", true),
    two("torn-tail-kite", "kite", "identify the damaged red kite", "the red kite with a torn tail", false),
    two("blue-sail-boat", "boat", "identify the wooden boat", "the wooden boat with a blue sail", false),
    two("cushion-cat", "cat", "show where the sleepy cat is", "the sleepy cat on the cushion", false),
    two("lock-box", "box", "identify the metal box", "the metal box with a tiny lock", false),
    two("door-boots", "boots", "show which muddy boots are meant", "the muddy boots by the door", false),
    two("two-deck-bus", "bus", "identify the yellow bus", "the yellow bus with two decks", false),
    two("stream-bridge", "bridge", "show which old bridge is meant", "the old bridge over the stream", false),
    two("pond-frog", "frog", "show where the green frog is", "the green frog beside the pond", false),
    two("space-book", "book", "identify the thick book", "the thick book about space", false),
    two("sand-towel", "towel", "show where the striped towel is", "the striped towel on the sand", false),
    two("star-badge", "badge", "identify the round badge", "the round badge with a star", false),
  ];
  return Array.from({ length: count }, (_, index) => {
    const item = items[index % items.length];
    const round = Math.floor(index / items.length);
    const wrongComma = item.comma ? item.answer.replace(",", "") : item.answer.replace("the ", "the,");
    const wrongOrder = `${determiner(item.answer)} ${item.noun} ${detailWords(item.answer, item.noun)}`.replace(/\s+/g, " ").trim();
    const choices = rotate(unique([item.answer, wrongComma, wrongOrder]), index % 3);
    return candidate({
      id: `${prefix}two-detail-${item.id}-${round + 1}`,
      format: "noun-phrase-builder",
      blueprint: "two-details-order-and-comma",
      band: "expected",
      taskType: "two_detail_build",
      prompt: `${round === 0 ? "Phrase workshop" : "Say-it-then-build-it"}: ${item.purpose}. Choose the natural phrase.`,
      body: {
        noun: item.noun,
        reader_purpose: item.purpose,
        choices,
        tiles: phraseTiles(item.answer),
        comma_decision: item.comma ? "two reviewed adjectives form a list" : "a specifying phrase follows the noun; no adjective-list comma",
        interaction_mode: round === 0 ? "two-detail-order-and-punctuation" : "oral-naturalness-check",
        oral_rehearsal: oralRoute(),
      },
      answer: item.answer,
      extraAnswer: { acceptable_spoken_without_punctuation: item.answer.replace(",", "") },
      hints: ["Keep the noun at the end unless a detail such as 'with' or 'beside' follows it.", item.comma ? "These two adjectives work as a reviewed list." : "Do not place a comma after the determiner."],
      explanation: item.comma
        ? `${sentenceStart(item.answer)} uses two useful listed details before the noun.`
        : `${sentenceStart(item.answer)} uses one detail before the noun and a specifying phrase after it, so no list comma is needed.`,
      difficulty: 5 + round,
      tag: "comma_everywhere",
      hook: round === 0 ? "phrase-slot-build" : "phrase-oral-order-check",
      repair: "Remove every comma, rebuild the natural word order, then add punctuation only if the reviewed details form a list.",
    });
  });
}

function editingCandidates(count) {
  const items = [
    edit("rocket-bag", "the lovely nice amazing bag with a silver rocket", "help someone find the rocket bag", "the bag with a silver rocket"),
    edit("white-paws-cat", "the sweet lovely nice cat with white paws", "identify the cat with white paws", "the cat with white paws"),
    edit("rusty-key", "the wonderful old rusty key quickly", "find the key that is rusty", "the rusty key"),
    edit("yellow-coat", "the pretty lovely yellow coat loudly", "spot the yellow coat", "the yellow coat"),
    edit("spiral-shell", "the amazing nice shell with a spiral pattern", "identify the spiral shell", "the shell with a spiral pattern"),
    edit("torn-map", "the old lovely map with a torn corner happily", "find the damaged map", "the map with a torn corner"),
    edit("striped-cup", "the nice beautiful cup with a blue stripe", "identify the blue-striped cup", "the cup with a blue stripe"),
    edit("dinosaur-book", "the brilliant lovely book with a dinosaur cover", "find the dinosaur book", "the book with a dinosaur cover"),
    edit("door-seven", "the amazing tall door with number seven quickly", "direct a visitor to door seven", "the door with number seven"),
    edit("hollow-tree", "the lovely nice old tree with a hollow trunk", "identify the hollow tree", "the tree with a hollow trunk"),
    edit("red-bird", "the cute pretty bird with a red chest", "identify the red-chested bird", "the bird with a red chest"),
    edit("spotty-sock", "the wonderful sock with green spots softly", "find the matching spotty sock", "the sock with green spots"),
    edit("sharp-pencil", "the lovely nice sharp pencil noisily", "choose the pencil ready for drawing", "the sharp pencil"),
    edit("muddy-path", "the good nice muddy path beautifully", "warn walkers about the muddy path", "the muddy path"),
    edit("window-chair", "the amazing chair lovely by the window", "show where the chair is", "the chair by the window"),
    edit("ribbon-parcel", "the nice parcel quickly with blue ribbon", "find the blue-ribbon parcel", "the parcel with blue ribbon"),
    edit("diamond-kite", "the lovely nice diamond-shaped kite", "identify the kite by shape", "the diamond-shaped kite"),
    edit("rabbit-ears", "the cute lovely rabbit with floppy ears", "identify the floppy-eared rabbit", "the rabbit with floppy ears"),
    edit("feather-hat", "the amazing pretty hat with a feather", "find the feathered hat", "the hat with a feather"),
    edit("red-door-house", "the wonderful house with a red door nicely", "identify the house", "the house with a red door"),
    edit("star-ball", "the brilliant lovely ball with yellow stars", "find the star ball", "the ball with yellow stars"),
    edit("pond-bench", "the good nice bench beside the pond", "show which bench is meant", "the bench beside the pond"),
    edit("cracked-tile", "the lovely old tile with a small crack", "find the cracked tile", "the tile with a small crack"),
  ];
  return Array.from({ length: count }, (_, index) => {
    const item = items[index % items.length];
    const round = Math.floor(index / items.length);
    const noun = lastAnchor(item.answer);
    const choices = rotate([
      item.answer,
      item.original,
      `the lovely nice amazing ${noun}`,
    ], index % 3);
    return candidate({
      id: `${prefix}edit-${item.id}-${round + 1}`,
      format: "useful-detail-choice",
      blueprint: "edit-for-clear-useful-detail",
      band: "secure",
      taskType: "purposeful_edit",
      prompt: `${round === 0 ? "Detail sort" : "Read-back edit"}: which revision keeps the useful clue and removes words that repeat or do not fit?`,
      body: {
        original_phrase: item.original,
        reader_purpose: item.purpose,
        choices,
        sort_labels: ["helps the reader", "repeats", "does not fit"],
        interaction_mode: round === 0 ? "helpful-repeat-unrelated-sort" : "before-after-phrase-editor",
        oral_rehearsal: oralRoute(),
      },
      answer: item.answer,
      hints: ["Keep the noun and the detail needed by this reader.", "Remove repeated praise words, adverbs and details that do not do the job."],
      explanation: `${sentenceStart(item.answer)} keeps the identifying detail and removes repeated or unrelated words.`,
      difficulty: 6 + round,
      tag: "adjective_pile",
      hook: "helpful-detail-sort",
      repair: "Sort every added word by its job, then read the shorter revision aloud to check that the meaning remains.",
    });
  });
}

function sentenceTransferCandidates(count) {
  const items = [
    transfer("spotted-dog", "the small, spotted dog", "The small, spotted dog raced across the field."),
    transfer("red-kite", "the bright red kite", "The bright red kite climbed above the trees."),
    transfer("wooden-boat", "the small wooden boat", "The small wooden boat rocked on the pond."),
    transfer("muddy-path", "the long, muddy path", "The long, muddy path led us home."),
    transfer("silver-key", "the tiny, silver key", "The tiny, silver key opened the box."),
    transfer("woolly-jumper", "the warm, woolly jumper", "The warm, woolly jumper dried by the fire."),
    transfer("star-ball", "the ball with yellow stars", "The ball with yellow stars bounced over the line."),
    transfer("red-door-house", "the house with a red door", "The house with a red door stood near the park."),
    transfer("dinosaur-book", "the book with a dinosaur cover", "The book with a dinosaur cover belongs on this shelf."),
    transfer("pond-frog", "the green frog beside the pond", "The green frog beside the pond caught a fly."),
    transfer("striped-towel", "the striped towel on the sand", "The striped towel on the sand blew away."),
    transfer("stormy-sky", "the dark, stormy sky", "The dark, stormy sky warned us about the rain."),
    transfer("spiral-shell", "the shell with a spiral pattern", "The shell with a spiral pattern gleamed in the sun."),
    transfer("hollow-tree", "the tree with a hollow trunk", "The tree with a hollow trunk sheltered a beetle."),
    transfer("blue-sail", "the wooden boat with a blue sail", "The wooden boat with a blue sail crossed the lake."),
    transfer("yellow-coat", "the yellow coat", "The yellow coat hung beside the door."),
    transfer("window-chair", "the chair by the window", "The chair by the window creaked softly."),
    transfer("parcel-ribbon", "the parcel with blue ribbon", "The parcel with blue ribbon arrived today."),
    transfer("round-pebble", "the smooth, round pebble", "The smooth, round pebble fitted in my palm."),
  ];
  return Array.from({ length: count }, (_, index) => {
    const item = items[index % items.length];
    const round = Math.floor(index / items.length);
    const broken = round === 0 ? item.phrase : `${item.sentence.charAt(0).toLowerCase()}${item.sentence.slice(1, -1)}`;
    const choices = rotate([
      item.sentence,
      `${sentenceStart(item.phrase)}.`,
      `${item.phrase} quickly`,
    ], index % 3);
    return candidate({
      id: `${prefix}transfer-${item.id}-${round + 1}`,
      format: "sentence-repair",
      blueprint: "expanded-phrase-sentence-transfer",
      band: "retrieval",
      taskType: "sentence_transfer",
      prompt: `${round === 0 ? "Sentence mission" : "Reread and repair"}: '${broken}' Which choice is a complete sentence?`,
      body: {
        phrase: item.phrase,
        starting_text: broken,
        choices,
        checks: ["capital letter", "expanded noun phrase", "verb", "end punctuation"],
        interaction_mode: round === 0 ? "phrase-into-sentence-builder" : "oral-reread-sentence-repair",
        oral_rehearsal: oralRoute(),
      },
      answer: item.sentence,
      hints: ["Keep the whole noun phrase together.", "Add what happens, then check the capital letter and end mark."],
      explanation: `${item.sentence} is complete because the expanded noun phrase sits inside a sentence with a verb and punctuation.`,
      difficulty: 5 + round,
      tag: "phrase_replaces_sentence",
      hook: "missing-verb-slot",
      repair: "Place the noun phrase in the who-or-what slot, add the verb part, then rehearse the whole sentence before checking punctuation.",
    });
  });
}

function candidate({ id, format, blueprint, band, taskType, prompt, body, answer, extraAnswer, hints, explanation, difficulty, tag, hook, repair }) {
  return {
    id,
    format,
    body: {
      prompt,
      ...body,
      task_type: taskType,
      response_mode: "tap_keyboard_switch_speak_or_adult_scribe",
      reduced_language_route: true,
      static_layout_available: true,
      no_timer: true,
      audio_optional: true,
      audio_asset_id: `narration-${id}`,
      audio_provider: "ElevenLabs",
      audio_asset_status: "required_human_listening_review",
      human_listening_approval_required: true,
      browser_tts_allowed: false,
      difficulty_band: band,
      evidence_purpose: blueprint.replaceAll("-", "_"),
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
    },
    expected_answer: { value: answer, ...extraAnswer },
    hints,
    explanation,
    feedback: {
      correct: "Clear choice: the words do the reader's job.",
      repair,
    },
    difficulty,
    status: "review",
    misconception_tag: tag,
    animation_hook: hook,
  };
}

function enrichVariant(variant) {
  const body = variant.body ?? {};
  const responseModes = ["tap", "keyboard", "switch", "eye_gaze", "aac"];
  let interactionContract;
  if (variant.format === "noun-phrase-builder") {
    const structured = Array.isArray(body.tiles) && body.tiles.length > 0 && (body.base_noun !== undefined || body.noun !== undefined);
    interactionContract = {
      kind: "noun_phrase_builder",
      mode: structured ? "structured_tokens" : "authored_choice",
      token_source: structured ? "tiles" : "choices",
      anchor_key: body.base_noun !== undefined ? "base_noun" : body.noun !== undefined ? "noun" : null,
      purpose_key: body.reader_purpose !== undefined ? "reader_purpose" : null,
      punctuation_key: body.comma_decision !== undefined ? "comma_decision" : null,
      drag_required: false,
      response_modes: responseModes,
    };
  } else if (variant.format === "sentence-repair") {
    const structured = body.phrase !== undefined && body.checks !== undefined;
    interactionContract = {
      kind: "sentence_transfer",
      mode: structured ? "structured_checks" : "authored_choice",
      phrase_key: structured ? "phrase" : null,
      starting_text_key: structured ? "starting_text" : null,
      checks_key: structured ? "checks" : null,
      expected_sentence_source: "expected_answer",
      drag_required: false,
      response_modes: responseModes,
    };
  } else if (variant.format === "useful-detail-choice") {
    const structured = body.original_phrase !== undefined && Array.isArray(body.sort_labels);
    interactionContract = {
      kind: "useful_detail_edit",
      mode: structured ? "structured_edit" : "authored_choice",
      original_key: structured ? "original_phrase" : null,
      purpose_key: body.reader_purpose !== undefined ? "reader_purpose" : null,
      sort_labels_key: structured ? "sort_labels" : null,
      choices_key: "choices",
      drag_required: false,
      response_modes: responseModes,
    };
  } else if (variant.format === "phrase-or-sentence") {
    interactionContract = {
      kind: "phrase_boundary",
      mode: body.text !== undefined ? "structured_boundary" : "authored_choice",
      text_key: body.text !== undefined ? "text" : null,
      task_type_key: body.task_type !== undefined ? "task_type" : null,
      choices_key: "choices",
      drag_required: false,
      response_modes: responseModes,
    };
  }
  return interactionContract ? { ...variant, body: { ...body, interaction_contract: interactionContract } } : variant;
}

function validateBank(currentPack, authored, generated) {
  if (authored.length !== 4) throw new Error(`Expected to preserve 4 curated variants, found ${authored.length}.`);
  if (currentPack.question_variants.length !== currentPack.practice.variant_targets.pilot) {
    throw new Error(`Expected ${currentPack.practice.variant_targets.pilot} variants, found ${currentPack.question_variants.length}.`);
  }
  const blueprints = new Map(currentPack.variant_blueprints.map((blueprint) => [blueprint.id, blueprint]));
  const ids = new Set();
  const signatures = new Set();
  for (const variant of currentPack.question_variants) {
    if (ids.has(variant.id)) throw new Error(`Duplicate variant id ${variant.id}.`);
    ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${JSON.stringify(variant.expected_answer)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`);
    signatures.add(signature);
  }
  for (const variant of currentPack.question_variants.filter((item) => ["noun-phrase-builder", "sentence-repair", "useful-detail-choice", "phrase-or-sentence"].includes(item.format))) validateInteractionContract(variant);
  for (const variant of generated) {
    const blueprint = blueprints.get(variant.body.variant_blueprint_id);
    if (!blueprint) throw new Error(`${variant.id} is not blueprint-linked.`);
    if (variant.format !== blueprint.format) throw new Error(`${variant.id} format does not match ${blueprint.id}.`);
    if (variant.body.difficulty_band !== blueprint.difficulty_band) throw new Error(`${variant.id} uses the wrong difficulty band.`);
    if (variant.status !== "review") throw new Error(`${variant.id} must remain in review.`);
    if (!variant.body.response_mode.includes("keyboard") || !variant.body.response_mode.includes("switch") || variant.body.reduced_language_route !== true || variant.body.static_layout_available !== true || variant.body.no_timer !== true) {
      throw new Error(`${variant.id} is missing a SEND scaffold route.`);
    }
    if (variant.body.audio_provider !== "ElevenLabs" || variant.body.audio_asset_status !== "required_human_listening_review" || variant.body.human_listening_approval_required !== true || variant.body.browser_tts_allowed !== false) {
      throw new Error(`${variant.id} violates the narration policy.`);
    }
    const choices = variant.body.choices;
    if (!Array.isArray(choices) || choices.length < 2) throw new Error(`${variant.id} needs renderer choices.`);
    if (new Set(choices.map((choice) => JSON.stringify(choice))).size !== choices.length) throw new Error(`${variant.id} repeats a choice.`);
    if (choices.filter((choice) => choice === variant.expected_answer.value).length !== 1) throw new Error(`${variant.id} must offer exactly one deterministic answer.`);
    if (!variant.hints?.length || !variant.feedback?.repair) throw new Error(`${variant.id} lacks scaffolded feedback.`);
    if (variant.body.prompt.length > 130) throw new Error(`${variant.id} prompt is too long for Year 2.`);
    if (!['identify_noun', 'phrase_boundary'].includes(variant.body.task_type) && normalise(variant.body.prompt).includes(normalise(variant.expected_answer.value))) {
      throw new Error(`${variant.id} leaks its answer in the prompt.`);
    }
    if (/api[_-]?key|secret|bearer\s|access[_-]?token/i.test(JSON.stringify(variant))) throw new Error(`${variant.id} contains secret-like text.`);
  }
  const allocation = combinedAllocation(authored, generated);
  for (const [blueprint, expected] of Object.entries(pilotAllocation)) {
    if (allocation[blueprint] !== expected) throw new Error(`${blueprint} expected ${expected}, found ${allocation[blueprint] ?? 0}.`);
  }
}

function validateInteractionContract(variant) {
  const body = variant.body ?? {};
  const contract = body.interaction_contract;
  const requiredResponseModes = ["tap", "keyboard", "switch", "eye_gaze", "aac"];
  if (!contract || contract.drag_required !== false || requiredResponseModes.some((mode) => !contract.response_modes?.includes(mode))) throw new Error(`${variant.id} lacks an accessible English interaction contract.`);
  if (variant.format === "noun-phrase-builder") {
    if (contract.kind !== "noun_phrase_builder") throw new Error(`${variant.id} has the wrong noun-phrase contract.`);
    if (contract.mode === "structured_tokens") {
      if (!Array.isArray(body[contract.token_source]) || body[contract.token_source].length < 2) throw new Error(`${variant.id} lacks phrase tokens.`);
      if (!body[contract.anchor_key] && !body.noun) throw new Error(`${variant.id} lacks a phrase anchor.`);
    } else if (contract.mode !== "authored_choice") throw new Error(`${variant.id} has an unknown noun-phrase mode.`);
  } else if (variant.format === "sentence-repair") {
    if (contract.kind !== "sentence_transfer") throw new Error(`${variant.id} has the wrong sentence-transfer contract.`);
    if (contract.mode === "structured_checks" && (!body[contract.phrase_key] || !body[contract.starting_text_key] || !Array.isArray(body[contract.checks_key]) || !body[contract.checks_key].includes("verb"))) throw new Error(`${variant.id} lacks sentence-transfer checks.`);
    if (contract.mode !== "structured_checks" && contract.mode !== "authored_choice") throw new Error(`${variant.id} has an unknown sentence-transfer mode.`);
  } else if (variant.format === "useful-detail-choice") {
    if (contract.kind !== "useful_detail_edit") throw new Error(`${variant.id} has the wrong detail-edit contract.`);
    if (contract.mode === "structured_edit" && (!body[contract.original_key] || !Array.isArray(body[contract.sort_labels_key]) || body[contract.sort_labels_key].length < 3)) throw new Error(`${variant.id} lacks detail-edit sorting semantics.`);
    if (contract.mode !== "structured_edit" && contract.mode !== "authored_choice") throw new Error(`${variant.id} has an unknown detail-edit mode.`);
  } else if (variant.format === "phrase-or-sentence") {
    if (contract.kind !== "phrase_boundary") throw new Error(`${variant.id} has the wrong phrase-boundary contract.`);
    if (contract.mode === "structured_boundary" && !body[contract.text_key]) throw new Error(`${variant.id} lacks phrase-boundary text.`);
    if (contract.mode !== "structured_boundary" && contract.mode !== "authored_choice") throw new Error(`${variant.id} has an unknown phrase-boundary mode.`);
  }
}

function curatedBlueprint(variant) {
  const map = {
    "en-y2-expanded-noun-phrases-q-find-noun": "find-noun-and-phrase-boundary",
    "en-y2-expanded-noun-phrases-q-useful-bag": "one-useful-detail-builds",
    "en-y2-expanded-noun-phrases-q-build-dog": "two-details-order-and-comma",
    "en-y2-expanded-noun-phrases-q-complete-sentence": "expanded-phrase-sentence-transfer",
  };
  const blueprint = map[variant.id];
  if (!blueprint) throw new Error(`No preserved blueprint assignment for ${variant.id}.`);
  return blueprint;
}

function combinedAllocation(authored, generated) {
  const counts = countBy(authored, curatedBlueprint);
  for (const variant of generated) {
    const key = variant.body.variant_blueprint_id;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function allocationSummary(authored, generated) {
  return Object.entries(combinedAllocation(authored, generated)).sort().map(([key, count]) => `${key}:${count}`).join(",");
}

function bandSummary(authored, generated, blueprints) {
  const assignments = [
    ...authored.map((variant) => curatedBlueprint(variant)),
    ...generated.map((variant) => variant.body.variant_blueprint_id),
  ];
  return summary(assignments, (blueprint) => blueprints.get(blueprint).difficulty_band);
}

function phrase(id, text, noun, predicate) { return { id, text, noun, predicate }; }
function detail(id, noun, purpose, answer) { return { id, noun, purpose, answer }; }
function two(id, noun, purpose, answer, comma) { return { id, noun, purpose, answer, comma }; }
function edit(id, original, purpose, answer) { return { id, original, purpose, answer }; }
function transfer(id, phraseText, sentence) { return { id, phrase: phraseText, sentence }; }

function oralRoute() {
  return {
    optional: true,
    microphone_required: false,
    recording_required: false,
    model_replay_available_after_human_listening_approval: true,
    self_or_adult_check: true,
  };
}

function phraseTiles(value) {
  return value.replace(/,/g, " ,").split(/\s+/).filter(Boolean);
}

function determiner(value) {
  return value.split(" ")[0];
}

function detailWords(value, noun) {
  return value.replace(/,/g, "").replace(new RegExp(`^${determiner(value)}\\s+`), "").replace(new RegExp(`\\b${noun}\\b`), "").trim();
}

function lastAnchor(value) {
  const words = value.replace(/[,.]/g, "").split(" ");
  const afterWords = new Set(["with", "by", "beside", "about", "on", "over"]);
  const marker = words.findIndex((word) => afterWords.has(word));
  return marker > 1 ? words[marker - 1] : words.at(-1);
}

function unique(items) {
  return [...new Set(items)];
}

function rotate(items, amount) {
  const offset = amount % items.length;
  return items.slice(offset).concat(items.slice(0, offset));
}

function normalise(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function sentenceStart(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function countBy(items, keyFor) {
  const counts = {};
  for (const item of items) {
    const key = keyFor(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function summary(items, keyFor) {
  return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(",");
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function relative(file) {
  return path.relative(repoRoot, file).replaceAll("\\", "/");
}
