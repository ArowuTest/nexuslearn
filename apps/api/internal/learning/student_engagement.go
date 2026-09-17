package learning

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

const MaxEngagementVersion int64 = 9007199254740991

var ErrEngagementForbidden = errors.New("pupil support is outside this account")
var ErrEngagementVersionRequired = errors.New("load the latest support profile before saving")

// Actor and route scope are supplied by the authenticated handler, never JSON.
type EngagementActor struct{ ID, Kind, SchoolURN string }
type EngagementSave struct {
	Profile         StudentEngagementProfile
	ExpectedVersion int64
	IdempotencyKey  string
}
type EngagementSaveReceipt struct {
	AppliedVersion int64 `json:"applied_version"`
	Changed        bool  `json:"changed"`
	Replayed       bool  `json:"replayed"`
}
type SavedStudentEngagement struct {
	StudentEngagementProfile
	SaveResult EngagementSaveReceipt `json:"save_result"`
}
type EngagementConflict struct {
	CurrentProfile  StudentEngagementProfile
	PreviouslySaved bool
}

func (*EngagementConflict) Error() string {
	return "pupil support settings changed; review the current profile"
}

type StudentEngagementRepository interface {
	ReadStudentEngagement(context.Context, EngagementActor, string) (StudentEngagementProfile, error)
	SaveStudentEngagement(context.Context, EngagementActor, EngagementSave) (SavedStudentEngagement, error)
}

var _ StudentEngagementRepository = (*PostgresRepository)(nil)

// PrepareEngagementSave never invents missing saved settings. The HTTP decoder
// also checks presence of booleans, whose zero values alone cannot prove it.
func PrepareEngagementSave(in EngagementSave) (EngagementSave, error) {
	if in.ExpectedVersion < 0 || in.ExpectedVersion > MaxEngagementVersion || in.Profile.Version != in.ExpectedVersion {
		return EngagementSave{}, invalidConfig("support version is invalid")
	}
	if len(in.IdempotencyKey) == 0 || len(in.IdempotencyKey) > 128 {
		return EngagementSave{}, invalidConfig("a support save key of up to 128 printable characters is required")
	}
	for _, char := range in.IdempotencyKey {
		if char < 32 || char > 126 {
			return EngagementSave{}, invalidConfig("support save key must use printable ASCII")
		}
	}
	in.IdempotencyKey = strings.TrimSpace(in.IdempotencyKey)
	if in.IdempotencyKey == "" {
		return EngagementSave{}, invalidConfig("a support save key is required")
	}
	in.Profile.StudentExternalRef = strings.TrimSpace(in.Profile.StudentExternalRef)
	in.Profile.Notes = strings.TrimSpace(in.Profile.Notes)
	in.Profile.UpdatedAt = ""
	for _, values := range []*[]string{&in.Profile.Interests, &in.Profile.DeclaredSupportNeeds, &in.Profile.LearningApproaches} {
		if *values == nil {
			return EngagementSave{}, invalidConfig("support lists must be supplied, including empty lists")
		}
		copyValues := make([]string, len(*values))
		for i, v := range *values {
			copyValues[i] = strings.TrimSpace(v)
		}
		*values = copyValues
	}
	if err := validateStudentEngagement(in.Profile); err != nil {
		return EngagementSave{}, err
	}
	return in, nil
}

func (r *PostgresRepository) ReadStudentEngagement(ctx context.Context, actor EngagementActor, ref string) (StudentEngagementProfile, error) {
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return StudentEngagementProfile{}, err
	}
	defer tx.Rollback(ctx)
	if _, err := lockEngagementScope(ctx, tx, actor, ref, false); err != nil {
		return StudentEngagementProfile{}, err
	}
	profile, err := readStudentEngagement(ctx, tx, ref)
	if err != nil {
		return StudentEngagementProfile{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return StudentEngagementProfile{}, err
	}
	return profile, nil
}

// The pupil lock serialises supported writers and setup. Membership locks keep
// revocation from slipping between authorisation and a save/conflict/replay.
func lockEngagementScope(ctx context.Context, tx pgx.Tx, actor EngagementActor, ref string, write bool) (string, error) {
	var id pgtype.UUID
	if id.Scan(actor.ID) != nil || !id.Valid || blank(ref) {
		return "", ErrEngagementForbidden
	}
	var schoolID, verifiedID string
	var err error
	switch actor.Kind {
	case "parent":
		err = tx.QueryRow(ctx, `SELECT id::text FROM app_users WHERE id=$1 AND user_type='parent' AND status='active' FOR SHARE`, actor.ID).Scan(&verifiedID)
	case "school":
		err = tx.QueryRow(ctx, `SELECT s.id::text FROM schools s JOIN school_users su ON su.school_id=s.id JOIN app_users u ON u.id=su.user_id WHERE s.urn=$1 AND u.id=$2 AND s.status IN ('active','trial') AND u.status='active' AND u.user_type IN ('teacher','school_admin') AND su.role IN ('teacher','school_admin') FOR SHARE OF s,su,u`, strings.TrimSpace(actor.SchoolURN), actor.ID).Scan(&schoolID)
	default:
		return "", ErrEngagementForbidden
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrEngagementForbidden
	}
	if err != nil {
		return "", err
	}
	lock := " FOR SHARE"
	if write {
		lock = " FOR UPDATE"
	}
	var studentID string
	err = tx.QueryRow(ctx, `SELECT id::text FROM students WHERE external_ref=$1`+lock, ref).Scan(&studentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrEngagementForbidden
	}
	if err != nil {
		return "", err
	}
	if actor.Kind == "parent" {
		err = tx.QueryRow(ctx, `SELECT id::text FROM parent_student_links WHERE parent_user_id=$1 AND student_id=$2 AND status='active' FOR SHARE`, actor.ID, studentID).Scan(&verifiedID)
	} else {
		// At least one current membership in the authorised school is required.
		err = tx.QueryRow(ctx, `SELECT c.id::text FROM class_students cs JOIN classes c ON c.id=cs.class_id WHERE cs.student_id=$1 AND c.school_id=$2 ORDER BY c.id LIMIT 1 FOR SHARE OF cs,c`, studentID, schoolID).Scan(&verifiedID)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrEngagementForbidden
	}
	if err != nil {
		return "", err
	}
	return studentID, nil
}

type engagementStoredReceipt struct {
	StudentID          string `json:"student_id"`
	StudentExternalRef string `json:"student_external_ref"`
	AppliedVersion     int64  `json:"applied_version"`
	Changed            bool   `json:"changed"`
}

func (r *PostgresRepository) SaveStudentEngagement(ctx context.Context, actor EngagementActor, in EngagementSave) (SavedStudentEngagement, error) {
	in, err := PrepareEngagementSave(in)
	if err != nil {
		return SavedStudentEngagement{}, err
	}
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return SavedStudentEngagement{}, err
	}
	defer tx.Rollback(ctx)
	studentID, err := lockEngagementScope(ctx, tx, actor, in.Profile.StudentExternalRef, true)
	if err != nil {
		return SavedStudentEngagement{}, err
	}
	const scope = "student.engagement.save"
	actorKey := actor.Kind + ":" + actor.ID + ":" + strings.TrimSpace(actor.SchoolURN)
	replay, err := beginIdempotency(ctx, tx, scope, actorKey, in.IdempotencyKey, in.Profile)
	if err != nil {
		return SavedStudentEngagement{}, err
	}
	current, err := readStudentEngagement(ctx, tx, in.Profile.StudentExternalRef)
	if err != nil {
		return SavedStudentEngagement{}, err
	}
	if replay.Found {
		var receipt engagementStoredReceipt
		if err := json.Unmarshal(replay.Response, &receipt); err != nil {
			return SavedStudentEngagement{}, err
		}
		if receipt.AppliedVersion <= 0 || receipt.AppliedVersion > MaxEngagementVersion || receipt.StudentExternalRef != in.Profile.StudentExternalRef {
			return SavedStudentEngagement{}, errors.New("invalid support save receipt")
		}
		if receipt.StudentID != studentID || receipt.AppliedVersion != current.Version {
			return SavedStudentEngagement{}, &EngagementConflict{CurrentProfile: current, PreviouslySaved: true}
		}
		return SavedStudentEngagement{StudentEngagementProfile: current, SaveResult: EngagementSaveReceipt{AppliedVersion: receipt.AppliedVersion, Changed: receipt.Changed, Replayed: true}}, nil
	}
	if current.Version != in.ExpectedVersion {
		return SavedStudentEngagement{}, &EngagementConflict{CurrentProfile: current}
	}
	before := current.Version
	comparison := current
	comparison.Version = in.ExpectedVersion
	comparison.UpdatedAt = ""
	changed := current.Version == 0 || !reflect.DeepEqual(comparison, in.Profile)
	if changed {
		current, err = writeEngagementProfile(ctx, tx, studentID, in.Profile)
		if errors.Is(err, pgx.ErrNoRows) {
			latest, readErr := readStudentEngagement(ctx, tx, in.Profile.StudentExternalRef)
			if readErr != nil {
				return SavedStudentEngagement{}, readErr
			}
			return SavedStudentEngagement{}, &EngagementConflict{CurrentProfile: latest}
		}
		if err != nil {
			return SavedStudentEngagement{}, err
		}
		_, err = tx.Exec(ctx, `INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,payload) VALUES($1,'upsert','student_engagement_profile',$2,$3::jsonb)`, actor.ID, current.StudentExternalRef, mustJSON(map[string]any{"previous_version": before, "version": current.Version}))
		if err != nil {
			return SavedStudentEngagement{}, err
		}
	}
	receipt := engagementStoredReceipt{StudentID: studentID, StudentExternalRef: current.StudentExternalRef, AppliedVersion: current.Version, Changed: changed}
	if err := completeIdempotency(ctx, tx, scope, actorKey, in.IdempotencyKey, receipt); err != nil {
		return SavedStudentEngagement{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return SavedStudentEngagement{}, err
	}
	return SavedStudentEngagement{StudentEngagementProfile: current, SaveResult: EngagementSaveReceipt{AppliedVersion: current.Version, Changed: changed}}, nil
}

func writeEngagementProfile(ctx context.Context, tx pgx.Tx, studentID string, p StudentEngagementProfile) (StudentEngagementProfile, error) {
	args := []any{studentID, p.DeclaredSupportNeeds, p.LearningApproaches, p.CelebrationIntensity, p.AudioSupport, p.ReadingSupport, p.SessionLength, p.SensoryLoad, p.AttentionSupport, p.CommunicationSupport, p.ProcessingSupport, p.ConfidenceSupport, p.CompanionStyle, p.RewardStyle, p.Interests, p.Notes}
	query := `INSERT INTO student_engagement_profiles(student_id,declared_support_needs,learning_approaches,celebration_intensity,audio_support,reading_support,session_length,sensory_load,attention_support,communication_support,processing_support,confidence_support,companion_style,reward_style,interests,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT(student_id) DO NOTHING RETURNING version,updated_at`
	if p.Version > 0 {
		query = `UPDATE student_engagement_profiles SET declared_support_needs=$2,learning_approaches=$3,celebration_intensity=$4,audio_support=$5,reading_support=$6,session_length=$7,sensory_load=$8,attention_support=$9,communication_support=$10,processing_support=$11,confidence_support=$12,companion_style=$13,reward_style=$14,interests=$15,notes=$16,version=nextval('student_engagement_version_seq'),updated_at=now() WHERE student_id=$1 AND version=$17 RETURNING version,updated_at`
		args = append(args, p.Version)
	}
	var updatedAt time.Time
	if err := tx.QueryRow(ctx, query, args...).Scan(&p.Version, &updatedAt); err != nil {
		return StudentEngagementProfile{}, err
	}
	p.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return p, nil
}
