import { useMemo, useState, useEffect } from "react";
import { ReactMutation, useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "./Button";
import {
  Plus,
  Trash2,
  Edit2,
  ArrowLeft,
  Loader2,
  Sparkles,
  RefreshCcw,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { getGlobalLogger } from "@/lib/globalLogger";
import useIsMock from "@/hooks/useIsMock";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
const logger = getGlobalLogger();

type Card = {
  _id: Id<"cards">;
  _creationTime: number;
  question: string;
  answer: string;
  hint?: string;
  explanation?: string;
  context?: string;
  sourceWord?: string;
  expression?: string;
};

export default function PlansPage() {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const userId = loggedInUser?._id;
  const isMock = useIsMock();
  const [currentPage, setCurrentPage] = useState(1);

  const bagsArgs = isMock
    ? "skip"
    : userId
      ? {
          userId,
        }
      : "skip";
  const bagsQuery = useQuery(api.learning.getUserBags, bagsArgs);
  const createBag = useMutation(api.learning.createBag);
  const deleteBag = useMutation(api.learning.deleteBag);

  const [newBagName, setNewBagName] = useState("");
  const [activeBagId, setActiveBagId] = useState<Id<"bags"> | null>(null);

  const handleAddBag = async () => {
    const name = newBagName.trim();
    if (!name) return;
    if (!userId) return;
    await createBag({ userId, name });
    setNewBagName("");
  };

  const mockBags = useMemo(() => {
    if (!isMock) return [];
    return Array.from({ length: 500 }, (_, i) => ({
      _id: `mock-${i + 1}` as Id<"bags">,
      name: `Mock Bag ${i + 1}`,
      totalCards: 0,
    }));
  }, [isMock]);

  const bags = isMock ? mockBags : bagsQuery;

  const activeBag = useMemo(
    () => bags?.find((d) => d._id === activeBagId) || null,
    [bags, activeBagId]
  );

  const PAGE_SIZE = 20;
  const totalPages = useMemo(() => {
    if (!bags?.length) return 1;
    return Math.ceil(bags.length / PAGE_SIZE);
  }, [bags]);

  const clampPage = (page: number) => Math.min(Math.max(page, 1), totalPages);
  const safeCurrentPage = clampPage(currentPage);
  const setPage = (next: number | ((page: number) => number)) => {
    setCurrentPage((prev) => {
      const resolved =
        typeof next === "function"
          ? (next as (page: number) => number)(prev)
          : next;
      return clampPage(resolved);
    });
  };

  const visibleBags = useMemo(() => {
    if (!bags) return [];
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    return bags.slice(start, start + PAGE_SIZE);
  }, [bags, safeCurrentPage]);

  if (activeBag) {
    return <BagDetail bag={activeBag} onBack={() => setActiveBagId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">샌드백 추가</h2>
        </div>
        <div className="mt-3 flex gap-2">
          <label className="sr-only" htmlFor="new-bag-name">
            새 샌드백 이름
          </label>
          <input
            id="new-bag-name"
            className="focus:border-primary-500 focus:ring-primary-500 flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm focus:ring-1"
            placeholder="새 샌드백 이름"
            value={newBagName}
            onChange={(e) => setNewBagName(e.target.value)}
          />
          {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
          <Button onClick={handleAddBag} className="gap-2">
            <Plus className="h-4 w-4" aria-hidden /> 샌드백 추가
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {visibleBags.map((bag) => (
          <div
            key={bag._id}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div>
              <p className="text-sm font-semibold text-gray-900">{bag.name}</p>
              <p className="text-xs text-gray-500">카드 {bag.totalCards}장</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setActiveBagId(bag._id)}
                aria-label={`관리 ${bag.name}`}
              >
                관리
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void deleteBag({ bagId: bag._id })}
                aria-label={`삭제 ${bag.name}`}
              >
                <Trash2 className="h-4 w-4 text-red-600" aria-hidden />
              </Button>
            </div>
          </div>
        ))}
        {!bags && (
          <div className="text-sm text-gray-500">샌드백을 불러오는 중...</div>
        )}
        {bags?.length === 0 && (
          <div className="text-sm text-gray-500">
            샌드백이 없습니다. 새로 추가해보세요.
          </div>
        )}
        {bags && bags.length > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-2 text-xs text-gray-600">
            <span>
              페이지 {safeCurrentPage} / {totalPages} · 총 {bags.length}개
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                aria-label="이전 페이지"
                onClick={() => setPage((page) => page - 1)}
                disabled={safeCurrentPage === 1}
              >
                이전
              </Button>
              <Button
                variant="secondary"
                size="sm"
                aria-label="다음 페이지"
                onClick={() => setPage((page) => page + 1)}
                disabled={safeCurrentPage === totalPages}
              >
                다음
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BagDetail({
  bag,
  onBack,
}: {
  bag: { _id: Id<"bags">; name: string };
  onBack: () => void;
}) {
  const isMock = useIsMock();
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const userId = loggedInUser?._id;
  const navigate = useNavigate({ from: "/plans" });
  const searchParams = useSearch({ from: "/plans" });
  const searchQuery = searchParams.search || "";

  const cardArgs = isMock
    ? "skip"
    : userId
      ? {
          bagId: bag._id,
          userId,
        }
      : "skip";

  const cards = useQuery(api.learning.getBagCards, cardArgs);
  const createCard = useMutation(api.learning.createCard);
  const updateCard = useMutation(api.learning.updateCard);
  const deleteCard = useMutation(api.learning.deleteCard);

  const mockCards = useMemo(() => {
    if (!isMock) return [];
    return Array.from({ length: 500 }, (_, i) => ({
      _id: `mock-card-${i + 1}` as Id<"cards">,
      _creationTime: Date.now() - i * 1000,
      question: `Mock Question ${i + 1}`,
      answer: `Mock Answer ${i + 1}`,
      hint: `Mock Hint ${i + 1}`,
      explanation: `Mock Explanation ${i + 1}`,
    }));
  }, [isMock]);

  const cardsToShow = useMemo(
    () => (isMock ? mockCards : cards) ?? [],
    [cards, isMock, mockCards]
  );

  const [cardEditor, setCardEditor] = useState<
    { mode: "create" } | { mode: "edit"; card: Card } | null
  >(null);

  const [sorting, setSorting] = useState<SortingState>([
    { id: "_creationTime", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const columnHelper = createColumnHelper<Card>();

  const columns = useMemo(
    () => [
      columnHelper.accessor("answer", {
        header: "Answer",
        cell: (info) => (
          <div className="font-semibold text-gray-900">{info.getValue()}</div>
        ),
        size: 200,
      }),
      columnHelper.accessor("question", {
        header: "Question",
        cell: (info) => {
          const question = info.getValue();
          const truncated =
            question.length > 80 ? question.slice(0, 80) + "..." : question;
          return <div className="text-sm text-gray-600">{truncated}</div>;
        },
        size: 400,
      }),
      columnHelper.accessor("_creationTime", {
        header: "Created",
        cell: (info) => {
          const date = new Date(info.getValue());
          return (
            <div className="text-xs text-gray-500">
              {date.toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              })}
            </div>
          );
        },
        size: 120,
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: (info) => {
          const card = info.row.original;
          return (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setCardEditor({ mode: "edit", card })}
                disabled={isMock}
                aria-label={`수정 ${card._id}`}
              >
                <Edit2 className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  void deleteCard({ cardId: card._id, bagId: bag._id })
                }
                disabled={isMock}
                aria-label={`삭제 ${card._id}`}
              >
                <Trash2 className="h-4 w-4 text-red-600" aria-hidden />
              </Button>
            </div>
          );
        },
        size: 120,
      }),
    ],
    [columnHelper, isMock, deleteCard, bag._id]
  );

  // Apply search filter via useEffect
  useEffect(() => {
    if (searchQuery) {
      setColumnFilters([{ id: "answer", value: searchQuery }]);
    } else {
      setColumnFilters([]);
    }
  }, [searchQuery]);

  const table = useReactTable({
    data: cardsToShow,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (cardEditor) {
    return (
      <CardEditorPage
        mode={cardEditor.mode}
        bag={bag}
        card={"card" in cardEditor ? cardEditor.card : undefined}
        onBack={() => setCardEditor(null)}
        onSaved={() => setCardEditor(null)}
        createCard={createCard}
        updateCard={updateCard}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="px-2" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Button>
          <h2 className="text-base font-semibold text-gray-900">{bag.name}</h2>
        </div>
        <Button
          size="sm"
          className="gap-2"
          onClick={() => setCardEditor({ mode: "create" })}
          disabled={isMock}
          aria-label="카드 추가"
        >
          <Plus className="h-4 w-4" aria-hidden /> 카드 추가
        </Button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by answer..."
            value={searchQuery}
            onChange={(e) => {
              void navigate({
                to: "/plans",
                search: { search: e.target.value },
              });
            }}
            className="focus:border-primary-500 focus:ring-primary-500 w-full rounded-md border border-gray-200 py-2 pr-3 pl-10 text-sm focus:ring-1"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-700"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-200">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  {!cardsToShow
                    ? "카드를 불러오는 중..."
                    : searchQuery
                      ? "검색 결과가 없습니다."
                      : "카드가 없습니다."}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-3"
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {table.getRowModel().rows.length > 0 && (
        <div className="text-xs text-gray-600">
          총 {table.getRowModel().rows.length}개
          {searchQuery && ` (필터링됨: ${cardsToShow.length}개 중)`}
        </div>
      )}
    </div>
  );
}

function CardEditorPage({
  mode,
  bag,
  card,
  onBack,
  onSaved,
  createCard,
  updateCard,
}: {
  mode: "create" | "edit";
  bag: { _id: Id<"bags">; name: string };
  card?: Card;
  onBack: () => void;
  onSaved: () => void;
  createCard: ReactMutation<typeof api.learning.createCard>;
  updateCard: ReactMutation<typeof api.learning.updateCard>;
}) {
  const isMock = useIsMock();
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const userId = loggedInUser?._id;
  const generateDraft = useAction(api.ai.generateCardDraft);
  const regenerateHintAndExplanation = useAction(
    api.ai.regenerateHintAndExplanation
  );
  const generateExpressionCandidates = useAction(
    api.ai.generateExpressionCandidates
  );
  const createCardsBatch = useMutation(api.learning.createCardsBatch);

  const [form, setForm] = useState({
    question: card?.question || "",
    answer: card?.answer || "",
    hint: card?.hint || "",
    explanation: card?.explanation || "",
    context: card?.context || "",
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegeneratingHelpers, setIsRegeneratingHelpers] = useState(false);
  const [showQuestionInput, setShowQuestionInput] = useState(
    !!card?.question || false
  );

  // Multi-expression state
  const [showMultiExpression, setShowMultiExpression] = useState(false);
  const [koreanInput, setKoreanInput] = useState("");
  const [expressionCandidates, setExpressionCandidates] = useState<string[]>(
    []
  );
  const [customExpression, setCustomExpression] = useState("");
  const [selectedExpressions, setSelectedExpressions] = useState<Set<number>>(
    new Set()
  );
  const [isGeneratingExpressions, setIsGeneratingExpressions] = useState(false);
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);

  const handleGenerate = async () => {
    if (!form.answer.trim()) {
      toast.error("정답을 먼저 입력해주세요.");
      return;
    }

    const previousAnswer = form.answer.trim();
    setIsGenerating(true);
    try {
      const aiDraft = await generateDraft({
        answer: form.answer,
        context: form.context || undefined,
      });
      const nextAnswer = aiDraft.finalAnswer || previousAnswer;

      setForm((current) => ({
        ...current,
        question: aiDraft.question,
        hint: aiDraft.hint,
        explanation: aiDraft.explanation,
        answer: nextAnswer,
      }));

      if (aiDraft.finalAnswer && aiDraft.finalAnswer !== previousAnswer) {
        toast.success(
          `정답을 "${previousAnswer}" → "${aiDraft.finalAnswer}"로 바꿨어요. 검토 후 저장하세요.`
        );
      } else {
        toast.success("질문과 설명을 채웠어요. 검토 후 저장하세요.");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "요청 중 문제가 발생했습니다.";
      logger.error("CardEditorPage", message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateHelpers = async () => {
    if (!form.question.trim() || !form.answer.trim()) {
      toast.error("질문과 정답을 먼저 입력해주세요.");
      return;
    }

    setIsRegeneratingHelpers(true);
    try {
      const result = await regenerateHintAndExplanation({
        question: form.question,
        answer: form.answer,
        context: form.context || undefined,
      });
      setForm((current) => ({
        ...current,
        hint: result.hint,
        explanation: result.explanation,
      }));
      toast.success("힌트와 설명을 새로 만들었어요.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "요청 중 문제가 발생했습니다.";
      logger.error("PlansPage.handleRegenerateHelpers", message);
      toast.error(message);
    } finally {
      setIsRegeneratingHelpers(false);
    }
  };

  const handleGenerateExpressions = async () => {
    if (!koreanInput.trim()) {
      toast.error("표현을 입력해주세요.");
      return;
    }

    setIsGeneratingExpressions(true);
    try {
      const result = await generateExpressionCandidates({
        input: koreanInput,
        context: form.context || undefined,
      });
      setExpressionCandidates(result.expressions);
      setSelectedExpressions(new Set());
      setCustomExpression("");
      toast.success(`${result.expressions.length}개의 표현을 생성했어요.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "요청 중 문제가 발생했습니다.";
      logger.error("PlansPage.handleGenerateExpressions", message);
      toast.error(message);
    } finally {
      setIsGeneratingExpressions(false);
    }
  };

  const handleCreateBatchCards = async () => {
    if (selectedExpressions.size === 0 && !customExpression.trim()) {
      toast.error("최소 하나의 표현을 선택하거나 입력해주세요.");
      return;
    }

    if (!userId) return;
    if (isMock) {
      toast.success("Mock 모드에서는 카드를 생성할 수 없습니다.");
      return;
    }

    setIsCreatingBatch(true);
    try {
      const expressions = [
        ...Array.from(selectedExpressions).map((i) => expressionCandidates[i]),
        ...(customExpression.trim() ? [customExpression.trim()] : []),
      ];

      // Generate cards for each expression
      const cardsToCreate = [];
      for (const expression of expressions) {
        const draft = await generateDraft({
          answer: expression,
          context: form.context || undefined,
        });

        cardsToCreate.push({
          question: draft.question,
          answer: draft.finalAnswer || expression,
          hint: draft.hint,
          explanation: draft.explanation,
          context: form.context || undefined,
          sourceWord: koreanInput,
          expression: expression,
        });
      }

      await createCardsBatch({
        bagId: bag._id,
        userId,
        cards: cardsToCreate,
      });

      toast.success(`${cardsToCreate.length}개의 카드를 생성했어요.`);
      onSaved();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "요청 중 문제가 발생했습니다.";
      logger.error("PlansPage.handleCreateBatchCards", message);
      toast.error(message);
    } finally {
      setIsCreatingBatch(false);
    }
  };

  const toggleExpressionSelection = (index: number) => {
    setSelectedExpressions((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.question.trim() || !form.answer.trim()) return;
    if (isMock) {
      onSaved();
      return;
    }
    if (!userId) return;

    if (mode === "create") {
      await createCard({
        bagId: bag._id,
        userId,
        question: form.question,
        answer: form.answer,
        hint: form.hint,
        explanation: form.explanation,
        context: form.context || undefined,
      });
    } else {
      if (!card) {
        logger.warn("CardEditorPage", "No card to update");
        return;
      }

      await updateCard({
        cardId: card._id,
        bagId: bag._id,
        question: form.question,
        answer: form.answer,
        hint: form.hint,
        explanation: form.explanation,
        context: form.context || undefined,
        // 이하 리셋
        due: Date.now(),
        stability: 0,
        difficulty: 0,
        scheduled_days: 0,
        learning_steps: 0,
        reps: 0,
        lapses: 0,
        state: 0,
      });
    }

    onSaved();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="px-2" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Button>
        <h2 className="text-base font-semibold text-gray-900">
          {mode === "create" ? "카드 추가" : "카드 편집"}
        </h2>
      </div>

      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        {/* Answer-first: Answer at the top */}
        <div className="space-y-1">
          <label
            className="text-sm font-medium text-gray-700"
            htmlFor="card-answer"
          >
            정답 (영어 표현)
          </label>
          <input
            id="card-answer"
            className="focus:border-primary-500 focus:ring-primary-500 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:ring-1"
            placeholder="예: reserve, look forward to"
            value={form.answer}
            onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
          />
        </div>

        {/* Context input */}
        <div className="space-y-1">
          <label
            className="text-sm font-medium text-gray-700"
            htmlFor="card-context"
          >
            상황/맥락 (선택)
          </label>
          <input
            id="card-context"
            className="focus:border-primary-500 focus:ring-primary-500 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:ring-1"
            placeholder="예: 친구에게 조언하는 상황, 회의에서 제안하는 말투"
            value={form.context}
            onChange={(e) =>
              setForm((f) => ({ ...f, context: e.target.value }))
            }
          />
          <p className="text-xs text-gray-500">
            맥락을 입력하면 질문, 힌트, 설명이 모두 이 상황에 맞춰 생성됩니다.
          </p>
        </div>

        {/* AI Generation button */}
        <Button
          variant="primary"
          className="w-full gap-2"
          onClick={() => void handleGenerate()}
          disabled={isGenerating || isMock}
          aria-label="AI로 질문·힌트·설명 생성"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              AI 생성 중...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" aria-hidden />
              AI로 질문·힌트·설명 생성
            </>
          )}
        </Button>

        <div className="border-t border-gray-200 pt-4">
          <p className="mb-3 text-xs text-gray-600">
            정답과 맥락을 입력한 후 위 버튼을 누르면 질문·힌트·설명이 자동
            완성됩니다. 생성 후 아래에서 직접 수정도 가능합니다.
          </p>
        </div>

        {/* Question input - toggleable */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              질문 {!showQuestionInput && "(직접 작성)"}
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowQuestionInput(!showQuestionInput)}
              className="text-xs"
            >
              {showQuestionInput ? "접기" : "직접 작성"}
            </Button>
          </div>
          {showQuestionInput && (
            <input
              id="card-question"
              className="focus:border-primary-500 focus:ring-primary-500 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:ring-1"
              placeholder="질문을 입력 (___를 사용해 빈칸 표시)"
              value={form.question}
              onChange={(e) =>
                setForm((f) => ({ ...f, question: e.target.value }))
              }
            />
          )}
          {!showQuestionInput && form.question && (
            <p className="text-sm text-gray-600 italic">{form.question}</p>
          )}
        </div>

        {/* Hint and Explanation - with one-shot regeneration */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label
              className="text-sm font-medium text-gray-700"
              htmlFor="card-hint"
            >
              힌트 (선택)
            </label>
            <Button
              variant="secondary"
              size="sm"
              className="text-xs whitespace-nowrap"
              onClick={() => void handleRegenerateHelpers()}
              disabled={isRegeneratingHelpers || isMock}
              aria-label="힌트와 설명 재생성"
            >
              {isRegeneratingHelpers ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  재생성 중...
                </>
              ) : (
                <>
                  <RefreshCcw className="h-4 w-4" aria-hidden />
                  힌트+설명 재생성
                </>
              )}
            </Button>
          </div>
          <input
            id="card-hint"
            className="focus:border-primary-500 focus:ring-primary-500 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:ring-1"
            placeholder="힌트"
            value={form.hint}
            onChange={(e) => setForm((f) => ({ ...f, hint: e.target.value }))}
          />
        </div>

        <div className="space-y-1">
          <label
            className="text-sm font-medium text-gray-700"
            htmlFor="card-explanation"
          >
            설명 (선택)
          </label>
          <textarea
            id="card-explanation"
            className="focus:border-primary-500 focus:ring-primary-500 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:ring-1"
            placeholder="설명"
            rows={3}
            value={form.explanation}
            onChange={(e) =>
              setForm((f) => ({ ...f, explanation: e.target.value }))
            }
          />
        </div>

        {/* Multi-expression Pipeline */}
        {mode === "create" && (
          <div className="border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => setShowMultiExpression(!showMultiExpression)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="text-sm font-medium text-gray-700">
                다중 표현 생성 (여러 영어 표현 일괄 생성)
              </span>
              {showMultiExpression ? (
                <ChevronUp className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              )}
            </button>

            {showMultiExpression && (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-gray-600">
                  한국어나 영어 표현을 입력하면 여러 영어 표현 후보를 생성하고,
                  선택한 표현들로 카드를 일괄 생성할 수 있습니다.
                </p>

                {/* Step 1: Input */}
                <div className="space-y-1">
                  <label
                    className="text-sm font-medium text-gray-700"
                    htmlFor="korean-input"
                  >
                    표현/의도
                  </label>
                  <input
                    id="korean-input"
                    className="focus:border-primary-500 focus:ring-primary-500 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:ring-1"
                    placeholder="예: 예약하다, reserve, 기대하다"
                    value={koreanInput}
                    onChange={(e) => setKoreanInput(e.target.value)}
                  />
                </div>

                <Button
                  variant="secondary"
                  className="w-full gap-2"
                  onClick={() => void handleGenerateExpressions()}
                  disabled={isGeneratingExpressions || isMock}
                >
                  {isGeneratingExpressions ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      표현 생성 중...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" aria-hidden />
                      영어 표현 후보 생성
                    </>
                  )}
                </Button>

                {/* Step 2: Expression Candidates */}
                {expressionCandidates.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      생성된 표현 (선택)
                    </label>
                    <div className="space-y-2">
                      {expressionCandidates.map((expr, index) => (
                        <label
                          key={index}
                          className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 p-2 hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedExpressions.has(index)}
                            onChange={() => toggleExpressionSelection(index)}
                            className="text-primary-600 focus:ring-primary-500 h-4 w-4 rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-900">{expr}</span>
                        </label>
                      ))}
                    </div>

                    <div className="space-y-1">
                      <label
                        className="text-sm font-medium text-gray-700"
                        htmlFor="custom-expression"
                      >
                        직접 입력 (선택)
                      </label>
                      <input
                        id="custom-expression"
                        className="focus:border-primary-500 focus:ring-primary-500 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:ring-1"
                        placeholder="다른 표현을 직접 입력"
                        value={customExpression}
                        onChange={(e) => setCustomExpression(e.target.value)}
                      />
                    </div>

                    {/* Step 3: Batch Create */}
                    <Button
                      variant="primary"
                      className="w-full gap-2"
                      onClick={() => void handleCreateBatchCards()}
                      disabled={
                        isCreatingBatch ||
                        isMock ||
                        (selectedExpressions.size === 0 &&
                          !customExpression.trim())
                      }
                    >
                      {isCreatingBatch ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          카드 생성 중...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          선택한 표현으로 카드 일괄 생성 (
                          {selectedExpressions.size +
                            (customExpression.trim() ? 1 : 0)}
                          개)
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <Button
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          onClick={handleSave}
          className="w-full"
          disabled={isGenerating}
          aria-label="저장"
        >
          저장
        </Button>
      </div>
    </div>
  );
}
