package server

import (
	"os"
	"regexp"
	"runtime/debug"
	"strings"
)

var gitRevisionPattern = regexp.MustCompile(`^[0-9a-f]{40}$`)

type buildRevision struct {
	SHA    string
	Source string
	State  string
}

func currentBuildRevision() buildRevision {
	info, _ := debug.ReadBuildInfo()
	return resolveBuildRevision(os.Getenv("RENDER_GIT_COMMIT"), info)
}

// Prefer identity embedded in the binary. Render's documented checkout SHA is
// a fallback for builds without VCS stamping, not a way to hide dirty or
// conflicting binary metadata. Only validated SHAs leave this boundary.
func resolveBuildRevision(renderSHA string, info *debug.BuildInfo) buildRevision {
	unknown := buildRevision{Source: "unavailable", State: "unknown"}
	renderSHA = strings.ToLower(renderSHA)
	if renderSHA != "" && !gitRevisionPattern.MatchString(renderSHA) {
		return buildRevision{Source: "render", State: "invalid"}
	}
	var revision, vcs, modified string
	if info != nil {
		for _, setting := range info.Settings {
			switch setting.Key {
			case "vcs":
				vcs = setting.Value
			case "vcs.revision":
				revision = strings.ToLower(setting.Value)
			case "vcs.modified":
				modified = setting.Value
			}
		}
	}
	if revision != "" {
		if vcs != "git" || !gitRevisionPattern.MatchString(revision) {
			return buildRevision{Source: "go-vcs", State: "invalid"}
		}
		result := buildRevision{SHA: revision, Source: "go-vcs", State: "unknown"}
		switch {
		case renderSHA != "" && renderSHA != revision:
			result.State = "conflict"
		case modified == "true":
			result.State = "modified"
		case modified == "false":
			result.State = "clean"
		}
		return result
	}
	if vcs != "" || modified != "" {
		// Incomplete VCS stamps cannot be upgraded to clean by an environment value.
		return unknown
	}
	if renderSHA != "" {
		return buildRevision{SHA: renderSHA, Source: "render", State: "reported"}
	}
	return unknown
}
