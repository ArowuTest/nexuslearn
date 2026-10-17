package learning

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestPrivacyAndNarrationApprovalPostgres(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	var parentID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO app_users (email, display_name, user_type, status)
		VALUES ('privacy-parent@example.test', 'Privacy Parent', 'parent', 'active')
		RETURNING id::text
	`).Scan(&parentID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO students (external_ref, display_name, year_group)
		VALUES ('privacy-child', 'Ada', 2)
	`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO parent_student_links (parent_user_id, student_id, status)
		SELECT $1::uuid, id, 'active' FROM students WHERE external_ref = 'privacy-child'
	`, parentID); err != nil {
		t.Fatal(err)
	}
	school, linked, consent, err := repo.FamilyChildAccess(ctx, "privacy-child")
	if err != nil || school || !linked || consent {
		t.Fatalf("access = school %v linked %v consent %v err %v", school, linked, consent, err)
	}
	saved, err := repo.RecordConsent(ctx, ConsentRecord{
		ParentUserID: parentID, StudentExternalRef: "privacy-child", Purpose: "family_learning", PolicyVersion: "2026-10-17", Region: "england",
	})
	if err != nil || saved.ID == "" {
		t.Fatal(err)
	}
	_, _, consent, err = repo.FamilyChildAccess(ctx, "privacy-child")
	if err != nil || !consent {
		t.Fatalf("consent active = %v, %v", consent, err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO question_attempts (student_id, question_id, expected_answer, given_answer, correct)
		SELECT id, 'q1', 'secret-key', '4', true FROM students WHERE external_ref = 'privacy-child'
	`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO curriculum_objectives (id, year_group, subject, strand, topic, statement)
		VALUES ('privacy-obj', 2, 'English', 'reading', 'words', 'Read words');
		INSERT INTO activities (id, objective_id, title) VALUES ('privacy-act', 'privacy-obj', 'Read');
		INSERT INTO student_objective_mastery (student_id, objective_id, score, band)
		SELECT id, 'privacy-obj', 40, 'Developing' FROM students WHERE external_ref = 'privacy-child';
		INSERT INTO mastery_history (student_id, objective_id, prior_score, new_score, mastery_delta, correct)
		SELECT id, 'privacy-obj', 0, 40, 40, true FROM students WHERE external_ref = 'privacy-child';
		INSERT INTO diagnostic_baselines (student_id, year_group, status)
		SELECT id, 2, 'completed' FROM students WHERE external_ref = 'privacy-child';
		INSERT INTO mock_assessments (student_id, created_by_role, subject, year_group, year_from, year_to, title, question_count)
		SELECT id, 'parent', 'English', 2, 2, 2, 'Privacy mock', 1 FROM students WHERE external_ref = 'privacy-child';
		INSERT INTO student_world_state (student_id, world_key, state)
		SELECT id, 'garden', '{"stars":1}'::jsonb FROM students WHERE external_ref = 'privacy-child';
		INSERT INTO lesson_step_attempts (student_id, activity_id, objective_id, step_id)
		SELECT id, 'privacy-act', 'privacy-obj', 'warm-up' FROM students WHERE external_ref = 'privacy-child';
		INSERT INTO learning_events (student_id, event_type, event_payload)
		SELECT id, 'answer', '{"login_code":"SECRET-CODE"}'::jsonb FROM students WHERE external_ref = 'privacy-child';
		INSERT INTO audit_logs (action, entity_type, entity_id, payload)
		VALUES ('upsert', 'student_credential', 'privacy-child', '{"login_code":"SECRET-CODE","picture_password":["sun","moon"]}'::jsonb);
	`); err != nil {
		t.Fatal(err)
	}
	exported, err := repo.ExportFamilyChild(ctx, parentID, "privacy-child")
	if err != nil {
		t.Fatal(err)
	}
	if exported.SecretsIncluded || exported.AttemptsTruncated || len(exported.Attempts) != 1 || exported.Attempts[0]["given_answer"] != "4" {
		t.Fatalf("export attempts = %#v truncated %v", exported.Attempts, exported.AttemptsTruncated)
	}
	if len(exported.Mastery) != 1 || len(exported.MasteryHistory) != 1 || len(exported.Baselines) != 1 || len(exported.MockAssessments) != 1 || len(exported.WorldState) != 1 || len(exported.LessonSteps) != 1 || len(exported.Events) != 1 {
		t.Fatalf("export collections mastery=%d history=%d baselines=%d mocks=%d world=%d steps=%d events=%d", len(exported.Mastery), len(exported.MasteryHistory), len(exported.Baselines), len(exported.MockAssessments), len(exported.WorldState), len(exported.LessonSteps), len(exported.Events))
	}
	if _, ok := exported.Attempts[0]["expected_answer"]; ok {
		t.Fatal("answer keys must stay out of the family export")
	}
	var schoolID, classID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO schools (name, urn) VALUES ('Privacy School', 'privacy-urn') RETURNING id::text
	`).Scan(&schoolID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `
		INSERT INTO classes (school_id, name, year_group)
		VALUES ($1::uuid, 'Privacy class', 2)
		RETURNING id::text
	`, schoolID).Scan(&classID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO class_students (class_id, student_id)
		SELECT $1::uuid, id FROM students WHERE external_ref = 'privacy-child'
	`, classID); err != nil {
		t.Fatal(err)
	}
	if err := repo.DeleteFamilyChild(ctx, parentID, "privacy-child"); !errors.Is(err, ErrChildHeldBySchool) {
		t.Fatalf("school-held child delete = %v", err)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM class_students WHERE student_id IN (SELECT id FROM students WHERE external_ref = 'privacy-child')`); err != nil {
		t.Fatal(err)
	}
	if err := repo.DeleteFamilyChild(ctx, parentID, "privacy-child"); err != nil {
		t.Fatal(err)
	}
	var remaining int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM students WHERE external_ref = 'privacy-child'`).Scan(&remaining); err != nil {
		t.Fatal(err)
	}
	if remaining != 0 {
		t.Fatal("child row remained after deletion")
	}
	var anonymised int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM consent_records WHERE student_external_ref = '' AND withdrawn_at IS NOT NULL`).Scan(&anonymised); err != nil {
		t.Fatal(err)
	}
	if anonymised == 0 {
		t.Fatal("consent record was not withdrawn and anonymised")
	}
	var secretLeft, namedSubjects, rawEvents int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM audit_logs WHERE payload::text ILIKE '%SECRET-CODE%' OR payload ? 'picture_password' OR payload ? 'login_code'`).Scan(&secretLeft); err != nil {
		t.Fatal(err)
	}
	if secretLeft != 0 {
		t.Fatal("deleted child credentials remained in the audit log")
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM privacy_actions WHERE subject_ref = 'privacy-child'`).Scan(&namedSubjects); err != nil {
		t.Fatal(err)
	}
	if namedSubjects != 0 {
		t.Fatal("privacy actions still name the deleted child")
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM learning_events WHERE event_payload::text ILIKE '%SECRET-CODE%' OR event_type <> 'redacted'`).Scan(&rawEvents); err != nil {
		t.Fatal(err)
	}
	if rawEvents != 0 {
		t.Fatal("learning event contents were not scrubbed")
	}
	approved, err := repo.SaveHumanContentApproval(ctx, HumanContentApproval{
		PackID: "pack-a", Decision: "approved", Reviewer: "parent@example.test", Notes: "I listened to every clip in this pack.", NarrationIDs: []string{"clip-1"},
	})
	if err != nil || approved.ID == "" {
		t.Fatal(err)
	}
	ids, err := repo.ApprovedNarrationIDs(ctx)
	if err != nil || len(ids) != 1 || ids[0] != "clip-1" {
		t.Fatalf("approved ids = %v, %v", ids, err)
	}
	if _, err := repo.SaveHumanContentApproval(ctx, HumanContentApproval{
		PackID: "pack-a", Decision: "hold", Reviewer: "parent@example.test", Notes: "The second listen found a wrong word.", NarrationIDs: []string{"clip-1"},
	}); err != nil {
		t.Fatal(err)
	}
	ids, err = repo.ApprovedNarrationIDs(ctx)
	if err != nil || len(ids) != 0 {
		t.Fatalf("a later hold must block the clip, got %v, %v", ids, err)
	}
}
