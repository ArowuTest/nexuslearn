package learning

import (
	"context"
	"encoding/json"
	"strings"
	"time"
)

func validateContentReviewDecision(decision ContentReviewDecision) error {
	if strings.TrimSpace(decision.BatchID) == "" || strings.TrimSpace(decision.PackID) == "" || strings.TrimSpace(decision.LaneID) == "" {
		return invalidConfig("content review batch, pack and lane are required")
	}
	if !narrationSHA256Pattern.MatchString(decision.BatchSHA256) {
		return invalidConfig("content review batch hash must be a lowercase sha256 value")
	}
	switch decision.Decision {
	case "approved":
		if strings.TrimSpace(decision.ReviewerName) == "" || strings.TrimSpace(decision.EvidenceNotes) == "" {
			return invalidConfig("an approval needs a reviewer name and evidence notes")
		}
		if len(decision.CandidateIDs) == 0 {
			return invalidConfig("an approval needs at least one reviewed candidate id")
		}
	case "revise", "hold":
		if strings.TrimSpace(decision.ReviewerName) == "" || strings.TrimSpace(decision.EvidenceNotes) == "" {
			return invalidConfig("a revise or hold decision needs a reviewer name and evidence notes")
		}
	default:
		return invalidConfig("content review decision must be approved, revise or hold")
	}
	return nil
}

// ValidateContentReviewDecision exposes the shared review contract to HTTP
// adapters while keeping the repository persistence guard in place.
func ValidateContentReviewDecision(decision ContentReviewDecision) error {
	return validateContentReviewDecision(decision)
}

func (r *PostgresRepository) ListContentReviewDecisions(ctx context.Context, batchID string, limit int) ([]ContentReviewDecision, error) {
	if limit <= 0 || limit > 500 {
		limit = 200
	}
	rows, err := r.db.Query(ctx, `
		SELECT id, batch_id, batch_sha256, pack_id, lane_id, decision,
		       reviewer_id, reviewer_name, evidence_notes, candidate_ids,
		       revision_actions, created_at
		FROM (
			SELECT DISTINCT ON (pack_id, lane_id)
			       id::text AS id, batch_id, batch_sha256, pack_id, lane_id, decision,
			       reviewer_id, reviewer_name, evidence_notes, candidate_ids,
			       revision_actions, created_at
			FROM content_review_decisions
			WHERE batch_id=$1
			ORDER BY pack_id, lane_id, created_at DESC, id DESC
		) latest
		ORDER BY created_at DESC, id DESC
		LIMIT $2
	`, strings.TrimSpace(batchID), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	decisions := []ContentReviewDecision{}
	for rows.Next() {
		var item ContentReviewDecision
		var candidateIDsRaw, revisionActionsRaw []byte
		var createdAt time.Time
		if err := rows.Scan(
			&item.ID, &item.BatchID, &item.BatchSHA256, &item.PackID, &item.LaneID,
			&item.Decision, &item.ReviewerID, &item.ReviewerName, &item.EvidenceNotes,
			&candidateIDsRaw, &revisionActionsRaw, &createdAt,
		); err != nil {
			return nil, err
		}
		item.CandidateIDs = []string{}
		_ = json.Unmarshal(candidateIDsRaw, &item.CandidateIDs)
		item.RevisionActions = []string{}
		_ = json.Unmarshal(revisionActionsRaw, &item.RevisionActions)
		item.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		decisions = append(decisions, item)
	}
	return decisions, rows.Err()
}

func (r *PostgresRepository) SaveContentReviewDecision(ctx context.Context, decision ContentReviewDecision, idempotencyKey string) (ContentReviewDecision, error) {
	if err := validateContentReviewDecision(decision); err != nil {
		return decision, err
	}
	if decision.CandidateIDs == nil {
		decision.CandidateIDs = []string{}
	}
	if decision.RevisionActions == nil {
		decision.RevisionActions = []string{}
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return decision, err
	}
	defer tx.Rollback(ctx)
	actor := strings.TrimSpace(decision.ReviewerID)
	if actor == "" {
		actor = "content-reviewer:" + strings.TrimSpace(decision.ReviewerName)
	}
	replay, err := beginIdempotency(ctx, tx, "content.review", actor, idempotencyKey, decision)
	if err != nil {
		return decision, err
	}
	if replay.Found {
		if err := json.Unmarshal(replay.Response, &decision); err != nil {
			return decision, err
		}
		return decision, nil
	}
	candidateIDs, err := json.Marshal(decision.CandidateIDs)
	if err != nil {
		return decision, err
	}
	revisionActions, err := json.Marshal(decision.RevisionActions)
	if err != nil {
		return decision, err
	}
	var createdAt time.Time
	if err := tx.QueryRow(ctx, `
		INSERT INTO content_review_decisions(
			batch_id, batch_sha256, pack_id, lane_id, decision, reviewer_id,
			reviewer_name, evidence_notes, candidate_ids, revision_actions
		)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)
		RETURNING id::text, created_at
	`, decision.BatchID, decision.BatchSHA256, decision.PackID, decision.LaneID,
		decision.Decision, decision.ReviewerID, decision.ReviewerName,
		decision.EvidenceNotes, candidateIDs, revisionActions).Scan(&decision.ID, &createdAt); err != nil {
		return decision, err
	}
	decision.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	if _, err := tx.Exec(ctx, `
		INSERT INTO audit_logs(action, entity_type, entity_id, payload)
		VALUES('review', 'content_pack_lane', $1, $2::jsonb)
	`, decision.PackID+":"+decision.LaneID, mustJSON(map[string]any{
		"batch_id": decision.BatchID, "batch_sha256": decision.BatchSHA256,
		"pack_id": decision.PackID, "lane_id": decision.LaneID,
		"decision": decision.Decision, "reviewer_name": decision.ReviewerName,
	})); err != nil {
		return decision, err
	}
	if err := completeIdempotency(ctx, tx, "content.review", actor, idempotencyKey, decision); err != nil {
		return decision, err
	}
	if err := tx.Commit(ctx); err != nil {
		return decision, err
	}
	return decision, nil
}
