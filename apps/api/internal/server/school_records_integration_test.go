package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/learning"
)

func TestSchoolRecordReadsHTTPPostgres(t *testing.T) {
	srv, repo, pool := parentChildSecurityServer(t)
	ctx := context.Background()
	for _, urn := range []string{"records-school-a", "records-school-b"} {
		if _, err := repo.UpsertSchool(ctx, learning.SchoolConfig{URN: urn, Name: urn, Status: "active"}); err != nil {
			t.Fatal(err)
		}
	}
	for _, sql := range []string{
		`INSERT INTO students(external_ref,display_name,year_group) VALUES ('records-child-a','Child A',3),('records-child-b','Child B',3),('records-child-c','Child C',3)`,
		`INSERT INTO curriculum_objectives(id,year_group,subject,strand,topic,statement) VALUES ('records-objective',3,'Mathematics','Number','Fractions','Recognise fractions')`,
	} {
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	seedRecords := func(urn, ref string, count int) {
		t.Helper()
		for _, sql := range []string{
			`INSERT INTO assignments(school_id,student_id,objective_id,title)
			 SELECT sch.id,st.id,'records-objective','Saved assignment' FROM schools sch CROSS JOIN students st CROSS JOIN generate_series(1,$3::int)
			 WHERE sch.urn=$1 AND st.external_ref=$2`,
			`INSERT INTO teacher_evidence_records(school_id,student_id,objective_id,evidence_type,outcome,note)
			 SELECT sch.id,st.id,'records-objective','observation','developing','Saved observation' FROM schools sch CROSS JOIN students st CROSS JOIN generate_series(1,$3::int)
			 WHERE sch.urn=$1 AND st.external_ref=$2`,
			`WITH plans AS (
			 INSERT INTO intervention_plans(school_id,student_id,objective_id,title,need,strategy)
			 SELECT sch.id,st.id,'records-objective','Saved intervention','Practise fractions','Use fraction wall' FROM schools sch CROSS JOIN students st CROSS JOIN generate_series(1,$3::int)
			 WHERE sch.urn=$1 AND st.external_ref=$2 RETURNING id,school_id,student_id,objective_id)
			 INSERT INTO intervention_reviews(intervention_id,school_id,student_id,objective_id,outcome,evidence_note)
			 SELECT id,school_id,student_id,objective_id,'continue','Saved reassessment' FROM plans`,
		} {
			if _, err := pool.Exec(ctx, sql, urn, ref, count); err != nil {
				t.Fatal(err)
			}
		}
	}
	seedRecords("records-school-a", "records-child-a", 1)
	seedRecords("records-school-a", "records-child-b", 1)
	seedRecords("records-school-b", "records-child-c", 1)
	// A pupil's historical records in another school must still be excluded.
	seedRecords("records-school-b", "records-child-a", 1)
	newSession := func(urn, role string) (string, string) {
		t.Helper()
		user, err := repo.UpsertSchoolUser(ctx, learning.SchoolUserConfig{SchoolURN: urn, Email: role + "-" + urn + "@example.test", LoginID: role + "-" + urn, DisplayName: "School user", Role: role, Status: "active", TemporaryPassword: "test-only-password"})
		if err != nil {
			t.Fatal(err)
		}
		session, err := srv.createAccountSession(ctx, user.ID, user.LoginID, role, urn, time.Hour)
		if err != nil {
			t.Fatal(err)
		}
		return session.Token, user.ID
	}
	teacher, teacherID := newSession("records-school-a", "teacher")
	admin, _ := newSession("records-school-a", "school_admin")
	foreign, _ := newSession("records-school-b", "teacher")
	request := func(t *testing.T, token, target string, want int) *httptest.ResponseRecorder {
		t.Helper()
		res := schoolAccessRequest(srv, token, target)
		if res.Code != want {
			t.Errorf("%s: status=%d want=%d body=%s", target, res.Code, want, res.Body.String())
		}
		cache := res.Header().Get("Cache-Control")
		if !strings.Contains(cache, "private") || !strings.Contains(cache, "no-store") {
			t.Errorf("%s: private response is cacheable: %q", target, cache)
		}
		return res
	}
	read := func(t *testing.T, token, path, key, query, urn string, want map[string]int) {
		t.Helper()
		res := request(t, token, path+query, http.StatusOK)
		var body map[string][]struct {
			ID  string `json:"id"`
			URN string `json:"school_urn"`
			Ref string `json:"student_external_ref"`
		}
		if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil || len(body) != 1 || body[key] == nil {
			t.Fatalf("invalid saved-list contract: %s err=%v", res.Body.String(), err)
		}
		got := map[string]int{}
		ids := map[string]bool{}
		for _, item := range body[key] {
			if item.URN != urn || item.ID == "" || ids[item.ID] {
				t.Errorf("foreign, missing or duplicate record: %+v", item)
			}
			ids[item.ID] = true
			got[item.Ref]++
		}
		if !reflect.DeepEqual(got, want) {
			t.Errorf("%s%s: pupil counts=%v want=%v", path, query, got, want)
		}
	}
	const snapshotSQL = `SELECT jsonb_build_object(
	 'assignments',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM assignments a),
	 'evidence',(SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM teacher_evidence_records e),
	 'plans',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM intervention_plans p),
	 'reviews',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM intervention_reviews r),
	 'audit',(SELECT count(*) FROM audit_logs))::text`
	var before string
	if err := pool.QueryRow(ctx, snapshotSQL).Scan(&before); err != nil {
		t.Fatal(err)
	}
	for _, route := range schoolRecordRoutes {
		t.Run(route.key+"/isolation", func(t *testing.T) {
			for _, token := range []string{teacher, admin} {
				for _, tc := range []struct {
					query string
					want  map[string]int
				}{
					{"", map[string]int{"records-child-a": 1, "records-child-b": 1}},
					{"?school_urn=records-school-b", map[string]int{"records-child-a": 1, "records-child-b": 1}},
					{"?studentId=records-child-a&school_urn=records-school-b", map[string]int{"records-child-a": 1}},
					{"?studentId=records-child-b", map[string]int{"records-child-b": 1}},
					{"?studentId=%20records-child-a%20", map[string]int{"records-child-a": 1}},
					{"?studentId=records-child-c", map[string]int{}},
					{"?studentId=unknown-child", map[string]int{}},
				} {
					read(t, token, route.path, route.key, tc.query, "records-school-a", tc.want)
				}
			}
			read(t, foreign, route.path, route.key, "", "records-school-b", map[string]int{"records-child-a": 1, "records-child-c": 1})
			read(t, foreign, route.path, route.key, "?studentId=records-child-b&school_urn=records-school-a", "records-school-b", map[string]int{})
		})
		t.Run(route.key+"/invalid-scope", func(t *testing.T) {
			for _, query := range []string{"?studentId=", "?studentId=%20", "?studentId=&studentId=records-child-a", "?studentId=records-child-a&studentId=records-child-b", "?studentId=%ZZ", "?studentId=records-child-a;bad=value"} {
				res := request(t, teacher, route.path+query, http.StatusBadRequest)
				if strings.Contains(res.Body.String(), "student_external_ref") {
					t.Error("invalid scope disclosed saved records")
				}
			}
		})
	}
	for _, change := range []struct{ name, deny, restore string }{
		{"role changed", `UPDATE school_users SET role='school_admin' WHERE user_id=$1`, `UPDATE school_users SET role='teacher' WHERE user_id=$1`},
		{"user paused", `UPDATE app_users SET status='paused' WHERE id=$1`, `UPDATE app_users SET status='active' WHERE id=$1`},
		{"school paused", `UPDATE schools SET status='paused' WHERE id=(SELECT school_id FROM school_users WHERE user_id=$1)`, `UPDATE schools SET status='active' WHERE id=(SELECT school_id FROM school_users WHERE user_id=$1)`},
		{"membership moved", `UPDATE school_users SET school_id=(SELECT id FROM schools WHERE urn='records-school-b') WHERE user_id=$1`, `UPDATE school_users SET school_id=(SELECT id FROM schools WHERE urn='records-school-a') WHERE user_id=$1`},
		{"membership deleted", `DELETE FROM school_users WHERE user_id=$1`, `INSERT INTO school_users(school_id,user_id,role) SELECT id,$1,'teacher' FROM schools WHERE urn='records-school-a'`},
	} {
		t.Run(change.name, func(t *testing.T) {
			if _, err := pool.Exec(ctx, change.deny, teacherID); err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() {
				if _, err := pool.Exec(ctx, change.restore, teacherID); err != nil {
					t.Error(err)
				}
			})
			for _, route := range schoolRecordRoutes {
				for _, query := range []string{"", "?studentId=records-child-a"} {
					res := request(t, teacher, route.path+query, http.StatusUnauthorized)
					if strings.Contains(res.Body.String(), "student_external_ref") {
						t.Error("revoked membership disclosed saved records")
					}
				}
			}
		})
	}
	var after string
	if err := pool.QueryRow(ctx, snapshotSQL).Scan(&after); err != nil || before != after {
		t.Fatalf("record GETs mutated saved records or audit: %v", err)
	}
	seedRecords("records-school-a", "records-child-a", 501)
	for _, route := range schoolRecordRoutes {
		t.Run(route.key+"/bounded-before-response", func(t *testing.T) {
			read(t, teacher, route.path, route.key, "?studentId=records-child-a", "records-school-a", map[string]int{"records-child-a": route.cap})
			// Filtering must happen before the cap: another pupil's newer records
			// cannot crowd this pupil out of their saved list.
			read(t, teacher, route.path, route.key, "?studentId=records-child-b", "records-school-a", map[string]int{"records-child-b": 1})
			res := request(t, teacher, route.path, http.StatusOK)
			var body map[string][]json.RawMessage
			if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil || len(body[route.key]) != route.cap {
				t.Errorf("school-wide cap changed: count=%d want=%d err=%v", len(body[route.key]), route.cap, err)
			}
		})
	}
}
