package learning

import (
	"context"
	"fmt"
	"time"
)

func (r *PostgresRepository) ListSchoolPage(ctx context.Context, query AdminOrganisationPageQuery) (SchoolPage, error) {
	bounds, err := newAdminOrganisationBounds(query, "schools")
	if err != nil {
		return SchoolPage{}, err
	}
	sql := `
		SELECT id::text, name, COALESCE(urn,''), status, created_at, updated_at
		FROM schools`
	args := []any{}
	if bounds.Cursor != nil {
		sql += ` WHERE (name, COALESCE(urn,''), id::text) > ($1,$2,$3)`
		args = append(args, bounds.Cursor.SchoolName, bounds.Cursor.URN, bounds.Cursor.ID)
	}
	limitPosition := len(args) + 1
	sql += fmt.Sprintf(" ORDER BY name, COALESCE(urn,''), id::text LIMIT $%d", limitPosition)
	args = append(args, bounds.QueryLimit)
	rows, err := r.db.Query(ctx, sql, args...)
	if err != nil {
		return SchoolPage{}, err
	}
	defer rows.Close()
	schools := []SchoolConfig{}
	for rows.Next() {
		var school SchoolConfig
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&school.ID, &school.Name, &school.URN, &school.Status, &createdAt, &updatedAt); err != nil {
			return SchoolPage{}, err
		}
		school.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		school.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		schools = append(schools, school)
	}
	if err := rows.Err(); err != nil {
		return SchoolPage{}, err
	}
	return newSchoolPage(schools, bounds.Limit)
}

func (r *PostgresRepository) ListSchoolUserPage(ctx context.Context, query AdminOrganisationPageQuery) (SchoolUserPage, error) {
	bounds, err := newAdminOrganisationBounds(query, "school_users")
	if err != nil {
		return SchoolUserPage{}, err
	}
	sql := `
		SELECT u.id::text, COALESCE(s.urn,''), COALESCE(s.name,''), COALESCE(u.email,''), u.display_name,
		       su.role, COALESCE(u.login_id,''), u.temporary_password_required, u.status, u.created_at, u.updated_at
		FROM school_users su
		JOIN app_users u ON u.id = su.user_id
		JOIN schools s ON s.id = su.school_id`
	args := []any{}
	if bounds.Cursor != nil {
		sql += ` WHERE (COALESCE(s.name,''), su.role, u.display_name, COALESCE(u.email,''), u.id::text) > ($1,$2,$3,$4,$5)`
		args = append(args, bounds.Cursor.SchoolName, bounds.Cursor.Role, bounds.Cursor.DisplayName, bounds.Cursor.Email, bounds.Cursor.ID)
	}
	limitPosition := len(args) + 1
	sql += fmt.Sprintf(" ORDER BY COALESCE(s.name,''), su.role, u.display_name, COALESCE(u.email,''), u.id::text LIMIT $%d", limitPosition)
	args = append(args, bounds.QueryLimit)
	rows, err := r.db.Query(ctx, sql, args...)
	if err != nil {
		return SchoolUserPage{}, err
	}
	defer rows.Close()
	users := []SchoolUserConfig{}
	for rows.Next() {
		user, err := scanSchoolUser(rows)
		if err != nil {
			return SchoolUserPage{}, err
		}
		users = append(users, user)
	}
	if err := rows.Err(); err != nil {
		return SchoolUserPage{}, err
	}
	return newSchoolUserPage(users, bounds.Limit)
}

func (r *PostgresRepository) ListClassPage(ctx context.Context, query AdminOrganisationPageQuery) (ClassPage, error) {
	bounds, err := newAdminOrganisationBounds(query, "classes")
	if err != nil {
		return ClassPage{}, err
	}
	sql := `
		SELECT c.id::text, COALESCE(c.school_id::text,''), COALESCE(s.urn,''), COALESCE(s.name,''), c.name, c.year_group,
		       c.created_at, c.updated_at
		FROM classes c
		LEFT JOIN schools s ON s.id = c.school_id`
	args := []any{}
	if bounds.Cursor != nil {
		sql += ` WHERE (COALESCE(s.name,''), c.year_group, c.name, c.id::text) > ($1,$2,$3,$4)`
		args = append(args, bounds.Cursor.SchoolName, bounds.Cursor.YearGroup, bounds.Cursor.Name, bounds.Cursor.ID)
	}
	limitPosition := len(args) + 1
	sql += fmt.Sprintf(" ORDER BY COALESCE(s.name,''), c.year_group, c.name, c.id::text LIMIT $%d", limitPosition)
	args = append(args, bounds.QueryLimit)
	rows, err := r.db.Query(ctx, sql, args...)
	if err != nil {
		return ClassPage{}, err
	}
	classes := []ClassConfig{}
	for rows.Next() {
		classConfig, err := scanClassBase(rows)
		if err != nil {
			rows.Close()
			return ClassPage{}, err
		}
		classes = append(classes, classConfig)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return ClassPage{}, err
	}
	rows.Close()
	if err := r.loadClassStudents(ctx, classes); err != nil {
		return ClassPage{}, err
	}
	return newClassPage(classes, bounds.Limit)
}

func (r *PostgresRepository) loadClassStudents(ctx context.Context, classes []ClassConfig) error {
	if len(classes) == 0 {
		return nil
	}
	ids := make([]string, 0, len(classes))
	byID := make(map[string]int, len(classes))
	for index := range classes {
		ids = append(ids, classes[index].ID)
		byID[classes[index].ID] = index
		classes[index].Students = []StudentProfileConfig{}
	}
	studentRows, err := r.db.Query(ctx, `
		SELECT cs.class_id::text, s.id::text, s.external_ref, s.display_name, s.year_group, s.created_at, s.updated_at
		FROM class_students cs
		JOIN students s ON s.id=cs.student_id
		WHERE cs.class_id::text = ANY($1::text[])
		ORDER BY s.display_name, s.external_ref
	`, ids)
	if err != nil {
		return err
	}
	defer studentRows.Close()
	for studentRows.Next() {
		var classID string
		var student StudentProfileConfig
		var createdAt, updatedAt time.Time
		if err := studentRows.Scan(&classID, &student.ID, &student.ExternalRef, &student.DisplayName, &student.YearGroup, &createdAt, &updatedAt); err != nil {
			return err
		}
		student.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		student.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		if index, ok := byID[classID]; ok {
			classes[index].Students = append(classes[index].Students, student)
		}
	}
	return studentRows.Err()
}
