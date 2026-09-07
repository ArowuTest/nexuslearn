package learning

import (
	"reflect"
	"strings"
	"testing"
)

func TestQuestionRepairFeedbackPreservesScoringAndGameState(t *testing.T) {
	for _, format := range []string{"word-build", "sound-box-build", "sentence-build", "evidence-link", "coordinate-plot", "fraction-wall", "fair-test-plan", "pattern-sort", "sequence-build", "number-input", "timed-recall", "future-format"} {
		t.Run(format, func(t *testing.T) {
			original := AttemptResult{MasteryDelta: -4, ProjectedScore: 53, NextReviewDays: 3, RewardHook: "configured-reward", AnimationHook: "configured-animation", EvidenceEvent: "configured-event", Feedback: "old", Explanation: "old", CompanionPrompt: "old"}
			got := applyQuestionRepairFeedback(QuestionConfig{Format: format}, original)
			if !strings.HasPrefix(got.Feedback, "Not yet. ") || got.Explanation == "old" || got.CompanionPrompt == "old" {
				t.Fatalf("missing repair guidance: %+v", got)
			}
			got.Feedback, got.Explanation, got.CompanionPrompt = original.Feedback, original.Explanation, original.CompanionPrompt
			if !reflect.DeepEqual(got, original) {
				t.Fatalf("guidance changed evidence or game state: %+v", got)
			}
			original.Correct = true
			if got := applyQuestionRepairFeedback(QuestionConfig{Format: format}, original); !reflect.DeepEqual(got, original) {
				t.Fatalf("correct result changed: %+v", got)
			}
		})
	}
}

func TestScoreFallbackDoesNotAssumeArithmeticOrDiagnose(t *testing.T) {
	for _, correct := range []bool{true, false} {
		result := scoreCorrectness(Attempt{}, correct)
		for _, word := range []string{"recall", "array", "timed practice", "misconception"} {
			if strings.Contains(result.Feedback+result.Explanation+result.CompanionPrompt, word) {
				t.Fatalf("unsupported fallback claim %q: %+v", word, result)
			}
		}
	}
}
