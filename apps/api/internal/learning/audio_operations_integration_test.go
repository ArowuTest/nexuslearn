package learning

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPostgresAudioOperationsAreTransactionalAndIdempotent(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	manifest := validAudioManifestImport(t)

	first, err := repo.ImportAudioManifest(ctx, manifest, "audio-admin-1", "import-audio-release")
	if err != nil {
		t.Fatalf("first audio manifest import: %v", err)
	}
	if first.Replayed || first.AcceptedAssets != 1 || first.AcceptedReferences != 1 || first.Status != "imported" {
		t.Fatalf("unexpected first import outcome %#v", first)
	}
	replay, err := repo.ImportAudioManifest(ctx, manifest, "audio-admin-1", "import-audio-release")
	if err != nil || !replay.Replayed || replay.ReleaseID != first.ReleaseID {
		t.Fatalf("same idempotency key should replay the committed result, outcome=%#v err=%v", replay, err)
	}
	businessReplay, err := repo.ImportAudioManifest(ctx, manifest, "audio-admin-1", "import-audio-release-again")
	if err != nil || !businessReplay.Replayed {
		t.Fatalf("same immutable release under a new transport key should replay, outcome=%#v err=%v", businessReplay, err)
	}

	changedPayload := manifest
	changedPayload.Status = "changed-after-first-request"
	if _, err := repo.ImportAudioManifest(ctx, changedPayload, "audio-admin-1", "import-audio-release"); !errors.Is(err, ErrIdempotencyConflict) {
		t.Fatalf("same transport key with a changed payload must conflict, got %v", err)
	}
	immutableConflict := manifest
	immutableConflict.ReleaseSHA256 = immutableConflict.ReleaseSHA256[:24] + strings.Repeat("f", 40)
	if _, err := repo.ImportAudioManifest(ctx, immutableConflict, "audio-admin-1", "import-colliding-release"); !errors.Is(err, ErrAudioManifestConflict) {
		t.Fatalf("same release id with a different full digest must conflict, got %v", err)
	}

	assertAudioRowCount(t, ctx, pool, "audio_manifests", 1)
	assertAudioRowCount(t, ctx, pool, "audio_manifest_assets", 1)
	assertAudioRowCount(t, ctx, pool, "audio_manifest_references", 1)

	rerecord := AudioRerecordRequest{
		ReleaseID: manifest.ReleaseID, AssetID: manifest.Assets[0].AssetID,
		Reason: "pronunciation", Notes: "The final consonant needs another take.",
	}
	created, err := repo.RequestAudioRerecord(ctx, rerecord, "audio-reviewer-1", "rerecord-asset")
	if err != nil || created.ID == "" || created.Status != "open" {
		t.Fatalf("create rerecord request: request=%#v err=%v", created, err)
	}
	rerecordReplay, err := repo.RequestAudioRerecord(ctx, rerecord, "audio-reviewer-1", "rerecord-asset")
	if err != nil || rerecordReplay.ID != created.ID {
		t.Fatalf("rerecord replay must return the immutable request, request=%#v err=%v", rerecordReplay, err)
	}
	changedRerecord := rerecord
	changedRerecord.Notes = "A different request body."
	if _, err := repo.RequestAudioRerecord(ctx, changedRerecord, "audio-reviewer-1", "rerecord-asset"); !errors.Is(err, ErrIdempotencyConflict) {
		t.Fatalf("changed rerecord payload under one key must conflict, got %v", err)
	}
	missing := rerecord
	missing.AssetID = "narration-v1-" + strings.Repeat("e", 24)
	if _, err := repo.RequestAudioRerecord(ctx, missing, "audio-reviewer-1", "rerecord-missing"); !errors.Is(err, ErrAudioAssetNotFound) {
		t.Fatalf("unregistered rerecord asset must fail, got %v", err)
	}
	assertAudioRowCount(t, ctx, pool, "audio_rerecord_requests", 1)
}

func assertAudioRowCount(t *testing.T, ctx context.Context, pool *pgxpool.Pool, table string, want int) {
	t.Helper()
	var got int
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM "+table).Scan(&got); err != nil {
		t.Fatal(err)
	}
	if got != want {
		t.Fatalf("%s row count=%d want=%d", table, got, want)
	}
}
