package cmd

import (
	"fmt"
	"strings"
	"testing"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
)

// TestCommands_HaveCompleteHelp walks the full command tree starting
// from NewRootCmd() and verifies that every registered command has
// the help fields an LLM caller needs for discovery via
// "ep <verb> --help":
//
//   - Short must be set on every command
//   - Long must be set on every command (including pure-parent
//     commands like "ep auth" and "ep bags default")
//   - Example must be set on every runnable (leaf) command
//   - Every locally defined flag must have a non-empty Usage string
//
// See docs/cli-llm-as-caller.md rule 4 for the design rationale.
// Cobra's auto-generated "help" and "completion" subcommands are
// exempted because we do not own their help text.
func TestCommands_HaveCompleteHelp(t *testing.T) {
	root := NewRootCmd()
	var problems []string

	walkCommands(root, func(cmd *cobra.Command) {
		if isExemptCommand(cmd) {
			return
		}
		path := cmd.CommandPath()

		if strings.TrimSpace(cmd.Short) == "" {
			problems = append(problems, fmt.Sprintf("%s: missing Short", path))
		}
		if strings.TrimSpace(cmd.Long) == "" {
			problems = append(problems, fmt.Sprintf("%s: missing Long", path))
		}
		if cmd.Runnable() && strings.TrimSpace(cmd.Example) == "" {
			problems = append(problems, fmt.Sprintf("%s: missing Example (runnable command)", path))
		}

		cmd.LocalFlags().VisitAll(func(f *pflag.Flag) {
			if strings.TrimSpace(f.Usage) == "" {
				problems = append(problems, fmt.Sprintf("%s --%s: missing Usage", path, f.Name))
			}
		})
	})

	if len(problems) > 0 {
		t.Errorf("help-text completeness violations (%d):\n  %s",
			len(problems), strings.Join(problems, "\n  "))
	}
}

func walkCommands(cmd *cobra.Command, fn func(*cobra.Command)) {
	fn(cmd)
	for _, sub := range cmd.Commands() {
		walkCommands(sub, fn)
	}
}

func isExemptCommand(cmd *cobra.Command) bool {
	switch cmd.Name() {
	case "help", "completion":
		return true
	}
	return false
}
