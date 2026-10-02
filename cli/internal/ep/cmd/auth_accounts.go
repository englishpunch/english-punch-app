package cmd

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
	"github.com/echoja/english-punch-app/cli/internal/ep/config"
	"github.com/spf13/cobra"
)

var accountListFields = append([]common.Field{{Name: "accounts", Type: "array"}, {Name: "environmentOverride", Type: "boolean"}}, credentialFields...)

func newAuthAccountsCmd() *cobra.Command {
	return &cobra.Command{
		Use: "accounts", Short: "List saved accounts in the selected credential backend",
		Long: `List saved account emails and the active selection without contacting the server.
Saved sessions may have expired; the next authenticated command refreshes them.
EP_TOKEN takes precedence over the saved selection when environmentOverride is true.
Tokens are never included. An empty account list is a successful result.`,
		Example: `  ep auth accounts
  ep auth accounts --json accounts,storage,environmentOverride`,
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if done, err := prepareAuthOutput(accountListFields, false); done || err != nil {
				return err
			}
			_, store, err := selectedCredentialStore()
			if err != nil {
				return err
			}
			accounts, err := store.Accounts()
			if err != nil {
				return credentialStorageError(store, "list accounts", err)
			}
			payload := credentialMetadata(store)
			payload["accounts"] = accounts
			payload["environmentOverride"] = os.Getenv("EP_TOKEN") != ""
			if handled, err := jsonFlag.HandleOutput(payload, accountListFields); handled {
				return err
			}
			for _, account := range accounts {
				fmt.Printf("%s active=%t\n", account.Email, account.Active)
			}
			if len(accounts) == 0 {
				fmt.Println("No saved accounts. Run ep auth login --web.")
			}
			if os.Getenv("EP_TOKEN") != "" {
				fmt.Println("EP_TOKEN overrides the saved selection.")
			}
			return nil
		},
	}
}

func newAuthSwitchCmd() *cobra.Command {
	return &cobra.Command{
		Use: "switch <email>", Short: "Select a previously saved account",
		Long: `Select an account from ep auth accounts without signing in again.
Repeating the same selection is safe. Switching also selects this credential
backend for future commands and uses that account's default bag. No network
request is made; expired sessions may require ep auth login on next use.
Unset EP_TOKEN before switching. Missing accounts produce NOT_LOGGED_IN.`,
		Example: `  ep auth switch me@example.com
  ep auth switch me@example.com --json ok,email,storage`,
		Args: cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if done, err := prepareAuthOutput(loginExtraFields, true); done || err != nil {
				return err
			}
			if len(args) != 1 || strings.TrimSpace(args[0]) == "" {
				return common.NewTokenError(common.TokenInvalidArgument, "an account email is required", nil)
			}
			if os.Getenv("EP_TOKEN") != "" {
				return common.NewAuthTokenError(common.TokenInvalidCredentials, "EP_TOKEN is set; unset it before switching accounts", nil)
			}
			cfg, store, err := selectedCredentialStore()
			if err != nil {
				return err
			}
			unlock, err := store.Lock(cmd.Context())
			if err != nil {
				return credentialStorageError(store, "lock credentials", err)
			}
			defer unlock()
			email := strings.TrimSpace(args[0])
			creds, err := store.AccountCredentials(email)
			if err != nil {
				return credentialStorageError(store, "find saved account", err)
			}
			if creds.Issuer != authIssuer || creds.Resource != cfg.ConvexURL || cfg.ConvexURL != authResource {
				return common.NewAuthTokenError(common.TokenInvalidCredentials, "saved account belongs to a different issuer or backend", nil)
			}
			if err := migrateAccountDefault(cfg, store); err != nil {
				return err
			}
			if err := store.Switch(email); err != nil {
				return credentialStorageError(store, "switch account", err)
			}
			cfg.AuthStorage = store.Storage
			if err := config.Save(configDir, cfg); err != nil {
				return common.NewTokenError(common.TokenConfigWriteFailed, "account selected, but could not save storage selection", err)
			}
			payload := credentialMetadata(store)
			payload["email"] = email
			if handled, err := jsonFlag.HandleOKOutput(payload, loginExtraFields); handled {
				return err
			}
			fmt.Printf("Switched to %s\n", email)
			return nil
		},
	}
}

// The old config value is used only by legacy credentials. Once migrated,
// defaults live with the account so switching never inherits someone else's bag.
func accountDefaultBag(cfg *config.Config) (string, error) {
	if os.Getenv("EP_TOKEN") != "" {
		return "", nil
	}
	store, err := config.NewCredentialStore(configDir, cfg, storageOverride)
	if err != nil {
		return "", common.NewTokenError(common.TokenInvalidArgument, "select credential storage", err)
	}
	creds, err := store.Load()
	if errors.Is(err, config.ErrCredentialsNotFound) {
		return "", nil
	}
	if err != nil {
		return "", credentialStorageError(store, "read account default", err)
	}
	if creds.AccountManaged {
		return creds.DefaultBagID, nil
	}
	return cfg.DefaultBagID, nil
}

func saveAccountDefault(ctx context.Context, bagID, expectedEmail string) error {
	if os.Getenv("EP_TOKEN") != "" {
		return common.NewTokenError(common.TokenInvalidArgument, "use --bag with EP_TOKEN; saved defaults belong to saved accounts", nil)
	}
	cfg, store, err := selectedCredentialStore()
	if err != nil {
		return err
	}
	unlock, err := store.Lock(ctx)
	if err != nil {
		return credentialStorageError(store, "lock credentials", err)
	}
	defer unlock()
	creds, err := store.Load()
	if err != nil {
		return credentialStorageError(store, "read account", err)
	}
	if expectedEmail != "" && creds.Email != expectedEmail {
		return common.NewAuthTokenError(common.TokenInvalidCredentials, "active account changed; retry", nil)
	}
	creds.DefaultBagID = bagID
	creds.AccountManaged = true
	if err := store.Save(creds); err != nil {
		return credentialStorageError(store, "save account default", err)
	}
	// Retain the legacy setting for older clients, but new clients always prefer
	// the default stored with managed credentials.
	cfg.DefaultBagID = bagID
	if err := config.Save(configDir, cfg); err != nil {
		return common.NewTokenError(common.TokenConfigWriteFailed, "save config", err)
	}
	return nil
}
