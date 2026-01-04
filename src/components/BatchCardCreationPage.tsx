import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "./Button";
import { ArrowLeft, Loader2, Sparkles, Plus } from "lucide-react";
import { toast } from "sonner";
import { getGlobalLogger } from "@/lib/globalLogger";
import { useNavigate, useParams } from "@tanstack/react-router";
import useIsMock from "@/hooks/useIsMock";

const logger = getGlobalLogger();

export default function BatchCardCreationPage() {
  const { bagId } = useParams({ from: "/plans/$bagId/cards/batch" });
  const isMock = useIsMock();
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const userId = loggedInUser?._id;
  const navigate = useNavigate();

  const generateDraft = useAction(api.ai.generateCardDraft);
  const generateExpressionCandidates = useAction(
    api.ai.generateExpressionCandidates
  );
  const createCardsBatch = useMutation(api.learning.createCardsBatch);

  // Get bag info
  const bagsArgs = isMock ? "skip" : userId ? { userId } : "skip";
  const bags = useQuery(api.learning.getUserBags, bagsArgs);
  const bag = bags?.find((b) => b._id === bagId);

  const [context, setContext] = useState("");
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

  const handleBack = () => {
    void navigate({ to: "/plans/$bagId", params: { bagId } });
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
        context: context || undefined,
      });
      setExpressionCandidates(result.expressions);
      setSelectedExpressions(new Set());
      setCustomExpression("");
      toast.success(`${result.expressions.length}개의 표현을 생성했어요.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "요청 중 문제가 발생했습니다.";
      logger.error("BatchCardCreationPage.handleGenerateExpressions", message);
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

    if (!userId || !bag) return;
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
          context: context || undefined,
        });

        cardsToCreate.push({
          question: draft.question,
          answer: draft.finalAnswer || expression,
          hint: draft.hint,
          explanation: draft.explanation,
          context: context || undefined,
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
      handleBack();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "요청 중 문제가 발생했습니다.";
      logger.error("BatchCardCreationPage.handleCreateBatchCards", message);
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

  if (!bag) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="px-2"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Button>
          <h2 className="text-base font-semibold text-gray-900">
            샌드백을 찾을 수 없습니다
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="px-2" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Button>
        <h2 className="text-base font-semibold text-gray-900">
          다중 표현 생성
        </h2>
        <span className="text-sm text-gray-500">- {bag.name}</span>
      </div>

      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-gray-600">
          한국어나 영어 표현을 입력하면 여러 영어 표현 후보를 생성하고, 선택한
          표현들로 카드를 일괄 생성할 수 있습니다.
        </p>

        {/* Context input */}
        <div className="space-y-1">
          <label
            className="text-sm font-medium text-gray-700"
            htmlFor="batch-context"
          >
            상황/맥락 (선택)
          </label>
          <input
            id="batch-context"
            className="focus:border-primary-500 focus:ring-primary-500 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:ring-1"
            placeholder="예: 친구에게 조언하는 상황, 회의에서 제안하는 말투"
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
          <p className="text-xs text-gray-500">
            맥락을 입력하면 생성되는 모든 카드가 이 상황에 맞춰집니다.
          </p>
        </div>

        {/* Korean/English input */}
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

        {/* Expression Candidates */}
        {expressionCandidates.length > 0 && (
          <div className="space-y-3 border-t border-gray-200 pt-4">
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

            {/* Batch Create Button */}
            <Button
              variant="primary"
              className="w-full gap-2"
              onClick={() => void handleCreateBatchCards()}
              disabled={
                isCreatingBatch ||
                isMock ||
                (selectedExpressions.size === 0 && !customExpression.trim())
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
                  {selectedExpressions.size + (customExpression.trim() ? 1 : 0)}
                  개)
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
