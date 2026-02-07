import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import StudyCard from "./StudyCard";
import { Button } from "./Button";
import { FileText } from "lucide-react";
import { Spinner } from "./Spinner";
import { useTranslation } from "react-i18next";

interface FSRSStudySessionProps {
  bagId: Id<"bags">;
  onComplete: () => void;
}

export default function FSRSStudySession({
  bagId,
  onComplete,
}: FSRSStudySessionProps) {
  const { t } = useTranslation();
  const loggedInUser = useQuery(api.auth.loggedInUser);

  const userId = loggedInUser?._id;
  const [isReviewing, setIsReviewing] = useState(false);

  // Convex 쿼리 및 뮤테이션
  const dueCard = useQuery(api.learning.getOneDueCard, {
    bagId,
  });

  const dueCardCount = useQuery(api.learning.getDueCardCount, {
    bagId,
  });
  const dueCardCountDisplay =
    typeof dueCardCount === "number" && dueCardCount > 100
      ? "100+"
      : `${dueCardCount}`;

  const reviewCard = useMutation(api.fsrs.reviewCard);

  const handleGrade = async (rating: 1 | 2 | 3 | 4, duration: number) => {
    if (!userId || !dueCard || dueCard === "NO_CARD_AVAILABLE" || isReviewing) {
      return;
    }

    setIsReviewing(true);

    try {
      await reviewCard({
        userId,
        cardId: dueCard._id,
        rating,
        duration,
      });
    } catch (error) {
      console.error("Failed to review card:", error);
    }
    setIsReviewing(false);
  };

  // 뒤로 가기 핸들러 (카드 목록 초기화 포함)
  const handleBack = () => {
    onComplete();
  };

  // 로딩 상태
  if (!dueCard) {
    return <Spinner wrapper="page" />;
  }

  // 카드가 없는 경우
  if (dueCard === "NO_CARD_AVAILABLE") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md bg-white p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-500">
            <FileText className="h-8 w-8" aria-hidden />
          </div>
          <h2 className="mb-2 text-xl font-bold text-gray-900">
            {t("studySession.noCardsTitle")}
          </h2>
          <p className="mb-6 text-gray-600">
            {t("studySession.noCardsDescription")}
          </p>
          <Button fullWidth onClick={handleBack} variant="secondary">
            {t("common.actions.back")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div>
        <div className="flex items-center justify-between px-4 py-4">
          <h1 className="text-lg font-medium text-gray-900">
            {t("studySession.sessionTitle")}
          </h1>
          <div className="text-sm text-gray-600">
            {dueCardCount !== undefined
              ? t("studySession.cardsDue", {
                  countDisplay: dueCardCountDisplay,
                })
              : ""}
          </div>
        </div>
      </div>
      {/* Study card */}
      {dueCard && (
        <StudyCard
          card={dueCard}
          onGrade={(rating, duration) => void handleGrade(rating, duration)}
          isLoading={isReviewing}
        />
      )}
    </div>
  );
}
