import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "./Button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "@tanstack/react-router";
import useIsMock from "@/hooks/useIsMock";
import { CardForm, type CardFormHandle } from "./CardForm";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useRef, useState, useEffect } from "react";

const KEEP_CREATING_KEY = "cardAdd.keepCreating";

export default function CardAddPage() {
  const { t } = useTranslation();
  const { bagId } = useParams({ from: "/plans/$bagId/cards/new" });
  const isMock = useIsMock();
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const userId = loggedInUser?._id;
  const navigate = useNavigate();
  const createCard = useMutation(api.learning.createCard);
  const cardFormRef = useRef<CardFormHandle>(null);

  // Get bag info
  const bagsArgs = isMock ? "skip" : userId ? { userId } : "skip";
  const bags = useQuery(api.learning.getUserBags, bagsArgs);
  const bag = bags?.find((b) => b._id === bagId);

  // Load and persist "keep creating" preference
  const [keepCreating, setKeepCreating] = useState(() => {
    try {
      const saved = localStorage.getItem(KEEP_CREATING_KEY);
      return saved === "true";
    } catch {
      // Handle cases where localStorage is unavailable (e.g., SSR, private browsing)
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(KEEP_CREATING_KEY, String(keepCreating));
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }, [keepCreating]);

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

    if (keepCreating) {
      // Reset form and stay on page
      cardFormRef.current?.reset();
    } else {
      // Navigate back to bag detail
      handleBack();
    }
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
        <CardForm
          ref={cardFormRef}
          onSubmit={(data) => void handleSubmit(data)}
          autoFocus={true}
        />
        <div className="mt-4 flex items-center gap-2 border-t border-gray-200 pt-4">
          <input
            type="checkbox"
            id="keep-creating"
            checked={keepCreating}
            onChange={(e) => setKeepCreating(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label
            htmlFor="keep-creating"
            className="cursor-pointer text-sm text-gray-700 select-none"
          >
            {t("cardAdd.keepCreating")}
          </label>
        </div>
      </div>
    </div>
  );
}
