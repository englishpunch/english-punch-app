import { useState, useRef, useImperativeHandle, forwardRef } from "react";
import { Button } from "./Button";
import { Input, Textarea } from "./Input";
import { Sparkles, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { getGlobalLogger } from "@/lib/globalLogger";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import useIsMock from "@/hooks/useIsMock";
import { useTranslation } from "react-i18next";

const logger = getGlobalLogger();

type CardFormData = {
  question: string;
  answer: string;
  hint: string;
  explanation: string;
  context: string;
};

type CardFormProps = {
  initialData?: Partial<CardFormData>;
  onSubmit: (data: CardFormData) => void | Promise<void>;
  submitLabel?: string;
  showQuestionByDefault?: boolean;
  autoFocus?: boolean;
};

export type CardFormHandle = {
  reset: () => void;
};

export const CardForm = forwardRef<CardFormHandle, CardFormProps>(
  function CardForm(
    {
      initialData,
      onSubmit,
      submitLabel,
      showQuestionByDefault = false,
      autoFocus = false,
    },
    ref
  ) {
    const { t } = useTranslation();
    const isMock = useIsMock();
    const generateDraft = useAction(api.ai.generateCardDraft);
    const regenerateHintAndExplanation = useAction(
      api.ai.regenerateHintAndExplanation
    );

    const answerInputRef = useRef<HTMLInputElement>(null);

    const [form, setForm] = useState<CardFormData>({
      question: initialData?.question || "",
      answer: initialData?.answer || "",
      hint: initialData?.hint || "",
      explanation: initialData?.explanation || "",
      context: initialData?.context || "",
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [isRegeneratingHelpers, setIsRegeneratingHelpers] = useState(false);
    const [showQuestionInput, setShowQuestionInput] = useState(
      showQuestionByDefault || !!initialData?.question
    );
    const resolvedSubmitLabel = submitLabel ?? t("common.actions.save");

    // Expose reset method to parent
    useImperativeHandle(ref, () => ({
      reset: () => {
        setForm({
          question: "",
          answer: "",
          hint: "",
          explanation: "",
          context: "",
        });
        setShowQuestionInput(showQuestionByDefault);
        // Focus on answer input after reset
        setTimeout(() => {
          answerInputRef.current?.focus();
        }, 0);
      },
    }));

    const handleGenerate = async () => {
      if (!form.answer.trim()) {
        toast.error(t("cardForm.toasts.answerRequired"));
        return;
      }

      const previousAnswer = form.answer.trim();
      setIsGenerating(true);
      try {
        const aiDraft = await generateDraft({
          answer: form.answer,
          context: form.context,
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
            t("cardForm.toasts.answerUpdated", {
              prev: previousAnswer,
              next: aiDraft.finalAnswer,
            })
          );
        } else {
          toast.success(t("cardForm.toasts.generated"));
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : t("cardForm.toasts.requestError");
        logger.error("CardForm.handleGenerate", message);
        toast.error(message);
      } finally {
        setIsGenerating(false);
      }
    };

    const handleRegenerateHelpers = async () => {
      if (!form.question.trim() || !form.answer.trim()) {
        toast.error(t("cardForm.toasts.questionAnswerRequired"));
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
        toast.success(t("cardForm.toasts.helpersRegenerated"));
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : t("cardForm.toasts.requestError");
        logger.error("CardForm.handleRegenerateHelpers", message);
        toast.error(message);
      } finally {
        setIsRegeneratingHelpers(false);
      }
    };

    const handleSubmit = () => {
      if (!form.question.trim() || !form.answer.trim()) {
        toast.error(t("cardForm.toasts.questionAnswerRequired"));
        return;
      }
      void onSubmit(form);
    };

    return (
      <div className="space-y-4">
        {/* Answer input */}
        <div className="space-y-1">
          <label
            className="text-sm font-medium text-gray-700"
            htmlFor="card-answer"
          >
            {t("cardForm.answerLabel")}
          </label>
          <Input
            ref={answerInputRef}
            id="card-answer"
            placeholder={t("cardForm.answerPlaceholder")}
            value={form.answer}
            onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
            autoFocus={autoFocus}
          />
        </div>

        {/* Context input */}
        <div className="space-y-1">
          <label
            className="text-sm font-medium text-gray-700"
            htmlFor="card-context"
          >
            {t("cardForm.contextLabel")}
          </label>
          <Input
            id="card-context"
            placeholder={t("cardForm.contextPlaceholder")}
            value={form.context}
            onChange={(e) =>
              setForm((f) => ({ ...f, context: e.target.value }))
            }
          />
          <p className="text-xs text-gray-500">{t("cardForm.contextHelp")}</p>
        </div>

        {/* AI Generation button */}
        <Button
          variant="primary"
          className="w-full gap-2"
          onClick={() => void handleGenerate()}
          loading={isGenerating}
          disabled={isMock}
          aria-label={t("cardForm.generateAria")}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          {t("cardForm.generateButton")}
        </Button>

        <div className="border-t border-gray-200 pt-4">
          <p className="mb-3 text-xs text-gray-600">
            {t("cardForm.generationHelp")}
          </p>
        </div>

        {/* Question input - toggleable */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              {t("cardForm.questionLabel")}{" "}
              {showQuestionInput && t("cardForm.questionManualSuffix")}
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowQuestionInput(!showQuestionInput)}
              className="text-xs"
            >
              {showQuestionInput
                ? t("cardForm.questionToggleClose")
                : t("cardForm.questionToggleOpen")}
            </Button>
          </div>
          {showQuestionInput && (
            <Textarea
              id="card-question"
              placeholder={t("cardForm.questionPlaceholder")}
              autoResize
              minRows={1}
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

        {/* Hint and Explanation */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label
              className="text-sm font-medium text-gray-700"
              htmlFor="card-hint"
            >
              {t("cardForm.hintLabel")}
            </label>
            <Button
              variant="secondary"
              size="sm"
              className="text-xs whitespace-nowrap"
              onClick={() => void handleRegenerateHelpers()}
              loading={isRegeneratingHelpers}
              disabled={isMock}
              aria-label={t("cardForm.regenerateButton")}
            >
              <RefreshCcw className="h-4 w-4" aria-hidden />
              {t("cardForm.regenerateButton")}
            </Button>
          </div>
          <Input
            id="card-hint"
            placeholder={t("cardForm.hintPlaceholder")}
            value={form.hint}
            onChange={(e) => setForm((f) => ({ ...f, hint: e.target.value }))}
          />
        </div>

        <div className="space-y-1">
          <label
            className="text-sm font-medium text-gray-700"
            htmlFor="card-explanation"
          >
            {t("cardForm.explanationLabel")}
          </label>
          <Textarea
            id="card-explanation"
            placeholder={t("cardForm.explanationPlaceholder")}
            autoResize
            minRows={3}
            value={form.explanation}
            onChange={(e) =>
              setForm((f) => ({ ...f, explanation: e.target.value }))
            }
          />
        </div>

        {/* Submit button */}
        <Button
          onClick={handleSubmit}
          className="w-full"
          disabled={isGenerating}
          aria-label={resolvedSubmitLabel}
        >
          {resolvedSubmitLabel}
        </Button>
      </div>
    );
  }
);
