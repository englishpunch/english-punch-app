import { Tag } from "./Tag";
import { useTranslation } from "react-i18next";
export function RatingPill({ rating }: { rating: number }) {
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
    <Tag className={`rounded-full font-semibold ${entry.className}`}>
      {entry.label}
    </Tag>
  );
}
