// Package security holds request protections that must not depend on a database.
package security

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	LoginFailureLimit = 8
	LoginLockWindow   = 15 * time.Minute
)

type attempt struct {
	failures int
	lockedTo time.Time
	windowAt time.Time
}

// LoginLimiter locks a login identity after repeated failures.
// A successful login clears the count. The limiter is in-memory: a process
// restart clears it, which is acceptable for a single family API instance.
type LoginLimiter struct {
	mu       sync.Mutex
	attempts map[string]*attempt
	now      func() time.Time
	limit    int
	window   time.Duration
}

func NewLoginLimiter() *LoginLimiter {
	return &LoginLimiter{
		attempts: map[string]*attempt{},
		now:      time.Now,
		limit:    LoginFailureLimit,
		window:   LoginLockWindow,
	}
}

func (l *LoginLimiter) SetClock(now func() time.Time) {
	if l == nil || now == nil {
		return
	}
	l.mu.Lock()
	l.now = now
	l.mu.Unlock()
}

// Blocked reports whether the key is currently locked and for how long.
func (l *LoginLimiter) Blocked(key string) (bool, time.Duration) {
	if l == nil {
		return false, 0
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	state := l.attempts[key]
	if state == nil {
		return false, 0
	}
	now := l.now()
	if !state.lockedTo.IsZero() && now.Before(state.lockedTo) {
		return true, state.lockedTo.Sub(now)
	}
	if !state.windowAt.IsZero() && now.Sub(state.windowAt) > l.window {
		delete(l.attempts, key)
	}
	return false, 0
}

func (l *LoginLimiter) Fail(key string) {
	if l == nil || key == "" {
		return
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	state := l.attempts[key]
	if state == nil || (!state.windowAt.IsZero() && now.Sub(state.windowAt) > l.window) {
		state = &attempt{windowAt: now}
		l.attempts[key] = state
	}
	state.failures++
	if state.failures >= l.limit {
		state.lockedTo = now.Add(l.window)
	}
}

func (l *LoginLimiter) Success(key string) {
	if l == nil || key == "" {
		return
	}
	l.mu.Lock()
	delete(l.attempts, key)
	l.mu.Unlock()
}

func ClientIP(r *http.Request, trustProxy bool) string {
	if r == nil {
		return ""
	}
	if trustProxy {
		if forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); forwarded != "" {
			return strings.TrimSpace(strings.Split(forwarded, ",")[0])
		}
	}
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err != nil {
		return strings.TrimSpace(r.RemoteAddr)
	}
	return host
}
