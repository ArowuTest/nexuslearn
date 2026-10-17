// Package platformenv reads deployment mode without importing the HTTP server.
package platformenv

import (
	"os"
	"strconv"
	"strings"
)

// Production is true for an explicit production setting or a Render web service.
func Production() bool {
	for _, key := range []string{"NEXUSLEARN_ENV", "APP_ENV"} {
		if strings.EqualFold(strings.TrimSpace(os.Getenv(key)), "production") {
			return true
		}
	}
	return strings.EqualFold(strings.TrimSpace(os.Getenv("RENDER")), "true")
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
