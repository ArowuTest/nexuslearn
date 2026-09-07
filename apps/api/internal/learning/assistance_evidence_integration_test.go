package learning

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"testing"
)

func TestPostgresAssistanceEvidenceSeparatesAccessAndAnswerHelp(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `
INSERT INTO students(external_ref,display_name,year_group) VALUES ('assistance-child','Test pupil',3);
INSERT INTO curriculum_objectives(id,year_group,subject,strand,topic,statement) VALUES ('assistance-objective',3,'Mathematics','Number','Addition','Add two numbers');
INSERT INTO questions(id,objective_id,format,body,expected_answer,status) VALUES
 ('assistance-access','assistance-objective','number-input','{"prompt":"What is 2 + 3?"}','{"value":5}','approved'),
 ('assistance-answer-help','assistance-objective','number-input','{"prompt":"What is 4 + 1?"}','{"value":5}','approved');`); err != nil {
		t.Fatal(err)
	}
	questions, err := repo.ListQuestionsForActivity(ctx, "", "assistance-objective", 10)
	if err != nil || len(questions) != 2 {
		t.Fatalf("questions=%+v error=%v", questions, err)
	}
	byID := map[string]QuestionConfig{}
	for _, question := range questions {
		byID[question.ID] = question
	}
	access := Attempt{
		StudentID: "assistance-child", ObjectiveID: "assistance-objective", QuestionID: "assistance-access",
		QuestionVersion: byID["assistance-access"].QuestionVersion, IdempotencyKey: "assistance-access-attempt",
		Response: &AnswerResponse{Kind: "number", Value: json.RawMessage(`5`)}, ResponseMode: "keyboard", AssistanceUsed: []string{"audio-replay", "switch-access"},
	}
	if result, err := repo.RecordAttempt(ctx, access); err != nil || !result.Correct {
		t.Fatalf("access-supported answer=%+v error=%v", result, err)
	}
	answerHelp := Attempt{
		StudentID: "assistance-child", ObjectiveID: "assistance-objective", QuestionID: "assistance-answer-help",
		QuestionVersion: byID["assistance-answer-help"].QuestionVersion, IdempotencyKey: "assistance-answer-attempt",
		Response: &AnswerResponse{Kind: "number", Value: json.RawMessage(`5`)}, AssistanceUsed: []string{"answer-model"},
	}
	first, err := repo.RecordAttempt(ctx, answerHelp)
	if err != nil || !first.Correct {
		t.Fatalf("answer-help result=%+v error=%v", first, err)
	}
	replay, err := repo.RecordAttempt(ctx, answerHelp)
	if err != nil || !reflect.DeepEqual(first, replay) {
		t.Fatalf("idempotent retry changed answer-help result: first=%+v replay=%+v error=%v", first, replay, err)
	}
	conflict := answerHelp
	conflict.AssistanceUsed = []string{"audio-replay"}
	if _, err := repo.RecordAttempt(ctx, conflict); !errors.Is(err, ErrIdempotencyConflict) {
		t.Fatalf("changed assistance reused idempotency key: %v", err)
	}

	var accessSignals, answerSignals string
	if err := pool.QueryRow(ctx, `SELECT array_to_string(assistance_used, ',') FROM question_attempts WHERE question_id='assistance-access'`).Scan(&accessSignals); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT array_to_string(assistance_used, ',') FROM question_attempts WHERE question_id='assistance-answer-help'`).Scan(&answerSignals); err != nil {
		t.Fatal(err)
	}
	if accessSignals != "audio_replay,switch_access,keyboard_response" || answerSignals != "answer_model" {
		t.Fatalf("assistance evidence was not canonicalised: access=%q answer=%q", accessSignals, answerSignals)
	}

	var independentCorrect int
	if err := pool.QueryRow(ctx, `SELECT independent_correct_count FROM student_objective_mastery som JOIN students s ON s.id=som.student_id WHERE s.external_ref='assistance-child' AND som.objective_id='assistance-objective'`).Scan(&independentCorrect); err != nil {
		t.Fatal(err)
	}
	if independentCorrect != 1 {
		t.Fatalf("independent correct count=%d, want 1", independentCorrect)
	}

	items, err := repo.AdultAttemptEvidence(ctx, "assistance-child", 10)
	if err != nil || len(items) != 2 {
		t.Fatalf("adult evidence=%+v error=%v", items, err)
	}
	if items[0].Independent || !items[1].Independent || items[0].AssistanceUsed[0] != "answer_model" || items[1].AssistanceUsed[0] != "audio_replay" || !containsAssistance(items[1].AssistanceUsed, "keyboard_response") {
		t.Fatalf("adult evidence lost independent classification: %+v", items)
	}
	recent, err := repo.RecentAttempts(ctx, "assistance-child", 10)
	if err != nil || len(recent) != 2 {
		t.Fatalf("recent attempts=%+v error=%v", recent, err)
	}
	if recent[0].Independent || !recent[1].Independent {
		t.Fatalf("recent attempt classification incorrect: %+v", recent)
	}
}
