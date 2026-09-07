package learning

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestPostgresMarkingPolicySnapshotsReplayAndInvalidRollback(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `INSERT INTO students(external_ref,display_name,year_group) VALUES ('policy-child','Test',4);
 INSERT INTO curriculum_objectives(id,year_group,subject,strand,topic,statement) VALUES ('policy-o',4,'English','Reading','Inference','Find evidence');
 INSERT INTO questions(id,objective_id,format,body,expected_answer,status) VALUES ('policy-q','policy-o','clue-highlight','{"prompt":"Find the evidence."}','{"value":"stopped, and read the sign again","marking_policy":{"version":1,"mode":"exact","accepted_values":["stopped"]}}','approved')`); err != nil {
		t.Fatal(err)
	}
	qs, err := repo.ListQuestionsForActivity(ctx, "", "policy-o", 1)
	if err != nil || len(qs) != 1 {
		t.Fatalf("questions=%v %v", qs, err)
	}
	a := Attempt{StudentID: "policy-child", ObjectiveID: "policy-o", QuestionID: "policy-q", QuestionVersion: qs[0].QuestionVersion, IdempotencyKey: "policy-answer", Response: &AnswerResponse{Kind: "text", Value: json.RawMessage(`"stopped"`)}}
	result, err := repo.RecordAttempt(ctx, a)
	if err != nil || !result.Correct {
		t.Fatalf("alternative=%+v %v", result, err)
	}
	var snapshot []byte
	if err := pool.QueryRow(ctx, `SELECT snapshot FROM question_grading_versions WHERE version=$1`, a.QuestionVersion).Scan(&snapshot); err != nil {
		t.Fatal(err)
	}
	var frozen QuestionConfig
	if err := json.Unmarshal(snapshot, &frozen); err != nil {
		t.Fatal(err)
	}
	if _, got, err := gradeCanonicalAttempt(a, frozen); err != nil || !got.Correct {
		t.Fatalf("snapshot lost policy: %+v %v", got, err)
	}
	if _, err := pool.Exec(ctx, `UPDATE questions SET expected_answer='{"value":"cat","marking_policy":{"version":99,"mode":"exact"}}' WHERE id='policy-q'`); err != nil {
		t.Fatal(err)
	}
	replay, err := repo.RecordAttempt(ctx, a)
	if err != nil || !reflect.DeepEqual(result, replay) {
		t.Fatalf("policy edit changed saved retry: %+v %v", replay, err)
	}
	stale := a
	stale.IdempotencyKey = "stale"
	if _, err := repo.RecordAttempt(ctx, stale); !errors.Is(err, ErrQuestionVersion) {
		t.Fatalf("stale policy accepted: %v", err)
	}
	qs, err = repo.ListQuestionsForActivity(ctx, "", "policy-o", 1)
	if err != nil || len(qs) != 1 || qs[0].ResponseKind != "review" {
		t.Fatalf("invalid policy offered: %+v %v", qs, err)
	}
	invalid := a
	invalid.IdempotencyKey = "invalid"
	invalid.QuestionVersion = qs[0].QuestionVersion
	if _, err := repo.RecordAttempt(ctx, invalid); !errors.Is(err, ErrQuestionNeedsReview) {
		t.Fatalf("invalid policy marked: %v", err)
	}
	var attempts, requests int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM question_attempts WHERE question_id='policy-q'`).Scan(&attempts); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM request_idempotency WHERE request_key IN ('stale','invalid')`).Scan(&requests); err != nil {
		t.Fatal(err)
	}
	if attempts != 1 || requests != 0 {
		t.Fatalf("invalid policies left writes: %d %d", attempts, requests)
	}
}

func TestAuthoredCataloguePolicyInventory(t *testing.T) {
	files, err := filepath.Glob(filepath.Join("..", "..", "..", "..", "packages", "content", "packs", "*.json"))
	if err != nil || len(files) == 0 {
		t.Fatalf("catalogue missing: %v", err)
	}
	variants, policies, spans, oral, units := 0, 0, 0, 0, 0
	for _, file := range files {
		data, err := os.ReadFile(file)
		if err != nil {
			t.Fatal(err)
		}
		var pack struct {
			QuestionVariants []QuestionConfig `json:"question_variants"`
		}
		if err := json.Unmarshal(data, &pack); err != nil {
			t.Fatal(err)
		}
		for _, q := range pack.QuestionVariants {
			variants++
			if _, ok := q.ExpectedAnswer["marking_policy"]; ok {
				policies++
				kind, _, err := canonicalBaseAnswer(q)
				if err == nil {
					if _, err := questionMarkingPolicy(q, kind); err != nil {
						t.Fatalf("invalid authored policy %s: %v", q.ID, err)
					}
				}
			}
			if _, ok := q.ExpectedAnswer["acceptable_spoken_without_punctuation"]; ok {
				oral++
			}
			if _, ok := q.ExpectedAnswer["unit"]; ok {
				units++
			}
			if values, ok := q.ExpectedAnswer["accepted_spans"].([]any); ok {
				spans++
				for _, value := range values {
					raw, _ := json.Marshal(value)
					_, got, err := gradeCanonicalAttempt(Attempt{QuestionID: q.ID, QuestionVersion: questionContractVersion(q), Response: &AnswerResponse{Kind: "text", Value: raw}}, q)
					if err != nil || !got.Correct {
						t.Fatalf("authored span rejected %s: %+v %v", q.ID, got, err)
					}
				}
			}
		}
	}
	t.Logf("packs=%d variants=%d explicit_policies=%d accepted_span_questions=%d spoken_punctuation_annotations=%d unit_annotations=%d; inventory is not approval", len(files), variants, policies, spans, oral, units)
}

func TestPostgresNumericPolicyPrecisionAndFrozenIdentity(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `INSERT INTO students(external_ref,display_name,year_group) VALUES ('decimal-policy-child','Test',4);
 INSERT INTO curriculum_objectives(id,year_group,subject,strand,topic,statement) VALUES ('decimal-policy-o',4,'Mathematics','Number','Decimals','Compare decimals');
 INSERT INTO questions(id,objective_id,format,body,expected_answer,status) VALUES ('decimal-policy-q','decimal-policy-o','number-input','{"prompt":"Enter a value close to 0.3."}','{"value":0.3,"marking_policy":{"version":1,"mode":"numeric","absolute_tolerance":0.099999999999999999}}','approved')`); err != nil {
		t.Fatal(err)
	}
	qs, err := repo.ListQuestionsForActivity(ctx, "", "decimal-policy-o", 1)
	if err != nil || len(qs) != 1 {
		t.Fatalf("questions=%v %v", qs, err)
	}
	a := Attempt{StudentID: "decimal-policy-child", ObjectiveID: "decimal-policy-o", QuestionID: "decimal-policy-q", QuestionVersion: qs[0].QuestionVersion, IdempotencyKey: "decimal-policy-answer", Response: &AnswerResponse{Kind: "number", Value: json.RawMessage(`0.4`)}}
	result, err := repo.RecordAttempt(ctx, a)
	if err != nil || result.Correct {
		t.Fatalf("authored tolerance rounded during DB read: %+v %v", result, err)
	}
	var snapshot []byte
	if err := pool.QueryRow(ctx, `SELECT snapshot FROM question_grading_versions WHERE version=$1`, a.QuestionVersion).Scan(&snapshot); err != nil {
		t.Fatal(err)
	}
	var frozen QuestionConfig
	if err := json.Unmarshal(snapshot, &frozen); err != nil {
		t.Fatal(err)
	}
	if _, got, err := gradeCanonicalAttempt(a, frozen); err != nil || got.Correct {
		t.Fatalf("snapshot changed precision/identity: %+v %v", got, err)
	}
	if _, err := pool.Exec(ctx, `UPDATE questions SET expected_answer=jsonb_set(expected_answer,'{marking_policy,absolute_tolerance}','0.1') WHERE id='decimal-policy-q'`); err != nil {
		t.Fatal(err)
	}
	replay, err := repo.RecordAttempt(ctx, a)
	if err != nil || !reflect.DeepEqual(result, replay) {
		t.Fatalf("tolerance edit changed completed result: %+v %v", replay, err)
	}
	qs, err = repo.ListQuestionsForActivity(ctx, "", "decimal-policy-o", 1)
	if err != nil || len(qs) != 1 || qs[0].QuestionVersion == a.QuestionVersion {
		t.Fatalf("tolerance precision absent from hash: %+v %v", qs, err)
	}
	a.QuestionVersion = qs[0].QuestionVersion
	a.IdempotencyKey = "new-tolerance-answer"
	if result, err = repo.RecordAttempt(ctx, a); err != nil || !result.Correct {
		t.Fatalf("new inclusive tolerance rejected: %+v %v", result, err)
	}
}
