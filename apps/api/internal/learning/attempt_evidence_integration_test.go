package learning

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestPostgresAdultAttemptEvidenceSurvivesContentEdits(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx := context.Background()
	exec := func(sql string) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	exec(`INSERT INTO students(external_ref,display_name,year_group) VALUES ('evidence-child','Test',3),('other-child','Other',3);
 INSERT INTO curriculum_objectives(id,year_group,subject,strand,topic,statement) VALUES ('evidence-objective',3,'Mathematics','Number','Decimals','Add decimals');
 INSERT INTO questions(id,objective_id,format,body,expected_answer,status) VALUES ('evidence-question','evidence-objective','number-input','{"prompt":"What is 1.5 + 1?","private_notes":"DO-NOT-EXPOSE"}','{"value":2.5}','approved');`)
	questions, err := repo.ListQuestionsForActivity(ctx, "", "evidence-objective", 10)
	if err != nil || len(questions) != 1 {
		t.Fatalf("questions=%+v error=%v", questions, err)
	}
	_, err = repo.RecordAttempt(ctx, Attempt{StudentID: "evidence-child", ObjectiveID: "evidence-objective", QuestionID: "evidence-question", QuestionVersion: questions[0].QuestionVersion, Format: "number-input", Response: &AnswerResponse{Kind: "number", Value: json.RawMessage(`2.5`)}, HintUsed: true})
	if err != nil {
		t.Fatal(err)
	}
	// Interface detection keeps the red test executable before the new method exists.
	store, ok := any(repo).(interface {
		AdultAttemptEvidence(context.Context, string, int) ([]AttemptEvidence, error)
	})
	if !ok {
		t.Fatal("adult evidence reader is missing")
	}
	exec(`UPDATE questions SET body='{"prompt":"CHANGED LIVE PROMPT"}',expected_answer='{"value":99}',status='draft' WHERE id='evidence-question'`)
	items, err := store.AdultAttemptEvidence(ctx, "evidence-child", 10)
	if err != nil || len(items) != 1 {
		t.Fatalf("evidence=%+v error=%v", items, err)
	}
	item := items[0]
	if item.QuestionPrompt != "What is 1.5 + 1?" || item.RecordedAnswer != "2.5" || len(item.QuestionVersion) != 64 || item.ID == "" || !item.Correct || !item.HintUsed {
		t.Fatalf("lost immutable evidence: %+v", item)
	}
	data, _ := json.Marshal(item)
	for _, private := range []string{"expected_answer", "DO-NOT-EXPOSE", "CHANGED LIVE PROMPT", "snapshot"} {
		if strings.Contains(string(data), private) {
			t.Fatalf("private or live marking data exposed: %s", data)
		}
	}
	for _, student := range []string{"other-child", "missing", ""} {
		items, err := store.AdultAttemptEvidence(ctx, student, 10)
		if err != nil || len(items) != 0 {
			t.Fatalf("scope %q leaked evidence: %+v %v", student, items, err)
		}
	}
	exec(`INSERT INTO question_attempts(student_id,objective_id,question_id,format,expected_answer,given_answer,correct,response_ms,hint_used,mastery_delta,explanation,created_at)
 SELECT id,'evidence-objective','evidence-question','number-input','5','4',false,1000,false,0,'Historical result','2020-01-01' FROM students WHERE external_ref='evidence-child'`)
	items, err = store.AdultAttemptEvidence(ctx, "evidence-child", 1)
	if err != nil || len(items) != 1 || items[0].QuestionVersion == "" {
		t.Fatalf("limit/order: %+v %v", items, err)
	}
	items, err = store.AdultAttemptEvidence(ctx, "evidence-child", 10)
	if err != nil || len(items) != 2 || items[1].QuestionVersion != "" || items[1].QuestionPrompt != "" || items[1].RecordedAnswer != "4" {
		t.Fatalf("historical provenance invented: %+v %v", items, err)
	}
	exec(`INSERT INTO mock_assessments(id,student_id,created_by_role,subject,year_group,year_from,year_to,title,question_count)
 SELECT '00000000-0000-0000-0000-000000000001',id,'parent','Mathematics',3,3,3,'Test mock',1 FROM students WHERE external_ref='evidence-child';
 INSERT INTO question_attempts(student_id,objective_id,question_id,expected_answer,given_answer,correct,mock_assessment_id)
 SELECT id,'evidence-objective','mock-only','5','5',true,'00000000-0000-0000-0000-000000000001' FROM students WHERE external_ref='evidence-child'`)
	items, err = store.AdultAttemptEvidence(ctx, "evidence-child", 10)
	if err != nil || len(items) != 2 {
		t.Fatalf("mock leaked into ordinary learning evidence: %+v %v", items, err)
	}
	exec(`INSERT INTO question_attempts(student_id,objective_id,question_id,expected_answer,given_answer,correct,created_at)
 SELECT s.id,'evidence-objective','bounded-'||n,'5','5',true,'2020-01-01' FROM students s CROSS JOIN generate_series(1,60) AS n WHERE s.external_ref='evidence-child'`)
	for _, limit := range []int{-1, 0, 51, 1000000} {
		items, err = store.AdultAttemptEvidence(ctx, "evidence-child", limit)
		if err != nil || len(items) != 10 {
			t.Fatalf("unbounded limit %d returned %d: %v", limit, len(items), err)
		}
	}
	first, err := store.AdultAttemptEvidence(ctx, "evidence-child", 50)
	if err != nil || len(first) != 50 {
		t.Fatalf("maximum page: %d %v", len(first), err)
	}
	second, err := store.AdultAttemptEvidence(ctx, "evidence-child", 50)
	if err != nil {
		t.Fatal(err)
	}
	for i := range first {
		if first[i].ID != second[i].ID {
			t.Fatal("equal timestamps produce unstable evidence ordering")
		}
	}
}
