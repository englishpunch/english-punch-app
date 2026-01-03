import { useState } from "react";
import { Button } from "./Button";
import { Loader2, Sparkles, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { getGlobalLogger } from "@/lib/globalLogger";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import useIsMock from "@/hooks/useIsMock";

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
};

export function CardForm({
  initialData,
  onSubmit,
  submitLabel = "저장",
  showQuestionByDefault = false,
}: CardFormProps) {
  const isMock = useIsMock();
  const generateDraft = useAction(api.ai.generateCardDraft);
  const regenerateHintAndExplanation = useAction(
    api.ai.regenerateHintAndExplanation
  );

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
          `정답을 "${previousAnswer}" → "${aiDraft.finalAnswer}"로 바꿨어요. 검토 후 저장하세요.`
        );
      } else {
        toast.success("질문과 설명을 채웠어요. 검토 후 저장하세요.");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "요청 중 문제가 발생했습니다.";
      logger.error("CardForm.handleGenerate", message);
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
      logger.error("CardForm.handleRegenerateHelpers", message);
      toast.error(message);
    } finally {
      setIsRegeneratingHelpers(false);
    }
  };

  const handleSubmit = () => {
    if (!form.question.trim() || !form.answer.trim()) {
      toast.error("질문과 정답을 입력해주세요.");
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
          onChange={(e) => setForm((f) => ({ ...f, context: e.target.value }))}
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
          <p className="italic text-sm text-gray-600">{form.question}</p>
        )}
      </div>

      {/* Hint and Explanation */}
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
            className="whitespace-nowrap text-xs"
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

      {/* Submit button */}
      <Button
        onClick={handleSubmit}
        className="w-full"
        disabled={isGenerating}
        aria-label={submitLabel}
      >
        {submitLabel}
      </Button>
    </div>
  );
}
