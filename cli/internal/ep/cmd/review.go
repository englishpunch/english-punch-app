package cmd

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
	"github.com/echoja/english-punch-app/cli/internal/ep/convex"
	"github.com/spf13/cobra"
	"golang.org/x/term"
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

type reviewAutoService interface {
	FetchPendingReview(ctx context.Context) (*reviewStatusResult, error)
	StartReview(ctx context.Context, bagID string) (reviewStartResult, error)
	RevealReview(ctx context.Context) (reviewRevealResult, error)
	RateReview(ctx context.Context, rating int) (reviewRateResult, error)
	AbandonReview(ctx context.Context) (reviewAbandonResult, error)
}

type reviewAutoCard struct {
	CardID   string
	Question string
	Hint     *string
	Revealed bool
	Resumed  bool
}

type convexReviewAutoService struct {
	client *convex.Client
	userID string
}

func (s convexReviewAutoService) FetchPendingReview(ctx context.Context) (*reviewStatusResult, error) {
	return fetchPendingReview(ctx, s.client, s.userID)
}

func (s convexReviewAutoService) StartReview(ctx context.Context, bagID string) (reviewStartResult, error) {
	return startReview(ctx, s.client, s.userID, bagID)
}

func (s convexReviewAutoService) RevealReview(ctx context.Context) (reviewRevealResult, error) {
	return revealReview(ctx, s.client, s.userID)
}

func (s convexReviewAutoService) RateReview(ctx context.Context, rating int) (reviewRateResult, error) {
	return rateReview(ctx, s.client, s.userID, rating)
}

func (s convexReviewAutoService) AbandonReview(ctx context.Context) (reviewAbandonResult, error) {
	return abandonReview(ctx, s.client, s.userID)
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
	cmd.AddCommand(newReviewAutoCmd())
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

			result, err := startReview(ctx, client, user.ID, resolvedBag)
			if err != nil {
				return err
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

func startReview(ctx context.Context, client *convex.Client, userID, bagID string) (reviewStartResult, error) {
	raw, err := client.Mutation(ctx, "review:startReview", map[string]any{
		"userId": userID,
		"bagId":  bagID,
	})
	if err != nil {
		return reviewStartResult{}, err
	}

	var result reviewStartResult
	if err := json.Unmarshal(raw, &result); err != nil {
		return reviewStartResult{}, fmt.Errorf("parse startReview response: %w", err)
	}

	if !result.Ok {
		return reviewStartResult{}, reviewStartError(result)
	}

	return result, nil
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

			result, err := revealReview(ctx, client, user.ID)
			if err != nil {
				return err
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

func revealReview(ctx context.Context, client *convex.Client, userID string) (reviewRevealResult, error) {
	raw, err := client.Mutation(ctx, "review:revealReview", map[string]any{
		"userId": userID,
	})
	if err != nil {
		return reviewRevealResult{}, err
	}

	var result reviewRevealResult
	if err := json.Unmarshal(raw, &result); err != nil {
		return reviewRevealResult{}, fmt.Errorf("parse revealReview response: %w", err)
	}

	if !result.Ok {
		if result.Token == common.TokenNoPendingReview {
			return reviewRevealResult{}, common.NewTokenError(
				common.TokenNoPendingReview,
				"no pending review — run 'ep review start' first",
				nil,
			)
		}
		return reviewRevealResult{}, fmt.Errorf("unexpected revealReview failure token: %q", result.Token)
	}

	return result, nil
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

			result, err := rateReview(ctx, client, user.ID, rating)
			if err != nil {
				return err
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

func rateReview(ctx context.Context, client *convex.Client, userID string, rating int) (reviewRateResult, error) {
	raw, err := client.Mutation(ctx, "review:rateReview", map[string]any{
		"userId": userID,
		"rating": rating,
	})
	if err != nil {
		return reviewRateResult{}, err
	}

	var result reviewRateResult
	if err := json.Unmarshal(raw, &result); err != nil {
		return reviewRateResult{}, fmt.Errorf("parse rateReview response: %w", err)
	}

	if !result.Ok {
		switch result.Token {
		case common.TokenNoPendingReview:
			return reviewRateResult{}, common.NewTokenError(
				common.TokenNoPendingReview,
				"no pending review — run 'ep review start' first",
				nil,
			)
		case common.TokenReviewNotRevealed:
			return reviewRateResult{}, common.NewTokenError(
				common.TokenReviewNotRevealed,
				"pending review has not been revealed yet — run 'ep review reveal' before 'rate'",
				nil,
			)
		}
		return reviewRateResult{}, fmt.Errorf("unexpected rateReview failure token: %q", result.Token)
	}

	return result, nil
}

func newReviewAutoCmd() *cobra.Command {
	var bagID string

	cmd := &cobra.Command{
		Use:   "auto",
		Short: "Continuously review due cards in an interactive loop",
		Long: `Run a human-oriented review loop that continuously
resumes or starts a pending review, reveals the answer on Enter,
prompts for a 1-4 FSRS rating, and repeats until there are no due
cards left.

Unlike the stateless subcommands, this command is intentionally
interactive: it requires a terminal and does not support --json.
If a pending review already exists, auto resumes it instead of
failing with REVIEW_ALREADY_PENDING.`,
		Example: `  ep review auto
  ep review auto --bag k17abc...`,
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if jsonFlag.Used {
				return common.NewTokenError(
					common.TokenInteractiveOnly,
					"'ep review auto' is interactive only and does not support --json",
					nil,
				)
			}
			if !isInteractiveTerminal(cmd.InOrStdin()) || !isInteractiveTerminal(cmd.OutOrStdout()) {
				return common.NewTokenError(
					common.TokenNotATTY,
					"'ep review auto' requires an interactive terminal on stdin and stdout",
					nil,
				)
			}

			ctx := cmd.Context()
			client, user, err := authenticatedClient(ctx)
			if err != nil {
				return err
			}

			service := convexReviewAutoService{client: client, userID: user.ID}
			return runReviewAuto(
				ctx,
				service,
				func() (string, error) { return resolveBagID(bagID) },
				cmd.InOrStdin(),
				cmd.OutOrStdout(),
			)
		},
	}

	cmd.Flags().StringVar(&bagID, "bag", "", "Target bag ID for newly started reviews. Falls back to default_bag_id in the config file.")
	return cmd
}

type fileDescriptorProvider interface {
	Fd() uintptr
}

func isInteractiveTerminal(stream any) bool {
	fdStream, ok := stream.(fileDescriptorProvider)
	if !ok {
		return false
	}
	return term.IsTerminal(int(fdStream.Fd()))
}

func runReviewAuto(
	ctx context.Context,
	service reviewAutoService,
	resolveBag func() (string, error),
	in io.Reader,
	out io.Writer,
) error {
	reader := bufio.NewReader(in)
	completed := 0
	var (
		cachedBagID string
		bagResolved bool
	)

	resolveBagOnce := func() (string, error) {
		if bagResolved {
			return cachedBagID, nil
		}
		resolvedBagID, err := resolveBag()
		if err != nil {
			return "", err
		}
		cachedBagID = resolvedBagID
		bagResolved = true
		return cachedBagID, nil
	}

	for {
		card, exhausted, err := nextReviewAutoCard(ctx, service, resolveBagOnce)
		if err != nil {
			return err
		}
		if exhausted {
			if err := printReviewAutoSummary(out, completed); err != nil {
				return err
			}
			return nil
		}

		if err := printReviewAutoQuestion(out, card); err != nil {
			return err
		}
		if !card.Revealed {
			quit, err := promptReviewAutoReveal(reader, out)
			if err != nil {
				return err
			}
			if quit {
				return abandonReviewAuto(ctx, service, out)
			}
		} else {
			if err := writeLine(out, "Answer was already revealed. Showing it again before rating."); err != nil {
				return err
			}
		}

		revealed, err := service.RevealReview(ctx)
		if err != nil {
			return err
		}
		if err := printReviewAutoReveal(out, revealed); err != nil {
			return err
		}

		rating, quit, err := promptReviewAutoRating(reader, out)
		if err != nil {
			return err
		}
		if quit {
			return abandonReviewAuto(ctx, service, out)
		}

		rated, err := service.RateReview(ctx, rating)
		if err != nil {
			return err
		}
		completed++
		if err := printReviewAutoRate(out, rating, rated); err != nil {
			return err
		}
		if int(rated.DueCount) == 0 {
			if err := printReviewAutoSummary(out, completed); err != nil {
				return err
			}
			return nil
		}
	}
}

func nextReviewAutoCard(
	ctx context.Context,
	service reviewAutoService,
	resolveBag func() (string, error),
) (*reviewAutoCard, bool, error) {
	pending, err := service.FetchPendingReview(ctx)
	if err != nil {
		return nil, false, err
	}
	if pending != nil {
		return &reviewAutoCard{
			CardID:   pending.CardID,
			Question: pending.Question,
			Hint:     pending.Hint,
			Revealed: pending.Revealed,
			Resumed:  true,
		}, false, nil
	}

	bagID, err := resolveBag()
	if err != nil {
		return nil, false, err
	}

	started, err := service.StartReview(ctx, bagID)
	if err != nil {
		if hasExitToken(err, common.TokenNoCardAvailable) {
			return nil, true, nil
		}
		if hasExitToken(err, common.TokenReviewAlreadyPending) {
			pending, pendingErr := service.FetchPendingReview(ctx)
			if pendingErr != nil {
				return nil, false, pendingErr
			}
			if pending == nil {
				return nil, false, fmt.Errorf("review auto: pending review disappeared while resuming")
			}
			return &reviewAutoCard{
				CardID:   pending.CardID,
				Question: pending.Question,
				Hint:     pending.Hint,
				Revealed: pending.Revealed,
				Resumed:  true,
			}, false, nil
		}
		return nil, false, err
	}

	return &reviewAutoCard{
		CardID:   started.CardID,
		Question: started.Question,
		Hint:     started.Hint,
		Revealed: false,
		Resumed:  false,
	}, false, nil
}

func promptReviewAutoReveal(reader *bufio.Reader, out io.Writer) (bool, error) {
	for {
		if err := writeString(out, "Press Enter to reveal, or q to quit and discard this pending review: "); err != nil {
			return false, fmt.Errorf("write reveal prompt: %w", err)
		}
		line, err := reader.ReadString('\n')
		if err != nil {
			return false, fmt.Errorf("read reveal input: %w", err)
		}

		switch strings.ToLower(strings.TrimSpace(line)) {
		case "":
			return false, nil
		case "q", "quit", "exit":
			return true, nil
		default:
			if err := writeLine(out, "Enter to reveal, or q to quit."); err != nil {
				return false, fmt.Errorf("write reveal retry prompt: %w", err)
			}
		}
	}
}

func promptReviewAutoRating(reader *bufio.Reader, out io.Writer) (int, bool, error) {
	for {
		if err := writeString(out, "Rate [1] Again [2] Hard [3] Good [4] Easy, or q to quit and discard this pending review: "); err != nil {
			return 0, false, fmt.Errorf("write rating prompt: %w", err)
		}
		line, err := reader.ReadString('\n')
		if err != nil {
			return 0, false, fmt.Errorf("read rating input: %w", err)
		}

		rating, quit, ok := parseReviewAutoRating(line)
		if ok {
			return rating, quit, nil
		}
		if err := writeLine(out, "Enter 1, 2, 3, 4, or q."); err != nil {
			return 0, false, fmt.Errorf("write rating retry prompt: %w", err)
		}
	}
}

func parseReviewAutoRating(input string) (int, bool, bool) {
	switch strings.ToLower(strings.TrimSpace(input)) {
	case "1", "a", "again":
		return 1, false, true
	case "2", "h", "hard":
		return 2, false, true
	case "3", "g", "good":
		return 3, false, true
	case "4", "e", "easy":
		return 4, false, true
	case "q", "quit", "exit":
		return 0, true, true
	default:
		return 0, false, false
	}
}

func abandonReviewAuto(ctx context.Context, service reviewAutoService, out io.Writer) error {
	result, err := service.AbandonReview(ctx)
	if err != nil {
		return err
	}

	if result.Existed {
		return writeLine(out, "Pending review discarded. Exiting review auto.")
	}
	return writeLine(out, "No pending review remained. Exiting review auto.")
}

func printReviewAutoQuestion(out io.Writer, card *reviewAutoCard) error {
	if err := writeLine(out, ""); err != nil {
		return err
	}
	if card.Resumed {
		if err := writeLine(out, "Resuming pending review."); err != nil {
			return err
		}
	} else {
		if err := writeLine(out, "Starting next due card."); err != nil {
			return err
		}
	}
	if err := writef(out, "cardId: %s\n", card.CardID); err != nil {
		return err
	}
	if err := writef(out, "question: %s\n", card.Question); err != nil {
		return err
	}
	if card.Hint != nil && *card.Hint != "" {
		if err := writef(out, "hint: %s\n", *card.Hint); err != nil {
			return err
		}
	}
	return nil
}

func printReviewAutoReveal(out io.Writer, revealed reviewRevealResult) error {
	if err := writef(out, "answer: %s\n", revealed.Answer); err != nil {
		return err
	}
	if revealed.Explanation != nil && *revealed.Explanation != "" {
		if err := writef(out, "explanation: %s\n", *revealed.Explanation); err != nil {
			return err
		}
	}
	if revealed.Context != nil && *revealed.Context != "" {
		if err := writef(out, "context: %s\n", *revealed.Context); err != nil {
			return err
		}
	}
	return nil
}

func printReviewAutoRate(out io.Writer, rating int, rated reviewRateResult) error {
	if err := writef(out, "rated: %s\n", reviewAutoRatingLabel(rating)); err != nil {
		return err
	}
	if err := writef(out, "nextReviewDate: %s\n", rated.NextReviewDate); err != nil {
		return err
	}
	return writef(out, "remainingDue: %d\n", int(rated.DueCount))
}

func printReviewAutoSummary(out io.Writer, completed int) error {
	if completed == 0 {
		return writeLine(out, "No due cards right now.")
	}
	return writef(out, "Review complete. Rated %d card(s).\n", completed)
}

func reviewAutoRatingLabel(rating int) string {
	switch rating {
	case 1:
		return "Again"
	case 2:
		return "Hard"
	case 3:
		return "Good"
	case 4:
		return "Easy"
	default:
		return strconv.Itoa(rating)
	}
}

func hasExitToken(err error, token string) bool {
	var exitErr *common.ExitError
	return errors.As(err, &exitErr) && exitErr.Token == token
}

func writeString(out io.Writer, text string) error {
	_, err := io.WriteString(out, text)
	return err
}

func writeLine(out io.Writer, text string) error {
	_, err := fmt.Fprintln(out, text)
	return err
}

func writef(out io.Writer, format string, args ...any) error {
	_, err := fmt.Fprintf(out, format, args...)
	return err
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

func abandonReview(ctx context.Context, client *convex.Client, userID string) (reviewAbandonResult, error) {
	raw, err := client.Mutation(ctx, "review:abandonReview", map[string]any{
		"userId": userID,
	})
	if err != nil {
		return reviewAbandonResult{}, err
	}

	var result reviewAbandonResult
	if err := json.Unmarshal(raw, &result); err != nil {
		return reviewAbandonResult{}, fmt.Errorf("parse abandonReview response: %w", err)
	}

	return result, nil
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

			result, err := abandonReview(ctx, client, user.ID)
			if err != nil {
				return err
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
