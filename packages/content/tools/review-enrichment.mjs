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
    const explanation = String(variant.explanation ?? "").trim();
    const hints = Array.isArray(variant.hints) ? variant.hints.filter(Boolean).map(String) : [];
    const misconception = readable(String(variant.misconception_tag ?? "the target idea"));
    const firstHint = hints[0] ?? "Look carefully at the model and the evidence in the task.";
    const secondHint = hints[1] ?? "Explain why your choice fits the learning goal.";

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
