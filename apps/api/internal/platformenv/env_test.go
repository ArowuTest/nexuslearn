package platformenv

import "testing"

func TestProductionDefaultsClosed(t *testing.T) {
	getenv := func(key string) string { return "" }
	if !production(getenv, false) {
		t.Fatal("an unmarked process is production")
	}
	if production(getenv, true) {
		t.Fatal("go test stays non-production until it opts in")
	}
	dev := func(key string) string {
		if key == "NEXUSLEARN_ENV" {
			return "development"
		}
		return ""
	}
	if production(dev, false) {
		t.Fatal("explicit development is not production")
	}
	render := func(key string) string {
		if key == "RENDER" {
			return "true"
		}
		if key == "NEXUSLEARN_ENV" {
			return "development"
		}
		return ""
	}
	if production(render, false) {
		t.Fatal("an explicit development flag wins over Render")
	}
	live := func(key string) string {
		if key == "APP_ENV" {
			return "production"
		}
		return ""
	}
	if !production(live, true) {
		t.Fatal("tests can still opt into production")
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
