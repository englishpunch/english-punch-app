import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { StatsCard } from "./StatsCard";
import { QuickActions } from "./QuickActions";
import { RecentActivity } from "./RecentActivity";

interface DashboardProps {
  onStartStudy: (mode: "flashcards" | "quiz" | "spelling" | "definition_match", wordListId?: string) => void;
  onViewLists: () => void;
  onViewProgress: () => void;
  onStartFSRS: () => void;
}

export function Dashboard({ onStartStudy, onViewLists, onViewProgress, onStartFSRS }: DashboardProps) {
  const userStats = useQuery(api.studySessions.getUserStats);
  const recentSessions = useQuery(api.studySessions.getUserStudySessions, { limit: 5 });
  const wordsForReview = useQuery(api.vocabulary.getWordsForReview, { limit: 10 });
  const populateSampleWords = useMutation(api.sampleData.populateSampleWords);

  if (userStats === undefined || recentSessions === undefined || wordsForReview === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  const todayProgress = userStats?.weeklyStats[today] || 0;
  const dailyGoal = userStats?.dailyGoal || 10;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">English Punch 🥊</h1>
        <p className="text-gray-600">Choose your learning method</p>
      </div>

      {/* FSRS Learning - New Main Feature */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-8 shadow-lg text-white">
        <div className="text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🧠</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">스마트 간격 반복 학습</h2>
          <p className="text-blue-100 mb-6">
            과학적인 알고리즘으로 최적의 학습 효율을 경험하세요.
            <br />
            개인의 기억 패턴에 맞춰 자동으로 복습 간격을 조정합니다.
          </p>
          <button
            onClick={onStartFSRS}
            className="bg-white text-blue-600 px-8 py-3 rounded-lg font-bold text-lg hover:bg-blue-50 transition-colors transform hover:scale-105"
          >
            스마트 학습 시작하기 🚀
          </button>
        </div>
      </div>

      {/* Legacy Features - Commented Out */}
      {/* 
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Current Streak"
          value={userStats?.currentStreak || 0}
          unit="days"
          icon="🔥"
          color="text-orange-600"
        />
        <StatsCard
          title="Words Learned"
          value={userStats?.totalWordsLearned || 0}
          unit="total"
          icon="📚"
          color="text-blue-600"
        />
        <StatsCard
          title="Today's Progress"
          value={todayProgress}
          unit={`/ ${dailyGoal}`}
          icon="🎯"
          color="text-green-600"
        />
        <StatsCard
          title="Due for Review"
          value={wordsForReview?.length || 0}
          unit="words"
          icon="⏰"
          color="text-purple-600"
        />
      </div>

      <QuickActions
        onStartStudy={onStartStudy}
        onViewLists={onViewLists}
        onViewProgress={onViewProgress}
        wordsForReview={wordsForReview?.length || 0}
      />

      <RecentActivity sessions={recentSessions || []} />
      */}

      {/* Legacy Vocabulary System Access */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">기존 단어장 시스템</h3>
          <p className="text-gray-600 mb-4">
            기존의 단어장 기반 학습을 원하시면 아래 버튼을 클릭하세요.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => onStartStudy("flashcards")}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              플래시카드
            </button>
            <button
              onClick={() => onStartStudy("quiz")}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              퀴즈
            </button>
            <button
              onClick={onViewLists}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              단어장 관리
            </button>
            <button
              onClick={onViewProgress}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              진도 확인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
