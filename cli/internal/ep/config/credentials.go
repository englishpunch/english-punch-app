package config

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"time"

	"github.com/gofrs/flock"
	"github.com/zalando/go-keyring"
)

const keychainService = "english-punch-cli-oauth"
const keychainAccount = "session"

var ErrCredentialsNotFound = errors.New("credentials not found")

// Credentials contains OAuth tokens, never an account password.
type Credentials struct {
	Email        string `json:"email"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresAt    int64  `json:"expires_at"`
	Issuer       string `json:"issuer"`
	Resource     string `json:"resource"`
}

func validCredentials(c *Credentials) bool {
	return c.AccessToken != "" && c.RefreshToken != "" && c.ExpiresAt > 0 && c.Issuer != "" && c.Resource != ""
}

// CredentialStore selects exactly one backend. It never falls back to another
// backend when storage is unavailable or its contents are invalid.
type CredentialStore struct {
	Storage string
	Path    string
}

func NewCredentialStore(configDir string, cfg *Config, override string) (*CredentialStore, error) {
	storage := cfg.AuthStorage
	if override != "" {
		storage = override
	}
	if storage == "" {
		storage = "keyring"
	}
	if storage != "keyring" && storage != "file" {
		return nil, errors.New("storage must be keyring or file")
	}
	if configDir == "" {
		configDir = DefaultConfigDir()
	}
	return &CredentialStore{
		Storage: storage,
		Path:    filepath.Join(configDir, "auth", "credentials.json"),
	}, nil
}

func (s *CredentialStore) Load() (*Credentials, error) {
	if s.Storage == "file" {
		return s.loadFile()
	}
	data, err := keyring.Get(keychainService, keychainAccount)
	if errors.Is(err, keyring.ErrNotFound) {
		return nil, ErrCredentialsNotFound
	}
	if err != nil {
		return nil, errors.New("could not read the system keyring")
	}
	var creds Credentials
	if json.Unmarshal([]byte(data), &creds) != nil || !validCredentials(&creds) {
		return nil, errors.New("invalid OAuth credentials; run ep auth login")
	}
	return &creds, nil
}

func (s *CredentialStore) Save(creds *Credentials) error {
	if !validCredentials(creds) {
		return errors.New("OAuth tokens and their issuer, resource, and expiry are required")
	}
	if s.Storage == "file" {
		return s.saveFile(creds)
	}
	data, err := json.Marshal(creds)
	if err != nil {
		return errors.New("could not encode credentials")
	}
	if err := keyring.Set(keychainService, keychainAccount, string(data)); err != nil {
		// Some providers include command details in errors. Keep secrets out of
		// diagnostics, even if a provider changes its error formatting.
		return errors.New("could not write to the system keyring")
	}
	return nil
}

// Delete removes only the selected backend. It never exposes a second backend
// as a fallback, and absence is success so logout can be retried safely.
func (s *CredentialStore) Delete() error {
	if s.Storage == "file" {
		if err := s.checkDirectory(false); err != nil {
			if errors.Is(err, os.ErrNotExist) {
				return nil
			}
			return err
		}
		err := os.Remove(s.Path)
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}
	if err := keyring.DeleteAll(keychainService); err != nil && !errors.Is(err, keyring.ErrNotFound) {
		return errors.New("could not remove English Punch credentials from the system keyring")
	}
	return nil
}

func (s *CredentialStore) checkDirectory(create bool) error {
	// POSIX modes do not enforce owner-only access on Windows. Use its native
	// credential manager until file storage has a Windows ACL implementation.
	if runtime.GOOS == "windows" {
		return errors.New("file storage requires POSIX permissions; use keyring on Windows")
	}
	dir := filepath.Dir(s.Path)
	if create {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return err
		}
	}
	info, err := os.Lstat(dir)
	if err != nil {
		return err
	}
	if !info.IsDir() || info.Mode().Perm()&0o077 != 0 {
		return errors.New("credentials directory must be a real directory with owner-only permissions (0700)")
	}
	return nil
}

func (s *CredentialStore) loadFile() (*Credentials, error) {
	if err := s.checkDirectory(false); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, ErrCredentialsNotFound
		}
		return nil, err
	}
	info, err := os.Lstat(s.Path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, ErrCredentialsNotFound
	}
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() || info.Mode().Perm()&0o077 != 0 {
		return nil, errors.New("credentials file must be a regular file with owner-only permissions (0600)")
	}
	f, err := os.Open(s.Path)
	if err != nil {
		return nil, err
	}
	defer func() { _ = f.Close() }()
	openedInfo, err := f.Stat()
	if err != nil {
		return nil, err
	}
	if !os.SameFile(info, openedInfo) || openedInfo.Mode().Perm()&0o077 != 0 {
		return nil, errors.New("credentials file changed while opening; retry the command")
	}
	data, err := io.ReadAll(io.LimitReader(f, 64*1024+1))
	if err != nil {
		return nil, err
	}
	var creds Credentials
	if len(data) > 64*1024 || json.Unmarshal(data, &creds) != nil || !validCredentials(&creds) {
		return nil, errors.New("credentials file is invalid; run ep auth login --storage file to replace it")
	}
	return &creds, nil
}

func (s *CredentialStore) saveFile(creds *Credentials) error {
	if err := s.checkDirectory(true); err != nil {
		return err
	}
	// Refuse surprising destinations. Atomic replacement below also avoids
	// following a symlink or changing another hard link to an existing file.
	info, err := os.Lstat(s.Path)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	if err == nil && !info.Mode().IsRegular() {
		return errors.New("credentials file must be a regular file")
	}
	data, err := json.Marshal(creds)
	if err != nil {
		return errors.New("could not encode credentials")
	}
	if len(data) > 64*1024 {
		return errors.New("credentials exceed the file size limit")
	}
	f, err := os.CreateTemp(filepath.Dir(s.Path), ".credentials-*")
	if err != nil {
		return err
	}
	defer func() { _ = f.Close(); _ = os.Remove(f.Name()) }()
	if err := f.Chmod(0o600); err != nil {
		return err
	}
	if _, err := f.Write(data); err != nil {
		return err
	}
	if err := f.Sync(); err != nil {
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	if err := os.Rename(f.Name(), s.Path); err != nil {
		return fmt.Errorf("replace credentials file: %w", err)
	}
	return nil
}

// Lock serializes rotating refresh tokens across CLI processes. Keyring uses a
// single account, so its lock is shared even across custom config directories.
func (s *CredentialStore) Lock(ctx context.Context) (func(), error) {
	path := s.Path + ".lock"
	if s.Storage == "keyring" {
		path = filepath.Join(DefaultConfigDir(), "auth", "keyring.lock")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, err
	}
	// Refuse symlinks rather than letting the lock library follow them.
	if info, err := os.Lstat(path); err == nil && !info.Mode().IsRegular() {
		return nil, errors.New("credential lock must be a regular file")
	}
	lock := flock.New(path, flock.SetPermissions(0o600))
	waitCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	ok, err := lock.TryLockContext(waitCtx, 50*time.Millisecond)
	if err != nil || !ok {
		_ = lock.Close()
		return nil, errors.New("could not lock credentials; retry the command")
	}
	return func() { _ = lock.Close() }, nil
}
