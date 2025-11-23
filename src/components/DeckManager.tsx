import React, { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import FSRSStudySession from "./FSRSStudySession";
import DeckStats from "./DeckStats";
import { Button } from "./Button";
import { ArrowLeft, BarChart3, Eye, Loader2, Plus } from "lucide-react";

interface DeckManagerProps {
  userId: Id<"users">;
  onBack?: () => void;
}

export default function DeckManager({ userId, onBack }: DeckManagerProps) {
  const [currentView, setCurrentView] = useState<'decks' | 'study' | 'stats'>('decks');
  const [selectedDeckId, setSelectedDeckId] = useState<Id<"decks"> | null>(null);
  const [isCreatingSample, setIsCreatingSample] = useState(false);

  // Convex 쿼리 및 뮤테이션
  const decks = useQuery(api.learning.getUserDecks, { userId });
  const createSampleDeck = useMutation(api.learning.createSampleDeck);
  const updateDeckStats = useMutation(api.learning.updateDeckStats);

  const handleCreateSampleDeck = async () => {
    setIsCreatingSample(true);
    try {
      const deckId = await createSampleDeck({ userId });
      await updateDeckStats({ deckId });
      console.log('Sample deck created:', deckId);
    } catch (error) {
      console.error('Failed to create sample deck:', error);
    } finally {
      setIsCreatingSample(false);
    }
  };

  const handleStartStudy = (deckId: Id<"decks">) => {
    setSelectedDeckId(deckId);
    setCurrentView('study');
  };

  const handleViewStats = (deckId: Id<"decks">) => {
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
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-gray-900">영어 학습 덱</h1>
          <p className="text-base leading-6 text-gray-600">
            과학적인 간격 반복 학습으로 효율적으로 암기하세요. 한 번에 하나의 주요 행동만 보이도록 단순하게 유지합니다.
          </p>
        </div>
        {onBack && (
          <Button
            onClick={onBack}
            variant="secondary"
            size="sm"
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            메인으로 돌아가기
          </Button>
        )}
      </div>

      {/* 샘플 덱 생성 버튼 */}
      {(!decks || decks.length === 0) && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 shadow-sm">
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-700 text-xl">
              <Plus className="h-6 w-6" aria-hidden />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-gray-900">첫 학습을 시작해보세요!</h2>
              <p className="text-sm leading-6 text-gray-600">
                영어 기초 표현들로 구성된 샘플 덱으로 스마트 학습을 체험해보세요. 10개의 실용적인 영어 문장이 준비되어 있습니다.
              </p>
            </div>
            <Button
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
              onClick={handleCreateSampleDeck}
              disabled={isCreatingSample}
              className="mx-auto px-6"
            >
              {isCreatingSample ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  <span>생성 중...</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" aria-hidden />
                  <span>샘플 덱 생성하기</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* 덱 목록 */}
      {decks && decks.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      )}
    </div>
  );
}

interface DeckCardProps {
  deck: {
    _id: Id<"decks">;
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow transition-shadow duration-200">
      <div className="p-6">
        {/* 덱 헤더 */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">{deck.name}</h3>
          <div className="flex items-center space-x-2">
            {!deck.isActive && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
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
                className="px-2 py-1 bg-primary-50 text-primary-700 text-xs rounded-full"
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
            <span className="text-gray-600">새 카드:</span>
            <span className="font-semibold text-primary-700">{deck.newCards}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">학습 중:</span>
            <span className="font-semibold text-primary-700">{deck.learningCards}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">복습:</span>
            <span className="font-semibold text-primary-700">{deck.reviewCards}</span>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="space-y-2">
          {dueCount > 0 ? (
            <Button
              onClick={onStartStudy}
              fullWidth
            >
              학습하기 ({dueCount}장)
            </Button>
          ) : (
            <Button fullWidth variant="secondary" disabled>
              학습할 카드가 없습니다
            </Button>
          )}
          
          <div className="flex gap-2">
            <Button
              onClick={onStartStudy}
              variant="secondary"
              size="sm"
              className="flex-1 gap-2"
            >
              <Eye className="h-4 w-4" aria-hidden />
              모든 카드 보기
            </Button>
            <Button
              onClick={onViewStats}
              variant="secondary"
              size="sm"
              className="flex-1 gap-2"
            >
              <BarChart3 className="h-4 w-4" aria-hidden />
              통계
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
