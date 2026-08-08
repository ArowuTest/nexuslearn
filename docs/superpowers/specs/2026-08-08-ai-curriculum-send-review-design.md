# AI Curriculum and SEND Review Design

**Status:** Approved design, awaiting written-spec confirmation

**Date:** 2026-08-08

**Scope:** NexusLearn Year 1-7 English, mathematics and science MVP curriculum

**Decision owners:** Product owner, AI Curriculum Lead and AI SEND Lead

## 1. Purpose

NexusLearn needs an evidence-backed way to review every curriculum pack and every generated learning variant without representing AI review as a human professional sign-off. This design establishes two explicit, auditable approval lanes:

1. **AI Curriculum Lead approval** for curriculum accuracy, progression, pedagogy and assessment quality.
2. **AI SEND Lead approval** for inclusive design, accessibility, reasonable response routes and non-deficit treatment of learners.

A content item may enter the controlled development or pilot catalogue only when both AI lanes approve the exact content revision and all technical gates pass. Public production release remains separately blocked until safeguarding, produced-audio listening and real-child pilot evidence are complete where applicable.

This design also defines how the review programme fits the remaining product work: learner experience, gamification, teacher and parent evidence, administration, audio, accessibility and operational readiness.

## 2. Current baseline

The repository's generated release evidence reports the following baseline:

- 87 curriculum packs across Years 1-7.
- 90 contracted year-subject-strand curriculum areas, with 90 authored and none missing.
- 20,210 authored learning variants.
- 65 variants currently marked runtime-approved at source.
- 20,145 variants currently held as review candidates.
- 20,145 variants currently passing the generated technical-readiness checks.
- 0 variants currently reported as technically requiring revision.
- 874 narration assets reported as technically valid.
- 0 narration assets with recorded human listening approval.

These figures describe inventory and technical state, not educational quality. No percentage based only on schema validity, counts or automated test success may be presented as curriculum approval, SEND approval, safeguarding approval or pilot validation.

## 3. Goals

- Review all 87 packs and all 20,210 variants under explicit, reproducible criteria.
- Make curriculum and SEND decisions separately visible and auditable.
- Allow development and controlled pilot use after dual AI approval and technical release checks.
- Automatically invalidate approval when the reviewed content or material dependencies change.
- Route uncertain, unsafe, ambiguous or weak content into revision instead of approving by default.
- Preserve age-appropriate fun, narrative continuity and meaningful gamification without weakening educational depth.
- Support subject-specific advancement so strong mathematics progress is not blocked by weaker English progress, while retaining spaced retrieval of prior learning.
- Give operators a usable review queue, evidence view, filters, bulk actions with safeguards and complete audit history.
- Keep the architecture backend-driven and suitable for future editors, reviewers, subjects, providers and larger catalogues.

## 4. Non-goals

- Claiming that an AI system is a qualified human teacher, SENCO, SEND specialist, safeguarding officer or clinical professional.
- Treating AI review as independent human safeguarding approval.
- Treating audio-file existence or codec validation as listening approval.
- Treating a simulated learner or automated browser run as evidence from real children.
- Expanding the current MVP to Computing, History, French or Spanish before the existing English, mathematics and science experience reaches the agreed release standard.
- Using engagement mechanics to rank children publicly, create shame, apply coercive streak pressure or obscure learning outcomes.

## 5. Authority and terminology

The product must use these exact decision labels:

- `ai_curriculum_lead`
- `ai_send_lead`
- `human_safeguarding`
- `human_audio_listening`
- `child_pilot_evidence`

The first two are AI review lanes. The final three are independent evidence lanes and cannot be satisfied by an AI decision.

Independent human teacher or SEND-professional review may be recorded as additional advisory evidence and is strongly recommended before wide-scale launch. It is not a mandatory system blocker under this design unless the product owner, a customer contract, an insurer or applicable regulation makes it one.

No interface, report, API or document may shorten `AI Curriculum Lead approval` to `teacher approved`, or `AI SEND Lead approval` to `SEND specialist approved`.

## 6. Review unit and version identity

Review operates at two linked levels:

- **Pack review:** the coherent programme of objectives, prerequisite sequence, teaching steps, misconceptions, assessment plan, gamification model and evidence expectations.
- **Variant review:** the exact learner-facing prompt, expected response, accepted equivalents, hints, explanation, accessibility alternatives, narration text and metadata.

Each review decision binds to:

- immutable content ID;
- content revision;
- canonical content hash;
- pack and curriculum-contract revision;
- rubric revision;
- reviewer lane and reviewer implementation identity;
- model or ruleset identifier;
- source-set revision;
- decision timestamp;
- structured findings and evidence notes.

Approval never floats across changed content. A changed hash or material dependency marks the earlier decision `stale` and removes it from release eligibility until re-review succeeds.

## 7. Status model

Each lane uses the following statuses:

- `not_reviewed`: no decision exists for the current revision.
- `in_review`: deterministic and semantic checks are running.
- `approved`: the current revision satisfies that lane's rubric.
- `approved_with_observation`: safe for controlled pilot, with a non-blocking improvement recorded.
- `revision_required`: one or more remediable blocking findings exist.
- `escalation_required`: uncertainty or risk exceeds AI decision authority.
- `stale`: a prior decision no longer matches the current content or dependencies.
- `superseded`: retained historical decision for an older revision.

`approved_with_observation` counts as AI approval for controlled pilot only. Observations remain visible in the backlog and must not be silently discarded.

## 8. Evidence record

Every lane decision stores a durable record with:

- `review_id`, `content_id`, `content_type`, `content_revision` and `content_hash`;
- `lane`, `status`, `risk_tier` and `rubric_revision`;
- reviewer implementation and model or ruleset identifiers;
- review start and completion timestamps;
- deterministic check results;
- rubric criterion scores and pass/fail outcomes;
- finding codes, severity, rationale and affected fields;
- cited source IDs and the claims each source supports;
- confidence and explicit uncertainty notes;
- required revisions or escalation reason;
- prior review linkage for re-reviews;
- audit actor and operation source.

The evidence record is append-only. Corrections create a superseding record. Administrative changes that alter release state must be audited separately from educational review decisions.

## 9. Curriculum review rubric

### 9.1 Pack-level criteria

Every pack must demonstrate:

- alignment to the applicable England National Curriculum programme of study and the repository curriculum contract;
- accurate subject knowledge and terminology;
- a coherent prerequisite and progression sequence;
- sufficient depth, examples and practice for the intended objective;
- explicit teaching, guided practice, independent practice, retrieval and assessment opportunities;
- age-appropriate cognitive demand without artificial restriction of capable learners;
- identified common misconceptions with diagnostic responses;
- varied evidence modes appropriate to the learning goal;
- planned spaced retrieval and interleaving of prior content;
- subject-specific progression and cross-year advancement rules;
- meaningful links between learning, narrative, rewards and mastery;
- assessment coverage that supports reliable decisions rather than one-question mastery;
- clarity about what is statutory curriculum, platform enrichment or future extension.

### 9.2 Variant-level criteria

Every variant must pass checks for:

- factual and computational correctness;
- one defensible intended answer or a complete accepted-answer set;
- absence of accidental ambiguity, trick wording and hidden assumptions;
- alignment between objective, prompt, response and explanation;
- hints that scaffold rather than reveal or introduce a second method unexpectedly;
- explanations that teach the underlying idea, not merely restate the answer;
- plausible distractors tied to known misconceptions where multiple choice is used;
- age-appropriate vocabulary, sentence length and context;
- cultural respect and avoidance of stereotypes;
- valid difficulty and prerequisite metadata;
- consistency between visible text and narration text;
- enough surface variation to prevent memorising templates while preserving construct validity.

### 9.3 Progression and retention

Mastery is tracked per subject, strand and objective. Advancement in one subject must not wait for unrelated subjects. A Year 3 learner who demonstrates secure Year 3 mathematics may receive Year 4 mathematics while continuing at the appropriate level in English and science.

Advancement must:

- require multiple independent pieces of evidence across time and task forms;
- distinguish fluency, reasoning and transfer where the objective requires them;
- retain periodic retrieval from the learner's enrolled year and prior mastered objectives;
- reduce but not eliminate retrieval after sustained success;
- increase retrieval or provide repair teaching when retention weakens;
- expose the current working level, evidence and uncertainty to authorised adults;
- allow an authorised adult to inspect and override routing with a recorded reason.

## 10. SEND review rubric

AI SEND Lead review is an inclusive-design and accessibility review, not diagnosis or clinical advice. Every pack and variant must be checked for:

- clear, literal and concise instructions, with idiom explained or avoided;
- manageable information density and chunking;
- predictable interaction and feedback patterns;
- keyboard, switch-compatible and low-precision response routes where relevant;
- text-choice or alternative response modes that preserve the assessed construct;
- narration availability and transcript equivalence where audio is required;
- no reliance on colour, sound, speed or fine motor precision alone;
- reduced-motion and low-sensory compatibility;
- control over replay, pace, repetition and avoidable time pressure;
- readable typography, contrast, focus order and target sizing;
- supportive hints and repair loops without public comparison or shame;
- non-deficit, respectful language and no unsupported diagnostic inference;
- avoidance of contexts likely to create unnecessary sensory, emotional or cultural barriers;
- equivalence between accessible alternatives and the original learning objective;
- clear escalation where safety, trauma, medical, behavioural or diagnostic judgment would be required.

SEND approval must fail when an accessibility alternative changes what is being assessed, supplies the answer, or excludes a learner without a justified construct-specific reason.

## 11. Deterministic checks and risk-based deep review

All variants receive deterministic checks. These include schema validation, reference integrity, answer resolution, duplicate and near-duplicate detection, prompt-answer consistency, narration-text parity, forbidden patterns, reading-load thresholds, accessibility metadata, curriculum linkage and release-state consistency.

All packs receive full semantic review. Variants receive semantic review according to risk, with no variant entering the catalogue solely because it passed syntax checks.

Risk tier is calculated from:

- subject and concept complexity;
- year and reading demand;
- open-ended or multi-answer response design;
- generated mathematical values or units;
- safeguarding-sensitive context;
- SEND adaptation complexity;
- narration dependence;
- novelty of template or renderer;
- history of failures, revisions or learner difficulty;
- low confidence or conflicting source evidence.

Risk handling:

- **Tier 1:** deterministic checks plus rubric review of the canonical template, generated constraints and representative boundary cases.
- **Tier 2:** deterministic checks plus direct semantic review of every variant.
- **Tier 3:** direct semantic review of every variant with adversarial checks and mandatory escalation on unresolved uncertainty.

Sampling may reduce repeated semantic inspection only for a proven deterministic variant family in Tier 1. The family definition, generator constraints, boundary cases and sample seed must be recorded so the review is reproducible. A sample failure expands review to the entire family and invalidates existing family approval.

## 12. Source governance

Curriculum claims must trace to authoritative primary sources, led by the Department for Education's current National Curriculum material and statutory or official assessment guidance where applicable. SEND criteria must trace to current authoritative accessibility, equality and education guidance and recognised inclusive-design standards.

The source registry stores:

- stable source ID and title;
- publisher and source type;
- direct URL or repository artifact;
- publication or revision date;
- date checked;
- applicable years, subjects and rubric criteria;
- excerpt-free claim summary;
- supersession state.

Sources are versioned. A source update triggers a targeted staleness assessment for affected reviews. Secondary articles may inform practice but cannot override primary statutory or standards sources.

## 13. Review and revision workflow

1. Freeze a content revision and compute its canonical hash.
2. Run structural, correctness, accessibility and release-integrity checks.
3. Assign risk tier and review lane queues.
4. Review the pack under both rubrics.
5. Review its variants under the applicable risk policy.
6. Record separate Curriculum Lead and SEND Lead decisions.
7. Convert blocking findings into field-specific revision tasks.
8. Revise source content or generation rules, never generated evidence alone.
9. Regenerate affected variants and reports deterministically.
10. Mark prior decisions stale or superseded.
11. Re-run both review lanes for the changed scope.
12. Admit only dual-approved, technically releasable revisions to the controlled catalogue.

Bulk approval is not permitted without a shared immutable hash basis, the same passing evidence and a recorded family decision. Administrators may bulk queue or bulk assign content, but cannot bypass a failing lane.

## 14. Release boundaries

### 14.1 Authoring catalogue

May contain incomplete, failed, stale and unreviewed content. It is inaccessible to ordinary learners.

### 14.2 Controlled development catalogue

Requires valid technical checks and current dual AI approval. It may be used by developers, authorised reviewers and synthetic test learners.

### 14.3 Controlled pilot catalogue

Requires controlled-development eligibility plus the configured pilot safeguards, named pilot cohort, monitoring, rollback capability and operator visibility. Content with `approved_with_observation` may be included when the observation is explicitly accepted for that pilot.

### 14.4 Public production catalogue

Requires:

- current AI Curriculum Lead approval;
- current AI SEND Lead approval;
- all technical and operational release gates;
- human safeguarding approval for the applicable experience;
- human listening approval for every required produced-audio asset;
- successful real-child pilot evidence under the approved protocol;
- no unresolved release-blocking incidents or findings.

The runtime must default closed: missing, stale, conflicting or unreadable evidence excludes content rather than falling back to authoring data.

## 15. Backend architecture and data flow

The backend is the source of truth for curriculum, versions, approvals, release snapshots, learner evidence and routing decisions. The web application renders backend-issued views and may cache immutable release artifacts, but must not contain a separate authoritative curriculum catalogue.

Core components are:

- curriculum and variant repository;
- source and rubric registry;
- deterministic review runner;
- Curriculum Lead review service;
- SEND Lead review service;
- append-only review evidence store;
- release eligibility evaluator;
- immutable catalogue snapshot publisher;
- learner evidence and subject-routing service;
- admin and reviewer APIs;
- audit and observability pipeline.

Data flow:

`authoring source -> canonical revision/hash -> deterministic checks -> risk assignment -> two AI review lanes -> eligibility evaluation -> immutable release snapshot -> learner runtime -> attempt evidence -> subject routing and reports`

Writes must be idempotent. A repeated review request for the same content hash, rubric revision, source-set revision and reviewer implementation returns the existing completed decision or resumes the same in-flight job. Snapshot publication uses a unique release ID and atomic activation so retries cannot create conflicting active catalogues.

Queries must be paginated and scoped. Reviewer queues use indexed status, lane, risk, year, subject, pack and updated-time fields. Learner and parent reporting endpoints return only required projections, aggregate evidence server-side and enforce tenant and relationship boundaries.

## 16. Admin and operator experience

The admin route presents a simple sign-in screen before authentication. No platform data, navigation or bootstrap controls are exposed to unauthenticated users.

After sign-in, role-based navigation separates:

- Overview and operational health;
- Schools, staff, groups and learners;
- Parents and learner relationships;
- Curriculum packs, objectives and variants;
- Curriculum review and SEND review queues;
- Audio production and listening review;
- Pilot readiness and release management;
- Progress, assessment and intervention evidence;
- Rewards, worlds, activities and feature flags;
- Audit, incidents and system configuration.

List views are paginated, filterable and searchable. Editors provide full authorised CRUD operations with validation, version history, optimistic-concurrency protection and audit records. Destructive or release-affecting actions require confirmation and an explicit reason. Review pages show the exact content revision, rendered learner view, sources, rubric findings and comparison with the prior revision.

## 17. Learner, parent and educator experience

### Learner

- A clear child-safe entry and profile route.
- A predictable loop of warm-up retrieval, teaching, guided play, independent mission, feedback and celebration.
- Age-adjusted visual identity across Years 1-7 without making older learners feel infantilised.
- Meaningful worlds, collections, quests and unlocks tied to effort, strategy and mastery.
- SEND preferences applied consistently without labelling the child publicly.
- Subject-specific routing, cross-year stretch and spaced retrieval.

### Parent

- Current working level by subject and strand, not a single misleading overall year.
- Evidence-based strengths, practice priorities, recent learning and retention trends.
- Plain-language explanations of confidence and why the next activity was selected.
- Appropriate controls for home practice and mock assessments without altering formal mastery evidence.

### School or tutor

- Cohort and learner views with tenant-scoped filters.
- Assignments, mock assessments and intervention tools.
- Objective-level evidence, misconceptions, adaptations used and progression recommendations.
- Clear distinction between assigned year, current working level and content being retrieved.

### Platform administrator

- Cross-tenant visibility only under authorised support or operational roles.
- Search by learner ID and linked parent or school with audited access.
- Catalogue, review, release, audio, pilot and incident controls.
- No ability to silently edit historical evidence or bypass mandatory public-release gates.

## 18. Gamification principles

Gamification is a learning system, not decoration. Every pack must define:

- a motivating mission fantasy appropriate to the year group;
- an observable learning goal within the mission;
- short feedback cycles and useful consequences;
- earned progress based on effort, strategy, practice and demonstrated learning;
- collection or world progression that remains understandable across modules;
- optional cooperative or personal-goal mechanics without public ranking;
- low-sensory, reduced-motion and audio-control equivalents;
- recovery after error without lost streak pressure or punitive lockout;
- age progression from playful discovery in early years to autonomy, challenge and sophisticated narrative in Years 5-7.

Rewards must never imply mastery unsupported by evidence. Cosmetic rewards and narrative unlocks may celebrate participation, while mastery badges require the defined independent and retained evidence.

## 19. Audio policy

Narration scripts are reviewed as content in both AI lanes. Generated files then pass technical validation for existence, duration, encoding, loudness range, clipping and transcript association.

Human listening approval remains mandatory before public release of required audio. Listening review records asset hash, voice/provider metadata, reviewer, pronunciation and pacing findings, accessibility concerns and decision. Regeneration changes the hash and invalidates listening approval.

Younger-year narration targets a slightly slower, warm and natural delivery. Speed changes must be made at production or voice-setting level and then listened to; browser playback-rate adjustment alone is not final audio QA.

Provider credentials remain secret environment configuration and must never be committed, logged, embedded in public assets or stored in review evidence. Produced assets and reproducible metadata remain usable according to the provider's licence after credential rotation or subscription cancellation.

## 20. Failure and escalation behaviour

- Unavailable review services leave content unreviewed; they do not approve by timeout.
- Conflicting lane evidence blocks release and opens an incident.
- Low confidence on a safety-, correctness- or accessibility-critical finding produces `escalation_required`.
- Content-generation failures retain the last valid immutable release snapshot.
- Snapshot activation failure rolls back atomically to the prior active release.
- Runtime catalogue errors fail closed and emit an operator alert without exposing internal details to a child.
- Learner routing never advances solely from one anomalous response or from unvalidated mock-assessment data.
- Administrative overrides are time-bound where appropriate, reasoned and audited; they cannot satisfy human safeguarding, listening or child-pilot gates.

## 21. Testing and verification

The implementation requires:

- unit tests for hashing, staleness, status transitions, risk scoring and eligibility rules;
- contract tests for review evidence and release APIs;
- property and boundary tests for generated variant families;
- curriculum fixture tests for progression, accepted answers and misconception handling;
- accessibility tests for alternate response modes and rendering;
- idempotency and concurrency tests for review jobs and release activation;
- tenant-isolation and role-authorization tests across pupil, parent, educator and administrator personas;
- pagination and query-plan checks for large review and learner-evidence datasets;
- end-to-end tests for all four persona journeys;
- visual tests with deterministic data, fonts, animation state and environment controls;
- audio manifest and technical-integrity tests;
- release-gate tests proving that absent or stale evidence fails closed;
- browser testing in Playwright Chromium, with focused Chrome inspection when an existing signed-in browser state is required.

Automated tests demonstrate software behaviour. They do not replace human audio listening, safeguarding review or real-child pilot evidence.

## 22. Rollout and remaining-build decomposition

Work proceeds in coherent local batches, with verification before commits:

1. **Approval foundation:** schema, migrations, hashes, source registry, rubrics, statuses, stale rules and audit events.
2. **Review engine:** deterministic checks, risk assignment, two review lanes, revision workflow and reproducible reports.
3. **Release integration:** controlled-development, pilot and public eligibility; immutable snapshots; closed runtime behaviour.
4. **Admin review operations:** authenticated shell, role navigation, paginated queues, editors, evidence views, bulk queueing and release controls.
5. **Curriculum execution:** run review across all 87 packs and 20,210 variants; revise failures at source; repeat until every item has a current decision.
6. **Learner experience:** complete the warm-up-to-mission loop, coherent worlds, subject identity, responsive behaviour and age progression across Years 1-7.
7. **Progress and assessment:** subject-independent advancement, spaced retrieval, mock assessment, parent reporting and educator intervention evidence.
8. **SEND and accessibility:** validate adaptations end-to-end across every renderer and persona, including keyboard, reduced-motion, low-sensory and narration routes.
9. **Audio completion:** produce missing or changed narration, run technical validation and expose the listening workflow for human decisions.
10. **Production hardening:** performance, observability, incident handling, security, data isolation, browser journeys, safeguarding evidence and controlled child pilot.

Computing, History, French and Spanish remain documented future phases and begin only after the MVP release standard is met or the product owner explicitly changes priority.

## 23. Acceptance criteria

The design is implemented when:

- every one of the 87 packs has current AI Curriculum Lead and AI SEND Lead evidence;
- every one of the 20,210 variants has deterministic evidence and the semantic evidence required by its recorded risk tier;
- every released revision has a reproducible content hash, rubric revision and source-set revision;
- changed content automatically loses prior release eligibility until re-reviewed;
- no interface represents AI approval as human professional approval;
- controlled catalogues contain only technically valid, dual-AI-approved content;
- public production cannot activate without human safeguarding, applicable human audio listening and real-child pilot evidence;
- all four persona journeys pass authorization, usability, accessibility and end-to-end tests;
- subject progression can advance independently and includes evidence-based spaced retrieval;
- the admin system is authenticated, role-organised, paginated, auditable and supports the required lifecycle operations;
- generated reports reconcile exactly with backend release state;
- the repository's required quality, build, performance and Playwright gates pass from a clean checkout.

## 24. Decision summary

NexusLearn will replace the existing ambiguity around educational approval with two explicit AI-owned lanes. Dual AI approval is sufficient for controlled development and pilot catalogue eligibility when technical and pilot controls also pass. It is not a substitute for human safeguarding, human listening of required produced audio or evidence from a real-child pilot before public production.

This model provides complete review coverage, honest claims, reproducible evidence, backend-driven release control and a scalable path for future curriculum subjects and human advisory review.
