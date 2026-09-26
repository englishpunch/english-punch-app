package cmd

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
	"github.com/echoja/english-punch-app/cli/internal/ep/config"
	"github.com/echoja/english-punch-app/cli/internal/ep/oauth"
	"github.com/zalando/go-keyring"
)

const authTestEmail = "user@example.test"

func authTestSetup(t *testing.T) (string, *httptest.Server) {
	t.Helper()
	if runtime.GOOS == "windows" {
		t.Skip("file storage requires POSIX permissions")
	}
	keyring.MockInitWithError(errors.New("keyring unavailable"))
	t.Setenv("HOME", t.TempDir())
	t.Setenv("EP_TOKEN", "")
	t.Setenv("EP_AUTH_STORAGE", "")
	t.Setenv("EP_AUTH_EMAIL", "")
	t.Setenv("EP_CONVEX_URL", "")
	t.Cleanup(func() {
		configDir, storageOverride = "", ""
		jsonFlag = common.JSONFlag{}
		keyring.MockInit()
		authIssuer, authResource = oauth.Issuer, oauth.Resource
	})
	var refreshUsed atomic.Bool
	var server *httptest.Server
	server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			w.WriteHeader(http.StatusOK)
			return
		}
		if r.URL.Path == "/oauth/device/code" {
			_ = json.NewEncoder(w).Encode(map[string]any{"device_code": "device-secret", "user_code": "ABCD-EFGH", "verification_uri": server.URL + "/device", "expires_in": 60, "interval": 1})
			return
		}
		if r.URL.Path == "/oauth/token" {
			if err := r.ParseForm(); err != nil {
				t.Error(err)
				return
			}
			if r.Form.Get("grant_type") == "refresh_token" && !refreshUsed.CompareAndSwap(false, true) {
				t.Error("refresh token used twice")
				w.WriteHeader(400)
				return
			}

			_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "test-jwt-secret", "refresh_token": "refresh-secret", "token_type": "Bearer", "expires_in": 3600, "scope": "cli:access"})
			return
		}
		var req struct {
			Path string `json:"path"`
			Args struct {
				Params struct {
					Email, Password string
				} `json:"params"`
			} `json:"args"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Error(err)
			return
		}
		var value any
		switch req.Path {
		case "auth:loggedInUser":
			value = map[string]string{"_id": "user-1", "email": authTestEmail}
		case "learning:getUserBags":
			value = []map[string]string{{"_id": "bag-1", "name": "Vocabulary"}}
		default:
			t.Errorf("unexpected backend call: %s", req.Path)
		}
		if req.Path != "auth:signIn" && r.Header.Get("Authorization") != "Bearer test-jwt-secret" {
			t.Error("authenticated request is missing its token")
		}
		if err := json.NewEncoder(w).Encode(map[string]any{"value": value}); err != nil {
			t.Error(err)
		}
	}))
	t.Cleanup(server.Close)
	authIssuer, authResource = server.URL, server.URL
	dir := t.TempDir()
	if err := config.Save(dir, &config.Config{ConvexURL: server.URL, AuthStorage: "keyring"}); err != nil {
		t.Fatal(err)
	}
	return dir, server
}

func runAuthTestCommand(t *testing.T, dir string, fields []string, args ...string) (string, error) {
	t.Helper()
	jsonFlag = common.JSONFlag{Used: fields != nil, Fields: fields}
	root := NewRootCmd()
	root.SetArgs(append([]string{"--config-dir", dir}, args...))
	var err error
	output := captureStdout(t, func() { err = root.Execute() })
	if strings.Contains(output, "refresh-secret") || strings.Contains(output, "test-jwt-secret") {
		t.Fatal("credential leaked in command output")
	}
	return output, err
}

func requireAuthError(t *testing.T, err error, token string) {
	t.Helper()
	var exitErr *common.ExitError
	if !errors.As(err, &exitErr) || exitErr.Token != token {
		t.Fatalf("got %v, want %s", err, token)
	}
}

func TestAuthFileLoginAndAuthenticatedCommands(t *testing.T) {
	dir, _ := authTestSetup(t)
	out, err := runAuthTestCommand(t, dir, []string{"ok", "storage", "plaintext", "credentialsFile"}, "auth", "login", "--storage", "file")
	if err != nil {
		t.Fatal(err)
	}
	var login map[string]any
	if err := json.Unmarshal([]byte(out), &login); err != nil {
		t.Fatal(err)
	}
	if login["ok"] != true || login["storage"] != "file" || login["plaintext"] != true || login["credentialsFile"] != filepath.Join(dir, "auth", "credentials.json") {
		t.Fatalf("unexpected login metadata: %s", out)
	}
	for _, command := range [][]string{{"auth", "status"}, {"bags", "list"}, {"doctor"}, {"bags", "default", "set", "bag-1"}} {
		if _, err := runAuthTestCommand(t, dir, nil, command...); err != nil {
			t.Fatalf("%v: %v", command, err)
		}
	}
	cfg, err := config.Load(dir)
	if err != nil || cfg.AuthStorage != "file" || cfg.DefaultBagID != "bag-1" {
		t.Fatalf("saved selection lost after config mutation: %v", err)
	}
	// File logout cannot accidentally activate still-present keyring credentials.
	keyring.MockInit()
	if err := keyring.Set("english-punch-cli-oauth", "session", "retained"); err != nil {
		t.Fatal(err)
	}
	for range 2 {
		if _, err := runAuthTestCommand(t, dir, []string{"ok"}, "auth", "logout"); err != nil {
			t.Fatal(err)
		}
	}
	_, err = runAuthTestCommand(t, dir, nil, "auth", "status")
	requireAuthError(t, err, common.TokenNotLoggedIn)
	if _, err := keyring.Get("english-punch-cli-oauth", "session"); err != nil {
		t.Fatal("file logout removed keyring credentials")
	}
}

func TestAuthKeyringLogin(t *testing.T) {
	dir, _ := authTestSetup(t)
	keyring.MockInit()
	if _, err := runAuthTestCommand(t, dir, nil, "auth", "login"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dir, "auth", "credentials.json")); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("keyring created plaintext credentials")
	}
	if _, err := runAuthTestCommand(t, dir, nil, "auth", "status"); err != nil {
		t.Fatal(err)
	}
	for range 2 {
		if _, err := runAuthTestCommand(t, dir, nil, "auth", "logout"); err != nil {
			t.Fatal(err)
		}
	}
	_, err := runAuthTestCommand(t, dir, nil, "auth", "status")
	requireAuthError(t, err, common.TokenNotLoggedIn)
}

func TestAuthDiscoveryAndInvalidFieldsHaveNoSideEffects(t *testing.T) {
	dir, _ := authTestSetup(t)
	for _, name := range []string{"login", "logout", "status"} {
		out, err := runAuthTestCommand(t, dir, []string{}, "auth", name)
		if err != nil || !strings.Contains(out, "storage") {
			t.Fatalf("%s discovery: %v, %s", name, err, out)
		}
		_, err = runAuthTestCommand(t, dir, []string{"unknown"}, "auth", name, "--storage", "file")
		requireAuthError(t, err, common.TokenInvalidArgument)
	}
	if _, err := os.Stat(filepath.Join(dir, "auth")); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("JSON discovery or invalid fields accessed credential storage")
	}
}

func TestAuthStorageFailuresDoNotFallBack(t *testing.T) {
	dir, _ := authTestSetup(t)
	if _, err := runAuthTestCommand(t, dir, nil, "auth", "login", "--storage", "file"); err != nil {
		t.Fatal(err)
	}
	_, err := runAuthTestCommand(t, dir, nil, "auth", "status", "--storage", "keyring")
	requireAuthError(t, err, common.TokenKeychainFailed)
	_, err = runAuthTestCommand(t, dir, nil, "auth", "login", "--storage", "keyring")
	requireAuthError(t, err, common.TokenKeychainFailed)
	cfg, err := config.Load(dir)
	if err != nil || cfg.AuthStorage != "file" {
		t.Fatalf("failed login changed saved selection: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "auth", "credentials.json"), []byte(`{"password": "private-marker", "email": 7}`), 0o600); err != nil {
		t.Fatal(err)
	}
	_, err = runAuthTestCommand(t, dir, nil, "auth", "status")
	requireAuthError(t, err, common.TokenCredentialStorageFailed)
	if strings.Contains(err.Error(), "private-marker") {
		t.Fatal("storage error disclosed file contents")
	}
	out, err := runAuthTestCommand(t, dir, []string{"allOk", "checks"}, "doctor")
	if err != nil || !strings.Contains(out, common.TokenCredentialStorageFailed) || strings.Contains(out, "private-marker") {
		t.Fatalf("doctor did not distinguish storage failure: %v, %s", err, out)
	}
	_, err = runAuthTestCommand(t, dir, nil, "auth", "status", "--storage", "invalid")
	requireAuthError(t, err, common.TokenInvalidArgument)
}

func TestEnvironmentTokenBypassesStorage(t *testing.T) {
	dir, _ := authTestSetup(t)
	t.Setenv("EP_TOKEN", "test-jwt-secret")
	out, err := runAuthTestCommand(t, dir, []string{"storage", "email"}, "auth", "status")
	if err != nil || !strings.Contains(out, "environment") {
		t.Fatalf("%s %v", out, err)
	}
	if _, err := runAuthTestCommand(t, dir, nil, "bags", "list"); err != nil {
		t.Fatal(err)
	}
	if _, err := runAuthTestCommand(t, dir, nil, "auth", "login"); err == nil {
		t.Fatal("login ignored EP_TOKEN")
	}
	if _, err := runAuthTestCommand(t, dir, nil, "auth", "logout"); err == nil {
		t.Fatal("logout ignored EP_TOKEN")
	}
}

func TestConcurrentTokenRefresh(t *testing.T) {
	dir, _ := authTestSetup(t)
	cfg, err := config.Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	store, err := config.NewCredentialStore(dir, cfg, "file")
	if err != nil {
		t.Fatal(err)
	}
	creds := &config.Credentials{Email: authTestEmail, AccessToken: "expired", RefreshToken: "refresh-secret", ExpiresAt: time.Now().Unix() - 10, Issuer: authIssuer, Resource: authResource}
	if err := store.Save(creds); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	for range 5 {
		wg.Go(func() {
			if _, _, err := authenticateFromStore(context.Background(), cfg, store); err != nil {
				t.Error(err)
			}
		})
	}
	wg.Wait()
	got, err := store.Load()
	if err != nil || got.AccessToken != "test-jwt-secret" || got.ExpiresAt <= time.Now().Unix() {
		t.Fatalf("refresh not saved: %v", err)
	}
}
