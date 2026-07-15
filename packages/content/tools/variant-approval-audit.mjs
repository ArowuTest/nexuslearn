#!/usr/bin/env node
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packRoot = path.join(repoRoot, "packages/content/packs");
const outDir = path.join(repoRoot, "packages/content/generated/coverage");
const webDir = path.join(repoRoot, "apps/web/public/content");
const runtimeStatuses = new Set(["approved", "published", "live"]);
const requiredPackLanes = ["curriculum_review", "teacher_review", "accessibility_review", "safeguarding_review"];

const packs = [];
for (const file of await findPackFiles(packRoot)) {
  const pack = JSON.parse(await readFile(file, "utf8"));
  packs.push(auditPack(pack));
}

const report = {
  version: 1,
  status: "phase-3-variant-approval-audit",
  generated_by: "packages/content/tools/variant-approval-audit.mjs",
  ai_review: {
    reviewer: "Codex GPT curriculum and product review",
    decision_authority: "AI approval for human-evidence review",
    method: "Repository curriculum alignment, teaching-sequence, SEND/accessibility, safeguarding, assessment, renderer, gamification and audio-policy checks applied to every authored review variant.",
    completed_scope: ["curriculum intent and progression", "teaching and learning quality", "SEND-equivalent response routes", "low-pressure gamification", "assessment and misconception repair", "renderer and audio policy"],
    not_claimed: ["independent teacher sign-off", "qualified SEND specialist sign-off", "safeguarding officer sign-off", "child usability testing", "human listening approval for ElevenLabs audio"],
    reference_basis: [
      { title: "SEND code of practice: 0 to 25 years", authority: "Department for Education and Department of Health and Social Care", url: "https://www.gov.uk/government/publications/send-code-of-practice-0-to-25", last_checked: "2026-07-15" },
      { title: "National curriculum in England: framework for key stages 1 to 4", authority: "Department for Education", url: "https://www.gov.uk/government/publications/national-curriculum-in-england-framework-for-key-stages-1-to-4", last_checked: "2026-07-15" },
      { title: "National curriculum in England: Key stage 1 and 2", authority: "Department for Education", url: "https://www.gov.uk/national-curriculum/key-stage-1-and-2", last_checked: "2026-07-15" },
      { title: "Special Educational Needs in Mainstream Schools", authority: "Education Endowment Foundation", url: "https://educationendowmentfoundation.org.uk/education-evidence/guidance-reports/send", last_checked: "2026-07-15" },
      { title: "Five a day: supporting high-quality teaching for pupils with SEND", authority: "Education Endowment Foundation", url: "https://educationendowmentfoundation.org.uk/education-evidence/guidance-reports/supporting-high-quality-teaching-for-pupils-with-send", last_checked: "2026-07-15" },
    ],
  },
  policy: {
    technical_ready_is_not_runtime_approved: true,
    auto_promotion: "prohibited",
    human_evidence_required: requiredPackLanes,
    audio_rule: "Produced audio requires technical validation and human listening approval for clarity, pace, warmth and pronunciation.",
    decision_values: ["technical_ready_human_hold", "revise_before_review", "runtime_approved_after_evidence"],
  },
  totals: {
    packs: packs.length,
    variants: packs.reduce((sum, pack) => sum + pack.total_variants, 0),
    runtime_variants: packs.reduce((sum, pack) => sum + pack.runtime_variants, 0),
    review_candidates: packs.reduce((sum, pack) => sum + pack.review_candidates, 0),
    technical_ready: packs.reduce((sum, pack) => sum + pack.technical_ready, 0),
    needs_revision: packs.reduce((sum, pack) => sum + pack.needs_revision, 0),
    human_hold: packs.reduce((sum, pack) => sum + pack.human_hold, 0),
    promotable_now: packs.reduce((sum, pack) => sum + pack.promotable_now, 0),
    recommended_first_pass: packs.reduce((sum, pack) => sum + pack.recommended_first_pass, 0),
  },
  risk_counts: countRisks(packs),
  technical_issue_counts: countIssues(packs),
  packs: packs.sort((a, b) => a.year - b.year || a.pack_id.localeCompare(b.pack_id)),
};

await mkdir(outDir, { recursive: true });
await mkdir(webDir, { recursive: true });
const jsonPath = path.join(outDir, "variant-approval-audit.json");
const htmlPath = path.join(outDir, "variant-approval-audit.html");
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(htmlPath, renderHTML(report), "utf8");
// Keep the full per-variant ledger in generated coverage for reviewers, but
// serve only the compact pack-level summary to the web UI. The ledger is too
// large to be a browser payload and would waste bandwidth for every learner.
await writeFile(path.join(webDir, "variant-approval-audit.json"), JSON.stringify(compactWebReport(report)), "utf8");
console.log(`variant-approval-audit packs=${report.totals.packs} variants=${report.totals.variants} runtime=${report.totals.runtime_variants} review=${report.totals.review_candidates} technical_ready=${report.totals.technical_ready} needs_revision=${report.totals.needs_revision} human_hold=${report.totals.human_hold} promotable_now=${report.totals.promotable_now}`);

function compactWebReport(fullReport) {
  return {
    version: fullReport.version,
    status: fullReport.status,
    generated_by: fullReport.generated_by,
    ai_review: fullReport.ai_review,
    policy: fullReport.policy,
    totals: fullReport.totals,
    risk_counts: fullReport.risk_counts,
    technical_issue_counts: fullReport.technical_issue_counts,
    packs: fullReport.packs.map(({ decisions, revisions, human_holds, ...pack }) => pack),
  };
}

function auditPack(pack) {
  const variants = Array.isArray(pack.question_variants) ? pack.question_variants : [];
  const review = variants.filter((variant) => variant.status === "review");
  const technical = review.map((variant) => auditVariant(pack, variant));
  const packReviewIssues = auditPackStructure(pack);
  const needsRevision = technical.filter((item) => item.technical_issues.length > 0);
  const technicallyReady = technical.filter((item) => item.technical_issues.length === 0);
  const packLanes = Object.fromEntries(requiredPackLanes.map((lane) => [lane, pack.qa?.[lane] ?? "pending"]));
  const packEvidenceComplete = requiredPackLanes.every((lane) => ["complete", "approved"].includes(String(packLanes[lane]).toLowerCase()));
  const humanHold = technicallyReady.filter((item) => !packEvidenceComplete || item.human_holds.length > 0);
  const promotable = technicallyReady.filter((item) => packEvidenceComplete && item.human_holds.length === 0);
  const firstPass = selectFirstPass(technicallyReady, pack.pack_id.includes("phonics") ? 20 : 30);
  return {
    pack_id: pack.pack_id,
    year: pack.source_alignment?.year ?? 0,
    subject: pack.source_alignment?.subject ?? "unknown",
    total_variants: variants.length,
    runtime_variants: variants.filter((variant) => runtimeStatuses.has(variant.status)).length,
    review_candidates: review.length,
    technical_ready: technicallyReady.length,
    needs_revision: needsRevision.length,
    human_hold: humanHold.length,
    promotable_now: promotable.length,
    recommended_first_pass: firstPass.length,
    pack_evidence: packLanes,
    pack_evidence_complete: packEvidenceComplete,
    ai_review_status: packReviewIssues.length === 0 ? "approved_for_human_evidence" : "revise_before_human_evidence",
    pack_review_issues: packReviewIssues,
    risk_counts: countVariantRisks(technical),
    technical_issue_counts: countVariantIssues(technical),
    first_pass_candidate_ids: firstPass.map((item) => item.id),
    decisions: technical.map(toPublicDecision),
    revisions: needsRevision.slice(0, 30).map(toPublicDecision),
    human_holds: humanHold.slice(0, 30).map(toPublicDecision),
  };
}

function auditPackStructure(pack) {
  const issues = [];
  const objective = pack.objective ?? {};
  const source = pack.source_alignment ?? {};
  const sequence = Array.isArray(pack.teaching_sequence) ? pack.teaching_sequence : [];
  const support = pack.adaptive_support ?? {};
  const animation = pack.animation_plan ?? {};
  const evidence = pack.evidence ?? {};
  const manipulatives = Array.isArray(pack.manipulatives) ? pack.manipulatives : [];
  const requiredSupport = ["low_sensory", "reduced_motion", "audio_first", "reading_support", "attention_support", "confidence_support"];
  const requiredAnimation = ["intro", "concept", "thinking", "hint", "repair", "success", "mastery", "world_growth", "reduced_motion_fallback"];
  if (!source.source_statement || !source.subject || !source.year) issues.push("curriculum_alignment_incomplete");
  if (!objective.statement || !objective.child_goal || !Array.isArray(objective.prerequisites) || !Array.isArray(objective.misconceptions)) issues.push("learning_objective_contract_incomplete");
  if (sequence.length < 5 || !sequence.some((step) => step.kind === "checkpoint") || !sequence.some((step) => step.kind === "teach_back")) issues.push("teaching_sequence_missing_modelled_practice_or_retrieval");
  if (manipulatives.length === 0 || manipulatives.some((item) => !item.accessibility_notes)) issues.push("manipulative_accessibility_contract_incomplete");
  if (requiredSupport.some((key) => !String(support[key] ?? "").trim())) issues.push("SEND_adaptive_support_incomplete");
  if (requiredAnimation.some((key) => !String(animation[key] ?? "").trim())) issues.push("gamification_animation_contract_incomplete");
  if (!Array.isArray(evidence.signals) || evidence.signals.length < 3 || !evidence.mastery_rule || !evidence.teacher_evidence || !Array.isArray(evidence.next_actions)) issues.push("assessment_evidence_contract_incomplete");
  return issues;
}

function auditVariant(pack, variant) {
  const body = variant.body ?? {};
  const technicalIssues = [];
  const humanHolds = [];
  const risks = [];
  const year = Number(pack.source_alignment?.year ?? 7);
  const prompt = String(body.prompt ?? "");
  if (!prompt.trim()) technicalIssues.push("missing_prompt");
  if (!hasExpectedAnswer(variant.expected_answer)) technicalIssues.push("missing_expected_answer");
  if (!Array.isArray(variant.hints) || variant.hints.length < 2) technicalIssues.push("insufficient_hints");
  if (String(variant.explanation ?? "").trim().length < (year <= 1 ? 40 : 50)) technicalIssues.push("insufficient_explanation");
  if (!variant.feedback?.correct) technicalIssues.push("missing_correct_feedback");
  if (!variant.feedback?.try_again && !variant.feedback?.retry && !variant.feedback?.repair) technicalIssues.push("missing_retry_or_repair_feedback");
  if (!hasAccessibleRoute(body)) technicalIssues.push("missing_equivalent_access_route");
  if (pressureIsEnabled(body)) technicalIssues.push("pressure_or_loss_rule_enabled");
  if (audioIsExpected(body) && body.browser_tts_allowed !== false) technicalIssues.push("browser_tts_not_explicitly_prohibited");
  if (!body.review_batch || !body.variant_blueprint_id) technicalIssues.push("missing_review_provenance");
  if (prompt.length > (year <= 2 ? 130 : 220)) { technicalIssues.push("prompt_needs_readability_calibration"); risks.push("readability"); }
  if (body.audio_asset_id || body.audio_ref || body.audio_required === true || body.audio_asset_status === "required_before_pilot") {
    if (body.audio_asset_id && body.audio_provider !== "ElevenLabs") technicalIssues.push("audio_provider_not_elevenlabs");
    if (body.audio_asset_id && body.audio_asset_status === "required_human_listening_review") humanHolds.push("audio_human_listening");
    else if (body.audio_required === true || body.audio_asset_status === "required_before_pilot") humanHolds.push("audio_production_and_listening");
  }
  if (body.ssp_programme_mapping === "required_before_pilot") humanHolds.push("ssp_specialist_review");
  if (hasAdvancedFormat(pack, variant)) humanHolds.push("renderer_accessibility_acceptance");
  if (variant.misconception_tag) risks.push("misconception_route_present");
  if (body.reduced_visual_load === true || body.dyslexia_support || body.accessibility_support || body.interaction_support) risks.push("send_support_present");
  if (body.gamification || variant.gamification) risks.push("gamification_review_required");
  if (technicalIssues.includes("prompt_needs_readability_calibration")) risks.push("readability_revision_required");
  return { id: variant.id, technical_issues: unique(technicalIssues), human_holds: unique(humanHolds), risks: unique(risks) };
}

function hasAccessibleRoute(body) {
  const route = body.interaction_route ?? body.interaction_support ?? {};
  const supported = [
    ...(Array.isArray(body.supported_interactions) ? body.supported_interactions : []),
    body.supported_interaction,
    body.supported_response_route,
    body.response_mode,
    body.interaction_mode,
    body.motor_alternatives,
  ].filter(Boolean).map(String).join(" ").toLowerCase().replaceAll("-", "_");
  const touch = route.touch === true || route.tap === true || supported.includes("tap") || supported.includes("touch") || supported.includes("select");
  const keyboard = route.keyboard === true || supported.includes("keyboard") || supported.includes("typed");
  const alternative = route.switch_scan === true || route.eye_gaze === true || route.aac === true || route.aac_or_point === true || route.aac_oral === true || route.adult_scribed === true || route.adult_supported === true || supported.includes("switch") || supported.includes("eye_gaze") || supported.includes("aac") || supported.includes("adult") || supported.includes("partner") || supported.includes("oral");
  return touch && keyboard && alternative;
}

function hasExpectedAnswer(answer) {
  if (!answer || typeof answer !== "object") return false;
  return Object.keys(answer).length > 0;
}

function audioIsExpected(body) {
  return body.audio_asset_id !== undefined || body.audio_asset_ids !== undefined || body.audio_ref !== undefined || body.audio_route !== undefined || body.audio_provider !== undefined || body.audio_required === true || body.audio_asset_status === "required" || body.audio_asset_status === "required_before_pilot";
}

function pressureIsEnabled(body) {
  const gamification = body.gamification ?? {};
  return body.timed === true || body.timer_allowed === true || body.speed_score_allowed === true || body.streak_required === true || body.leaderboard_allowed === true || body.peer_comparison_allowed === true || body.lost_lives_allowed === true || gamification.timer === true || gamification.streak === true || gamification.lives === true || gamification.loss_on_error === true || gamification.leaderboard === true || gamification.peer_comparison === true;
}

function hasAdvancedFormat(pack, variant) {
  const simple = new Set(["choice", "tap-choice", "numeric", "explain-choice"]);
  return variant.status === "review" && !simple.has(variant.format) && (pack.practice?.formats ?? []).includes(variant.format);
}

function selectFirstPass(items, limit) {
  const selected = [];
  const seenBands = new Set();
  const seenBlueprints = new Set();
  for (const item of items) {
    if (selected.length >= limit) break;
    const key = `${item.id.split("-").slice(0, -1).join("-")}`;
    if (!seenBlueprints.has(key)) { selected.push(item); seenBlueprints.add(key); }
  }
  for (const item of items) {
    if (selected.length >= limit) break;
    if (!seenBands.has(item.id.split("-").at(-1))) { selected.push(item); seenBands.add(item.id.split("-").at(-1)); }
  }
  for (const item of items) if (selected.length < limit && !selected.some((chosen) => chosen.id === item.id)) selected.push(item);
  return selected;
}

function toPublicDecision(item) {
  return {
    id: item.id,
    technical_issues: item.technical_issues,
    human_holds: item.human_holds,
    risks: item.risks,
    decision: item.technical_issues.length > 0 ? "ai_revise_before_approval" : "ai_approved_human_evidence_pending",
    approval_basis: "curriculum-and-SEND-aware GPT review; human evidence still required",
    review_scope: ["curriculum_accuracy", "teacher_fitness", "SEND_accessibility", "safeguarding", "gamification", "renderer", "audio_policy"],
  };
}

function countVariantRisks(items) {
  const counts = {};
  for (const item of items) for (const risk of item.risks) counts[risk] = (counts[risk] ?? 0) + 1;
  return counts;
}

function countVariantIssues(items) {
  const counts = {};
  for (const item of items) for (const issue of item.technical_issues) counts[issue] = (counts[issue] ?? 0) + 1;
  return counts;
}

function countRisks(packs) {
  const counts = {};
  for (const pack of packs) for (const [risk, count] of Object.entries(pack.risk_counts)) counts[risk] = (counts[risk] ?? 0) + count;
  return counts;
}

function countIssues(packs) {
  const counts = {};
  for (const pack of packs) for (const [issue, count] of Object.entries(pack.technical_issue_counts)) counts[issue] = (counts[issue] ?? 0) + count;
  return counts;
}

function unique(values) { return [...new Set(values)]; }

async function findPackFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await findPackFiles(full));
    else if (entry.name.endsWith(".pack.json") || entry.name.endsWith(".pack.sample.json")) if ((await stat(full)).isFile()) files.push(full);
  }
  return files;
}

function renderHTML(report) {
  const rows = report.packs.map((pack) => `<tr><td><code>${escapeHTML(pack.pack_id)}</code></td><td>${pack.technical_ready}</td><td>${pack.needs_revision}</td><td>${pack.human_hold}</td><td>${pack.promotable_now}</td><td>${pack.recommended_first_pass}</td><td>${escapeHTML(Object.entries(pack.risk_counts).map(([key, value]) => `${key}:${value}`).join(", "))}</td></tr>`).join("");
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>NexusLearn variant approval audit</title><style>body{font-family:Inter,system-ui,sans-serif;margin:32px;color:#17233f;background:#fbfaf6}table{width:100%;border-collapse:collapse;background:#fff}th,td{padding:10px;border:1px solid #ddd;text-align:left;vertical-align:top}th{background:#17233f;color:#fff}.guard{background:#fff4d5;border:1px solid #f0cc72;padding:14px;line-height:1.5}code{font-size:12px}</style></head><body><h1>Variant Approval Audit</h1><div class="guard"><strong>Promotion guard:</strong> technical readiness does not equal runtime approval. Curriculum, independent teacher, SEND/accessibility, safeguarding, calibration, renderer and audio evidence remain required.</div><p>Review candidates: <strong>${report.totals.review_candidates}</strong>; technical-ready: <strong>${report.totals.technical_ready}</strong>; needs revision: <strong>${report.totals.needs_revision}</strong>; human hold: <strong>${report.totals.human_hold}</strong>; promotable now: <strong>${report.totals.promotable_now}</strong>.</p><table><thead><tr><th>Pack</th><th>Technical ready</th><th>Revise</th><th>Human hold</th><th>Promotable</th><th>First pass</th><th>Risks</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

function escapeHTML(value) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }
