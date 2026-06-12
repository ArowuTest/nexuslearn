package learning

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var ErrInvalidConfiguration = errors.New("invalid configuration")

func (r *PostgresRepository) ListObjectives(ctx context.Context) ([]Objective, error) {
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
	if err := validateObjective(objective); err != nil {
		return objective, err
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
	if err := validateFeatureFlag(flag); err != nil {
		return flag, err
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
	if err == nil {
		_, err = r.db.Exec(ctx, `INSERT INTO audit_logs (action, entity_type, entity_id, payload) VALUES ('upsert', 'feature_flag', $1, $2::jsonb)`, flag.Key, mustJSON(flag))
	}
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
	if err := validateWorld(world); err != nil {
		return world, err
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
	if err == nil {
		_, err = r.db.Exec(ctx, `INSERT INTO audit_logs (action, entity_type, entity_id, payload) VALUES ('upsert', 'world', $1, $2::jsonb)`, world.Key, mustJSON(world))
	}
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
	if err := validateActivity(activity); err != nil {
		return activity, err
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
	if err == nil {
		_, err = r.db.Exec(ctx, `INSERT INTO audit_logs (action, entity_type, entity_id, payload) VALUES ('upsert', 'activity', $1, $2::jsonb)`, activity.ID, mustJSON(activity))
	}
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
	if err := validateQuestion(question); err != nil {
		return question, err
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
	if err == nil {
		_, err = r.db.Exec(ctx, `INSERT INTO audit_logs (action, entity_type, entity_id, payload) VALUES ('upsert', 'question', $1, $2::jsonb)`, question.ID, mustJSON(question))
	}
	question.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return question, err
}

func (r *PostgresRepository) ListRewardRules(ctx context.Context) ([]RewardRule, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, COALESCE(world_key,''), COALESCE(objective_id,''), trigger, reward_payload, enabled, updated_at
		FROM reward_rules
		ORDER BY enabled DESC, world_key, objective_id, trigger, id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	rules := []RewardRule{}
	for rows.Next() {
		var rule RewardRule
		var raw []byte
		var updatedAt time.Time
		if err := rows.Scan(&rule.ID, &rule.WorldKey, &rule.ObjectiveID, &rule.Trigger, &raw, &rule.Enabled, &updatedAt); err != nil {
			return nil, err
		}
		rule.RewardPayload = map[string]any{}
		_ = json.Unmarshal(raw, &rule.RewardPayload)
		rule.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		rules = append(rules, rule)
	}
	return rules, rows.Err()
}

func (r *PostgresRepository) UpsertRewardRule(ctx context.Context, rule RewardRule) (RewardRule, error) {
	if err := validateRewardRule(rule); err != nil {
		return rule, err
	}
	if rule.RewardPayload == nil {
		rule.RewardPayload = map[string]any{}
	}
	var updatedAt time.Time
	err := r.db.QueryRow(ctx, `
		INSERT INTO reward_rules (id, world_key, objective_id, trigger, reward_payload, enabled, updated_at)
		VALUES ($1,NULLIF($2,''),NULLIF($3,''),$4,$5::jsonb,$6,now())
		ON CONFLICT (id) DO UPDATE SET
			world_key = EXCLUDED.world_key,
			objective_id = EXCLUDED.objective_id,
			trigger = EXCLUDED.trigger,
			reward_payload = EXCLUDED.reward_payload,
			enabled = EXCLUDED.enabled,
			updated_at = now()
		RETURNING updated_at
	`, rule.ID, rule.WorldKey, rule.ObjectiveID, rule.Trigger, mustJSON(rule.RewardPayload), rule.Enabled).Scan(&updatedAt)
	if err == nil {
		_, err = r.db.Exec(ctx, `INSERT INTO audit_logs (action, entity_type, entity_id, payload) VALUES ('upsert', 'reward_rule', $1, $2::jsonb)`, rule.ID, mustJSON(rule))
	}
	rule.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return rule, err
}

func (r *PostgresRepository) ListStudents(ctx context.Context) ([]StudentProfileConfig, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id::text, external_ref, display_name, year_group, created_at, updated_at
		FROM students
		ORDER BY year_group, display_name, external_ref
		LIMIT 500
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	students := []StudentProfileConfig{}
	for rows.Next() {
		var student StudentProfileConfig
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&student.ID, &student.ExternalRef, &student.DisplayName, &student.YearGroup, &createdAt, &updatedAt); err != nil {
			return nil, err
		}
		student.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		student.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		students = append(students, student)
	}
	return students, rows.Err()
}

func (r *PostgresRepository) UpsertStudent(ctx context.Context, student StudentProfileConfig) (StudentProfileConfig, error) {
	if err := validateStudent(student); err != nil {
		return student, err
	}
	var id string
	var createdAt, updatedAt time.Time
	err := r.db.QueryRow(ctx, `
		INSERT INTO students (external_ref, display_name, year_group, updated_at)
		VALUES ($1,$2,$3,now())
		ON CONFLICT (external_ref) DO UPDATE SET
			display_name = EXCLUDED.display_name,
			year_group = EXCLUDED.year_group,
			updated_at = now()
		RETURNING id::text, created_at, updated_at
	`, student.ExternalRef, student.DisplayName, student.YearGroup).Scan(&id, &createdAt, &updatedAt)
	if err == nil {
		_, err = r.db.Exec(ctx, `INSERT INTO audit_logs (action, entity_type, entity_id, payload) VALUES ('upsert', 'student', $1, $2::jsonb)`, student.ExternalRef, mustJSON(student))
	}
	student.ID = id
	student.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	student.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return student, err
}

func (r *PostgresRepository) ListSchools(ctx context.Context) ([]SchoolConfig, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id::text, name, COALESCE(urn,''), status, created_at, updated_at
		FROM schools
		ORDER BY name, urn
		LIMIT 500
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	schools := []SchoolConfig{}
	for rows.Next() {
		var school SchoolConfig
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&school.ID, &school.Name, &school.URN, &school.Status, &createdAt, &updatedAt); err != nil {
			return nil, err
		}
		school.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		school.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		schools = append(schools, school)
	}
	return schools, rows.Err()
}

func (r *PostgresRepository) UpsertSchool(ctx context.Context, school SchoolConfig) (SchoolConfig, error) {
	if err := validateSchool(school); err != nil {
		return school, err
	}
	var id string
	var createdAt, updatedAt time.Time
	err := r.db.QueryRow(ctx, `
		INSERT INTO schools (name, urn, status, updated_at)
		VALUES ($1,$2,$3,now())
		ON CONFLICT (urn) WHERE urn IS NOT NULL AND urn <> '' DO UPDATE SET
			name = EXCLUDED.name,
			status = EXCLUDED.status,
			updated_at = now()
		RETURNING id::text, created_at, updated_at
	`, school.Name, school.URN, school.Status).Scan(&id, &createdAt, &updatedAt)
	if err == nil {
		_, err = r.db.Exec(ctx, `INSERT INTO audit_logs (action, entity_type, entity_id, payload) VALUES ('upsert', 'school', $1, $2::jsonb)`, school.URN, mustJSON(school))
	}
	school.ID = id
	school.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	school.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return school, err
}

func (r *PostgresRepository) ListSchoolUsers(ctx context.Context) ([]SchoolUserConfig, error) {
	rows, err := r.db.Query(ctx, `
		SELECT u.id::text, COALESCE(s.urn,''), COALESCE(s.name,''), COALESCE(u.email,''), u.display_name,
		       su.role, COALESCE(u.login_id,''), u.temporary_password_required, u.status, u.created_at, u.updated_at
		FROM school_users su
		JOIN app_users u ON u.id = su.user_id
		JOIN schools s ON s.id = su.school_id
		ORDER BY s.name, su.role, u.display_name
		LIMIT 500
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	users := []SchoolUserConfig{}
	for rows.Next() {
		user, err := scanSchoolUser(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, rows.Err()
}

func (r *PostgresRepository) UpsertSchoolUser(ctx context.Context, user SchoolUserConfig) (SchoolUserConfig, error) {
	if err := validateSchoolUser(user); err != nil {
		return user, err
	}
	email := strings.ToLower(strings.TrimSpace(user.Email))
	loginID := strings.ToLower(strings.TrimSpace(user.LoginID))
	if loginID == "" {
		loginID = slugForLogin(user.SchoolURN + "-" + user.DisplayName)
	}
	tempPassword := randomPassword()
	passwordHash := credentialHash(loginID, tempPassword)
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return user, err
	}
	defer tx.Rollback(ctx)

	var schoolExists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM schools WHERE urn=$1)`, user.SchoolURN).Scan(&schoolExists); err != nil {
		return user, err
	}
	if !schoolExists {
		return user, invalidConfig("school user school urn does not exist")
	}

	var userID string
	if err := tx.QueryRow(ctx, `
		INSERT INTO app_users (email, display_name, user_type, status, login_id, password_hash, temporary_password_required, updated_at)
		VALUES (NULLIF($1,''), $2, $3, $4, $5, $6, true, now())
		ON CONFLICT (email) DO UPDATE SET
			display_name = EXCLUDED.display_name,
			user_type = EXCLUDED.user_type,
			status = EXCLUDED.status,
			login_id = EXCLUDED.login_id,
			password_hash = EXCLUDED.password_hash,
			temporary_password_required = true,
			updated_at = now()
		RETURNING id::text
	`, email, strings.TrimSpace(user.DisplayName), userTypeForSchoolRole(user.Role), user.Status, loginID, passwordHash).Scan(&userID); err != nil {
		return user, err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO user_roles (user_id, role_id)
		VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, userID, roleForSchoolUser(user.Role)); err != nil {
		return user, err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO school_users (school_id, user_id, role, updated_at)
		VALUES ((SELECT id FROM schools WHERE urn=$1 LIMIT 1), $2, $3, now())
		ON CONFLICT (school_id, user_id) DO UPDATE SET
			role = EXCLUDED.role,
			updated_at = now()
	`, user.SchoolURN, userID, user.Role); err != nil {
		return user, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO audit_logs (action, entity_type, entity_id, payload) VALUES ('upsert', 'school_user', $1, $2::jsonb)`, userID, mustJSON(user)); err != nil {
		return user, err
	}
	if err := tx.Commit(ctx); err != nil {
		return user, err
	}
	saved, err := r.getSchoolUser(ctx, userID)
	if err != nil {
		return user, err
	}
	saved.TemporaryPassword = tempPassword
	return saved, nil
}

func (r *PostgresRepository) VerifySchoolUser(ctx context.Context, schoolURN string, loginID string, password string) (SchoolUserConfig, bool, error) {
	if blank(schoolURN) || blank(loginID) || blank(password) {
		return SchoolUserConfig{}, false, nil
	}
	row := r.db.QueryRow(ctx, `
		SELECT u.id::text, COALESCE(s.urn,''), COALESCE(s.name,''), COALESCE(u.email,''), u.display_name,
		       su.role, COALESCE(u.login_id,''), u.temporary_password_required, u.status, u.created_at, u.updated_at
		FROM school_users su
		JOIN app_users u ON u.id = su.user_id
		JOIN schools s ON s.id = su.school_id
		WHERE s.urn=$1
		  AND lower(u.login_id)=lower($2)
		  AND u.password_hash=$3
		  AND u.status='active'
		  AND su.role IN ('school_admin', 'teacher')
		LIMIT 1
	`, schoolURN, loginID, credentialHash(strings.ToLower(strings.TrimSpace(loginID)), password))
	user, err := scanSchoolUser(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return SchoolUserConfig{}, false, nil
	}
	if err != nil {
		return SchoolUserConfig{}, false, err
	}
	return user, true, nil
}

func (r *PostgresRepository) SchoolPortal(ctx context.Context, schoolURN string) (SchoolPortalConfig, error) {
	if blank(schoolURN) {
		return SchoolPortalConfig{}, invalidConfig("school urn is required")
	}
	schools, err := r.ListSchools(ctx)
	if err != nil {
		return SchoolPortalConfig{}, err
	}
	var school SchoolConfig
	for _, item := range schools {
		if item.URN == schoolURN {
			school = item
			break
		}
	}
	if school.URN == "" {
		return SchoolPortalConfig{}, invalidConfig("school urn does not exist")
	}
	classes, err := r.ListClasses(ctx)
	if err != nil {
		return SchoolPortalConfig{}, err
	}
	groups, err := r.ListGroups(ctx)
	if err != nil {
		return SchoolPortalConfig{}, err
	}
	credentials, err := r.ListStudentCredentials(ctx)
	if err != nil {
		return SchoolPortalConfig{}, err
	}
	users, err := r.ListSchoolUsers(ctx)
	if err != nil {
		return SchoolPortalConfig{}, err
	}
	out := SchoolPortalConfig{School: school}
	studentRefs := map[string]bool{}
	classIDs := map[string]bool{}
	for _, classConfig := range classes {
		if classConfig.SchoolURN != schoolURN {
			continue
		}
		out.Classes = append(out.Classes, classConfig)
		classIDs[classConfig.ID] = true
		for _, student := range classConfig.Students {
			studentRefs[student.ExternalRef] = true
		}
	}
	for _, group := range groups {
		if classIDs[group.ClassID] {
			out.Groups = append(out.Groups, group)
		}
	}
	for _, credential := range credentials {
		if studentRefs[credential.StudentExternalRef] {
			out.StudentCredentials = append(out.StudentCredentials, credential)
		}
	}
	for _, user := range users {
		if user.SchoolURN == schoolURN {
			out.Users = append(out.Users, user)
		}
	}
	return out, nil
}

func (r *PostgresRepository) ListClasses(ctx context.Context) ([]ClassConfig, error) {
	rows, err := r.db.Query(ctx, `
		SELECT c.id::text, COALESCE(c.school_id::text,''), COALESCE(s.urn,''), COALESCE(s.name,''), c.name, c.year_group,
		       c.created_at, c.updated_at
		FROM classes c
		LEFT JOIN schools s ON s.id = c.school_id
		ORDER BY s.name, c.year_group, c.name
		LIMIT 500
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	classes := []ClassConfig{}
	for rows.Next() {
		classConfig, err := r.scanClass(ctx, rows)
		if err != nil {
			return nil, err
		}
		classes = append(classes, classConfig)
	}
	return classes, rows.Err()
}

func (r *PostgresRepository) UpsertClass(ctx context.Context, classConfig ClassConfig) (ClassConfig, error) {
	if err := validateClass(classConfig); err != nil {
		return classConfig, err
	}
	var schoolExists bool
	if err := r.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM schools WHERE urn=$1)`, classConfig.SchoolURN).Scan(&schoolExists); err != nil {
		return classConfig, err
	}
	if !schoolExists {
		return classConfig, invalidConfig("class school urn does not exist")
	}
	var id string
	err := r.db.QueryRow(ctx, `
		INSERT INTO classes (school_id, name, year_group, updated_at)
		VALUES ((SELECT id FROM schools WHERE urn=$1 LIMIT 1), $2, $3, now())
		ON CONFLICT (school_id, name) DO UPDATE SET
			year_group = EXCLUDED.year_group,
			updated_at = now()
		RETURNING id::text
	`, classConfig.SchoolURN, classConfig.Name, classConfig.YearGroup).Scan(&id)
	if err != nil {
		return classConfig, err
	}
	_, err = r.db.Exec(ctx, `INSERT INTO audit_logs (action, entity_type, entity_id, payload) VALUES ('upsert', 'class', $1, $2::jsonb)`, id, mustJSON(classConfig))
	if err != nil {
		return classConfig, err
	}
	return r.getClass(ctx, id)
}

func (r *PostgresRepository) AssignStudentToClass(ctx context.Context, classID string, studentExternalRef string) (ClassConfig, error) {
	if blank(classID) {
		return ClassConfig{}, invalidConfig("class id is required")
	}
	if blank(studentExternalRef) {
		return ClassConfig{}, invalidConfig("student external ref is required")
	}
	var classExists, studentExists bool
	if err := r.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM classes WHERE id=$1)`, classID).Scan(&classExists); err != nil {
		return ClassConfig{}, err
	}
	if !classExists {
		return ClassConfig{}, invalidConfig("class id does not exist")
	}
	if err := r.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM students WHERE external_ref=$1)`, studentExternalRef).Scan(&studentExists); err != nil {
		return ClassConfig{}, err
	}
	if !studentExists {
		return ClassConfig{}, invalidConfig("student external ref does not exist")
	}
	_, err := r.db.Exec(ctx, `
		INSERT INTO class_students (class_id, student_id)
		VALUES ($1, (SELECT id FROM students WHERE external_ref=$2 LIMIT 1))
		ON CONFLICT DO NOTHING
	`, classID, studentExternalRef)
	if err != nil {
		return ClassConfig{}, err
	}
	_, err = r.db.Exec(ctx, `INSERT INTO audit_logs (action, entity_type, entity_id, payload) VALUES ('assign', 'class_student', $1, $2::jsonb)`,
		classID, mustJSON(map[string]string{"class_id": classID, "student_external_ref": studentExternalRef}))
	if err != nil {
		return ClassConfig{}, err
	}
	return r.getClass(ctx, classID)
}

func (r *PostgresRepository) ListStudentCredentials(ctx context.Context) ([]StudentCredentialConfig, error) {
	rows, err := r.db.Query(ctx, `
		SELECT s.external_ref, s.display_name, COALESCE(c.login_code,''), COALESCE(c.picture_password, '[]'::jsonb),
		       COALESCE(c.qr_secret_hash,''), COALESCE(c.updated_at, s.updated_at)
		FROM students s
		LEFT JOIN student_credentials c ON c.student_id = s.id
		ORDER BY s.year_group, s.display_name, s.external_ref
		LIMIT 500
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	credentials := []StudentCredentialConfig{}
	for rows.Next() {
		var credential StudentCredentialConfig
		var raw []byte
		var updatedAt time.Time
		if err := rows.Scan(&credential.StudentExternalRef, &credential.DisplayName, &credential.LoginCode, &raw, &credential.QRSecretHash, &updatedAt); err != nil {
			return nil, err
		}
		credential.PicturePassword = []string{}
		_ = json.Unmarshal(raw, &credential.PicturePassword)
		credential.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		credentials = append(credentials, credential)
	}
	return credentials, rows.Err()
}

func (r *PostgresRepository) UpsertStudentCredential(ctx context.Context, credential StudentCredentialConfig) (StudentCredentialConfig, error) {
	if err := validateStudentCredential(credential); err != nil {
		return credential, err
	}
	var studentExists bool
	if err := r.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM students WHERE external_ref=$1)`, credential.StudentExternalRef).Scan(&studentExists); err != nil {
		return credential, err
	}
	if !studentExists {
		return credential, invalidConfig("credential student external ref does not exist")
	}
	var updatedAt time.Time
	err := r.db.QueryRow(ctx, `
		INSERT INTO student_credentials (student_id, login_code, picture_password, qr_secret_hash, updated_at)
		VALUES ((SELECT id FROM students WHERE external_ref=$1 LIMIT 1), NULLIF($2,''), $3::jsonb, NULLIF($4,''), now())
		ON CONFLICT (student_id) DO UPDATE SET
			login_code = EXCLUDED.login_code,
			picture_password = EXCLUDED.picture_password,
			qr_secret_hash = EXCLUDED.qr_secret_hash,
			updated_at = now()
		RETURNING updated_at
	`, credential.StudentExternalRef, credential.LoginCode, mustJSON(credential.PicturePassword), credential.QRSecretHash).Scan(&updatedAt)
	if err == nil {
		_, err = r.db.Exec(ctx, `INSERT INTO audit_logs (action, entity_type, entity_id, payload) VALUES ('upsert', 'student_credential', $1, $2::jsonb)`, credential.StudentExternalRef, mustJSON(credential))
	}
	credential.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return credential, err
}

func (r *PostgresRepository) GenerateClassCredentials(ctx context.Context, classID string, overwrite bool, picturePool []string) (ClassCredentialBatch, error) {
	if blank(classID) {
		return ClassCredentialBatch{}, invalidConfig("class id is required")
	}
	if len(picturePool) == 0 {
		picturePool = []string{"star", "book", "sun", "tree", "rocket", "shell", "moon", "key"}
	}
	for _, item := range picturePool {
		if blank(item) {
			return ClassCredentialBatch{}, invalidConfig("picture pool items cannot be blank")
		}
	}
	var classExists bool
	if err := r.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM classes WHERE id=$1)`, classID).Scan(&classExists); err != nil {
		return ClassCredentialBatch{}, err
	}
	if !classExists {
		return ClassCredentialBatch{}, invalidConfig("class id does not exist")
	}
	students, err := r.classStudents(ctx, classID)
	if err != nil {
		return ClassCredentialBatch{}, err
	}
	batch := ClassCredentialBatch{
		ClassID:     classID,
		Overwrite:   overwrite,
		PicturePool: picturePool,
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		Credentials: []StudentCredentialConfig{},
	}
	for _, student := range students {
		if !overwrite {
			var hasCredential bool
			if err := r.db.QueryRow(ctx, `
				SELECT EXISTS (
					SELECT 1
					FROM student_credentials c
					JOIN students s ON s.id = c.student_id
					WHERE s.external_ref=$1
					  AND (c.login_code IS NOT NULL OR jsonb_array_length(c.picture_password) > 0)
				)
			`, student.ExternalRef).Scan(&hasCredential); err != nil {
				return batch, err
			}
			if hasCredential {
				continue
			}
		}
		credential := StudentCredentialConfig{
			StudentExternalRef: student.ExternalRef,
			DisplayName:        student.DisplayName,
			LoginCode:          loginCode(student.ExternalRef),
			PicturePassword:    picturePassword(picturePool, 3),
		}
		saved, err := r.UpsertStudentCredential(ctx, credential)
		if err != nil {
			return batch, err
		}
		batch.Credentials = append(batch.Credentials, saved)
	}
	batch.GeneratedCount = len(batch.Credentials)
	_, err = r.db.Exec(ctx, `INSERT INTO audit_logs (action, entity_type, entity_id, payload) VALUES ('generate', 'class_credentials', $1, $2::jsonb)`, classID, mustJSON(batch))
	return batch, err
}

func (r *PostgresRepository) ListGroups(ctx context.Context) ([]LearningGroupConfig, error) {
	rows, err := r.db.Query(ctx, `
		SELECT g.id::text, COALESCE(g.class_id::text,''), COALESCE(c.name,''), g.name, g.purpose, g.created_at, g.updated_at
		FROM learning_groups g
		LEFT JOIN classes c ON c.id = g.class_id
		ORDER BY c.year_group, c.name, g.name
		LIMIT 500
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	groups := []LearningGroupConfig{}
	for rows.Next() {
		group, err := r.scanGroup(ctx, rows)
		if err != nil {
			return nil, err
		}
		groups = append(groups, group)
	}
	return groups, rows.Err()
}

func (r *PostgresRepository) UpsertGroup(ctx context.Context, group LearningGroupConfig) (LearningGroupConfig, error) {
	if err := validateGroup(group); err != nil {
		return group, err
	}
	var classExists bool
	if err := r.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM classes WHERE id=$1)`, group.ClassID).Scan(&classExists); err != nil {
		return group, err
	}
	if !classExists {
		return group, invalidConfig("group class id does not exist")
	}
	var id string
	err := r.db.QueryRow(ctx, `
		INSERT INTO learning_groups (class_id, name, purpose, updated_at)
		VALUES ($1,$2,$3,now())
		ON CONFLICT (class_id, name) DO UPDATE SET
			purpose = EXCLUDED.purpose,
			updated_at = now()
		RETURNING id::text
	`, group.ClassID, group.Name, group.Purpose).Scan(&id)
	if err != nil {
		return group, err
	}
	_, err = r.db.Exec(ctx, `INSERT INTO audit_logs (action, entity_type, entity_id, payload) VALUES ('upsert', 'learning_group', $1, $2::jsonb)`, id, mustJSON(group))
	if err != nil {
		return group, err
	}
	return r.getGroup(ctx, id)
}

func (r *PostgresRepository) AssignStudentToGroup(ctx context.Context, groupID string, studentExternalRef string) (LearningGroupConfig, error) {
	if blank(groupID) {
		return LearningGroupConfig{}, invalidConfig("group id is required")
	}
	if blank(studentExternalRef) {
		return LearningGroupConfig{}, invalidConfig("student external ref is required")
	}
	var groupExists, studentExists bool
	if err := r.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM learning_groups WHERE id=$1)`, groupID).Scan(&groupExists); err != nil {
		return LearningGroupConfig{}, err
	}
	if !groupExists {
		return LearningGroupConfig{}, invalidConfig("group id does not exist")
	}
	if err := r.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM students WHERE external_ref=$1)`, studentExternalRef).Scan(&studentExists); err != nil {
		return LearningGroupConfig{}, err
	}
	if !studentExists {
		return LearningGroupConfig{}, invalidConfig("student external ref does not exist")
	}
	_, err := r.db.Exec(ctx, `
		INSERT INTO learning_group_students (group_id, student_id)
		VALUES ($1, (SELECT id FROM students WHERE external_ref=$2 LIMIT 1))
		ON CONFLICT DO NOTHING
	`, groupID, studentExternalRef)
	if err != nil {
		return LearningGroupConfig{}, err
	}
	_, err = r.db.Exec(ctx, `INSERT INTO audit_logs (action, entity_type, entity_id, payload) VALUES ('assign', 'learning_group_student', $1, $2::jsonb)`,
		groupID, mustJSON(map[string]string{"group_id": groupID, "student_external_ref": studentExternalRef}))
	if err != nil {
		return LearningGroupConfig{}, err
	}
	return r.getGroup(ctx, groupID)
}

func (r *PostgresRepository) ListParentLinks(ctx context.Context) ([]ParentLinkConfig, error) {
	rows, err := r.db.Query(ctx, `
		SELECT l.id::text, u.email, u.display_name, s.external_ref, s.display_name, l.relationship, l.status, l.created_at, l.updated_at
		FROM parent_student_links l
		JOIN app_users u ON u.id = l.parent_user_id
		JOIN students s ON s.id = l.student_id
		ORDER BY s.display_name, u.email
		LIMIT 500
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	links := []ParentLinkConfig{}
	for rows.Next() {
		var link ParentLinkConfig
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&link.ID, &link.ParentEmail, &link.ParentDisplayName, &link.StudentExternalRef, &link.StudentDisplayName, &link.Relationship, &link.Status, &createdAt, &updatedAt); err != nil {
			return nil, err
		}
		link.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		link.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		links = append(links, link)
	}
	return links, rows.Err()
}

func (r *PostgresRepository) UpsertParentLink(ctx context.Context, link ParentLinkConfig) (ParentLinkConfig, error) {
	if err := validateParentLink(link); err != nil {
		return link, err
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return link, err
	}
	defer tx.Rollback(ctx)
	var parentID, studentID string
	var parentDisplayName string
	if link.ParentDisplayName == "" {
		parentDisplayName = link.ParentEmail
	} else {
		parentDisplayName = link.ParentDisplayName
	}
	if err := tx.QueryRow(ctx, `
		INSERT INTO app_users (email, display_name, user_type, status, updated_at)
		VALUES ($1,$2,'parent','active',now())
		ON CONFLICT (email) DO UPDATE SET
			display_name = EXCLUDED.display_name,
			user_type = 'parent',
			status = 'active',
			updated_at = now()
		RETURNING id::text
	`, strings.ToLower(strings.TrimSpace(link.ParentEmail)), parentDisplayName).Scan(&parentID); err != nil {
		return link, err
	}
	if err := tx.QueryRow(ctx, `SELECT id::text FROM students WHERE external_ref=$1 LIMIT 1`, link.StudentExternalRef).Scan(&studentID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return link, invalidConfig("parent link student external ref does not exist")
		}
		return link, err
	}
	var id string
	var createdAt, updatedAt time.Time
	if err := tx.QueryRow(ctx, `
		INSERT INTO parent_student_links (parent_user_id, student_id, relationship, status, updated_at)
		VALUES ($1,$2,$3,$4,now())
		ON CONFLICT (parent_user_id, student_id) DO UPDATE SET
			relationship = EXCLUDED.relationship,
			status = EXCLUDED.status,
			updated_at = now()
		RETURNING id::text, created_at, updated_at
	`, parentID, studentID, link.Relationship, link.Status).Scan(&id, &createdAt, &updatedAt); err != nil {
		return link, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO audit_logs (action, entity_type, entity_id, payload) VALUES ('upsert', 'parent_student_link', $1, $2::jsonb)`, id, mustJSON(link)); err != nil {
		return link, err
	}
	if err := tx.Commit(ctx); err != nil {
		return link, err
	}
	link.ID = id
	link.ParentEmail = strings.ToLower(strings.TrimSpace(link.ParentEmail))
	link.ParentDisplayName = parentDisplayName
	link.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	link.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return link, nil
}

func (r *PostgresRepository) UpsertParentAccount(ctx context.Context, parent ParentAccountConfig) (ParentAccountConfig, error) {
	if err := validateParentAccount(parent); err != nil {
		return parent, err
	}
	email := strings.ToLower(strings.TrimSpace(parent.Email))
	loginID := strings.ToLower(strings.TrimSpace(parent.LoginID))
	if loginID == "" {
		loginID = email
	}
	password := parent.Password
	if password == "" {
		password = randomPassword()
		parent.TemporaryPassword = password
		parent.TemporaryPasswordRequired = true
	} else {
		parent.TemporaryPasswordRequired = false
	}
	if parent.Status == "" {
		parent.Status = "active"
	}
	var id string
	var createdAt, updatedAt time.Time
	err := r.db.QueryRow(ctx, `
		INSERT INTO app_users (email, display_name, user_type, status, login_id, password_hash, temporary_password_required, updated_at)
		VALUES ($1,$2,'parent',$3,$4,$5,$6,now())
		ON CONFLICT (email) DO UPDATE SET
			display_name = EXCLUDED.display_name,
			user_type = 'parent',
			status = EXCLUDED.status,
			login_id = EXCLUDED.login_id,
			password_hash = EXCLUDED.password_hash,
			temporary_password_required = EXCLUDED.temporary_password_required,
			updated_at = now()
		RETURNING id::text, created_at, updated_at
	`, email, strings.TrimSpace(parent.DisplayName), parent.Status, loginID, credentialHash(loginID, password), parent.TemporaryPasswordRequired).Scan(&id, &createdAt, &updatedAt)
	if err == nil {
		_, err = r.db.Exec(ctx, `INSERT INTO roles (id, description) VALUES ('parent', 'Can manage home child profiles and view family evidence.') ON CONFLICT DO NOTHING`)
	}
	if err == nil {
		_, err = r.db.Exec(ctx, `INSERT INTO user_roles (user_id, role_id) VALUES ($1, 'parent') ON CONFLICT DO NOTHING`, id)
	}
	if err == nil {
		_, err = r.db.Exec(ctx, `INSERT INTO audit_logs (action, entity_type, entity_id, payload) VALUES ('upsert', 'parent_account', $1, $2::jsonb)`, id, mustJSON(map[string]string{"email": email, "login_id": loginID}))
	}
	parent.ID = id
	parent.Email = email
	parent.LoginID = loginID
	parent.Password = ""
	parent.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	parent.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return parent, err
}

func (r *PostgresRepository) VerifyParentUser(ctx context.Context, loginID string, password string) (ParentAccountConfig, bool, error) {
	if blank(loginID) || blank(password) {
		return ParentAccountConfig{}, false, nil
	}
	loginID = strings.ToLower(strings.TrimSpace(loginID))
	row := r.db.QueryRow(ctx, `
		SELECT id::text, COALESCE(email,''), display_name, COALESCE(login_id,''), temporary_password_required, status, created_at, updated_at
		FROM app_users
		WHERE lower(COALESCE(login_id, email))=lower($1)
		  AND password_hash=$2
		  AND user_type='parent'
		  AND status='active'
		LIMIT 1
	`, loginID, credentialHash(loginID, password))
	parent, err := scanParentAccount(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return ParentAccountConfig{}, false, nil
	}
	if err != nil {
		return ParentAccountConfig{}, false, err
	}
	return parent, true, nil
}

func (r *PostgresRepository) ParentPortal(ctx context.Context, parentLoginID string) (ParentPortalConfig, error) {
	if blank(parentLoginID) {
		return ParentPortalConfig{}, invalidConfig("parent login id is required")
	}
	row := r.db.QueryRow(ctx, `
		SELECT id::text, COALESCE(email,''), display_name, COALESCE(login_id,''), temporary_password_required, status, created_at, updated_at
		FROM app_users
		WHERE lower(COALESCE(login_id, email))=lower($1)
		  AND user_type='parent'
		LIMIT 1
	`, strings.ToLower(strings.TrimSpace(parentLoginID)))
	parent, err := scanParentAccount(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return ParentPortalConfig{}, invalidConfig("parent account does not exist")
	}
	if err != nil {
		return ParentPortalConfig{}, err
	}
	rows, err := r.db.Query(ctx, `
		SELECT s.id::text, s.external_ref, s.display_name, s.year_group, s.created_at, s.updated_at
		FROM parent_student_links l
		JOIN app_users u ON u.id = l.parent_user_id
		JOIN students s ON s.id = l.student_id
		WHERE u.id=$1
		  AND l.status IN ('invited', 'active')
		ORDER BY s.display_name, s.external_ref
	`, parent.ID)
	if err != nil {
		return ParentPortalConfig{}, err
	}
	defer rows.Close()
	out := ParentPortalConfig{Parent: parent}
	for rows.Next() {
		var student StudentProfileConfig
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&student.ID, &student.ExternalRef, &student.DisplayName, &student.YearGroup, &createdAt, &updatedAt); err != nil {
			return ParentPortalConfig{}, err
		}
		student.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		student.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		credential, _ := r.studentCredential(ctx, student.ExternalRef)
		engagement, _ := r.studentEngagement(ctx, student.ExternalRef)
		out.Children = append(out.Children, ParentChildConfig{Student: student, Credential: credential, Engagement: engagement})
	}
	return out, rows.Err()
}

func (r *PostgresRepository) UpsertStudentEngagement(ctx context.Context, profile StudentEngagementProfile) (StudentEngagementProfile, error) {
	defaults := defaultStudentEngagement(profile.StudentExternalRef)
	if profile.CelebrationIntensity == "" {
		profile.CelebrationIntensity = defaults.CelebrationIntensity
	}
	if profile.SessionLength == "" {
		profile.SessionLength = defaults.SessionLength
	}
	if profile.SensoryLoad == "" {
		profile.SensoryLoad = defaults.SensoryLoad
	}
	if profile.AttentionSupport == "" {
		profile.AttentionSupport = defaults.AttentionSupport
	}
	if profile.CommunicationSupport == "" {
		profile.CommunicationSupport = defaults.CommunicationSupport
	}
	if profile.ProcessingSupport == "" {
		profile.ProcessingSupport = defaults.ProcessingSupport
	}
	if profile.ConfidenceSupport == "" {
		profile.ConfidenceSupport = defaults.ConfidenceSupport
	}
	if profile.CompanionStyle == "" {
		profile.CompanionStyle = defaults.CompanionStyle
	}
	if profile.RewardStyle == "" {
		profile.RewardStyle = defaults.RewardStyle
	}
	if profile.Interests == nil {
		profile.Interests = []string{}
	}
	if profile.DeclaredSupportNeeds == nil {
		profile.DeclaredSupportNeeds = []string{}
	}
	if profile.LearningApproaches == nil {
		profile.LearningApproaches = []string{}
	}
	if err := validateStudentEngagement(profile); err != nil {
		return profile, err
	}
	var updatedAt time.Time
	err := r.db.QueryRow(ctx, `
		INSERT INTO student_engagement_profiles (
			student_id, declared_support_needs, learning_approaches, celebration_intensity,
			audio_support, reading_support, session_length, sensory_load, attention_support,
			communication_support, processing_support, confidence_support, companion_style,
			reward_style, interests, notes, updated_at
		)
		VALUES ((SELECT id FROM students WHERE external_ref=$1 LIMIT 1), $2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,now())
		ON CONFLICT (student_id) DO UPDATE SET
			declared_support_needs = EXCLUDED.declared_support_needs,
			learning_approaches = EXCLUDED.learning_approaches,
			celebration_intensity = EXCLUDED.celebration_intensity,
			audio_support = EXCLUDED.audio_support,
			reading_support = EXCLUDED.reading_support,
			session_length = EXCLUDED.session_length,
			sensory_load = EXCLUDED.sensory_load,
			attention_support = EXCLUDED.attention_support,
			communication_support = EXCLUDED.communication_support,
			processing_support = EXCLUDED.processing_support,
			confidence_support = EXCLUDED.confidence_support,
			companion_style = EXCLUDED.companion_style,
			reward_style = EXCLUDED.reward_style,
			interests = EXCLUDED.interests,
			notes = EXCLUDED.notes,
			updated_at = now()
		RETURNING updated_at
	`, profile.StudentExternalRef, profile.DeclaredSupportNeeds, profile.LearningApproaches, profile.CelebrationIntensity,
		profile.AudioSupport, profile.ReadingSupport, profile.SessionLength, profile.SensoryLoad, profile.AttentionSupport,
		profile.CommunicationSupport, profile.ProcessingSupport, profile.ConfidenceSupport, profile.CompanionStyle,
		profile.RewardStyle, profile.Interests, strings.TrimSpace(profile.Notes)).Scan(&updatedAt)
	if err != nil {
		return profile, err
	}
	profile.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	_, err = r.db.Exec(ctx, `INSERT INTO audit_logs (action, entity_type, entity_id, payload) VALUES ('upsert', 'student_engagement_profile', $1, $2::jsonb)`, profile.StudentExternalRef, mustJSON(profile))
	return profile, err
}

func (r *PostgresRepository) ListAccessRequests(ctx context.Context, status string) ([]AccessRequestConfig, error) {
	status = strings.ToLower(strings.TrimSpace(status))
	args := []any{}
	query := `
		SELECT id::text, request_type, organisation_name, contact_name, contact_email, phone, role, region,
		       COALESCE(learner_count, 0), array_to_json(year_groups)::text, message, status, source, created_at, updated_at
		FROM access_requests
	`
	if status != "" {
		if !validAccessRequestStatus(status) {
			return nil, invalidConfig("access request status is not valid")
		}
		query += ` WHERE status=$1`
		args = append(args, status)
	}
	query += ` ORDER BY created_at DESC LIMIT 500`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	requests := []AccessRequestConfig{}
	for rows.Next() {
		request, err := scanAccessRequest(rows)
		if err != nil {
			return nil, err
		}
		requests = append(requests, request)
	}
	return requests, rows.Err()
}

func (r *PostgresRepository) CreateAccessRequest(ctx context.Context, request AccessRequestConfig) (AccessRequestConfig, error) {
	request.Status = "new"
	if blank(request.Source) {
		request.Source = "public_site"
	}
	if err := validateAccessRequest(request); err != nil {
		return request, err
	}
	request.ContactEmail = strings.ToLower(strings.TrimSpace(request.ContactEmail))
	request.RequestType = strings.ToLower(strings.TrimSpace(request.RequestType))
	var learnerCount any
	if request.LearnerCount > 0 {
		learnerCount = request.LearnerCount
	}
	row := r.db.QueryRow(ctx, `
		INSERT INTO access_requests (
			request_type, organisation_name, contact_name, contact_email, phone, role, region,
			learner_count, year_groups, message, status, source, updated_at
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'new',$11,now())
		RETURNING id::text, request_type, organisation_name, contact_name, contact_email, phone, role, region,
		          COALESCE(learner_count, 0), array_to_json(year_groups)::text, message, status, source, created_at, updated_at
	`, request.RequestType, strings.TrimSpace(request.OrganisationName), strings.TrimSpace(request.ContactName), request.ContactEmail,
		strings.TrimSpace(request.Phone), strings.TrimSpace(request.Role), strings.TrimSpace(request.Region),
		learnerCount, request.YearGroups, strings.TrimSpace(request.Message), request.Source)
	saved, err := scanAccessRequest(row)
	if err == nil {
		_, err = r.db.Exec(ctx, `INSERT INTO audit_logs (action, entity_type, entity_id, payload) VALUES ('create', 'access_request', $1, $2::jsonb)`, saved.ID, mustJSON(saved))
	}
	return saved, err
}

func (r *PostgresRepository) UpdateAccessRequestStatus(ctx context.Context, id string, status string) (AccessRequestConfig, error) {
	if blank(id) {
		return AccessRequestConfig{}, invalidConfig("access request id is required")
	}
	status = strings.ToLower(strings.TrimSpace(status))
	if !validAccessRequestStatus(status) {
		return AccessRequestConfig{}, invalidConfig("access request status is not valid")
	}
	row := r.db.QueryRow(ctx, `
		UPDATE access_requests
		SET status=$2, updated_at=now()
		WHERE id=$1
		RETURNING id::text, request_type, organisation_name, contact_name, contact_email, phone, role, region,
		          COALESCE(learner_count, 0), array_to_json(year_groups)::text, message, status, source, created_at, updated_at
	`, id, status)
	saved, err := scanAccessRequest(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return AccessRequestConfig{}, invalidConfig("access request id does not exist")
	}
	if err == nil {
		_, err = r.db.Exec(ctx, `INSERT INTO audit_logs (action, entity_type, entity_id, payload) VALUES ('status', 'access_request', $1, $2::jsonb)`, saved.ID, mustJSON(saved))
	}
	return saved, err
}

func (r *PostgresRepository) getClass(ctx context.Context, id string) (ClassConfig, error) {
	row := r.db.QueryRow(ctx, `
		SELECT c.id::text, COALESCE(c.school_id::text,''), COALESCE(s.urn,''), COALESCE(s.name,''), c.name, c.year_group,
		       c.created_at, c.updated_at
		FROM classes c
		LEFT JOIN schools s ON s.id = c.school_id
		WHERE c.id=$1
	`, id)
	return r.scanClass(ctx, row)
}

func (r *PostgresRepository) getGroup(ctx context.Context, id string) (LearningGroupConfig, error) {
	row := r.db.QueryRow(ctx, `
		SELECT g.id::text, COALESCE(g.class_id::text,''), COALESCE(c.name,''), g.name, g.purpose, g.created_at, g.updated_at
		FROM learning_groups g
		LEFT JOIN classes c ON c.id = g.class_id
		WHERE g.id=$1
	`, id)
	return r.scanGroup(ctx, row)
}

func (r *PostgresRepository) scanGroup(ctx context.Context, row pgx.Row) (LearningGroupConfig, error) {
	var group LearningGroupConfig
	var createdAt, updatedAt time.Time
	if err := row.Scan(&group.ID, &group.ClassID, &group.ClassName, &group.Name, &group.Purpose, &createdAt, &updatedAt); err != nil {
		return group, err
	}
	group.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	group.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	students, err := r.groupStudents(ctx, group.ID)
	if err != nil {
		return group, err
	}
	group.Students = students
	return group, nil
}

func (r *PostgresRepository) groupStudents(ctx context.Context, groupID string) ([]StudentProfileConfig, error) {
	rows, err := r.db.Query(ctx, `
		SELECT s.id::text, s.external_ref, s.display_name, s.year_group, s.created_at, s.updated_at
		FROM learning_group_students gs
		JOIN students s ON s.id = gs.student_id
		WHERE gs.group_id=$1
		ORDER BY s.display_name, s.external_ref
	`, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	students := []StudentProfileConfig{}
	for rows.Next() {
		var student StudentProfileConfig
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&student.ID, &student.ExternalRef, &student.DisplayName, &student.YearGroup, &createdAt, &updatedAt); err != nil {
			return nil, err
		}
		student.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		student.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		students = append(students, student)
	}
	return students, rows.Err()
}

func (r *PostgresRepository) scanClass(ctx context.Context, row pgx.Row) (ClassConfig, error) {
	var classConfig ClassConfig
	var createdAt, updatedAt time.Time
	if err := row.Scan(&classConfig.ID, &classConfig.SchoolID, &classConfig.SchoolURN, &classConfig.SchoolName, &classConfig.Name, &classConfig.YearGroup, &createdAt, &updatedAt); err != nil {
		return classConfig, err
	}
	classConfig.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	classConfig.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	students, err := r.classStudents(ctx, classConfig.ID)
	if err != nil {
		return classConfig, err
	}
	classConfig.Students = students
	return classConfig, nil
}

func (r *PostgresRepository) classStudents(ctx context.Context, classID string) ([]StudentProfileConfig, error) {
	rows, err := r.db.Query(ctx, `
		SELECT s.id::text, s.external_ref, s.display_name, s.year_group, s.created_at, s.updated_at
		FROM class_students cs
		JOIN students s ON s.id = cs.student_id
		WHERE cs.class_id=$1
		ORDER BY s.display_name, s.external_ref
	`, classID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	students := []StudentProfileConfig{}
	for rows.Next() {
		var student StudentProfileConfig
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&student.ID, &student.ExternalRef, &student.DisplayName, &student.YearGroup, &createdAt, &updatedAt); err != nil {
			return nil, err
		}
		student.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		student.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		students = append(students, student)
	}
	return students, rows.Err()
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

func scanAccessRequest(row pgx.Row) (AccessRequestConfig, error) {
	var request AccessRequestConfig
	var yearGroupsJSON string
	var createdAt, updatedAt time.Time
	err := row.Scan(
		&request.ID,
		&request.RequestType,
		&request.OrganisationName,
		&request.ContactName,
		&request.ContactEmail,
		&request.Phone,
		&request.Role,
		&request.Region,
		&request.LearnerCount,
		&yearGroupsJSON,
		&request.Message,
		&request.Status,
		&request.Source,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		return request, err
	}
	request.YearGroups = []int{}
	_ = json.Unmarshal([]byte(yearGroupsJSON), &request.YearGroups)
	request.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	request.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return request, nil
}

func scanSchoolUser(row pgx.Row) (SchoolUserConfig, error) {
	var user SchoolUserConfig
	var createdAt, updatedAt time.Time
	err := row.Scan(
		&user.ID,
		&user.SchoolURN,
		&user.SchoolName,
		&user.Email,
		&user.DisplayName,
		&user.Role,
		&user.LoginID,
		&user.TemporaryPasswordRequired,
		&user.Status,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		return user, err
	}
	user.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	user.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return user, nil
}

func scanParentAccount(row pgx.Row) (ParentAccountConfig, error) {
	var parent ParentAccountConfig
	var createdAt, updatedAt time.Time
	err := row.Scan(
		&parent.ID,
		&parent.Email,
		&parent.DisplayName,
		&parent.LoginID,
		&parent.TemporaryPasswordRequired,
		&parent.Status,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		return parent, err
	}
	parent.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	parent.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return parent, nil
}

func (r *PostgresRepository) studentCredential(ctx context.Context, externalRef string) (StudentCredentialConfig, error) {
	rows, err := r.ListStudentCredentials(ctx)
	if err != nil {
		return StudentCredentialConfig{StudentExternalRef: externalRef}, err
	}
	for _, credential := range rows {
		if credential.StudentExternalRef == externalRef {
			return credential, nil
		}
	}
	return StudentCredentialConfig{StudentExternalRef: externalRef}, nil
}

func (r *PostgresRepository) studentEngagement(ctx context.Context, externalRef string) (StudentEngagementProfile, error) {
	profile := defaultStudentEngagement(externalRef)
	var supportJSON, approachesJSON, interestsJSON string
	var updatedAt time.Time
	err := r.db.QueryRow(ctx, `
		SELECT array_to_json(declared_support_needs)::text, array_to_json(learning_approaches)::text,
		       celebration_intensity, audio_support, reading_support, session_length, sensory_load,
		       attention_support, communication_support, processing_support, confidence_support,
		       companion_style, reward_style, array_to_json(interests)::text, notes, updated_at
		FROM student_engagement_profiles p
		JOIN students s ON s.id = p.student_id
		WHERE s.external_ref=$1
	`, externalRef).Scan(&supportJSON, &approachesJSON, &profile.CelebrationIntensity, &profile.AudioSupport, &profile.ReadingSupport,
		&profile.SessionLength, &profile.SensoryLoad, &profile.AttentionSupport, &profile.CommunicationSupport,
		&profile.ProcessingSupport, &profile.ConfidenceSupport, &profile.CompanionStyle, &profile.RewardStyle,
		&interestsJSON, &profile.Notes, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return profile, nil
	}
	if err != nil {
		return profile, err
	}
	_ = json.Unmarshal([]byte(supportJSON), &profile.DeclaredSupportNeeds)
	_ = json.Unmarshal([]byte(approachesJSON), &profile.LearningApproaches)
	_ = json.Unmarshal([]byte(interestsJSON), &profile.Interests)
	profile.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return profile, nil
}

func (r *PostgresRepository) getSchoolUser(ctx context.Context, id string) (SchoolUserConfig, error) {
	row := r.db.QueryRow(ctx, `
		SELECT u.id::text, COALESCE(s.urn,''), COALESCE(s.name,''), COALESCE(u.email,''), u.display_name,
		       su.role, COALESCE(u.login_id,''), u.temporary_password_required, u.status, u.created_at, u.updated_at
		FROM school_users su
		JOIN app_users u ON u.id = su.user_id
		JOIN schools s ON s.id = su.school_id
		WHERE u.id=$1
	`, id)
	return scanSchoolUser(row)
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

func mustJSON(v any) string {
	raw, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(raw)
}

func validateWorld(world WorldConfig) error {
	if blank(world.Key) {
		return invalidConfig("world key is required")
	}
	if blank(world.Name) {
		return invalidConfig("world name is required")
	}
	if world.YearGroup < 0 || world.YearGroup > 7 {
		return invalidConfig("world year group must be 0 for all years or between 1 and 7")
	}
	if blank(world.Theme) {
		return invalidConfig("world theme is required")
	}
	return nil
}

func validateActivity(activity ActivityConfig) error {
	if blank(activity.ID) {
		return invalidConfig("activity id is required")
	}
	if blank(activity.ObjectiveID) {
		return invalidConfig("activity objective id is required")
	}
	if blank(activity.WorldKey) {
		return invalidConfig("activity world key is required")
	}
	if blank(activity.TemplateID) {
		return invalidConfig("activity template id is required")
	}
	if blank(activity.Title) {
		return invalidConfig("activity title is required")
	}
	if blank(activity.Prompt) {
		return invalidConfig("activity prompt is required")
	}
	if activity.Difficulty < 1 || activity.Difficulty > 10 {
		return invalidConfig("activity difficulty must be between 1 and 10")
	}
	if !validStatus(activity.Status) {
		return invalidConfig("activity status must be draft, review, approved, published, live or archived")
	}
	return nil
}

func validateQuestion(question QuestionConfig) error {
	if blank(question.ID) {
		return invalidConfig("question id is required")
	}
	if blank(question.ObjectiveID) {
		return invalidConfig("question objective id is required")
	}
	if blank(question.Format) {
		return invalidConfig("question format is required")
	}
	if question.Difficulty < 1 || question.Difficulty > 10 {
		return invalidConfig("question difficulty must be between 1 and 10")
	}
	if !validStatus(question.Status) {
		return invalidConfig("question status must be draft, review, approved, published, live or archived")
	}
	if isPublishedStatus(question.Status) && blank(question.ActivityID) {
		return invalidConfig("published questions must belong to an activity")
	}
	if isPublishedStatus(question.Status) && blank(question.Explanation) {
		return invalidConfig("published questions need an explanation")
	}
	if len(question.Body) == 0 {
		return invalidConfig("question body is required")
	}
	if len(question.ExpectedAnswer) == 0 {
		return invalidConfig("question expected answer is required")
	}
	if err := validateQuestionShape(question); err != nil {
		return err
	}
	return nil
}

func validateQuestionShape(question QuestionConfig) error {
	switch strings.ToLower(strings.TrimSpace(question.Format)) {
	case "multiple_choice":
		if blank(anyString(question.Body["prompt"])) {
			return invalidConfig("multiple_choice questions require body.prompt")
		}
		choices, ok := question.Body["choices"].([]any)
		if !ok || len(choices) < 2 {
			return invalidConfig("multiple_choice questions require at least two body.choices")
		}
		if _, ok := question.ExpectedAnswer["value"]; !ok {
			return invalidConfig("multiple_choice questions require expected_answer.value")
		}
	case "audio_blend", "audio-blend":
		if blank(anyString(question.Body["prompt"])) {
			return invalidConfig("audio_blend questions require body.prompt")
		}
		sounds, ok := question.Body["sounds"].([]any)
		if !ok || len(sounds) < 2 {
			return invalidConfig("audio_blend questions require at least two body.sounds")
		}
		choices, ok := question.Body["choices"].([]any)
		if !ok || len(choices) < 2 {
			return invalidConfig("audio_blend questions require at least two body.choices")
		}
		if blank(anyString(question.ExpectedAnswer["value"])) {
			return invalidConfig("audio_blend questions require expected_answer.value")
		}
	case "timed-recall", "timed_recall":
		if !numberLike(question.Body["a"]) || !numberLike(question.Body["b"]) {
			return invalidConfig("timed-recall questions require numeric body.a and body.b")
		}
		if !numberLike(question.ExpectedAnswer["value"]) {
			return invalidConfig("timed-recall questions require numeric expected_answer.value")
		}
	}
	return nil
}

func validateObjective(objective Objective) error {
	if blank(objective.ID) {
		return invalidConfig("objective id is required")
	}
	if objective.Year < 1 || objective.Year > 7 {
		return invalidConfig("objective year must be between 1 and 7")
	}
	if blank(objective.Subject) {
		return invalidConfig("objective subject is required")
	}
	if blank(objective.Strand) {
		return invalidConfig("objective strand is required")
	}
	if blank(objective.Topic) {
		return invalidConfig("objective topic is required")
	}
	if blank(objective.Statement) {
		return invalidConfig("objective statement is required")
	}
	if blank(objective.ParentExplanation) {
		return invalidConfig("objective parent explanation is required")
	}
	if blank(objective.TeacherEvidence) {
		return invalidConfig("objective teacher evidence is required")
	}
	if objective.Mastery.Expected < 1 || objective.Mastery.Expected > 100 {
		return invalidConfig("objective expected mastery must be between 1 and 100")
	}
	if objective.Mastery.Secure < objective.Mastery.Expected || objective.Mastery.Secure > 100 {
		return invalidConfig("objective secure mastery must be greater than or equal to expected mastery and no more than 100")
	}
	if len(objective.Mastery.RetentionDays) == 0 {
		return invalidConfig("objective retention days are required")
	}
	for _, day := range objective.Mastery.RetentionDays {
		if day < 1 {
			return invalidConfig("objective retention days must be positive")
		}
	}
	if len(objective.Mastery.RequiredFormats) == 0 {
		return invalidConfig("objective required formats are required")
	}
	if len(objective.Misconceptions) == 0 {
		return invalidConfig("objective misconceptions are required")
	}
	return nil
}

func validateFeatureFlag(flag FeatureFlag) error {
	if blank(flag.Key) {
		return invalidConfig("feature flag key is required")
	}
	if blank(flag.Description) {
		return invalidConfig("feature flag description is required")
	}
	return nil
}

func validateRewardRule(rule RewardRule) error {
	if blank(rule.ID) {
		return invalidConfig("reward rule id is required")
	}
	switch strings.ToLower(strings.TrimSpace(rule.Trigger)) {
	case "attempt.correct", "attempt.incorrect":
	default:
		return invalidConfig("reward rule trigger must be attempt.correct or attempt.incorrect")
	}
	if len(rule.RewardPayload) == 0 {
		return invalidConfig("reward rule payload is required")
	}
	for _, key := range []string{"reward_hook", "animation_hook", "feedback", "explanation", "evidence_event", "companion_prompt"} {
		if blank(anyString(rule.RewardPayload[key])) {
			return invalidConfig("reward rule payload requires " + key)
		}
	}
	return nil
}

func validateStudent(student StudentProfileConfig) error {
	if blank(student.ExternalRef) {
		return invalidConfig("student external ref is required")
	}
	if blank(student.DisplayName) {
		return invalidConfig("student display name is required")
	}
	if student.YearGroup < 1 || student.YearGroup > 7 {
		return invalidConfig("student year group must be between 1 and 7")
	}
	return nil
}

func validateSchool(school SchoolConfig) error {
	if blank(school.URN) {
		return invalidConfig("school urn is required")
	}
	if blank(school.Name) {
		return invalidConfig("school name is required")
	}
	switch strings.ToLower(strings.TrimSpace(school.Status)) {
	case "trial", "active", "paused", "archived":
		return nil
	default:
		return invalidConfig("school status must be trial, active, paused or archived")
	}
}

func validateSchoolUser(user SchoolUserConfig) error {
	if blank(user.SchoolURN) {
		return invalidConfig("school user school urn is required")
	}
	if blank(user.DisplayName) {
		return invalidConfig("school user display name is required")
	}
	if blank(user.Email) || !strings.Contains(user.Email, "@") {
		return invalidConfig("school user email is required")
	}
	switch strings.ToLower(strings.TrimSpace(user.Role)) {
	case "school_admin", "teacher":
	default:
		return invalidConfig("school user role must be school_admin or teacher")
	}
	switch strings.ToLower(strings.TrimSpace(user.Status)) {
	case "active", "invited", "paused", "archived":
		return nil
	default:
		return invalidConfig("school user status must be active, invited, paused or archived")
	}
}

func validateClass(classConfig ClassConfig) error {
	if blank(classConfig.SchoolURN) {
		return invalidConfig("class school urn is required")
	}
	if blank(classConfig.Name) {
		return invalidConfig("class name is required")
	}
	if classConfig.YearGroup < 1 || classConfig.YearGroup > 7 {
		return invalidConfig("class year group must be between 1 and 7")
	}
	return nil
}

func validateStudentCredential(credential StudentCredentialConfig) error {
	if blank(credential.StudentExternalRef) {
		return invalidConfig("credential student external ref is required")
	}
	if blank(credential.LoginCode) && len(credential.PicturePassword) == 0 {
		return invalidConfig("credential requires a login code or picture password")
	}
	if len(credential.PicturePassword) > 6 {
		return invalidConfig("picture password can contain up to six items")
	}
	for _, item := range credential.PicturePassword {
		if blank(item) {
			return invalidConfig("picture password items cannot be blank")
		}
	}
	return nil
}

func validateGroup(group LearningGroupConfig) error {
	if blank(group.ClassID) {
		return invalidConfig("group class id is required")
	}
	if blank(group.Name) {
		return invalidConfig("group name is required")
	}
	if blank(group.Purpose) {
		return invalidConfig("group purpose is required")
	}
	return nil
}

func validateParentLink(link ParentLinkConfig) error {
	if blank(link.ParentEmail) || !strings.Contains(link.ParentEmail, "@") {
		return invalidConfig("parent email is required")
	}
	if blank(link.StudentExternalRef) {
		return invalidConfig("parent link student external ref is required")
	}
	if blank(link.Relationship) {
		return invalidConfig("parent relationship is required")
	}
	switch strings.ToLower(strings.TrimSpace(link.Status)) {
	case "invited", "active", "paused", "revoked":
		return nil
	default:
		return invalidConfig("parent link status must be invited, active, paused or revoked")
	}
}

func validateParentAccount(parent ParentAccountConfig) error {
	if blank(parent.Email) || !strings.Contains(parent.Email, "@") {
		return invalidConfig("parent email is required")
	}
	if blank(parent.DisplayName) {
		return invalidConfig("parent display name is required")
	}
	if parent.Password != "" && len(parent.Password) < 8 {
		return invalidConfig("parent password must be at least eight characters")
	}
	if parent.Status == "" {
		return nil
	}
	switch strings.ToLower(strings.TrimSpace(parent.Status)) {
	case "active", "invited", "paused", "archived":
		return nil
	default:
		return invalidConfig("parent status must be active, invited, paused or archived")
	}
}

func validateStudentEngagement(profile StudentEngagementProfile) error {
	if blank(profile.StudentExternalRef) {
		return invalidConfig("engagement profile student external ref is required")
	}
	switch profile.CelebrationIntensity {
	case "quiet", "balanced", "big":
	default:
		return invalidConfig("celebration intensity must be quiet, balanced or big")
	}
	switch profile.SessionLength {
	case "short", "standard", "extended":
	default:
		return invalidConfig("session length must be short, standard or extended")
	}
	switch profile.SensoryLoad {
	case "low", "balanced", "high":
	default:
		return invalidConfig("sensory load must be low, balanced or high")
	}
	switch profile.AttentionSupport {
	case "standard", "chunked", "high_structure":
	default:
		return invalidConfig("attention support must be standard, chunked or high_structure")
	}
	switch profile.CommunicationSupport {
	case "standard", "visual", "audio_visual":
	default:
		return invalidConfig("communication support must be standard, visual or audio_visual")
	}
	switch profile.ProcessingSupport {
	case "standard", "extra_time", "step_by_step":
	default:
		return invalidConfig("processing support must be standard, extra_time or step_by_step")
	}
	switch profile.ConfidenceSupport {
	case "gentle", "balanced", "challenge":
	default:
		return invalidConfig("confidence support must be gentle, balanced or challenge")
	}
	switch profile.CompanionStyle {
	case "friendly", "funny", "calm", "coach":
	default:
		return invalidConfig("companion style must be friendly, funny, calm or coach")
	}
	switch profile.RewardStyle {
	case "world_building", "collecting", "story", "challenge":
	default:
		return invalidConfig("reward style must be world_building, collecting, story or challenge")
	}
	for _, interest := range profile.Interests {
		if blank(interest) {
			return invalidConfig("interests cannot contain blank values")
		}
	}
	validNeeds := map[string]bool{
		"adhd": true, "autism": true, "dyslexia": true, "dyspraxia": true,
		"dyscalculia": true, "speech_language": true, "sensory": true,
		"working_memory": true, "processing_speed": true, "eal": true,
		"hearing": true, "vision": true, "anxiety_confidence": true,
		"fine_motor": true, "other": true,
	}
	for _, need := range profile.DeclaredSupportNeeds {
		if !validNeeds[need] {
			return invalidConfig("declared support needs contain an unsupported value")
		}
	}
	validApproaches := map[string]bool{
		"predictable_routine": true, "short_bursts": true, "visual_steps": true,
		"audio_read_aloud": true, "reduced_motion": true, "low_sensory": true,
		"extra_processing_time": true, "worked_examples": true, "confidence_first": true,
		"movement_breaks": true, "teach_back": true, "high_challenge": true,
	}
	for _, approach := range profile.LearningApproaches {
		if !validApproaches[approach] {
			return invalidConfig("learning approaches contain an unsupported value")
		}
	}
	return nil
}

func defaultStudentEngagement(externalRef string) StudentEngagementProfile {
	return StudentEngagementProfile{
		StudentExternalRef:   externalRef,
		CelebrationIntensity: "balanced",
		AudioSupport:         false,
		ReadingSupport:       false,
		SessionLength:        "standard",
		SensoryLoad:          "balanced",
		AttentionSupport:     "standard",
		CommunicationSupport: "standard",
		ProcessingSupport:    "standard",
		ConfidenceSupport:    "balanced",
		CompanionStyle:       "friendly",
		RewardStyle:          "world_building",
		Interests:            []string{},
		DeclaredSupportNeeds: []string{},
		LearningApproaches:   []string{},
	}
}

func validateAccessRequest(request AccessRequestConfig) error {
	requestType := strings.ToLower(strings.TrimSpace(request.RequestType))
	switch requestType {
	case "parent", "school", "tutor_org":
	default:
		return invalidConfig("access request type must be parent, school or tutor_org")
	}
	if requestType != "parent" && blank(request.OrganisationName) {
		return invalidConfig("organisation name is required for school and tutor requests")
	}
	if blank(request.ContactName) {
		return invalidConfig("contact name is required")
	}
	if blank(request.ContactEmail) || !strings.Contains(request.ContactEmail, "@") {
		return invalidConfig("contact email is required")
	}
	if request.LearnerCount < 0 {
		return invalidConfig("learner count must be positive when provided")
	}
	for _, year := range request.YearGroups {
		if year < 1 || year > 7 {
			return invalidConfig("year groups must be between 1 and 7")
		}
	}
	if !validAccessRequestStatus(request.Status) {
		return invalidConfig("access request status is not valid")
	}
	if blank(request.Source) {
		return invalidConfig("access request source is required")
	}
	return nil
}

func validAccessRequestStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "new", "reviewing", "approved", "waitlisted", "rejected", "converted":
		return true
	default:
		return false
	}
}

func loginCode(externalRef string) string {
	base := strings.ToUpper(strings.ReplaceAll(externalRef, "-", ""))
	if len(base) > 4 {
		base = base[:4]
	}
	if base == "" {
		base = "NXL"
	}
	return base + "-" + randomDigits(4)
}

func randomPassword() string {
	return strings.ToLower(randomLetters(3)) + "-" + randomDigits(3) + "-" + strings.ToLower(randomLetters(3))
}

func randomLetters(length int) string {
	const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"
	var builder strings.Builder
	for i := 0; i < length; i++ {
		builder.WriteByte(letters[randomIndex(len(letters))])
	}
	return builder.String()
}

func credentialHash(loginID string, password string) string {
	sum := sha256.Sum256([]byte(strings.ToLower(strings.TrimSpace(loginID)) + ":" + password))
	return hex.EncodeToString(sum[:])
}

func roleForSchoolUser(role string) string {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "school_admin":
		return "school_admin"
	default:
		return "teacher"
	}
}

func userTypeForSchoolRole(role string) string {
	if strings.ToLower(strings.TrimSpace(role)) == "school_admin" {
		return "school_admin"
	}
	return "teacher"
}

func slugForLogin(value string) string {
	out := strings.ToLower(strings.TrimSpace(value))
	out = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			return r
		}
		return '-'
	}, out)
	out = strings.Trim(out, "-")
	for strings.Contains(out, "--") {
		out = strings.ReplaceAll(out, "--", "-")
	}
	if out == "" {
		return "school-user-" + randomDigits(4)
	}
	return out
}

func picturePassword(pool []string, count int) []string {
	if count <= 0 || len(pool) == 0 {
		return []string{}
	}
	out := make([]string, 0, count)
	used := map[int]bool{}
	for len(out) < count && len(used) < len(pool) {
		index := randomIndex(len(pool))
		if used[index] {
			continue
		}
		used[index] = true
		out = append(out, pool[index])
	}
	return out
}

func randomDigits(length int) string {
	var builder strings.Builder
	for i := 0; i < length; i++ {
		builder.WriteString(fmt.Sprint(randomIndex(10)))
	}
	return builder.String()
}

func randomIndex(max int) int {
	if max <= 0 {
		return 0
	}
	n, err := rand.Int(rand.Reader, big.NewInt(int64(max)))
	if err != nil {
		return int(time.Now().UnixNano() % int64(max))
	}
	return int(n.Int64())
}

func invalidConfig(message string) error {
	return fmt.Errorf("%w: %s", ErrInvalidConfiguration, message)
}

func validStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "draft", "review", "approved", "published", "live", "archived":
		return true
	default:
		return false
	}
}

func isPublishedStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "approved", "published", "live":
		return true
	default:
		return false
	}
}

func blank(value string) bool {
	return strings.TrimSpace(value) == ""
}

func anyString(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	default:
		return ""
	}
}

func numberLike(value any) bool {
	switch typed := value.(type) {
	case int:
		return true
	case int32:
		return true
	case int64:
		return true
	case float32:
		return true
	case float64:
		return true
	case json.Number:
		return typed.String() != ""
	default:
		return false
	}
}
