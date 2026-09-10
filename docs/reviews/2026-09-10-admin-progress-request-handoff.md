# Admin progress request handoff: CI regression correction

## Finding and cause

GitHub Platform quality run `34515130790` on `f2343cb` passed 492 browser
cases but failed the two admin attempt-evidence cases, one per viewport.
Twelve separately executed backend cases were intentionally skipped. Content
quality, API quality, the frontend build and performance gate passed. Both
hosted services served the exact revision and passed deployment smoke, which
did not make the failed browser gate green.

The privacy correction correctly stopped an invalidated progress response
from clearing state after a pupil/account change. However, changing pupils
incremented the request version and removed the report without releasing the
old request's `progress` busy marker. Its guarded `finally` then correctly did
nothing, leaving the button disabled indefinitely. This was a product defect,
not an obsolete assertion or timeout problem.

## Correction and regression contract

Invalidating admin progress now immediately releases only a `progress` busy
marker. It preserves unrelated mutation markers and keeps the request-version
fence. An older response cannot display its pupil's evidence or unlock a newer
progress request. No backend contract, timeout, retry or acceptance gate changed.

- The actual-handler unit regression first failed: 24 passed / one failed,
  specifically the invalidated request retaining `progress`.
- With the one-line correction, all 25 adult-auth/privacy checks plus four
  bundle-boundary checks passed (29/29). Tests cover a newer in-flight request
  and an unrelated mutation, not only an empty final screen.
- The existing desktop/mobile browser test is strengthened: hold the first
  response, change pupil, start a second held request, settle the first and
  verify the second stays busy with no old evidence, then display only the
  second pupil's returned evidence. The original final-state assertion is not
  weakened or removed as a workaround.
- Focused lint, production build and TypeScript passed. Performance remained
  within unchanged limits: aggregate JS 1,428,733 / 1,430,000; largest route
  700,716 / 750,000; largest public asset 275,314 / 600,000 bytes.

- The rebuilt production browser suite passed **90/90** desktop/mobile cases
  in 2.3 minutes, one worker and zero retries: attempt evidence, adult
  authentication, whole-session privacy and admin role/data boundaries.
  Both strengthened admin request-handoff scenarios passed.

The subsequent exact remote release result is recorded in the FS V2B
checkpoint after execution. Evidence logs are private
under `.agent/admin-progress-*-20260910.log` and `apps/web/.agent/`.
