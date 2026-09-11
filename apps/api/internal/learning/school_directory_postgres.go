package learning

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

var _ SchoolDirectoryRepository = (*PostgresRepository)(nil)

type schoolDirectoryQueryer interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}

// A single repeatable-read snapshot keeps organisation totals and the three
// initial pages consistent, without ever loading staff or membership arrays.
func (r *PostgresRepository) SchoolDirectoryOverview(ctx context.Context, urn string) (SchoolDirectoryOverview, error) {
	if !schoolCurriculumKey(urn) {
		return SchoolDirectoryOverview{}, invalidConfig("invalid school urn")
	}
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return SchoolDirectoryOverview{}, err
	}
	defer tx.Rollback(ctx)
	result := SchoolDirectoryOverview{Classes: []SchoolDirectoryClass{}, Groups: []SchoolDirectoryGroup{}, Students: []SchoolDirectoryStudent{}, Directory: SchoolDirectoryMetadata{Version: 1}}
	var created, updated time.Time
	err = tx.QueryRow(ctx, `SELECT id::text,name,urn,status,created_at,updated_at FROM schools WHERE urn=$1`, urn).Scan(&result.School.ID, &result.School.Name, &result.School.URN, &result.School.Status, &created, &updated)
	if errors.Is(err, pgx.ErrNoRows) {
		return SchoolDirectoryOverview{}, invalidConfig("school urn does not exist")
	}
	if err != nil {
		return SchoolDirectoryOverview{}, err
	}
	result.School.CreatedAt = created.UTC().Format(time.RFC3339)
	result.School.UpdatedAt = updated.UTC().Format(time.RFC3339)
	err = tx.QueryRow(ctx, `
		WITH school_classes AS MATERIALIZED (
			SELECT c.id FROM classes c JOIN schools s ON s.id=c.school_id WHERE s.urn=$1
		)
		SELECT (SELECT count(*) FROM school_classes),
		       (SELECT count(*) FROM learning_groups g JOIN school_classes c ON c.id=g.class_id),
		       (SELECT count(DISTINCT cs.student_id) FROM class_students cs JOIN school_classes c ON c.id=cs.class_id)
	`, urn).Scan(&result.Directory.Counts.Classes, &result.Directory.Counts.Groups, &result.Directory.Counts.Students)
	if err != nil {
		return SchoolDirectoryOverview{}, err
	}
	for _, kind := range []string{"classes", "groups", "students"} {
		q := SchoolDirectoryQuery{Kind: kind, Limit: DefaultSchoolDirectoryLimit}
		page, err := listSchoolDirectory(ctx, tx, urn, q, schoolDirectoryCursor{})
		if err != nil {
			return SchoolDirectoryOverview{}, err
		}
		switch kind {
		case "classes":
			for _, item := range page.Items {
				result.Classes = append(result.Classes, item.(SchoolDirectoryClass))
			}
			result.Directory.ClassesNextCursor = page.NextCursor
		case "groups":
			for _, item := range page.Items {
				result.Groups = append(result.Groups, item.(SchoolDirectoryGroup))
			}
			result.Directory.GroupsNextCursor = page.NextCursor
		case "students":
			for _, item := range page.Items {
				result.Students = append(result.Students, item.(SchoolDirectoryStudent))
			}
			result.Directory.StudentsNextCursor = page.NextCursor
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return SchoolDirectoryOverview{}, err
	}
	return result, nil
}

func (r *PostgresRepository) ListSchoolDirectory(ctx context.Context, urn string, query SchoolDirectoryQuery) (SchoolDirectoryPage, error) {
	query, cursor, err := prepareSchoolDirectoryQuery(urn, query)
	if err != nil {
		return SchoolDirectoryPage{}, err
	}
	return listSchoolDirectory(ctx, r.db, urn, query, cursor)
}

// Only validated kinds choose SQL. Search uses strpos, not LIKE, so %, _ and
// backslash are literal. Membership counting happens after the bounded page;
// there is one SQL query per directory page, not one query per directory row.
func schoolDirectorySQL(urn string, q SchoolDirectoryQuery, c schoolDirectoryCursor) (string, []any) {
	args := []any{urn, q.Search, q.Limit + 1}
	bind := func(value any) string { args = append(args, value); return fmt.Sprintf("$%d", len(args)) }
	where := ""
	switch q.Kind {
	case "classes":
		if c.ID != "" {
			where += " AND c.id>" + bind(c.ID) + "::uuid"
		}
		if q.Ref != "" {
			where += " AND c.id=" + bind(q.Ref) + "::uuid"
		}
		return `WITH page AS MATERIALIZED (
			SELECT c.id,c.name,c.year_group FROM classes c
			WHERE c.school_id=(SELECT id FROM schools WHERE urn=$1)
			AND ($2='' OR strpos(lower(c.name),lower($2))>0)` + where + `
			ORDER BY c.id LIMIT $3
		)
		SELECT p.id::text,p.name,COALESCE(p.year_group,0),count(cs.student_id)
		FROM page p LEFT JOIN class_students cs ON cs.class_id=p.id
		GROUP BY p.id,p.name,p.year_group ORDER BY p.id`, args
	case "groups":
		if c.ID != "" {
			classPosition := bind(c.ClassID)
			where += " AND c.id>=" + classPosition + "::uuid AND (c.id,g.id)>(" + classPosition + "::uuid," + bind(c.ID) + "::uuid)"
		}
		return `WITH page AS MATERIALIZED (
			SELECT g.id,g.class_id,c.school_id,g.name,g.purpose
			FROM classes c JOIN learning_groups g ON g.class_id=c.id
			WHERE c.school_id=(SELECT id FROM schools WHERE urn=$1)
			AND ($2='' OR strpos(lower(g.name),lower($2))>0)` + where + `
			ORDER BY c.id,g.id LIMIT $3
		)
		SELECT p.id::text,p.class_id::text,p.name,p.purpose,count(gs.student_id)
		FROM page p LEFT JOIN learning_group_students gs ON gs.group_id=p.id AND EXISTS (
			SELECT 1 FROM class_students cs JOIN classes c ON c.id=cs.class_id
			WHERE cs.student_id=gs.student_id AND c.school_id=p.school_id
		)
		GROUP BY p.class_id,p.id,p.name,p.purpose ORDER BY p.class_id,p.id`, args
	default: // students; the public entry points validate before this builder.
		if c.ID != "" {
			where += " AND st.id>" + bind(c.ID) + "::uuid"
		}
		if q.Ref != "" {
			where += " AND st.external_ref=" + bind(q.Ref)
		}
		return `WITH members AS MATERIALIZED (
			SELECT DISTINCT st.id,st.external_ref,st.display_name,st.year_group
			FROM students st JOIN class_students cs ON cs.student_id=st.id
			JOIN classes c ON c.id=cs.class_id JOIN schools s ON s.id=c.school_id
			WHERE s.urn=$1 AND ($2='' OR strpos(lower(st.display_name),lower($2))>0 OR strpos(lower(st.external_ref),lower($2))>0)` + where + `
			ORDER BY st.id LIMIT $3
		)
		SELECT id::text,external_ref,display_name,year_group FROM members ORDER BY id`, args
	}
}

func listSchoolDirectory(ctx context.Context, db schoolDirectoryQueryer, urn string, q SchoolDirectoryQuery, cursor schoolDirectoryCursor) (SchoolDirectoryPage, error) {
	sql, args := schoolDirectorySQL(urn, q, cursor)
	rows, err := db.Query(ctx, sql, args...)
	if err != nil {
		return SchoolDirectoryPage{}, err
	}
	defer rows.Close()
	page := SchoolDirectoryPage{SchoolURN: urn, Kind: q.Kind, Items: []SchoolDirectoryItem{}}
	last := schoolDirectoryCursor{Version: 1, SchoolURN: urn, Kind: q.Kind, Search: q.Search, Ref: q.Ref}
	hasMore := false
	for rows.Next() {
		var item SchoolDirectoryItem
		var id, classID string
		switch q.Kind {
		case "classes":
			var row SchoolDirectoryClass
			err = rows.Scan(&row.ID, &row.Name, &row.YearGroup, &row.StudentCount)
			id = row.ID
			item = row
		case "groups":
			var row SchoolDirectoryGroup
			err = rows.Scan(&row.ID, &row.ClassID, &row.Name, &row.Purpose, &row.StudentCount)
			id = row.ID
			classID = row.ClassID
			item = row
		case "students":
			var row SchoolDirectoryStudent
			err = rows.Scan(&id, &row.ExternalRef, &row.DisplayName, &row.YearGroup)
			item = row
		}
		if err != nil {
			return SchoolDirectoryPage{}, err
		}
		if len(page.Items) == q.Limit {
			hasMore = true
			continue
		}
		page.Items = append(page.Items, item)
		last.ID = id
		last.ClassID = classID
	}
	if err := rows.Err(); err != nil {
		return SchoolDirectoryPage{}, err
	}
	if hasMore {
		page.NextCursor, err = encodeSchoolDirectoryCursor(last)
		if err != nil {
			return SchoolDirectoryPage{}, err
		}
	}
	return page, nil
}
