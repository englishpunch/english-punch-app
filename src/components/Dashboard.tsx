import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { StatsCard } from "./StatsCard";
import { QuickActions } from "./QuickActions";
import { RecentActivity } from "./RecentActivity";

interface DashboardProps {
  onStartStudy: (mode: "flashcards" | "quiz" | "spelling" | "definition_match", wordListId?: string) => void;
  onViewLists: () => void;
  onViewProgress: () => void;
}

export function Dashboard({ onStartStudy, onViewLists, onViewProgress }: DashboardProps) {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back!</h1>
        <p className="text-gray-600">Ready to expand your vocabulary?</p>
      </div>

      {/* Stats Overview */}
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

      {/* Quick Actions */}
      <QuickActions
        onStartStudy={onStartStudy}
        onViewLists={onViewLists}
        onViewProgress={onViewProgress}
        wordsForReview={wordsForReview?.length || 0}
      />

      {/* Recent Activity */}
      <RecentActivity sessions={recentSessions || []} />

      {/* Sample Data Button (for demo purposes) */}
      {wordsForReview?.length === 0 && (
        <div className="bg-yellow-50 rounded-lg p-6 shadow-sm border border-yellow-200">
          <div className="text-center">
            <h3 className="text-lg font-medium text-yellow-900 mb-2">Get Started</h3>
            <p className="text-yellow-700 mb-4">
              No vocabulary words found. Add some sample words to start learning!
            </p>
            <button
              onClick={() => populateSampleWords()}
              className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            >
              Add Sample Words
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
