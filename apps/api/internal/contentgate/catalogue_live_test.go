package contentgate

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

// Counts are allowed to change when a person approves a pack. The test checks
// that the real catalogue still parses and that the totals still add up.
func TestLiveCatalogueSafetyInvariants(t *testing.T) {
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("caller")
	}
	root := filepath.Clean(filepath.Join(filepath.Dir(file), "..", "..", "..", ".."))
	packDir := filepath.Join(root, "packages", "content", "packs")
	manifest := filepath.Join(root, "apps", "web", "public", "content", "narration-manifest.json")
	if _, err := os.Stat(packDir); err != nil {
		t.Skip("content packs are not in this checkout")
	}
	report, err := Scan(packDir, manifest)
	if err != nil {
		t.Fatal(err)
	}
	if !report.CatalogueAvailable || report.Packs == 0 || report.Variants == 0 || report.Narrations == 0 {
		t.Fatalf("catalogue was not readable: %+v", summary(report))
	}
	if report.ChildServableVariants+report.BlockedVariants != report.Variants {
		t.Fatalf("variant totals: %+v", summary(report))
	}
	if report.NarrationsServable+report.NarrationsBlocked != report.Narrations {
		t.Fatalf("narration totals: %+v", summary(report))
	}
	t.Logf("packs=%d variants=%d child_servable=%d blocked=%d runtime_without_human=%d narrations=%d narration_servable=%d narration_blocked=%d",
		report.Packs, report.Variants, report.ChildServableVariants, report.BlockedVariants, report.RuntimeStatusWithoutHumanApproval,
		report.Narrations, report.NarrationsServable, report.NarrationsBlocked)
}

func summary(report Report) Report {
	report.PackSummaries = nil
	return report
}
