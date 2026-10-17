package contentgate

import (
	"os"
	"path/filepath"
	"testing"
)

func TestChildSafetyBlocksUnreviewedAndUnapprovedAudio(t *testing.T) {
	dir := t.TempDir()
	pack := `{
	  "pack_id": "ma-y4-demo",
	  "source_alignment": {"year": 4, "subject": "Mathematics"},
	  "qa": {"curriculum_review": "approved", "teacher_review": "approved", "accessibility_review": "complete", "safeguarding_review": "approved"},
	  "question_variants": [
	    {"status": "approved", "body": {"prompt": "Ready"}},
	    {"status": "approved", "body": {"audio_asset_id": "clip-ready"}},
	    {"status": "approved", "body": {"audio_asset_id": "clip-pending"}},
	    {"status": "review", "body": {"prompt": "Waiting"}}
	  ]
	}`
	unreviewed := `{
	  "pack_id": "en-y1-demo",
	  "source_alignment": {"year": 1, "subject": "English"},
	  "qa": {"curriculum_review": "in_progress", "teacher_review": "not_started", "accessibility_review": "not_started", "safeguarding_review": "not_started"},
	  "question_variants": [{"status": "approved", "body": {"prompt": "Technical only"}}]
	}`
	if err := os.WriteFile(filepath.Join(dir, "ready.json"), []byte(pack), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "hold.json"), []byte(unreviewed), 0o644); err != nil {
		t.Fatal(err)
	}
	manifest := filepath.Join(dir, "manifest.json")
	if err := os.WriteFile(manifest, []byte(`{"items":[
	  {"id":"clip-ready","production_status":"human_listening_approved","technical_pass":true},
	  {"id":"clip-pending","production_status":"generated_pending_human_listening","technical_pass":true}
	]}`), 0o644); err != nil {
		t.Fatal(err)
	}
	report, err := Scan(dir, manifest)
	if err != nil {
		t.Fatal(err)
	}
	if report.ChildServableVariants != 2 || report.BlockedVariants != 3 || report.RuntimeStatusWithoutHumanApproval != 1 {
		t.Fatalf("%+v", report)
	}
	if report.NarrationsServable != 1 || report.NarrationsBlocked != 1 {
		t.Fatalf("audio %+v", report)
	}
}

func TestMissingCatalogueIsExplicitlyUnavailable(t *testing.T) {
	report, err := Scan(filepath.Join(t.TempDir(), "missing"), filepath.Join(t.TempDir(), "missing.json"))
	if err != nil {
		t.Fatal(err)
	}
	if report.CatalogueAvailable {
		t.Fatal("missing packs were treated as an empty safe catalogue")
	}
}
