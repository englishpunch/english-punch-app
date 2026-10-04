package config

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"testing"

	"github.com/zalando/go-keyring"
)

func TestKeyringWriteDiagnostics(t *testing.T) {
	for _, tc := range []struct {
		name  string
		cause error
		want  string
	}{
		{"oversized", keyring.ErrSetDataTooBig, "reason=DATA_TOO_BIG"},
		{"wrapped oversized", fmt.Errorf("sensitive-marker: %w", keyring.ErrSetDataTooBig), "reason=DATA_TOO_BIG"},
		{"permission", &os.PathError{Op: "write", Path: "sensitive-marker", Err: os.ErrPermission}, "reason=PERMISSION_DENIED"},
		{"missing executable", &exec.Error{Name: "sensitive-marker", Err: exec.ErrNotFound}, "reason=HELPER_NOT_FOUND"},
		{"unknown", errors.New("sensitive-marker access_token refresh_token"), "reason=UNKNOWN"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			keyring.MockInitWithError(tc.cause)
			t.Cleanup(keyring.MockInit)
			s := &CredentialStore{Storage: "keyring"}
			err := s.writeData(&credentialData{Credentials: *testCredentials("secret-access-token")})
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("want %s, got %v", tc.want, err)
			}
			for _, secret := range []string{"sensitive-marker", "secret-access-token", "access_token", "refresh_token"} {
				if strings.Contains(fmt.Sprintf("%+v", err), secret) {
					t.Fatalf("diagnostic leaked %q", secret)
				}
			}
			if errors.Unwrap(err) != nil {
				t.Fatal("must not retain unsafe provider error")
			}
		})
	}
}

func TestKeyringExitDiagnostic(t *testing.T) {
	// Use the test executable so this works without a shell on every platform.
	if os.Getenv("EP_TEST_KEYRING_EXIT") == "1" {
		os.Exit(36)
	}
	cmd := exec.Command(os.Args[0], "-test.run=^TestKeyringExitDiagnostic$")
	cmd.Env = append(os.Environ(), "EP_TEST_KEYRING_EXIT=1")
	cause := cmd.Run()
	var exitErr *exec.ExitError
	if !errors.As(cause, &exitErr) {
		t.Fatalf("expected exit error, got %v", cause)
	}
	exitErr.Stderr = []byte("sensitive-marker")
	keyring.MockInitWithError(fmt.Errorf("secret-command: %w", cause))
	t.Cleanup(keyring.MockInit)
	s := &CredentialStore{Storage: "keyring"}
	_, err := s.Load()
	if err == nil || !strings.Contains(err.Error(), "reason=HELPER_EXIT") || !strings.Contains(err.Error(), "exit_status=36") {
		t.Fatalf("missing safe process diagnostics: %v", err)
	}
	if strings.Contains(err.Error(), "sensitive-marker") || strings.Contains(err.Error(), "secret-command") {
		t.Fatal("leaked raw provider error")
	}
}
