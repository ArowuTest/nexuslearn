package learning

type MasteryRule struct {
	Expected        int      `json:"expected"`
	Secure          int      `json:"secure"`
	RetentionDays   []int    `json:"retention_days"`
	RequiredFormats []string `json:"required_formats"`
}

type Objective struct {
	ID                string      `json:"id"`
	Year              int         `json:"year"`
	Subject           string      `json:"subject"`
	Strand            string      `json:"strand"`
	Topic             string      `json:"topic"`
	Statement         string      `json:"statement"`
	Prerequisites     []string    `json:"prerequisites"`
	Misconceptions    []string    `json:"misconceptions"`
	Mastery           MasteryRule `json:"mastery"`
	ParentExplanation string      `json:"parent_explanation"`
	TeacherEvidence   string      `json:"teacher_evidence"`
}

type StudentMastery struct {
	StudentID     string `json:"student_id"`
	ObjectiveID   string `json:"objective_id"`
	Score         int    `json:"score"`
	Band          string `json:"band"`
	LastSignal    string `json:"last_signal"`
	NextReviewDue string `json:"next_review_due"`
}

type RecentAttempt struct {
	StudentID     string `json:"student_id"`
	ObjectiveID   string `json:"objective_id"`
	QuestionID    string `json:"question_id"`
	Correct       bool   `json:"correct"`
	ResponseMS    int    `json:"response_ms"`
	HintUsed      bool   `json:"hint_used"`
	MasteryDelta  int    `json:"mastery_delta"`
	Explanation   string `json:"explanation"`
	AttemptedAt   string `json:"attempted_at"`
	AnimationHook string `json:"animation_hook"`
}

type EvidenceSummary struct {
	StudentID              string         `json:"student_id"`
	Attempts7Days          int            `json:"attempts_7_days"`
	Correct7Days           int            `json:"correct_7_days"`
	Accuracy7Days          int            `json:"accuracy_7_days"`
	DueReviews             int            `json:"due_reviews"`
	OpenReviews            int            `json:"open_reviews"`
	MisconceptionsRepaired int            `json:"misconceptions_repaired"`
	Bands                  map[string]int `json:"bands"`
	UpdatedAt              string         `json:"updated_at"`
}

type WorldState struct {
	StudentID string         `json:"student_id"`
	WorldKey  string         `json:"world_key"`
	State     map[string]any `json:"state"`
	UpdatedAt string         `json:"updated_at"`
}

type LearningSession struct {
	ID         string `json:"id"`
	StudentID  string `json:"student_id"`
	Mode       string `json:"mode"`
	DeviceTier string `json:"device_tier"`
	StartedAt  string `json:"started_at"`
}

type Diagnostics struct {
	Persistence       string `json:"persistence"`
	SchemaVersion     string `json:"schema_version"`
	Students          int    `json:"students"`
	Attempts          int    `json:"attempts"`
	OpenReviews       int    `json:"open_reviews"`
	WorldStates       int    `json:"world_states"`
	LastAttemptAt     string `json:"last_attempt_at"`
	LastMigrationAt   string `json:"last_migration_at"`
	ReviewQueueStatus string `json:"review_queue_status"`
}

type FeatureFlag struct {
	Key         string         `json:"key"`
	Enabled     bool           `json:"enabled"`
	Config      map[string]any `json:"config"`
	Description string         `json:"description"`
	UpdatedAt   string         `json:"updated_at"`
}

type WorldConfig struct {
	Key       string         `json:"key"`
	Name      string         `json:"name"`
	YearGroup int            `json:"year_group"`
	Theme     string         `json:"theme"`
	Config    map[string]any `json:"config"`
	Enabled   bool           `json:"enabled"`
	UpdatedAt string         `json:"updated_at"`
}

type ActivityConfig struct {
	ID             string         `json:"id"`
	ObjectiveID    string         `json:"objective_id"`
	TemplateID     string         `json:"template_id"`
	WorldKey       string         `json:"world_key"`
	Title          string         `json:"title"`
	Prompt         string         `json:"prompt"`
	Difficulty     int            `json:"difficulty"`
	Interaction    map[string]any `json:"interaction"`
	Feedback       map[string]any `json:"feedback"`
	AnimationHooks map[string]any `json:"animation_hooks"`
	Status         string         `json:"status"`
	UpdatedAt      string         `json:"updated_at"`
}

type QuestionConfig struct {
	ID             string         `json:"id"`
	ActivityID     string         `json:"activity_id"`
	ObjectiveID    string         `json:"objective_id"`
	Format         string         `json:"format"`
	Body           map[string]any `json:"body"`
	ExpectedAnswer map[string]any `json:"expected_answer"`
	Hints          []string       `json:"hints"`
	Explanation    string         `json:"explanation"`
	Difficulty     int            `json:"difficulty"`
	Status         string         `json:"status"`
	UpdatedAt      string         `json:"updated_at"`
}

type AuditLog struct {
	ID         string         `json:"id"`
	Action     string         `json:"action"`
	EntityType string         `json:"entity_type"`
	EntityID   string         `json:"entity_id"`
	Payload    map[string]any `json:"payload"`
	CreatedAt  string         `json:"created_at"`
}

type WarmUpItem struct {
	ObjectiveID    string `json:"objective_id"`
	Prompt         string `json:"prompt"`
	Format         string `json:"format"`
	Reason         string `json:"reason"`
	DueAt          string `json:"due_at,omitempty"`
	Priority       int    `json:"priority,omitempty"`
	AnimationHook  string `json:"animation_hook,omitempty"`
	CompanionNudge string `json:"companion_nudge,omitempty"`
}

type NextActivityDecision struct {
	StudentID          string   `json:"student_id"`
	ObjectiveID        string   `json:"objective_id"`
	ActivityID         string   `json:"activity_id"`
	World              string   `json:"world"`
	Realm              string   `json:"realm"`
	Interaction        string   `json:"interaction"`
	Difficulty         int      `json:"difficulty"`
	Scaffold           bool     `json:"scaffold"`
	Review             bool     `json:"review"`
	PrerequisiteProbe  bool     `json:"prerequisite_probe"`
	RewardHook         string   `json:"reward_hook"`
	AnimationHook      string   `json:"animation_hook"`
	Explanation        string   `json:"explanation"`
	CompanionPrompt    string   `json:"companion_prompt"`
	RecommendedActions []string `json:"recommended_actions"`
}

var objectives = []Objective{
	{
		ID:        "ma-y4-number-multiplication-12x12",
		Year:      4,
		Subject:   "Mathematics",
		Strand:    "Number",
		Topic:     "Multiplication and division",
		Statement: "Recall multiplication and division facts for multiplication tables up to 12 x 12.",
		Prerequisites: []string{
			"ma-y2-number-count-in-2-5-10",
			"ma-y3-number-recall-3-4-8-tables",
			"ma-y3-number-arrays-repeated-addition",
		},
		Misconceptions: []string{
			"Confuses nearby multiplication facts such as 6 x 8 and 7 x 8.",
			"Counts every fact from the beginning instead of using known facts.",
			"Does not connect division facts to multiplication facts.",
		},
		Mastery: MasteryRule{
			Expected:        80,
			Secure:          90,
			RetentionDays:   []int{1, 3, 7, 14, 30},
			RequiredFormats: []string{"timed-recall", "array-build", "division-match"},
		},
		ParentExplanation: "Can recall mixed multiplication and division facts with increasing fluency.",
		TeacherEvidence:   "Accuracy, speed, mixed recall, retention and reduced hint use.",
	},
	{
		ID:        "ma-y4-measure-area-rectangles",
		Year:      4,
		Subject:   "Mathematics",
		Strand:    "Measurement",
		Topic:     "Area",
		Statement: "Find the area of rectilinear shapes by counting squares.",
		Prerequisites: []string{
			"ma-y2-geometry-recognise-rectangles",
			"ma-y3-number-arrays-repeated-addition",
			"ma-y4-number-multiplication-12x12",
		},
		Misconceptions: []string{
			"Confuses area with perimeter.",
			"Counts only the outside squares.",
			"Counts rows and columns but does not connect them to multiplication.",
		},
		Mastery: MasteryRule{
			Expected:        80,
			Secure:          90,
			RetentionDays:   []int{1, 3, 7, 14},
			RequiredFormats: []string{"grid-count", "array-build", "word-problem"},
		},
		ParentExplanation: "Can find the space inside a rectangle or rectilinear shape by counting or using rows and columns.",
		TeacherEvidence:   "Can model area with squares, explain rows and columns, and avoid perimeter confusion.",
	},
	{
		ID:        "en-y1-phonics-blend-cvc-words",
		Year:      1,
		Subject:   "English",
		Strand:    "Phonics",
		Topic:     "Blending",
		Statement: "Blend sounds in simple CVC words to read the whole word.",
		Prerequisites: []string{
			"en-y1-phonics-recognise-single-letter-sounds",
			"en-y1-listening-hear-initial-sounds",
		},
		Misconceptions: []string{
			"Says each sound separately but does not blend into a whole word.",
			"Guesses from the picture without checking sounds.",
			"Reverses or skips the middle vowel sound.",
		},
		Mastery: MasteryRule{
			Expected:        80,
			Secure:          90,
			RetentionDays:   []int{1, 3, 7, 14},
			RequiredFormats: []string{"audio-blend", "tap-choice", "word-build"},
		},
		ParentExplanation: "Can hear sounds in a simple word and blend them together to read the word.",
		TeacherEvidence:   "Can blend CVC words across different vowel sounds with reduced adult prompting.",
	},
}

func Objectives() []Objective {
	return objectives
}

func ObjectiveByID(id string) (Objective, bool) {
	for _, objective := range objectives {
		if objective.ID == id {
			return objective, true
		}
	}
	return Objective{}, false
}

func MasteryBand(score int) string {
	switch {
	case score >= 90:
		return "Secure"
	case score >= 80:
		return "Expected standard"
	case score >= 60:
		return "Nearly secure"
	case score >= 40:
		return "Developing"
	case score >= 20:
		return "Introduced"
	default:
		return "Unknown"
	}
}

func DemoMastery(studentID string) []StudentMastery {
	return []StudentMastery{
		{
			StudentID:     studentID,
			ObjectiveID:   "ma-y4-number-multiplication-12x12",
			Score:         76,
			Band:          MasteryBand(76),
			LastSignal:    "Strong recall on 3, 4 and 8 times tables; hesitation remains on 6 x 8 and 7 x 8.",
			NextReviewDue: "tomorrow",
		},
		{
			StudentID:     studentID,
			ObjectiveID:   "ma-y4-measure-area-rectangles",
			Score:         48,
			Band:          MasteryBand(48),
			LastSignal:    "Area errors suggest an array and multiplication prerequisite gap.",
			NextReviewDue: "after prerequisite repair",
		},
	}
}

func WarmUp(studentID string) []WarmUpItem {
	return []WarmUpItem{
		{
			ObjectiveID: "ma-y4-number-multiplication-12x12",
			Prompt:      "Recall 7 x 8 without counting from the start.",
			Format:      "timed-recall",
			Reason:      "Spaced review is due for a recently missed fact.",
		},
		{
			ObjectiveID: "ma-y4-number-multiplication-12x12",
			Prompt:      "Build 6 rows of 8 to repair a nearby multiplication fact.",
			Format:      "array-build",
			Reason:      "A visual model will strengthen the weak fact family.",
		},
		{
			ObjectiveID: "ma-y4-measure-area-rectangles",
			Prompt:      "Use rows and columns to find the area of a small habitat grid.",
			Format:      "grid-count",
			Reason:      "This prepares the return to area after multiplication practice.",
		},
	}
}

func NextActivity(studentID string) NextActivityDecision {
	return NextActivityDecision{
		StudentID:         studentID,
		ObjectiveID:       "ma-y4-number-multiplication-12x12",
		ActivityID:        "act-inventor-wilds-array-repair-7x8",
		World:             "Nexusverse",
		Realm:             "Year 4 Inventor Wilds - Dino Lab biome",
		Interaction:       "array-build",
		Difficulty:        6,
		Scaffold:          true,
		Review:            true,
		PrerequisiteProbe: false,
		RewardHook:        "mistake-museum-fossil",
		AnimationHook:     "dino-lab-power-core",
		Explanation:       "Reviewing 7 x 8 because it was missed recently; using an array scaffold before returning to area.",
		CompanionPrompt:   "Let's build the fact, then you can teach it back to me.",
		RecommendedActions: []string{
			"Start with a 3-question warm-up.",
			"Use array-build before timed recall.",
			"Return to area of rectangles after one confident success.",
		},
	}
}
