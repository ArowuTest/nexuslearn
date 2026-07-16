package learning

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var ErrContentReleaseConflict = errors.New("content release conflicts with existing state")
var ErrContentReleaseIncomplete = errors.New("content release is incomplete")
var ErrContentReleaseDigest = errors.New("content release digest does not match payload")

type ContentReleaseManifest struct {
	ID                      string                         `json:"id"`
	SchemaVersion           string                         `json:"schema_version"`
	Channel                 string                         `json:"channel"`
	SourceRevision          string                         `json:"source_revision"`
	ManifestSHA256          string                         `json:"manifest_sha256"`
	CompleteSnapshot        bool                           `json:"complete_snapshot"`
	ExpectedPackCount       int                            `json:"expected_pack_count"`
	ExpectedObjectiveCount  int                            `json:"expected_objective_count"`
	ExpectedActivityCount   int                            `json:"expected_activity_count"`
	ExpectedQuestionCount   int                            `json:"expected_question_count"`
	ExpectedRewardRuleCount int                            `json:"expected_reward_rule_count"`
	Status                  string                         `json:"status,omitempty"`
	Packs                   []ContentReleasePackDescriptor `json:"packs"`
	Metadata                map[string]any                 `json:"metadata,omitempty"`
	CreatedAt               string                         `json:"created_at,omitempty"`
	UpdatedAt               string                         `json:"updated_at,omitempty"`
	AppliedAt               string                         `json:"applied_at,omitempty"`
	UploadedPackCount       int                            `json:"uploaded_pack_count,omitempty"`
}

type ContentReleasePackDescriptor struct {
	PackID          string `json:"pack_id"`
	PackVersion     string `json:"pack_version"`
	PayloadSHA256   string `json:"payload_sha256"`
	ObjectiveCount  int    `json:"objective_count"`
	ActivityCount   int    `json:"activity_count"`
	QuestionCount   int    `json:"question_count"`
	RewardRuleCount int    `json:"reward_rule_count"`
}

type ContentReleaseChunk struct {
	PackID          string          `json:"pack_id"`
	PackVersion     string          `json:"pack_version"`
	PayloadSHA256   string          `json:"payload_sha256"`
	Payload         json.RawMessage `json:"payload"`
	ObjectiveCount  int             `json:"objective_count"`
	ActivityCount   int             `json:"activity_count"`
	QuestionCount   int             `json:"question_count"`
	RewardRuleCount int             `json:"reward_rule_count"`
}

type ContentReleasePackPayload struct {
	PackID        string           `json:"pack_id"`
	Version       string           `json:"version"`
	Objective     Objective        `json:"objective"`
	Activities    []ActivityConfig `json:"activities"`
	Questions     []QuestionConfig `json:"questions"`
	RewardRules   []RewardRule     `json:"reward_rules"`
	ReadinessSeed map[string]any   `json:"readiness_seed,omitempty"`
}

type ContentReleaseStore interface {
	StageContentRelease(context.Context, ContentReleaseManifest) (ContentReleaseManifest, error)
	PutContentReleaseChunk(context.Context, string, ContentReleaseChunk) (ContentReleaseManifest, error)
	ApplyContentRelease(context.Context, string) (ContentReleaseManifest, error)
	ListContentReleases(context.Context, int) ([]ContentReleaseManifest, error)
}

func (r *PostgresRepository) StageContentRelease(ctx context.Context, manifest ContentReleaseManifest) (ContentReleaseManifest, error) {
	if err := validateReleaseManifest(manifest); err != nil {
		return manifest, err
	}
	if manifest.Metadata == nil {
		manifest.Metadata = map[string]any{}
	}
	var existingID string
	var existingStatus string
	existingErr := r.db.QueryRow(ctx, `
		SELECT id, status
		FROM content_releases
		WHERE channel=$1 AND manifest_sha256=$2
		LIMIT 1
	`, manifest.Channel, manifest.ManifestSHA256).Scan(&existingID, &existingStatus)
	if existingErr == nil {
		// The manifest digest is the business idempotency key. A caller may
		// generate a new transport ID while retrying the same release.
		return r.contentRelease(ctx, existingID)
	}
	if !errors.Is(existingErr, pgx.ErrNoRows) {
		return manifest, existingErr
	}
	var createdAt, updatedAt time.Time
	err := r.db.QueryRow(ctx, `
		INSERT INTO content_releases (
			id, schema_version, channel, source_revision, manifest_sha256, complete_snapshot,
			expected_pack_count, expected_objective_count, expected_activity_count,
			expected_question_count, expected_reward_rule_count, packs, metadata
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb)
		ON CONFLICT (id) DO UPDATE SET
			updated_at=now()
		WHERE content_releases.status='staged'
		  AND content_releases.manifest_sha256=EXCLUDED.manifest_sha256
		RETURNING status, created_at, updated_at
	`, manifest.ID, manifest.SchemaVersion, manifest.Channel, manifest.SourceRevision,
		manifest.ManifestSHA256, manifest.CompleteSnapshot, manifest.ExpectedPackCount,
		manifest.ExpectedObjectiveCount, manifest.ExpectedActivityCount, manifest.ExpectedQuestionCount,
		manifest.ExpectedRewardRuleCount, mustJSON(manifest.Packs), mustJSON(manifest.Metadata)).Scan(&manifest.Status, &createdAt, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return manifest, ErrContentReleaseConflict
	}
	if err != nil {
		return manifest, err
	}
	manifest.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	manifest.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return manifest, nil
}

func (r *PostgresRepository) PutContentReleaseChunk(ctx context.Context, releaseID string, chunk ContentReleaseChunk) (ContentReleaseManifest, error) {
	releaseID = strings.TrimSpace(releaseID)
	if releaseID == "" || strings.TrimSpace(chunk.PackID) == "" || strings.TrimSpace(chunk.PackVersion) == "" {
		return ContentReleaseManifest{}, fmt.Errorf("%w: release, pack and version are required", ErrInvalidConfiguration)
	}
	canonical, err := canonicalJSON(chunk.Payload)
	if err != nil {
		return ContentReleaseManifest{}, fmt.Errorf("%w: invalid chunk payload", ErrInvalidConfiguration)
	}
	digest := sha256.Sum256(canonical)
	if !strings.EqualFold(hex.EncodeToString(digest[:]), strings.TrimSpace(chunk.PayloadSHA256)) {
		return ContentReleaseManifest{}, ErrContentReleaseDigest
	}
	var payload ContentReleasePackPayload
	if err := json.Unmarshal(canonical, &payload); err != nil {
		return ContentReleaseManifest{}, fmt.Errorf("%w: invalid pack payload", ErrInvalidConfiguration)
	}
	if err := validateReleasePack(chunk, payload); err != nil {
		return ContentReleaseManifest{}, err
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return ContentReleaseManifest{}, err
	}
	defer tx.Rollback(ctx)
	manifest, err := scanRelease(tx.QueryRow(ctx, `
		SELECT r.id,r.schema_version,r.channel,r.source_revision,r.manifest_sha256,r.complete_snapshot,
		       r.expected_pack_count,r.expected_objective_count,r.expected_activity_count,
		       r.expected_question_count,r.expected_reward_rule_count,r.status,r.packs,r.metadata,
		       r.created_at,r.updated_at,r.applied_at,
		       (SELECT count(*) FROM content_release_chunks c WHERE c.release_id=r.id)
		FROM content_releases r WHERE r.id=$1 FOR UPDATE
	`, releaseID))
	if errors.Is(err, pgx.ErrNoRows) {
		return ContentReleaseManifest{}, ErrContentReleaseIncomplete
	}
	if err != nil {
		return ContentReleaseManifest{}, err
	}
	if manifest.Status != "staged" && manifest.Status != "superseded" {
		return ContentReleaseManifest{}, ErrContentReleaseConflict
	}
	descriptor, ok := releasePackDescriptor(manifest.Packs, chunk.PackID)
	if !ok || descriptor.PackVersion != chunk.PackVersion || !strings.EqualFold(descriptor.PayloadSHA256, chunk.PayloadSHA256) || descriptor.ObjectiveCount != chunk.ObjectiveCount || descriptor.ActivityCount != chunk.ActivityCount || descriptor.QuestionCount != chunk.QuestionCount || descriptor.RewardRuleCount != chunk.RewardRuleCount {
		return ContentReleaseManifest{}, fmt.Errorf("%w: chunk does not match signed manifest", ErrContentReleaseDigest)
	}
	result, err := tx.Exec(ctx, `
		INSERT INTO content_release_chunks (
			release_id, pack_id, pack_version, payload_sha256, payload,
			objective_count, activity_count, question_count, reward_rule_count
		)
		VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)
		ON CONFLICT (release_id, pack_id) DO UPDATE SET
			pack_version=EXCLUDED.pack_version,
			payload_sha256=EXCLUDED.payload_sha256,
			payload=EXCLUDED.payload,
			objective_count=EXCLUDED.objective_count,
			activity_count=EXCLUDED.activity_count,
			question_count=EXCLUDED.question_count,
			reward_rule_count=EXCLUDED.reward_rule_count,
			uploaded_at=now()
	`, releaseID, chunk.PackID, chunk.PackVersion, strings.ToLower(chunk.PayloadSHA256), string(canonical),
		chunk.ObjectiveCount, chunk.ActivityCount, chunk.QuestionCount, chunk.RewardRuleCount)
	if err != nil {
		return ContentReleaseManifest{}, err
	}
	if result.RowsAffected() == 0 {
		return ContentReleaseManifest{}, ErrContentReleaseConflict
	}
	if _, err := tx.Exec(ctx, `UPDATE content_releases SET updated_at=now() WHERE id=$1`, releaseID); err != nil {
		return ContentReleaseManifest{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ContentReleaseManifest{}, err
	}
	return r.contentRelease(ctx, releaseID)
}

func (r *PostgresRepository) ApplyContentRelease(ctx context.Context, releaseID string) (ContentReleaseManifest, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return ContentReleaseManifest{}, err
	}
	defer tx.Rollback(ctx)

	manifest, err := scanRelease(tx.QueryRow(ctx, `
		SELECT r.id,r.schema_version,r.channel,r.source_revision,r.manifest_sha256,r.complete_snapshot,
		       r.expected_pack_count,r.expected_objective_count,r.expected_activity_count,
		       r.expected_question_count,r.expected_reward_rule_count,r.status,r.packs,r.metadata,
		       r.created_at,r.updated_at,r.applied_at,
		       (SELECT count(*) FROM content_release_chunks c WHERE c.release_id=r.id)
		FROM content_releases r WHERE r.id=$1 FOR UPDATE
	`, releaseID))
	if errors.Is(err, pgx.ErrNoRows) {
		return ContentReleaseManifest{}, ErrContentReleaseIncomplete
	}
	if err != nil {
		return ContentReleaseManifest{}, err
	}
	if manifest.Status == "applied" {
		return manifest, nil
	}
	if manifest.Status != "staged" {
		return ContentReleaseManifest{}, ErrContentReleaseConflict
	}
	if manifest.Channel != "live" {
		return ContentReleaseManifest{}, fmt.Errorf("%w: only the protected live channel can replace the active catalogue", ErrInvalidConfiguration)
	}
	if manifest.UploadedPackCount != manifest.ExpectedPackCount {
		return ContentReleaseManifest{}, fmt.Errorf("%w: uploaded %d of %d packs", ErrContentReleaseIncomplete, manifest.UploadedPackCount, manifest.ExpectedPackCount)
	}

	rows, err := tx.Query(ctx, `SELECT pack_id,payload,objective_count,activity_count,question_count,reward_rule_count FROM content_release_chunks WHERE release_id=$1 ORDER BY pack_id`, releaseID)
	if err != nil {
		return ContentReleaseManifest{}, err
	}
	defer rows.Close()
	totals := [4]int{}
	payloads := []ContentReleasePackPayload{}
	for rows.Next() {
		var packID, raw string
		var counts [4]int
		if err := rows.Scan(&packID, &raw, &counts[0], &counts[1], &counts[2], &counts[3]); err != nil {
			return ContentReleaseManifest{}, err
		}
		var payload ContentReleasePackPayload
		if err := json.Unmarshal([]byte(raw), &payload); err != nil || payload.PackID != packID {
			return ContentReleaseManifest{}, fmt.Errorf("%w: corrupt staged pack %s", ErrContentReleaseIncomplete, packID)
		}
		for i := range totals {
			totals[i] += counts[i]
		}
		payloads = append(payloads, payload)
	}
	if err := rows.Err(); err != nil {
		return ContentReleaseManifest{}, err
	}
	expected := [4]int{manifest.ExpectedObjectiveCount, manifest.ExpectedActivityCount, manifest.ExpectedQuestionCount, manifest.ExpectedRewardRuleCount}
	if totals != expected {
		return ContentReleaseManifest{}, fmt.Errorf("%w: aggregate counts do not match manifest", ErrContentReleaseIncomplete)
	}
	if err := validateReleaseChannelPayloads(manifest.Channel, payloads); err != nil {
		return ContentReleaseManifest{}, err
	}

	// Create every objective first so prerequisite foreign keys are independent
	// of deterministic pack ordering.
	for _, payload := range payloads {
		if err := upsertReleaseObjective(ctx, tx, releaseID, payload.PackID, payload.Objective); err != nil {
			return ContentReleaseManifest{}, err
		}
	}
	for _, payload := range payloads {
		if err := applyReleasePack(ctx, tx, releaseID, payload); err != nil {
			return ContentReleaseManifest{}, err
		}
	}
	if manifest.CompleteSnapshot {
		if _, err := tx.Exec(ctx, `UPDATE activities SET status='archived',updated_at=now() WHERE content_release_id IS NOT NULL AND content_release_id<>$1`, releaseID); err != nil {
			return ContentReleaseManifest{}, err
		}
		if _, err := tx.Exec(ctx, `UPDATE questions SET status='archived',updated_at=now() WHERE content_release_id IS NOT NULL AND content_release_id<>$1`, releaseID); err != nil {
			return ContentReleaseManifest{}, err
		}
		if _, err := tx.Exec(ctx, `UPDATE reward_rules SET enabled=false,updated_at=now() WHERE content_release_id IS NOT NULL AND content_release_id<>$1`, releaseID); err != nil {
			return ContentReleaseManifest{}, err
		}
	}
	if _, err := tx.Exec(ctx, `UPDATE content_releases SET status='superseded',updated_at=now() WHERE channel=$1 AND status='applied' AND id<>$2`, manifest.Channel, releaseID); err != nil {
		return ContentReleaseManifest{}, err
	}
	if _, err := tx.Exec(ctx, `UPDATE content_releases SET status='applied',applied_at=now(),updated_at=now() WHERE id=$1`, releaseID); err != nil {
		return ContentReleaseManifest{}, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO audit_logs(action,entity_type,entity_id,payload) VALUES('apply','content_release',$1,$2::jsonb)`, releaseID, mustJSON(manifest)); err != nil {
		return ContentReleaseManifest{}, err
	}
	if err := recordContentVersion(ctx, tx, releaseID, "content_release", "published", manifest); err != nil {
		return ContentReleaseManifest{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ContentReleaseManifest{}, err
	}
	return r.contentRelease(ctx, releaseID)
}

func (r *PostgresRepository) ListContentReleases(ctx context.Context, limit int) ([]ContentReleaseManifest, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	rows, err := r.db.Query(ctx, `
		SELECT r.id,r.schema_version,r.channel,r.source_revision,r.manifest_sha256,r.complete_snapshot,
		       r.expected_pack_count,r.expected_objective_count,r.expected_activity_count,
		       r.expected_question_count,r.expected_reward_rule_count,r.status,r.packs,r.metadata,
		       r.created_at,r.updated_at,r.applied_at,
		       (SELECT count(*) FROM content_release_chunks c WHERE c.release_id=r.id)
		FROM content_releases r ORDER BY r.created_at DESC LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []ContentReleaseManifest{}
	for rows.Next() {
		item, err := scanRelease(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *PostgresRepository) contentRelease(ctx context.Context, id string) (ContentReleaseManifest, error) {
	return scanRelease(r.db.QueryRow(ctx, `
		SELECT r.id,r.schema_version,r.channel,r.source_revision,r.manifest_sha256,r.complete_snapshot,
		       r.expected_pack_count,r.expected_objective_count,r.expected_activity_count,
		       r.expected_question_count,r.expected_reward_rule_count,r.status,r.packs,r.metadata,
		       r.created_at,r.updated_at,r.applied_at,
		       (SELECT count(*) FROM content_release_chunks c WHERE c.release_id=r.id)
		FROM content_releases r WHERE r.id=$1
	`, id))
}

type releaseScanner interface{ Scan(...any) error }

func scanRelease(row releaseScanner) (ContentReleaseManifest, error) {
	var item ContentReleaseManifest
	var packs, metadata []byte
	var createdAt, updatedAt time.Time
	var appliedAt *time.Time
	err := row.Scan(&item.ID, &item.SchemaVersion, &item.Channel, &item.SourceRevision, &item.ManifestSHA256, &item.CompleteSnapshot,
		&item.ExpectedPackCount, &item.ExpectedObjectiveCount, &item.ExpectedActivityCount, &item.ExpectedQuestionCount,
		&item.ExpectedRewardRuleCount, &item.Status, &packs, &metadata, &createdAt, &updatedAt, &appliedAt, &item.UploadedPackCount)
	if err != nil {
		return item, err
	}
	_ = json.Unmarshal(packs, &item.Packs)
	_ = json.Unmarshal(metadata, &item.Metadata)
	item.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	item.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	if appliedAt != nil {
		item.AppliedAt = appliedAt.UTC().Format(time.RFC3339)
	}
	return item, nil
}

func validateReleaseManifest(item ContentReleaseManifest) error {
	if strings.TrimSpace(item.ID) == "" || item.SchemaVersion != "1.0" || !validSHA256(item.ManifestSHA256) || item.ExpectedPackCount <= 0 {
		return fmt.Errorf("%w: release id, schema, digest and positive pack count are required", ErrInvalidConfiguration)
	}
	if item.Channel != "review" && item.Channel != "pilot" && item.Channel != "live" {
		return fmt.Errorf("%w: invalid release channel", ErrInvalidConfiguration)
	}
	expectedID := "nexuslearn-" + item.Channel + "-" + strings.ToLower(item.ManifestSHA256[:16])
	if item.ID != expectedID {
		return fmt.Errorf("%w: release id does not match manifest digest", ErrInvalidConfiguration)
	}
	if item.Channel == "live" && strings.TrimSpace(item.SourceRevision) == "" {
		return fmt.Errorf("%w: live releases require a source revision", ErrInvalidConfiguration)
	}
	if item.ExpectedObjectiveCount < 0 || item.ExpectedActivityCount < 0 || item.ExpectedQuestionCount < 0 || item.ExpectedRewardRuleCount < 0 {
		return fmt.Errorf("%w: counts cannot be negative", ErrInvalidConfiguration)
	}
	if len(item.Packs) != item.ExpectedPackCount {
		return fmt.Errorf("%w: pack manifest count mismatch", ErrInvalidConfiguration)
	}
	totals := [4]int{}
	seen := map[string]bool{}
	for _, pack := range item.Packs {
		if pack.PackID == "" || pack.PackVersion == "" || !validSHA256(pack.PayloadSHA256) || seen[pack.PackID] {
			return fmt.Errorf("%w: invalid or duplicate pack descriptor", ErrInvalidConfiguration)
		}
		seen[pack.PackID] = true
		totals[0] += pack.ObjectiveCount
		totals[1] += pack.ActivityCount
		totals[2] += pack.QuestionCount
		totals[3] += pack.RewardRuleCount
	}
	if totals != [4]int{item.ExpectedObjectiveCount, item.ExpectedActivityCount, item.ExpectedQuestionCount, item.ExpectedRewardRuleCount} {
		return fmt.Errorf("%w: descriptor totals do not match release totals", ErrInvalidConfiguration)
	}
	rawPacks, err := json.Marshal(item.Packs)
	if err != nil {
		return err
	}
	canonical, err := canonicalJSON(rawPacks)
	if err != nil {
		return err
	}
	digest := sha256.Sum256(canonical)
	if !strings.EqualFold(hex.EncodeToString(digest[:]), item.ManifestSHA256) {
		return ErrContentReleaseDigest
	}
	return nil
}

func releasePackDescriptor(items []ContentReleasePackDescriptor, packID string) (ContentReleasePackDescriptor, bool) {
	for _, item := range items {
		if item.PackID == packID {
			return item, true
		}
	}
	return ContentReleasePackDescriptor{}, false
}

func validSHA256(value string) bool {
	value = strings.TrimSpace(value)
	if len(value) != 64 {
		return false
	}
	_, err := hex.DecodeString(value)
	return err == nil
}

func validateReleaseChannelPayloads(channel string, payloads []ContentReleasePackPayload) error {
	if channel == "review" {
		return nil
	}
	for _, payload := range payloads {
		for _, activity := range payload.Activities {
			if !releaseRuntimeStatus(activity.Status) {
				return fmt.Errorf("%w: %s has a non-runtime activity in the %s channel", ErrInvalidConfiguration, payload.PackID, channel)
			}
		}
		runtimeQuestions := 0
		for _, question := range payload.Questions {
			if releaseRuntimeStatus(question.Status) {
				runtimeQuestions++
			}
		}
		if runtimeQuestions < 3 {
			return fmt.Errorf("%w: %s needs at least three runtime-approved questions in the %s channel", ErrInvalidConfiguration, payload.PackID, channel)
		}
	}
	return nil
}

func releaseRuntimeStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "approved", "published", "live":
		return true
	default:
		return false
	}
}

func validateReleasePack(chunk ContentReleaseChunk, payload ContentReleasePackPayload) error {
	if payload.PackID != chunk.PackID || payload.Version != chunk.PackVersion {
		return fmt.Errorf("%w: chunk identity does not match payload", ErrInvalidConfiguration)
	}
	if chunk.ObjectiveCount != 1 || payload.Objective.ID == "" || len(payload.Activities) != chunk.ActivityCount || len(payload.Questions) != chunk.QuestionCount || len(payload.RewardRules) != chunk.RewardRuleCount {
		return fmt.Errorf("%w: chunk counts do not match payload", ErrInvalidConfiguration)
	}
	if payload.Objective.ID != payload.PackID {
		return fmt.Errorf("%w: objective and pack ids must match", ErrInvalidConfiguration)
	}
	for _, activity := range payload.Activities {
		if activity.ObjectiveID != payload.Objective.ID {
			return fmt.Errorf("%w: activity objective mismatch", ErrInvalidConfiguration)
		}
	}
	for _, question := range payload.Questions {
		if question.ObjectiveID != payload.Objective.ID {
			return fmt.Errorf("%w: question objective mismatch", ErrInvalidConfiguration)
		}
	}
	return nil
}

func canonicalJSON(raw []byte) ([]byte, error) {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	var value any
	if err := decoder.Decode(&value); err != nil {
		return nil, err
	}
	return json.Marshal(value)
}

func applyReleasePack(ctx context.Context, tx pgx.Tx, releaseID string, payload ContentReleasePackPayload) error {
	packID := payload.PackID
	o := payload.Objective
	if _, err := tx.Exec(ctx, `DELETE FROM objective_prerequisites WHERE objective_id=$1`, o.ID); err != nil {
		return err
	}
	for _, prerequisite := range o.Prerequisites {
		if _, err := tx.Exec(ctx, `INSERT INTO objective_prerequisites(objective_id,prerequisite_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, o.ID, prerequisite); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx, `DELETE FROM objective_misconceptions WHERE objective_id=$1`, o.ID); err != nil {
		return err
	}
	for _, misconception := range o.Misconceptions {
		if _, err := tx.Exec(ctx, `INSERT INTO objective_misconceptions(objective_id,description) VALUES($1,$2)`, o.ID, misconception); err != nil {
			return err
		}
	}
	for _, a := range payload.Activities {
		if err := validateActivity(a); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO activities(id,objective_id,template_id,world_key,title,prompt,difficulty,interaction,feedback,animation_hooks,status,content_release_id,pack_id,updated_at) VALUES($1,NULLIF($2,''),(SELECT id FROM activity_templates WHERE id=NULLIF($3,'')),$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12,$13,now()) ON CONFLICT(id) DO UPDATE SET objective_id=EXCLUDED.objective_id,template_id=EXCLUDED.template_id,world_key=EXCLUDED.world_key,title=EXCLUDED.title,prompt=EXCLUDED.prompt,difficulty=EXCLUDED.difficulty,interaction=EXCLUDED.interaction,feedback=EXCLUDED.feedback,animation_hooks=EXCLUDED.animation_hooks,status=EXCLUDED.status,content_release_id=EXCLUDED.content_release_id,pack_id=EXCLUDED.pack_id,updated_at=now()`, a.ID, a.ObjectiveID, a.TemplateID, a.WorldKey, a.Title, a.Prompt, a.Difficulty, mustJSON(a.Interaction), mustJSON(a.Feedback), mustJSON(a.AnimationHooks), a.Status, releaseID, packID); err != nil {
			return err
		}
	}
	for _, q := range payload.Questions {
		if err := validateQuestion(q); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO questions(id,activity_id,objective_id,format,body,expected_answer,hints,explanation,difficulty,status,content_release_id,pack_id,updated_at) VALUES($1,NULLIF($2,''),NULLIF($3,''),$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12,now()) ON CONFLICT(id) DO UPDATE SET activity_id=EXCLUDED.activity_id,objective_id=EXCLUDED.objective_id,format=EXCLUDED.format,body=EXCLUDED.body,expected_answer=EXCLUDED.expected_answer,hints=EXCLUDED.hints,explanation=EXCLUDED.explanation,difficulty=EXCLUDED.difficulty,status=EXCLUDED.status,content_release_id=EXCLUDED.content_release_id,pack_id=EXCLUDED.pack_id,updated_at=now()`, q.ID, q.ActivityID, q.ObjectiveID, q.Format, mustJSON(q.Body), mustJSON(q.ExpectedAnswer), mustJSON(q.Hints), q.Explanation, q.Difficulty, q.Status, releaseID, packID); err != nil {
			return err
		}
	}
	for _, rule := range payload.RewardRules {
		if err := validateRewardRule(rule); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO reward_rules(id,world_key,objective_id,trigger,reward_payload,enabled,content_release_id,pack_id,updated_at) VALUES($1,NULLIF($2,''),NULLIF($3,''),$4,$5::jsonb,$6,$7,$8,now()) ON CONFLICT(id) DO UPDATE SET world_key=EXCLUDED.world_key,objective_id=EXCLUDED.objective_id,trigger=EXCLUDED.trigger,reward_payload=EXCLUDED.reward_payload,enabled=EXCLUDED.enabled,content_release_id=EXCLUDED.content_release_id,pack_id=EXCLUDED.pack_id,updated_at=now()`, rule.ID, rule.WorldKey, rule.ObjectiveID, rule.Trigger, mustJSON(rule.RewardPayload), rule.Enabled, releaseID, packID); err != nil {
			return err
		}
	}
	return nil
}

func upsertReleaseObjective(ctx context.Context, tx pgx.Tx, releaseID, packID string, o Objective) error {
	if err := validateObjective(o); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO curriculum_objectives(id,year_group,subject,strand,topic,statement,parent_explanation,teacher_evidence,expected_mastery,secure_mastery,retention_days,required_formats,content_release_id,pack_id,updated_at)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now())
		ON CONFLICT(id) DO UPDATE SET year_group=EXCLUDED.year_group,subject=EXCLUDED.subject,strand=EXCLUDED.strand,topic=EXCLUDED.topic,statement=EXCLUDED.statement,parent_explanation=EXCLUDED.parent_explanation,teacher_evidence=EXCLUDED.teacher_evidence,expected_mastery=EXCLUDED.expected_mastery,secure_mastery=EXCLUDED.secure_mastery,retention_days=EXCLUDED.retention_days,required_formats=EXCLUDED.required_formats,content_release_id=EXCLUDED.content_release_id,pack_id=EXCLUDED.pack_id,updated_at=now()
	`, o.ID, o.Year, o.Subject, o.Strand, o.Topic, o.Statement, o.ParentExplanation, o.TeacherEvidence, o.Mastery.Expected, o.Mastery.Secure, o.Mastery.RetentionDays, o.Mastery.RequiredFormats, releaseID, packID)
	return err
}
