package database

import (
	"context"
	"os"
	"testing"

	"github.com/ArowuTest/nexuslearn/apps/api/internal/platformenv"
)

func TestMain(m *testing.M) {
	platformenv.EnableTestProcess()
	os.Exit(m.Run())
}

func TestConnectRefusesMemoryInProduction(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("NEXUSLEARN_ENV", "production")
	t.Setenv("APP_ENV", "")
	t.Setenv("RENDER", "")
	_, err := Connect(context.Background())
	if err == nil {
		t.Fatal("production must not fall back to an in-memory repository")
	}
}
