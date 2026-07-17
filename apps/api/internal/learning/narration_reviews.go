package learning

import (
	"context"
	"encoding/json"
	"regexp"
	"strings"
	"time"
)

var narrationSHA256Pattern = regexp.MustCompile(`^[0-9a-f]{64}$`)

func validateNarrationReview(review NarrationReview) error {
	if strings.TrimSpace(review.AssetID) == "" {
		return invalidConfig("narration asset id is required")
	}
	if !narrationSHA256Pattern.MatchString(review.TextSHA256) || !narrationSHA256Pattern.MatchString(review.AudioSHA256) {
		return invalidConfig("narration review hashes must be lowercase sha256 values")
	}
	if review.Decision != "approved" && review.Decision != "rejected" {
		return invalidConfig("narration review decision must be approved or rejected")
	}
	if strings.TrimSpace(review.ReviewerName) == "" {
		return invalidConfig("narration reviewer name is required")
	}
	if review.Decision == "approved" {
		for _, criterion := range []string{"natural", "clear", "pronunciation", "age_suitable"} {
			if !review.Criteria[criterion] {
				return invalidConfig("all listening criteria must be confirmed before approval")
			}
		}
	}
	if review.Decision == "rejected" && strings.TrimSpace(review.Notes) == "" && len(review.RejectionReasons) == 0 {
		return invalidConfig("a rejection needs a note or rejection reason")
	}
	return nil
}

// ValidateNarrationReview exposes the shared review contract to HTTP and
// other adapters while keeping the repository's persistence guard in place.
func ValidateNarrationReview(review NarrationReview) error {
	return validateNarrationReview(review)
}

func (r *PostgresRepository) ListNarrationReviews(ctx context.Context, assetID string, limit int) ([]NarrationReview, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	assetID = strings.TrimSpace(assetID)
	rows, err := r.db.Query(ctx, `
		SELECT id::text, asset_id, text_sha256, audio_sha256, decision,
		       reviewer_id, reviewer_name, criteria, rejection_reasons, notes,
		       created_at, updated_at
		FROM narration_reviews
		WHERE ($1 = '' OR asset_id = $1)
		ORDER BY updated_at DESC
		LIMIT $2
	`, assetID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	reviews := []NarrationReview{}
	for rows.Next() {
		var review NarrationReview
		var criteriaRaw, reasonsRaw []byte
		var createdAt, updatedAt time.Time
		if err := rows.Scan(
			&review.ID, &review.AssetID, &review.TextSHA256, &review.AudioSHA256,
			&review.Decision, &review.ReviewerID, &review.ReviewerName,
			&criteriaRaw, &reasonsRaw, &review.Notes, &createdAt, &updatedAt,
		); err != nil {
			return nil, err
		}
		review.Criteria = map[string]bool{}
		_ = json.Unmarshal(criteriaRaw, &review.Criteria)
		review.RejectionReasons = []string{}
		_ = json.Unmarshal(reasonsRaw, &review.RejectionReasons)
		review.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		review.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		reviews = append(reviews, review)
	}
	return reviews, rows.Err()
}

func (r *PostgresRepository) SaveNarrationReview(ctx context.Context, review NarrationReview, idempotencyKey string) (NarrationReview, error) {
	if err := validateNarrationReview(review); err != nil {
		return review, err
	}
	if review.Criteria == nil {
		review.Criteria = map[string]bool{}
	}
	if review.RejectionReasons == nil {
		review.RejectionReasons = []string{}
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return review, err
	}
	defer tx.Rollback(ctx)

	actor := strings.TrimSpace(review.ReviewerID)
	if actor == "" {
		actor = "legacy-admin:" + strings.TrimSpace(review.ReviewerName)
	}
	replay, err := beginIdempotency(ctx, tx, "narration.review", actor, idempotencyKey, review)
	if err != nil {
		return review, err
	}
	if replay.Found {
		if err := json.Unmarshal(replay.Response, &review); err != nil {
			return review, err
		}
		return review, nil
	}

	criteria, err := json.Marshal(review.Criteria)
	if err != nil {
		return review, err
	}
	reasons, err := json.Marshal(review.RejectionReasons)
	if err != nil {
		return review, err
	}
	var createdAt, updatedAt time.Time
	if err := tx.QueryRow(ctx, `
		INSERT INTO narration_reviews(
			asset_id, text_sha256, audio_sha256, decision, reviewer_id,
			reviewer_name, criteria, rejection_reasons, notes
		)
		VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9)
		ON CONFLICT(asset_id, text_sha256, audio_sha256) DO UPDATE SET
			decision = EXCLUDED.decision,
			reviewer_id = EXCLUDED.reviewer_id,
			reviewer_name = EXCLUDED.reviewer_name,
			criteria = EXCLUDED.criteria,
			rejection_reasons = EXCLUDED.rejection_reasons,
			notes = EXCLUDED.notes,
			updated_at = now()
		RETURNING id::text, created_at, updated_at
	`, review.AssetID, review.TextSHA256, review.AudioSHA256, review.Decision,
		review.ReviewerID, review.ReviewerName, criteria, reasons, review.Notes,
	).Scan(&review.ID, &createdAt, &updatedAt); err != nil {
		return review, err
	}
	review.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	review.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	if _, err := tx.Exec(ctx, `
		INSERT INTO audit_logs(action, entity_type, entity_id, payload)
		VALUES('review', 'narration_asset', $1, $2::jsonb)
	`, review.AssetID, mustJSON(map[string]any{
		"asset_id": review.AssetID, "text_sha256": review.TextSHA256,
		"audio_sha256": review.AudioSHA256, "decision": review.Decision,
		"reviewer_name": review.ReviewerName,
	})); err != nil {
		return review, err
	}
	if err := completeIdempotency(ctx, tx, "narration.review", actor, idempotencyKey, review); err != nil {
		return review, err
	}
	if err := tx.Commit(ctx); err != nil {
		return review, err
	}
	return review, nil
}
