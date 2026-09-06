# Versioned submissions and authored review gates

## Scope

Follow-on to the canonical grading plan, based on main `f2819a7`. No curriculum promotion, human approval, audio regeneration, or real learner-data changes.

- New answers require the served `question_version` and typed `response` envelope. Missing/stale versions return 409; a current version without typed evidence returns 422. Existing pupil practice and mock routes already share this submission path.
- Removed legacy numeric/text grading and its custom numeric-presence decoder. Exported request fields, JSON ordering, and idempotency hashing remain unchanged for pre-upgrade retries. Legacy client-supplied expected values remain untrusted.
- Completed actor-scoped idempotent requests are still replayed **before** canonical lookup and new-submission validation, including after content withdrawal. Changed payloads remain conflicts. No historical evidence is regraded or relabelled.
- `accepted_semantic_equivalents` is an explicit review gate, like a rubric. An exact match with the example does not waive required judgement; other unsupported semantic-policy shapes also fail closed. This does not implement semantic grading or a review-submission inbox.
- `/v1/version` advertises `attempt_submission_contract: typed-versioned-v1`, separately from the existing canonical-grading and pupil-projection capability markers.
- The pupil UI handles `response_kind: review` before showing answer controls: it explains that teacher review is needed and offers a keyboard-accessible route back to worlds. An encounter after an earlier saved answer does not complete the mission, submit the review question or log it as a seen question. This boundary is not a teacher-marking inbox and does not discard earlier saved answers.

## Authored-policy inventory

Read-only traversal of all 87 JSON pack files found **20,210 unique question IDs** with a format and structured expected answer. Embedded lesson prose is excluded; these are authored records, not a statement of runtime approval or full curriculum coverage.

| Marking metadata | Records | Interpretation / remaining work |
| --- | ---: | --- |
| `accepted_semantic_equivalents` | 86 | All contain `teacher_review_required`, all currently `review`; none also had a rubric/moderation flag. New gate protects eventual runtime admission. |
| `rubric` | 117 | Existing review gate retained; no fabricated tracing/written-response mastery. |
| `moderation_required` | 43 | Existing moderation gate retained. |
| `acceptable_spoken_without_punctuation` | 47 | Spoken alternative must remain modality-specific; do not erase punctuation requirements globally. |
| `accepted_spans` | 1 | Explicit selected-span alternatives need a defined renderer/marking contract. |
| `accept` | 2 | Authored spoken/explanatory examples accompany numeric answers; not interchangeable JSON response types. |
| `unit` | 336 | Units occur with numeric values and tool-choice strings; metadata presence alone does not define unit conversion or tolerance. |

This inventory found no justification for blanket fuzzy matching. Next policy work needs explicit type/modality rules, validation, preserved raw evidence and grader-policy provenance before expanding automatic marking.

## Verification

- Test-first unit and PostgreSQL regressions reproduced legacy submissions earning mastery before the fix.
- New-submission rejection checks assert no attempt, mastery history/current mastery, revision queue, or consumed idempotency key. Historical acknowledgements are seeded as pre-upgrade records, decoded through JSON, replayed after withdrawal, and rejected on conflicting payloads.
- Existing forged-key, decimal, sequence/mapping, concurrent retry, immutable snapshot, rollback, release-boundary and closed-mock replay tests now exercise the served typed/versioned path.
- Test-first semantic-review cases reproduced both false automatic acceptance and automatic rejection; a real database case checks no automatic evidence or consumed key.
- Real-backend desktop/mobile Playwright adds authenticated 409/422 checks before completing a typed decimal answer, a lost-acknowledgement retry, and authenticated adult evidence inspection. The Go harness asserts exactly one saved answer and six mastery points per disposable learner.
- Additional desktop/mobile test-first pupil checks reproduce both the missing review boundary and false `question_seen` telemetry; first-question and mid-mission review cases exercise the actual UI and submission/event requests.
- A bounded UI review found two accessibility gaps in the initial boundary: switch scanning had no exit target, and mid-mission focus was lost. Both were reproduced on desktop/mobile before adding the scan region and labelled focus handoff. Dedicated tests use Space-only activation and natural Tab/Enter navigation, not imperative focus, for these paths. The review screen also receives an automated WCAG accessibility check.
- Full test/build/review and hosted results are recorded in the FS V2B release checkpoint after verification; this document alone is not a deployment-success claim.

## Deployment and limits

Deploy the existing typed/versioned pupil client before or alongside this API. Old open tabs with genuinely unsaved legacy answers must reopen the mission; they must not be silently graded against unseen content. Completed retries continue to work. No schema migration is needed.

Backend commit `7866c9d` passed Platform quality `34047332850` (170 browser tests plus 2 real API/database tests), Content quality `34047332997`, Deployment smoke `34047593917` and Vercel. The live Render version endpoint advertised `typed-versioned-v1`. These checks predate the pupil boundary follow-on; its separate verification is in the release checkpoint.

Outstanding: explicit alternatives/unit/tolerance/case policies, richer subject-specific feedback, raw/verbatim evidence, grader-policy versioning, paginated full-history audit, authentic tracing evidence, and independent educational/SEND/safeguarding/audio-listening/pilot review. The latest-ten adult evidence panel remains a bounded preview, not full history. This batch does not certify the entire curriculum or games as complete.
