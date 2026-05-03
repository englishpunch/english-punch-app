import { useMemo, useState } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  HelpCircle,
} from "lucide-react";
import { Spinner } from "./Spinner";
import { ActivityHeatmapCell } from "./ActivityHeatmapCell";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  dayjs,
  DATETIME_FORMAT,
  TIME_FORMAT,
  WEEKDAY_FORMAT,
} from "@/lib/dayjs";

type ActivityEventType =
  | "review_question_seen"
  | "review_answer_revealed"
  | "review_rated";

type ActivityPayload = Record<string, unknown>;

export default function ActivityPage() {
  const { t } = useTranslation();
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const userId = loggedInUser?._id;
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(
    null
  );

  const heatmap = useQuery(
    api.activities.getActivityHeatmap,
    userId ? { userId } : "skip"
  );
  const activeDate = useMemo(() => {
    if (!heatmap) {
      return null;
    }

    const selectedDateExists = heatmap.days.some(
      (day) => day.date === selectedDate
    );
    if (selectedDate && selectedDateExists) {
      return selectedDate;
    }

    const latestRevealDay = [...heatmap.days]
      .reverse()
      .find((day) => day.revealCount > 0);
    return latestRevealDay?.date ?? heatmap.toDate;
  }, [heatmap, selectedDate]);

  const selectedDay = useQuery(
    api.activities.getActivitiesByDate,
    userId && activeDate ? { userId, localDate: activeDate } : "skip"
  );

  const totalReveals = useMemo(
    () => heatmap?.days.reduce((total, day) => total + day.revealCount, 0) ?? 0,
    [heatmap]
  );
  const handleHeatmapDaySelect = (date: string) => {
    setSelectedDate(date);
    setExpandedActivityId(null);
  };

  if (loggedInUser === undefined || (userId && heatmap === undefined)) {
    return <Spinner wrapper="page" />;
  }

  if (!userId) {
    return (
      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-lg font-semibold text-gray-900">
          {t("profilePage.loginRequiredTitle")}
        </p>
        <p className="text-sm text-gray-600">
          {t("profilePage.loginRequiredDescription")}
        </p>
      </div>
    );
  }

  if (!heatmap) {
    return <Spinner wrapper="page" />;
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <div className="text-right text-xs text-gray-500">
          {formatDateRange(heatmap.fromDate, heatmap.toDate)}
        </div>

        <div className="grid grid-cols-[auto_1fr] gap-2">
          <div className="grid grid-rows-7 text-right text-[10px] leading-none text-gray-500">
            {heatmap.days.slice(0, 7).map((day) => (
              <div key={day.date} className="flex h-4 items-center justify-end">
                {formatWeekday(day.date)}
              </div>
            ))}
          </div>
          <Tooltip.Provider
            delayDuration={0}
            skipDelayDuration={0}
            disableHoverableContent
          >
            <div className="grid w-fit grid-flow-col grid-rows-7">
              {heatmap.days.map((day) => (
                <ActivityHeatmapCell
                  key={day.date}
                  day={day}
                  active={activeDate === day.date}
                  onSelect={handleHeatmapDaySelect}
                />
              ))}
            </div>
          </Tooltip.Provider>
        </div>
      </section>

      {totalReveals === 0 ? (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-gray-900">
            {t("activity.emptyTitle")}
          </p>
          <p className="text-sm text-gray-600">
            {t("activity.emptyDescription")}
          </p>
        </div>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {activeDate ? formatDate(activeDate) : ""}
              </h2>
              <p className="text-sm text-gray-600">
                {t("activity.selectedDateSubtitle")}
              </p>
            </div>
            {selectedDay && (
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <SummaryChip
                  label={t("activity.summary.questionSeen")}
                  value={selectedDay.summary.questionSeenCount}
                />
                <SummaryChip
                  label={t("activity.summary.revealed")}
                  value={selectedDay.summary.revealCount}
                />
                <SummaryChip
                  label={t("activity.summary.rated")}
                  value={selectedDay.summary.ratedCount}
                />
              </div>
            )}
          </div>

          {selectedDay === undefined ? (
            <Spinner wrapper="page" />
          ) : selectedDay.activities.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">
              {t("activity.noActivitiesForDate")}
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDay.activities.map((activity) => (
                <ActivityRow
                  key={activity._id}
                  activity={activity}
                  expanded={expandedActivityId === activity._id}
                  onToggle={() =>
                    setExpandedActivityId((current) =>
                      current === activity._id ? null : activity._id
                    )
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function SummaryChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-20 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
      <div className="text-sm font-semibold text-gray-900">{value}</div>
      <div className="mt-0.5 text-[11px] text-gray-500">{label}</div>
    </div>
  );
}

function ActivityRow({
  activity,
  expanded,
  onToggle,
}: {
  activity: {
    _id: string;
    eventType: ActivityEventType;
    occurredAt: number;
    timezone: string;
    payload?: unknown;
  };
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const payload = asPayload(activity.payload);
  const question = getPayloadString(payload, "questionSnapshot");
  const answer = getPayloadString(payload, "answerSnapshot");
  const rating = getPayloadNumber(payload, "rating");
  const canExpand = activity.eventType === "review_answer_revealed" && !!answer;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
          <ActivityIcon eventType={activity.eventType} />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">
              {t(`activity.events.${activity.eventType}`)}
            </p>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Clock3 className="h-3.5 w-3.5" aria-hidden />
              <span
                title={formatTimestampDateTime(
                  activity.occurredAt,
                  activity.timezone
                )}
              >
                {formatTimestampTime(activity.occurredAt, activity.timezone)}
              </span>
            </span>
            {rating !== undefined && <RatingPill rating={rating} />}
          </div>
          {question && (
            <p className="truncate text-sm text-gray-700">{question}</p>
          )}
          {canExpand && expanded && (
            <p className="text-primary-700 text-sm font-semibold">{answer}</p>
          )}
        </div>
        {canExpand && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="focus-visible:ring-primary-500 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:outline-none"
            title={
              expanded ? t("activity.hideAnswer") : t("activity.showAnswer")
            }
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                expanded && "rotate-180"
              )}
              aria-hidden
            />
          </button>
        )}
      </div>
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

function ActivityIcon({ eventType }: { eventType: ActivityEventType }) {
  if (eventType === "review_answer_revealed") {
    return <Eye className="h-4 w-4" aria-hidden />;
  }
  if (eventType === "review_rated") {
    return <CheckCircle2 className="h-4 w-4" aria-hidden />;
  }
  return <HelpCircle className="h-4 w-4" aria-hidden />;
}

function asPayload(payload: unknown): ActivityPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }
  return payload as ActivityPayload;
}

function getPayloadString(payload: ActivityPayload, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getPayloadNumber(payload: ActivityPayload, key: string) {
  const value = payload[key];
  return typeof value === "number" ? value : undefined;
}

function formatDate(date: string) {
  return date;
}

function formatWeekday(date: string) {
  return dayjs(date).format(WEEKDAY_FORMAT);
}

function formatTimestampTime(timestamp: number, timezone: string) {
  return dayjs(timestamp).tz(timezone).format(TIME_FORMAT);
}

function formatTimestampDateTime(timestamp: number, timezone: string) {
  return dayjs(timestamp).tz(timezone).format(DATETIME_FORMAT);
}

function formatDateRange(fromDate: string, toDate: string) {
  return `${formatDate(fromDate)} - ${formatDate(toDate)}`;
}
