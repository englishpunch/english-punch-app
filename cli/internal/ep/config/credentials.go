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
	"sort"
	"time"

	"github.com/gofrs/flock"
	"github.com/zalando/go-keyring"
)

const keychainService = "english-punch-cli-oauth"
const keychainAccount = "session"

var ErrCredentialsNotFound = errors.New("credentials not found")

// Credentials contains OAuth tokens, never an account password.
type Credentials struct {
	Email          string `json:"email"`
	DefaultBagID   string `json:"default_bag_id,omitempty"`
	AccountManaged bool   `json:"account_managed,omitempty"`
	AccessToken    string `json:"access_token"`
	RefreshToken   string `json:"refresh_token"`
	ExpiresAt      int64  `json:"expires_at"`
	Issuer         string `json:"issuer"`
	Resource       string `json:"resource"`
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

// credentialData preserves the old top-level token format when migrating a
// single login. Saved accounts stay in the same protected backend, never config.
type credentialData struct {
	Credentials
	Accounts map[string]Credentials `json:"accounts,omitempty"`
	Version  int                    `json:"version,omitempty"`
}

type Account struct {
	Email  string `json:"email"`
	Active bool   `json:"active"`
}

func (s *CredentialStore) Load() (*Credentials, error) {
	data, err := s.readData()
	if err != nil {
		return nil, err
	}
	if !validCredentials(&data.Credentials) {
		return nil, ErrCredentialsNotFound
	}
	return &data.Credentials, nil
}

func (s *CredentialStore) readData() (*credentialData, error) {
	var raw []byte
	if s.Storage == "file" {
		var err error
		raw, err = s.readFile()
		if err != nil {
			return nil, err
		}
	} else {
		value, err := keyring.Get(keychainService, keychainAccount)
		if errors.Is(err, keyring.ErrNotFound) {
			return nil, ErrCredentialsNotFound
		}
		if err != nil {
			return nil, errors.New("could not read the system keyring")
		}
		raw = []byte(value)
	}
	var data credentialData
	if len(raw) > 64*1024 || json.Unmarshal(raw, &data) != nil {
		return nil, errors.New("invalid OAuth credential storage")
	}
	if data.Version != 0 && data.Version != 1 {
		return nil, errors.New("unsupported credential storage version")
	}
	if !validCredentials(&data.Credentials) && (data.Version != 1 || data.Credentials != (Credentials{})) {
		return nil, errors.New("invalid OAuth credentials; repair or remove the credential storage before signing in")
	}
	if data.Accounts == nil {
		data.Accounts = map[string]Credentials{}
	}
	for email, creds := range data.Accounts {
		if email == "" || email != creds.Email || !validCredentials(&creds) {
			return nil, errors.New("invalid saved account")
		}
	}
	if validCredentials(&data.Credentials) {
		data.Accounts[data.Email] = data.Credentials
	}
	return &data, nil
}

// Save replaces only this account and selects it. Callers hold Lock across
// read/modify/write, including token refresh, login, switching, and logout.
func (s *CredentialStore) Save(creds *Credentials) error {
	if !validCredentials(creds) || creds.Email == "" {
		return errors.New("OAuth credentials and email are required")
	}
	data, err := s.readData()
	if errors.Is(err, ErrCredentialsNotFound) {
		data = &credentialData{Accounts: map[string]Credentials{}}
	} else if err != nil {
		return err
	}
	data.Accounts[creds.Email] = *creds
	data.Credentials = *creds
	data.Version = 1
	return s.writeData(data)
}

func (s *CredentialStore) Accounts() ([]Account, error) {
	data, err := s.readData()
	if errors.Is(err, ErrCredentialsNotFound) {
		return []Account{}, nil
	}
	if err != nil {
		return nil, err
	}
	accounts := make([]Account, 0, len(data.Accounts))
	for email := range data.Accounts {
		accounts = append(accounts, Account{Email: email, Active: email == data.Email})
	}
	sort.Slice(accounts, func(i, j int) bool { return accounts[i].Email < accounts[j].Email })
	return accounts, nil
}

func (s *CredentialStore) AccountCredentials(email string) (*Credentials, error) {
	data, err := s.readData()
	if err != nil {
		return nil, err
	}
	creds, ok := data.Accounts[email]
	if !ok {
		return nil, ErrCredentialsNotFound
	}
	return &creds, nil
}

func (s *CredentialStore) Switch(email string) error {
	data, err := s.readData()
	if err != nil {
		return err
	}
	creds, ok := data.Accounts[email]
	if !ok {
		return ErrCredentialsNotFound
	}
	data.Credentials = creds
	data.Version = 1
	return s.writeData(data)
}

// Logout removes only the active account and never selects a fallback.
func (s *CredentialStore) Delete() error {
	data, err := s.readData()
	if errors.Is(err, ErrCredentialsNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	delete(data.Accounts, data.Email)
	if len(data.Accounts) > 0 {
		data.Credentials = Credentials{}
		data.Version = 1
		return s.writeData(data)
	}
	if s.Storage == "file" {
		err := os.Remove(s.Path)
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}
	if err := keyring.Delete(keychainService, keychainAccount); err != nil && !errors.Is(err, keyring.ErrNotFound) {
		return errors.New("could not remove English Punch credentials from the system keyring")
	}
	return nil
}

func (s *CredentialStore) writeData(data *credentialData) error {
	raw, err := json.Marshal(data)
	if err != nil || len(raw) > 64*1024 {
		return errors.New("credentials exceed the storage size limit")
	}
	if s.Storage == "file" {
		return s.writeFile(raw)
	}
	if err := keyring.Set(keychainService, keychainAccount, string(raw)); err != nil {
		return errors.New("could not write to the system keyring")
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

func (s *CredentialStore) readFile() ([]byte, error) {
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
	return data, nil
}

func (s *CredentialStore) writeFile(data []byte) error {
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
