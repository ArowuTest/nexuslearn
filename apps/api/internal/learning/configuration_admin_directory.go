package learning

import (
	"context"
	"encoding/json"
	"time"
)

func (r *PostgresRepository) ListStudentPage(ctx context.Context, query AdminDirectoryPageQuery) (StudentProfilePage, error) {
	bounds, err := newAdminDirectoryBounds(query)
	if err != nil {
		return StudentProfilePage{}, err
	}
	yearGroup, displayName, externalRef := adminDirectoryCursorValues(bounds.Cursor)
	rows, err := r.db.Query(ctx, `
		SELECT id::text, external_ref, display_name, year_group, created_at, updated_at
		FROM students
		WHERE ($1::int = 0 OR (year_group, display_name, external_ref) > ($1::int, $2::text, $3::text))
		ORDER BY year_group, display_name, external_ref
		LIMIT $4
	`, yearGroup, displayName, externalRef, bounds.QueryLimit)
	if err != nil {
		return StudentProfilePage{}, err
	}
	defer rows.Close()
	students := []StudentProfileConfig{}
	for rows.Next() {
		var student StudentProfileConfig
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&student.ID, &student.ExternalRef, &student.DisplayName, &student.YearGroup, &createdAt, &updatedAt); err != nil {
			return StudentProfilePage{}, err
		}
		student.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		student.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		students = append(students, student)
	}
	if err := rows.Err(); err != nil {
		return StudentProfilePage{}, err
	}
	return newStudentProfilePage(students, bounds.Limit)
}

func (r *PostgresRepository) ListStudentCredentialPage(ctx context.Context, query AdminDirectoryPageQuery) (StudentCredentialPage, error) {
	bounds, err := newAdminDirectoryBounds(query)
	if err != nil {
		return StudentCredentialPage{}, err
	}
	yearGroup, displayName, externalRef := adminDirectoryCursorValues(bounds.Cursor)
	rows, err := r.db.Query(ctx, `
		SELECT s.external_ref, s.display_name, s.year_group, COALESCE(c.login_code,''), COALESCE(c.picture_password, '[]'::jsonb),
		       COALESCE(c.qr_secret_hash,''), COALESCE(c.updated_at, s.updated_at)
		FROM students s
		LEFT JOIN student_credentials c ON c.student_id = s.id
		WHERE ($1::int = 0 OR (s.year_group, s.display_name, s.external_ref) > ($1::int, $2::text, $3::text))
		ORDER BY s.year_group, s.display_name, s.external_ref
		LIMIT $4
	`, yearGroup, displayName, externalRef, bounds.QueryLimit)
	if err != nil {
		return StudentCredentialPage{}, err
	}
	defer rows.Close()
	credentials := []StudentCredentialConfig{}
	for rows.Next() {
		var credential StudentCredentialConfig
		var raw []byte
		var updatedAt time.Time
		if err := rows.Scan(&credential.StudentExternalRef, &credential.DisplayName, &credential.YearGroup, &credential.LoginCode, &raw, &credential.QRSecretHash, &updatedAt); err != nil {
			return StudentCredentialPage{}, err
		}
		credential.PicturePassword = []string{}
		_ = json.Unmarshal(raw, &credential.PicturePassword)
		credential.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		credentials = append(credentials, credential)
	}
	if err := rows.Err(); err != nil {
		return StudentCredentialPage{}, err
	}
	return newStudentCredentialPage(credentials, bounds.Limit)
}

func adminDirectoryCursorValues(cursor *adminDirectoryCursor) (int, string, string) {
	if cursor == nil {
		return 0, "", ""
	}
	return cursor.YearGroup, cursor.DisplayName, cursor.ExternalRef
}
