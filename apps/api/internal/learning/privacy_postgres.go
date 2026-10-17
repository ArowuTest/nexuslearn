package learning

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
)

func (r *PostgresRepository) FamilyChildAccess(ctx context.Context, externalRef string) (bool, bool, bool, error) {
	var schoolHeld, parentLinked, consentActive bool
	err := r.db.QueryRow(ctx, `
		SELECT
			EXISTS (
				SELECT 1 FROM class_students cs
				JOIN students s ON s.id = cs.student_id
				WHERE s.external_ref = $1
			) OR EXISTS (
				SELECT 1 FROM learning_group_students gs
				JOIN students s ON s.id = gs.student_id
				WHERE s.external_ref = $1
			),
			EXISTS (
				SELECT 1 FROM parent_student_links l
				JOIN students s ON s.id = l.student_id
				WHERE s.external_ref = $1 AND l.status = 'active'
			),
			EXISTS (
				SELECT 1 FROM consent_records c
				WHERE c.student_external_ref = $1
				  AND c.purpose = 'family_learning'
				  AND c.withdrawn_at IS NULL
			)
	`, externalRef).Scan(&schoolHeld, &parentLinked, &consentActive)
	return schoolHeld, parentLinked, consentActive, err
}

func (r *PostgresRepository) RecordConsent(ctx context.Context, record ConsentRecord) (ConsentRecord, error) {
	if !AllowedConsentPurpose(record.Purpose) {
		return ConsentRecord{}, ErrConsentPurpose
	}
	if record.Region == "" {
		record.Region = "england"
	}
	if record.Method == "" {
		record.Method = "recorded"
	}
	if record.PolicyVersion == "" {
		record.PolicyVersion = "2026-10-17"
	}
	var granted time.Time
	err := r.db.QueryRow(ctx, `
		INSERT INTO consent_records (
			parent_user_id, student_external_ref, purpose, policy_version, region, method
		) VALUES ($1::uuid, $2, $3, $4, $5, $6)
		RETURNING id::text, granted_at
	`, record.ParentUserID, record.StudentExternalRef, record.Purpose, record.PolicyVersion, record.Region, record.Method).Scan(&record.ID, &granted)
	if err != nil {
		return ConsentRecord{}, err
	}
	record.GrantedAt = granted.UTC().Format(time.RFC3339)
	return record, nil
}

func (r *PostgresRepository) ExportFamilyChild(ctx context.Context, parentUserID string, externalRef string) (FamilyExport, error) {
	owned, err := r.parentOwnsActiveChild(ctx, parentUserID, externalRef)
	if err != nil {
		return FamilyExport{}, err
	}
	if !owned {
		return FamilyExport{}, ErrChildNotOwned
	}
	export := FamilyExport{
		ExportedAt:        time.Now().UTC().Format(time.RFC3339),
		Sharing:           map[string]bool{"school": false, "marketing": false, "research": false},
		SecretsIncluded:   false,
		Consent:           []ConsentRecord{},
		Attempts:          []map[string]any{},
		AttemptsTruncated: false,
		Mastery:           []map[string]any{},
		MasteryHistory:    []map[string]any{},
		Baselines:         []map[string]any{},
		MockAssessments:   []map[string]any{},
		WorldState:        []map[string]any{},
		LessonSteps:       []map[string]any{},
		Events:            []map[string]any{},
	}
	var year int
	var name string
	var created time.Time
	if err := r.db.QueryRow(ctx, `
		SELECT display_name, year_group, created_at
		FROM students WHERE external_ref = $1
	`, externalRef).Scan(&name, &year, &created); err != nil {
		return FamilyExport{}, err
	}
	export.Child = map[string]any{"external_ref": externalRef, "display_name": name, "year_group": year, "created_at": created.UTC().Format(time.RFC3339)}
	export.Engagement, err = r.engagementExport(ctx, externalRef)
	if err != nil {
		return FamilyExport{}, err
	}
	export.Consent, err = r.consentExport(ctx, externalRef)
	if err != nil {
		return FamilyExport{}, err
	}
	export.Attempts, err = r.attemptExport(ctx, externalRef)
	if err != nil {
		return FamilyExport{}, err
	}
	export.Mastery, err = r.rowsForChild(ctx, externalRef, `
		SELECT m.objective_id, m.score, m.band, m.last_signal, m.updated_at
		FROM student_objective_mastery m
		JOIN students s ON s.id = m.student_id
		WHERE s.external_ref = $1
		ORDER BY m.objective_id
	`)
	if err != nil {
		return FamilyExport{}, err
	}
	export.MasteryHistory, err = r.rowsForChild(ctx, externalRef, `
		SELECT h.objective_id, h.question_id, h.prior_score, h.new_score, h.mastery_delta, h.correct, h.hint_used, h.response_format, h.recorded_at
		FROM mastery_history h
		JOIN students s ON s.id = h.student_id
		WHERE s.external_ref = $1
		ORDER BY h.recorded_at, h.id
	`)
	if err != nil {
		return FamilyExport{}, err
	}
	export.Baselines, err = r.rowsForChild(ctx, externalRef, `
		SELECT b.id::text AS id, b.year_group, b.status, b.started_at, b.completed_at,
		       COALESCE((
		         SELECT jsonb_agg(jsonb_build_object(
		           'objective_id', i.objective_id, 'position', i.position, 'status', i.status,
		           'attempt_count', i.attempt_count, 'correct_count', i.correct_count
		         ) ORDER BY i.position)
		         FROM diagnostic_baseline_items i WHERE i.baseline_id = b.id
		       ), '[]'::jsonb) AS items
		FROM diagnostic_baselines b
		JOIN students s ON s.id = b.student_id
		WHERE s.external_ref = $1
		ORDER BY b.created_at, b.id
	`)
	if err != nil {
		return FamilyExport{}, err
	}
	export.MockAssessments, err = r.rowsForChild(ctx, externalRef, `
		SELECT m.id::text AS id, m.subject, m.year_group, m.title, m.status, m.question_count, m.created_at, m.completed_at
		FROM mock_assessments m
		JOIN students s ON s.id = m.student_id
		WHERE s.external_ref = $1
		ORDER BY m.created_at, m.id
	`)
	if err != nil {
		return FamilyExport{}, err
	}
	export.WorldState, err = r.rowsForChild(ctx, externalRef, `
		SELECT w.world_key, w.state, w.updated_at
		FROM student_world_state w
		JOIN students s ON s.id = w.student_id
		WHERE s.external_ref = $1
		ORDER BY w.world_key
	`)
	if err != nil {
		return FamilyExport{}, err
	}
	export.LessonSteps, err = r.rowsForChild(ctx, externalRef, `
		SELECT a.activity_id, a.objective_id, a.step_id, a.step_kind, a.status, a.duration_ms, a.recorded_at
		FROM lesson_step_attempts a
		JOIN students s ON s.id = a.student_id
		WHERE s.external_ref = $1
		ORDER BY a.recorded_at, a.id
	`)
	if err != nil {
		return FamilyExport{}, err
	}
	export.Events, err = r.rowsForChild(ctx, externalRef, `
		SELECT e.event_type, e.event_payload, e.created_at
		FROM learning_events e
		JOIN students s ON s.id = e.student_id
		WHERE s.external_ref = $1
		ORDER BY e.created_at, e.id
	`)
	if err != nil {
		return FamilyExport{}, err
	}
	if _, err := r.db.Exec(ctx, `
		INSERT INTO privacy_actions (action, actor, subject_ref, detail)
		VALUES ('export', $1, $2, '{"secrets_included":false}'::jsonb)
	`, parentUserID, externalRef); err != nil {
		return FamilyExport{}, err
	}
	return export, nil
}

func (r *PostgresRepository) DeleteFamilyChild(ctx context.Context, parentUserID string, externalRef string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var studentID string
	err = tx.QueryRow(ctx, `
		SELECT s.id::text
		FROM students s
		JOIN parent_student_links l ON l.student_id = s.id
		WHERE s.external_ref = $2
		  AND l.parent_user_id = $1::uuid
		  AND l.status = 'active'
	`, parentUserID, externalRef).Scan(&studentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrChildNotOwned
	}
	if err != nil {
		return err
	}
	var held bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS (SELECT 1 FROM class_students WHERE student_id = $1::uuid)
		    OR EXISTS (SELECT 1 FROM learning_group_students WHERE student_id = $1::uuid)
	`, studentID).Scan(&held); err != nil {
		return err
	}
	if held {
		return ErrChildHeldBySchool
	}
	if _, err := tx.Exec(ctx, `
		UPDATE consent_records
		SET student_external_ref = '', withdrawn_at = now()
		WHERE student_external_ref = $1
	`, externalRef); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE audit_logs
		SET payload = (
			SELECT CASE
				WHEN jsonb_typeof(body -> 'credentials') = 'array' THEN
					jsonb_set(body, '{credentials}', COALESCE((
						SELECT jsonb_agg(
							CASE
								WHEN jsonb_typeof(element) = 'object' THEN
									element
										- 'login_code' - 'picture_password' - 'qr_secret_hash'
										- 'password' - 'temporary_password' - 'password_hash'
								ELSE element
							END
						)
						FROM jsonb_array_elements(body -> 'credentials') AS element
					), '[]'::jsonb))
				ELSE body
			END
			FROM (
				SELECT COALESCE(audit_logs.payload, '{}'::jsonb)
				       - 'login_code' - 'picture_password' - 'qr_secret_hash'
				       - 'password' - 'temporary_password' - 'password_hash' AS body
			) AS stripped
		)
		WHERE entity_id = $1
		   OR payload->>'student_external_ref' = $1
		   OR payload->>'external_ref' = $1
	`, externalRef); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE learning_events
		SET event_payload = '{}'::jsonb, event_type = 'redacted'
		WHERE student_id = $1::uuid
	`, studentID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE privacy_actions SET subject_ref = '' WHERE subject_ref = $1
	`, externalRef); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO privacy_actions (action, actor, subject_ref, detail)
		VALUES ('delete', $1, '', '{}'::jsonb)
	`, parentUserID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM students WHERE id = $1::uuid`, studentID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *PostgresRepository) PurgeExpiredAttempts(ctx context.Context, days int, actor string) (int64, error) {
	if days < 30 || days > 3650 {
		return 0, errors.New("retention days are outside the allowed range")
	}
	tag, err := r.db.Exec(ctx, `
		DELETE FROM question_attempts
		WHERE created_at < now() - make_interval(days => $1)
	`, days)
	if err != nil {
		return 0, err
	}
	detail, _ := json.Marshal(map[string]any{"days": days, "deleted": tag.RowsAffected()})
	if _, err := r.db.Exec(ctx, `
		INSERT INTO privacy_actions (action, actor, subject_ref, detail)
		VALUES ('purge', $1, 'question_attempts', $2::jsonb)
	`, actor, detail); err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

func (r *PostgresRepository) SaveHumanContentApproval(ctx context.Context, approval HumanContentApproval) (HumanContentApproval, error) {
	if approval.NarrationIDs == nil {
		approval.NarrationIDs = []string{}
	}
	var created time.Time
	err := r.db.QueryRow(ctx, `
		INSERT INTO human_content_approvals (pack_id, decision, reviewer, notes, narration_ids)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id::text, created_at
	`, approval.PackID, approval.Decision, approval.Reviewer, approval.Notes, approval.NarrationIDs).Scan(&approval.ID, &created)
	if err != nil {
		return HumanContentApproval{}, err
	}
	approval.CreatedAt = created.UTC().Format(time.RFC3339)
	return approval, nil
}

func (r *PostgresRepository) ApprovedNarrationIDs(ctx context.Context) ([]string, error) {
	rows, err := r.db.Query(ctx, `
		WITH expanded AS (
			SELECT id, decision, created_at, unnest(narration_ids) AS narration_id
			FROM human_content_approvals
		),
		latest AS (
			SELECT DISTINCT ON (narration_id) narration_id, decision
			FROM expanded
			ORDER BY narration_id, created_at DESC, id DESC
		)
		SELECT narration_id FROM latest WHERE decision = 'approved' AND narration_id <> ''
		ORDER BY narration_id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (r *PostgresRepository) parentOwnsActiveChild(ctx context.Context, parentUserID string, externalRef string) (bool, error) {
	var owned bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM parent_student_links l
			JOIN students s ON s.id = l.student_id
			WHERE l.parent_user_id = $1::uuid
			  AND s.external_ref = $2
			  AND l.status = 'active'
		)
	`, parentUserID, externalRef).Scan(&owned)
	return owned, err
}

func (r *PostgresRepository) engagementExport(ctx context.Context, externalRef string) (map[string]any, error) {
	var support, approaches, interests []string
	var celebration, session, sensory, attention, communication, processing, confidence, companion, reward, notes string
	var audio, reading bool
	err := r.db.QueryRow(ctx, `
		SELECT declared_support_needs, learning_approaches, celebration_intensity, audio_support,
		       reading_support, session_length, sensory_load, attention_support, communication_support,
		       processing_support, confidence_support, companion_style, reward_style, interests, notes
		FROM student_engagement_profiles p
		JOIN students s ON s.id = p.student_id
		WHERE s.external_ref = $1
	`, externalRef).Scan(&support, &approaches, &celebration, &audio, &reading, &session, &sensory, &attention, &communication, &processing, &confidence, &companion, &reward, &interests, &notes)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"declared_support_needs": support,
		"learning_approaches":    approaches,
		"celebration_intensity":  celebration,
		"audio_support":          audio,
		"reading_support":        reading,
		"session_length":         session,
		"sensory_load":           sensory,
		"attention_support":      attention,
		"communication_support":  communication,
		"processing_support":     processing,
		"confidence_support":     confidence,
		"companion_style":        companion,
		"reward_style":           reward,
		"interests":              interests,
		"notes":                  notes,
	}, nil
}

func (r *PostgresRepository) consentExport(ctx context.Context, externalRef string) ([]ConsentRecord, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id::text, parent_user_id::text, student_external_ref, purpose, policy_version,
		       region, method, granted_at, COALESCE(withdrawn_at::text, '')
		FROM consent_records
		WHERE student_external_ref = $1
		ORDER BY granted_at
	`, externalRef)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	records := []ConsentRecord{}
	for rows.Next() {
		var record ConsentRecord
		var granted time.Time
		if err := rows.Scan(&record.ID, &record.ParentUserID, &record.StudentExternalRef, &record.Purpose, &record.PolicyVersion, &record.Region, &record.Method, &granted, &record.WithdrawnAt); err != nil {
			return nil, err
		}
		record.GrantedAt = granted.UTC().Format(time.RFC3339)
		records = append(records, record)
	}
	return records, rows.Err()
}

func (r *PostgresRepository) attemptExport(ctx context.Context, externalRef string) ([]map[string]any, error) {
	attempts := []map[string]any{}
	const pageSize = 1000
	for offset := 0; ; offset += pageSize {
		page, err := r.rowsForChild(ctx, externalRef, `
			SELECT a.question_id, a.format, a.given_answer, a.correct, a.response_ms, a.hint_used, a.created_at
			FROM question_attempts a
			JOIN students s ON s.id = a.student_id
			WHERE s.external_ref = $1
			ORDER BY a.created_at, a.id
			LIMIT `+strconvPage(pageSize)+` OFFSET `+strconvPage(offset)+`
		`)
		if err != nil {
			return nil, err
		}
		attempts = append(attempts, page...)
		if len(page) < pageSize {
			return attempts, nil
		}
	}
}

func strconvPage(value int) string {
	return strconv.Itoa(value)
}

func (r *PostgresRepository) rowsForChild(ctx context.Context, externalRef string, query string) ([]map[string]any, error) {
	rows, err := r.db.Query(ctx, query, externalRef)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			return nil, err
		}
		fields := rows.FieldDescriptions()
		item := map[string]any{}
		for i, field := range fields {
			item[string(field.Name)] = exportValue(values[i])
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func exportValue(value any) any {
	switch typed := value.(type) {
	case time.Time:
		return typed.UTC().Format(time.RFC3339)
	case []byte:
		var decoded any
		if json.Unmarshal(typed, &decoded) == nil {
			return decoded
		}
		return string(typed)
	case [16]byte:
		return fmt.Sprintf("%x", typed[:])
	default:
		return value
	}
}
