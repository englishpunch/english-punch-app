import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "./Button";
import { Plus } from "lucide-react";
import { Spinner } from "./Spinner";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useDueCountAsOf } from "@/hooks/useDueCountAsOf";
import { TableWrapper, Table, THead, TBody, Tr, Th } from "./Table";
import { StudyBagRow } from "./StudyBagRow";

export default function BagManager() {
  const { t } = useTranslation();
  const user = useQuery(api.auth.loggedInUser);
  const now = useDueCountAsOf();
  const bags = useQuery(api.learning.getStudyBags, user ? { now } : "skip");
  const settings = useQuery(
    api.fsrs.getUserSettings,
    user ? { userId: user._id } : "skip"
  );
  const createSampleBag = useMutation(api.learning.createSampleBag);
  const [isCreatingSample, setIsCreatingSample] = useState(false);

  const handleCreateSampleBag = async () => {
    if (!user) {
      return;
    }
    setIsCreatingSample(true);
    try {
      await createSampleBag({ userId: user._id });
    } catch (error) {
      console.error("Failed to create sample bag:", error);
      toast.error(t("bagManager.sample.failed"));
    } finally {
      setIsCreatingSample(false);
    }
  };

  if (bags === undefined) {
    return <Spinner wrapper="page" />;
  }
  if (bags.length === 0) {
    return (
      <div className="space-y-3 px-4 py-10 text-center">
        <h2 className="text-lg font-semibold text-gray-900">
          {t("bagManager.sample.title")}
        </h2>
        <p className="text-sm text-gray-600">
          {t("bagManager.sample.description")}
        </p>
        <Button
          onClick={() => void handleCreateSampleBag()}
          loading={isCreatingSample}
          disabled={!user}
          className="mx-auto"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t("bagManager.sample.create")}
        </Button>
      </div>
    );
  }
  return (
    <TableWrapper edgeToEdge>
      <Table>
        <caption className="sr-only">{t("bagManager.tableCaption")}</caption>
        <THead>
          <Tr>
            <Th scope="col">{t("bagManager.columns.bag")}</Th>
            <Th scope="col" className="w-px text-right whitespace-nowrap">
              {t("bagManager.columns.cards")}
            </Th>
            <Th
              scope="col"
              className="w-px whitespace-nowrap"
              aria-sort="descending"
            >
              {t("bagManager.columns.lastStudied")}
            </Th>
            <Th scope="col" className="w-px text-right">
              {t("bagManager.columns.study")}
            </Th>
          </Tr>
        </THead>
        <TBody>
          {bags.map((bag) => (
            <StudyBagRow
              key={bag._id}
              bag={bag}
              timezone={settings?.timezone ?? "Asia/Seoul"}
            />
          ))}
        </TBody>
      </Table>
    </TableWrapper>
  );
}
