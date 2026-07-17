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
	StudentID          string  `json:"student_id"`
	ObjectiveID        string  `json:"objective_id"`
	Score              int     `json:"score"`
	Band               string  `json:"band"`
	LastSignal         string  `json:"last_signal"`
	NextReviewDue      string  `json:"next_review_due"`
	EvidenceCount      int     `json:"evidence_count"`
	FormatCount        int     `json:"format_count"`
	IndependentCorrect int     `json:"independent_correct_count"`
	RetainedSuccess    int     `json:"retained_success_count"`
	EvidenceConfidence string  `json:"evidence_confidence"`
	EffectiveEvidence  float64 `json:"effective_evidence_score"`
	EvidenceFreshness  string  `json:"evidence_freshness"`
	LastEvidenceAt     string  `json:"last_evidence_at,omitempty"`
}

type RecentAttempt struct {
	StudentID     string `json:"student_id"`
	ObjectiveID   string `json:"objective_id"`
	QuestionID    string `json:"question_id"`
	ResponseMode  string `json:"response_mode"`
	Correct       bool   `json:"correct"`
	ResponseMS    int    `json:"response_ms"`
	HintUsed      bool   `json:"hint_used"`
	MasteryDelta  int    `json:"mastery_delta"`
	Explanation   string `json:"explanation"`
	AttemptedAt   string `json:"attempted_at"`
	AnimationHook string `json:"animation_hook"`
}

type DiagnosticBaseline struct {
	ID                 string                   `json:"id"`
	IdempotencyKey     string                   `json:"-"`
	StudentID          string                   `json:"student_id"`
	YearGroup          int                      `json:"year_group"`
	Status             string                   `json:"status"`
	CreatedBy          string                   `json:"created_by"`
	StartedAt          string                   `json:"started_at"`
	CompletedAt        string                   `json:"completed_at,omitempty"`
	CurrentObjectiveID string                   `json:"current_objective_id,omitempty"`
	CompletedItems     int                      `json:"completed_items"`
	TotalItems         int                      `json:"total_items"`
	Items              []DiagnosticBaselineItem `json:"items"`
}

type DiagnosticBaselineItem struct {
	ObjectiveID     string   `json:"objective_id"`
	Position        int      `json:"position"`
	Status          string   `json:"status"`
	AttemptCount    int      `json:"attempt_count"`
	CorrectCount    int      `json:"correct_count"`
	ResponseFormats []string `json:"response_formats"`
	CompletedAt     string   `json:"completed_at,omitempty"`
}

type EvidenceSummary struct {
	StudentID              string         `json:"student_id"`
	Attempts7Days          int            `json:"attempts_7_days"`
	Correct7Days           int            `json:"correct_7_days"`
	Accuracy7Days          int            `json:"accuracy_7_days"`
	DueReviews             int            `json:"due_reviews"`
	OpenReviews            int            `json:"open_reviews"`
	MisconceptionsRepaired int            `json:"misconceptions_repaired"`
	TeacherEvidenceCount   int            `json:"teacher_evidence_count"`
	ActiveInterventions    int            `json:"active_interventions"`
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

type LessonStepAttempt struct {
	ID             string   `json:"id,omitempty"`
	IdempotencyKey string   `json:"-"`
	StudentID      string   `json:"student_id"`
	ActivityID     string   `json:"activity_id"`
	ObjectiveID    string   `json:"objective_id"`
	StepID         string   `json:"step_id"`
	StepKind       string   `json:"step_kind"`
	Status         string   `json:"status"`
	DurationMS     int      `json:"duration_ms"`
	SupportUsed    []string `json:"support_used"`
	RecordedAt     string   `json:"recorded_at,omitempty"`
}

type LearningEvent struct {
	ID             string         `json:"id,omitempty"`
	IdempotencyKey string         `json:"-"`
	StudentID      string         `json:"student_id"`
	EventType      string         `json:"event_type"`
	Payload        map[string]any `json:"payload"`
	CreatedAt      string         `json:"created_at,omitempty"`
}

type AssessmentBlueprint struct {
	Mode             string   `json:"mode"`
	QuestionCount    int      `json:"question_count"`
	TargetDifficulty int      `json:"target_difficulty"`
	Formats          []string `json:"formats"`
	Rationale        []string `json:"rationale"`
}

// MockAssessment is a durable, role-scoped subject assessment assembled from
// runtime-approved question variants. It deliberately remains separate from
// the adaptive next-activity decision so a practice mock can be resumed and
// reported without changing the learner's route by accident.
type MockAssessment struct {
	ID                 string               `json:"id"`
	IdempotencyKey     string               `json:"-"`
	StudentExternalRef string               `json:"student_external_ref"`
	StudentDisplayName string               `json:"student_display_name,omitempty"`
	SchoolURN          string               `json:"school_urn,omitempty"`
	CreatedByRole      string               `json:"created_by_role"`
	CreatedBy          string               `json:"created_by"`
	Subject            string               `json:"subject"`
	YearGroup          int                  `json:"year_group"`
	YearFrom           int                  `json:"year_from"`
	YearTo             int                  `json:"year_to"`
	Title              string               `json:"title"`
	Status             string               `json:"status"`
	QuestionCount      int                  `json:"question_count"`
	AnsweredCount      int                  `json:"answered_count"`
	CorrectCount       int                  `json:"correct_count"`
	Score              int                  `json:"score"`
	DurationMinutes    int                  `json:"duration_minutes"`
	IncludeRevision    bool                 `json:"include_revision"`
	IncludeStretch     bool                 `json:"include_stretch"`
	Accessibility      map[string]any       `json:"accessibility"`
	Items              []MockAssessmentItem `json:"items"`
	CreatedAt          string               `json:"created_at,omitempty"`
	UpdatedAt          string               `json:"updated_at,omitempty"`
	CompletedAt        string               `json:"completed_at,omitempty"`
}

type MockAssessmentSummary struct {
	ID            string `json:"id"`
	Subject       string `json:"subject"`
	YearGroup     int    `json:"year_group"`
	Title         string `json:"title"`
	Status        string `json:"status"`
	QuestionCount int    `json:"question_count"`
	AnsweredCount int    `json:"answered_count"`
	CorrectCount  int    `json:"correct_count"`
	Score         int    `json:"score"`
	CompletedAt   string `json:"completed_at,omitempty"`
}

func (assessment MockAssessment) Summary() MockAssessmentSummary {
	return MockAssessmentSummary{
		ID: assessment.ID, Subject: assessment.Subject, YearGroup: assessment.YearGroup,
		Title: assessment.Title, Status: assessment.Status, QuestionCount: assessment.QuestionCount,
		AnsweredCount: assessment.AnsweredCount, CorrectCount: assessment.CorrectCount,
		Score: assessment.Score, CompletedAt: assessment.CompletedAt,
	}
}

type MockAssessmentItem struct {
	Position        int    `json:"position"`
	QuestionID      string `json:"question_id"`
	ObjectiveID     string `json:"objective_id"`
	ActivityID      string `json:"activity_id,omitempty"`
	SelectionReason string `json:"selection_reason,omitempty"`
}

type Assignment struct {
	ID                 string `json:"id"`
	IdempotencyKey     string `json:"-"`
	SchoolURN          string `json:"school_urn"`
	StudentExternalRef string `json:"student_external_ref"`
	StudentDisplayName string `json:"student_display_name,omitempty"`
	ObjectiveID        string `json:"objective_id"`
	ActivityID         string `json:"activity_id,omitempty"`
	Title              string `json:"title"`
	Priority           int    `json:"priority"`
	Status             string `json:"status"`
	DueAt              string `json:"due_at,omitempty"`
	CreatedBy          string `json:"created_by,omitempty"`
	CreatedAt          string `json:"created_at,omitempty"`
	UpdatedAt          string `json:"updated_at,omitempty"`
}

type TeacherEvidenceRecord struct {
	ID                 string `json:"id"`
	IdempotencyKey     string `json:"-"`
	SchoolURN          string `json:"school_urn"`
	StudentExternalRef string `json:"student_external_ref"`
	StudentDisplayName string `json:"student_display_name,omitempty"`
	ObjectiveID        string `json:"objective_id"`
	EvidenceType       string `json:"evidence_type"`
	Outcome            string `json:"outcome"`
	Note               string `json:"note"`
	SourceRef          string `json:"source_ref,omitempty"`
	RecordedBy         string `json:"recorded_by,omitempty"`
	RecordedAt         string `json:"recorded_at,omitempty"`
}

type InterventionPlan struct {
	ID                 string `json:"id"`
	IdempotencyKey     string `json:"-"`
	SchoolURN          string `json:"school_urn"`
	StudentExternalRef string `json:"student_external_ref"`
	StudentDisplayName string `json:"student_display_name,omitempty"`
	ObjectiveID        string `json:"objective_id"`
	Title              string `json:"title"`
	Need               string `json:"need"`
	Strategy           string `json:"strategy"`
	Priority           int    `json:"priority"`
	Status             string `json:"status"`
	ReviewDueAt        string `json:"review_due_at,omitempty"`
	CreatedBy          string `json:"created_by,omitempty"`
	CreatedAt          string `json:"created_at,omitempty"`
	UpdatedAt          string `json:"updated_at,omitempty"`
}

type InterventionReview struct {
	ID                 string `json:"id,omitempty"`
	IdempotencyKey     string `json:"-"`
	InterventionID     string `json:"intervention_id"`
	SchoolURN          string `json:"school_urn,omitempty"`
	StudentExternalRef string `json:"student_external_ref,omitempty"`
	StudentDisplayName string `json:"student_display_name,omitempty"`
	ObjectiveID        string `json:"objective_id,omitempty"`
	Outcome            string `json:"outcome"`
	EvidenceNote       string `json:"evidence_note"`
	NextReviewDueAt    string `json:"next_review_due_at,omitempty"`
	ReviewedBy         string `json:"reviewed_by,omitempty"`
	ReviewedAt         string `json:"reviewed_at,omitempty"`
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

type RuntimeFlags struct {
	Flags       map[string]bool           `json:"flags"`
	Config      map[string]map[string]any `json:"config"`
	GeneratedAt string                    `json:"generated_at"`
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
	ID              string         `json:"id"`
	ActivityID      string         `json:"activity_id"`
	ObjectiveID     string         `json:"objective_id"`
	Format          string         `json:"format"`
	Body            map[string]any `json:"body"`
	ExpectedAnswer  map[string]any `json:"expected_answer"`
	Hints           []string       `json:"hints"`
	Explanation     string         `json:"explanation"`
	Difficulty      int            `json:"difficulty"`
	Status          string         `json:"status"`
	UpdatedAt       string         `json:"updated_at"`
	SelectionReason string         `json:"selection_reason,omitempty"`
}

type AuditLog struct {
	ID         string         `json:"id"`
	Action     string         `json:"action"`
	EntityType string         `json:"entity_type"`
	EntityID   string         `json:"entity_id"`
	Payload    map[string]any `json:"payload"`
	CreatedAt  string         `json:"created_at"`
}

type NarrationReview struct {
	ID               string          `json:"id"`
	AssetID          string          `json:"asset_id"`
	TextSHA256       string          `json:"text_sha256"`
	AudioSHA256      string          `json:"audio_sha256"`
	Decision         string          `json:"decision"`
	ReviewerID       string          `json:"reviewer_id,omitempty"`
	ReviewerName     string          `json:"reviewer_name"`
	Criteria         map[string]bool `json:"criteria"`
	RejectionReasons []string        `json:"rejection_reasons,omitempty"`
	Notes            string          `json:"notes,omitempty"`
	CreatedAt        string          `json:"created_at"`
	UpdatedAt        string          `json:"updated_at"`
	Stale            bool            `json:"stale,omitempty"`
}

type ContentVersion struct {
	ID          string         `json:"id"`
	ContentKey  string         `json:"content_key"`
	ContentType string         `json:"content_type"`
	Status      string         `json:"status"`
	Version     int            `json:"version"`
	Payload     map[string]any `json:"payload"`
	CreatedAt   string         `json:"created_at"`
	PublishedAt string         `json:"published_at,omitempty"`
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

type SchoolUserConfig struct {
	ID                        string `json:"id"`
	SchoolURN                 string `json:"school_urn"`
	SchoolName                string `json:"school_name"`
	Email                     string `json:"email"`
	DisplayName               string `json:"display_name"`
	Role                      string `json:"role"`
	LoginID                   string `json:"login_id"`
	TemporaryPassword         string `json:"temporary_password,omitempty"`
	TemporaryPasswordRequired bool   `json:"temporary_password_required"`
	Status                    string `json:"status"`
	CreatedAt                 string `json:"created_at"`
	UpdatedAt                 string `json:"updated_at"`
}

type SchoolPortalConfig struct {
	School             SchoolConfig              `json:"school"`
	Users              []SchoolUserConfig        `json:"users"`
	Classes            []ClassConfig             `json:"classes"`
	Groups             []LearningGroupConfig     `json:"groups"`
	StudentCredentials []StudentCredentialConfig `json:"student_credentials"`
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

type LearningGroupConfig struct {
	ID        string                 `json:"id"`
	ClassID   string                 `json:"class_id"`
	ClassName string                 `json:"class_name"`
	Name      string                 `json:"name"`
	Purpose   string                 `json:"purpose"`
	Students  []StudentProfileConfig `json:"students"`
	CreatedAt string                 `json:"created_at"`
	UpdatedAt string                 `json:"updated_at"`
}

type ClassCredentialBatch struct {
	ClassID        string                    `json:"class_id"`
	Overwrite      bool                      `json:"overwrite"`
	PicturePool    []string                  `json:"picture_pool"`
	Credentials    []StudentCredentialConfig `json:"credentials"`
	GeneratedAt    string                    `json:"generated_at"`
	GeneratedCount int                       `json:"generated_count"`
}

type ParentLinkConfig struct {
	ID                 string `json:"id"`
	ParentEmail        string `json:"parent_email"`
	ParentDisplayName  string `json:"parent_display_name"`
	StudentExternalRef string `json:"student_external_ref"`
	StudentDisplayName string `json:"student_display_name"`
	Relationship       string `json:"relationship"`
	Status             string `json:"status"`
	CreatedAt          string `json:"created_at"`
	UpdatedAt          string `json:"updated_at"`
}

type ParentAccountConfig struct {
	ID                        string `json:"id"`
	Email                     string `json:"email"`
	DisplayName               string `json:"display_name"`
	LoginID                   string `json:"login_id"`
	Password                  string `json:"password,omitempty"`
	TemporaryPassword         string `json:"temporary_password,omitempty"`
	TemporaryPasswordRequired bool   `json:"temporary_password_required"`
	Status                    string `json:"status"`
	CreatedAt                 string `json:"created_at"`
	UpdatedAt                 string `json:"updated_at"`
}

type StudentEngagementProfile struct {
	StudentExternalRef   string   `json:"student_external_ref"`
	DeclaredSupportNeeds []string `json:"declared_support_needs"`
	LearningApproaches   []string `json:"learning_approaches"`
	CelebrationIntensity string   `json:"celebration_intensity"`
	AudioSupport         bool     `json:"audio_support"`
	ReadingSupport       bool     `json:"reading_support"`
	SessionLength        string   `json:"session_length"`
	SensoryLoad          string   `json:"sensory_load"`
	AttentionSupport     string   `json:"attention_support"`
	CommunicationSupport string   `json:"communication_support"`
	ProcessingSupport    string   `json:"processing_support"`
	ConfidenceSupport    string   `json:"confidence_support"`
	CompanionStyle       string   `json:"companion_style"`
	RewardStyle          string   `json:"reward_style"`
	Interests            []string `json:"interests"`
	Notes                string   `json:"notes"`
	UpdatedAt            string   `json:"updated_at"`
}

type ParentChildConfig struct {
	Student    StudentProfileConfig     `json:"student"`
	Credential StudentCredentialConfig  `json:"credential"`
	Engagement StudentEngagementProfile `json:"engagement"`
}

type ParentPortalConfig struct {
	Parent   ParentAccountConfig `json:"parent"`
	Children []ParentChildConfig `json:"children"`
}

type AccountSession struct {
	ID        string `json:"id"`
	UserID    string `json:"user_id"`
	LoginID   string `json:"login_id"`
	Role      string `json:"role"`
	SchoolURN string `json:"school_urn,omitempty"`
	TokenHash string `json:"-"`
	ExpiresAt string `json:"expires_at"`
	RevokedAt string `json:"revoked_at,omitempty"`
	CreatedAt string `json:"created_at"`
}

type PlatformUserConfig struct {
	ID          string   `json:"id"`
	Email       string   `json:"email"`
	DisplayName string   `json:"display_name"`
	LoginID     string   `json:"login_id"`
	Roles       []string `json:"roles"`
	Status      string   `json:"status"`
}

type ParentInvitation struct {
	ID                 string `json:"id"`
	ParentEmail        string `json:"parent_email"`
	ParentDisplayName  string `json:"parent_display_name"`
	StudentExternalRef string `json:"student_external_ref"`
	Relationship       string `json:"relationship"`
	Status             string `json:"status"`
	Token              string `json:"token,omitempty"`
	TokenHash          string `json:"-"`
	ExpiresAt          string `json:"expires_at"`
	SentAt             string `json:"sent_at,omitempty"`
	AcceptedAt         string `json:"accepted_at,omitempty"`
	RevokedAt          string `json:"revoked_at,omitempty"`
	CreatedAt          string `json:"created_at"`
	UpdatedAt          string `json:"updated_at"`
}

type AccessRequestConfig struct {
	ID                 string   `json:"id"`
	IdempotencyKey     string   `json:"-"`
	RequestType        string   `json:"request_type"`
	OrganisationName   string   `json:"organisation_name"`
	ContactName        string   `json:"contact_name"`
	ContactEmail       string   `json:"contact_email"`
	Phone              string   `json:"phone"`
	Role               string   `json:"role"`
	Region             string   `json:"region"`
	LearnerCount       int      `json:"learner_count"`
	YearGroups         []int    `json:"year_groups"`
	SupportNeeds       []string `json:"support_needs"`
	LearningPriorities []string `json:"learning_priorities"`
	Message            string   `json:"message"`
	Status             string   `json:"status"`
	Source             string   `json:"source"`
	CreatedAt          string   `json:"created_at"`
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
	StudentID          string             `json:"student_id"`
	ObjectiveID        string             `json:"objective_id"`
	ActivityID         string             `json:"activity_id"`
	WorldKey           string             `json:"world_key"`
	World              string             `json:"world"`
	Realm              string             `json:"realm"`
	Interaction        string             `json:"interaction"`
	Difficulty         int                `json:"difficulty"`
	Scaffold           bool               `json:"scaffold"`
	Review             bool               `json:"review"`
	PrerequisiteProbe  bool               `json:"prerequisite_probe"`
	AssessmentMode     string             `json:"assessment_mode"`
	RewardHook         string             `json:"reward_hook"`
	AnimationHook      string             `json:"animation_hook"`
	Explanation        string             `json:"explanation"`
	CompanionPrompt    string             `json:"companion_prompt"`
	RecommendedActions []string           `json:"recommended_actions"`
	RuntimeAdaptations RuntimeAdaptations `json:"runtime_adaptations"`
}

type RuntimeAdaptations struct {
	AnimationTier        string   `json:"animation_tier"`
	ReducedMotion        bool     `json:"reduced_motion"`
	CelebrationIntensity string   `json:"celebration_intensity"`
	SessionLength        string   `json:"session_length"`
	QuestionLimit        int      `json:"question_limit"`
	ScaffoldLevel        string   `json:"scaffold_level"`
	AudioSupport         bool     `json:"audio_support"`
	ReadingSupport       bool     `json:"reading_support"`
	SimpleText           bool     `json:"simple_text"`
	VisualGuide          bool     `json:"visual_guide"`
	HighContrast         bool     `json:"high_contrast"`
	LargeTargets         bool     `json:"large_targets"`
	SimplifiedControls   bool     `json:"simplified_controls"`
	SwitchAccess         bool     `json:"switch_access"`
	PreferredFormats     []string `json:"preferred_formats"`
	AvoidFormats         []string `json:"avoid_formats"`
	CompanionStyle       string   `json:"companion_style"`
	RewardStyle          string   `json:"reward_style"`
	Reasons              []string `json:"reasons"`
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
