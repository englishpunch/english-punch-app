import { useState, useRef, useImperativeHandle, type Ref } from "react";
import { Button } from "./Button";
import { Input, Textarea } from "./Input";
import { RefreshCcw } from "lucide-react";
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
  autoFocus?: boolean;
  ref?: Ref<CardFormHandle>;
};

export type CardFormHandle = {
  reset: () => void;
};

export function CardForm({
  initialData,
  onSubmit,
  submitLabel,
  autoFocus = false,
  ref,
}: CardFormProps) {
  const { t } = useTranslation();
  const isMock = useIsMock();
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

  const [isRegeneratingHelpers, setIsRegeneratingHelpers] = useState(false);
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
      // Focus on answer input after reset - use queueMicrotask for clarity
      queueMicrotask(() => {
        answerInputRef.current?.focus();
      });
    },
  }));

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
          onChange={(e) => setForm((f) => ({ ...f, context: e.target.value }))}
        />
        <p className="text-xs text-gray-500">{t("cardForm.contextHelp")}</p>
      </div>

      {/* Question input */}
      <div className="space-y-1">
        <label
          className="text-sm font-medium text-gray-700"
          htmlFor="card-question"
        >
          {t("cardForm.questionLabel")}
        </label>
        <Textarea
          id="card-question"
          placeholder={t("cardForm.questionPlaceholder")}
          autoResize
          minRows={1}
          value={form.question}
          onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
        />
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
        aria-label={resolvedSubmitLabel}
      >
        {resolvedSubmitLabel}
      </Button>
    </div>
  );
}
