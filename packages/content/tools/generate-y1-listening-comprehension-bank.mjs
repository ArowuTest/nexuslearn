#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/en-y1-listening-comprehension.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "en-y1-listening-comprehension-bank-";
const reviewBatch = "y1-listening-comprehension-pilot-a";
const pilotAllocation = {
  "who-what-where-retrieval": 48,
  "first-next-last-sequences": 48,
  "spoken-vocabulary-in-context": 48,
  "simple-clue-based-inference": 48,
  "mixed-listening-retrieval": 48,
};

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "en-y1-listening-comprehension") throw new Error("This generator only supports the Year 1 listening-comprehension pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedCounts = countBy(curated, (variant) => variant.body?.variant_blueprint_id);
const targets = Object.fromEntries(Object.entries(pilotAllocation).map(([id, target]) => [id, target - (curatedCounts[id] ?? 0)]));
for (const [id, target] of Object.entries(targets)) if (target < 0) throw new Error(`Curated variants exceed the allocation for ${id}.`);

const literalPassages = [
  literal("kite", "story", "Zara carried a yellow kite to the windy hill. Her grandad held the string.", "What colour was Zara's kite?", "yellow", ["yellow", "blue", "green"], "colour"),
  literal("library", "story", "Ben chose a book about whales. He sat on the round rug by the window.", "Where did Ben sit?", "on the round rug", ["on the round rug", "behind the shelf", "outside the library"], "place"),
  literal("fox", "information", "A fox has a thick tail. It may use its nose to find food after dark.", "Which body part helps the fox find food?", "its nose", ["its nose", "its tail", "its paws"], "detail"),
  literal("lunch", "story", "Mei packed an apple and a cheese roll. She put them in her green lunch bag.", "What kind of roll did Mei pack?", "a cheese roll", ["a cheese roll", "a jam roll", "a bread roll"], "object"),
  literal("bus", "information", "The school bus stops beside the park at eight o'clock. Mr Shah opens the door.", "When does the bus stop?", "at eight o'clock", ["at eight o'clock", "at lunchtime", "after bedtime"], "time"),
  literal("frog", "information", "The small frog rested on a damp stone. Then it hopped into the pond.", "Where did the frog hop?", "into the pond", ["into the pond", "under a log", "onto a leaf"], "place"),
  literal("drum", "story", "Nia tapped the drum softly with two wooden sticks. Her brother shook a bell.", "What did Nia tap?", "the drum", ["the drum", "the bell", "the sticks"], "object"),
  literal("garden", "information", "Worms help mix the soil. Robins sometimes look for worms in the garden.", "Which birds look for worms?", "robins", ["robins", "ducks", "owls"], "who"),
  literal("boat", "story", "Omar's paper boat floated under the little bridge. A red leaf landed beside it.", "What floated under the bridge?", "the paper boat", ["the paper boat", "the red leaf", "a toy fish"], "object"),
  literal("poem-moon", "poem", "Moon above, round and bright. Silver glow in the quiet night.", "When does the moon glow?", "in the night", ["in the night", "at breakfast", "at noon"], "time"),
  literal("baker", "information", "The baker mixed flour with water. She baked the loaf in a hot oven.", "Where did the loaf bake?", "in the oven", ["in the oven", "in the bowl", "on the shelf"], "place"),
  literal("boots", "story", "Kai left his muddy boots beside the back door. He wore clean slippers indoors.", "What did Kai leave by the door?", "his muddy boots", ["his muddy boots", "his clean slippers", "his coat"], "object"),
];

const sequencePassages = [
  sequence("toast", "directions", "First put the bread on the plate. Next spread the butter. Last add banana slices.", ["put bread on the plate", "spread the butter", "add banana slices"]),
  sequence("plant", "information", "A seed split open. A root grew down. Then a green shoot grew up.", ["seed splits", "root grows down", "green shoot grows up"]),
  sequence("parcel", "story", "Ari folded the paper around the box. He tied the string. Then he wrote the name tag.", ["fold paper around the box", "tie the string", "write the name tag"]),
  sequence("paint", "directions", "Dip the brush in water. Touch it on the blue paint. Make a wavy line across the page.", ["dip brush in water", "touch blue paint", "make a wavy line"]),
  sequence("duck", "story", "The duck climbed onto the bank. It shook water from its feathers. Then it waddled to the grass.", ["climb onto the bank", "shake off water", "waddle to the grass"]),
  sequence("handwash", "directions", "Wet your hands. Rub them with soap. Rinse and dry them well.", ["wet hands", "rub with soap", "rinse and dry"]),
  sequence("snowman", "story", "Lena rolled a large snowball. She added a smaller one. Last, she placed on a woolly hat.", ["roll a large snowball", "add a smaller snowball", "put on the hat"]),
  sequence("fruit", "directions", "Put the pear in the bowl. Place the orange beside it. Set the apple at the front.", ["put pear in bowl", "place orange beside pear", "set apple at front"]),
  sequence("caterpillar", "information", "A caterpillar ate leaves and grew. It rested inside a chrysalis. Later, a butterfly came out.", ["caterpillar eats and grows", "rests in chrysalis", "butterfly comes out"]),
  sequence("bedtime", "story", "Milo put away his toys. He brushed his teeth. Then Dad read a short story.", ["put away toys", "brush teeth", "listen to a story"]),
  sequence("paper-plane", "directions", "Fold the paper in half. Open it and fold both top corners in. Press the folds flat.", ["fold paper in half", "fold top corners in", "press folds flat"]),
  sequence("rain", "poem", "Clouds gather high. Raindrops patter down. At last, a rainbow brightens the sky.", ["clouds gather", "rain falls", "rainbow appears"]),
];

const vocabularyPassages = [
  vocab("enormous", "story", "The elephant was enormous. It was much bigger than the little goat beside it.", "enormous", "very big", ["very big", "very quiet", "very hungry"]),
  vocab("drowsy", "story", "Tia felt drowsy after the long journey. Her eyes kept closing and she gave a slow yawn.", "drowsy", "sleepy", ["sleepy", "cross", "excited"]),
  vocab("delicate", "information", "The butterfly's wings are delicate. Hana held the picture gently so its thin paper would not tear.", "delicate", "easy to damage", ["easy to damage", "heavy and strong", "brightly coloured"]),
  vocab("swift", "story", "The swift rabbit raced across the field. It reached the hedge before the slow tortoise.", "swift", "fast", ["fast", "lost", "small"]),
  vocab("shallow", "information", "The water was shallow near the edge. It only reached the top of Bo's boots.", "shallow", "not deep", ["not deep", "very cold", "full of fish"]),
  vocab("sturdy", "story", "The sturdy stool did not wobble when Sam stood beside it. Its thick legs stayed firm.", "sturdy", "strong and steady", ["strong and steady", "soft and bendy", "newly painted"]),
  vocab("vanished", "story", "The sun vanished behind a cloud. One moment it was bright; the next it could not be seen.", "vanished", "disappeared", ["disappeared", "grew hotter", "moved closer"]),
  vocab("narrow", "information", "The path was narrow. Only one person could walk along it at a time.", "narrow", "not wide", ["not wide", "very long", "made of stones"]),
  vocab("glimmer", "poem", "A tiny light began to glimmer. It shone faintly like a faraway star.", "glimmer", "shine with a small light", ["shine with a small light", "make a loud sound", "move very quickly"]),
  vocab("gathered", "story", "The children gathered around the map. They came together so everyone could see.", "gathered", "came together", ["came together", "ran away", "fell asleep"]),
  vocab("soaked", "story", "The towel was soaked after the spill. It was completely wet and dripped into the sink.", "soaked", "very wet", ["very wet", "neatly folded", "warm and dry"]),
  vocab("observe", "information", "Scientists observe the snails. They watch carefully and note what the snails do.", "observe", "watch carefully", ["watch carefully", "pick up quickly", "feed at once"]),
];

const inferencePassages = [
  infer("picnic", "story", "Jo spread a blanket on the grass. She opened a basket of sandwiches and fruit.", "Jo is having a picnic", ["Jo is having a picnic", "Jo is going to sleep", "Jo is washing clothes"], "blanket, basket and food"),
  infer("cold", "story", "Ravi zipped his thick coat. His breath made a little cloud in the air.", "It is cold outside", ["It is cold outside", "It is very hot", "It is lunchtime"], "thick coat and cloudy breath"),
  infer("birthday", "story", "Candles stood on a cake. Everyone smiled and began to sing to Ana.", "It is Ana's birthday", ["It is Ana's birthday", "Ana lost a toy", "School has finished"], "candles, cake and singing"),
  infer("lost-cat", "story", "Mum shook the treat bag and called under the sofa. A soft miaow came from behind the curtain.", "The cat is behind the curtain", ["The cat is behind the curtain", "The dog is outside", "The treats are under the sofa"], "a miaow behind the curtain"),
  infer("night", "information", "Stars filled the dark sky. An owl called from a tree while most windows were unlit.", "It is night-time", ["It is night-time", "It is midday", "A storm is starting"], "stars and a dark sky"),
  infer("wind", "story", "Leaves hurried along the path. Asha held her hat with both hands.", "It is windy", ["It is windy", "It is snowing", "The path is sticky"], "moving leaves and a hat held down"),
  infer("baking", "story", "Flour dusted Dad's apron. A warm sweet smell came from the oven.", "Dad is baking", ["Dad is baking", "Dad is gardening", "Dad is painting"], "flour and a smell from the oven"),
  infer("library-quiet", "story", "Leila whispered and turned the pages softly. Tall shelves of books stood around her.", "Leila is in a library", ["Leila is in a library", "Leila is at a football match", "Leila is in a swimming pool"], "whispering and shelves of books"),
  infer("wet-dog", "story", "The dog came inside with dripping fur. Small muddy paw marks crossed the floor.", "The dog has been outside in wet weather", ["The dog has been outside in wet weather", "The dog has been asleep", "The floor has just been painted"], "dripping fur and muddy paw marks"),
  infer("train", "story", "The doors slid shut. People held the rails as the carriage moved away from the platform.", "They are travelling by train", ["They are travelling by train", "They are sitting in a classroom", "They are rowing a boat"], "carriage, rails and platform"),
  infer("garden-work", "story", "Niko wore gardening gloves. A small trowel and a tray of seedlings lay beside him.", "Niko is planting", ["Niko is planting", "Niko is cooking", "Niko is drawing"], "gardening gloves, trowel and seedlings"),
  infer("tired", "story", "Ellis rubbed his eyes and yawned twice. He rested his head on the cushion.", "Ellis is tired", ["Ellis is tired", "Ellis is hungry", "Ellis is surprised"], "rubbing eyes and yawning"),
];

const mixedPassages = [
  mixed("robot", "directions", "Touch the blue circle. Then move the toy robot beside the red box.", "Where should the robot finish?", "beside the red box", ["beside the red box", "on the blue circle", "under the table"], "two_step_direction"),
  mixed("clap", "directions", "Clap once, touch your shoulders, then point to the floor.", "What should you do after touching your shoulders?", "point to the floor", ["point to the floor", "clap twice", "sit on the floor"], "three_step_direction"),
  mixed("bee", "information", "A bee visits flowers to collect nectar. It carries some pollen between flowers too.", "What does the bee collect?", "nectar", ["nectar", "leaves", "rainwater"], "information_recall"),
  mixed("sock", "directions", "Put the striped sock in the basket. Leave the plain sock on the chair.", "Which sock goes in the basket?", "the striped sock", ["the striped sock", "the plain sock", "both socks"], "detail_in_direction"),
  mixed("poem-rain", "poem", "Tap, tap, rain on the pane. Drip, drip, then sunshine again.", "What comes after the dripping rain?", "sunshine", ["sunshine", "snow", "night-time"], "poem_sequence"),
  mixed("hedgehog", "information", "A hedgehog curls into a ball when it feels unsafe. Its spines point outwards.", "Why might a hedgehog curl up?", "because it feels unsafe", ["because it feels unsafe", "because it wants to fly", "because it is looking for fruit"], "information_cause"),
  mixed("shape", "directions", "Choose the small triangle, not the large one. Place it above the square.", "Which shape should go above the square?", "the small triangle", ["the small triangle", "the large triangle", "the square"], "two_detail_direction"),
  mixed("market", "story", "At the market, Imani bought two pears. She gave one pear to her brother on the way home.", "How many pears did Imani keep?", "one pear", ["one pear", "two pears", "no pears"], "story_comprehension"),
  mixed("sound", "directions", "When you hear bell, raise one hand. When you hear drum, tap both knees.", "What should you do for the drum sound?", "tap both knees", ["tap both knees", "raise one hand", "ring a bell"], "conditional_direction"),
  mixed("penguin", "information", "A penguin is a bird with feathers. It cannot fly, but it uses its wings to swim.", "What does the penguin use its wings for?", "swimming", ["swimming", "flying over trees", "digging in soil"], "information_recall"),
  mixed("morning", "story", "Nora opened the curtains and saw the sunrise. She poured cereal into a bowl.", "Which meal is Nora getting ready for?", "breakfast", ["breakfast", "lunch", "supper"], "clue_comprehension"),
  mixed("book-action", "directions", "Open the book to the star sticker. Point to the moon, then close the book.", "What should happen just before the book is closed?", "point to the moon", ["point to the moon", "find the star sticker", "put the book away"], "three_step_direction"),
];

const generated = [
  ...literalCandidates(targets["who-what-where-retrieval"]),
  ...sequenceCandidates(targets["first-next-last-sequences"]),
  ...vocabularyCandidates(targets["spoken-vocabulary-in-context"]),
  ...inferenceCandidates(targets["simple-clue-based-inference"]),
  ...mixedCandidates(targets["mixed-listening-retrieval"]),
];

pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa.notes = "Review-stage Year 1 listening-comprehension pack with a deterministic 240-item pilot bank. Four curated variants are preserved alongside short stories, information, poems and directions covering attention, literal recall, sequencing, vocabulary in context, following directions and clue-supported comprehension. Every generated audio reference follows the ElevenLabs produced-audio policy: browser TTS is prohibited, runtime fallback is disabled, and assets remain unavailable pending explicit human listening approval. Replay, chunking, visual cues and transcripts are controlled auditory-processing accommodations and are excluded from accuracy scoring. Generated candidates require curriculum, teacher, cultural-accessibility, safeguarding, renderer and human listening review before promotion.";

validateBank(pack, curated, generated);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y1-listening-comprehension-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`y1-listening-comprehension-bank blueprints=${summary(pack.question_variants, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`y1-listening-comprehension-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y1-listening-comprehension-bank genres=${summary(generated, (variant) => variant.body.passage_genre)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y1-listening-comprehension-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 1 listening-comprehension bank is out of date; run generate-y1-listening-comprehension-bank.mjs --write.");
  console.log("y1-listening-comprehension-bank deterministic check passed");
} else {
  console.log("y1-listening-comprehension-bank dry-run; pass --write to update the pack");
}

function literalCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = literalPassages[index % literalPassages.length];
    return candidate({
      id: `literal-${item.id}-${index + 1}`, format: "audio-choice", blueprint: "who-what-where-retrieval", band: "intro", genre: item.genre,
      prompt: `Listening mission ${index + 1}: listen to the whole message, then answer: ${item.question}`,
      script: item.script, chunks: sentenceChunks(item.script), body: { choices: rotate(item.choices, index % item.choices.length), question_focus: item.focus, choice_mode: "large_picture_with_spoken_label_after_audio" }, answer: item.answer,
      hints: ["Replay the whole message if you want.", `Use the ${item.focus} detail, not a picture that matches only one word.`],
      explanation: `The message says, “${evidenceSentence(item.script, item.answer)}” That directly tells us ${item.answer}.`,
      difficulty: 2 + Math.floor(index / literalPassages.length), tag: "single_word_picture_match", hook: "mission-detail-lantern",
      correct: `Detail found: ${item.answer}. You listened for the whole meaning.`, repair: `Replay one chunk and listen for the ${item.focus} detail before the pictures return.`,
    });
  });
}

function sequenceCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = sequencePassages[index % sequencePassages.length];
    const cards = rotate(item.events, (index % (item.events.length - 1)) + 1);
    return candidate({
      id: `sequence-${item.id}-${index + 1}`, format: "picture-sort", blueprint: "first-next-last-sequences", band: "developing", genre: item.genre,
      prompt: `Path mission ${index + 1}: listen, then place the three event cards in order.`, script: item.script, chunks: sentenceChunks(item.script),
      body: { event_cards: cards, ordered_model: item.events, numbered_spaces: [1, 2, 3], interaction_mode: "tap_order_keyboard_switch_partner_scan_or_number_cards" }, answer: item.events,
      hints: ["Replay one sentence at a time if that helps.", "Find what happened first, then next, then last."],
      explanation: `The heard order is ${item.events.join(" → ")}. Each card matches one spoken step.`, difficulty: 3 + Math.floor(index / sequencePassages.length), tag: "event_order_confusion", hook: "mission-sequence-stepping-stones",
      correct: "Route restored. All three events follow the spoken order.", repair: "Keep any correctly placed card. Replay the chunk for one empty numbered space, then place just that event.",
    });
  });
}

function vocabularyCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = vocabularyPassages[index % vocabularyPassages.length];
    return candidate({
      id: `vocab-${item.id}-${index + 1}`, format: "audio-choice", blueprint: "spoken-vocabulary-in-context", band: "expected", genre: item.genre,
      prompt: `Word-signal mission ${index + 1}: what does “${item.word}” mean in this message?`, script: item.script, chunks: sentenceChunks(item.script),
      body: { target_word: item.word, choices: rotate(item.choices, index % item.choices.length), context_clue_mode: "replay_example_then_non_example", interaction_mode: "picture_choice_spoken_label_keyboard_or_switch" }, answer: item.answer,
      hints: ["Listen to the words around the target word.", "The second sentence gives an example or explanation."],
      explanation: `Here, “${item.word}” means ${item.answer}. The clue is: “${item.script.split(". ").at(-1).replace(/\.$/, "")}.”`, difficulty: 4 + Math.floor(index / vocabularyPassages.length), tag: "familiar_word_over_context", hook: "mission-context-clue-beam",
      correct: `Word signal decoded: ${item.word} means ${item.answer} here.`, repair: "Replay the target sentence and its clue sentence as separate chunks. Match the meaning to both.",
    });
  });
}

function inferenceCandidates(count) {
  return Array.from({ length: count }, (_, index) => {
    const item = inferencePassages[index % inferencePassages.length];
    return candidate({
      id: `infer-${item.id}-${index + 1}`, format: "teach-back", blueprint: "simple-clue-based-inference", band: "expected", genre: item.genre,
      prompt: `Clue mission ${index + 1}: choose what is probably true, then choose the heard clue.`, script: item.script, chunks: sentenceChunks(item.script),
      body: { answer_choices: rotate(item.choices, index % item.choices.length), clue_choices: rotate([item.clue, "a name in the message", "a detail that was not spoken"], index % 3), choices: rotate(item.choices, index % item.choices.length), accepted_clue: item.clue, interaction_mode: "tap_speech_aac_eye_gaze_or_adult_scribed" }, answer: item.answer,
      hints: ["Choose an idea that fits all the spoken details.", `Listen for this kind of evidence: ${item.clue.split(" and ")[0]}.`],
      explanation: `${item.answer} is strongly supported by ${item.clue}. The answer comes from heard clues, not from the picture or a guess.`, difficulty: 4 + Math.floor(index / inferencePassages.length), tag: "picture_or_prior_knowledge_guess", hook: "mission-clue-constellation",
      correct: `Clue link complete: ${item.clue} supports “${item.answer}.”`, repair: "Hide the answer pictures, replay each sentence, then select the clue token before choosing the inference again.",
    });
  });
}

function mixedCandidates(count) {
  const intervals = [1, 3, 7, 14, 30];
  return Array.from({ length: count }, (_, index) => {
    const item = mixedPassages[index % mixedPassages.length];
    return candidate({
      id: `mixed-${item.id}-${index + 1}`, format: "listen-read", blueprint: "mixed-listening-retrieval", band: "retrieval", genre: item.genre,
      prompt: `Explorer recall ${index + 1}: listen, then answer: ${item.question}`, script: item.script, chunks: sentenceChunks(item.script),
      body: { choices: rotate(item.choices, index % item.choices.length), comprehension_focus: item.focus, review_interval_days: intervals[index % intervals.length], instruction_support: item.genre === "directions" ? "gesture_or_object_response_allowed" : "not_applicable", interaction_mode: "tap_object_action_keyboard_switch_aac_or_partner_scan" }, answer: item.answer,
      hints: ["Replay is a listening strategy, not a mistake.", item.genre === "directions" ? "Show each step with objects or gestures as you hear it." : "Listen for the sentence that answers the question."],
      explanation: `The message supports ${item.answer}. ${item.genre === "directions" ? "Following the spoken detail in order completes the direction." : "This answer matches the important heard detail."}`, difficulty: 3 + Math.floor(index / mixedPassages.length), tag: item.genre === "directions" ? "direction_detail_missed" : "replay_means_failure", hook: "mission-recall-map-glow",
      correct: "Mission marker placed for careful listening. Replay count and speed do not affect it.", repair: "Choose whole-message or chunk replay. Keep the question visible and respond by pointing, moving an object, AAC, switch or speech.",
    });
  });
}

function candidate({ id, format, blueprint, band, genre, prompt, script, chunks, body, answer, hints, explanation, difficulty, tag, hook, correct, repair }) {
  const fullId = `${prefix}${id}`;
  return {
    id: fullId,
    format,
    body: {
      prompt, narration_script: script, narration_chunks: chunks, ...body,
      passage_genre: genre,
      whole_audio_asset_id: `narration-${fullId}`,
      audio_provider: "ElevenLabs",
      audio_voice_profile: "warm_UK_narration_subject_to_approval",
      audio_asset_status: "required_human_listening_review",
      human_listening_approval_required: true,
      browser_tts_allowed: false,
      browser_tts_fallback: "prohibited",
      unavailable_audio_state: "honest_not_ready_no_assessment",
      replay_allowed: true,
      replay_limit: null,
      chunk_replay: "whole_sentence_or_instruction_step",
      replay_count_scored: false,
      default_assessment_mode: "audio_first_choices_hidden_until_first_listen",
      visual_cues: "neutral_character_and_place_icons_after_first_listen_without_answer_highlight",
      transcript_accommodation: { default_visible: false, access: "adult_controlled_or_access_plan", timing: "after_audio_or_alongside_chunks", content: script, decoding_scored: false },
      auditory_processing_support: { pause_between_chunks: true, playback_speed_options: [0.85, 1], reduced_choice_option: true, quiet_background: true, no_music_under_speech: true, adult_controlled_playback: true },
      response_mode: "tap_keyboard_switch_eye_gaze_aac_speech_object_action_or_adult_scribed",
      supported_interaction: "partner_may_read_interface_scan_choices_control_replay_and_record_response_without_supplying_answer",
      no_voice_recording_required: true,
      no_timer: true,
      speed_score_allowed: false,
      retry_without_penalty: true,
      gamification: { mission: "restore one Wonder Garden signal or path marker by showing listening evidence", reward: "one calm mission star for completing the listen-think-show routine", replay_penalty: false, loss_on_error: false, streak_pressure: false, leaderboard: false, retry_message: "That answer gives us a clue. Choose a replay route and listen again." },
      difficulty_band: band,
      evidence_purpose: blueprint.replaceAll("-", "_"),
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
    },
    expected_answer: { value: answer }, hints, explanation,
    feedback: { correct, repair, evidence: explanation, replay_normalisation: "Replay is a useful listening strategy and is never counted as failure." },
    difficulty, status: "review", misconception_tag: tag, animation_hook: hook,
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
    if (variant.body.audio_provider !== "ElevenLabs" || variant.body.audio_asset_status !== "required_human_listening_review" || variant.body.human_listening_approval_required !== true) throw new Error(`${variant.id} violates the produced-audio review policy.`);
    if (variant.body.browser_tts_allowed !== false || variant.body.browser_tts_fallback !== "prohibited" || variant.body.unavailable_audio_state !== "honest_not_ready_no_assessment") throw new Error(`${variant.id} permits an unsafe audio fallback.`);
    if (!variant.body.whole_audio_asset_id || !variant.body.narration_script || !Array.isArray(variant.body.narration_chunks)) throw new Error(`${variant.id} lacks narration references.`);
    if (variant.body.replay_allowed !== true || variant.body.replay_limit !== null || variant.body.replay_count_scored !== false || !variant.body.chunk_replay) throw new Error(`${variant.id} lacks replay or chunking support.`);
    if (variant.body.transcript_accommodation?.default_visible !== false || variant.body.transcript_accommodation?.access !== "adult_controlled_or_access_plan") throw new Error(`${variant.id} exposes an uncontrolled transcript.`);
    if (!variant.body.auditory_processing_support?.pause_between_chunks || !variant.body.auditory_processing_support?.no_music_under_speech) throw new Error(`${variant.id} lacks auditory-processing support.`);
    if (!variant.body.response_mode.includes("keyboard") || !variant.body.response_mode.includes("switch") || !variant.body.response_mode.includes("eye_gaze") || !variant.body.response_mode.includes("aac")) throw new Error(`${variant.id} lacks supported response routes.`);
    if (variant.body.no_timer !== true || variant.body.speed_score_allowed !== false || variant.body.gamification?.replay_penalty !== false || variant.body.gamification?.streak_pressure !== false) throw new Error(`${variant.id} introduces listening pressure.`);
    if (!variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.evidence || !variant.feedback?.replay_normalisation) throw new Error(`${variant.id} lacks rich feedback.`);
    if (variant.body.narration_script.split(/\s+/).length > 34) throw new Error(`${variant.id} passage is too long for Year 1.`);
    if (variant.body.prompt.length > 130) throw new Error(`${variant.id} prompt is too long for Year 1.`);
    if (variant.format !== "picture-sort") {
      const choices = variant.body.choices ?? variant.body.answer_choices;
      if (!Array.isArray(choices) || choices.length < 2 || new Set(choices.map((choice) => JSON.stringify(choice))).size !== choices.length) throw new Error(`${variant.id} has invalid choices.`);
      if (choices.filter((choice) => JSON.stringify(choice) === JSON.stringify(variant.expected_answer.value)).length !== 1) throw new Error(`${variant.id} must offer exactly one expected answer.`);
    }
  }
  const allocation = countBy(currentPack.question_variants, (variant) => variant.body.variant_blueprint_id);
  for (const [id, expected] of Object.entries(pilotAllocation)) if (allocation[id] !== expected) throw new Error(`${id} expected ${expected}, found ${allocation[id] ?? 0}.`);
  for (const genre of ["story", "information", "poem", "directions"]) if (!generated.some((variant) => variant.body.passage_genre === genre)) throw new Error(`Missing ${genre} listening passages.`);
  if (!generated.some((variant) => variant.body.comprehension_focus?.includes("direction"))) throw new Error("Missing following-directions coverage.");
}

function literal(id, genre, script, question, answer, choices, focus) { return { id, genre, script, question, answer, choices, focus }; }
function sequence(id, genre, script, events) { return { id, genre, script, events }; }
function vocab(id, genre, script, word, answer, choices) { return { id, genre, script, word, answer, choices }; }
function infer(id, genre, script, answer, choices, clue) { return { id, genre, script, answer, choices, clue }; }
function mixed(id, genre, script, question, answer, choices, focus) { return { id, genre, script, question, answer, choices, focus }; }
function sentenceChunks(script) { return script.match(/[^.!?]+[.!?]?/g).map((part, index) => ({ id: `chunk-${index + 1}`, text: part.trim() })); }
function evidenceSentence(script, answer) { return script.split(/(?<=[.!?])\s+/).find((sentence) => normalise(sentence).includes(normalise(answer))) ?? script; }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function normalise(value) { return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " "); }
function countBy(items, keyFor) { const result = {}; for (const item of items) { const key = keyFor(item); result[key] = (result[key] ?? 0) + 1; } return result; }
function summary(items, keyFor) { return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
