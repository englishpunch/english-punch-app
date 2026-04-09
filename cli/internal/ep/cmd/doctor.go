package cmd

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/echoja/english-punch-app/cli/internal/ep/config"
	"github.com/spf13/cobra"
)

func newDoctorCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "doctor",
		Short: "Check CLI setup and connectivity",
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := cmd.Context()
			allOK := true

			// 1. Config
			cfg, err := config.Load(configDir)
			if err != nil {
				printCheck(false, "Config", err.Error())
				allOK = false
			} else {
				printCheck(true, "Config", cfg.ConvexURL)
			}

			// 2. Convex reachability
			if cfg != nil {
				if err := checkConvex(ctx, cfg.ConvexURL); err != nil {
					printCheck(false, "Convex", err.Error())
					allOK = false
				} else {
					printCheck(true, "Convex", "reachable")
				}
			}

			// 3. Keychain credentials
			creds, err := config.KeychainLoad()
			if err != nil {
				printCheck(false, "Keychain", "no credentials stored")
				allOK = false
			} else {
				printCheck(true, "Keychain", creds.Email)
			}

			// 4. Auth validation
			if creds != nil && cfg != nil {
				_, _, err := authenticatedClient(ctx)
				if err != nil {
					printCheck(false, "Auth", "credentials invalid")
					allOK = false
				} else {
					printCheck(true, "Auth", "credentials valid")
				}
			}

			if !allOK {
				fmt.Println("\nSome checks failed. Run 'ep auth login' to set up credentials.")
			} else {
				fmt.Println("\nAll checks passed.")
			}
			return nil
		},
	}
}

func printCheck(ok bool, name, detail string) {
	mark := "x"
	if ok {
		mark = "v"
	}
	fmt.Printf("  [%s] %-10s %s\n", mark, name, detail)
}

func checkConvex(ctx context.Context, baseURL string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL, nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("unreachable: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	return nil
}
