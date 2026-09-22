package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

func TestPostgresParentNextActivityDoesNotInventDueRetrieval(t *testing.T) {
	srv, repo, pool := parentChildSecurityServer(t)
	parent, token := parentChildSecuritySession(t, srv, repo, "retrieval-parent")
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `
		INSERT INTO content_releases(id,schema_version,channel,manifest_sha256,expected_pack_count,expected_objective_count,expected_activity_count,expected_question_count,expected_reward_rule_count,status,applied_at)
		 VALUES ('synthetic-retrieval','test','live','synthetic',1,2,2,2,0,'applied',now());
		INSERT INTO students(external_ref,display_name,year_group) VALUES ('retrieval-child','Synthetic new learner',1),('other-child','Other learner',2);
		INSERT INTO curriculum_objectives(id,year_group,subject,strand,topic,statement,content_release_id) VALUES
		 ('retrieval-y1',1,'Mathematics','Number','Counting','Count to five','synthetic-retrieval'),
		 ('retrieval-y2',2,'Mathematics','Number','Counting','Count to ten','synthetic-retrieval');
		INSERT INTO activities(id,objective_id,title,status,content_release_id) VALUES
		 ('activity-y1','retrieval-y1','Count to five','published','synthetic-retrieval'), ('activity-y2','retrieval-y2','Count to ten','published','synthetic-retrieval');
		INSERT INTO questions(id,activity_id,objective_id,format,body,expected_answer,status,difficulty,content_release_id) VALUES
		 ('question-y1','activity-y1','retrieval-y1','number-input','{"prompt":"What is 2 + 3?"}','{"value":5}','published',2,'synthetic-retrieval'),
		 ('question-y2','activity-y2','retrieval-y2','number-input','{"prompt":"What is 4 + 6?"}','{"value":10}','published',1,'synthetic-retrieval');
		INSERT INTO spaced_review_queue(student_id,objective_id,due_at,interval_days,reason)
		 SELECT id,'retrieval-y2',now()-interval '1 day',7,'Other learner review' FROM students WHERE external_ref='other-child';
	`); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.UpsertParentLink(ctx, learning.ParentLinkConfig{ParentEmail: parent.Email, StudentExternalRef: "retrieval-child", Relationship: "parent", Status: "active"}); err != nil {
		t.Fatal(err)
	}
	assertEvidence := func(t *testing.T, activity, mode string, review bool, attempts, warmUps int) {
		t.Helper()
		items, err := repo.WarmUpItems(ctx, "retrieval-child", 3)
		if err != nil || len(items) != warmUps {
			t.Errorf("warm-ups=%+v err=%v, want %d owned due reviews", items, err, warmUps)
		}
		request := httptest.NewRequest(http.MethodGet, "/v1/parent/children/retrieval-child/evidence", nil)
		request.Header.Set("Authorization", "Bearer "+token)
		response := httptest.NewRecorder()
		srv.ServeHTTP(response, request)
		if response.Code != http.StatusOK {
			t.Fatalf("parent evidence status=%d body=%s", response.Code, response.Body.String())
		}
		var body struct {
			Attempts []learning.RecentAttempt      `json:"attempts"`
			Summary  learning.EvidenceSummary      `json:"summary"`
			Next     learning.NextActivityDecision `json:"next_activity"`
		}
		if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		if len(body.Attempts) != attempts || body.Summary.Attempts7Days != attempts {
			t.Fatalf("unexpected attempt evidence: %+v", body)
		}
		if body.Next.ActivityID != activity || body.Next.AssessmentMode != mode || body.Next.Review != review {
			t.Fatalf("next_activity must reflect real learner review state: %+v", body.Next)
		}
		if strings.Contains(body.Next.Explanation, "due for spaced retrieval") != review {
			t.Fatalf("retrieval explanation disagrees with actual due state: %+v", body.Next)
		}
	}

	t.Run("new Year 1 learner has no review or borrowed evidence", func(t *testing.T) {
		assertEvidence(t, "activity-y1", "practice", false, 0, 0)
	})
	questions, err := repo.(adaptiveCatalogueRepository).ListQuestionsForActivity(ctx, "activity-y1", "retrieval-y1", 1)
	if err != nil || len(questions) != 1 {
		t.Fatalf("question lookup=%+v err=%v", questions, err)
	}
	result, err := repo.RecordAttempt(ctx, learning.Attempt{
		StudentID: "retrieval-child", ObjectiveID: "retrieval-y1", QuestionID: "question-y1",
		QuestionVersion: questions[0].QuestionVersion, IdempotencyKey: "retrieval-first-attempt",
		Response: &learning.AnswerResponse{Kind: "number", Value: json.RawMessage(`5`)},
	})
	if err != nil || !result.Correct || result.NextReviewDays <= 0 {
		t.Fatalf("real attempt did not schedule a later review: %+v err=%v", result, err)
	}
	t.Run("first attempt does not make future review due", func(t *testing.T) {
		assertEvidence(t, "activity-y1", "practice", false, 1, 0)
	})
	if _, err := pool.Exec(ctx, `UPDATE students SET year_group=2 WHERE external_ref='retrieval-child'`); err != nil {
		t.Fatal(err)
	}
	t.Run("future earlier-year review does not starve new year learning", func(t *testing.T) {
		assertEvidence(t, "activity-y2", "practice", false, 1, 0)
	})
	// Advance only this synthetic learner's scheduled review to model elapsed time.
	if _, err := pool.Exec(ctx, `UPDATE spaced_review_queue SET due_at=now()-interval '1 second' WHERE student_id=(SELECT id FROM students WHERE external_ref='retrieval-child') AND completed_at IS NULL`); err != nil {
		t.Fatal(err)
	}
	t.Run("genuinely due earlier-year review retains priority", func(t *testing.T) {
		assertEvidence(t, "activity-y1", "review", true, 1, 1)
	})
	if _, err := srv.createDiagnosticBaseline(ctx, "retrieval-child", 2, 3, "retrieval-baseline"); err != nil {
		t.Fatal(err)
	}
	t.Run("active diagnostic retains precedence", func(t *testing.T) {
		assertEvidence(t, "activity-y2", "diagnostic", false, 1, 1)
	})
}
