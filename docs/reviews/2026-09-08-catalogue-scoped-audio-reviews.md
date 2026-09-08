# Catalogue-scoped audio review lookup

## Defect reproduced

The listening queue requested a globally ordered latest-review list with a limit equal to the current manifest's length. A newer review for a retired asset could occupy that limit, excluding a valid older review for a current asset. The UI would then incorrectly report that current recording as awaiting listening. A catalogue beyond the history endpoint's 5,000-row limit also triggered its existing 100-row fallback.

A server regression reproduced the displacement before changing production code. This was a read/reporting defect, not evidence that recordings had lost their stored decisions.

## Repair

- The queue requests decisions only for the technically playable assets in its current manifest.
- PostgreSQL applies parameterised asset-ID membership **before** selecting the latest decision and limiting results. Retired assets cannot consume the result budget.
- IDs are deduplicated. Each query accepts at most 5,000 IDs; larger catalogues use bounded batches instead of per-asset queries or silently truncating to 100 rows.
- Empty scope does not query global history. Query/scan/iteration failures return an error, not partial success.
- Existing latest-decision ordering and its `(asset_id, updated_at DESC, id DESC)` index remain in use. The history endpoint, hash-binding rules, append-only review writes and idempotency behaviour are unchanged. No schema migration is needed.

## Verification

- Targeted server tests cover current approval surviving a newer retired review, complete filtered counts and catalogue-scoped repository calls.
- A disposable PostgreSQL test covers **5,001 active assets**, an updated rejection, a newer retired review, duplicate IDs, empty scope and complete final-batch results. All fixtures and decisions are synthetic.
- Full `go test -work ./...` with disposable PostgreSQL, `go vet ./...`, `go build ./...`, formatting and diff checks passed. The learning package's integration run took approximately 127 seconds.
- One bounded read-only reviewer found no blocking P1/P2 issues and was closed.

This improves the accuracy and scalability of the review queue; it neither creates listening approvals nor changes any release gate. The immediately preceding UI/audio commit `d3e3883` passed GitHub content quality, platform quality (including Linux visual tests) and deployment smoke. Hosted verification of this backend follow-on is recorded separately in the FS V2B checkpoint.
