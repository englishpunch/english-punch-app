package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
	"github.com/spf13/cobra"
)

type bag struct {
	ID            string   `json:"_id"`
	Name          string   `json:"name"`
	Description   string   `json:"description,omitempty"`
	TotalCards    float64  `json:"totalCards"`
	NewCards      float64  `json:"newCards"`
	LearningCards float64  `json:"learningCards"`
	ReviewCards   float64  `json:"reviewCards"`
	Tags          []string `json:"tags"`
	IsActive      bool     `json:"isActive"`
}

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

			return common.PrintJSON(bags)
		},
	}
}
