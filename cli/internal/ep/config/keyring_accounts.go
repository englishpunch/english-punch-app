package config

import (
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"sort"

	"github.com/zalando/go-keyring"
)

type keyringBackend interface {
	Get(service, account string) (string, error)
	Set(service, account, value string) error
	Delete(service, account string) error
}
type systemKeyring struct{}

func (systemKeyring) Get(s, a string) (string, error) { return keyring.Get(s, a) }
func (systemKeyring) Set(s, a, v string) error        { return keyring.Set(s, a, v) }
func (systemKeyring) Delete(s, a string) error        { return keyring.Delete(s, a) }
func (s *CredentialStore) keyringBackend() keyringBackend {
	if s.keyring != nil {
		return s.keyring
	}
	return systemKeyring{}
}

// A token-free index and individual account entries share a dedicated service.
// The old combined credential service is deliberately not read or migrated.
type keyringIndex struct {
	Version  int      `json:"version"`
	Active   string   `json:"active,omitempty"`
	Accounts []string `json:"accounts"`
}

func accountKey(email string) string { return fmt.Sprintf("account:%x", sha256.Sum256([]byte(email))) }

func (s *CredentialStore) readKeyringData() (*credentialData, error) {
	backend := s.keyringBackend()
	raw, err := backend.Get(keychainService, keychainAccount)
	if errors.Is(err, keyring.ErrNotFound) {
		return nil, ErrCredentialsNotFound
	}
	if err != nil {
		return nil, keyringFailure("read from", err)
	}
	var index keyringIndex
	if len(raw) > 64*1024 || json.Unmarshal([]byte(raw), &index) != nil || index.Version != 2 {
		return nil, errors.New("invalid Keychain account index")
	}
	data := &credentialData{Accounts: map[string]Credentials{}, Version: 1}
	for _, email := range index.Accounts {
		if _, exists := data.Accounts[email]; email == "" || exists {
			return nil, errors.New("invalid Keychain account index")
		}
		value, err := backend.Get(keychainService, accountKey(email))
		if errors.Is(err, keyring.ErrNotFound) {
			// Logout may have deleted the entry before its index update failed.
			continue
		}
		if err != nil {
			return nil, keyringFailure("read account from", err)
		}
		var creds Credentials
		if len(value) > 64*1024 || json.Unmarshal([]byte(value), &creds) != nil || !validCredentials(&creds) || creds.Email != email {
			return nil, errors.New("invalid Keychain account credentials")
		}
		data.Accounts[email] = creds
	}
	data.Credentials = data.Accounts[index.Active]
	return data, nil
}

func (s *CredentialStore) writeKeyringData(data *credentialData) error {
	previous, err := s.readKeyringData()
	if errors.Is(err, ErrCredentialsNotFound) {
		previous = &credentialData{Accounts: map[string]Credentials{}}
	} else if err != nil {
		return err
	}
	backend := s.keyringBackend()
	index := keyringIndex{Version: 2, Active: data.Email, Accounts: []string{}}
	for email := range data.Accounts {
		index.Accounts = append(index.Accounts, email)
	}
	sort.Strings(index.Accounts)
	// Store each account once; switching only needs to update the index.
	for _, email := range index.Accounts {
		creds := data.Accounts[email]
		if previous.Accounts[email] == creds {
			continue
		}
		raw, err := json.Marshal(creds)
		if err != nil {
			return errors.New("could not encode account credentials")
		}
		if err := backend.Set(keychainService, accountKey(email), string(raw)); err != nil {
			return keyringFailure("write account to", err)
		}
	}
	// Remove tokens before updating the index. Readers ignore absent entries,
	// so an interrupted logout cannot restore a deleted login.
	for email := range previous.Accounts {
		if _, kept := data.Accounts[email]; kept {
			continue
		}
		if err := backend.Delete(keychainService, accountKey(email)); err != nil && !errors.Is(err, keyring.ErrNotFound) {
			return keyringFailure("remove account from", err)
		}
	}
	return s.saveKeyringIndex(index)
}

func (s *CredentialStore) saveKeyringIndex(index keyringIndex) error {
	raw, err := json.Marshal(index)
	if err != nil {
		return errors.New("could not encode Keychain account index")
	}
	if err := s.keyringBackend().Set(keychainService, keychainAccount, string(raw)); err != nil {
		return keyringFailure("write account index to", err)
	}
	return nil
}
