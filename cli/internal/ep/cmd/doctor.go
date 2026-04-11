package cmd

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
	"github.com/echoja/english-punch-app/cli/internal/ep/config"
	"github.com/spf13/cobra"
)

var doctorFields = []common.Field{
	{Name: "allOk", Type: "boolean"},
	{Name: "checks", Type: "object[]"},
}

type doctorCheck struct {
	Name   string `json:"name"`
	OK     bool   `json:"ok"`
	Detail string `json:"detail"`
}

type doctorResult struct {
	AllOK  bool          `json:"allOk"`
	Checks []doctorCheck `json:"checks"`
}

func newDoctorCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "doctor",
		Short: "Check CLI setup and connectivity",
		Long: `Run diagnostic checks against the local config, Convex
reachability, keychain credentials, and end-to-end authentication.

Always exits 0 — individual check results are reported via the
printed output (or the --json payload). The skill should branch on
the allOk field or iterate the checks array; it must not infer
failure from the exit code.`,
		Example: `  ep doctor
  ep doctor --json
  ep doctor --json allOk
  ep doctor --json checks`,
		RunE: func(cmd *cobra.Command, args []string) error {
			if jsonFlag.Used && len(jsonFlag.Fields) == 0 {
				common.PrintFieldList(doctorFields)
				return nil
			}

			ctx := cmd.Context()
			result := doctorResult{AllOK: true}

			// 1. Config
			cfg, err := config.Load(configDir)
			if err != nil {
				result.Checks = append(result.Checks, doctorCheck{Name: "Config", OK: false, Detail: err.Error()})
				result.AllOK = false
			} else {
				result.Checks = append(result.Checks, doctorCheck{Name: "Config", OK: true, Detail: cfg.ConvexURL})
			}

			// 2. Convex reachability (skipped if config failed)
			if cfg != nil {
				if err := checkConvex(ctx, cfg.ConvexURL); err != nil {
					result.Checks = append(result.Checks, doctorCheck{Name: "Convex", OK: false, Detail: err.Error()})
					result.AllOK = false
				} else {
					result.Checks = append(result.Checks, doctorCheck{Name: "Convex", OK: true, Detail: "reachable"})
				}
			}

			// 3. Keychain credentials
			creds, err := config.KeychainLoad()
			if err != nil {
				result.Checks = append(result.Checks, doctorCheck{Name: "Keychain", OK: false, Detail: "no credentials stored"})
				result.AllOK = false
			} else {
				result.Checks = append(result.Checks, doctorCheck{Name: "Keychain", OK: true, Detail: creds.Email})
			}

			// 4. Auth validation (end-to-end)
			if creds != nil && cfg != nil {
				if _, _, err := authenticatedClient(ctx); err != nil {
					result.Checks = append(result.Checks, doctorCheck{Name: "Auth", OK: false, Detail: "credentials invalid"})
					result.AllOK = false
				} else {
					result.Checks = append(result.Checks, doctorCheck{Name: "Auth", OK: true, Detail: "credentials valid"})
				}
			}

			if handled, err := jsonFlag.HandleOutput(result, doctorFields); handled {
				return err
			}

			for _, c := range result.Checks {
				printCheck(c.OK, c.Name, c.Detail)
			}
			if !result.AllOK {
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
