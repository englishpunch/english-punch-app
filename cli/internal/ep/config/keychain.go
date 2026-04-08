package config

import (
	"fmt"
	"os/exec"
	"strings"
)

const keychainService = "english-punch-cli"

// Credentials holds email and password from the keychain.
type Credentials struct {
	Email    string
	Password string
}

// KeychainStore stores credentials in macOS Keychain.
func KeychainStore(email, password string) error {
	// Delete existing entry first (ignore errors if it doesn't exist)
	_ = KeychainDelete()

	cmd := exec.Command("security", "add-generic-password",
		"-s", keychainService,
		"-a", email,
		"-w", password,
		"-U", // update if exists
	)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("keychain store: %s: %w", strings.TrimSpace(string(out)), err)
	}
	return nil
}

// KeychainLoad reads credentials from macOS Keychain.
func KeychainLoad() (*Credentials, error) {
	// Get account name (email)
	email, err := keychainGetAccount()
	if err != nil {
		return nil, err
	}

	// Get password
	cmd := exec.Command("security", "find-generic-password",
		"-s", keychainService,
		"-w", // output password only
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("keychain load password: %s: %w", strings.TrimSpace(string(out)), err)
	}

	return &Credentials{
		Email:    email,
		Password: strings.TrimSpace(string(out)),
	}, nil
}

// KeychainDelete removes credentials from macOS Keychain.
func KeychainDelete() error {
	cmd := exec.Command("security", "delete-generic-password",
		"-s", keychainService,
	)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("keychain delete: %s: %w", strings.TrimSpace(string(out)), err)
	}
	return nil
}

// keychainGetAccount extracts the account (email) from a keychain entry.
func keychainGetAccount() (string, error) {
	cmd := exec.Command("security", "find-generic-password",
		"-s", keychainService,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("keychain find: %s: %w", strings.TrimSpace(string(out)), err)
	}

	// Parse "acct" attribute from output like:
	//     "acct"<blob>="user@example.com"
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, `"acct"`) {
			if idx := strings.Index(line, `="`); idx != -1 {
				val := line[idx+2:]
				if end := strings.LastIndex(val, `"`); end != -1 {
					return val[:end], nil
				}
			}
		}
	}
	return "", fmt.Errorf("keychain: account not found in entry")
}
