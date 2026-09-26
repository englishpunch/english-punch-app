package cmd

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"time"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
	"github.com/echoja/english-punch-app/cli/internal/ep/config"
	"github.com/echoja/english-punch-app/cli/internal/ep/convex"
	"github.com/echoja/english-punch-app/cli/internal/ep/oauth"
	"github.com/spf13/cobra"
)

var credentialFields = []common.Field{
	{Name: "storage", Type: "string"},
	{Name: "credentialsFile", Type: "string"},
	{Name: "plaintext", Type: "boolean"},
}

var authStatusFields = append([]common.Field{
	{Name: "loggedIn", Type: "boolean"},
	{Name: "email", Type: "string"},
	{Name: "convexUrl", Type: "string"},
}, credentialFields...)

var loginExtraFields = append([]common.Field{
	{Name: "email", Type: "string"},
}, credentialFields...)

func newAuthCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "auth",
		Short: "Authentication commands",
		Long: `Manage authentication against the English Punch Convex backend.

The default credential backend is the OS keyring. Explicitly select file
storage with ep auth login --storage file when the keyring is unavailable.
Login saves the selection for all subsequent commands. There is no automatic
fallback between backends. --storage overrides the selection for one command.

Both backends store OAuth access and refresh tokens. Authorize the displayed
device code in your browser; the CLI never asks for your password.
EP_TOKEN overrides saved tokens for authenticated commands.
File storage is plaintext, with owner-only POSIX permissions; it is not
supported on Windows. Never share the credentials file or commit it to Git.`,
	}
	cmd.AddCommand(newAuthLoginCmd(), newAuthLogoutCmd(), newAuthStatusCmd())
	return cmd
}

// Pinned in production; tests replace the issuer with an isolated local server.
var authIssuer = oauth.Issuer
var authResource = oauth.Resource

func newAuthLoginCmd() *cobra.Command {
	var web bool
	cmd := &cobra.Command{
		Use: "login", Short: "Log in using a browser and one-time device code",
		Long: `Start OAuth device authentication. Approve the displayed code in your browser.
Works without a local callback server or a terminal. Instructions go to stderr;
--json keeps stdout machine-readable. --web opens the approval page automatically.

The OS keyring is the default. --storage file explicitly stores OAuth tokens in
plaintext at <config-dir>/auth/credentials.json (0700 directory, 0600 file).
Login remembers the storage selection. Other stored logins are retained.
Access tokens refresh automatically; the selected storage must then be writable.
Legacy password logins require a new device login. No password is requested.
Each invocation starts a new approval request; Ctrl-C cancels polling.`,
		Example: `  ep auth login --web
  ep auth login --storage file
  ep auth login --storage file --json ok,email,storage`,
		RunE: func(cmd *cobra.Command, args []string) error {
			if done, err := prepareAuthOutput(loginExtraFields, true); done || err != nil {
				return err
			}
			if os.Getenv("EP_TOKEN") != "" {
				return common.NewAuthTokenError(common.TokenInvalidCredentials, "EP_TOKEN is set; unset it before saving a device login", nil)
			}
			cfg, store, err := selectedCredentialStore()
			if err != nil {
				return err
			}
			if cfg.ConvexURL != authResource {
				return common.NewTokenError(common.TokenInvalidArgument, "device login requires the English Punch production backend", nil)
			}
			oauthClient := oauth.NewClient(authIssuer, authResource)
			device, err := oauthClient.Start(cmd.Context())
			if err != nil {
				return oauthError(err)
			}
			_, _ = fmt.Fprintf(cmd.ErrOrStderr(), "Your one-time code: %s\nOpen %s and enter this code.\nWaiting for browser approval…\n", device.UserCode, device.VerificationURI)
			if web {
				if err := openDeviceBrowser(device.VerificationURIComplete); err != nil {
					_, _ = fmt.Fprintln(cmd.ErrOrStderr(), "Could not open a browser. Use the URL above on any device.")
				}
			}
			tokens, err := oauthClient.Poll(cmd.Context(), device)
			if err != nil {
				return oauthError(err)
			}
			client := convex.NewClient(cfg.ConvexURL)
			client.Token = tokens.AccessToken
			user, err := client.GetCurrentUser(cmd.Context())
			if err != nil {
				return err
			}
			creds := &config.Credentials{Email: user.Email, AccessToken: tokens.AccessToken, RefreshToken: tokens.RefreshToken,
				ExpiresAt: time.Now().Unix() + int64(tokens.ExpiresIn), Issuer: authIssuer, Resource: authResource}
			unlock, err := store.Lock(cmd.Context())
			if err != nil {
				return credentialStorageError(store, "lock credentials", err)
			}
			defer unlock()
			if err := saveLogin(cfg, store, creds); err != nil {
				return err
			}
			payload := credentialMetadata(store)
			payload["email"] = user.Email
			if handled, err := jsonFlag.HandleOKOutput(payload, loginExtraFields); handled {
				return err
			}
			fmt.Printf("Authenticated as %s\n", user.Email)
			printCredentialStorage(store)
			return nil
		}}
	cmd.Flags().BoolVar(&web, "web", false, "Open the device approval page in your browser")
	return cmd
}

func openDeviceBrowser(url string) error {
	switch runtime.GOOS {
	case "darwin":
		return exec.Command("open", url).Run()
	case "windows":
		return exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Run()
	default:
		return exec.Command("xdg-open", url).Run()
	}
}

func oauthError(err error) error {
	switch {
	case errors.Is(err, oauth.Error("access_denied")):
		return common.NewAuthTokenError(common.TokenDeviceAuthDenied, "device login was denied", nil)
	case errors.Is(err, oauth.Error("expired_token")), errors.Is(err, context.DeadlineExceeded):
		return common.NewAuthTokenError(common.TokenDeviceAuthExpired, "device login expired; run ep auth login again", nil)
	case errors.Is(err, context.Canceled):
		return common.NewAuthTokenError(common.TokenDeviceAuthCanceled, "device login canceled", nil)
	case errors.Is(err, oauth.Error("invalid_grant")):
		return common.NewAuthTokenError(common.TokenNotLoggedIn, "OAuth session expired or was revoked; run ep auth login", nil)
	default:
		return common.NewAuthTokenError(common.TokenOAuthFailed, "OAuth request failed", err)
	}
}

func newAuthLogoutCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "logout",
		Short: "Log out of English Punch",
		Long: `Remove credentials from the selected backend. Keyring logout removes
the English Punch CLI OAuth session in the OS keyring; file logout removes only
the credentials file under the current config directory. The other backend
is untouched. The selection is retained, so logout never activates a fallback.
This removes local credentials; it does not revoke issued server sessions.

Idempotent: succeeds if credentials are already absent.`,
		Example: `  ep auth logout
  ep auth logout --storage file --json ok,storage
  ep auth logout --storage keyring`,
		RunE: func(cmd *cobra.Command, args []string) error {
			if done, err := prepareAuthOutput(credentialFields, true); done || err != nil {
				return err
			}
			_, store, err := selectedCredentialStore()
			if err != nil {
				return err
			}
			if os.Getenv("EP_TOKEN") != "" {
				return common.NewAuthTokenError(common.TokenInvalidCredentials, "EP_TOKEN is set; unset it to log out of saved storage", nil)
			}
			unlock, err := store.Lock(cmd.Context())
			if err != nil {
				return credentialStorageError(store, "lock credentials", err)
			}
			defer unlock()
			if err := store.Delete(); err != nil {
				return credentialStorageError(store, "remove credentials", err)
			}
			if handled, err := jsonFlag.HandleOKOutput(credentialMetadata(store), credentialFields); handled {
				return err
			}
			fmt.Printf("Logged out of %s storage.\n", store.Storage)
			return nil
		},
	}
}

func newAuthStatusCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Short: "Show authentication status",
		Long: `Verify the selected credentials authenticate against Convex. Show the
account, backend URL, storage source, and credentials path (file storage only).
Never print a password or token. --storage overrides the saved backend.

Missing credentials produce NOT_LOGGED_IN; inaccessible or invalid storage
produces KEYCHAIN_FAILED or CREDENTIAL_STORAGE_FAILED. Network failures retain
CONVEX_* errors instead of being reported as an invalid login.`,
		Example: `  ep auth status
  ep auth status --json
  ep auth status --json email,storage,credentialsFile,plaintext`,
		RunE: func(cmd *cobra.Command, args []string) error {
			if done, err := prepareAuthOutput(authStatusFields, false); done || err != nil {
				return err
			}
			cfg, store, err := selectedCredentialStore()
			if err != nil {
				return err
			}
			_, user, err := authenticateFromStore(cmd.Context(), cfg, store)
			if err != nil {
				return err
			}
			status := credentialMetadata(store)
			if os.Getenv("EP_TOKEN") != "" {
				status = map[string]any{"storage": "environment", "credentialsFile": "", "plaintext": false}
			}
			status["loggedIn"] = true
			status["email"] = user.Email
			status["convexUrl"] = cfg.ConvexURL
			if handled, err := jsonFlag.HandleOutput(status, authStatusFields); handled {
				return err
			}
			fmt.Printf("Logged in as %s\nConvex URL: %s\n", user.Email, cfg.ConvexURL)
			if os.Getenv("EP_TOKEN") != "" {
				fmt.Println("Credential storage: environment (EP_TOKEN)")
			} else {
				printCredentialStorage(store)
			}
			return nil
		},
	}
}

// Validate JSON fields before any network or credential mutation.
func prepareAuthOutput(fields []common.Field, mutation bool) (bool, error) {
	if mutation {
		fields = append([]common.Field{{Name: "ok", Type: "boolean"}}, fields...)
	}
	if !jsonFlag.Used {
		return false, nil
	}
	if len(jsonFlag.Fields) == 0 {
		common.PrintFieldList(fields)
		return true, nil
	}
	for _, requested := range jsonFlag.Fields {
		found := false
		for _, field := range fields {
			if requested == field.Name {
				found = true
				break
			}
		}
		if !found {
			return false, common.NewTokenError(common.TokenInvalidArgument, "unknown JSON field: "+requested, nil)
		}
	}
	return false, nil
}

func selectedCredentialStore() (*config.Config, *config.CredentialStore, error) {
	cfg, err := config.Load(configDir)
	if err != nil {
		return nil, nil, common.NewTokenError(common.TokenConfigReadFailed, "load config", err)
	}
	store, err := config.NewCredentialStore(configDir, cfg, storageOverride)
	if err != nil {
		return nil, nil, common.NewTokenError(common.TokenInvalidArgument, "select credential storage", err)
	}
	return cfg, store, nil
}

func credentialStorageError(store *config.CredentialStore, action string, err error) error {
	if errors.Is(err, config.ErrCredentialsNotFound) {
		return common.NewAuthTokenError(common.TokenNotLoggedIn, "no credentials available in "+store.Storage+" storage; run ep auth login or select the intended --storage", nil)
	}
	if store.Storage == "keyring" {
		return common.NewTokenError(common.TokenKeychainFailed, action+" (keyring)", err)
	}
	return common.NewTokenError(common.TokenCredentialStorageFailed, action+" (file)", err)
}

func saveLogin(cfg *config.Config, store *config.CredentialStore, creds *config.Credentials) error {
	if err := store.Save(creds); err != nil {
		return credentialStorageError(store, "save credentials", err)
	}
	cfg.AuthStorage = store.Storage
	if err := config.Save(configDir, cfg); err != nil {
		return common.NewTokenError(common.TokenConfigWriteFailed, "credentials saved, but could not save storage selection", err)
	}
	return nil
}

func credentialMetadata(store *config.CredentialStore) map[string]any {
	path := ""
	if store.Storage == "file" {
		path = store.Path
	}
	return map[string]any{"storage": store.Storage, "credentialsFile": path, "plaintext": store.Storage == "file"}
}

func printCredentialStorage(store *config.CredentialStore) {
	fmt.Printf("Credential storage: %s\n", store.Storage)
	if store.Storage == "file" {
		fmt.Printf("Plaintext OAuth token file: %s\n", store.Path)
	}
}

func authenticatedClient(ctx context.Context) (*convex.Client, *convex.User, error) {
	cfg, store, err := selectedCredentialStore()
	if err != nil {
		return nil, nil, err
	}
	return authenticateFromStore(ctx, cfg, store)
}

func authenticateFromStore(ctx context.Context, cfg *config.Config, store *config.CredentialStore) (*convex.Client, *convex.User, error) {
	client := convex.NewClient(cfg.ConvexURL)
	if token := os.Getenv("EP_TOKEN"); token != "" {
		client.Token = token
	} else {
		creds, err := store.Load()
		if err != nil {
			return nil, nil, credentialStorageError(store, "load credentials", err)
		}
		if creds.Issuer != authIssuer || creds.Resource != cfg.ConvexURL || cfg.ConvexURL != authResource {
			return nil, nil, common.NewAuthTokenError(common.TokenInvalidCredentials, "saved OAuth tokens belong to a different issuer or backend; run ep auth login", nil)
		}
		if creds.ExpiresAt <= time.Now().Unix()+30 {
			unlock, err := store.Lock(ctx)
			if err != nil {
				return nil, nil, credentialStorageError(store, "lock credentials", err)
			}
			defer unlock()
			// Another command may have rotated the refresh token while we waited.
			creds, err = store.Load()
			if err != nil {
				return nil, nil, credentialStorageError(store, "reload credentials", err)
			}
			if creds.Issuer != authIssuer || creds.Resource != cfg.ConvexURL {
				return nil, nil, common.NewAuthTokenError(common.TokenInvalidCredentials, "credential binding changed; retry", nil)
			}
			if creds.ExpiresAt <= time.Now().Unix()+30 {
				tokens, err := oauth.NewClient(authIssuer, authResource).Refresh(ctx, creds.RefreshToken)
				if err != nil {
					return nil, nil, oauthError(err)
				}
				creds.AccessToken = tokens.AccessToken
				creds.RefreshToken = tokens.RefreshToken
				creds.ExpiresAt = time.Now().Unix() + int64(tokens.ExpiresIn)
				if err := store.Save(creds); err != nil {
					return nil, nil, credentialStorageError(store, "save refreshed tokens; login again if storage cannot be repaired", err)
				}
			}
		}
		client.Token = creds.AccessToken
	}
	user, err := client.GetCurrentUser(ctx)
	if err != nil {
		return nil, nil, err
	}
	return client, user, nil
}
