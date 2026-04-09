package cmd

import (
	"fmt"
	"os/exec"

	"github.com/spf13/cobra"
)

const webAppURL = "https://englishpunch.vercel.app"

func newOpenCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "open",
		Short: "Open English Punch in your browser",
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Printf("Opening %s\n", webAppURL)
			return exec.Command("open", webAppURL).Run()
		},
	}
}
