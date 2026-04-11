package cmd

import (
	"fmt"
	"os/exec"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
	"github.com/spf13/cobra"
)

const webAppURL = "https://englishpunch.vercel.app"

var openFields = []common.Field{
	{Name: "url", Type: "string"},
}

func newOpenCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "open",
		Short: "Open English Punch in your browser",
		Long: `Launch the English Punch web app in the default browser
using the macOS "open" command.

Useful as a quick escape hatch from the CLI into the full web UI
(card editing, richer review screens, etc.). The URL is hard-coded
to the production deployment — there is no --url flag today because
the Convex deployment URL is already stored in config and the web
app URL rarely changes.`,
		Example: `  ep open
  ep open --json   # emits {"ok": true, "url": "..."}`,
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := exec.Command("open", webAppURL).Run(); err != nil {
				return fmt.Errorf("launch browser: %w", err)
			}

			if handled, err := jsonFlag.HandleOKOutput(
				map[string]any{"url": webAppURL},
				openFields,
			); handled {
				return err
			}
			fmt.Printf("Opened %s\n", webAppURL)
			return nil
		},
	}
}
