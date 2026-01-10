import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "./Button";
import { ArrowLeft, Loader2, Sparkles, Plus } from "lucide-react";
import { toast } from "sonner";
import { getGlobalLogger } from "@/lib/globalLogger";
import { useNavigate, useParams } from "@tanstack/react-router";
import useIsMock from "@/hooks/useIsMock";
import { useTranslation } from "react-i18next";

const logger = getGlobalLogger();

export default function BatchCardCreationPage() {
  const { t } = useTranslation();
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
      toast.error(t("batchCreate.toasts.inputRequired"));
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
      toast.success(
        t("batchCreate.toasts.generated", {
          count: result.expressions.length,
        })
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("batchCreate.toasts.requestError");
      logger.error("BatchCardCreationPage.handleGenerateExpressions", message);
      toast.error(message);
    } finally {
      setIsGeneratingExpressions(false);
    }
  };

  const handleCreateBatchCards = async () => {
    if (selectedExpressions.size === 0 && !customExpression.trim()) {
      toast.error(t("batchCreate.toasts.selectRequired"));
      return;
    }

    if (!userId || !bag) {
      return;
    }
    if (isMock) {
      toast.success(t("batchCreate.toasts.mockUnavailable"));
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

      toast.success(
        t("batchCreate.toasts.created", { count: cardsToCreate.length })
      );
      handleBack();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("batchCreate.toasts.requestError");
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
            {t("cardAdd.bagNotFound")}
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
          {t("batchCreate.title")}
        </h2>
        <span className="text-sm text-gray-500">- {bag.name}</span>
      </div>

      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-gray-600">{t("batchCreate.description")}</p>

        {/* Context input */}
        <div className="space-y-1">
          <label
            className="text-sm font-medium text-gray-700"
            htmlFor="batch-context"
          >
            {t("cardForm.contextLabel")}
          </label>
          <input
            id="batch-context"
            className="focus:border-primary-500 focus:ring-primary-500 w-full rounded-md border border-gray-200 px-3 py-2 text-base focus:ring-1"
            placeholder={t("cardForm.contextPlaceholder")}
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
          <p className="text-xs text-gray-500">
            {t("batchCreate.contextHelp")}
          </p>
        </div>

        {/* Korean/English input */}
        <div className="space-y-1">
          <label
            className="text-sm font-medium text-gray-700"
            htmlFor="korean-input"
          >
            {t("batchCreate.intentLabel")}
          </label>
          <input
            id="korean-input"
            className="focus:border-primary-500 focus:ring-primary-500 w-full rounded-md border border-gray-200 px-3 py-2 text-base focus:ring-1"
            placeholder={t("batchCreate.intentPlaceholder")}
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
              {t("batchCreate.generating")}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" aria-hidden />
              {t("batchCreate.generateButton")}
            </>
          )}
        </Button>

        {/* Expression Candidates */}
        {expressionCandidates.length > 0 && (
          <div className="space-y-3 border-t border-gray-200 pt-4">
            <label className="text-sm font-medium text-gray-700">
              {t("batchCreate.generatedLabel")}
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
                {t("batchCreate.customLabel")}
              </label>
              <input
                id="custom-expression"
                className="focus:border-primary-500 focus:ring-primary-500 w-full rounded-md border border-gray-200 px-3 py-2 text-base focus:ring-1"
                placeholder={t("batchCreate.customPlaceholder")}
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
                  {t("batchCreate.creating")}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  {t("batchCreate.createButton", {
                    count:
                      selectedExpressions.size +
                      (customExpression.trim() ? 1 : 0),
                  })}
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
