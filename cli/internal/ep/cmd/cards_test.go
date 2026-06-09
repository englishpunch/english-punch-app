package cmd

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
	"github.com/echoja/english-punch-app/cli/internal/ep/convex"
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

func resetCardsCommandTestState() {
	jsonFlag = common.JSONFlag{}
	cardsResolveBagIDFunc = resolveBagID
	cardsAuthenticatedClientFunc = authenticatedClient
	cardsGetCardFunc = getCard
	cardsReplaceCardContentAndResetScheduleFunc = replaceCardContentAndResetSchedule
}

func runCardsCommand(command interface {
	SetArgs([]string)
	Execute() error
}, args []string) error {
	command.SetArgs(args)
	return command.Execute()
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

func TestCardsReplace_PreservesExistingOptionalFields(t *testing.T) {
	resetCardsCommandTestState()
	t.Cleanup(resetCardsCommandTestState)

	explanation := "Use this when hope drops after bad news."
	contextText := "after a rejection"
	sourceWord := "실망한"
	expression := "disheartened"
	var gotReplacement cardReplacement

	cardsResolveBagIDFunc = func(flagValue string) (string, error) {
		if flagValue != "bag-1" {
			t.Fatalf("flagValue = %q, want bag-1", flagValue)
		}
		return flagValue, nil
	}
	cardsAuthenticatedClientFunc = func(context.Context) (*convex.Client, *convex.User, error) {
		return &convex.Client{}, &convex.User{ID: "user-1"}, nil
	}
	cardsGetCardFunc = func(_ context.Context, _ *convex.Client, userID, bagID, cardID string) (*cardDetail, error) {
		if userID != "user-1" || bagID != "bag-1" || cardID != "card-1" {
			t.Fatalf("unexpected lookup: user=%s bag=%s card=%s", userID, bagID, cardID)
		}
		return &cardDetail{
			ID:          cardID,
			Question:    "old question",
			Answer:      "disheartened",
			Hint:        ptr("discouraged"),
			Explanation: &explanation,
			Context:     &contextText,
			SourceWord:  &sourceWord,
			Expression:  &expression,
		}, nil
	}
	cardsReplaceCardContentAndResetScheduleFunc = func(_ context.Context, _ *convex.Client, bagID, cardID string, replacement cardReplacement) error {
		if bagID != "bag-1" || cardID != "card-1" {
			t.Fatalf("unexpected replace target: bag=%s card=%s", bagID, cardID)
		}
		gotReplacement = replacement
		return nil
	}

	cmd := newCardsReplaceCmd()
	cmd.SilenceUsage = true
	cmd.SilenceErrors = true

	err := runCardsCommand(cmd, []string{
		"card-1",
		"--bag", "bag-1",
		"--question", "I felt ___ after reading the rejection letter.",
		"--hint", "discouraged, dejected, low-spirited",
	})
	if err != nil {
		t.Fatalf("runCardsCommand: %v", err)
	}

	if gotReplacement.Question != "I felt ___ after reading the rejection letter." {
		t.Fatalf("question = %q", gotReplacement.Question)
	}
	if gotReplacement.Answer != "disheartened" {
		t.Fatalf("answer = %q, want existing answer", gotReplacement.Answer)
	}
	if gotReplacement.Hint != "discouraged, dejected, low-spirited" {
		t.Fatalf("hint = %q", gotReplacement.Hint)
	}
	if gotReplacement.Explanation == nil || *gotReplacement.Explanation != explanation {
		t.Fatalf("explanation not preserved: %#v", gotReplacement.Explanation)
	}
	if gotReplacement.Context == nil || *gotReplacement.Context != contextText {
		t.Fatalf("context not preserved: %#v", gotReplacement.Context)
	}
	if gotReplacement.SourceWord == nil || *gotReplacement.SourceWord != sourceWord {
		t.Fatalf("sourceWord not preserved: %#v", gotReplacement.SourceWord)
	}
	if gotReplacement.Expression == nil || *gotReplacement.Expression != expression {
		t.Fatalf("expression not preserved: %#v", gotReplacement.Expression)
	}
}

func TestCardsReplace_RequiresQuestionAndHint(t *testing.T) {
	resetCardsCommandTestState()
	t.Cleanup(resetCardsCommandTestState)

	cmd := newCardsReplaceCmd()
	cmd.SilenceUsage = true
	cmd.SilenceErrors = true

	err := runCardsCommand(cmd, []string{
		"card-1",
		"--hint", "discouraged, dejected",
	})
	assertMissingField(t, err, "--question")

	cmd = newCardsReplaceCmd()
	cmd.SilenceUsage = true
	cmd.SilenceErrors = true

	err = runCardsCommand(cmd, []string{
		"card-1",
		"--question", "I felt ___.",
	})
	assertMissingField(t, err, "--hint")
}

func TestCardsGet_CardNotFoundTokenPropagates(t *testing.T) {
	resetCardsCommandTestState()
	t.Cleanup(resetCardsCommandTestState)

	cardsResolveBagIDFunc = func(flagValue string) (string, error) {
		return "bag-1", nil
	}
	cardsAuthenticatedClientFunc = func(context.Context) (*convex.Client, *convex.User, error) {
		return &convex.Client{}, &convex.User{ID: "user-1"}, nil
	}
	cardsGetCardFunc = func(context.Context, *convex.Client, string, string, string) (*cardDetail, error) {
		return nil, common.NewTokenError(common.TokenCardNotFound, "card not found", nil)
	}

	cmd := newCardsGetCmd()
	cmd.SilenceUsage = true
	cmd.SilenceErrors = true

	err := runCardsCommand(cmd, []string{"card-1"})
	var exitErr *common.ExitError
	if !errors.As(err, &exitErr) {
		t.Fatalf("expected *common.ExitError, got %T: %v", err, err)
	}
	if exitErr.Token != common.TokenCardNotFound {
		t.Fatalf("token = %q, want %q", exitErr.Token, common.TokenCardNotFound)
	}
}

func ptr(value string) *string {
	return &value
}
