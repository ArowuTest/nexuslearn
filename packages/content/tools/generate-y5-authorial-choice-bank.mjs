#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/en-y5-authorial-choice.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "en-y5-authorial-choice-bank-";
const pilotTarget = 240;

if (write && check) throw new Error("Choose either --write or --check, not both.");

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "en-y5-authorial-choice") {
  throw new Error("This generator only supports the Year 5 authorial-choice pack.");
}

const authored = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (authored.length !== 4) {
  throw new Error(`Expected exactly 4 curated variants, found ${authored.length}. Refusing to overwrite possible authored work.`);
}

const contexts = [
  { key: "library", name: "Ari", place: "library", object: "map" },
  { key: "arts-centre", name: "Mina", place: "community arts centre", object: "sketchbook" },
  { key: "museum", name: "Tomas", place: "local museum", object: "model boat" },
  { key: "science-centre", name: "Zara", place: "science centre", object: "star chart" },
];
const coreBands = ["intro", "developing", "expected", "secure", "stretch"];
const retrievalBands = ["retrieval", "intro", "developing", "expected", "secure", "stretch"];

const preciseItems = [
  { key: "crept", passage: "At the {place}, {name} watched as the side door crept open while the corridor stayed empty.", target: "crept", choices: ["crept", "side door", "corridor", "empty"], meaning: "Crept suggests slow, quiet movement, making the opening seem secretive rather than ordinary." },
  { key: "darted", passage: "Near the {place}, a wren darted between the benches before {name} could point it out.", target: "darted", choices: ["darted", "wren", "benches", "point it out"], meaning: "Darted suggests a sudden, rapid movement, emphasising how quickly the bird disappears from view." },
  { key: "hovered", passage: "In the {place}, {name}'s hand hovered above the {object}, not quite ready to pick it up.", target: "hovered", choices: ["hovered", "hand", "above", "pick it up"], meaning: "Hovered shows the hand pausing close by, suggesting hesitation before the decision." },
  { key: "trudged", passage: "After tidying the {place}, {name} trudged towards the exit with the heavy box.", target: "trudged", choices: ["trudged", "exit", "heavy box", "tidying"], meaning: "Trudged suggests slow, effortful steps, showing that the walk feels tiring." },
  { key: "gleamed", passage: "A narrow beam reached the {object}, and its painted edge gleamed in the dim {place}.", target: "gleamed", choices: ["gleamed", "narrow beam", "painted edge", "dim"], meaning: "Gleamed suggests a clear, bright reflection that makes the object briefly stand out from the dim setting." },
  { key: "muttered", passage: "'The label was here yesterday,' {name} muttered, keeping the words low in the quiet {place}.", target: "muttered", choices: ["muttered", "label", "yesterday", "quiet"], meaning: "Muttered suggests quiet, unclear speech, which may show annoyance or thought kept partly private." },
  { key: "brittle", passage: "Inside the {place}, {name} unfolded the brittle note beside the {object} with great care.", target: "brittle", choices: ["brittle", "unfolded", "beside", "great care"], meaning: "Brittle suggests the note may crack or break easily, explaining the character's careful handling." },
  { key: "nestled", passage: "The {object} nestled between two folded cloths in a drawer at the {place}.", target: "nestled", choices: ["nestled", "folded cloths", "drawer", "between"], meaning: "Nestled suggests the object is held closely and safely, giving the hiding place a protected feeling." },
  { key: "scattered", passage: "When {name} entered the {place}, sketches were scattered across the long table instead of stacked neatly.", target: "scattered", choices: ["scattered", "sketches", "long table", "stacked neatly"], meaning: "Scattered suggests the sketches are spread irregularly, making the workspace seem hurried or disordered." },
  { key: "swallowed", passage: "As the lights went out, the dark {place} swallowed the far end of the corridor from {name}'s view.", target: "swallowed", choices: ["swallowed", "lights went out", "far end", "view"], meaning: "Swallowed presents the darkness as if it consumes the view, making the space seem suddenly enclosing." },
  { key: "sprang", passage: "The catch clicked and the lid of a storage box sprang open beside the {object} in the {place}.", target: "sprang", choices: ["sprang", "catch clicked", "storage box", "beside"], meaning: "Sprang suggests quick, energetic movement, making the opening feel sudden." },
  { key: "drifted", passage: "A tune drifted from the next room while {name} sorted displays in the {place}.", target: "drifted", choices: ["drifted", "tune", "next room", "sorted displays"], meaning: "Drifted suggests the sound travels gently and without a sharp edge, creating a calm background." },
];

const imageryItems = [
  { key: "rain-stitches", extract: "Rain stitched silver lines across the windows of the {place}.", answer: "Stitched links the separate rain trails into a neat pattern, helping the reader picture fine lines joining the window.", tag: "generic_reader_effect" },
  { key: "market-wakes", extract: "By eight o'clock, the {place} woke, stretching bright signs towards the street.", answer: "Describing the place as waking and stretching makes its gradual opening seem lively and active.", tag: "technique_without_context" },
  { key: "still-no-signal", extract: "Still no signal. Still no reply. Still {name} watched the small screen.", answer: "Repeating still emphasises the continuing wait and may make the delay feel increasingly frustrating.", tag: "generic_reader_effect" },
  { key: "whispering-leaves", extract: "Leaves whispered above {name} as the path beside the {place} narrowed.", answer: "Whispered suggests a soft, secretive sound, giving the narrowing path a hushed atmosphere.", tag: "technique_without_context" },
  { key: "clock-nibbled", extract: "The clock nibbled away the final minutes before the {place} closed.", answer: "Nibbled presents time as disappearing in small pieces, drawing attention to the steadily shrinking opportunity.", tag: "generic_reader_effect" },
  { key: "bright-brass", extract: "Bright brass bells bounced their notes around the {place}.", answer: "The repeated b sound gives the line a buoyant rhythm that matches the lively ringing bells.", tag: "generic_reader_effect" },
  { key: "blanket-cloud", extract: "A low blanket of cloud covered the hills beyond the {place}.", answer: "Blanket helps the reader picture one broad layer covering the hills and suggests a heavy, enclosed sky.", tag: "technique_without_context" },
  { key: "tiny-turn", extract: "Turn by tiny turn, {name} eased the stiff key into the lock beside the {object}.", answer: "The repeated turn and the phrase tiny turn slow the moment down, emphasising careful effort.", tag: "generic_reader_effect" },
  { key: "river-ribbon", extract: "From the hill, the river was a blue ribbon curling past the {place}.", answer: "Ribbon conveys the river's long, narrow shape and curling route when seen from far above.", tag: "technique_without_context" },
  { key: "chairs-waited", extract: "Rows of empty chairs waited patiently for the talk at the {place} to begin.", answer: "Giving the chairs patience makes the empty room seem expectant before people arrive.", tag: "generic_reader_effect" },
  { key: "tap-tap", extract: "Tap, tap, tap went the loose sign while {name} searched the quiet {place}.", answer: "The repeated tap makes the small sound persistent, so it stands out against the quiet setting.", tag: "generic_reader_effect" },
  { key: "sun-poured", extract: "Late sunlight poured through the high windows and warmed the floor around the {object}.", answer: "Poured suggests plentiful, flowing light spreading across the floor, creating a warm and generous image.", tag: "technique_without_context" },
];

const sentenceItems = [
  { key: "sudden-find", purpose: "create a sudden discovery after a steady approach", best: "{name} checked each shelf in the {place}, reading every label as the clock ticked. The {object} was gone.", other: "{name} checked each shelf in the {place} and read every label and noticed that the {object} was gone.", explanation: "The longer first sentence establishes the steady search; the brief second sentence isolates and foregrounds the discovery." },
  { key: "calm-list", purpose: "present a calm, orderly routine", best: "First {name} opened the blinds, then arranged the chairs, and finally placed the {object} on the desk.", other: "{name} opened the blinds. Chairs! The {object}! Everything happened at once.", explanation: "The ordered clauses and sequence markers guide the reader smoothly through a calm routine." },
  { key: "pause-before-answer", purpose: "make the answer feel delayed and considered", best: "{name} looked again at the {object}, checked the note, and took a breath. 'I think I understand.'", other: "{name} immediately said, 'I think I understand,' while looking at the {object}.", explanation: "The actions before the speech postpone the answer, suggesting that the character considers it carefully." },
  { key: "busy-opening", purpose: "show several parts of the place becoming busy together", best: "Doors opened, signs turned, footsteps crossed the floor, and voices filled the {place}.", other: "The {place} became busy.", explanation: "The accumulating list of actions builds a layered impression of activity across the place." },
  { key: "single-focus", purpose: "shift attention from a wide setting to one important object", best: "People moved between every display in the crowded {place}. On the empty centre table sat the {object}.", other: "The crowded {place} had people and displays and the {object} was on a table.", explanation: "The sentence break and opening position of the second sentence narrow attention onto the single object." },
  { key: "careful-instructions", purpose: "make a set of instructions easy to follow", best: "Lift the cover. Check the label. Place the {object} in the marked tray.", other: "After lifting the cover and checking the label, the {object} should potentially be placed in the tray that has been marked.", explanation: "Three direct sentences separate the actions clearly and present them in the order needed." },
  { key: "building-wind", purpose: "show the wind becoming gradually stronger", best: "The curtain stirred, the papers lifted, and then the door rattled in its frame.", other: "The door rattled and papers lifted and the curtain stirred.", explanation: "The ordered list moves from a small effect to a stronger one, creating a clear build in intensity." },
  { key: "hesitant-step", purpose: "show that the character is uncertain about entering", best: "{name} reached for the handle - then stopped. Beyond the door, the {place} was silent.", other: "{name} confidently opened the door and entered the silent {place}.", explanation: "The dash interrupts the movement before the short statement stopped, making the hesitation visible." },
  { key: "quick-success", purpose: "make the final success feel immediate", best: "{name} aligned the final two pieces. Click. The indicator beside the {object} lit up.", other: "When {name} had eventually aligned the final two pieces, the indicator beside the {object} proceeded to illuminate.", explanation: "The one-word sound and concise final sentence make the successful result feel immediate." },
  { key: "reflective-ending", purpose: "end with a thoughtful rather than dramatic mood", best: "The {place} was quiet again, but {name} kept thinking about the faded note beside the {object}.", other: "The {place} exploded with the most astonishing silence imaginable.", explanation: "The balanced clause turns from the quiet setting to the character's continuing thought, creating a reflective close." },
  { key: "contrast-noise", purpose: "emphasise one small sound after a noisy moment", best: "The trolley clattered, the doors banged and everyone spoke at once. Then the {object} gave one soft beep.", other: "There were many noises and the {object} also beeped softly.", explanation: "The noisy list is followed by a separate quiet sentence, so the single beep becomes noticeable through contrast." },
  { key: "clear-cause", purpose: "make the cause and result easy to understand", best: "Because the roof window was open, rain reached the display, so {name} moved the {object} to a dry shelf.", other: "The {object} moved, the rain happened, and the window was open somewhere above.", explanation: "The linking words because and so make the reason for moving the object explicit and logically ordered." },
];

const viewpointItems = [
  { key: "sealed-box", passage: "{name} can hear a loose piece move inside the sealed case beside the {object}, but cannot open it yet.", evidence: ["the case remains sealed", "only a movement can be heard", "the contents are not named"], answer: "The reader may share the character's uncertainty because the contents are withheld from both of them." },
  { key: "missing-label", passage: "The narration stays with {name}, who finds an empty hook in the {place} but does not know who removed the label.", evidence: ["the hook is empty", "the remover is not shown", "the character has no explanation"], answer: "Limiting the viewpoint may encourage the reader to consider possibilities alongside the character without proving who acted." },
  { key: "behind-curtain", passage: "{name} sees the curtain move beside the {object}, while the narration gives no view of the open window behind it.", evidence: ["the curtain moves", "the window is outside the viewpoint", "no cause is confirmed"], answer: "The restricted view may make the movement briefly puzzling because its likely cause is hidden." },
  { key: "two-plans", passage: "{name} explains a plan for the {place}, but the narration does not reveal the note another character is holding.", evidence: ["one plan is explained", "the note remains unread", "another character knows more"], answer: "Withholding the note may lead the reader to question whether the plan will change when the missing information appears." },
  { key: "distant-wave", passage: "Across the {place}, {name} notices someone wave but cannot tell whether the gesture is meant for them.", evidence: ["the person is far away", "the direction is unclear", "the character cannot confirm the meaning"], answer: "Staying with the character's distant view preserves uncertainty about what the wave means." },
  { key: "unread-message", passage: "The screen beside the {object} lights up, but {name} turns away before the message appears.", evidence: ["the screen activates", "the character turns away", "the message is not shown"], answer: "The viewpoint withholds the message, so the reader may anticipate information that the character has missed." },
  { key: "memory-gap", passage: "{name} recognises the {place} in a photograph but cannot remember when the picture was taken.", evidence: ["the setting is recognised", "the time is forgotten", "the narration offers no date"], answer: "The character's incomplete memory may make the photograph's history feel uncertain rather than establish a hidden fact." },
  { key: "closed-door", passage: "The account follows {name} waiting outside a closed room in the {place}; only muffled voices reach the corridor.", evidence: ["the door stays closed", "speech is muffled", "events inside are not narrated"], answer: "Keeping the viewpoint outside limits what can be known and may make the reader listen for clues with the character." },
  { key: "bird-view", passage: "The description shifts above the {place}, showing winding paths and the tiny figure of {name} below.", evidence: ["the viewpoint is high", "the whole route is visible", "the character appears small"], answer: "The distant viewpoint reveals the wider route while making the character seem small within the setting." },
  { key: "object-narrator", passage: "The {object} narrates what it sees from one shelf in the {place}, but it cannot follow people into other rooms.", evidence: ["the narrator stays on one shelf", "other rooms are unseen", "only nearby actions are reported"], answer: "The fixed narrator offers an unusual local view but leaves events elsewhere unknown." },
  { key: "second-account", passage: "First {name} describes the meeting as calm; a second account notices tapping feet and unfinished sentences.", evidence: ["the accounts select different details", "the second notices restless actions", "neither states every person's feelings"], answer: "The changed viewpoint shows how selected details can challenge the first impression without proving one account dishonest." },
  { key: "future-unknown", passage: "{name} posts the plan for the {place}, and the chapter ends before anyone responds.", evidence: ["the plan is shared", "responses are not shown", "the chapter stops at that moment"], answer: "Ending within the character's present knowledge may encourage anticipation because the outcome remains open." },
];

const substituteItems = [
  { key: "uncertain-path", sentence: "The path ___ between the trees behind the {place}.", purpose: "make the route seem indirect and slightly uncertain", answer: "wandered", choices: ["wandered", "went", "operated", "announced"], explanation: "Wandered suggests an indirect route without a fixed-looking direction, fitting the intended uncertainty." },
  { key: "quiet-close", sentence: "{name} ___ the door so the talk in the {place} could continue.", purpose: "show a careful, quiet action", answer: "eased shut", choices: ["eased shut", "closed", "slammed", "obliterated"], explanation: "Eased shut conveys controlled, gentle movement and best supports the quiet purpose." },
  { key: "rapid-look", sentence: "{name} ___ the list beside the {object} before the group left.", purpose: "show a quick check rather than detailed reading", answer: "scanned", choices: ["scanned", "read", "memorised", "decorated"], explanation: "Scanned means looking over the key details quickly, which fits the limited time." },
  { key: "warm-light", sentence: "Light ___ across the tables in the {place}.", purpose: "create a gentle, spreading image", answer: "pooled", choices: ["pooled", "was", "attacked", "calculated"], explanation: "Pooled suggests light gathering and spreading softly over a surface, supporting the gentle image." },
  { key: "firm-reminder", sentence: "'Please return the {object} before closing,' {name} ___.", purpose: "sound firm but not aggressive", answer: "reminded them", choices: ["reminded them", "screamed", "said", "threatened them"], explanation: "Reminded them communicates clear expectation without adding aggression that the context does not justify." },
  { key: "crowded-room", sentence: "Visitors ___ around the new display in the {place}.", purpose: "show that people gather closely because they are interested", answer: "clustered", choices: ["clustered", "stood", "escaped", "vanished"], explanation: "Clustered suggests people gathering in a close group, making the display's attraction clear." },
  { key: "slow-fade", sentence: "The final note of music ___ through the {place}.", purpose: "show the sound becoming gradually quieter", answer: "faded", choices: ["faded", "stopped", "exploded", "argued"], explanation: "Faded suggests a gradual loss of sound, unlike stopped, which can seem immediate." },
  { key: "careful-search", sentence: "{name} ___ the drawer beneath the {object} for the missing card.", purpose: "show a thorough and careful search", answer: "examined", choices: ["examined", "looked at", "wrecked", "ignored"], explanation: "Examined suggests close, careful attention and therefore fits a thorough search." },
  { key: "small-movement", sentence: "The paper sign ___ whenever the door of the {place} opened.", purpose: "show a light, repeated movement", answer: "fluttered", choices: ["fluttered", "moved", "charged", "collapsed"], explanation: "Fluttered suggests repeated light movements, matching a paper sign disturbed by air." },
  { key: "thoughtful-reply", sentence: "{name} ___ before answering the question about the {object}.", purpose: "show that the reply is considered", answer: "paused", choices: ["paused", "waited", "performed", "shouted"], explanation: "Paused focuses on a brief break before speaking, suggesting time taken to consider the reply." },
  { key: "clear-view", sentence: "From the steps, the whole {place} ___ below {name}.", purpose: "emphasise that the wide view becomes visible", answer: "opened out", choices: ["opened out", "was", "hid", "whispered"], explanation: "Opened out conveys the wide view becoming available from the higher position." },
];

const candidates = [
  ...expand(preciseItems, 48, buildPrecise),
  ...expand(imageryItems, 48, buildImagery),
  ...expand(sentenceItems, 48, buildSentence),
  ...expand(viewpointItems, 48, buildViewpoint),
  ...expand(substituteItems, 44, buildSubstitute),
];

validateBank(pack, authored, candidates);
pack.question_variants = [...authored, ...candidates];
pack.version = "0.2.0";
pack.qa.notes = "Review-stage Year 5 reading bank now reaches the 240-item pilot target with four preserved curated questions and deterministic candidates across every blueprint and format. Generated candidates require human curriculum, teacher, accessibility and safeguarding review for extract quality, interpretive plausibility, cultural assumptions, narration and alternative evidence-based responses before promotion.";

enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`authorial-choice-bank authored=${authored.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`authorial-choice-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`authorial-choice-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`authorial-choice-bank bands=${summary(candidates, (variant) => variant.body.difficulty_band)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`authorial-choice-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) {
    throw new Error("Year 5 authorial-choice bank is out of date; run generate-y5-authorial-choice-bank.mjs --write.");
  }
  console.log("authorial-choice-bank deterministic check passed");
} else {
  console.log("authorial-choice-bank dry-run; pass --write to update the pack");
}

function buildPrecise(item, context, index) {
  const passage = fill(item.passage, context);
  const choices = rotate(item.choices, index % item.choices.length);
  return variant({
    id: `word-${item.key}-${context.key}`,
    format: "phrase-highlight",
    blueprint: "precise-word-connotation",
    band: coreBands[index % coreBands.length],
    evidencePurpose: "precise_contextual_connotation",
    prompt: `Read: '${passage}' Which word or shortest phrase most strongly supports the interpretation?`,
    body: { passage, interpretation: item.meaning.split(",")[0], choices, selectable_mode: "text_span_or_numbered_phrase_list" },
    answer: item.target,
    hints: ["Find the smallest choice that carries the important suggestion.", "Check that your choice supports the meaning in this particular sentence."],
    explanation: `${item.meaning} This connects the selected language to its local context instead of merely naming a word class.`,
    misconception: "technique_without_context",
    animation: "connotation-web-trace",
    index,
  });
}

function buildImagery(item, context, index) {
  const extract = fill(item.extract, context);
  const choices = rotate([
    item.answer,
    "The language is effective only because it uses a named technique.",
    "The choice definitely creates the same emotion for every reader.",
    "The words add decoration but do not contribute to meaning in this extract.",
  ], index % 4);
  return variant({
    id: `imagery-${item.key}-${context.key}`,
    format: "evidence-explain",
    blueprint: "imagery-and-pattern-effect",
    band: coreBands[(index + 1) % coreBands.length],
    evidencePurpose: "imagery_pattern_context_and_effect",
    prompt: `Which explanation best follows from the language in: '${extract}'?`,
    body: { extract, choices, evidence_mode: "quoted_language_plus_contextual_explanation" },
    answer: item.answer,
    hints: ["Explain what the image or pattern adds in this exact line.", "Reject answers that only name a technique or claim that every reader must react alike."],
    explanation: `${item.answer} This interpretation stays tied to the quoted detail and describes a supportable effect rather than a guaranteed reaction.`,
    misconception: item.tag,
    animation: "choice-effect-chain-build",
    index,
  });
}

function buildSentence(item, context, index) {
  const best = fill(item.best, context);
  const other = fill(item.other, context);
  const versions = rotate([
    best,
    other,
    `At the ${context.place}, ${context.name} used an exceptionally sophisticated arrangement of many elaborate words about the ${context.object}.`,
    `${context.name} acted. Things happened. It ended.`,
  ], index % 4);
  return variant({
    id: `rhythm-${item.key}-${context.key}`,
    format: "reader-effect-choice",
    blueprint: "sentence-rhythm-and-pace",
    band: coreBands[(index + 2) % coreBands.length],
    evidencePurpose: "sentence_rhythm_comparison",
    prompt: `For the ${context.place} scene, which version best serves this purpose: ${item.purpose}?`,
    body: { purpose: item.purpose, versions, comparison_mode: "matched_content_sentence_pattern" },
    answer: best,
    hints: ["Compare ordering, sentence boundaries and emphasis rather than choosing the longest version.", `Look for the version whose rhythm helps to ${item.purpose}.`],
    explanation: `${item.explanation} Its fitness comes from the sentence pattern in this context, not from length alone.`,
    misconception: "longer_is_better",
    animation: "sentence-rhythm-pulse",
    index,
  });
}

function buildViewpoint(item, context, index) {
  const passage = fill(item.passage, context);
  const answer = fill(item.answer, context);
  const choices = rotate([
    answer,
    "The viewpoint proves a hidden explanation that the passage never states.",
    "Every reader must feel exactly the same because information is missing.",
    "The viewpoint has no effect because only word choice can shape what a reader notices.",
  ], index % 4);
  return variant({
    id: `viewpoint-${item.key}-${context.key}`,
    format: "evidence-explain",
    blueprint: "viewpoint-and-information-control",
    band: coreBands[(index + 3) % coreBands.length],
    evidencePurpose: "viewpoint_information_control",
    prompt: `Read: '${passage}' Which claim best explains how the viewpoint controls information without inventing facts?`,
    body: { passage, evidence: item.evidence.map((value) => fill(value, context)), choices, knowledge_map: "character_reader_narrator" },
    answer,
    hints: ["Separate what is shown from what remains unknown.", "Choose a bounded claim using may or can, not a certainty unsupported by the text."],
    explanation: `${answer} The claim identifies the information boundary and does not turn a possibility into a fact.`,
    misconception: "reader_response_certain",
    animation: "viewpoint-window-mask",
    index,
  });
}

function buildSubstitute(item, context, index) {
  const sentence = fill(item.sentence, context);
  const choices = rotate(item.choices, index % item.choices.length);
  return variant({
    id: `substitute-${item.key}-${context.key}`,
    format: "meaning-substitute",
    blueprint: "purposeful-choice-retrieval",
    band: retrievalBands[index % retrievalBands.length],
    evidencePurpose: "purposeful_vocabulary_substitution",
    prompt: `Complete '${sentence}' Which choice best serves this purpose: ${item.purpose}?`,
    body: { sentence, stated_purpose: item.purpose, choices, substitution_rule: "preserve_grammar_compare_connotation" },
    answer: item.answer,
    hints: ["Read each option in the sentence and keep the grammar unchanged.", "Choose for precise fitness to the stated purpose, not rarity."],
    explanation: `${item.explanation} The other options are either less precise or introduce an unsupported effect.`,
    misconception: "rarest_word_is_best",
    animation: "controlled-rewrite-compare",
    index,
  });
}

function variant({ id, format, blueprint, band, evidencePurpose, prompt, body, answer, hints, explanation, misconception, animation, index }) {
  return {
    id: `${prefix}${id}`,
    format,
    body: {
      prompt,
      ...body,
      evidence_purpose: evidencePurpose,
      variant_blueprint_id: blueprint,
      review_batch: "y5-authorial-choice-pilot-a",
      difficulty_band: band,
      response_mode: "keyboard_switch_touch_voice_or_partner_scan",
      interaction_metadata: {
        keyboard: "All choices and text spans are reachable in reading order with visible focus and no precision drag.",
        switch: "Single-switch auto-scan offers pause, select, undo and replay controls.",
        static_alternative: "Numbered text, evidence and choice panels provide the complete task without animation.",
        reduced_motion: "State changes are immediate; evidence links use persistent underlines and labels rather than movement.",
        audio_and_language: "Sentence-level read-aloud, replay, glossary support and oral or partner-mediated response are available.",
      },
    },
    expected_answer: { value: answer },
    hints,
    explanation,
    difficulty: difficultyFor(band, index),
    status: "review",
    misconception_tag: misconception,
    animation_hook: animation,
  };
}

function expand(items, count, builder) {
  const variants = [];
  for (let index = 0; index < count; index += 1) {
    variants.push(builder(items[index % items.length], contexts[Math.floor(index / items.length) % contexts.length], index));
  }
  return variants;
}

function validateBank(currentPack, curated, generated) {
  if (generated.length !== pilotTarget - curated.length) {
    throw new Error(`Expected ${pilotTarget - curated.length} generated candidates, found ${generated.length}.`);
  }
  const all = [...curated, ...generated];
  if (all.length !== pilotTarget) throw new Error(`Pilot bank must contain exactly ${pilotTarget} variants.`);
  const ids = new Set(all.map((variantItem) => variantItem.id));
  if (ids.size !== all.length) throw new Error("Variant ids are not unique.");

  const requiredBlueprints = new Set(currentPack.variant_blueprints.map((blueprint) => blueprint.id));
  const actualBlueprints = new Set(generated.map((variantItem) => variantItem.body.variant_blueprint_id));
  assertSetCovered("blueprint", requiredBlueprints, actualBlueprints);
  const requiredFormats = new Set(currentPack.practice.formats);
  const actualFormats = new Set(generated.map((variantItem) => variantItem.format));
  assertSetCovered("format", requiredFormats, actualFormats);
  const requiredBands = new Set([...currentPack.practice.difficulty_bands, ...currentPack.variant_blueprints.map((blueprint) => blueprint.difficulty_band)]);
  const actualBands = new Set(generated.map((variantItem) => variantItem.body.difficulty_band));
  assertSetCovered("difficulty band", requiredBands, actualBands);

  for (const candidate of generated) {
    if (candidate.status !== "review") throw new Error(`${candidate.id} is not review status.`);
    if (!requiredBlueprints.has(candidate.body.variant_blueprint_id)) throw new Error(`${candidate.id} has an unknown blueprint.`);
    if (!candidate.body.evidence_purpose || !candidate.body.review_batch) throw new Error(`${candidate.id} lacks review provenance.`);
    if (candidate.explanation.length < 80) throw new Error(`${candidate.id} explanation is too weak.`);
    const answer = candidate.expected_answer.value;
    const answerPool = candidate.body.choices ?? candidate.body.versions;
    if (!Array.isArray(answerPool) || !answerPool.includes(answer)) throw new Error(`${candidate.id} answer is absent from its interaction choices.`);
    const metadata = candidate.body.interaction_metadata;
    for (const key of ["keyboard", "switch", "static_alternative", "reduced_motion", "audio_and_language"]) {
      if (!metadata?.[key]) throw new Error(`${candidate.id} lacks ${key} interaction metadata.`);
    }
    if ("answer" in candidate.body || "correct_answer" in candidate.body) throw new Error(`${candidate.id} leaks its answer in body metadata.`);
  }
}

function assertSetCovered(label, required, actual) {
  const missing = [...required].filter((value) => !actual.has(value));
  if (missing.length > 0) throw new Error(`Missing ${label} coverage: ${missing.join(", ")}.`);
}

function difficultyFor(band, index) {
  const ranges = {
    intro: [2, 3],
    developing: [4, 5],
    expected: [5, 6],
    secure: [7, 8],
    stretch: [8, 9],
    retrieval: [3, 5],
  };
  const [minimum, maximum] = ranges[band];
  return minimum + (index % (maximum - minimum + 1));
}

function fill(value, context) {
  return value
    .replaceAll("{name}", context.name)
    .replaceAll("{place}", context.place)
    .replaceAll("{object}", context.object);
}

function rotate(items, amount) {
  return items.slice(amount).concat(items.slice(0, amount));
}

function summary(items, select) {
  const counts = new Map();
  for (const item of items) {
    const key = select(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(",");
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function relative(file) {
  return path.relative(repoRoot, file).replaceAll("\\", "/");
}
