package learning

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

func (r *PostgresRepository) ListObjectives(ctx context.Context) ([]Objective, error) {
	if err := r.seedDefaultObjectives(ctx); err != nil {
		return nil, err
	}
	rows, err := r.db.Query(ctx, `
		SELECT
			o.id, o.year_group, o.subject, o.strand, o.topic, o.statement,
			o.parent_explanation, o.teacher_evidence, o.expected_mastery, o.secure_mastery,
			array_to_json(o.retention_days)::text,
			array_to_json(o.required_formats)::text,
			COALESCE((SELECT json_agg(p.prerequisite_id) FROM objective_prerequisites p WHERE p.objective_id=o.id), '[]')::text,
			COALESCE((SELECT json_agg(m.description) FROM objective_misconceptions m WHERE m.objective_id=o.id), '[]')::text
		FROM curriculum_objectives o
		ORDER BY o.year_group, o.subject, o.strand, o.topic, o.id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	objectives := []Objective{}
	for rows.Next() {
		objective, err := scanObjective(rows)
		if err != nil {
			return nil, err
		}
		objectives = append(objectives, objective)
	}
	return objectives, rows.Err()
}

func (r *PostgresRepository) GetObjective(ctx context.Context, id string) (Objective, bool, error) {
	if id == "" {
		return Objective{}, false, nil
	}
	if err := r.seedDefaultObjectives(ctx); err != nil {
		return Objective{}, false, err
	}
	row := r.db.QueryRow(ctx, `
		SELECT
			o.id, o.year_group, o.subject, o.strand, o.topic, o.statement,
			o.parent_explanation, o.teacher_evidence, o.expected_mastery, o.secure_mastery,
			array_to_json(o.retention_days)::text,
			array_to_json(o.required_formats)::text,
			COALESCE((SELECT json_agg(p.prerequisite_id) FROM objective_prerequisites p WHERE p.objective_id=o.id), '[]')::text,
			COALESCE((SELECT json_agg(m.description) FROM objective_misconceptions m WHERE m.objective_id=o.id), '[]')::text
		FROM curriculum_objectives o
		WHERE o.id=$1
	`, id)
	objective, err := scanObjective(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Objective{}, false, nil
	}
	if err != nil {
		return Objective{}, false, err
	}
	return objective, true, nil
}

func (r *PostgresRepository) UpsertObjective(ctx context.Context, objective Objective) (Objective, error) {
	if objective.ID == "" {
		return objective, errors.New("objective id is required")
	}
	if objective.Mastery.Expected == 0 {
		objective.Mastery.Expected = 80
	}
	if objective.Mastery.Secure == 0 {
		objective.Mastery.Secure = 90
	}
	if len(objective.Mastery.RetentionDays) == 0 {
		objective.Mastery.RetentionDays = []int{1, 3, 7, 14, 30}
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return objective, err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		INSERT INTO curriculum_objectives (
			id, year_group, subject, strand, topic, statement, parent_explanation,
			teacher_evidence, expected_mastery, secure_mastery, retention_days, required_formats, updated_at
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())
		ON CONFLICT (id) DO UPDATE SET
			year_group = EXCLUDED.year_group,
			subject = EXCLUDED.subject,
			strand = EXCLUDED.strand,
			topic = EXCLUDED.topic,
			statement = EXCLUDED.statement,
			parent_explanation = EXCLUDED.parent_explanation,
			teacher_evidence = EXCLUDED.teacher_evidence,
			expected_mastery = EXCLUDED.expected_mastery,
			secure_mastery = EXCLUDED.secure_mastery,
			retention_days = EXCLUDED.retention_days,
			required_formats = EXCLUDED.required_formats,
			updated_at = now()
	`, objective.ID, objective.Year, objective.Subject, objective.Strand, objective.Topic, objective.Statement,
		objective.ParentExplanation, objective.TeacherEvidence, objective.Mastery.Expected, objective.Mastery.Secure,
		objective.Mastery.RetentionDays, objective.Mastery.RequiredFormats); err != nil {
		return objective, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM objective_prerequisites WHERE objective_id=$1`, objective.ID); err != nil {
		return objective, err
	}
	for _, prerequisite := range objective.Prerequisites {
		if _, err := tx.Exec(ctx, `INSERT INTO objective_prerequisites (objective_id, prerequisite_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, objective.ID, prerequisite); err != nil {
			return objective, err
		}
	}
	if _, err := tx.Exec(ctx, `DELETE FROM objective_misconceptions WHERE objective_id=$1`, objective.ID); err != nil {
		return objective, err
	}
	for _, misconception := range objective.Misconceptions {
		if _, err := tx.Exec(ctx, `INSERT INTO objective_misconceptions (objective_id, description) VALUES ($1,$2)`, objective.ID, misconception); err != nil {
			return objective, err
		}
	}
	if _, err := tx.Exec(ctx, `INSERT INTO audit_logs (action, entity_type, entity_id, payload) VALUES ('upsert', 'curriculum_objective', $1, $2::jsonb)`, objective.ID, mustJSON(objective)); err != nil {
		return objective, err
	}
	if err := tx.Commit(ctx); err != nil {
		return objective, err
	}
	return objective, nil
}

func (r *PostgresRepository) ListFeatureFlags(ctx context.Context) ([]FeatureFlag, error) {
	rows, err := r.db.Query(ctx, `SELECT key, enabled, config, description, updated_at FROM feature_flags ORDER BY key`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	flags := []FeatureFlag{}
	for rows.Next() {
		var flag FeatureFlag
		var raw []byte
		var updatedAt time.Time
		if err := rows.Scan(&flag.Key, &flag.Enabled, &raw, &flag.Description, &updatedAt); err != nil {
			return nil, err
		}
		flag.Config = map[string]any{}
		_ = json.Unmarshal(raw, &flag.Config)
		flag.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		flags = append(flags, flag)
	}
	return flags, rows.Err()
}

func (r *PostgresRepository) UpsertFeatureFlag(ctx context.Context, flag FeatureFlag) (FeatureFlag, error) {
	if flag.Key == "" {
		return flag, errors.New("feature flag key is required")
	}
	if flag.Config == nil {
		flag.Config = map[string]any{}
	}
	var updatedAt time.Time
	err := r.db.QueryRow(ctx, `
		INSERT INTO feature_flags (key, enabled, config, description, updated_at)
		VALUES ($1,$2,$3::jsonb,$4,now())
		ON CONFLICT (key) DO UPDATE SET
			enabled = EXCLUDED.enabled,
			config = EXCLUDED.config,
			description = EXCLUDED.description,
			updated_at = now()
		RETURNING updated_at
	`, flag.Key, flag.Enabled, mustJSON(flag.Config), flag.Description).Scan(&updatedAt)
	flag.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return flag, err
}

func (r *PostgresRepository) ListWorlds(ctx context.Context) ([]WorldConfig, error) {
	rows, err := r.db.Query(ctx, `SELECT key, name, COALESCE(year_group, 0), theme, config, enabled, updated_at FROM worlds ORDER BY year_group, key`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	worlds := []WorldConfig{}
	for rows.Next() {
		world, err := scanWorld(rows)
		if err != nil {
			return nil, err
		}
		worlds = append(worlds, world)
	}
	return worlds, rows.Err()
}

func (r *PostgresRepository) UpsertWorld(ctx context.Context, world WorldConfig) (WorldConfig, error) {
	if world.Key == "" {
		return world, errors.New("world key is required")
	}
	if world.Config == nil {
		world.Config = map[string]any{}
	}
	var updatedAt time.Time
	err := r.db.QueryRow(ctx, `
		INSERT INTO worlds (key, name, year_group, theme, config, enabled, updated_at)
		VALUES ($1,$2,NULLIF($3,0),$4,$5::jsonb,$6,now())
		ON CONFLICT (key) DO UPDATE SET
			name = EXCLUDED.name,
			year_group = EXCLUDED.year_group,
			theme = EXCLUDED.theme,
			config = EXCLUDED.config,
			enabled = EXCLUDED.enabled,
			updated_at = now()
		RETURNING updated_at
	`, world.Key, world.Name, world.YearGroup, world.Theme, mustJSON(world.Config), world.Enabled).Scan(&updatedAt)
	world.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return world, err
}

func (r *PostgresRepository) ListActivities(ctx context.Context) ([]ActivityConfig, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, COALESCE(objective_id,''), COALESCE(template_id,''), world_key, title, prompt, difficulty,
		       interaction, feedback, animation_hooks, status, updated_at
		FROM activities
		ORDER BY updated_at DESC, id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	activities := []ActivityConfig{}
	for rows.Next() {
		activity, err := scanActivity(rows)
		if err != nil {
			return nil, err
		}
		activities = append(activities, activity)
	}
	return activities, rows.Err()
}

func (r *PostgresRepository) UpsertActivity(ctx context.Context, activity ActivityConfig) (ActivityConfig, error) {
	if activity.ID == "" {
		return activity, errors.New("activity id is required")
	}
	if activity.Interaction == nil {
		activity.Interaction = map[string]any{}
	}
	if activity.Feedback == nil {
		activity.Feedback = map[string]any{}
	}
	if activity.AnimationHooks == nil {
		activity.AnimationHooks = map[string]any{}
	}
	if activity.Status == "" {
		activity.Status = "draft"
	}
	var updatedAt time.Time
	err := r.db.QueryRow(ctx, `
		INSERT INTO activities (
			id, objective_id, template_id, world_key, title, prompt, difficulty,
			interaction, feedback, animation_hooks, status, updated_at
		)
		VALUES ($1,NULLIF($2,''),NULLIF($3,''),$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11,now())
		ON CONFLICT (id) DO UPDATE SET
			objective_id = EXCLUDED.objective_id,
			template_id = EXCLUDED.template_id,
			world_key = EXCLUDED.world_key,
			title = EXCLUDED.title,
			prompt = EXCLUDED.prompt,
			difficulty = EXCLUDED.difficulty,
			interaction = EXCLUDED.interaction,
			feedback = EXCLUDED.feedback,
			animation_hooks = EXCLUDED.animation_hooks,
			status = EXCLUDED.status,
			updated_at = now()
		RETURNING updated_at
	`, activity.ID, activity.ObjectiveID, activity.TemplateID, activity.WorldKey, activity.Title, activity.Prompt,
		activity.Difficulty, mustJSON(activity.Interaction), mustJSON(activity.Feedback), mustJSON(activity.AnimationHooks), activity.Status).Scan(&updatedAt)
	activity.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return activity, err
}

func (r *PostgresRepository) ListQuestions(ctx context.Context) ([]QuestionConfig, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, COALESCE(activity_id,''), COALESCE(objective_id,''), format, body, expected_answer,
		       hints, explanation, difficulty, status, updated_at
		FROM questions
		ORDER BY updated_at DESC, id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	questions := []QuestionConfig{}
	for rows.Next() {
		question, err := scanQuestion(rows)
		if err != nil {
			return nil, err
		}
		questions = append(questions, question)
	}
	return questions, rows.Err()
}

func (r *PostgresRepository) UpsertQuestion(ctx context.Context, question QuestionConfig) (QuestionConfig, error) {
	if question.ID == "" {
		return question, errors.New("question id is required")
	}
	if question.Body == nil {
		question.Body = map[string]any{}
	}
	if question.ExpectedAnswer == nil {
		question.ExpectedAnswer = map[string]any{}
	}
	if question.Hints == nil {
		question.Hints = []string{}
	}
	if question.Status == "" {
		question.Status = "draft"
	}
	var updatedAt time.Time
	err := r.db.QueryRow(ctx, `
		INSERT INTO questions (
			id, activity_id, objective_id, format, body, expected_answer, hints,
			explanation, difficulty, status, updated_at
		)
		VALUES ($1,NULLIF($2,''),NULLIF($3,''),$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10,now())
		ON CONFLICT (id) DO UPDATE SET
			activity_id = EXCLUDED.activity_id,
			objective_id = EXCLUDED.objective_id,
			format = EXCLUDED.format,
			body = EXCLUDED.body,
			expected_answer = EXCLUDED.expected_answer,
			hints = EXCLUDED.hints,
			explanation = EXCLUDED.explanation,
			difficulty = EXCLUDED.difficulty,
			status = EXCLUDED.status,
			updated_at = now()
		RETURNING updated_at
	`, question.ID, question.ActivityID, question.ObjectiveID, question.Format, mustJSON(question.Body),
		mustJSON(question.ExpectedAnswer), mustJSON(question.Hints), question.Explanation, question.Difficulty, question.Status).Scan(&updatedAt)
	question.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return question, err
}

func (r *PostgresRepository) ListAuditLogs(ctx context.Context, limit int) ([]AuditLog, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	rows, err := r.db.Query(ctx, `
		SELECT id::text, action, entity_type, entity_id, payload, created_at
		FROM audit_logs
		ORDER BY created_at DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	logs := []AuditLog{}
	for rows.Next() {
		var item AuditLog
		var raw []byte
		var createdAt time.Time
		if err := rows.Scan(&item.ID, &item.Action, &item.EntityType, &item.EntityID, &raw, &createdAt); err != nil {
			return nil, err
		}
		item.Payload = map[string]any{}
		_ = json.Unmarshal(raw, &item.Payload)
		item.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		logs = append(logs, item)
	}
	return logs, rows.Err()
}

func scanObjective(row pgx.Row) (Objective, error) {
	var objective Objective
	var retentionDaysJSON, formatsJSON, prerequisitesJSON, misconceptionsJSON string
	err := row.Scan(
		&objective.ID,
		&objective.Year,
		&objective.Subject,
		&objective.Strand,
		&objective.Topic,
		&objective.Statement,
		&objective.ParentExplanation,
		&objective.TeacherEvidence,
		&objective.Mastery.Expected,
		&objective.Mastery.Secure,
		&retentionDaysJSON,
		&formatsJSON,
		&prerequisitesJSON,
		&misconceptionsJSON,
	)
	if err != nil {
		return objective, err
	}
	_ = json.Unmarshal([]byte(retentionDaysJSON), &objective.Mastery.RetentionDays)
	_ = json.Unmarshal([]byte(formatsJSON), &objective.Mastery.RequiredFormats)
	_ = json.Unmarshal([]byte(prerequisitesJSON), &objective.Prerequisites)
	_ = json.Unmarshal([]byte(misconceptionsJSON), &objective.Misconceptions)
	return objective, nil
}

func scanQuestion(row pgx.Row) (QuestionConfig, error) {
	var question QuestionConfig
	var bodyRaw, expectedRaw, hintsRaw []byte
	var updatedAt time.Time
	err := row.Scan(
		&question.ID,
		&question.ActivityID,
		&question.ObjectiveID,
		&question.Format,
		&bodyRaw,
		&expectedRaw,
		&hintsRaw,
		&question.Explanation,
		&question.Difficulty,
		&question.Status,
		&updatedAt,
	)
	if err != nil {
		return question, err
	}
	question.Body = map[string]any{}
	question.ExpectedAnswer = map[string]any{}
	question.Hints = []string{}
	_ = json.Unmarshal(bodyRaw, &question.Body)
	_ = json.Unmarshal(expectedRaw, &question.ExpectedAnswer)
	_ = json.Unmarshal(hintsRaw, &question.Hints)
	question.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return question, nil
}

func scanWorld(row pgx.Row) (WorldConfig, error) {
	var world WorldConfig
	var raw []byte
	var updatedAt time.Time
	err := row.Scan(&world.Key, &world.Name, &world.YearGroup, &world.Theme, &raw, &world.Enabled, &updatedAt)
	if err != nil {
		return world, err
	}
	world.Config = map[string]any{}
	_ = json.Unmarshal(raw, &world.Config)
	world.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return world, nil
}

func scanActivity(row pgx.Row) (ActivityConfig, error) {
	var activity ActivityConfig
	var interactionRaw, feedbackRaw, hooksRaw []byte
	var updatedAt time.Time
	err := row.Scan(
		&activity.ID,
		&activity.ObjectiveID,
		&activity.TemplateID,
		&activity.WorldKey,
		&activity.Title,
		&activity.Prompt,
		&activity.Difficulty,
		&interactionRaw,
		&feedbackRaw,
		&hooksRaw,
		&activity.Status,
		&updatedAt,
	)
	if err != nil {
		return activity, err
	}
	activity.Interaction = map[string]any{}
	activity.Feedback = map[string]any{}
	activity.AnimationHooks = map[string]any{}
	_ = json.Unmarshal(interactionRaw, &activity.Interaction)
	_ = json.Unmarshal(feedbackRaw, &activity.Feedback)
	_ = json.Unmarshal(hooksRaw, &activity.AnimationHooks)
	activity.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return activity, nil
}

func (r *PostgresRepository) seedDefaultObjectives(ctx context.Context) error {
	for _, objective := range Objectives() {
		if err := r.ensureObjective(ctx, objective.ID); err != nil {
			return err
		}
	}
	return nil
}

func mustJSON(v any) string {
	raw, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(raw)
}
