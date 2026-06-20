# Phase 3.7: Learning Foundation and SEND Truth

Status: active
Started: 18 June 2026

## Purpose

Phase 3A established identity, persistence, configuration, content governance,
and deployment foundations. Phase 3.7 closes the gap between that platform and
the child learning experience before curriculum production is scaled.

The governing rule is product truth: planned item volume, renderer names, SEND
flags, and configured teaching steps do not count as delivered capability until
the child runtime executes them and automated tests verify them.

## Completed in the first corrective slice

- Content promoted to pilot or release is blocked unless:
  - actual authored variant volume reaches the pack's pilot target;
  - curriculum, teacher, accessibility, and safeguarding reviews are complete;
  - pack status and release channel agree.
- CI now treats warnings as failures for promoted packs while allowing honest
  authoring proof packs to remain visibly incomplete.
- Content release reporting separates actual variants from blueprint-planned
  volume and reports review states.
- New learner/objective mastery starts at `Unknown` rather than an invented
  score of 50.
- Response speed no longer changes mastery evidence.
- Confidence is optional and supplied by the child; it is no longer inferred
  from hint use.
- Review scheduling uses each objective's configured retention schedule.
- Mastery changes are recorded in durable history.
- Misconceptions have explicit confirmed, repairing, repaired, and reopened
  states; a generic correct answer is no longer reported as a repair.
- Runtime selection now prioritises due retrieval, recent errors,
  prerequisite gaps, and lowest-evidence available objectives.
- Missing learner records are no longer silently created as Year 4 pupils when
  attempts or sessions are recorded.
- Authored teaching sequences now run before practice in the mission.
- Step-by-step support and read-aloud controls are visible runtime behaviours.
- Audio-blend and teaching narration no longer fall back to browser speech.
  Child-facing voice controls play only produced audio assets; phonics shows an
  honest preparation state until SSP-reviewed phoneme recordings are attached.
- The Alice UK teaching-voice batch now contains 249 technically validated
  MP3 assets: 174 lesson lines and 75 vocabulary lines across all 29 objective
  packs. A generated listening-review page keeps batch approval separate from
  automated format checks; pure phonemes remain excluded for SSP review.
- Trace interactions now capture pointer movement and retain a keyboard
  alternative.
- Particle simulations include a manipulable energy control.
- Child confidence selection is covered by browser tests.
- The mission uses age-specific world rewards rather than a universal Year 4
  hatch outcome.
- World state accumulates attempts and earned artefacts rather than replacing
  all progress with the latest event.
- Desktop and mobile SEND-aware mission journeys are covered by Playwright.
- Lesson steps now create durable evidence containing step identity, duration,
  completion state, and the supports used by the learner.
- The child runtime exposes a predictable Learn, Practise, Finish schedule,
  quiet pause dialog, and focus mode.
- Word building is a tile-construction interaction rather than a generic
  multiple-choice alias.
- Array building exposes keyboard/touch-accessible row and column controls and
  renders the constructed equal groups.
- Particle energy controls now report and visually select the resulting state.
- Teachers can assign an objective or specific activity to a pupil from the
  school workspace; active assignments enter the adaptive selector after due
  retrieval and complete automatically when expected mastery is reached.
- Automated axe checks now fail critical and serious WCAG regressions on the
  public entry and completed SEND-aware mission.
- Contrast failures found by the new accessibility gate were corrected.
- Mastery now reports evidence count, response-format diversity, independent
  correct evidence, delayed-retention success, and an evidence-confidence band.
- A score cannot be labelled `Secure` until the evidence-confidence band is
  strong and includes successful delayed retrieval.
- Evidence now decays by age rather than counting forever at full strength.
  Mastery exposes effective evidence, current/aging/stale freshness and the
  latest evidence timestamp; strong confidence requires current evidence.
- Attempt records now preserve the actual interaction format used by the child
  rather than collapsing evidence into text/numeric categories.
- Teachers can record moderated observations, work samples, conversations,
  assessments, and external evidence without silently changing automated
  mastery scores.
- Teachers and SENCOs can create intervention plans with an identified need,
  teaching strategy, priority, and review date.
- Active intervention plans take adaptive priority after due retrieval and
  before ordinary assignments; reaching expected mastery moves the plan into
  monitoring rather than declaring it complete.
- Misconceptions now require contrasting repair evidence: either two distinct
  questions across different response formats or three distinct questions in
  one available format. Repeating one memorised repair item cannot close the
  misconception.
- Intervention reassessment now creates a dated evidence record, requires a
  next review date for continued/monitoring plans and applies an auditable
  continue, monitor, complete or reopen transition.
- Parent and school views expose evidence sufficiency, teacher evidence counts,
  and active interventions.
- Mission question sets now balance mastery, target difficulty, format
  diversity, recent exposure and misconception repair instead of taking the
  first configured questions.
- Every selected question carries a plain-language selection reason and each
  mission exposes its assessment blueprint.
- Question views, audio replay, hints, pauses, exits, restarts and assessment
  completion are recorded as non-blocking learning events.
- Teachers can move intervention plans through active, monitoring, completed
  and reopened states.
- Variant-quality CI now checks duplicate IDs, duplicate prompt/answer
  signatures, required-format coverage and deterministic arithmetic answers.
- A production-depth queue now ranks the real reviewed-item gap to pilot rather
  than reporting success merely because an objective-pack file exists.
- The Year 4 multiplication flagship now contains 123 blueprint-linked review
  candidates across recall, array and inverse-division formats. They remain
  outside the child runtime until human review promotes them.
- The Year 1 phonics flagship now contains 300 tasks across a curated 100-word
  single-letter CVC set, spanning audio blending, middle-vowel listening and
  accessible word building.
- The two prematurely runtime-approved phonics proof items were returned to
  review because browser text-to-speech is not verified phoneme audio.
- Phonics tasks now carry phoneme IDs, produced-audio asset requirements, GPC
  progression metadata and a mandatory school-SSP mapping gate. Word-building
  prompts no longer reveal the target answer.
- The Year 7 particle flagship now contains 120 additional review candidates
  across model sorting, energy-change prediction and misconception
  explanations, with particle count and size invariants checked in CI.
- CI verifies that all three flagship banks exactly match their deterministic
  generators, preventing hand-edited bank drift.
- A per-item flagship review ledger records 549 internal review passes while
  keeping all 549 release-blocked until the independent evidence required by
  policy exists. Internal AI/product review is not represented as teacher or
  child-pilot approval.
- Diagnostic baselines are now durable learner records with an ordered,
  year-appropriate set of live objectives, per-objective attempt and correctness
  counts, response-format diversity, progress state and completion timestamps.
- First-login pupils with no mastery evidence automatically receive a balanced
  baseline across available English, mathematics and science objectives.
- The adaptive selector prioritises the next unfinished baseline objective and
  identifies the resulting mission as diagnostic all the way into the child
  runtime.
- Diagnostic missions are capped at three selected questions per objective.
  An objective advances after three diagnostic responses, or after two correct
  responses across two formats; completing the final objective closes the
  baseline.
- Baseline creation and retrieval are exposed through pupil-protected APIs, and
  a restart explicitly cancels the prior in-progress plan rather than silently
  overwriting its evidence.
- The child completion screen shows accessible baseline checkpoint progress and
  launches the next diagnostic mission directly, preserving assessment mode
  rather than sending the learner back through world selection.
- Children can switch between specialist activity controls and a
  keyboard-native answer route during a mission. The selected response mode is
  stored separately from curriculum interaction format so accessibility choice
  does not misrepresent the evidence representation.
- Platform CI now enforces production asset ceilings aligned to lower-powered
  school devices: total JavaScript, maximum chunk size, total CSS and maximum
  individual public asset.
- Released specialist controls now expose named screen-reader groups and model
  descriptions for sound blending, word building, arrays, sentence cards,
  answer choices and particle representations.
- Particle and sentence renderers now have dedicated desktop/mobile acceptance
  journeys covering keyboard operation, semantic model/card names and
  critical/serious WCAG regressions.
- Trace and word-building renderers now have dedicated acceptance for named
  tracing paths, keyboard completion, named tile groups and keyboard-only word
  construction.
- Numeric keypad and generic choice renderers now have dedicated acceptance for
  keyboard-only entry and selection, named answer groups and WCAG regressions.
- Array-building and audio-blend renderers now have dedicated acceptance for
  keyboard range operation, semantic array models and named sound replay
  controls on desktop and mobile.
- The mission now provides a child-controlled high-contrast mode and a global
  four-pixel keyboard focus ring, with desktop/mobile visual, keyboard and axe
  acceptance.
- A child-controlled Simple text mode removes secondary world description,
  metadata, evidence rationale and instructional jargon while retaining the
  task prompt, schedule, progress, companion support and answer controls.
- A child-controlled Switch access mode automatically scans the current task
  controls, accepts the highlighted choice with Space and exits with Escape.
  Desktop and mobile acceptance verifies single-key selection and WCAG checks.
- A child-controlled Visual guide adds an icon-supported look, act and send
  sequence while keeping the specialist activity visible. Desktop and mobile
  acceptance verifies the semantic steps and their WCAG presentation.

## Remaining required gates

### SEND execution

- Produced, human-listened narration and SSP-reviewed pure phoneme audio.
- Produced symbol-set variants and child validation beyond the current visual
  schedule, model labels, interaction supports and Visual guide.
- Switch-access coverage for specialist controls beyond the current choice,
  keypad, word-building, sentence, trace and particle interaction families.
- Screen-reader and keyboard acceptance for every released renderer.
- User testing with children representing varied support needs.

### Learning engine

- Pilot calibration of baseline breadth, item difficulty and progression
  thresholds using real child evidence.

### Flagship interactions

- Teacher-reviewed phoneme audio and calibration for the authored Year 1
  phonics bank.
- Production-quality Year 4 arrays connected to area transfer.
- Teacher-reviewed calibration and richer manipulation for the authored Year 7
  particle prediction and explanation bank.
- Produced world art, companion states, audio, and low-sensory alternatives.

### Quality gates

- Automated WCAG checks, screen-reader scripts, and focus-order tests.
- Extend high-contrast visual regression beyond the flagship mission to every
  released renderer.
- Runtime Chromebook interaction and memory profiling on representative school
  hardware.
- Database-backed end-to-end prerequisite, repair, review, and persistence
  journeys.
- Pilot evidence and item calibration before broad release.

## Exit criteria

Phase 3.7 is complete only when all three flagship slices:

1. teach before testing;
2. execute SEND adaptations rather than merely describing them;
3. select learning from evidence;
4. gather trustworthy mastery and misconception evidence;
5. persist meaningful world progress;
6. pass curriculum, teacher, accessibility, safeguarding, browser, and
   performance gates.
