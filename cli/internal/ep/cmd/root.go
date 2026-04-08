package cmd

import (
	"errors"
	"fmt"
	"os"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
	"github.com/spf13/cobra"
)

var (
	version      = "dev"
	outputFormat string
	configDir    string
)

func NewRootCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:           "ep",
		Short:         "CLI for English Punch flashcard app",
		Version:       version,
		SilenceUsage:  true,
		SilenceErrors: true,
	}

	cmd.PersistentFlags().StringVarP(&outputFormat, "output", "o", "table", "Output format: table or json")
	cmd.PersistentFlags().StringVar(&configDir, "config-dir", "", "Config directory (default: ~/.config/english-punch)")

	cmd.AddCommand(newAuthCmd())
	cmd.AddCommand(newBagsCmd())

	return cmd
}

func Execute() {
	cmd := NewRootCmd()
	if err := cmd.Execute(); err != nil {
		var exitErr *common.ExitError
		if errors.As(err, &exitErr) {
			fmt.Fprintln(os.Stderr, exitErr.Error())
			os.Exit(exitErr.Code)
		}
		fmt.Fprintln(os.Stderr, err.Error())
		os.Exit(common.ExitGeneralError)
	}
}
