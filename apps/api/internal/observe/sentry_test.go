package observe

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func TestCaptureDoesNothingWithoutDSN(t *testing.T) {
	t.Setenv("SENTRY_DSN", "")
	called := false
	previous := HTTPClient
	HTTPClient = &http.Client{Transport: roundTrip(func(*http.Request) (*http.Response, error) {
		called = true
		return nil, nil
	})}
	t.Cleanup(func() { HTTPClient = previous })
	if err := Capture(context.Background(), Event{Message: "database offline"}); err != nil {
		t.Fatal(err)
	}
	if called {
		t.Fatal("error reporting ran without a DSN")
	}
}

func TestCapturePostsSentryStoreEvent(t *testing.T) {
	var gotAuth, gotBody string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("X-Sentry-Auth")
		raw, _ := io.ReadAll(r.Body)
		gotBody = string(raw)
		if r.URL.Path != "/api/77/store/" {
			t.Errorf("path %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()
	t.Setenv("SENTRY_DSN", strings.Replace(server.URL, "http://", "http://public-key@", 1)+"/77")
	previous := HTTPClient
	HTTPClient = server.Client()
	t.Cleanup(func() { HTTPClient = previous })
	if err := Capture(context.Background(), Event{Message: "ready check failed", Tags: map[string]string{"route": "/readyz"}}); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(gotAuth, "sentry_key=public-key") || !strings.Contains(gotBody, "ready check failed") {
		t.Fatalf("auth %q body %s", gotAuth, gotBody)
	}
	if strings.Contains(gotBody, "public-key") {
		t.Fatal("event body included the DSN key")
	}
}

type roundTrip func(*http.Request) (*http.Response, error)

func (fn roundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return fn(r) }

func TestMain(m *testing.M) {
	os.Exit(m.Run())
}
