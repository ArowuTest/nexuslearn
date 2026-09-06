package learning

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"testing"
)

func TestPostgresRetiredSubmissionsRejectNewWritesButReplayHistory(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `
 INSERT INTO students(external_ref,display_name,year_group) VALUES ('retirement-child','QA pupil',3);
 INSERT INTO curriculum_objectives(id,year_group,subject,strand,topic,statement) VALUES ('retirement-o',3,'Mathematics','Number','Zero','Recognise zero');
 INSERT INTO questions(id,objective_id,format,body,expected_answer,status) VALUES ('retirement-q','retirement-o','number-input','{"prompt":"One minus one?"}','{"value":0}','approved');
 `); err != nil {
		t.Fatal(err)
	}
	legacy := Attempt{StudentID: "retirement-child", ObjectiveID: "retirement-o", QuestionID: "retirement-q", Given: 0, Expected: 0, IdempotencyKey: "historical"}
	// Seed a completed pre-upgrade acknowledgement. Do not run the new grader to
	// manufacture history: the stored outcome must be returned without grading.
	// Freeze the pre-retirement serialized contract independently of today's
	// Attempt marshaler. A future tag/order change must not pass this test merely
	// because both fixture creation and replay use the same new hashing code.
	const historicalJSON = `{"student_id":"retirement-child","objective_id":"retirement-o","question_id":"retirement-q","format":"","response_mode":"","given":0,"expected":0,"given_text":"","expected_text":"","ms":0,"hint_used":false,"confidence":0}`
	hash := fmt.Sprintf("%x", sha256.Sum256([]byte(historicalJSON)))
	want := AttemptResult{Correct: true, MasteryGain: 4, MasteryDelta: 4, ProjectedScore: 47, Feedback: "Saved before upgrade"}
	if _, err := pool.Exec(ctx, `INSERT INTO request_idempotency(scope,actor_key,request_key,request_hash,response_payload)
 SELECT 'learning.attempt',id::text,'historical',$1,$2::jsonb FROM students WHERE external_ref='retirement-child'`, hash, mustJSON(want)); err != nil {
		t.Fatal(err)
	}

	for _, versioned := range []bool{false, true} {
		a := legacy
		a.IdempotencyKey = "rejected-new"
		wantErr := ErrQuestionVersion
		if versioned {
			questions, err := repo.ListQuestionsForActivity(ctx, "", "retirement-o", 10)
			if err != nil || len(questions) != 1 {
				t.Fatalf("questions=%+v err=%v", questions, err)
			}
			a.QuestionVersion = questions[0].QuestionVersion
			wantErr = ErrInvalidResponse
		}
		if _, err := repo.RecordAttempt(ctx, a); !errors.Is(err, wantErr) {
			t.Fatalf("new legacy accepted: %v", err)
		}
	}
	var writes int
	if err := pool.QueryRow(ctx, `SELECT
 (SELECT count(*) FROM question_attempts WHERE question_id='retirement-q') +
 (SELECT count(*) FROM mastery_history WHERE question_id='retirement-q') +
 (SELECT count(*) FROM student_objective_mastery WHERE objective_id='retirement-o') +
 (SELECT count(*) FROM spaced_review_queue WHERE objective_id='retirement-o') +
 (SELECT count(*) FROM request_idempotency WHERE request_key='rejected-new')`).Scan(&writes); err != nil {
		t.Fatal(err)
	}
	if writes != 0 {
		t.Fatalf("rejected legacy request left %d writes", writes)
	}
	if _, err := pool.Exec(ctx, `UPDATE questions SET status='draft',expected_answer='{"value":99}' WHERE id='retirement-q'`); err != nil {
		t.Fatal(err)
	}
	// Round-trip through JSON, as the HTTP decoder does, before replay.
	var retry Attempt
	if err := json.Unmarshal([]byte(historicalJSON), &retry); err != nil {
		t.Fatal(err)
	}
	retry.IdempotencyKey = legacy.IdempotencyKey
	got, err := repo.RecordAttempt(ctx, retry)
	if err != nil || !reflect.DeepEqual(got, want) {
		t.Fatalf("historical acknowledgement changed: %+v %v", got, err)
	}
	retry.Given = 1
	if _, err := repo.RecordAttempt(ctx, retry); !errors.Is(err, ErrIdempotencyConflict) {
		t.Fatalf("conflicting history accepted: %v", err)
	}
}
