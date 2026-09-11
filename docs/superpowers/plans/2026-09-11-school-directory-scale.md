# School directory scaling: end-to-end delivery batch

Authority: existing approved four-persona/UI scalability work and the user's
instruction to continue substantial tested batches on main. This implements
school/group/pupil overview pagination already listed in the school review;
it does not expand curriculum, alter SEND/gamification policy or change hosting.

## Design and integration contract

The current school portal hydrates up to 500 classes and groups with membership
arrays. Cards are already separately paginated. New clients will request a
bounded overview and page directories; old clients retain their legacy contract.

### Bounded overview

`GET /v1/school/config?include_credentials=false&view=directory`

Keep school and current_user. Return no credentials or staff directory. Return
at most 20 minimal classes, 20 minimal groups and 20 distinct students, without
nested student membership arrays. Add:

```
directory: {
  version: 1,
  counts: { classes: number, groups: number, students: number },
  classes_next_cursor?: string,
  groups_next_cursor?: string,
  students_next_cursor?: string
}
```

Top-level classes/groups/students arrays hold the initial pages. Classes have
id/name/year_group/student_count; groups id/class_id/name/purpose/student_count;
students external_ref/display_name/year_group (internal IDs need not be exposed).
Counts are organisation-wide, not loaded-page lengths, with distinct pupils.
Compatibility ruling: stored NULL class years are represented as 0 and labelled
"Year not set" (no inferred teaching year). Pupil years remain strictly 1-7.

### Directory read

`GET /v1/school/directory?kind=classes|groups|students&limit=20&cursor=...&search=...`

Return `{school_urn, kind, items: [...], next_cursor?: string}`. Default20/max50.
Search is trimmed, bounded (100 characters), case-insensitive literal substring
of display name/name or student external_ref (SQL wildcard characters literal).
For students/classes, optional `ref` is an exact external_ref/class UUID lookup
(max200 bytes) for revalidating a selected pupil or selecting an off-page class
when editing a teaching group; cannot combine
with cursor/search. Stable keyset order, cursor bound to school/kind/search/ref;
strict malformed/duplicate parameters and cross-scope cursor rejection. School
URN and actor role come only from authenticated session and live membership.

Both endpoints are no-store and refuse unsupported repositories. Unknown views
or credential=true plus view=directory fail validation. Existing no-view paths
retain compatibility. Do not introduce a frontend-only data cap.

## Task 1: Backend directory implementation

- [x] Witness failing tests for bounded overview/directory and authorisation.
- [x] Add optional repository capability, typed contract and new server handler.
- [x] Implement bounded PostgreSQL queries without nested membership hydration,
  no per-item queries, with same-school membership joins in counts and rows.
  Use limit+1 and stable keyset order; validate cursors before issuing SQL.
- [x] Add an additive index migration if query plans require it; do not change
  existing migrations. Coordinate the next free migration number with source.
- [x] Tests: real disposable PostgreSQL with >one page, duplicate names, pupils
  in multiple classes, foreign/home/unassigned pupils excluded, inactive/revoked
  school access, forged cursors/queries, literal wildcard search, deterministic
  paging, no nested credentials/membership payload, counts independent of pages.
- [x] Run focused Go packages and formatting; report exact red/green evidence.

Write scope: apps/api/internal/{learning,server,database} relevant new directory
files and minimal existing registration/model/handler edits. No frontend,
content/provider calls, credentials, git stage/commit/push or subagents.

## Task 2: Frontend directory navigation and owner-safe selection

- [x] Add typed bounded directory state/controls, search, next/back pages,
  explicit loading/errors and retry without losing valid selected context.
- [x] Request directory overview. Display backend counts; retain legacy
  no-directory response compatibility during rolling deployments only.
- [x] Page classes for setup/enrolment/cards, students for progress/SEND/mocks,
  and groups for inspection/editing. Preserve selected class/pupil objects
  across search/page changes; never mislabel old evidence as the new pupil.
- [x] Refresh overview after writes, revalidate selected pupil by exact-ref
  lookup for directory responses, and clear revoked/absent pupil evidence.
- [x] Abort/fence late pages on filters, reload, sign-out, expiry and replacement.
  Keep existing class-card lazy credential reads and role restrictions.
- [x] Browser red/green: large pages, true totals, later-page selection, search,
  old response races, empty/error/retry, selection revalidation, role scope,
  keyboard/narrow viewport; existing real-API journeys remain gates.

## Task 3: Integration, review and release

- [x] Complete backend/frontend integration, tests, typecheck/lint/build and
  unchanged performance budgets. Refactor duplicated UI logic if necessary;
  do not raise the aggregate budget merely to fit new code.
- [x] One independent adversarial review of the substantive integrated diff,
  with focused remediation; no repeated small review agents.
- [ ] Full relevant API/content/browser gates, exact-stage one coherent batch,
  push main and verify CI/hosted identities if authorised tools are available.
- [ ] Durable local handover and FS V2B checkpoint when service is available.

## Execution rulings

- Continue in the user-designated main checkout; preserve all unrelated dirty
  generated reports and local evidence. No agent commits or new worktrees.
- One backend implementer while the lead handles frontend/integration; one
  final reviewer after the full slice. User asked for purposeful limited agents
  and no intermediate approval pauses within already authorised build scope.
- This is a continuation of approved pagination, not a fresh product concept;
  use the explicit contract above instead of repeating brainstorming approval.
- Existing backend read paths retain compatibility, but the new directory path
  fails closed if unsupported. A legacy response is not evidence of bounded
  production queries; exercise the actual new path in integration tests.
- Render exact-SHA mismatch from the previous web-only correction remains
  independent. Do not inspect the rejected credential file or weaken the gate.
