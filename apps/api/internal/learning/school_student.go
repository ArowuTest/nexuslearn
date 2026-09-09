package learning

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// ErrSchoolStudentForbidden does not reveal which account, class or learner
// failed the ownership check. Platform administrators retain separate upserts.
var ErrSchoolStudentForbidden = errors.New("class or pupil is outside this school")

// SchoolStudentRepository never adopts an existing unassigned/foreign pupil.
// The actor ID and school URN must come from verified authentication, not input.
type SchoolStudentRepository interface {
	UpsertSchoolStudent(context.Context, string, string, string, StudentProfileConfig) (StudentProfileConfig, error)
	AssignSchoolStudentToClass(context.Context, string, string, string, string) (ClassConfig, error)
}

var _ SchoolStudentRepository = (*PostgresRepository)(nil)

// PrepareSchoolStudent validates the entire school pupil PUT before any write.
// class_id is required; caller-supplied database IDs and timestamps are ignored.
func PrepareSchoolStudent(classID string, student StudentProfileConfig) (string, StudentProfileConfig, error) {
	classID, err := prepareSchoolClassID(classID)
	if err != nil {
		return "", StudentProfileConfig{}, err
	}
	student = StudentProfileConfig{ExternalRef: strings.TrimSpace(student.ExternalRef), DisplayName: strings.TrimSpace(student.DisplayName), YearGroup: student.YearGroup}
	if err := validateStudent(student); err != nil {
		return "", StudentProfileConfig{}, err
	}
	return classID, student, nil
}

// PrepareSchoolClassAssignment accepts only an existing class UUID and a
// nonblank route reference; ownership is checked under locks by the repository.
func PrepareSchoolClassAssignment(classID, ref string) (string, string, error) {
	classID, err := prepareSchoolClassID(classID)
	if err != nil {
		return "", "", err
	}
	ref = strings.TrimSpace(ref)
	if ref == "" {
		return "", "", invalidConfig("student external ref is required")
	}
	return classID, ref, nil
}

func prepareSchoolClassID(classID string) (string, error) {
	classID = strings.TrimSpace(classID)
	var id pgtype.UUID
	if err := id.Scan(classID); err != nil || !id.Valid {
		return "", invalidConfig("class_id must be a persisted class UUID")
	}
	return classID, nil
}

// UpsertSchoolStudent creates the learner and its first owned class membership
// together. An existing learner must already belong exclusively to this school.
// Neither this path nor assignment reads, generates or rotates credentials.
func (r *PostgresRepository) UpsertSchoolStudent(ctx context.Context, actorID, schoolURN, classID string, student StudentProfileConfig) (StudentProfileConfig, error) {
	classID, student, err := PrepareSchoolStudent(classID, student)
	if err != nil {
		return StudentProfileConfig{}, err
	}
	if blank(actorID) || blank(schoolURN) {
		return StudentProfileConfig{}, ErrSchoolStudentForbidden
	}
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return StudentProfileConfig{}, err
	}
	defer tx.Rollback(ctx)
	class, err := lockSchoolStudentScope(ctx, tx, actorID, schoolURN, classID)
	if err != nil {
		return StudentProfileConfig{}, err
	}
	// The global unique index arbitrates concurrent family/school claims. This
	// must not be an ON CONFLICT UPDATE: the reference is untrusted input.
	saved, err := scanSchoolStudent(tx.QueryRow(ctx, `
		INSERT INTO students(external_ref,display_name,year_group) VALUES($1,$2,$3)
		ON CONFLICT(external_ref) DO NOTHING
		RETURNING id::text,external_ref,display_name,year_group,created_at,updated_at
	`, student.ExternalRef, student.DisplayName, student.YearGroup))
	created := err == nil
	if errors.Is(err, pgx.ErrNoRows) {
		saved, err = lockSchoolStudent(ctx, tx, student.ExternalRef)
	}
	if err != nil {
		return StudentProfileConfig{}, err
	}
	if !created {
		if err := lockSchoolStudentOwnership(ctx, tx, class.SchoolID, saved.ID); err != nil {
			return StudentProfileConfig{}, err
		}
		saved, err = scanSchoolStudent(tx.QueryRow(ctx, `
			UPDATE students SET display_name=$2,year_group=$3,updated_at=now() WHERE id=$1
			RETURNING id::text,external_ref,display_name,year_group,created_at,updated_at
		`, saved.ID, student.DisplayName, student.YearGroup))
		if err != nil {
			return StudentProfileConfig{}, err
		}
	}
	if _, err := tx.Exec(ctx, `INSERT INTO class_students(class_id,student_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, class.ID, saved.ID); err != nil {
		return StudentProfileConfig{}, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,payload) VALUES($1,'upsert','school_student',$2,$3::jsonb)`, actorID, saved.ExternalRef, mustJSON(map[string]any{"school_urn": class.SchoolURN, "class_id": class.ID, "created": created})); err != nil {
		return StudentProfileConfig{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return StudentProfileConfig{}, err
	}
	return saved, nil
}

// AssignSchoolStudentToClass can add an already-owned pupil to another class,
// but cannot confer a school's first ownership of a global/unassigned pupil.
func (r *PostgresRepository) AssignSchoolStudentToClass(ctx context.Context, actorID, schoolURN, classID, ref string) (ClassConfig, error) {
	classID, ref, err := PrepareSchoolClassAssignment(classID, ref)
	if err != nil {
		return ClassConfig{}, err
	}
	if blank(actorID) || blank(schoolURN) {
		return ClassConfig{}, ErrSchoolStudentForbidden
	}
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return ClassConfig{}, err
	}
	defer tx.Rollback(ctx)
	class, err := lockSchoolStudentScope(ctx, tx, actorID, schoolURN, classID)
	if err != nil {
		return ClassConfig{}, err
	}
	student, err := lockSchoolStudent(ctx, tx, ref)
	if err != nil {
		return ClassConfig{}, err
	}
	if err := lockSchoolStudentOwnership(ctx, tx, class.SchoolID, student.ID); err != nil {
		return ClassConfig{}, err
	}
	tag, err := tx.Exec(ctx, `INSERT INTO class_students(class_id,student_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, class.ID, student.ID)
	if err != nil {
		return ClassConfig{}, err
	}
	if tag.RowsAffected() > 0 {
		if _, err := tx.Exec(ctx, `INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,payload) VALUES($1,'assign','school_class_student',$2,$3::jsonb)`, actorID, ref, mustJSON(map[string]string{"school_urn": class.SchoolURN, "class_id": class.ID})); err != nil {
			return ClassConfig{}, err
		}
	}
	// Assemble the existing ClassConfig response before commit, so even a read
	// failure cannot report a failed operation after committing an assignment.
	rows, err := tx.Query(ctx, `SELECT s.id::text,s.external_ref,s.display_name,s.year_group,s.created_at,s.updated_at FROM class_students cs JOIN students s ON s.id=cs.student_id WHERE cs.class_id=$1 ORDER BY s.display_name,s.external_ref`, class.ID)
	if err != nil {
		return ClassConfig{}, err
	}
	for rows.Next() {
		pupil, err := scanSchoolStudent(rows)
		if err != nil {
			rows.Close()
			return ClassConfig{}, err
		}
		class.Students = append(class.Students, pupil)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return ClassConfig{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ClassConfig{}, err
	}
	return class, nil
}

func lockSchoolStudentScope(ctx context.Context, tx pgx.Tx, actorID, schoolURN, classID string) (ClassConfig, error) {
	var schoolID string
	// Session roles are not enough: lock the current account, school membership
	// and school state so removal/demotion/pausing cannot race the write.
	err := tx.QueryRow(ctx, `
		SELECT s.id::text FROM schools s
		JOIN school_users su ON su.school_id=s.id JOIN app_users u ON u.id=su.user_id
		WHERE s.urn=$1 AND u.id=$2 AND su.role='school_admin'
		  AND u.status='active' AND s.status IN ('active','trial')
		FOR SHARE OF s,su,u
	`, strings.TrimSpace(schoolURN), actorID).Scan(&schoolID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ClassConfig{}, ErrSchoolStudentForbidden
	}
	if err != nil {
		return ClassConfig{}, err
	}
	class, err := scanClassBase(tx.QueryRow(ctx, `
		SELECT c.id::text,c.school_id::text,s.urn,s.name,c.name,c.year_group,c.created_at,c.updated_at
		FROM classes c JOIN schools s ON s.id=c.school_id
		WHERE c.id=$1 AND c.school_id=$2 FOR SHARE OF c
	`, classID, schoolID))
	if errors.Is(err, pgx.ErrNoRows) {
		return ClassConfig{}, ErrSchoolStudentForbidden
	}
	if err != nil {
		return ClassConfig{}, err
	}
	return class, nil
}

func lockSchoolStudent(ctx context.Context, tx pgx.Tx, ref string) (StudentProfileConfig, error) {
	student, err := scanSchoolStudent(tx.QueryRow(ctx, `SELECT id::text,external_ref,display_name,year_group,created_at,updated_at FROM students WHERE external_ref=$1 FOR UPDATE`, ref))
	if errors.Is(err, pgx.ErrNoRows) {
		return StudentProfileConfig{}, ErrSchoolStudentForbidden
	}
	return student, err
}

func lockSchoolStudentOwnership(ctx context.Context, tx pgx.Tx, schoolID, studentID string) error {
	// There is no status column on classes/class_students: a present membership
	// in an existing class of the verified active/trial school is the authority.
	// Lock both rows to serialize removal/reparenting. The pupil FOR UPDATE lock
	// also blocks FK-backed concurrent membership insertions until this commits.
	rows, err := tx.Query(ctx, `SELECT COALESCE(c.school_id::text,'') FROM class_students cs JOIN classes c ON c.id=cs.class_id WHERE cs.student_id=$1 ORDER BY cs.class_id FOR SHARE OF cs,c`, studentID)
	if err != nil {
		return err
	}
	defer rows.Close()
	found := false
	for rows.Next() {
		var owner string
		if err := rows.Scan(&owner); err != nil {
			return err
		}
		if owner != schoolID {
			return ErrSchoolStudentForbidden
		}
		found = true
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if !found {
		return ErrSchoolStudentForbidden
	}
	return nil
}

func scanSchoolStudent(row rowScanner) (StudentProfileConfig, error) {
	var student StudentProfileConfig
	var createdAt, updatedAt time.Time
	if err := row.Scan(&student.ID, &student.ExternalRef, &student.DisplayName, &student.YearGroup, &createdAt, &updatedAt); err != nil {
		return StudentProfileConfig{}, err
	}
	student.CreatedAt, student.UpdatedAt = createdAt.UTC().Format(time.RFC3339), updatedAt.UTC().Format(time.RFC3339)
	return student, nil
}
