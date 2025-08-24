import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';

interface StudyCardProps {
  card: {
    _id: string;
    question: string;
    answer: string;
    hint?: string;
    explanation?: string;
    state: number;
    reps: number;
  };
  onGrade: (rating: 1 | 2 | 3 | 4, duration: number) => void;
  isLoading?: boolean;
}

export default function StudyCard({ card, onGrade, isLoading = false }: StudyCardProps) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    setShowAnswer(false);
    setStartTime(Date.now());
  }, [card._id]);

  const handleShowAnswer = () => {
    setShowAnswer(true);
  };

  const handleGrade = (rating: 1 | 2 | 3 | 4) => {
    if (!startTime) return;
    
    const duration = Date.now() - startTime;
    onGrade(rating, duration);
  };

  const getRatingConfig = (rating: 1 | 2 | 3 | 4) => {
    const configs = {
      1: { 
        label: '다시', 
        color: 'bg-red-500 hover:bg-red-600', 
        description: '기억나지 않음',
        shortcut: '1'
      },
      2: { 
        label: '어려움', 
        color: 'bg-orange-500 hover:bg-orange-600', 
        description: '어렵게 기억남',
        shortcut: '2'
      },
      3: { 
        label: '보통', 
        color: 'bg-green-500 hover:bg-green-600', 
        description: '잘 기억남',
        shortcut: '3'
      },
      4: { 
        label: '쉬움', 
        color: 'bg-blue-500 hover:bg-blue-600', 
        description: '매우 쉬움',
        shortcut: '4'
      },
    };
    return configs[rating];
  };

  // 키보드 단축키
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!showAnswer) {
        if (event.code === 'Space') {
          event.preventDefault();
          handleShowAnswer();
        }
        return;
      }

      // 답이 보일 때만 평가 가능
      if (event.key >= '1' && event.key <= '4') {
        event.preventDefault();
        const rating = parseInt(event.key) as 1 | 2 | 3 | 4;
        handleGrade(rating);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showAnswer, startTime]);

  const getStateLabel = (state: number) => {
    const labels = ['새 카드', '학습 중', '복습', '재학습'];
    return labels[state] || '알 수 없음';
  };

  const getStateColor = (state: number) => {
    const colors = [
      'bg-gray-100 text-gray-800', // New
      'bg-blue-100 text-blue-800', // Learning
      'bg-green-100 text-green-800', // Review
      'bg-orange-100 text-orange-800', // Relearning
    ];
    return colors[state] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
      {/* 카드 헤더 */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4 text-white">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <span className={clsx(
              'px-2 py-1 rounded-full text-xs font-medium',
              getStateColor(card.state)
            )}>
              {getStateLabel(card.state)}
            </span>
            <span className="text-sm opacity-90">
              복습 {card.reps}회
            </span>
          </div>
          <div className="text-sm opacity-90">
            {!showAnswer && 'Space: 답 보기'}
            {showAnswer && '1-4: 평가하기'}
          </div>
        </div>
      </div>

      {/* 카드 본문 */}
      <div className="px-6 py-8">
        {/* 문제 */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-500 mb-2">문제</h2>
          <p className="text-2xl font-bold text-gray-900 leading-relaxed">
            {card.question}
          </p>
        </div>

        {/* 힌트 */}
        {card.hint && !showAnswer && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">힌트</h3>
            <p className="text-gray-600 italic">
              {card.hint}
            </p>
          </div>
        )}

        {/* 답 영역 */}
        {!showAnswer ? (
          <div className="text-center">
            <button
              onClick={handleShowAnswer}
              className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-lg font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              disabled={isLoading}
            >
              답 보기 <span className="text-sm opacity-75">(Space)</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 정답 */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">정답</h3>
              <p className="text-xl font-bold text-green-600">
                {card.answer}
              </p>
            </div>

            {/* 설명 */}
            {card.explanation && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">설명</h3>
                <p className="text-gray-700">
                  {card.explanation}
                </p>
              </div>
            )}

            {/* 평가 버튼들 */}
            <div className="pt-4">
              <h3 className="text-sm font-medium text-gray-500 mb-4 text-center">
                얼마나 잘 기억하셨나요?
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {([1, 2, 3, 4] as const).map((rating) => {
                  const config = getRatingConfig(rating);
                  return (
                    <button
                      key={rating}
                      onClick={() => handleGrade(rating)}
                      disabled={isLoading}
                      className={clsx(
                        'px-4 py-3 rounded-lg text-white font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
                        'focus:outline-none focus:ring-2 focus:ring-opacity-50 focus:ring-offset-2',
                        'transform hover:scale-105 active:scale-95',
                        config.color
                      )}
                    >
                      <div className="text-center">
                        <div className="font-bold">{config.label}</div>
                        <div className="text-xs opacity-90 mt-1">
                          {config.description}
                        </div>
                        <div className="text-xs opacity-75 mt-1">
                          ({config.shortcut})
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 평가 가이드 */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">평가 가이드</h4>
                <div className="text-xs text-gray-600 space-y-1">
                  <div><strong>다시:</strong> 전혀 기억나지 않았음</div>
                  <div><strong>어려움:</strong> 기억하는데 어려움이 있었음</div>
                  <div><strong>보통:</strong> 적절한 노력으로 기억함</div>
                  <div><strong>쉬움:</strong> 매우 쉽게 기억함</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 로딩 오버레이 */}
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}
    </div>
  );
}