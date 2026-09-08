package learning

import (
	"context"
	"encoding/json"
	"regexp"
	"strings"
	"time"
)

var narrationSHA256Pattern = regexp.MustCompile(`^[0-9a-f]{64}$`)

const narrationPlaybackWorkspace = "admin_audio_workspace"
const narrationReviewLookupBatchSize = 5000

func validateNarrationReview(review NarrationReview) error {
	if strings.TrimSpace(review.AssetID) == "" {
		return invalidConfig("narration asset id is required")
	}
	if !narrationSHA256Pattern.MatchString(review.TextSHA256) || !narrationSHA256Pattern.MatchString(review.AudioSHA256) {
		return invalidConfig("narration review hashes must be lowercase sha256 values")
	}
	if review.ProductionProfileSHA256 != "" && !narrationSHA256Pattern.MatchString(review.ProductionProfileSHA256) {
		return invalidConfig("narration production profile hash must be a lowercase sha256 value")
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
	if review.PlaybackEvidence != nil {
		playback := review.PlaybackEvidence
		if review.PlaybackEvidence.Surface != "" && review.PlaybackEvidence.Surface != narrationPlaybackWorkspace {
			return invalidConfig("narration playback evidence surface is not recognised")
		}
		if review.PlaybackEvidence.DurationMS < 0 || review.PlaybackEvidence.DurationMS > 3600000 {
			return invalidConfig("narration playback duration is outside the safe range")
		}
		if review.Decision == "approved" && review.PlaybackEvidence.Surface == narrationPlaybackWorkspace && !review.PlaybackEvidence.Completed {
			return invalidConfig("the audio workspace requires playback completion before approval")
		}
		workspaceApproval := review.Decision == "approved" && playback.Surface == narrationPlaybackWorkspace
		// Legacy evidence remains unchanged. New coverage telemetry is checked
		// on every decision, including rejections and surface-less imports.
		if workspaceApproval || playback.CoverageVersion != "" || playback.PlayedMS != 0 || playback.PlaybackRate != 0 {
			if playback.CoverageVersion != "played-ranges-v1" {
				return invalidConfig("narration playback coverage version must be played-ranges-v1")
			}
			if playback.DurationMS < 1 || playback.PlayedMS < 1 || playback.PlayedMS > playback.DurationMS {
				return invalidConfig("narration playback coverage must be within the positive duration")
			}
			if playback.PlaybackRate != 1 {
				return invalidConfig("narration playback coverage requires normal playback rate")
			}
			if workspaceApproval {
				tolerance := playback.DurationMS / 100
				if tolerance > 100 {
					tolerance = 100
				}
				if playback.DurationMS-playback.PlayedMS > tolerance {
					return invalidConfig("the audio workspace requires full played-range coverage before approval")
				}
			}
		}
	}
	return nil
}

// ValidateNarrationReview exposes the shared review contract to HTTP and
// other adapters while keeping the repository's persistence guard in place.
func ValidateNarrationReview(review NarrationReview) error {
	return validateNarrationReview(review)
}

func (r *PostgresRepository) ListNarrationReviews(ctx context.Context, assetID string, limit int) ([]NarrationReview, error) {
	// The history endpoint is globally bounded. The current-catalogue queue
	// must use ListNarrationReviewsForAssets so retired assets cannot displace it.
	if limit <= 0 || limit > narrationReviewLookupBatchSize {
		limit = 100
	}
	return r.listNarrationReviews(ctx, strings.TrimSpace(assetID), false, limit)
}

func (r *PostgresRepository) ListNarrationReviewsForAssets(ctx context.Context, assetIDs []string) ([]NarrationReview, error) {
	ids := make([]string, 0, len(assetIDs))
	seen := make(map[string]bool, len(assetIDs))
	for _, id := range assetIDs {
		if id != "" && !seen[id] {
			ids = append(ids, id)
			seen[id] = true
		}
	}
	reviews := []NarrationReview{}
	// One query for today's catalogue; bounded batches when it grows. Empty
	// input never falls through to the global history query.
	for start := 0; start < len(ids); start += narrationReviewLookupBatchSize {
		end := start + narrationReviewLookupBatchSize
		if end > len(ids) {
			end = len(ids)
		}
		batch, err := r.listNarrationReviews(ctx, ids[start:end], true, end-start)
		if err != nil {
			return nil, err
		}
		reviews = append(reviews, batch...)
	}
	return reviews, nil
}

func (r *PostgresRepository) listNarrationReviews(ctx context.Context, assetFilter any, catalogueScoped bool, limit int) ([]NarrationReview, error) {
	// Only these fixed predicates are interpolated; all asset IDs are parameters.
	predicate := "($1 = '' OR asset_id = $1)"
	if catalogueScoped {
		predicate = "asset_id = ANY($1::text[])"
	}
	rows, err := r.db.Query(ctx, `
		SELECT id, asset_id, text_sha256, audio_sha256, production_profile_sha256, decision,
		       reviewer_id, reviewer_name, criteria, rejection_reasons, notes, playback_evidence,
		       created_at, updated_at
		FROM (
			SELECT DISTINCT ON (asset_id)
			       id::text AS id, asset_id, text_sha256, audio_sha256,
			       COALESCE(production_profile_sha256, '') AS production_profile_sha256, decision,
			       reviewer_id, reviewer_name, criteria, rejection_reasons, notes, playback_evidence,
			       created_at, updated_at
			FROM narration_reviews
			WHERE `+predicate+`
			ORDER BY asset_id, updated_at DESC, id DESC
		) latest
		ORDER BY updated_at DESC, id DESC
		LIMIT $2
	`, assetFilter, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	reviews := []NarrationReview{}
	for rows.Next() {
		var review NarrationReview
		var criteriaRaw, reasonsRaw, playbackRaw []byte
		var createdAt, updatedAt time.Time
		if err := rows.Scan(
			&review.ID, &review.AssetID, &review.TextSHA256, &review.AudioSHA256, &review.ProductionProfileSHA256,
			&review.Decision, &review.ReviewerID, &review.ReviewerName,
			&criteriaRaw, &reasonsRaw, &review.Notes, &playbackRaw, &createdAt, &updatedAt,
		); err != nil {
			return nil, err
		}
		review.Criteria = map[string]bool{}
		_ = json.Unmarshal(criteriaRaw, &review.Criteria)
		review.RejectionReasons = []string{}
		_ = json.Unmarshal(reasonsRaw, &review.RejectionReasons)
		var playback NarrationPlaybackEvidence
		if len(playbackRaw) > 0 && string(playbackRaw) != "{}" && string(playbackRaw) != "null" && json.Unmarshal(playbackRaw, &playback) == nil {
			review.PlaybackEvidence = &playback
		}
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
	playback := []byte("{}")
	if review.PlaybackEvidence != nil {
		playback, err = json.Marshal(review.PlaybackEvidence)
		if err != nil {
			return review, err
		}
	}
	var createdAt, updatedAt time.Time
	if err := tx.QueryRow(ctx, `
		INSERT INTO narration_reviews(
			asset_id, text_sha256, audio_sha256, production_profile_sha256, decision, reviewer_id,
			reviewer_name, criteria, rejection_reasons, notes, playback_evidence
		)
		VALUES($1,$2,$3,NULLIF($4,''),$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11::jsonb)
		RETURNING id::text, created_at, updated_at
	`, review.AssetID, review.TextSHA256, review.AudioSHA256, review.ProductionProfileSHA256, review.Decision,
		review.ReviewerID, review.ReviewerName, criteria, reasons, review.Notes, playback,
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
		"audio_sha256": review.AudioSHA256, "production_profile_sha256": review.ProductionProfileSHA256, "decision": review.Decision,
		"reviewer_name": review.ReviewerName, "playback_evidence": review.PlaybackEvidence,
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
