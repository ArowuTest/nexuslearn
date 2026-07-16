const SUPPORTED_INTERACTION = "Use labelled touch or keyboard controls. Equivalent routes include single-switch scanning, eye-gaze dwell selection, AAC, pointing, partner or adult-supported response; fine dragging, handwriting and speech are never required.";

/**
 * Applies deterministic review-safety defaults at the generator boundary.
 *
 * This is deliberately content-neutral: it never invents an answer or changes
 * a learning objective. It only fills review metadata that every generated
 * variant must carry so runtime and audit gates see the same contract.
 */
export function enrichPackForReview(pack) {
  for (const variant of pack.question_variants ?? []) {
    if (variant.status !== "review") continue;

    const body = { ...(variant.body ?? {}) };
    let explanation = String(variant.explanation ?? "").trim();
    const hints = Array.isArray(variant.hints) ? variant.hints.filter(Boolean).map(String) : [];
    const misconception = readable(String(variant.misconception_tag ?? "the target idea"));
    const firstHint = hints[0] ?? "Look carefully at the model and the evidence in the task.";
    const secondHint = hints[1] ?? "Explain why your choice fits the learning goal.";

    const readabilityPrompt = READABILITY_PROMPT_OVERRIDES[variant.id] ?? READABILITY_PROMPT_FIXES[variant.id];
    if (readabilityPrompt) body.prompt = readabilityPrompt;
    const explanationMinimum = pack.source_alignment?.year <= 1 ? 40 : 50;
    if (explanation.length < explanationMinimum) {
      const answer = answerSummary(variant.expected_answer);
      explanation = `${explanation ? `${explanation} ` : ""}The expected response is ${answer}. ${secondHint} ${firstHint}`.trim();
      variant.explanation = explanation;
    }

    if (audioIsExpected(body)) body.browser_tts_allowed = false;
    if (!hasAccessibleRoute(body)) body.supported_interaction = body.supported_interaction ?? SUPPORTED_INTERACTION;
    const generatedVariant = variant.id.includes("-bank-");
    if (!body.variant_blueprint_id && generatedVariant) body.variant_blueprint_id = `generated-${pack.pack_id}`;
    if (!body.variant_blueprint_id && !generatedVariant) {
      body.review_provenance = body.review_provenance ?? { kind: "curated", pack_id: pack.pack_id, variant_id: variant.id };
    }
    if (!body.review_batch) body.review_batch = `${generatedVariant ? "generated" : "curated"}-review-${pack.pack_id}`;
    if (!generatedVariant && body.variant_blueprint_id === `generated-${pack.pack_id}`) delete body.variant_blueprint_id;

    const feedback = body.feedback && typeof body.feedback === "object" ? { ...body.feedback } : { ...(variant.feedback ?? {}) };
    if (!feedback.correct) feedback.correct = `Correct. ${explanation || secondHint}`;
    if (!feedback.retry && !feedback.repair) feedback.retry = `Try again calmly: ${firstHint} ${secondHint} No progress is lost for checking or changing your answer.`;
    if (!feedback.repair) feedback.repair = `Repair the ${misconception} route: ${firstHint} Then use the evidence to explain your choice.`;
    if (!feedback.misconception_check) feedback.misconception_check = `Check the ${misconception} idea against the task evidence.`;
    if (!feedback.support_message) feedback.support_message = "Touch, keyboard, switch, eye-gaze, AAC, pointing and adult-supported routes are valid; speed, speech and fine-motor precision are not scored.";

    variant.body = body;
    variant.feedback = feedback;
  }
  return pack;
}

const READABILITY_PROMPT_FIXES = {
  "en-y2-spelling-patterns-bank-review-repair-knock-6": "At the first knock checkpoint, build the reviewed word from grapheme chunks that match the taught sound pattern.",
  "en-y2-spelling-patterns-bank-review-repair-knock-36": "At the later knock checkpoint, which grapheme chunks repair the reviewed spelling?",
  "en-y5-authorial-choice-bank-viewpoint-missing-label-arts-centre": "Which claim best explains how the viewpoint controls what the reader knows?",
  "en-y5-authorial-choice-bank-viewpoint-two-plans-arts-centre": "Which claim best explains how the viewpoint controls what the reader knows?",
  "en-y5-authorial-choice-bank-viewpoint-closed-door-arts-centre": "Which claim best explains how the viewpoint controls what the reader knows?",
  "en-y5-authorial-choice-bank-viewpoint-object-narrator-arts-centre": "Which claim best explains how the viewpoint controls what the reader knows?",
  "en-y6-reading-inference-bank-sufficiency-park-archive": "At the Clue Archive, do the quoted details sufficiently support the claim?",
  "en-y6-reading-inference-bank-sufficiency-park-newsroom": "In the Evidence Newsroom, do the quoted details sufficiently support the claim?",
  "en-y6-reading-inference-bank-sufficiency-park-library": "In the Hidden Meanings Library, do the quoted details sufficiently support the claim?",
  "ma-y1-add-subtract-stories-bank-mixed-4-20-0-10": "Which subtraction uses the whole and known part to check the hidden part?",
  "ma-y1-add-subtract-stories-bank-mixed-4-19-2-20": "Which subtraction uses the whole and known part to check the hidden part?",
  "sc-y1-everyday-materials-bank-suit-cushion-13": "Which material choice uses evidence for soft cushion filling?",
  "ma-y5-multi-step-problems-q-first-error": "Find and repair the first error in this multi-step calculation.",
  "sc-y5-earth-space-models-bank-relative-motion-planets-sun-5": "Which model explanation matches the planet-motion evidence?",
  "sc-y5-earth-space-models-bank-relative-motion-moving-viewpoint-1": "In the expected moving-viewpoint model, which explanation matches the evidence?",
  "sc-y5-earth-space-models-bank-relative-motion-moving-viewpoint-2": "At the secure moving-viewpoint checkpoint, which explanation matches the evidence?",
  "sc-y5-earth-space-models-bank-relative-motion-moving-viewpoint-3": "At the stretch moving-viewpoint checkpoint, which explanation matches the evidence?",
  "sc-y5-earth-space-models-bank-relative-motion-moving-viewpoint-4": "In the introductory moving-viewpoint model, which explanation matches the evidence?",
  "sc-y5-earth-space-models-bank-relative-motion-moving-viewpoint-5": "In the developing moving-viewpoint model, which explanation matches the evidence?",
  "sc-y5-earth-space-models-bank-moon-light-sun-moon-compare-2": "Which explanation matches the Sun–Moon light evidence?",
  "sc-y5-earth-space-models-bank-moon-light-sun-moon-compare-3": "Which explanation matches the Sun–Moon light evidence?",
  "sc-y5-earth-space-models-bank-moon-light-sun-moon-compare-4": "Which explanation matches the Sun–Moon light evidence?",
  "sc-y5-earth-space-models-bank-moon-light-sun-moon-compare-5": "Which explanation matches the Sun–Moon light evidence?",
  "sc-y5-life-cycles-bank-plant-full-sequence-3": "Using a labelled cycle with a generation boundary, which sequence matches the plant life-cycle evidence?",
  "sc-y5-life-cycles-bank-plant-full-sequence-4": "On the linear timeline, which sequence matches the plant life-cycle evidence?",
  "sc-y5-life-cycles-bank-plant-full-sequence-5": "Using the audio-described static cards, which sequence matches the plant life-cycle evidence?",
  "sc-y5-life-cycles-bank-evidence-secondary-source-19": "Using the labelled photograph sequence, which claim is supported by this life-cycle evidence?",
  "sc-y5-life-cycles-bank-evidence-secondary-source-29": "Using the audio-described field log, which claim is supported by this life-cycle evidence?",
  "sc-y5-life-cycles-bank-evidence-runner-record-37": "Which claim is supported by this life-cycle evidence?",
  "sc-y5-life-cycles-bank-evidence-secondary-source-39": "Using the static graph and data table, which claim is supported by this life-cycle evidence?",
};

const READABILITY_PROMPT_OVERRIDES = {
  "sc-y5-earth-space-models-bank-moon-light-sun-moon-compare-2": "At the stretch checkpoint, which explanation matches the Sun–Moon light evidence?",
  "sc-y5-earth-space-models-bank-moon-light-sun-moon-compare-3": "At the introductory checkpoint, which explanation matches the Sun–Moon light evidence?",
  "sc-y5-earth-space-models-bank-moon-light-sun-moon-compare-4": "At the developing checkpoint, which explanation matches the Sun–Moon light evidence?",
  "sc-y5-earth-space-models-bank-moon-light-sun-moon-compare-5": "At the expected checkpoint, which explanation matches the Sun–Moon light evidence?",
};

function audioIsExpected(body) {
  return body.audio_asset_id !== undefined || body.audio_asset_ids !== undefined || body.audio_ref !== undefined || body.audio_route !== undefined || body.audio_provider !== undefined || body.audio_required === true || body.audio_asset_status === "required" || body.audio_asset_status === "required_before_pilot";
}

function hasAccessibleRoute(body) {
  const route = body.interaction_route ?? body.interaction_support ?? {};
  const supported = [body.supported_interactions, body.supported_interaction, body.supported_response_route, body.response_mode, body.interaction_mode, body.motor_alternatives].filter(Boolean).map(String).join(" ").toLowerCase().replaceAll("-", "_");
  const hasRoute = route.touch === true || route.tap === true || supported.includes("tap") || supported.includes("touch") || supported.includes("select");
  const hasKeyboard = route.keyboard === true || supported.includes("keyboard") || supported.includes("typed");
  const hasAlternative = route.switch_scan === true || route.eye_gaze === true || route.aac === true || route.aac_or_point === true || route.aac_oral === true || route.adult_scribed === true || route.adult_supported === true || supported.includes("switch") || supported.includes("eye_gaze") || supported.includes("aac") || supported.includes("adult") || supported.includes("partner") || supported.includes("oral");
  return hasRoute && hasKeyboard && hasAlternative;
}

function readable(value) {
  return value.replaceAll("_", " ");
}

function answerSummary(expectedAnswer) {
  const value = expectedAnswer?.value;
  if (value === undefined || value === null || value === "") return "the response supported by the evidence";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
