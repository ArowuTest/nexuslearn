# Release evidence preflight

Goal: let platform administrators inspect all authoritative evidence blockers before staging a live curriculum release.

The first deliverable is a read-only API and CLI preflight. It accepts a validated live manifest and evaluates AI and human/audio ledgers in one read-only repeatable-read transaction. Activation and preflight share the same gate definitions. The response contains stable check codes, explanatory messages and aggregate AI counts; it does not export review notes, transcripts or credentials. Evidence readiness does not guarantee activation: uploaded chunks, runtime status and current evidence are still rechecked by activation.

This is part of the already authorised release-operations work. The later immutable human-review batch and evidence export need their own implementation; this preflight must not imply that those are already available.

- [x] Add backend preflight, shared gate checks and regression/integration tests.
- [x] Add authenticated HTTP route with bounded single-document input.
- [x] Add CLI preflight with automated network/exit-code tests.
- [x] Match CLI audio evidence limit to the backend 5,000-asset limit.
- [x] Verify the coherent batch, document the operator command, commit to main and check CI.

Verification before commit: content tooling 51/51, Go tests/vet/builds and 45
migrations passed against disposable PostgreSQL, frontend build and performance
budget passed, and Playwright passed 110/110 with one worker. A six-worker
local run produced navigation timeouts from the development server; the serial
rerun passed all of the same tests.
