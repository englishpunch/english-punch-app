import * as Tooltip from "@radix-ui/react-tooltip";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type ActivityHeatmapDay = {
  date: string;
  intensity: number;
  questionSeenCount: number;
  revealCount: number;
  ratedCount: number;
};

type ActivityHeatmapCellProps = {
  day: ActivityHeatmapDay;
  active: boolean;
  onSelect: (date: string) => void;
};

export function ActivityHeatmapCell({
  day,
  active,
  onSelect,
}: ActivityHeatmapCellProps) {
  const { t } = useTranslation();
  const dateLabel = day.date;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          aria-label={getHeatmapDayLabel(
            dateLabel,
            t("activity.summary.questionSeen"),
            day.questionSeenCount,
            t("activity.summary.revealed"),
            day.revealCount,
            t("activity.summary.rated"),
            day.ratedCount
          )}
          onClick={() => onSelect(day.date)}
          className="group relative flex h-4 w-4 items-center justify-center outline-none"
        >
          <span
            className={cn(
              "group-focus-visible:ring-primary-500 h-2.5 w-2.5 rounded-[2px] border transition group-hover:ring-2 group-hover:ring-gray-400 group-focus-visible:ring-2 sm:h-3 sm:w-3",
              getHeatmapCellClass(day.intensity),
              active && "ring-2 ring-gray-700"
            )}
          />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          data-activity-heatmap-tooltip
          side="top"
          align="center"
          sideOffset={2}
          collisionPadding={8}
          className="z-50 rounded-md bg-gray-900 px-2 py-1 text-[11px] font-medium whitespace-nowrap text-white shadow-lg"
        >
          <span className="block text-left text-gray-300">{dateLabel}</span>
          <span className="mt-1 grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5">
            <span>{t("activity.summary.questionSeen")}</span>
            <span className="text-right">{day.questionSeenCount}</span>
            <span>{t("activity.summary.revealed")}</span>
            <span className="text-right">{day.revealCount}</span>
            <span>{t("activity.summary.rated")}</span>
            <span className="text-right">{day.ratedCount}</span>
          </span>
          <Tooltip.Arrow className="fill-gray-900" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function getHeatmapCellClass(intensity: number) {
  const classes = [
    "border-gray-200 bg-gray-100",
    "border-emerald-200 bg-emerald-100",
    "border-emerald-300 bg-emerald-300",
    "border-emerald-400 bg-emerald-500",
    "border-emerald-500 bg-emerald-700",
  ];
  return classes[intensity] ?? classes[0];
}

function getHeatmapDayLabel(
  date: string,
  questionSeenLabel: string,
  questionSeenCount: number,
  revealedLabel: string,
  revealCount: number,
  ratedLabel: string,
  ratedCount: number
) {
  return `${date}: ${questionSeenLabel} ${questionSeenCount}, ${revealedLabel} ${revealCount}, ${ratedLabel} ${ratedCount}`;
}
