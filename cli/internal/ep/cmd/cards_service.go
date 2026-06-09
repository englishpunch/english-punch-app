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
