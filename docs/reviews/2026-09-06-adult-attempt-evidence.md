# Adult grading-evidence reporting

Follow-on to canonical grading plan steps 5 and 8. This batch exposes existing persisted learning evidence in authenticated adult reports; it does not change grading, promote curriculum, generate audio or certify educational/SEND review.

## Contract and scope

- Parent child-evidence, school/tutor learner-progress and platform-admin learner-progress responses include a bounded recent-attempt projection after their existing role and learner-scope checks. These responses use `Cache-Control: private, no-store`.
- The learner's progress and recent-attempt endpoints do not include this adult projection. Content reviewers/editors do not acquire platform-admin reporting rights.
- One database query selects the most recent 10 ordinary learning attempts (repository ceiling 50), ordered by timestamp then immutable attempt ID. The query is supported by the existing student/timestamp index and version primary-key join, without an entire question-bank load or per-attempt application query.
- Question prompt comes only from the persisted grading-version snapshot, never the current question. Keys, private body fields and the full snapshot are not selected into the response.
- Evidence includes attempt/objective/question IDs, question version, recorded normalized answer, outcome, hint use, response mode/format, actual saved mastery-score delta, saved feedback and timestamp. Historical unversioned attempts remain explicitly unversioned, with no reconstructed prompt.
- Mock attempts are excluded; their existing subject-check reporting remains separate from ordinary learning/mastery evidence.

## Adult interface

One shared keyboard-operable disclosure panel is integrated in Family, Parents, School/Tutor and Platform Admin. It explains that a correct answer is not a mastery judgement, that score changes are individual evidence contributions, and that support methods are not diagnoses or measures of effort. Long answer strings and version IDs wrap on mobile.

The panel is not imported into the pupil's shared progress component. Where the backend supplies no evidence rows (or an older backend lacks the extension), existing progress remains usable without inventing an evidence history.

## Evidence and limitations

- Test-first PostgreSQL regression: edits/withdrawal of the live question cannot rewrite the reported prompt; decimal answer retained; another pupil cannot supply rows; missing learner returns no rows; historical provenance not invented; mocks excluded; limits bounded; equal timestamps stable.
- Test-first HTTP regressions: authenticated parent/school/admin receive the projection; unlinked family and outside-school requests fail before evidence reads; anonymous access fails; database errors fail the report rather than return misleading partial success; pupil progress does not read/expose adult evidence.
- Playwright exercises actual adult pages with controlled API fixtures, including keyboard disclosure, older records, signed score changes and axe checks. The first new parent fixture omitted required SEND presentation fields and was corrected; its initial error-boundary failure was not a product regression.
- A delayed-response test reproduced old learner evidence reappearing after pupil selection changed in both school and admin workspaces. Request invalidation now prevents obsolete responses from updating reports after selection changes, admin section changes and workspace reset/sign-out. Parent child-selection already has effect cancellation.
- The real API/PostgreSQL browser harness follows a decimal answer through lost-acknowledgement recovery into a named, authenticated administrator session and asserts one evidence record, matching question version, answer and score delta. All identities exist only inside the disposable schema.
- Local acceptance: full Go suite with disposable PostgreSQL, Go vet/build, TypeScript, touched-file lint, 28 desktop/mobile role-and-evidence browser cases (2.1 minutes), and six public-boundary/performance gate tests passed. The real API browser rerun passed both devices (7.2s/6.9s); an initial mobile run stalled before the attempt reached the route interceptor and retained its trace in `.agent/adult-evidence-mobile-pending-request.zip`. No assertions or timeouts were relaxed to obtain the passing rerun.
- Production build passed. Aggregate JS 1,404,543 bytes remains below the unchanged 1,405,000 ceiling; maximum route 678,675 bytes, maximum public asset 275,314 bytes. Hosted release outcomes are recorded in the delivery checkpoint after verification.
- One bounded read-only reviewer found no P1/P2 issue in the initial batch and was closed. The subsequently reproduced learner-switch race was fixed and verified with browser regressions.

Remaining: this is a latest-10 evidence preview, not a paginated all-time audit/export. Existing stored answers are normalized marking evidence, not verbatim text, pen strokes, spoken audio or raw typed-response envelopes. The version identifies the frozen question contract, not a separately versioned grader algorithm. Richer authored marking policy, retirement of legacy submissions, authentic tracing evidence and independent human educational/SEND/safeguarding/listening/pilot gates remain separate work.

## Identity-isolation follow-up

Post-push boundary inspection found a pre-existing mismatch: PostgreSQL stores case-sensitive external learner references, but six authorization/login/school-resolution comparisons used case-insensitive matching. Regression tests reproduced cross-identity report authorization, a pupil token authorizing another case-only reference, and an uppercase pupil credential selecting the lowercase pupil profile. These comparisons now use exact learner IDs, consistently with database reads. Login-code normalization is unchanged. Existing records are not renamed or merged; callers must use the issued learner reference exactly. The parent, school/teacher and pupil scope tests include case-only conflicts, plus legitimate distinct-identity login and school-resolution checks.

Follow-up verification: the full Go suite passed with disposable PostgreSQL and the real browser grading/admin-evidence harness enabled (`learning` 99.577s; `server` 101.300s). Go vet/build and formatting passed. The preceding reporting commit `ed1e670` also passed hosted Platform quality (170 browser cases plus two real-backend browser journeys), Content quality, Deployment smoke and Vercel. Follow-up hosted status is recorded separately in the FS checkpoint.
