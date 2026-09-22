# Hosted first-use, retrieval timing and audio availability

## Scope and evidence boundary

Fresh hosted observations on main `b8937ed15f58c40d7c358e847d4695becb983845`,
22 September 2026. Both public version endpoints matched before the walkthrough.
The in-app browser failed the Windows sandbox helper; the previously authorised
Playwright fallback captured the live UI and fresh accessibility-tree snapshots.
This audit used one newly created synthetic family and child, not real pupil data.

The audit covered parent signup, first-child setup, support preferences, the
pupil login card, Today, mission entry, parent evidence, mock-generation failure
and parent sign-out. It is **not** hosted four-role acceptance or a completed
learning/marking journey. A test platform-admin login is still needed for the
hosted school/admin walkthrough. The audit harness deliberately blocked learning
event POSTs; those blocks are harness limitations, not service failures. No answer
was submitted, no learning evidence was fabricated and no review gate was waived.

Fresh captures and redacted snapshots are in the private local
`apps/web/.agent/hosted-family-20260922-6c6f8d65/` directory. Login-card captures are
private credentials and must not be published. The synthetic account/child
cleanup references are in that directory's manifest; the parent session was
revoked through Sign out (HTTP 200), and the browser was closed. The records
remain for authorised test-data cleanup.

## Numbered walkthrough

| Step | Observed health | Evidence and finding |
| --- | --- | --- |
| 1. Parent entry and signup | Working in this case | Captures 01/04; signup 201, authenticated config 200, usable empty-family state. |
| 2. Add Year 1 child and supports | Working in this case | Captures 10/11; child write and scoped evidence 200. Selected reduced motion and read-aloud preference. |
| 3. Card to pupil Today | Working, with misleading audio wording | Capture 16; picture login and scoped reads 200. Calm movement is reflected, but `Audio replay` is presented without proof of an available recording. |
| 4. First mission entry | Limited | Capture 18; mission 200. Sound-blending playback controls are disabled, while `Audio-first` promises replay. No hosted marking/completion was attempted. |
| 5. Return to parent evidence | Incorrect recommendation wording | Capture 10 showed zero attempts but claimed this learning was due for spaced retrieval. |
| 6. Parent Year 1 Mathematics mock | Correctly blocked by content, poor readiness | Capture 23; API 422: fewer than five runtime-approved questions for the selected scope. No mock was created. |
| 7. Responsive and accessibility sampling | No issues in the sampled automated scans | Mission at 1280px and family at 320px: no Axe violations in the selected WCAG A/AA tags, no horizontal overflow. This is not full assistive-technology or WCAG certification. |
| 8. Sign out | Working in this case | Captures 25/26; parent revocation 200 and private family UI removed. |

## Current hosted content boundary

The live `/v1/curriculum/release-status` reports `legacy_seed`, with **17 runtime
objectives**. `/v1/curriculum/map` independently agrees. This is distinct from the
87 authored packs and their variant inventories in the repository.

| Year | Live objective count | Subjects represented in this seed catalogue |
| --- | ---: | --- |
| 1 | 3 | English, Mathematics |
| 2 | 2 | English, Mathematics |
| 3 | 2 | Mathematics, Science |
| 4 | 4 | English, Mathematics, Science |
| 5 | 2 | English, Mathematics |
| 6 | 2 | English, Mathematics |
| 7 | 2 | Mathematics, Science |

These counts are not curriculum completion or coverage percentages. The hosted
service is suitable for controlled development checks, not a claim of complete
Years 1–7 teaching. Authored catalogue promotion and listening/release readiness
remain a separate workstream; bypassing its gates is not a usability fix.

## Root causes and implemented correction

- `WarmUpItems` selected queue entries up to 30 days in the future and substituted
  globally configured questions when there were no learner review rows.
  `chooseAdaptiveActivity` treated those results as due spaced review, ahead of
  normal teaching and assignments. The query now selects only genuinely due,
  pending, learner-owned reviews with an eligible activity/question in the
  current live release (or the existing legacy catalogue when no release is
  applied). The global fallback is removed, eligibility is checked before the
  limit, and ties have deterministic ordering. The scheduler also rejects
  absent, malformed, zero or future due timestamps. No-due learners follow the
  normal learning/diagnostic route; earlier-year due reviews remain valid.
- The mission UI confused the existence of a script/asset reference with a
  resolved recording. It linked to audio panels belonging to hidden steps and
  rendered a no-op replay button after answers with only a script or pending
  asset. Controls now derive from the visible step's resolved audio URL, including
  a real feedback replay target. Unavailable text/visual alternatives stay
  honest, and the stricter required-listening gate is preserved. Today describes
  a listening preference, not promised playback before the mission has loaded.

## Validation log

- UI RED: all six new desktop regressions fail on the original production build
  for the expected support-wording, contradictory narration, hidden-step link and
  Today-label failures. Traces retained in
  `apps/web/.agent/listening-availability-red-20260922/`.
- UI GREEN: all 12 new desktop/mobile cases pass against a fresh production build
  (one worker, no retries). Whole web-tool unit suite: 103/103 passed. Full lint,
  content validation and final TypeScript/production compilation passed. The
  initial compile found one missed helper argument; it was corrected before the
  successful build and browser run.
- Unchanged performance gate passes: aggregate JS 1,429,262 / 1,430,000 bytes;
  largest route 696,581 / 750,000; largest public asset 275,314 / 600,000. Headroom
  remains tight, and no threshold or snapshot baseline was relaxed.
- Backend RED/GREEN regressions use real PostgreSQL in disposable schemas:
  empty, foreign, future, completed, unavailable and non-current-release rows;
  priority/tie ordering and bounded limits; zero-attempt parent evidence; the
  first real attempt's future review; earlier-year retrieval after progression;
  and diagnostic precedence. The full Go test suite, vet and build pass. Main
  independently reran the focused database/server regressions successfully.
- Full local browser run, production build, one worker and no retries:
  **693 passed, 12 opt-in backend cases skipped, 1 failed**. The failed Windows
  desktop renderer snapshot expected 588x1197 pixels and received 588x1198.
  Both images were visually inspected: controls and text remain present, with
  different font rendering and a one-pixel vertical displacement. This is not a
  local all-green claim, and the exact-source Linux/container check is still
  required. No screenshot crop, baseline or tolerance was changed to hide it.
- Separate authenticated real-API/PostgreSQL browser harnesses passed all six
  canonical-grading cases and all six first-use role cases (desktop/mobile,
  one worker, no retries). This covers real grading/idempotency, family/pupil
  setup, school class/group/support management and protected admin navigation
  in disposable local schemas; it is not substituted for hosted role acceptance.
- One independent read-only reviewer examined all 11 authored paths and related
  routing/audio contracts and found no actionable introduced regression. This
  is source review, not independent listening or hosted validation.
- Commit-specific GitHub/container checks and exact hosted versions must still
  pass after pushing. Their results belong in the release checkpoint, without
  another source commit just to record the preceding revision's deployment.

## Remaining acceptance work

Hosted school/admin sign-in and operations; governed catalogue promotion;
listening and pace review; complete real-backend pupil learning and adult-report
walkthroughs; independent child/SEND/assistive-technology and safeguarding/pilot
evidence. Existing recordings remain ElevenLabs assets: these changes neither
generate new audio nor approve old recordings.
