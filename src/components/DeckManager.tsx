import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import FSRSStudySession from './FSRSStudySession';
import DeckStats from './DeckStats';

interface DeckManagerProps {
  userId: string;
  onBack?: () => void;
}

export default function DeckManager({ userId, onBack }: DeckManagerProps) {
  const [currentView, setCurrentView] = useState<'decks' | 'study' | 'stats'>('decks');
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [isCreatingSample, setIsCreatingSample] = useState(false);

  // Convex 쿼리 및 뮤테이션
  const decks = useQuery(api.learning.getUserDecks, { userId: userId as any });
  const createSampleDeck = useMutation(api.learning.createSampleDeck);
  const updateDeckStats = useMutation(api.learning.updateDeckStats);

  const handleCreateSampleDeck = async () => {
    setIsCreatingSample(true);
    try {
      const deckId = await createSampleDeck({ userId: userId as any });
      await updateDeckStats({ deckId });
      console.log('Sample deck created:', deckId);
    } catch (error) {
      console.error('Failed to create sample deck:', error);
    } finally {
      setIsCreatingSample(false);
    }
  };

  const handleStartStudy = (deckId: string) => {
    setSelectedDeckId(deckId);
    setCurrentView('study');
  };

  const handleViewStats = (deckId: string) => {
    setSelectedDeckId(deckId);
    setCurrentView('stats');
  };

  const handleCompleteStudy = () => {
    setCurrentView('decks');
    setSelectedDeckId(null);
  };

  const handleBackToDecks = () => {
    setCurrentView('decks');
    setSelectedDeckId(null);
  };

  if (currentView === 'study' && selectedDeckId) {
    return (
      <FSRSStudySession
        deckId={selectedDeckId}
        userId={userId}
        onComplete={handleCompleteStudy}
      />
    );
  }

  if (currentView === 'stats' && selectedDeckId) {
    return (
      <DeckStats
        userId={userId}
        deckId={selectedDeckId}
        onBack={handleBackToDecks}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">영어 학습 덱</h1>
            <p className="text-gray-600">과학적인 간격 반복 학습으로 효율적으로 암기하세요.</p>
          </div>
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              메인으로 돌아가기
            </button>
          )}
        </div>
      </div>

      {/* 샘플 덱 생성 버튼 */}
      {(!decks || decks.length === 0) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">첫 학습을 시작해보세요!</h2>
            <p className="text-gray-600 mb-6">
              영어 기초 표현들로 구성된 샘플 덱으로 스마트 학습을 체험해보세요.
              10개의 실용적인 영어 문장이 준비되어 있습니다.
            </p>
            <button
              onClick={handleCreateSampleDeck}
              disabled={isCreatingSample}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-8 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2 mx-auto"
            >
              {isCreatingSample ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>생성 중...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>샘플 덱 생성하기</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 덱 목록 */}
      {decks && decks.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <DeckCard
              key={deck._id}
              deck={deck}
              onStartStudy={() => handleStartStudy(deck._id)}
              onViewStats={() => handleViewStats(deck._id)}
            />
          ))}
        </div>
      )}

      {/* 로딩 상태 */}
      {!decks && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}
    </div>
  );
}

interface DeckCardProps {
  deck: {
    _id: string;
    name: string;
    description?: string;
    totalCards: number;
    newCards: number;
    learningCards: number;
    reviewCards: number;
    tags: string[];
    isActive: boolean;
  };
  onStartStudy: () => void;
  onViewStats: () => void;
}

function DeckCard({ deck, onStartStudy, onViewStats }: DeckCardProps) {
  const dueCount = deck.newCards + deck.learningCards; // 간단히 계산
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
      <div className="p-6">
        {/* 덱 헤더 */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">{deck.name}</h3>
          <div className="flex items-center space-x-2">
            {!deck.isActive && (
              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">
                비활성
              </span>
            )}
          </div>
        </div>

        {/* 덱 설명 */}
        {deck.description && (
          <p className="text-sm text-gray-600 mb-4">{deck.description}</p>
        )}

        {/* 태그 */}
        {deck.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {deck.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* 통계 */}
        <div className="space-y-2 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">전체 카드:</span>
            <span className="font-medium">{deck.totalCards}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-blue-600">새 카드:</span>
            <span className="font-medium text-blue-600">{deck.newCards}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-orange-600">학습 중:</span>
            <span className="font-medium text-orange-600">{deck.learningCards}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-green-600">복습:</span>
            <span className="font-medium text-green-600">{deck.reviewCards}</span>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="space-y-2">
          {dueCount > 0 ? (
            <button
              onClick={onStartStudy}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg font-medium transition-colors duration-200"
            >
              학습하기 ({dueCount}장)
            </button>
          ) : (
            <div className="w-full bg-gray-100 text-gray-500 py-3 px-4 rounded-lg text-center">
              학습할 카드가 없습니다
            </div>
          )}
          
          <div className="flex space-x-2">
            <button
              onClick={onStartStudy}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium transition-colors duration-200"
            >
              모든 카드 보기
            </button>
            <button
              onClick={onViewStats}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center justify-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              통계
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}