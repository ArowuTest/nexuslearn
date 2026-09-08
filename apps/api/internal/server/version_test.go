package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"runtime/debug"
	"strings"
	"testing"
)

func TestVersionReportsValidatedRenderRevision(t *testing.T) {
	sha := strings.Repeat("a", 40)
	t.Setenv("RENDER_GIT_COMMIT", sha)
	res := httptest.NewRecorder()
	New(fakeRepository{}, "postgres").ServeHTTP(res, httptest.NewRequest(http.MethodGet, "/v1/version", nil))
	var version map[string]string
	if err := json.Unmarshal(res.Body.Bytes(), &version); err != nil {
		t.Fatal(err)
	}
	if res.Code != http.StatusOK || version["git_revision"] != sha || version["git_revision_source"] != "render" || version["git_revision_state"] != "reported" {
		t.Fatalf("missing deployment identity: %s", res.Body.String())
	}
	if res.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("deployment identity must not be cached")
	}
}

func TestBuildRevisionResolution(t *testing.T) {
	sha, other := strings.Repeat("a", 40), strings.Repeat("b", 40)
	stamp := func(vcs, revision, modified string) *debug.BuildInfo {
		return &debug.BuildInfo{Settings: []debug.BuildSetting{
			{Key: "vcs", Value: vcs}, {Key: "vcs.revision", Value: revision}, {Key: "vcs.modified", Value: modified},
		}}
	}
	for _, tt := range []struct {
		name   string
		render string
		info   *debug.BuildInfo
		want   buildRevision
	}{
		{"unknown", "", nil, buildRevision{Source: "unavailable", State: "unknown"}},
		{"render fallback", sha, nil, buildRevision{sha, "render", "reported"}},
		{"normalised SHA", strings.ToUpper(sha), nil, buildRevision{sha, "render", "reported"}},
		{"short SHA rejected", sha[:7], nil, buildRevision{Source: "render", State: "invalid"}},
		{"clean binary", "", stamp("git", sha, "false"), buildRevision{sha, "go-vcs", "clean"}},
		{"matching stamps", sha, stamp("git", sha, "false"), buildRevision{sha, "go-vcs", "clean"}},
		{"runtime cannot hide old binary", other, stamp("git", sha, "false"), buildRevision{sha, "go-vcs", "conflict"}},
		{"runtime cannot hide dirty binary", sha, stamp("git", sha, "true"), buildRevision{sha, "go-vcs", "modified"}},
		{"missing clean flag", sha, stamp("git", sha, ""), buildRevision{sha, "go-vcs", "unknown"}},
		{"incomplete stamp", sha, stamp("git", "", "true"), buildRevision{Source: "unavailable", State: "unknown"}},
		{"invalid binary stamp", "", stamp("git", "do-not-echo", "false"), buildRevision{Source: "go-vcs", State: "invalid"}},
		{"wrong VCS", "", stamp("hg", sha, "false"), buildRevision{Source: "go-vcs", State: "invalid"}},
		{"bad platform metadata fails closed", "do-not-echo", stamp("git", sha, "false"), buildRevision{Source: "render", State: "invalid"}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			if got := resolveBuildRevision(tt.render, tt.info); got != tt.want {
				t.Fatalf("got %+v, want %+v", got, tt.want)
			}
		})
	}
}

func TestVersionDoesNotEchoInvalidRevision(t *testing.T) {
	t.Setenv("RENDER_GIT_COMMIT", "invalid-value-never-publish")
	res := httptest.NewRecorder()
	New(fakeRepository{}, "postgres").ServeHTTP(res, httptest.NewRequest(http.MethodGet, "/v1/version", nil))
	var version map[string]string
	if err := json.Unmarshal(res.Body.Bytes(), &version); err != nil {
		t.Fatal(err)
	}
	if version["git_revision_state"] != "invalid" || strings.Contains(res.Body.String(), "invalid-value-never-publish") {
		t.Fatalf("invalid metadata was accepted or echoed: %s", res.Body.String())
	}
}
