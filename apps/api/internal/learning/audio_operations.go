package learning

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const (
	maxAudioManifestAssets     = 5000
	maxAudioManifestReferences = 10000
)

var (
	ErrAudioManifestConflict = errors.New("audio manifest conflicts with an immutable release")
	ErrAudioAssetNotFound    = errors.New("audio asset is not registered in the requested release")
	audioReleaseIDPattern    = regexp.MustCompile(`^narration-release-v2-[0-9a-f]{24}$`)
	audioAssetIDPattern      = regexp.MustCompile(`^narration-v1-[0-9a-f]{24}$`)
)

type AudioManifestAsset struct {
	AssetID                  string         `json:"asset_id"`
	Text                     string         `json:"text"`
	TextSHA256               string         `json:"text_sha256"`
	AudioSHA256              string         `json:"audio_sha256"`
	ProductionIdentitySHA256 string         `json:"production_identity_sha256"`
	ProductionProfileSHA256  string         `json:"production_profile_sha256"`
	PackID                   string         `json:"pack_id"`
	Year                     int            `json:"year"`
	Kind                     string         `json:"kind"`
	File                     string         `json:"file"`
	Provider                 string         `json:"provider"`
	VoiceID                  string         `json:"voice_id"`
	ModelID                  string         `json:"model_id"`
	OutputFormat             string         `json:"output_format"`
	VoiceSettings            map[string]any `json:"voice_settings"`
	ProductionStatus         string         `json:"production_status"`
	ReuseCount               int            `json:"reuse_count"`
	Bytes                    int64          `json:"bytes"`
	TechnicalPass            bool           `json:"technical_pass"`
}

type AudioManifestReference struct {
	ReferenceID              string `json:"reference_id"`
	Status                   string `json:"status"`
	ProductionAssetID        string `json:"production_asset_id,omitempty"`
	TextSHA256               string `json:"text_sha256"`
	ProductionIdentitySHA256 string `json:"production_identity_sha256,omitempty"`
	ProductionProfileSHA256  string `json:"production_profile_sha256,omitempty"`
}

type AudioManifestImport struct {
	ReleaseID          string                   `json:"release_id"`
	ReleaseSHA256      string                   `json:"release_sha256"`
	CatalogueID        string                   `json:"catalogue_id"`
	CatalogueSHA256    string                   `json:"catalogue_sha256"`
	Provider           string                   `json:"provider"`
	LicenceID          string                   `json:"licence_id"`
	Status             string                   `json:"status"`
	ExpectedAssets     int                      `json:"expected_assets"`
	ProducedAssets     int                      `json:"produced_assets"`
	ReferenceIDs       int                      `json:"reference_ids"`
	SpecialistRequired int                      `json:"specialist_required"`
	Unresolved         int                      `json:"unresolved"`
	Assets             []AudioManifestAsset     `json:"assets"`
	References         []AudioManifestReference `json:"references"`
}

type AudioManifestImportOutcome struct {
	ReleaseID          string   `json:"release_id"`
	Status             string   `json:"status"`
	AcceptedAssets     int      `json:"accepted_assets"`
	AcceptedReferences int      `json:"accepted_references"`
	Rejected           int      `json:"rejected"`
	Replayed           bool     `json:"replayed"`
	Errors             []string `json:"errors"`
}

type AudioRerecordRequest struct {
	ID        string `json:"id,omitempty"`
	ReleaseID string `json:"release_id"`
	AssetID   string `json:"asset_id"`
	Reason    string `json:"reason"`
	Notes     string `json:"notes"`
	Status    string `json:"status,omitempty"`
	CreatedAt string `json:"created_at,omitempty"`
}

type AudioOperationsStore interface {
	ImportAudioManifest(context.Context, AudioManifestImport, string, string) (AudioManifestImportOutcome, error)
	RequestAudioRerecord(context.Context, AudioRerecordRequest, string, string) (AudioRerecordRequest, error)
}

func ValidateAudioManifestImport(manifest AudioManifestImport) error {
	if !audioReleaseIDPattern.MatchString(manifest.ReleaseID) || !validLowerAudioSHA(manifest.ReleaseSHA256) || !strings.HasSuffix(manifest.ReleaseID, manifest.ReleaseSHA256[:24]) {
		return invalidConfig("audio manifest release identity is invalid")
	}
	if !strings.HasPrefix(manifest.CatalogueID, "variant-audio-catalog-v1-") || !validLowerAudioSHA(manifest.CatalogueSHA256) || !strings.HasSuffix(manifest.CatalogueID, manifest.CatalogueSHA256[:24]) {
		return invalidConfig("audio manifest catalogue identity is invalid")
	}
	if manifest.Provider == "" || manifest.LicenceID != "provider_terms" || !validAudioManifestStatus(manifest.Status) || manifest.ProducedAssets != len(manifest.Assets) || manifest.ReferenceIDs != len(manifest.References) || manifest.ExpectedAssets < manifest.ProducedAssets {
		return invalidConfig("audio manifest totals are invalid")
	}
	if len(manifest.Assets) == 0 || len(manifest.Assets) > maxAudioManifestAssets || len(manifest.References) > maxAudioManifestReferences {
		return invalidConfig("audio manifest exceeds the bounded import size")
	}
	assets := make(map[string]AudioManifestAsset, len(manifest.Assets))
	for _, asset := range manifest.Assets {
		if !audioAssetIDPattern.MatchString(asset.AssetID) || !validLowerAudioSHA(asset.TextSHA256) || !validLowerAudioSHA(asset.AudioSHA256) || !validLowerAudioSHA(asset.ProductionIdentitySHA256) || !validLowerAudioSHA(asset.ProductionProfileSHA256) {
			return invalidConfig("audio manifest asset identity is invalid")
		}
		if _, exists := assets[asset.AssetID]; exists {
			return invalidConfig("audio manifest asset ids must be unique")
		}
		if audioSHA256(asset.Text) != asset.TextSHA256 {
			return invalidConfig("audio manifest transcript hash does not match")
		}
		if !validAudioVoiceSettings(asset.VoiceSettings) {
			return invalidConfig("audio manifest voice settings are invalid")
		}
		profileSHA, err := canonicalAudioSHA256(map[string]any{
			"provider": asset.Provider, "voice_id": asset.VoiceID, "model_id": asset.ModelID,
			"output_format": asset.OutputFormat, "voice_settings": asset.VoiceSettings,
		})
		if err != nil || profileSHA != asset.ProductionProfileSHA256 {
			return invalidConfig("audio manifest production profile hash does not match")
		}
		identitySHA, err := canonicalAudioSHA256(map[string]any{
			"version": 1, "text_sha256": asset.TextSHA256, "production_profile_sha256": profileSHA,
		})
		if err != nil || identitySHA != asset.ProductionIdentitySHA256 || asset.AssetID != "narration-v1-"+identitySHA[:24] {
			return invalidConfig("audio manifest production identity does not match")
		}
		expectedFile := "/canonical/variant/" + asset.AssetID + ".mp3"
		unsafeFile := strings.Contains(asset.File, "..") || strings.ContainsAny(asset.File, "?#\\%")
		if unsafeFile || !strings.HasPrefix(asset.File, "/audio/narration/") || !strings.HasSuffix(asset.File, expectedFile) {
			return invalidConfig("audio manifest public file is invalid")
		}
		if asset.Provider != manifest.Provider || asset.Bytes <= 0 || !asset.TechnicalPass || asset.VoiceID == "" || asset.ModelID == "" || asset.OutputFormat == "" || !validAudioProductionStatus(asset.ProductionStatus) {
			return invalidConfig("audio manifest asset production metadata is incomplete")
		}
		assets[asset.AssetID] = asset
	}
	aliases := make(map[string]bool, len(manifest.References))
	specialistRequired := 0
	unresolved := 0
	for _, reference := range manifest.References {
		if strings.TrimSpace(reference.ReferenceID) == "" || aliases[reference.ReferenceID] || !validLowerAudioSHA(reference.TextSHA256) {
			return invalidConfig("audio manifest reference ids must be complete and unique")
		}
		aliases[reference.ReferenceID] = true
		if reference.Status == "production_required" {
			if !audioAssetIDPattern.MatchString(reference.ProductionAssetID) || !validLowerAudioSHA(reference.ProductionIdentitySHA256) || !validLowerAudioSHA(reference.ProductionProfileSHA256) {
				return invalidConfig("audio manifest production reference is incomplete")
			}
			if asset, exists := assets[reference.ProductionAssetID]; exists && (asset.TextSHA256 != reference.TextSHA256 || asset.ProductionIdentitySHA256 != reference.ProductionIdentitySHA256 || asset.ProductionProfileSHA256 != reference.ProductionProfileSHA256) {
				return invalidConfig("audio manifest reference binding does not match its asset")
			}
			if _, exists := assets[reference.ProductionAssetID]; !exists && manifest.ProducedAssets == manifest.ExpectedAssets {
				return invalidConfig("complete audio manifest reference target is missing")
			}
		} else if reference.Status != "specialist_required" && reference.Status != "unresolved" {
			return invalidConfig("audio manifest reference status is invalid")
		} else {
			if reference.ProductionAssetID != "" || reference.ProductionIdentitySHA256 != "" || reference.ProductionProfileSHA256 != "" {
				return invalidConfig("non-production audio reference cannot bind a production asset")
			}
			if reference.Status == "specialist_required" {
				specialistRequired++
			} else {
				unresolved++
			}
		}
	}
	if specialistRequired != manifest.SpecialistRequired || unresolved != manifest.Unresolved {
		return invalidConfig("audio manifest blocker totals are invalid")
	}
	return nil
}

func validLowerAudioSHA(value string) bool {
	return value == strings.TrimSpace(value) && value == strings.ToLower(value) && validSHA256(value)
}

func canonicalAudioSHA256(value any) (string, error) {
	body, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	return audioSHA256(string(body)), nil
}

func audioSHA256(value string) string {
	digest := sha256.Sum256([]byte(value))
	return hex.EncodeToString(digest[:])
}

func validAudioVoiceSettings(settings map[string]any) bool {
	if len(settings) != 5 {
		return false
	}
	for _, key := range []string{"similarity_boost", "speed", "stability", "style"} {
		if _, ok := settings[key].(float64); !ok {
			return false
		}
	}
	_, speakerBoost := settings["use_speaker_boost"].(bool)
	return speakerBoost
}

func validAudioProductionStatus(status string) bool {
	switch strings.TrimSpace(status) {
	case "generated_pending_human_listening", "required_human_listening_review", "human_listening_approved", "approved", "production_approved", "released", "rejected", "re_record_required":
		return true
	default:
		return false
	}
}

func validAudioManifestStatus(status string) bool {
	switch strings.TrimSpace(status) {
	case "incomplete_review_inventory", "generated_pending_human_listening", "human_listening_approved", "production_approved", "released":
		return true
	default:
		return false
	}
}

func ValidateAudioRerecordRequest(request AudioRerecordRequest) error {
	if !audioReleaseIDPattern.MatchString(strings.TrimSpace(request.ReleaseID)) || !audioAssetIDPattern.MatchString(strings.TrimSpace(request.AssetID)) {
		return invalidConfig("rerecord request must bind a valid release and asset")
	}
	switch strings.TrimSpace(request.Reason) {
	case "pronunciation", "naturalness", "clarity", "age_suitability", "pace", "technical", "transcript_change", "other":
	default:
		return invalidConfig("rerecord request reason is invalid")
	}
	if strings.TrimSpace(request.Notes) == "" || len(request.Notes) > 2000 {
		return invalidConfig("rerecord request notes are required and must be at most 2000 characters")
	}
	return nil
}

func (r *PostgresRepository) ImportAudioManifest(ctx context.Context, manifest AudioManifestImport, actor, idempotencyKey string) (AudioManifestImportOutcome, error) {
	outcome := AudioManifestImportOutcome{ReleaseID: manifest.ReleaseID, Errors: []string{}}
	if err := ValidateAudioManifestImport(manifest); err != nil {
		return outcome, err
	}
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return outcome, invalidConfig("audio manifest import actor is required")
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return outcome, err
	}
	defer tx.Rollback(ctx)

	replay, err := beginIdempotency(ctx, tx, "audio.manifest.import", actor, idempotencyKey, manifest)
	if err != nil {
		return outcome, err
	}
	if replay.Found {
		if err := json.Unmarshal(replay.Response, &outcome); err != nil {
			return outcome, err
		}
		outcome.Replayed = true
		return outcome, nil
	}

	var existingSHA string
	var existingAssets, existingReferences int
	existingErr := tx.QueryRow(ctx, `
		SELECT release_sha256, produced_assets, reference_ids
		FROM audio_manifests
		WHERE release_id=$1
	`, manifest.ReleaseID).Scan(&existingSHA, &existingAssets, &existingReferences)
	if existingErr == nil {
		if existingSHA != manifest.ReleaseSHA256 {
			return outcome, ErrAudioManifestConflict
		}
		outcome.Status = "imported"
		outcome.AcceptedAssets = existingAssets
		outcome.AcceptedReferences = existingReferences
		outcome.Replayed = true
		if err := completeIdempotency(ctx, tx, "audio.manifest.import", actor, idempotencyKey, outcome); err != nil {
			return outcome, err
		}
		if err := tx.Commit(ctx); err != nil {
			return outcome, err
		}
		return outcome, nil
	}
	if !errors.Is(existingErr, pgx.ErrNoRows) {
		return outcome, existingErr
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO audio_manifests(
			release_id, release_sha256, catalogue_id, catalogue_sha256, provider, licence_id, status,
			expected_assets, produced_assets, reference_ids, specialist_required, unresolved, imported_by
		) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
	`, manifest.ReleaseID, manifest.ReleaseSHA256, manifest.CatalogueID, manifest.CatalogueSHA256,
		manifest.Provider, manifest.LicenceID, manifest.Status, manifest.ExpectedAssets, manifest.ProducedAssets,
		manifest.ReferenceIDs, manifest.SpecialistRequired, manifest.Unresolved, actor); err != nil {
		return outcome, err
	}
	assetRows := make([][]any, 0, len(manifest.Assets))
	for _, asset := range manifest.Assets {
		settings, err := json.Marshal(asset.VoiceSettings)
		if err != nil {
			return outcome, err
		}
		assetRows = append(assetRows, []any{
			manifest.ReleaseID, asset.AssetID, asset.Text, asset.TextSHA256, asset.AudioSHA256,
			asset.ProductionIdentitySHA256, asset.ProductionProfileSHA256, asset.PackID, asset.Year,
			asset.Kind, asset.File, asset.Provider, asset.VoiceID, asset.ModelID, asset.OutputFormat,
			string(settings), asset.ProductionStatus, asset.ReuseCount, asset.Bytes, asset.TechnicalPass,
		})
	}
	assetCount, err := tx.CopyFrom(ctx, pgx.Identifier{"audio_manifest_assets"}, []string{
		"release_id", "asset_id", "transcript", "text_sha256", "audio_sha256",
		"production_identity_sha256", "production_profile_sha256", "pack_id", "year_group", "kind",
		"public_file", "provider", "voice_id", "model_id", "output_format", "voice_settings",
		"production_status", "reuse_count", "byte_count", "technical_pass",
	}, pgx.CopyFromRows(assetRows))
	if err != nil {
		return outcome, err
	}
	if int(assetCount) != len(manifest.Assets) {
		return outcome, errors.New("audio manifest asset import was incomplete")
	}
	referenceRows := make([][]any, 0, len(manifest.References))
	for _, reference := range manifest.References {
		referenceRows = append(referenceRows, []any{
			manifest.ReleaseID, reference.ReferenceID, reference.Status,
			nullableAudioString(reference.ProductionAssetID), reference.TextSHA256,
			nullableAudioString(reference.ProductionIdentitySHA256), nullableAudioString(reference.ProductionProfileSHA256),
		})
	}
	referenceCount, err := tx.CopyFrom(ctx, pgx.Identifier{"audio_manifest_references"}, []string{
		"release_id", "reference_id", "status", "production_asset_id", "text_sha256",
		"production_identity_sha256", "production_profile_sha256",
	}, pgx.CopyFromRows(referenceRows))
	if err != nil {
		return outcome, err
	}
	if int(referenceCount) != len(manifest.References) {
		return outcome, errors.New("audio manifest reference import was incomplete")
	}
	outcome.Status = "imported"
	outcome.AcceptedAssets = len(manifest.Assets)
	outcome.AcceptedReferences = len(manifest.References)
	if _, err := tx.Exec(ctx, `
		INSERT INTO audit_logs(action, entity_type, entity_id, payload)
		VALUES('import', 'audio_manifest', $1, $2::jsonb)
	`, manifest.ReleaseID, mustJSON(map[string]any{
		"release_id": manifest.ReleaseID, "release_sha256": manifest.ReleaseSHA256,
		"catalogue_id": manifest.CatalogueID, "licence_id": manifest.LicenceID, "assets": len(manifest.Assets),
		"references": len(manifest.References), "imported_by": actor,
	})); err != nil {
		return outcome, err
	}
	if err := completeIdempotency(ctx, tx, "audio.manifest.import", actor, idempotencyKey, outcome); err != nil {
		return outcome, err
	}
	if err := tx.Commit(ctx); err != nil {
		return outcome, err
	}
	return outcome, nil
}

func (r *PostgresRepository) RequestAudioRerecord(ctx context.Context, request AudioRerecordRequest, actor, idempotencyKey string) (AudioRerecordRequest, error) {
	if err := ValidateAudioRerecordRequest(request); err != nil {
		return request, err
	}
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return request, invalidConfig("audio rerecord actor is required")
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return request, err
	}
	defer tx.Rollback(ctx)
	replay, err := beginIdempotency(ctx, tx, "audio.rerecord.request", actor, idempotencyKey, request)
	if err != nil {
		return request, err
	}
	if replay.Found {
		if err := json.Unmarshal(replay.Response, &request); err != nil {
			return request, err
		}
		return request, nil
	}
	var exists bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM audio_manifest_assets WHERE release_id=$1 AND asset_id=$2
		)
	`, request.ReleaseID, request.AssetID).Scan(&exists); err != nil {
		return request, err
	}
	if !exists {
		return request, ErrAudioAssetNotFound
	}
	var createdAt time.Time
	if err := tx.QueryRow(ctx, `
		INSERT INTO audio_rerecord_requests(release_id, asset_id, reason, notes, requested_by)
		VALUES($1,$2,$3,$4,$5)
		RETURNING id::text, status, created_at
	`, request.ReleaseID, request.AssetID, request.Reason, request.Notes, actor).Scan(&request.ID, &request.Status, &createdAt); err != nil {
		return request, err
	}
	request.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	if _, err := tx.Exec(ctx, `
		INSERT INTO audit_logs(action, entity_type, entity_id, payload)
		VALUES('rerecord_request', 'audio_asset', $1, $2::jsonb)
	`, request.AssetID, mustJSON(map[string]any{
		"request_id": request.ID, "release_id": request.ReleaseID, "asset_id": request.AssetID,
		"reason": request.Reason, "requested_by": actor,
	})); err != nil {
		return request, err
	}
	if err := completeIdempotency(ctx, tx, "audio.rerecord.request", actor, idempotencyKey, request); err != nil {
		return request, err
	}
	if err := tx.Commit(ctx); err != nil {
		return request, err
	}
	return request, nil
}

func nullableAudioString(value string) any {
	if value == "" {
		return nil
	}
	return value
}
