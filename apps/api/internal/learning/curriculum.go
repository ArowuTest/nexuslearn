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

type CurriculumMap struct {
	Years       []CurriculumYear    `json:"years"`
	Subjects    []CurriculumSubject `json:"subjects"`
	Total       int                 `json:"total"`
	GeneratedAt string              `json:"generated_at"`
}

type CurriculumYear struct {
	Year     int                 `json:"year"`
	Subjects []CurriculumSubject `json:"subjects"`
	Total    int                 `json:"total"`
}

type CurriculumSubject struct {
	Name    string             `json:"name"`
	Strands []CurriculumStrand `json:"strands"`
	Total   int                `json:"total"`
}

type CurriculumStrand struct {
	Name       string   `json:"name"`
	Topics     []string `json:"topics"`
	Objectives int      `json:"objectives"`
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

type RewardRule struct {
	ID            string         `json:"id"`
	WorldKey      string         `json:"world_key"`
	ObjectiveID   string         `json:"objective_id"`
	Trigger       string         `json:"trigger"`
	RewardPayload map[string]any `json:"reward_payload"`
	Enabled       bool           `json:"enabled"`
	UpdatedAt     string         `json:"updated_at"`
}

type StudentProfileConfig struct {
	ID          string `json:"id"`
	ExternalRef string `json:"external_ref"`
	DisplayName string `json:"display_name"`
	YearGroup   int    `json:"year_group"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

type SchoolConfig struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	URN       string `json:"urn"`
	Status    string `json:"status"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

type ClassConfig struct {
	ID         string                 `json:"id"`
	SchoolID   string                 `json:"school_id"`
	SchoolURN  string                 `json:"school_urn"`
	SchoolName string                 `json:"school_name"`
	Name       string                 `json:"name"`
	YearGroup  int                    `json:"year_group"`
	Students   []StudentProfileConfig `json:"students"`
	CreatedAt  string                 `json:"created_at"`
	UpdatedAt  string                 `json:"updated_at"`
}

type StudentCredentialConfig struct {
	StudentExternalRef string   `json:"student_external_ref"`
	DisplayName        string   `json:"display_name"`
	LoginCode          string   `json:"login_code"`
	PicturePassword    []string `json:"picture_password"`
	QRSecretHash       string   `json:"qr_secret_hash"`
	UpdatedAt          string   `json:"updated_at"`
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
	WorldKey           string   `json:"world_key"`
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
