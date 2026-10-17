// Package observe sends errors to Sentry only when SENTRY_DSN is set.
package observe

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// Capture reports an error when a DSN is configured. An empty DSN does nothing.
func Capture(err error) {
	if err == nil {
		return
	}
	dsn := strings.TrimSpace(os.Getenv("SENTRY_DSN"))
	if dsn == "" {
		return
	}
	endpoint, key, ok := sentryEndpoint(dsn)
	if !ok {
		slog.Warn("sentry dsn was ignored because it could not be parsed")
		return
	}
	payload, marshalErr := json.Marshal(map[string]any{
		"message":   err.Error(),
		"level":     "error",
		"platform":  "go",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"logger":    "nexuslearn-api",
	})
	if marshalErr != nil {
		return
	}
	request, reqErr := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(payload))
	if reqErr != nil {
		return
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Sentry-Auth", fmt.Sprintf("Sentry sentry_version=7, sentry_client=nexuslearn/1, sentry_key=%s", key))
	client := &http.Client{Timeout: 2 * time.Second}
	response, postErr := client.Do(request)
	if postErr != nil {
		slog.Warn("sentry report failed", "error", postErr)
		return
	}
	_ = response.Body.Close()
}

func sentryEndpoint(dsn string) (string, string, bool) {
	parsed, err := url.Parse(dsn)
	if err != nil || parsed.User == nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return "", "", false
	}
	key := parsed.User.Username()
	project := strings.Trim(parsed.Path, "/")
	if key == "" || project == "" {
		return "", "", false
	}
	return parsed.Scheme + "://" + parsed.Host + "/api/" + project + "/store/", key, true
}

// Recover turns a panic into a 500 and reports it when Sentry is configured.
func Recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			rec := recover()
			if rec == nil {
				return
			}
			Capture(fmt.Errorf("request panic"))
			slog.Error("request panic recovered")
			http.Error(w, "internal error", http.StatusInternalServerError)
		}()
		next.ServeHTTP(w, r)
	})
}
