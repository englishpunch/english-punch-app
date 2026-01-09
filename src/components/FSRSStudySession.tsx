import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import StudyCard from "./StudyCard";
import { Button } from "./Button";
import { ArrowLeft, CheckCircle2, FileText } from "lucide-react";
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
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [sessionStats, setSessionStats] = useState({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });

  const startSession = useMutation(api.fsrs.startSession);
  const endSession = useMutation(api.fsrs.endSession);
  const reviewCard = useMutation(api.fsrs.reviewCard);

  // Get cards from session (pre-shuffled order)
  const sessionCards = useQuery(
    api.fsrs.getSessionCards,
    sessionId ? { sessionId } : "skip"
  );

  // 세션 시작
  useEffect(() => {
    if (!userId || sessionId) return;
    const initSession = async () => {
      try {
        const newSessionId = await startSession({
          userId,
          bagId,
          sessionType: "daily",
          limit: 30,
        });
        setSessionId(newSessionId);
      } catch (error) {
        console.error("Failed to start session:", error);
      }
    };

    initSession().catch(console.error);
  }, [startSession, userId, bagId, sessionId]);

  const currentCard = sessionCards?.[currentCardIndex];
  const totalCards = sessionCards?.length || 0;
  const isSessionComplete = currentCardIndex >= totalCards;

  const handleGrade = async (rating: 1 | 2 | 3 | 4, duration: number) => {
    if (!userId || !currentCard || !sessionId || isReviewing) return;

    setIsReviewing(true);

    try {
      await reviewCard({
        userId,
        cardId: currentCard._id,
        rating,
        duration,
        sessionId,
      });

      // 통계 업데이트
      setSessionStats((prev) => ({
        ...prev,
        again: prev.again + (rating === 1 ? 1 : 0),
        hard: prev.hard + (rating === 2 ? 1 : 0),
        good: prev.good + (rating === 3 ? 1 : 0),
        easy: prev.easy + (rating === 4 ? 1 : 0),
      }));

      setCompletedCount((prev) => prev + 1);

      // 다음 카드로 이동
      setTimeout(() => {
        setCurrentCardIndex((prev) => prev + 1);
        setIsReviewing(false);
      }, 500);
    } catch (error) {
      console.error("Failed to review card:", error);
      setIsReviewing(false);
    }
  };

  const handleCompleteSession = async () => {
    if (sessionId) {
      try {
        await endSession({ sessionId });
      } catch (error) {
        console.error("❌ Failed to end session:", error);
      }
    }
    // 세션 카드 목록 초기화 (다음 세션을 위해)
    setSessionId(null);
    onComplete();
  };

  // 뒤로 가기 핸들러 (카드 목록 초기화 포함)
  const handleBack = () => {
    setSessionId(null);
    onComplete();
  };

  // 로딩 상태
  if (!sessionCards) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-primary-500 h-12 w-12 animate-spin rounded-full border-b-2"></div>
      </div>
    );
  }

  // 세션 완료
  if (isSessionComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md bg-white p-8">
          <div className="text-center">
            <div className="bg-primary-50 text-primary-700 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
              <CheckCircle2 className="h-8 w-8" aria-hidden />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-900">
              {t("studySession.completeTitle")}
            </h2>
            <p className="mb-6 text-gray-600">
              {t("studySession.completeSummary", { count: completedCount })}
            </p>

            {/* 세션 통계 */}
            <div className="mb-6 grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-gray-200 bg-red-50 p-3">
                <div className="text-lg font-semibold text-red-600">
                  {sessionStats.again}
                </div>
                <div className="text-sm text-red-600">
                  {t("ratings.labels.again")}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="text-primary-700 text-lg font-semibold">
                  {sessionStats.hard}
                </div>
                <div className="text-sm text-gray-700">
                  {t("ratings.labels.hard")}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="text-primary-700 text-lg font-semibold">
                  {sessionStats.good}
                </div>
                <div className="text-sm text-gray-700">
                  {t("ratings.labels.good")}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="text-primary-700 text-lg font-semibold">
                  {sessionStats.easy}
                </div>
                <div className="text-sm text-gray-700">
                  {t("ratings.labels.easy")}
                </div>
              </div>
            </div>

            <Button fullWidth onClick={() => void handleCompleteSession()}>
              {t("common.actions.done")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 카드가 없는 경우
  if (totalCards === 0) {
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
      {/* 진행률 표시 */}
      <div className="">
        <div className="w-full p-4">
          <div className="mb-2 flex items-center justify-between">
            <Button
              onClick={handleBack}
              variant="secondary"
              size="sm"
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              <span className="text-sm font-medium">
                {t("studySession.backToHome")}
              </span>
            </Button>
            <span className="text-sm font-medium text-gray-700">
              {t("studySession.progress")}
            </span>
            <span className="text-sm text-gray-500">
              {currentCardIndex + 1} / {totalCards}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${((currentCardIndex + 1) / totalCards) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* 학습 카드 */}
      <div className="flex items-center justify-center px-0 py-4">
        <div className="w-full">
          {currentCard && (
            <StudyCard
              card={currentCard}
              onGrade={(rating, duration) => void handleGrade(rating, duration)}
              isLoading={isReviewing}
            />
          )}
        </div>
      </div>
    </div>
  );
}
