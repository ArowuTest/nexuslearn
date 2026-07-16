package learning

import "strings"

type Attempt struct {
	ID               string `json:"id,omitempty"`
	IdempotencyKey   string `json:"-"`
	StudentID        string `json:"student_id"`
	MockAssessmentID string `json:"mock_assessment_id,omitempty"`
	ObjectiveID      string `json:"objective_id"`
	QuestionID       string `json:"question_id"`
	Format           string `json:"format"`
	ResponseMode     string `json:"response_mode"`
	Given            int    `json:"given"`
	Expected         int    `json:"expected"`
	GivenText        string `json:"given_text"`
	ExpectedText     string `json:"expected_text"`
	MS               int    `json:"ms"`
	HintUsed         bool   `json:"hint_used"`
	Confidence       int    `json:"confidence"`
}

type AttemptResult struct {
	Correct         bool                   `json:"correct"`
	MasteryGain     int                    `json:"mastery_gain"`
	MasteryDelta    int                    `json:"mastery_delta"`
	ProjectedScore  int                    `json:"projected_score"`
	ProjectedBand   string                 `json:"projected_band"`
	NextReviewDays  int                    `json:"next_review_days"`
	RewardHook      string                 `json:"reward_hook"`
	AnimationHook   string                 `json:"animation_hook"`
	Feedback        string                 `json:"feedback"`
	Explanation     string                 `json:"explanation"`
	EvidenceEvent   string                 `json:"evidence_event"`
	CompanionPrompt string                 `json:"companion_prompt"`
	MockAssessment  *MockAssessmentSummary `json:"mock_assessment,omitempty"`
}

// ScoreAttempt applies the v1 explainable scoring rules.
func ScoreAttempt(a Attempt) AttemptResult {
	if !attemptCorrect(a) {
		return AttemptResult{
			Correct:         false,
			MasteryGain:     0,
			MasteryDelta:    -2,
			ProjectedScore:  0,
			ProjectedBand:   MasteryBand(0),
			NextReviewDays:  0,
			RewardHook:      "mistake-museum-progress",
			AnimationHook:   "array-scaffold",
			Feedback:        "Almost. Let's build it together.",
			Explanation:     "Incorrect recall suggests this fact should be repaired with a visual array before returning to timed practice.",
			EvidenceEvent:   "attempt.incorrect.scaffold",
			CompanionPrompt: "Let's make the groups first, then try the fact again.",
		}
	}

	gain := 8
	if a.MS > 0 && a.MS < 6000 {
		gain += 2
	}
	if a.HintUsed {
		gain -= 4
	}
	if a.Confidence > 0 && a.Confidence < 3 {
		gain -= 2
	}
	if gain < 1 {
		gain = 1
	}

	return AttemptResult{
		Correct:         true,
		MasteryGain:     gain,
		MasteryDelta:    gain,
		ProjectedScore:  gain,
		ProjectedBand:   MasteryBand(gain),
		NextReviewDays:  nextReviewDays(gain),
		RewardHook:      "dino-lab-power-core",
		AnimationHook:   "machine-charge",
		Feedback:        "Brilliant recall!",
		Explanation:     "Correct recall increases mastery; the fact will return through spaced review so it sticks over time.",
		EvidenceEvent:   "attempt.correct.mastery_gain",
		CompanionPrompt: "Great. Can you teach me why that fact works?",
	}
}

func attemptCorrect(a Attempt) bool {
	if strings.TrimSpace(a.ExpectedText) != "" {
		return normalizeAnswer(a.GivenText) == normalizeAnswer(a.ExpectedText)
	}
	return a.Given == a.Expected
}

func normalizeAnswer(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func nextReviewDays(score int) int {
	switch {
	case score >= 90:
		return 14
	case score >= 80:
		return 7
	case score >= 60:
		return 3
	default:
		return 1
	}
}

func clamp(v, min, max int) int {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}
