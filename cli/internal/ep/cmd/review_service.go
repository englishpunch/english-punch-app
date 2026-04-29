package cmd

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
	"github.com/echoja/english-punch-app/cli/internal/ep/convex"
)

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

func hasExitToken(err error, token string) bool {
	var exitErr *common.ExitError
	return errors.As(err, &exitErr) && exitErr.Token == token
}
