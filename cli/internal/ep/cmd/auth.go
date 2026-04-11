package cmd

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
	"github.com/echoja/english-punch-app/cli/internal/ep/config"
	"github.com/echoja/english-punch-app/cli/internal/ep/convex"
	"github.com/spf13/cobra"
	"golang.org/x/term"
)

var authStatusFields = []common.Field{
	{Name: "loggedIn", Type: "boolean"},
	{Name: "email", Type: "string"},
	{Name: "convexUrl", Type: "string"},
}

var loginExtraFields = []common.Field{
	{Name: "email", Type: "string"},
}

func newAuthCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "auth",
		Short: "Authentication commands",
		Long: `Manage authentication against the English Punch Convex backend.

Credentials are stored in the OS keychain (macOS only today). Every
subsequent command re-reads them and exchanges them for a short-lived
JWT — there is no long-lived token cached in a file.`,
	}

	cmd.AddCommand(newAuthLoginCmd())
	cmd.AddCommand(newAuthLogoutCmd())
	cmd.AddCommand(newAuthStatusCmd())

	return cmd
}

func newAuthLoginCmd() *cobra.Command {
	var email, password string

	cmd := &cobra.Command{
		Use:   "login",
		Short: "Log in to English Punch",
		Long: `Log in by validating credentials against Convex and storing
them in the OS keychain.

In a terminal, --email and --password may be omitted and the command
will prompt interactively. In non-TTY contexts (scripts, CI, Claude
Code Bash tool calls) both flags MUST be provided or the command exits
with NOT_A_TTY.`,
		Example: `  # Interactive (prompts for email and password)
  ep auth login

  # Non-interactive (required for scripts and LLM callers)
  ep auth login --email you@example.com --password hunter2

  # JSON output (on success, emits {"ok": true, "email": "..."})
  ep auth login --email you@example.com --password hunter2 --json`,
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := cmd.Context()

			if email == "" || password == "" {
				if !term.IsTerminal(int(os.Stdin.Fd())) {
					return common.NewAuthTokenError(
						common.TokenNotATTY,
						"stdin is not a terminal — pass --email and --password flags",
						nil,
					)
				}
			}

			if email == "" {
				fmt.Print("Email: ")
				reader := bufio.NewReader(os.Stdin)
				line, err := reader.ReadString('\n')
				if err != nil {
					return common.NewAuthTokenError(common.TokenNotATTY, "read email", err)
				}
				email = strings.TrimSpace(line)
			}

			if password == "" {
				fmt.Print("Password: ")
				raw, err := term.ReadPassword(int(os.Stdin.Fd()))
				if err != nil {
					return common.NewAuthTokenError(common.TokenNotATTY, "read password", err)
				}
				fmt.Println()
				password = string(raw)
			}

			client, err := newConvexClient(ctx)
			if err != nil {
				return err
			}
			if err := client.SignIn(ctx, email, password); err != nil {
				return err
			}

			if err := config.KeychainStore(email, password); err != nil {
				return common.NewTokenError(common.TokenKeychainFailed, "store credentials", err)
			}

			if handled, err := jsonFlag.HandleOKOutput(
				map[string]any{"email": email},
				loginExtraFields,
			); handled {
				return err
			}
			fmt.Printf("Authenticated as %s\n", email)
			return nil
		},
	}

	cmd.Flags().StringVar(&email, "email", "", "Email address. Required in non-TTY contexts.")
	cmd.Flags().StringVar(&password, "password", "", "Password. Required in non-TTY contexts.")

	return cmd
}

func newAuthLogoutCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "logout",
		Short: "Log out of English Punch",
		Long: `Remove the stored credentials from the OS keychain.

Idempotent — succeeds quietly if no credentials were stored.`,
		Example: `  ep auth logout
  ep auth logout --json   # emits {"ok": true}`,
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := config.KeychainDelete(); err != nil {
				return common.NewTokenError(common.TokenKeychainFailed, "logout", err)
			}
			if handled, err := jsonFlag.HandleOKOutput(nil, nil); handled {
				return err
			}
			fmt.Println("Logged out.")
			return nil
		},
	}
}

func newAuthStatusCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Short: "Show authentication status",
		Long: `Verify the stored credentials still authenticate against
Convex and print the logged-in email plus the Convex URL in use.

Exit code 2 (ExitAuthError) with token NOT_LOGGED_IN if no credentials
are stored or the stored credentials are rejected. Exit code 3
(ExitConnectionError) with a CONVEX_* token if Convex is unreachable.`,
		Example: `  ep auth status
  ep auth status --json
  ep auth status --json email,convexUrl`,
		RunE: func(cmd *cobra.Command, args []string) error {
			if jsonFlag.Used && len(jsonFlag.Fields) == 0 {
				common.PrintFieldList(authStatusFields)
				return nil
			}

			ctx := cmd.Context()

			creds, err := config.KeychainLoad()
			if err != nil {
				return common.NewAuthTokenError(common.TokenNotLoggedIn, "no credentials in keychain", err)
			}

			client, err := newConvexClient(ctx)
			if err != nil {
				return err
			}
			if err := client.SignIn(ctx, creds.Email, creds.Password); err != nil {
				return err
			}

			user, err := client.GetCurrentUser(ctx)
			if err != nil {
				return err
			}

			cfg, _ := config.Load(configDir)
			status := map[string]any{
				"loggedIn":  true,
				"email":     user.Email,
				"convexUrl": cfg.ConvexURL,
			}

			if handled, err := jsonFlag.HandleOutput(status, authStatusFields); handled {
				return err
			}

			fmt.Printf("Logged in as %s\n", user.Email)
			fmt.Printf("Convex URL: %s\n", cfg.ConvexURL)
			return nil
		},
	}
}

// newConvexClient creates a Convex client from config.
func newConvexClient(ctx context.Context) (*convex.Client, error) {
	cfg, err := config.Load(configDir)
	if err != nil {
		return nil, fmt.Errorf("load config: %w", err)
	}
	return convex.NewClient(cfg.ConvexURL), nil
}

// authenticatedClient loads credentials, signs in, and returns a ready client + user ID.
func authenticatedClient(ctx context.Context) (*convex.Client, *convex.User, error) {
	creds, err := config.KeychainLoad()
	if err != nil {
		return nil, nil, common.NewAuthTokenError(
			common.TokenNotLoggedIn,
			"no credentials in keychain — run 'ep auth login' first",
			err,
		)
	}

	client, err := newConvexClient(ctx)
	if err != nil {
		return nil, nil, err
	}

	if err := client.SignIn(ctx, creds.Email, creds.Password); err != nil {
		return nil, nil, err
	}

	user, err := client.GetCurrentUser(ctx)
	if err != nil {
		return nil, nil, err
	}

	return client, user, nil
}
