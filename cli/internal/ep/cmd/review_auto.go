package cmd

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"strconv"
	"strings"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
	"github.com/spf13/cobra"
	"golang.org/x/term"
)

const reviewAutoQuestionRuleFallback = "────────────────────────"

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
			client, user, err := reviewAuthenticatedClientFunc(ctx)
			if err != nil {
				return err
			}

			service := convexReviewAutoService{client: client, userID: user.ID}
			return runReviewAuto(
				ctx,
				service,
				func() (string, error) { return reviewResolveBagIDFunc(bagID) },
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
	if err := writeSectionHeader(out, "Question"); err != nil {
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
	questionRule := reviewAutoQuestionRule(out)
	if err := writeLine(out, questionRule); err != nil {
		return err
	}
	if err := writef(out, "question: %s\n", card.Question); err != nil {
		return err
	}
	if err := writeLine(out, questionRule); err != nil {
		return err
	}
	if card.Hint != nil && *card.Hint != "" {
		if err := writef(out, "hint: %s\n", *card.Hint); err != nil {
			return err
		}
	}
	return writeLine(out, "")
}

func printReviewAutoReveal(out io.Writer, revealed reviewRevealResult) error {
	if err := writeSectionHeader(out, "Reveal"); err != nil {
		return err
	}
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
	return writeLine(out, "")
}

func printReviewAutoRate(out io.Writer, rating int, rated reviewRateResult) error {
	if err := writeSectionHeader(out, "Result"); err != nil {
		return err
	}
	if err := writef(out, "rated: %s\n", reviewAutoRatingLabel(rating)); err != nil {
		return err
	}
	if err := writef(out, "nextReviewDate: %s\n", rated.NextReviewDate); err != nil {
		return err
	}
	return writef(out, "remainingDue: %d\n", int(rated.DueCount))
}

func printReviewAutoSummary(out io.Writer, completed int) error {
	if err := writeSectionHeader(out, "Summary"); err != nil {
		return err
	}
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

func reviewAutoQuestionRule(out io.Writer) string {
	fdStream, ok := out.(fileDescriptorProvider)
	if !ok {
		return reviewAutoQuestionRuleFallback
	}

	width, _, err := term.GetSize(int(fdStream.Fd()))
	if err != nil || width <= 4 {
		return reviewAutoQuestionRuleFallback
	}

	return strings.Repeat("─", width-2)
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

func writeSectionHeader(out io.Writer, title string) error {
	if err := writeLine(out, ""); err != nil {
		return err
	}
	return writef(out, "[%s]\n", title)
}
