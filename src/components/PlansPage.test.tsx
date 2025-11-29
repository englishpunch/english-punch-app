import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, Mock } from "vitest";
import PlansPage from "./PlansPage";
import { useQuery, useMutation } from "convex/react";
import { Id } from "../../convex/_generated/dataModel";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

const mockedUseQuery = useQuery as unknown as Mock;
const mockedUseMutation = useMutation as unknown as Mock;

describe("PlansPage bags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseMutation.mockImplementation(() => vi.fn());
  });

  it("adds and deletes bags", async () => {
    const user = userEvent.setup();
    mockedUseQuery.mockImplementation((_fn: any, args: any) => {
      if (args?.bagId) return [];
      return [{ _id: "bag1", name: "Bag 1", totalCards: 0 }];
    });

    render(<PlansPage userId={"user_1" as Id<"users">} />);

    await user.type(screen.getByPlaceholderText(/새 샌드백 이름/i), "New Bag");
    await user.click(screen.getByRole("button", { name: /샌드백 추가/i }));

    const hasCreateBag = mockedUseMutation.mock.results.some((r) =>
      (r.value as Mock).mock.calls.some(
        (call: any[]) => call[0]?.name === "New Bag"
      )
    );
    expect(hasCreateBag).toBe(true);

    await user.click(screen.getByRole("button", { name: /삭제 bag 1/i }));
    const hasDeleteBag = mockedUseMutation.mock.results.some((r) =>
      (r.value as Mock).mock.calls.some(
        (call: any[]) => call[0]?.bagId === "bag1"
      )
    );
    expect(hasDeleteBag).toBe(true);
  });

  it("paginates bags 20 per page and navigates between pages", async () => {
    const user = userEvent.setup();
    const mockBags = Array.from({ length: 45 }, (_, i) => ({
      _id: `bag${i + 1}`,
      name: `Bag ${i + 1}`,
      totalCards: 0,
    }));
    mockedUseQuery.mockImplementation((_fn: any, args: any) => {
      if (args?.bagId) return [];
      return mockBags;
    });

    render(<PlansPage userId={"user_1" as Id<"users">} />);

    expect(screen.getAllByRole("button", { name: /관리 bag/i }).length).toBe(
      20
    );
    expect(screen.getByText(/^Bag 1$/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /다음 페이지/i }));

    expect(screen.getByText(/Bag 21/)).toBeInTheDocument();
    expect(screen.queryByText(/^Bag 1$/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /이전 페이지/i }));
    expect(screen.getByText(/^Bag 1$/)).toBeInTheDocument();
  });

  it("toggles test mode to request mocked bulk data in dev", async () => {
    const user = userEvent.setup();
    const calls: any[] = [];
    mockedUseQuery.mockImplementation((_fn: any, args: any) => {
      calls.push(args);
      return [];
    });

    render(<PlansPage userId={"user_1" as Id<"users">} />);

    expect(calls.at(-1)?.testMode).toBeFalsy();
    const toggle = screen.getByRole("button", { name: /테스트 모드/i });
    expect(toggle).toHaveTextContent(/OFF/);

    await user.click(screen.getByRole("button", { name: /테스트 모드/i }));

    expect(calls.at(-1)).toBe("skip");
    expect(toggle).toHaveTextContent(/ON/);
  });

  it("defaults to test mode when VITE_TEST_MODE is true", () => {
    const calls: any[] = [];
    vi.stubEnv("VITE_TEST_MODE", "true");
    mockedUseQuery.mockImplementation((_fn: any, args: any) => {
      calls.push(args);
      return [];
    });

    render(<PlansPage userId={"user_1" as Id<"users">} />);

    const toggle = screen.getByRole("button", { name: /테스트 모드/i });
    expect(calls.at(-1)).toBe("skip");
    expect(toggle).toHaveTextContent(/ON/);
    vi.unstubAllEnvs();
  });
});

describe("PlansPage cards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseMutation.mockImplementation(() => vi.fn());
  });

  it("opens a dedicated page to create and edit cards", async () => {
    const user = userEvent.setup();
    mockedUseQuery.mockImplementation((_fn: any, args: any) => {
      if (args?.bagId) {
        return [
          {
            _id: "card1",
            question: "Q1",
            answer: "A1",
            hint: "",
            explanation: "",
          },
        ];
      }
      return [{ _id: "bag1", name: "Bag 1", totalCards: 1 }];
    });

    render(<PlansPage userId={"user_1" as Id<"users">} />);

    await user.click(screen.getByRole("button", { name: /관리 bag 1/i }));

    expect(
      screen.queryByPlaceholderText(/질문을 입력/i)
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /카드 추가/i }));

    expect(screen.getByRole("heading", { name: /카드 추가/i })).toBeVisible();
    await user.type(screen.getByPlaceholderText(/질문을 입력/i), "새 질문");
    await user.type(screen.getByPlaceholderText(/정답을 입력/i), "새 답");
    await user.click(screen.getByRole("button", { name: /저장/i }));

    const createCardSpy = mockedUseMutation.mock.results
      .map((r) => r.value as Mock)
      .find((spy) =>
        spy.mock.calls.some(
          (call) => call[0]?.question === "새 질문" && call[0]?.bagId === "bag1"
        )
      );
    expect(createCardSpy).toBeTruthy();

    expect(
      screen.queryByPlaceholderText(/질문을 입력/i)
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /수정 card1/i }));
    expect(screen.getByRole("heading", { name: /카드 편집/i })).toBeVisible();
    expect(screen.getByDisplayValue(/Q1/)).toBeVisible();
  });

  it("adds, edits (with reset), and deletes cards in a bag", async () => {
    const user = userEvent.setup();
    mockedUseQuery.mockImplementation((_fn: any, args: any) => {
      if (args?.bagId) {
        return [
          {
            _id: "card1",
            question: "Q1",
            answer: "A1",
            hint: "H1",
            explanation: "E1",
          },
        ];
      }
      return [{ _id: "bag1", name: "Bag 1", totalCards: 1 }];
    });

    render(<PlansPage userId={"user_1" as Id<"users">} />);

    await user.click(screen.getByRole("button", { name: /관리 bag 1/i }));

    // add card
    await user.click(screen.getByRole("button", { name: /카드 추가/i }));
    await user.type(screen.getByPlaceholderText(/질문을 입력/i), "What? ");
    await user.type(screen.getByPlaceholderText(/정답을 입력/i), "Answer");
    await user.click(screen.getByRole("button", { name: /저장/i }));

    const createCardSpy = mockedUseMutation.mock.results.find((r) =>
      r.value.mock.calls.some((c: any[]) => c[0]?.question === "What? ")
    )?.value as Mock;
    expect(createCardSpy).toBeTruthy();
    expect(createCardSpy).toHaveBeenCalledWith({
      bagId: "bag1",
      userId: "user_1",
      question: "What? ",
      answer: "Answer",
      hint: "",
      explanation: "",
    });

    // edit card
    await user.click(screen.getByRole("button", { name: /수정 card1/i }));
    const questionInput = screen.getByDisplayValue(/Q1/);
    await user.clear(questionInput);
    await user.type(questionInput, "Q1 edited");
    await user.click(screen.getByRole("button", { name: /저장/i }));

    const updateCardSpy = mockedUseMutation.mock.results
      .map((r) => r.value as Mock)
      .find((spy) =>
        spy.mock.calls.some(
          (call) =>
            call[0]?.cardId === "card1" && call[0]?.question === "Q1 edited"
        )
      );
    expect(updateCardSpy).toBeTruthy();
    const lastCall = updateCardSpy!.mock.calls.find(
      (call) => call[0].question === "Q1 edited"
    )?.[0];
    expect(lastCall.state).toBe(0);
    expect(lastCall.reps).toBe(0);
    expect(lastCall.lapses).toBe(0);
    expect(lastCall.scheduled_days).toBe(0);
    expect(lastCall.learning_steps).toBe(0);
    expect(lastCall.stability).toBe(0);
    expect(lastCall.difficulty).toBe(0);
    expect(typeof lastCall.due).toBe("number");

    // delete card
    await user.click(screen.getByRole("button", { name: /삭제 card1/i }));
    const deleteCardSpy = mockedUseMutation.mock.results
      .map((r) => r.value as Mock)
      .find((spy) =>
        spy.mock.calls.some(
          (call) =>
            call[0]?.cardId === "card1" && call[0]?.question === undefined
        )
      );
    expect(deleteCardSpy).toBeTruthy();
    expect(deleteCardSpy).toHaveBeenCalledWith({
      cardId: "card1",
      bagId: "bag1",
    });
  });
});
