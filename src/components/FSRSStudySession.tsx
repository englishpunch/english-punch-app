import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import StudyCard from './StudyCard';

interface FSRSStudySessionProps {
  deckId: string;
  userId: string;
  onComplete: () => void;
}

export default function FSRSStudySession({ deckId, userId, onComplete }: FSRSStudySessionProps) {
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
  const dueCards = useQuery(api.learning.getDueCards, { 
    userId: userId as any, 
    deckId: deckId as any,
    limit: 20 
  });
  const newCards = useQuery(api.learning.getNewCards, { 
    userId: userId as any, 
    deckId: deckId as any,
    limit: 10 
  });
  
  const startSession = useMutation(api.fsrs.startSession);
  const endSession = useMutation(api.fsrs.endSession);
  const reviewCard = useMutation(api.fsrs.reviewCard);

  // 세션 시작
  useEffect(() => {
    const initSession = async () => {
      try {
        const newSessionId = await startSession({
          userId: userId as any,
          sessionType: "daily"
        });
        setSessionId(newSessionId);
      } catch (error) {
        console.error('Failed to start session:', error);
      }
    };

    initSession().catch(console.error);
  }, [startSession, userId]);

  // 학습할 카드들 결합 (복습 카드 + 새 카드)
  const allCards = React.useMemo(() => {
    const due = dueCards || [];
    const newCardsToAdd = newCards || [];
    
    // 복습 카드를 우선하고, 새 카드를 적절히 섞음
    const combined = [...due];
    
    // 새 카드를 복습 카드 사이에 배치 (3:1 비율)
    newCardsToAdd.forEach((cardItem, index) => {
      const insertIndex = Math.min((index + 1) * 4, combined.length);
      combined.splice(insertIndex, 0, cardItem);
    });
    
    return combined;
  }, [dueCards, newCards]);

  const currentCard = allCards?.[currentCardIndex];
  const totalCards = allCards?.length || 0;
  const isSessionComplete = currentCardIndex >= totalCards;

  const handleGrade = async (rating: 1 | 2 | 3 | 4, duration: number) => {
    if (!currentCard || !sessionId || isReviewing) return;

    setIsReviewing(true);
    
    try {
      await reviewCard({
        userId: userId as any,
        cardId: currentCard._id as any,
        rating,
        duration,
        sessionId,
      });

      // 통계 업데이트
      setSessionStats(prev => ({
        ...prev,
        again: prev.again + (rating === 1 ? 1 : 0),
        hard: prev.hard + (rating === 2 ? 1 : 0),
        good: prev.good + (rating === 3 ? 1 : 0),
        easy: prev.easy + (rating === 4 ? 1 : 0),
      }));

      setCompletedCount(prev => prev + 1);

      // 다음 카드로 이동
      setTimeout(() => {
        setCurrentCardIndex(prev => prev + 1);
        setIsReviewing(false);
      }, 500);

    } catch (error) {
      console.error('Failed to review card:', error);
      setIsReviewing(false);
    }
  };

  const handleCompleteSession = async () => {
    if (sessionId) {
      try {
        await endSession({ sessionId });
      } catch (error) {
        console.error('Failed to end session:', error);
      }
    }
    onComplete();
  };

  // 로딩 상태
  if (!allCards) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // 세션 완료
  if (isSessionComplete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">학습 완료!</h2>
            <p className="text-gray-600 mb-6">
              총 {completedCount}장의 카드를 학습했습니다.
            </p>

            {/* 세션 통계 */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-red-50 p-3 rounded-lg">
                <div className="text-red-600 font-bold text-lg">{sessionStats.again}</div>
                <div className="text-red-500 text-sm">다시</div>
              </div>
              <div className="bg-orange-50 p-3 rounded-lg">
                <div className="text-orange-600 font-bold text-lg">{sessionStats.hard}</div>
                <div className="text-orange-500 text-sm">어려움</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-green-600 font-bold text-lg">{sessionStats.good}</div>
                <div className="text-green-500 text-sm">보통</div>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-blue-600 font-bold text-lg">{sessionStats.easy}</div>
                <div className="text-blue-500 text-sm">쉬움</div>
              </div>
            </div>

            <button
              onClick={handleCompleteSession}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg font-medium transition-colors duration-200"
            >
              완료
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 카드가 없는 경우
  if (totalCards === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">학습할 카드가 없습니다</h2>
          <p className="text-gray-600 mb-6">
            모든 카드를 학습했거나 아직 복습 시간이 되지 않았습니다.
          </p>
          <button
            onClick={onComplete}
            className="w-full bg-gray-500 hover:bg-gray-600 text-white py-3 px-4 rounded-lg font-medium transition-colors duration-200"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 진행률 표시 */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={onComplete}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-medium">홈으로</span>
            </button>
            <span className="text-sm font-medium text-gray-700">
              진행률
            </span>
            <span className="text-sm text-gray-500">
              {currentCardIndex + 1} / {totalCards}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentCardIndex + 1) / totalCards) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* 학습 카드 */}
      <div className="flex items-center justify-center min-h-[calc(100vh-120px)] p-4">
        <div className="w-full">
          {currentCard && (
            <StudyCard
              card={currentCard}
              onGrade={handleGrade}
              isLoading={isReviewing}
            />
          )}
        </div>
      </div>

      {/* 하단 통계 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-2">
          <div className="flex justify-center space-x-6 text-sm">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>{sessionStats.again}</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              <span>{sessionStats.hard}</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>{sessionStats.good}</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>{sessionStats.easy}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}