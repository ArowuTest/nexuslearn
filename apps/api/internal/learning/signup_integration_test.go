package learning

import (
	"context"
	"errors"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"
)

func TestSignupDoesNotReplaceAnExistingAdministrator(t *testing.T) {
	_, repo := openPaginationIntegrationRepository(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if _, err := repo.UpsertPlatformUser(ctx, PlatformUserConfig{
		Email: "root@example.test", DisplayName: "Root", LoginID: "root@example.test", Roles: []string{"platform_admin"},
	}, "correct-horse-battery"); err != nil {
		t.Fatal(err)
	}
	_, err := repo.CreateParentAccount(ctx, ParentAccountConfig{
		Email: "root@example.test", DisplayName: "Attacker", Password: "another-secure-password",
	})
	if !errors.Is(err, ErrParentAccountExists) {
		t.Fatalf("existing admin signup = %v", err)
	}
	if _, ok, err := repo.VerifyPlatformUser(ctx, "root@example.test", "correct-horse-battery"); err != nil || !ok {
		t.Fatalf("original administrator password no longer works: ok=%v err=%v", ok, err)
	}
	if _, ok, err := repo.VerifyPlatformUser(ctx, "root@example.test", "another-secure-password"); err != nil || ok {
		t.Fatal("signup replaced the administrator password")
	}
	created, err := repo.CreateParentAccount(ctx, ParentAccountConfig{
		Email: "new-parent@example.test", DisplayName: "New Parent", Password: "a-brand-new-password",
	})
	if err != nil || created.ID == "" || created.Password != "" {
		t.Fatalf("new parent = %#v, %v", created, err)
	}
	_, err = repo.CreateParentAccount(ctx, ParentAccountConfig{
		Email: "new-parent@example.test", DisplayName: "Second try", Password: "a-different-password",
	})
	if !errors.Is(err, ErrParentAccountExists) {
		t.Fatalf("duplicate parent signup = %v", err)
	}
}

func TestCreateParentAccountCallsHasherForNewAndExistingEmail(t *testing.T) {
	pool, repo := openPaginationIntegrationRepository(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	var calls []bool
	original := signupPasswordWork
	signupPasswordWork = func(loginID, password string, existing bool) string {
		calls = append(calls, existing)
		if existing {
			return "must-not-be-stored"
		}
		if loginID != "hasher-parent@example.test" || password != "a-brand-new-password" {
			t.Errorf("new-account hasher saw login %q password %q", loginID, password)
		}
		return "test-hash"
	}
	t.Cleanup(func() { signupPasswordWork = original })

	created, err := repo.CreateParentAccount(ctx, ParentAccountConfig{
		Email: "hasher-parent@example.test", DisplayName: "Hasher Parent", Password: "a-brand-new-password",
	})
	if err != nil || created.ID == "" {
		t.Fatalf("new parent = %#v, %v", created, err)
	}
	var stored string
	if err := pool.QueryRow(ctx, `SELECT password_hash FROM app_users WHERE id = $1::uuid`, created.ID).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if stored != "test-hash" {
		t.Fatalf("stored hash = %q", stored)
	}
	_, err = repo.CreateParentAccount(ctx, ParentAccountConfig{
		Email: "hasher-parent@example.test", DisplayName: "Second try", Password: "another-password-value",
	})
	if !errors.Is(err, ErrParentAccountExists) {
		t.Fatalf("duplicate parent signup = %v", err)
	}
	if err := pool.QueryRow(ctx, `SELECT password_hash FROM app_users WHERE id = $1::uuid`, created.ID).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if stored != "test-hash" {
		t.Fatalf("existing email replaced the stored hash with %q", stored)
	}
	if len(calls) != 2 || calls[0] || !calls[1] {
		t.Fatalf("hasher calls = %v, want new account then existing email", calls)
	}
}

func TestSignupPasswordWorkMatchesBcryptCost(t *testing.T) {
	const password = "correct-horse"
	hash := signupPasswordWork("parent@example.test", password, false)
	cost, err := bcrypt.Cost([]byte(hash))
	if err != nil || cost != bcrypt.DefaultCost {
		t.Fatalf("new account hash cost = %d, err = %v", cost, err)
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil {
		t.Fatal("new account hash does not match the supplied password")
	}
	compared := 0
	original := compareSignupPassword
	compareSignupPassword = func(hashedPassword, supplied []byte) error {
		compared++
		if mustCost(hashedPassword) != bcrypt.DefaultCost {
			t.Errorf("dummy compare cost = %d", mustCost(hashedPassword))
		}
		return original(hashedPassword, supplied)
	}
	t.Cleanup(func() { compareSignupPassword = original })
	if got := signupPasswordWork("parent@example.test", password, true); got != "" {
		t.Fatalf("existing email hasher returned %q", got)
	}
	if compared != 1 {
		t.Fatalf("existing email path compared the password %d times", compared)
	}
	dummyCost, err := bcrypt.Cost(dummySignupHash)
	if err != nil || dummyCost != cost {
		t.Fatalf("dummy hash cost = %d, new hash cost = %d, err = %v", dummyCost, cost, err)
	}
}

func mustCost(hash []byte) int {
	cost, err := bcrypt.Cost(hash)
	if err != nil {
		return -1
	}
	return cost
}
