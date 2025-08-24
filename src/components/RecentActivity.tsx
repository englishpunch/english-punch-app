import { Doc } from "../../convex/_generated/dataModel";

interface RecentActivityProps {
  sessions: Doc<"studySessions">[];
}

export function RecentActivity({ sessions }: RecentActivityProps) {
  if (sessions.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <p className="text-gray-500 text-center py-8">No study sessions yet. Start learning to see your progress!</p>
      </div>
    );
  }

  const getSessionIcon = (type: string) => {
    switch (type) {
      case "flashcards": return "🃏";
      case "quiz": return "❓";
      case "spelling": return "✏️";
      case "definition_match": return "🔗";
      default: return "📚";
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return minutes > 0 ? `${minutes}m` : `${seconds}s`;
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
      <div className="space-y-3">
        {sessions.map((session) => (
          <div key={session._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="text-xl">{getSessionIcon(session.sessionType)}</div>
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
                {formatDuration(session.duration)}
              </p>
              <p className="text-xs text-gray-500">
                {new Date(session.completedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
