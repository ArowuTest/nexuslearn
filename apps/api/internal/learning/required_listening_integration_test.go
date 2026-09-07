package learning

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Synthetic release/review fixtures in a disposable schema; no real asset is approved.
func listeningFixture(t *testing.T) (*pgxpool.Pool, *PostgresRepository, AudioManifestImport) {
	t.Helper()
	pool, repo := openPaginationIntegrationRepository(t)
	ctx := context.Background()
	m := validAudioManifestImport(t)
	m.Status = "released"
	m.Assets[0].ProductionStatus = "released"
	if _, err := repo.ImportAudioManifest(ctx, m, "synthetic-test", "listening-import"); err != nil {
		t.Fatal(err)
	}
	asset := m.Assets[0]
	metadata := ReleaseEvidenceMetadata{AudioReleaseID: m.ReleaseID, AudioReleaseSHA256: m.ReleaseSHA256, AudioCatalogueID: m.CatalogueID, AudioCatalogueSHA256: m.CatalogueSHA256, AudioLicenceID: m.LicenceID, RequiredAudioAssets: []ReleaseAudioEvidenceIdentity{{AssetID: asset.AssetID, TextSHA256: asset.TextSHA256, AudioSHA256: asset.AudioSHA256, ProductionIdentitySHA256: asset.ProductionIdentitySHA256, ProductionProfileSHA256: asset.ProductionProfileSHA256}}}
	if _, err := pool.Exec(ctx, `INSERT INTO content_releases(id,schema_version,channel,manifest_sha256,expected_pack_count,expected_objective_count,expected_activity_count,expected_question_count,expected_reward_rule_count,status,metadata,applied_at) VALUES ('listening-release','test','live','test-hash',1,1,0,1,0,'applied',$1,now())`, mustJSON(metadata)); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO students(external_ref,display_name,year_group) VALUES ('listening-child','Synthetic test',1);
 INSERT INTO curriculum_objectives(id,year_group,subject,strand,topic,statement,content_release_id) VALUES ('listening-o',1,'English','Phonics','Blend','Blend a word','listening-release');`); err != nil {
		t.Fatal(err)
	}
	body := map[string]any{"prompt": "Listen and build the word.", "audio_required": true, "audio_asset_id": m.References[0].ReferenceID, "prompt_audio_url": "https://untrusted.example/fake.mp3"}
	if _, err := pool.Exec(ctx, `INSERT INTO questions(id,objective_id,format,body,expected_answer,status,content_release_id) VALUES ('listening-q','listening-o','word-build',$1,'{"value":"cat"}','approved','listening-release')`, mustJSON(body)); err != nil {
		t.Fatal(err)
	}
	return pool, repo, m
}

func listeningDecision(t *testing.T, repo *PostgresRepository, m AudioManifestImport, decision, key string) {
	t.Helper()
	a := m.Assets[0]
	review := NarrationReview{AssetID: a.AssetID, TextSHA256: a.TextSHA256, AudioSHA256: a.AudioSHA256, ProductionProfileSHA256: a.ProductionProfileSHA256, Decision: decision, ReviewerID: "synthetic-test", ReviewerName: "Synthetic test only", Criteria: map[string]bool{"natural": true, "clear": true, "pronunciation": true, "age_suitable": true}, Notes: "Disposable fixture, not a real listening decision"}
	if _, err := repo.SaveNarrationReview(context.Background(), review, key); err != nil {
		t.Fatal(err)
	}
}

func listeningQuestion(t *testing.T, repo *PostgresRepository) QuestionConfig {
	t.Helper()
	qs, err := repo.ListQuestionsForActivity(context.Background(), "", "listening-o", 2)
	if err != nil || len(qs) != 1 {
		t.Fatalf("questions=%+v err=%v", qs, err)
	}
	return qs[0]
}

func TestPostgresRequiredListeningReleaseReviewSnapshotAndReplay(t *testing.T) {
	pool, repo, m := listeningFixture(t)
	ctx := context.Background()
	q := listeningQuestion(t, repo)
	a := Attempt{StudentID: "listening-child", QuestionID: q.ID, ObjectiveID: q.ObjectiveID, QuestionVersion: q.QuestionVersion, IdempotencyKey: "listening-answer", Response: &AnswerResponse{Kind: "text", Value: json.RawMessage(`"cat"`)}}
	if q.ResponseKind != "review" {
		t.Fatal("asset without listening decision was served as markable")
	}
	if _, err := repo.RecordAttempt(ctx, a); !errors.Is(err, ErrQuestionNeedsReview) {
		t.Fatalf("missing review accepted: %v", err)
	}
	listeningDecision(t, repo, m, "approved", "approve")
	q = listeningQuestion(t, repo)
	a.QuestionVersion = q.QuestionVersion
	if q.ResponseKind != "text" || len(q.RequiredListening) != 1 {
		t.Fatalf("exact approval not served: %+v", q)
	}
	public := PupilQuestion(q)
	raw, _ := json.Marshal(public)
	if public.Body["audio_url"] != m.Assets[0].File || public.Body["prompt_audio_url"] != nil || strings.Contains(string(raw), "required_listening_evidence") || strings.Contains(string(raw), m.Assets[0].AudioSHA256) {
		t.Fatalf("public boundary: %s", raw)
	}
	result, err := repo.RecordAttempt(ctx, a)
	if err != nil || !result.Correct {
		t.Fatalf("approved recording not markable: %+v %v", result, err)
	}
	var snapshot []byte
	if err := pool.QueryRow(ctx, `SELECT snapshot FROM question_grading_versions WHERE version=$1`, a.QuestionVersion).Scan(&snapshot); err != nil {
		t.Fatal(err)
	}
	var frozen QuestionConfig
	if err := json.Unmarshal(snapshot, &frozen); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(frozen.RequiredListening, q.RequiredListening) || questionContractVersion(frozen) != a.QuestionVersion {
		t.Fatal("snapshot lost audio identity")
	}
	if _, got, err := gradeCanonicalAttempt(a, frozen); err != nil || !got.Correct {
		t.Fatalf("frozen result changed: %+v %v", got, err)
	}
	listeningDecision(t, repo, m, "rejected", "revoke")
	revoked := listeningQuestion(t, repo)
	if revoked.ResponseKind != "review" || revoked.QuestionVersion == a.QuestionVersion {
		t.Fatal("latest rejection did not revoke availability/version")
	}
	replay, err := repo.RecordAttempt(ctx, a)
	if err != nil || !reflect.DeepEqual(result, replay) {
		t.Fatalf("saved replay changed: %+v %v", replay, err)
	}
	a.IdempotencyKey = "new-after-revoke"
	a.QuestionVersion = revoked.QuestionVersion
	if _, err := repo.RecordAttempt(ctx, a); !errors.Is(err, ErrQuestionNeedsReview) {
		t.Fatalf("revoked clip accepted: %v", err)
	}
	var count int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM question_attempts WHERE question_id='listening-q'`).Scan(&count); err != nil || count != 1 {
		t.Fatalf("unavailable attempts wrote evidence: %d %v", count, err)
	}
}

func TestPostgresRequiredListeningRejectsMismatchedOrPartialEvidence(t *testing.T) {
	pool, repo, m := listeningFixture(t)
	ctx := context.Background()
	listeningDecision(t, repo, m, "approved", "approve")
	for _, tc := range []struct{ name, sql string }{
		{"stale review hash", `UPDATE narration_reviews SET audio_sha256=repeat('0',64)`},
		{"unreleased asset", `UPDATE audio_manifest_assets SET production_status='generated_pending_human_listening'`},
		{"technical failure", `UPDATE audio_manifest_assets SET technical_pass=false`},
		{"unresolved alias", `UPDATE audio_manifest_references SET status='unresolved'`},
		{"stale reference identity", `UPDATE audio_manifest_references SET production_identity_sha256=repeat('0',64)`},
		{"wrong release digest", `UPDATE content_releases SET metadata=jsonb_set(metadata,'{audio_release_sha256}','"wrong"')`},
		{"missing asset binding", `UPDATE content_releases SET metadata=jsonb_set(metadata,'{required_audio_assets}','[]')`},
		{"partial required references", `UPDATE questions SET body=body||'{"audio_ref":"another-missing-reference"}'::jsonb`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			tx, err := pool.Begin(ctx)
			if err != nil {
				t.Fatal(err)
			}
			defer tx.Rollback(ctx)
			if _, err := tx.Exec(ctx, tc.sql); err != nil {
				t.Fatal(err)
			}
			q, err := canonicalQuestion(ctx, tx, "listening-q")
			if err != nil {
				t.Fatal(err)
			}
			if kind, _, err := canonicalAnswer(q); kind != "review" || !errors.Is(err, ErrQuestionNeedsReview) {
				t.Fatalf("invalid evidence markable: %s %v", kind, err)
			}
		})
	}
}
