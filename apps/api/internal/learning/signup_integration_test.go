package learning

import (
	"context"
	"errors"
	"testing"
	"time"
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
