# Mission integrity and access repair batch

Approved direction: the 5–6 September game audit, followed by the user's instruction to continue. Execute inline on the existing main checkout; preserve unrelated generated content. Use one tested batch, not miniature commits.

## Scope and design

Repair the shared pupil interaction lifecycle (G02/G03/G04/G08). Keep specialised renderer validation: renderers that own a submit action retain it; other registered builders receive a shared submit control. Do not turn unavailable formats into purportedly working games. Failed saves retain an immutable request and freeze answer editing until retry resolves; this avoids reusing an ID with changed evidence. A failed answer is not automatically hint use: reveal authored hints on request and log only actual support. Include teaching, question, feedback and summary actions in scanning, without claiming native select/range scanning is solved here.

The backend currently grades browser-supplied expectations. That G01/G06 work needs a separate canonical-question lookup and response contract, including idempotent replay before regrading mutable content. Do not call progress integrity complete based on this client batch.

## Tasks

- [x] Add `tests/e2e/mission-integrity.spec.ts`: demonstrate sound-box/noun-phrase submission; hints initially hidden and explicitly revealed; wrong unassisted retry remains unassisted; 503 retains the answer and reuses the entire request even if confidence changes; switch can activate feedback continuation. Run tests before implementation and retain expected failures.
- [x] In `LearningStudio.tsx`/`learning-studio/registry.tsx`, give shared-submit ownership a single explicit contract while preserving specialised validation. Test representative builder interactions, not button counts alone. Remove duplicate specialist keyboard submission.
- [x] In `play/mission/page.tsx`, retain a pending request string until a valid response; render save failure beside the task and offer retry. Freeze response editing while saving or uncertain. Reset pending state only for conclusive responses or a new mission.
- [x] Reveal one authored hint at a time via an explicit action; reset between questions. Render failure feedback independently of hint state. Record hint events with actual index and carry assistance only after revealing support.
- [x] Extend scan regions to teaching/feedback/summary, include links, refresh on stage changes, ignore key repeats and stale targets. Test Space continuation and Escape stop; leave full select/range scanning explicitly pending.
- [x] Follow-up found during verification: move support telemetry out of state updaters. Two Focus actions reproduced four events before the fix and two after it on desktop/mobile. Consolidate repeated controls while retaining labels and states.
- [x] Stop cropping renderer visual evidence to historical fixed heights. Capture the complete interaction, including lower answer controls, with unchanged pixel tolerances.
- [x] Run focused desktop/mobile Playwright, existing renderer accessibility/gamification tests, TypeScript and ESLint. Inspect repaired screenshots. Review diff and document unresolved gates before any push. Final full Linux run: 134/134 passed without retries; build and unchanged performance gate passed. See the repair review for details and remaining gates.

## Verification commands (from apps/web)

```powershell
$env:PLAYWRIGHT_PORT='3011'
npx playwright test tests/e2e/mission-integrity.spec.ts --workers=1
npx playwright test tests/e2e/renderer-accessibility.spec.ts tests/e2e/mission-gamification.spec.ts --workers=2
npx tsc --noEmit
npx eslint src/app/play/mission/page.tsx src/components/LearningStudio.tsx src/components/learning-studio/registry.tsx tests/e2e/mission-integrity.spec.ts
```

Tests intercept the API to verify browser behaviour at the request boundary; they do not certify deployed persistence, every variant, or SEND suitability. Real-backend canonical grading, numeric/structured evidence, complete switch operation for selects/sliders, model correctness, audio and age-specific UI remain release gates.
