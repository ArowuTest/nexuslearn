package learning

import "errors"

var ErrChildHeldBySchool = errors.New("this child is also on a school roll and cannot be deleted from the family account")
var ErrChildNotOwned = errors.New("this child is not linked to this parent")
var ErrConsentPurpose = errors.New("consent purpose is not recognised")

// ConsentRecord is the parent's own record that they agreed to a stated purpose.
type ConsentRecord struct {
	ID                 string `json:"id"`
	ParentUserID       string `json:"parent_user_id"`
	StudentExternalRef string `json:"student_external_ref"`
	Purpose            string `json:"purpose"`
	PolicyVersion      string `json:"policy_version"`
	Region             string `json:"region"`
	Method             string `json:"method"`
	GrantedAt          string `json:"granted_at"`
	WithdrawnAt        string `json:"withdrawn_at,omitempty"`
}

// HumanContentApproval records a person's decision about one pack.
// It does not by itself publish question variants. Narration ids listed here
// can be played to children after the decision is approved.
type HumanContentApproval struct {
	ID           string   `json:"id"`
	PackID       string   `json:"pack_id"`
	Decision     string   `json:"decision"`
	Reviewer     string   `json:"reviewer"`
	Notes        string   `json:"notes"`
	NarrationIDs []string `json:"narration_ids"`
	CreatedAt    string   `json:"created_at,omitempty"`
}

// FamilyExport is a parent's copy of one child's stored learning record.
// Sign-in secrets and answer keys are left out.
type FamilyExport struct {
	ExportedAt        string           `json:"exported_at"`
	Child             map[string]any   `json:"child"`
	Engagement        map[string]any   `json:"engagement,omitempty"`
	Consent           []ConsentRecord  `json:"consent"`
	Attempts          []map[string]any `json:"attempts"`
	AttemptsTruncated bool             `json:"attempts_truncated"`
	Mastery           []map[string]any `json:"mastery"`
	MasteryHistory    []map[string]any `json:"mastery_history"`
	Baselines         []map[string]any `json:"baselines"`
	MockAssessments   []map[string]any `json:"mock_assessments"`
	WorldState        []map[string]any `json:"world_state"`
	LessonSteps       []map[string]any `json:"lesson_steps"`
	Events            []map[string]any `json:"events"`
	Sharing           map[string]bool  `json:"sharing"`
	SecretsIncluded   bool             `json:"secrets_included"`
}

func AllowedConsentPurpose(purpose string) bool {
	switch purpose {
	case "family_learning", "school_pilot":
		return true
	default:
		return false
	}
}
