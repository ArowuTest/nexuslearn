# Task-relevant repair guidance and definite rejection recovery

## Delivered behaviour

Incorrect ordinary learning attempts now receive a next step based on the canonical question format: sounds/blending, sentence order, textual evidence, coordinates, equal parts, experimental variables, sorting or sequences. Numerical activities get step-by-step guidance without speed pressure; unrecognised task formats receive a neutral question-checking fallback.

The guidance does not reveal the answer key, open an authored hint automatically, label the pupil, infer a diagnosis/misconception, or pretend a wrong answer was nearly correct. It is a task-level repair prompt, not a complete objective-specific explanation or approval of every curriculum variant.

Question repair guidance takes precedence over reward-rule `feedback`, `explanation` and `companion_prompt` for incorrect nonmock attempts. Reward rules continue to control animation/reward/event hooks. Correct-answer configured messages remain unchanged. Generic scoring fallback text no longer assumes arithmetic recall; the existing fallback animation hook is retained. Numeric scoring, confidence/hint handling, spaced review and SEND runtime settings are unchanged.

The exact explanation returned is persisted with the attempt and shown in scoped adult evidence. Completed idempotent retries retain the saved response, including after the question is withdrawn. Mocks retain their separate assessment feedback and do not enter the repair override. Review-only formats still fail closed before grading; no curriculum or human review gates are promoted.

Definitive HTTP 413 responses now use the existing rejected-answer recovery instead of trapping a pupil in an uncertain retry. HTML or JSON-null rejection bodies also show a safe fallback and a route out. A lost acknowledgement remains uncertain and keeps its identical retry payload.

`GET /v1/version` advertises `feedback_contract: task-repair-v1`; deployment smoke requires it in addition to the submitted-evidence contract. A healthy old API alone is not deployment proof.

## Verification record

Task-feedback PostgreSQL tests first reproduced generic reward messages replacing learning guidance. They now cover English, Mathematics, Science, neutral fallback, game-hook preservation, saved adult explanation and replay after withdrawal. Pure tests cover all guidance branches and unchanged nontext result fields/correct results.

The oversized/null-body browser regressions reproduced the uncertain-retry trap before correction. One bounded reviewer identified the null-body exception and an out-of-scope fallback animation change; both were addressed. The reviewer was closed after the review.

Final local acceptance: full Go tests with disposable PostgreSQL, vet/build, production frontend build, TypeScript and touched-file ESLint passed. **48** production-build desktop/mobile tests passed (2.0 minutes), covering mission integrity, scoped adult evidence/axe and switch-access boundaries. **4** real authenticated PostgreSQL-backed browser tests passed (19.1 seconds), covering decimal retry and English repair/replay. Aggregate JavaScript is **1,403,955 / 1,405,000 bytes**; largest route is **678,196 / 750,000 bytes**. No visual baselines or performance thresholds were relaxed. Hosted identifiers are recorded separately in the FS V2B checkpoint after verification.

## Remaining boundaries

- Authored objective-specific feedback, semantic alternatives, units and tolerance policies still require explicit schema/policy work; task guidance is not a substitute.
- Correct-answer reward messages are still administrator-configurable and must be reviewed for educational accuracy.
- Full-history reporting, reward/mastery-policy versioning and authentic tracing/review submissions remain open.
- ElevenLabs files, listening sign-off, educational/safeguarding approval and curriculum release status were not changed.
