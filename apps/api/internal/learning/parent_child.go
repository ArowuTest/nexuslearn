package learning

import (
	"context"
	"crypto/rand"
	"encoding/base32"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// ErrParentChildForbidden deliberately does not distinguish an unrelated child,
// an inactive link, or an inactive parent account.
var ErrParentChildForbidden = errors.New("child is outside this parent account")

// ParentChildRepository is separate from the administrator's general upserts.
// Callers must supply the parent ID from verified authentication, never input.
type ParentChildRepository interface {
	UpsertParentChild(context.Context, string, StudentProfileConfig, StudentEngagementProfile) (ParentChildConfig, error)
}

var _ ParentChildRepository = (*PostgresRepository)(nil)

// UpsertParentChild creates a private family learner or updates an actively
// linked learner. Ownership, identity, credentials and support share one commit.
func (r *PostgresRepository) UpsertParentChild(ctx context.Context, parentID string, student StudentProfileConfig, profile StudentEngagementProfile) (ParentChildConfig, error) {
	student, profile, err := PrepareParentChild(student, profile)
	if err != nil {
		return ParentChildConfig{}, err
	}
	if blank(parentID) {
		return ParentChildConfig{}, ErrParentChildForbidden
	}
	// Explicit READ COMMITTED makes the post-conflict SELECT see the winner of a
	// concurrent insert, even if the database default isolation level differs.
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return ParentChildConfig{}, err
	}
	defer tx.Rollback(ctx)
	var verifiedID string
	err = tx.QueryRow(ctx, `SELECT id::text FROM app_users WHERE id=$1 AND user_type='parent' AND status='active' FOR SHARE`, parentID).Scan(&verifiedID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ParentChildConfig{}, ErrParentChildForbidden
	}
	if err != nil {
		return ParentChildConfig{}, err
	}

	var createdAt, updatedAt time.Time
	// DO NOTHING is critical: an untrusted reference must never trigger the
	// administrator-style ON CONFLICT UPDATE. The unique index arbitrates new
	// claims, including other writers that do not use this repository method.
	err = tx.QueryRow(ctx, `
		INSERT INTO students(external_ref,display_name,year_group)
		VALUES($1,$2,$3) ON CONFLICT(external_ref) DO NOTHING
		RETURNING id::text,created_at,updated_at
	`, student.ExternalRef, student.DisplayName, student.YearGroup).Scan(&student.ID, &createdAt, &updatedAt)
	created := err == nil
	if errors.Is(err, pgx.ErrNoRows) {
		err = tx.QueryRow(ctx, `SELECT id::text,created_at,updated_at FROM students WHERE external_ref=$1 FOR UPDATE`, student.ExternalRef).Scan(&student.ID, &createdAt, &updatedAt)
		if errors.Is(err, pgx.ErrNoRows) {
			return ParentChildConfig{}, ErrParentChildForbidden
		}
	}
	if err != nil {
		return ParentChildConfig{}, err
	}
	if created {
		_, err = tx.Exec(ctx, `INSERT INTO parent_student_links(parent_user_id,student_id,relationship,status) VALUES($1,$2,'parent','active')`, verifiedID, student.ID)
	} else {
		var linkID string
		// Hold the active link through commit so concurrent revocation cannot
		// slip between the ownership check and the writes/credential response.
		err = tx.QueryRow(ctx, `SELECT id::text FROM parent_student_links WHERE parent_user_id=$1 AND student_id=$2 AND status='active' FOR SHARE`, verifiedID, student.ID).Scan(&linkID)
		if errors.Is(err, pgx.ErrNoRows) {
			return ParentChildConfig{}, ErrParentChildForbidden
		}
		if err == nil {
			err = tx.QueryRow(ctx, `UPDATE students SET display_name=$2,year_group=$3,updated_at=now() WHERE id=$1 RETURNING updated_at`, student.ID, student.DisplayName, student.YearGroup).Scan(&updatedAt)
		}
	}
	if err != nil {
		return ParentChildConfig{}, err
	}
	student.CreatedAt, student.UpdatedAt = createdAt.UTC().Format(time.RFC3339), updatedAt.UTC().Format(time.RFC3339)

	credential, err := parentChildCredential(ctx, tx, student)
	if err != nil {
		return ParentChildConfig{}, err
	}
	profile, err = saveParentChildSupport(ctx, tx, student.ID, profile)
	if err != nil {
		return ParentChildConfig{}, err
	}
	// Audit the actor and operation without copying login secrets or sensitive
	// support notes into the general administrator audit feed.
	_, err = tx.Exec(ctx, `INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,payload) VALUES($1,'upsert','parent_child',$2,$3::jsonb)`, verifiedID, student.ExternalRef, mustJSON(map[string]bool{"created": created}))
	if err != nil {
		return ParentChildConfig{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ParentChildConfig{}, err
	}
	return ParentChildConfig{Student: student, Credential: credential, Engagement: profile}, nil
}

func parentChildCredential(ctx context.Context, tx pgx.Tx, student StudentProfileConfig) (StudentCredentialConfig, error) {
	credential := StudentCredentialConfig{StudentExternalRef: student.ExternalRef, DisplayName: student.DisplayName, PicturePassword: []string{}}
	var raw []byte
	var updatedAt time.Time
	read := func() error {
		return tx.QueryRow(ctx, `SELECT COALESCE(login_code,''),picture_password,COALESCE(qr_secret_hash,''),updated_at FROM student_credentials WHERE student_id=$1 FOR SHARE`, student.ID).Scan(&credential.LoginCode, &raw, &credential.QRSecretHash, &updatedAt)
	}
	err := read()
	if errors.Is(err, pgx.ErrNoRows) {
		// 128 random bits in the login code; six independently random pictures
		// from the existing pupil-login vocabulary. No clock/ref-derived secret.
		var entropy [22]byte
		if _, err := rand.Read(entropy[:]); err != nil {
			return StudentCredentialConfig{}, err
		}
		code := "HOME-" + base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(entropy[:16])
		pool := [...]string{"star", "book", "sun", "tree", "rocket", "shell", "moon", "key"}
		pictures := make([]string, 6)
		for i := range pictures {
			pictures[i] = pool[int(entropy[16+i])%len(pool)]
		}
		// Never rotate school/family credentials, including a concurrently
		// provisioned credential. A code collision fails and rolls back safely.
		_, err = tx.Exec(ctx, `INSERT INTO student_credentials(student_id,login_code,picture_password) VALUES($1,$2,$3::jsonb) ON CONFLICT(student_id) DO NOTHING`, student.ID, code, mustJSON(pictures))
		if err == nil {
			err = read()
		}
	}
	if err != nil {
		return StudentCredentialConfig{}, err
	}
	if err := json.Unmarshal(raw, &credential.PicturePassword); err != nil {
		return StudentCredentialConfig{}, err
	}
	credential.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return credential, nil
}

// PrepareParentChild applies the existing support defaults and validation before
// either the handler or repository can write. The route's reference is authority
// for both records; client-supplied IDs/timestamps are never persisted.
func PrepareParentChild(student StudentProfileConfig, profile StudentEngagementProfile) (StudentProfileConfig, StudentEngagementProfile, error) {
	student = StudentProfileConfig{ExternalRef: strings.TrimSpace(student.ExternalRef), DisplayName: strings.TrimSpace(student.DisplayName), YearGroup: student.YearGroup}
	if err := validateStudent(student); err != nil {
		return StudentProfileConfig{}, StudentEngagementProfile{}, err
	}
	profile.StudentExternalRef = student.ExternalRef
	profile.UpdatedAt = ""
	profile.Notes = strings.TrimSpace(profile.Notes)
	defaults := defaultStudentEngagement(student.ExternalRef)
	for _, field := range []struct {
		value    *string
		fallback string
	}{
		{&profile.CelebrationIntensity, defaults.CelebrationIntensity},
		{&profile.SessionLength, defaults.SessionLength},
		{&profile.SensoryLoad, defaults.SensoryLoad},
		{&profile.AttentionSupport, defaults.AttentionSupport},
		{&profile.CommunicationSupport, defaults.CommunicationSupport},
		{&profile.ProcessingSupport, defaults.ProcessingSupport},
		{&profile.ConfidenceSupport, defaults.ConfidenceSupport},
		{&profile.CompanionStyle, defaults.CompanionStyle},
		{&profile.RewardStyle, defaults.RewardStyle},
	} {
		if *field.value == "" {
			*field.value = field.fallback
		}
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
		return StudentProfileConfig{}, StudentEngagementProfile{}, err
	}
	return student, profile, nil
}

func saveParentChildSupport(ctx context.Context, tx pgx.Tx, studentID string, profile StudentEngagementProfile) (StudentEngagementProfile, error) {
	var updatedAt time.Time
	err := tx.QueryRow(ctx, `
		INSERT INTO student_engagement_profiles (
			student_id, declared_support_needs, learning_approaches, celebration_intensity,
			audio_support, reading_support, session_length, sensory_load, attention_support,
			communication_support, processing_support, confidence_support, companion_style,
			reward_style, interests, notes, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,now())
		ON CONFLICT (student_id) DO UPDATE SET
			declared_support_needs=EXCLUDED.declared_support_needs,
			learning_approaches=EXCLUDED.learning_approaches,
			celebration_intensity=EXCLUDED.celebration_intensity,
			audio_support=EXCLUDED.audio_support, reading_support=EXCLUDED.reading_support,
			session_length=EXCLUDED.session_length, sensory_load=EXCLUDED.sensory_load,
			attention_support=EXCLUDED.attention_support, communication_support=EXCLUDED.communication_support,
			processing_support=EXCLUDED.processing_support, confidence_support=EXCLUDED.confidence_support,
			companion_style=EXCLUDED.companion_style, reward_style=EXCLUDED.reward_style,
			interests=EXCLUDED.interests, notes=EXCLUDED.notes, updated_at=now()
		RETURNING updated_at
	`, studentID, profile.DeclaredSupportNeeds, profile.LearningApproaches, profile.CelebrationIntensity,
		profile.AudioSupport, profile.ReadingSupport, profile.SessionLength, profile.SensoryLoad, profile.AttentionSupport,
		profile.CommunicationSupport, profile.ProcessingSupport, profile.ConfidenceSupport, profile.CompanionStyle,
		profile.RewardStyle, profile.Interests, profile.Notes).Scan(&updatedAt)
	if err != nil {
		return StudentEngagementProfile{}, err
	}
	profile.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return profile, nil
}
