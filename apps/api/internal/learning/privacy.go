package learning

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var ErrChildDeletionBlocked = errors.New("this learner is enrolled at a school and cannot be deleted from the family account")

// FamilyLearningConsentStatement is the sentence shown beside the family
// create-child control. The API stores this exact wording when a parent ticks it.
const FamilyLearningConsentStatement = "I agree this child can use NexusLearn."

const familyLearningConsentPolicy = "2026-10"

type ConsentRecord struct {
	ID                 string `json:"id"`
	StudentExternalRef string `json:"student_external_ref"`
	Purpose            string `json:"purpose"`
	PolicyVersion      string `json:"policy_version"`
	Granted            bool   `json:"granted"`
	Region             string `json:"region"`
	Statement          string `json:"statement"`
	RecordedAt         string `json:"recorded_at"`
}

type PrivacySettings struct {
	AnalyticsEnabled bool   `json:"analytics_enabled"`
	MarketingEnabled bool   `json:"marketing_enabled"`
	ResearchEnabled  bool   `json:"research_enabled"`
	ShareWithSchool  bool   `json:"share_with_school"`
	CurriculumRegion string `json:"curriculum_region"`
	UpdatedAt        string `json:"updated_at,omitempty"`
}

type RetentionPolicy struct {
	Category   string `json:"category"`
	RetainDays int    `json:"retain_days"`
	Action     string `json:"action"`
	Notes      string `json:"notes"`
}

type ChildExport struct {
	ExportedAt string                   `json:"exported_at"`
	Student    StudentProfileConfig     `json:"student"`
	Engagement StudentEngagementProfile `json:"engagement"`
	Consents   []ConsentRecord          `json:"consents"`
	Privacy    PrivacySettings          `json:"privacy"`
	Mastery    []StudentMastery         `json:"mastery"`
	Attempts   []RecentAttempt          `json:"attempts"`
	Omissions  []string                 `json:"omissions"`
}

type DeletionReceipt struct {
	StudentRefHash string         `json:"student_ref_hash"`
	Status         string         `json:"status"`
	CompletedAt    string         `json:"completed_at"`
	Summary        map[string]int `json:"summary"`
}

func DefaultPrivacySettings() PrivacySettings {
	return PrivacySettings{CurriculumRegion: "england"}
}

func DefaultRetentionPolicies() []RetentionPolicy {
	return []RetentionPolicy{
		{Category: "learning_evidence", RetainDays: 730, Action: "delete_on_family_request", Notes: "Keep learning records for up to two years, or delete them sooner when a parent asks. Automatic deletion is not running."},
		{Category: "parental_consent", RetainDays: 2190, Action: "keep_after_account_deletion", Notes: "Keep the consent decision for six years so the family can show what was agreed. It does not keep the child's answers."},
		{Category: "login_lockout", RetainDays: 1, Action: "memory_only", Notes: "Failed login counts stay in the API process and are forgotten on restart."},
		{Category: "support_notes", RetainDays: 730, Action: "delete_on_family_request", Notes: "Support notes are private to the family or school and are removed with the learner."},
	}
}

func FamilyLearningConsent(studentExternalRef string) ConsentRecord {
	return ConsentRecord{
		StudentExternalRef: strings.TrimSpace(studentExternalRef),
		Purpose:            "core_learning",
		PolicyVersion:      familyLearningConsentPolicy,
		Granted:            true,
		Region:             "england",
		Statement:          FamilyLearningConsentStatement,
	}
}

func ValidConsentPurpose(purpose string) bool {
	switch strings.ToLower(strings.TrimSpace(purpose)) {
	case "core_learning", "school_reporting", "research":
		return true
	default:
		return false
	}
}

func NormalizeCurriculumRegion(region string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(region)) {
	case "", "england", "uk":
		return "england", nil
	case "nigeria", "ng":
		return "nigeria", nil
	default:
		return "", invalidConfig("curriculum region must be england or nigeria")
	}
}

func (r *PostgresRepository) RecordConsent(ctx context.Context, parentID string, record ConsentRecord) (ConsentRecord, error) {
	if strings.TrimSpace(parentID) == "" {
		return ConsentRecord{}, ErrParentChildForbidden
	}
	record.Purpose = strings.ToLower(strings.TrimSpace(record.Purpose))
	record.PolicyVersion = strings.TrimSpace(record.PolicyVersion)
	record.Statement = strings.TrimSpace(record.Statement)
	record.StudentExternalRef = strings.TrimSpace(record.StudentExternalRef)
	if !ValidConsentPurpose(record.Purpose) || record.PolicyVersion == "" || len(record.PolicyVersion) > 40 || record.Statement == "" || len(record.Statement) > 2000 {
		return ConsentRecord{}, invalidConfig("consent needs a known purpose, policy version and the statement the parent agreed to")
	}
	region, err := NormalizeCurriculumRegion(record.Region)
	if err != nil {
		return ConsentRecord{}, err
	}
	record.Region = region
	var studentID string
	err = r.db.QueryRow(ctx, `
		SELECT s.id::text
		FROM students s
		JOIN parent_student_links l ON l.student_id=s.id AND l.status='active'
		JOIN app_users u ON u.id=l.parent_user_id AND u.status='active'
		WHERE s.external_ref=$1 AND u.id=$2
	`, record.StudentExternalRef, parentID).Scan(&studentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ConsentRecord{}, ErrParentChildForbidden
	}
	if err != nil {
		return ConsentRecord{}, err
	}
	var recorded time.Time
	err = r.db.QueryRow(ctx, `
		INSERT INTO parental_consents(parent_user_id, student_external_ref, purpose, policy_version, granted, region, statement)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING id::text, recorded_at
	`, parentID, record.StudentExternalRef, record.Purpose, record.PolicyVersion, record.Granted, record.Region, record.Statement).Scan(&record.ID, &recorded)
	if err != nil {
		return ConsentRecord{}, err
	}
	record.RecordedAt = recorded.UTC().Format(time.RFC3339)
	return record, nil
}

func (r *PostgresRepository) ListConsent(ctx context.Context, parentID, studentExternalRef string) ([]ConsentRecord, error) {
	if strings.TrimSpace(parentID) == "" {
		return nil, ErrParentChildForbidden
	}
	var owned bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM students s
			JOIN parent_student_links l ON l.student_id=s.id AND l.status='active'
			WHERE s.external_ref=$1 AND l.parent_user_id=$2
		)
	`, strings.TrimSpace(studentExternalRef), parentID).Scan(&owned)
	if err != nil {
		return nil, err
	}
	if !owned {
		return nil, ErrParentChildForbidden
	}
	rows, err := r.db.Query(ctx, `
		SELECT id::text, student_external_ref, purpose, policy_version, granted, region, statement, recorded_at
		FROM parental_consents
		WHERE student_external_ref=$1
		ORDER BY recorded_at DESC, id DESC
		LIMIT 50
	`, strings.TrimSpace(studentExternalRef))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanConsents(rows)
}

func (r *PostgresRepository) ChildConsentRequired(ctx context.Context, studentExternalRef string) (bool, error) {
	var required bool
	err := r.db.QueryRow(ctx, `SELECT consent_required FROM students WHERE external_ref=$1`, strings.TrimSpace(studentExternalRef)).Scan(&required)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return required, err
}

func (r *PostgresRepository) CoreLearningConsentGranted(ctx context.Context, studentExternalRef string) (bool, error) {
	var granted bool
	err := r.db.QueryRow(ctx, `
		SELECT granted FROM parental_consents
		WHERE student_external_ref=$1 AND purpose='core_learning'
		ORDER BY recorded_at DESC, id DESC
		LIMIT 1
	`, strings.TrimSpace(studentExternalRef)).Scan(&granted)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return granted, err
}

func (r *PostgresRepository) FamilyPrivacy(ctx context.Context, parentID string) (PrivacySettings, error) {
	if strings.TrimSpace(parentID) == "" {
		return PrivacySettings{}, ErrParentChildForbidden
	}
	if _, err := r.db.Exec(ctx, `INSERT INTO family_privacy_settings(parent_user_id) VALUES ($1) ON CONFLICT (parent_user_id) DO NOTHING`, parentID); err != nil {
		return PrivacySettings{}, err
	}
	return r.readPrivacy(ctx, parentID)
}

func (r *PostgresRepository) SaveFamilyPrivacy(ctx context.Context, parentID string, settings PrivacySettings) (PrivacySettings, error) {
	if strings.TrimSpace(parentID) == "" {
		return PrivacySettings{}, ErrParentChildForbidden
	}
	region, err := NormalizeCurriculumRegion(settings.CurriculumRegion)
	if err != nil {
		return PrivacySettings{}, err
	}
	_, err = r.db.Exec(ctx, `
		INSERT INTO family_privacy_settings(parent_user_id, analytics_enabled, marketing_enabled, research_enabled, share_with_school, curriculum_region, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,now())
		ON CONFLICT (parent_user_id) DO UPDATE SET
			analytics_enabled=EXCLUDED.analytics_enabled,
			marketing_enabled=EXCLUDED.marketing_enabled,
			research_enabled=EXCLUDED.research_enabled,
			share_with_school=EXCLUDED.share_with_school,
			curriculum_region=EXCLUDED.curriculum_region,
			updated_at=now()
	`, parentID, settings.AnalyticsEnabled, settings.MarketingEnabled, settings.ResearchEnabled, settings.ShareWithSchool, region)
	if err != nil {
		return PrivacySettings{}, err
	}
	return r.readPrivacy(ctx, parentID)
}

func (r *PostgresRepository) readPrivacy(ctx context.Context, parentID string) (PrivacySettings, error) {
	var settings PrivacySettings
	var updated time.Time
	err := r.db.QueryRow(ctx, `
		SELECT analytics_enabled, marketing_enabled, research_enabled, share_with_school, curriculum_region, updated_at
		FROM family_privacy_settings WHERE parent_user_id=$1
	`, parentID).Scan(&settings.AnalyticsEnabled, &settings.MarketingEnabled, &settings.ResearchEnabled, &settings.ShareWithSchool, &settings.CurriculumRegion, &updated)
	if err != nil {
		return PrivacySettings{}, err
	}
	settings.UpdatedAt = updated.UTC().Format(time.RFC3339)
	return settings, nil
}

func (r *PostgresRepository) ExportChild(ctx context.Context, parentID, studentExternalRef string) (ChildExport, error) {
	export := ChildExport{ExportedAt: time.Now().UTC().Format(time.RFC3339), Omissions: []string{"login codes", "picture passwords", "card secrets", "other children's records"}}
	studentExternalRef = strings.TrimSpace(studentExternalRef)
	var studentID string
	err := r.db.QueryRow(ctx, `
		SELECT s.id::text, s.external_ref, s.display_name, s.year_group
		FROM students s
		JOIN parent_student_links l ON l.student_id=s.id AND l.status='active'
		WHERE s.external_ref=$1 AND l.parent_user_id=$2
	`, studentExternalRef, parentID).Scan(&studentID, &export.Student.ExternalRef, &export.Student.DisplayName, &export.Student.YearGroup)
	if errors.Is(err, pgx.ErrNoRows) {
		return ChildExport{}, ErrParentChildForbidden
	}
	if err != nil {
		return ChildExport{}, err
	}
	export.Student.ID = studentID
	if engagement, err := r.StudentEngagement(ctx, studentExternalRef); err == nil {
		export.Engagement = engagement
	}
	consents, err := r.ListConsent(ctx, parentID, studentExternalRef)
	if err != nil {
		return ChildExport{}, err
	}
	export.Consents = consents
	if privacy, err := r.FamilyPrivacy(ctx, parentID); err == nil {
		export.Privacy = privacy
	} else {
		export.Privacy = DefaultPrivacySettings()
	}
	mastery, err := r.ListMastery(ctx, studentExternalRef)
	if err != nil {
		return ChildExport{}, err
	}
	export.Mastery = mastery
	attempts, err := r.RecentAttempts(ctx, studentExternalRef, 200)
	if err != nil {
		return ChildExport{}, err
	}
	export.Attempts = attempts
	return export, nil
}

func (r *PostgresRepository) DeleteFamilyChild(ctx context.Context, parentID, studentExternalRef string) (DeletionReceipt, error) {
	studentExternalRef = strings.TrimSpace(studentExternalRef)
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return DeletionReceipt{}, err
	}
	defer tx.Rollback(ctx)
	var studentID, displayName string
	err = tx.QueryRow(ctx, `
		SELECT s.id::text, s.display_name
		FROM students s
		JOIN parent_student_links l ON l.student_id=s.id AND l.status='active'
		JOIN app_users u ON u.id=l.parent_user_id AND u.status='active'
		WHERE s.external_ref=$1 AND u.id=$2
		FOR UPDATE OF s
	`, studentExternalRef, parentID).Scan(&studentID, &displayName)
	if errors.Is(err, pgx.ErrNoRows) {
		return DeletionReceipt{}, ErrParentChildForbidden
	}
	if err != nil {
		return DeletionReceipt{}, err
	}
	var enrolled bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM class_students WHERE student_id=$1)`, studentID).Scan(&enrolled); err != nil {
		return DeletionReceipt{}, err
	}
	if enrolled {
		return DeletionReceipt{}, ErrChildDeletionBlocked
	}
	var attempts, mastery int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM question_attempts WHERE student_id=$1`, studentID).Scan(&attempts); err != nil {
		return DeletionReceipt{}, err
	}
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM student_objective_mastery WHERE student_id=$1`, studentID).Scan(&mastery); err != nil {
		return DeletionReceipt{}, err
	}
	sum := sha256.Sum256([]byte(strings.ToLower(studentExternalRef)))
	hash := hex.EncodeToString(sum[:])
	summary := map[string]int{"attempts": attempts, "mastery_rows": mastery}
	var completed time.Time
	if err := tx.QueryRow(ctx, `
		INSERT INTO data_deletion_records(parent_user_id, student_ref_hash, status, summary)
		VALUES ($1,$2,'completed',$3::jsonb)
		RETURNING completed_at
	`, parentID, hash, mustJSON(summary)).Scan(&completed); err != nil {
		return DeletionReceipt{}, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM students WHERE id=$1`, studentID); err != nil {
		return DeletionReceipt{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return DeletionReceipt{}, err
	}
	return DeletionReceipt{StudentRefHash: hash, Status: "completed", CompletedAt: completed.UTC().Format(time.RFC3339), Summary: summary}, nil
}

func scanConsents(rows pgx.Rows) ([]ConsentRecord, error) {
	records := []ConsentRecord{}
	for rows.Next() {
		var record ConsentRecord
		var recorded time.Time
		if err := rows.Scan(&record.ID, &record.StudentExternalRef, &record.Purpose, &record.PolicyVersion, &record.Granted, &record.Region, &record.Statement, &recorded); err != nil {
			return nil, err
		}
		record.RecordedAt = recorded.UTC().Format(time.RFC3339)
		records = append(records, record)
	}
	return records, rows.Err()
}
