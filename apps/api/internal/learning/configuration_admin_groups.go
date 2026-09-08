package learning

import (
	"context"
	"fmt"
	"time"
)

func (r *PostgresRepository) ListGroupPage(ctx context.Context, query AdminGroupPageQuery) (GroupPage, error) {
	bounds, err := newAdminGroupBounds(query)
	if err != nil {
		return GroupPage{}, err
	}
	sql := `
		SELECT g.id::text, COALESCE(g.class_id::text,''), COALESCE(c.name,''), g.name, g.purpose, g.created_at, g.updated_at,
		       COALESCE(c.year_group, 0)
		FROM learning_groups g
		LEFT JOIN classes c ON c.id = g.class_id`
	args := []any{}
	if bounds.Cursor != nil {
		sql += ` WHERE (COALESCE(c.year_group, 0), COALESCE(c.name,''), g.name, g.id::text) > ($1,$2,$3,$4)`
		args = append(args, bounds.Cursor.YearGroup, bounds.Cursor.ClassName, bounds.Cursor.GroupName, bounds.Cursor.ID)
	}
	limitPosition := len(args) + 1
	sql += fmt.Sprintf(" ORDER BY COALESCE(c.year_group, 0), COALESCE(c.name,''), g.name, g.id::text LIMIT $%d", limitPosition)
	args = append(args, bounds.QueryLimit)
	rows, err := r.db.Query(ctx, sql, args...)
	if err != nil {
		return GroupPage{}, err
	}
	type directoryRow struct {
		group     LearningGroupConfig
		yearGroup int
		className string
	}
	items := []directoryRow{}
	for rows.Next() {
		var item directoryRow
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&item.group.ID, &item.group.ClassID, &item.group.ClassName, &item.group.Name, &item.group.Purpose, &createdAt, &updatedAt, &item.yearGroup); err != nil {
			rows.Close()
			return GroupPage{}, err
		}
		item.className = item.group.ClassName
		item.group.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		item.group.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		item.group.Students = []StudentProfileConfig{}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return GroupPage{}, err
	}
	rows.Close()
	groups := make([]LearningGroupConfig, 0, len(items))
	for _, item := range items {
		groups = append(groups, item.group)
	}
	if err := r.loadGroupStudents(ctx, groups); err != nil {
		return GroupPage{}, err
	}
	if len(items) <= bounds.Limit {
		return GroupPage{Groups: groups}, nil
	}
	last := items[bounds.Limit-1]
	page := GroupPage{Groups: groups[:bounds.Limit]}
	page.NextCursor, err = encodeAdminGroupCursor(adminGroupCursor{Kind: "groups", YearGroup: last.yearGroup, ClassName: last.className, GroupName: last.group.Name, ID: last.group.ID})
	if err != nil {
		return GroupPage{}, err
	}
	return page, nil
}

func (r *PostgresRepository) loadGroupStudents(ctx context.Context, groups []LearningGroupConfig) error {
	if len(groups) == 0 {
		return nil
	}
	ids := make([]string, 0, len(groups))
	byID := make(map[string]int, len(groups))
	for index := range groups {
		ids = append(ids, groups[index].ID)
		byID[groups[index].ID] = index
		groups[index].Students = []StudentProfileConfig{}
	}
	studentRows, err := r.db.Query(ctx, `
		SELECT gs.group_id::text, s.id::text, s.external_ref, s.display_name, s.year_group, s.created_at, s.updated_at
		FROM learning_group_students gs
		JOIN students s ON s.id = gs.student_id
		WHERE gs.group_id::text = ANY($1::text[])
		ORDER BY s.display_name, s.external_ref
	`, ids)
	if err != nil {
		return err
	}
	defer studentRows.Close()
	for studentRows.Next() {
		var groupID string
		var student StudentProfileConfig
		var createdAt, updatedAt time.Time
		if err := studentRows.Scan(&groupID, &student.ID, &student.ExternalRef, &student.DisplayName, &student.YearGroup, &createdAt, &updatedAt); err != nil {
			return err
		}
		student.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		student.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		if index, ok := byID[groupID]; ok {
			groups[index].Students = append(groups[index].Students, student)
		}
	}
	return studentRows.Err()
}
