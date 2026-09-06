import { Button } from "./Button";
import { TableWrapper, Table, THead, TBody, Tr, Th, Td } from "./Table";
import { useMemo, useState } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Spinner } from "./Spinner";
import { ActivityHeatmapCell } from "./ActivityHeatmapCell";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ActivityHistoryRow } from "./ActivityHistoryRow";

type ActivityEventType =
  "review_question_seen" | "review_answer_revealed" | "review_rated";

export default function ActivityPage() {
  const { t } = useTranslation();
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const userId = loggedInUser?._id;
  const [eventFilter, setEventFilter] =
    useState<ActivityEventType>("review_rated");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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
      .find(
        (day) =>
          day.ratedCount > 0 || day.revealCount > 0 || day.questionSeenCount > 0
      );
    return latestRevealDay?.date ?? heatmap.toDate;
  }, [heatmap, selectedDate]);

  const selectedDay = useQuery(
    api.activities.getActivitiesByDate,
    userId && activeDate ? { userId, localDate: activeDate } : "skip"
  );

  const filteredActivities = selectedDay?.activities.filter(
    (activity) => activity.eventType === eventFilter
  );
  const totalActivities = useMemo(
    () =>
      heatmap?.days.reduce(
        (total, day) =>
          total + day.questionSeenCount + day.revealCount + day.ratedCount,
        0
      ) ?? 0,
    [heatmap]
  );
  const handleHeatmapDaySelect = (date: string) => {
    setSelectedDate(date);
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
    <div className="relative space-y-4 py-3">
      <section
        aria-label={t("activity.heatmapAriaLabel")}
        data-testid="activity-heatmap"
        className="space-y-2 px-3"
      >
        <div className="text-right text-xs text-gray-500">
          {formatDateRange(heatmap.fromDate, heatmap.toDate)}
        </div>

        <div className="overflow-x-auto pb-1">
          <Tooltip.Provider
            delayDuration={0}
            skipDelayDuration={0}
            disableHoverableContent
          >
            <div
              role="group"
              aria-label={t("activity.heatmapGridAriaLabel")}
              data-testid="activity-heatmap-grid"
              className="grid w-full min-w-[500px] grid-flow-col grid-rows-7"
              style={{
                gridTemplateColumns: `repeat(${Math.ceil(heatmap.days.length / 7)}, minmax(0, 1fr))`,
              }}
            >
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

      {totalActivities === 0 ? (
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
          <div className="flex flex-wrap items-center justify-between gap-2 px-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {activeDate ? formatDate(activeDate) : ""}
              </h2>
              <p className="text-sm text-gray-600">
                {t("activity.selectedDateSubtitle")}
              </p>
            </div>
            <div
              role="group"
              aria-label={t("activity.filtersLabel")}
              className="flex flex-wrap gap-2"
            >
              {(
                [
                  [
                    "review_question_seen",
                    "questionSeen",
                    selectedDay?.summary.questionSeenCount,
                  ],
                  [
                    "review_answer_revealed",
                    "revealed",
                    selectedDay?.summary.revealCount,
                  ],
                  ["review_rated", "rated", selectedDay?.summary.ratedCount],
                ] as const
              ).map(([eventType, label, count]) => (
                <Button
                  variant="plain"
                  size="sm"
                  key={eventType}
                  type="button"
                  aria-pressed={eventFilter === eventType}
                  onClick={() => setEventFilter(eventType)}
                  className={cn(
                    "focus-visible:ring-primary-500 flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm font-medium transition focus-visible:ring-2 focus-visible:outline-none",
                    eventFilter === eventType
                      ? "border-primary-300 bg-primary-50 text-primary-800"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {t(`activity.summary.${label}`)}
                  <span className="rounded-md bg-black/5 px-1.5 text-xs tabular-nums">
                    {count ?? "—"}
                  </span>
                </Button>
              ))}
            </div>
          </div>

          {selectedDay === undefined ? (
            <Spinner wrapper="page" />
          ) : (
            <TableWrapper edgeToEdge>
              <Table className="w-full table-fixed border-collapse text-left">
                <caption className="sr-only">
                  {t("activity.selectedDateSubtitle")} {activeDate}
                </caption>
                <THead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500">
                  <Tr>
                    <Th scope="col" className="w-16 font-medium">
                      {t("activity.columns.time")}
                    </Th>
                    <Th scope="col" className="font-medium">
                      {t("activity.columns.question")}
                    </Th>
                    <Th scope="col" className="w-20 font-medium">
                      {t("activity.columns.rating")}
                    </Th>
                  </Tr>
                </THead>
                <TBody className="divide-y divide-gray-100">
                  {filteredActivities?.length === 0 ? (
                    <Tr>
                      <Td
                        colSpan={3}
                        className="px-4 py-12 text-center text-gray-500"
                      >
                        {t(
                          selectedDay.activities.length === 0
                            ? "activity.noActivitiesForDate"
                            : "activity.noMatchingActivities"
                        )}
                      </Td>
                    </Tr>
                  ) : (
                    filteredActivities?.map((activity) => (
                      <ActivityHistoryRow
                        key={activity._id}
                        activity={activity}
                        relatedActivities={selectedDay.activities}
                      />
                    ))
                  )}
                </TBody>
              </Table>
            </TableWrapper>
          )}
        </section>
      )}
    </div>
  );
}

function formatDate(date: string) {
  return date;
}

function formatDateRange(fromDate: string, toDate: string) {
  return `${formatDate(fromDate)} - ${formatDate(toDate)}`;
}
