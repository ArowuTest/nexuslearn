package learning

import (
	"testing"
	"time"
)

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

func TestAttemptResponseModeAcceptsSupportedModesAndDefaultsSafely(t *testing.T) {
	for _, test := range []struct {
		input string
		want  string
	}{
		{input: "keyboard", want: "keyboard"},
		{input: " SWITCH ", want: "interactive"},
		{input: "interactive", want: "interactive"},
		{input: "voice", want: "interactive"},
		{input: "", want: "interactive"},
	} {
		if got := attemptResponseMode(Attempt{ResponseMode: test.input}); got != test.want {
			t.Fatalf("attemptResponseMode(%q)=%q, want %q", test.input, got, test.want)
		}
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
		freshness          string
		want               string
	}{
		{name: "one attempt is limited", evidence: 1, formats: 1, independentCorrect: 1, freshness: "current", want: "limited"},
		{name: "three attempts are emerging", evidence: 3, formats: 1, independentCorrect: 2, freshness: "current", want: "emerging"},
		{name: "diverse independent evidence is supported", evidence: 5, formats: 2, independentCorrect: 3, freshness: "aging", want: "supported"},
		{name: "strong requires delayed retention and current evidence", evidence: 8, formats: 2, independentCorrect: 5, retainedSuccess: 1, freshness: "current", want: "strong"},
		{name: "aging evidence cannot remain strong", evidence: 8, formats: 2, independentCorrect: 5, retainedSuccess: 1, freshness: "aging", want: "supported"},
		{name: "stale evidence decays below supported", evidence: 8, formats: 3, independentCorrect: 8, retainedSuccess: 1, freshness: "stale", want: "emerging"},
		{name: "no delayed retention remains supported", evidence: 10, formats: 3, independentCorrect: 8, retainedSuccess: 0, freshness: "current", want: "supported"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := evidenceConfidenceBand(float64(tc.evidence), tc.formats, tc.independentCorrect, tc.retainedSuccess, tc.freshness); got != tc.want {
				t.Fatalf("evidenceConfidenceBand() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestEvidenceRecencySummaryDecaysOldSignals(t *testing.T) {
	now := time.Date(2026, time.June, 19, 12, 0, 0, 0, time.UTC)
	signals := []evidenceSignal{
		{Correct: true, Format: "choice", RecordedAt: now.Add(-5 * 24 * time.Hour)},
		{Correct: true, Format: "builder", RetentionReview: true, RecordedAt: now.Add(-20 * 24 * time.Hour)},
		{Correct: true, Format: "choice", RecordedAt: now.Add(-150 * 24 * time.Hour)},
	}
	summary := summariseEvidence(signals, now)
	if summary.EffectiveScore < 1.849 || summary.EffectiveScore > 1.851 {
		t.Fatalf("effective score = %.2f, want 1.85", summary.EffectiveScore)
	}
	if summary.Freshness != "current" || summary.FormatCount != 2 || summary.RetainedSuccess != 1 {
		t.Fatalf("unexpected recency summary %#v", summary)
	}
}

func TestContrastingRepairRequiresDifferentEvidence(t *testing.T) {
	if contrastingRepairSatisfied([]string{"q1", "q1"}, []string{"choice"}) {
		t.Fatal("replaying one repair item must not close a misconception")
	}
	if contrastingRepairSatisfied([]string{"q1", "q2"}, []string{"choice"}) {
		t.Fatal("two same-format items are not yet contrasting enough")
	}
	if !contrastingRepairSatisfied([]string{"q1", "q2"}, []string{"choice", "builder"}) {
		t.Fatal("two distinct questions across formats should close repair")
	}
	if !contrastingRepairSatisfied([]string{"q1", "q2", "q3"}, []string{"choice"}) {
		t.Fatal("three distinct repair questions should close repair even in one available format")
	}
}

func TestInterventionReviewOutcomeControlsPlanStatus(t *testing.T) {
	tests := map[string]string{
		"continue": "active",
		"reopen":   "active",
		"monitor":  "monitoring",
		"complete": "completed",
	}
	for outcome, want := range tests {
		got, ok := interventionStatusForReviewOutcome(outcome)
		if !ok || got != want {
			t.Fatalf("outcome %q mapped to %q, %v; want %q", outcome, got, ok, want)
		}
	}
	if _, ok := interventionStatusForReviewOutcome("guess"); ok {
		t.Fatal("unknown intervention review outcome must be rejected")
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
