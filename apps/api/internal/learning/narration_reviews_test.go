package learning

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestValidateNarrationReviewAcceptsExactProfileBindingAndLegacyRows(t *testing.T) {
	base := NarrationReview{
		AssetID: "narration-v1-test", TextSHA256: strings.Repeat("a", 64), AudioSHA256: strings.Repeat("b", 64),
		Decision: "approved", ReviewerName: "A. Reviewer",
		Criteria: map[string]bool{"natural": true, "clear": true, "pronunciation": true, "age_suitable": true},
	}
	legacy := base
	if err := ValidateNarrationReview(legacy); err != nil {
		t.Fatalf("historical review without a profile hash must remain readable: %v", err)
	}
	v2 := base
	v2.ProductionProfileSHA256 = strings.Repeat("c", 64)
	if err := ValidateNarrationReview(v2); err != nil {
		t.Fatalf("exact v2 profile binding should validate: %v", err)
	}
	v2.ProductionProfileSHA256 = strings.Repeat("C", 64)
	if err := ValidateNarrationReview(v2); err == nil {
		t.Fatal("uppercase or malformed profile hashes must fail closed")
	}
}

func TestValidateNarrationReviewRequiresPlaybackCompletionForWorkspaceApproval(t *testing.T) {
	base := NarrationReview{
		AssetID: "narration-v1-test", TextSHA256: strings.Repeat("a", 64), AudioSHA256: strings.Repeat("b", 64),
		Decision: "approved", ReviewerName: "A. Reviewer",
		Criteria:         map[string]bool{"natural": true, "clear": true, "pronunciation": true, "age_suitable": true},
		PlaybackEvidence: &NarrationPlaybackEvidence{Surface: "admin_audio_workspace"},
	}
	if err := ValidateNarrationReview(base); err == nil {
		t.Fatal("the authenticated workspace must not approve before the exact player reaches the end")
	}

	base.PlaybackEvidence.Completed = true
	base.PlaybackEvidence.DurationMS = 7_250
	if err := json.Unmarshal([]byte(`{"coverage_version":"played-ranges-v1","played_ms":7250,"playback_rate":1}`), base.PlaybackEvidence); err != nil {
		t.Fatal(err)
	}
	if err := ValidateNarrationReview(base); err != nil {
		t.Fatalf("completed playback evidence should validate: %v", err)
	}

	base.PlaybackEvidence.Surface = "unknown_surface"
	if err := ValidateNarrationReview(base); err == nil {
		t.Fatal("unknown playback surfaces must fail closed")
	}
}

func TestNarrationPlaybackCoverageValidation(t *testing.T) {
	for _, tc := range []struct {
		name, evidence  string
		rejected, valid bool
	}{
		{"ended only", `{"surface":"admin_audio_workspace","completed":true,"duration_ms":7250}`, false, false},
		{"full", `{"duration_ms":7250,"played_ms":7250}`, false, true},
		{"skipped ranges", `{"duration_ms":7250,"played_ms":4000}`, false, false},
		{"zero played", `{"duration_ms":7250,"played_ms":0}`, false, false},
		{"negative played", `{"duration_ms":7250,"played_ms":-1}`, false, false},
		{"overcount", `{"duration_ms":7250,"played_ms":7251}`, false, false},
		{"rate two", `{"duration_ms":7250,"played_ms":7250,"playback_rate":2}`, false, false},
		{"rate zero", `{"duration_ms":7250,"played_ms":7250,"playback_rate":0}`, false, false},
		{"wrong version", `{"duration_ms":7250,"played_ms":7250,"coverage_version":"ended-v1"}`, false, false},
		{"incomplete", `{"duration_ms":7250,"played_ms":7250,"completed":false}`, false, false},
		{"one percent boundary", `{"duration_ms":7250,"played_ms":7178}`, false, true},
		{"one percent exceeded", `{"duration_ms":7250,"played_ms":7177}`, false, false},
		{"cap boundary", `{"duration_ms":20000,"played_ms":19900}`, false, true},
		{"cap exceeded", `{"duration_ms":20000,"played_ms":19899}`, false, false},
		{"minimum duration", `{"duration_ms":1,"played_ms":1}`, false, true},
		{"zero tolerance", `{"duration_ms":99,"played_ms":98}`, false, false},
		{"zero duration", `{"duration_ms":0,"played_ms":1}`, false, false},
		{"negative duration", `{"duration_ms":-1,"played_ms":1}`, false, false},
		{"maximum duration", `{"duration_ms":3600000,"played_ms":3599900}`, false, true},
		{"duration exceeded", `{"duration_ms":3600001,"played_ms":3600001}`, false, false},
		{"rejected partial", `{"duration_ms":7250,"played_ms":1,"completed":false}`, true, true},
		{"rejected wrong version", `{"duration_ms":7250,"played_ms":7250,"coverage_version":"unknown"}`, true, false},
		{"rejected overcount", `{"duration_ms":7250,"played_ms":7251}`, true, false},
		{"rejected zero", `{"duration_ms":7250,"played_ms":0}`, true, false},
		{"rejected rate two", `{"duration_ms":7250,"played_ms":7250,"playback_rate":2}`, true, false},
		{"legacy nil", `null`, false, true},
		{"legacy without surface", `{"completed":true,"duration_ms":7250}`, false, true},
		{"legacy invalid supplied version", `{"surface":"","coverage_version":"unknown","duration_ms":1,"played_ms":1}`, true, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			evidence := &NarrationPlaybackEvidence{}
			if tc.name != "ended only" && tc.name != "legacy without surface" {
				if err := json.Unmarshal([]byte(`{"surface":"admin_audio_workspace","completed":true,"coverage_version":"played-ranges-v1","playback_rate":1}`), evidence); err != nil {
					t.Fatal(err)
				}
			}
			if err := json.Unmarshal([]byte(tc.evidence), &evidence); err != nil {
				t.Fatal(err)
			}
			review := NarrationReview{AssetID: "test", TextSHA256: strings.Repeat("a", 64), AudioSHA256: strings.Repeat("b", 64), Decision: "approved", ReviewerName: "Synthetic reviewer", Criteria: map[string]bool{"natural": true, "clear": true, "pronunciation": true, "age_suitable": true}, PlaybackEvidence: evidence}
			if tc.rejected {
				review.Decision, review.Notes = "rejected", "Synthetic rejection"
			}
			err := ValidateNarrationReview(review)
			if (err == nil) != tc.valid {
				t.Fatalf("valid=%v, error=%v", tc.valid, err)
			}
			if !tc.valid {
				// No DB is needed: invalid input must fail before persistence starts.
				repo := &PostgresRepository{}
				if _, err := repo.SaveNarrationReview(context.Background(), review, "invalid-coverage"); err == nil {
					t.Fatal("repository accepted invalid playback evidence")
				}
			}
		})
	}
}
