package learning

import (
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
