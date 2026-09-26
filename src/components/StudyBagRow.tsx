import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import { dayjs, DATETIME_FORMAT } from "@/lib/dayjs";
import { Button } from "./Button";
import { buttonVariants } from "./buttonVariants";
import { Td, Tr } from "./Table";

type StudyBag = FunctionReturnType<typeof api.learning.getStudyBags>[number];

export function StudyBagRow({
  bag,
  timezone,
}: {
  bag: StudyBag;
  timezone: string;
}) {
  const { t } = useTranslation();
  return (
    <Tr>
      <Td className="align-middle font-medium break-words text-gray-900">
        {bag.name}
        {!bag.isActive && (
          <span className="ml-2 text-xs font-normal text-gray-500">
            {t("bagManager.inactive")}
          </span>
        )}
      </Td>
      <Td className="text-right align-middle text-gray-600 tabular-nums">
        {bag.totalCards}
      </Td>
      <Td className="align-middle text-xs whitespace-nowrap text-gray-500 tabular-nums">
        {bag.lastReviewedAt === null ? (
          t("bagManager.neverStudied")
        ) : (
          <time dateTime={dayjs(bag.lastReviewedAt).toISOString()}>
            {dayjs(bag.lastReviewedAt).tz(timezone).format(DATETIME_FORMAT)}
          </time>
        )}
      </Td>
      <Td className="text-right align-middle whitespace-nowrap">
        {bag.dueCount > 0 ? (
          <Link
            to="/run/$bagId"
            params={{ bagId: bag._id }}
            aria-label={t("bagManager.actions.studyWithCount", {
              count: bag.dueCount,
            })}
            className={buttonVariants({ size: "sm" })}
          >
            {t("bagManager.actions.studyCompact")}
          </Link>
        ) : (
          <Button size="sm" variant="secondary" disabled>
            {t("bagManager.actions.noCardsCompact")}
          </Button>
        )}
      </Td>
    </Tr>
  );
}
