# Bounded school directory and safe selection

This batch replaces the school workspace's initial membership hydration with
backend-driven, paginated class, teaching-group and pupil directories. It is
operational scalability work for the existing three-subject Years 1-7 MVP;
it does not expand or approve curriculum, generate narration, or change hosting.

## Delivered behaviour

- Initial school overview contains at most 20 summaries per directory and
  school-wide totals, with distinct pupil counting across classes. It contains
  neither a staff directory, login credentials nor nested pupil memberships.
- Classes, groups and pupils have searchable next/back pages. Selected pupils
  and classes remain available across directory navigation; pupil evidence is
  cleared when switching pupil or losing access. Post-save refresh revalidates
  a selected off-page pupil by exact reference.
- Late directory and group/class lookup responses are aborted and fenced on
  replacement, sign-out, session change and unmount. The group race was first
  reproduced by a failing browser regression, then corrected.
- Cards still load separately, 12 at a time, with existing disclosure, selection
  and print restrictions. Legacy classes without a stored year display
  "Year not set"; no learning year is inferred. Pupil years remain 1-7.
- Directory reads require an account session and live school access, use
  private/no-store responses, and independently scope SQL to that school.
  Strict query/cursor checks reject ambiguous or cross-scope requests. Exact
  class and pupil lookups do not disclose foreign or unenrolled entities.
- Immutable identity-based keyset order and additive migration 0059 support
  bounded page queries. Search treats SQL wildcard characters literally.
  Old clients retain the no-view API contract; unsupported new directory
  capabilities fail closed rather than hydrating an entire school as fallback.

## Scalability boundaries

The real PostgreSQL scale fixture contains 1,200 classes, 1,200 groups and 2,500
pupils. It checks 20-row overview pages, exact totals, one query per continuation,
limit-plus-one retrieval, and query plans. Counts, pupil deduplication and literal
substring search still do work proportional to the relevant school data; this
is not a constant-time or production latency claim. Cursors are positions, not
authorization grants or a cross-request snapshot. Membership changes can require
refreshing the overview and restarting pagination.

Migration 0059 adds two indexes using the existing transactional runner. Index
creation can hold locks; normal deployment migration monitoring still applies.
The browser-only chunk changes share measured duplicate mock-history and child
journey components. No performance limit, screenshot baseline or tolerance was
raised.

## Verification and release

Local integration is accepted; this document is not a hosted deployment acceptance.
The first combined desktop/mobile school/auth/card/record regression passed
112/112 with zero retries before the additional unset-class-year case. The
unset-year validator has separate witnessed unit red/green evidence. The real
role harness now explicitly requires version-1 bounded overviews and performs
a real authenticated pupil-directory search, so legacy fallback cannot satisfy
that integration gate.

Independent review, production build/budget, API and browser evidence are below.
GitHub CI and hosted revision acceptance remain post-push gates.

The independent review found three P2 selection races/edge cases. Each was
reproduced in a failing browser test before remediation. Retained class metadata
now occupies four independent slots (enrolment, group, card, edit draft), so a
late group lookup cannot prune newer selections. New off-page class responses
are pinned before overview refresh, and name/purpose edits preserve the pending
parent-class lookup. Identity changes still cancel it. No backend changes were
needed for these fixes.

Lead full API tests, vet and build passed against isolated PostgreSQL (learning
202.037s, server 110.259s). The content/prebuild gate and 64 boundary tests passed.
The pre-remediation real role harness passed 6/6 including actual bounded overview
and authenticated pupil search. After remediation, production build/typecheck,
focused lint and unchanged performance gate pass: aggregate JavaScript 1,428,046
/ 1,430,000; largest route 700,716 / 750,000; largest chunk 222,190 / 250,000;
CSS 72,285 / 120,000; largest public asset 275,314 / 600,000.

The first broad run passed 510 cases, skipped the 12 separately gated real-API
cases, and failed two desktop admin-audio cases at initial navigation. The traces
show prompt HTML but delayed/incomplete local static JavaScript loads before
hydration. The precise cause is not established; these failures remain recorded.
All 22 new directory cases passed, including the three review regressions on
both viewports. A complete same-build rerun passed **512/512** in 7.4 minutes,
with zero retries and only the 12 separately gated real-API cases skipped.
The final same-build real-backend harness also passed: **6/6 grading** (21.4s)
and **6/6 role journeys** (29.5s), with durable PostgreSQL writes and zero retries.
No timeout, assertion, worker-count or baseline adjustment was made. The two
Linux-only visual scenarios are not
included in this Windows run and remain required in GitHub CI.
The reviewer's read-only recheck cleared the three fixes; it did not replace
runtime verification.

The reviewed release contains 21 explicitly selected source, test and document
files. Scoped secret-pattern scanning and whitespace checks passed. Release
must verify the GitHub main commit and its CI, then compare both hosted build
identities; a successful push alone does not establish a successful deployment.

Independent listening, safeguarding and real-child pilot acceptance remain
open. This batch produces no recordings or human approvals. Private/generated
reports, credentials and local test artifacts stay out of the source commit.
