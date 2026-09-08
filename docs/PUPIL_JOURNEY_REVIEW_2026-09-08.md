# Pupil learning route: implementation and review

Date: 2026-09-08
Scope: the authenticated child portal in the existing frontend MVP specification.
This is engineering evidence, not curriculum completeness, human SEND approval,
audio listening approval or pilot acceptance.

## Delivered behaviour

`Access card -> Today's route -> selected warm-up or mission -> saved discoveries -> refreshed route`

- `/play/today` uses the existing signed pupil session. A URL parameter cannot
  select a different pupil. Public world exploration remains at `/play`.
- The profile uses the stored display name and enrolled year, independently of
  the selected world's year. An indexed identity lookup replaces derived names;
  missing records and database failures have explicit unavailable responses.
- Login, the public child entry and the mission's exit/completion actions connect
  to the personal route. Switching cards removes the previous pupil view.
- The next-step API now supplies the selected published activity's title, pupil
  prompt and subject, using data already loaded by the selector. No extra query
  or front-end curriculum catalogue is needed for that preview.
- The three-stage rail reflects the actual backend decision: warm-up is active
  only for a due review. The UI does not invent a completed warm-up or change the
  adaptive sequence. Separate mock practice stays separate.
- Subject progress stays independent. Evidence counts identify their actual
  year; eligibility for a higher year is not labelled as learning already done
  in that year. The page makes no whole-year completion percentage claim.
- Growth reads the explicitly selected world and validates the returned key.
  Only persisted discoveries are counted. A confirmed new world starts empty;
  a failed request never masquerades as a reset or zero progress.
- Mission audio/support shortcuts reuse the existing produced narration and
  support controls. There is no browser TTS, new paid speech generation or
  auto-approved listening evidence in this batch.
- Reduced-motion and high-contrast presentation, keyboard focus, short-step
  support indicators and Years 1-7 presentation are covered by browser tests.
  The page does not persist support-profile changes or add a new switch scanner.

## Independent review and remediation

One bounded read-only reviewer was used and then closed. The findings were
verified against source and reproduced before their fixes.

| Finding | Remediation and regression evidence |
| --- | --- |
| World request omitted its key; the repository defaults to Inventor Wilds | Explicit selected-world request, matching-key validation, two-world and next-world tests |
| A stalled optional endpoint discarded an otherwise valid mission | Per-request deadlines: four seconds for flags/profile/selection, two for optional progress/world; whole-navigation cancellation remains separate |
| Staff intervention strategy appeared in pupil-facing explanations | Removed free-text strategy at the shared API source; the pupil UI also uses curated mode-specific explanations |
| Higher-year eligibility visually inherited current-year evidence counts | Explicit evidence-year labels and sampled-versus-ready distinction |
| White focus outline disappeared against the cream mission panel | Contrasting navy/white two-tone focus ring with computed-style browser assertion |
| Late denial could delete a replacement card session | Capture and compare the original token, honour cancellation, test replacement tokens for both the same and another pupil |

Additional checks caught and fixed old-session retention after a failed new-card
login, hidden card switching during a refresh, dark disclosure text in
high-contrast mode, and the confirmed-empty-world onboarding state.

The real-database return journey also caught an older backend defect: profile
names were derived from access IDs and the reported year came from the selected
world. The persisted name/year assertion was retained and the backend fixed.
Handler tests cover a Year 3 pupil in a Year 4 world, missing pupils and database
errors. The lookup uses the existing unique `students.external_ref` index.

## Performance boundary

The aggregate JavaScript ceiling remains **1,430,000 bytes**. It was not raised.
The initial reviewed build emitted 1,447,730 bytes; the final local build emits
1,424,651. The largest measured route is 694,912 / 750,000 bytes; largest JS file
222,190 / 250,000; CSS 70,706 / 120,000; largest public asset 275,314 / 600,000.
These are emitted uncompressed bytes, not measured network transfer sizes.

The improvement shares only `src/lib/api.ts` in the App Router browser layer.
Next's framework/library groups, server builds, development builds and global
splitting thresholds are preserved. Tests protect that narrow boundary. Recheck
it on framework upgrades: custom webpack configuration is an upgrade-sensitive
extension point ([Next.js documentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/webpack),
[webpack cache groups](https://webpack.js.org/plugins/split-chunks-plugin/)).

## Verification record

- Full content prebuild, production build, scoped ESLint, TypeScript and existing
  performance gate passed locally. Nine loader/chunk-boundary tests passed.
- Fresh Go tests with the disposable PostgreSQL DSN passed.
- Final nonvisual desktop/mobile suite: **312 passed**, including all **56**
  new pupil-route cases. Six backend-only cases are skipped in that fixture run
  and verified separately, not counted as passing there.
- Real API/PostgreSQL browser suite: **6 passed**. The journey proves canonical
  grading, lost-acknowledgement idempotency, return to newly saved world growth
  and subject evidence, followed by the authenticated adult evidence workspace.
- Standard desktop/mobile expanded-disclosure screenshots and representative
  Year 1 mobile / Year 7 desktop high-contrast screens were inspected. Axe checks
  cover standard and high-contrast representatives; keyboard/overflow checks
  cover every year, including a 320px viewport.
- A four-worker local run had pre-hydration HTTP/static-resource stalls. The
  retained trace showed a 19.8-second HTML response and unresolved script loads;
  the unchanged suite passed serially. The underlying environment cause is not
  proven. Assertions, timeouts and visual baselines were not relaxed.
- The broad run also found an old `/play` selector in the audio teardown test;
  it now tests `/play/today`, retaining the blocked-destination and immediate
  playback-stop assertions. No visual baselines were changed. The first broad
  Windows run inadvertently included one renderer-baseline test; its desktop
  comparison failed. The final nonvisual run excludes the visual suite entirely;
  Linux CI remains authoritative for those comparisons.
- Hosted release proof belongs to the checks attached to the delivery commit
  and the FS checkpoint written after push; it is not inferred from these
  successful local checks.

## Remaining product gates

- Responsive, keyboard, reduced-motion and task-completion review across the
  family, teacher and platform-admin lanes remains a wider acceptance item.
- Human pronunciation, naturalness, pace and SEND listening decisions remain in
  the authenticated audio queue; technical decode checks are not listening.
- Curriculum breadth/depth reconciliation, safeguarding and pilot evidence are
  not closed by the new pupil page. Wider subject expansion stays behind those
  MVP priorities.
