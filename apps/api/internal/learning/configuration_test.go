package learning

import (
	"errors"
	"testing"
)

func TestValidateActivityRejectsMissingConfiguredLinks(t *testing.T) {
	err := validateActivity(ActivityConfig{
		ID:         "act-test",
		Title:      "Test Activity",
		Prompt:     "Try the activity.",
		Difficulty: 3,
		Status:     "draft",
	})

	if !errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("expected invalid configuration error, got %v", err)
	}
}

func TestValidateQuestionRequiresPublishedActivityLink(t *testing.T) {
	err := validateQuestion(QuestionConfig{
		ID:             "q-test",
		ObjectiveID:    "ma-y4-test",
		Format:         "multiple_choice",
		Body:           map[string]any{"prompt": "What is 6 x 8?"},
		ExpectedAnswer: map[string]any{"value": 48},
		Explanation:    "Six groups of eight make 48.",
		Difficulty:     4,
		Status:         "published",
	})

	if !errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("expected invalid configuration error, got %v", err)
	}
}

func TestValidateQuestionRejectsMalformedMultipleChoice(t *testing.T) {
	err := validateQuestion(QuestionConfig{
		ID:             "q-test",
		ObjectiveID:    "ma-y4-test",
		Format:         "multiple_choice",
		Body:           map[string]any{"prompt": "What is 6 x 8?"},
		ExpectedAnswer: map[string]any{"value": 48},
		Explanation:    "Six groups of eight make 48.",
		Difficulty:     4,
		Status:         "draft",
	})

	if !errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("expected invalid configuration error, got %v", err)
	}
}

func TestValidateQuestionAcceptsAudioBlendShape(t *testing.T) {
	err := validateQuestion(QuestionConfig{
		ID:          "q-audio",
		ActivityID:  "act-audio",
		ObjectiveID: "en-y1-phonics-blend-cvc-words",
		Format:      "audio_blend",
		Body: map[string]any{
			"prompt":  "Blend c-a-t.",
			"sounds":  []any{"c", "a", "t"},
			"choices": []any{"cat", "cap", "cot"},
		},
		ExpectedAnswer: map[string]any{"value": "cat"},
		Explanation:    "The sounds c-a-t blend into cat.",
		Difficulty:     1,
		Status:         "published",
	})

	if err != nil {
		t.Fatalf("expected valid audio blend question, got %v", err)
	}
}

func TestValidateObjectiveAcceptsCompleteCurriculumRecord(t *testing.T) {
	err := validateObjective(Objective{
		ID:                "ma-y4-test",
		Year:              4,
		Subject:           "Mathematics",
		Strand:            "Number",
		Topic:             "Multiplication",
		Statement:         "Recall multiplication facts.",
		Misconceptions:    []string{"Confuses nearby facts."},
		ParentExplanation: "Can recall facts with fluency.",
		TeacherEvidence:   "Accuracy, retention and reduced hints.",
		Mastery: MasteryRule{
			Expected:        80,
			Secure:          90,
			RetentionDays:   []int{1, 3, 7},
			RequiredFormats: []string{"timed-recall"},
		},
	})

	if err != nil {
		t.Fatalf("expected valid objective, got %v", err)
	}
}

func TestValidateSchoolClassAndCredential(t *testing.T) {
	if err := validateSchool(SchoolConfig{Name: "Nexus Primary", URN: "urn-100", Status: "trial"}); err != nil {
		t.Fatalf("expected valid school, got %v", err)
	}
	if err := validateClass(ClassConfig{SchoolURN: "urn-100", Name: "Year 3 Falcon", YearGroup: 3}); err != nil {
		t.Fatalf("expected valid class, got %v", err)
	}
	if err := validateStudentCredential(StudentCredentialConfig{StudentExternalRef: "ava-y1", LoginCode: "AVA-123", PicturePassword: []string{"sun", "book"}}); err != nil {
		t.Fatalf("expected valid credential, got %v", err)
	}
}

func TestValidateCredentialRejectsBlankAccessMethod(t *testing.T) {
	err := validateStudentCredential(StudentCredentialConfig{StudentExternalRef: "ava-y1"})

	if !errors.Is(err, ErrInvalidConfiguration) {
		t.Fatalf("expected invalid configuration error, got %v", err)
	}
}
