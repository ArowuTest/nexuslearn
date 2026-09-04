package learning

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var ErrContentReleaseConflict = errors.New("content release conflicts with existing state")
var ErrContentReleaseIncomplete = errors.New("content release is incomplete")
var ErrContentReleaseDigest = errors.New("content release digest does not match payload")

var releaseMetadataFieldNormalizer = regexp.MustCompile(`[^a-z0-9]`)

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

// HumanReleaseEvidence records independent evidence that AI review cannot
// provide. These values must be derived from immutable human-review ledgers,
// never inferred from AI decisions or a request-body boolean.
type HumanReleaseEvidence struct {
	SafeguardingApproved           bool `json:"safeguarding_approved"`
	ExactAudioReleaseApproved      bool `json:"exact_audio_release_approved"`
	RequiredAudioListeningApproved bool `json:"required_audio_listening_approved"`
	ChildPilotEvidenceApproved     bool `json:"child_pilot_evidence_approved"`
}

type ReleaseAudioEvidenceIdentity struct {
	AssetID                  string `json:"asset_id"`
	TextSHA256               string `json:"text_sha256"`
	AudioSHA256              string `json:"audio_sha256"`
	ProductionIdentitySHA256 string `json:"production_identity_sha256"`
	ProductionProfileSHA256  string `json:"production_profile_sha256"`
}

type ReleaseEvidenceMetadata struct {
	AIReviewIdentities   []ReviewIdentity               `json:"ai_review_identities"`
	HumanReviewBatchID   string                         `json:"human_review_batch_id"`
	HumanReviewBatchHash string                         `json:"human_review_batch_sha256"`
	AudioReleaseID       string                         `json:"audio_release_id"`
	AudioReleaseSHA256   string                         `json:"audio_release_sha256"`
	AudioCatalogueID     string                         `json:"audio_catalogue_id"`
	AudioCatalogueSHA256 string                         `json:"audio_catalogue_sha256"`
	AudioLicenceID       string                         `json:"audio_licence_id"`
	RequiredAudioAssets  []ReleaseAudioEvidenceIdentity `json:"required_audio_assets"`
}

func ValidateReleaseEvidence(channel string, ai AIReviewEligibility, human HumanReleaseEvidence) error {
	switch strings.TrimSpace(channel) {
	case "review":
		return nil
	case "pilot":
		if !ai.ControlledPilotAllowed {
			return fmt.Errorf("%w: controlled pilot requires current approval from both AI review lanes", ErrContentReleaseIncomplete)
		}
		return nil
	case "live":
		if !ai.ControlledPilotAllowed {
			return fmt.Errorf("%w: live release requires current approval from both AI review lanes", ErrContentReleaseIncomplete)
		}
		if !human.SafeguardingApproved {
			return fmt.Errorf("%w: live release requires independent human safeguarding approval", ErrContentReleaseIncomplete)
		}
		if !human.ExactAudioReleaseApproved {
			return fmt.Errorf("%w: live release requires the exact technically valid audio release and catalogue", ErrContentReleaseIncomplete)
		}
		if !human.RequiredAudioListeningApproved {
			return fmt.Errorf("%w: live release requires human listening approval for every required audio asset", ErrContentReleaseIncomplete)
		}
		if !human.ChildPilotEvidenceApproved {
			return fmt.Errorf("%w: live release requires recorded real-child pilot evidence", ErrContentReleaseIncomplete)
		}
		return nil
	default:
		return fmt.Errorf("%w: invalid release evidence channel", ErrInvalidConfiguration)
	}
}

func releaseEvidenceMetadata(manifest ContentReleaseManifest) (ReleaseEvidenceMetadata, error) {
	var evidence ReleaseEvidenceMetadata
	raw, err := json.Marshal(manifest.Metadata)
	if err != nil {
		return evidence, err
	}
	var normalizedMetadata any
	if err := json.Unmarshal(raw, &normalizedMetadata); err != nil || releaseMetadataContainsSensitiveField(normalizedMetadata) {
		return evidence, fmt.Errorf("%w: release metadata contains a forbidden credential or transcript field", ErrInvalidConfiguration)
	}
	if err := json.Unmarshal(raw, &evidence); err != nil {
		return evidence, fmt.Errorf("%w: invalid release evidence metadata", ErrInvalidConfiguration)
	}
	if len(evidence.AIReviewIdentities) != len(manifest.Packs) {
		return evidence, fmt.Errorf("%w: release metadata requires exactly one AI review identity per pack", ErrInvalidConfiguration)
	}
	seenIdentities := map[string]bool{}
	reviewPolicy := ""
	for _, identity := range evidence.AIReviewIdentities {
		if !validReleaseLabel(identity.ContentID) || !validLowerAudioSHA(identity.ContentHash) ||
			!validReleaseLabel(identity.RubricRevision) || !validReleaseLabel(identity.SourceSetRevision) ||
			!validReleaseLabel(identity.ReviewerImplementation) || seenIdentities[identity.ContentID] {
			return evidence, fmt.Errorf("%w: release AI review identities must be complete and unique", ErrInvalidConfiguration)
		}
		policy := identity.RubricRevision + "\x00" + identity.SourceSetRevision + "\x00" + identity.ReviewerImplementation
		if reviewPolicy != "" && policy != reviewPolicy {
			return evidence, fmt.Errorf("%w: release AI review identities must use one consistent review policy", ErrInvalidConfiguration)
		}
		reviewPolicy = policy
		seenIdentities[identity.ContentID] = true
	}
	for _, pack := range manifest.Packs {
		matched := false
		for _, identity := range evidence.AIReviewIdentities {
			if identity.ContentID == pack.PackID && identity.ContentHash == pack.PayloadSHA256 {
				matched = true
				break
			}
		}
		if !matched {
			return evidence, fmt.Errorf("%w: pack %s has no exact AI-reviewed payload identity", ErrInvalidConfiguration, pack.PackID)
		}
	}
	if !validReleaseLabel(evidence.HumanReviewBatchID) || !validLowerAudioSHA(evidence.HumanReviewBatchHash) {
		return evidence, fmt.Errorf("%w: release metadata requires an exact human review batch identity", ErrInvalidConfiguration)
	}
	if !audioReleaseIDPattern.MatchString(evidence.AudioReleaseID) || !validLowerAudioSHA(evidence.AudioReleaseSHA256) || !strings.HasSuffix(evidence.AudioReleaseID, evidence.AudioReleaseSHA256[:24]) ||
		!strings.HasPrefix(evidence.AudioCatalogueID, "variant-audio-catalog-v1-") || !validLowerAudioSHA(evidence.AudioCatalogueSHA256) || !strings.HasSuffix(evidence.AudioCatalogueID, evidence.AudioCatalogueSHA256[:24]) {
		return evidence, fmt.Errorf("%w: release metadata requires exact audio release and catalogue identities", ErrInvalidConfiguration)
	}
	if evidence.AudioLicenceID != "provider_terms" {
		return evidence, fmt.Errorf("%w: release metadata requires a supported audio licence", ErrInvalidConfiguration)
	}
	if len(evidence.RequiredAudioAssets) == 0 || len(evidence.RequiredAudioAssets) > maxAudioManifestAssets {
		return evidence, fmt.Errorf("%w: release metadata requires exact audio assets for listening approval", ErrInvalidConfiguration)
	}
	seenAudio := map[string]bool{}
	for _, asset := range evidence.RequiredAudioAssets {
		if !audioAssetIDPattern.MatchString(asset.AssetID) || !validLowerAudioSHA(asset.TextSHA256) || !validLowerAudioSHA(asset.AudioSHA256) ||
			!validLowerAudioSHA(asset.ProductionIdentitySHA256) || !validLowerAudioSHA(asset.ProductionProfileSHA256) || seenAudio[asset.AssetID] {
			return evidence, fmt.Errorf("%w: release audio identities must be complete and unique", ErrInvalidConfiguration)
		}
		if !strings.HasSuffix(asset.AssetID, asset.ProductionIdentitySHA256[:24]) {
			return evidence, fmt.Errorf("%w: release audio asset ID must bind the production identity", ErrInvalidConfiguration)
		}
		seenAudio[asset.AssetID] = true
	}
	return evidence, nil
}

func releaseMetadataContainsSensitiveField(value any) bool {
	switch typed := value.(type) {
	case map[string]any:
		for key, child := range typed {
			normalizedKey := releaseMetadataFieldNormalizer.ReplaceAllString(strings.ToLower(key), "")
			isSensitive := false
			for _, forbidden := range []string{"apikey", "token", "secret", "password", "credential", "transcript"} {
				isSensitive = isSensitive || strings.Contains(normalizedKey, forbidden)
			}
			if isSensitive || releaseMetadataContainsSensitiveField(child) {
				return true
			}
		}
	case []any:
		for _, child := range typed {
			if releaseMetadataContainsSensitiveField(child) {
				return true
			}
		}
	}
	return false
}

func validReleaseLabel(value string) bool {
	return value != "" && value == strings.TrimSpace(value) && len(value) <= 200
}

type audioReleaseLedgerEvidence struct {
	ReleaseID          string
	ReleaseSHA256      string
	CatalogueID        string
	CatalogueSHA256    string
	LicenceID          string
	Status             string
	ExpectedAssets     int
	ProducedAssets     int
	SpecialistRequired int
	Unresolved         int
}

type audioAssetLedgerEvidence struct {
	AssetID                  string
	TextSHA256               string
	AudioSHA256              string
	ProductionIdentitySHA256 string
	ProductionProfileSHA256  string
	ProductionStatus         string
	TechnicalPass            bool
}

type audioReviewLedgerEvidence struct {
	AssetID                 string
	TextSHA256              string
	AudioSHA256             string
	ProductionProfileSHA256 string
	Decision                string
}

func approvedAudioProductionStatus(status string) bool {
	switch strings.TrimSpace(status) {
	case "human_listening_approved", "approved", "production_approved", "released":
		return true
	default:
		return false
	}
}

func evaluateExactAudioReleaseEvidence(metadata ReleaseEvidenceMetadata, release audioReleaseLedgerEvidence, assets []audioAssetLedgerEvidence, reviews []audioReviewLedgerEvidence) HumanReleaseEvidence {
	result := HumanReleaseEvidence{}
	result.ExactAudioReleaseApproved = release.ReleaseID == metadata.AudioReleaseID &&
		release.ReleaseSHA256 == metadata.AudioReleaseSHA256 && release.CatalogueID == metadata.AudioCatalogueID &&
		release.CatalogueSHA256 == metadata.AudioCatalogueSHA256 && release.LicenceID == metadata.AudioLicenceID &&
		release.ExpectedAssets > 0 && release.ExpectedAssets == release.ProducedAssets &&
		release.ExpectedAssets == len(metadata.RequiredAudioAssets) && len(assets) == len(metadata.RequiredAudioAssets) &&
		release.SpecialistRequired == 0 && release.Unresolved == 0 && validAudioManifestStatus(release.Status) && release.Status != "incomplete_review_inventory"

	expectedAssets := make(map[string]ReleaseAudioEvidenceIdentity, len(metadata.RequiredAudioAssets))
	for _, asset := range metadata.RequiredAudioAssets {
		expectedAssets[asset.AssetID] = asset
	}
	storedAssets := make(map[string]audioAssetLedgerEvidence, len(assets))
	for _, asset := range assets {
		expected, ok := expectedAssets[asset.AssetID]
		if !ok || !asset.TechnicalPass || !approvedAudioProductionStatus(asset.ProductionStatus) || asset.TextSHA256 != expected.TextSHA256 || asset.AudioSHA256 != expected.AudioSHA256 ||
			asset.ProductionIdentitySHA256 != expected.ProductionIdentitySHA256 || asset.ProductionProfileSHA256 != expected.ProductionProfileSHA256 {
			result.ExactAudioReleaseApproved = false
		}
		storedAssets[asset.AssetID] = asset
	}
	for assetID := range expectedAssets {
		if _, ok := storedAssets[assetID]; !ok {
			result.ExactAudioReleaseApproved = false
		}
	}

	approvedReviews := make(map[string]bool, len(reviews))
	for _, review := range reviews {
		expected, ok := expectedAssets[review.AssetID]
		approvedReviews[review.AssetID] = ok && review.Decision == "approved" &&
			review.TextSHA256 == expected.TextSHA256 && review.AudioSHA256 == expected.AudioSHA256 &&
			review.ProductionProfileSHA256 == expected.ProductionProfileSHA256
	}
	result.RequiredAudioListeningApproved = result.ExactAudioReleaseApproved && len(approvedReviews) == len(expectedAssets)
	for assetID := range expectedAssets {
		result.RequiredAudioListeningApproved = result.RequiredAudioListeningApproved && approvedReviews[assetID]
	}
	return result
}

func loadHumanReleaseEvidence(ctx context.Context, tx pgx.Tx, manifest ContentReleaseManifest, metadata ReleaseEvidenceMetadata) (HumanReleaseEvidence, error) {
	result := HumanReleaseEvidence{}
	packIDs := make([]string, 0, len(manifest.Packs))
	for _, pack := range manifest.Packs {
		packIDs = append(packIDs, pack.PackID)
	}
	rows, err := tx.Query(ctx, `
		SELECT DISTINCT ON (pack_id,lane_id) pack_id,lane_id,batch_sha256,decision
		FROM content_review_decisions
		WHERE batch_id=$1 AND pack_id=ANY($2) AND lane_id=ANY($3)
		ORDER BY pack_id,lane_id,created_at DESC,id DESC
	`, metadata.HumanReviewBatchID, packIDs, []string{"safeguarding", "real_child_pilot_evidence"})
	if err != nil {
		return result, err
	}
	approvedHuman := map[string]bool{}
	for rows.Next() {
		var packID, laneID, batchHash, decision string
		if err := rows.Scan(&packID, &laneID, &batchHash, &decision); err != nil {
			rows.Close()
			return result, err
		}
		approvedHuman[packID+"\x00"+laneID] = strings.EqualFold(batchHash, metadata.HumanReviewBatchHash) && decision == "approved"
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return result, err
	}
	rows.Close()
	result.SafeguardingApproved = len(packIDs) > 0
	result.ChildPilotEvidenceApproved = len(packIDs) > 0
	for _, packID := range packIDs {
		result.SafeguardingApproved = result.SafeguardingApproved && approvedHuman[packID+"\x00safeguarding"]
		result.ChildPilotEvidenceApproved = result.ChildPilotEvidenceApproved && approvedHuman[packID+"\x00real_child_pilot_evidence"]
	}

	assetIDs := make([]string, 0, len(metadata.RequiredAudioAssets))
	for _, asset := range metadata.RequiredAudioAssets {
		assetIDs = append(assetIDs, asset.AssetID)
	}
	var release audioReleaseLedgerEvidence
	err = tx.QueryRow(ctx, `
		SELECT release_id,release_sha256,catalogue_id,catalogue_sha256,
		       COALESCE(licence_id,''),status,expected_assets,produced_assets,specialist_required,unresolved
		FROM audio_manifests
		WHERE release_id=$1
	`, metadata.AudioReleaseID).Scan(
		&release.ReleaseID, &release.ReleaseSHA256, &release.CatalogueID, &release.CatalogueSHA256,
		&release.LicenceID, &release.Status, &release.ExpectedAssets, &release.ProducedAssets,
		&release.SpecialistRequired, &release.Unresolved,
	)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return result, err
	}

	rows, err = tx.Query(ctx, `
		SELECT asset_id,text_sha256,audio_sha256,production_identity_sha256,
		       production_profile_sha256,production_status,technical_pass
		FROM audio_manifest_assets
		WHERE release_id=$1 AND asset_id=ANY($2)
		ORDER BY asset_id
	`, metadata.AudioReleaseID, assetIDs)
	if err != nil {
		return result, err
	}
	storedAssets := []audioAssetLedgerEvidence{}
	for rows.Next() {
		var asset audioAssetLedgerEvidence
		if err := rows.Scan(&asset.AssetID, &asset.TextSHA256, &asset.AudioSHA256, &asset.ProductionIdentitySHA256,
			&asset.ProductionProfileSHA256, &asset.ProductionStatus, &asset.TechnicalPass); err != nil {
			rows.Close()
			return result, err
		}
		storedAssets = append(storedAssets, asset)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return result, err
	}
	rows.Close()

	rows, err = tx.Query(ctx, `
		SELECT DISTINCT ON (asset_id) asset_id,text_sha256,audio_sha256,
		       COALESCE(production_profile_sha256,''),decision
		FROM narration_reviews
		WHERE asset_id=ANY($1)
		ORDER BY asset_id,created_at DESC,id DESC
	`, assetIDs)
	if err != nil {
		return result, err
	}
	storedReviews := []audioReviewLedgerEvidence{}
	for rows.Next() {
		var review audioReviewLedgerEvidence
		if err := rows.Scan(&review.AssetID, &review.TextSHA256, &review.AudioSHA256, &review.ProductionProfileSHA256, &review.Decision); err != nil {
			rows.Close()
			return result, err
		}
		storedReviews = append(storedReviews, review)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return result, err
	}
	rows.Close()
	audioEvidence := evaluateExactAudioReleaseEvidence(metadata, release, storedAssets, storedReviews)
	result.ExactAudioReleaseApproved = audioEvidence.ExactAudioReleaseApproved
	result.RequiredAudioListeningApproved = audioEvidence.RequiredAudioListeningApproved
	return result, nil
}

type ContentReleaseStore interface {
	StageContentRelease(context.Context, ContentReleaseManifest) (ContentReleaseManifest, error)
	PutContentReleaseChunk(context.Context, string, ContentReleaseChunk) (ContentReleaseManifest, error)
	ApplyContentRelease(context.Context, string) (ContentReleaseManifest, error)
	ListContentReleases(context.Context, int) ([]ContentReleaseManifest, error)
	ListContentReleasePage(context.Context, AdminPageQuery) (ContentReleasePage, error)
	ActiveContentRelease(context.Context, string) (ContentReleaseManifest, bool, error)
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
	evidenceMetadata, err := releaseEvidenceMetadata(manifest)
	if err != nil {
		return ContentReleaseManifest{}, err
	}
	aiEvidence, err := EvaluateAIReviewEligibility(ctx, tx, evidenceMetadata.AIReviewIdentities)
	if err != nil {
		return ContentReleaseManifest{}, err
	}
	humanEvidence, err := loadHumanReleaseEvidence(ctx, tx, manifest, evidenceMetadata)
	if err != nil {
		return ContentReleaseManifest{}, err
	}
	if err := ValidateReleaseEvidence(manifest.Channel, aiEvidence, humanEvidence); err != nil {
		return ContentReleaseManifest{}, err
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
	page, err := r.ListContentReleasePage(ctx, AdminPageQuery{Limit: limit})
	if err != nil {
		return nil, err
	}
	return page.ContentReleases, nil
}

func (r *PostgresRepository) ListContentReleasePage(ctx context.Context, query AdminPageQuery) (ContentReleasePage, error) {
	bounds, err := newAdminPageBounds(query)
	if err != nil {
		return ContentReleasePage{}, err
	}
	var beforeCreatedAt any
	var beforeID any
	if !bounds.BeforeCreatedAt.IsZero() {
		beforeCreatedAt = bounds.BeforeCreatedAt
		beforeID = bounds.BeforeID
	}
	var liveApplied bool
	if err := r.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM content_releases
			WHERE channel='live' AND status='applied'
		)
	`).Scan(&liveApplied); err != nil {
		return ContentReleasePage{}, err
	}
	rows, err := r.db.Query(ctx, `
		SELECT r.id,r.schema_version,r.channel,r.source_revision,r.manifest_sha256,r.complete_snapshot,
		       r.expected_pack_count,r.expected_objective_count,r.expected_activity_count,
		       r.expected_question_count,r.expected_reward_rule_count,r.status,r.packs,r.metadata,
		       r.created_at,r.updated_at,r.applied_at,
		       (SELECT count(*) FROM content_release_chunks c WHERE c.release_id=r.id)
		FROM content_releases r
		WHERE ($1::timestamptz IS NULL OR (r.created_at, r.id) < ($1::timestamptz, $2::text))
		ORDER BY r.created_at DESC, r.id DESC
		LIMIT $3
	`, beforeCreatedAt, beforeID, bounds.QueryLimit)
	if err != nil {
		return ContentReleasePage{}, err
	}
	defer rows.Close()
	items := []ContentReleaseManifest{}
	for rows.Next() {
		item, err := scanRelease(rows)
		if err != nil {
			return ContentReleasePage{}, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return ContentReleasePage{}, err
	}
	page, err := newContentReleasePage(items, bounds.Limit)
	if err != nil {
		return ContentReleasePage{}, err
	}
	page.LiveApplied = liveApplied
	return page, nil
}

func (r *PostgresRepository) ActiveContentRelease(ctx context.Context, channel string) (ContentReleaseManifest, bool, error) {
	item, err := scanRelease(r.db.QueryRow(ctx, `
		SELECT r.id,r.schema_version,r.channel,r.source_revision,r.manifest_sha256,r.complete_snapshot,
		       r.expected_pack_count,r.expected_objective_count,r.expected_activity_count,
		       r.expected_question_count,r.expected_reward_rule_count,r.status,r.packs,r.metadata,
		       r.created_at,r.updated_at,r.applied_at,
		       (SELECT count(*) FROM content_release_chunks c WHERE c.release_id=r.id)
		FROM content_releases r
		WHERE r.channel=$1 AND r.status='applied'
		ORDER BY r.applied_at DESC NULLS LAST, r.id DESC
		LIMIT 1
	`, channel))
	if errors.Is(err, pgx.ErrNoRows) {
		return ContentReleaseManifest{}, false, nil
	}
	return item, err == nil, err
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
	item.CreatedAt = formatAdminTimestamp(createdAt)
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
	if item.Channel == "live" {
		if _, err := releaseEvidenceMetadata(item); err != nil {
			return err
		}
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
