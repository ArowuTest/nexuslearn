// Package learning holds the learning-domain types and, in Slice 1, the
// demo mission used by the Dino-Craft incubator scene. In Slice 2 this is
// replaced by the curriculum content pipeline + adaptive engine backed by
// PostgreSQL; the API shapes are designed to survive that swap.
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
	ID      string `json:"id"`
	Format  string `json:"format"`
	Body    string `json:"body"`
	A       int    `json:"a"`
	B       int    `json:"b"`
	Answer  int    `json:"answer"`
	Hint    string `json:"hint"`
	Difficulty int `json:"difficulty"`
}

type Attempt struct {
	QuestionID string `json:"question_id"`
	Given      int    `json:"given"`
	Expected   int    `json:"expected"`
	MS         int    `json:"ms"`
	HintUsed   bool   `json:"hint_used"`
}

type AttemptResult struct {
	Correct    bool   `json:"correct"`
	MasteryGain int   `json:"mastery_gain"`
	Feedback   string `json:"feedback"`
}

// DemoMission generates the Year 4 multiplication-fluency incubator mission
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
		ID:          "mission-dino-incubator-demo",
		ObjectiveID: "ma4-num-mult-recall-12x12",
		Year:        4,
		Subject:     "Mathematics",
		Statement:   "Recall multiplication and division facts up to 12 × 12",
		Mechanic:    "dino-incubator",
		Questions:   qs,
	}
}

// ScoreAttempt applies the Slice-1 scoring rules: correctness drives mastery
// gain, speed adds a small bonus, hint usage damps the gain. This becomes the
// Elo-style update in Slice 2.
func ScoreAttempt(a Attempt) AttemptResult {
	if a.Given != a.Expected {
		return AttemptResult{Correct: false, MasteryGain: 0,
			Feedback: "Almost! Let's build it together."}
	}
	gain := 8
	if a.MS > 0 && a.MS < 6000 {
		gain += 2
	}
	if a.HintUsed {
		gain -= 4
	}
	return AttemptResult{Correct: true, MasteryGain: gain, Feedback: "Brilliant recall!"}
}
