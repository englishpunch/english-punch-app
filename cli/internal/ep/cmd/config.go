package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
	"github.com/echoja/english-punch-app/cli/internal/ep/config"
	"github.com/spf13/cobra"
)

var configShowFields = []common.Field{
	{Name: "configDir", Type: "string"},
	{Name: "configFile", Type: "string"},
	{Name: "configFileExists", Type: "boolean"},
	{Name: "convexUrl", Type: "string"},
	{Name: "defaultBagId", Type: "string"},
}

func newConfigCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "config",
		Short: "Manage CLI configuration",
		Long: `Inspect the viper config at ~/.config/english-punch/config.yaml
(or the directory supplied via --config-dir). Most config keys are
written indirectly by other commands — for example ep bags default
set writes default_bag_id.`,
	}

	cmd.AddCommand(newConfigShowCmd())

	return cmd
}

func newConfigShowCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "show",
		Short: "Show current configuration",
		Long: `Print the resolved config directory, config file path,
Convex URL, and default bag id. In --json mode the config file is
reported via two fields (configFile = absolute path, configFileExists
= boolean) so the skill does not have to parse the "not found"
placeholder string.`,
		Example: `  ep config show
  ep config show --json
  ep config show --json convexUrl,defaultBagId`,
		RunE: func(cmd *cobra.Command, args []string) error {
			if jsonFlag.Used && len(jsonFlag.Fields) == 0 {
				common.PrintFieldList(configShowFields)
				return nil
			}

			dir := configDir
			if dir == "" {
				dir = config.DefaultConfigDir()
			}

			cfg, err := config.Load(configDir)
			if err != nil {
				return common.NewTokenError(common.TokenConfigReadFailed, "load config", err)
			}

			configFile := filepath.Join(dir, "config.yaml")
			configFileExists := false
			if _, statErr := os.Stat(configFile); statErr == nil {
				configFileExists = true
			}

			payload := map[string]any{
				"configDir":        dir,
				"configFile":       configFile,
				"configFileExists": configFileExists,
				"convexUrl":        cfg.ConvexURL,
				"defaultBagId":     cfg.DefaultBagID,
			}

			if handled, err := jsonFlag.HandleOutput(payload, configShowFields); handled {
				return err
			}

			displayFile := configFile
			if !configFileExists {
				displayFile = "not found"
			}
			defaultBag := cfg.DefaultBagID
			if defaultBag == "" {
				defaultBag = "(unset)"
			}

			fmt.Printf("Config dir:   %s\n", dir)
			fmt.Printf("Config file:  %s\n", displayFile)
			fmt.Printf("Convex URL:   %s\n", cfg.ConvexURL)
			fmt.Printf("Default bag:  %s\n", defaultBag)

			return nil
		},
	}
}
