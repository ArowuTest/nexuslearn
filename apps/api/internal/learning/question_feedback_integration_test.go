package learning

import (
	"context"
	"encoding/json"
	"reflect"
	"strings"
	"testing"
)

func TestPostgresRepairFeedbackFitsCanonicalTask(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx := context.Background()
	// Reward text must not replace the learning guidance with a generic claim.
	if _, err := pool.Exec(ctx, `DELETE FROM reward_rules;
 INSERT INTO reward_rules(id,trigger,reward_payload,enabled) VALUES ('feedback-reward','attempt.incorrect','{"feedback":"Almost! Go faster!","explanation":"A mistake proves a misconception.","companion_prompt":"Build an array.","animation_hook":"quiet-progress","reward_hook":"world-growth"}',true)`); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct{ id, subject, format, expected, kind, value, want string }{
		{"words", "English", "word-build", `{"value":"cat"}`, "text", `"dog"`, "sounds"},
		{"reading", "English", "evidence-link", `{"value":"the moon"}`, "text", `"the sun"`, "text"},
		{"coordinates", "Mathematics", "coordinate-plot", `{"value":[1,2]}`, "sequence", `[2,1]`, "horizontal"},
		{"experiment", "Science", "fair-test-plan", `{"change":"area","measure":"time","keep_same":["mass"]}`, "mapping", `{"change":"time","measure":"area","keep_same":["mass"]}`, "measure"},
		{"fallback", "Science", "text-choice", `{"value":"solid"}`, "text", `"gas"`, "question"},
	} {
		t.Run(tc.id, func(t *testing.T) {
			if _, err := pool.Exec(ctx, `INSERT INTO students(external_ref,display_name,year_group) VALUES ($1,'Test',3);
`, tc.id); err != nil {
				t.Fatal(err)
			}
			if _, err := pool.Exec(ctx, `INSERT INTO curriculum_objectives(id,year_group,subject,strand,topic,statement) VALUES ($1,3,$2,'Test','Test','Test')`, tc.id, tc.subject); err != nil {
				t.Fatal(err)
			}
			if _, err := pool.Exec(ctx, `INSERT INTO questions(id,objective_id,format,body,expected_answer,status) VALUES ($1,$1,$2,'{"prompt":"Test question"}',$3::jsonb,'approved')`, tc.id, tc.format, tc.expected); err != nil {
				t.Fatal(err)
			}
			qs, err := repo.ListQuestionsForActivity(ctx, "", tc.id, 1)
			if err != nil || len(qs) != 1 {
				t.Fatalf("questions=%v %v", qs, err)
			}
			a := Attempt{StudentID: tc.id, ObjectiveID: tc.id, QuestionID: tc.id, QuestionVersion: qs[0].QuestionVersion, IdempotencyKey: tc.id, Response: &AnswerResponse{Kind: tc.kind, Value: json.RawMessage(tc.value)}}
			result, err := repo.RecordAttempt(ctx, a)
			if err != nil {
				t.Fatal(err)
			}
			if result.Correct || !strings.Contains(result.Feedback, tc.want) {
				t.Fatalf("missing task guidance: %+v", result)
			}
			for _, forbidden := range []string{"Almost", "faster", "misconception", "array", "timed practice"} {
				if strings.Contains(result.Feedback+result.Explanation+result.CompanionPrompt, forbidden) {
					t.Fatalf("inappropriate feedback %q: %+v", forbidden, result)
				}
			}
			if result.AnimationHook != "quiet-progress" || result.RewardHook != "world-growth" {
				t.Fatalf("lost configured game presentation: %+v", result)
			}
			items, err := repo.AdultAttemptEvidence(ctx, tc.id, 10)
			if err != nil || len(items) != 1 || items[0].Explanation != result.Explanation {
				t.Fatalf("adult evidence differs from saved guidance: %+v %v", items, err)
			}
			if _, err := pool.Exec(ctx, `UPDATE questions SET status='draft',format='number-input' WHERE id=$1`, tc.id); err != nil {
				t.Fatal(err)
			}
			replayed, err := repo.RecordAttempt(ctx, a)
			if err != nil || !reflect.DeepEqual(replayed, result) {
				t.Fatalf("replay replaced saved guidance: %+v %v", replayed, err)
			}
		})
	}
}
