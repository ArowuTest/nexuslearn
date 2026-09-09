package learning

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type testedParentChildStore interface {
	UpsertParentChild(context.Context, string, StudentProfileConfig, StudentEngagementProfile) (ParentChildConfig, error)
}

func TestParentChildRepositoryPostgres(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	store, ok := any(repo).(testedParentChildStore)
	if !ok {
		t.Fatal("atomic parent-child repository capability is missing")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	parent := func(name string) string {
		t.Helper()
		var id string
		if err := pool.QueryRow(ctx, `INSERT INTO app_users(email,login_id,display_name,user_type,status) VALUES($1,$2,$2,'parent','active') RETURNING id::text`, name+"@example.test", name).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return id
	}
	a, b := parent("atomic-parent-a"), parent("atomic-parent-b")
	child := func(ref string) StudentProfileConfig {
		return StudentProfileConfig{ExternalRef: ref, DisplayName: "Original", YearGroup: 2}
	}
	seed := func(ref string) StudentProfileConfig {
		t.Helper()
		student, err := repo.UpsertStudent(ctx, child(ref))
		if err != nil {
			t.Fatal(err)
		}
		if _, err := repo.UpsertStudentCredential(ctx, StudentCredentialConfig{StudentExternalRef: ref, LoginCode: "SCHOOL-" + ref, PicturePassword: []string{"moon", "tree", "key"}, QRSecretHash: "original-qr"}); err != nil {
			t.Fatal(err)
		}
		if _, err := repo.UpsertStudentEngagement(ctx, StudentEngagementProfile{StudentExternalRef: ref, Notes: "Original private support"}); err != nil {
			t.Fatal(err)
		}
		return student
	}
	link := func(parentID, studentID, status string) {
		t.Helper()
		if _, err := pool.Exec(ctx, `INSERT INTO parent_student_links(parent_user_id,student_id,status) VALUES($1,$2,$3)`, parentID, studentID, status); err != nil {
			t.Fatal(err)
		}
	}
	t.Run("existing unrelated and inactive links are immutable", func(t *testing.T) {
		for _, status := range []string{"unlinked", "other-parent", "invited", "paused", "revoked"} {
			t.Run(status, func(t *testing.T) {
				ref := "denied-" + status
				student := seed(ref)
				if status == "other-parent" {
					link(b, student.ID, "active")
				} else if status != "unlinked" {
					link(a, student.ID, status)
				}
				before := parentChildSnapshot(t, ctx, pool, ref)
				attempt := child(ref)
				attempt.DisplayName = "Takeover"
				got, err := store.UpsertParentChild(ctx, a, attempt, StudentEngagementProfile{Notes: "Overwrite"})
				if !errors.Is(err, ErrParentChildForbidden) || !reflect.DeepEqual(got, ParentChildConfig{}) {
					t.Fatalf("denied operation returned data: result=%+v error=%v", got, err)
				}
				if after := parentChildSnapshot(t, ctx, pool, ref); after != before {
					t.Fatalf("denied operation changed persisted state\nbefore: %s\nafter: %s", before, after)
				}
			})
		}
	})
	t.Run("active parent account and immutable id required", func(t *testing.T) {
		for _, status := range []string{"invited", "paused", "archived", "wrong-role", "missing", "blank"} {
			t.Run(status, func(t *testing.T) {
				id := parent("inactive-" + status)
				if status == "wrong-role" {
					if _, err := pool.Exec(ctx, `UPDATE app_users SET user_type='teacher' WHERE id=$1`, id); err != nil {
						t.Fatal(err)
					}
				} else if status == "missing" {
					if _, err := pool.Exec(ctx, `DELETE FROM app_users WHERE id=$1`, id); err != nil {
						t.Fatal(err)
					}
				} else if status == "blank" {
					id = ""
				} else {
					if _, err := pool.Exec(ctx, `UPDATE app_users SET status=$2 WHERE id=$1`, id, status); err != nil {
						t.Fatal(err)
					}
				}
				ref := "inactive-child-" + status
				before := parentChildSnapshot(t, ctx, pool, ref)
				got, err := store.UpsertParentChild(ctx, id, child(ref), StudentEngagementProfile{})
				if err == nil || !reflect.DeepEqual(got, ParentChildConfig{}) {
					t.Fatalf("inactive parent accepted: %+v %v", got, err)
				}
				if parentChildSnapshot(t, ctx, pool, ref) != before {
					t.Fatal("inactive parent left writes")
				}
			})
		}
	})
	t.Run("create retry and update preserve generated credentials", func(t *testing.T) {
		first, err := store.UpsertParentChild(ctx, a, child("atomic-retry"), StudentEngagementProfile{SensoryLoad: "low", Notes: "private"})
		if err != nil {
			t.Fatal(err)
		}
		if first.Student.ID == "" || first.Credential.LoginCode == "" || len(first.Credential.PicturePassword) != 6 || first.Engagement.SensoryLoad != "low" {
			t.Fatalf("incomplete child: %+v", first)
		}
		for i := 0; i < 3; i++ {
			retry, err := store.UpsertParentChild(ctx, a, child("atomic-retry"), StudentEngagementProfile{SensoryLoad: "low", Notes: "private"})
			if err != nil {
				t.Fatal(err)
			}
			if retry.Student.ID != first.Student.ID || !reflect.DeepEqual(retry.Credential, first.Credential) {
				t.Fatalf("retry changed identity/credentials: %+v -> %+v", first, retry)
			}
		}
		update := child("atomic-retry")
		update.DisplayName = "Updated"
		update.YearGroup = 4
		got, err := store.UpsertParentChild(ctx, a, update, StudentEngagementProfile{SensoryLoad: "low"})
		if err != nil || got.Student.DisplayName != "Updated" || got.Student.YearGroup != 4 || got.Credential.LoginCode != first.Credential.LoginCode || !reflect.DeepEqual(got.Credential.PicturePassword, first.Credential.PicturePassword) {
			t.Fatalf("update failed or reset credentials: %+v %v", got, err)
		}
		var links int
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM parent_student_links WHERE student_id=$1 AND parent_user_id=$2 AND status='active'`, first.Student.ID, a).Scan(&links); err != nil {
			t.Fatal(err)
		}
		if links != 1 {
			t.Fatalf("expected one active link, got %d", links)
		}
	})
	t.Run("school and family credentials are not rotated", func(t *testing.T) {
		student := seed("keep-school-credential")
		link(a, student.ID, "active")
		var before string
		if err := pool.QueryRow(ctx, `SELECT to_jsonb(c)::text FROM student_credentials c WHERE student_id=$1`, student.ID).Scan(&before); err != nil {
			t.Fatal(err)
		}
		got, err := store.UpsertParentChild(ctx, a, child(student.ExternalRef), StudentEngagementProfile{})
		if err != nil {
			t.Fatal(err)
		}
		var after string
		if err := pool.QueryRow(ctx, `SELECT to_jsonb(c)::text FROM student_credentials c WHERE student_id=$1`, student.ID).Scan(&after); err != nil {
			t.Fatal(err)
		}
		if before != after || got.Credential.LoginCode != "SCHOOL-keep-school-credential" || got.Credential.QRSecretHash != "original-qr" {
			t.Fatal("existing credential changed")
		}
	})
	t.Run("invalid input creates and updates nothing", func(t *testing.T) {
		profiles := []StudentEngagementProfile{{SensoryLoad: "invalid"}, {DeclaredSupportNeeds: []string{"invalid"}}, {LearningApproaches: []string{"invalid"}}, {Interests: []string{" "}}}
		for i, profile := range profiles {
			for _, existing := range []bool{false, true} {
				ref := fmt.Sprintf("invalid-%d-%t", i, existing)
				if existing {
					student := seed(ref)
					link(a, student.ID, "active")
				}
				before := parentChildSnapshot(t, ctx, pool, ref)
				got, err := store.UpsertParentChild(ctx, a, child(ref), profile)
				if err == nil || !reflect.DeepEqual(got, ParentChildConfig{}) || before != parentChildSnapshot(t, ctx, pool, ref) {
					t.Fatalf("invalid support was not atomic: %+v %v", got, err)
				}
			}
		}
		for _, input := range []StudentProfileConfig{{ExternalRef: "invalid-name", DisplayName: " ", YearGroup: 2}, {ExternalRef: "invalid-year", DisplayName: "Name", YearGroup: 8}, {ExternalRef: " ", DisplayName: "Name", YearGroup: 2}} {
			if _, err := store.UpsertParentChild(ctx, a, input, StudentEngagementProfile{}); err == nil {
				t.Fatalf("invalid student accepted: %+v", input)
			}
		}
	})
	t.Run("database support failure rolls back all four writes", func(t *testing.T) {
		if _, err := pool.Exec(ctx, `CREATE FUNCTION reject_parent_child_support() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.notes='force rollback' THEN RAISE EXCEPTION 'injected support failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_parent_child_support BEFORE INSERT OR UPDATE ON student_engagement_profiles FOR EACH ROW EXECUTE FUNCTION reject_parent_child_support()`); err != nil {
			t.Fatal(err)
		}
		for _, existing := range []bool{false, true} {
			ref := fmt.Sprintf("rollback-%t", existing)
			if existing {
				student := seed(ref)
				link(a, student.ID, "active")
			}
			before := parentChildSnapshot(t, ctx, pool, ref)
			input := child(ref)
			input.DisplayName = "Must roll back"
			got, err := store.UpsertParentChild(ctx, a, input, StudentEngagementProfile{Notes: "force rollback"})
			if err == nil || !reflect.DeepEqual(got, ParentChildConfig{}) || before != parentChildSnapshot(t, ctx, pool, ref) {
				t.Fatalf("failed support write leaked state: %+v %v", got, err)
			}
		}
	})
	t.Run("concurrent parents cannot both claim a new reference", func(t *testing.T) {
		for round := 0; round < 12; round++ {
			ref := fmt.Sprintf("concurrent-claim-%d", round)
			start := make(chan struct{})
			type outcome struct {
				parent string
				child  ParentChildConfig
				err    error
			}
			results := make(chan outcome, 2)
			for _, id := range []string{a, b} {
				go func(id string) {
					<-start
					input := child(ref)
					input.DisplayName = id
					got, err := store.UpsertParentChild(ctx, id, input, StudentEngagementProfile{})
					results <- outcome{id, got, err}
				}(id)
			}
			close(start)
			one, two := <-results, <-results
			if one.err != nil {
				one, two = two, one
			}
			if one.err != nil || two.err == nil || !reflect.DeepEqual(two.child, ParentChildConfig{}) {
				t.Fatalf("expected one winner and one data-free rejection: %+v %+v", one, two)
			}
			var owner, name string
			var count int
			if err := pool.QueryRow(ctx, `SELECT count(*), min(l.parent_user_id::text), min(s.display_name) FROM students s JOIN parent_student_links l ON l.student_id=s.id WHERE s.external_ref=$1`, ref).Scan(&count, &owner, &name); err != nil {
				t.Fatal(err)
			}
			if count != 1 || owner != one.parent || name != one.parent {
				t.Fatalf("loser changed ownership/profile: count=%d owner=%s name=%s", count, owner, name)
			}
		}
	})
	t.Run("concurrent same parent retries share credentials", func(t *testing.T) {
		start := make(chan struct{})
		results := make(chan ParentChildConfig, 8)
		errors := make(chan error, 8)
		for i := 0; i < 8; i++ {
			go func() {
				<-start
				got, err := store.UpsertParentChild(ctx, a, child("same-parent-race"), StudentEngagementProfile{})
				results <- got
				errors <- err
			}()
		}
		close(start)
		var first ParentChildConfig
		for i := 0; i < 8; i++ {
			got := <-results
			if err := <-errors; err != nil {
				t.Fatal(err)
			}
			if i == 0 {
				first = got
			} else if got.Student.ID != first.Student.ID || !reflect.DeepEqual(got.Credential, first.Credential) {
				t.Fatal("concurrent retry rotated credentials")
			}
		}
	})
	t.Run("uncommitted competing claim is rechecked after waiting", func(t *testing.T) {
		ref := "uncommitted-claim"
		tx, err := pool.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		defer tx.Rollback(ctx)
		var pid int
		var id string
		if err := tx.QueryRow(ctx, `SELECT pg_backend_pid()`).Scan(&pid); err != nil {
			t.Fatal(err)
		}
		if err := tx.QueryRow(ctx, `INSERT INTO students(external_ref,display_name,year_group) VALUES($1,'Uncommitted owner',3) RETURNING id::text`, ref).Scan(&id); err != nil {
			t.Fatal(err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO parent_student_links(parent_user_id,student_id,status) VALUES($1,$2,'active')`, b, id); err != nil {
			t.Fatal(err)
		}
		type outcome struct {
			child ParentChildConfig
			err   error
		}
		results := make(chan outcome, 1)
		go func() {
			got, err := store.UpsertParentChild(ctx, a, child(ref), StudentEngagementProfile{})
			results <- outcome{got, err}
		}()
		waitParentChildDatabaseBlock(t, ctx, pool, pid)
		if err := tx.Commit(ctx); err != nil {
			t.Fatal(err)
		}
		got := <-results
		if !errors.Is(got.err, ErrParentChildForbidden) || !reflect.DeepEqual(got.child, ParentChildConfig{}) {
			t.Fatalf("competing claim escaped ownership check: %+v", got)
		}
		var name string
		var links, credentials, support int
		if err := pool.QueryRow(ctx, `SELECT s.display_name,(SELECT count(*) FROM parent_student_links WHERE student_id=s.id),(SELECT count(*) FROM student_credentials WHERE student_id=s.id),(SELECT count(*) FROM student_engagement_profiles WHERE student_id=s.id) FROM students s WHERE external_ref=$1`, ref).Scan(&name, &links, &credentials, &support); err != nil {
			t.Fatal(err)
		}
		if name != "Uncommitted owner" || links != 1 || credentials != 0 || support != 0 {
			t.Fatalf("loser mutated winning claim: %s links=%d credentials=%d support=%d", name, links, credentials, support)
		}
	})
	t.Run("concurrent link revocation is rechecked after waiting", func(t *testing.T) {
		ref := "revocation-race"
		student := seed(ref)
		link(a, student.ID, "active")
		tx, err := pool.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		defer tx.Rollback(ctx)
		var pid int
		if err := tx.QueryRow(ctx, `SELECT pg_backend_pid()`).Scan(&pid); err != nil {
			t.Fatal(err)
		}
		if _, err := tx.Exec(ctx, `UPDATE parent_student_links SET status='revoked' WHERE parent_user_id=$1 AND student_id=$2`, a, student.ID); err != nil {
			t.Fatal(err)
		}
		type outcome struct {
			child ParentChildConfig
			err   error
		}
		results := make(chan outcome, 1)
		go func() {
			input := child(ref)
			input.DisplayName = "Denied update"
			got, err := store.UpsertParentChild(ctx, a, input, StudentEngagementProfile{})
			results <- outcome{got, err}
		}()
		waitParentChildDatabaseBlock(t, ctx, pool, pid)
		if err := tx.Commit(ctx); err != nil {
			t.Fatal(err)
		}
		before := parentChildSnapshot(t, ctx, pool, ref)
		got := <-results
		if !errors.Is(got.err, ErrParentChildForbidden) || !reflect.DeepEqual(got.child, ParentChildConfig{}) {
			t.Fatalf("revoked link was accepted: %+v", got)
		}
		if before != parentChildSnapshot(t, ctx, pool, ref) {
			t.Fatal("revoked parent mutated child")
		}
	})
	t.Run("generated credentials are independent and usable", func(t *testing.T) {
		codes := map[string]bool{}
		pictures := map[string]bool{}
		for i := 0; i < 12; i++ {
			got, err := store.UpsertParentChild(ctx, a, child(fmt.Sprintf("random-%d", i)), StudentEngagementProfile{})
			if err != nil {
				t.Fatal(err)
			}
			if codes[got.Credential.LoginCode] {
				t.Fatal("duplicate login code")
			}
			codes[got.Credential.LoginCode] = true
			pictures[strings.Join(got.Credential.PicturePassword, ",")] = true
			if err := validateStudentCredential(got.Credential); err != nil {
				t.Fatal(err)
			}
		}
		if len(pictures) < 2 {
			t.Fatal("globally fixed picture password")
		}
	})
}

// Observe PostgreSQL lock contention, not a scheduler-dependent sleep. This
// proves the operation overlaps the uncommitted claim/revocation transaction.
func waitParentChildDatabaseBlock(t *testing.T, ctx context.Context, pool *pgxpool.Pool, blockerPID int) {
	t.Helper()
	deadline := time.NewTimer(5 * time.Second)
	defer deadline.Stop()
	tick := time.NewTicker(10 * time.Millisecond)
	defer tick.Stop()
	for {
		var blocked bool
		if err := pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid)))`, blockerPID).Scan(&blocked); err != nil {
			t.Fatal(err)
		}
		if blocked {
			return
		}
		select {
		case <-ctx.Done():
			t.Fatal(ctx.Err())
		case <-deadline.C:
			t.Fatal("operation never overlapped the blocking transaction")
		case <-tick.C:
		}
	}
}

func parentChildSnapshot(t *testing.T, ctx context.Context, pool *pgxpool.Pool, ref string) string {
	t.Helper()
	var snapshot string
	err := pool.QueryRow(ctx, `SELECT jsonb_build_object(
		'student', (SELECT to_jsonb(s) FROM students s WHERE external_ref=$1),
		'links', (SELECT jsonb_agg(to_jsonb(l) ORDER BY l.id) FROM parent_student_links l JOIN students s ON s.id=l.student_id WHERE s.external_ref=$1),
		'credential', (SELECT to_jsonb(c) FROM student_credentials c JOIN students s ON s.id=c.student_id WHERE s.external_ref=$1),
		'support', (SELECT to_jsonb(p) FROM student_engagement_profiles p JOIN students s ON s.id=p.student_id WHERE s.external_ref=$1),
		'audit', (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM audit_logs a WHERE entity_id=$1)
	)::text`, ref).Scan(&snapshot)
	if err != nil {
		t.Fatal(err)
	}
	return snapshot
}
