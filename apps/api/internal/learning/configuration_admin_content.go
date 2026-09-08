package learning

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"
)

func (r *PostgresRepository) ListActivityPage(ctx context.Context, query AdminContentPageQuery) (ActivityPage, error) {
	bounds, err := newAdminContentBounds(query, "activities")
	if err != nil {
		return ActivityPage{}, err
	}
	var hasCursor bool
	var beforeUpdatedAt time.Time
	var beforeID string
	if bounds.Cursor != nil {
		hasCursor = true
		beforeUpdatedAt, err = time.Parse(time.RFC3339Nano, bounds.Cursor.UpdatedAt)
		if err != nil {
			return ActivityPage{}, invalidConfig("invalid admin content cursor")
		}
		beforeID = bounds.Cursor.ID
	}
	rows, err := r.db.Query(ctx, `
		SELECT id, COALESCE(objective_id,''), COALESCE(template_id,''), world_key, title, prompt, difficulty,
		       interaction, feedback, animation_hooks, status, updated_at
		FROM activities
		WHERE (NOT $1::boolean OR updated_at < $2::timestamptz OR (updated_at = $2::timestamptz AND id > $3::text))
		ORDER BY updated_at DESC, id
		LIMIT $4
	`, hasCursor, beforeUpdatedAt, beforeID, bounds.QueryLimit)
	if err != nil {
		return ActivityPage{}, err
	}
	defer rows.Close()
	items := make([]ActivityConfig, 0, bounds.QueryLimit)
	for rows.Next() {
		item, err := scanActivity(rows)
		if err != nil {
			return ActivityPage{}, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return ActivityPage{}, err
	}
	return newActivityPage(items, bounds.Limit)
}

func (r *PostgresRepository) ListQuestionPage(ctx context.Context, query AdminContentPageQuery) (QuestionPage, error) {
	bounds, err := newAdminContentBounds(query, "questions")
	if err != nil {
		return QuestionPage{}, err
	}
	var hasCursor bool
	var beforeUpdatedAt time.Time
	var beforeID string
	if bounds.Cursor != nil {
		hasCursor = true
		beforeUpdatedAt, err = time.Parse(time.RFC3339Nano, bounds.Cursor.UpdatedAt)
		if err != nil {
			return QuestionPage{}, invalidConfig("invalid admin content cursor")
		}
		beforeID = bounds.Cursor.ID
	}
	rows, err := r.db.Query(ctx, `
		SELECT id, COALESCE(activity_id,''), COALESCE(objective_id,''), format, body, expected_answer,
		       hints, explanation, difficulty, status, updated_at
		FROM questions
		WHERE (NOT $1::boolean OR updated_at < $2::timestamptz OR (updated_at = $2::timestamptz AND id > $3::text))
		ORDER BY updated_at DESC, id
		LIMIT $4
	`, hasCursor, beforeUpdatedAt, beforeID, bounds.QueryLimit)
	if err != nil {
		return QuestionPage{}, err
	}
	defer rows.Close()
	items := make([]QuestionConfig, 0, bounds.QueryLimit)
	for rows.Next() {
		item, err := scanQuestion(rows)
		if err != nil {
			return QuestionPage{}, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return QuestionPage{}, err
	}
	return newQuestionPage(items, bounds.Limit)
}

func (r *PostgresRepository) ListRewardRulePage(ctx context.Context, query AdminContentPageQuery) (RewardRulePage, error) {
	bounds, err := newAdminContentBounds(query, "reward_rules")
	if err != nil {
		return RewardRulePage{}, err
	}
	var hasCursor bool
	var beforeUpdatedAt time.Time
	var beforeID string
	if bounds.Cursor != nil {
		hasCursor = true
		beforeUpdatedAt, err = time.Parse(time.RFC3339Nano, bounds.Cursor.UpdatedAt)
		if err != nil {
			return RewardRulePage{}, invalidConfig("invalid admin content cursor")
		}
		beforeID = bounds.Cursor.ID
	}
	rows, err := r.db.Query(ctx, `
		SELECT id, COALESCE(world_key,''), COALESCE(objective_id,''), trigger, reward_payload, enabled, updated_at
		FROM reward_rules
		WHERE (NOT $1::boolean OR updated_at < $2::timestamptz OR (updated_at = $2::timestamptz AND id > $3::text))
		ORDER BY updated_at DESC, id
		LIMIT $4
	`, hasCursor, beforeUpdatedAt, beforeID, bounds.QueryLimit)
	if err != nil {
		return RewardRulePage{}, err
	}
	defer rows.Close()
	items := make([]RewardRule, 0, bounds.QueryLimit)
	for rows.Next() {
		item, err := scanAdminRewardRule(rows)
		if err != nil {
			return RewardRulePage{}, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return RewardRulePage{}, err
	}
	return newRewardRulePage(items, bounds.Limit)
}

func (r *PostgresRepository) ListObjectivePage(ctx context.Context, query AdminContentPageQuery) (ObjectivePage, error) {
	bounds, err := newAdminContentBounds(query, "objectives")
	if err != nil {
		return ObjectivePage{}, err
	}
	var hasCursor bool
	var beforeYear int
	var beforeSubject, beforeStrand, beforeTopic, beforeID string
	if bounds.Cursor != nil {
		hasCursor = true
		beforeYear = bounds.Cursor.Year
		beforeSubject = bounds.Cursor.Subject
		beforeStrand = bounds.Cursor.Strand
		beforeTopic = bounds.Cursor.Topic
		beforeID = bounds.Cursor.ID
	}
	rows, err := r.db.Query(ctx, `
		WITH active_release AS (
			SELECT id
			FROM content_releases
			WHERE channel='live' AND status='applied'
			ORDER BY applied_at DESC NULLS LAST, id DESC
			LIMIT 1
		), objective_page AS (
			SELECT o.id, o.year_group, o.subject, o.strand, o.topic, o.statement,
			       o.parent_explanation, o.teacher_evidence, o.expected_mastery, o.secure_mastery,
			       array_to_json(o.retention_days)::text AS retention_days_json,
			       array_to_json(o.required_formats)::text AS required_formats_json
			FROM curriculum_objectives o
			LEFT JOIN active_release ON TRUE
			WHERE (active_release.id IS NULL OR o.content_release_id=active_release.id)
			  AND (
					NOT $1::boolean
					OR o.year_group > $2::int
					OR (o.year_group = $2::int AND (
						COALESCE(o.subject,'') > $3::text
						OR (COALESCE(o.subject,'') = $3::text AND (
							COALESCE(o.strand,'') > $4::text
							OR (COALESCE(o.strand,'') = $4::text AND (
								COALESCE(o.topic,'') > $5::text
								OR (COALESCE(o.topic,'') = $5::text AND o.id > $6::text)
							))
						))
					))
			  )
			ORDER BY o.year_group, o.subject, o.strand, o.topic, o.id
			LIMIT $7
		)
		SELECT p.id, p.year_group, p.subject, p.strand, p.topic, p.statement,
		       p.parent_explanation, p.teacher_evidence, p.expected_mastery, p.secure_mastery,
		       p.retention_days_json, p.required_formats_json,
		       COALESCE((SELECT json_agg(prerequisite_id ORDER BY prerequisite_id)
		                 FROM objective_prerequisites WHERE objective_id=p.id), '[]'::json)::text,
		       COALESCE((SELECT json_agg(description ORDER BY id)
		                 FROM objective_misconceptions WHERE objective_id=p.id), '[]'::json)::text
		FROM objective_page p
		ORDER BY p.year_group, p.subject, p.strand, p.topic, p.id
	`, hasCursor, beforeYear, beforeSubject, beforeStrand, beforeTopic, beforeID, bounds.QueryLimit)
	if err != nil {
		return ObjectivePage{}, err
	}
	defer rows.Close()
	items := make([]Objective, 0, bounds.QueryLimit)
	for rows.Next() {
		item, err := scanObjective(rows)
		if err != nil {
			return ObjectivePage{}, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return ObjectivePage{}, err
	}
	return newObjectivePage(items, bounds.Limit)
}

func scanAdminRewardRule(row pgx.Row) (RewardRule, error) {
	var rule RewardRule
	var raw []byte
	var updatedAt time.Time
	if err := row.Scan(&rule.ID, &rule.WorldKey, &rule.ObjectiveID, &rule.Trigger, &raw, &rule.Enabled, &updatedAt); err != nil {
		return rule, err
	}
	rule.RewardPayload = map[string]any{}
	_ = json.Unmarshal(raw, &rule.RewardPayload)
	rule.UpdatedAt = updatedAt.UTC().Format(time.RFC3339Nano)
	return rule, nil
}
