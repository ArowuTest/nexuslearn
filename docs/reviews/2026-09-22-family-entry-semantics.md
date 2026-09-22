# Family account heading semantics

Date: 2026-09-22

## Hosted finding

After release `637a02b`, read-only Chromium checks visited pupil login, family,
school, platform admin and the pupil Today route at 1280px and 320px. Eight
checks passed. The two family checks stopped at the missing top-level heading:
the forms loaded normally, but the only `h1` belonged to the authenticated
sidebar, which correctly stays unmounted before sign-in. This was a semantic
navigation gap, not evidence of a broken authentication service.

Headings help assistive-technology users understand and navigate page structure;
see the [W3C WAI heading guidance](https://www.w3.org/WAI/tutorials/page-structure/headings/).
The fix keeps one visible page heading in every account state without adding
decorative content, changing the wording or exposing authenticated controls.

## Correction and coverage

- Normal signed-out access: `Parent access` is the page heading.
- Invitation entry: the invitation title is the page heading, and the alternate
  parent-access section remains subordinate.
- Authenticated family workspace: the existing sidebar title remains the sole
  page heading; the child and SEND sections remain subordinate.
- Sign-out: the public account heading returns with the private workspace gone.

Only the local section-header component's typed heading level and its two
account/invitation call sites change. Class names, layout, authentication,
invitation acceptance, session revocation and data access are unchanged.

The regression tests require one visible `h1` at all four role entry surfaces,
check invitation heading hierarchy, and cover linked-child/SEND keyboard and
reflow checks before signing out to the public heading. All account identities
are synthetic fixtures; no live login or learner mutation was performed.

## Test-first evidence

The new/expanded desktop and mobile checks reproduced six failures before the
UI change: normal family entry, invitation entry and post-sign-out state on
each device. The other six cases passed. All failures reported zero `h1`
elements where one was expected, not a test-server or network error.

After the correction, the same 12 tests passed with one worker and no retries.

## Wider local verification

- Complete web lint and production build, including content checks, TypeScript
  and prerendering: exit 0. The isolated content check still reports its 87
  backend-unavailable warnings and `promotion=false`; these are not approvals.
- All 47 release-smoke, authentication and public-content boundary unit checks
  pass, as do the five performance-budget regressions.
- Unchanged asset limits pass: aggregate JavaScript 1,429,095 / 1,430,000 bytes,
  largest route 696,581 / 750,000, CSS 72,947 and largest public asset 275,314.
  Headroom is small; no ceiling was raised.
- A bounded static reviewer found no blocking issue and suggested explicitly
  checking that the private child and SEND sections are absent after sign-out.
  Those DOM-removal assertions were added. The reviewer was closed and did not
  independently run the tests or provide accessibility certification.
- The first wider production-browser run passed 104/106 with two workers. Its
  two failures occurred while filling still-disabled server-rendered fields,
  before either sign-in request. Traces show JavaScript downloads taking 10-30
  seconds or remaining unfinished. About 1.5 GB of host RAM was free at inspection;
  the underlying cause of the local transport stalls was not established.
- The exact same 106-case matrix then passed with one worker, zero retries and
  unchanged assertions/timeouts in 2.1 minutes. It covers authentication
  cancellation, late responses, first-use and invitation flows, role boundaries,
  narrow-screen accessibility, SEND controls and logout privacy. The unsuccessful
  first run is retained as evidence, not reclassified as a pass.
- Inspected the new 320px family screenshot: wrapped content, preserved layout
  and visible keyboard-focus backing. Local production identity uses the
  synthetic `aaaa...` test SHA, not a claim of an already deployed source commit.

The follow-up still needs its own exact-source GitHub and hosted checks; the
preceding release's results are not a substitute. Final remote outcomes are
recorded in the FS V2B checkpoint after their actual runs.

This is not a screen-reader certification, a complete authenticated hosted
four-persona acceptance study, educational/SEND sign-off or audio listening
approval. Existing content and audio release gates remain intact.
