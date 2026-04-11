package cmd

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
	"github.com/echoja/english-punch-app/cli/internal/ep/config"
	"github.com/echoja/english-punch-app/cli/internal/ep/convex"
	"github.com/spf13/cobra"
)

// bag and bagFields are generated in types_gen.go

func newBagsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "bags",
		Short: "Manage flashcard bags",
		Long: `Manage flashcard bags (the English Punch term for a study
collection). Use "ep bags list" to discover IDs, and
"ep bags default set <id>" to avoid repeating --bag on every
card-scoped command.`,
	}

	cmd.AddCommand(newBagsListCmd())
	cmd.AddCommand(newBagsDefaultCmd())

	return cmd
}

func newBagsDefaultCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "default",
		Short: "Manage the default bag used when --bag is omitted",
	}
	cmd.AddCommand(newBagsDefaultSetCmd())
	cmd.AddCommand(newBagsDefaultUnsetCmd())
	cmd.AddCommand(newBagsDefaultShowCmd())
	return cmd
}

func newBagsDefaultSetCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "set <bag-id>",
		Short: "Set the default bag",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			bagID := args[0]
			ctx := cmd.Context()

			client, user, err := authenticatedClient(ctx)
			if err != nil {
				return err
			}
			if err := verifyBagOwnership(ctx, client, user.ID, bagID); err != nil {
				return err
			}

			cfg, err := config.Load(configDir)
			if err != nil {
				return fmt.Errorf("load config: %w", err)
			}
			cfg.DefaultBagID = bagID
			if err := config.Save(configDir, cfg); err != nil {
				return fmt.Errorf("save config: %w", err)
			}
			fmt.Printf("Default bag set to %s\n", bagID)
			return nil
		},
	}
}

func newBagsDefaultUnsetCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "unset",
		Short: "Clear the default bag",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load(configDir)
			if err != nil {
				return fmt.Errorf("load config: %w", err)
			}
			if cfg.DefaultBagID == "" {
				fmt.Println("No default bag set.")
				return nil
			}
			cfg.DefaultBagID = ""
			if err := config.Save(configDir, cfg); err != nil {
				return fmt.Errorf("save config: %w", err)
			}
			fmt.Println("Default bag cleared.")
			return nil
		},
	}
}

func newBagsDefaultShowCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "show",
		Short: "Show the current default bag",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load(configDir)
			if err != nil {
				return fmt.Errorf("load config: %w", err)
			}
			if cfg.DefaultBagID == "" {
				fmt.Println("No default bag set.")
				return nil
			}
			fmt.Println(cfg.DefaultBagID)
			return nil
		},
	}
}

func verifyBagOwnership(ctx context.Context, client *convex.Client, userID, bagID string) error {
	raw, err := client.Query(ctx, "learning:getUserBags", map[string]any{
		"userId": userID,
	})
	if err != nil {
		return fmt.Errorf("fetch bags: %w", err)
	}
	var bags []bag
	if err := json.Unmarshal(raw, &bags); err != nil {
		return fmt.Errorf("parse bags: %w", err)
	}
	for _, b := range bags {
		if b.ID == bagID {
			return nil
		}
	}
	return common.NewTokenError(common.TokenBagNotFound, fmt.Sprintf("bag %q not found among your bags", bagID), nil)
}

func newBagsListCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List your flashcard bags",
		Long: `List every flashcard bag owned by the currently signed-in
user. Output is JSON by default; --json supports field discovery
(bare --json) and field filtering (--json field1,field2).

Errors from the Convex API propagate with their token intact (e.g.
CONVEX_UNREACHABLE on network failure, NOT_LOGGED_IN if credentials
are missing).`,
		Example: `  ep bags list
  ep bags list --json
  ep bags list --json _id,name,totalCards`,
		RunE: func(cmd *cobra.Command, args []string) error {
			// --json with no value: list fields
			if jsonFlag.Used && len(jsonFlag.Fields) == 0 {
				common.PrintFieldList(bagFields)
				return nil
			}

			ctx := cmd.Context()

			client, user, err := authenticatedClient(ctx)
			if err != nil {
				return err
			}

			raw, err := client.Query(ctx, "learning:getUserBags", map[string]any{
				"userId": user.ID,
			})
			if err != nil {
				return err
			}

			var bags []bag
			if err := json.Unmarshal(raw, &bags); err != nil {
				return fmt.Errorf("parse bags: %w", err)
			}

			if handled, err := jsonFlag.HandleOutput(bags, bagFields); handled {
				return err
			}

			return common.PrintJSON(bags)
		},
	}
}
