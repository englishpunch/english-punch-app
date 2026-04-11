package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/echoja/english-punch-app/cli/internal/ep/config"
	"github.com/spf13/cobra"
)

func newConfigCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "config",
		Short: "Manage CLI configuration",
	}

	cmd.AddCommand(newConfigShowCmd())

	return cmd
}

func newConfigShowCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "show",
		Short: "Show current configuration",
		RunE: func(cmd *cobra.Command, args []string) error {
			dir := configDir
			if dir == "" {
				dir = config.DefaultConfigDir()
			}

			cfg, err := config.Load(configDir)
			if err != nil {
				return fmt.Errorf("load config: %w", err)
			}

			configFile := filepath.Join(dir, "config.yaml")
			exists := "not found"
			if _, err := os.Stat(configFile); err == nil {
				exists = configFile
			}

			defaultBag := cfg.DefaultBagID
			if defaultBag == "" {
				defaultBag = "(unset)"
			}

			fmt.Printf("Config dir:   %s\n", dir)
			fmt.Printf("Config file:  %s\n", exists)
			fmt.Printf("Convex URL:   %s\n", cfg.ConvexURL)
			fmt.Printf("Default bag:  %s\n", defaultBag)

			return nil
		},
	}
}
