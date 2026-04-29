package cmd

import (
	"github.com/echoja/english-punch-app/cli/internal/ep/common"
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

var (
	reviewResolveBagIDFunc        = resolveBagID
	reviewAuthenticatedClientFunc = authenticatedClient
	reviewStartReviewFunc         = startReview
	reviewRevealReviewFunc        = revealReview
	reviewRateReviewFunc          = rateReview
	reviewFetchPendingReviewFunc  = fetchPendingReview
	reviewAbandonReviewFunc       = abandonReview
)

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
	cmd.AddCommand(newReviewAutoCmd())
	cmd.AddCommand(newReviewStatusCmd())
	cmd.AddCommand(newReviewAbortCmd())

	return cmd
}
