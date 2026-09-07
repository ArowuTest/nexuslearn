package learning

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestPostgresPreservesSubmittedEvidenceBeforeNormalization(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `INSERT INTO students(external_ref,display_name,year_group) VALUES ('original-child','Test',3);
 INSERT INTO curriculum_objectives(id,year_group,subject,strand,topic,statement) VALUES ('original-o',3,'English','Reading','Words','Read words')`); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct{ id, format, expected, kind, submitted, normalized string }{
		{"text", "audio-choice", `{"value":"cat"}`, "text", `"  CaT  "`, "cat"},
		{"number", "number-input", `{"value":1.25}`, "number", `1.2500`, "1.25"},
		{"sequence", "sequence-build", `{"sequence":["a","b"]}`, "sequence", `[" A ","B"]`, `["a","b"]`},
		{"mapping", "pattern-sort", `{"value":{"one":["a","b"]}}`, "mapping", `{"one":[" B ","A"]}`, `{"one":["a","b"]}`},
	} {
		t.Run(tc.id, func(t *testing.T) {
			if _, err := pool.Exec(ctx, `INSERT INTO questions(id,objective_id,format,body,expected_answer,status) VALUES ($1,'original-o',$2,'{"prompt":"Test prompt"}',$3::jsonb,'approved')`, tc.id, tc.format, tc.expected); err != nil {
				t.Fatal(err)
			}
			questions, err := repo.ListQuestionsForActivity(ctx, "", "original-o", 10)
			if err != nil {
				t.Fatal(err)
			}
			a := Attempt{StudentID: "original-child", ObjectiveID: "original-o", QuestionID: tc.id, IdempotencyKey: tc.id, Response: &AnswerResponse{Kind: tc.kind, Value: json.RawMessage(tc.submitted)}}
			for _, q := range questions {
				if q.ID == tc.id {
					a.QuestionVersion = q.QuestionVersion
				}
			}
			result, err := repo.RecordAttempt(ctx, a)
			if err != nil || !result.Correct {
				t.Fatalf("grade=%+v err=%v", result, err)
			}
			if tc.kind == "text" {
				oversized := a
				oversized.IdempotencyKey = "oversized"
				oversized.Response = &AnswerResponse{Kind: "text", Value: json.RawMessage(`"` + strings.Repeat(" ", 65536) + `cat"`)}
				if _, err := repo.RecordAttempt(ctx, oversized); !errors.Is(err, ErrInvalidResponse) {
					t.Fatalf("unbounded original input accepted: %v", err)
				}
			}
			items, err := repo.AdultAttemptEvidence(ctx, "original-child", 10)
			if err != nil {
				t.Fatal(err)
			}
			var fields map[string]json.RawMessage
			for _, item := range items {
				if item.QuestionID == tc.id {
					if item.RecordedAnswer != tc.normalized {
						t.Fatalf("normalized=%q", item.RecordedAnswer)
					}
					if item.SubmittedValueJSON != tc.submitted {
						t.Fatalf("display value lost original precision: %q", item.SubmittedValueJSON)
					}
					data, _ := json.Marshal(item)
					if err := json.Unmarshal(data, &fields); err != nil {
						t.Fatal(err)
					}
				}
			}
			var submitted AnswerResponse
			if err := json.Unmarshal(fields["submitted_response"], &submitted); err != nil {
				t.Fatalf("original submitted answer missing: %s %v", fields["submitted_response"], err)
			}
			if submitted.Kind != tc.kind || string(submitted.Value) != tc.submitted {
				t.Fatalf("submitted evidence normalized: %+v", submitted)
			}
			if string(fields["grader_revision"]) != `"canonical-policy-v2"` {
				t.Fatalf("marking revision missing: %s", fields["grader_revision"])
			}
			if _, err := pool.Exec(ctx, `UPDATE questions SET status='draft',expected_answer='{"value":"changed"}' WHERE id=$1`, tc.id); err != nil {
				t.Fatal(err)
			}
			replay, err := repo.RecordAttempt(ctx, a)
			if err != nil || !reflect.DeepEqual(result, replay) {
				t.Fatalf("retry changed saved result: %+v %v", replay, err)
			}
			var count int
			if err := pool.QueryRow(ctx, `SELECT count(*) FROM question_attempts WHERE question_id=$1`, tc.id).Scan(&count); err != nil {
				t.Fatal(err)
			}
			if count != 1 {
				t.Fatalf("retry duplicated original evidence: %d", count)
			}
		})
	}
}

func TestPostgresSubmittedEvidenceMigrationRoundTrip(t *testing.T) {
	pool, _ := openPaginationIntegrationRepository(t)
	ctx := context.Background()
	apply := func(direction string) {
		t.Helper()
		sql, err := os.ReadFile(filepath.Join("..", "..", "migrations", "0047_submitted_answer_evidence."+direction+".sql"))
		if err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, string(sql)); err != nil {
			t.Fatal(err)
		}
	}
	// This schema is disposable. No rollback is performed against learner data.
	apply("down")
	if _, err := pool.Exec(ctx, `INSERT INTO students(external_ref,display_name,year_group) VALUES ('migration-child','Test',3);
 INSERT INTO question_attempts(student_id,question_id,expected_answer,given_answer,correct)
 SELECT id,'historical','5','5',true FROM students WHERE external_ref='migration-child'`); err != nil {
		t.Fatal(err)
	}
	apply("up")
	var absent bool
	if err := pool.QueryRow(ctx, `SELECT submitted_response IS NULL AND grader_revision IS NULL FROM question_attempts WHERE question_id='historical'`).Scan(&absent); err != nil || !absent {
		t.Fatalf("migration invented provenance: %v %v", absent, err)
	}
	for _, sql := range []string{
		`UPDATE question_attempts SET grader_revision='canonical-exact-v1' WHERE question_id='historical'`,
		`UPDATE question_attempts SET submitted_response='null',grader_revision='canonical-exact-v1' WHERE question_id='historical'`,
		`UPDATE question_attempts SET submitted_response='{"kind":"text","value":"5"}',grader_revision='canonical-exact-v1' WHERE question_id='historical'`,
	} {
		if _, err := pool.Exec(ctx, sql); err == nil {
			t.Fatalf("partial or unversioned evidence accepted: %s", sql)
		}
	}
	apply("down")
	apply("up")
}
