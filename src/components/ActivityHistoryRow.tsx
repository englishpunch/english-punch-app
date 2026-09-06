import { Tr, Td } from "./Table";
import { Tag } from "./Tag";
import { useTranslation } from "react-i18next";
import { dayjs, TIME_FORMAT, DATETIME_FORMAT } from "@/lib/dayjs";
import { RatingPill } from "./ActivityRatingPill";

type Activity = {
  _id: string;
  eventType: "review_question_seen" | "review_answer_revealed" | "review_rated";
  occurredAt: number;
  timezone: string;
  attemptId?: string;
  payload?: unknown;
};

export function ActivityHistoryRow({
  activity,
  relatedActivities,
}: {
  activity: Activity;
  relatedActivities: Activity[];
}) {
  const { t } = useTranslation();
  const payload = asPayload(activity.payload);
  // Rated events omit card snapshots; use only events from the same attempt.
  const snapshots = activity.attemptId
    ? relatedActivities
        .filter((event) => event.attemptId === activity.attemptId)
        .map((event) => asPayload(event.payload))
    : [];
  const question =
    getString(payload, "questionSnapshot") ??
    snapshots
      .map((snapshot) => getString(snapshot, "questionSnapshot"))
      .find(Boolean);
  const answer =
    getString(payload, "answerSnapshot") ??
    snapshots
      .map((snapshot) => getString(snapshot, "answerSnapshot"))
      .find(Boolean);
  const rating =
    typeof payload.rating === "number" ? payload.rating : undefined;

  return (
    <Tr className="hover:bg-gray-50/70">
      <Td
        className="text-gray-500 tabular-nums"
        title={dayjs(activity.occurredAt)
          .tz(activity.timezone)
          .format(DATETIME_FORMAT)}
      >
        {dayjs(activity.occurredAt).tz(activity.timezone).format(TIME_FORMAT)}
      </Td>
      <Td className="break-words text-gray-900">
        <div className="leading-5">
          {question ?? t("activity.noCardContent")}
        </div>
        {answer && (
          <Tag
            className="mt-1"
            aria-label={`${t("bagDetail.tableHeaders.answer")}: ${answer}`}
          >
            {answer}
          </Tag>
        )}
      </Td>
      <Td>
        {rating !== undefined ? (
          <RatingPill rating={rating} />
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </Td>
    </Tr>
  );
}

function asPayload(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

function getString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
