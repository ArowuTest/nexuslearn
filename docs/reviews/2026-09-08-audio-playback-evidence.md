# Audio review playback evidence

## Decision

The authenticated admin audio workspace now records a small immutable
`playback_evidence` object on a narration review. When a reviewer approves from
that workspace, the browser must observe the exact hash-bound recording reach
the end of playback first. The API validates the declared surface and refuses
an `admin_audio_workspace` approval whose completion flag is false.

The evidence records:

- `surface`: `admin_audio_workspace`;
- `completed`: whether the player emitted its native end-of-playback event;
- `duration_ms`: the media duration when the browser exposed a finite value.

Rejections remain available without completion so a reviewer can report a
technical failure or unsafe/unsuitable recording. Legacy reviews remain valid
and readable because their field is absent or `{}`.

## Limits

Playback completion is a workflow guard and audit context, not proof that a
human paid attention, understood the script, judged pronunciation correctly or
found the voice suitable for SEND learners. The four named human criteria,
technical integrity, transcript/hash binding and safeguarding review remain
separate release requirements. Browser telemetry is never used as learner
mastery evidence.

## Verification

- Go unit/server validation covers incomplete workspace approvals, accepted
  completion and unknown surfaces.
- The PostgreSQL integration fixture verifies JSON persistence and bounded list
  round-trip.
- Desktop and mobile Playwright coverage verifies the approval button remains
  disabled until playback completion and serialises the evidence on approval.
