# Progress Measurement and Parent Reporting Specification

Status: active product requirement
Scope: Years 1-7 English, Mathematics and Science MVP

## Product promise

A learner's school year is a starting point, not a ceiling. NexusLearn must
show what has actually been sampled, what is becoming secure, what needs more
practice and where a learner is ready for a carefully governed stretch into
the next year's curriculum.

The report must be useful to a parent or teacher without requiring knowledge of
the adaptive engine. It should answer:

- What did the learner work on recently?
- Which subject, strand or topic is becoming secure?
- Which sampled topics need another supported route?
- Which topics have not been sampled yet?
- Is the learner broadly on the current-year route, or is a next-year stretch
  available in addition to spaced review?
- What should the adult do next?

## Evidence model

The backend is the source of truth. A progress signal may use:

- correctness and mastery score;
- independent correctness and hint use;
- evidence count and response-format variety;
- confidence signal;
- retention-review success;
- evidence freshness;
- teacher evidence and active intervention context.

The report must not claim mastery from one correct answer. Current stretch
eligibility requires, per active current-year subject:

1. At least the smaller of two current-year objectives to have secure evidence.
2. Each secure objective to meet its configured secure threshold.
3. At least three evidence points and two response formats.
4. Evidence confidence to be supported or strong.
5. Evidence not to be stale.

This is a stretch gate, not a permanent year-group promotion. Spaced reviews,
teacher assignments and interventions continue to take priority when due.

## Status semantics

Use these labels consistently:

- `Not sampled`: no trustworthy evidence has been collected yet. This is never
  a deficit or a failure.
- `Needs practice`: sampled evidence is below the configured expected threshold.
- `On track`: sampled evidence meets the expected threshold but is not yet
  secure across the required evidence pattern.
- `Secure`: evidence meets the configured secure threshold and confidence gate.
- `Ahead`: evidence has been collected for a year above the learner's recorded
  year and meets the expected threshold. This means “ready to explore more,” not
  “the child has been permanently reclassified.”

The UI may show a rounded evidence signal for orientation, but the status and
sample counts are more important than a pseudo-precise percentage.

## Report contract

`GET /v1/students/{studentId}/progress` is pupil-session protected and returns:

- recorded year group;
- current working year;
- next stretch year when eligible;
- stretch eligibility and plain-English summary;
- subject reports with current-year status and sampled counts;
- subject-by-year rows for the Years 1-7 ladder;
- strengths and practice topics with subject, year, strand and topic context.

The authenticated parent-child evidence response includes the same `progress`
object after the parent-child link has been authorised. Parents only see linked
children.

## Parent and teacher experience

The report should lead with meaning, not internal telemetry:

- “Sam is secure with…”
- “Next practice: …”
- “Year 4 stretch is open in addition to spaced review.”
- “We have not sampled this topic yet.”

Avoid:

- “AI predicts ability.”
- “Failed objective.”
- ranking children against each other;
- speed-based labels;
- exposing SEND declarations as a deficit score;
- treating reduced motion, audio, AAC, switch, extra time or partner input as
  lower-quality evidence.

## SEND and inclusion rules

Support changes the route, not the standard. A learner can demonstrate the same
objective through an accessible response mode. Replay, chunking, visual guides,
AAC, switch access, partner pointing, additional processing time and reduced
sensory load must not reduce the evidence value of a correct response.

The report should show the support context when helpful, but never disclose a
diagnostic label more widely than the authorised parent, school or safeguarding
workflow permits.

## Acceptance criteria

The feature is complete when:

- all three MVP subjects can appear in the report;
- each subject can show multiple year rows with sampled and unsampled states;
- a Year 3 learner with secure, varied, recent evidence across English,
  Mathematics and Science receives a Year 4 stretch route;
- one weak subject keeps the learner on the Year 3 core route;
- due reviews, teacher assignments and active interventions still override the
  stretch choice;
- unsampled objectives never appear in the practice list as failures;
- parent access is limited to linked children;
- the API, parent UI and adaptive engine use the same gate;
- the report is understandable on mobile and works with reduced motion,
  keyboard access, high contrast and screen readers.
