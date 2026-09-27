package cmd

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
	"github.com/spf13/cobra"
)

func newBagsUpdateCmd() *cobra.Command {
	var name string
	cmd := &cobra.Command{
		Use:   "update <bag-id> --name <name>",
		Short: "Update a bag's title",
		Long: `Update the title of a bag owned by the signed-in user. Leading and trailing
whitespace is trimmed; names must not be blank. Cards and bag settings are
preserved. Repeating the same update is safe and leaves lastModified unchanged.

Bare --json lists fields without updating a bag or requiring login.
Use --json ok,bagId,name to update a bag and return its ID and saved name.`,
		Example: `  ep bags update k17abc... --name "TOEFL Speaking"
  ep bags update k17abc... --name "TOEFL Speaking" --json ok,bagId,name
  # {"ok": true, "bagId": "k17abc...", "name": "TOEFL Speaking"}
  ep bags update --json`,
		Args: func(cmd *cobra.Command, args []string) error {
			if jsonFlag.Used && len(jsonFlag.Fields) == 0 && len(args) == 0 {
				return nil
			}
			if len(args) == 0 {
				return common.NewTokenError(common.TokenMissingRequiredField, "bag-id is required", nil)
			}
			if len(args) != 1 {
				return common.NewTokenError(common.TokenInvalidArgument, "provide exactly one bag-id", nil)
			}
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			if jsonFlag.Used && len(jsonFlag.Fields) == 0 {
				common.PrintFieldList(append([]common.Field{{Name: "ok", Type: "boolean"}}, bagsCreateFields...))
				return nil
			}
			bagID := strings.TrimSpace(args[0])
			if bagID == "" {
				return common.NewTokenError(common.TokenMissingRequiredField, "bag-id must not be blank", nil)
			}
			name = strings.TrimSpace(name)
			if !cmd.Flags().Changed("name") || name == "" {
				return common.NewTokenError(common.TokenMissingRequiredField, "--name is required and must not be blank", nil)
			}
			for _, field := range jsonFlag.Fields {
				if field != "ok" && field != "bagId" && field != "name" {
					return common.NewTokenError(common.TokenInvalidArgument, fmt.Sprintf("unknown JSON field %q; run with --json to see available fields", field), nil)
				}
			}
			client, _, err := bagsAuthenticatedClientFunc(cmd.Context())
			if err != nil {
				return err
			}
			raw, err := client.Mutation(cmd.Context(), "learning:updateBag", map[string]any{"bagId": bagID, "name": name})
			if err != nil {
				return err
			}
			var result struct {
				BagID string `json:"bagId"`
				Name  string `json:"name"`
			}
			if err := json.Unmarshal(raw, &result); err != nil || result.BagID != bagID || result.Name != name {
				return common.NewTokenError(common.TokenConvexAPIError, "invalid updateBag response", err)
			}
			payload := map[string]any{"bagId": result.BagID, "name": result.Name}
			if handled, err := jsonFlag.HandleOKOutput(payload, bagsCreateFields); handled {
				return err
			}
			fmt.Printf("Updated bag %s: %s\n", result.BagID, result.Name)
			return nil
		},
	}
	cmd.Flags().StringVar(&name, "name", "", "New bag title (required). Quote names containing spaces.")
	return cmd
}
