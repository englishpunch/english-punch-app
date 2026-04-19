package cmd

import (
	"context"
	"reflect"
	"strings"
	"testing"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
)

type fakeReviewAutoStep struct {
	start  reviewStartResult
	reveal reviewRevealResult
	rate   reviewRateResult
}

type fakeReviewAutoService struct {
	steps       []fakeReviewAutoStep
	current     *fakeReviewAutoStep
	pending     *reviewStatusResult
	next        int
	startedBags []string
	ratings     []int
	abortCalls  int
}

func newFakeReviewAutoService(steps ...fakeReviewAutoStep) *fakeReviewAutoService {
	return &fakeReviewAutoService{steps: steps}
}

func (s *fakeReviewAutoService) FetchPendingReview(context.Context) (*reviewStatusResult, error) {
	if s.pending == nil {
		return nil, nil
	}
	pending := *s.pending
	return &pending, nil
}

func (s *fakeReviewAutoService) StartReview(_ context.Context, bagID string) (reviewStartResult, error) {
	if s.pending != nil {
		return reviewStartResult{}, common.NewTokenError(common.TokenReviewAlreadyPending, "pending review exists", nil)
	}
	if s.next >= len(s.steps) {
		return reviewStartResult{}, common.NewTokenError(common.TokenNoCardAvailable, "no due cards", nil)
	}

	s.startedBags = append(s.startedBags, bagID)
	s.current = &s.steps[s.next]
	s.next++
	s.pending = &reviewStatusResult{
		CardID:   s.current.start.CardID,
		BagID:    s.current.start.BagID,
		Question: s.current.start.Question,
		Hint:     s.current.start.Hint,
		Revealed: false,
	}
	return s.current.start, nil
}

func (s *fakeReviewAutoService) RevealReview(context.Context) (reviewRevealResult, error) {
	if s.pending == nil {
		return reviewRevealResult{}, common.NewTokenError(common.TokenNoPendingReview, "no pending review", nil)
	}
	s.pending.Revealed = true
	return s.current.reveal, nil
}

func (s *fakeReviewAutoService) RateReview(_ context.Context, rating int) (reviewRateResult, error) {
	if s.pending == nil {
		return reviewRateResult{}, common.NewTokenError(common.TokenNoPendingReview, "no pending review", nil)
	}
	if !s.pending.Revealed {
		return reviewRateResult{}, common.NewTokenError(common.TokenReviewNotRevealed, "not revealed", nil)
	}
	s.ratings = append(s.ratings, rating)
	s.pending = nil
	return s.current.rate, nil
}

func (s *fakeReviewAutoService) AbandonReview(context.Context) (reviewAbandonResult, error) {
	existed := s.pending != nil
	s.abortCalls++
	s.pending = nil
	return reviewAbandonResult{Ok: true, Existed: existed}, nil
}

func TestParseReviewAutoRating(t *testing.T) {
	tests := []struct {
		input      string
		wantRating int
		wantQuit   bool
		wantOK     bool
	}{
		{input: "1", wantRating: 1, wantOK: true},
		{input: "again", wantRating: 1, wantOK: true},
		{input: "H", wantRating: 2, wantOK: true},
		{input: "good", wantRating: 3, wantOK: true},
		{input: " easy ", wantRating: 4, wantOK: true},
		{input: "q", wantQuit: true, wantOK: true},
		{input: "later", wantOK: false},
	}

	for _, tt := range tests {
		gotRating, gotQuit, gotOK := parseReviewAutoRating(tt.input)
		if gotRating != tt.wantRating || gotQuit != tt.wantQuit || gotOK != tt.wantOK {
			t.Fatalf("parseReviewAutoRating(%q) = (%d, %t, %t), want (%d, %t, %t)", tt.input, gotRating, gotQuit, gotOK, tt.wantRating, tt.wantQuit, tt.wantOK)
		}
	}
}

func TestRunReviewAuto_CompletesUntilDueCountZero(t *testing.T) {
	hint1 := "first hint"
	explanation1 := "first explanation"
	hint2 := "second hint"
	service := newFakeReviewAutoService(
		fakeReviewAutoStep{
			start: reviewStartResult{
				CardID:   "card-1",
				BagID:    "bag-1",
				Question: "question 1",
				Hint:     &hint1,
			},
			reveal: reviewRevealResult{
				CardID:      "card-1",
				Question:    "question 1",
				Answer:      "answer 1",
				Explanation: &explanation1,
			},
			rate: reviewRateResult{
				NextReviewDate: "2026-04-20",
				DueCount:       1,
			},
		},
		fakeReviewAutoStep{
			start: reviewStartResult{
				CardID:   "card-2",
				BagID:    "bag-1",
				Question: "question 2",
				Hint:     &hint2,
			},
			reveal: reviewRevealResult{
				CardID:   "card-2",
				Question: "question 2",
				Answer:   "answer 2",
			},
			rate: reviewRateResult{
				NextReviewDate: "2026-04-22",
				DueCount:       0,
			},
		},
	)

	var output strings.Builder
	resolveCalls := 0
	err := runReviewAuto(
		context.Background(),
		service,
		func() (string, error) {
			resolveCalls++
			return "bag-1", nil
		},
		strings.NewReader("\n3\n\n4\n"),
		&output,
	)
	if err != nil {
		t.Fatalf("runReviewAuto: %v", err)
	}

	if resolveCalls != 1 {
		t.Fatalf("resolveCalls = %d, want 1", resolveCalls)
	}
	if !reflect.DeepEqual(service.startedBags, []string{"bag-1", "bag-1"}) {
		t.Fatalf("startedBags = %#v", service.startedBags)
	}
	if !reflect.DeepEqual(service.ratings, []int{3, 4}) {
		t.Fatalf("ratings = %#v, want [3 4]", service.ratings)
	}
	if !strings.Contains(output.String(), "Review complete. Rated 2 card(s).") {
		t.Fatalf("output missing completion summary:\n%s", output.String())
	}
	if !strings.Contains(output.String(), "answer: answer 1") {
		t.Fatalf("output missing first answer:\n%s", output.String())
	}
}

func TestRunReviewAuto_ResumesRevealedPendingReview(t *testing.T) {
	hint := "hint"
	service := newFakeReviewAutoService(
		fakeReviewAutoStep{
			start: reviewStartResult{
				CardID:   "card-1",
				BagID:    "bag-1",
				Question: "question 1",
				Hint:     &hint,
			},
			reveal: reviewRevealResult{
				CardID:   "card-1",
				Question: "question 1",
				Answer:   "answer 1",
			},
			rate: reviewRateResult{
				NextReviewDate: "2026-04-20",
				DueCount:       0,
			},
		},
	)
	service.current = &service.steps[0]
	service.next = 1
	service.pending = &reviewStatusResult{
		CardID:   "card-1",
		BagID:    "bag-1",
		Question: "question 1",
		Hint:     &hint,
		Revealed: true,
	}

	var output strings.Builder
	err := runReviewAuto(
		context.Background(),
		service,
		func() (string, error) {
			t.Fatal("resolveBag should not be called when resuming a pending review")
			return "", nil
		},
		strings.NewReader("3\n"),
		&output,
	)
	if err != nil {
		t.Fatalf("runReviewAuto: %v", err)
	}

	if len(service.startedBags) != 0 {
		t.Fatalf("startedBags = %#v, want empty", service.startedBags)
	}
	if !reflect.DeepEqual(service.ratings, []int{3}) {
		t.Fatalf("ratings = %#v, want [3]", service.ratings)
	}
	if !strings.Contains(output.String(), "Resuming pending review.") {
		t.Fatalf("output missing resume message:\n%s", output.String())
	}
	if !strings.Contains(output.String(), "Answer was already revealed.") {
		t.Fatalf("output missing revealed resume message:\n%s", output.String())
	}
}

func TestRunReviewAuto_QuitDiscardsPendingReview(t *testing.T) {
	service := newFakeReviewAutoService(
		fakeReviewAutoStep{
			start: reviewStartResult{
				CardID:   "card-1",
				BagID:    "bag-1",
				Question: "question 1",
			},
			reveal: reviewRevealResult{
				CardID:   "card-1",
				Question: "question 1",
				Answer:   "answer 1",
			},
			rate: reviewRateResult{
				NextReviewDate: "2026-04-20",
				DueCount:       0,
			},
		},
	)

	var output strings.Builder
	err := runReviewAuto(
		context.Background(),
		service,
		func() (string, error) { return "bag-1", nil },
		strings.NewReader("q\n"),
		&output,
	)
	if err != nil {
		t.Fatalf("runReviewAuto: %v", err)
	}

	if service.abortCalls != 1 {
		t.Fatalf("abortCalls = %d, want 1", service.abortCalls)
	}
	if len(service.ratings) != 0 {
		t.Fatalf("ratings = %#v, want empty", service.ratings)
	}
	if !strings.Contains(output.String(), "Pending review discarded. Exiting review auto.") {
		t.Fatalf("output missing quit message:\n%s", output.String())
	}
}
