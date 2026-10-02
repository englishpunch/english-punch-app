package cmd

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
	"github.com/echoja/english-punch-app/cli/internal/ep/config"
)

func TestAccountCommandsAndDefaultIsolation(t *testing.T) {
	dir, _ := authTestSetup(t)
	configDir = dir
	cfg, err := config.Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	cfg.DefaultBagID = "legacy-bag"
	cfg.AuthStorage = "file"
	if err := config.Save(dir, cfg); err != nil {
		t.Fatal(err)
	}
	store, err := config.NewCredentialStore(dir, cfg, "file")
	if err != nil {
		t.Fatal(err)
	}
	first := &config.Credentials{Email: "first@example.test", AccessToken: "first-secret", RefreshToken: "first-refresh", ExpiresAt: time.Now().Unix() + 3600, Issuer: authIssuer, Resource: authResource}
	// Write the exact pre-migration single-account format.
	raw, err := json.Marshal(first)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Dir(store.Path), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(store.Path, raw, 0o600); err != nil {
		t.Fatal(err)
	}
	second := *first
	second.Email, second.AccessToken = "second@example.test", "second-secret"
	if err := saveLogin(cfg, store, &second); err != nil {
		t.Fatal(err)
	}
	if got, err := accountDefaultBag(cfg); err != nil || got != "" {
		t.Fatalf("new account inherited default: %q %v", got, err)
	}
	if err := saveAccountDefault(t.Context(), "second-bag", second.Email); err != nil {
		t.Fatal(err)
	}
	out, err := runAuthTestCommand(t, dir, []string{"accounts", "storage"}, "auth", "accounts")
	if err != nil || !strings.Contains(out, first.Email) || !strings.Contains(out, second.Email) || strings.Contains(out, "secret") || strings.Contains(out, "refresh") {
		t.Fatalf("account list: %s %v", out, err)
	}
	for range 2 {
		if _, err := runAuthTestCommand(t, dir, []string{"ok", "email"}, "auth", "switch", first.Email); err != nil {
			t.Fatal(err)
		}
	}
	if got, err := accountDefaultBag(cfg); err != nil || got != "legacy-bag" {
		t.Fatalf("lost migrated default: %q %v", got, err)
	}
	// A fresh login refreshes credentials without resetting the selected bag.
	if err := saveLogin(cfg, store, &second); err != nil {
		t.Fatal(err)
	}
	if got, err := accountDefaultBag(cfg); err != nil || got != "second-bag" {
		t.Fatalf("login reset saved default: %q %v", got, err)
	}
	_, err = runAuthTestCommand(t, dir, nil, "auth", "switch", "missing@example.test")
	requireAuthError(t, err, common.TokenNotLoggedIn)
	active, err := store.Load()
	if err != nil || active.Email != second.Email {
		t.Fatalf("failed switch changed active account: %v", err)
	}
	t.Setenv("EP_TOKEN", "environment-token")
	_, err = runAuthTestCommand(t, dir, nil, "auth", "switch", first.Email)
	requireAuthError(t, err, common.TokenInvalidCredentials)
}

func TestAccountDiscoveryDoesNotAccessStorage(t *testing.T) {
	dir, _ := authTestSetup(t)
	for _, command := range []string{"accounts", "switch"} {
		if _, err := runAuthTestCommand(t, dir, []string{}, "auth", command); err != nil {
			t.Fatal(err)
		}
		_, err := runAuthTestCommand(t, dir, []string{"invalid"}, "auth", command)
		requireAuthError(t, err, common.TokenInvalidArgument)
	}
	if _, err := os.Stat(filepath.Join(dir, "auth")); !os.IsNotExist(err) {
		t.Fatalf("discovery touched storage: %v", err)
	}
}
