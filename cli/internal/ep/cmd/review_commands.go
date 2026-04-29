package cmd

import (
	"fmt"
	"io"
	"strconv"
	"time"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
	"github.com/spf13/cobra"
)

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

			resolvedBag, err := reviewResolveBagIDFunc(bagID)
			if err != nil {
				return err
			}

			ctx := cmd.Context()
			client, user, err := reviewAuthenticatedClientFunc(ctx)
			if err != nil {
				return err
			}

			result, err := reviewStartReviewFunc(ctx, client, user.ID, resolvedBag)
			if err != nil {
				return err
			}

			if handled, err := jsonFlag.HandleOutput(reviewStartPayload(result), reviewStartFields); handled {
				return err
			}

			return printReviewStartText(cmd.OutOrStdout(), result)
		},
	}

	cmd.Flags().StringVar(&bagID, "bag", "", "Target bag ID. Falls back to default_bag_id in the config file.")
	return cmd
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
			client, user, err := reviewAuthenticatedClientFunc(ctx)
			if err != nil {
				return err
			}

			result, err := reviewRevealReviewFunc(ctx, client, user.ID)
			if err != nil {
				return err
			}

			if handled, err := jsonFlag.HandleOutput(reviewRevealPayload(result), reviewRevealFields); handled {
				return err
			}

			return printReviewRevealText(cmd.OutOrStdout(), result)
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
			client, user, err := reviewAuthenticatedClientFunc(ctx)
			if err != nil {
				return err
			}

			result, err := reviewRateReviewFunc(ctx, client, user.ID, rating)
			if err != nil {
				return err
			}

			if handled, err := jsonFlag.HandleOutput(reviewRatePayload(result), reviewRateFields); handled {
				return err
			}

			return printReviewRateText(cmd.OutOrStdout(), result)
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
			client, user, err := reviewAuthenticatedClientFunc(ctx)
			if err != nil {
				return err
			}

			pending, err := reviewFetchPendingReviewFunc(ctx, client, user.ID)
			if err != nil {
				return err
			}

			if handled, err := jsonFlag.HandleOutput(reviewStatusPayload(pending), reviewStatusFields); handled {
				return err
			}

			return printReviewStatusText(cmd.OutOrStdout(), pending)
		},
	}
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
			client, user, err := reviewAuthenticatedClientFunc(ctx)
			if err != nil {
				return err
			}

			result, err := reviewAbandonReviewFunc(ctx, client, user.ID)
			if err != nil {
				return err
			}

			if handled, err := jsonFlag.HandleOKOutput(
				map[string]any{"existed": result.Existed},
				reviewAbortFields,
			); handled {
				return err
			}

			return printReviewAbortText(cmd.OutOrStdout(), result)
		},
	}
}

func reviewStartPayload(result reviewStartResult) map[string]any {
	payload := map[string]any{
		"cardId":   result.CardID,
		"bagId":    result.BagID,
		"question": result.Question,
	}
	if result.Hint != nil {
		payload["hint"] = *result.Hint
	}
	return payload
}

func reviewRevealPayload(result reviewRevealResult) map[string]any {
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
	return payload
}

func reviewRatePayload(result reviewRateResult) map[string]any {
	return map[string]any{
		"nextReviewDate":      result.NextReviewDate,
		"nextReviewTimestamp": result.NextReviewTimestamp,
		"newState":            result.NewState,
		"dueCount":            result.DueCount,
	}
}

func reviewStatusPayload(pending *reviewStatusResult) map[string]any {
	payload := map[string]any{"pending": pending != nil}
	if pending == nil {
		return payload
	}

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
	return payload
}

func printReviewStartText(out io.Writer, result reviewStartResult) error {
	if _, err := fmt.Fprintf(out, "cardId: %s\n", result.CardID); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(out, "bagId: %s\n", result.BagID); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(out, "question: %s\n", result.Question); err != nil {
		return err
	}
	if result.Hint != nil && *result.Hint != "" {
		if _, err := fmt.Fprintf(out, "hint: %s\n", *result.Hint); err != nil {
			return err
		}
	}
	return nil
}

func printReviewRevealText(out io.Writer, result reviewRevealResult) error {
	if _, err := fmt.Fprintf(out, "cardId: %s\n", result.CardID); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(out, "%s\n", result.Question); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(out, "answer: %s\n", result.Answer); err != nil {
		return err
	}
	if result.Hint != nil && *result.Hint != "" {
		if _, err := fmt.Fprintf(out, "hint: %s\n", *result.Hint); err != nil {
			return err
		}
	}
	if result.Explanation != nil && *result.Explanation != "" {
		if _, err := fmt.Fprintf(out, "explanation: %s\n", *result.Explanation); err != nil {
			return err
		}
	}
	if result.Context != nil && *result.Context != "" {
		if _, err := fmt.Fprintf(out, "context: %s\n", *result.Context); err != nil {
			return err
		}
	}
	return nil
}

func printReviewRateText(out io.Writer, result reviewRateResult) error {
	if _, err := fmt.Fprintf(out, "nextReviewDate: %s\n", result.NextReviewDate); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(out, "newState: %d\n", int(result.NewState)); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(out, "dueCount: %d\n", int(result.DueCount)); err != nil {
		return err
	}
	return nil
}

func printReviewStatusText(out io.Writer, pending *reviewStatusResult) error {
	if pending == nil {
		_, err := fmt.Fprintln(out, "No pending review.")
		return err
	}
	if _, err := fmt.Fprintf(out, "cardId: %s\n", pending.CardID); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(out, "bagId: %s\n", pending.BagID); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(out, "question: %s\n", pending.Question); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(out, "startedAt: %s\n", time.UnixMilli(int64(pending.StartTime)).Format(time.RFC3339)); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(out, "revealed: %t\n", pending.Revealed); err != nil {
		return err
	}
	return nil
}

func printReviewAbortText(out io.Writer, result reviewAbandonResult) error {
	if result.Existed {
		_, err := fmt.Fprintln(out, "Pending review discarded.")
		return err
	}
	_, err := fmt.Fprintln(out, "No pending review to discard.")
	return err
}
