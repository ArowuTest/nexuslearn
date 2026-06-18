package learning

import "testing"

func TestSelectRetentionIntervalUsesObjectiveSchedule(t *testing.T) {
	days := []int{30, 1, 14, 3, 7}
	tests := []struct {
		name  string
		score int
		want  int
	}{
		{name: "unknown evidence returns quickly", score: 0, want: 1},
		{name: "developing returns quickly", score: 55, want: 1},
		{name: "nearly secure uses middle interval", score: 70, want: 7},
		{name: "expected uses penultimate interval", score: 82, want: 14},
		{name: "secure uses longest interval", score: 92, want: 30},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := selectRetentionInterval(tc.score, 80, 90, days); got != tc.want {
				t.Fatalf("selectRetentionInterval(%d) = %d, want %d", tc.score, got, tc.want)
			}
		})
	}
}

func TestCumulativeDeltaDoesNotRewardSpeed(t *testing.T) {
	fast := cumulativeDelta(Attempt{MS: 1000, Confidence: 3}, AttemptResult{Correct: true})
	slow := cumulativeDelta(Attempt{MS: 30000, Confidence: 3}, AttemptResult{Correct: true})
	if fast != slow {
		t.Fatalf("speed must not change mastery evidence: fast=%d slow=%d", fast, slow)
	}
}

func TestCumulativeDeltaTreatsConfidenceAsOptionalEvidence(t *testing.T) {
	withoutConfidence := cumulativeDelta(Attempt{}, AttemptResult{Correct: true})
	withBalancedConfidence := cumulativeDelta(Attempt{Confidence: 3}, AttemptResult{Correct: true})
	if withoutConfidence != withBalancedConfidence {
		t.Fatalf("omitted confidence should not be invented or penalised: omitted=%d balanced=%d", withoutConfidence, withBalancedConfidence)
	}
}

func TestEvidenceConfidenceRequiresDiverseRetainedEvidence(t *testing.T) {
	tests := []struct {
		name               string
		evidence           int
		formats            int
		independentCorrect int
		retainedSuccess    int
		want               string
	}{
		{name: "one attempt is limited", evidence: 1, formats: 1, independentCorrect: 1, want: "limited"},
		{name: "three attempts are emerging", evidence: 3, formats: 1, independentCorrect: 2, want: "emerging"},
		{name: "diverse independent evidence is supported", evidence: 5, formats: 2, independentCorrect: 3, want: "supported"},
		{name: "strong requires delayed retention", evidence: 8, formats: 2, independentCorrect: 5, retainedSuccess: 1, want: "strong"},
		{name: "no delayed retention remains supported", evidence: 10, formats: 3, independentCorrect: 8, retainedSuccess: 0, want: "supported"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := evidenceConfidenceBand(tc.evidence, tc.formats, tc.independentCorrect, tc.retainedSuccess); got != tc.want {
				t.Fatalf("evidenceConfidenceBand() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestSecureBandRequiresStrongRetainedEvidence(t *testing.T) {
	if got := evidenceAdjustedMasteryBand(94, "supported"); got != "Expected standard" {
		t.Fatalf("supported evidence must not be labelled secure, got %q", got)
	}
	if got := evidenceAdjustedMasteryBand(94, "strong"); got != "Secure" {
		t.Fatalf("strong retained evidence should permit secure, got %q", got)
	}
}
