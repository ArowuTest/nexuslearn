package learning

import "testing"

func TestScoreAttemptCorrectFastNoHint(t *testing.T) {
	result := ScoreAttempt(Attempt{
		StudentID:   "alex-demo",
		ObjectiveID: "ma-y4-number-multiplication-12x12",
		QuestionID:  "q1",
		Given:       56,
		Expected:    56,
		MS:          3200,
		HintUsed:    false,
		Confidence:  4,
	})

	if !result.Correct {
		t.Fatal("expected correct result")
	}
	if result.MasteryGain != 10 {
		t.Fatalf("expected mastery gain 10, got %d", result.MasteryGain)
	}
	if result.ProjectedScore != 10 {
		t.Fatalf("expected projected score 10, got %d", result.ProjectedScore)
	}
	if result.ProjectedBand != "Unknown" {
		t.Fatalf("expected Unknown band before persistence adjustment, got %q", result.ProjectedBand)
	}
	if result.NextReviewDays != 1 {
		t.Fatalf("expected 1 day review before persistence adjustment, got %d", result.NextReviewDays)
	}
}

func TestScoreAttemptIncorrectScaffolds(t *testing.T) {
	result := ScoreAttempt(Attempt{
		StudentID:   "alex-demo",
		ObjectiveID: "ma-y4-number-multiplication-12x12",
		QuestionID:  "q1",
		Given:       54,
		Expected:    56,
		MS:          9000,
		HintUsed:    true,
		Confidence:  4,
	})

	if result.Correct {
		t.Fatal("expected incorrect result")
	}
	if result.MasteryDelta >= 0 {
		t.Fatalf("expected negative mastery delta, got %d", result.MasteryDelta)
	}
	if result.AnimationHook != "array-scaffold" {
		t.Fatalf("expected array scaffold hook, got %q", result.AnimationHook)
	}
	assertGamificationPayload(t, result)
}

func TestScoreAttemptCorrectIncludesGamificationPayload(t *testing.T) {
	result := ScoreAttempt(Attempt{Given: 56, Expected: 56, MS: 3200, Confidence: 4})
	if !result.Correct {
		t.Fatal("expected correct result")
	}
	assertGamificationPayload(t, result)
}

func assertGamificationPayload(t *testing.T, result AttemptResult) {
	t.Helper()
	for name, value := range map[string]string{
		"reward_hook":      result.RewardHook,
		"animation_hook":   result.AnimationHook,
		"feedback":         result.Feedback,
		"explanation":      result.Explanation,
		"evidence_event":   result.EvidenceEvent,
		"companion_prompt": result.CompanionPrompt,
	} {
		if value == "" {
			t.Errorf("gamification payload %s must be populated", name)
		}
	}
}

func TestScoreAttemptTextChoiceIsCaseInsensitive(t *testing.T) {
	result := ScoreAttempt(Attempt{
		StudentID:    "ava-demo",
		ObjectiveID:  "en-y1-phonics-blend-cvc-words",
		QuestionID:   "q-y1-sound-sprout-cat",
		GivenText:    " Cat ",
		ExpectedText: "cat",
		MS:           4200,
		Confidence:   4,
	})

	if !result.Correct {
		t.Fatal("expected text answer to be marked correct")
	}
	if result.MasteryGain == 0 {
		t.Fatal("expected text answer to produce mastery gain")
	}
}
