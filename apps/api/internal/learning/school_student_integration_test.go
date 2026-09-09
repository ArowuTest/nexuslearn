package learning

import (
	"context"
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type testedSchoolStudentStore interface {
	UpsertSchoolStudent(context.Context, string, string, string, StudentProfileConfig) (StudentProfileConfig, error)
	AssignSchoolStudentToClass(context.Context, string, string, string, string) (ClassConfig, error)
}

func TestSchoolStudentRepositoryPostgres(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	store, ok := any(repo).(testedSchoolStudentStore)
	if !ok {
		t.Fatal("atomic school-student capability is missing")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	for _, urn := range []string{"atomic-school-a", "atomic-school-b"} {
		if _, err := repo.UpsertSchool(ctx, SchoolConfig{URN: urn, Name: urn, Status: "active"}); err != nil {
			t.Fatal(err)
		}
	}
	makeClass := func(urn, name string) ClassConfig {
		t.Helper()
		c, err := repo.UpsertClass(ctx, ClassConfig{SchoolURN: urn, Name: name, YearGroup: 2})
		if err != nil {
			t.Fatal(err)
		}
		return c
	}
	a, a2, b := makeClass("atomic-school-a", "Class A"), makeClass("atomic-school-a", "Class A2"), makeClass("atomic-school-b", "Class B")
	actor := func(name, schoolID string) string {
		t.Helper()
		var id string
		if err := pool.QueryRow(ctx, `INSERT INTO app_users(email,display_name,user_type,status) VALUES($1,$1,'school_admin','active') RETURNING id::text`, name+"@example.test").Scan(&id); err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, `INSERT INTO school_users(school_id,user_id,role) VALUES($1,$2,'school_admin')`, schoolID, id); err != nil {
			t.Fatal(err)
		}
		return id
	}
	adminA, adminA2, adminB := actor("atomic-admin-a", a.SchoolID), actor("atomic-admin-a2", a.SchoolID), actor("atomic-admin-b", b.SchoolID)
	student := func(ref string) StudentProfileConfig {
		return StudentProfileConfig{ExternalRef: ref, DisplayName: "Original learner", YearGroup: 2}
	}
	seed := func(ref string, classes ...ClassConfig) StudentProfileConfig {
		t.Helper()
		saved, err := repo.UpsertStudent(ctx, student(ref))
		if err != nil {
			t.Fatal(err)
		}
		for _, class := range classes {
			if _, err := repo.AssignStudentToClass(ctx, class.ID, ref); err != nil {
				t.Fatal(err)
			}
		}
		if _, err := repo.UpsertStudentCredential(ctx, StudentCredentialConfig{StudentExternalRef: ref, LoginCode: "KEEP-" + ref, PicturePassword: []string{"moon", "key", "tree"}, QRSecretHash: "keep-existing-qr"}); err != nil {
			t.Fatal(err)
		}
		return saved
	}
	t.Run("create is enrolled immediately and replay update preserves credentials", func(t *testing.T) {
		first, err := store.UpsertSchoolStudent(ctx, adminA, a.SchoolURN, a.ID, student("school-own-child"))
		if err != nil {
			t.Fatal(err)
		}
		if first.ID == "" {
			t.Fatal("missing created learner identity")
		}
		classes, err := repo.ListClassesForSchool(ctx, a.SchoolURN)
		if err != nil {
			t.Fatal(err)
		}
		found := false
		for _, c := range classes {
			for _, p := range c.Students {
				if c.ID == a.ID && p.ID == first.ID {
					found = true
				}
			}
		}
		if !found {
			t.Fatal("created pupil was not immediately visible in the owned class")
		}
		if _, err := repo.UpsertStudentCredential(ctx, StudentCredentialConfig{StudentExternalRef: first.ExternalRef, LoginCode: "KEEP-SCHOOL", PicturePassword: []string{"book", "key"}, QRSecretHash: "keep-qr"}); err != nil {
			t.Fatal(err)
		}
		var before string
		if err := pool.QueryRow(ctx, `SELECT to_jsonb(c)::text FROM student_credentials c WHERE student_id=$1`, first.ID).Scan(&before); err != nil {
			t.Fatal(err)
		}
		for i := 0; i < 3; i++ {
			retry, err := store.UpsertSchoolStudent(ctx, adminA, a.SchoolURN, a.ID, student(first.ExternalRef))
			if err != nil || retry.ID != first.ID {
				t.Fatalf("replay failed: %+v %v", retry, err)
			}
		}
		update := student(first.ExternalRef)
		update.DisplayName = "Updated learner"
		update.YearGroup = 3
		updated, err := store.UpsertSchoolStudent(ctx, adminA2, a.SchoolURN, a2.ID, update)
		if err != nil || updated.ID != first.ID || updated.DisplayName != "Updated learner" || updated.YearGroup != 3 {
			t.Fatalf("owned update failed: %+v %v", updated, err)
		}
		assigned, err := store.AssignSchoolStudentToClass(ctx, adminA, a.SchoolURN, a2.ID, first.ExternalRef)
		if err != nil || assigned.ID != a2.ID || len(assigned.Students) != 1 || assigned.Students[0].ID != first.ID {
			t.Fatalf("assignment response failed: %+v %v", assigned, err)
		}
		var after string
		var links int
		if err := pool.QueryRow(ctx, `SELECT to_jsonb(c)::text FROM student_credentials c WHERE student_id=$1`, first.ID).Scan(&after); err != nil {
			t.Fatal(err)
		}
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM class_students WHERE student_id=$1`, first.ID).Scan(&links); err != nil {
			t.Fatal(err)
		}
		if before != after || links != 2 {
			t.Fatalf("replay/update rotated credentials or duplicated membership: links=%d", links)
		}
	})
	t.Run("unrelated unassigned and cross-linked pupils cannot be claimed", func(t *testing.T) {
		for _, scope := range []string{"unassigned", "family", "foreign", "cross-linked"} {
			t.Run(scope, func(t *testing.T) {
				ref := "school-denied-" + scope
				switch scope {
				case "foreign":
					seed(ref, b)
				case "cross-linked":
					seed(ref, a, b)
				default:
					seed(ref)
				}
				if scope == "family" {
					if _, err := repo.UpsertParentLink(ctx, ParentLinkConfig{ParentEmail: "school-denied-parent@example.test", StudentExternalRef: ref, Relationship: "parent", Status: "active"}); err != nil {
						t.Fatal(err)
					}
				}
				before := schoolStudentSnapshot(t, ctx, pool, ref)
				input := student(ref)
				input.DisplayName = "Takeover"
				got, err := store.UpsertSchoolStudent(ctx, adminA, a.SchoolURN, a2.ID, input)
				if err == nil || !reflect.DeepEqual(got, StudentProfileConfig{}) {
					t.Fatalf("unrelated update returned data: %+v %v", got, err)
				}
				class, err := store.AssignSchoolStudentToClass(ctx, adminA, a.SchoolURN, a2.ID, ref)
				if err == nil || !reflect.DeepEqual(class, ClassConfig{}) {
					t.Fatalf("unrelated assignment returned data: %+v %v", class, err)
				}
				if before != schoolStudentSnapshot(t, ctx, pool, ref) {
					t.Fatal("denied request mutated pupil, membership, credentials or audit")
				}
			})
		}
	})
	t.Run("invalid input foreign class and missing target leave no writes", func(t *testing.T) {
		for _, classID := range []string{"", "not-a-persisted-id", b.ID, "00000000-0000-0000-0000-000000000000"} {
			ref := "school-invalid-class"
			before := schoolStudentSnapshot(t, ctx, pool, ref)
			if got, err := store.UpsertSchoolStudent(ctx, adminA, a.SchoolURN, classID, student(ref)); err == nil || !reflect.DeepEqual(got, StudentProfileConfig{}) {
				t.Fatalf("invalid class accepted: %+v %v", got, err)
			}
			if before != schoolStudentSnapshot(t, ctx, pool, ref) {
				t.Fatal("invalid destination left writes")
			}
		}
		for _, input := range []StudentProfileConfig{{ExternalRef: "invalid-name", YearGroup: 2}, {ExternalRef: "invalid-year", DisplayName: "Name", YearGroup: 8}, {DisplayName: "Name", YearGroup: 2}} {
			if _, err := store.UpsertSchoolStudent(ctx, adminA, a.SchoolURN, a.ID, input); err == nil {
				t.Fatalf("invalid input accepted: %+v", input)
			}
		}
		if got, err := store.AssignSchoolStudentToClass(ctx, adminA, a.SchoolURN, a.ID, "missing-pupil"); err == nil || !reflect.DeepEqual(got, ClassConfig{}) {
			t.Fatalf("assignment created or exposed missing pupil: %+v %v", got, err)
		}
	})
	t.Run("live actor membership role and school status are required", func(t *testing.T) {
		for _, state := range []string{"teacher", "paused-user", "revoked-membership", "wrong-school", "blank-actor", "paused-school"} {
			t.Run(state, func(t *testing.T) {
				id := actor("denied-"+state, a.SchoolID)
				urn := a.SchoolURN
				switch state {
				case "teacher":
					if _, err := pool.Exec(ctx, `UPDATE school_users SET role='teacher' WHERE user_id=$1`, id); err != nil {
						t.Fatal(err)
					}
				case "paused-user":
					if _, err := pool.Exec(ctx, `UPDATE app_users SET status='paused' WHERE id=$1`, id); err != nil {
						t.Fatal(err)
					}
				case "revoked-membership":
					if _, err := pool.Exec(ctx, `DELETE FROM school_users WHERE user_id=$1`, id); err != nil {
						t.Fatal(err)
					}
				case "wrong-school":
					urn = b.SchoolURN
				case "blank-actor":
					id = ""
				case "paused-school":
					if _, err := pool.Exec(ctx, `UPDATE schools SET status='paused' WHERE id=$1`, a.SchoolID); err != nil {
						t.Fatal(err)
					}
					defer pool.Exec(ctx, `UPDATE schools SET status='active' WHERE id=$1`, a.SchoolID)
				}
				ref := "school-denied-actor-" + state
				before := schoolStudentSnapshot(t, ctx, pool, ref)
				if got, err := store.UpsertSchoolStudent(ctx, id, urn, a.ID, student(ref)); err == nil || !reflect.DeepEqual(got, StudentProfileConfig{}) {
					t.Fatalf("inactive/foreign actor accepted: %+v %v", got, err)
				}
				if before != schoolStudentSnapshot(t, ctx, pool, ref) {
					t.Fatal("denied actor created pupil")
				}
				if got, err := store.AssignSchoolStudentToClass(ctx, id, urn, a2.ID, "school-own-child"); err == nil || !reflect.DeepEqual(got, ClassConfig{}) {
					t.Fatalf("inactive/foreign actor assigned: %+v %v", got, err)
				}
			})
		}
	})
	t.Run("enrolment and audit failures roll back creates updates and assignments", func(t *testing.T) {
		if _, err := pool.Exec(ctx, `CREATE FUNCTION reject_school_enrolment() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM students WHERE id=NEW.student_id AND external_ref LIKE 'school-rollback-member%') AND NEW.class_id='`+a2.ID+`'::uuid THEN RAISE EXCEPTION 'injected enrolment failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_school_enrolment BEFORE INSERT ON class_students FOR EACH ROW EXECUTE FUNCTION reject_school_enrolment(); CREATE FUNCTION reject_school_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type IN ('school_student','school_class_student') AND NEW.entity_id LIKE 'school-rollback-audit%' THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_school_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_school_audit()`); err != nil {
			t.Fatal(err)
		}
		for _, stage := range []string{"member", "audit"} {
			for _, existing := range []bool{false, true} {
				ref := fmt.Sprintf("school-rollback-%s-%t", stage, existing)
				if existing {
					seed(ref, a)
				}
				before := schoolStudentSnapshot(t, ctx, pool, ref)
				input := student(ref)
				input.DisplayName = "Must roll back"
				got, err := store.UpsertSchoolStudent(ctx, adminA, a.SchoolURN, a2.ID, input)
				if err == nil || !reflect.DeepEqual(got, StudentProfileConfig{}) || before != schoolStudentSnapshot(t, ctx, pool, ref) {
					t.Fatalf("%s failure left partial writes: %+v %v", stage, got, err)
				}
				if existing {
					class, err := store.AssignSchoolStudentToClass(ctx, adminA, a.SchoolURN, a2.ID, ref)
					if err == nil || !reflect.DeepEqual(class, ClassConfig{}) || before != schoolStudentSnapshot(t, ctx, pool, ref) {
						t.Fatalf("assignment failure leaked state: %+v %v", class, err)
					}
				}
			}
		}
	})
	t.Run("concurrent schools have exactly one owner", func(t *testing.T) {
		for i := 0; i < 10; i++ {
			ref := fmt.Sprintf("school-race-%d", i)
			start := make(chan struct{})
			type result struct {
				school string
				pupil  StudentProfileConfig
				err    error
			}
			results := make(chan result, 2)
			for _, who := range []struct {
				actor string
				class ClassConfig
			}{{adminA, a}, {adminB, b}} {
				go func(id string, class ClassConfig) {
					<-start
					input := student(ref)
					input.DisplayName = class.SchoolURN
					got, err := store.UpsertSchoolStudent(ctx, id, class.SchoolURN, class.ID, input)
					results <- result{class.SchoolURN, got, err}
				}(who.actor, who.class)
			}
			close(start)
			winner, loser := <-results, <-results
			if winner.err != nil {
				winner, loser = loser, winner
			}
			if winner.err != nil || loser.err == nil || !reflect.DeepEqual(loser.pupil, StudentProfileConfig{}) {
				t.Fatalf("expected one claim winner: %+v %+v", winner, loser)
			}
			var links int
			var owner, name string
			if err := pool.QueryRow(ctx, `SELECT count(*),min(sc.urn),min(s.display_name) FROM students s JOIN class_students cs ON cs.student_id=s.id JOIN classes c ON c.id=cs.class_id JOIN schools sc ON sc.id=c.school_id WHERE s.external_ref=$1`, ref).Scan(&links, &owner, &name); err != nil {
				t.Fatal(err)
			}
			if links != 1 || owner != winner.school || name != winner.school {
				t.Fatalf("loser mutated ownership: links=%d owner=%s name=%s", links, owner, name)
			}
		}
	})
	t.Run("same school concurrent replays share one pupil and membership", func(t *testing.T) {
		start := make(chan struct{})
		type result struct {
			pupil StudentProfileConfig
			err   error
		}
		results := make(chan result, 8)
		for i := 0; i < 8; i++ {
			go func() {
				<-start
				got, err := store.UpsertSchoolStudent(ctx, adminA, a.SchoolURN, a.ID, student("school-same-replay"))
				results <- result{got, err}
			}()
		}
		close(start)
		id := ""
		for i := 0; i < 8; i++ {
			got := <-results
			if got.err != nil {
				t.Fatal(got.err)
			}
			if id == "" {
				id = got.pupil.ID
			}
			if got.pupil.ID != id {
				t.Fatal("concurrent replay created multiple pupils")
			}
		}
		var count int
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM class_students WHERE student_id=$1`, id).Scan(&count); err != nil {
			t.Fatal(err)
		}
		if count != 1 {
			t.Fatalf("duplicate enrolment: %d", count)
		}
	})
	t.Run("removed membership cannot be used after concurrent revocation", func(t *testing.T) {
		ref := "school-revoked-membership"
		original := seed(ref, a)
		tx, err := pool.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		defer tx.Rollback(ctx)
		var pid int
		if err := tx.QueryRow(ctx, `SELECT pg_backend_pid()`).Scan(&pid); err != nil {
			t.Fatal(err)
		}
		if _, err := tx.Exec(ctx, `DELETE FROM class_students WHERE student_id=$1`, original.ID); err != nil {
			t.Fatal(err)
		}
		type result struct {
			pupil StudentProfileConfig
			err   error
		}
		results := make(chan result, 1)
		go func() {
			input := student(ref)
			input.DisplayName = "Denied after revocation"
			got, err := store.UpsertSchoolStudent(ctx, adminA, a.SchoolURN, a2.ID, input)
			results <- result{got, err}
		}()
		waitParentChildDatabaseBlock(t, ctx, pool, pid)
		if err := tx.Commit(ctx); err != nil {
			t.Fatal(err)
		}
		got := <-results
		if got.err == nil || !reflect.DeepEqual(got.pupil, StudentProfileConfig{}) {
			t.Fatalf("revoked membership allowed update: %+v", got)
		}
		var name string
		var count int
		if err := pool.QueryRow(ctx, `SELECT display_name,(SELECT count(*) FROM class_students WHERE student_id=s.id) FROM students s WHERE id=$1`, original.ID).Scan(&name, &count); err != nil {
			t.Fatal(err)
		}
		if name != "Original learner" || count != 0 {
			t.Fatal("revoked learner was updated or reattached")
		}
	})
	t.Run("parent and school concurrent claims cannot share ownership", func(t *testing.T) {
		var parentID string
		if err := pool.QueryRow(ctx, `INSERT INTO app_users(email,display_name,user_type,status) VALUES('competing-parent@example.test','Parent','parent','active') RETURNING id::text`).Scan(&parentID); err != nil {
			t.Fatal(err)
		}
		for i := 0; i < 10; i++ {
			ref := fmt.Sprintf("parent-school-claim-%d", i)
			start := make(chan struct{})
			type result struct {
				kind  string
				id    string
				empty bool
				err   error
			}
			results := make(chan result, 2)
			go func() {
				<-start
				got, err := store.UpsertSchoolStudent(ctx, adminA, a.SchoolURN, a.ID, student(ref))
				results <- result{"school", got.ID, reflect.DeepEqual(got, StudentProfileConfig{}), err}
			}()
			go func() {
				<-start
				got, err := repo.UpsertParentChild(ctx, parentID, student(ref), StudentEngagementProfile{})
				results <- result{"parent", got.Student.ID, reflect.DeepEqual(got, ParentChildConfig{}), err}
			}()
			close(start)
			winner, loser := <-results, <-results
			if winner.err != nil {
				winner, loser = loser, winner
			}
			if winner.err != nil || loser.err == nil || !loser.empty {
				t.Fatalf("school/family claim did not have a single data-safe winner: %+v %+v", winner, loser)
			}
			var schoolLinks, parentLinks, credentials int
			if err := pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM class_students WHERE student_id=$1),(SELECT count(*) FROM parent_student_links WHERE student_id=$1),(SELECT count(*) FROM student_credentials WHERE student_id=$1)`, winner.id).Scan(&schoolLinks, &parentLinks, &credentials); err != nil {
				t.Fatal(err)
			}
			if winner.kind == "parent" {
				if parentLinks != 1 || schoolLinks != 0 || credentials != 1 {
					t.Fatalf("partial or shared parent win: %d %d %d", parentLinks, schoolLinks, credentials)
				}
			} else if parentLinks != 0 || schoolLinks != 1 || credentials != 0 {
				t.Fatalf("partial or shared school win: %d %d %d", parentLinks, schoolLinks, credentials)
			}
		}
	})
	t.Run("destination class ownership is rechecked after a concurrent move", func(t *testing.T) {
		ref := "school-moved-destination"
		tx, err := pool.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		defer tx.Rollback(ctx)
		var pid int
		if err := tx.QueryRow(ctx, `SELECT pg_backend_pid()`).Scan(&pid); err != nil {
			t.Fatal(err)
		}
		if _, err := tx.Exec(ctx, `UPDATE classes SET school_id=$2 WHERE id=$1`, a2.ID, b.SchoolID); err != nil {
			t.Fatal(err)
		}
		type result struct {
			pupil StudentProfileConfig
			err   error
		}
		results := make(chan result, 1)
		go func() {
			got, err := store.UpsertSchoolStudent(ctx, adminA, a.SchoolURN, a2.ID, student(ref))
			results <- result{got, err}
		}()
		waitParentChildDatabaseBlock(t, ctx, pool, pid)
		if err := tx.Commit(ctx); err != nil {
			t.Fatal(err)
		}
		got := <-results
		if got.err == nil || !reflect.DeepEqual(got.pupil, StudentProfileConfig{}) {
			t.Fatalf("moved class accepted: %+v", got)
		}
		var count int
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM students WHERE external_ref=$1`, ref).Scan(&count); err != nil {
			t.Fatal(err)
		}
		if count != 0 {
			t.Fatal("moved destination left an orphan pupil")
		}
	})
}

func schoolStudentSnapshot(t *testing.T, ctx context.Context, pool *pgxpool.Pool, ref string) string {
	t.Helper()
	before := parentChildSnapshot(t, ctx, pool, ref)
	var membership string
	if err := pool.QueryRow(ctx, `SELECT COALESCE(jsonb_agg(to_jsonb(cs) ORDER BY cs.class_id),'[]'::jsonb)::text FROM class_students cs JOIN students s ON s.id=cs.student_id WHERE s.external_ref=$1`, ref).Scan(&membership); err != nil {
		t.Fatal(err)
	}
	return before + "\n" + membership
}
