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
	exported, err := repo.ExportFamilyChild(ctx, parentID, "privacy-child")
	if err != nil {
		t.Fatal(err)
	}
	if exported.SecretsIncluded || len(exported.Attempts) != 1 || exported.Attempts[0]["given_answer"] != "4" {
		t.Fatalf("export = %#v", exported)
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
