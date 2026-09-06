package learning

import (
	"context"
	"time"
)

// AttemptEvidence is an adult-only projection of persisted learning evidence.
// RecordedAnswer is the normalized value used by marking, not a raw transcript.
// An absent version means historical provenance is unavailable, never inferred.
type AttemptEvidence struct {
	ID              string `json:"id"`
	ObjectiveID     string `json:"objective_id"`
	QuestionID      string `json:"question_id"`
	QuestionVersion string `json:"question_version,omitempty"`
	QuestionPrompt  string `json:"question_prompt,omitempty"`
	Format          string `json:"format"`
	RecordedAnswer  string `json:"recorded_answer"`
	ResponseMode    string `json:"response_mode"`
	Correct         bool   `json:"correct"`
	HintUsed        bool   `json:"hint_used"`
	MasteryDelta    int    `json:"mastery_delta"`
	Explanation     string `json:"explanation"`
	AttemptedAt     string `json:"attempted_at"`
}

// AdultAttemptEvidence must only be used after adult role and learner scope
// checks. Select a small projection of the frozen contract, never the full key
// or live questions table. Mock answers have a separate reporting lifecycle.
func (r *PostgresRepository) AdultAttemptEvidence(ctx context.Context, studentID string, limit int) ([]AttemptEvidence, error) {
	items := []AttemptEvidence{}
	if studentID == "" {
		return items, nil
	}
	if limit <= 0 || limit > 50 {
		limit = 10
	}
	rows, err := r.db.Query(ctx, `
 SELECT a.id::text, COALESCE(a.objective_id,''), a.question_id,
        COALESCE(a.question_version,''), COALESCE(v.snapshot->'body'->>'prompt',''),
        a.format,a.given_answer,a.response_mode,a.correct,a.hint_used,a.mastery_delta,a.explanation,a.created_at
 FROM question_attempts a
 JOIN students s ON s.id=a.student_id
 LEFT JOIN question_grading_versions v ON v.version=a.question_version AND v.question_id=a.question_id
 WHERE s.external_ref=$1 AND a.mock_assessment_id IS NULL
 ORDER BY a.created_at DESC,a.id DESC LIMIT $2
 `, studentID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var item AttemptEvidence
		var at time.Time
		if err := rows.Scan(&item.ID, &item.ObjectiveID, &item.QuestionID, &item.QuestionVersion, &item.QuestionPrompt, &item.Format, &item.RecordedAnswer, &item.ResponseMode, &item.Correct, &item.HintUsed, &item.MasteryDelta, &item.Explanation, &at); err != nil {
			return nil, err
		}
		item.AttemptedAt = at.UTC().Format(time.RFC3339Nano)
		items = append(items, item)
	}
	return items, rows.Err()
}
