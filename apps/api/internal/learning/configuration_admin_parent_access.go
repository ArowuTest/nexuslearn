package learning

import (
	"context"
	"fmt"
	"strings"
	"time"
)

func (r *PostgresRepository) ListParentLinkPage(ctx context.Context, query AdminParentPageQuery) (ParentLinkPage, error) {
	bounds, err := newAdminParentBounds(query, "parent_links")
	if err != nil {
		return ParentLinkPage{}, err
	}
	sql := `
		SELECT l.id::text, l.student_id::text, l.parent_user_id::text,
		       u.email, u.display_name, s.external_ref, s.display_name,
		       l.relationship, l.status, l.created_at, l.updated_at
		FROM parent_student_links l
		JOIN app_users u ON u.id = l.parent_user_id
		JOIN students s ON s.id = l.student_id`
	args := []any{}
	if bounds.Cursor != nil {
		sql += ` WHERE (l.student_id, l.parent_user_id, l.id) > ($1::uuid, $2::uuid, $3::uuid)`
		args = append(args, bounds.Cursor.StudentID, bounds.Cursor.ParentUserID, bounds.Cursor.ID)
	}
	limitPosition := len(args) + 1
	sql += fmt.Sprintf(" ORDER BY l.student_id, l.parent_user_id, l.id LIMIT $%d", limitPosition)
	args = append(args, bounds.QueryLimit)
	rows, err := r.db.Query(ctx, sql, args...)
	if err != nil {
		return ParentLinkPage{}, err
	}
	defer rows.Close()
	type relationshipRow struct {
		link         ParentLinkConfig
		studentID    string
		parentUserID string
	}
	items := []relationshipRow{}
	for rows.Next() {
		var item relationshipRow
		var createdAt, updatedAt time.Time
		if err := rows.Scan(
			&item.link.ID, &item.studentID, &item.parentUserID,
			&item.link.ParentEmail, &item.link.ParentDisplayName,
			&item.link.StudentExternalRef, &item.link.StudentDisplayName,
			&item.link.Relationship, &item.link.Status, &createdAt, &updatedAt,
		); err != nil {
			return ParentLinkPage{}, err
		}
		item.link.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		item.link.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return ParentLinkPage{}, err
	}
	links := make([]ParentLinkConfig, 0, len(items))
	for _, item := range items {
		links = append(links, item.link)
	}
	if len(items) <= bounds.Limit {
		return ParentLinkPage{ParentLinks: links}, nil
	}
	last := items[bounds.Limit-1]
	page := ParentLinkPage{ParentLinks: links[:bounds.Limit]}
	page.NextCursor, err = encodeAdminParentCursor(adminParentCursor{
		Kind: "parent_links", StudentID: last.studentID, ParentUserID: last.parentUserID, ID: last.link.ID,
	})
	if err != nil {
		return ParentLinkPage{}, err
	}
	return page, nil
}

func (r *PostgresRepository) ListParentInvitationPage(ctx context.Context, query AdminParentPageQuery) (ParentInvitationPage, error) {
	bounds, err := newAdminParentBounds(query, "parent_invitations")
	if err != nil {
		return ParentInvitationPage{}, err
	}
	sql := `
		SELECT i.id::text, i.parent_email, i.parent_display_name, s.external_ref, i.relationship,
		       CASE WHEN i.status IN ('pending','sent') AND i.expires_at <= now() THEN 'expired' ELSE i.status END,
		       i.expires_at, i.sent_at, i.accepted_at, i.revoked_at, i.created_at, i.updated_at
		FROM parent_invitations i
		JOIN students s ON s.id=i.student_id`
	args := []any{}
	if bounds.Cursor != nil {
		sql += ` WHERE (i.created_at, i.id) < ($1::timestamptz, $2::uuid)`
		args = append(args, bounds.Cursor.CreatedAt, bounds.Cursor.ID)
	}
	limitPosition := len(args) + 1
	sql += fmt.Sprintf(" ORDER BY i.created_at DESC, i.id DESC LIMIT $%d", limitPosition)
	args = append(args, bounds.QueryLimit)
	rows, err := r.db.Query(ctx, sql, args...)
	if err != nil {
		return ParentInvitationPage{}, err
	}
	defer rows.Close()
	type invitationRow struct {
		invitation ParentInvitation
		createdAt  time.Time
	}
	items := []invitationRow{}
	for rows.Next() {
		invitation, createdAt, err := scanParentInvitationWithCreatedAt(rows)
		if err != nil {
			return ParentInvitationPage{}, err
		}
		items = append(items, invitationRow{invitation: invitation, createdAt: createdAt})
	}
	if err := rows.Err(); err != nil {
		return ParentInvitationPage{}, err
	}
	invitations := make([]ParentInvitation, 0, len(items))
	for _, item := range items {
		invitations = append(invitations, item.invitation)
	}
	if len(items) <= bounds.Limit {
		return ParentInvitationPage{ParentInvitations: invitations}, nil
	}
	last := items[bounds.Limit-1]
	page := ParentInvitationPage{ParentInvitations: invitations[:bounds.Limit]}
	page.NextCursor, err = encodeAdminParentCursor(adminParentCursor{
		Kind: "parent_invitations", CreatedAt: last.createdAt.UTC().Format(time.RFC3339Nano), ID: last.invitation.ID,
	})
	if err != nil {
		return ParentInvitationPage{}, err
	}
	return page, nil
}

func (r *PostgresRepository) ListAccessRequestPage(ctx context.Context, query AdminAccessRequestPageQuery) (AccessRequestPage, error) {
	bounds, err := newAdminAccessRequestBounds(query)
	if err != nil {
		return AccessRequestPage{}, err
	}
	sql := `
		SELECT id::text, request_type, organisation_name, contact_name, contact_email, phone, role, region,
		       COALESCE(learner_count, 0), array_to_json(year_groups)::text,
		       array_to_json(support_needs)::text, array_to_json(learning_priorities)::text,
		       message, status, source, created_at, updated_at
		FROM access_requests`
	args := []any{}
	where := []string{}
	if bounds.Status != "" {
		where = append(where, "status=$1")
		args = append(args, bounds.Status)
	}
	if bounds.Cursor != nil {
		createdPosition := len(args) + 1
		idPosition := createdPosition + 1
		where = append(where, fmt.Sprintf("(created_at, id) < ($%d::timestamptz, $%d::uuid)", createdPosition, idPosition))
		args = append(args, bounds.Cursor.CreatedAt, bounds.Cursor.ID)
	}
	if len(where) > 0 {
		sql += " WHERE " + strings.Join(where, " AND ")
	}
	limitPosition := len(args) + 1
	sql += fmt.Sprintf(" ORDER BY created_at DESC, id DESC LIMIT $%d", limitPosition)
	args = append(args, bounds.QueryLimit)
	rows, err := r.db.Query(ctx, sql, args...)
	if err != nil {
		return AccessRequestPage{}, err
	}
	defer rows.Close()
	type requestRow struct {
		request   AccessRequestConfig
		createdAt time.Time
	}
	items := []requestRow{}
	for rows.Next() {
		request, createdAt, err := scanAccessRequestWithCreatedAt(rows)
		if err != nil {
			return AccessRequestPage{}, err
		}
		items = append(items, requestRow{request: request, createdAt: createdAt})
	}
	if err := rows.Err(); err != nil {
		return AccessRequestPage{}, err
	}
	requests := make([]AccessRequestConfig, 0, len(items))
	for _, item := range items {
		requests = append(requests, item.request)
	}
	if len(items) <= bounds.Limit {
		return AccessRequestPage{AccessRequests: requests}, nil
	}
	last := items[bounds.Limit-1]
	page := AccessRequestPage{AccessRequests: requests[:bounds.Limit]}
	page.NextCursor, err = encodeAdminAccessRequestCursor(adminAccessRequestCursor{
		Kind: "access_requests", Status: bounds.Status, CreatedAt: last.createdAt.UTC().Format(time.RFC3339Nano), ID: last.request.ID,
	})
	if err != nil {
		return AccessRequestPage{}, err
	}
	return page, nil
}
