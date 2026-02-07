import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Clock3 } from "lucide-react";
import { Spinner } from "./Spinner";
import { useTranslation } from "react-i18next";
import { getLocaleForLanguage } from "@/i18n";

export default function ActivityPage() {
  const { t, i18n } = useTranslation();
  const locale = getLocaleForLanguage(i18n.language);
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const userId = loggedInUser?._id;
  const logs = useQuery(
    api.fsrs.getRecentReviewLogs,
    userId ? { userId, limit: 50 } : "skip"
  );

  if (logs === undefined) {
    return <Spinner wrapper="page" />;
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-lg font-semibold text-gray-900">
          {t("activity.emptyTitle")}
        </p>
        <p className="text-sm text-gray-600">
          {t("activity.emptyDescription")}
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
                {new Date(log.review).toLocaleString(locale)}
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {log.question || t("activity.noCardContent")}
            </p>
          </div>
          <div className="text-right text-xs text-gray-500">
            {log.duration
              ? t("activity.durationMs", {
                  ms: Math.round(log.duration),
                })
              : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

function RatingPill({ rating }: { rating: number }) {
  const { t } = useTranslation();
  const config = {
    1: {
      label: t("ratings.labels.again"),
      className: "bg-red-100 text-red-700",
    },
    2: {
      label: t("ratings.labels.hard"),
      className: "bg-primary-100 text-primary-700",
    },
    3: {
      label: t("ratings.labels.good"),
      className: "bg-primary-200 text-primary-800",
    },
    4: {
      label: t("ratings.labels.easy"),
      className: "bg-primary-300 text-primary-900",
    },
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
