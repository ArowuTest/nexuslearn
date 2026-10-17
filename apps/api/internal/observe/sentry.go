// Package observe reports operational failures. Error reporting stays off
// unless SENTRY_DSN is set, so a family install does not send children's
// errors anywhere by default.
package observe

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

type Event struct {
	Message string
	Level   string
	Tags    map[string]string
}

var HTTPClient = &http.Client{Timeout: 2 * time.Second}

// Capture posts one Sentry-compatible store event. It returns nil when no DSN
// is configured. The event must not include request bodies or children's answers.
func Capture(ctx context.Context, event Event) error {
	dsn := strings.TrimSpace(os.Getenv("SENTRY_DSN"))
	if dsn == "" || strings.TrimSpace(event.Message) == "" {
		return nil
	}
	endpoint, key, err := storeURL(dsn)
	if err != nil {
		return err
	}
	if event.Level == "" {
		event.Level = "error"
	}
	payload := map[string]any{
		"message":   event.Message,
		"level":     event.Level,
		"platform":  "go",
		"tags":      event.Tags,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"logger":    "nexuslearn",
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Sentry-Auth", "Sentry sentry_version=7, sentry_client=nexuslearn/0.4, sentry_key="+key)
	resp, err := HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return &sendError{status: resp.StatusCode}
	}
	return nil
}

type sendError struct{ status int }

func (e *sendError) Error() string { return "sentry rejected the event" }

func storeURL(dsn string) (string, string, error) {
	parsed, err := url.Parse(dsn)
	if err != nil {
		return "", "", err
	}
	project := strings.Trim(parsed.Path, "/")
	if parsed.User == nil || project == "" || parsed.Host == "" {
		return "", "", &sendError{status: 0}
	}
	key := parsed.User.Username()
	parsed.User = nil
	parsed.Path = "/api/" + project + "/store/"
	return parsed.String(), key, nil
}
