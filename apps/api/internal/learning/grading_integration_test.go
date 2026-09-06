package learning

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"sync"
	"testing"
)

// These tests exercise real migrations, grading, mastery and transaction writes.
func TestPostgresAttemptDoesNotTrustClientAnswerKey(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx := context.Background()
	_, err := pool.Exec(ctx, `
 INSERT INTO students (external_ref,display_name,year_group) VALUES ('grading-child','Test pupil',3);
 INSERT INTO curriculum_objectives (id,year_group,subject,strand,topic,statement)
 VALUES ('grading-objective',3,'Mathematics','Number','Addition','Add two numbers');
 INSERT INTO questions (id,objective_id,format,body,expected_answer,status)
 VALUES ('grading-question','grading-objective','number-input','{"prompt":"What is 2 + 3?"}','{"value":5}','approved');
 `)
	if err != nil {
		t.Fatal(err)
	}
	a := Attempt{StudentID: "grading-child", ObjectiveID: "grading-objective", QuestionID: "grading-question", Format: "number-input", Given: 99, Expected: 99, IdempotencyKey: "forged-key"}
	result, err := repo.RecordAttempt(ctx, a)
	if err != nil {
		t.Fatal(err)
	}
	if result.Correct || result.MasteryGain > 0 {
		t.Fatalf("forged client key earned mastery: %+v", result)
	}
	var expected string
	if err := pool.QueryRow(ctx, `SELECT expected_answer FROM question_attempts WHERE question_id='grading-question'`).Scan(&expected); err != nil {
		t.Fatal(err)
	}
	if expected != "5" {
		t.Fatalf("persisted client key %q instead of canonical 5", expected)
	}
}

func TestPostgresAttemptRejectsUnconfiguredQuestion(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `INSERT INTO students (external_ref,display_name,year_group) VALUES ('grading-child','Test pupil',3)`); err != nil {
		t.Fatal(err)
	}
	a := Attempt{StudentID: "grading-child", ObjectiveID: "invented-objective", QuestionID: "invented-question", Given: 1, Expected: 1}
	if result, err := repo.RecordAttempt(ctx, a); err == nil {
		t.Fatalf("invented content accepted: %+v", result)
	}
	var count int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM curriculum_objectives WHERE id='invented-objective'`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatal("attempt created an invented objective")
	}
}

func TestPostgresCanonicalGradingIntegrity(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx := context.Background()
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	exec(`INSERT INTO curriculum_objectives(id,year_group,subject,strand,topic,statement) VALUES ('grading-objective',3,'Mathematics','Number','Addition','Add two numbers')`)
	fresh := func(name string) Attempt {
		t.Helper()
		exec(`INSERT INTO students(external_ref,display_name,year_group) VALUES ($1,'Test pupil',3)`, name)
		exec(`INSERT INTO questions(id,objective_id,format,body,expected_answer,status) VALUES ($1,'grading-objective','number-input','{"prompt":"2+3"}','{"value":5}','approved')`, name)
		return Attempt{StudentID: name, ObjectiveID: "grading-objective", QuestionID: name, Format: "number-input", IdempotencyKey: name, Given: 5, Expected: 999}
	}
	assertNoEvidence := func(a Attempt) {
		t.Helper()
		var count int
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM question_attempts qa JOIN students s ON s.id=qa.student_id WHERE s.external_ref=$1`, a.StudentID).Scan(&count); err != nil {
			t.Fatal(err)
		}
		if count != 0 {
			t.Fatalf("rejected request wrote %d attempts", count)
		}
	}
	t.Run("contract binding", func(t *testing.T) {
		for i, mutate := range []func(*Attempt){func(a *Attempt) { a.ObjectiveID = "other-objective" }, func(a *Attempt) { a.Format = "made-up-format" }, func(a *Attempt) { a.QuestionID = "missing" }} {
			a := fresh(fmt.Sprintf("binding-%d", i))
			mutate(&a)
			if _, err := repo.RecordAttempt(ctx, a); !errors.Is(err, ErrQuestionUnavailable) {
				t.Fatalf("got %v", err)
			}
			assertNoEvidence(a)
		}
	})
	t.Run("draft cannot grade", func(t *testing.T) {
		a := fresh("draft")
		exec(`UPDATE questions SET status='draft' WHERE id=$1`, a.QuestionID)
		if _, err := repo.RecordAttempt(ctx, a); !errors.Is(err, ErrQuestionUnavailable) {
			t.Fatal(err)
		}
		assertNoEvidence(a)
	})
	t.Run("stale first submission rejected", func(t *testing.T) {
		a := fresh("stale")
		questions, err := repo.ListQuestionsForActivity(ctx, "", "grading-objective", 500)
		if err != nil {
			t.Fatal(err)
		}
		for _, q := range questions {
			if q.ID == a.QuestionID {
				a.QuestionVersion = q.QuestionVersion
			}
		}
		if a.QuestionVersion == "" {
			t.Fatal("served question missing version")
		}
		exec(`UPDATE questions SET expected_answer='{"value":6}' WHERE id=$1`, a.QuestionID)
		if _, err := repo.RecordAttempt(ctx, a); !errors.Is(err, ErrQuestionVersion) {
			t.Fatalf("got %v", err)
		}
		assertNoEvidence(a)
	})
	t.Run("concurrent retries award once and replay after withdrawal", func(t *testing.T) {
		a := fresh("concurrent")
		const n = 8
		results := make([]AttemptResult, n)
		errs := make([]error, n)
		var wg sync.WaitGroup
		for i := 0; i < n; i++ {
			wg.Add(1)
			go func(i int) { defer wg.Done(); results[i], errs[i] = repo.RecordAttempt(ctx, a) }(i)
		}
		wg.Wait()
		for i := range results {
			if errs[i] != nil {
				t.Fatal(errs[i])
			}
			if !results[i].Correct || !reflect.DeepEqual(results[0], results[i]) {
				t.Fatalf("inconsistent replay %+v", results)
			}
		}
		var count, history int
		var version string
		var snapshot []byte
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM question_attempts WHERE question_id=$1`, a.QuestionID).Scan(&count); err != nil {
			t.Fatal(err)
		}
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM mastery_history WHERE question_id=$1`, a.QuestionID).Scan(&history); err != nil {
			t.Fatal(err)
		}
		if count != 1 || history != 1 {
			t.Fatalf("duplicated evidence attempts=%d history=%d", count, history)
		}
		if err := pool.QueryRow(ctx, `SELECT a.question_version,v.snapshot FROM question_attempts a JOIN question_grading_versions v ON v.version=a.question_version WHERE a.question_id=$1`, a.QuestionID).Scan(&version, &snapshot); err != nil {
			t.Fatal(err)
		}
		var q QuestionConfig
		if err := json.Unmarshal(snapshot, &q); err != nil {
			t.Fatal(err)
		}
		if version == "" || q.ExpectedAnswer["value"] != float64(5) {
			t.Fatalf("missing canonical provenance: %s %s", version, snapshot)
		}
		exec(`INSERT INTO students(external_ref,display_name,year_group) VALUES ('concurrent-peer','Another pupil',3)`)
		peer := a
		peer.StudentID = "concurrent-peer"
		if _, err := repo.RecordAttempt(ctx, peer); err != nil {
			t.Fatal(err)
		}
		var versions int
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM question_grading_versions WHERE question_id='concurrent'`).Scan(&versions); err != nil {
			t.Fatal(err)
		}
		if versions != 1 {
			t.Fatalf("identical content duplicated across learners: %d snapshots", versions)
		}
		exec(`UPDATE questions SET status='draft',expected_answer='{"value":99}' WHERE id=$1`, a.QuestionID)
		replay, err := repo.RecordAttempt(ctx, a)
		if err != nil || !reflect.DeepEqual(replay, results[0]) {
			t.Fatalf("withdrawal broke acknowledged replay: %+v %v", replay, err)
		}
		a.Given = 9
		if _, err := repo.RecordAttempt(ctx, a); !errors.Is(err, ErrIdempotencyConflict) {
			t.Fatalf("conflicting retry: %v", err)
		}
	})
	t.Run("late failure rolls all evidence back", func(t *testing.T) {
		a := fresh("rollback")
		exec(`ALTER TABLE mastery_history ADD CONSTRAINT grading_test_reject CHECK (question_id != 'rollback')`)
		if _, err := repo.RecordAttempt(ctx, a); err == nil {
			t.Fatal("expected persistence failure")
		}
		assertNoEvidence(a)
		var count int
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM request_idempotency WHERE request_key='rollback'`).Scan(&count); err != nil {
			t.Fatal(err)
		}
		if count != 0 {
			t.Fatal("failed transaction consumed idempotency key")
		}
		exec(`ALTER TABLE mastery_history DROP CONSTRAINT grading_test_reject`)
		if result, err := repo.RecordAttempt(ctx, a); err != nil || !result.Correct {
			t.Fatalf("retry after rollback failed: %+v %v", result, err)
		}
	})
	t.Run("mock membership and closed replay without mastery", func(t *testing.T) {
		a := fresh("mock")
		var id string
		if err := pool.QueryRow(ctx, `INSERT INTO mock_assessments(student_id,created_by_role,subject,year_group,year_from,year_to,title,question_count) SELECT id,'pupil','Mathematics',3,3,3,'Test mock',1 FROM students WHERE external_ref='mock' RETURNING id::text`).Scan(&id); err != nil {
			t.Fatal(err)
		}
		a.MockAssessmentID = id
		if _, err := repo.RecordAttempt(ctx, a); !errors.Is(err, ErrMockQuestionNotInAssessment) {
			t.Fatalf("non-member allowed: %v", err)
		}
		assertNoEvidence(a)
		exec(`INSERT INTO mock_assessment_items(assessment_id,position,question_id,objective_id) VALUES ($1,1,'mock','grading-objective')`, id)
		result, err := repo.RecordAttempt(ctx, a)
		if err != nil || !result.Correct {
			t.Fatalf("mock marking: %+v %v", result, err)
		}
		if result.MasteryGain != 0 || result.MasteryDelta != 0 || result.ProjectedScore != 0 {
			t.Fatalf("mock response claims mastery: %+v", result)
		}
		var count int
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM mastery_history WHERE question_id='mock'`).Scan(&count); err != nil {
			t.Fatal(err)
		}
		if count != 0 {
			t.Fatal("mock created mastery evidence")
		}
		exec(`UPDATE questions SET status='draft' WHERE id='mock'`)
		replay, err := repo.RecordAttempt(ctx, a)
		if err != nil || !reflect.DeepEqual(result, replay) {
			t.Fatalf("closed mock replay failed: %+v %v", replay, err)
		}
	})
	t.Run("active release bounds both question and objective", func(t *testing.T) {
		a := fresh("release")
		exec(`INSERT INTO content_releases(id,schema_version,channel,manifest_sha256,expected_pack_count,expected_objective_count,expected_activity_count,expected_question_count,expected_reward_rule_count,status,applied_at) VALUES ('grading-live','1','live','grading-hash',1,1,0,1,0,'applied',now())`)
		if _, err := repo.RecordAttempt(ctx, a); !errors.Is(err, ErrQuestionUnavailable) {
			t.Fatalf("out of release question allowed: %v", err)
		}
		exec(`UPDATE questions SET content_release_id='grading-live' WHERE id='release'`)
		if _, err := repo.RecordAttempt(ctx, a); !errors.Is(err, ErrQuestionUnavailable) {
			t.Fatalf("out of release objective allowed: %v", err)
		}
		exec(`UPDATE curriculum_objectives SET content_release_id='grading-live' WHERE id='grading-objective'`)
		if result, err := repo.RecordAttempt(ctx, a); err != nil || !result.Correct {
			t.Fatalf("active release answer failed: %+v %v", result, err)
		}
	})
}

func TestNoopRepositoryCannotCertifyAnswers(t *testing.T) {
	if _, err := (NoopRepository{}).RecordAttempt(context.Background(), Attempt{}); err == nil {
		t.Fatal("unpersisted answer returned success")
	}
}
