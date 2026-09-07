package learning

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5"
)

// Populated only from the database when serving/marking, never from authored
// readiness flags. Serialized solely into private immutable grading snapshots.
type RequiredListeningAsset struct {
	ReferenceID string `json:"reference_id"`
	ReleaseID   string `json:"release_id"`
	ReviewID    string `json:"review_id"`
	File        string `json:"file"`
	ReleaseAudioEvidenceIdentity
}

func requiresListening(q QuestionConfig) bool {
	if value, present := q.Body["audio_required"]; present && value != false && value != nil {
		return true
	}
	status, _ := q.Body["audio_asset_status"].(string)
	return status == "required" || status == "required_before_pilot"
}

func requiredListeningReferences(q QuestionConfig) []string {
	refs := []string{}
	seen := map[string]bool{}
	keys := []string{"audio_asset_id", "audio_ref", "whole_audio_asset_id"}
	if value, _ := q.Body["whole_audio_asset_id"].(string); strings.TrimSpace(value) == "" {
		keys = append(keys, "whole_word_audio_asset_id")
	}
	for _, key := range keys {
		if ref, ok := q.Body[key].(string); ok && strings.TrimSpace(ref) != "" {
			ref = strings.TrimSpace(ref)
			if !seen[ref] {
				refs = append(refs, ref)
				seen[ref] = true
			}
		}
	}
	return refs
}

func listeningReady(q QuestionConfig) bool {
	refs := requiredListeningReferences(q)
	if len(refs) == 0 || len(refs) != len(q.RequiredListening) {
		return false
	}
	for i, ref := range refs {
		if q.RequiredListening[i].ReferenceID != ref || q.RequiredListening[i].File == "" {
			return false
		}
	}
	return true
}

type listeningQueryer interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}

func resolveRequiredListening(ctx context.Context, db listeningQueryer, questions []QuestionConfig) error {
	type request struct {
		QuestionID  string `json:"question_id"`
		ReferenceID string `json:"reference_id"`
	}
	requests := []request{}
	for i := range questions {
		questions[i].RequiredListening = nil // Ignore any historical/authored assertion.
		if requiresListening(questions[i]) {
			for _, ref := range requiredListeningReferences(questions[i]) {
				requests = append(requests, request{questions[i].ID, ref})
			}
		}
	}
	if len(requests) == 0 {
		return nil
	}
	// One query per bounded question batch, not one lookup per clip. A later
	// rejection must revoke an earlier approval: select latest BEFORE hash checks.
	rows, err := db.Query(ctx, `
 WITH requested AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(question_id text,reference_id text))
 SELECT wanted.question_id,wanted.reference_id,m.release_id,n.id::text,a.public_file,
        a.asset_id,a.text_sha256,a.audio_sha256,a.production_identity_sha256,a.production_profile_sha256
 FROM requested wanted
 JOIN questions q ON q.id=wanted.question_id
 JOIN content_releases c ON c.id=q.content_release_id AND c.channel='live' AND c.status='applied'
 JOIN audio_manifests m ON m.release_id=c.metadata->>'audio_release_id'
   AND m.release_sha256=c.metadata->>'audio_release_sha256'
   AND m.catalogue_id=c.metadata->>'audio_catalogue_id'
   AND m.catalogue_sha256=c.metadata->>'audio_catalogue_sha256'
   AND m.licence_id=c.metadata->>'audio_licence_id'
 LEFT JOIN audio_manifest_references ref ON ref.release_id=m.release_id AND ref.reference_id=wanted.reference_id
 JOIN audio_manifest_assets a ON a.release_id=m.release_id AND a.asset_id=COALESCE(ref.production_asset_id,wanted.reference_id)
 JOIN LATERAL (SELECT id,decision,text_sha256,audio_sha256,production_profile_sha256,criteria
   FROM narration_reviews WHERE asset_id=a.asset_id ORDER BY created_at DESC,id DESC LIMIT 1) n ON TRUE
 WHERE m.expected_assets>0 AND m.expected_assets=m.produced_assets AND m.specialist_required=0 AND m.unresolved=0
   AND m.status IN ('human_listening_approved','approved','production_approved','released')
   AND a.technical_pass AND a.production_status IN ('human_listening_approved','approved','production_approved','released')
   AND n.decision='approved' AND n.text_sha256=a.text_sha256 AND n.audio_sha256=a.audio_sha256
   AND n.production_profile_sha256=a.production_profile_sha256
   AND n.criteria @> '{"natural":true,"clear":true,"pronunciation":true,"age_suitable":true}'::jsonb
   AND a.public_file ~ '^/audio/[a-zA-Z0-9_./-]+\.(mp3|wav|ogg|m4a)$' AND a.public_file NOT LIKE '%..%'
   AND (ref.reference_id IS NULL OR (ref.status='production_required' AND ref.text_sha256=a.text_sha256
       AND ref.production_identity_sha256=a.production_identity_sha256 AND ref.production_profile_sha256=a.production_profile_sha256))
   AND c.metadata @> jsonb_build_object('required_audio_assets',jsonb_build_array(jsonb_build_object(
       'asset_id',a.asset_id,'text_sha256',a.text_sha256,'audio_sha256',a.audio_sha256,
       'production_identity_sha256',a.production_identity_sha256,'production_profile_sha256',a.production_profile_sha256)))
 `, mustJSON(requests))
	if err != nil {
		return err
	}
	defer rows.Close()
	found := map[string]map[string]RequiredListeningAsset{}
	for rows.Next() {
		var id string
		var asset RequiredListeningAsset
		if err := rows.Scan(&id, &asset.ReferenceID, &asset.ReleaseID, &asset.ReviewID, &asset.File, &asset.AssetID, &asset.TextSHA256, &asset.AudioSHA256, &asset.ProductionIdentitySHA256, &asset.ProductionProfileSHA256); err != nil {
			return err
		}
		if found[id] == nil {
			found[id] = map[string]RequiredListeningAsset{}
		}
		found[id][asset.ReferenceID] = asset
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for i := range questions {
		if !requiresListening(questions[i]) {
			continue
		}
		for _, ref := range requiredListeningReferences(questions[i]) {
			if asset, ok := found[questions[i].ID][ref]; ok {
				questions[i].RequiredListening = append(questions[i].RequiredListening, asset)
			}
		}
		questions[i].QuestionVersion = questionContractVersion(questions[i])
		questions[i].ResponseKind, _, _ = canonicalAnswer(questions[i])
	}
	return nil
}
