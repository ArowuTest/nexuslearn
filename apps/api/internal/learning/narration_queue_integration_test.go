package learning

import (
	"context"
	"fmt"
	"testing"
)

func TestNarrationCatalogueLookupEmptyDoesNotQueryHistory(t *testing.T) {
	// No database is necessary or accessed for empty scope.
	repo := &PostgresRepository{}
	for _, ids := range [][]string{nil, {}, {""}} {
		reviews, err := repo.ListNarrationReviewsForAssets(context.Background(), ids)
		if err != nil || len(reviews) != 0 {
			t.Fatalf("empty catalogue returned reviews=%#v err=%v", reviews, err)
		}
	}
}

func TestNarrationCatalogueLookupScopesAndBatchesLatestDecisions(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx := context.Background()
	const count = narrationReviewLookupBatchSize + 1
	// Synthetic decisions only, confined to the disposable test schema.
	if _, err := pool.Exec(ctx, `
		INSERT INTO narration_reviews(asset_id,text_sha256,audio_sha256,decision,reviewer_name,updated_at)
		SELECT 'active-' || n::text, repeat('a',64), repeat('b',64), 'approved', 'Synthetic reviewer', now() - interval '1 day'
		FROM generate_series(1, $1::int) n;
	`, count); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO narration_reviews(asset_id,text_sha256,audio_sha256,decision,reviewer_name)
		VALUES ('active-1',repeat('a',64),repeat('b',64),'rejected','Synthetic reviewer'),
		       ('retired',repeat('a',64),repeat('b',64),'approved','Synthetic reviewer');
	`); err != nil {
		t.Fatal(err)
	}
	ids := make([]string, 0, count+2)
	for n := 1; n <= count; n++ {
		ids = append(ids, fmt.Sprintf("active-%d", n))
	}
	ids = append(ids, "active-1", "") // Duplicate/empty IDs must not inflate results.
	reviews, err := repo.ListNarrationReviewsForAssets(ctx, ids)
	if err != nil || len(reviews) != count {
		t.Fatalf("expected all %d scoped reviews across batches, got %d: %v", count, len(reviews), err)
	}
	seen := map[string]bool{}
	for _, review := range reviews {
		if review.AssetID == "retired" || seen[review.AssetID] {
			t.Fatalf("out-of-scope or duplicate review: %s", review.AssetID)
		}
		seen[review.AssetID] = true
		if review.AssetID == "active-1" && review.Decision != "rejected" {
			t.Fatal("catalogue lookup returned an older decision")
		}
	}
	if !seen[fmt.Sprintf("active-%d", count)] || !seen["active-1"] {
		t.Fatal("catalogue lookup silently truncated the first or final batch")
	}
}
