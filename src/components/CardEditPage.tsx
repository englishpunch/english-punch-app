import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "./Button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate, useParams } from "@tanstack/react-router";
import useIsMock from "@/hooks/useIsMock";
import { CardForm } from "./CardForm";
import { toast } from "sonner";
import { getGlobalLogger } from "@/lib/globalLogger";
import { useTranslation } from "react-i18next";

const logger = getGlobalLogger();

export default function CardEditPage() {
  const { t } = useTranslation();
  const { bagId, cardId } = useParams({
    from: "/plans/$bagId/cards/$cardId/edit",
  });
  const isMock = useIsMock();
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const userId = loggedInUser?._id;
  const navigate = useNavigate();
  const updateCard = useMutation(api.learning.updateCard);

  // Get bag info
  const bagsArgs = isMock ? "skip" : userId ? { userId } : "skip";
  const bags = useQuery(api.learning.getUserBags, bagsArgs);
  const bag = bags?.find((b) => b._id === bagId);

  // Get card directly by ID
  const cardArgs =
    isMock || !userId || !bag
      ? "skip"
      : { cardId: cardId as Id<"cards">, bagId: bag._id, userId };
  const card = useQuery(api.learning.getCard, cardArgs);

  const handleBack = () => {
    void navigate({ to: "/plans/$bagId", params: { bagId } });
  };

  const handleSubmit = async (formData: {
    question: string;
    answer: string;
    hint: string;
    explanation: string;
    context: string;
  }) => {
    if (isMock) {
      toast.success(t("cardEdit.mockUnavailable"));
      handleBack();
      return;
    }
    if (!userId || !bag || !card) {
      logger.warn("CardEditPage", "Missing required data for update");
      return;
    }

    await updateCard({
      cardId: card._id,
      bagId: bag._id,
      question: formData.question,
      answer: formData.answer,
      hint: formData.hint,
      explanation: formData.explanation,
      context: formData.context || undefined,
      // Reset FSRS data
      due: Date.now(),
      stability: 0,
      difficulty: 0,
      scheduled_days: 0,
      learning_steps: 0,
      reps: 0,
      lapses: 0,
      state: 0,
    });

    toast.success(t("cardEdit.updated"));
    handleBack();
  };

  // Loading state: bags or card query still in progress
  const isLoading = !isMock && (bags === undefined || (bag && card === undefined));
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

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
            {t("cardEdit.bagNotFound")}
          </h2>
        </div>
      </div>
    );
  }

  if (!card) {
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
            {t("cardEdit.cardNotFound")}
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
          {t("cardEdit.title")}
        </h2>
        <span className="text-sm text-gray-500">- {bag.name}</span>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <CardForm
          initialData={{
            question: card.question,
            answer: card.answer,
            hint: card.hint,
            explanation: card.explanation,
            context: card.context,
          }}
          onSubmit={(data) => void handleSubmit(data)}
          submitLabel={t("cardEdit.submitLabel")}
          showQuestionByDefault={true}
        />
      </div>
    </div>
  );
}
