package learning

import "math/rand"

// Mission is one playable unit mapped to a curriculum objective.
type Mission struct {
	ID          string     `json:"id"`
	ObjectiveID string     `json:"objective_id"`
	Year        int        `json:"year"`
	Subject     string     `json:"subject"`
	Statement   string     `json:"statement"`
	Mechanic    string     `json:"mechanic"`
	Questions   []Question `json:"questions"`
}

type Question struct {
	ID         string `json:"id"`
	Format     string `json:"format"`
	Body       string `json:"body"`
	A          int    `json:"a"`
	B          int    `json:"b"`
	Answer     int    `json:"answer"`
	Hint       string `json:"hint"`
	Difficulty int    `json:"difficulty"`
}

type Attempt struct {
	StudentID   string `json:"student_id"`
	ObjectiveID string `json:"objective_id"`
	QuestionID  string `json:"question_id"`
	Given       int    `json:"given"`
	Expected    int    `json:"expected"`
	MS          int    `json:"ms"`
	HintUsed    bool   `json:"hint_used"`
	Confidence  int    `json:"confidence"`
}

type AttemptResult struct {
	Correct         bool   `json:"correct"`
	MasteryGain     int    `json:"mastery_gain"`
	MasteryDelta    int    `json:"mastery_delta"`
	ProjectedScore  int    `json:"projected_score"`
	ProjectedBand   string `json:"projected_band"`
	NextReviewDays  int    `json:"next_review_days"`
	RewardHook      string `json:"reward_hook"`
	AnimationHook   string `json:"animation_hook"`
	Feedback        string `json:"feedback"`
	Explanation     string `json:"explanation"`
	EvidenceEvent   string `json:"evidence_event"`
	CompanionPrompt string `json:"companion_prompt"`
}

// DemoMission generates the Year 4 multiplication-fluency Dino Lab mission
// (NC objective: recall multiplication and division facts up to 12 x 12).
func DemoMission() Mission {
	tables := []int{3, 4, 6, 7, 8}
	qs := make([]Question, 0, 8)
	for i := 0; i < 8; i++ {
		a := tables[rand.Intn(len(tables))]
		b := 2 + rand.Intn(11)
		qs = append(qs, Question{
			ID:         "q" + string(rune('1'+i)),
			Format:     "timed-recall",
			A:          a,
			B:          b,
			Answer:     a * b,
			Difficulty: a,
		})
	}
	return Mission{
		ID:          "mission-dino-lab-power-core-demo",
		ObjectiveID: "ma-y4-number-multiplication-12x12",
		Year:        4,
		Subject:     "Mathematics",
		Statement:   "Recall multiplication and division facts up to 12 x 12.",
		Mechanic:    "dino-lab-power-core",
		Questions:   qs,
	}
}

// ScoreAttempt applies the v1 explainable scoring rules. Persistence lands in
// the next slice; this response shape already carries the evidence fields the
// database-backed engine will store.
func ScoreAttempt(a Attempt) AttemptResult {
	currentScore := 72
	if a.Given != a.Expected {
		projected := clamp(currentScore-2, 0, 100)
		return AttemptResult{
			Correct:         false,
			MasteryGain:     0,
			MasteryDelta:    -2,
			ProjectedScore:  projected,
			ProjectedBand:   MasteryBand(projected),
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

	projected := clamp(currentScore+gain, 0, 100)
	return AttemptResult{
		Correct:         true,
		MasteryGain:     gain,
		MasteryDelta:    gain,
		ProjectedScore:  projected,
		ProjectedBand:   MasteryBand(projected),
		NextReviewDays:  nextReviewDays(projected),
		RewardHook:      "dino-lab-power-core",
		AnimationHook:   "machine-charge",
		Feedback:        "Brilliant recall!",
		Explanation:     "Correct recall increases mastery; the fact will return through spaced review so it sticks over time.",
		EvidenceEvent:   "attempt.correct.mastery_gain",
		CompanionPrompt: "Great. Can you teach me why that fact works?",
	}
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
