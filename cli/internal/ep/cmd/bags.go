package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

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

var defaultBagIDField = []common.Field{
	{Name: "bagId", Type: "string"},
}

var defaultBagShowFields = []common.Field{
	{Name: "defaultBagId", Type: "string"},
}

func newBagsDefaultCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "default",
		Short: "Manage the default bag used when --bag is omitted",
		Long: `Read or write the default_bag_id stored in the viper config
at ~/.config/english-punch/config.yaml. Card-scoped commands fall
back to this value when --bag is not passed explicitly.`,
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
		Long: `Validate that <bag-id> belongs to the signed-in user via
learning:getUserBags, then write it to default_bag_id in the config
file. Subsequent card-scoped commands will use this id when --bag
is omitted.

Exits with BAG_NOT_FOUND if the id is not in your bag list.`,
		Example: `  ep bags default set k17abc...
  ep bags default set k17abc... --json`,
		Args: cobra.ExactArgs(1),
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
				return common.NewTokenError(common.TokenConfigReadFailed, "load config", err)
			}
			cfg.DefaultBagID = bagID
			if err := config.Save(configDir, cfg); err != nil {
				return common.NewTokenError(common.TokenConfigWriteFailed, "save config", err)
			}

			if handled, err := jsonFlag.HandleOKOutput(
				map[string]any{"bagId": bagID},
				defaultBagIDField,
			); handled {
				return err
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
		Long: `Clear default_bag_id in the config file. Idempotent —
running unset on a config with no default bag succeeds quietly.`,
		Example: `  ep bags default unset
  ep bags default unset --json`,
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load(configDir)
			if err != nil {
				return common.NewTokenError(common.TokenConfigReadFailed, "load config", err)
			}
			if cfg.DefaultBagID == "" {
				if handled, err := jsonFlag.HandleOKOutput(nil, nil); handled {
					return err
				}
				fmt.Println("No default bag set.")
				return nil
			}
			cfg.DefaultBagID = ""
			if err := config.Save(configDir, cfg); err != nil {
				return common.NewTokenError(common.TokenConfigWriteFailed, "save config", err)
			}
			if handled, err := jsonFlag.HandleOKOutput(nil, nil); handled {
				return err
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
		Long: `Print the default_bag_id from the config file, or an
empty string / "No default bag set." message if unset.

In --json mode the payload is {"defaultBagId": "<id>"} with an empty
string when unset — the skill can check for "" to decide whether to
prompt the user.`,
		Example: `  ep bags default show
  ep bags default show --json
  ep bags default show --json defaultBagId`,
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if jsonFlag.Used && len(jsonFlag.Fields) == 0 {
				common.PrintFieldList(defaultBagShowFields)
				return nil
			}

			cfg, err := config.Load(configDir)
			if err != nil {
				return common.NewTokenError(common.TokenConfigReadFailed, "load config", err)
			}

			payload := map[string]any{"defaultBagId": cfg.DefaultBagID}
			if handled, err := jsonFlag.HandleOutput(payload, defaultBagShowFields); handled {
				return err
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

// resolveBagID returns the bag id to use for card-scoped commands. If
// flagValue is non-empty it wins. Otherwise the function falls back to
// cfg.DefaultBagID from the viper config. Returns NO_DEFAULT_BAG if
// neither source provides an id — this is a client-side validation so
// card commands fail fast before spending a Convex round-trip.
//
// Intentionally does not pre-verify bag ownership; that costs a query
// per command and the server will reject unauthorized ids on the
// mutation anyway. Individual commands that want stronger guarantees
// (like ep bags default set) still call verifyBagOwnership explicitly.
func resolveBagID(flagValue string) (string, error) {
	if strings.TrimSpace(flagValue) != "" {
		return flagValue, nil
	}
	cfg, err := config.Load(configDir)
	if err != nil {
		return "", common.NewTokenError(common.TokenConfigReadFailed, "load config", err)
	}
	if cfg.DefaultBagID == "" {
		return "", common.NewTokenError(
			common.TokenNoDefaultBag,
			"no bag specified — pass --bag <id> or run 'ep bags default set <id>'",
			nil,
		)
	}
	return cfg.DefaultBagID, nil
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
