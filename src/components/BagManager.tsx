import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import FSRSStudySession from "./FSRSStudySession";
import BagStats from "./BagStats";
import { Button } from "./Button";
import { ArrowLeft, BarChart3, Eye, Loader2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

interface BagManagerProps {
  onBack?: () => void;
}

export default function BagManager({ onBack }: BagManagerProps) {
  const { t } = useTranslation();
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const userId = loggedInUser?._id;

  const [currentView, setCurrentView] = useState<"bags" | "study" | "stats">(
    "bags"
  );
  const [selectedBagId, setSelectedBagId] = useState<Id<"bags"> | null>(null);
  const [isCreatingSample, setIsCreatingSample] = useState(false);

  // Convex 쿼리 및 뮤테이션
  const bags = useQuery(api.learning.getUserBags, userId ? { userId } : "skip");
  const createSampleBag = useMutation(api.learning.createSampleBag);
  const updateBagStats = useMutation(api.learning.updateBagStats);

  const handleCreateSampleBag = async () => {
    if (!userId) return;
    setIsCreatingSample(true);
    try {
      const bagId = await createSampleBag({ userId });
      await updateBagStats({ bagId });
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
        onComplete={handleCompleteStudy}
      />
    );
  }

  if (currentView === "stats" && selectedBagId) {
    return <BagStats bagId={selectedBagId} onBack={handleBackToBags} />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-gray-900">
            {t("bagManager.title")}
          </h1>
          <p className="text-base leading-6 text-gray-600">
            {t("bagManager.description")}
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
            {t("bagManager.backToMain")}
          </Button>
        )}
      </div>

      {/* 샘플 샌드백 생성 버튼 */}
      {(!bags || bags.length === 0) && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 shadow-sm">
          <div className="space-y-4 text-center">
            <div className="bg-primary-50 text-primary-700 mx-auto flex h-14 w-14 items-center justify-center rounded-full text-xl">
              <Plus className="h-6 w-6" aria-hidden />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-gray-900">
                {t("bagManager.sample.title")}
              </h2>
              <p className="text-sm leading-6 text-gray-600">
                {t("bagManager.sample.description")}
              </p>
            </div>
            <Button
              onClick={() => void handleCreateSampleBag()}
              disabled={isCreatingSample || !userId}
              className="mx-auto px-6"
            >
              {isCreatingSample ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  <span>{t("bagManager.sample.creating")}</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" aria-hidden />
                  <span>{t("bagManager.sample.create")}</span>
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
          <div className="border-primary-500 h-8 w-8 animate-spin rounded-full border-b-2"></div>
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
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow">
      <div className="p-6">
        {/* 샌드백 헤더 */}
        <div className="mb-3 flex items-start justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{bag.name}</h3>
          <div className="flex items-center space-x-2">
            {!bag.isActive && (
              <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                {t("bagManager.inactive")}
              </span>
            )}
          </div>
        </div>

        {/* 샌드백 설명 */}
        {bag.description && (
          <p className="mb-4 text-sm text-gray-600">{bag.description}</p>
        )}

        {/* 태그 */}
        {bag.tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1">
            {bag.tags.map((tag) => (
              <span
                key={tag}
                className="bg-primary-50 text-primary-700 rounded-full px-2 py-1 text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* 통계 */}
        <div className="mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              {t("bagManager.stats.totalCards")}:
            </span>
            <span className="font-medium">{bag.totalCards}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              {t("bagManager.stats.newCards")}:
            </span>
            <span className="text-primary-700 font-semibold">
              {bag.newCards}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              {t("bagManager.stats.learningCards")}:
            </span>
            <span className="text-primary-700 font-semibold">
              {bag.learningCards}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              {t("bagManager.stats.reviewCards")}:
            </span>
            <span className="text-primary-700 font-semibold">
              {bag.reviewCards}
            </span>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="space-y-2">
          {dueCount > 0 ? (
            <Button onClick={onStartStudy} fullWidth>
              {t("bagManager.actions.studyWithCount", { count: dueCount })}
            </Button>
          ) : (
            <Button fullWidth variant="secondary" disabled>
              {t("bagManager.actions.noCards")}
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
              {t("bagManager.actions.viewAll")}
            </Button>
            <Button
              onClick={onViewStats}
              variant="secondary"
              size="sm"
              className="flex-1 gap-2"
            >
              <BarChart3 className="h-4 w-4" aria-hidden />
              {t("bagManager.actions.stats")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
