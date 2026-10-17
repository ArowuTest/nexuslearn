package platformenv

import "testing"

func TestProductionSignals(t *testing.T) {
	t.Setenv("NEXUSLEARN_ENV", "")
	t.Setenv("APP_ENV", "")
	t.Setenv("RENDER", "")
	if Production() {
		t.Fatal("empty environment is not production")
	}
	t.Setenv("RENDER", "true")
	if !Production() {
		t.Fatal("Render web services are production")
	}
	t.Setenv("RENDER", "")
	t.Setenv("APP_ENV", "production")
	if !Production() {
		t.Fatal("APP_ENV=production is production")
	}
}

func TestRetentionDays(t *testing.T) {
	t.Setenv("DATA_RETENTION_DAYS", "")
	days, err := RetentionDays()
	if err != nil || days != 730 {
		t.Fatalf("default retention = %d, %v", days, err)
	}
	t.Setenv("DATA_RETENTION_DAYS", "29")
	if _, err := RetentionDays(); err == nil {
		t.Fatal("retention below 30 days must be rejected")
	}
	t.Setenv("DATA_RETENTION_DAYS", "365")
	days, err = RetentionDays()
	if err != nil || days != 365 {
		t.Fatalf("configured retention = %d, %v", days, err)
	}
}
