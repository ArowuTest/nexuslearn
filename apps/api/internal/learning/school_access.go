package learning

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const (
	DefaultSchoolCredentialPageLimit = 12
	MaxSchoolCredentialPageLimit     = 50
)

var ErrSchoolClassForbidden = errors.New("class is outside this school")

// These read capabilities are optional; Repository and its older fakes retain
// their legacy shape. School URNs must come from authenticated school users.
type SchoolOverviewRepository interface {
	SchoolOverview(context.Context, string) (SchoolPortalConfig, error)
}

type SchoolClassCredentialRepository interface {
	ListClassStudentCredentialPage(context.Context, string, string, int, string) (StudentCredentialPage, error)
}

// SchoolReadAuthorizationRepository revalidates live access for private reads;
// it does not move or substitute for the atomic write paths' locked checks.
type SchoolReadAuthorizationRepository interface {
	SchoolUserCanRead(context.Context, string, string, string) (bool, error)
}

// Read checks do not replace the locked authorization in SchoolStudentRepository.
type SchoolScopeRepository interface {
	ClassBelongsToSchool(context.Context, string, string) (bool, error)
	GroupBelongsToSchool(context.Context, string, string) (bool, error)
	StudentBelongsToSchool(context.Context, string, string) (bool, error)
}

var (
	_ SchoolOverviewRepository          = (*PostgresRepository)(nil)
	_ SchoolClassCredentialRepository   = (*PostgresRepository)(nil)
	_ SchoolScopeRepository             = (*PostgresRepository)(nil)
	_ SchoolReadAuthorizationRepository = (*PostgresRepository)(nil)
)

func (r *PostgresRepository) SchoolOverview(ctx context.Context, schoolURN string) (SchoolPortalConfig, error) {
	return r.schoolPortal(ctx, schoolURN, false)
}

func (r *PostgresRepository) SchoolUserCanRead(ctx context.Context, actorID, schoolURN, role string) (bool, error) {
	if !validUUID(actorID) || blank(schoolURN) || (role != "school_admin" && role != "teacher") {
		return false, nil
	}
	var allowed bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS (
		SELECT 1 FROM school_users su JOIN app_users u ON u.id=su.user_id
		JOIN schools s ON s.id=su.school_id
		WHERE u.id=$1 AND s.urn=$2 AND su.role=$3
		  AND u.status='active' AND s.status IN ('active','trial')
	)`, actorID, schoolURN, role).Scan(&allowed)
	return allowed, err
}

func (r *PostgresRepository) schoolByURN(ctx context.Context, schoolURN string) (SchoolConfig, error) {
	var school SchoolConfig
	var createdAt, updatedAt time.Time
	err := r.db.QueryRow(ctx, `
		SELECT id::text, name, urn, status, created_at, updated_at
		FROM schools WHERE urn=$1 LIMIT 1
	`, schoolURN).Scan(&school.ID, &school.Name, &school.URN, &school.Status, &createdAt, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return SchoolConfig{}, invalidConfig("school urn does not exist")
	}
	if err != nil {
		return SchoolConfig{}, err
	}
	school.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	school.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return school, nil
}

func (r *PostgresRepository) ClassBelongsToSchool(ctx context.Context, schoolURN, classID string) (bool, error) {
	if blank(schoolURN) || !validUUID(classID) {
		return false, nil
	}
	var belongs bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS (
		SELECT 1 FROM classes c JOIN schools s ON s.id=c.school_id
		WHERE s.urn=$1 AND c.id=$2
	)`, schoolURN, classID).Scan(&belongs)
	return belongs, err
}

func (r *PostgresRepository) GroupBelongsToSchool(ctx context.Context, schoolURN, groupID string) (bool, error) {
	if blank(schoolURN) || !validUUID(groupID) {
		return false, nil
	}
	var belongs bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS (
		SELECT 1 FROM learning_groups g
		JOIN classes c ON c.id=g.class_id JOIN schools s ON s.id=c.school_id
		WHERE s.urn=$1 AND g.id=$2
	)`, schoolURN, groupID).Scan(&belongs)
	return belongs, err
}

func (r *PostgresRepository) StudentBelongsToSchool(ctx context.Context, schoolURN, externalRef string) (bool, error) {
	if blank(schoolURN) || blank(externalRef) {
		return false, nil
	}
	var belongs bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS (
		SELECT 1 FROM students st JOIN class_students cs ON cs.student_id=st.id
		JOIN classes c ON c.id=cs.class_id JOIN schools s ON s.id=c.school_id
		WHERE s.urn=$1 AND st.external_ref=$2
	)`, schoolURN, externalRef).Scan(&belongs)
	return belongs, err
}

// The immutable membership key uses class_students' (class_id, student_id)
// primary key. Names, year groups and credential updates cannot move a boundary.
type schoolCredentialCursor struct {
	Version   int    `json:"v"`
	SchoolURN string `json:"school_urn"`
	ClassID   string `json:"class_id"`
	StudentID string `json:"student_id"`
}

func decodeSchoolCredentialCursor(value, schoolURN, classID string) (schoolCredentialCursor, error) {
	invalid := func() (schoolCredentialCursor, error) {
		return schoolCredentialCursor{}, invalidConfig("invalid school class credential cursor")
	}
	if len(value) > 1024 {
		return invalid()
	}
	raw, err := base64.RawURLEncoding.Strict().DecodeString(value)
	if err != nil || base64.RawURLEncoding.EncodeToString(raw) != value {
		return invalid()
	}
	var cursor schoolCredentialCursor
	decoder := json.NewDecoder(strings.NewReader(string(raw)))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&cursor); err != nil {
		return invalid()
	}
	if err := decoder.Decode(new(any)); err != io.EOF || cursor.Version != 1 || cursor.SchoolURN != schoolURN || cursor.ClassID != classID || !validUUID(cursor.StudentID) {
		return invalid()
	}
	return cursor, nil
}

// ListClassStudentCredentialPage never generates or rotates credentials. The
// SQL limits memberships before joining private credentials, including members
// that have no credential row. A cursor is a position, not authorization; every
// query independently restricts school and class even after cursor validation.
func (r *PostgresRepository) ListClassStudentCredentialPage(ctx context.Context, schoolURN, classID string, limit int, cursorValue string) (StudentCredentialPage, error) {
	if limit == 0 {
		limit = DefaultSchoolCredentialPageLimit
	}
	if limit < 1 || limit > MaxSchoolCredentialPageLimit {
		return StudentCredentialPage{}, invalidConfig("limit must be between 1 and 50")
	}
	classID = strings.ToLower(classID)
	var cursor schoolCredentialCursor
	var err error
	if cursorValue != "" {
		cursor, err = decodeSchoolCredentialCursor(cursorValue, schoolURN, classID)
		if err != nil {
			return StudentCredentialPage{}, err
		}
	}
	belongs, err := r.ClassBelongsToSchool(ctx, schoolURN, classID)
	if err != nil {
		return StudentCredentialPage{}, err
	}
	if !belongs {
		return StudentCredentialPage{}, ErrSchoolClassForbidden
	}
	args := []any{schoolURN, classID, limit + 1}
	after := ""
	if cursor.StudentID != "" {
		after = " AND cs.student_id > $4::uuid"
		args = append(args, cursor.StudentID)
	}
	rows, err := r.db.Query(ctx, `
		WITH members AS MATERIALIZED (
			SELECT cs.student_id FROM class_students cs
			JOIN classes cl ON cl.id=cs.class_id JOIN schools sch ON sch.id=cl.school_id
			WHERE sch.urn=$1 AND cl.id=$2`+after+`
			ORDER BY cs.student_id LIMIT $3
		)
		SELECT s.id::text, s.external_ref, s.display_name, s.year_group,
		       COALESCE(c.login_code,''), COALESCE(c.picture_password,'[]'::jsonb),
		       COALESCE(c.qr_secret_hash,''), COALESCE(c.updated_at,s.updated_at)
		FROM members m JOIN students s ON s.id=m.student_id
		LEFT JOIN student_credentials c ON c.student_id=s.id
		ORDER BY m.student_id
	`, args...)
	if err != nil {
		return StudentCredentialPage{}, err
	}
	defer rows.Close()
	page := StudentCredentialPage{StudentCredentials: []StudentCredentialConfig{}}
	lastStudentID, hasMore := "", false
	for rows.Next() {
		var item StudentCredentialConfig
		var id string
		var pictures []byte
		var updatedAt time.Time
		if err := rows.Scan(&id, &item.StudentExternalRef, &item.DisplayName, &item.YearGroup, &item.LoginCode, &pictures, &item.QRSecretHash, &updatedAt); err != nil {
			return StudentCredentialPage{}, err
		}
		if len(page.StudentCredentials) == limit {
			hasMore = true
			continue
		}
		item.PicturePassword = []string{}
		if err := json.Unmarshal(pictures, &item.PicturePassword); err != nil {
			return StudentCredentialPage{}, err
		}
		// Older login-code-only credentials can contain JSON null, not SQL NULL.
		if item.PicturePassword == nil {
			item.PicturePassword = []string{}
		}
		item.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		page.StudentCredentials = append(page.StudentCredentials, item)
		lastStudentID = id
	}
	if err := rows.Err(); err != nil {
		return StudentCredentialPage{}, err
	}
	if hasMore {
		raw, err := json.Marshal(schoolCredentialCursor{Version: 1, SchoolURN: schoolURN, ClassID: classID, StudentID: lastStudentID})
		if err != nil {
			return StudentCredentialPage{}, err
		}
		page.NextCursor = base64.RawURLEncoding.EncodeToString(raw)
	}
	return page, nil
}
