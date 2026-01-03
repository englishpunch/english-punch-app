import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import StudyCard from "./StudyCard";
import { Button } from "./Button";
import { ArrowLeft, CheckCircle2, FileText } from "lucide-react";

interface FSRSStudySessionProps {
  bagId: Id<"bags">;
  onComplete: () => void;
}

type SessionCard = {
  _id: Id<"cards">;
  question: string;
  answer: string;
  hint?: string;
  explanation?: string;
  due: number;
  state: number;
  reps: number;
};

export default function FSRSStudySession({
  bagId,
  onComplete,
}: FSRSStudySessionProps) {
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

  // Convex 쿼리 및 뮤테이션
  const dueCards = useQuery(
    api.learning.getDueCards,
    userId
      ? {
          userId,
          bagId,
          limit: 30,
        }
      : "skip"
  );

  const startSession = useMutation(api.fsrs.startSession);
  const endSession = useMutation(api.fsrs.endSession);
  const reviewCard = useMutation(api.fsrs.reviewCard);

  // 세션 시작
  useEffect(() => {
    if (!userId) return;
    const initSession = async () => {
      try {
        const newSessionId = await startSession({
          userId,
          sessionType: "daily",
        });
        setSessionId(newSessionId);
      } catch (error) {
        console.error("Failed to start session:", error);
      }
    };

    initSession().catch(console.error);
  }, [startSession, userId]);

  // 학습할 카드들을 세션 시작 시점에 고정 (실시간 업데이트 방지)
  const [sessionCards, setSessionCards] = useState<SessionCard[]>([]);

  // 세션 카드 목록을 한 번만 설정
  React.useEffect(() => {
    if (dueCards && sessionCards.length === 0) {
      const allDue = dueCards;
      const newCardsOnly = allDue.filter((card) => card.state === 0);
      const reviewAndLearningCards = allDue.filter((card) => card.state !== 0);

      // 복습/학습 카드를 우선하고, 새 카드를 복습 카드 사이에 배치 (3:1 비율)
      const combined = [...reviewAndLearningCards];

      newCardsOnly.forEach((cardItem, index) => {
        const insertIndex = Math.min((index + 1) * 4, combined.length);
        combined.splice(insertIndex, 0, cardItem);
      });

      console.log("🎯 Session cards fixed:", combined.length, "cards");
      setSessionCards(combined);
    }
  }, [dueCards, sessionCards.length]);

  const allCards: SessionCard[] = sessionCards;

  const currentCard = allCards?.[currentCardIndex];
  const totalCards = allCards?.length || 0;
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
        console.log("✅ Session completed successfully");
      } catch (error) {
        console.error("❌ Failed to end session:", error);
      }
    }
    // 세션 카드 목록 초기화 (다음 세션을 위해)
    setSessionCards([]);
    onComplete();
  };

  // 뒤로 가기 핸들러 (카드 목록 초기화 포함)
  const handleBack = () => {
    setSessionCards([]);
    onComplete();
  };

  // 로딩 상태
  if (!allCards) {
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
        <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow">
          <div className="text-center">
            <div className="bg-primary-50 text-primary-700 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
              <CheckCircle2 className="h-8 w-8" aria-hidden />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-900">
              학습 완료!
            </h2>
            <p className="mb-6 text-gray-600">
              총 {completedCount}장의 카드를 학습했습니다.
            </p>

            {/* 세션 통계 */}
            <div className="mb-6 grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-gray-200 bg-red-50 p-3">
                <div className="text-lg font-semibold text-red-600">
                  {sessionStats.again}
                </div>
                <div className="text-sm text-red-600">다시</div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="text-primary-700 text-lg font-semibold">
                  {sessionStats.hard}
                </div>
                <div className="text-sm text-gray-700">어려움</div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="text-primary-700 text-lg font-semibold">
                  {sessionStats.good}
                </div>
                <div className="text-sm text-gray-700">보통</div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="text-primary-700 text-lg font-semibold">
                  {sessionStats.easy}
                </div>
                <div className="text-sm text-gray-700">쉬움</div>
              </div>
            </div>

            {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
            <Button fullWidth onClick={handleCompleteSession}>
              완료
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
        <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center shadow">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-500">
            <FileText className="h-8 w-8" aria-hidden />
          </div>
          <h2 className="mb-2 text-xl font-bold text-gray-900">
            학습할 카드가 없습니다
          </h2>
          <p className="mb-6 text-gray-600">
            모든 카드를 학습했거나 아직 복습 시간이 되지 않았습니다.
          </p>
          <Button fullWidth onClick={handleBack} variant="secondary">
            돌아가기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 진행률 표시 */}
      <div className="bg-white shadow-sm">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="mb-2 flex items-center justify-between">
            <Button
              onClick={handleBack}
              variant="secondary"
              size="sm"
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              <span className="text-sm font-medium">홈으로</span>
            </Button>
            <span className="text-sm font-medium text-gray-700">진행률</span>
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
      <div className="flex items-center justify-center p-4">
        <div className="w-full">
          {currentCard && (
            <StudyCard
              card={currentCard}
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
              onGrade={handleGrade}
              isLoading={isReviewing}
            />
          )}
        </div>
      </div>

      {/* 하단 통계 */}
      <div className="fixed right-0 bottom-0 left-0 border-t bg-white shadow">
        <div className="mx-auto max-w-4xl px-4 py-2">
          <div className="flex justify-center space-x-6 text-sm">
            <div className="flex items-center space-x-1">
              <div className="h-3 w-3 rounded-full bg-red-500"></div>
              <span>{sessionStats.again}</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="bg-primary-500 h-3 w-3 rounded-full"></div>
              <span>{sessionStats.hard}</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="bg-primary-600 h-3 w-3 rounded-full"></div>
              <span>{sessionStats.good}</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="bg-primary-700 h-3 w-3 rounded-full"></div>
              <span>{sessionStats.easy}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
