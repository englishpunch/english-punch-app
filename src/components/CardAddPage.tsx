import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "./Button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "@tanstack/react-router";
import useIsMock from "@/hooks/useIsMock";
import { CardForm } from "./CardForm";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function CardAddPage() {
  const { t } = useTranslation();
  const { bagId } = useParams({ from: "/plans/$bagId/cards/new" });
  const isMock = useIsMock();
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const userId = loggedInUser?._id;
  const navigate = useNavigate();
  const createCard = useMutation(api.learning.createCard);

  // Get bag info
  const bagsArgs = isMock ? "skip" : userId ? { userId } : "skip";
  const bags = useQuery(api.learning.getUserBags, bagsArgs);
  const bag = bags?.find((b) => b._id === bagId);

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
      toast.success(t("cardAdd.mockUnavailable"));
      handleBack();
      return;
    }
    if (!userId || !bag) {
      return;
    }

    await createCard({
      bagId: bag._id,
      userId,
      question: formData.question,
      answer: formData.answer,
      hint: formData.hint,
      explanation: formData.explanation,
      context: formData.context || undefined,
    });

    toast.success(t("cardAdd.added"));
    handleBack();
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
          {t("cardAdd.title")}
        </h2>
        <span className="text-sm text-gray-500">- {bag.name}</span>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <CardForm onSubmit={(data) => void handleSubmit(data)} />
      </div>
    </div>
  );
}
