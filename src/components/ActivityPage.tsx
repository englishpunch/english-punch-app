import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Loader2, Clock3 } from "lucide-react";

interface ActivityPageProps {
  userId: Id<"users">;
}

export default function ActivityPage({ userId }: ActivityPageProps) {
  const logs = useQuery(api.fsrs.getRecentReviewLogs, { userId, limit: 50 });

  if (logs === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2
          className="h-6 w-6 animate-spin text-primary-600"
          aria-hidden
        />
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-8 text-center space-y-3">
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
          className="rounded-lg bg-white border border-gray-200 shadow-sm p-4 flex items-start justify-between"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <RatingPill rating={log.rating} />
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" aria-hidden />
                {new Date(log.review).toLocaleString()}
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {log.question || "카드 내용 없음"}
            </p>
          </div>
          <div className="text-xs text-gray-500 text-right">
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
      className={`px-2 py-1 rounded-full text-xs font-semibold ${entry.className}`}
    >
      {entry.label}
    </span>
  );
}
