package server

import (
	"net/http"
	"strings"
)

const (
	adminRolePlatform = "platform_admin"
	adminRoleEditor   = "content_editor"
	adminRoleReviewer = "content_reviewer"
)

func adminRouteAllowed(role, method, path string) bool {
	if role == adminRolePlatform {
		return true
	}

	if role == adminRoleEditor {
		if method == http.MethodGet && path == "/v1/admin/config" {
			return true
		}
		return strings.HasPrefix(path, "/v1/admin/content/activities") ||
			strings.HasPrefix(path, "/v1/admin/content/questions") ||
			(method == http.MethodPut && strings.HasPrefix(path, "/v1/admin/curriculum/objectives/"))
	}

	if role == adminRoleReviewer && method == http.MethodGet {
		return path == "/v1/admin/content/readiness" ||
			path == "/v1/admin/content/narration-readiness" ||
			strings.HasPrefix(path, "/v1/admin/content/reports/") ||
			path == "/v1/admin/content/versions" ||
			path == "/v1/admin/content/releases"
	}

	return false
}

func (s *Server) authenticatedAdminRole(r *http.Request) string {
	if token := bearerToken(r); token != "" {
		if payload, ok := s.verifyAccountToken(token); ok {
			return payload.Role
		}
	}
	return adminRolePlatform
}

func writeAdminCapabilityDenied(w http.ResponseWriter) {
	writeJSON(w, http.StatusForbidden, map[string]string{"error": "account role is not permitted for this admin operation"})
}

var adminConfigSectionFields = map[string][]string{
	"overview":   {"worlds", "students", "classes"},
	"access":     {"access_requests"},
	"schools":    {"schools", "school_users", "classes"},
	"groups":     {"groups", "classes", "students"},
	"parents":    {"parent_links"},
	"learners":   {"students", "student_credentials"},
	"progress":   {"students"},
	"worlds":     {"worlds"},
	"activities": {"activities"},
	"questions":  {"questions"},
	"rewards":    {"reward_rules"},
	"flags":      {"feature_flags"},
}

var allAdminConfigFields = []string{
	"feature_flags", "worlds", "activities", "questions", "reward_rules", "students",
	"schools", "school_users", "classes", "student_credentials", "groups", "parent_links", "access_requests",
}

func adminConfigFields(role, rawSection string) ([]string, bool) {
	section := strings.ToLower(strings.TrimSpace(rawSection))
	if role == adminRoleEditor {
		if section == "" {
			return []string{"activities", "questions"}, true
		}
		if section == "activities" || section == "questions" {
			return []string{section}, true
		}
		return nil, false
	}
	if role != adminRolePlatform {
		return nil, false
	}
	if section == "" {
		return allAdminConfigFields, true
	}
	fields, ok := adminConfigSectionFields[section]
	return fields, ok
}
