package cmd

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
	"github.com/echoja/english-punch-app/cli/internal/ep/convex"
)

type cardDetail struct {
	ID           string  `json:"_id,omitempty"`
	CreationTime float64 `json:"_creationTime,omitempty"`
	Question     string  `json:"question"`
	Answer       string  `json:"answer"`
	Hint         *string `json:"hint,omitempty"`
	Explanation  *string `json:"explanation,omitempty"`
	Context      *string `json:"context,omitempty"`
	SourceWord   *string `json:"sourceWord,omitempty"`
	Expression   *string `json:"expression,omitempty"`
}

type cardReplacement struct {
	Question    string
	Answer      string
	Hint        string
	Explanation *string
	Context     *string
	SourceWord  *string
	Expression  *string
}

type cardListOptions struct {
	BagID  string
	UserID string
	Search string
	Limit  int
	Cursor string
}

type cardListResult struct {
	BagID          string       `json:"bagId"`
	Search         string       `json:"search,omitempty"`
	Count          int          `json:"count"`
	IsDone         bool         `json:"isDone"`
	ContinueCursor string       `json:"continueCursor,omitempty"`
	Page           []cardDetail `json:"page"`
}

func getCard(ctx context.Context, client *convex.Client, userID, bagID, cardID string) (*cardDetail, error) {
	raw, err := client.Query(ctx, "learning:getCard", map[string]any{
		"cardId": cardID,
		"bagId":  bagID,
		"userId": userID,
	})
	if err != nil {
		return nil, err
	}

	if string(raw) == "null" {
		return nil, common.NewTokenError(
			common.TokenCardNotFound,
			fmt.Sprintf("card %q not found in bag %q", cardID, bagID),
			nil,
		)
	}

	var card cardDetail
	if err := json.Unmarshal(raw, &card); err != nil {
		return nil, fmt.Errorf("parse getCard response: %w", err)
	}
	return &card, nil
}

func listCards(ctx context.Context, client *convex.Client, opts cardListOptions) (*cardListResult, error) {
	paginationOpts := map[string]any{
		"numItems": opts.Limit,
		"cursor":   nil,
	}
	if opts.Cursor != "" {
		paginationOpts["cursor"] = opts.Cursor
	}

	args := map[string]any{
		"bagId":          opts.BagID,
		"userId":         opts.UserID,
		"paginationOpts": paginationOpts,
	}
	if opts.Search != "" {
		args["search"] = opts.Search
	}

	raw, err := client.Query(ctx, "learning:getBagCardsPaginated", args)
	if err != nil {
		return nil, err
	}

	var response struct {
		Page           []cardDetail `json:"page"`
		ContinueCursor string       `json:"continueCursor"`
		IsDone         bool         `json:"isDone"`
	}
	if err := json.Unmarshal(raw, &response); err != nil {
		return nil, fmt.Errorf("parse getBagCardsPaginated response: %w", err)
	}

	return &cardListResult{
		BagID:          opts.BagID,
		Search:         opts.Search,
		Count:          len(response.Page),
		IsDone:         response.IsDone,
		ContinueCursor: response.ContinueCursor,
		Page:           response.Page,
	}, nil
}

func replaceCardContentAndResetSchedule(
	ctx context.Context,
	client *convex.Client,
	bagID string,
	cardID string,
	replacement cardReplacement,
) error {
	args := map[string]any{
		"cardId":   cardID,
		"bagId":    bagID,
		"question": replacement.Question,
		"answer":   replacement.Answer,
		"hint":     replacement.Hint,
	}
	if replacement.Explanation != nil {
		args["explanation"] = *replacement.Explanation
	}
	if replacement.Context != nil {
		args["context"] = *replacement.Context
	}
	if replacement.SourceWord != nil {
		args["sourceWord"] = *replacement.SourceWord
	}
	if replacement.Expression != nil {
		args["expression"] = *replacement.Expression
	}

	if _, err := client.Mutation(ctx, "learning:replaceCardContentAndResetSchedule", args); err != nil {
		return err
	}
	return nil
}
