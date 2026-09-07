# Required-listening assessment integrity

Continue approved G12 remediation. Existing player release filtering is insufficient: the canonical grader ignores explicit required-audio markers. An unavailable listening task must not silently become a visual assessment.

Implementation boundary:

- Recognise explicit required-listening markers; optional narration remains optional.
- Resolve required prompt references in one bounded database query per question batch, against that question's live content release, exact audio-release metadata, asset identities and latest hash-bound listening decisions. No browser/authored readiness boolean is authority.
- Fail closed on missing, partial, rejected, stale or unregistered evidence. Preserve exact audio identity in private grading snapshots and question versions; completed idempotent replay precedes current availability checks.
- Pupil projection exposes only the approved primary audio URL and normalised required marker, never private review metadata. Required direct URLs cannot bypass the ledger.
- Explain unavailable listening in the pupil boundary UI and prevent submission on unavailable/failed transport. Keep alternative missions accessible without awarding an answer.
- Test unit contracts, PostgreSQL serving/submission/snapshot/replay/revocation, desktop/mobile browser routes, bundles and hosted checks. Preserve pre-existing generated dirt and all actual listening statuses.

Not an approval of any existing audio. No paid regeneration. Scaffold/phoneme assistance and broader independent-answer leakage remain separate G12 work.
