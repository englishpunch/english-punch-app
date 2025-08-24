import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";

interface ProgressProps {
  onBack: () => void;
}

export function Progress({ onBack }: ProgressProps) {
  const [newDailyGoal, setNewDailyGoal] = useState("");
  const [showGoalForm, setShowGoalForm] = useState(false);

  const userStats = useQuery(api.studySessions.getUserStats);
  const recentSessions = useQuery(api.studySessions.getUserStudySessions, { limit: 10 });
  const updateDailyGoal = useMutation(api.studySessions.updateDailyGoal);

  const handleUpdateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const goal = parseInt(newDailyGoal);
    if (goal > 0) {
      await updateDailyGoal({ dailyGoal: goal });
      setShowGoalForm(false);
      setNewDailyGoal("");
    }
  };

  if (userStats === undefined || recentSessions === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const weekDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          ← Back to Dashboard
        </button>
      </div>

      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Progress</h1>
        <p className="text-gray-600">Track your vocabulary learning journey</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg p-6 shadow-sm border text-center">
          <div className="text-3xl font-bold text-orange-600">{userStats?.currentStreak || 0}</div>
          <p className="text-gray-600">Current Streak</p>
          <p className="text-sm text-gray-500">days</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border text-center">
          <div className="text-3xl font-bold text-blue-600">{userStats?.longestStreak || 0}</div>
          <p className="text-gray-600">Longest Streak</p>
          <p className="text-sm text-gray-500">days</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border text-center">
          <div className="text-3xl font-bold text-green-600">{userStats?.totalWordsLearned || 0}</div>
          <p className="text-gray-600">Words Learned</p>
          <p className="text-sm text-gray-500">total</p>
        </div>
      </div>

      {/* Daily Goal */}
      <div className="bg-white rounded-lg p-6 shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Daily Goal</h2>
          <button
            onClick={() => setShowGoalForm(true)}
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            Edit Goal
          </button>
        </div>

        {showGoalForm ? (
          <form onSubmit={handleUpdateGoal} className="flex items-center space-x-3">
            <input
              type="number"
              value={newDailyGoal}
              onChange={(e) => setNewDailyGoal(e.target.value)}
              placeholder={(userStats?.dailyGoal || 10).toString()}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="1"
              required
            />
            <span className="text-gray-600">words per day</span>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowGoalForm(false)}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          </form>
        ) : (
          <div>
            <p className="text-2xl font-bold text-gray-900">{userStats?.dailyGoal || 10} words per day</p>
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Today's Progress</span>
                <span>
                  {userStats?.weeklyStats[new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as keyof typeof userStats.weeklyStats] || 0} / {userStats?.dailyGoal || 10}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{
                    width: `${Math.min(100, ((userStats?.weeklyStats[new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as keyof typeof userStats.weeklyStats] || 0) / (userStats?.dailyGoal || 10)) * 100)}%`
                  }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Weekly Activity */}
      <div className="bg-white rounded-lg p-6 shadow-sm border">
        <h2 className="text-xl font-semibold mb-4">This Week's Activity</h2>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day, index) => (
            <div key={day} className="text-center">
              <div className="text-sm text-gray-600 mb-2">{dayNames[index]}</div>
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="text-lg font-semibold text-gray-900">
                  {userStats?.weeklyStats[day as keyof typeof userStats.weeklyStats] || 0}
                </div>
                <div className="text-xs text-gray-500">words</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Sessions */}
      <div className="bg-white rounded-lg p-6 shadow-sm border">
        <h2 className="text-xl font-semibold mb-4">Recent Study Sessions</h2>
        {recentSessions.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No study sessions yet</p>
        ) : (
          <div className="space-y-3">
            {recentSessions.map((session) => (
              <div key={session._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="text-lg">
                    {session.sessionType === "flashcards" && "🃏"}
                    {session.sessionType === "quiz" && "❓"}
                    {session.sessionType === "spelling" && "✏️"}
                    {session.sessionType === "definition_match" && "🔗"}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 capitalize">
                      {session.sessionType.replace('_', ' ')}
                    </p>
                    <p className="text-sm text-gray-500">
                      {session.correctAnswers}/{session.totalQuestions} correct
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {Math.floor(session.duration / 60)}m {session.duration % 60}s
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(session.completedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
