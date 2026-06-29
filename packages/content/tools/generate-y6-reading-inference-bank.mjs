#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/en-y6-reading-inference-justify.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "en-y6-reading-inference-bank-";
const pilotTarget = 240;

if (write && check) throw new Error("Choose either --write or --check, not both.");

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "en-y6-reading-inference-justify") throw new Error("This generator only supports the Year 6 reading inference and justification pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 3) throw new Error(`Expected exactly 3 curated variants, found ${curated.length}. Refusing to overwrite possible authored work.`);

ensureBlueprints(pack);

const missions = [
  { key: "archive", place: "Clue Archive", reward: "evidence-thread card" },
  { key: "newsroom", place: "Evidence Newsroom", reward: "verified-source stamp" },
  { key: "library", place: "Hidden Meanings Library", reward: "interpretation index tile" },
  { key: "fielddesk", place: "Field Notes Investigation Desk", reward: "case-map marker" },
  { key: "studio", place: "Author Clue Studio", reward: "writer-choice lens" },
];

const sources = [
  { key: "corridor", genre: "fiction", text: "Nia reached the hall door, stopped, and checked the folded invitation for the third time. When music spilled into the corridor, she smoothed her sleeve and stepped inside.", inference: "Nia feels uncertain but decides to enter", evidence: "checked the folded invitation for the third time", secondEvidence: "smoothed her sleeve and stepped inside", alternative: "Nia is carefully checking that she has the correct event", clue: "for the third time", clueEffect: "the repetition suggests that her checking is not casual", prediction: "Nia may enter cautiously rather than turn away", overclaim: "Nia hates everyone inside and will immediately leave" },
  { key: "notebook", genre: "fiction", text: "Omar slid the repaired notebook onto Suki's desk before anyone arrived. At break, he listened from the doorway as she asked who had fixed it, but he said nothing.", inference: "Omar wants to help without receiving attention", evidence: "before anyone arrived", secondEvidence: "he said nothing", alternative: "Omar may be unsure whether Suki will like the repair", clue: "listened from the doorway", clueEffect: "the distant position keeps him outside the public moment", prediction: "Omar may continue to keep his help private", overclaim: "Omar is certainly frightened of Suki" },
  { key: "diary-stage", genre: "diary", text: "I finally volunteered to introduce our project. My name looked enormous at the top of the programme, and I kept rereading the first sentence on the bus home.", inference: "the writer is proud but nervous about speaking", evidence: "kept rereading the first sentence", secondEvidence: "finally volunteered", alternative: "the writer wants to prepare very carefully", clue: "finally", clueEffect: "the word implies that volunteering took time or courage", prediction: "the writer is likely to rehearse before the event", overclaim: "the writer will definitely forget every word on stage" },
  { key: "community-news", genre: "news report", text: "More than two hundred residents attended Saturday's river meeting. Questions continued for an hour after the planned finish, and organisers agreed to publish a second set of answers.", inference: "the river issue generated substantial public interest", evidence: "Questions continued for an hour after the planned finish", secondEvidence: "More than two hundred residents attended", alternative: "some attendees may have wanted more detail", clue: "agreed to publish a second set of answers", clueEffect: "the response indicates that the first discussion did not settle every question", prediction: "organisers may provide further information", overclaim: "every resident supports the organisers' proposal" },
  { key: "moth-info", genre: "information text", text: "The silver-striped moth rests beneath leaves during daylight. After dusk, it visits pale flowers whose scent becomes stronger at night.", inference: "the moth has behaviours suited to feeding at night", evidence: "After dusk, it visits pale flowers", secondEvidence: "rests beneath leaves during daylight", alternative: "the flowers may be easier for the moth to locate at night", clue: "whose scent becomes stronger at night", clueEffect: "the detail links flower scent with the moth's night-time visits", prediction: "the moth is more likely to be observed feeding after dusk", overclaim: "the moth can never move during daylight" },
  { key: "inventor", genre: "biography", text: "After the first design collapsed, Amara labelled every broken joint and rebuilt the frame. Her next three versions remained in the workshop, each covered with new measurements.", inference: "Amara responds persistently and methodically to setbacks", evidence: "labelled every broken joint and rebuilt the frame", secondEvidence: "each covered with new measurements", alternative: "Amara may value careful records", clue: "next three versions", clueEffect: "the number of revisions emphasises sustained effort rather than one quick attempt", prediction: "Amara is likely to test another revised design", overclaim: "Amara never makes mistakes" },
  { key: "park", genre: "persuasive article", text: "The eastern gate is the only entrance without a level path. Installing a short ramp would allow more residents to use the garden independently; the survey should begin this month.", inference: "the writer wants prompt action to improve access", evidence: "the survey should begin this month", secondEvidence: "allow more residents to use the garden independently", alternative: "the writer considers the eastern gate a priority", clue: "only entrance without a level path", clueEffect: "the comparison presents the gate as an unresolved exception", prediction: "the writer is likely to support a ramp survey", overclaim: "the writer proves that every resident wants exactly this ramp design" },
  { key: "storm", genre: "nature writing", text: "The gulls folded inland, low over the fields. Beyond the harbour wall, the horizon had vanished into one dark band, and shopkeepers began lifting signs from the pavement.", inference: "people and animals are responding to approaching severe weather", evidence: "shopkeepers began lifting signs from the pavement", secondEvidence: "The gulls folded inland", alternative: "the harbour may soon become windier", clue: "the horizon had vanished into one dark band", clueEffect: "the visual change makes the approaching weather seem broad and close", prediction: "the weather is likely to worsen soon", overclaim: "the passage proves the harbour will be destroyed" },
  { key: "poem-window", genre: "poetry", text: "The train draws one bright window / across the rain-black field; / I lift my hand too late / and keep the wave unseen.", inference: "the speaker feels a missed connection", evidence: "I lift my hand too late", secondEvidence: "keep the wave unseen", alternative: "the speaker may be watching someone depart", clue: "one bright window", clueEffect: "the single light isolates the brief point of connection in the dark setting", prediction: "the speaker may continue thinking about the departure", overclaim: "the speaker will never see the traveller again" },
  { key: "review", genre: "review", text: "The exhibition's opening room is crowded with labels, yet the final gallery gives each object space and a clear question. I returned to the last display twice.", inference: "the reviewer finds the final gallery more effective than the opening", evidence: "I returned to the last display twice", secondEvidence: "gives each object space and a clear question", alternative: "the reviewer particularly values uncluttered presentation", clue: "yet", clueEffect: "the contrast signals a shift from criticism to approval", prediction: "the review is likely to recommend parts of the exhibition with reservations", overclaim: "the reviewer thinks the entire exhibition is perfect" },
  { key: "formal-letter", genre: "formal letter", text: "We appreciate the temporary lighting installed last week. However, the northern path remains difficult to see after dusk, so we request a further inspection.", inference: "the writers are polite but still concerned about path safety", evidence: "we request a further inspection", secondEvidence: "the northern path remains difficult to see", alternative: "the writers acknowledge partial improvement", clue: "However", clueEffect: "the contrast preserves thanks while introducing the unresolved concern", prediction: "the writers expect the northern path to be reviewed", overclaim: "the writers accuse the installers of deliberately causing danger" },
  { key: "historical", genre: "historical account", text: "Only two pages of the expedition journal survive. Both mention delays caused by ice, but neither records why the group changed its route on 14 March.", inference: "the reason for the route change remains uncertain", evidence: "neither records why the group changed its route", secondEvidence: "Only two pages of the expedition journal survive", alternative: "ice may have influenced the route change", clue: "may", clueEffect: "cautious language separates a possibility from a documented fact", prediction: "a careful account will present more than one possible explanation", overclaim: "ice definitely caused the route change on 14 March" },
];

const candidates = [
  ...expand("inference", 34, buildInference),
  ...expand("evidence", 34, buildEvidence),
  ...expand("justification", 34, buildJustification),
  ...expand("competing", 34, buildCompeting),
  ...expand("author-clues", 34, buildAuthorClue),
  ...expand("sufficiency", 34, buildSufficiency),
  ...expand("overclaim", 33, buildOverclaim),
];

pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.adaptive_support.audio_first = "Optional extract and sentence replay uses only ElevenLabs assets after human listening approval. Browser TTS is prohibited; when audio is unavailable, visible text, clause chunking, line focus and adult or partner reading routes remain complete.";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Depth-wave review bank reaches the 240-item pilot target with three preserved curated questions and 237 deterministic candidates covering inference, evidence selection, justification, competing interpretations, author clues, evidence sufficiency and overclaiming across original fiction, diary, news, information, biography, persuasion, nature writing, poetry, review, letter and historical extracts. Generated candidates include SEND/dyslexia scaffolds, supported non-drag interactions, rich clue-to-inference feedback, pressure-free investigation missions and optional ElevenLabs references requiring human listening approval; browser TTS is prohibited. Independent English, teacher, SEND, accessibility, safeguarding, audio and renderer review remains required before promotion.";

validateBank(pack, curated, candidates);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`reading-inference-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`reading-inference-bank strands=${summary(candidates, (variant) => variant.body.inference_strand)}`);
console.log(`reading-inference-bank genres=${summary(candidates, (variant) => variant.body.genre)}`);
console.log(`reading-inference-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`reading-inference-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`reading-inference-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 6 reading-inference bank is out of date; run generate-y6-reading-inference-bank.mjs --write.");
  console.log("reading-inference-bank deterministic check passed");
} else {
  console.log("reading-inference-bank dry-run; pass --write to update the pack");
}

function buildInference(source, mission, index, id) {
  const answer = source.inference;
  return candidate({ id, format: "evidence-highlight", blueprint: "feeling-clue-highlights", band: "developing", strand: "inference", source, mission, prompt: `Inference case ${index + 1}: what is the most supportable inference from this ${source.genre} extract?`, choices: [answer, source.overclaim, "The extract supports no inference at all.", `The main point is only that this is ${source.genre}.`], answer, selectedEvidence: [source.evidence, source.secondEvidence], hints: ["Combine what the text states with what the actions, wording or details reasonably imply.", "Choose cautious language that fits all the clues without turning an inference into a proven fact."], explanation: `${source.inference} is supported by '${source.evidence}' and '${source.secondEvidence}'. The inference goes beyond literal recall but remains limited by the text.`, tag: "no_textual_evidence", repair: "Highlight one action or wording clue, paraphrase it, then complete 'This suggests... because...' before selecting an inference." });
}

function buildEvidence(source, mission, index, id) {
  const answer = source.evidence;
  return candidate({ id, format: "evidence-highlight", blueprint: "inference-retrieval-quick-checks", band: "retrieval", strand: "evidence_selection", source, mission, prompt: `Evidence scan ${index + 1}: which shortest quoted clue most directly supports '${source.inference}'?`, choices: [answer, source.text.split(". ")[0].split(" ").slice(0, 5).join(" "), "a detail not stated in the extract", source.genre], answer, selectedEvidence: [answer], hints: ["Match the evidence to the exact inference, not merely to the topic.", "Prefer the shortest sufficient span; do not copy the whole extract when a precise phrase carries the clue."], explanation: `'${answer}' directly supports ${source.inference.toLowerCase()} because ${source.clueEffect}. Other details may be true or related without proving this particular inference.`, tag: "copies_whole_passage", repair: "Use line focus and selectable phrase numbers, then test each phrase against the words of the inference." });
}

function buildJustification(source, mission, index, id) {
  const answer = `I infer that ${lowerFirst(source.inference)} because '${source.evidence}' ${source.clueEffect}.`;
  return candidate({ id, format: "short-response", blueprint: "quote-explanation-repairs", band: "secure", strand: "justification", source, mission, prompt: `Justification file ${index + 1}: which response links a quotation to the inference rather than leaving the quotation unexplained?`, choices: [answer, `'${source.evidence}'—this is my quote.`, `I think ${lowerFirst(source.inference)}, but I do not need evidence.`, `${source.inference} because the author wrote the extract.`], answer, selectedEvidence: [source.evidence], hints: ["A complete justification contains an inference, a precise clue and an explanation of how the clue supports it.", "After the quotation, explain the action, wording or contrast instead of repeating it."], explanation: `${answer} This creates a clue-inference-because chain and leaves room for another interpretation if it can be supported with equally relevant evidence.`, tag: "quote_without_explanation", repair: "Build three cards in order—INFERENCE, QUOTE, HOW IT SUPPORTS—then combine them orally or in writing." });
}

function buildCompeting(source, mission, index, id) {
  const answer = `Both are possible, but '${source.inference}' is stronger because '${source.evidence}' directly supports it; '${source.alternative}' remains plausible but less complete.`;
  return candidate({ id, format: "reason-builder", blueprint: "competing-interpretation-evidence", band: "secure", strand: "competing_interpretations", source, mission, prompt: `Interpretation hearing ${index + 1}: compare '${source.inference}' with '${source.alternative}'. Which judgement best weighs the evidence?`, choices: [answer, `Only the first interpretation can ever be discussed because it appears first.`, `Both interpretations are equally strong without checking any clues.`, `Neither interpretation needs textual evidence.`], answer, selectedEvidence: [source.evidence, source.secondEvidence], hints: ["Test each interpretation against the same set of clues.", "An alternative can be plausible yet weaker if it explains fewer details or needs an unstated assumption."], explanation: `${answer} Comparing coverage and directness is more rigorous than treating interpretation as personal preference or insisting there can be only one possible reading.`, tag: "one_interpretation_only", repair: "Place each interpretation above an evidence column, connect supporting clues, and mark assumptions that are not stated." });
}

function buildAuthorClue(source, mission, index, id) {
  const answer = `'${source.clue}' matters because ${source.clueEffect}.`;
  return candidate({ id, format: "evidence-highlight", blueprint: "author-clue-meaning", band: "expected", strand: "author_clues", source, mission, prompt: `Author-clue lens ${index + 1}: which explanation best shows how a deliberate word or structural clue shapes an inference?`, choices: [answer, `The clue matters only because it is a long word.`, `Every reader must feel exactly the same emotion.`, `The author clue can be ignored because only plot facts count.`], answer, selectedEvidence: [source.clue], hints: ["Notice repetition, contrast, cautious modality, positioning or a precise descriptive choice.", "Explain what the choice foregrounds or limits in this extract; avoid guaranteed reader reactions."], explanation: `${answer} The explanation connects a specific author choice to a supportable meaning effect within this ${source.genre} extract.`, tag: "feature_named_without_effect", repair: "Compare the original clue with a neutral replacement and complete 'The original makes the detail seem... because...'." });
}

function buildSufficiency(source, mission, index, id) {
  const limited = index % 3 === 0;
  const claim = limited ? source.overclaim : source.inference;
  const answer = limited
    ? `The evidence is insufficient for '${source.overclaim}'; it supports only the cautious inference that ${lowerFirst(source.inference)}.`
    : `The two clues are sufficient for the cautious inference '${source.inference}', but they do not prove every cause or future outcome.`;
  return candidate({ id, format: "short-response", blueprint: "evidence-sufficiency-and-overclaim", band: "stretch", strand: "evidence_sufficiency", source, mission, prompt: `Sufficiency review ${index + 1}: do '${source.evidence}' and '${source.secondEvidence}' sufficiently support the claim '${claim}'?`, choices: [answer, "Yes; any one related word proves the strongest possible claim.", "No inference can ever be made from a text.", "The genre label alone is enough evidence."], answer, selectedEvidence: [source.evidence, source.secondEvidence], hints: ["Ask whether the evidence supports every important part of the claim.", "Distinguish sufficient evidence for a cautious inference from proof of motive, cause, universality or a certain future."], explanation: `${answer} Evidence sufficiency depends on relevance, number and fit of clues, as well as the strength of the language used in the claim.`, tag: limited ? "overclaim_from_limited_evidence" : "demands_absolute_proof", repair: "Underline each claim word, connect evidence to it, and downgrade unsupported words such as always, definitely or everyone." });
}

function buildOverclaim(source, mission, index, id) {
  const predictionRoute = index % 2 === 0;
  const answer = predictionRoute
    ? `A careful prediction is '${source.prediction}' because '${source.secondEvidence}' supports that possibility; it is not certain.`
    : `Replace '${source.overclaim}' with '${source.inference}' because the extract supports the cautious interpretation but not the absolute claim.`;
  return candidate({ id, format: "reason-builder", blueprint: predictionRoute ? "prediction-from-evidence" : "motive-inference-chains", band: predictionRoute ? "stretch" : "expected", strand: "overclaiming", source, mission, prompt: predictionRoute ? `Prediction check ${index + 1}: which prediction stays within the evidence?` : `Overclaim repair ${index + 1}: which revision removes an unsupported certainty from '${source.overclaim}'?`, choices: [answer, source.overclaim, "Any outcome is equally likely because this is an inference question.", "A confident claim needs no quotation."], answer, selectedEvidence: [source.evidence, source.secondEvidence], hints: ["Look for absolute words or invented motives, causes and outcomes.", "Use may, might, suggests or is likely when the text supports a possibility rather than certainty."], explanation: `${answer} The response keeps the inference or prediction proportional to the clues and avoids inventing information beyond the extract.`, tag: "overclaim_from_limited_evidence", repair: "Place the claim on a certainty scale, remove unsupported absolute words, and attach one precise clue before resubmitting." });
}

function candidate({ id, format, blueprint, band, strand, source, mission, prompt, choices, answer, selectedEvidence, hints, explanation, tag, repair }) {
  const fullId = `${prefix}${id}`;
  const choiceSet = [...new Set(choices)];
  while (choiceSet.length < 4) choiceSet.push(`Unsupported distractor ${choiceSet.length + 1}`);
  const richExplanation = `${explanation} A different response remains reviewable when it cites relevant text and explains its reasoning without overclaiming.`;
  return {
    id: fullId,
    format,
    body: {
      prompt,
      text: source.text,
      genre: source.genre,
      choices: rotate(choiceSet, fullId.length % choiceSet.length),
      selected_evidence: selectedEvidence,
      inference_strand: strand,
      difficulty_band: band,
      evidence_purpose: `${strand}_clue_inference_justification`,
      variant_blueprint_id: blueprint,
      review_batch: "depth-wave",
      text_remains_visible: true,
      response_mode: "tap_keyboard_switch_oral_or_partner_response",
      interaction_support: { keyboard: true, switch_scan: true, touch: true, oral_or_partner_response: true, precision_drag_required: false, numbered_phrase_selection: true, undo_available: true },
      dyslexia_support: { increased_spacing: true, adjustable_line_length: true, line_focus: true, tinted_background_option: true, readable_font_option: true, chunked_sentence_view: true, evidence_only_view: true },
      scaffold_routes: { visual: "colour-independent clue-to-inference thread map", text: "numbered extract lines and phrase choices", oral: "rehearse inference-clue-because before recording", reduced_choice: "compare two interpretations or clues before restoring all options", vocabulary: "optional in-context glosses without defining the answer" },
      timer_allowed: false,
      speed_score_allowed: false,
      leaderboard_allowed: false,
      audio_optional: true,
      audio_asset_id: `narration-${fullId}`,
      audio_provider: "ElevenLabs",
      audio_asset_status: "required_human_listening_review",
      human_listening_approval_required: true,
      browser_tts_allowed: false,
      investigation_mission: { place: mission.place, strategic_unlock: "select a precise clue, state an inference, then explain the connection and certainty", reward: `add one ${mission.reward} to the shared case board`, loss_on_error: false, streak_pressure: false, retry_message: "That interpretation exposed a useful clue gap. Keep the extract open, revise one link, and try again when ready." },
    },
    expected_answer: { value: answer },
    hints,
    explanation: richExplanation,
    feedback: { correct: `Case link supported. ${richExplanation}`, evidence_feedback: "Check that the selected words directly address this inference rather than only the topic.", justification_feedback: "Explain what the clue reveals; do not leave the quotation to speak for itself.", sufficiency_feedback: "Match certainty to evidence and distinguish plausible, well-supported and proven.", misconception_repair: repair },
    difficulty: { developing: 4, expected: 5, secure: 7, stretch: 8, retrieval: 5 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: format === "evidence-highlight" ? "text-clue-highlight" : format === "reason-builder" ? "because-bridge-test" : "evidence-to-inference-thread",
  };
}

function expand(label, count, builder) {
  return Array.from({ length: count }, (_, index) => {
    const source = sources[index % sources.length];
    const mission = missions[Math.floor(index / sources.length) % missions.length];
    return builder(source, mission, index, `${label}-${source.key}-${mission.key}`);
  });
}

function ensureBlueprints(currentPack) {
  const additions = [
    { id: "competing-interpretation-evidence", format: "reason-builder", count: 280, difficulty_band: "secure", misconception_tag: "one_interpretation_only", purpose: "Compare plausible interpretations by relevance, directness and coverage of textual evidence.", generation_pattern: "original extract + two interpretations + evidence columns + strength judgement", review_notes: "Allow multiple defensible readings when each is justified, while distinguishing stronger from weaker support.", source: "ai_drafted_teacher_reviewed" },
    { id: "author-clue-meaning", format: "evidence-highlight", count: 280, difficulty_band: "expected", misconception_tag: "feature_named_without_effect", purpose: "Explain how precise author wording or structure contributes to an inference.", generation_pattern: "extract + author clue + neutral contrast + local meaning-effect choice", review_notes: "Avoid guaranteed reader reactions and decontextualised technique spotting.", source: "ai_drafted_teacher_reviewed" },
    { id: "evidence-sufficiency-and-overclaim", format: "short-response", count: 280, difficulty_band: "stretch", misconception_tag: "overclaim_from_limited_evidence", purpose: "Judge whether evidence is sufficient for claims of different strength and repair overclaiming.", generation_pattern: "claim + clue set + sufficient/limited judgement + calibrated revision", review_notes: "Accept concise alternative judgements when certainty and evidence are accurately matched.", source: "ai_drafted_teacher_reviewed" },
  ];
  for (const blueprint of additions) if (!currentPack.variant_blueprints.some((existing) => existing.id === blueprint.id)) currentPack.variant_blueprints.push(blueprint);
}

function validateBank(currentPack, authored, generated) {
  if (authored.length !== 3) throw new Error(`Expected three curated variants, found ${authored.length}.`);
  if (generated.length !== pilotTarget - authored.length || currentPack.question_variants.length !== pilotTarget) throw new Error(`Expected ${pilotTarget} total variants with ${pilotTarget - authored.length} generated.`);
  const blueprints = new Map(currentPack.variant_blueprints.map((item) => [item.id, item]));
  const formats = new Set(currentPack.practice.formats);
  const ids = new Set();
  const signatures = new Set();
  const strands = new Set();
  const genres = new Set();
  const actualFormats = new Set();
  const actualBlueprints = new Set();
  for (const item of currentPack.question_variants) {
    if (ids.has(item.id)) throw new Error(`Duplicate id ${item.id}.`);
    ids.add(item.id);
    const signature = `${item.format}|${normalise(item.body?.prompt)}|${normalise(item.expected_answer?.value)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${item.id}.`);
    signatures.add(signature);
  }
  for (const item of generated) {
    const blueprint = blueprints.get(item.body.variant_blueprint_id);
    if (!blueprint || blueprint.format !== item.format || blueprint.difficulty_band !== item.body.difficulty_band) throw new Error(`${item.id} does not match its blueprint format and band.`);
    if (!formats.has(item.format) || item.status !== "review" || !item.body.text_remains_visible) throw new Error(`${item.id} has unsupported format, status or hidden source text.`);
    if (!item.body.interaction_support?.keyboard || !item.body.interaction_support?.switch_scan || !item.body.interaction_support?.oral_or_partner_response || item.body.interaction_support?.precision_drag_required !== false) throw new Error(`${item.id} lacks supported interactions.`);
    if (!item.body.dyslexia_support?.increased_spacing || !item.body.dyslexia_support?.line_focus || !item.body.dyslexia_support?.chunked_sentence_view || !item.body.scaffold_routes?.visual || !item.body.scaffold_routes?.text || !item.body.scaffold_routes?.oral || !item.body.scaffold_routes?.reduced_choice) throw new Error(`${item.id} lacks SEND/dyslexia scaffolds.`);
    if (item.body.audio_provider !== "ElevenLabs" || item.body.audio_asset_status !== "required_human_listening_review" || item.body.human_listening_approval_required !== true || item.body.browser_tts_allowed !== false) throw new Error(`${item.id} violates audio policy.`);
    if (item.body.timer_allowed !== false || item.body.speed_score_allowed !== false || item.body.leaderboard_allowed !== false || item.body.investigation_mission?.loss_on_error !== false || item.body.investigation_mission?.streak_pressure !== false || !item.body.investigation_mission?.strategic_unlock) throw new Error(`${item.id} has unsuitable investigation gamification.`);
    if (!item.feedback?.correct || !item.feedback?.evidence_feedback || !item.feedback?.justification_feedback || !item.feedback?.sufficiency_feedback || !item.feedback?.misconception_repair || item.hints.length < 2 || item.explanation.length < 110) throw new Error(`${item.id} lacks rich feedback.`);
    if (!Array.isArray(item.body.choices) || item.body.choices.length < 4 || new Set(item.body.choices).size !== item.body.choices.length || item.body.choices.filter((choice) => choice === item.expected_answer.value).length !== 1) throw new Error(`${item.id} has invalid choices.`);
    strands.add(item.body.inference_strand);
    genres.add(item.body.genre);
    actualFormats.add(item.format);
    actualBlueprints.add(item.body.variant_blueprint_id);
  }
  requireCoverage("strands", ["inference", "evidence_selection", "justification", "competing_interpretations", "author_clues", "evidence_sufficiency", "overclaiming"], strands);
  requireCoverage("genres", ["fiction", "diary", "news report", "information text", "biography", "persuasive article", "nature writing", "poetry", "review", "formal letter", "historical account"], genres);
  requireCoverage("formats", [...formats], actualFormats);
  requireCoverage("blueprints", [...blueprints.keys()], actualBlueprints);
}

function requireCoverage(label, required, actual) { const missing = required.filter((item) => !actual.has(item)); if (missing.length) throw new Error(`Generated bank is missing ${label}: ${missing.join(", ")}.`); }
function lowerFirst(value) { return `${value.charAt(0).toLowerCase()}${value.slice(1)}`; }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function summary(items, keyFor) { const counts = new Map(); for (const item of items) counts.set(keyFor(item), (counts.get(keyFor(item)) ?? 0) + 1); return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
