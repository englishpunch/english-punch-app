package config

import (
	"encoding/base64"
	"errors"
	"fmt"
	"github.com/zalando/go-keyring"
	"strings"
	"testing"
)

type testKeyring struct {
	entries             map[string]string
	failSet, failDelete string
}

func (k *testKeyring) Get(_, a string) (string, error) {
	v, ok := k.entries[a]
	if !ok {
		return "", keyring.ErrNotFound
	}
	return v, nil
}
func (k *testKeyring) Set(_, a, v string) error {
	if a == k.failSet {
		return errors.New("injected failure")
	}
	command := fmt.Sprintf("add-generic-password -U -s %s -a %s -w go-keyring-base64:%s\n", keychainService, a, base64.StdEncoding.EncodeToString([]byte(v)))
	if len(command) > 4096 {
		return keyring.ErrSetDataTooBig
	}
	k.entries[a] = v
	return nil
}
func (k *testKeyring) Delete(_, a string) error {
	if a == k.failDelete {
		return errors.New("injected deletion failure")
	}
	delete(k.entries, a)
	return nil
}
func newTestKeyringStore() (*CredentialStore, *testKeyring) {
	k := &testKeyring{entries: map[string]string{}}
	return &CredentialStore{Storage: "keyring", keyring: k}, k
}
func TestSeparateKeyringAccountsExceedCombinedLimit(t *testing.T) {
	s, k := newTestKeyringStore()
	first := testCredentials(strings.Repeat("a", 1100))
	first.DefaultBagID = "first-bag"
	second := testCredentials(strings.Repeat("b", 1100))
	second.Email = "second@example.test"
	for _, c := range []*Credentials{first, second} {
		if err := s.Save(c); err != nil {
			t.Fatal(err)
		}
	}
	if len(k.entries) != 3 {
		t.Fatalf("want two accounts and index, got %d", len(k.entries))
	}
	if strings.Contains(k.entries[keychainAccount], "access_token") {
		t.Fatal("tokens in index")
	}
	if err := s.Switch(first.Email); err != nil {
		t.Fatal(err)
	}
	got, err := s.Load()
	if err != nil || *got != *first {
		t.Fatalf("switch lost credentials: %v", err)
	}
	if err := s.Delete(); err != nil {
		t.Fatal(err)
	}
	if len(k.entries) != 2 {
		t.Fatal("logout removed wrong entries")
	}
	got, err = s.AccountCredentials(second.Email)
	if err != nil || *got != *second {
		t.Fatalf("other account lost: %v", err)
	}
	if _, err := s.Load(); !errors.Is(err, ErrCredentialsNotFound) {
		t.Fatalf("logout activated fallback: %v", err)
	}
}
func TestKeyringLogoutRetriesCleanup(t *testing.T) {
	s, k := newTestKeyringStore()
	if err := s.Save(testCredentials("token")); err != nil {
		t.Fatal(err)
	}
	for a := range k.entries {
		if a != keychainAccount {
			k.failDelete = a
		}
	}
	if err := s.Delete(); err == nil {
		t.Fatal("expected delete error")
	}
	if _, err := s.Load(); err != nil {
		t.Fatalf("failed deletion lost account: %v", err)
	}
	k.failDelete = ""
	if err := s.Delete(); err != nil {
		t.Fatal(err)
	}
	if len(k.entries) != 1 {
		t.Fatal("retry left tokens behind")
	}
}

func TestKeyringLogoutIndexFailureDoesNotRestoreLogin(t *testing.T) {
	s, k := newTestKeyringStore()
	if err := s.Save(testCredentials("token")); err != nil {
		t.Fatal(err)
	}
	k.failSet = keychainAccount
	if err := s.Delete(); err == nil {
		t.Fatal("expected index failure")
	}
	if _, err := s.Load(); !errors.Is(err, ErrCredentialsNotFound) {
		t.Fatalf("logout restored account: %v", err)
	}
	k.failSet = ""
	if err := s.Delete(); err != nil {
		t.Fatal(err)
	}
	accounts, err := s.Accounts()
	if err != nil || len(accounts) != 0 {
		t.Fatalf("stale account remains: %v", err)
	}
}
func TestKeyringFailedAddPreservesActiveAccount(t *testing.T) {
	s, k := newTestKeyringStore()
	first := testCredentials("first")
	if err := s.Save(first); err != nil {
		t.Fatal(err)
	}
	second := testCredentials("second")
	second.Email = "second@example.test"
	k.failSet = accountKey(second.Email)
	if err := s.Save(second); err == nil {
		t.Fatal("expected account write failure")
	}
	got, err := s.Load()
	if err != nil || *got != *first {
		t.Fatalf("failed add lost active account: %v", err)
	}
	k.failSet = keychainAccount
	if err := s.Save(second); err == nil {
		t.Fatal("expected index write failure")
	}
	got, err = s.Load()
	if err != nil || *got != *first {
		t.Fatalf("failed index commit changed active account: %v", err)
	}
	k.failSet = ""
	if err := s.Save(second); err != nil {
		t.Fatal(err)
	}
}
