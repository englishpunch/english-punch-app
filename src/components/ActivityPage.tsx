import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Loader2, Clock3 } from "lucide-react";

export default function ActivityPage() {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const userId = loggedInUser?._id;
  const logs = useQuery(
    api.fsrs.getRecentReviewLogs,
    userId ? { userId, limit: 50 } : "skip"
  );

  if (logs === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2
          className="text-primary-600 h-6 w-6 animate-spin"
          aria-hidden
        />
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-lg font-semibold text-gray-900">
          최근 리뷰 로그가 없습니다
        </p>
        <p className="text-sm text-gray-600">
          학습을 시작하면 기록이 여기에 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {logs.map((log) => (
        <div
          key={log._id}
          className="flex items-start justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <RatingPill rating={log.rating} />
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Clock3 className="h-3.5 w-3.5" aria-hidden />
                {new Date(log.review).toLocaleString()}
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {log.question || "카드 내용 없음"}
            </p>
          </div>
          <div className="text-right text-xs text-gray-500">
            {log.duration ? `${Math.round(log.duration)}ms` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

function RatingPill({ rating }: { rating: number }) {
  const config = {
    1: { label: "Again", className: "bg-red-100 text-red-700" },
    2: { label: "Hard", className: "bg-primary-100 text-primary-700" },
    3: { label: "Good", className: "bg-primary-200 text-primary-800" },
    4: { label: "Easy", className: "bg-primary-300 text-primary-900" },
  } as const;
  const entry = config[rating as 1 | 2 | 3 | 4] || config[1];
  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-semibold ${entry.className}`}
    >
      {entry.label}
    </span>
  );
}
