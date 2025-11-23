import React, { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import FSRSStudySession from "./FSRSStudySession";
import BagStats from "./BagStats";
import { Button } from "./Button";
import { ArrowLeft, BarChart3, Eye, Loader2, Plus } from "lucide-react";

interface BagManagerProps {
  userId: Id<"users">;
  onBack?: () => void;
}

export default function BagManager({ userId, onBack }: BagManagerProps) {
  const [currentView, setCurrentView] = useState<"bags" | "study" | "stats">(
    "bags",
  );
  const [selectedBagId, setSelectedBagId] = useState<Id<"bags"> | null>(
    null,
  );
  const [isCreatingSample, setIsCreatingSample] = useState(false);

  // Convex 쿼리 및 뮤테이션
  const bags = useQuery(api.learning.getUserBags, { userId });
  const createSampleBag = useMutation(api.learning.createSampleBag);
  const updateBagStats = useMutation(api.learning.updateBagStats);

  const handleCreateSampleBag = async () => {
    setIsCreatingSample(true);
    try {
      const bagId = await createSampleBag({ userId });
      await updateBagStats({ bagId });
      console.log("Sample bag created:", bagId);
    } catch (error) {
      console.error("Failed to create sample bag:", error);
    } finally {
      setIsCreatingSample(false);
    }
  };

  const handleStartStudy = (bagId: Id<"bags">) => {
    setSelectedBagId(bagId);
    setCurrentView("study");
  };

  const handleViewStats = (bagId: Id<"bags">) => {
    setSelectedBagId(bagId);
    setCurrentView("stats");
  };

  const handleCompleteStudy = () => {
    setCurrentView("bags");
    setSelectedBagId(null);
  };

  const handleBackToBags = () => {
    setCurrentView("bags");
    setSelectedBagId(null);
  };

  if (currentView === "study" && selectedBagId) {
    return (
      <FSRSStudySession
        bagId={selectedBagId}
        userId={userId}
        onComplete={handleCompleteStudy}
      />
    );
  }

  if (currentView === "stats" && selectedBagId) {
    return (
      <BagStats
        userId={userId}
        bagId={selectedBagId}
        onBack={handleBackToBags}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-gray-900">영어 학습 샌드백</h1>
          <p className="text-base leading-6 text-gray-600">
            과학적인 간격 반복 학습으로 효율적으로 암기하세요. 한 번에 하나의
            주요 행동만 보이도록 단순하게 유지합니다.
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

      {/* 샘플 샌드백 생성 버튼 */}
      {(!bags || bags.length === 0) && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 shadow-sm">
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-700 text-xl">
              <Plus className="h-6 w-6" aria-hidden />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-gray-900">
                첫 학습을 시작해보세요!
              </h2>
              <p className="text-sm leading-6 text-gray-600">
                영어 기초 표현들로 구성된 샘플 샌드백으로 스마트 학습을
                체험해보세요. 10개의 실용적인 영어 문장이 준비되어 있습니다.
              </p>
            </div>
            <Button
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
              onClick={handleCreateSampleBag}
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
                  <span>샘플 샌드백 생성하기</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* 샌드백 목록 */}
      {bags && bags.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {bags.map((bag) => (
            <BagCard
              key={bag._id}
              bag={bag}
              onStartStudy={() => handleStartStudy(bag._id)}
              onViewStats={() => handleViewStats(bag._id)}
            />
          ))}
        </div>
      )}

      {/* 로딩 상태 */}
      {!bags && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      )}
    </div>
  );
}

interface BagCardProps {
  bag: {
    _id: Id<"bags">;
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

function BagCard({ bag, onStartStudy, onViewStats }: BagCardProps) {
  const dueCount = bag.newCards + bag.learningCards; // 간단히 계산

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow transition-shadow duration-200">
      <div className="p-6">
        {/* 샌드백 헤더 */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">{bag.name}</h3>
          <div className="flex items-center space-x-2">
            {!bag.isActive && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                비활성
              </span>
            )}
          </div>
        </div>

        {/* 샌드백 설명 */}
        {bag.description && (
          <p className="text-sm text-gray-600 mb-4">{bag.description}</p>
        )}

        {/* 태그 */}
        {bag.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {bag.tags.map((tag) => (
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
            <span className="font-medium">{bag.totalCards}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">새 카드:</span>
            <span className="font-semibold text-primary-700">
              {bag.newCards}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">학습 중:</span>
            <span className="font-semibold text-primary-700">
              {bag.learningCards}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">복습:</span>
            <span className="font-semibold text-primary-700">
              {bag.reviewCards}
            </span>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="space-y-2">
          {dueCount > 0 ? (
            <Button onClick={onStartStudy} fullWidth>
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
