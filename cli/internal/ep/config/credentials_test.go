package config

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/zalando/go-keyring"
)

func testFileStore(t *testing.T) *CredentialStore {
	t.Helper()
	if runtime.GOOS == "windows" {
		t.Skip("file storage requires POSIX permissions")
	}
	s, err := NewCredentialStore(t.TempDir(), &Config{}, "file")
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestFileCredentialLifecycle(t *testing.T) {
	keyring.MockInitWithError(errors.New("keyring must not be accessed"))
	t.Cleanup(keyring.MockInit)
	s := testFileStore(t)
	if _, err := s.Load(); !errors.Is(err, ErrCredentialsNotFound) {
		t.Fatalf("missing credentials: %v", err)
	}
	for _, password := range []string{" original password \n", "한국어 updated password"} {
		want := testCredentials(password)
		if err := s.Save(want); err != nil {
			t.Fatal(err)
		}
		got, err := s.Load()
		if err != nil || *got != *want {
			t.Fatalf("credentials did not round-trip: %v", err)
		}
		for path, mode := range map[string]os.FileMode{s.Path: 0o600, filepath.Dir(s.Path): 0o700} {
			info, err := os.Stat(path)
			if err != nil || info.Mode().Perm() != mode {
				t.Fatalf("incorrect permissions for %s: %v", path, err)
			}
		}
		entries, err := os.ReadDir(filepath.Dir(s.Path))
		if err != nil || len(entries) != 1 {
			t.Fatalf("unexpected temporary files: %v", err)
		}
	}
	for range 2 {
		if err := s.Delete(); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := s.Load(); !errors.Is(err, ErrCredentialsNotFound) {
		t.Fatalf("credentials survived logout: %v", err)
	}
}

func TestFileCredentialsRejectUnsafeStorage(t *testing.T) {
	for _, tc := range []string{"file permissions", "directory permissions", "file symlink", "directory symlink", "malformed", "missing password", "oversized"} {
		t.Run(tc, func(t *testing.T) {
			s := testFileStore(t)
			if err := s.Save(testCredentials("sensitive-marker")); err != nil {
				t.Fatal(err)
			}
			var err error
			switch tc {
			case "file permissions":
				err = os.Chmod(s.Path, 0o644)
			case "directory permissions":
				err = os.Chmod(filepath.Dir(s.Path), 0o755)
			case "file symlink":
				target := filepath.Join(t.TempDir(), "target")
				if err := os.Rename(s.Path, target); err != nil {
					t.Fatal(err)
				}
				err = os.Symlink(target, s.Path)
			case "directory symlink":
				dir := filepath.Dir(s.Path)
				target := filepath.Join(t.TempDir(), "target")
				if err := os.Rename(dir, target); err != nil {
					t.Fatal(err)
				}
				err = os.Symlink(target, dir)
			case "malformed":
				err = os.WriteFile(s.Path, []byte(`{"password":"sensitive-marker","email":true}`), 0o600)
			case "missing password":
				err = os.WriteFile(s.Path, []byte(`{"email":"sensitive-marker"}`), 0o600)
			case "oversized":
				err = os.WriteFile(s.Path, []byte(strings.Repeat("sensitive-marker", 5000)), 0o600)
			}
			if err != nil {
				t.Fatal(err)
			}
			if _, err := s.Load(); err == nil || strings.Contains(err.Error(), "sensitive-marker") || errors.Is(err, ErrCredentialsNotFound) {
				t.Fatalf("expected sanitized storage error, got %v", err)
			}
			if strings.Contains(tc, "symlink") {
				if err := s.Save(testCredentials("new")); err == nil {
					t.Fatal("save followed a symlink")
				}
			}
		})
	}
}

func TestKeyringCredentialsAndBackendIsolation(t *testing.T) {
	keyring.MockInit()
	s, err := NewCredentialStore(t.TempDir(), &Config{}, "")
	if err != nil || s.Storage != "keyring" {
		t.Fatalf("default selection: %v", err)
	}
	// OAuth credentials round-trip as JSON in the dedicated keyring service.
	if err := s.Save(testCredentials("old-password")); err != nil {
		t.Fatal(err)
	}
	got, err := s.Load()
	if err != nil || got.AccessToken != "old-password" {
		t.Fatalf("could not read existing entry: %v", err)
	}
	if err := s.Save(testCredentials("new-password")); err != nil {
		t.Fatal(err)
	}
	got, err = s.Load()
	if err != nil || got.AccessToken != "new-password" {
		t.Fatalf("could not replace entry: %v", err)
	}
	for range 2 {
		if err := s.Delete(); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := s.Load(); !errors.Is(err, ErrCredentialsNotFound) {
		t.Fatalf("missing keyring entry: %v", err)
	}
	file := testFileStore(t)
	if err := file.Save(testCredentials("file-password")); err != nil {
		t.Fatal(err)
	}
	s.Path = file.Path
	keyring.MockInitWithError(errors.New("provider error containing sensitive-marker"))
	t.Cleanup(keyring.MockInit)
	if _, err := s.Load(); err == nil || errors.Is(err, ErrCredentialsNotFound) || strings.Contains(err.Error(), "sensitive-marker") {
		t.Fatalf("keyring errors must not fall back or leak provider details: %v", err)
	}
	if err := s.Save(testCredentials("new")); err == nil {
		t.Fatal("keyring save failure was ignored")
	}
	got, err = file.Load()
	if err != nil || got.AccessToken != "file-password" {
		t.Fatal("failed keyring save changed file credentials")
	}
}

func TestCredentialStorageSelection(t *testing.T) {
	for _, tc := range []struct{ saved, override, want string }{
		{"", "", "keyring"}, {"file", "", "file"}, {"file", "keyring", "keyring"}, {"keyring", "file", "file"},
	} {
		s, err := NewCredentialStore(t.TempDir(), &Config{AuthStorage: tc.saved}, tc.override)
		if err != nil || s.Storage != tc.want {
			t.Fatalf("selection %+v: %v", tc, err)
		}
	}
	if _, err := NewCredentialStore(t.TempDir(), &Config{}, "invalid"); err == nil {
		t.Fatal("accepted invalid storage")
	}
}

func testCredentials(token string) *Credentials {
	return &Credentials{Email: "user@example.test", AccessToken: token, RefreshToken: "refresh", ExpiresAt: 2000000000, Issuer: "https://ep.echoja.com", Resource: "https://ep-convex.echoja.com"}
}
