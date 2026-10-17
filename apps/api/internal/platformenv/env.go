// Package platformenv reads deployment mode without importing the HTTP server.
package platformenv

import (
	"os"
	"strconv"
	"strings"
	"testing"
)

// Production is the safe default. A process is not production only when it is
// explicitly marked development, or when it is a Go test that has not opted in.
// Render and any other host are production unless that flag is set.
func Production() bool {
	return production(os.Getenv, testing.Testing())
}

func production(getenv func(string) string, inTest bool) bool {
	if developmentMode(getenv) {
		return false
	}
	if inTest && !explicitProduction(getenv) {
		return false
	}
	return true
}

func developmentMode(getenv func(string) string) bool {
	env := strings.ToLower(strings.TrimSpace(getenv("NEXUSLEARN_ENV")))
	if env == "" {
		env = strings.ToLower(strings.TrimSpace(getenv("APP_ENV")))
	}
	switch env {
	case "development", "dev", "test":
		return true
	default:
		return false
	}
}

func explicitProduction(getenv func(string) string) bool {
	for _, key := range []string{"NEXUSLEARN_ENV", "APP_ENV"} {
		if strings.EqualFold(strings.TrimSpace(getenv(key)), "production") {
			return true
		}
	}
	return strings.EqualFold(strings.TrimSpace(getenv("RENDER")), "true")
}

// RetentionDays is how long learning attempts are kept. The default is two years.
func RetentionDays() (int, error) {
	raw := strings.TrimSpace(os.Getenv("DATA_RETENTION_DAYS"))
	if raw == "" {
		return 730, nil
	}
	days, err := strconv.Atoi(raw)
	if err != nil || days < 30 || days > 3650 {
		return 0, errOutOfRange
	}
	return days, nil
}

type rangeError struct{}

func (rangeError) Error() string {
	return "DATA_RETENTION_DAYS must be a whole number from 30 to 3650"
}

var errOutOfRange = rangeError{}
