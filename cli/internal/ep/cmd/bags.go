package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
	"github.com/spf13/cobra"
)

// bag and bagFields are generated in types_gen.go

func newBagsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "bags",
		Short: "Manage flashcard bags",
	}

	cmd.AddCommand(newBagsListCmd())

	return cmd
}

func newBagsListCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List your flashcard bags",
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
				return fmt.Errorf("fetch bags: %w", err)
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
