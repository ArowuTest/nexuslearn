package server

import (
	"os"
	"testing"
)

func TestMain(m *testing.M) {
	// Existing handler tests authenticate with the old shared headers. The
	// product default is off; tests that cover that default clear this value.
	if os.Getenv("ALLOW_LEGACY_CREDENTIAL_HEADERS") == "" {
		_ = os.Setenv("ALLOW_LEGACY_CREDENTIAL_HEADERS", "true")
	}
	os.Exit(m.Run())
}
