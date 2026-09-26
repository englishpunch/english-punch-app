package cmd

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/signal"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
	"github.com/spf13/cobra"
)

var (
	version         = "dev"
	configDir       string
	storageOverride string
	jsonFlag        common.JSONFlag
)

func NewRootCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "ep",
		Short: "CLI for English Punch flashcard app",
		Long: `ep is the command-line interface for the English Punch
flashcard app. It talks directly to the Convex backend over HTTPS
and is designed primarily as a tool callable by a Claude Code skill
(see docs/cli-llm-as-caller.md for the design rules every command
follows: --json everywhere, pattern-matchable error tokens,
idempotency, self-describing help, minimal chrome).

Human terminal use is supported as a side-effect, not the primary
design target.`,
		Example: `  # Log in (stores credentials in the OS keychain)
  ep auth login --web

  # Pick a default bag so card commands can omit --bag
  ep bags list --json _id,name
  ep bags default set k17abc...

  # Diagnostic health check
  ep doctor --json`,
		Version:       version,
		SilenceUsage:  true,
		SilenceErrors: true,
	}

	cmd.PersistentFlags().StringVar(&configDir, "config-dir", "", "Config directory (default: ~/.config/english-punch)")
	cmd.PersistentFlags().StringVar(&storageOverride, "storage", "", "Credential storage: keyring or file (default: saved selection, initially keyring). Login saves this selection; other commands only override it.")
	// --json is stripped from os.Args by JSONFlag.Parse() before cobra
	// sees them, so this persistent flag registration is purely for
	// documentation — cobra never actually parses a value. Declared on
	// the root so every subcommand shows it under "Global Flags".
	cmd.PersistentFlags().String("json", "", "Emit JSON output. Pass no value to list available fields, or a comma-separated list to filter.")

	cmd.AddCommand(newAuthCmd())
	cmd.AddCommand(newBagsCmd())
	cmd.AddCommand(newCardsCmd())
	cmd.AddCommand(newConfigCmd())
	cmd.AddCommand(newDoctorCmd())
	cmd.AddCommand(newOpenCmd())
	cmd.AddCommand(newReviewCmd())

	return cmd
}

func Execute() {
	jsonFlag.Parse()
	cmd := NewRootCmd()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()
	if err := cmd.ExecuteContext(ctx); err != nil {
		var exitErr *common.ExitError
		if errors.As(err, &exitErr) {
			fmt.Fprintln(os.Stderr, exitErr.Error())
			os.Exit(exitErr.Code)
		}
		fmt.Fprintln(os.Stderr, err.Error())
		os.Exit(common.ExitGeneralError)
	}
}
