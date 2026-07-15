#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/en-y3-grammar-expansion.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "en-y3-grammar-expansion-bank-";
const reviewBatch = "y3-grammar-expansion-pilot-a";

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "en-y3-grammar-expansion") {
  throw new Error("This generator only supports the Year 3 grammar expansion pack.");
}

const beforeVariants = structuredClone(pack.question_variants ?? []);
const beforeCore = coreSnapshot(beforeVariants);
const beforeBlueprints = sortedCounts(beforeVariants, (variant) => variant.body?.variant_blueprint_id);
const beforeMissingFeedback = countMissingFeedback(beforeVariants);
const beforeMissingRoute = countMissingRoute(beforeVariants);
const authored = beforeVariants.filter((variant) => !variant.id.startsWith(prefix)).map(enrichVariant);
const candidates = [
  ...nounPhraseCandidates(),
  ...fragmentCandidates(),
  ...linkCandidates(),
  ...clarityCandidates(),
  ...transferCandidates(),
].map(enrichVariant);

validateBank(pack, authored, candidates);
pack.question_variants = [...authored, ...candidates];
pack.version = "0.3.0";
pack.qa.notes = "Quality-hardened Year 3 grammar-expansion pack with the same four curated proof questions and 226 deterministic pilot candidates. IDs, answers, blueprint allocation, grammatical judgements and curriculum scope remain unchanged. Every variant now has concept-specific feedback addressing noun-phrase purpose, clause completeness, conjunction meaning or editing clarity and its exact misconception. Explicit touch, keyboard, switch, eye-gaze, AAC/oral/adult-scribed routes, clause maps, chunking and dyslexia supports remove mandatory dragging, handwriting and speech. Missions remain untimed and penalty-free. Narration remains selectively absent; any future narration must use produced, human-reviewed ElevenLabs assets and browser TTS is prohibited. Curriculum, teacher, accessibility and safeguarding review must still verify natural alternatives, reading load and interaction routes before runtime promotion.";
validateHardening(pack.question_variants, beforeCore, beforeBlueprints);
const afterMissingFeedback = countMissingFeedback(pack.question_variants);
const afterMissingRoute = countMissingRoute(pack.question_variants);

enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`y3-grammar-bank authored=${authored.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`y3-grammar-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`y3-grammar-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`y3-grammar-bank bands=${summary(candidates, (variant) => variant.body.difficulty_band)}`);
console.log(`y3-grammar-bank missing_feedback before=${beforeMissingFeedback} after=${afterMissingFeedback}`);
console.log(`y3-grammar-bank missing_route before=${beforeMissingRoute} after=${afterMissingRoute}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y3-grammar-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) {
    throw new Error("Year 3 grammar expansion bank is out of date; run generate-y3-grammar-expansion-bank.mjs --write.");
  }
  console.log("y3-grammar-bank deterministic check passed");
} else {
  console.log("y3-grammar-bank dry-run; pass --write to update the pack");
}

function nounPhraseCandidates() {
  const items = [
    ["map", "the map", "the folded map with a red compass mark", ["the wonderful lovely map", "the map carefully", "because the map"]],
    ["backpack", "the backpack", "the blue backpack with Mina's name tag", ["the nice amazing backpack", "the backpack suddenly", "although the backpack"]],
    ["shell", "the shell", "the striped shell beside the tide pool", ["the pretty lovely shell", "the shell loudly", "if the shell"]],
    ["book", "the book", "the green book about nocturnal animals", ["the good interesting book", "the book quickly", "when the book"]],
    ["tree", "the tree", "the oak tree with the split trunk", ["the tall big huge tree", "the tree gently", "because tree"]],
    ["bottle", "the bottle", "the clear bottle labelled rainwater", ["the brilliant nice bottle", "the bottle outside", "although bottle"]],
    ["robot", "the robot", "the silver robot with one square wheel", ["the cool great robot", "the robot noisily", "if robot"]],
    ["bridge", "the bridge", "the narrow wooden bridge over the stream", ["the long big bridge", "the bridge carefully", "because the bridge"]],
    ["seed-tray", "the seed tray", "the seed tray labelled beans", ["the lovely useful seed tray", "the seed tray slowly", "when seed tray"]],
    ["coat", "the coat", "the yellow coat with reflective strips", ["the warm nice good coat", "the coat brightly", "although coat"]],
    ["cave", "the cave", "the low cave behind the waterfall", ["the dark scary amazing cave", "the cave quietly", "if the cave"]],
    ["pencil", "the pencil", "the short blue pencil with a silver star", ["the useful lovely pencil", "the pencil neatly", "because pencil"]],
    ["parcel", "the parcel", "the square parcel tied with green string", ["the exciting nice parcel", "the parcel eagerly", "although the parcel"]],
    ["kite", "the kite", "the diamond-shaped kite with a spotted tail", ["the beautiful lovely kite", "the kite highly", "if kite"]],
    ["door", "the door", "the arched door beneath the clock", ["the old big interesting door", "the door slowly", "because door"]],
  ];
  const prompts = [
    (noun) => `Which noun phrase helps a reader identify ${noun} exactly?`,
    (noun) => `A teammate needs to find ${noun}. Choose the clearest useful detail.`,
    (noun) => `Choose the precise noun phrase for an instruction about ${noun}.`,
  ];
  const variants = [];
  for (const [slug, noun, expected, distractors] of items) {
    for (let mode = 0; mode < prompts.length; mode += 1) {
      const index = variants.length;
      variants.push(makeChoice({
        id: `${prefix}noun-${slug}-${mode + 1}`,
        format: "noun-phrase-builder",
        prompt: prompts[mode](noun),
        choices: rotate([expected, ...distractors], index % 4),
        expected,
        hints: ["Keep detail that helps the reader identify the noun.", "Remove vague praise and words that do not belong in the noun phrase."],
        explanation: `${capitalise(expected)} identifies the noun with specific, grammatical detail rather than piling up vague words.`,
        blueprint: "purposeful-noun-phrase-builds",
        evidencePurpose: "purposeful_noun_expansion",
        misconception: "adjective_pile",
        animation: "useful-detail-gates",
        bandIndex: index,
        body: { base_noun: noun, communicative_purpose: mode === 0 ? "identify" : mode === 1 ? "find" : "instruct" },
      }));
    }
  }
  return variants;
}

function fragmentCandidates() {
  const items = [
    ["rain-stopped", "Because the rain had stopped", "the class went outside", "Because the rain had stopped, the class went outside."],
    ["gate-locked", "Because the gate was locked", "the team used the side path", "Because the gate was locked, the team used the side path."],
    ["lamp-failed", "Because the lamp had no battery", "it would not switch on", "Because the lamp had no battery, it would not switch on."],
    ["muddy-path", "Although the path was muddy", "the walkers continued", "Although the path was muddy, the walkers continued."],
    ["quiet-bell", "Although the bell was quiet", "everyone heard it", "Although the bell was quiet, everyone heard it."],
    ["small-boat", "Although the boat was small", "it carried all four boxes", "Although the boat was small, it carried all four boxes."],
    ["signal-green", "When the signal turned green", "the cyclists moved forward", "When the signal turned green, the cyclists moved forward."],
    ["music-ended", "When the music ended", "the dancers froze", "When the music ended, the dancers froze."],
    ["seed-sprouted", "When the seed sprouted", "the class recorded the date", "When the seed sprouted, the class recorded the date."],
    ["weather-clear", "If the weather stays clear", "we will sketch outdoors", "If the weather stays clear, we will sketch outdoors."],
    ["code-matches", "If the code matches", "the archive door will open", "If the code matches, the archive door will open."],
    ["soil-dry", "If the soil feels dry", "water the plant carefully", "If the soil feels dry, water the plant carefully."],
    ["museum-opened", "Before the museum opened", "the guide checked every display", "Before the museum opened, the guide checked every display."],
    ["crossing", "Before you cross the bridge", "check that the path is clear", "Before you cross the bridge, check that the path is clear."],
    ["mixture", "Before the mixture cools", "pour it into the mould", "Before the mixture cools, pour it into the mould."],
    ["storm-passed", "After the storm passed", "the crew inspected the roof", "After the storm passed, the crew inspected the roof."],
    ["chapter", "After the chapter ended", "Sam wrote a prediction", "After the chapter ended, Sam wrote a prediction."],
    ["measurement", "After we measured the shadow", "we added the result to the table", "After we measured the shadow, we added the result to the table."],
    ["owl-calling", "While the owl was calling", "the recorder captured the sound", "While the owl was calling, the recorder captured the sound."],
    ["paint-dried", "While the paint dried", "we cleaned the brushes", "While the paint dried, we cleaned the brushes."],
    ["timer-running", "While the timer was running", "the group watched for changes", "While the timer was running, the group watched for changes."],
    ["sunset", "As the sun set", "the path lights came on", "As the sun set, the path lights came on."],
    ["water-rises", "As the water level rises", "the marker moves up the scale", "As the water level rises, the marker moves up the scale."],
  ];
  const variants = [];
  for (const [slug, fragment, mainClause, fullSentence] of items) {
    const base = variants.length;
    variants.push(makeChoice({
      id: `${prefix}fragment-${slug}-repair`,
      format: "sentence-editor",
      prompt: `Which option repairs the fragment '${fragment}.'?`,
      choices: rotate([fullSentence, `${fragment}.`, `${fragment} and.`, `The ${fragment.toLowerCase()}.`], base % 4),
      expected: fullSentence,
      hints: ["The opening clause needs a complete partner.", "Choose the option that tells what happened."],
      explanation: `${fullSentence} contains the opening clause and the complete main clause '${mainClause}'.`,
      blueprint: "complete-clause-and-fragment-tests",
      evidencePurpose: "complete_clause_partner",
      misconception: "conjunction_fragment",
      animation: "missing-clause-socket",
      bandIndex: base + 2,
      body: { fragment, edit_task: "repair_fragment" },
    }));
    variants.push(makeChoice({
      id: `${prefix}fragment-${slug}-partner`,
      format: "sentence-editor",
      prompt: `Choose the main clause that completes '${fragment}'.`,
      choices: rotate([mainClause, "because the reason", "although and", "the very interesting"], (base + 1) % 4),
      expected: mainClause,
      hints: ["Look for a group of words with a subject and a verb.", "The partner must complete the meaning of the opening clause."],
      explanation: `'${capitalise(mainClause)}' is a complete main clause, so it gives the opening clause a grammatical partner.`,
      blueprint: "complete-clause-and-fragment-tests",
      evidencePurpose: "main_clause_selection",
      misconception: "conjunction_fragment",
      animation: "missing-clause-socket",
      bandIndex: base + 3,
      body: { fragment, edit_task: "supply_main_clause" },
    }));
  }
  return variants;
}

function linkCandidates() {
  const groups = [
    ["cause", "Because", [
      "___ the soil was dry, Priya watered the bean plant.",
      "___ the torch battery was flat, the bulb stayed dark.",
      "___ the path was icy, the caretaker closed the gate.",
      "___ the instructions were unclear, the group asked for help.",
      "___ the river had risen, the lower path was flooded.",
      "___ the glue was still wet, the model came apart.",
      "___ the library was busy, we used the quiet room.",
      "___ the wheel was loose, the cart wobbled.",
      "___ the clouds covered the Sun, the shadow became faint.",
    ]],
    ["contrast", "Although", [
      "___ the box looked heavy, Jo lifted it easily.",
      "___ the cave was dark, the reflective markers were visible.",
      "___ the first design failed, the team kept testing.",
      "___ the wind was strong, the kite stayed under control.",
      "___ the clue was tiny, Asha noticed it.",
      "___ the water felt cold, the swimmers completed one length.",
      "___ the route was longer, it was safer.",
      "___ the plant looked weak, one new leaf had grown.",
      "___ the drum was small, its sound filled the hall.",
    ]],
    ["condition", "If", [
      "___ the red light flashes, press the stop button.",
      "___ the soil is damp, do not add more water.",
      "___ your estimate is close, test it with an exact calculation.",
      "___ the library book is damaged, tell an adult.",
      "___ the pattern continues, the next shape will be a triangle.",
      "___ the switch is open, the bulb will not light.",
      "___ the map key matches, mark the location.",
      "___ the sentence is complete, add the full stop.",
      "___ the timer reaches zero, record the result.",
    ]],
    ["time", "When", [
      "___ the bell rings, return the equipment.",
      "___ the ice melts, record the water temperature.",
      "___ the character enters, the mood changes.",
      "___ the seedling appears, begin the height chart.",
      "___ the bridge lowers, the boat can pass.",
      "___ the page loads, choose your saved project.",
      "___ the Moon appears, compare its position.",
      "___ the buzzer sounds, the round is complete.",
      "___ the paint dries, add the final label.",
    ]],
    ["time-order", "Before", [
      "___ you start the test, check the equipment.",
      "___ the guests arrive, place the signs by the door.",
      "___ you measure the line, align the ruler with zero.",
      "___ the story ends, write your prediction.",
      "___ the circuit is tested, inspect every connection.",
      "___ you plant the seed, make a small hole.",
      "___ the model is painted, cover the work surface.",
      "___ the recording begins, close the window.",
      "___ you submit the paragraph, read it aloud once.",
    ]],
  ];
  const variants = [];
  for (const [relationship, expected, prompts] of groups) {
    for (let item = 0; item < prompts.length; item += 1) {
      const index = variants.length;
      const distractors = ["Although", "Because", "If", "When", "Before"].filter((choice) => choice !== expected).slice(0, 3);
      variants.push(makeChoice({
        id: `${prefix}link-${relationship}-${item + 1}`,
        format: "clause-linker",
        prompt: `The intended relationship is ${relationship.replace("-", " ")}. Choose the best link: '${prompts[item]}'`,
        choices: rotate([expected, ...distractors], index % 4),
        expected,
        hints: [`The writer wants to show ${relationship.replace("-", " ")}.`, relationship === "cause" ? "Choose the conjunction that gives a reason." : relationship === "contrast" ? "Choose the conjunction that signals an unexpected difference." : relationship === "condition" ? "Choose the conjunction that makes one event depend on another." : "Choose the conjunction that makes the order in time clear."],
        explanation: `'${expected}' accurately signals ${relationship.replace("-", " ")} in this sentence.`,
        blueprint: "time-cause-condition-contrast-links",
        evidencePurpose: "relationship_choice",
        misconception: "link_by_sound",
        animation: "relationship-bridge-switch",
        bandIndex: index + 4,
        body: { relationship, sentence_frame: prompts[item] },
      }));
    }
  }
  return variants;
}

function clarityCandidates() {
  const items = [
    ["robot", "The enormous, huge, massive robot beside the gate, which was shiny, and it beeped because it saw us.", "The enormous robot beside the gate beeped when it saw us.", ["The enormous huge massive robot and beside the gate.", "Because shiny, the robot, which, beeped.", "The robot the gate the beep saw us."]],
    ["fox", "The quick, speedy, fast fox near the hedge, which was red, and it ran because the dog barked.", "The quick red fox near the hedge ran when the dog barked.", ["The quick speedy fast fox and near the hedge.", "Because red, which fox ran.", "The fox hedge dog barked running."]],
    ["boat", "The little, small, tiny boat with a blue sail, and it crossed although the wind was strong.", "The small boat with a blue sail crossed although the wind was strong.", ["The little small tiny boat and blue sail.", "Although boat with wind crossing.", "The sail the boat strong crossed."]],
    ["owl", "The silent, quiet, noiseless owl in the oak tree, which had wide wings, and it watched us.", "The quiet owl with wide wings watched us from the oak tree.", ["The silent quiet noiseless owl and oak.", "Which wide, the owl, and watched.", "The owl tree wings us watching."]],
    ["machine", "The old, ancient, very old machine in the workshop, and because it shook, it stopped.", "The old machine in the workshop stopped because it shook.", ["The old ancient very old machine and workshop.", "Because it shook and because stopped.", "The machine workshop shaking stop."]],
    ["path", "The narrow, thin, not wide path through the woods, which was muddy, and we followed it.", "We followed the narrow muddy path through the woods.", ["The narrow thin not wide path and woods.", "Which muddy, and followed path.", "We path woods it followed narrow."]],
    ["parcel", "The square, box-shaped, four-sided parcel on the desk, and it had green string, and I opened it.", "I opened the square parcel with green string on the desk.", ["The square box-shaped four-sided parcel and desk.", "Green string, and parcel, which opened.", "I desk parcel green opened it."]],
    ["puppy", "The playful, lively, full-of-energy puppy by the bench, which had muddy paws, and it jumped.", "The lively puppy with muddy paws jumped by the bench.", ["The playful lively full-of-energy puppy and bench.", "Which muddy, the puppy, and jumped.", "Puppy bench paws it jumping."]],
    ["tower", "The tall, high, very towering tower above the town, and it flashed when night came because dark.", "The tall tower above the town flashed when night came.", ["The tall high very towering tower and town.", "Because dark when and flashed.", "Tower town night flash tall."]],
    ["garden", "The colourful, bright, full-of-colour garden behind school, which had spring flowers, and it attracted bees.", "The bright garden behind school attracted bees with its spring flowers.", ["The colourful bright full-of-colour garden and school.", "Which flowers and because bees.", "Garden school bees spring attracted."]],
    ["train", "The long, lengthy, very extended train at platform two, which was silver, and it arrived late.", "The long silver train arrived late at platform two.", ["The long lengthy very extended train and platform.", "Which silver and arrived because.", "Train platform late silver arriving."]],
    ["stream", "The cold, chilly, freezing stream below the bridge, and it moved quickly because downhill.", "The cold stream below the bridge moved quickly downhill.", ["The cold chilly freezing stream and bridge.", "Because downhill and stream which.", "Stream bridge quickly cold moving."]],
    ["costume", "The bright, colourful, vivid costume with silver stars, which was for the play, and Ana wore it.", "Ana wore the bright costume with silver stars for the play.", ["The bright colourful vivid costume and stars.", "Which play, costume, and wore.", "Ana stars play costume wearing."]],
    ["notebook", "The small, little, not large notebook beside the lamp, and it contained our results, which were important.", "The small notebook beside the lamp contained our important results.", ["The small little not large notebook and lamp.", "Which results, and notebook contained.", "Notebook lamp results important contained."]],
    ["dragon", "The fierce, scary, frightening dragon beyond the wall, which had silver scales, and it slept although guards watched.", "The fierce dragon with silver scales slept beyond the wall although guards watched.", ["The fierce scary frightening dragon and wall.", "Although silver, which dragon slept.", "Dragon wall guards scales sleeping."]],
  ];
  const prompts = [
    "Which edit keeps the useful meaning clearest?",
    "Choose the revision that removes repetition but keeps precise detail.",
    "Which sentence is grammatical, concise and easy to follow?",
  ];
  const variants = [];
  for (const [slug, original, expected, distractors] of items) {
    for (let mode = 0; mode < prompts.length; mode += 1) {
      const index = variants.length;
      variants.push(makeChoice({
        id: `${prefix}clarity-${slug}-${mode + 1}`,
        format: "sentence-editor",
        prompt: `${prompts[mode]} Original: '${original}'`,
        choices: rotate([expected, ...distractors], index % 4),
        expected,
        hints: ["Keep details that identify or explain something useful.", "Remove repeated meanings and check that every clause joins clearly."],
        explanation: `${expected} keeps precise detail while removing repetition and restoring a clear clause structure.`,
        blueprint: "expand-edit-for-clarity",
        evidencePurpose: "overload_revision",
        misconception: "expansion_overload",
        animation: "meaning-load-balance",
        bandIndex: index + 1,
        body: { original, edit_focus: mode === 0 ? "clarity" : mode === 1 ? "remove_repetition" : "grammar_and_flow" },
      }));
    }
  }
  return variants;
}

function transferCandidates() {
  const items = [
    ["museum-map", "Which sentence gives a visitor the clearest instruction?", "Follow the dotted map to the gallery beside the clock.", ["Follow the nice lovely map.", "Because the map to gallery.", "The gallery the clock follow."], "purposeful_noun_expansion", "adjective_pile"],
    ["wet-ground", "Which sentence explains why the match moved indoors?", "The match moved indoors because the ground was wet.", ["The match moved indoors although the ground was wet.", "Because the wet ground.", "The match the ground indoors."], "relationship_choice", "link_by_sound"],
    ["quiet-buzzer", "Which sentence shows an unexpected contrast?", "Although the buzzer was quiet, everyone heard it.", ["Because the buzzer was quiet, everyone heard it.", "Although the quiet buzzer.", "The buzzer everyone quiet heard."], "relationship_choice", "link_by_sound"],
    ["plant-check", "Which instruction uses a condition accurately?", "If the soil feels dry, add a little water.", ["Although the soil feels dry, add a little water.", "If the dry soil.", "The soil water if little."], "relationship_choice", "link_by_sound"],
    ["shadow-record", "Which sentence makes the time order clear?", "After we measured the shadow, we recorded its length.", ["Because we measured the shadow, we recorded its length.", "After the measured shadow.", "The shadow its length recorded."], "relationship_choice", "link_by_sound"],
    ["specific-key", "Which note identifies one particular key?", "Use the small iron key with a triangular hole.", ["Use the nice amazing key.", "Use the key quickly.", "Because the key with."] , "purposeful_noun_expansion", "adjective_pile"],
    ["complete-reason", "Which option is a complete sentence?", "Because the bridge was closed, we chose another route.", ["Because the bridge was closed.", "Because the closed bridge.", "Although because the bridge."], "complete_clause_partner", "conjunction_fragment"],
    ["clear-description", "Which sentence keeps only useful description?", "The spotted dog with a red collar waited by the gate.", ["The spotted patterned dotted dog with a lovely nice collar waited.", "The dog quickly red collar.", "Because the spotted dog."], "overload_revision", "expansion_overload"],
    ["experiment-cause", "Which result sentence expresses cause clearly?", "The paper tore because it became soaked.", ["The paper tore although it became soaked.", "Because the soaked paper.", "The paper soaked tearing it."], "relationship_choice", "link_by_sound"],
    ["story-condition", "Which sentence tells what may happen under one condition?", "If the lantern goes out, the travellers will stop.", ["Although the lantern goes out, the travellers will stop.", "If the lantern out.", "The travellers lantern stop if."], "relationship_choice", "link_by_sound"],
    ["contrast-route", "Which sentence makes the safer choice sound unexpected?", "Although the forest route was shorter, the group chose the road.", ["Because the forest route was shorter, the group chose the road.", "Although the shorter route.", "The route group road shorter."], "relationship_choice", "link_by_sound"],
    ["labelled-tray", "Which phrase identifies the correct science tray?", "the shallow tray labelled rock samples", ["the useful good tray", "the tray carefully", "although the tray"], "purposeful_noun_expansion", "adjective_pile"],
    ["timer-fragment", "Which option completes the message 'When the timer rings'?", "put the pencils down", ["when the timer", "the ringing timer", "because and"], "main_clause_selection", "conjunction_fragment"],
    ["fox-edit", "Which edit is easiest to follow?", "The red fox beneath the oak watched the empty path.", ["The red crimson scarlet fox beneath under the oak watched.", "Which fox, and beneath, watched.", "Fox oak path empty watching."], "overload_revision", "expansion_overload"],
    ["paragraph-link", "Which sentence links the explanation clearly?", "The bulb stayed off because the circuit had a gap.", ["The bulb stayed off although the circuit had a gap.", "Because the circuit gap.", "The bulb circuit stayed gap."], "relationship_choice", "link_by_sound"],
  ];
  const promptFrames = [
    (prompt) => prompt,
    (prompt) => `Mixed review: ${lowerFirst(prompt)}`,
    (prompt) => `Read for meaning, then answer: ${lowerFirst(prompt)}`,
  ];
  const variants = [];
  for (const [slug, prompt, expected, distractors, evidencePurpose, misconception] of items) {
    for (let mode = 0; mode < promptFrames.length; mode += 1) {
      const index = variants.length;
      variants.push(makeChoice({
        id: `${prefix}transfer-${slug}-${mode + 1}`,
        format: "meaning-choice",
        prompt: promptFrames[mode](prompt),
        choices: rotate([expected, ...distractors], index % 4),
        expected,
        hints: ["Read every option as a complete message.", "Check whether the detail or link matches the writer's purpose."],
        explanation: transferExplanation(evidencePurpose),
        blueprint: "grammar-expansion-spaced-transfer",
        evidencePurpose,
        misconception,
        animation: "sentence-expansion-stepper",
        bandIndex: index + 5,
        body: { transfer_context: slug.replaceAll("-", "_"), retrieval_spacing: "scheduled" },
      }));
    }
  }
  return variants;
}

function makeChoice({ id, format, prompt, choices, expected, hints, explanation, blueprint, evidencePurpose, misconception, animation, bandIndex, body }) {
  const difficultyBand = bandFor(bandIndex);
  return {
    id,
    format,
    body: {
      prompt,
      choices,
      ...body,
      evidence_purpose: evidencePurpose,
      variant_blueprint_id: blueprint,
      difficulty_band: difficultyBand,
      review_batch: reviewBatch,
      response_mode: "tap_keyboard_switch_or_oral_choice",
      audio_replay: true,
      timed: false,
      drag_required: false,
      visual_load: "low",
      keyboard_instructions: "Use arrow keys to review choices, then Enter to select.",
      switch_scan_order: "prompt_then_choices_then_check",
      static_alternative: "numbered_prompt_and_choice_list",
      reduced_motion_alternative: "instant_outline_and_text_feedback",
    },
    expected_answer: { value: expected },
    hints,
    explanation,
    difficulty: difficultyFor(difficultyBand),
    status: "review",
    misconception_tag: misconception,
    animation_hook: animation,
  };
}

function validateBank(packData, authored, generated) {
  const pilot = packData.practice?.variant_targets?.pilot;
  if (authored.length !== 4) throw new Error(`Expected four curated variants, found ${authored.length}.`);
  if (generated.length !== pilot - authored.length) {
    throw new Error(`Expected ${pilot - authored.length} generated candidates, found ${generated.length}.`);
  }
  const all = [...authored, ...generated];
  if (all.length !== pilot) throw new Error(`Pilot bank must contain exactly ${pilot} variants.`);

  const blueprintIDs = new Set((packData.variant_blueprints ?? []).map((blueprint) => blueprint.id));
  const formats = new Set(packData.practice?.formats ?? []);
  const bands = new Set([
    ...(packData.practice?.difficulty_bands ?? []),
    ...(packData.variant_blueprints ?? []).map((blueprint) => blueprint.difficulty_band),
  ]);
  const generatedBlueprints = new Set();
  const generatedFormats = new Set();
  const generatedBands = new Set();
  const ids = new Set();
  const signatures = new Set();

  for (const variant of all) {
    if (ids.has(variant.id)) throw new Error(`Duplicate variant id ${variant.id}.`);
    ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${normalise(variant.expected_answer?.value)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`);
    signatures.add(signature);
  }

  for (const variant of generated) {
    const blueprint = variant.body?.variant_blueprint_id;
    if (variant.status !== "review") throw new Error(`${variant.id} must remain in review.`);
    if (!blueprintIDs.has(blueprint)) throw new Error(`${variant.id} has unknown blueprint ${blueprint}.`);
    if (!formats.has(variant.format)) throw new Error(`${variant.id} has unknown format ${variant.format}.`);
    const choices = variant.body?.choices ?? [];
    if (choices.filter((choice) => choice === variant.expected_answer?.value).length !== 1) {
      throw new Error(`${variant.id} must include its expected answer exactly once.`);
    }
    if (normalise(variant.body?.prompt).includes(normalise(variant.expected_answer?.value))) {
      throw new Error(`${variant.id} prompt leaks its expected answer.`);
    }
    if (!Array.isArray(variant.hints) || variant.hints.length < 2 || !variant.explanation) {
      throw new Error(`${variant.id} requires two useful hints and an explanation.`);
    }
    generatedBlueprints.add(blueprint);
    generatedFormats.add(variant.format);
    generatedBands.add(variant.body.difficulty_band);
  }

  assertCovered("blueprints", blueprintIDs, generatedBlueprints);
  assertCovered("formats", formats, generatedFormats);
  assertCovered("difficulty bands", bands, generatedBands);
}

function enrichVariant(variant) {
  const body = variant.body ?? {};
  const hasAudioReference = Boolean(body.audio_asset_id || body.audio_asset_ids?.length);
  const audioPolicy = hasAudioReference ? {
    audio_provider: "ElevenLabs",
    audio_production_policy: "produced_and_human_listening_reviewed_assets_only",
    human_listening_approval_required: true,
    browser_tts_allowed: false,
    browser_tts_fallback: "prohibited",
  } : {
    audio_required: false,
    audio_route: "not_required_text_chunks_clause_maps_and_choices_are_complete",
    audio_policy: "if_narration_is_added_use_produced_human_reviewed_ElevenLabs_assets_only",
    browser_tts_allowed: false,
    browser_tts_fallback: "prohibited",
  };
  return {
    ...variant,
    body: {
      ...body,
      ...audioPolicy,
      interaction_route: {
        touch: "Tap a sentence chunk or numbered choice, then tap check; moving chunks by drag is optional.",
        keyboard: "Tab through prompt, clause or noun-phrase chunks and choices; use arrows to review and Enter or Space to select, place or check.",
        switch_scan: "Scan prompt, chunk map, numbered choices, check and retry in a fixed order with one activation per decision.",
        eye_gaze: "Use large dwell-select chunk and choice targets with adjustable dwell time and a confirm step.",
        aac_oral_adult_scribed: "The learner may point, use AAC, compose orally or direct an adult to select/place/transcribe the indicated answer without the adult supplying the grammatical judgement.",
        drag_required: false,
      },
      accessible_response_route: "Touch, keyboard, switch, eye gaze, AAC, oral composition, pointing and adult-scribed responses provide equivalent grammar evidence; dragging, handwriting and speech are never mandatory.",
      chunking_route: "Prompt and options can be revealed one sentence or labelled meaning chunk at a time with line focus, adjustable spacing and correct chunks preserved.",
      clause_map_route: "Conjunction-led clause, main clause, subject/command focus and verb are shown in separate labelled text boxes; a linear text list replaces spatial mapping.",
      noun_phrase_route: "Determiner, noun and useful identifying/describing detail are bracketed separately; vague adjective piles and words outside the noun phrase can be compared without colour-only cues.",
      meaning_comparison_route: "Original and revised sentences remain side by side with relationship labels for cause, time, condition or contrast and a concise read-for-meaning question.",
      dyslexia_support: { one_sentence_per_panel: true, line_focus: true, adjustable_spacing_and_font: true, persistent_chunk_brackets: true, reduced_choice_mode: true, colour_not_required: true, oral_or_adult_scribed_equal_evidence: true },
      reduced_load_route: "Show one choice, clause boundary, conjunction relationship or editing decision at a time while retaining the complete target meaning and correct work.",
      no_mandatory_dragging: true,
      no_mandatory_handwriting: true,
      no_mandatory_speech: true,
      microphone_required: false,
      handwriting_required: false,
      drag_required: false,
      retry_without_penalty: true,
      no_timer: true,
      speed_score_allowed: false,
      preserve_correct_work: true,
      undo_available: true,
      pressure_rules: { timer: false, speed_score: false, streaks: false, lives: false, loss_on_error: false, public_ranking: false, retry_cost: false },
    },
    feedback: feedbackFor(variant),
  };
}

function feedbackFor(variant) {
  return {
    correct: correctFeedback(variant),
    repair: repairFeedback(variant),
    grammar_evidence: grammarEvidence(variant),
    misconception_support: `${variant.misconception_tag}: ${repairFeedback(variant)}`,
    strategy_support: strategySupport(variant),
    support_message: "Chunk selection, touch, keyboard, switch, eye gaze, AAC, oral composition and adult scribing are equally valid; speed, dragging, speech and handwriting are not scored.",
    retry: "Your correct meaning and sentence chunks stay. Inspect one noun-detail, clause-boundary, conjunction or clarity clue, then retry without losing progress.",
  };
}

function correctFeedback(variant) {
  const expected = variant.expected_answer?.value;
  const purpose = variant.body?.evidence_purpose;
  if (purpose === "purposeful_noun_expansion") return `“${expected}” keeps the noun easy to identify and adds specific detail with a clear job instead of piling up vague praise.`;
  if (purpose === "complete_clause_partner") return `“${expected}” repairs the fragment by pairing the conjunction-led clause with a complete main clause that tells what happened.`;
  if (purpose === "main_clause_selection") return `“${expected}” supplies the complete clause or command needed to finish the opening idea.`;
  if (purpose === "relationship_choice") return `“${expected}” expresses the intended ${variant.body?.relationship?.replaceAll("-", " ") ?? conjunctionMeaning(expected)} relationship while keeping the linked ideas clear.`;
  return `“${expected}” keeps the central message easy to follow, retains useful detail and removes repetition or broken clause links.`;
}

function repairFeedback(variant) {
  if (variant.misconception_tag === "adjective_pile") return "Find the head noun, ask what detail helps the reader identify or picture this exact noun, keep that grammatical detail and remove vague praise, repeated adjectives or words that belong outside the noun phrase.";
  if (variant.misconception_tag === "conjunction_fragment") return "Box the conjunction-led clause and find its verb, then ask ‘what happened?’ Add a complete main clause or command with its own verb so the whole message is complete.";
  if (variant.misconception_tag === "link_by_sound") return "Name the relationship before choosing: because gives cause, although gives contrast, if gives condition, and when/before give time. Reread both ideas with the selected link and reject a link that changes the intended meaning.";
  return "Underline the core subject or command focus and verb, bracket each added phrase or clause, keep only detail with a clear job, and repair or remove any repetition or link that hides the main meaning.";
}

function grammarEvidence(variant) {
  const expected = variant.expected_answer?.value;
  const purpose = variant.body?.evidence_purpose;
  if (purpose === "purposeful_noun_expansion") return `The selected noun phrase “${expected}” contains a head noun plus precise identifying, describing or specifying detail; it remains one grammatical noun phrase.`;
  if (purpose === "complete_clause_partner" || purpose === "main_clause_selection") return `The selected completion “${expected}” supplies the action, event or command needed by the opening clause, so the message is no longer a conjunction-led fragment.`;
  if (purpose === "relationship_choice") return `The selected answer “${expected}” matches ${variant.body?.relationship?.replaceAll("-", " ") ?? conjunctionMeaning(expected)} meaning rather than being chosen only because it sounds familiar.`;
  return `The revision “${expected}” preserves the main message and useful description while reducing repetition, overload or unclear clause structure.`;
}

function strategySupport(variant) {
  const purpose = variant.body?.evidence_purpose;
  if (purpose === "purposeful_noun_expansion") return "Use HEAD NOUN → DETAIL WITH A JOB → REMOVE REPETITION → REREAD.";
  if (purpose === "complete_clause_partner" || purpose === "main_clause_selection") return "Use FIND VERB → ASK WHAT HAPPENED → SUPPLY COMPLETE PARTNER → REREAD WHOLE MESSAGE.";
  if (purpose === "relationship_choice") return "Use NAME RELATIONSHIP → CHOOSE CONJUNCTION → CHECK BOTH CLAUSES → REREAD MEANING.";
  return "Use FIND CORE MESSAGE → BRACKET ADDED DETAIL → REMOVE/REPAIR ONE UNCLEAR PART → REREAD FOR CLARITY.";
}

function conjunctionMeaning(value) {
  const text = String(value).toLowerCase();
  if (text.includes("because")) return "cause";
  if (text.includes("although")) return "contrast";
  if (/\bif\b/.test(text)) return "condition";
  if (/\bwhen\b|\bbefore\b|\bafter\b|\bwhile\b|\bas\b/.test(text)) return "time";
  return "stated";
}

function validateHardening(variants, beforeCoreSnapshot, beforeBlueprintCounts) {
  if (variants.length !== 230) throw new Error(`Expected 230 variants, found ${variants.length}.`);
  if (new Set(variants.map((variant) => variant.id)).size !== 230) throw new Error("Variant IDs are not unique.");
  if (JSON.stringify(coreSnapshot(variants)) !== JSON.stringify(beforeCoreSnapshot)) throw new Error("Hardening changed IDs, answers, curated content, grammar judgements, curriculum scope or ordering.");
  if (JSON.stringify(sortedCounts(variants, (variant) => variant.body?.variant_blueprint_id)) !== JSON.stringify(beforeBlueprintCounts)) throw new Error("Blueprint allocation changed during hardening.");
  if (countMissingFeedback(variants) !== 0) throw new Error("At least one variant still lacks concept-specific feedback.");
  if (countMissingRoute(variants) !== 0) throw new Error("At least one variant still lacks a complete interaction route.");
  for (const variant of variants) {
    const body = variant.body, hasAudioReference = Boolean(body.audio_asset_id || body.audio_asset_ids?.length);
    if (hasAudioReference) {
      if (body.audio_provider !== "ElevenLabs" || body.audio_production_policy !== "produced_and_human_listening_reviewed_assets_only" || !body.human_listening_approval_required || body.browser_tts_allowed !== false || body.browser_tts_fallback !== "prohibited") throw new Error(`Audio policy failed in ${variant.id}.`);
    } else if (body.audio_required !== false || body.audio_provider || body.browser_tts_allowed !== false || body.browser_tts_fallback !== "prohibited") throw new Error(`Selective no-audio policy failed in ${variant.id}.`);
    if (!body.no_timer || body.speed_score_allowed || body.pressure_rules?.streaks || body.pressure_rules?.lives || body.pressure_rules?.loss_on_error) throw new Error(`Pressure mechanic found in ${variant.id}.`);
  }
}

function coreSnapshot(variants) { return variants.map(stripEnrichment); }
function stripEnrichment(variant) {
  const copy = structuredClone(variant); delete copy.feedback;
  for (const key of ["interaction_route", "accessible_response_route", "chunking_route", "clause_map_route", "noun_phrase_route", "meaning_comparison_route", "dyslexia_support", "reduced_load_route", "no_mandatory_dragging", "no_mandatory_handwriting", "no_mandatory_speech", "microphone_required", "handwriting_required", "drag_required", "retry_without_penalty", "no_timer", "speed_score_allowed", "preserve_correct_work", "undo_available", "pressure_rules", "audio_required", "audio_route", "audio_policy", "audio_provider", "audio_production_policy", "human_listening_approval_required", "browser_tts_allowed", "browser_tts_fallback"]) delete copy.body[key];
  return copy;
}
function countMissingFeedback(variants) { return variants.filter((variant) => !variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.grammar_evidence || !variant.feedback?.misconception_support || !variant.feedback?.strategy_support).length; }
function countMissingRoute(variants) { return variants.filter((variant) => { const body = variant.body ?? {}, route = body.interaction_route ?? {}; return !route.touch || !route.keyboard || !route.switch_scan || !route.eye_gaze || !route.aac_oral_adult_scribed || route.drag_required !== false || body.no_mandatory_dragging !== true || body.no_mandatory_handwriting !== true || body.no_mandatory_speech !== true; }).length; }
function sortedCounts(items, keyFor) { const counts = {}; for (const item of items) { const key = keyFor(item); counts[key] = (counts[key] ?? 0) + 1; } return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => String(left).localeCompare(String(right)))); }

function assertCovered(label, required, actual) {
  const missing = [...required].filter((value) => value && !actual.has(value));
  if (missing.length > 0) throw new Error(`Generated bank is missing ${label}: ${missing.join(", ")}.`);
}

function bandFor(index) {
  return ["intro", "developing", "expected", "secure", "stretch", "retrieval"][index % 6];
}

function difficultyFor(band) {
  return { intro: 2, developing: 4, expected: 5, secure: 7, stretch: 8, retrieval: 6 }[band];
}

function transferExplanation(evidencePurpose) {
  return {
    purposeful_noun_expansion: "The selected detail identifies the noun precisely without adding vague or unnecessary words.",
    relationship_choice: "The selected conjunction matches the intended relationship, and both linked ideas remain complete and clear.",
    complete_clause_partner: "The opening conjunction-led clause now has a complete main-clause partner.",
    main_clause_selection: "The selected command contains a verb, completes the time clause and makes the whole message clear.",
    overload_revision: "The revision keeps useful detail while removing repetition and broken clause links.",
  }[evidencePurpose] ?? "The selected sentence is grammatical and communicates its intended meaning clearly.";
}

function rotate(items, amount) {
  const offset = amount % items.length;
  return items.slice(offset).concat(items.slice(0, offset));
}

function normalise(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function capitalise(value) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function lowerFirst(value) {
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function summary(variants, key) {
  const counts = new Map();
  for (const variant of variants) counts.set(key(variant), (counts.get(key(variant)) ?? 0) + 1);
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([name, count]) => `${name}:${count}`).join(",");
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function relative(file) {
  return path.relative(repoRoot, file).replaceAll("\\", "/");
}
