package cmd

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
	"github.com/spf13/cobra"
)

var bagsAuthenticatedClientFunc = authenticatedClient

var bagsCreateFields = []common.Field{
	{Name: "bagId", Type: "string"},
	{Name: "name", Type: "string"},
}

func newBagsCreateCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "create <name>",
		Short: "Create a flashcard bag",
		Long: `Create a new bag owned by the signed-in user. Quote names containing
spaces. Leading and trailing whitespace is trimmed; names must not be blank.
The default bag is unchanged. Use "ep bags default set <id>" to change it.

Each call creates a new bag, even if the name already exists. The backend
allows duplicate names and has no idempotency key. After a timeout, inspect
"ep bags list" before retrying to avoid duplicates.

Bare --json lists fields without creating a bag or requiring login.
Use --json ok,bagId,name to create a bag and return its ID and name.`,
		Example: `  ep bags create "TOEFL Speaking"
  ep bags create "TOEFL Speaking" --json ok,bagId,name
  # {"ok": true, "bagId": "...", "name": "TOEFL Speaking"}
  ep bags create --json`,
		Args: func(cmd *cobra.Command, args []string) error {
			if jsonFlag.Used && len(jsonFlag.Fields) == 0 && len(args) == 0 {
				return nil
			}
			if len(args) == 0 {
				return common.NewTokenError(common.TokenMissingRequiredField, "name is required", nil)
			}
			if len(args) != 1 {
				return common.NewTokenError(common.TokenInvalidArgument, "provide exactly one bag name; quote names containing spaces", nil)
			}
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			if jsonFlag.Used && len(jsonFlag.Fields) == 0 {
				common.PrintFieldList(append([]common.Field{{Name: "ok", Type: "boolean"}}, bagsCreateFields...))
				return nil
			}
			name := strings.TrimSpace(args[0])
			if name == "" {
				return common.NewTokenError(common.TokenMissingRequiredField, "name must not be blank", nil)
			}
			// Reject invalid output selections before a non-idempotent mutation.
			for _, field := range jsonFlag.Fields {
				if field != "ok" && field != "bagId" && field != "name" {
					return common.NewTokenError(common.TokenInvalidArgument, fmt.Sprintf("unknown JSON field %q; run with --json to see available fields", field), nil)
				}
			}
			client, _, err := bagsAuthenticatedClientFunc(cmd.Context())
			if err != nil {
				return err
			}
			raw, err := client.Mutation(cmd.Context(), "learning:createBag", map[string]any{"name": name})
			if err != nil {
				return err
			}
			var bagID string
			if err := json.Unmarshal(raw, &bagID); err != nil || bagID == "" {
				return common.NewTokenError(common.TokenConvexAPIError, "invalid createBag response; inspect your bags before retrying", err)
			}
			payload := map[string]any{"bagId": bagID, "name": name}
			if handled, err := jsonFlag.HandleOKOutput(payload, bagsCreateFields); handled {
				return err
			}
			fmt.Printf("Created bag %s: %s\n", bagID, name)
			return nil
		},
	}
}
