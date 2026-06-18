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
- Audio-blend sound controls are playable through the browser speech layer
  while produced phoneme audio remains an asset-production requirement.
- Trace interactions now capture pointer movement and retain a keyboard
  alternative.
- Particle simulations include a manipulable energy control.
- Child confidence selection is covered by browser tests.
- The mission uses age-specific world rewards rather than a universal Year 4
  hatch outcome.
- World state accumulates attempts and earned artefacts rather than replacing
  all progress with the latest event.
- Desktop and mobile SEND-aware mission journeys are covered by Playwright.

## Remaining required gates

### SEND execution

- Produced narration and phoneme audio.
- Verified reading-reduction and visual-communication variants.
- Switch-access and alternative motor-response testing.
- Screen-reader and keyboard acceptance for every released renderer.
- Child-controlled breaks, response-mode selection, and visual schedules.
- User testing with children representing varied support needs.

### Learning engine

- Teacher assignments and intervention priority.
- Explicit lesson/step attempt persistence.
- Evidence confidence based on recency, independence, format diversity, and
  delayed retention.
- Multiple contrasting repair items before misconception closure.
- Baselines and diagnostic routes.
- Teacher moderation and manual evidence.

### Flagship interactions

- Production-quality Year 1 phonics blending and word building.
- Production-quality Year 4 arrays connected to area transfer.
- Production-quality Year 7 particle prediction, manipulation, explanation,
  and retrieval.
- Produced world art, companion states, audio, and low-sensory alternatives.

### Quality gates

- Automated WCAG checks, screen-reader scripts, and focus-order tests.
- Visual regression for standard, calm, and high-contrast modes.
- Chromebook performance and memory budgets.
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
