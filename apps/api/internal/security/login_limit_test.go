package security

import (
	"net/http"
	"testing"
	"time"
)

func TestLoginLimiterLocksAndClears(t *testing.T) {
	now := time.Date(2026, 10, 17, 9, 0, 0, 0, time.UTC)
	limiter := NewLoginLimiter()
	limiter.SetClock(func() time.Time { return now })
	key := "pupil:203.0.113.8:child-1"
	for i := 0; i < LoginFailureLimit-1; i++ {
		limiter.Fail(key)
		if blocked, _ := limiter.Blocked(key); blocked {
			t.Fatalf("locked after %d failures", i+1)
		}
	}
	limiter.Fail(key)
	blocked, retry := limiter.Blocked(key)
	if !blocked || retry < LoginLockWindow-time.Second {
		t.Fatalf("expected lock, blocked=%v retry=%s", blocked, retry)
	}
	limiter.Success(key)
	if blocked, _ := limiter.Blocked(key); blocked {
		t.Fatal("success should clear the lock")
	}
	limiter.Fail(key)
	now = now.Add(LoginLockWindow + time.Second)
	limiter.Fail(key)
	if blocked, _ := limiter.Blocked(key); blocked {
		t.Fatal("an old failure window should not still lock the family")
	}
}

func TestClientIPIgnoresForwardedHeaderUnlessTrusted(t *testing.T) {
	req, err := http.NewRequest(http.MethodPost, "/v1/auth/parent-login", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.RemoteAddr = "192.0.2.10:443"
	req.Header.Set("X-Forwarded-For", "198.51.100.7, 192.0.2.10")
	if ClientIP(req, false) != "192.0.2.10" {
		t.Fatalf("untrusted proxy used the spoofed address: %s", ClientIP(req, false))
	}
	if ClientIP(req, true) != "198.51.100.7" {
		t.Fatalf("trusted proxy ignored the first forwarded address: %s", ClientIP(req, true))
	}
}
