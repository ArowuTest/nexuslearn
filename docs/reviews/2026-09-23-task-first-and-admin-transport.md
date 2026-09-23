# Task-first pupil missions and administrative transport safety

## Approved scope (23 September 2026)

The owner approved the task-first pupil layout: teaching/questions before the game journal, with secondary controls in an accessible **Support & audio** disclosure. This changes the responsive website, not a separate mobile app.

- Keep one Exit link, Pause and Sound available without opening support.
- Keep the year-appropriate journey/rewards beside the task on larger screens and after it in mobile/assistive-technology reading order.
- Preserve saved SEND settings while the disclosure is closed; do not treat opening it as assistance or a settings change.
- Keep unfinished answers, listening requirements, confidence, hints, grading, immutable attempt retries and earned progress intact.
- Support keyboard open/close, Escape, return focus, deep links, scanning, and audio shortcuts to the currently mounted player.
- Release/AI-review operator tools must not follow authenticated redirects, leak server diagnostics, wait indefinitely, or count malformed acknowledgements as success.

## Evidence and remaining verification

Baseline browser tests reproduced eight mobile failures, including first teaching content at approximately y=2844. The authored regression suite covers Years 1, 4 and 7, the disclosure without a preset, answer preservation, event counts, narrow-screen overlap, keyboard focus, scanning and audio shortcuts. Existing renderer, audio-integrity and gamification checks remain part of the gate.

The production UI compiles. An intermediate browser run was invalid for functional conclusions because its production build omitted the api.test origin; it displayed the explicit unavailable boundary. Rebuild/testing uses an explicit fixture origin. That run is not counted as a pass or a new product regression.

The release-tool worker witnessed initial RED (7 passed/18 failed), focused GREEN (29/29), and full content GREEN (104/104). Later loaded-host reruns hit child-process watchdogs, so integration verification remains open until the exact final files pass again.

Linux validation uses the pinned Playwright 1.61.0 Noble image from platform-quality.yml and Node 22. Snapshot updates must be intentional, visually inspected and rerun; no tolerance increases or cropped replacement checks are permitted to conceal differences.

## Release boundaries

This batch does not activate a new curriculum release, purchase/generate narration, change hosting providers or represent human professional approval. Existing human safeguarding, listening and child-pilot gates remain separate. The previous verified hosted catalogue had 17 runtime objectives; repository pack counts must not be presented as live learning coverage.

Generated content reports, private evidence, credentials and local test artifacts remain outside the commit.
