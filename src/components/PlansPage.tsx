import { useMemo, useState } from "react";
import {
  ReactMutation,
  useAction,
  useMutation,
  useQuery,
} from "convex/react";
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
} from "lucide-react";
import { toast } from "sonner";
import { getGlobalLogger } from "@/lib/globalLogger";
import useIsMock from "@/hooks/useIsMock";
const logger = getGlobalLogger();

interface PlansPageProps {
  userId: Id<"users">;
}

type Card = {
  _id: Id<"cards">;
  question: string;
  answer: string;
  hint?: string;
  explanation?: string;
};

export default function PlansPage({ userId }: PlansPageProps) {
  const isMock = useIsMock();
  const [currentPage, setCurrentPage] = useState(1);

  const bagsArgs = isMock
    ? "skip"
    : {
        userId,
      };
  const bagsQuery = useQuery(api.learning.getUserBags, bagsArgs);
  const createBag = useMutation(api.learning.createBag);
  const deleteBag = useMutation(api.learning.deleteBag);

  const [newBagName, setNewBagName] = useState("");
  const [activeBagId, setActiveBagId] = useState<Id<"bags"> | null>(null);

  const handleAddBag = async () => {
    const name = newBagName.trim();
    if (!name) return;
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
    return (
      <BagDetail
        bag={activeBag}
        onBack={() => setActiveBagId(null)}
        userId={userId}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">샌드백 추가</h2>
        </div>
        <div className="mt-3 flex gap-2">
          <label className="sr-only" htmlFor="new-bag-name">
            새 샌드백 이름
          </label>
          <input
            id="new-bag-name"
            className="flex-1 px-3 py-2 rounded-md border border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
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
  userId,
}: {
  bag: { _id: Id<"bags">; name: string };
  onBack: () => void;
  userId: Id<"users">;
}) {
  const isMock = useIsMock();
  const cardArgs = isMock
    ? "skip"
    : {
        bagId: bag._id,
        userId,
      };

  const cards = useQuery(api.learning.getBagCards, cardArgs);
  const createCard = useMutation(api.learning.createCard);
  const updateCard = useMutation(api.learning.updateCard);
  const deleteCard = useMutation(api.learning.deleteCard);

  const mockCards = useMemo(() => {
    if (!isMock) return [];
    return Array.from({ length: 500 }, (_, i) => ({
      _id: `mock-card-${i + 1}` as Id<"cards">,
      question: `Mock Question ${i + 1}`,
      answer: `Mock Answer ${i + 1}`,
      hint: `Mock Hint ${i + 1}`,
      explanation: `Mock Explanation ${i + 1}`,
    }));
  }, [isMock]);

  const cardsToShow = (isMock ? mockCards : cards) ?? [];
  const CARD_PAGE_SIZE = 20;
  const [cardPage, setCardPage] = useState(1);

  const cardTotalPages = useMemo(() => {
    if (!cardsToShow.length) return 1;
    return Math.ceil(cardsToShow.length / CARD_PAGE_SIZE);
  }, [cardsToShow]);

  const clampCardPage = (page: number) =>
    Math.min(Math.max(page, 1), cardTotalPages);
  const safeCardPage = clampCardPage(cardPage);
  const setPage = (next: number | ((page: number) => number)) => {
    setCardPage((prev) => {
      const resolved =
        typeof next === "function"
          ? (next as (page: number) => number)(prev)
          : next;
      return clampCardPage(resolved);
    });
  };

  const visibleCards = useMemo(() => {
    if (!cardsToShow.length) return [];
    const start = (safeCardPage - 1) * CARD_PAGE_SIZE;
    return cardsToShow.slice(start, start + CARD_PAGE_SIZE);
  }, [cardsToShow, safeCardPage]);

  const [cardEditor, setCardEditor] = useState<
    { mode: "create" } | { mode: "edit"; card: Card } | null
  >(null);

  if (cardEditor) {
    return (
      <CardEditorPage
        mode={cardEditor.mode}
        bag={bag}
        card={"card" in cardEditor ? cardEditor.card : undefined}
        userId={userId}
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

      <div className="space-y-2">
        {visibleCards.map((card) => (
          <div
            key={card._id}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm font-semibold text-gray-900">
              {card.question}
            </p>
            <p className="text-xs text-gray-600 mt-1">정답: {card.answer}</p>
            <div className="flex gap-2 mt-2">
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
          </div>
        ))}
        {!cardsToShow && (
          <p className="text-sm text-gray-500">카드를 불러오는 중...</p>
        )}
        {cardsToShow?.length === 0 && (
          <p className="text-sm text-gray-500">카드가 없습니다.</p>
        )}
        {cardsToShow.length > CARD_PAGE_SIZE && (
          <div className="flex items-center justify-between pt-2 text-xs text-gray-600">
            <span>
              {`페이지 ${safeCardPage} / ${cardTotalPages} · 총 ${cardsToShow.length}개`}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                aria-label="이전 페이지"
                onClick={() => setPage((page) => page - 1)}
                disabled={safeCardPage === 1}
              >
                이전
              </Button>
              <Button
                variant="secondary"
                size="sm"
                aria-label="다음 페이지"
                onClick={() => setPage((page) => page + 1)}
                disabled={safeCardPage === cardTotalPages}
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

function CardEditorPage({
  mode,
  bag,
  card,
  userId,
  onBack,
  onSaved,
  createCard,
  updateCard,
}: {
  mode: "create" | "edit";
  bag: { _id: Id<"bags">; name: string };
  card?: Card;
  userId: Id<"users">;
  onBack: () => void;
  onSaved: () => void;
  createCard: ReactMutation<typeof api.learning.createCard>;
  updateCard: ReactMutation<typeof api.learning.updateCard>;
}) {
  const isMock = useIsMock();
  const generateDraft = useAction(api.ai.generateCardDraft);
  const [form, setForm] = useState({
    question: card?.question || "",
    answer: card?.answer || "",
    hint: card?.hint || "",
    explanation: card?.explanation || "",
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!form.answer.trim()) {
      toast.error("정답을 먼저 입력해주세요.");
      return;
    }

    setIsGenerating(true);
    try {
      const aiDraft = await generateDraft({ answer: form.answer });
      setForm((current) => ({
        ...current,
        ...aiDraft,
      }));
      toast.success("Gemini가 질문과 설명을 채웠어요. 검토 후 저장하세요.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Gemini 요청 중 문제가 발생했습니다.";
      logger.error("CardEditorPage", message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!form.question.trim() || !form.answer.trim()) return;
    if (isMock) {
      onSaved();
      return;
    }

    if (mode === "create") {
      await createCard({
        bagId: bag._id,
        userId,
        question: form.question,
        answer: form.answer,
        hint: form.hint,
        explanation: form.explanation,
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

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-4">
        <div className="space-y-1">
          <label
            className="text-sm font-medium text-gray-700"
            htmlFor="card-question"
          >
            질문
          </label>
          <input
            id="card-question"
            className="w-full px-3 py-2 rounded-md border border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
            placeholder="질문을 입력"
            value={form.question}
            onChange={(e) =>
              setForm((f) => ({ ...f, question: e.target.value }))
            }
          />
        </div>

        <div className="space-y-1">
          <label
            className="text-sm font-medium text-gray-700"
            htmlFor="card-answer"
          >
            정답
          </label>
          <div className="flex gap-2">
            <input
              id="card-answer"
              className="w-full px-3 py-2 rounded-md border border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
              placeholder="정답을 입력"
              value={form.answer}
              onChange={(e) =>
                setForm((f) => ({ ...f, answer: e.target.value }))
              }
            />
            <Button
              variant="secondary"
              size="sm"
              className="whitespace-nowrap"
              onClick={() => void handleGenerate()}
              disabled={isGenerating || isMock}
              aria-label="Gemini로 질문 생성"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  생성 중...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" aria-hidden />
                  AI 생성
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            정답을 적고 AI 생성 버튼을 누르면 질문·힌트·설명이 자동 완성돼요.
          </p>
        </div>

        <div className="space-y-1">
          <label
            className="text-sm font-medium text-gray-700"
            htmlFor="card-hint"
          >
            힌트 (선택)
          </label>
          <input
            id="card-hint"
            className="w-full px-3 py-2 rounded-md border border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
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
            className="w-full px-3 py-2 rounded-md border border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
            placeholder="설명"
            value={form.explanation}
            onChange={(e) =>
              setForm((f) => ({ ...f, explanation: e.target.value }))
            }
          />
        </div>
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
