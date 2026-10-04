package config

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"runtime"

	"github.com/zalando/go-keyring"
)

// keyringFailure exposes only typed, non-secret facts. Provider error strings,
// stderr, paths and command arguments may contain credentials. Do not wrap the
// original error: callers and loggers must not be able to unwrap and print it.
func keyringFailure(operation string, cause error) error {
	detail := "reason=UNKNOWN; provider supplied no recognized safe diagnostic"
	var exitErr *exec.ExitError
	switch {
	case errors.Is(cause, keyring.ErrSetDataTooBig):
		detail = "reason=DATA_TOO_BIG; credential entry exceeds the provider's per-item size limit"
		if runtime.GOOS == "darwin" {
			detail += "; macOS go-keyring limits the encoded security command to 4096 bytes"
		}
		detail += "; sign in with --storage file to use owner-only plaintext storage instead"
	case errors.Is(cause, os.ErrPermission):
		detail = "reason=PERMISSION_DENIED; the OS denied credential storage access; check Keychain access permissions and sandbox restrictions"
	case errors.Is(cause, exec.ErrNotFound), errors.Is(cause, os.ErrNotExist):
		detail = "reason=HELPER_NOT_FOUND; the credential helper or a required path is missing"
	case errors.As(cause, &exitErr):
		detail = fmt.Sprintf("reason=HELPER_EXIT; exit_status=%d; the credential helper failed", exitErr.ExitCode())
		if runtime.GOOS == "darwin" {
			detail += "; helper=/usr/bin/security; check that the login keychain is unlocked and access is allowed; this exit status is not a full Keychain OSStatus"
		}
	}
	return fmt.Errorf("could not %s the system keyring: %s", operation, detail)
}
