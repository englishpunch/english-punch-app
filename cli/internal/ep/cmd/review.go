package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
	"github.com/echoja/english-punch-app/cli/internal/ep/convex"
	"github.com/spf13/cobra"
)

// Field lists for --json discovery. Kept alongside the commands
// rather than in types_gen.go because these payload shapes are only
// consumed by ep review — not by any shared type.

var reviewStartFields = []common.Field{
	{Name: "cardId", Type: "string"},
	{Name: "bagId", Type: "string"},
	{Name: "question", Type: "string"},
	{Name: "hint", Type: "string"},
}

var reviewRevealFields = []common.Field{
	{Name: "cardId", Type: "string"},
	{Name: "question", Type: "string"},
	{Name: "hint", Type: "string"},
	{Name: "answer", Type: "string"},
	{Name: "explanation", Type: "string"},
	{Name: "context", Type: "string"},
}

var reviewRateFields = []common.Field{
	{Name: "nextReviewDate", Type: "string"},
	{Name: "nextReviewTimestamp", Type: "number"},
	{Name: "newState", Type: "number"},
	{Name: "dueCount", Type: "number"},
}

var reviewStatusFields = []common.Field{
	{Name: "pending", Type: "boolean"},
	{Name: "cardId", Type: "string"},
	{Name: "bagId", Type: "string"},
	{Name: "question", Type: "string"},
	{Name: "hint", Type: "string"},
	{Name: "startTime", Type: "number"},
	{Name: "revealTime", Type: "number"},
	{Name: "revealed", Type: "boolean"},
}

var reviewAbortFields = []common.Field{
	{Name: "existed", Type: "boolean"},
}

// reviewStartResult mirrors the discriminated-union return of
// review:startReview. When Ok is true the success fields are set;
// when Ok is false Token names the failure (and CardID is set for
// REVIEW_ALREADY_PENDING so the skill can route to reveal/rate/abort).
type reviewStartResult struct {
	Ok       bool    `json:"ok"`
	Token    string  `json:"token,omitempty"`
	CardID   string  `json:"cardId,omitempty"`
	BagID    string  `json:"bagId,omitempty"`
	Question string  `json:"question,omitempty"`
	Hint     *string `json:"hint,omitempty"`
}

type reviewRevealResult struct {
	Ok          bool    `json:"ok"`
	Token       string  `json:"token,omitempty"`
	CardID      string  `json:"cardId,omitempty"`
	Question    string  `json:"question,omitempty"`
	Hint        *string `json:"hint,omitempty"`
	Answer      string  `json:"answer,omitempty"`
	Explanation *string `json:"explanation,omitempty"`
	Context     *string `json:"context,omitempty"`
}

type reviewRateResult struct {
	Ok                  bool    `json:"ok"`
	Token               string  `json:"token,omitempty"`
	NextReviewDate      string  `json:"nextReviewDate,omitempty"`
	NextReviewTimestamp float64 `json:"nextReviewTimestamp,omitempty"`
	NewState            float64 `json:"newState,omitempty"`
	DueCount            float64 `json:"dueCount,omitempty"`
}

type reviewStatusResult struct {
	CardID     string   `json:"cardId"`
	BagID      string   `json:"bagId"`
	StartTime  float64  `json:"startTime"`
	RevealTime *float64 `json:"revealTime,omitempty"`
	Question   string   `json:"question"`
	Hint       *string  `json:"hint,omitempty"`
	Revealed   bool     `json:"revealed"`
}

type reviewAbandonResult struct {
	Ok      bool `json:"ok"`
	Existed bool `json:"existed"`
}

func newReviewCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "review",
		Short: "Run a spaced-repetition review session",
		Long: `Drive a stateless review flow against the Convex backend.
Each subcommand is one Convex round-trip; there is no client-side
session file. Per-attempt state lives in a server-side pendingReviews
row keyed by userId — the CLI never tracks an attempt id itself.

Typical skill-driven flow:

  ep review start            # prints question
  ep review reveal           # prints answer
  ep review rate 3           # submits rating, prints next due date

Use 'ep review status' to inspect the current pending review (useful
after a crash / terminal switch) and 'ep review abort' to discard it.`,
	}

	cmd.AddCommand(newReviewStartCmd())
	cmd.AddCommand(newReviewRevealCmd())
	cmd.AddCommand(newReviewRateCmd())
	cmd.AddCommand(newReviewStatusCmd())
	cmd.AddCommand(newReviewAbortCmd())

	return cmd
}

func newReviewStartCmd() *cobra.Command {
	var bagID string

	cmd := &cobra.Command{
		Use:   "start",
		Short: "Start a new review attempt",
		Long: `Fetch the next due card in the target bag, insert a
pendingReviews row on the server, and print the question (without
the answer). The --bag flag is optional and falls back to
default_bag_id from the config (set via 'ep bags default set').

Errors:
  REVIEW_ALREADY_PENDING — a fresh pending review already exists for
    this user; run 'ep review reveal' / 'rate' / 'abort' to resolve
    it before starting a new one. Stale rows (> 30 min) are
    auto-abandoned and start succeeds.
  NO_CARD_AVAILABLE     — no due card in the bag right now.
  BAG_NOT_FOUND         — the bag id doesn't belong to this user.

Idempotency: calling start twice in quick succession on an empty
state produces exactly one pending row. The second call returns
REVIEW_ALREADY_PENDING with the existing cardId, so it is safe to
retry after a network blip — the skill should prefer 'reveal' over
a second 'start' if it is unsure whether the first call landed.`,
		Example: `  ep review start
  ep review start --bag k17abc...
  ep review start --json
  ep review start --json cardId,question`,
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if jsonFlag.Used && len(jsonFlag.Fields) == 0 {
				common.PrintFieldList(reviewStartFields)
				return nil
			}

			resolvedBag, err := resolveBagID(bagID)
			if err != nil {
				return err
			}

			ctx := cmd.Context()
			client, user, err := authenticatedClient(ctx)
			if err != nil {
				return err
			}

			raw, err := client.Mutation(ctx, "review:startReview", map[string]any{
				"userId": user.ID,
				"bagId":  resolvedBag,
			})
			if err != nil {
				return err
			}

			var result reviewStartResult
			if err := json.Unmarshal(raw, &result); err != nil {
				return fmt.Errorf("parse startReview response: %w", err)
			}

			if !result.Ok {
				return reviewStartError(result)
			}

			payload := map[string]any{
				"cardId":   result.CardID,
				"bagId":    result.BagID,
				"question": result.Question,
			}
			if result.Hint != nil {
				payload["hint"] = *result.Hint
			}
			if handled, err := jsonFlag.HandleOutput(payload, reviewStartFields); handled {
				return err
			}

			fmt.Printf("cardId: %s\n", result.CardID)
			fmt.Printf("bagId: %s\n", result.BagID)
			fmt.Printf("question: %s\n", result.Question)
			if result.Hint != nil && *result.Hint != "" {
				fmt.Printf("hint: %s\n", *result.Hint)
			}
			return nil
		},
	}

	cmd.Flags().StringVar(&bagID, "bag", "", "Target bag ID. Falls back to default_bag_id in the config file.")
	return cmd
}

func reviewStartError(r reviewStartResult) error {
	switch r.Token {
	case common.TokenReviewAlreadyPending:
		return common.NewTokenError(
			common.TokenReviewAlreadyPending,
			fmt.Sprintf("a review is already in progress (cardId %s) — run 'ep review reveal', 'rate', or 'abort'", r.CardID),
			nil,
		)
	case common.TokenNoCardAvailable:
		return common.NewTokenError(
			common.TokenNoCardAvailable,
			"no due card in this bag — come back later or add more cards",
			nil,
		)
	case common.TokenBagNotFound:
		return common.NewTokenError(
			common.TokenBagNotFound,
			"bag not found or not owned by this user",
			nil,
		)
	}
	return fmt.Errorf("unexpected startReview failure token: %q", r.Token)
}

func newReviewRevealCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "reveal",
		Short: "Reveal the answer for the current pending review",
		Long: `Print the answer, explanation, and context fields for the
user's current pending review and mark the pending row as
'answer shown'. Must be preceded by 'ep review start'.

Idempotent — calling reveal twice returns the same fields and
does not change any state after the first call, so it is safe to
retry after a network blip.

Errors:
  NO_PENDING_REVIEW — the user has no pending review; run
    'ep review start' first.`,
		Example: `  ep review reveal
  ep review reveal --json
  ep review reveal --json answer,explanation`,
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if jsonFlag.Used && len(jsonFlag.Fields) == 0 {
				common.PrintFieldList(reviewRevealFields)
				return nil
			}

			ctx := cmd.Context()
			client, user, err := authenticatedClient(ctx)
			if err != nil {
				return err
			}

			raw, err := client.Mutation(ctx, "review:revealReview", map[string]any{
				"userId": user.ID,
			})
			if err != nil {
				return err
			}

			var result reviewRevealResult
			if err := json.Unmarshal(raw, &result); err != nil {
				return fmt.Errorf("parse revealReview response: %w", err)
			}

			if !result.Ok {
				if result.Token == common.TokenNoPendingReview {
					return common.NewTokenError(
						common.TokenNoPendingReview,
						"no pending review — run 'ep review start' first",
						nil,
					)
				}
				return fmt.Errorf("unexpected revealReview failure token: %q", result.Token)
			}

			payload := map[string]any{
				"cardId":   result.CardID,
				"question": result.Question,
				"answer":   result.Answer,
			}
			if result.Hint != nil {
				payload["hint"] = *result.Hint
			}
			if result.Explanation != nil {
				payload["explanation"] = *result.Explanation
			}
			if result.Context != nil {
				payload["context"] = *result.Context
			}
			if handled, err := jsonFlag.HandleOutput(payload, reviewRevealFields); handled {
				return err
			}

			fmt.Printf("cardId: %s\n", result.CardID)
			fmt.Printf("question: %s\n", result.Question)
			fmt.Printf("answer: %s\n", result.Answer)
			if result.Hint != nil && *result.Hint != "" {
				fmt.Printf("hint: %s\n", *result.Hint)
			}
			if result.Explanation != nil && *result.Explanation != "" {
				fmt.Printf("explanation: %s\n", *result.Explanation)
			}
			if result.Context != nil && *result.Context != "" {
				fmt.Printf("context: %s\n", *result.Context)
			}
			return nil
		},
	}
}

func newReviewRateCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "rate <1|2|3|4>",
		Short: "Submit a rating for the current pending review",
		Long: `Submit a rating (1=Again, 2=Hard, 3=Good, 4=Easy) for the
user's current pending review. Delegates to the canonical FSRS
handler on the server, writes the reviewLogs row, and deletes the
pending row. Must be preceded by 'ep review reveal'.

Errors:
  NO_PENDING_REVIEW  — no pending review; run 'ep review start'.
  REVIEW_NOT_REVEALED — you called 'rate' before 'reveal'; run
    'ep review reveal' first.

Not idempotent by construction — a successful rate consumes the
pending row. A retry after a successful call will return
NO_PENDING_REVIEW, which the skill should treat as "already done"
rather than an error.`,
		Example: `  ep review rate 3
  ep review rate 1 --json
  ep review rate 4 --json nextReviewDate,dueCount`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if jsonFlag.Used && len(jsonFlag.Fields) == 0 {
				common.PrintFieldList(reviewRateFields)
				return nil
			}

			rating, err := strconv.Atoi(args[0])
			if err != nil || rating < 1 || rating > 4 {
				return common.NewTokenError(
					common.TokenMissingRequiredField,
					"rating must be an integer from 1 (Again) to 4 (Easy)",
					nil,
				)
			}

			ctx := cmd.Context()
			client, user, err := authenticatedClient(ctx)
			if err != nil {
				return err
			}

			raw, err := client.Mutation(ctx, "review:rateReview", map[string]any{
				"userId": user.ID,
				"rating": rating,
			})
			if err != nil {
				return err
			}

			var result reviewRateResult
			if err := json.Unmarshal(raw, &result); err != nil {
				return fmt.Errorf("parse rateReview response: %w", err)
			}

			if !result.Ok {
				switch result.Token {
				case common.TokenNoPendingReview:
					return common.NewTokenError(
						common.TokenNoPendingReview,
						"no pending review — run 'ep review start' first",
						nil,
					)
				case common.TokenReviewNotRevealed:
					return common.NewTokenError(
						common.TokenReviewNotRevealed,
						"pending review has not been revealed yet — run 'ep review reveal' before 'rate'",
						nil,
					)
				}
				return fmt.Errorf("unexpected rateReview failure token: %q", result.Token)
			}

			payload := map[string]any{
				"nextReviewDate":      result.NextReviewDate,
				"nextReviewTimestamp": result.NextReviewTimestamp,
				"newState":            result.NewState,
				"dueCount":            result.DueCount,
			}
			if handled, err := jsonFlag.HandleOutput(payload, reviewRateFields); handled {
				return err
			}

			fmt.Printf("nextReviewDate: %s\n", result.NextReviewDate)
			fmt.Printf("newState: %d\n", int(result.NewState))
			fmt.Printf("dueCount: %d\n", int(result.DueCount))
			return nil
		},
	}
}

func newReviewStatusCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Short: "Show the current pending review, if any",
		Long: `Inspect the server-side pending review row for this user.
Safe to call at any time — returns pending=false when nothing is
in progress.

Exit code is always 0 regardless of whether a review is pending;
use the 'pending' field (or the 'revealed' field) to branch on
state.`,
		Example: `  ep review status
  ep review status --json
  ep review status --json pending,revealed,cardId`,
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if jsonFlag.Used && len(jsonFlag.Fields) == 0 {
				common.PrintFieldList(reviewStatusFields)
				return nil
			}

			ctx := cmd.Context()
			client, user, err := authenticatedClient(ctx)
			if err != nil {
				return err
			}

			pending, err := fetchPendingReview(ctx, client, user.ID)
			if err != nil {
				return err
			}

			payload := map[string]any{"pending": pending != nil}
			if pending != nil {
				payload["cardId"] = pending.CardID
				payload["bagId"] = pending.BagID
				payload["question"] = pending.Question
				payload["startTime"] = pending.StartTime
				payload["revealed"] = pending.Revealed
				if pending.Hint != nil {
					payload["hint"] = *pending.Hint
				}
				if pending.RevealTime != nil {
					payload["revealTime"] = *pending.RevealTime
				}
			}

			if handled, err := jsonFlag.HandleOutput(payload, reviewStatusFields); handled {
				return err
			}

			if pending == nil {
				fmt.Println("No pending review.")
				return nil
			}
			fmt.Printf("cardId: %s\n", pending.CardID)
			fmt.Printf("bagId: %s\n", pending.BagID)
			fmt.Printf("question: %s\n", pending.Question)
			fmt.Printf("startedAt: %s\n", time.UnixMilli(int64(pending.StartTime)).Format(time.RFC3339))
			fmt.Printf("revealed: %t\n", pending.Revealed)
			return nil
		},
	}
}

func fetchPendingReview(ctx context.Context, client *convex.Client, userID string) (*reviewStatusResult, error) {
	raw, err := client.Query(ctx, "review:getCurrentPendingReview", map[string]any{
		"userId": userID,
	})
	if err != nil {
		return nil, err
	}
	// Convex serializes `null` as literal JSON null.
	if string(raw) == "null" {
		return nil, nil
	}
	var pending reviewStatusResult
	if err := json.Unmarshal(raw, &pending); err != nil {
		return nil, fmt.Errorf("parse getCurrentPendingReview response: %w", err)
	}
	return &pending, nil
}

func newReviewAbortCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "abort",
		Short: "Discard the current pending review",
		Long: `Delete the user's pending review row without recording
any FSRS state change. The card remains due and can be reviewed
again with 'ep review start'.

Idempotent — calling abort with no pending review succeeds
quietly and returns existed=false.`,
		Example: `  ep review abort
  ep review abort --json
  ep review abort --json ok,existed`,
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if jsonFlag.Used && len(jsonFlag.Fields) == 0 {
				common.PrintFieldList(append(
					[]common.Field{{Name: "ok", Type: "boolean"}},
					reviewAbortFields...,
				))
				return nil
			}

			ctx := cmd.Context()
			client, user, err := authenticatedClient(ctx)
			if err != nil {
				return err
			}

			raw, err := client.Mutation(ctx, "review:abandonReview", map[string]any{
				"userId": user.ID,
			})
			if err != nil {
				return err
			}

			var result reviewAbandonResult
			if err := json.Unmarshal(raw, &result); err != nil {
				return fmt.Errorf("parse abandonReview response: %w", err)
			}

			if handled, err := jsonFlag.HandleOKOutput(
				map[string]any{"existed": result.Existed},
				reviewAbortFields,
			); handled {
				return err
			}

			if result.Existed {
				fmt.Println("Pending review discarded.")
			} else {
				fmt.Println("No pending review to discard.")
			}
			return nil
		},
	}
}
