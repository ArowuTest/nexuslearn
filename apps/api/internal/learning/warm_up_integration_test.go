package learning

import (
	"context"
	"reflect"
	"testing"
	"time"
)

func TestPostgresWarmUpItemsOnlyDueOwnedPendingReviews(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `
		INSERT INTO students(external_ref,display_name,year_group) VALUES
		 ('new-year-one','New learner',1), ('review-owner','Review learner',3),
		 ('future-only','Future learner',3), ('completed-only','Completed learner',3);
		INSERT INTO curriculum_objectives(id,year_group,subject,strand,topic,statement) VALUES
		 ('earlier-year',2,'English','Reading','Words','Read familiar words');
		INSERT INTO activities(id,objective_id,title,status) VALUES
		 ('earlier-activity','earlier-year','Read familiar words','published');
		INSERT INTO questions(id,activity_id,objective_id,format,body,expected_answer,status) VALUES
		 ('earlier-question','earlier-activity','earlier-year','short-answer','{"prompt":"Read cat"}','{"value":"cat"}','published');
		INSERT INTO spaced_review_queue(student_id,objective_id,due_at,interval_days,priority,reason,completed_at)
		 SELECT id,'earlier-year',now() + CASE WHEN external_ref='future-only' THEN interval '1 day' ELSE interval '-1 day' END,
		        7,70,'Review after earlier learning',CASE WHEN external_ref='completed-only' THEN now() ELSE NULL END
		 FROM students WHERE external_ref IN ('review-owner','future-only','completed-only');
	`); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		student string
		want    []string
	}{
		{"new-year-one", []string{}},
		{"future-only", []string{}},
		{"completed-only", []string{}},
		{"unknown-learner", []string{}},
		{"Review-owner", []string{}},
		{"", []string{}},
		{"review-owner", []string{"earlier-year"}},
	} {
		t.Run(tc.student, func(t *testing.T) {
			items, err := repo.WarmUpItems(ctx, tc.student, 10)
			if err != nil {
				t.Fatal(err)
			}
			ids := make([]string, 0, len(items))
			for _, item := range items {
				ids = append(ids, item.ObjectiveID)
				due, err := time.Parse(time.RFC3339, item.DueAt)
				if err != nil || due.IsZero() || due.After(time.Now()) {
					t.Errorf("warm-up must have a real due timestamp: %+v", item)
				}
			}
			if !reflect.DeepEqual(ids, tc.want) {
				t.Fatalf("learner %q warm-ups=%v, want only owned due pending reviews %v", tc.student, ids, tc.want)
			}
			if items == nil {
				t.Fatal("empty warm-up must be an empty list, not null")
			}
		})
	}
}

// All release states below are synthetic fixtures in a disposable schema, not
// approvals or evidence for any real curriculum/audio release.
func TestPostgresWarmUpItemsRequireCurrentRuntimeContent(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `
		INSERT INTO content_releases(id,schema_version,channel,manifest_sha256,
		 expected_pack_count,expected_objective_count,expected_activity_count,expected_question_count,expected_reward_rule_count,status,applied_at)
		VALUES
		 ('z-old','test','live','old',1,1,1,1,0,'applied',now()-interval '2 days'),
		 ('a-current','test','live','current',1,1,1,1,0,'applied',now()-interval '1 day'),
		 ('later-staged','test','live','staged',1,1,1,1,0,'staged',now()),
		 ('later-pilot','test','pilot','pilot',1,1,1,1,0,'applied',now());
	`); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name             string
		objectiveRelease string
		activityRelease  string
		questionRelease  string
		activityStatus   string
		questionStatus   string
		objectiveOnly    bool
		otherActivity    bool
		want             bool
	}{
		{name: "current published", objectiveRelease: "a-current", activityRelease: "a-current", questionRelease: "a-current", activityStatus: "published", questionStatus: "published", want: true},
		{name: "approved objective question", objectiveRelease: "a-current", activityRelease: "a-current", questionRelease: "a-current", activityStatus: "approved", questionStatus: "approved", objectiveOnly: true, want: true},
		{name: "live", objectiveRelease: "a-current", activityRelease: "a-current", questionRelease: "a-current", activityStatus: "live", questionStatus: "live", want: true},
		{name: "old objective", objectiveRelease: "z-old", activityRelease: "a-current", questionRelease: "a-current", activityStatus: "published", questionStatus: "published"},
		{name: "unversioned objective", activityRelease: "a-current", questionRelease: "a-current", activityStatus: "published", questionStatus: "published"},
		{name: "old activity", objectiveRelease: "a-current", activityRelease: "z-old", questionRelease: "a-current", activityStatus: "published", questionStatus: "published"},
		{name: "unversioned activity", objectiveRelease: "a-current", questionRelease: "a-current", activityStatus: "published", questionStatus: "published"},
		{name: "staged activity", objectiveRelease: "a-current", activityRelease: "later-staged", questionRelease: "a-current", activityStatus: "published", questionStatus: "published"},
		{name: "pilot activity", objectiveRelease: "a-current", activityRelease: "later-pilot", questionRelease: "a-current", activityStatus: "published", questionStatus: "published"},
		{name: "draft activity", objectiveRelease: "a-current", activityRelease: "a-current", questionRelease: "a-current", activityStatus: "draft", questionStatus: "published"},
		{name: "archived activity", objectiveRelease: "a-current", activityRelease: "a-current", questionRelease: "a-current", activityStatus: "archived", questionStatus: "published"},
		{name: "missing activity", objectiveRelease: "a-current"},
		{name: "old question", objectiveRelease: "a-current", activityRelease: "a-current", questionRelease: "z-old", activityStatus: "published", questionStatus: "published"},
		{name: "unversioned question", objectiveRelease: "a-current", activityRelease: "a-current", activityStatus: "published", questionStatus: "published"},
		{name: "draft question", objectiveRelease: "a-current", activityRelease: "a-current", questionRelease: "a-current", activityStatus: "published", questionStatus: "draft"},
		{name: "archived question", objectiveRelease: "a-current", activityRelease: "a-current", questionRelease: "a-current", activityStatus: "published", questionStatus: "archived"},
		{name: "missing question", objectiveRelease: "a-current", activityRelease: "a-current", activityStatus: "published"},
		{name: "question on unavailable sibling", objectiveRelease: "a-current", activityRelease: "a-current", questionRelease: "a-current", activityStatus: "published", questionStatus: "published", otherActivity: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var studentID string
			if err := pool.QueryRow(ctx, `INSERT INTO students(external_ref,display_name,year_group) VALUES($1,'Synthetic learner',3) RETURNING id::text`, tc.name).Scan(&studentID); err != nil {
				t.Fatal(err)
			}
			if _, err := pool.Exec(ctx, `INSERT INTO curriculum_objectives(id,year_group,subject,strand,topic,statement,content_release_id) VALUES($1,2,'English','Reading','Words','Read familiar words',NULLIF($2,''))`, tc.name, tc.objectiveRelease); err != nil {
				t.Fatal(err)
			}
			if tc.activityStatus != "" {
				if _, err := pool.Exec(ctx, `INSERT INTO activities(id,objective_id,title,status,content_release_id) VALUES($1,$1,'Synthetic activity',$2,NULLIF($3,''))`, tc.name, tc.activityStatus, tc.activityRelease); err != nil {
					t.Fatal(err)
				}
			}
			if tc.questionStatus != "" {
				activityID := tc.name
				if tc.objectiveOnly {
					activityID = ""
				}
				if tc.otherActivity {
					activityID = tc.name + "-sibling"
					if _, err := pool.Exec(ctx, `INSERT INTO activities(id,objective_id,title,status,content_release_id) VALUES($1,$2,'Unavailable sibling','archived','a-current')`, activityID, tc.name); err != nil {
						t.Fatal(err)
					}
				}
				if _, err := pool.Exec(ctx, `INSERT INTO questions(id,activity_id,objective_id,format,status,content_release_id) VALUES($1,NULLIF($2,''),$1,'short-answer',$3,NULLIF($4,''))`, tc.name, activityID, tc.questionStatus, tc.questionRelease); err != nil {
					t.Fatal(err)
				}
			}
			if _, err := pool.Exec(ctx, `INSERT INTO spaced_review_queue(student_id,objective_id,due_at,interval_days,reason) VALUES($1,$2,now(),7,'Synthetic due review')`, studentID, tc.name); err != nil {
				t.Fatal(err)
			}
			items, err := repo.WarmUpItems(ctx, tc.name, 3)
			if err != nil {
				t.Fatal(err)
			}
			if tc.want {
				if len(items) != 1 || items[0].ObjectiveID != tc.name || items[0].DueAt == "" {
					t.Fatalf("current runtime earlier-year review missing: %+v", items)
				}
			} else if len(items) != 0 {
				t.Fatalf("unavailable or non-current content returned as due review: %+v", items)
			}
		})
	}
}

func TestPostgresWarmUpItemsOrderAndBoundEligibleReviews(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `
		INSERT INTO students(external_ref,display_name,year_group) VALUES ('ordered','Synthetic learner',3);
		INSERT INTO curriculum_objectives(id,year_group,subject,strand,topic,statement)
		 SELECT id,2,'Mathematics','Number','Counting',id FROM unnest(ARRAY['tie-z','tie-a','urgent','older','future','unavailable']) AS id;
		INSERT INTO activities(id,objective_id,title,status)
		 SELECT id,id,id,CASE WHEN id='unavailable' THEN 'archived' ELSE 'published' END FROM curriculum_objectives
		 WHERE id IN ('tie-z','tie-a','urgent','older','future','unavailable');
		INSERT INTO questions(id,activity_id,objective_id,format,status)
		 SELECT id,id,id,'number-input','published' FROM curriculum_objectives
		 WHERE id IN ('tie-z','tie-a','urgent','older','future','unavailable');
		INSERT INTO spaced_review_queue(student_id,objective_id,due_at,interval_days,priority,reason)
		 SELECT s.id,o.id,
		        now() + CASE o.id WHEN 'future' THEN interval '1 hour' WHEN 'older' THEN interval '-2 days' ELSE interval '-1 day' END,
		        7,CASE o.id WHEN 'unavailable' THEN 100 WHEN 'future' THEN 100 WHEN 'urgent' THEN 90 ELSE 70 END,'Synthetic review'
		 FROM students s CROSS JOIN curriculum_objectives o WHERE s.external_ref='ordered'
		 AND o.id IN ('tie-z','tie-a','urgent','older','future','unavailable');
	`); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		limit int
		want  []string
	}{
		{1, []string{"urgent"}},
		{2, []string{"urgent", "older"}},
		{3, []string{"urgent", "older", "tie-a"}},
		{10, []string{"urgent", "older", "tie-a", "tie-z"}},
		{0, []string{"urgent", "older", "tie-a"}},
		{-1, []string{"urgent", "older", "tie-a"}},
		{11, []string{"urgent", "older", "tie-a"}},
	} {
		for repeat := 0; repeat < 3; repeat++ {
			items, err := repo.WarmUpItems(ctx, "ordered", tc.limit)
			if err != nil {
				t.Fatal(err)
			}
			ids := make([]string, 0, len(items))
			for _, item := range items {
				ids = append(ids, item.ObjectiveID)
			}
			if !reflect.DeepEqual(ids, tc.want) {
				t.Fatalf("limit=%d run=%d: got %v, want %v", tc.limit, repeat, ids, tc.want)
			}
		}
	}
}
