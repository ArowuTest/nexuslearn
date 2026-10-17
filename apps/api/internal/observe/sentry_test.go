package observe

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

func TestCaptureIsQuietWithoutDSN(t *testing.T) {
	t.Setenv("SENTRY_DSN", "")
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		calls.Add(1)
	}))
	defer server.Close()
	Capture(errors.New("unused"))
	if calls.Load() != 0 {
		t.Fatal("sentry was called without a DSN")
	}
}

func TestCapturePostsWhenDSNIsSet(t *testing.T) {
	var body []byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ = io.ReadAll(r.Body)
		if r.Header.Get("X-Sentry-Auth") == "" {
			t.Error("missing sentry auth header")
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()
	t.Setenv("SENTRY_DSN", "http://public@"+server.Listener.Addr().String()+"/42")
	Capture(errors.New("boom"))
	if !strings.Contains(string(body), "boom") {
		t.Fatalf("sentry body = %s", body)
	}
}

func TestRecoverReportsPanic(t *testing.T) {
	var seen atomic.Bool
	server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		seen.Store(true)
	}))
	defer server.Close()
	t.Setenv("SENTRY_DSN", "http://public@"+server.Listener.Addr().String()+"/42")
	handler := Recover(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("child data must not be copied into this message")
	}))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if response.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d", response.Code)
	}
	if !seen.Load() {
		t.Fatal("panic was not reported")
	}
	if strings.Contains(response.Body.String(), "child data") {
		t.Fatal("panic text was returned to the caller")
	}
}
