package cmd

import (
	"errors"
	"strings"
	"testing"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
)

// These tests exercise the client-side flag validation in
// ep cards create. They stop before any network call because
// every failure mode checked here is detected before the command
// reaches authenticatedClient / client.Mutation.
//
// The assertions check both the token (so the skill's
// pattern-matching keeps working) and the English message tail
// (so we know the skill can identify the offending field).

func runCardsCreate(args []string) error {
	cmd := newCardsCreateCmd()
	cmd.SetArgs(args)
	// Suppress usage output on error so test logs stay readable.
	cmd.SilenceUsage = true
	cmd.SilenceErrors = true
	return cmd.Execute()
}

func assertMissingField(t *testing.T, err error, wantField string) {
	t.Helper()
	if err == nil {
		t.Fatalf("expected MISSING_REQUIRED_FIELD error, got nil")
	}
	var ee *common.ExitError
	if !errors.As(err, &ee) {
		t.Fatalf("expected *common.ExitError, got %T: %v", err, err)
	}
	if ee.Token != common.TokenMissingRequiredField {
		t.Errorf("token = %q, want %q", ee.Token, common.TokenMissingRequiredField)
	}
	if !strings.Contains(ee.Message, wantField) {
		t.Errorf("message = %q, want it to mention %q", ee.Message, wantField)
	}
}

func TestCardsCreate_EmptyAnswer(t *testing.T) {
	err := runCardsCreate([]string{
		"   ",
		"--question", "q",
		"--hint", "h",
		"--explanation", "e",
	})
	assertMissingField(t, err, "answer")
}

func TestCardsCreate_MissingQuestion(t *testing.T) {
	err := runCardsCreate([]string{
		"disheartened",
		"--hint", "h",
		"--explanation", "e",
	})
	assertMissingField(t, err, "--question")
}

func TestCardsCreate_WhitespaceQuestion(t *testing.T) {
	err := runCardsCreate([]string{
		"disheartened",
		"--question", "   ",
		"--hint", "h",
		"--explanation", "e",
	})
	assertMissingField(t, err, "--question")
}

func TestCardsCreate_MissingHint(t *testing.T) {
	err := runCardsCreate([]string{
		"disheartened",
		"--question", "I felt ___.",
		"--explanation", "e",
	})
	assertMissingField(t, err, "--hint")
}

func TestCardsCreate_MissingExplanation(t *testing.T) {
	err := runCardsCreate([]string{
		"disheartened",
		"--question", "I felt ___.",
		"--hint", "h",
	})
	assertMissingField(t, err, "--explanation")
}

// Validation order: answer is checked first, so when multiple
// fields are missing the skill gets a deterministic response and
// its retry loop can address them one at a time.
func TestCardsCreate_ValidationOrder(t *testing.T) {
	err := runCardsCreate([]string{
		"",
		// every other field also missing
	})
	assertMissingField(t, err, "answer")
}
