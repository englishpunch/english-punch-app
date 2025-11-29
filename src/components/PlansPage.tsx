import { useMemo, useState } from "react";
import { ReactMutation, useMutation, useQuery } from "convex/react";
import { cn } from "@/lib/utils";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "./Button";
import { Plus, Trash2, Edit2, ArrowLeft } from "lucide-react";
import { getGlobalLogger } from "@/lib/globalLogger";
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

const getInitialTestMode = () => {
  const envDefault = import.meta.env?.VITE_TEST_MODE === "true";
  const isTestEnv =
    import.meta.env?.MODE === "test" ||
    Boolean(import.meta.env?.VITEST) ||
    process.env.NODE_ENV === "test";

  if (isTestEnv) {
    return envDefault;
  }
  return envDefault;
};

export default function PlansPage({ userId }: PlansPageProps) {
  const [testMode, setTestMode] = useState<boolean>(getInitialTestMode);
  const [currentPage, setCurrentPage] = useState(1);

  const bagsQuery = useQuery(api.learning.getUserBags, { userId, testMode });
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
    if (!testMode) return [];
    return Array.from({ length: 500 }, (_, i) => ({
      _id: `mock-${i + 1}` as Id<"bags">,
      name: `Mock Bag ${i + 1}`,
      totalCards: 0,
    }));
  }, [testMode]);

  const bags = testMode ? mockBags : bagsQuery;

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
        testMode={testMode}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">샌드백 추가</h2>
          {import.meta.env.DEV && (
            <div className="flex items-center gap-2">
              <Button
                variant={testMode ? "secondary" : "ghost"}
                size="sm"
                aria-label="테스트 모드"
                onClick={() => {
                  const next = !testMode;
                  setTestMode(next);
                  setPage(1);
                }}
              >
                테스트 모드 {testMode ? "ON" : "OFF"}
              </Button>
            </div>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <input
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
  testMode,
}: {
  bag: { _id: Id<"bags">; name: string };
  onBack: () => void;
  userId: Id<"users">;
  testMode: boolean;
}) {
  const cardArgs = testMode
    ? ("skip" as const)
    : {
        bagId: bag._id,
        userId,
      };
  const cards = useQuery(api.learning.getBagCards, cardArgs);
  const createCard = useMutation(api.learning.createCard);
  const updateCard = useMutation(api.learning.updateCard);
  const deleteCard = useMutation(api.learning.deleteCard);

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
        testMode={testMode}
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
          disabled={testMode}
          aria-label="카드 추가"
        >
          <Plus className="h-4 w-4" aria-hidden /> 카드 추가
        </Button>
      </div>

      <div className="space-y-2">
        {(cards || []).map((card) => (
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
                disabled={testMode}
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
                disabled={testMode}
                aria-label={`삭제 ${card._id}`}
              >
                <Trash2 className="h-4 w-4 text-red-600" aria-hidden />
              </Button>
            </div>
          </div>
        ))}
        {!cards && (
          <p className="text-sm text-gray-500">카드를 불러오는 중...</p>
        )}
        {cards?.length === 0 && (
          <p className="text-sm text-gray-500">카드가 없습니다.</p>
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
  testMode,
}: {
  mode: "create" | "edit";
  bag: { _id: Id<"bags">; name: string };
  card?: Card;
  userId: Id<"users">;
  onBack: () => void;
  onSaved: () => void;
  createCard: ReactMutation<typeof api.learning.createCard>;
  updateCard: ReactMutation<typeof api.learning.updateCard>;
  testMode: boolean;
}) {
  const [form, setForm] = useState({
    question: card?.question || "",
    answer: card?.answer || "",
    hint: card?.hint || "",
    explanation: card?.explanation || "",
  });

  const handleSave = async () => {
    if (!form.question.trim() || !form.answer.trim()) return;
    if (testMode) {
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

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <input
          className="w-full px-3 py-2 rounded-md border border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
          placeholder="질문을 입력"
          value={form.question}
          onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
        />
        <input
          className="w-full px-3 py-2 rounded-md border border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
          placeholder="정답을 입력"
          value={form.answer}
          onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
        />
        <input
          className="w-full px-3 py-2 rounded-md border border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
          placeholder="힌트 (선택)"
          value={form.hint}
          onChange={(e) => setForm((f) => ({ ...f, hint: e.target.value }))}
        />
        <textarea
          className="w-full px-3 py-2 rounded-md border border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
          placeholder="설명 (선택)"
          value={form.explanation}
          onChange={(e) =>
            setForm((f) => ({ ...f, explanation: e.target.value }))
          }
        />
        <Button
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          onClick={handleSave}
          className="w-full"
          aria-label="저장"
        >
          저장
        </Button>
      </div>
    </div>
  );
}
