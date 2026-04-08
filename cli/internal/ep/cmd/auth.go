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

func newAuthCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "auth",
		Short: "Authentication commands",
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
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := cmd.Context()

			if email == "" || password == "" {
				if !term.IsTerminal(int(os.Stdin.Fd())) {
					return common.NewAuthError("not a terminal — use --email and --password flags", nil)
				}
			}

			if email == "" {
				fmt.Print("Email: ")
				reader := bufio.NewReader(os.Stdin)
				line, err := reader.ReadString('\n')
				if err != nil {
					return fmt.Errorf("read email: %w", err)
				}
				email = strings.TrimSpace(line)
			}

			if password == "" {
				fmt.Print("Password: ")
				raw, err := term.ReadPassword(int(os.Stdin.Fd()))
				if err != nil {
					return fmt.Errorf("read password: %w", err)
				}
				fmt.Println()
				password = string(raw)
			}

			// Validate credentials against Convex
			client, err := newConvexClient(ctx)
			if err != nil {
				return err
			}
			if err := client.SignIn(ctx, email, password); err != nil {
				return err
			}

			// Store in keychain
			if err := config.KeychainStore(email, password); err != nil {
				return fmt.Errorf("store credentials: %w", err)
			}

			fmt.Printf("Authenticated as %s\n", email)
			return nil
		},
	}

	cmd.Flags().StringVar(&email, "email", "", "Email address")
	cmd.Flags().StringVar(&password, "password", "", "Password")

	return cmd
}

func newAuthLogoutCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "logout",
		Short: "Log out of English Punch",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := config.KeychainDelete(); err != nil {
				return fmt.Errorf("logout: %w", err)
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
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := cmd.Context()

			creds, err := config.KeychainLoad()
			if err != nil {
				return common.NewAuthError("not logged in", err)
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
			convexURL := cfg.ConvexURL

			fmt.Printf("Logged in as %s\n", user.Email)
			fmt.Printf("Convex URL: %s\n", convexURL)
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
		return nil, nil, common.NewAuthError("not logged in — run 'ep auth login' first", err)
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
