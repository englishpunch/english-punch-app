package cmd

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"strings"
	"testing"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
	"github.com/echoja/english-punch-app/cli/internal/ep/convex"
	"github.com/spf13/cobra"
)

func resetReviewCommandTestState() {
	jsonFlag = common.JSONFlag{}
	reviewResolveBagIDFunc = resolveBagID
	reviewAuthenticatedClientFunc = authenticatedClient
	reviewStartReviewFunc = startReview
	reviewRevealReviewFunc = revealReview
	reviewRateReviewFunc = rateReview
	reviewFetchPendingReviewFunc = fetchPendingReview
	reviewAbandonReviewFunc = abandonReview
}

func runReviewCommand(t *testing.T, command *cobra.Command, args []string) error {
	t.Helper()
	command.SetArgs(args)
	command.SilenceUsage = true
	command.SilenceErrors = true
	return command.Execute()
}

func assertExitToken(t *testing.T, err error, wantToken string) *common.ExitError {
	t.Helper()
	if err == nil {
		t.Fatalf("expected %s error, got nil", wantToken)
	}

	var exitErr *common.ExitError
	if !errors.As(err, &exitErr) {
		t.Fatalf("expected *common.ExitError, got %T: %v", err, err)
	}
	if exitErr.Token != wantToken {
		t.Fatalf("token = %q, want %q", exitErr.Token, wantToken)
	}
	return exitErr
}

func captureStdout(t *testing.T, fn func()) string {
	t.Helper()

	original := os.Stdout
	reader, writer, err := os.Pipe()
	if err != nil {
		t.Fatalf("os.Pipe: %v", err)
	}

	os.Stdout = writer
	t.Cleanup(func() {
		os.Stdout = original
	})

	fn()

	if err := writer.Close(); err != nil {
		t.Fatalf("writer.Close: %v", err)
	}

	data, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("io.ReadAll: %v", err)
	}
	if err := reader.Close(); err != nil {
		t.Fatalf("reader.Close: %v", err)
	}
	os.Stdout = original
	return string(data)
}

func TestReviewRate_InvalidRatingReturnsMissingRequiredField(t *testing.T) {
	resetReviewCommandTestState()
	t.Cleanup(resetReviewCommandTestState)

	err := runReviewCommand(t, newReviewRateCmd(), []string{"5"})
	exitErr := assertExitToken(t, err, common.TokenMissingRequiredField)
	if !strings.Contains(exitErr.Message, "rating") {
		t.Fatalf("message = %q, want mention of rating", exitErr.Message)
	}
}

func TestReviewAuto_JSONRejected(t *testing.T) {
	resetReviewCommandTestState()
	t.Cleanup(resetReviewCommandTestState)
	jsonFlag = common.JSONFlag{Used: true}

	cmd := newReviewAutoCmd()
	cmd.SetIn(strings.NewReader(""))
	cmd.SetOut(&bytes.Buffer{})

	err := runReviewCommand(t, cmd, nil)
	_ = assertExitToken(t, err, common.TokenInteractiveOnly)
}

func TestReviewAuto_NonTTYRejected(t *testing.T) {
	resetReviewCommandTestState()
	t.Cleanup(resetReviewCommandTestState)

	cmd := newReviewAutoCmd()
	cmd.SetIn(strings.NewReader(""))
	cmd.SetOut(&bytes.Buffer{})

	err := runReviewCommand(t, cmd, nil)
	_ = assertExitToken(t, err, common.TokenNotATTY)
}

func TestReviewStart_TextOutput(t *testing.T) {
	resetReviewCommandTestState()
	t.Cleanup(resetReviewCommandTestState)

	hint := "remember the collocation"
	reviewResolveBagIDFunc = func(flagValue string) (string, error) {
		if flagValue != "bag-1" {
			t.Fatalf("flagValue = %q, want bag-1", flagValue)
		}
		return flagValue, nil
	}
	reviewAuthenticatedClientFunc = func(context.Context) (*convex.Client, *convex.User, error) {
		return &convex.Client{}, &convex.User{ID: "user-1"}, nil
	}
	reviewStartReviewFunc = func(_ context.Context, _ *convex.Client, userID, bagID string) (reviewStartResult, error) {
		if userID != "user-1" {
			t.Fatalf("userID = %q, want user-1", userID)
		}
		if bagID != "bag-1" {
			t.Fatalf("bagID = %q, want bag-1", bagID)
		}
		return reviewStartResult{
			CardID:   "card-1",
			BagID:    bagID,
			Question: "What does \"hold up\" mean here?",
			Hint:     &hint,
		}, nil
	}

	var output bytes.Buffer
	cmd := newReviewStartCmd()
	cmd.SetOut(&output)

	if err := runReviewCommand(t, cmd, []string{"--bag", "bag-1"}); err != nil {
		t.Fatalf("runReviewCommand: %v", err)
	}

	got := output.String()
	if !strings.Contains(got, "cardId: card-1\n") {
		t.Fatalf("output missing cardId:\n%s", got)
	}
	if !strings.Contains(got, "bagId: bag-1\n") {
		t.Fatalf("output missing bagId:\n%s", got)
	}
	if !strings.Contains(got, "question: What does \"hold up\" mean here?\n") {
		t.Fatalf("output missing question:\n%s", got)
	}
	if !strings.Contains(got, "hint: remember the collocation\n") {
		t.Fatalf("output missing hint:\n%s", got)
	}
}

func TestReviewStart_BareJSONListsFields(t *testing.T) {
	resetReviewCommandTestState()
	t.Cleanup(resetReviewCommandTestState)
	jsonFlag = common.JSONFlag{Used: true}

	output := captureStdout(t, func() {
		if err := runReviewCommand(t, newReviewStartCmd(), nil); err != nil {
			t.Fatalf("runReviewCommand: %v", err)
		}
	})

	if !strings.Contains(output, "cardId") {
		t.Fatalf("output missing cardId field:\n%s", output)
	}
	if !strings.Contains(output, "question") {
		t.Fatalf("output missing question field:\n%s", output)
	}
	if strings.Contains(output, "NOT_LOGGED_IN") {
		t.Fatalf("field discovery should not authenticate:\n%s", output)
	}
}
