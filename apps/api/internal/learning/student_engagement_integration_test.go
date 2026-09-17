package learning

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func engagementTestParent(t *testing.T, ctx context.Context, pool *pgxpool.Pool, name string) string {
	t.Helper()
	var id string
	if err := pool.QueryRow(ctx, `INSERT INTO app_users(login_id,display_name,user_type,status) VALUES($1,$1,'parent','active') RETURNING id::text`, name).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

func TestStudentEngagementSavesPostgres(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	store, ok := any(repo).(StudentEngagementRepository)
	if !ok {
		t.Fatal("scoped version-checked support repository capability is missing")
	}
	ctx := context.Background()
	parent := EngagementActor{Kind: "parent", ID: engagementTestParent(t, ctx, pool, "support-parent")}
	teacher := EngagementActor{Kind: "school", SchoolURN: "support-school"}
	var schoolID, classID string
	if err := pool.QueryRow(ctx, `INSERT INTO schools(urn,name,status) VALUES('support-school','Support school','active') RETURNING id::text`).Scan(&schoolID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO app_users(display_name,user_type,status) VALUES('Support teacher','teacher','active') RETURNING id::text`).Scan(&teacher.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO school_users(school_id,user_id,role) VALUES($1,$2,'teacher')`, schoolID, teacher.ID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO classes(school_id,name,year_group) VALUES($1,'Support class',3) RETURNING id::text`, schoolID).Scan(&classID); err != nil {
		t.Fatal(err)
	}
	fixture := func(ref string, missing bool) StudentEngagementProfile {
		t.Helper()
		child, err := repo.UpsertParentChild(ctx, parent.ID, StudentProfileConfig{ExternalRef: ref, DisplayName: ref, YearGroup: 3}, StudentEngagementProfile{Notes: "original", SensoryLoad: "low"})
		if err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, `INSERT INTO class_students(class_id,student_id) VALUES($1,$2)`, classID, child.Student.ID); err != nil {
			t.Fatal(err)
		}
		if missing {
			if _, err := pool.Exec(ctx, `DELETE FROM student_engagement_profiles WHERE student_id=$1`, child.Student.ID); err != nil {
				t.Fatal(err)
			}
		}
		profile, err := store.ReadStudentEngagement(ctx, parent, ref)
		if err != nil {
			t.Fatal(err)
		}
		return profile
	}
	save := func(actor EngagementActor, p StudentEngagementProfile, key, notes string) (SavedStudentEngagement, error) {
		p.Notes = notes
		return store.SaveStudentEngagement(ctx, actor, EngagementSave{Profile: p, ExpectedVersion: p.Version, IdempotencyKey: key})
	}
	count := func(query string, args ...any) int {
		t.Helper()
		var n int
		if err := pool.QueryRow(ctx, query, args...).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	auditCount := func(ref string) int {
		return count(`SELECT count(*) FROM audit_logs WHERE entity_type='student_engagement_profile' AND entity_id=$1`, ref)
	}
	t.Run("stale parent cannot replace teacher and replay cannot resurrect older support", func(t *testing.T) {
		p := fixture("support-stale", false)
		first, err := save(teacher, p, "first", "newer support")
		if err != nil {
			t.Fatal(err)
		}
		if first.Version <= p.Version || !first.SaveResult.Changed || first.SaveResult.AppliedVersion != first.Version {
			t.Fatalf("unacknowledged save: %+v", first.SaveResult)
		}
		_, err = save(parent, p, "stale", "older draft")
		var conflict *EngagementConflict
		if !errors.As(err, &conflict) || conflict.CurrentProfile.Notes != "newer support" || conflict.PreviouslySaved {
			t.Fatalf("stale save not rejected: %v", err)
		}
		replay, err := save(teacher, p, "first", "newer support")
		if err != nil || replay.Version != first.Version || !replay.SaveResult.Replayed {
			t.Fatalf("retry was not stable: %v %+v", err, replay.SaveResult)
		}
		if auditCount(p.StudentExternalRef) != 1 {
			t.Fatal("retry/conflict created extra audit")
		}
		next, err := save(parent, first.StudentEngagementProfile, "next", "latest support")
		if err != nil {
			t.Fatal(err)
		}
		_, err = save(teacher, p, "first", "newer support")
		conflict = nil
		if !errors.As(err, &conflict) || !conflict.PreviouslySaved || conflict.CurrentProfile.Version != next.Version {
			t.Fatalf("superseded retry not identified: %v", err)
		}
		if auditCount(p.StudentExternalRef) != 2 {
			t.Fatal("superseded replay mutated support")
		}
		if count(`SELECT count(*) FROM request_idempotency, LATERAL jsonb_object_keys(response_payload) AS key WHERE scope='student.engagement.save' AND key NOT IN ('student_id','student_external_ref','applied_version','changed')`) != 0 {
			t.Fatal("unexpected private fields copied into retry ledger")
		}
		if count(`SELECT count(*) FROM audit_logs WHERE entity_type='student_engagement_profile' AND (payload ? 'notes' OR payload ? 'declared_support_needs')`) != 0 {
			t.Fatal("private support copied into audit")
		}
	})
	t.Run("no change is acknowledged without a new revision", func(t *testing.T) {
		p := fixture("support-unchanged", false)
		got, err := save(parent, p, "unchanged", p.Notes)
		if err != nil {
			t.Fatal(err)
		}
		if got.Version != p.Version || got.UpdatedAt != p.UpdatedAt || got.SaveResult.Changed || got.SaveResult.Replayed || auditCount(p.StudentExternalRef) != 0 {
			t.Fatal("unchanged save created update")
		}
		retry, err := save(parent, p, "unchanged", p.Notes)
		if err != nil || !retry.SaveResult.Replayed || retry.SaveResult.Changed {
			t.Fatalf("unchanged replay: %v", err)
		}
	})
	for _, missing := range []bool{false, true} {
		t.Run(fmt.Sprintf("competing writes missing=%t", missing), func(t *testing.T) {
			p := fixture(fmt.Sprintf("support-race-%t", missing), missing)
			start := make(chan struct{})
			errs := make(chan error, 2)
			for i, actor := range []EngagementActor{parent, teacher} {
				go func(i int, actor EngagementActor) {
					<-start
					_, err := save(actor, p, fmt.Sprintf("race-%t-%d", missing, i), fmt.Sprintf("winner-%d", i))
					errs <- err
				}(i, actor)
			}
			close(start)
			success, conflicts := 0, 0
			for i := 0; i < 2; i++ {
				err := <-errs
				var conflict *EngagementConflict
				if err == nil {
					success++
				} else if errors.As(err, &conflict) {
					conflicts++
				} else {
					t.Fatal(err)
				}
			}
			if success != 1 || conflicts != 1 || auditCount(p.StudentExternalRef) != 1 {
				t.Fatalf("race success=%d conflict=%d", success, conflicts)
			}
		})
	}
	t.Run("same key simultaneous retry and reuse with changed request", func(t *testing.T) {
		p := fixture("support-key", false)
		start := make(chan struct{})
		results := make(chan SavedStudentEngagement, 2)
		errs := make(chan error, 2)
		for i := 0; i < 2; i++ {
			go func() { <-start; v, e := save(parent, p, "same-key", "same save"); results <- v; errs <- e }()
		}
		close(start)
		a, b := <-results, <-results
		if e := <-errs; e != nil {
			t.Fatal(e)
		}
		if e := <-errs; e != nil {
			t.Fatal(e)
		}
		if a.Version != b.Version || a.SaveResult.Replayed == b.SaveResult.Replayed || auditCount(p.StudentExternalRef) != 1 {
			t.Fatal("duplicate request did not replay")
		}
		if _, err := save(parent, p, "same-key", "changed save"); !errors.Is(err, ErrIdempotencyConflict) {
			t.Fatalf("key reuse accepted: %v", err)
		}
		other := fixture("support-other-key", false)
		if _, err := save(parent, other, "same-key", "same save"); !errors.Is(err, ErrIdempotencyConflict) {
			t.Fatalf("cross-pupil key reuse accepted: %v", err)
		}
	})
	t.Run("revoked access denies replay and read without private data", func(t *testing.T) {
		p := fixture("support-revoked", false)
		if _, err := save(parent, p, "revoked-key", "private saved"); err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, `UPDATE parent_student_links SET status='revoked' WHERE parent_user_id=$1 AND student_id=(SELECT id FROM students WHERE external_ref=$2)`, parent.ID, p.StudentExternalRef); err != nil {
			t.Fatal(err)
		}
		got, err := save(parent, p, "revoked-key", "private saved")
		if !errors.Is(err, ErrEngagementForbidden) || !reflect.DeepEqual(got, SavedStudentEngagement{}) {
			t.Fatalf("revoked replay exposed data: %v", err)
		}
		read, err := store.ReadStudentEngagement(ctx, parent, p.StudentExternalRef)
		if !errors.Is(err, ErrEngagementForbidden) || !reflect.DeepEqual(read, StudentEngagementProfile{}) {
			t.Fatal("revoked read exposed profile")
		}
		for _, status := range []string{"invited", "paused"} {
			if _, err := pool.Exec(ctx, `UPDATE parent_student_links SET status=$3 WHERE parent_user_id=$1 AND student_id=(SELECT id FROM students WHERE external_ref=$2)`, parent.ID, p.StudentExternalRef, status); err != nil {
				t.Fatal(err)
			}
			if _, err := save(parent, p, "revoked-key", "private saved"); !errors.Is(err, ErrEngagementForbidden) {
				t.Fatalf("%s link edited support", status)
			}
		}
		for _, actor := range []EngagementActor{{Kind: "parent", ID: teacher.ID}, {Kind: "school", ID: teacher.ID, SchoolURN: "other"}, {Kind: "admin", ID: parent.ID}, {}} {
			if _, err := save(actor, p, "denied", "denied"); !errors.Is(err, ErrEngagementForbidden) {
				t.Fatalf("invalid actor scope accepted: %v", err)
			}
		}
		if _, err := store.ReadStudentEngagement(ctx, teacher, "absent-pupil"); !errors.Is(err, ErrEngagementForbidden) {
			t.Fatalf("unknown pupil exposed: %v", err)
		}
	})
	t.Run("malformed settings versions and keys do not write", func(t *testing.T) {
		p := fixture("support-invalid", false)
		for _, key := range []string{"", strings.Repeat("a", 129), "line\nbreak", "non-ascii-é"} {
			if _, err := save(parent, p, key, "bad"); !errors.Is(err, ErrInvalidConfiguration) {
				t.Fatalf("invalid key accepted: %q %v", key, err)
			}
		}
		for _, version := range []int64{-1, MaxEngagementVersion + 1} {
			bad := p
			bad.Version = version
			if _, err := save(parent, bad, "bad-version", "bad"); !errors.Is(err, ErrInvalidConfiguration) {
				t.Fatal("invalid version accepted")
			}
		}
		bad := p
		bad.SensoryLoad = ""
		if _, err := save(parent, bad, "partial", "bad"); !errors.Is(err, ErrInvalidConfiguration) {
			t.Fatal("missing saved setting silently defaulted")
		}
		bad = p
		bad.Interests = nil
		if _, err := save(parent, bad, "null-array", "bad"); !errors.Is(err, ErrInvalidConfiguration) {
			t.Fatal("null array accepted")
		}
		if auditCount(p.StudentExternalRef) != 0 {
			t.Fatal("invalid request left audit")
		}
	})
	t.Run("audit failure rolls back profile version and receipt", func(t *testing.T) {
		p := fixture("support-rollback", false)
		if _, err := pool.Exec(ctx, `CREATE FUNCTION reject_support_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='student_engagement_profile' AND NEW.entity_id='support-rollback' THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_support_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_support_audit()`); err != nil {
			t.Fatal(err)
		}
		if _, err := save(parent, p, "rollback-key", "not committed"); err == nil {
			t.Fatal("injected failure ignored")
		}
		current, err := store.ReadStudentEngagement(ctx, parent, p.StudentExternalRef)
		if err != nil || !reflect.DeepEqual(current, p) {
			t.Fatalf("audit failure left updated support: %v", err)
		}
		if count(`SELECT count(*) FROM request_idempotency WHERE scope='student.engagement.save' AND request_key='rollback-key'`) != 0 {
			t.Fatal("rollback left retry receipt")
		}
	})
	for _, actor := range []EngagementActor{parent, teacher} {
		t.Run("concurrent revocation "+actor.Kind, func(t *testing.T) {
			p := fixture("support-concurrent-revoked-"+actor.Kind, false)
			tx, err := pool.Begin(ctx)
			if err != nil {
				t.Fatal(err)
			}
			defer tx.Rollback(ctx)
			var pid int
			if err := tx.QueryRow(ctx, `SELECT pg_backend_pid()`).Scan(&pid); err != nil {
				t.Fatal(err)
			}
			if actor.Kind == "parent" {
				_, err = tx.Exec(ctx, `UPDATE parent_student_links SET status='revoked' WHERE parent_user_id=$1 AND student_id=(SELECT id FROM students WHERE external_ref=$2)`, actor.ID, p.StudentExternalRef)
			} else {
				_, err = tx.Exec(ctx, `DELETE FROM class_students WHERE class_id=$1 AND student_id=(SELECT id FROM students WHERE external_ref=$2)`, classID, p.StudentExternalRef)
			}
			if err != nil {
				t.Fatal(err)
			}
			errs := make(chan error, 1)
			go func() { _, err := save(actor, p, "revocation-"+actor.Kind, "must not save"); errs <- err }()
			waitParentChildDatabaseBlock(t, ctx, pool, pid)
			if err := tx.Commit(ctx); err != nil {
				t.Fatal(err)
			}
			if err := <-errs; !errors.Is(err, ErrEngagementForbidden) {
				t.Fatalf("revoked ownership not rechecked: %v", err)
			}
			current, err := repo.StudentEngagement(ctx, p.StudentExternalRef)
			if err != nil || !reflect.DeepEqual(current, p) || auditCount(p.StudentExternalRef) != 0 {
				t.Fatal("revocation left support mutation")
			}
		})
	}
	t.Run("account school and membership status rechecked", func(t *testing.T) {
		p := fixture("support-access-status", false)
		for _, actor := range []EngagementActor{parent, teacher} {
			if _, err := pool.Exec(ctx, `UPDATE app_users SET status='paused' WHERE id=$1`, actor.ID); err != nil {
				t.Fatal(err)
			}
			if _, err := save(actor, p, "paused-"+actor.Kind, "forbidden"); !errors.Is(err, ErrEngagementForbidden) {
				t.Fatalf("paused actor saved: %v", err)
			}
			if _, err := pool.Exec(ctx, `UPDATE app_users SET status='active' WHERE id=$1`, actor.ID); err != nil {
				t.Fatal(err)
			}
		}
		if _, err := pool.Exec(ctx, `UPDATE schools SET status='paused' WHERE id=$1`, schoolID); err != nil {
			t.Fatal(err)
		}
		if _, err := save(teacher, p, "paused-school", "forbidden"); !errors.Is(err, ErrEngagementForbidden) {
			t.Fatalf("paused school saved: %v", err)
		}
		if _, err := pool.Exec(ctx, `UPDATE schools SET status='active' WHERE id=$1`, schoolID); err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, `DELETE FROM school_users WHERE user_id=$1 AND school_id=$2`, teacher.ID, schoolID); err != nil {
			t.Fatal(err)
		}
		if _, err := save(teacher, p, "revoked-school-user", "forbidden"); !errors.Is(err, ErrEngagementForbidden) {
			t.Fatalf("removed school user saved: %v", err)
		}
		if _, err := pool.Exec(ctx, `INSERT INTO school_users(school_id,user_id,role) VALUES($1,$2,'teacher')`, schoolID, teacher.ID); err != nil {
			t.Fatal(err)
		}
	})
	t.Run("setup retry and portal preserve the latest standalone save", func(t *testing.T) {
		p := fixture("support-late-setup", false)
		latest, err := save(teacher, p, "newer-before-setup", "More recent adult support")
		if err != nil {
			t.Fatal(err)
		}
		got, err := repo.UpsertParentChild(ctx, parent.ID, StudentProfileConfig{ExternalRef: p.StudentExternalRef, DisplayName: "Updated child name", YearGroup: 4}, StudentEngagementProfile{Notes: "Stale setup", SensoryLoad: "high"})
		if err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(got.Engagement, latest.StudentEngagementProfile) {
			t.Fatal("setup retry replaced later support save")
		}
		portal, err := repo.ParentPortal(ctx, "support-parent")
		if err != nil {
			t.Fatal(err)
		}
		found := false
		for _, child := range portal.Children {
			if child.Student.ExternalRef == p.StudentExternalRef {
				found = true
				if child.Engagement.Version != latest.Version {
					t.Fatal("portal omitted saved version")
				}
			}
		}
		if !found {
			t.Fatal("portal omitted linked child")
		}
	})
	t.Run("receipt failure rolls back the audit and profile", func(t *testing.T) {
		p := fixture("support-receipt-rollback", false)
		if _, err := pool.Exec(ctx, `CREATE FUNCTION reject_support_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.scope='student.engagement.save' AND NEW.request_key='receipt-failure' THEN RAISE EXCEPTION 'injected receipt failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_support_receipt BEFORE UPDATE ON request_idempotency FOR EACH ROW EXECUTE FUNCTION reject_support_receipt()`); err != nil {
			t.Fatal(err)
		}
		if _, err := save(parent, p, "receipt-failure", "uncommitted support"); err == nil {
			t.Fatal("receipt failure ignored")
		}
		current, err := store.ReadStudentEngagement(ctx, parent, p.StudentExternalRef)
		if err != nil || !reflect.DeepEqual(current, p) || auditCount(p.StudentExternalRef) != 0 {
			t.Fatal("receipt failure left profile or audit")
		}
		if count(`SELECT count(*) FROM request_idempotency WHERE scope='student.engagement.save' AND request_key='receipt-failure'`) != 0 {
			t.Fatal("receipt failure left ledger row")
		}
	})
}

func TestParentChildSetupPreservesSupportPostgres(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx := context.Background()
	parent := engagementTestParent(t, ctx, pool, "support-setup-parent")
	child := StudentProfileConfig{ExternalRef: "support-setup-child", DisplayName: "Support child", YearGroup: 3}
	first, err := repo.UpsertParentChild(ctx, parent, child, StudentEngagementProfile{SensoryLoad: "low", Notes: "Keep this support"})
	if err != nil {
		t.Fatal(err)
	}
	second, err := repo.UpsertParentChild(ctx, parent, child, StudentEngagementProfile{SensoryLoad: "high", Notes: "Stale setup"})
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(first.Engagement, second.Engagement) {
		t.Fatal("setup replaced established support")
	}
	if !reflect.DeepEqual(first.Credential, second.Credential) {
		t.Fatal("setup rotated credentials")
	}
}

func TestStudentEngagementVersionMigrationPostgres(t *testing.T) {
	pool, _ := openPaginationIntegrationRepository(t)
	ctx := context.Background()
	var present bool
	if err := pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='student_engagement_profiles' AND column_name='version')`).Scan(&present); err != nil {
		t.Fatal(err)
	}
	if !present {
		t.Fatal("support profiles lack a server-owned version")
	}
	var first, second int64
	if _, err := pool.Exec(ctx, `INSERT INTO students(external_ref,display_name,year_group) VALUES('version-pupil','Version pupil',3)`); err != nil {
		t.Fatal(err)
	}
	insert := `INSERT INTO student_engagement_profiles(student_id,notes) SELECT id,'Kept note' FROM students WHERE external_ref='version-pupil' RETURNING version`
	if err := pool.QueryRow(ctx, insert).Scan(&first); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM student_engagement_profiles WHERE student_id=(SELECT id FROM students WHERE external_ref='version-pupil')`); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, insert).Scan(&second); err != nil {
		t.Fatal(err)
	}
	if first <= 0 || second <= first || second > 9007199254740991 {
		t.Fatalf("versions are not positive non-reused safe integers: %d, %d", first, second)
	}
	// Rebuild the pre-migration shape inside this isolated schema, then exercise
	// the actual additive migration against an existing support row.
	for _, direction := range []string{"down", "up"} {
		raw, err := os.ReadFile(filepath.Join("..", "..", "migrations", "0060_student_engagement_versions."+direction+".sql"))
		if err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, string(raw)); err != nil {
			t.Fatal(err)
		}
	}
	var note string
	var version int64
	var cycle bool
	var max int64
	if err := pool.QueryRow(ctx, `SELECT notes,version FROM student_engagement_profiles WHERE student_id=(SELECT id FROM students WHERE external_ref='version-pupil')`).Scan(&note, &version); err != nil {
		t.Fatal(err)
	}
	if note != "Kept note" || version <= 0 {
		t.Fatal("migration lost existing support")
	}
	if err := pool.QueryRow(ctx, `SELECT seqcycle,seqmax FROM pg_sequence WHERE seqrelid='student_engagement_version_seq'::regclass`).Scan(&cycle, &max); err != nil {
		t.Fatal(err)
	}
	if cycle || max != MaxEngagementVersion {
		t.Fatal("version sequence can wrap or exceed safe integers")
	}
}
