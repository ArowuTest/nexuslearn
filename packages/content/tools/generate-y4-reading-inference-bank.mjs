#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/en-y4-reading-inference.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "en-y4-reading-inference-bank-";
const reviewBatch = "y4-reading-inference-cross-year-pilot-a";
const pilotAllocation = {
  "action-to-feeling-clues": 44,
  "thought-and-motive-choices": 44,
  "because-link-builders": 44,
  "precision-and-overclaim-repairs": 44,
  "mixed-genre-spaced-inference": 44,
};

const scenes = [
  scene("bridge-lab", "story", "Mina", "The bridge model tilted above the workbench. Mina held her breath, then braced the loose side with a wooden block. One joint showed a thin gap. Around her, conversations faded as the group watched the beam settle level again.",
    "cautious about the bridge", "held her breath", "to stop the bridge from tilting", "braced the loose side with a wooden block", "a focused, tense workshop", "conversations faded as the group watched", "the gap in one joint may have made the beam dip", "One joint showed a thin gap. The bridge model tilted", "braced", "supported firmly so it could not move", "She may be thinking that the loose side needs support before the test continues", "concerned about whether the model will hold"),
  scene("rainy-library", "diary", "Lila", "Raindrops dotted the library book, and the zip of Lila's bag still gaped open. She dried the cover, tucked an apology note beneath it and hovered beside the returns desk. The final chairs were empty, and the clock sounded unusually loud.",
    "worried about returning the book", "hovered beside the returns desk", "to explain and take responsibility for the wet book", "tucked an apology note beneath it", "a quiet library near closing time", "The final chairs were empty, and the clock sounded unusually loud", "rain may have entered through the open bag", "Raindrops dotted the book, and the zip of Lila's bag still gaped open", "hovered", "stayed nearby without quite moving forward", "She may be thinking about how the librarian will react", "uncertain about starting the conversation"),
  scene("garden-trays", "letter", "Arun", "The seedling leaves drooped against the warm trays. Arun touched the dry compost, carried the trays beneath the shade cloth and poured water slowly around each stem. An hour later, the leaves had perked up. Even the path stones felt hot through his shoes.",
    "relieved when the seedlings recover", "the leaves had perked up", "to protect the seedlings from heat and dryness", "carried the trays beneath the shade cloth and poured water", "a hot, dry garden", "Even the path stones felt hot through his shoes", "heat and dry compost may have made the leaves droop", "The leaves drooped; the compost was dry and the path stones felt hot", "perked", "lifted and looked fresher again", "He may be thinking that shade and water will help the seedlings", "carefully hopeful that the plants will recover"),
  scene("backstage-vase", "playscript", "Nia", "Backstage voices crossed over one another while Nia repeated her opening line under her breath. She threaded between costume rails, found the blue vase on the wrong shelf and tied a bright label around its base. Her fingers tapped the script until the stage manager called her name.",
    "nervous before going on stage", "repeated her opening line under her breath", "to stop the blue vase being misplaced again", "tied a bright label around its base", "a busy, crowded backstage area", "voices crossed over one another while she threaded between costume rails", "the vase may have seemed missing because it was put on the wrong shelf", "found the blue vase on the wrong shelf", "threaded", "moved carefully through narrow gaps", "She may be thinking that she must remember both her line and the prop", "anxious but preparing carefully"),
  scene("museum-label", "story", "Owen", "Owen peered at the tiny number beneath the fossil, then checked the catalogue twice. The card beside the case named a different number. He fetched the curator instead of moving the fossil and placed both records side by side under the desk lamp.",
    "puzzled by the records", "checked the catalogue twice", "to resolve the number mismatch safely", "fetched the curator instead of moving the fossil", "a careful museum work area", "placed both records side by side under the desk lamp", "one record may have been labelled incorrectly", "the fossil number and the case card showed different numbers", "peered", "looked closely and carefully", "He may be thinking that the mismatch needs checking before anything is moved", "curious about which record is accurate"),
  scene("concert-stool", "playscript", "Sofia", "A low murmur filled the hall as the orchestra lifted its instruments. Sofia noticed that Eli's feet could not reach the stool bar, so she swapped in the smaller stool and checked that it stood firmly. Eli smiled, and Sofia finally unfolded her own music.",
    "relieved after helping Eli", "Sofia finally unfolded her own music", "to help Eli sit securely and play comfortably", "swapped in the smaller stool and checked that it stood firmly", "an expectant hall just before a concert", "A low murmur filled the hall as the orchestra lifted its instruments", "Eli may have needed another stool because his feet could not reach the bar", "Eli's feet could not reach the stool bar, so she swapped the stool", "murmur", "a low sound made by many quiet voices", "She may be thinking that Eli is ready now and she can prepare herself", "pleased that a practical problem is solved"),
  scene("misty-trail", "diary", "Jonah", "The next marker loomed out of the mist only when Jonah was a few steps away. He stopped at the fork, turned the damp map towards the path and traced the route back to the last bridge. The signpost ahead was hidden behind a pale curtain of cloud.",
    "uncertain about the route", "stopped at the fork and traced the route back", "to check the correct path before continuing", "turned the damp map towards the path", "a misty trail with poor visibility", "The signpost ahead was hidden behind a pale curtain of cloud", "the group may have difficulty choosing because the mist hides the signpost", "the signpost was hidden and Jonah stopped at the fork", "loomed", "appeared as a large, unclear shape", "He may be thinking that the map must match the last known landmark", "careful rather than willing to guess"),
  scene("bakery-dough", "letter", "Mei", "The first bowl of dough remained flat while the other bowls rose above their rims. Mei frowned at the unopened yeast packet beside her scales. She started a fresh bowl, checked off each ingredient and kneaded until the mixture became smooth and springy.",
    "disappointed but determined to fix the dough", "frowned at the unopened yeast packet", "to make a corrected batch", "started a fresh bowl and checked off each ingredient", "a busy practical baking session", "the other bowls rose above their rims", "the first dough may have stayed flat because the yeast was not added", "the dough remained flat and the yeast packet was unopened", "kneaded", "pressed and folded dough repeatedly", "She may be thinking that missing yeast caused the problem", "focused on learning from the mistake"),
  scene("robot-battery", "story", "Dara", "The robot's green light flickered, and its wheels slowed halfway across the mat. Dara crouched beside it, pressed the battery clip until it clicked and returned the robot to the same starting line. This time, the light stayed bright throughout the route.",
    "hopeful after finding a possible fix", "returned the robot to the same starting line", "to test whether securing the battery clip solves the problem", "pressed the battery clip until it clicked", "a controlled robotics test area", "returned the robot to the same starting line", "a loose battery connection may have slowed the robot", "the light flickered until Dara pressed the battery clip", "flickered", "shone unsteadily, switching quickly between bright and dim", "Dara may be thinking that the battery clip was causing the fault", "carefully optimistic about the second test"),
  scene("wildlife-hide", "diary", "Leah froze as a deer stepped between the silver birches. She raised one finger towards the others and lowered the notebook without closing it. A branch snapped beyond the hide; the feeding birds scattered, but the deer only lifted its head.",
    "excited but trying to stay calm", "froze as a deer stepped between the birches", "to keep the group quiet and avoid disturbing the deer", "raised one finger towards the others", "a hushed wildlife hide", "lowered the notebook without closing it", "the birds may have scattered because a branch snapped", "A branch snapped; the feeding birds scattered", "froze", "stopped moving suddenly", "She may be thinking that any noise could disturb the deer", "alert to every movement and sound"),
  scene("leaking-display", "letter", "Malik", "A dark patch spread across the ceiling tile above the council display. One corner of the poster sagged, and a blue letter blurred into the paper. Malik pulled the display board away from the drip, set a bucket beneath it and photographed the damage for the caretaker.",
    "concerned about the display", "pulled the display board away from the drip", "to prevent more water damage and report the problem", "set a bucket beneath it and photographed the damage", "a corridor affected by a leak", "a dark patch spread across the ceiling tile", "water from the ceiling may have made the poster sag and blur", "a drip fell above the sagging, blurred poster", "sagged", "drooped down instead of staying firm and flat", "He may be thinking that the display must be protected before the leak worsens", "responsible and focused on limiting damage"),
];

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "en-y4-reading-inference") throw new Error("This generator only supports the Year 4 reading inference pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
const curatedAllocation = countBy(curated, curatedBlueprint);
const targets = Object.fromEntries(Object.entries(pilotAllocation).map(([id, total]) => [id, total - (curatedAllocation[id] ?? 0)]));
for (const [blueprint, count] of Object.entries(targets)) if (count < 0) throw new Error(`Curated variants exceed ${blueprint}.`);

const candidates = [
  ...clueCandidates(targets["action-to-feeling-clues"]),
  ...choiceCandidates(targets["thought-and-motive-choices"]),
  ...linkCandidates(targets["because-link-builders"]),
  ...precisionCandidates(targets["precision-and-overclaim-repairs"]),
  ...mixedCandidates(targets["mixed-genre-spaced-inference"]),
];

pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.adaptive_support.audio_first = "Optional sentence-level narration uses only ElevenLabs assets after human listening approval. Browser TTS is prohibited; unavailable audio shows an honest not-ready state, and narration remains neutral so it does not reveal feelings, motives or other inferences.";
pack.qa.notes = "Review-stage Year 4 inference pack with a deterministic 220-item pilot bank and four preserved curated variants. The progression separates retrieval of stated clues from inference, then develops feelings, motives, thoughts, setting, cause, vocabulary clues, competing explanations, evidence sufficiency and bounded claims. Generated candidates include SEND and dyslexia scaffolds, optional human-reviewed ElevenLabs references with browser TTS prohibited, supported interactions, rich repair feedback and untimed detective missions. Independent English, teacher, accessibility, safeguarding, audio and renderer review remain required before promotion.";
validateBank(pack, curated, candidates);

console.log(`y4-reading-inference-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`y4-reading-inference-bank blueprints=${allocationSummary(curated, candidates)}`);
console.log(`y4-reading-inference-bank formats=${summary(pack.question_variants, (variant) => variant.format)}`);
console.log(`y4-reading-inference-bank bands=${summary(candidates, (variant) => variant.body.difficulty_band)}`);
console.log(`y4-reading-inference-bank strands=${summary(candidates, (variant) => variant.body.inference_strand)}`);

const nextText = `${JSON.stringify(pack, null, 2)}\n`;
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`y4-reading-inference-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 4 reading inference bank is out of date; run generate-y4-reading-inference-bank.mjs --write.");
  console.log("y4-reading-inference-bank deterministic check passed");
} else {
  console.log("y4-reading-inference-bank dry-run; pass --write to update the pack");
}

function clueCandidates(count) {
  const variants = [];
  for (const item of scenes) {
    const tasks = [
      clueTask("feeling", `Highlight the smallest clue that suggests ${item.name} feels ${item.feeling}.`, item.feelingClue, item.feeling, "action_to_feeling"),
      clueTask("setting", `Highlight the detail that best suggests ${item.setting}.`, item.settingClue, item.setting, "setting_atmosphere_clue"),
      clueTask("vocabulary", `Highlight the word that helps suggest this meaning: '${item.vocabularyMeaning}'.`, item.vocabulary, item.vocabularyMeaning, "vocabulary_inference_clue"),
      clueTask("cause", `Highlight the shortest evidence that supports this possible cause: ${item.cause}.`, item.causeClue, item.cause, "cause_evidence_clue"),
    ];
    for (const task of tasks) variants.push(makeVariant({ ...task, id: `${prefix}clue-${item.id}-${task.strand}`, format: "clue-highlight", blueprint: "action-to-feeling-clues", scene: item, misconception: "guess_without_clue", stage: `select_${task.strand}_clue` }));
  }
  return variants.slice(0, count);
}

function choiceCandidates(count) {
  const variants = [];
  for (const item of scenes) {
    const tasks = [
      choiceTask("motive", `Why does ${item.name} take the key action in this extract?`, item.motive, ["to make the problem harder", "because the task has been forgotten", "to avoid doing anything at all"], item.motiveClue, "best_supported_motive"),
      choiceTask("thought", `What may ${item.name} be thinking?`, item.thought, ["Nothing in the scene matters", "The problem has definitely solved itself", "Someone else must know every answer"], item.motiveClue, "supported_thought"),
      choiceTask("competing_explanations", `Which explanation is best supported by the exact actions in the extract?`, item.motive, [item.alternative, "the character wants the difficulty to continue", "the character has not noticed the situation"], item.motiveClue, "competing_explanation_choice"),
      choiceTask("cause", "Which possible cause is best supported by the sequence of clues?", item.cause, ["an unrelated event outside the extract", "a cause proved only by general knowledge", "the character planned every event in advance"], item.causeClue, "supported_cause_inference"),
    ];
    for (const task of tasks) variants.push(makeVariant({ ...task, id: `${prefix}choice-${item.id}-${task.strand}`, format: "inference-choice", blueprint: "thought-and-motive-choices", scene: item, misconception: "possible_but_unsupported", stage: `choose_${task.strand}` }));
  }
  return variants.slice(0, count);
}

function linkCandidates(count) {
  const variants = [];
  for (const item of scenes) {
    const tasks = [
      linkTask("feeling", `${item.name} may feel ${item.feeling}`, item.feelingClue, `the action '${item.feelingClue}' fits someone who is ${item.feeling}`, "feeling_evidence_link"),
      linkTask("motive", `${item.name}'s motive may be ${item.motive}`, item.motiveClue, `the action '${item.motiveClue}' directly helps to ${item.motive.replace(/^to /, "")}`, "motive_evidence_link"),
      linkTask("setting", `The setting seems like ${item.setting}`, item.settingClue, `the detail '${item.settingClue}' creates that impression of the place`, "setting_evidence_link"),
      linkTask("cause", `A plausible cause is that ${item.cause}`, item.causeClue, `the nearby sequence '${item.causeClue}' connects the possible cause with its result`, "cause_evidence_link"),
    ];
    for (const task of tasks) variants.push(makeVariant({ ...task, id: `${prefix}link-${item.id}-${task.strand}`, format: "evidence-link", blueprint: "because-link-builders", scene: item, misconception: "evidence_without_link", stage: `link_${task.strand}_evidence` }));
  }
  return variants.slice(0, count);
}

function precisionCandidates(count) {
  const variants = [];
  for (const item of scenes) {
    const boundedFeeling = `${item.name} may feel ${item.feeling} in this moment because ${item.feelingClue}`;
    const tasks = [
      responseTask("overclaim", `Improve this overclaim: '${item.name} is always ${item.feeling}.'`, boundedFeeling, [`${item.name} is definitely ${item.feeling} in every situation`, `${item.name} has a fixed personality that the extract proves`, "The clue should be copied without explaining it"], "Use may and limit the claim to this moment.", "bounded_inference_repair"),
      responseTask("sufficiency", `Is the clue '${item.feelingClue}' sufficient to prove that ${item.name} is always ${item.feeling}?`, `No. It supports that ${item.name} may feel ${item.feeling} here, but it cannot prove 'always'.`, ["Yes. One action proves a permanent trait.", "Yes. Any possible feeling is automatically proven.", "No inference can ever use an action clue."], "Test the strength and scope of the claim.", "evidence_sufficiency_check"),
      responseTask("competing", `Two detectives suggest '${item.feeling}' and '${item.alternative}'. What is the most careful conclusion?`, `Both may be plausible from '${item.feelingClue}', so a careful reader should explain each link and not claim either is certain.`, [`Both are certainly true in every moment.`, `Choose '${item.alternative}' without linking a clue.`, "Neither explanation needs text evidence."], "Compare how directly each explanation fits the supplied clue.", "competing_explanations_evaluation"),
      responseTask("boundary", `Which response clearly separates retrieval from inference in ${item.name}'s case?`, `Retrieval locates '${item.feelingClue}'; inference uses it to suggest ${item.feeling}.`, [`Retrieval proves every possible feeling.`, `Inference copies '${item.feelingClue}' without working anything out.`, "Retrieval and inference are exactly the same step."], "First identify what the text states, then name what it suggests.", "retrieval_inference_boundary"),
    ];
    for (const task of tasks) variants.push(makeVariant({ ...task, id: `${prefix}precision-${item.id}-${task.strand}`, format: "short-response", blueprint: "precision-and-overclaim-repairs", scene: item, misconception: task.strand === "boundary" ? "retrieval_inference_confusion" : "overclaim_from_evidence", stage: `repair_${task.strand}` }));
  }
  return variants.slice(0, count);
}

function mixedCandidates(count) {
  const variants = [];
  for (const item of scenes) {
    const tasks = [
      clueTask("feeling", `Case-file review (${item.genre}): which clue best supports that ${item.name} may feel ${item.feeling}?`, item.feelingClue, item.feeling, "mixed_genre_feeling_clue"),
      clueTask("motive", `Case-file review (${item.genre}): which clue best supports the motive '${item.motive}'?`, item.motiveClue, item.motive, "mixed_genre_motive_clue"),
      clueTask("vocabulary", `Case-file review (${item.genre}): which word supports the meaning '${item.vocabularyMeaning}'?`, item.vocabulary, item.vocabularyMeaning, "mixed_genre_vocabulary_clue"),
      clueTask("cause", `Case-file review (${item.genre}): which clue supports the possible cause '${item.cause}'?`, item.causeClue, item.cause, "mixed_genre_cause_clue"),
    ];
    for (const task of tasks) variants.push(makeVariant({ ...task, id: `${prefix}mixed-${item.id}-${task.strand}`, format: "clue-highlight", blueprint: "mixed-genre-spaced-inference", scene: item, misconception: "guess_without_clue", stage: `spaced_${task.strand}_clue`, retrieval: true }));
  }
  return variants.slice(0, count);
}

function clueTask(strand, prompt, answer, inference, purpose) {
  return { strand, prompt, expected: answer, choices: [answer, "the first character name", "an unrelated place detail", "the final punctuation mark"], inference, clue: answer, hints: ["Retrieve the exact words first.", "Then check whether those words genuinely support the inference rather than merely sounding vivid."], explanation: `The clue '${answer}' is stated in the extract. It supports the inference '${inference}' without proving more than the text shows.`, purpose };
}
function choiceTask(strand, prompt, expected, distractors, clue, purpose) {
  return { strand, prompt, expected, choices: [expected, ...distractors], inference: expected, clue, hints: ["Locate the action or wording before choosing.", `Test each explanation against the clue '${clue}'.`], explanation: `'${clue}' most directly supports '${expected}'. The other explanations are possible in another story, contradicted, or unsupported here.`, purpose };
}
function linkTask(strand, inference, clue, link, purpose) {
  const expected = `${inference} because ${link}.`;
  return { strand, prompt: `Complete a precise CLUE-INFERENCE-BECAUSE link for: '${inference}'.`, expected, choices: [expected, `${inference}, and the extract contains '${clue}', but there is no explanation of the link.`, `${inference} because that is possible in real life, even without a clue.`, `The extract states '${clue}', so every stronger claim must also be true.`], inference, clue, hints: ["Keep the exact clue and explain what it shows.", "Use because or suggests to make the reasoning link explicit."], explanation: `This response joins the bounded inference to '${clue}' and explains why the evidence is relevant.`, purpose };
}
function responseTask(strand, prompt, expected, distractors, secondHint, purpose) {
  return { strand, prompt, expected, choices: [expected, ...distractors], inference: expected, clue: "see the named clue in the prompt and extract", hints: ["Keep only what this extract can support.", secondHint], explanation: `The improved response matches the strength of the evidence, keeps the clue and inference connected, and avoids an unsupported certainty.`, purpose };
}

function makeVariant({ id, format, blueprint, scene: item, stage, strand, prompt, expected, choices, inference, clue, hints, explanation, purpose, misconception, retrieval = false }) {
  const band = bandFor(blueprint, stage);
  const interactionChoices = format === "clue-highlight"
    ? unique([expected, item.feelingClue, item.motiveClue, item.settingClue, item.causeClue, item.vocabulary]).slice(0, 4)
    : unique(choices);
  return {
    id,
    format,
    body: {
      prompt,
      extract: item.extract,
      choices: rotate(interactionChoices, id.length % interactionChoices.length),
      inference,
      evidence_clue: clue,
      inference_strand: strand,
      genre: item.genre,
      conceptual_progression: stage,
      difficulty_band: band,
      evidence_purpose: purpose,
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
      reading_process: {
        retrieval_step: "Locate words or details explicitly stated in the extract.",
        inference_step: "Work out a bounded idea that the retrieved clue supports but does not state directly.",
        boundary_check: "If the answer only copies the clue, retrieval is complete but inference is not; if it has no clue, the inference is unsupported.",
      },
      response_mode: "tap_keyboard_switch_phrase_list_typed_oral_or_partner_recorded",
      interaction_support: { keyboard: true, switch_scan: true, touch: true, phrase_list: true, typed: true, oral_or_partner_recording: true, precision_drag_required: false, undo_available: true },
      send_scaffolds: { one_decision_per_screen: true, clue_inference_because_strip: true, sentence_masking: true, vocabulary_gloss_without_answer: true, repeated_reread: true, no_time_limit: true },
      dyslexia_support: { increased_spacing: true, adjustable_line_length: true, tinted_background_option: true, readable_font_option: true, line_focus: true, phrase_chunking: true },
      reduced_visual_load: true,
      one_extract_and_question_per_screen: true,
      static_alternative: "numbered sentence and phrase cards in reading order; no fine text selection or animation required",
      reduced_motion_alternative: "persistent CLUE, INFERENCE and BECAUSE cards with instant labelled state changes",
      audio_optional: true,
      audio_asset_id: `narration-${id}`,
      audio_provider: "ElevenLabs",
      audio_asset_status: "required_human_listening_review",
      human_listening_approval_required: true,
      neutral_narration_required: true,
      browser_tts_allowed: false,
      detective_mission: missionFor(item, strand, stage, id),
      pressure_rules: { timer: false, speed_score: false, streak_loss: false, lives: false, public_ranking: false, retry_cost: false },
      review_interval_days: retrieval ? [1, 3, 7, 14, 30][id.length % 5] : undefined,
    },
    expected_answer: { value: expected, accepted_semantic_equivalents: format === "short-response" || format === "evidence-link" ? "teacher_review_required" : undefined },
    hints,
    explanation,
    feedback: {
      correct: "Case link secured: the inference is bounded and attached to relevant text evidence.",
      repair: repairFor(strand, stage),
      distractor_check: "Ask whether the choice is stated, suggested by a clue, merely possible, contradicted, or too certain.",
      boundary_reminder: "Retrieval finds the clue; inference explains what the clue may suggest.",
      retry: "The case remains open. Keep any useful clue and test one narrower explanation.",
    },
    difficulty: difficultyFor(band),
    status: "review",
    misconception_tag: misconception,
    animation_hook: animationFor(strand),
  };
}

function missionFor(item, strand, stage, id) {
  const desks = { feeling: "Body-Language Desk", motive: "Motive Map", thought: "Thought File", setting: "Scene Survey", cause: "Cause Chain", vocabulary: "Word Clue Lab", competing_explanations: "Rival Theory Board", overclaim: "Claim Calibrator", sufficiency: "Evidence Scale", competing: "Rival Theory Board", boundary: "Say-or-Suggest Gate" };
  return {
    campaign: "The Quiet Clue Agency",
    case_id: id.slice(-30),
    dossier: `${item.genre}: ${item.id.replaceAll("-", " ")}`,
    desk: desks[strand] ?? "Mixed Evidence Desk",
    objective: `Resolve the ${stage.replaceAll("_", " ")} step by tracing a clue to a supportable explanation.`,
    evidence_protocol: ["retrieve the exact clue", "compare explanations", "choose the narrowest supported claim", "check the because link"],
    strategy_tool: strand === "vocabulary" ? "read around the word and test a replacement meaning" : strand === "cause" ? "place events in order and avoid claiming certainty" : "CLUE → INFERENCE → BECAUSE",
    reward: { item: "case-file seal", earned_for: "using evidence or completing a repair", effect: "reveals the next dossier tab without raising pressure or difficulty" },
    retry_protocol: "No lives, ranks or evidence are lost; an unsupported theory becomes a clue for the next attempt.",
  };
}

function validateBank(packData, curatedItems, generated) {
  const pilot = packData.practice.variant_targets.pilot;
  if (curatedItems.length !== 4) throw new Error(`Expected four curated variants, found ${curatedItems.length}.`);
  if (generated.length !== pilot - curatedItems.length || curatedItems.length + generated.length !== pilot) throw new Error(`Pilot bank must contain exactly ${pilot} variants.`);
  const blueprintMap = new Map(packData.variant_blueprints.map((item) => [item.id, item]));
  const ids = new Set(); const signatures = new Set();
  for (const variant of [...curatedItems, ...generated]) {
    if (ids.has(variant.id)) throw new Error(`Duplicate id ${variant.id}.`); ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${normalise(variant.expected_answer?.value)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`); signatures.add(signature);
  }
  const coverage = new Set(); const formats = new Set(); const blueprints = new Set(); const bands = new Set();
  for (const variant of generated) {
    const blueprint = blueprintMap.get(variant.body.variant_blueprint_id);
    if (!blueprint || variant.format !== blueprint.format) throw new Error(`${variant.id} does not match its blueprint format.`);
    if (variant.status !== "review") throw new Error(`${variant.id} must remain in review.`);
    if (!Array.isArray(variant.body.choices) || variant.body.choices.length < 4 || new Set(variant.body.choices).size !== variant.body.choices.length) throw new Error(`${variant.id} has invalid choices.`);
    if (variant.body.choices.filter((choice) => choice === variant.expected_answer.value).length !== 1) throw new Error(`${variant.id} must contain its expected answer exactly once.`);
    if (!variant.body.reading_process?.retrieval_step || !variant.body.reading_process?.inference_step || !/Retrieval finds/.test(variant.feedback?.boundary_reminder)) throw new Error(`${variant.id} does not separate retrieval and inference.`);
    if (!variant.body.interaction_support?.keyboard || !variant.body.interaction_support?.switch_scan || variant.body.interaction_support?.precision_drag_required !== false) throw new Error(`${variant.id} lacks supported interactions.`);
    if (!variant.body.send_scaffolds?.clue_inference_because_strip || !variant.body.dyslexia_support?.line_focus || variant.body.reduced_visual_load !== true) throw new Error(`${variant.id} lacks SEND/dyslexia scaffolds.`);
    if (variant.body.audio_provider !== "ElevenLabs" || variant.body.audio_asset_status !== "required_human_listening_review" || variant.body.human_listening_approval_required !== true || variant.body.neutral_narration_required !== true || variant.body.browser_tts_allowed !== false) throw new Error(`${variant.id} violates audio policy.`);
    if (Object.values(variant.body.pressure_rules).some((value) => value !== false) || !/No lives/.test(variant.body.detective_mission?.retry_protocol) || !variant.body.detective_mission?.strategy_tool) throw new Error(`${variant.id} lacks low-pressure detective gamification.`);
    if (!variant.feedback?.repair || !variant.feedback?.distractor_check || !variant.feedback?.retry || variant.hints.length < 2 || variant.explanation.length < 70) throw new Error(`${variant.id} lacks rich feedback.`);
    coverage.add(variant.body.inference_strand);
    if (variant.body.evidence_purpose.includes("sufficiency")) coverage.add("evidence_sufficiency");
    if (variant.body.evidence_purpose.includes("boundary")) coverage.add("retrieval_inference_boundary");
    formats.add(variant.format); blueprints.add(variant.body.variant_blueprint_id); bands.add(variant.body.difficulty_band);
  }
  const allocation = combinedAllocation(curatedItems, generated);
  for (const [blueprint, expected] of Object.entries(pilotAllocation)) if (allocation[blueprint] !== expected) throw new Error(`${blueprint} expected ${expected}, found ${allocation[blueprint] ?? 0}.`);
  assertCovered("formats", new Set(packData.practice.formats), formats);
  assertCovered("blueprints", new Set(blueprintMap.keys()), blueprints);
  assertCovered("difficulty bands", new Set([...packData.practice.difficulty_bands, ...packData.variant_blueprints.map((item) => item.difficulty_band)]), bands);
  assertCovered("inference coverage", new Set(["feeling", "motive", "thought", "setting", "cause", "vocabulary", "competing_explanations", "evidence_sufficiency", "retrieval_inference_boundary"]), coverage);
}

function scene(id, genre, name, extract, feeling, feelingClue, motive, motiveClue, setting, settingClue, cause, causeClue, vocabulary, vocabularyMeaning, thought, alternative) { return { id, genre, name, extract, feeling, feelingClue, motive, motiveClue, setting, settingClue, cause, causeClue, vocabulary, vocabularyMeaning, thought, alternative }; }
function bandFor(blueprint, stage) { if (blueprint === "action-to-feeling-clues") return stage.includes("feeling") ? "intro" : stage.includes("vocabulary") ? "expected" : "developing"; if (blueprint === "thought-and-motive-choices") return stage.includes("competing") ? "secure" : "expected"; if (blueprint === "because-link-builders") return stage.includes("cause") || stage.includes("setting") ? "secure" : "expected"; if (blueprint === "precision-and-overclaim-repairs") return stage.includes("sufficiency") || stage.includes("competing") ? "stretch" : "secure"; return "retrieval"; }
function difficultyFor(band) { return { intro: 3, developing: 4, expected: 5, secure: 7, stretch: 8, retrieval: 5 }[band]; }
function repairFor(strand, stage) { if (stage.includes("boundary")) return "Put the stated words on a CLUE card and the worked-out idea on a separate INFERENCE card."; if (stage.includes("sufficiency") || stage.includes("overclaim")) return "Replace always or definitely with may, might or suggests, then limit the claim to this moment."; if (strand === "vocabulary") return "Read the sentence around the word, test a replacement meaning and check whether the wider inference still fits."; if (strand === "cause") return "Order the clues, use may for the cause and reject explanations that need outside knowledge."; return "Return to the smallest relevant clue, choose the narrowest supported idea and say how the action or wording leads to it."; }
function animationFor(strand) { return ({ feeling: "action-to-feeling-link", motive: "action-to-motive-link", thought: "clue-thought-path", setting: "setting-clue-map", cause: "cause-chain-build", vocabulary: "context-word-lens", competing_explanations: "rival-theory-balance", overclaim: "support-balance-test", sufficiency: "evidence-scale-check", boundary: "say-suggest-sort" })[strand] ?? "evidence-link-build"; }
function curatedBlueprint(variant) { const map = { "en-y4-reading-inference-q-feeling-highlight": "action-to-feeling-clues", "en-y4-reading-inference-q-motive-choice": "thought-and-motive-choices", "en-y4-reading-inference-q-because-link": "because-link-builders", "en-y4-reading-inference-q-overclaim": "precision-and-overclaim-repairs" }; const value = map[variant.id]; if (!value) throw new Error(`No curated blueprint assignment for ${variant.id}.`); return value; }
function combinedAllocation(curatedItems, generated) { const counts = countBy(curatedItems, curatedBlueprint); for (const variant of generated) counts[variant.body.variant_blueprint_id] = (counts[variant.body.variant_blueprint_id] ?? 0) + 1; return counts; }
function allocationSummary(curatedItems, generated) { return Object.entries(combinedAllocation(curatedItems, generated)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function assertCovered(label, required, actual) { const missing = [...required].filter((value) => !actual.has(value)); if (missing.length) throw new Error(`Missing ${label}: ${missing.join(", ")}.`); }
function countBy(items, keyFor) { const counts = {}; for (const item of items) { const key = keyFor(item); counts[key] = (counts[key] ?? 0) + 1; } return counts; }
function summary(items, keyFor) { return Object.entries(countBy(items, keyFor)).sort().map(([key, count]) => `${key}:${count}`).join(","); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function unique(items) { return [...new Set(items)]; }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
